#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import {
  ACTOR_ATTESTATION_MARKER,
  actorCellLabels,
  expectedActorAttestation,
  importActorAttestationModule,
  inspectMbrRunnerBoundaryAst,
  inspectRunnerAttestationAst,
  loadSsotDeActor,
  loadSsotDeActors,
} from '../lib/ssot_de_actor_test_helpers.mjs';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const actors = loadSsotDeActors();
const expectedActors = Object.freeze({
  mbr: {
    workerId: '5/10/28/35/14',
    workerRole: 'DEM',
    workerAlias: null,
    topicBase: 'UIPUT/ws/dam/pic/de',
    declarationFile: 'deploy/sys-v1ns/mbr/patches/mbr_role_v0.json',
    busTypes: ['pin.bus.cb.in', 'pin.bus.cb.out', 'pin.bus.mb.in', 'pin.bus.mb.out'],
  },
  r1: {
    workerId: '5/10/28/35/15',
    workerRole: 'V1N',
    workerAlias: 'R1',
    topicBase: 'UIPUT/ws/dam/pic/de',
    declarationFile: 'deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json',
    busTypes: ['pin.bus.cb.in', 'pin.bus.cb.out'],
  },
  wm1: {
    workerId: '5/10/28/36/16',
    workerRole: 'DEM',
    workerAlias: 'WM1',
    topicBase: 'UIPUT/ws/dam/pic/de',
    declarationFile: 'deploy/sys-v1ns/workspace-manager/patches/00_workspace_manager_dem_config.json',
    busTypes: ['pin.bus.cb.in', 'pin.bus.cb.out', 'pin.bus.mb.in', 'pin.bus.mb.out'],
  },
});

function sorted(values) {
  return [...values].sort((left, right) => String(left).localeCompare(String(right)));
}

function routeEndpoints(connection) {
  return Array.isArray(connection?.value) ? connection.value : [];
}

function endpointEquals(value, expected) {
  return Array.isArray(value)
    && value.length === expected.length
    && value.every((item, index) => item === expected[index]);
}

function connectionHasRoute(connection, from, targetPredicate) {
  return routeEndpoints(connection).some((route) => (
    route && endpointEquals(route.from, from)
    && Array.isArray(route.to)
    && route.to.some(targetPredicate)
  ));
}

function mt(k, t, v, id = 0) {
  return { id, p: 0, r: 0, c: 0, k, t, v };
}

function dispatcherProbe(endpoint) {
  const opId = `0457_dispatch_${endpoint.model_id}_${endpoint.pin}`;
  const topic = `UIPUT/ws/dam/pic/de/R1/${endpoint.model_id}/${endpoint.pin}`;
  return [
    mt('__mt_payload_kind', 'str', 'pin_payload.v2'),
    mt('__mt_request_id', 'str', opId),
    mt('op_id', 'str', opId),
    mt('message_role', 'str', 'request'),
    mt('bus', 'str', 'control'),
    mt('route_kind', 'str', 'control'),
    mt('topic', 'str', topic),
    mt('response_topic', 'str', 'UIPUT/ws/dam/pic/de/U1/1/result'),
    mt('endpoint_worker_id', 'str', 'R1'),
    mt('endpoint_table_id', 'str', 'host'),
    mt('endpoint_model_id', 'int', endpoint.model_id),
    mt('endpoint_pin', 'str', endpoint.pin),
    mt('origin_worker_id', 'str', 'U1'),
    mt('origin_table_id', 'str', 'app:0457:dispatch-probe'),
    mt('origin_model_id', 'int', 1),
    mt('origin_pin', 'str', 'send'),
    mt('reply_target_worker_id', 'str', 'U1'),
    mt('reply_target_table_id', 'str', 'app:0457:dispatch-probe'),
    mt('reply_target_model_id', 'int', 1),
    mt('reply_target_pin', 'str', 'result'),
    mt('payload_model_id', 'int', 1),
    mt('timestamp', 'int', 1),
    mt('is_need_response', 'bool', false),
    mt('model_type', 'model.table', 'Data', 1),
    mt('sys_msg_type', 'str', '0457.dispatch.probe', 1),
  ];
}

async function settlePropagation() {
  for (let index = 0; index < 8; index += 1) {
    await new Promise((resolvePromise) => setImmediate(resolvePromise));
  }
}

