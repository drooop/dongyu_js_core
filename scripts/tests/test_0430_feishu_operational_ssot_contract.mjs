#!/usr/bin/env node
// 0430 — Feishu operational SSOT executable contract.
// RED stage: these assertions define the target before runtime/server refit.

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

function mt(k, t, v, id = 0) {
  return { id, p: 0, r: 0, c: 0, k, t, v };
}

function createRuntime() {
  const rt = new ModelTableRuntime();
  rt.eventLog.reset();
  rt.intercepts.reset();
  return rt;
}

function lastEventFor(rt, key) {
  return rt.eventLog.list().reverse().find((event) => event?.label?.k === key) || null;
}

function assertRejectedWithReason(rt, result, key, reason) {
  assert.equal(result.applied, false, `${key} must be rejected`);
  const event = lastEventFor(rt, key);
  assert.ok(event, `${key} must write an audit event`);
  assert.equal(event.result, 'rejected', `${key} audit result`);
  assert.equal(event.reason, reason, `${key} rejection reason`);
}

function validPinPayloadV2(overrides = {}) {
  const {
    opId = 'req_0430_v2',
    topic = 'UIPUT/ws/dam/pic/de/R1/3000/submit1',
    responseTopic = 'UIPUT/ws/dam/pic/de/U1/1055/result',
    endpointWorkerId = 'R1',
    endpointTableId = 'host',
    endpointModelId = 3000,
    endpointPin = 'submit1',
    originWorkerId = 'U1',
    originTableId = 'app:subject:drop:todo:001',
    originModelId = 0,
    originPin = 'submit1',
    replyTargetWorkerId = 'U1',
    replyTargetTableId = 'app:subject:drop:todo:001',
    replyTargetModelId = 0,
    replyTargetPin = 'result',
    payloadModelId = 1,
    bus = 'control',
    routeKind = 'control',
    businessRecords = [mt('title', 'str', 'hello 0430', 1)],
    includeOriginTableId = true,
    includeReplyTargetTableId = true,
    includeNestedPayload = false,
    kind = 'pin_payload.v2',
  } = overrides;
  const records = [
    mt('__mt_payload_kind', 'str', kind),
    mt('__mt_request_id', 'str', opId),
    mt('op_id', 'str', opId),
    mt('message_role', 'str', 'request'),
    mt('bus', 'str', bus),
    mt('route_kind', 'str', routeKind),
    mt('topic', 'str', topic),
    mt('response_topic', 'str', responseTopic),
    mt('endpoint_worker_id', 'str', endpointWorkerId),
    mt('endpoint_table_id', 'str', endpointTableId),
    mt('endpoint_model_id', 'int', endpointModelId),
    mt('endpoint_pin', 'str', endpointPin),
    mt('origin_worker_id', 'str', originWorkerId),
    ...(includeOriginTableId ? [mt('origin_table_id', 'str', originTableId)] : []),
    mt('origin_model_id', 'int', originModelId),
    mt('origin_pin', 'str', originPin),
    mt('reply_target_worker_id', 'str', replyTargetWorkerId),
    ...(includeReplyTargetTableId ? [mt('reply_target_table_id', 'str', replyTargetTableId)] : []),
    mt('reply_target_model_id', 'int', replyTargetModelId),
    mt('reply_target_pin', 'str', replyTargetPin),
    mt('payload_model_id', 'int', payloadModelId),
    ...businessRecords,
  ];
  if (includeNestedPayload) {
    records.push(mt('payload', 'json', [mt('nested_title', 'str', 'legacy nested payload')]));
  }
  return records;
}

function test_removed_feishu_label_types_are_rejected() {
  const rt = createRuntime();
  const root = rt.getModel(0);
  const cases = [
    ['removed_model_v1n', 'model.v1n'],
    ['removed_model_subtableconnection', 'model.subtableconnection'],
    ['removed_model_submtconnection', 'model.submtconnection'],
    ['removed_pin_connect_model', 'pin.connect.model'],
  ];

  for (const [key, type] of cases) {
    const result = rt.addLabel(root, 0, 0, 0, { k: key, t: type, v: 'rejected' });
    assertRejectedWithReason(rt, result, key, 'label_type_removed');
    assert.equal(root.getCell(0, 0, 0).labels.has(key), false, `${type} must not be stored`);
  }

  return { key: 'removed_feishu_label_types_are_rejected', status: 'PASS' };
}

