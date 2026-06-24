#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import {
  createServerState,
  parsePinPayloadRecordEnvelope,
} from '../../packages/ui-model-demo-server/server.mjs';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

function mt(k, t, v) {
  return { id: 0, p: 0, r: 0, c: 0, k, t, v };
}

function labelValue(model, p, r, c, k) {
  return model.getCell(p, r, c).labels.get(k)?.v;
}

function records(options = {}) {
  const {
    opId = 'req_0425_payload_reply',
    messageRole = 'request',
    endpointWorkerId = 'R1',
    endpointTableId = undefined,
    endpointModelId = 3000,
    endpointPin = 'submit1',
    originWorkerId = 'U1',
    originTableId = undefined,
    originModelId = 1087,
    originPin = 'submit1',
    replyTargetWorkerId = 'U1',
    replyTargetTableId = undefined,
    replyTargetModelId = 1087,
    replyTargetPin = 'result',
    topic = 'UIPUT/ws/dam/pic/de/R1/3000/submit1',
    responseTopic = 'UIPUT/ws/dam/pic/de/U1/1087/result',
    payload = [mt('display_text', 'str', 'updated from remote')],
    extra = [],
  } = options;
  const result = [
    mt('__mt_payload_kind', 'str', 'pin_payload.v1'),
    mt('__mt_request_id', 'str', opId),
    mt('op_id', 'str', opId),
    mt('message_role', 'str', messageRole),
    mt('topic', 'str', topic),
    mt('response_topic', 'str', responseTopic),
    mt('route_kind', 'str', 'control'),
    mt('bus', 'str', 'control'),
    mt('endpoint_worker_id', 'str', endpointWorkerId),
    ...(endpointTableId !== undefined ? [mt('endpoint_table_id', 'str', endpointTableId)] : []),
    mt('endpoint_model_id', 'int', endpointModelId),
    mt('endpoint_pin', 'str', endpointPin),
    mt('origin_worker_id', 'str', originWorkerId),
    ...(originTableId !== undefined ? [mt('origin_table_id', 'str', originTableId)] : []),
    mt('origin_model_id', 'int', originModelId),
    mt('origin_pin', 'str', originPin),
    mt('reply_target_worker_id', 'str', replyTargetWorkerId),
    ...(replyTargetTableId !== undefined ? [mt('reply_target_table_id', 'str', replyTargetTableId)] : []),
    mt('reply_target_model_id', 'int', replyTargetModelId),
    mt('reply_target_pin', 'str', replyTargetPin),
    mt('payload', 'json', payload),
    mt('timestamp', 'int', 42025),
    ...extra,
  ];
  return result;
}

function packet(payloadRecords) {
  return { version: 'v1', type: 'pin_payload', payload: payloadRecords };
}

function test_runtime_builds_explicit_table_metadata() {
  const rt = new ModelTableRuntime();
  const value = rt._buildPinPayloadValue({
    opId: 'req_0425_runtime_build',
    payload: [mt('body', 'str', 'hello')],
    endpoint: { worker_id: 'R1', table_id: 'host', model_id: 3000, pin: 'submit1' },
    origin: { worker_id: 'U1', table_id: 'app:todo:a', model_id: 0, pin: 'submit1' },
    replyTarget: { worker_id: 'U1', table_id: 'app:todo:a', model_id: 0, pin: 'result' },
    messageRole: 'request',
    topic: 'UIPUT/ws/dam/pic/de/R1/3000/submit1',
    responseTopic: 'UIPUT/ws/dam/pic/de/U1/1087/result',
    routeKind: 'control',
    bus: 'control',
  });
  assert.equal(value.find((entry) => entry.k === 'endpoint_table_id')?.v, 'host');
  assert.equal(value.find((entry) => entry.k === 'origin_table_id')?.v, 'app:todo:a');
  assert.equal(value.find((entry) => entry.k === 'reply_target_table_id')?.v, 'app:todo:a');
}

function test_server_normalizes_legacy_host_payload_to_host_table() {
  const parsed = parsePinPayloadRecordEnvelope(packet(records()));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.endpoint.table_id, 'host');
  assert.equal(parsed.origin.table_id, 'host');
  assert.equal(parsed.replyTarget.table_id, 'host');
}

