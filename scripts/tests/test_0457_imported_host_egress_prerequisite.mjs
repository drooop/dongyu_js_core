#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AdmZipPkg from 'adm-zip';
import { ModelTableRuntime } from '../../packages/worker-base/src/runtime.mjs';

const AdmZip = AdmZipPkg && AdmZipPkg.default ? AdmZipPkg.default : AdmZipPkg;

const RESERVED_ENVELOPE_EXTENSION_EXACT_KEYS = [
  '__mt_payload_kind',
  '__mt_request_id',
  'op_id',
  'request_id',
  'correlation_id',
  'message_role',
  'bus',
  'bus_out_key',
  'route_kind',
  'topic',
  'response_topic',
  'timestamp',
  'payload',
  'payload_model_id',
  'bundle_record_id_offset',
  'worker_id',
  'model_id',
  'table_id',
  'pin',
  'principal_ref',
  'principal_id',
  'authority',
  'identity',
  'source_model_id',
  'route',
  'reply_to',
  'route.reply_to',
  'response_pin',
  'return_topic',
  'returnTopic',
  'result_topic',
  'envelope_extension_keys',
];

const RESERVED_ENVELOPE_EXTENSION_PREFIXES = [
  '__mt_',
  'endpoint_',
  'origin_',
  'reply_target_',
  'principal_',
  'owner_',
  'payload_',
  'response_',
  'return_',
  'route_',
  'source_',
  'model_',
  'sys_',
];

const EXACT_MAX_LENGTH_EXTENSION_KEY = `x${'a'.repeat(63)}`;
const EXACT_MAX_EXTENSION_KEYS = [
  'is_need_response',
  'message_server',
  'between',
  'send_user',
  'receive_user',
  'custom_trace',
  ...Array.from({ length: 9 }, (_, index) => `boundary_${index}`),
  EXACT_MAX_LENGTH_EXTENSION_KEY,
];

const SERVER_LIFECYCLE_PROBE_HELPERS = String.raw`
      const lifecycleCapture = (() => {
        const programWarnings = [];
        const unhandledRejections = [];
        const originalWarn = console.warn;
        const onUnhandledRejection = (reason) => {
          unhandledRejections.push(reason instanceof Error ? (reason.stack || reason.message) : String(reason));
        };
        console.warn = (...args) => {
          const line = args.map((value) => value instanceof Error ? (value.stack || value.message) : String(value)).join(' ');
          if (/\[ProgramModelEngine\]/u.test(line)) {
            programWarnings.push(line);
          }
          originalWarn(...args);
        };
        process.on('unhandledRejection', onUnhandledRejection);
        return {
          programWarnings,
          unhandledRejections,
          restore() {
            process.off('unhandledRejection', onUnhandledRejection);
            console.warn = originalWarn;
          },
        };
      })();

      const awaitBoundedQuietTurn = async () => {
        await Promise.resolve();
        await new Promise((resolve) => setTimeout(resolve, 20));
        await Promise.resolve();
      };
      const lifecycleSnapshot = (state) => JSON.stringify(state.snapshot());
      const assertServerLifecycleApi = (state, description) => {
        assert.deepEqual(
          { whenReady: typeof state?.whenReady, shutdown: typeof state?.shutdown },
          { whenReady: 'function', shutdown: 'function' },
          description + ': createServerState must expose whenReady() and shutdown()',
        );
      };
      const awaitServerReady = async (state, description) => {
        assertServerLifecycleApi(state, description);
        await state.whenReady();
        await assertWhenReadyWaitsForControlledWork(state, description);
        await assertWhenReadyPropagatesControlledRejection(state, description);
        const settledSnapshot = lifecycleSnapshot(state);
        const warningCount = lifecycleCapture.programWarnings.length;
        const rejectionCount = lifecycleCapture.unhandledRejections.length;
        await awaitBoundedQuietTurn();
        assert.equal(lifecycleSnapshot(state), settledSnapshot, description + ': whenReady() must include every startup chain');
        assert.equal(
          lifecycleCapture.programWarnings.length,
          warningCount,
          description + ': whenReady() must not leave any late ProgramModelEngine warning',
        );
        assert.equal(
          lifecycleCapture.unhandledRejections.length,
          rejectionCount,
          description + ': whenReady() must not leave a late unhandledRejection',
        );
      };
      const createDeferred = () => {
        let resolvePromise;
        let rejectPromise;
        let settled = false;
        const promise = new Promise((resolve, reject) => {
          resolvePromise = (value) => {
            if (settled) return;
            settled = true;
            resolve(value);
          };
          rejectPromise = (error) => {
            if (settled) return;
            settled = true;
            reject(error);
          };
        });
        return { promise, resolve: resolvePromise, reject: rejectPromise };
      };
      const assertPromisePending = async (promise, description) => {
        let settled = false;
        promise.then(
          () => { settled = true; },
          () => { settled = true; },
        );
        await awaitBoundedQuietTurn();
        assert.equal(settled, false, description);
      };
      const assertWhenReadyWaitsForControlledWork = async (state, description) => {
        const tickDeferred = createDeferred();
        const matrixInitDeferred = createDeferred();
        let trackedTick;
        trackedTick = tickDeferred.promise.finally(() => {
          if (state.programEngine.tickInFlight === trackedTick) {
            state.programEngine.tickInFlight = null;
          }
        });
        let trackedMatrixInit;
        trackedMatrixInit = matrixInitDeferred.promise.finally(() => {
          if (state.programEngine.matrixAdapterInitPromise === trackedMatrixInit) {
            state.programEngine.matrixAdapterInitPromise = null;
          }
        });
        state.programEngine.tickInFlight = trackedTick;
        state.programEngine.matrixAdapterInitPromise = trackedMatrixInit;

        const readiness = state.whenReady();
        await assertPromisePending(
          readiness,
          description + ': whenReady must remain pending while tickInFlight is active',
        );
        tickDeferred.resolve();
        await assertPromisePending(
          readiness,
          description + ': whenReady must remain pending while Matrix initialization is active',
        );
        matrixInitDeferred.resolve();
        await readiness;
        assert.equal(state.programEngine.tickInFlight, null, description + ': readiness must settle the controlled tick');
        assert.equal(
          state.programEngine.matrixAdapterInitPromise,
          null,
          description + ': readiness must settle controlled Matrix initialization',
        );
      };
      const assertWhenReadyPropagatesControlledRejection = async (state, description) => {
        const rejectionDeferred = createDeferred();
        const expectedError = new Error(description + ': controlled readiness rejection');
        let rejectingMatrixInit;
        rejectingMatrixInit = rejectionDeferred.promise.then(() => {
          throw expectedError;
        }).finally(() => {
          if (state.programEngine.matrixAdapterInitPromise === rejectingMatrixInit) {
            state.programEngine.matrixAdapterInitPromise = null;
          }
        });
        state.programEngine.matrixAdapterInitPromise = rejectingMatrixInit;
        const readiness = state.whenReady();
        await assertPromisePending(
          readiness,
          description + ': rejecting Matrix initialization must remain pending until released',
        );
        rejectionDeferred.resolve();
        await assert.rejects(
          readiness,
          (error) => error === expectedError,
          description + ': whenReady must propagate the original controlled rejection',
        );
        assert.equal(
          state.programEngine.matrixAdapterInitPromise,
          null,
          description + ': rejected readiness must release the tracked Matrix initialization',
        );
      };
      const installObservableLifecycleResources = (state, description) => {
        const calls = {
          mqtt_end: 0,
          matrix_unsubscribe: 0,
          matrix_close: 0,
          persistence_close: 0,
        };
        const completion = {
          tick: false,
          matrix_init: false,
          matrix_action: false,
          rejecting_matrix_action: false,
        };
        const closeCompletion = {
          mqtt: false,
          matrix: false,
        };
        const tickDeferred = createDeferred();
        const matrixInitDeferred = createDeferred();
        const matrixActionDeferred = createDeferred();
        const rejectingMatrixActionDeferred = createDeferred();
        const matrixCloseDeferred = createDeferred();
        let mqttEndCallback = null;
        const allWorkCompleted = () => Object.values(completion).every(Boolean);
        const assertWorkDrained = (resource) => {
          assert.equal(
            allWorkCompleted(),
            true,
            description + ': ' + resource + ' must close only after pending tick/init/actions drain',
          );
        };

        const matrixAdapter = {
          close() {
            assertWorkDrained('Matrix adapter');
            calls.matrix_close += 1;
            return matrixCloseDeferred.promise.then(() => {
              closeCompletion.matrix = true;
            });
          },
        };
        state.programEngine.matrixAdapter = matrixAdapter;
        state.programEngine.matrixAdapterUnsub = () => {
          assertWorkDrained('Matrix subscription');
          calls.matrix_unsubscribe += 1;
        };
        state.programEngine.controlBusClient = {
          connected: true,
          end(...args) {
            assertWorkDrained('MQTT adapter');
            calls.mqtt_end += 1;
            const callback = [...args].reverse().find((value) => typeof value === 'function') || null;
            assert.equal(typeof callback, 'function', description + ': MQTT close must provide a completion callback');
            assert.equal(mqttEndCallback, null, description + ': MQTT close callback must be registered once');
            mqttEndCallback = callback;
            return this;
          },
          off() {},
          removeAllListeners() {},
        };
        state.programEngine.controlBusReady = true;

        const tickPromise = tickDeferred.promise.then(() => {
          const model0 = state.runtime.getModel(0);
          const applied = state.runtime.addLabel(model0, 0, 0, 0, {
            k: 'lifecycle_shutdown_tick_probe',
            t: 'str',
            v: description,
          });
          assert.equal(applied?.applied, true, description + ': controlled tick mutation must complete before persistence closes');
          completion.tick = true;
        });
        const trackedTick = tickPromise.finally(() => {
          if (state.programEngine.tickInFlight === trackedTick) state.programEngine.tickInFlight = null;
        });
        state.programEngine.tickInFlight = trackedTick;
        state.programEngine.tickRequested = true;

        const matrixInitPromise = matrixInitDeferred.promise.then(() => {
          completion.matrix_init = true;
          return matrixAdapter;
        }).finally(() => {
          if (state.programEngine.matrixAdapterInitPromise === matrixInitPromise) {
            state.programEngine.matrixAdapterInitPromise = null;
          }
        });
        state.programEngine.matrixAdapterInitPromise = matrixInitPromise;

        state.programEngine.trackMatrixHostAction(matrixActionDeferred.promise.then(() => {
          completion.matrix_action = true;
        }));
        state.programEngine.trackMatrixHostAction(rejectingMatrixActionDeferred.promise.then(() => {
          completion.rejecting_matrix_action = true;
          throw new Error('lifecycle_controlled_rejection');
        }));

        const persistence = state.runtime.persistence;
        assert.ok(persistence && typeof persistence.close === 'function', description + ': SQLite persister must be active');
        const originalPersistenceClose = persistence.close.bind(persistence);
        persistence.close = (...args) => {
          assertWorkDrained('SQLite persister');
          calls.persistence_close += 1;
          return originalPersistenceClose(...args);
        };

        return {
          calls,
          closeCompletion,
          completion,
          releaseTick: () => tickDeferred.resolve(),
          releaseMatrixInit: () => matrixInitDeferred.resolve(),
          releaseMatrixAction: () => matrixActionDeferred.resolve(),
          releaseRejectingMatrixAction: () => rejectingMatrixActionDeferred.resolve(),
          releaseMqttClose: () => {
            assert.equal(typeof mqttEndCallback, 'function', description + ': MQTT close must start before release');
            closeCompletion.mqtt = true;
            const callback = mqttEndCallback;
            mqttEndCallback = null;
            callback(null);
          },
          releaseMatrixClose: () => {
            assert.equal(calls.matrix_close, 1, description + ': Matrix close must start before release');
            matrixCloseDeferred.resolve();
          },
        };
      };
      const expectedShutdownResult = {
        mode: 'edit',
        pending_matrix_host_actions: 0,
        mqtt_active: false,
        matrix_active: false,
        persistence_closed: true,
        background_work_pending: 0,
      };
      const shutdownAndAssertQuiet = async (state, description) => {
        assert.equal(typeof state?.shutdown, 'function', description + ': createServerState must expose shutdown()');
        const resources = installObservableLifecycleResources(state, description);
        const warningStart = lifecycleCapture.programWarnings.length;
        let shutdownSettled = false;
        let concurrentShutdownSettled = false;
        const firstShutdown = state.shutdown();
        const concurrentShutdown = state.shutdown();
        assert.equal(typeof firstShutdown?.then, 'function', description + ': first shutdown must be waitable');
        assert.equal(typeof concurrentShutdown?.then, 'function', description + ': concurrent shutdown must be waitable');
        firstShutdown.then(
          () => { shutdownSettled = true; },
          () => { shutdownSettled = true; },
        );
        concurrentShutdown.then(
          () => { concurrentShutdownSettled = true; },
          () => { concurrentShutdownSettled = true; },
        );
        const assertShutdownsPending = (phase) => {
          assert.equal(shutdownSettled, false, description + ': first shutdown ' + phase);
          assert.equal(concurrentShutdownSettled, false, description + ': concurrent shutdown ' + phase);
        };
        await awaitBoundedQuietTurn();
        assertShutdownsPending('must wait for the controlled pending tick');
        resources.releaseTick();
        await awaitBoundedQuietTurn();
        assertShutdownsPending('must also wait for Matrix initialization');
        resources.releaseMatrixInit();
        await awaitBoundedQuietTurn();
        assertShutdownsPending('must also wait for pending Matrix host actions');
        resources.releaseMatrixAction();
        await awaitBoundedQuietTurn();
        assertShutdownsPending('must drain a rejecting Matrix host action too');
        resources.releaseRejectingMatrixAction();
        await awaitBoundedQuietTurn();
        assertShutdownsPending('must wait for asynchronous adapter closure');
        assert.equal(
          resources.calls.mqtt_end + resources.calls.matrix_close > 0,
          true,
          description + ': shutdown must begin at least one active adapter close after work drains',
        );
        const mqttCloseStarted = resources.calls.mqtt_end === 1;
        const matrixCloseStarted = resources.calls.matrix_close === 1;
        const firstClose = mqttCloseStarted && matrixCloseStarted
          ? (/first state/u.test(description) ? 'matrix' : 'mqtt')
          : (mqttCloseStarted ? 'mqtt' : 'matrix');
        if (firstClose === 'mqtt') resources.releaseMqttClose();
        else resources.releaseMatrixClose();
        await awaitBoundedQuietTurn();
        assertShutdownsPending('must remain pending until every asynchronous adapter close settles');
        let secondCloseStarted = false;
        for (let attempt = 0; attempt < 10; attempt += 1) {
          secondCloseStarted = firstClose === 'mqtt'
            ? resources.calls.matrix_close === 1
            : resources.calls.mqtt_end === 1;
          if (secondCloseStarted) break;
          await awaitBoundedQuietTurn();
        }
        assert.equal(
          secondCloseStarted,
          true,
          description + ': shutdown must start the remaining asynchronous adapter close',
        );
        assertShutdownsPending('must remain pending immediately before the final adapter close settles');
        if (firstClose === 'mqtt') resources.releaseMatrixClose();
        else resources.releaseMqttClose();
        const [firstResult, concurrentResult] = await Promise.all([firstShutdown, concurrentShutdown]);
        assert.deepEqual(
          concurrentResult,
          firstResult,
          description + ': concurrent shutdown callers must observe the same complete lifecycle result',
        );
        assert.deepEqual(resources.completion, {
          tick: true,
          matrix_init: true,
          matrix_action: true,
          rejecting_matrix_action: true,
        }, description + ': every controlled lifecycle task must settle before shutdown returns');
        assert.deepEqual(firstResult, expectedShutdownResult, description + ': shutdown result must expose complete lifecycle closure');
        assert.deepEqual(
          resources.closeCompletion,
          { mqtt: true, matrix: true },
          description + ': shutdown must await both asynchronous adapter close completions',
        );
        assert.deepEqual(resources.calls, {
          mqtt_end: 1,
          matrix_unsubscribe: 1,
          matrix_close: 1,
          persistence_close: 1,
        }, description + ': shutdown must invoke every real resource disposer exactly once');
        assert.equal(state.getRuntimeMode(), 'edit', description + ': shutdown must leave runtime in edit mode');
        assert.equal(state.runtime.isRunLoopActive(), false, description + ': shutdown must stop the runtime run loop');
        assert.equal(state.programEngine.pendingMatrixHostActions.size, 0, description + ': shutdown must drain Matrix host actions');
        assert.equal(state.programEngine.tickInFlight, null, description + ': shutdown must await the active program-engine tick');
        assert.equal(state.programEngine.tickRequested, false, description + ': shutdown must leave no queued program-engine tick');
        assert.equal(state.programEngine.controlBusClient, null, description + ': shutdown must close and release the MQTT adapter');
        assert.equal(state.programEngine.controlBusReady, false, description + ': shutdown must clear MQTT readiness');
        assert.equal(state.programEngine.matrixAdapter, null, description + ': shutdown must close and release the Matrix adapter');
        assert.equal(state.programEngine.matrixAdapterUnsub, null, description + ': shutdown must remove the Matrix subscription');
        assert.equal(state.programEngine.matrixAdapterInitPromise, null, description + ': shutdown must await Matrix adapter initialization');
        const controlledWarnings = lifecycleCapture.programWarnings.slice(warningStart);
        assert.equal(controlledWarnings.length, 1, description + ': rejecting Matrix action must produce exactly one visible warning');
        assert.match(
          controlledWarnings[0],
          /\[ProgramModelEngine\] Matrix host action failed: lifecycle_controlled_rejection/u,
          description + ': rejecting Matrix action warning must remain observable',
        );

        const completedShutdown = state.shutdown();
        assert.equal(typeof completedShutdown?.then, 'function', description + ': completed shutdown must remain waitable');
        const secondResult = await completedShutdown;
        assert.deepEqual(secondResult, firstResult, description + ': shutdown must be idempotent');
        assert.deepEqual(resources.calls, {
          mqtt_end: 1,
          matrix_unsubscribe: 1,
          matrix_close: 1,
          persistence_close: 1,
        }, description + ': idempotent shutdown must not invoke resource disposers twice');
        const settledSnapshot = lifecycleSnapshot(state);
        const warningCount = lifecycleCapture.programWarnings.length;
        const rejectionCount = lifecycleCapture.unhandledRejections.length;
        await awaitBoundedQuietTurn();
        assert.equal(lifecycleSnapshot(state), settledSnapshot, description + ': snapshot must not change after shutdown');
        assert.equal(
          lifecycleCapture.programWarnings.length,
          warningCount,
          description + ': no late ProgramModelEngine warning is allowed after shutdown',
        );
        assert.equal(
          lifecycleCapture.unhandledRejections.length,
          rejectionCount,
          description + ': no late unhandledRejection is allowed after shutdown',
        );
        assert.deepEqual(
          lifecycleCapture.unhandledRejections,
          [],
          description + ': lifecycle work must not produce unhandled rejections',
        );
      };
`;

