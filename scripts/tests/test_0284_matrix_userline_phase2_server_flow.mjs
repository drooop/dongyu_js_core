#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const MATRIX_SESSION_MODEL_ID = 1017;
const MATRIX_ACTIVE_CONVERSATION_MODEL_ID = 1019;
const MATRIX_ACTIVE_ROOM_MEMBERS_MODEL_ID = 1020;
const MATRIX_CHAT_UI_STATE_MODEL_ID = 1021;

function wait(ms = 120) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

function mailboxEnvelope(action, options = {}) {
  const payload = {
    action,
    meta: { op_id: options.opId || `${action}_${Date.now()}`, model_id: options.modelId || MATRIX_ACTIVE_CONVERSATION_MODEL_ID },
  };
  if (options.value !== undefined) payload.value = options.value;
  return {
    event_id: Date.now(),
    type: action,
    payload,
    source: 'ui_renderer',
    ts: Date.now(),
  };
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0284-phase2-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0284_phase2_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null });
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
  }
}

async function test_room_select_and_send_use_phase2_models() {
  return withServerState(async (state) => {
    const runtime = state.runtime;
    const session = runtime.getModel(MATRIX_SESSION_MODEL_ID);
    const conversation = runtime.getModel(MATRIX_ACTIVE_CONVERSATION_MODEL_ID);
    const members = runtime.getModel(MATRIX_ACTIVE_ROOM_MEMBERS_MODEL_ID);
    const uiState = runtime.getModel(MATRIX_CHAT_UI_STATE_MODEL_ID);

    assert.ok(session, 'phase2_requires_session_model');
    assert.ok(conversation, 'phase2_requires_active_conversation_model');
    assert.ok(members, 'phase2_requires_active_members_model');
    assert.ok(uiState, 'phase2_requires_ui_state_model');

    runtime.addLabel(session, 0, 0, 0, { k: 'session_authenticated', t: 'bool', v: true });
    runtime.addLabel(session, 0, 0, 0, { k: 'session_user_id', t: 'str', v: '@phase2:localhost' });

    const selectResult = await state.submitEnvelope(mailboxEnvelope('select_room', {
      modelId: MATRIX_ACTIVE_CONVERSATION_MODEL_ID,
      value: { t: 'event', v: { action: 'select_room', room_id: '!phase2-group:localhost' } },
    }));
    assert.equal(selectResult.result, 'ok', 'select_room_must_be_accepted');
    await wait();

    const afterSelect = state.clientSnap();
    const conversationLabels = afterSelect.models[String(MATRIX_ACTIVE_CONVERSATION_MODEL_ID)]?.cells?.['0,0,0']?.labels || {};
    const memberLabels = afterSelect.models[String(MATRIX_ACTIVE_ROOM_MEMBERS_MODEL_ID)]?.cells?.['0,0,0']?.labels || {};
    assert.equal(conversationLabels.active_room_id?.v, '!phase2-group:localhost', 'room_select_must_update_active_room_id');
    assert.match(String(conversationLabels.timeline_text?.v || ''), /Group|phase2-group|team/i, 'room_select_must_refresh_timeline_text');
    assert.match(String(memberLabels.active_members_summary?.v || ''), /@/i, 'room_select_must_refresh_member_summary');

    runtime.addLabel(uiState, 0, 0, 0, { k: 'composer_draft', t: 'str', v: 'phase2 hello group' });

    const published = [];
    state.programEngine.matrixAdapter = {
      publish: async (payload) => {
        published.push(payload);
      },
      subscribe: () => () => {},
    };
    state.programEngine.matrixRoomId = '!mbr:localhost';
    state.programEngine.matrixDmPeerUserId = '@mbr:localhost';

    const sendResult = await state.submitEnvelope(mailboxEnvelope('submit', {
      modelId: MATRIX_ACTIVE_CONVERSATION_MODEL_ID,
      value: { t: 'event', v: { action: 'submit' } },
    }));
    assert.equal(sendResult.result, 'ok', 'phase2_send_must_be_accepted');
    await wait();

    assert.equal(published.length, 1, 'phase2_send_must_publish_one_payload');
    assert.equal(published[0]?.pin, 'submit', 'phase2_send_must_use_submit_pin');
    assert.ok(Array.isArray(published[0]?.payload), 'phase2_send_must_use_temporary_modeltable_payload');
    assert.ok(
      published[0]?.payload?.some?.((record) => record && record.k === 'room_id' && record.v === '!phase2-group:localhost'),
      'phase2_send_must_use_selected_room_id',
    );
    assert.ok(
      published[0]?.payload?.some?.((record) => record && record.k === 'message_text' && record.v === 'phase2 hello group'),
      'phase2_send_must_read_composer_draft_from_ui_state',
    );

    return { key: 'room_select_and_send_use_phase2_models', status: 'PASS' };
  });
}

const tests = [
  test_room_select_and_send_use_phase2_models,
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
      console.log(`[FAIL] ${test.name}: ${error.message}`);
      failed += 1;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
  process.exit(failed > 0 ? 1 : 0);
})();