function test_server_rejects_app_origin_without_reply_target_table() {
  const parsed = parsePinPayloadRecordEnvelope(packet(records({
    originTableId: 'app:todo:a',
    originModelId: 0,
    replyTargetModelId: 1087,
  })));
  assert.equal(parsed.ok, false);
  assert.equal(parsed.code, 'missing_reply_target_table_id');
}

function test_server_rejects_non_host_transport_endpoint_table() {
  const parsed = parsePinPayloadRecordEnvelope(packet(records({
    endpointTableId: 'app:spoof',
  })));
  assert.equal(parsed.ok, false);
  assert.equal(parsed.code, 'invalid_pin_payload_records');
}

function test_runtime_rejects_non_host_transport_endpoint_table() {
  const rt = new ModelTableRuntime();
  const parsed = rt._validatePinPayloadRecords(records({
    endpointTableId: 'app:spoof',
  }));
  assert.equal(parsed.ok, false);
  assert.equal(parsed.code, 'invalid_pin_payload_records');
}

function test_server_accepts_app_origin_with_reply_target_table() {
  const parsed = parsePinPayloadRecordEnvelope(packet(records({
    originTableId: 'app:todo:a',
    originModelId: 0,
    replyTargetTableId: 'app:todo:a',
    replyTargetModelId: 0,
  })));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.origin.table_id, 'app:todo:a');
  assert.equal(parsed.origin.model_id, 0);
  assert.equal(parsed.replyTarget.table_id, 'app:todo:a');
  assert.equal(parsed.replyTarget.model_id, 0);
}

function test_server_accepts_app_response_with_host_transport_endpoint() {
  const parsed = parsePinPayloadRecordEnvelope(packet(records({
    messageRole: 'response',
    topic: 'UIPUT/ws/dam/pic/de/U1/1087/result',
    responseTopic: 'UIPUT/ws/dam/pic/de/U1/1087/result',
    endpointWorkerId: 'U1',
    endpointTableId: 'host',
    endpointModelId: 1087,
    endpointPin: 'result',
    originTableId: 'app:todo:a',
    originModelId: 0,
    replyTargetTableId: 'app:todo:a',
    replyTargetModelId: 0,
  })));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.endpoint.table_id, 'host');
  assert.equal(parsed.replyTarget.table_id, 'app:todo:a');
  assert.equal(parsed.replyTarget.model_id, 0);
}

function test_server_rejects_client_authored_authority_metadata() {
  const parsed = parsePinPayloadRecordEnvelope(packet(records({
    extra: [mt('principal_id', 'str', 'attacker')],
  })));
  assert.equal(parsed.ok, false);
  assert.equal(parsed.code, 'client_authority_metadata_rejected');
}

async function test_app_reply_materializes_into_table_qualified_target() {
  const state = createServerState({ dbPath: null });
  const appModel = state.runtime.createModel({ table_id: 'app:todo:a', id: 0, name: 'todo-root', type: 'app' });
  const requestEnvelope = {
    op_id: 'req_0425_app_materialize',
    records: [{
      op: 'add_label',
      table_id: 'app:todo:a',
      model_id: 0,
      p: 0,
      r: 0,
      c: 0,
      k: 'display_text',
      t: 'str',
      v: 'updated from remote',
    }],
  };
  const result = await state.programEngine.routePinPayloadViaOwnerMaterialization(requestEnvelope);
  assert.equal(result.ok, true);
  assert.equal(labelValue(appModel, 0, 0, 0, 'display_text'), 'updated from remote');
}

const tests = [
  test_runtime_builds_explicit_table_metadata,
  test_server_normalizes_legacy_host_payload_to_host_table,
  test_server_rejects_app_origin_without_reply_target_table,
  test_server_rejects_non_host_transport_endpoint_table,
  test_runtime_rejects_non_host_transport_endpoint_table,
  test_server_accepts_app_origin_with_reply_target_table,
  test_server_accepts_app_response_with_host_transport_endpoint,
  test_server_rejects_client_authored_authority_metadata,
  test_app_reply_materializes_into_table_qualified_target,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    await test();
    console.log(`[PASS] ${test.name}`);
    passed += 1;
  } catch (err) {
    console.log(`[FAIL] ${test.name}: ${err && err.message ? err.message : err}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