function mt(k, t, v, id = 0, p = 0, r = 0, c = 0) {
  return { id, p, r, c, k, t, v };
}

function rootRecord(records, key) {
  return Array.isArray(records)
    ? records.find((record) => record && record.id === 0 && record.p === 0 && record.r === 0 && record.c === 0 && record.k === key) || null
    : null;
}

function payloadRecords(records, payloadModelId = 1) {
  return Array.isArray(records) ? records.filter((record) => record && record.id === payloadModelId) : [];
}

function buildZipBuffer(payload) {
  const zip = new AdmZip();
  zip.addFile('app_payload.json', Buffer.from(JSON.stringify(payload, null, 2), 'utf8'));
  return zip.toBuffer();
}

function dualBusDeclaration(overrides = {}) {
  return {
    mode: 'imported_host_egress',
    egress_pins: ['resource', 'data'],
    egress_routes: [
      { pin_name: 'resource', route_kind: 'control' },
      { pin_name: 'data', route_kind: 'management' },
    ],
    envelope_extension_keys: [
      'is_need_response',
      'message_server',
      'between',
      'send_user',
      'receive_user',
      'custom_trace',
    ],
    ...overrides,
  };
}

function genericDualBusDeclaration(overrides = {}) {
  return dualBusDeclaration({
    egress_pins: ['alpha', 'omega'],
    egress_routes: [],
    ...overrides,
  });
}

function appPayload(dualBus = dualBusDeclaration(), { routeKind = 'control' } = {}) {
  const egressPins = Array.isArray(dualBus?.egress_pins) ? dualBus.egress_pins : [];
  return [
    mt('model_type', 'model.table', 'UI.0457HostEgressPrerequisite'),
    mt('app_name', 'str', '0457 Host Egress Prerequisite'),
    mt('slide_app_summary', 'str', 'Exercises generic per-pin routes and safe v2 envelope extensions.'),
    mt('source_worker', 'str', '0457-host-egress-prerequisite'),
    mt('slide_capable', 'bool', true),
    mt('slide_surface_type', 'str', 'workspace.page'),
    mt('from_user', 'str', '@ui:localhost'),
    mt('to_user', 'str', '@mbr:localhost'),
    mt('ui_authoring_version', 'str', 'cellwise.ui.v1'),
    mt('ui_root_node_id', 'str', 'it0457_host_egress_root'),
    mt('remote_bus_endpoint_v1', 'json', {
      transport: 'mqtt',
      ...(routeKind ? { route_kind: routeKind } : {}),
      to: { worker_id: 'R1', model_id: 3200 },
    }),
    mt('dual_bus_model', 'json', dualBus),
    ...egressPins.map((pinName) => mt(pinName, 'pin.out', null)),
  ];
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0457-host-egress-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0457_host_egress_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  process.env.DY_UI_SERVER_WORKER_ID = 'U1';
  const { buildSlideAppExportPayload, createServerState } = await import(
    new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url)
  );
  let state = null;
  try {
    state = createServerState({ dbPath: null });
    assert.deepEqual(
      { whenReady: typeof state?.whenReady, shutdown: typeof state?.shutdown },
      { whenReady: 'function', shutdown: 'function' },
      'every createServerState test fixture must expose waitable readiness and shutdown',
    );
    await state.whenReady();
    await state.activateRuntimeMode('running');
    await state.whenReady();
    return await fn(state, buildSlideAppExportPayload);
  } finally {
    if (state && typeof state.shutdown === 'function') {
      const firstShutdown = await state.shutdown();
      const secondShutdown = await state.shutdown();
      assert.deepEqual(secondShutdown, firstShutdown, 'every createServerState fixture must shut down idempotently');
    }
    rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.WORKER_BASE_WORKSPACE;
    delete process.env.WORKER_BASE_DATA_ROOT;
    delete process.env.DOCS_ROOT;
    delete process.env.STATIC_PROJECTS_ROOT;
    delete process.env.DY_PERSISTED_ASSET_ROOT;
    delete process.env.DY_UI_SERVER_WORKER_ID;
  }
}