function positiveModelSnapshot(runtime) {
  const snapshot = runtime.snapshot();
  return Object.fromEntries(Object.entries(snapshot.models || {})
    .filter(([modelId]) => Number(modelId) > 0));
}

function test_actor_facts_come_from_applied_versioned_patches() {
  for (const [name, actor] of Object.entries(actors)) {
    const expected = expectedActors[name];
    assert.equal(actor.loadRejected, 0, `${name}: every system/role record must apply without rejection`);
    assert.equal(actor.workerId, expected.workerId, `${name}: exact worker.id`);
    assert.equal(actor.workerRole, expected.workerRole, `${name}: exact worker.role`);
    assert.equal(actor.workerAlias, expected.workerAlias, `${name}: exact worker alias`);
    assert.equal(actor.topicBase, expected.topicBase, `${name}: exact MQTT topic base`);
    for (const key of ['sys_worker_id', 'sys_worker_role', 'mqtt_topic_base']) {
      assert.equal(actor.rootLabels[key]?.source_file, expected.declarationFile, `${name}: ${key} must come from role patch`);
    }
    if (expected.workerAlias !== null) {
      assert.equal(actor.rootLabels.mqtt_worker_id?.source_file, expected.declarationFile, `${name}: alias must come from role patch`);
    }
  }
}

function test_worker_roots_declare_loaded_model_v1n() {
  const violations = Object.values(actors)
    .filter((actor) => actor.rootForm?.key !== 'model_type' || actor.rootForm?.type !== 'model.v1n')
    .map((actor) => `${actor.name}:${actor.rootForm ? `${actor.rootForm.key}/${actor.rootForm.type}` : 'missing'}`);
  assert.deepEqual(violations, [], `loaded worker roots must declare model.v1n; got ${violations.join(', ')}`);
}

function test_target_actors_expose_exact_role_legal_bus_pins() {
  const violations = [];
  for (const [name, actor] of Object.entries(actors)) {
    const actualTypes = sorted(actor.busPins.map((pin) => pin.type));
    const expectedTypes = sorted(expectedActors[name].busTypes);
    if (JSON.stringify(actualTypes) !== JSON.stringify(expectedTypes)) {
      violations.push(`${name}:expected=${expectedTypes.join('|')}:actual=${actualTypes.join('|')}`);
    }
    if (actor.workerRole === 'V1N' && actualTypes.some((type) => type.startsWith('pin.bus.mb.'))) {
      violations.push(`${name}:V1N_exposes_management_bus`);
    }
  }
  assert.deepEqual(violations, [], `actor bus contracts differ: ${violations.join(', ')}`);
}

function test_mbr_model_zero_is_structural_bus_boundary_only() {
  const allowedInfrastructureFunctions = new Set(['mt_write', 'mt_bus_receive', 'mt_bus_send']);
  const violations = [
    ...actors.mbr.rootFunctions
      .filter((entry) => !allowedInfrastructureFunctions.has(entry.key))
      .map((entry) => `model0_business_function:${entry.key}`),
    ...actors.mbr.directModelMinus10InboxConfig.map((record) => `model-10_direct_config:${record.key}`),
  ];
  assert.deepEqual(violations, [], `MBR Model 0/-10 must not retain direct business dispatch: ${violations.join(', ')}`);
}

function test_mbr_runner_maps_matrix_and_mqtt_only_to_model_zero_bus_inputs() {
  const contract = inspectMbrRunnerBoundaryAst();
  assert.deepEqual(contract.violations, [], `${contract.runnerPath}: ${contract.violations.join(', ')}`);
}

function test_r1_mqtt_ingress_cannot_fall_through_to_positive_models() {
  const ingress = actors.r1.busPins.find((pin) => pin.key === actors.r1.mqttIngressPin);
  const mounted = new Set(actors.r1.mounts.map((mount) => mount.child_model_id));
  const unmountedSubscriptions = actors.r1.subscribedModelIds.filter((modelId) => !mounted.has(modelId));
  const violations = [
    ...(actors.r1.directPositiveIngressRisk ? ['positive_model_fallback_risk'] : []),
    ...(!actors.r1.mqttIngressPin ? ['missing:mqtt_ingress_pin'] : []),
    ...(ingress?.type !== 'pin.bus.cb.in' ? [`invalid_control_ingress:${ingress?.type ?? 'missing'}`] : []),
    ...unmountedSubscriptions.map((modelId) => `unmounted_subscription:${modelId}`),
  ];
  assert.deepEqual(violations, [], `R1 ingress must enter via Model 0 control bus: ${violations.join(', ')}`);
}

