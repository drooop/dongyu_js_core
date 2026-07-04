#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  buildClientSnapshotForPrincipal,
  createServerState,
  deriveWorkspaceRegistryFromSnapshot,
} from '../../packages/ui-model-demo-server/server.mjs';
import { WorkerEngineV0, loadSystemPatch } from '../worker_engine_v0.mjs';
import {
  externalPacket,
  mt,
  payloadValue,
  pinPayloadV2Records,
} from '../lib/pin_payload_v2_test_helpers.mjs';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');
const { createRenderer } = require('../../packages/ui-renderer/src/index.js');

const COLOR_APP_NAME = 'E2E 颜色生成器';

function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0434-color-subtable-'));
  const previous = {
    DY_AUTH: process.env.DY_AUTH,
    DY_DEV_FAKE_LOGIN: process.env.DY_DEV_FAKE_LOGIN,
    DY_PERSISTED_ASSET_ROOT: process.env.DY_PERSISTED_ASSET_ROOT,
    WORKER_BASE_WORKSPACE: process.env.WORKER_BASE_WORKSPACE,
    WORKER_BASE_DATA_ROOT: process.env.WORKER_BASE_DATA_ROOT,
    DOCS_ROOT: process.env.DOCS_ROOT,
    STATIC_PROJECTS_ROOT: process.env.STATIC_PROJECTS_ROOT,
  };
  let state = null;
  process.env.DY_AUTH = '0';
  process.env.DY_DEV_FAKE_LOGIN = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0434_color_subtable_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  try {
    state = createServerState({ dbPath: null });
    return fn(state);
  } finally {
    if (state?.runtime?.persistence && typeof state.runtime.persistence.close === 'function') {
      state.runtime.persistence.close();
    }
    rmSync(tempRoot, { recursive: true, force: true });
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function principal(subject) {
  return {
    subject,
    userId: subject,
    capabilities: ['app:read', 'app:write', 'workspace:read', 'workspace:write', 'slide_app:use'],
  };
}

function labelsAt(snapshotModel, cellKey = '0,0,0') {
  return snapshotModel?.cells?.[cellKey]?.labels || {};
}

function readJson(pathname) {
  return JSON.parse(readFileSync(pathname, 'utf8'));
}

function payloadRecord(records, key, id = 0) {
  return Array.isArray(records)
    ? records.find((record) => record && record.id === id && record.k === key) || null
    : null;
}

function payloadString(records, key, id = 0) {
  const record = payloadRecord(records, key, id);
  return record && record.t === 'str' ? record.v : '';
}

function fakeH(type, props, children) {
  let normalized = children;
  if (children && typeof children === 'object' && typeof children.default === 'function') {
    normalized = children.default();
  }
  return { type, props: props || {}, children: normalized };
}

function fakeResolve(name) {
  return name;
}

function flattenText(node) {
  if (node === null || node === undefined) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join('');
  if (typeof node === 'object') return flattenText(node.children);
  return '';
}

function walk(node, visitor) {
  if (!node) return;
  visitor(node);
  const children = Array.isArray(node.children) ? node.children : [node.children];
  for (const child of children) {
    if (child && typeof child === 'object') walk(child, visitor);
  }
}

function findButtonByText(root, text) {
  let found = null;
  walk(root, (node) => {
    if (found) return;
    if ((node.type === 'button' || node.type === 'ElButton') && flattenText(node).includes(text)) found = node;
  });
  return found;
}

function loadRemoteWorkerModel100Runtime() {
  const rt = new ModelTableRuntime();
  loadSystemPatch(rt);
  if (!rt.getModel(-10)) rt.createModel({ id: -10, name: 'system', type: 'system' });
  for (const pathname of [
    'deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json',
    'deploy/sys-v1ns/remote-worker/patches/10_model100.json',
  ]) {
    rt.applyPatch(readJson(pathname), {
      allowCreateModel: true,
      trustedBootstrap: true,
    });
  }
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  return rt;
}

function drainWorkerEngine(rt) {
  const mqttPublished = [];
  const engine = new WorkerEngineV0({
    runtime: rt,
    mqttPublish: (topic, payload) => mqttPublished.push({ topic, payload }),
    mgmtAdapter: {
      publish: async () => {},
    },
  });
  engine.tick();
  return mqttPublished;
}

async function wait(ms = 80) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function findHostSubtableConnections(runtime, tableId) {
  const model0 = runtime.getModel(0);
  const matches = [];
  for (const cell of model0.cells.values()) {
    for (const label of cell.labels.values()) {
      if (label && label.t === 'model.subtableconnection' && label.v?.table_id === tableId) {
        matches.push({ cell, label });
      }
    }
  }
  return matches;
}

function colorEntriesForPrincipal(runtime, subject) {
  return deriveWorkspaceRegistryFromSnapshot({
    snapshot: buildClientSnapshotForPrincipal(runtime.snapshot(), principal(subject)),
  }).filter((entry) => entry.name === COLOR_APP_NAME);
}

function assertConnectionCellBoundaryOnly(match) {
  const allowedTypes = new Set(['model.subtableconnection', 'pin.in', 'pin.out', 'pin.login', 'pin.logout']);
  for (const [key, label] of match.cell.labels.entries()) {
    assert.equal(
      allowedTypes.has(label.t),
      true,
      `connection_cell_must_not_hold_business_label:${key}:${label.t}`,
    );
  }
}

function test_e2e_color_generator_is_registered_only_as_app_table() {
  return withServerState((state) => {
    const snapshot = state.runtime.snapshot();
    const registry = deriveWorkspaceRegistryFromSnapshot({ snapshot });

    const hostColorEntry = registry.find((entry) => entry.table_id === 'host' && entry.model_id === 100);
    assert.equal(hostColorEntry, undefined, 'host_model100_must_not_remain_workspace_app_entry');

    const colorEntries = registry.filter((entry) => entry.name === COLOR_APP_NAME);
    assert.equal(colorEntries.length, 1, 'color_generator_must_have_exactly_one_workspace_entry');
    const colorEntry = colorEntries[0];
    assert.equal(typeof colorEntry.table_id, 'string', 'color_generator_must_publish_table_id');
    assert.notEqual(colorEntry.table_id, 'host', 'color_generator_must_be_registered_as_child_app_table');
    assert.equal(colorEntry.model_id, 0, 'color_generator_app_table_root_model_id_must_be_zero');
    assert.equal(colorEntry.app_origin, 'slid_in', 'color_generator_must_remain_slid_in_origin');
    assert.equal(colorEntry.source_de, 'RemoteWorker R1', 'color_generator_must_keep_source_de');

    const appRoot = snapshot.tables?.[colorEntry.table_id]?.models?.['0'];
    assert.ok(appRoot, 'color_generator_child_app_table_root_must_exist_in_snapshot');
    assert.equal(
      labelsAt(appRoot).model_type?.t,
      'model.subtable',
      'color_generator_child_app_table_root_must_declare_model_subtable',
    );
    assert.equal(labelsAt(appRoot).slide_capable?.v, true, 'color_generator_app_table_root_must_be_slide_capable');
    assert.equal(labelsAt(appRoot).app_name?.v, COLOR_APP_NAME, 'color_generator_app_table_root_must_keep_app_name');

    const connections = findHostSubtableConnections(state.runtime, colorEntry.table_id);
    assert.equal(connections.length, 1, 'host_must_have_one_model_subtableconnection_for_color_generator');
    assert.deepEqual(
      connections[0].label.v,
      {
        table_id: colorEntry.table_id,
        root_model_id: 0,
        mount_kind: 'slide_app',
        owner_principal_id: 'local-dev',
      },
      'color_generator_model_subtableconnection_must_have_strict_shape',
    );
    assertConnectionCellBoundaryOnly(connections[0]);

    return { key: 'e2e_color_generator_is_registered_only_as_app_table', status: 'PASS' };
  });
}

function test_seeded_color_generator_is_principal_scoped() {
  return withServerState((state) => {
    const localEntries = colorEntriesForPrincipal(state.runtime, 'local-dev');
    assert.equal(localEntries.length, 1, 'local_dev_must_see_one_color_generator_app_table');
    const model0 = state.runtime.getModel(0);
    state.runtime.principalRuntimeKey = 'subject:drop-test';
    state.runtime.addLabel(model0, 0, 0, 0, { k: 'principal_runtime_key', t: 'str', v: 'subject:drop-test' });
    const seeded = state.ensureSeededSlidInAppSubtables();
    assert.equal(seeded.some((entry) => entry.status === 'created'), true, 'new_principal_must_create_own_color_generator_app_table');

    const dropEntries = colorEntriesForPrincipal(state.runtime, 'drop-test');
    assert.equal(dropEntries.length, 1, 'drop_test_must_see_one_color_generator_app_table');
    assert.notEqual(dropEntries[0].table_id, localEntries[0].table_id, 'principals_must_not_share_seeded_color_app_table');
    assert.equal(findHostSubtableConnections(state.runtime, localEntries[0].table_id)[0].label.v.owner_principal_id, 'local-dev');
    assert.equal(findHostSubtableConnections(state.runtime, dropEntries[0].table_id)[0].label.v.owner_principal_id, 'drop-test');

    return { key: 'seeded_color_generator_is_principal_scoped', status: 'PASS' };
  });
}

function test_seeded_color_generator_is_persistent_and_idempotent() {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0434-color-subtable-persist-'));
  const previous = {
    DY_AUTH: process.env.DY_AUTH,
    DY_DEV_FAKE_LOGIN: process.env.DY_DEV_FAKE_LOGIN,
    DY_PERSISTED_ASSET_ROOT: process.env.DY_PERSISTED_ASSET_ROOT,
    WORKER_BASE_WORKSPACE: process.env.WORKER_BASE_WORKSPACE,
    WORKER_BASE_DATA_ROOT: process.env.WORKER_BASE_DATA_ROOT,
    DOCS_ROOT: process.env.DOCS_ROOT,
    STATIC_PROJECTS_ROOT: process.env.STATIC_PROJECTS_ROOT,
  };
  process.env.DY_AUTH = '0';
  process.env.DY_DEV_FAKE_LOGIN = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0434_color_subtable_persist_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  const dbPath = join(tempRoot, 'runtime.sqlite');
  try {
    const script = `
      const mod = await import(${JSON.stringify(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url).href)});
      const principal = {
        subject: 'local-dev',
        userId: 'local-dev',
        capabilities: ['app:read', 'app:write', 'workspace:read', 'workspace:write', 'slide_app:use'],
      };
      function colorEntries(state) {
        return mod.deriveWorkspaceRegistryFromSnapshot({
          snapshot: mod.buildClientSnapshotForPrincipal(state.runtime.snapshot(), principal),
        }).filter((entry) => entry.name === ${JSON.stringify(COLOR_APP_NAME)});
      }
      const first = mod.createServerState({ dbPath: ${JSON.stringify(dbPath)} });
      const firstEntries = colorEntries(first);
      const firstTableId = firstEntries[0] && firstEntries[0].table_id;
      if (first.runtime.persistence && typeof first.runtime.persistence.close === 'function') first.runtime.persistence.close();
      const second = mod.createServerState({ dbPath: ${JSON.stringify(dbPath)} });
      const secondEntries = colorEntries(second);
      if (second.runtime.persistence && typeof second.runtime.persistence.close === 'function') second.runtime.persistence.close();
      console.log(JSON.stringify({
        firstCount: firstEntries.length,
        firstTableId,
        secondCount: secondEntries.length,
        secondTableId: secondEntries[0] && secondEntries[0].table_id,
      }));
    `;
    const result = spawnSync('bun', ['--eval', script], {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 30000,
      env: process.env,
    });
    assert.equal(result.status, 0, `bun_seed_persistence_probe_failed:${result.stderr || result.stdout}`);
    const lines = result.stdout.trim().split('\n').filter(Boolean);
    const parsed = JSON.parse(lines[lines.length - 1] || '{}');
    assert.equal(parsed.firstCount, 1, 'first_boot_must_seed_one_color_app_table');
    assert.equal(parsed.secondCount, 1, 'second_boot_must_not_duplicate_seeded_color_app_table');
    assert.equal(parsed.secondTableId, parsed.firstTableId, 'second_boot_must_reuse_persisted_seeded_color_app_table');
    return { key: 'seeded_color_generator_is_persistent_and_idempotent', status: 'PASS' };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function test_remote_color_worker_accepts_subtable_reply_target() {
  const rt = loadRemoteWorkerModel100Runtime();
  const tableId = 'app:drop:e2e:2-0-20:1';
  const topic = 'UIPUT/ws/dam/pic/de/R1/100/submit';
  const responseTopic = 'UIPUT/ws/dam/pic/de/U1/1051/result';
  const records = pinPayloadV2Records({
    opId: '0434_color_subtable_remote',
    endpointWorkerId: 'R1',
    endpointTableId: 'host',
    endpointModelId: 100,
    endpointPin: 'submit',
    topic,
    responseTopic,
    originWorkerId: 'U1',
    originTableId: tableId,
    originModelId: 0,
    originPin: 'submit',
    replyTargetWorkerId: 'U1',
    replyTargetTableId: tableId,
    replyTargetModelId: 0,
    replyTargetPin: 'result',
    replyTargetPrincipalKey: 'subject:drop',
    payloadRecords: [
      mt('model_type', 'model.single', 'Data.RemoteSubmit', 1),
      mt('input_value', 'str', 'subtable color smoke', 1),
      mt('route_mode', 'str', 'remote', 1),
    ],
  });

  const accepted = rt.mqttIncoming(topic, externalPacket(records));
  assert.equal(accepted, true, 'remote_model100_must_accept_subtable_origin_request');
  await wait();

  const root = rt.getCell(rt.getModel(100), 0, 0, 0).labels;
  assert.notEqual(root.get('status')?.v, 'pin_payload_invalid', 'remote_model100_must_not_reject_subtable_reply_target');
  assert.equal(root.get('status')?.v, 'processed', 'remote_model100_must_process_color_submit');
  assert.match(root.get('bg_color')?.v || '', /^#[0-9a-f]{6}$/i, 'remote_model100_must_generate_color');

  const published = drainWorkerEngine(rt);
  assert.equal(published.length, 1, 'remote_model100_must_publish_one_subtable_reply');
  assert.equal(published[0].topic, responseTopic, 'remote_model100_reply_must_publish_on_response_topic');
  const replyRecords = published[0].payload.payload;
  assert.equal(payloadString(replyRecords, 'endpoint_worker_id'), 'U1', 'reply_endpoint_must_be_response_topic_worker');
  assert.equal(payloadString(replyRecords, 'endpoint_table_id'), 'host', 'reply_endpoint_must_be_host_response_endpoint');
  assert.equal(payloadValue(replyRecords, 'endpoint_model_id'), 1051, 'reply_endpoint_must_use_response_topic_model');
  assert.equal(payloadString(replyRecords, 'reply_target_table_id'), tableId, 'reply_target_must_preserve_child_app_table');
  assert.equal(payloadValue(replyRecords, 'reply_target_model_id'), 0, 'reply_target_must_preserve_child_app_root_model');
  assert.equal(payloadString(replyRecords, 'reply_target_principal_key'), 'subject:drop', 'reply_must_preserve_principal_key');

  return { key: 'remote_color_worker_accepts_subtable_reply_target', status: 'PASS' };
}

function test_renderer_releases_color_subtable_button_when_business_loading_is_false() {
  const tableId = 'app:drop:e2e:2-0-20:1';
  const snapshot = {
      models: {
        '-1': {
          table_id: 'host',
          id: -1,
          cells: {
            '0,0,1': {
              p: 0,
              r: 0,
              c: 1,
              labels: {
                bus_event_last_op_id: { k: 'bus_event_last_op_id', t: 'str', v: 'host_op_1' },
              },
            },
          },
        },
      },
      tables: {
        [tableId]: {
          table_id: tableId,
          models: {
            '0': {
              table_id: tableId,
              id: 0,
              cells: {
                '0,0,0': {
                  p: 0,
                  r: 0,
                  c: 0,
                  labels: {
                    submit_inflight: { k: 'submit_inflight', t: 'bool', v: true },
                  },
                },
              },
            },
          },
        },
      },
  };
  const renderer = createRenderer({
    vue: { h: fakeH, resolveComponent: fakeResolve },
    host: {
      getSnapshot: () => snapshot,
      dispatchAddLabel: () => ({ ok: true }),
      dispatchRmLabel: () => ({ ok: true }),
    },
  });
  const buttonNode = {
    id: 'subtable_color_submit_button',
    type: 'Button',
    cell_ref: { table_id: tableId, model_id: 0, p: 1, r: 0, c: 0 },
    props: {
      label: 'Generate Color',
      loading: { $label: { p: 0, r: 0, c: 0, k: 'submit_inflight' } },
      disabled: { $label: { p: 0, r: 0, c: 0, k: 'submit_inflight' } },
      singleFlight: {
        key: 'model100_submit',
        releaseRef: { model_id: -1, p: 0, r: 0, c: 1, k: 'bus_event_last_op_id' },
      },
    },
    bind: {
      write: {
        action: 'label_update',
        target_ref: { table_id: tableId, model_id: 0, p: 0, r: 0, c: 0, k: 'submit_request' },
        value_ref: { t: 'json', v: { click: true } },
      },
    },
  };

  const firstRender = renderer.renderVNode(buttonNode);
  const firstButton = findButtonByText(firstRender, 'Generate Color');
  firstButton.props.onClick();

  delete snapshot.tables[tableId].models['0'].cells['0,0,0'].labels.submit_inflight;
  const missingLabelRender = renderer.renderVNode(buttonNode);
  const missingLabelButton = findButtonByText(missingLabelRender, 'Generate Color');
  assert.equal(missingLabelButton.props.loading, true, 'missing_business_loading_label_must_not_release_subtable_singleflight');
  assert.equal(missingLabelButton.props.disabled, true, 'missing_business_loading_label_must_keep_subtable_singleflight_disabled');

  snapshot.tables[tableId].models['0'].cells['0,0,0'].labels.submit_inflight = {
    k: 'submit_inflight',
    t: 'bool',
    v: false,
  };
  const secondRender = renderer.renderVNode(buttonNode);
  const secondButton = findButtonByText(secondRender, 'Generate Color');
  assert.equal(secondButton.props.loading, false, 'business_loading_false_must_release_subtable_singleflight_loading');
  assert.equal(secondButton.props.disabled, false, 'business_loading_false_must_release_subtable_singleflight_disabled');

  return { key: 'renderer_releases_color_subtable_button_when_business_loading_is_false', status: 'PASS' };
}

const tests = [
  test_e2e_color_generator_is_registered_only_as_app_table,
  test_seeded_color_generator_is_principal_scoped,
  test_seeded_color_generator_is_persistent_and_idempotent,
  test_remote_color_worker_accepts_subtable_reply_target,
  test_renderer_releases_color_subtable_button_when_business_loading_is_false,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    const result = await test();
    console.log(`[${result.status}] ${result.key}`);
    passed += 1;
  } catch (err) {
    console.log(`[FAIL] ${test.name}: ${err && err.stack ? err.stack : err}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