function importPayload(state, payload, suffix) {
  const uri = `mxc://localhost/0457-host-egress-${suffix}-${Date.now()}`;
  state.cacheUploadedMediaForTest(uri, {
    buffer: buildZipBuffer(payload),
    contentType: 'application/zip',
    filename: `0457-host-egress-${suffix}.zip`,
    userId: '@ui:localhost',
  });
  return state.runtime.hostApi.slideImportAppFromMxc(uri);
}

function generatedBridgeForPin(state, root, pinName) {
  const rootLabels = state.runtime.getCell(root, 0, 0, 0).labels;
  const generatedKeys = rootLabels.get('host_egress_generated_model0_labels')?.v || [];
  const model0Labels = state.runtime.getCell(state.runtime.getModel(0), 0, 0, 0).labels;
  const bridgeKey = generatedKeys.find((key) => {
    const label = model0Labels.get(key);
    return label?.t === 'func.js' && key.includes(`_${pinName}_`);
  });
  assert.ok(bridgeKey, `${pinName} bridge function must be generated`);
  const bridgeLabel = model0Labels.get(bridgeKey);
  assert.equal(typeof bridgeLabel?.v?.code, 'string', `${pinName} bridge must contain executable code`);
  return { bridgeKey, bridgeLabel, model0Labels, rootLabels };
}