function test_r1_model_minus10_dispatcher_chain_is_structural() {
  const r1 = actors.r1;
  const ingressKey = r1.mqttIngressPin;
  const systemMount = r1.mounts.find((mount) => mount.parent_model_id === 0 && mount.child_model_id === -10);
  const violations = [];
  if (!systemMount) {
    violations.push('missing_model_minus10_mount');
  } else {
    const model0Routes = r1.connections.filter((entry) => entry.model_id === 0 && entry.p === 0 && entry.r === 0 && entry.c === 0);
    const parentBoundaryCandidates = [];
    for (const connection of model0Routes) {
      for (const route of routeEndpoints(connection)) {
        if (!endpointEquals(route?.from, [0, 0, 0, ingressKey]) || !Array.isArray(route.to)) continue;
        for (const target of route.to) {
          if (!Array.isArray(target) || target.length !== 4) continue;
          if (target[0] !== systemMount.p || target[1] !== systemMount.r || target[2] !== systemMount.c) continue;
          const label = actorCellLabels(r1, 0, systemMount.p, systemMount.r, systemMount.c)[target[3]];
          if (label?.type === 'pin.in') parentBoundaryCandidates.push(label);
        }
      }
    }
    const parentBoundary = parentBoundaryCandidates.length === 1 ? parentBoundaryCandidates[0] : null;
    const childBoundary = parentBoundary ? actorCellLabels(r1, -10)[parentBoundary.key] : null;
    if (parentBoundaryCandidates.length !== 1) violations.push(`model_minus10_parent_boundary_count:${parentBoundaryCandidates.length}`);
    if (!childBoundary || childBoundary.type !== 'pin.in') violations.push('missing_model_minus10_child_boundary_pin');

    const reachesSystemMount = parentBoundary && model0Routes.some((connection) => connectionHasRoute(
      connection,
      [0, 0, 0, ingressKey],
      (target) => endpointEquals(target, [systemMount.p, systemMount.r, systemMount.c, parentBoundary.key]),
    ));
    if (!reachesSystemMount) violations.push('model0_ingress_does_not_route_to_model_minus10');

    const dispatcherFunctions = r1.functions.filter((entry) => entry.model_id === -10 && /dispatch/iu.test(entry.key));
    const routeTables = r1.entries.filter((entry) => (
      entry.model_id === -10
      && /route|dispatch/iu.test(entry.key)
      && entry.key !== 'remote_subscriptions'
      && entry.type !== 'func.js'
      && entry.type !== 'func.python'
      && entry.type !== 'pin.connect.cell'
      && entry.type !== 'pin.connect.label'
      && !entry.type.startsWith('pin.')
    ));
    if (dispatcherFunctions.length === 0) violations.push('missing_model_minus10_dispatcher_function');
    if (routeTables.length === 0) violations.push('missing_model_minus10_endpoint_route_table');

    const childRootRoutes = r1.connections.filter((entry) => entry.model_id === -10 && entry.p === 0 && entry.r === 0 && entry.c === 0);
    const childRootLabelRoutes = r1.labelConnections.filter((entry) => entry.model_id === -10 && entry.p === 0 && entry.r === 0 && entry.c === 0);
    const directlyWiredRootDispatcher = parentBoundary && dispatcherFunctions.some((dispatcher) => (
      dispatcher.p === 0
      && dispatcher.r === 0
      && dispatcher.c === 0
      && childRootLabelRoutes.some((wiring) => Array.isArray(wiring.value) && wiring.value.some((route) => (
        route?.from === parentBoundary.key
        && Array.isArray(route.to)
        && route.to.includes(`${dispatcher.key}:in`)
      )))
    ));
    const dispatchTargets = parentBoundary ? childRootRoutes.flatMap((connection) => routeEndpoints(connection).flatMap((route) => {
      if (!endpointEquals(route?.from, [0, 0, 0, parentBoundary.key]) || !Array.isArray(route.to)) return [];
      return route.to;
    })) : [];
    const wiredDispatchTarget = dispatchTargets.some((target) => {
      const [p, r, c, pin] = target;
      const cellLabels = actorCellLabels(r1, -10, p, r, c);
      const dispatcher = dispatcherFunctions.find((entry) => entry.p === p && entry.r === r && entry.c === c);
      const wirings = Object.values(cellLabels).filter((entry) => entry.type === 'pin.connect.label');
      return Boolean(dispatcher && wirings.some((wiring) => Array.isArray(wiring.value) && wiring.value.some((route) => (
        route?.from === pin && Array.isArray(route.to) && route.to.includes(`${dispatcher.key}:in`)
      ))));
    });
    if (!directlyWiredRootDispatcher && !wiredDispatchTarget) {
      violations.push('model_minus10_boundary_does_not_wire_to_dispatcher');
    }
    if (dispatcherFunctions.length > 0 && routeTables.length > 0) {
      const codeText = JSON.stringify(dispatcherFunctions.map((entry) => entry.value));
      if (!routeTables.some((entry) => codeText.includes(entry.key))) violations.push('dispatcher_does_not_read_route_table');
      if (/ctx\.hostApi|writeCrossModel|rmCrossModel|readCrossModel/u.test(codeText)) {
        violations.push('dispatcher_uses_cross_model_host_api');
      }
      if (!/V1N\.addLabel/u.test(codeText)) violations.push('dispatcher_does_not_emit_declared_pin');
    }
  }
  assert.deepEqual(violations, [], `R1 Model -10 dispatcher chain violations: ${violations.join(', ')}`);
}

