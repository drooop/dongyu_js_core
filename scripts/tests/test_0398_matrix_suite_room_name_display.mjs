#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const MODEL_ID = 1080;
const BUS_KEY = 'matrix_suite_1080_bus_event';

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

function visibleRoomListText(roomsText) {
  return String(roomsText || '')
    .split('\n')
    .map((line) => line.split('\x01')[0])
    .join('\n');
}

function hoverRoomListText(roomsText) {
  return String(roomsText || '')
    .split('\n')
    .map((line) => line.split('\x01')[1] || '')
    .join('\n');
}

async function withServerState(options, fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0398-matrix-suite-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0398_${Date.now()}`;
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
    meta: { op_id: `it0398_${action}_${Date.now()}` },
  });
  assert.equal(result.result, 'ok', `${action} must route successfully`);
  assert.equal(result.routed_by, 'model0_busin', `${action} must use Model 0 ingress`);
  await wait();
  return result;
}

function labels(state) {
  return state.clientSnap().models[String(MODEL_ID)].cells['0,0,0'].labels;
}

async function test_room_list_visible_text_is_name_only_and_hover_keeps_id() {
  return withServerState({
    matrixSuiteMatrixImpl: {
      refreshRooms: async () => ({
        ok: true,
        rooms: [
          { room_id: '!alpha:synapse.dongyudigital.com', name: 'Remote Matrix Check', canonical_alias: '#alpha:synapse.dongyudigital.com' },
          { room_id: '!beta:synapse.dongyudigital.com', name: 'Remote Matrix Check', canonical_alias: '#beta:synapse.dongyudigital.com' },
          { room_id: '!nameless:synapse.dongyudigital.com', name: '', canonical_alias: '' },
        ],
      }),
    },
  }, async (state) => {
    await dispatch(state, 'refresh_rooms');
    const root = labels(state);
    const visible = visibleRoomListText(root.rooms_text.v);
    const hover = hoverRoomListText(root.rooms_text.v);
    assert.match(visible, /Remote Matrix Check/u, 'room names must be visible');
    assert.doesNotMatch(visible, /kind:/u, 'visible room list must not show room metadata rows');
    assert.doesNotMatch(visible, /members:/u, 'visible room list must not show room metadata rows');
    assert.doesNotMatch(visible, /!alpha:synapse\.dongyudigital\.com/u, 'visible room list must not show Matrix room id');
    assert.doesNotMatch(visible, /!beta:synapse\.dongyudigital\.com/u, 'visible room list must not show Matrix room id');
    assert.doesNotMatch(visible, /!nameless:synapse\.dongyudigital\.com/u, 'visible room list must not use room id as fallback name');
    assert.match(visible, /Unnamed room/u, 'nameless rooms must use a safe display fallback');
    assert.match(hover, /!alpha:synapse\.dongyudigital\.com/u, 'hover detail must retain first room id');
    assert.match(hover, /!beta:synapse\.dongyudigital\.com/u, 'hover detail must retain second room id');
    assert.match(hover, /!nameless:synapse\.dongyudigital\.com/u, 'hover detail must retain nameless room id');
    assert.match(root.room_inspector_markdown.v, /!alpha:synapse\.dongyudigital\.com/u, 'room detail must still show selected room id');
    return { key: 'room_list_visible_text_is_name_only_and_hover_keeps_id', status: 'PASS' };
  });
}

function test_model_table_program_projection_uses_hover_detail_separator() {
  const patch = JSON.parse(readFileSync('packages/worker-base/system-models/workspace_positive_models.json', 'utf8'));
  const func = patch.records.find((record) => record.model_id === MODEL_ID && record.k === 'handle_matrix_suite_event');
  const code = String(func?.v?.code || '');
  assert.match(code, /\\x01/u, 'program model renderRooms must include Terminal hover detail separator');
  assert.match(code, /room id:/u, 'program model hover detail must include room id');
  return { key: 'model_table_program_projection_uses_hover_detail_separator', status: 'PASS' };
}

const tests = [
  test_room_list_visible_text_is_name_only_and_hover_keeps_id,
  test_model_table_program_projection_uses_hover_detail_separator,
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
