#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadSystemPatch } from '../worker_engine_v0.mjs';
import { buildAstFromCellwiseModel } from '../../packages/ui-model-demo-frontend/src/ui_cellwise_projection.js';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

const MODEL_ID = 1080;
const BUS_KEY = 'matrix_suite_1080_bus_event';
const workspacePath = 'packages/worker-base/system-models/workspace_positive_models.json';
const hierarchyPath = 'packages/worker-base/system-models/runtime_hierarchy_mounts.json';

function readJson(pathname) {
  return JSON.parse(fs.readFileSync(pathname, 'utf8'));
}

function wait(ms = 180) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mt(k, t, v) {
  return { id: 0, p: 0, r: 0, c: 0, k, t, v };
}

function payload(action, extra = []) {
  return [
    mt('__mt_payload_kind', 'str', 'ui_event.v1'),
    mt('action', 'str', action),
    ...extra,
  ];
}

async function withServerState(options, fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0397-matrix-suite-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0397_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  process.env.DY_UI_SERVER_WORKER_ID = 'U1';
  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null, ...options });
  try {
    await state.activateRuntimeMode('running');
    return await fn(state);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.WORKER_BASE_WORKSPACE;
    delete process.env.WORKER_BASE_DATA_ROOT;
    delete process.env.DOCS_ROOT;
    delete process.env.STATIC_PROJECTS_ROOT;
    delete process.env.DY_PERSISTED_ASSET_ROOT;
    delete process.env.DY_UI_SERVER_WORKER_ID;
  }
}

async function dispatch(state, action, extra = []) {
  const result = await state.submitEnvelope({
    type: 'bus_event_v2',
    bus_in_key: BUS_KEY,
    value: payload(action, extra),
    meta: { op_id: `it0397_${action}_${Date.now()}` },
  });
  assert.equal(result.result, 'ok', `${action} must route through Model 0`);
  assert.equal(result.routed_by, 'model0_busin', `${action} must use model0 bus ingress`);
  await wait();
  return result;
}

function labels(state) {
  return state.clientSnap().models[String(MODEL_ID)].cells['0,0,0'].labels;
}

function loadRuntime() {
  const rt = new ModelTableRuntime();
  loadSystemPatch(rt);
  for (const pathname of [workspacePath, hierarchyPath]) {
    const result = rt.applyPatch(readJson(pathname), { allowCreateModel: true, trustedBootstrap: true });
    assert.equal(result.rejected, 0, `${pathname} must load without rejected records`);
  }
  return rt;
}

