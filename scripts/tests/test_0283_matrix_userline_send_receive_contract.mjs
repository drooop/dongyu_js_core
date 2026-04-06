#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const MATRIX_SESSION_MODEL_ID = 1017;
const MATRIX_ACTIVE_CONVERSATION_MODEL_ID = 1019;

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
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0283-send-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0283_send_${Date.now()}`;
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

async function test_send_submit_publishes_pin_payload_for_model1019() {
  return withServerState(async (state) => {
    const session = state.runtime.getModel(MATRIX_SESSION_MODEL_ID);
    const conversation = state.runtime.getModel(MATRIX_ACTIVE_CONVERSATION_MODEL_ID);
    state.runtime.addLabel(session, 0, 0, 0, { k: 'session_authenticated', t: 'bool', v: true });
    state.runtime.addLabel(session, 0, 0, 0, { k: 'session_user_id', t: 'str', v: '@drop:localhost' });
    state.runtime.addLabel(conversation, 0, 0, 0, { k: 'active_room_id', t: 'str', v: '!phase1:localhost' });
    state.runtime.addLabel(conversation, 0, 0, 0, { k: 'message_draft', t: 'str', v: 'hello matrix' });

    const published = [];
    state.programEngine.matrixAdapter = {
      publish: async (payload) => {
        published.push(payload);
      },
      subscribe: () => () => {},
    };
    state.programEngine.matrixRoomId = '!mbr:localhost';
    state.programEngine.matrixDmPeerUserId = '@mbr:localhost';

    const result = await state.submitEnvelope(mailboxEnvelope('submit', {
      opId: 'test_0283_send_submit',
      modelId: MATRIX_ACTIVE_CONVERSATION_MODEL_ID,
      value: { t: 'event', v: { action: 'submit' } },
    }));
    assert.equal(result.result, 'ok', 'send_submit_must_be_accepted');
    await wait();

    assert.equal(published.length, 1, 'send_submit_must_publish_one_matrix_payload');
    assert.equal(published[0]?.type, 'pin_payload', 'send_submit_must_use_pin_payload_transport');
    assert.equal(published[0]?.source_model_id, MATRIX_ACTIVE_CONVERSATION_MODEL_ID, 'send_submit_must_preserve_source_model_id');
    assert.equal(published[0]?.pin, 'submit', 'send_submit_must_use_submit_pin');
    assert.ok(Array.isArray(published[0]?.payload), 'send_submit_must_carry_temporary_modeltable_array');
    assert.ok(published[0]?.payload?.some?.((record) => record && record.k === 'message_text' && record.v === 'hello matrix'), 'send_submit_payload_missing_message_text');
    assert.ok(published[0]?.payload?.some?.((record) => record && record.k === 'sender_user_id' && record.v === '@drop:localhost'), 'send_submit_payload_missing_sender_user_id');
    assert.ok(published[0]?.payload?.some?.((record) => record && record.k === 'room_id' && record.v === '!phase1:localhost'), 'send_submit_payload_missing_room_id');

    const beforeReturn = state.clientSnap().models[String(MATRIX_ACTIVE_CONVERSATION_MODEL_ID)].cells['0,0,0'].labels;
    assert.equal(beforeReturn.last_sent_text?.v, 'hello matrix', 'send_submit_must_materialize_last_sent_text');
    assert.equal(beforeReturn.submit_inflight?.v, true, 'send_submit_must_set_submit_inflight');
    assert.equal(beforeReturn.conversation_status?.v, 'loading', 'send_submit_must_set_loading_status');

    state.programEngine.handleDyBusEvent({
      version: 'v1',
      type: 'pin_payload',
      op_id: 'test_0283_send_return',
      source_model_id: MATRIX_ACTIVE_CONVERSATION_MODEL_ID,
      pin: 'result',
      payload: [
        { id: 0, p: 0, r: 0, c: 0, k: 'last_remote_text', t: 'str', v: 'echo: hello matrix' },
        { id: 0, p: 0, r: 0, c: 0, k: 'conversation_status', t: 'str', v: 'remote_processed' },
        { id: 0, p: 0, r: 0, c: 0, k: 'submit_inflight', t: 'bool', v: false },
      ],
    });
    await wait();

    const afterReturn = state.clientSnap().models[String(MATRIX_ACTIVE_CONVERSATION_MODEL_ID)].cells['0,0,0'].labels;
    assert.equal(afterReturn.last_remote_text?.v, 'echo: hello matrix', 'send_return_must_materialize_remote_reply');
    assert.equal(afterReturn.conversation_status?.v, 'remote_processed', 'send_return_must_materialize_remote_status');
    assert.equal(afterReturn.submit_inflight?.v, false, 'send_return_must_clear_submit_inflight');
    return { key: 'send_submit_publishes_pin_payload_for_model1019', status: 'PASS' };
  });
}

const tests = [
  test_send_submit_publishes_pin_payload_for_model1019,
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