function sameCellPin(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

function generatedFullChainForPin(state, root, pinName, expectedRoute) {
  const { bridgeKey, bridgeLabel, model0Labels, rootLabels } = generatedBridgeForPin(state, root, pinName);
  const binding = rootLabels.get(`ui_egress_${pinName}_binding`);
  assert.equal(binding?.v?.bus, expectedRoute, `${pinName} binding must resolve to ${expectedRoute}`);
  const expectedPinType = expectedRoute === 'management' ? 'pin.bus.mb.out' : 'pin.bus.cb.out';
  assert.equal(binding?.v?.host_pin_type, expectedPinType, `${pinName} binding must declare the resolved bus pin type`);
  assert.equal(
    model0Labels.get(binding?.v?.host_pin_key)?.t,
    expectedPinType,
    `${pinName} Model 0 bus pin must actually use the resolved label type`,
  );

  const generatedKeys = rootLabels.get('host_egress_generated_model0_labels')?.v || [];
  const mount = rootLabels.get('host_egress_generated_mount')?.v;
  assert.ok(
    mount && Number.isInteger(mount.p) && Number.isInteger(mount.r) && Number.isInteger(mount.c),
    `${pinName} generated parent mount must exist`,
  );
  assert.equal(mount.keys?.includes(pinName), true, `${pinName} must be exposed on the generated parent mount`);
  const mountLabels = state.runtime.getCell(state.runtime.getModel(0), mount.p, mount.r, mount.c).labels;
  assert.equal(mountLabels.get(pinName)?.t, 'pin.out', `${pinName} parent mount must expose a real pin.out`);

  const mountSource = [mount.p, mount.r, mount.c, pinName];
  let cellRouteKey = null;
  let bridgeInputKey = null;
  for (const key of generatedKeys) {
    const label = model0Labels.get(key);
    if (label?.t !== 'pin.connect.cell' || !Array.isArray(label.v)) continue;
    const route = label.v.find((entry) => sameCellPin(entry?.from, mountSource));
    const target = route?.to?.find((candidate) => (
      Array.isArray(candidate)
      && candidate.length === 4
      && candidate[0] === 0
      && candidate[1] === 0
      && candidate[2] === 0
      && typeof candidate[3] === 'string'
    ));
    if (!target) continue;
    cellRouteKey = key;
    bridgeInputKey = target[3];
    break;
  }
  assert.ok(cellRouteKey, `${pinName} generated pin.connect.cell must connect the parent mount to Model 0`);
  assert.equal(model0Labels.get(bridgeInputKey)?.t, 'pin.in', `${pinName} generated bridge input must be a pin.in`);

  const labelRouteKey = generatedKeys.find((key) => {
    const label = model0Labels.get(key);
    return label?.t === 'pin.connect.label'
      && Array.isArray(label.v)
      && label.v.some((entry) => (
        entry?.from === bridgeInputKey
        && Array.isArray(entry.to)
        && entry.to.includes(`${bridgeKey}:in`)
      ));
  });
  assert.ok(labelRouteKey, `${pinName} generated pin.connect.label must connect the bridge input to its function`);
  return {
    binding,
    bridgeInputKey,
    bridgeKey,
    bridgeLabel,
    cellRouteKey,
    expectedPinType,
    labelRouteKey,
    model0Labels,
    mount,
    rootLabels,
  };
}

async function tickUntil(state, predicate, description, attempts = 80) {
  for (let index = 0; index < attempts; index += 1) {
    await state.programEngine.tick();
    const value = predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail(description);
}

async function executeGeneratedBridge(state, root, pinName, expectedRoute, emittedRecords = null) {
  await state.programEngine.tick();
  const topology = generatedFullChainForPin(state, root, pinName, expectedRoute);
  const { binding, expectedPinType, model0Labels } = topology;

  const basePayload = emittedRecords || [
    mt('model_type', 'model.table', `Generic.${pinName}`),
    mt('value', 'str', `bridge-${pinName}`, 0, 0, 0, 1),
  ];
  const traceValue = rootRecord(basePayload, 'custom_trace')?.v || {
    source: pinName,
    probe: `full-chain-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  };
  const payload = rootRecord(basePayload, 'custom_trace')
    ? basePayload
    : [...basePayload, mt('custom_trace', 'json', traceValue)];

  const applied = state.runtime.addLabel(root, 0, 0, 0, {
    k: pinName,
    t: 'pin.out',
    v: payload,
  });
  assert.equal(applied?.applied, true, `${pinName} public root pin.out write must be accepted`);
  const busOut = await tickUntil(
    state,
    () => {
      const candidate = model0Labels.get(binding.v.host_pin_key);
      return JSON.stringify(rootRecord(candidate?.v || [], 'custom_trace')?.v) === JSON.stringify(traceValue)
        ? candidate
        : null;
    },
    `${pinName} full connection chain must publish the trace to ${expectedRoute} bus out`,
  );
  const busSend = model0Labels.get('mt_bus_send_in');
  assert.equal(busSend?.t, 'pin.in', `${pinName} full chain must write mt_bus_send_in through the generated function`);
  assert.equal(rootRecord(busSend?.v || [], 'bus')?.v, expectedRoute, `${pinName} bridge bus must match resolved route`);
  assert.equal(rootRecord(busSend?.v || [], 'route_kind')?.v, expectedRoute, `${pinName} bridge route_kind must match resolved route`);
  assert.equal(rootRecord(busSend?.v || [], 'endpoint_pin')?.v, pinName);
  assert.equal(busOut?.t, expectedPinType, `${pinName} emitted bus label must retain the actual resolved type`);
  assert.equal(rootRecord(busOut?.v || [], 'bus')?.v, expectedRoute);
  assert.equal(rootRecord(busOut?.v || [], 'route_kind')?.v, expectedRoute);
  assert.equal(rootRecord(busOut?.v || [], 'envelope_extension_keys'), null, 'internal declaration must not be published');
  return { busSend, busOut, binding, payload, topology };
}

async function executeEveryGeneratedBridge(state, root, expectedRoutes) {
  for (const [pinName, expectedRoute] of Object.entries(expectedRoutes)) {
    const rootTrace = { pin: pinName, scope: 'root', route: expectedRoute };
    const payloadTrace = { pin: pinName, scope: 'payload', route: expectedRoute };
    const emitted = [
      mt('model_type', 'model.table', `Generic.${pinName}`),
      mt('custom_trace', 'json', rootTrace),
      mt('custom_trace', 'json', payloadTrace, 0, 1, 0, 0),
      mt('value', 'str', `bridge-${pinName}`, 0, 0, 0, 1),
    ];
    const { busOut } = await executeGeneratedBridge(state, root, pinName, expectedRoute, emitted);
    assert.deepEqual(
      rootRecord(busOut.v, 'custom_trace'),
      mt('custom_trace', 'json', rootTrace),
      `${pinName} must lift only the exact-root generic extension into the envelope`,
    );
    const remappedTraces = payloadRecords(busOut.v).filter((record) => record.k === 'custom_trace');
    assert.deepEqual(
      remappedTraces,
      [mt('custom_trace', 'json', payloadTrace, 1, 1, 0, 0)],
      `${pinName} must preserve the non-root same-key extension in the remapped business payload`,
    );
  }
}

async function test_normal_import_persists_and_restarts_complete_host_egress_contract() {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0457-host-egress-normal-restart-'));
  const dbPath = join(tempRoot, 'ui-server.sqlite');
  const expected = dualBusDeclaration();
  const payload = appPayload(expected);
  const serverUrl = new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url).href;
  try {
    const script = `
      import assert from 'node:assert/strict';
      import AdmZipPkg from 'adm-zip';

      const AdmZip = AdmZipPkg && AdmZipPkg.default ? AdmZipPkg.default : AdmZipPkg;
      const { createServerState } = await import(${JSON.stringify(serverUrl)});
      const dbPath = ${JSON.stringify(dbPath)};
      const expected = ${JSON.stringify(expected)};
      const payload = ${JSON.stringify(payload)};
      ${SERVER_LIFECYCLE_PROBE_HELPERS}
      const rootRecord = (records, key) => Array.isArray(records)
        ? records.find((record) => record && record.id === 0 && record.p === 0 && record.r === 0 && record.c === 0 && record.k === key) || null
        : null;
      const buildZipBuffer = (records) => {
        const zip = new AdmZip();
        zip.addFile('app_payload.json', Buffer.from(JSON.stringify(records, null, 2), 'utf8'));
        return zip.toBuffer();
      };
      const sameCellPin = (actual, expectedPoint) => Array.isArray(actual)
        && actual.length === expectedPoint.length
        && actual.every((value, index) => value === expectedPoint[index]);
      const fullChainForPin = (state, root, pinName, expectedRoute) => {
        const rootLabels = state.runtime.getCell(root, 0, 0, 0).labels;
        const model0 = state.runtime.getModel(0);
        const model0Labels = state.runtime.getCell(model0, 0, 0, 0).labels;
        const generatedKeys = rootLabels.get('host_egress_generated_model0_labels')?.v || [];
        const mount = rootLabels.get('host_egress_generated_mount')?.v;
        const binding = rootLabels.get('ui_egress_' + pinName + '_binding');
        const expectedPinType = expectedRoute === 'management' ? 'pin.bus.mb.out' : 'pin.bus.cb.out';
        assert.equal(binding?.v?.bus, expectedRoute, pinName + ' normal restart route');
        assert.equal(binding?.v?.host_pin_type, expectedPinType, pinName + ' normal restart pin type');
        assert.equal(model0Labels.get(binding?.v?.host_pin_key)?.t, expectedPinType);
        assert.ok(mount && Number.isInteger(mount.p) && Number.isInteger(mount.r) && Number.isInteger(mount.c));
        assert.equal(mount.keys?.includes(pinName), true, pinName + ' must remain on the parent mount after restart');
        assert.equal(
          state.runtime.getCell(model0, mount.p, mount.r, mount.c).labels.get(pinName)?.t,
          'pin.out',
          pinName + ' parent mount must expose pin.out after restart',
        );
        const bridgeKey = generatedKeys.find((key) => {
          const label = model0Labels.get(key);
          return label?.t === 'func.js' && key.includes('_' + pinName + '_');
        });
        assert.ok(bridgeKey, pinName + ' normal restart bridge must exist');
        assert.equal(typeof model0Labels.get(bridgeKey)?.v?.code, 'string');
        const source = [mount.p, mount.r, mount.c, pinName];
        let cellRouteKey = null;
        let bridgeInputKey = null;
        for (const key of generatedKeys) {
          const label = model0Labels.get(key);
          if (label?.t !== 'pin.connect.cell' || !Array.isArray(label.v)) continue;
          const route = label.v.find((entry) => sameCellPin(entry?.from, source));
          const target = route?.to?.find((candidate) => Array.isArray(candidate)
            && candidate[0] === 0 && candidate[1] === 0 && candidate[2] === 0 && typeof candidate[3] === 'string');
          if (!target) continue;
          cellRouteKey = key;
          bridgeInputKey = target[3];
          break;
        }
        assert.ok(cellRouteKey, pinName + ' pin.connect.cell must survive normal restart');
        assert.equal(model0Labels.get(bridgeInputKey)?.t, 'pin.in');
        const labelRouteKey = generatedKeys.find((key) => {
          const label = model0Labels.get(key);
          return label?.t === 'pin.connect.label' && Array.isArray(label.v) && label.v.some((entry) => (
            entry?.from === bridgeInputKey && Array.isArray(entry.to) && entry.to.includes(bridgeKey + ':in')
          ));
        });
        assert.ok(labelRouteKey, pinName + ' pin.connect.label must survive normal restart');
        return { binding, expectedPinType, model0Labels };
      };
      const tickForTrace = async (state, model0Labels, busOutKey, expectedTrace, description) => {
        for (let index = 0; index < 80; index += 1) {
          await state.programEngine.tick();
          const candidate = model0Labels.get(busOutKey);
          if (JSON.stringify(rootRecord(candidate?.v || [], 'custom_trace')?.v) === JSON.stringify(expectedTrace)) {
            return candidate;
          }
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        assert.fail(description);
      };

      try {
        let rootRef = null;
        const first = createServerState({ dbPath });
        assertServerLifecycleApi(first, 'normal first state');
        try {
          await awaitServerReady(first, 'normal first state');
          const uri = 'mxc://localhost/0457-host-egress-normal-persisted-restart';
          first.cacheUploadedMediaForTest(uri, {
            buffer: buildZipBuffer(payload),
            contentType: 'application/zip',
            filename: '0457-host-egress-normal-persisted-restart.zip',
            userId: '@ui:localhost',
          });
          const imported = first.runtime.hostApi.slideImportAppFromMxc(uri);
          assert.equal(imported.ok, true, 'normal restart fixture must import through the production installer');
          rootRef = imported.data.model_ref;
          const firstRoot = first.runtime.getModel(rootRef);
          assert.ok(firstRoot, 'normal import root must exist before close');
          const firstRootLabels = first.runtime.getCell(firstRoot, 0, 0, 0).labels;
          assert.deepEqual(
            firstRootLabels.get('dual_bus_model')?.v,
            expected,
            'normal import must persist the complete authoritative declaration without test repair',
          );
          assert.ok(
            (firstRootLabels.get('host_egress_generated_model0_labels')?.v || []).length > 0,
            'normal import must materialize generated adapter state before close',
          );
        } finally {
          await shutdownAndAssertQuiet(first, 'normal first state');
        }

        const restored = createServerState({ dbPath });
        assertServerLifecycleApi(restored, 'normal restored state');
        try {
          await awaitServerReady(restored, 'normal restored state');
          await restored.activateRuntimeMode('running');
          await awaitServerReady(restored, 'normal restored running state');
          await restored.programEngine.tick();
          const restoredRoot = restored.runtime.getModel(rootRef);
          assert.ok(restoredRoot, 'normal persisted app root must reload from the same SQLite database');
          const restoredRootLabels = restored.runtime.getCell(restoredRoot, 0, 0, 0).labels;
          assert.deepEqual(
            restoredRootLabels.get('dual_bus_model')?.v,
            expected,
            'normal restart must retain the complete authoritative declaration',
          );
          const restoredGeneratedKeys = restoredRootLabels.get('host_egress_generated_model0_labels')?.v || [];
          assert.ok(restoredGeneratedKeys.length > 0, 'normal restart must expose generated Model 0 labels');
          const restoredModel0 = restored.runtime.getModel(0);
          const restoredModel0Labels = restored.runtime.getCell(restoredModel0, 0, 0, 0).labels;
          const evidence = {};

          for (const [pinName, expectedRoute] of [['resource', 'control'], ['data', 'management']]) {
            const topology = fullChainForPin(restored, restoredRoot, pinName, expectedRoute);
            const emitted = [
              { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.table', v: \`Data.\${pinName}\` },
              { id: 0, p: 0, r: 0, c: 0, k: 'custom_trace', t: 'json', v: { source: pinName, normal_restart: true } },
              { id: 0, p: 0, r: 0, c: 1, k: 'value', t: 'str', v: \`normal-restart-\${pinName}\` },
            ];
            const applied = restored.runtime.addLabel(restoredRoot, 0, 0, 0, {
              k: pinName,
              t: 'pin.out',
              v: emitted,
            });
            assert.equal(applied?.applied, true, pinName + ' public root pin.out must be accepted after normal restart');
            const busOut = await tickForTrace(
              restored,
              topology.model0Labels,
              topology.binding.v.host_pin_key,
              { source: pinName, normal_restart: true },
              pinName + ' full chain must publish after normal restart',
            );
            const busSend = topology.model0Labels.get('mt_bus_send_in');
            assert.equal(busSend?.t, 'pin.in', pinName + ' normal restart full chain must write mt_bus_send_in');
            assert.deepEqual(
              rootRecord(busSend?.v || [], 'envelope_extension_keys')?.v,
              expected.envelope_extension_keys,
              pinName + ' normal restart bridge must carry the full declaration',
            );
            assert.equal(busOut?.t, topology.expectedPinType);
            assert.equal(rootRecord(busOut?.v || [], 'bus')?.v, expectedRoute);
            assert.deepEqual(rootRecord(busOut?.v || [], 'custom_trace')?.v, { source: pinName, normal_restart: true });
            evidence[pinName] = { route: expectedRoute, pinType: busOut.t };
          }

          console.log('NORMAL_RESTART_EVIDENCE ' + JSON.stringify({ declaration: restoredRootLabels.get('dual_bus_model')?.v, evidence }));
        } finally {
          await shutdownAndAssertQuiet(restored, 'normal restored state');
        }
      } finally {
        lifecycleCapture.restore();
      }
    `;
    const result = spawnSync('bun', ['--eval', script], {
      cwd: new URL('../..', import.meta.url).pathname,
      encoding: 'utf8',
      timeout: 30000,
      env: {
        ...process.env,
        DY_AUTH: '0',
        DY_PERSISTED_ASSET_ROOT: '',
        DY_UI_SERVER_WORKER_ID: 'U1',
        WORKER_BASE_WORKSPACE: `it0457_host_egress_normal_restart_${Date.now()}`,
        WORKER_BASE_DATA_ROOT: join(tempRoot, 'runtime'),
        DOCS_ROOT: join(tempRoot, 'docs'),
        STATIC_PROJECTS_ROOT: join(tempRoot, 'static'),
      },
    });
    assert.equal(
      result.status,
      0,
      `normal persisted restart probe must pass:\n${result.stderr || result.stdout}`,
    );
    const evidenceLine = result.stdout.split(/\r?\n/u).find((line) => line.startsWith('NORMAL_RESTART_EVIDENCE '));
    assert.ok(evidenceLine, 'normal persisted restart probe must emit machine-readable evidence');
    const evidence = JSON.parse(evidenceLine.slice('NORMAL_RESTART_EVIDENCE '.length));
    assert.deepEqual(evidence, {
      declaration: expected,
      evidence: {
        resource: { route: 'control', pinType: 'pin.bus.cb.out' },
        data: { route: 'management', pinType: 'pin.bus.mb.out' },
      },
    });
    return { key: 'normal_import_persists_and_restarts_complete_host_egress_contract', status: 'PASS' };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function test_persisted_restart_reapplies_complete_host_egress_contract() {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0457-host-egress-restart-'));
  const dbPath = join(tempRoot, 'ui-server.sqlite');
  const expected = dualBusDeclaration();
  const payload = appPayload(expected);
  const serverUrl = new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url).href;
  try {
    const script = `
      import assert from 'node:assert/strict';
      import AdmZipPkg from 'adm-zip';

      const AdmZip = AdmZipPkg && AdmZipPkg.default ? AdmZipPkg.default : AdmZipPkg;
      const { createServerState } = await import(${JSON.stringify(serverUrl)});
      const dbPath = ${JSON.stringify(dbPath)};
      const expected = ${JSON.stringify(expected)};
      const payload = ${JSON.stringify(payload)};
      ${SERVER_LIFECYCLE_PROBE_HELPERS}

      const mt = (k, t, v, id = 0, p = 0, r = 0, c = 0) => ({ id, p, r, c, k, t, v });
      const rootRecord = (records, key) => Array.isArray(records)
        ? records.find((record) => record && record.id === 0 && record.p === 0 && record.r === 0 && record.c === 0 && record.k === key) || null
        : null;
      const buildZipBuffer = (records) => {
        const zip = new AdmZip();
        zip.addFile('app_payload.json', Buffer.from(JSON.stringify(records, null, 2), 'utf8'));
        return zip.toBuffer();
      };
      const sameCellPin = (actual, expectedPoint) => Array.isArray(actual)
        && actual.length === expectedPoint.length
        && actual.every((value, index) => value === expectedPoint[index]);
      const fullChainForPin = (state, root, pinName, expectedRoute) => {
        const rootLabels = state.runtime.getCell(root, 0, 0, 0).labels;
        const model0 = state.runtime.getModel(0);
        const model0Labels = state.runtime.getCell(model0, 0, 0, 0).labels;
        const generatedKeys = rootLabels.get('host_egress_generated_model0_labels')?.v || [];
        const mount = rootLabels.get('host_egress_generated_mount')?.v;
        const binding = rootLabels.get('ui_egress_' + pinName + '_binding');
        const expectedPinType = expectedRoute === 'management' ? 'pin.bus.mb.out' : 'pin.bus.cb.out';
        assert.equal(binding?.v?.bus, expectedRoute, pinName + ' restart route');
        assert.equal(binding?.v?.host_pin_type, expectedPinType, pinName + ' restart pin type');
        assert.equal(model0Labels.get(binding?.v?.host_pin_key)?.t, expectedPinType);
        assert.ok(mount && Number.isInteger(mount.p) && Number.isInteger(mount.r) && Number.isInteger(mount.c));
        assert.equal(mount.keys?.includes(pinName), true, pinName + ' must be restored on the parent mount');
        assert.equal(
          state.runtime.getCell(model0, mount.p, mount.r, mount.c).labels.get(pinName)?.t,
          'pin.out',
          pinName + ' rebuilt parent mount must expose pin.out',
        );
        const bridgeKey = generatedKeys.find((key) => {
          const label = model0Labels.get(key);
          return label?.t === 'func.js' && key.includes('_' + pinName + '_');
        });
        assert.ok(bridgeKey, pinName + ' startup reapply must regenerate bridge code');
        assert.equal(typeof model0Labels.get(bridgeKey)?.v?.code, 'string');
        const source = [mount.p, mount.r, mount.c, pinName];
        let cellRouteKey = null;
        let bridgeInputKey = null;
        for (const key of generatedKeys) {
          const label = model0Labels.get(key);
          if (label?.t !== 'pin.connect.cell' || !Array.isArray(label.v)) continue;
          const route = label.v.find((entry) => sameCellPin(entry?.from, source));
          const target = route?.to?.find((candidate) => Array.isArray(candidate)
            && candidate[0] === 0 && candidate[1] === 0 && candidate[2] === 0 && typeof candidate[3] === 'string');
          if (!target) continue;
          cellRouteKey = key;
          bridgeInputKey = target[3];
          break;
        }
        assert.ok(cellRouteKey, pinName + ' pin.connect.cell must be rebuilt after restart');
        assert.equal(model0Labels.get(bridgeInputKey)?.t, 'pin.in');
        const labelRouteKey = generatedKeys.find((key) => {
          const label = model0Labels.get(key);
          return label?.t === 'pin.connect.label' && Array.isArray(label.v) && label.v.some((entry) => (
            entry?.from === bridgeInputKey && Array.isArray(entry.to) && entry.to.includes(bridgeKey + ':in')
          ));
        });
        assert.ok(labelRouteKey, pinName + ' pin.connect.label must be rebuilt after restart');
        return { binding, expectedPinType, model0Labels };
      };
      const tickForTrace = async (state, model0Labels, busOutKey, expectedTrace, description) => {
        for (let index = 0; index < 80; index += 1) {
          await state.programEngine.tick();
          const candidate = model0Labels.get(busOutKey);
          if (JSON.stringify(rootRecord(candidate?.v || [], 'custom_trace')?.v) === JSON.stringify(expectedTrace)) {
            return candidate;
          }
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        assert.fail(description);
      };

      try {
        let rootRef = null;
        const first = createServerState({ dbPath });
        assertServerLifecycleApi(first, 'recovery first state');
        try {
          await awaitServerReady(first, 'recovery first state');
          const uri = 'mxc://localhost/0457-host-egress-persisted-restart';
          first.cacheUploadedMediaForTest(uri, {
            buffer: buildZipBuffer(payload),
            contentType: 'application/zip',
            filename: '0457-host-egress-persisted-restart.zip',
            userId: '@ui:localhost',
          });
          const imported = first.runtime.hostApi.slideImportAppFromMxc(uri);
          assert.equal(imported.ok, true, 'restart fixture must import through the production installer');
          rootRef = imported.data.model_ref;
          const importedRoot = first.runtime.getModel(rootRef);
          assert.ok(importedRoot, 'imported app root must exist before restart');

          // Import normalization is covered separately. Persist the exact authoritative
          // declaration, then remove only derived adapter state so startup must rebuild it.
          const persistedDeclaration = first.runtime.addLabel(importedRoot, 0, 0, 0, {
            k: 'dual_bus_model',
            t: 'json',
            v: expected,
          });
          assert.equal(persistedDeclaration?.applied, true, 'complete declaration must be persisted for restart isolation');
          const importedRootLabels = first.runtime.getCell(importedRoot, 0, 0, 0).labels;
          const model0 = first.runtime.getModel(0);
          const generatedModel0Keys = importedRootLabels.get('host_egress_generated_model0_labels')?.v || [];
          const generatedMount = importedRootLabels.get('host_egress_generated_mount')?.v || null;
          for (const key of generatedModel0Keys) {
            first.runtime.rmLabel(model0, 0, 0, 0, key);
          }
          if (generatedMount && Number.isInteger(generatedMount.p) && Number.isInteger(generatedMount.r) && Number.isInteger(generatedMount.c)) {
            for (const key of Array.isArray(generatedMount.keys) ? generatedMount.keys : []) {
              first.runtime.rmLabel(model0, generatedMount.p, generatedMount.r, generatedMount.c, key);
            }
          }
          for (const pinName of ['resource', 'data']) {
            first.runtime.rmLabel(importedRoot, 0, 0, 0, \`ui_egress_\${pinName}_binding\`);
          }
          first.runtime.rmLabel(importedRoot, 0, 0, 0, 'host_egress_generated_model0_labels');
          first.runtime.rmLabel(importedRoot, 0, 0, 0, 'host_egress_generated_mount');
        } finally {
          await shutdownAndAssertQuiet(first, 'recovery first state');
        }

        const restored = createServerState({ dbPath });
        assertServerLifecycleApi(restored, 'recovery restored state');
        try {
          await awaitServerReady(restored, 'recovery restored state');
          await restored.activateRuntimeMode('running');
          await awaitServerReady(restored, 'recovery restored running state');
          await restored.programEngine.tick();
          const restoredRoot = restored.runtime.getModel(rootRef);
          assert.ok(restoredRoot, 'persisted app root must reload by its table-qualified model ref');
          const restoredRootLabels = restored.runtime.getCell(restoredRoot, 0, 0, 0).labels;
          assert.deepEqual(
            restoredRootLabels.get('dual_bus_model')?.v,
            expected,
            'persisted restart must retain the complete authoritative declaration',
          );
          const restoredGeneratedKeys = restoredRootLabels.get('host_egress_generated_model0_labels')?.v || [];
          assert.ok(restoredGeneratedKeys.length > 0, 'startup reapply must recreate generated Model 0 labels');
          const restoredModel0Labels = restored.runtime.getCell(restored.runtime.getModel(0), 0, 0, 0).labels;
          const evidence = {};

          for (const [pinName, expectedRoute] of [['resource', 'control'], ['data', 'management']]) {
            const topology = fullChainForPin(restored, restoredRoot, pinName, expectedRoute);

            const emitted = [
              mt('model_type', 'model.table', \`Data.\${pinName}\`),
              mt('is_need_response', 'bool', true),
              mt('message_server', 'str', 'local'),
              mt('custom_trace', 'json', { source: pinName, restart: true }),
              mt('value', 'str', \`restart-\${pinName}\`, 0, 0, 0, 1),
            ];
            const applied = restored.runtime.addLabel(restoredRoot, 0, 0, 0, {
              k: pinName,
              t: 'pin.out',
              v: emitted,
            });
            assert.equal(applied?.applied, true, pinName + ' public root pin.out must be accepted after rebuild');
            const busOut = await tickForTrace(
              restored,
              topology.model0Labels,
              topology.binding.v.host_pin_key,
              { source: pinName, restart: true },
              pinName + ' full chain must publish after startup rebuild',
            );
            const busSend = topology.model0Labels.get('mt_bus_send_in');
            assert.equal(busSend?.t, 'pin.in', pinName + ' rebuilt full chain must write mt_bus_send_in');
            assert.deepEqual(
              rootRecord(busSend?.v || [], 'envelope_extension_keys')?.v,
              expected.envelope_extension_keys,
              pinName + ' restarted bridge must carry the complete internal declaration',
            );
            assert.equal(busOut?.t, topology.expectedPinType);
            assert.equal(rootRecord(busOut?.v || [], 'bus')?.v, expectedRoute);
            assert.equal(rootRecord(busOut?.v || [], 'route_kind')?.v, expectedRoute);
            assert.equal(rootRecord(busOut?.v || [], 'envelope_extension_keys'), null, 'internal declaration must not leak after restart');
            assert.deepEqual(rootRecord(busOut?.v || [], 'custom_trace')?.v, { source: pinName, restart: true });
            evidence[pinName] = { route: expectedRoute, pinType: busOut.t };
          }

          console.log('RESTART_EVIDENCE ' + JSON.stringify({ declaration: restoredRootLabels.get('dual_bus_model')?.v, evidence }));
        } finally {
          await shutdownAndAssertQuiet(restored, 'recovery restored state');
        }
      } finally {
        lifecycleCapture.restore();
      }
    `;
    const result = spawnSync('bun', ['--eval', script], {
      cwd: new URL('../..', import.meta.url).pathname,
      encoding: 'utf8',
      timeout: 30000,
      env: {
        ...process.env,
        DY_AUTH: '0',
        DY_PERSISTED_ASSET_ROOT: '',
        DY_UI_SERVER_WORKER_ID: 'U1',
        WORKER_BASE_WORKSPACE: `it0457_host_egress_restart_${Date.now()}`,
        WORKER_BASE_DATA_ROOT: join(tempRoot, 'runtime'),
        DOCS_ROOT: join(tempRoot, 'docs'),
        STATIC_PROJECTS_ROOT: join(tempRoot, 'static'),
      },
    });
    assert.equal(
      result.status,
      0,
      `persisted restart/reapply probe must pass:\n${result.stderr || result.stdout}`,
    );
    const evidenceLine = result.stdout.split(/\r?\n/u).find((line) => line.startsWith('RESTART_EVIDENCE '));
    assert.ok(evidenceLine, 'persisted restart probe must emit machine-readable evidence');
    const evidence = JSON.parse(evidenceLine.slice('RESTART_EVIDENCE '.length));
    assert.deepEqual(evidence, {
      declaration: expected,
      evidence: {
        resource: { route: 'control', pinType: 'pin.bus.cb.out' },
        data: { route: 'management', pinType: 'pin.bus.mb.out' },
      },
    });
    return { key: 'persisted_restart_reapplies_complete_host_egress_contract', status: 'PASS' };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function test_import_preserves_per_pin_route_and_extension_declaration() {
  return withServerState(async (state, buildSlideAppExportPayload) => {
    assert.equal(EXACT_MAX_EXTENSION_KEYS.length, 16);
    assert.equal(EXACT_MAX_LENGTH_EXTENSION_KEY.length, 64);
    const expected = dualBusDeclaration({
      envelope_extension_keys: EXACT_MAX_EXTENSION_KEYS,
    });
    const imported = importPayload(state, appPayload(expected), 'valid');
    assert.equal(imported.ok, true, `valid generic host-egress declaration must import: ${JSON.stringify(imported)}`);
    const rootRef = imported.data.model_ref;
    const root = state.runtime.getModel(rootRef);
    const labels = state.runtime.getCell(root, 0, 0, 0).labels;

    assert.deepEqual(labels.get('dual_bus_model')?.v, expected, 'runtime must preserve the complete validated declaration');
    assert.equal(labels.get('ui_egress_resource_binding')?.v?.bus, 'control', 'resource pin must use control override');
    assert.equal(labels.get('ui_egress_resource_binding')?.v?.host_pin_type, 'pin.bus.cb.out');
    assert.equal(labels.get('ui_egress_data_binding')?.v?.bus, 'management', 'data pin must use management override');
    assert.equal(labels.get('ui_egress_data_binding')?.v?.host_pin_type, 'pin.bus.mb.out');

    const exported = buildSlideAppExportPayload(state.runtime, rootRef);
    assert.equal(exported.ok, true, `export after import must pass: ${JSON.stringify(exported)}`);
    const exportedDualBus = exported.data.payload.find((record) => record.k === 'dual_bus_model');
    assert.deepEqual(exportedDualBus?.v, expected, 'import/export must preserve per-pin routes and extension keys');

    const roundTrip = importPayload(state, exported.data.payload, 'round-trip');
    assert.equal(roundTrip.ok, true, `exported declaration must re-import: ${JSON.stringify(roundTrip)}`);
    const roundTripRoot = state.runtime.getModel(roundTrip.data.model_ref);
    const roundTripLabels = state.runtime.getCell(roundTripRoot, 0, 0, 0).labels;
    assert.deepEqual(roundTripLabels.get('dual_bus_model')?.v, expected, 're-import must preserve the complete declaration');
    assert.equal(roundTripLabels.get('ui_egress_resource_binding')?.v?.bus, 'control');
    assert.equal(roundTripLabels.get('ui_egress_data_binding')?.v?.bus, 'management');
    const generatedKeys = roundTripLabels.get('host_egress_generated_model0_labels')?.v || [];
    assert.equal(
      generatedKeys.some((key) => state.programEngine.functions.has(key)),
      true,
      're-import/reapply must register generated bridge functions for execution',
    );
    await executeEveryGeneratedBridge(state, root, { resource: 'control', data: 'management' });
    await executeEveryGeneratedBridge(state, roundTripRoot, { resource: 'control', data: 'management' });
    const boundaryValue = { boundary: '64-char-key', nested: { count: 1 } };
    for (const [boundaryRoot, suffix] of [[root, 'original'], [roundTripRoot, 'round-trip']]) {
      const { busSend, busOut } = await executeGeneratedBridge(
        state,
        boundaryRoot,
        'resource',
        'control',
        [
          mt('model_type', 'model.table', `Generic.Boundary.${suffix}`),
          mt(EXACT_MAX_LENGTH_EXTENSION_KEY, 'json', boundaryValue),
          mt('value', 'str', suffix, 0, 0, 0, 1),
        ],
      );
      assert.deepEqual(
        rootRecord(busSend.v, 'envelope_extension_keys')?.v,
        EXACT_MAX_EXTENSION_KEYS,
        `${suffix}: generated bridge must carry all 16 declared extension keys`,
      );
      assert.deepEqual(
        rootRecord(busSend.v, EXACT_MAX_LENGTH_EXTENSION_KEY)?.v,
        boundaryValue,
        `${suffix}: generated bridge must lift the declared 64-character key`,
      );
      assert.deepEqual(
        rootRecord(busOut.v, EXACT_MAX_LENGTH_EXTENSION_KEY)?.v,
        boundaryValue,
        `${suffix}: runtime must externally publish the declared 64-character key`,
      );
    }

    return { key: 'import_preserves_per_pin_route_and_extension_declaration', status: 'PASS' };
  });
}

async function test_import_rejects_invalid_route_and_extension_declarations() {
  const cases = [
    ['null_route_array', { egress_routes: null }, 'invalid_dual_bus_model_egress_routes'],
    ['string_route_array', { egress_routes: 'control' }, 'invalid_dual_bus_model_egress_routes'],
    ['object_route_array', { egress_routes: { pin_name: 'resource', route_kind: 'control' } }, 'invalid_dual_bus_model_egress_routes'],
    ['null_route_entry', { egress_routes: [null] }, 'invalid_dual_bus_model_egress_route_shape'],
    ['string_route_entry', { egress_routes: ['resource'] }, 'invalid_dual_bus_model_egress_route_shape'],
    ['array_route_entry', { egress_routes: [['resource', 'control']] }, 'invalid_dual_bus_model_egress_route_shape'],
    ['missing_route_pin_name', { egress_routes: [{ route_kind: 'control' }] }, 'invalid_dual_bus_model_egress_route_shape'],
    ['missing_route_kind', { egress_routes: [{ pin_name: 'resource' }] }, 'invalid_dual_bus_model_egress_route_shape'],
    ['wrong_route_pin_name_type', { egress_routes: [{ pin_name: 7, route_kind: 'control' }] }, 'invalid_dual_bus_model_egress_route_shape'],
    ['wrong_route_kind_type', { egress_routes: [{ pin_name: 'resource', route_kind: true }] }, 'invalid_dual_bus_model_egress_route_shape'],
    ['duplicate_route', {
      egress_routes: [
        { pin_name: 'resource', route_kind: 'control' },
        { pin_name: 'resource', route_kind: 'management' },
      ],
    }, 'duplicate_dual_bus_model_egress_route:resource'],
    ['unknown_route_pin', {
      egress_routes: [{ pin_name: 'unknown', route_kind: 'control' }],
    }, 'unknown_dual_bus_model_egress_route_pin:unknown'],
    ['invalid_route_kind', {
      egress_routes: [{ pin_name: 'resource', route_kind: 'manage' }],
    }, 'invalid_dual_bus_model_egress_route_kind:resource'],
    ['extra_route_field', {
      egress_routes: [{ pin_name: 'resource', route_kind: 'control', topic: 'forbidden' }],
    }, 'invalid_dual_bus_model_egress_route_shape'],
    ['null_extension_array', { envelope_extension_keys: null }, 'invalid_dual_bus_model_envelope_extension_keys'],
    ['string_extension_array', { envelope_extension_keys: 'custom_trace' }, 'invalid_dual_bus_model_envelope_extension_keys'],
    ['object_extension_array', { envelope_extension_keys: { key: 'custom_trace' } }, 'invalid_dual_bus_model_envelope_extension_keys'],
    ['null_extension_entry', { envelope_extension_keys: [null] }, 'invalid_dual_bus_model_envelope_extension_key'],
    ['number_extension_entry', { envelope_extension_keys: [7] }, 'invalid_dual_bus_model_envelope_extension_key'],
    ['object_extension_entry', { envelope_extension_keys: [{ key: 'custom_trace' }] }, 'invalid_dual_bus_model_envelope_extension_key'],
    ['duplicate_extension_key', {
      envelope_extension_keys: ['is_need_response', 'is_need_response'],
    }, 'duplicate_dual_bus_model_envelope_extension_key:is_need_response'],
    ['structural_extension_key', {
      envelope_extension_keys: ['model_type'],
    }, 'reserved_dual_bus_model_envelope_extension_key:model_type'],
    ['invalid_extension_key', {
      envelope_extension_keys: ['is_need_response', ''],
    }, 'invalid_dual_bus_model_envelope_extension_key'],
    ['invalid_extension_key_grammar', {
      envelope_extension_keys: ['Bad-Key'],
    }, 'invalid_dual_bus_model_envelope_extension_key'],
    ['too_many_extension_keys', {
      envelope_extension_keys: Array.from({ length: 17 }, (_, index) => `custom_${index}`),
    }, 'too_many_dual_bus_model_envelope_extension_keys'],
    ['extension_key_too_long', {
      envelope_extension_keys: [`custom_${'x'.repeat(58)}`],
    }, 'invalid_dual_bus_model_envelope_extension_key'],
    ...RESERVED_ENVELOPE_EXTENSION_EXACT_KEYS.map((key) => [
      `reserved_exact_${key.replace(/[^a-z0-9]+/giu, '_')}`,
      { envelope_extension_keys: [key] },
      `reserved_dual_bus_model_envelope_extension_key:${key}`,
    ]),
    ...RESERVED_ENVELOPE_EXTENSION_PREFIXES.map((prefix) => {
      const key = `${prefix}shadow`;
      return [
        `reserved_prefix_${prefix.replace(/[^a-z0-9]+/giu, '_')}`,
        { envelope_extension_keys: [key] },
        `reserved_dual_bus_model_envelope_extension_key:${key}`,
      ];
    }),
  ];

  return withServerState(async (state) => {
    for (const [name, override, detail] of cases) {
      const result = importPayload(state, appPayload(dualBusDeclaration(override)), name);
      assert.deepEqual(
        { ok: result.ok, code: result.code, detail: result.detail },
        { ok: false, code: 'invalid_target', detail },
        `${name} must fail closed before adapter generation`,
      );
    }
    return { key: 'import_rejects_invalid_route_and_extension_declarations', status: 'PASS' };
  });
}

async function test_default_route_fallback_remains_backward_compatible() {
  return withServerState(async (state, buildSlideAppExportPayload) => {
    const withoutOverrides = genericDualBusDeclaration({ egress_routes: undefined });
    const management = importPayload(
      state,
      appPayload(withoutOverrides, { routeKind: 'management' }),
      'default-management',
    );
    assert.equal(management.ok, true);
    const managementRoot = state.runtime.getModel(management.data.model_ref);
    const managementLabels = state.runtime.getCell(managementRoot, 0, 0, 0).labels;
    assert.equal(managementLabels.get('ui_egress_alpha_binding')?.v?.bus, 'management');
    assert.equal(managementLabels.get('ui_egress_omega_binding')?.v?.bus, 'management');
    await executeEveryGeneratedBridge(state, managementRoot, { alpha: 'management', omega: 'management' });

    const control = importPayload(
      state,
      appPayload(withoutOverrides, { routeKind: null }),
      'default-control',
    );
    assert.equal(control.ok, true);
    const controlRoot = state.runtime.getModel(control.data.model_ref);
    const controlLabels = state.runtime.getCell(controlRoot, 0, 0, 0).labels;
    assert.equal(controlLabels.get('ui_egress_alpha_binding')?.v?.bus, 'control');
    assert.equal(controlLabels.get('ui_egress_omega_binding')?.v?.bus, 'control');
    await executeEveryGeneratedBridge(state, controlRoot, { alpha: 'control', omega: 'control' });

    const partialAgainstDefault = importPayload(
      state,
      appPayload(genericDualBusDeclaration({
        egress_routes: [{ pin_name: 'alpha', route_kind: 'control' }],
      }), { routeKind: 'management' }),
      'partial-override-app-default',
    );
    assert.equal(partialAgainstDefault.ok, true);
    const partialDefaultRoot = state.runtime.getModel(partialAgainstDefault.data.model_ref);
    const partialDefaultLabels = state.runtime.getCell(partialDefaultRoot, 0, 0, 0).labels;
    assert.equal(partialDefaultLabels.get('ui_egress_alpha_binding')?.v?.bus, 'control', 'per-pin override wins');
    assert.equal(partialDefaultLabels.get('ui_egress_omega_binding')?.v?.bus, 'management', 'unmentioned pin uses app default');
    await executeEveryGeneratedBridge(state, partialDefaultRoot, { alpha: 'control', omega: 'management' });

    const partialAgainstImplicitControl = importPayload(
      state,
      appPayload(genericDualBusDeclaration({
        egress_routes: [{ pin_name: 'omega', route_kind: 'management' }],
      }), { routeKind: null }),
      'partial-override-implicit-control',
    );
    assert.equal(partialAgainstImplicitControl.ok, true);
    const partialControlRoot = state.runtime.getModel(partialAgainstImplicitControl.data.model_ref);
    const partialControlLabels = state.runtime.getCell(partialControlRoot, 0, 0, 0).labels;
    assert.equal(partialControlLabels.get('ui_egress_alpha_binding')?.v?.bus, 'control', 'unmentioned pin falls back to control');
    assert.equal(partialControlLabels.get('ui_egress_omega_binding')?.v?.bus, 'management', 'per-pin override wins over implicit control');
    await executeEveryGeneratedBridge(state, partialControlRoot, { alpha: 'control', omega: 'management' });

    for (const [suffix, original, expectedRoutes] of [
      ['partial-default-round-trip', partialAgainstDefault, { alpha: 'control', omega: 'management' }],
      ['partial-control-round-trip', partialAgainstImplicitControl, { alpha: 'control', omega: 'management' }],
    ]) {
      const exported = buildSlideAppExportPayload(state.runtime, original.data.model_ref);
      assert.equal(exported.ok, true, `${suffix} export must pass: ${JSON.stringify(exported)}`);
      const reimported = importPayload(state, exported.data.payload, suffix);
      assert.equal(reimported.ok, true, `${suffix} re-import must pass: ${JSON.stringify(reimported)}`);
      const reimportedRoot = state.runtime.getModel(reimported.data.model_ref);
      assert.deepEqual(
        state.runtime.getCell(reimportedRoot, 0, 0, 0).labels.get('dual_bus_model')?.v,
        state.runtime.getCell(state.runtime.getModel(original.data.model_ref), 0, 0, 0).labels.get('dual_bus_model')?.v,
        `${suffix} must preserve the generic declaration`,
      );
      await executeEveryGeneratedBridge(state, reimportedRoot, expectedRoutes);
    }

    return { key: 'default_route_fallback_remains_backward_compatible', status: 'PASS' };
  });
}

async function test_generated_bridge_lifts_only_declared_root_extensions() {
  return withServerState(async (state) => {
    const imported = importPayload(state, appPayload(), 'bridge');
    assert.equal(imported.ok, true);
    const root = state.runtime.getModel(imported.data.model_ref);
    for (const [pinName, expectedRoute] of [['resource', 'control'], ['data', 'management']]) {
      const emitted = [
        mt('model_type', 'model.table', `Data.${pinName}`),
        mt('sys_msg_type', 'str', `${pinName}.report`),
        mt('is_need_response', 'bool', true),
        mt('message_server', 'str', 'local'),
        mt('custom_trace', 'json', { source: pinName, nested: { count: 1 } }),
        mt('type', 'str', 'UI', 0, 0, 0, 1),
        mt(pinName, 'list', [`UI.0457.${pinName}`], 0, 0, 0, 1),
      ];
      const { busSend, busOut } = await executeGeneratedBridge(state, root, pinName, expectedRoute, emitted);
      assert.deepEqual(
        rootRecord(busSend.v, 'envelope_extension_keys'),
        mt('envelope_extension_keys', 'json', dualBusDeclaration().envelope_extension_keys),
        `${pinName} bridge must carry the complete validated declaration as internal metadata`,
      );
      assert.deepEqual(rootRecord(busSend.v, 'is_need_response'), mt('is_need_response', 'bool', true));
      assert.deepEqual(rootRecord(busSend.v, 'message_server'), mt('message_server', 'str', 'local'));
      assert.deepEqual(
        rootRecord(busSend.v, 'custom_trace'),
        mt('custom_trace', 'json', { source: pinName, nested: { count: 1 } }),
        `${pinName} must lift a generic extension by declaration`,
      );
      assert.equal(rootRecord(busSend.v, 'model_type'), null, 'business root must not become envelope metadata');
      assert.deepEqual(payloadRecords(busSend.v), emitted
        .filter((record) => !['is_need_response', 'message_server', 'custom_trace'].includes(record.k))
        .map((record) => ({ ...record, id: 1 })));
      assert.equal(rootRecord(busOut.v, 'envelope_extension_keys'), null, 'internal declaration must not leave runtime');
      assert.deepEqual(rootRecord(busOut.v, 'custom_trace')?.v, { source: pinName, nested: { count: 1 } });
    }

    const brokenTopology = generatedFullChainForPin(state, root, 'resource', 'control');
    state.runtime.rmLabel(state.runtime.getModel(0), 0, 0, 0, brokenTopology.cellRouteKey);
    assert.equal(
      brokenTopology.model0Labels.has(brokenTopology.cellRouteKey),
      false,
      'negative fixture must actually remove the required parent pin.connect.cell route',
    );
    const brokenTrace = { source: 'resource', broken_link: true };
    const brokenWrite = state.runtime.addLabel(root, 0, 0, 0, {
      k: 'resource',
      t: 'pin.out',
      v: [
        mt('model_type', 'model.table', 'Data.resource.BrokenLink'),
        mt('custom_trace', 'json', brokenTrace),
      ],
    });
    assert.equal(brokenWrite?.applied, true, 'broken-link fixture must still accept the public root pin.out write');
    for (let index = 0; index < 12; index += 1) {
      await state.programEngine.tick();
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    const disconnectedBusOut = brokenTopology.model0Labels.get(brokenTopology.binding.v.host_pin_key);
    assert.notDeepEqual(
      rootRecord(disconnectedBusOut?.v || [], 'custom_trace')?.v,
      brokenTrace,
      'removing the generated pin.connect.cell route must stop the public root pin from reaching Model 0 bus out',
    );

    return { key: 'generated_bridge_lifts_only_declared_root_extensions', status: 'PASS' };
  });
}

async function test_runtime_extension_survives_json_transport_and_legacy_metadata_stays_rejected() {
  const sender = new ModelTableRuntime();
  const receiver = new ModelTableRuntime();
  const senderModel0 = sender.getModel(0);
  const receiverModel0 = receiver.getModel(0);
  const requestTopic = 'UIPUT/ws/dam/pic/de/R1/3200/resource';
  const responseTopic = 'UIPUT/ws/dam/pic/de/U1/1051/slide_app_reply';
  const extensionValue = {
    pin: 'resource',
    route: 'control',
    nested: { source: 'json-roundtrip', attempt: 1 },
  };
  const busSend = [
    mt('__mt_payload_kind', 'str', 'bus_send.v1'),
    mt('__mt_request_id', 'str', 'req_0457_extension_json_roundtrip'),
    mt('op_id', 'str', 'req_0457_extension_json_roundtrip'),
    mt('message_role', 'str', 'request'),
    mt('bus_out_key', 'str', 'extension_json_roundtrip_out'),
    mt('bus', 'str', 'control'),
    mt('route_kind', 'str', 'control'),
    mt('topic', 'str', requestTopic),
    mt('response_topic', 'str', responseTopic),
    mt('endpoint_worker_id', 'str', 'R1'),
    mt('endpoint_table_id', 'str', 'host'),
    mt('endpoint_model_id', 'int', 3200),
    mt('endpoint_pin', 'str', 'resource'),
    mt('origin_worker_id', 'str', 'U1'),
    mt('origin_table_id', 'str', 'host'),
    mt('origin_model_id', 'int', 1051),
    mt('origin_pin', 'str', 'resource'),
    mt('reply_target_worker_id', 'str', 'U1'),
    mt('reply_target_table_id', 'str', 'host'),
    mt('reply_target_model_id', 'int', 1051),
    mt('reply_target_pin', 'str', 'slide_app_reply'),
    mt('payload_model_id', 'int', 1),
    mt('envelope_extension_keys', 'json', ['custom_trace']),
    mt('custom_trace', 'json', extensionValue),
    mt('model_type', 'model.single', 'Data.0457JsonRoundTrip', 1),
    mt('value', 'str', 'roundtrip-ok', 1),
  ];

  const sendResult = sender._applyBusSendPayload(senderModel0, 0, 0, 0, busSend);
  assert.deepEqual(sendResult, { status: 'ok', bus_out_key: 'extension_json_roundtrip_out' });
  const senderBusOut = sender.getCell(senderModel0, 0, 0, 0).labels.get('extension_json_roundtrip_out');
  const externalPacket = sender._pinBusOutValueToExternalPayload(senderBusOut?.v);
  assert.ok(externalPacket, 'sender Runtime must externalize the generated pin_payload.v2 packet');
  assert.equal(rootRecord(externalPacket.payload, 'envelope_extension_keys'), null, 'internal extension declaration must not cross the wire');

  const wirePacket = JSON.parse(JSON.stringify(externalPacket));
  const normalized = receiver._normalizeBusInValue(wirePacket, 'resource');
  assert.equal(normalized.ok, true, `receiver Runtime must accept the JSON-round-tripped packet: ${JSON.stringify(normalized)}`);
  assert.deepEqual(rootRecord(normalized.value, 'custom_trace')?.v, extensionValue);
  const receiveResult = receiver.addLabel(receiverModel0, 0, 0, 0, {
    k: 'extension_json_roundtrip_in',
    t: 'pin.bus.cb.in',
    v: normalized.value,
  });
  assert.equal(receiveResult?.applied, true, 'receiver Runtime must materialize the legal extension payload');

  const legacyPacket = JSON.parse(JSON.stringify(externalPacket));
  rootRecord(legacyPacket.payload, 'custom_trace').v = {
    route: {
      reply_to: { worker_id: 'U1', model_id: 1051, pin: 'slide_app_reply' },
    },
  };
  const rejected = receiver._normalizeBusInValue(legacyPacket, 'resource');
  assert.deepEqual(
    rejected,
    { ok: false, code: 'legacy_pin_payload_metadata_removed' },
    'a declared extension must not exempt real legacy routing metadata',
  );
  return { key: 'runtime_extension_survives_json_transport_and_legacy_metadata_stays_rejected', status: 'PASS' };
}

async function test_shutdown_aggregates_failures_and_preserves_active_resources() {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0457-shutdown-failures-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0457_shutdown_failures_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null });
  try {
    await state.whenReady();
    const calls = {
      mqtt_close: 0,
      mqtt_listener_cleanup: 0,
      matrix_unsubscribe: 0,
      matrix_close: 0,
      persistence_close: 0,
    };
    const mqttClient = {
      end(...args) {
        calls.mqtt_close += 1;
        const callback = [...args].reverse().find((value) => typeof value === 'function');
        callback(new Error('injected_mqtt_close_failure'));
        return this;
      },
      removeAllListeners() {
        calls.mqtt_listener_cleanup += 1;
      },
    };
    const matrixUnsubscribe = () => {
      calls.matrix_unsubscribe += 1;
      throw new Error('injected_matrix_unsubscribe_failure');
    };
    const matrixAdapter = {
      async close() {
        calls.matrix_close += 1;
        throw new Error('injected_matrix_close_failure');
      },
    };
    state.programEngine.controlBusClient = mqttClient;
    state.programEngine.controlBusReady = true;
    state.programEngine.controlBusSubscription = 'UIPUT/ws/dam/pic/de/R1/+/+';
    state.programEngine.matrixAdapterUnsub = matrixUnsubscribe;
    state.programEngine.matrixAdapter = matrixAdapter;

    state.runtime.setPersistence({
      close() {
        calls.persistence_close += 1;
        throw new Error('injected_persistence_close_failure');
      },
    });

    const first = state.shutdown();
    const concurrent = state.shutdown();
    assert.strictEqual(concurrent, first, 'concurrent shutdown calls must share one failure result');
    const [firstError, concurrentError] = await Promise.all([
      first.then(() => null, (error) => error),
      concurrent.then(() => null, (error) => error),
    ]);
    assert.ok(firstError instanceof AggregateError, 'shutdown must reject with an AggregateError');
    assert.strictEqual(concurrentError, firstError, 'all callers must observe the same aggregate failure');
    assert.equal(firstError.code, 'server_shutdown_failed');
    assert.deepEqual(firstError.failures, [
      { stage: 'mqtt_close', message: 'injected_mqtt_close_failure' },
      { stage: 'matrix_unsubscribe', message: 'injected_matrix_unsubscribe_failure' },
      { stage: 'matrix_close', message: 'injected_matrix_close_failure' },
      { stage: 'persistence_close', message: 'injected_persistence_close_failure' },
    ]);
    assert.deepEqual(firstError.shutdown_state, {
      mode: 'edit',
      pending_matrix_host_actions: 0,
      mqtt_active: true,
      matrix_active: true,
      persistence_closed: false,
      background_work_pending: 0,
    });
    assert.deepEqual(calls, {
      mqtt_close: 1,
      mqtt_listener_cleanup: 0,
      matrix_unsubscribe: 1,
      matrix_close: 1,
      persistence_close: 1,
    }, 'all close paths must be attempted once and failed resources must not be disguised as closed');
    assert.strictEqual(state.programEngine.controlBusClient, mqttClient);
    assert.equal(state.programEngine.controlBusReady, true);
    assert.equal(state.programEngine.controlBusSubscription, 'UIPUT/ws/dam/pic/de/R1/+/+');
    assert.strictEqual(state.programEngine.matrixAdapter, matrixAdapter);
    assert.strictEqual(state.programEngine.matrixAdapterUnsub, matrixUnsubscribe);

    const repeated = state.shutdown();
    assert.strictEqual(repeated, first, 'failed shutdown must remain idempotent');
    const repeatedError = await repeated.then(() => null, (error) => error);
    assert.strictEqual(repeatedError, firstError);
    assert.deepEqual(calls, {
      mqtt_close: 1,
      mqtt_listener_cleanup: 0,
      matrix_unsubscribe: 1,
      matrix_close: 1,
      persistence_close: 1,
    }, 'idempotent failed shutdown must not retry resource disposers');
    return { key: 'shutdown_aggregates_failures_and_preserves_active_resources', status: 'PASS' };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.WORKER_BASE_WORKSPACE;
    delete process.env.WORKER_BASE_DATA_ROOT;
    delete process.env.DOCS_ROOT;
    delete process.env.STATIC_PROJECTS_ROOT;
    delete process.env.DY_PERSISTED_ASSET_ROOT;
  }
}

async function test_shutdown_times_out_never_settling_mqtt_close() {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0457-shutdown-timeout-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0457_shutdown_timeout_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null, shutdownStepTimeoutMs: 25 });
  try {
    await state.whenReady();
    let closeCalls = 0;
    let listenerCleanupCalls = 0;
    let lateCloseCallback = null;
    const neverClosingClient = {
      end(...args) {
        closeCalls += 1;
        lateCloseCallback = [...args].reverse().find((value) => typeof value === 'function') || null;
        return this;
      },
      removeAllListeners() {
        listenerCleanupCalls += 1;
      },
    };
    state.programEngine.controlBusClient = neverClosingClient;
    state.programEngine.controlBusReady = true;
    state.programEngine.controlBusSubscription = 'UIPUT/ws/dam/pic/de/R1/+/+';

    const startedAt = Date.now();
    const first = state.shutdown();
    const error = await Promise.race([
      first.then(() => null, (reason) => reason),
      new Promise((_, reject) => setTimeout(() => reject(new Error('shutdown_test_outer_timeout')), 500)),
    ]);
    assert.ok(error instanceof AggregateError, 'bounded shutdown must reject with the aggregate result');
    assert.equal(error.code, 'server_shutdown_failed');
    assert.deepEqual(error.failures, [{ stage: 'mqtt_close', message: 'mqtt_close_timeout' }]);
    assert.deepEqual(error.shutdown_state, {
      mode: 'edit',
      pending_matrix_host_actions: 0,
      mqtt_active: true,
      matrix_active: false,
      persistence_closed: true,
      background_work_pending: 0,
    });
    assert.ok(Date.now() - startedAt < 500, 'a client that never invokes its callback must not hang shutdown');
    assert.equal(closeCalls, 1);
    assert.strictEqual(state.programEngine.controlBusClient, neverClosingClient, 'timed-out MQTT state must remain visibly active');

    const repeated = state.shutdown();
    assert.strictEqual(repeated, first, 'timed-out shutdown must remain idempotent');
    assert.strictEqual(await repeated.then(() => null, (reason) => reason), error);
    assert.equal(closeCalls, 1, 'idempotent timeout must not retry the resource disposer');

    assert.equal(typeof lateCloseCallback, 'function', 'test client must retain the real MQTT end callback');
    lateCloseCallback();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(listenerCleanupCalls, 1, 'late completion may perform underlying listener cleanup exactly once');
    assert.equal(state.programEngine.controlBusClient, null, 'late completion must update the tracked MQTT resource state');
    assert.equal(state.programEngine.controlBusReady, false);
    assert.equal(state.programEngine.controlBusSubscription, '');
    assert.deepEqual(error.shutdown_state, {
      mode: 'edit',
      pending_matrix_host_actions: 0,
      mqtt_active: false,
      matrix_active: false,
      persistence_closed: true,
      background_work_pending: 0,
    }, 'cached shutdown error must track a late terminal MQTT cleanup');
    assert.deepEqual(state.getShutdownState(), error.shutdown_state, 'queryable shutdown state must match the cached error');
    assert.strictEqual(await state.shutdown().then(() => null, (reason) => reason), error);
    assert.equal(closeCalls, 1, 'late completion must not change idempotent disposer count');
    return { key: 'shutdown_times_out_never_settling_mqtt_close', status: 'PASS' };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.WORKER_BASE_WORKSPACE;
    delete process.env.WORKER_BASE_DATA_ROOT;
    delete process.env.DOCS_ROOT;
    delete process.env.STATIC_PROJECTS_ROOT;
    delete process.env.DY_PERSISTED_ASSET_ROOT;
  }
}

async function test_shutdown_cancels_late_matrix_init_and_closes_created_adapter() {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0457-shutdown-late-matrix-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0457_shutdown_late_matrix_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  let resolveFactory = null;
  const factoryResult = new Promise((resolve) => {
    resolveFactory = resolve;
  });
  let factoryCalls = 0;
  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({
    dbPath: null,
    shutdownStepTimeoutMs: 25,
    matrixAdapterFactory: async () => {
      factoryCalls += 1;
      return factoryResult;
    },
  });
  try {
    await state.whenReady();
    const model0 = state.runtime.getModel(0);
    state.runtime.addLabel(model0, 0, 0, 0, { k: 'matrix_room_id', t: 'str', v: '!late-init:localhost' });
    state.runtime.addLabel(model0, 0, 0, 0, { k: 'matrix_contuser', t: 'str', v: '@mbr:localhost' });
    await state.activateRuntimeMode('running');
    for (let index = 0; index < 20 && factoryCalls === 0; index += 1) {
      await Promise.resolve();
    }
    assert.equal(factoryCalls, 1, 'running activation must start one controlled Matrix initialization');
    const pendingInit = state.programEngine.matrixAdapterInitPromise;
    assert.equal(typeof pendingInit?.then, 'function');

    const first = state.shutdown();
    const error = await first.then(() => null, (reason) => reason);
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.failures, [{ stage: 'background_work_drain', message: 'background_work_drain_timeout' }]);
    assert.deepEqual(error.shutdown_state, {
      mode: 'edit',
      pending_matrix_host_actions: 0,
      mqtt_active: false,
      matrix_active: false,
      persistence_closed: true,
      background_work_pending: 1,
    }, 'timed-out Matrix init must remain visible as pending');

    let subscribeCalls = 0;
    let closeCalls = 0;
    let unsubscribeCalls = 0;
    const lateAdapter = {
      subscribe() {
        subscribeCalls += 1;
        return () => { unsubscribeCalls += 1; };
      },
      async close() {
        closeCalls += 1;
      },
    };
    resolveFactory(lateAdapter);
    await pendingInit;
    await Promise.resolve();

    assert.equal(subscribeCalls, 0, 'a stale Matrix generation must never subscribe after shutdown');
    assert.equal(unsubscribeCalls, 0, 'a stale Matrix generation must never publish a disposer into engine state');
    assert.equal(closeCalls, 1, 'a Matrix adapter created after shutdown must be closed immediately');
    assert.equal(state.programEngine.matrixAdapter, null);
    assert.equal(state.programEngine.matrixAdapterUnsub, null);
    assert.equal(state.programEngine.matrixAdapterInitPromise, null);
    assert.deepEqual(error.shutdown_state, {
      mode: 'edit',
      pending_matrix_host_actions: 0,
      mqtt_active: false,
      matrix_active: false,
      persistence_closed: true,
      background_work_pending: 0,
    }, 'cached shutdown error must update after late Matrix cleanup settles');
    assert.deepEqual(state.getShutdownState(), error.shutdown_state);
    assert.strictEqual(await state.shutdown().then(() => null, (reason) => reason), error);
    assert.equal(factoryCalls, 1, 'idempotent shutdown must not reconnect Matrix');
    return { key: 'shutdown_cancels_late_matrix_init_and_closes_created_adapter', status: 'PASS' };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.WORKER_BASE_WORKSPACE;
    delete process.env.WORKER_BASE_DATA_ROOT;
    delete process.env.DOCS_ROOT;
    delete process.env.STATIC_PROJECTS_ROOT;
    delete process.env.DY_PERSISTED_ASSET_ROOT;
  }
}

const tests = [
  test_normal_import_persists_and_restarts_complete_host_egress_contract,
  test_persisted_restart_reapplies_complete_host_egress_contract,
  test_import_preserves_per_pin_route_and_extension_declaration,
  test_import_rejects_invalid_route_and_extension_declarations,
  test_default_route_fallback_remains_backward_compatible,
  test_generated_bridge_lifts_only_declared_root_extensions,
  test_runtime_extension_survives_json_transport_and_legacy_metadata_stays_rejected,
  test_shutdown_aggregates_failures_and_preserves_active_resources,
  test_shutdown_times_out_never_settling_mqtt_close,
  test_shutdown_cancels_late_matrix_init_and_closes_created_adapter,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    const result = await test();
    console.log(`[${result.status}] ${result.key}`);
    passed += 1;
  } catch (error) {
    console.error(`[FAIL] ${test.name}: ${error.message}`);
    failed += 1;
  }
}
console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