function findNode(node, id) {
  if (!node || typeof node !== 'object') return null;
  if (node.id === id) return node;
  for (const child of node.children || []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

async function test_refresh_rooms_materializes_real_matrix_rooms() {
  const calls = [];
  const remoteRooms = [
    { room_id: '!roomA:synapse.dongyudigital.com', name: 'Dongyu Local Test', canonical_alias: '#dongyu-local:synapse.dongyudigital.com' },
    { room_id: '!roomB:synapse.dongyudigital.com', name: 'Remote Matrix Check', canonical_alias: '' },
  ];
  return withServerState({
    matrixSuiteMatrixImpl: {
      refreshRooms: async (input) => {
        calls.push({ kind: 'refreshRooms', input });
        return { ok: true, rooms: remoteRooms };
      },
    },
  }, async (state) => {
    await dispatch(state, 'refresh_rooms');
    const root = labels(state);
    assert.deepEqual(calls.map((call) => call.kind), ['refreshRooms'], 'refresh_rooms must call host adapter');
    assert.equal(root.active_room_id.v, '!roomA:synapse.dongyudigital.com', 'refresh must select the first real room by default');
    assert.equal(root.target_room_id.v, '!roomA:synapse.dongyudigital.com', 'refresh must expose a target room id for manual tests');
    assert.match(root.rooms_text.v, /Dongyu Local Test/u, 'rooms_text must show real Matrix room names');
    assert.match(root.room_inspector_markdown.v, /!roomA:synapse\.dongyudigital\.com/u, 'inspector must show selected real room id');

    state.runtime.addLabel(state.runtime.getModel(MODEL_ID), 0, 0, 0, { k: 'target_room_id', t: 'str', v: '!roomB:synapse.dongyudigital.com' });
    await dispatch(state, 'select_target_room');
    assert.equal(labels(state).active_room_id.v, '!roomB:synapse.dongyudigital.com', 'select_target_room must select a real room from refreshed rooms');
    return { key: 'refresh_rooms_materializes_real_matrix_rooms', status: 'PASS' };
  });
}

async function test_send_after_refresh_uses_selected_real_room() {
  const calls = [];
  return withServerState({
    matrixSuiteMatrixImpl: {
      refreshRooms: async () => ({
        ok: true,
        rooms: [{ room_id: '!sendRoom:synapse.dongyudigital.com', name: 'Dongyu Local Test', canonical_alias: '' }],
      }),
      sendMessage: async (input) => {
        calls.push({ kind: 'sendMessage', input });
        return { ok: true, eventId: '$real_0397_send', ts: '12:39' };
      },
    },
  }, async (state) => {
    await dispatch(state, 'refresh_rooms');
    await dispatch(state, 'send_message', [mt('draft_text', 'str', '0397 browser matrix live test')]);
    assert.equal(calls.length, 1, 'send_message must call host adapter once');
    assert.equal(calls[0].input.roomId, '!sendRoom:synapse.dongyudigital.com', 'send_message must target the refreshed Matrix room');
    assert.equal(calls[0].input.body, '0397 browser matrix live test');
    assert.match(labels(state).timeline_markdown.v, /\$real_0397_send/u, 'timeline must include real Matrix event id');
    return { key: 'send_after_refresh_uses_selected_real_room', status: 'PASS' };
  });
}

function test_live_test_controls_are_cellwise_and_bus_routed() {
  const rt = loadRuntime();
  const ast = buildAstFromCellwiseModel(rt.snapshot(), MODEL_ID);
  assert.ok(ast, 'Matrix Suite must build a cellwise UI AST');
  const refresh = findNode(ast, 'matrix_suite_refresh_rooms');
  const target = findNode(ast, 'matrix_suite_target_room_input');
  const useTarget = findNode(ast, 'matrix_suite_use_target_room');
  assert.equal(refresh?.type, 'Button', 'refresh control must be a cellwise Button');
  assert.equal(target?.type, 'Input', 'target room control must be a cellwise Input');
  assert.equal(useTarget?.type, 'Button', 'use target control must be a cellwise Button');
  for (const [id, node] of [['matrix_suite_refresh_rooms', refresh], ['matrix_suite_use_target_room', useTarget]]) {
    assert.equal(node?.bind?.write?.bus_event_v2, true, `${id} must use bus_event_v2`);
    assert.equal(node?.bind?.write?.bus_in_key, BUS_KEY, `${id} must target Matrix Suite Model 0 ingress`);
  }
  assert.equal(target?.bind?.write?.commit_policy, 'on_blur', 'target room input must avoid per-keystroke persistence');
  return { key: 'live_test_controls_are_cellwise_and_bus_routed', status: 'PASS' };
}

function test_frontend_still_has_no_direct_matrix_send() {
  const files = [
    'packages/ui-model-demo-frontend/src/main.js',
    'packages/ui-model-demo-frontend/src/demo_app.js',
    'packages/ui-model-demo-frontend/src/remote_store.js',
    'packages/ui-renderer/src/renderer.mjs',
  ];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    assert.equal(text.includes('matrix-js-sdk'), false, `${file} must not import matrix-js-sdk`);
    assert.equal(/sendEvent\s*\(/u.test(text), false, `${file} must not directly send Matrix events`);
    assert.equal(/_matrix\/client/u.test(text), false, `${file} must not call Matrix Client API directly`);
  }
  return { key: 'frontend_still_has_no_direct_matrix_send', status: 'PASS' };
}

const tests = [
  test_refresh_rooms_materializes_real_matrix_rooms,
  test_send_after_refresh_uses_selected_real_room,
  test_live_test_controls_are_cellwise_and_bus_routed,
  test_frontend_still_has_no_direct_matrix_send,
];

(async () => {
  let passed = 0;
  let failed = 0;
  for (const test of tests) {
    try {
      const result = await test();
      console.log(`[${result.status}] ${result.key}`);
      passed += 1;
    } catch (error) {
      console.log(`[FAIL] ${test.name}: ${error.stack || error.message}`);
      failed += 1;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
  process.exit(failed > 0 ? 1 : 0);
})();