async function test_r1_dispatcher_reaches_every_subscribed_mounted_endpoint() {
  for (const endpoint of actors.r1.subscribedEndpoints) {
    const r1 = loadSsotDeActor('r1');
    const mount = r1.mounts.find((entry) => entry.parent_model_id === 0 && entry.child_model_id === endpoint.model_id);
    assert.ok(mount, `${endpoint.topic}: endpoint model must be mounted`);
    assert.equal(
      actorCellLabels(r1, 0, mount.p, mount.r, mount.c)[endpoint.pin]?.type,
      'pin.in',
      `${endpoint.topic}: parent connection Cell must declare endpoint pin.in`,
    );
    r1.runtime.setRuntimeMode('edit');
    r1.runtime.setRuntimeMode('running');
    assert.equal(r1.runtime.getRuntimeMode(), 'running', `${endpoint.topic}: runtime must be running`);
    const records = dispatcherProbe(endpoint);
    const model0 = r1.runtime.getModel(0);
    const ingress = r1.rootLabels[r1.mqttIngressPin];
    assert.ok(ingress, `${endpoint.topic}: declared Model 0 ingress`);
    const applied = r1.runtime.addLabel(model0, 0, 0, 0, {
      k: ingress.key,
      t: ingress.type,
      v: records,
    });
    assert.equal(applied.applied, true, `${endpoint.topic}: ingress write must apply`);
    await settlePropagation();
    const delivered = r1.runtime.getCell(r1.runtime.getModel(endpoint.model_id), 0, 0, 0).labels.get(endpoint.pin);
    assert.deepEqual(delivered?.v, records, `${endpoint.topic}: dispatcher must deliver through declared PIN chain`);
  }
}

async function test_r1_malformed_ingress_never_writes_positive_model_error() {
  const r1 = loadSsotDeActor('r1');
  await r1.runtime.setRuntimeMode('edit');
  await r1.runtime.setRuntimeMode('running');
  const before = positiveModelSnapshot(r1.runtime);
  const handled = r1.runtime.mqttIncoming('UIPUT/ws/dam/pic/de/R1/100/submit', {
    version: 'v1',
    type: 'pin_payload',
    payload: [],
  });
  assert.equal(handled, false, 'malformed ingress must fail closed');
  assert.deepEqual(
    positiveModelSnapshot(r1.runtime),
    before,
    'malformed ingress must leave every positive-model cell and label unchanged',
  );
}

