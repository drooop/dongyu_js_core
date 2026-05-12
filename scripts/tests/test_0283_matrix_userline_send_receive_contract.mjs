#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const MATRIX_SESSION_MODEL_ID = 1017;
const MATRIX_ACTIVE_CONVERSATION_MODEL_ID = 1019;
const WORKSPACE_POSITIVE_MODELS_PATH = resolve('packages/worker-base/system-models/workspace_positive_models.json');

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

function mt(k, t, v) {
  return { id: 0, p: 0, r: 0, c: 0, k, t, v };
}

function payloadValue(packetOrRecords, key) {
  const records = Array.isArray(packetOrRecords)
    ? packetOrRecords
    : (Array.isArray(packetOrRecords?.payload) ? packetOrRecords.payload : []);
  return records.find((record) => record && record.k === key)?.v;
}

function assertStrictPinPacket(packet, message = 'packet') {
  assert.deepEqual(Object.keys(packet || {}).sort(), ['payload', 'type', 'version'], `${message}_must_only_expose_version_type_payload`);
  assert.equal(packet.version, 'v1', `${message}_must_be_v1`);
  assert.equal(packet.type, 'pin_payload', `${message}_must_use_pin_payload_transport`);
  assert.equal(Array.isArray(packet.payload), true, `${message}_payload_must_be_modeltable_records`);
  for (const forbidden of ['source_model_id', 'pin', 'route', 'reply_to', 'return_topic', 'returnTopic', 'result_topic']) {
    assert.equal(Object.hasOwn(packet, forbidden), false, `${message}_must_not_expose_${forbidden}`);
  }
}

function pinPayloadRecords({
  opId,
  messageRole = 'request',
  endpointWorkerId,
  endpointModelId,
  endpointPin,
  originWorkerId,
  originModelId,
  originPin,
  replyTargetWorkerId,
  replyTargetModelId,
  replyTargetPin,
  payloadRecords,
  timestamp = 1700000000000,
}) {
  return [
    mt('__mt_payload_kind', 'str', 'pin_payload.v1'),
    mt('__mt_request_id', 'str', opId),
    mt('op_id', 'str', opId),
    mt('message_role', 'str', messageRole),
    mt('endpoint_worker_id', 'str', endpointWorkerId),
    mt('endpoint_model_id', 'int', endpointModelId),
    mt('endpoint_pin', 'str', endpointPin),
    mt('origin_worker_id', 'str', originWorkerId),
    mt('origin_model_id', 'int', originModelId),
    mt('origin_pin', 'str', originPin),
    mt('reply_target_worker_id', 'str', replyTargetWorkerId),
    mt('reply_target_model_id', 'int', replyTargetModelId),
    mt('reply_target_pin', 'str', replyTargetPin),
    mt('payload', 'json', payloadRecords),
    mt('timestamp', 'int', timestamp),
  ];
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0283-send-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0283_send_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  process.env.DY_UI_SERVER_WORKER_ID = 'ui-server-it0283';
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
    delete process.env.DY_UI_SERVER_WORKER_ID;
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
    assertStrictPinPacket(published[0], 'send_submit_payload');
    assert.equal(payloadValue(published[0], '__mt_payload_kind'), 'pin_payload.v1', 'send_submit_must_declare_pin_payload_v1');
    assert.equal(payloadValue(published[0], 'endpoint_worker_id'), 'R1', 'send_submit_must_target_remote_worker');
    assert.equal(payloadValue(published[0], 'endpoint_model_id'), MATRIX_ACTIVE_CONVERSATION_MODEL_ID, 'send_submit_must_target_model1019');
    assert.equal(payloadValue(published[0], 'endpoint_pin'), 'submit', 'send_submit_must_use_submit_endpoint_pin');
    assert.equal(payloadValue(published[0], 'origin_worker_id'), 'ui-server-it0283', 'send_submit_must_include_origin_worker');
    assert.equal(payloadValue(published[0], 'origin_model_id'), MATRIX_ACTIVE_CONVERSATION_MODEL_ID, 'send_submit_must_include_origin_model');
    assert.equal(payloadValue(published[0], 'origin_pin'), 'submit', 'send_submit_must_include_origin_pin');
    assert.equal(payloadValue(published[0], 'reply_target_worker_id'), 'ui-server-it0283', 'send_submit_must_include_reply_target_worker');
    assert.equal(payloadValue(published[0], 'reply_target_model_id'), MATRIX_ACTIVE_CONVERSATION_MODEL_ID, 'send_submit_must_include_reply_target_model');
    assert.equal(payloadValue(published[0], 'reply_target_pin'), 'result', 'send_submit_must_include_reply_target_pin');
    assert.ok(Array.isArray(payloadValue(published[0], 'payload')), 'send_submit_must_carry_temporary_modeltable_array');
    assert.ok(payloadValue(published[0], 'payload')?.some?.((record) => record && record.k === 'message_text' && record.v === 'hello matrix'), 'send_submit_payload_missing_message_text');
    assert.ok(payloadValue(published[0], 'payload')?.some?.((record) => record && record.k === 'sender_user_id' && record.v === '@drop:localhost'), 'send_submit_payload_missing_sender_user_id');
    assert.ok(payloadValue(published[0], 'payload')?.some?.((record) => record && record.k === 'room_id' && record.v === '!phase1:localhost'), 'send_submit_payload_missing_room_id');

    const beforeReturn = state.clientSnap().models[String(MATRIX_ACTIVE_CONVERSATION_MODEL_ID)].cells['0,0,0'].labels;
    assert.equal(beforeReturn.last_sent_text?.v, 'hello matrix', 'send_submit_must_materialize_last_sent_text');
    assert.equal(beforeReturn.submit_inflight?.v, true, 'send_submit_must_set_submit_inflight');
    assert.equal(beforeReturn.conversation_status?.v, 'loading', 'send_submit_must_set_loading_status');

    state.programEngine.handleDyBusEvent({
      version: 'v1',
      type: 'pin_payload',
      payload: pinPayloadRecords({
        opId: 'test_0283_send_return',
        messageRole: 'response',
        endpointWorkerId: 'R1',
        endpointModelId: MATRIX_ACTIVE_CONVERSATION_MODEL_ID,
        endpointPin: 'submit',
        originWorkerId: 'R1',
        originModelId: MATRIX_ACTIVE_CONVERSATION_MODEL_ID,
        originPin: 'submit',
        replyTargetWorkerId: 'ui-server-it0283',
        replyTargetModelId: MATRIX_ACTIVE_CONVERSATION_MODEL_ID,
        replyTargetPin: 'result',
        payloadRecords: [
        { id: 0, p: 0, r: 0, c: 0, k: 'last_remote_text', t: 'str', v: 'echo: hello matrix' },
        { id: 0, p: 0, r: 0, c: 0, k: 'conversation_status', t: 'str', v: 'remote_processed' },
        { id: 0, p: 0, r: 0, c: 0, k: 'submit_inflight', t: 'bool', v: false },
        ],
      }),
    });
    await wait();

    const afterReturn = state.clientSnap().models[String(MATRIX_ACTIVE_CONVERSATION_MODEL_ID)].cells['0,0,0'].labels;
    assert.equal(afterReturn.last_remote_text?.v, 'echo: hello matrix', 'send_return_must_materialize_remote_reply');
    assert.equal(afterReturn.conversation_status?.v, 'remote_processed', 'send_return_must_materialize_remote_status');
    assert.equal(afterReturn.submit_inflight?.v, false, 'send_return_must_clear_submit_inflight');
    return { key: 'send_submit_publishes_pin_payload_for_model1019', status: 'PASS' };
  });
}

