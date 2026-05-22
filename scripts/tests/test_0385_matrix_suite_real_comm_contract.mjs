#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const MODEL_ID = 1080;
const BUS_KEY = 'matrix_suite_1080_bus_event';

function wait(ms = 160) {
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
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0385-matrix-suite-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0385_${Date.now()}`;
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
    meta: { op_id: `it0385_${action}_${Date.now()}` },
  });
  assert.equal(result.result, 'ok', `${action} must route through Model 0`);
  assert.equal(result.routed_by, 'model0_busin', `${action} must use model0 bus ingress`);
  await wait();
  return result;
}

function labels(state) {
  return state.clientSnap().models[String(MODEL_ID)].cells['0,0,0'].labels;
}

async function test_login_and_send_call_real_matrix_host_adapter() {
  const calls = [];
  return withServerState({
    matrixSuiteMatrixImpl: {
      login: async (input) => {
        calls.push({ kind: 'login', input });
        return { ok: true, userId: '@alice:example.test', displayName: 'Alice', homeserverUrl: 'https://matrix.example.test' };
      },
      sendMessage: async (input) => {
        calls.push({ kind: 'sendMessage', input });
        return { ok: true, eventId: '$real_send_0385', ts: '12:34' };
      },
    },
  }, async (state) => {
    await dispatch(state, 'save_settings', [
      mt('settings_mode', 'str', 'login'),
      mt('homeserver', 'str', 'https://matrix.example.test'),
      mt('user_id', 'str', '@alice:example.test'),
      mt('password', 'str', 'secret-0385'),
    ]);
    await dispatch(state, 'send_message', [
      mt('draft_text', 'str', 'real matrix suite hello'),
    ]);

    assert.deepEqual(calls.map((call) => call.kind), ['login', 'sendMessage'], 'login and send must call host adapter');
    assert.equal(calls[0].input.password, 'secret-0385', 'login host adapter must receive password only transiently');
    assert.equal(calls[1].input.body, 'real matrix suite hello', 'send host adapter must receive message body');
    assert.equal(calls[1].input.roomId, labels(state).active_room_id.v, 'send host adapter must target active room');
    assert.equal(labels(state).session_status.v, 'authenticated', 'login success must materialize authenticated status');
    assert.equal(labels(state).session_user_id.v, '@alice:example.test', 'login success must materialize user id');
    assert.equal(labels(state).login_password_draft.v, '', 'password draft must be cleared after login');
    assert.match(labels(state).timeline_markdown.v, /\$real_send_0385/u, 'timeline must include real Matrix event id');
    assert.equal(labels(state).status_text.v, 'Sent via Matrix: $real_send_0385', 'send status must report real Matrix send');
    return { key: 'login_and_send_call_real_matrix_host_adapter', status: 'PASS' };
  });
}

async function test_edit_create_and_share_file_call_real_matrix_host_adapter() {
  const calls = [];
  return withServerState({
    matrixSuiteMatrixImpl: {
      editMessage: async (input) => {
        calls.push({ kind: 'editMessage', input });
        return { ok: true, eventId: '$real_edit_0385', ts: '12:35' };
      },
      createRoom: async (input) => {
        calls.push({ kind: 'createRoom', input });
        return { ok: true, roomId: '!real-room-0385:example.test', name: input.name, kind: input.kind || 'room' };
      },
      shareFile: async (input) => {
        calls.push({ kind: 'shareFile', input });
        return { ok: true, eventId: '$real_file_0385', ts: '12:36' };
      },
    },
  }, async (state) => {
    const model = state.runtime.getModel(MODEL_ID);
    state.runtime.addLabel(model, 0, 0, 0, { k: 'last_editable_event_id', t: 'str', v: '$evt_alice_1' });
    state.runtime.addLabel(model, 0, 0, 0, { k: 'edit_draft', t: 'str', v: 'real edited body' });
    state.runtime.addLabel(model, 0, 0, 0, { k: 'pending_file_uri', t: 'str', v: 'mxc://example.test/file-0385' });
    state.runtime.addLabel(model, 0, 0, 0, { k: 'pending_file_name', t: 'str', v: 'real-file.txt' });

    await dispatch(state, 'edit_message');
    await dispatch(state, 'create_channel', [
      mt('channel_kind', 'str', 'room'),
      mt('channel_name', 'str', 'Real Matrix Room 0385'),
    ]);
    await dispatch(state, 'share_file');

    assert.deepEqual(calls.map((call) => call.kind), ['editMessage', 'createRoom', 'shareFile'], 'edit/create/share must call host adapter');
    assert.equal(calls[0].input.eventId, '$evt_alice_1', 'edit host adapter must receive target event');
    assert.equal(calls[1].input.name, 'Real Matrix Room 0385', 'create host adapter must receive channel name');
    assert.equal(calls[2].input.mediaUri, 'mxc://example.test/file-0385', 'share host adapter must receive uploaded mxc uri');
    assert.equal(
      labels(state).timeline_json.v.some((event) => event && (event.edit_event_id === '$real_edit_0385' || event.event_id === '$real_edit_0385')),
      true,
      'timeline truth must include real edit event id',
    );
    assert.match(labels(state).timeline_markdown.v, /\$real_file_0385/u, 'active timeline must include real file event id');
    assert.match(labels(state).rooms_text.v, /Real Matrix Room 0385/u, 'created Matrix room must be projected');
    return { key: 'edit_create_and_share_file_call_real_matrix_host_adapter', status: 'PASS' };
  });
}

async function test_media_buttons_do_not_fake_success_before_media_capability_exists() {
  return withServerState({}, async (state) => {
    await dispatch(state, 'start_screen');
    await dispatch(state, 'start_video');
    await dispatch(state, 'start_voice');

    const root = labels(state);
    assert.equal(root.call_state.v, 'requires_media_capability', 'media buttons must report missing media capability');
    assert.equal(root.connection_status.v, 'warning', 'media buttons must not claim online success');
    assert.doesNotMatch(root.timeline_markdown.v, /Screen sharing started|Video conference started|Voice message recorded/u, 'media buttons must not append fake success events');
    assert.match(root.status_text.v, /requires_media_capability/u, 'status text must explain media capability is missing');
    return { key: 'media_buttons_do_not_fake_success_before_media_capability_exists', status: 'PASS' };
  });
}

function test_frontend_still_has_no_direct_matrix_send() {
  const files = [
    'packages/ui-model-demo-frontend/src/main.js',
    'packages/ui-model-demo-frontend/src/demo_app.js',
    'packages/ui-model-demo-frontend/src/remote_store.js',
    'packages/ui-renderer/src/renderer.mjs',
  ];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    assert.equal(text.includes('matrix-js-sdk'), false, `${file} must not import matrix-js-sdk`);
    assert.equal(/sendEvent\s*\(/u.test(text), false, `${file} must not directly send Matrix events`);
    assert.equal(/getDisplayMedia\s*\(/u.test(text), false, `${file} must not start screen capture outside host capability contract`);
  }
  return { key: 'frontend_still_has_no_direct_matrix_send', status: 'PASS' };
}

const tests = [
  test_login_and_send_call_real_matrix_host_adapter,
  test_edit_create_and_share_file_call_real_matrix_host_adapter,
  test_media_buttons_do_not_fake_success_before_media_capability_exists,
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