async function test_exported_attestation_builder_is_pure_and_loaded_state_derived() {
  const imported = await importActorAttestationModule();
  assert.equal(imported.error, null, `attestation module contract missing: ${imported.error}`);
  assert.equal(typeof imported.module.buildDeActorAttestation, 'function', 'must export buildDeActorAttestation');
  assert.equal(imported.module.ACTOR_ATTESTATION_MARKER, ACTOR_ATTESTATION_MARKER, 'attestation marker mismatch');
  for (const actor of Object.values(actors)) {
    const before = JSON.stringify(actor.runtime.snapshot());
    const options = { runtime: actor.runtime, sourceFiles: actor.sourceFiles };
    const first = imported.module.buildDeActorAttestation(options);
    const second = imported.module.buildDeActorAttestation(options);
    assert.deepEqual(first, expectedActorAttestation(actor), `${actor.name}: attestation must derive loaded state`);
    assert.deepEqual(second, first, `${actor.name}: attestation builder must be deterministic`);
    assert.equal(JSON.stringify(actor.runtime.snapshot()), before, `${actor.name}: attestation builder must be pure`);
  }
}

function runAttestationOnly(actor) {
  return spawnSync(process.execPath, [resolve(repoRoot, actor.runnerPath), resolve(repoRoot, actor.patchDir)], {
    cwd: repoRoot,
    env: {
      ...process.env,
      DY_ACTOR_ATTEST_ONLY: '1',
      DY_PERSISTED_ASSET_ROOT: '',
      DY_ROLE_PATCH_DIR: resolve(repoRoot, actor.patchDir),
      DY_WORKER_SCOPE: actor.workerScope,
      DY_WORKER_LOG_PREFIX: `0457-${actor.name}`,
      MODELTABLE_PATCH_JSON: '',
    },
    encoding: 'utf8',
    timeout: 5000,
    killSignal: 'SIGKILL',
    maxBuffer: 2 * 1024 * 1024,
  });
}

function test_actor_runners_call_and_output_loaded_attestation() {
  const astViolations = [...new Set(Object.values(actors).map((actor) => actor.runnerPath))]
    .map(inspectRunnerAttestationAst)
    .filter((contract) => contract.violations.length > 0);
  assert.deepEqual(astViolations, [], `runner attestation AST contracts: ${JSON.stringify(astViolations)}`);

  for (const actor of Object.values(actors)) {
    const result = runAttestationOnly(actor);
    assert.equal(result.error, undefined, `${actor.name}: attestation-only runner error ${result.error?.message || ''}`);
    assert.equal(result.status, 0, `${actor.name}: attestation-only exit=${result.status} stderr=${result.stderr}`);
    const lines = String(result.stdout || '').split(/\r?\n/u)
      .filter((line) => line.startsWith(`${ACTOR_ATTESTATION_MARKER} `));
    assert.equal(lines.length, 1, `${actor.name}: runner must emit exactly one attestation line`);
    const parsed = JSON.parse(lines[0].slice(ACTOR_ATTESTATION_MARKER.length + 1));
    assert.deepEqual(parsed, expectedActorAttestation(actor), `${actor.name}: emitted attestation mismatch`);
  }
}

const tests = [
  test_actor_facts_come_from_applied_versioned_patches,
  test_worker_roots_declare_loaded_model_v1n,
  test_target_actors_expose_exact_role_legal_bus_pins,
  test_mbr_model_zero_is_structural_bus_boundary_only,
  test_mbr_runner_maps_matrix_and_mqtt_only_to_model_zero_bus_inputs,
  test_r1_mqtt_ingress_cannot_fall_through_to_positive_models,
  test_r1_model_minus10_dispatcher_chain_is_structural,
  test_r1_dispatcher_reaches_every_subscribed_mounted_endpoint,
  test_r1_malformed_ingress_never_writes_positive_model_error,
  test_exported_attestation_builder_is_pure_and_loaded_state_derived,
  test_actor_runners_call_and_output_loaded_attestation,
];

let failed = 0;
for (const test of tests) {
  try {
    await test();
    console.log(`[PASS] ${test.name}`);
  } catch (error) {
    failed += 1;
    console.error(`[FAIL] ${test.name}`);
    console.error(error && error.message ? error.message : error);
  }
}

if (failed > 0) {
  console.error(`${failed} failed, ${tests.length - failed} passed out of ${tests.length}`);
  process.exit(1);
}

console.log(`${tests.length} passed, 0 failed out of ${tests.length}`);