function test_pin_payload_v2_record_array_is_valid_bus_value() {
  const rt = createRuntime();
  const root = rt.getModel(0);
  const roleResult = rt.addLabel(root, 0, 0, 0, { k: 'sys_worker_role', t: 'worker.role', v: 'DEM' });
  assert.equal(roleResult.applied, true, 'management bus accepted-shape test must declare DEM role first');
  const cbValue = validPinPayloadV2({ opId: 'req_0430_v2_cb' });
  const mbValue = validPinPayloadV2({
    opId: 'req_0430_v2_mb',
    bus: 'management',
    routeKind: 'management',
    businessRecords: [mt('title', 'str', 'hello 0430 management', 1)],
  });
  const cbResult = rt.addLabel(root, 0, 0, 0, { k: 'submit_cb_bus_out', t: 'pin.bus.cb.out', v: cbValue });
  const mbResult = rt.addLabel(root, 0, 0, 0, { k: 'submit_mb_bus_out', t: 'pin.bus.mb.out', v: mbValue });

  assert.equal(cbResult.applied, true, 'pin_payload.v2 record array must be accepted as Model 0 control bus out value');
  assert.equal(mbResult.applied, true, 'pin_payload.v2 record array must be accepted as Model 0 management bus out value');
  assert.deepEqual(root.getCell(0, 0, 0).labels.get('submit_cb_bus_out')?.v, cbValue);
  assert.deepEqual(root.getCell(0, 0, 0).labels.get('submit_mb_bus_out')?.v, mbValue);

  return { key: 'pin_payload_v2_record_array_is_valid_bus_value', status: 'PASS' };
}

function test_pin_payload_v2_rejects_nested_formal_payload() {
  const rt = createRuntime();
  const root = rt.getModel(0);
  const result = rt.addLabel(root, 0, 0, 0, {
    k: 'nested_submit_bus_out',
    t: 'pin.bus.cb.out',
    v: validPinPayloadV2({ includeNestedPayload: true }),
  });

  assertRejectedWithReason(rt, result, 'nested_submit_bus_out', 'bus_out_nested_payload_removed');
  assert.equal(root.getCell(0, 0, 0).labels.has('nested_submit_bus_out'), false);

  return { key: 'pin_payload_v2_rejects_nested_formal_payload', status: 'PASS' };
}

function test_pin_payload_v2_requires_origin_table_qualified_ref() {
  const rt = createRuntime();
  const root = rt.getModel(0);

  const missingOrigin = rt.addLabel(root, 0, 0, 0, {
    k: 'missing_origin_table_bus_out',
    t: 'pin.bus.cb.out',
    v: validPinPayloadV2({ includeOriginTableId: false }),
  });
  assertRejectedWithReason(rt, missingOrigin, 'missing_origin_table_bus_out', 'bus_out_missing_origin_table_id');

  return { key: 'pin_payload_v2_requires_origin_table_qualified_ref', status: 'PASS' };
}

function test_pin_payload_v2_requires_reply_target_table_qualified_ref() {
  const rt = createRuntime();
  const root = rt.getModel(0);

  const missingReply = rt.addLabel(root, 0, 0, 0, {
    k: 'missing_reply_target_table_bus_out',
    t: 'pin.bus.cb.out',
    v: validPinPayloadV2({ includeReplyTargetTableId: false }),
  });
  assertRejectedWithReason(rt, missingReply, 'missing_reply_target_table_bus_out', 'bus_out_missing_reply_target_table_id');

  return { key: 'pin_payload_v2_requires_reply_target_table_qualified_ref', status: 'PASS' };
}

function test_pin_payload_v1_formal_transport_is_removed() {
  const rt = createRuntime();
  const root = rt.getModel(0);
  const result = rt.addLabel(root, 0, 0, 0, {
    k: 'legacy_v1_bus_out',
    t: 'pin.bus.cb.out',
    v: validPinPayloadV2({
      kind: 'pin_payload.v1',
    }),
  });

  assertRejectedWithReason(rt, result, 'legacy_v1_bus_out', 'bus_out_legacy_pin_payload_kind_removed');
  assert.equal(root.getCell(0, 0, 0).labels.has('legacy_v1_bus_out'), false);

  return { key: 'pin_payload_v1_formal_transport_is_removed', status: 'PASS' };
}

const tests = [
  test_removed_feishu_label_types_are_rejected,
  test_pin_payload_v2_record_array_is_valid_bus_value,
  test_pin_payload_v2_rejects_nested_formal_payload,
  test_pin_payload_v2_requires_origin_table_qualified_ref,
  test_pin_payload_v2_requires_reply_target_table_qualified_ref,
  test_pin_payload_v1_formal_transport_is_removed,
];

const failures = [];
const passes = [];
for (const test of tests) {
  try {
    passes.push(test());
  } catch (err) {
    failures.push({ key: test.name, error: err && err.message ? err.message : String(err) });
  }
}

if (failures.length > 0) {
  console.error('0430 FEISHU OPERATIONAL SSOT CONTRACT FAILED');
  for (const failure of failures) {
    console.error(`${failure.key}: ${failure.error}`);
  }
  process.exit(1);
}

console.log('0430 FEISHU OPERATIONAL SSOT CONTRACT PASSED');
for (const pass of passes) {
  console.log(`${pass.key}: ${pass.status}`);
}