async function test_model1019_dispatch_uses_explicit_write_label_route() {
  const patch = JSON.parse(readFileSync(WORKSPACE_POSITIVE_MODELS_PATH, 'utf8'));
  const records = Array.isArray(patch.records) ? patch.records : [];
  const route = records.find((record) => (
    record && record.op === 'add_label' &&
    record.model_id === MATRIX_ACTIVE_CONVERSATION_MODEL_ID &&
    record.p === 0 && record.r === 0 && record.c === 0 &&
    record.k === 'matrix_phase1_processor_write_routes'
  ));
  assert.ok(route, 'model1019_must_declare_processor_write_route');
  assert.equal(route.t, 'pin.connect.cell', 'model1019_processor_write_route_must_use_pin_connect_cell');
  assert.ok(route.v.some((entry) => (
    Array.isArray(entry.from) &&
    entry.from[0] === 1 && entry.from[1] === 0 && entry.from[2] === 0 && entry.from[3] === 'write_label_req' &&
    entry.to.some((target) => Array.isArray(target) && target[0] === 0 && target[1] === 0 && target[2] === 0 && target[3] === 'mt_write_req')
  )), 'model1019_processor_write_route_must_target_root_mt_write_req');

  const dispatch = records.find((record) => (
    record && record.op === 'add_label' &&
    record.model_id === MATRIX_ACTIVE_CONVERSATION_MODEL_ID &&
    record.p === 1 && record.r === 0 && record.c === 0 &&
    record.k === 'dispatch_matrix_phase1_send'
  ));
  assert.ok(dispatch, 'model1019_dispatch_function_missing');
  const code = String(dispatch.v?.code || '');
  assert.match(code, /V1N\.writeLabel\(0,\s*0,\s*0/u, 'model1019_dispatch_must_write_root_via_v1n_write_label');
  assert.doesNotMatch(code, /V1N\.table/u, 'model1019_dispatch_must_not_use_root_table_privilege');
  assert.doesNotMatch(code, /ctx\.hostApi/u, 'model1019_dispatch_must_not_use_host_api');
  return { key: 'model1019_dispatch_uses_explicit_write_label_route', status: 'PASS' };
}

const tests = [
  test_model1019_dispatch_uses_explicit_write_label_route,
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
