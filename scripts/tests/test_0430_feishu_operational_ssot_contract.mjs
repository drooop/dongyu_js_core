#!/usr/bin/env node
// 0430 — Feishu operational SSOT executable contract.
// RED stage: these assertions define the target before runtime/server refit.

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ModelTableRuntime: CjsModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');
const { ModelTableRuntime: EsmModelTableRuntime } = await import('../../packages/worker-base/src/runtime.mjs');
const {
  buildMgmtBusConsoleMatrixPacket,
  buildWorkspaceAssetBundleRequestPacket,
  isValidBusPayloadArray,
  materializeImportedHostEgressAdapter,
  parsePinPayloadRecordEnvelope,
  parsePrincipalRuntimePinPayload,
} = await import('../../packages/ui-model-demo-server/server.mjs');

function mt(k, t, v, id = 0) {
  return { id, p: 0, r: 0, c: 0, k, t, v };
}

function createRuntime(RuntimeClass) {
  const rt = new RuntimeClass();
  rt.eventLog.reset();
  rt.intercepts.reset();
  return rt;
}

function rootRecord(records, key) {
  return records.find((record) => record && record.id === 0 && record.p === 0 && record.r === 0 && record.c === 0 && record.k === key) || null;
}

function payloadRecords(records, payloadModelId = 1) {
  return records.filter((record) => record && record.id === payloadModelId);
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
    messageRole = 'request',
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
    mt('message_role', 'str', messageRole),
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

function validBusSendV2Input(overrides = {}) {
  const {
    opId = 'req_0430_bus_send',
    busOutKey = 'generated_submit_bus_out',
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
    businessRecords = [mt('title', 'str', 'hello from bus_send', 1)],
    includeNestedPayload = false,
  } = overrides;
  const records = [
    mt('__mt_payload_kind', 'str', 'bus_send.v1'),
    mt('__mt_request_id', 'str', opId),
    mt('op_id', 'str', opId),
    mt('message_role', 'str', 'request'),
    mt('bus_out_key', 'str', busOutKey),
    mt('bus', 'str', bus),
    mt('route_kind', 'str', routeKind),
    mt('topic', 'str', topic),
    mt('response_topic', 'str', responseTopic),
    mt('endpoint_worker_id', 'str', endpointWorkerId),
    mt('endpoint_table_id', 'str', endpointTableId),
    mt('endpoint_model_id', 'int', endpointModelId),
    mt('endpoint_pin', 'str', endpointPin),
    mt('origin_worker_id', 'str', originWorkerId),
    mt('origin_table_id', 'str', originTableId),
    mt('origin_model_id', 'int', originModelId),
    mt('origin_pin', 'str', originPin),
    mt('reply_target_worker_id', 'str', replyTargetWorkerId),
    mt('reply_target_table_id', 'str', replyTargetTableId),
    mt('reply_target_model_id', 'int', replyTargetModelId),
    mt('reply_target_pin', 'str', replyTargetPin),
    mt('payload_model_id', 'int', payloadModelId),
    ...businessRecords,
  ];
  if (includeNestedPayload) {
    records.push(mt('payload', 'json', [mt('nested_title', 'str', 'legacy nested bus send')]));
  }
  return records;
}

function test_removed_feishu_label_types_are_rejected(RuntimeClass) {
  const rt = createRuntime(RuntimeClass);
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

function test_pin_payload_v2_record_array_is_valid_bus_value(RuntimeClass) {
  const rt = createRuntime(RuntimeClass);
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

function test_pin_payload_v2_rejects_nested_formal_payload(RuntimeClass) {
  const rt = createRuntime(RuntimeClass);
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

function test_pin_payload_v2_requires_origin_table_qualified_ref(RuntimeClass) {
  const rt = createRuntime(RuntimeClass);
  const root = rt.getModel(0);

  const missingOrigin = rt.addLabel(root, 0, 0, 0, {
    k: 'missing_origin_table_bus_out',
    t: 'pin.bus.cb.out',
    v: validPinPayloadV2({ includeOriginTableId: false }),
  });
  assertRejectedWithReason(rt, missingOrigin, 'missing_origin_table_bus_out', 'bus_out_missing_origin_table_id');

  return { key: 'pin_payload_v2_requires_origin_table_qualified_ref', status: 'PASS' };
}

function test_pin_payload_v2_requires_reply_target_table_qualified_ref(RuntimeClass) {
  const rt = createRuntime(RuntimeClass);
  const root = rt.getModel(0);

  const missingReply = rt.addLabel(root, 0, 0, 0, {
    k: 'missing_reply_target_table_bus_out',
    t: 'pin.bus.cb.out',
    v: validPinPayloadV2({ includeReplyTargetTableId: false }),
  });
  assertRejectedWithReason(rt, missingReply, 'missing_reply_target_table_bus_out', 'bus_out_missing_reply_target_table_id');

  return { key: 'pin_payload_v2_requires_reply_target_table_qualified_ref', status: 'PASS' };
}

function test_pin_payload_v1_formal_transport_is_removed(RuntimeClass) {
  const rt = createRuntime(RuntimeClass);
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

function test_mt_bus_send_generates_pin_payload_v2_without_nested_payload(RuntimeClass) {
  const rt = createRuntime(RuntimeClass);
  const root = rt.getModel(0);
  const payload = validBusSendV2Input();
  const result = rt._applyBusSendPayload(root, 0, 0, 0, payload);
  const busLabel = root.getCell(0, 0, 0).labels.get('generated_submit_bus_out');

  assert.equal(result.status, 'ok', 'mt_bus_send must accept non-nested bus_send request');
  assert.equal(busLabel?.t, 'pin.bus.cb.out', 'mt_bus_send must write control bus out');
  assert.equal(busLabel.v.find((record) => record.k === '__mt_payload_kind')?.v, 'pin_payload.v2');
  assert.equal(busLabel.v.find((record) => record.k === 'payload_model_id')?.v, 1);
  assert.equal(busLabel.v.some((record) => record.k === 'payload'), false, 'mt_bus_send output must not contain nested payload.v');
  assert.deepEqual(
    busLabel.v.filter((record) => record.id === 1),
    [mt('title', 'str', 'hello from bus_send', 1)],
    'mt_bus_send output must preserve business records as model records',
  );

  return { key: 'mt_bus_send_generates_pin_payload_v2_without_nested_payload', status: 'PASS' };
}

function test_mt_bus_send_rejects_nested_formal_payload(RuntimeClass) {
  const rt = createRuntime(RuntimeClass);
  const root = rt.getModel(0);
  const result = rt._applyBusSendPayload(root, 0, 0, 0, validBusSendV2Input({ includeNestedPayload: true }));

  assert.equal(result.status, 'rejected', 'mt_bus_send must reject nested payload.v');
  assert.equal(result.code, 'nested_payload_removed');
  assert.equal(root.getCell(0, 0, 0).labels.has('generated_submit_bus_out'), false);

  return { key: 'mt_bus_send_rejects_nested_formal_payload', status: 'PASS' };
}

function test_positive_model_pin_rejects_malformed_pin_payload_v2(RuntimeClass) {
  const rt = createRuntime(RuntimeClass);
  const app = rt.createModel({ id: 42, name: 'app', type: 'model.table' });
  const malformed = validPinPayloadV2({ businessRecords: [] })
    .filter((record) => record.k !== 'payload_model_id');
  const result = rt.addLabel(app, 0, 0, 0, {
    k: 'submit_in',
    t: 'pin.in',
    v: malformed,
  });

  assertRejectedWithReason(rt, result, 'submit_in', 'pin_payload_missing_payload_model_id');
  assert.equal(app.getCell(0, 0, 0).labels.has('submit_in'), false);

  return { key: 'positive_model_pin_rejects_malformed_pin_payload_v2', status: 'PASS' };
}

function test_imported_host_egress_bridge_generates_non_nested_bus_send(RuntimeClass) {
  const rt = createRuntime(RuntimeClass);
  const root = rt.createModel({ id: 222, name: 'Imported Bridge Fixture', type: 'model.table' });
  rt.addLabel(root, 0, 0, 0, { k: 'submit_request', t: 'pin.in', v: null });
  const result = materializeImportedHostEgressAdapter(
    rt,
    222,
    { p: 2, r: 0, c: 0 },
    { semantic: 'submit', pinName: 'submit' },
    { transport: 'mqtt', to: { worker_id: 'R1', model_id: 3000 }, route_kind: 'control' },
  );
  assert.ok(result, 'host egress bridge must be generated');

  const model0 = rt.getModel(0);
  const bridgeCode = model0.getCell(0, 0, 0).labels.get('bridge_imported_submit_to_mt_bus_send_222')?.v?.code || '';
  assert.ok(bridgeCode.includes("mt('payload_model_id', 'int', 1)"), 'bridge must write payload_model_id');
  assert.ok(bridgeCode.includes('...payloadRecords'), 'bridge must expand payload records');
  assert.equal(bridgeCode.includes("mt('payload', 'json', payload)"), false, 'bridge must not nest payload.v');

  const writes = [];
  const bridge = new Function('label', 'V1N', bridgeCode);
  bridge(
    { v: [mt('message_text', 'str', 'hello bridge')] },
    {
      readLabel: () => null,
      addLabel: (k, t, v) => {
        writes.push({ k, t, v });
      },
    },
  );
  const busSend = writes.find((entry) => entry.k === 'mt_bus_send_in');
  assert.ok(busSend, 'bridge must write mt_bus_send_in');
  assert.equal(busSend.t, 'pin.in');
  assert.equal(rootRecord(busSend.v, '__mt_payload_kind')?.v, 'bus_send.v1');
  assert.equal(rootRecord(busSend.v, 'payload_model_id')?.v, 1);
  assert.equal(rootRecord(busSend.v, 'payload'), null, 'bridge bus_send must not contain nested payload.v');
  assert.deepEqual(payloadRecords(busSend.v), [mt('message_text', 'str', 'hello bridge', 1)]);

  const applied = rt._applyBusSendPayload(model0, 0, 0, 0, busSend.v);
  assert.equal(applied.status, 'ok', 'bridge bus_send must reach runtime mt_bus_send');
  const busOut = model0.getCell(0, 0, 0).labels.get('imported_submit_222_bus');
  assert.equal(busOut?.t, 'pin.bus.cb.out');
  assert.equal(rootRecord(busOut.v, '__mt_payload_kind')?.v, 'pin_payload.v2');
  assert.equal(rootRecord(busOut.v, 'payload'), null, 'runtime bus out must not contain nested payload.v');
  assert.deepEqual(payloadRecords(busOut.v), [mt('message_text', 'str', 'hello bridge', 1)]);

  return { key: 'imported_host_egress_bridge_generates_non_nested_bus_send', status: 'PASS' };
}

function test_server_parser_accepts_pin_payload_v2_non_nested_records() {
  const records = validPinPayloadV2({ opId: 'req_0430_server_v2' });
  const parsed = parsePinPayloadRecordEnvelope({ version: 'v1', type: 'pin_payload', payload: records });

  assert.equal(parsed.ok, true, 'server parser must accept pin_payload.v2 non-nested record array');
  assert.equal(parsed.payloadModelId, 1, 'server parser must expose payload_model_id');
  assert.deepEqual(parsed.payloadRecords, [mt('title', 'str', 'hello 0430', 1)]);
  assert.equal(parsed.nestedPayload, undefined, 'server parser must not expose nested payload for v2');

  return { key: 'server_parser_accepts_pin_payload_v2_non_nested_records', status: 'PASS' };
}

function test_server_parser_rejects_removed_pin_payload_shapes() {
  const legacy = parsePinPayloadRecordEnvelope({
    version: 'v1',
    type: 'pin_payload',
    payload: validPinPayloadV2({ kind: 'pin_payload.v1' }),
  });
  assert.equal(legacy.ok, false, 'server parser must reject pin_payload.v1');
  assert.equal(legacy.code, 'legacy_pin_payload_kind_removed');

  const nested = parsePinPayloadRecordEnvelope({
    version: 'v1',
    type: 'pin_payload',
    payload: validPinPayloadV2({ includeNestedPayload: true }),
  });
  assert.equal(nested.ok, false, 'server parser must reject nested payload.v');
  assert.equal(nested.code, 'nested_payload_removed');

  const missingOriginTable = parsePinPayloadRecordEnvelope({
    version: 'v1',
    type: 'pin_payload',
    payload: validPinPayloadV2({ includeOriginTableId: false }),
  });
  assert.equal(missingOriginTable.ok, false, 'server parser must reject missing origin_table_id');
  assert.equal(missingOriginTable.code, 'missing_origin_table_id');

  const missingReplyTable = parsePinPayloadRecordEnvelope({
    version: 'v1',
    type: 'pin_payload',
    payload: validPinPayloadV2({ includeReplyTargetTableId: false }),
  });
  assert.equal(missingReplyTable.ok, false, 'server parser must reject missing reply_target_table_id');
  assert.equal(missingReplyTable.code, 'missing_reply_target_table_id');

  return { key: 'server_parser_rejects_removed_pin_payload_shapes', status: 'PASS' };
}

function test_server_bus_payload_array_accepts_pin_payload_v2() {
  const records = validPinPayloadV2({
    opId: 'req_0430_server_direct_v2',
    businessRecords: [
      mt('__mt_payload_kind', 'str', 'slide_app_bundle_response.v1', 1),
      mt('asset_id', 'str', 'todo_app', 1),
    ],
  });

  assert.equal(isValidBusPayloadArray(records), true, 'server direct bus payload validation must accept pin_payload.v2');
  assert.equal(
    isValidBusPayloadArray(validPinPayloadV2({ kind: 'pin_payload.v1' })),
    false,
    'server direct bus payload validation must reject removed pin_payload.v1',
  );
  assert.equal(
    isValidBusPayloadArray(validPinPayloadV2({ includeNestedPayload: true })),
    false,
    'server direct bus payload validation must reject nested payload.v',
  );

  return { key: 'server_bus_payload_array_accepts_pin_payload_v2', status: 'PASS' };
}

function test_server_workspace_bundle_request_builder_emits_pin_payload_v2() {
  const rt = createRuntime(CjsModelTableRuntime);
  const root = rt.getModel(0);
  rt.addLabel(root, 0, 0, 0, { k: 'mqtt_topic_base', t: 'str', v: 'UIPUT/ws/dam/pic/de' });
  rt.addLabel(root, 0, 0, 0, { k: 'principal_runtime_key', t: 'str', v: 'subject:drop' });
  const row = {
    id: 'todo_app',
    provider_worker_id: 'R1',
    provider_model_id: 3100,
    provider_bundle_pin: 'bundle_request',
  };
  const providerEndpoint = {
    routeKind: 'control',
    topic: 'UIPUT/ws/dam/pic/de/R1/3100/bundle_request',
  };
  const built = buildWorkspaceAssetBundleRequestPacket(rt, row, 'req_0430_bundle_request', providerEndpoint);

  assert.equal(rootRecord(built.records, '__mt_payload_kind')?.v, 'pin_payload.v2');
  assert.equal(rootRecord(built.records, 'payload_model_id')?.v, 1);
  assert.equal(rootRecord(built.records, 'payload'), null, 'workspace bundle request must not nest payload.v');
  assert.deepEqual(payloadRecords(built.records), [
    mt('__mt_payload_kind', 'str', 'slide_app_bundle_request.v1', 1),
    mt('__mt_request_id', 'str', 'req_0430_bundle_request', 1),
    mt('asset_id', 'str', 'todo_app', 1),
    mt('requested_version', 'str', 'current', 1),
  ]);
  assert.equal(parsePinPayloadRecordEnvelope({ version: 'v1', type: 'pin_payload', payload: built.records }).ok, true);

  return { key: 'server_workspace_bundle_request_builder_emits_pin_payload_v2', status: 'PASS' };
}

function test_server_mgmt_bus_console_builder_emits_pin_payload_v2() {
  const rt = createRuntime(CjsModelTableRuntime);
  const root = rt.getModel(0);
  rt.addLabel(root, 0, 0, 0, { k: 'mqtt_topic_base', t: 'str', v: 'UIPUT/ws/dam/pic/de' });
  rt.addLabel(root, 0, 0, 0, { k: 'principal_runtime_key', t: 'str', v: 'subject:drop' });
  const packet = buildMgmtBusConsoleMatrixPacket([
    mt('__mt_payload_kind', 'str', 'mgmt_bus_console.send.v1'),
    mt('target_user_id', 'str', '@mbr:localhost'),
    mt('draft', 'str', 'hello mbr'),
  ], { runtime: rt });

  assert.equal(packet.ok, true, 'mgmt bus console builder must accept valid input');
  const records = packet.data.payload;
  assert.equal(rootRecord(records, '__mt_payload_kind')?.v, 'pin_payload.v2');
  assert.equal(rootRecord(records, 'payload_model_id')?.v, 1);
  assert.equal(rootRecord(records, 'payload'), null, 'mgmt bus console packet must not nest payload.v');
  assert.equal(payloadRecords(records).find((record) => record.k === 'message_text')?.v, 'hello mbr');
  assert.equal(parsePinPayloadRecordEnvelope({ version: 'v1', type: 'pin_payload', payload: records }).ok, true);

  return { key: 'server_mgmt_bus_console_builder_emits_pin_payload_v2', status: 'PASS' };
}

function test_principal_runtime_parser_accepts_pin_payload_v2_response() {
  const records = validPinPayloadV2({
    opId: 'req_0430_principal_response',
    messageRole: 'response',
    topic: 'UIPUT/ws/dam/pic/de/U1/1055/result',
    responseTopic: 'UIPUT/ws/dam/pic/de/U1/1055/result',
    endpointWorkerId: 'U1',
    endpointTableId: 'host',
    endpointModelId: 1055,
    endpointPin: 'result',
    originWorkerId: 'R1',
    originTableId: 'host',
    originModelId: 3000,
    originPin: 'submit1',
    replyTargetWorkerId: 'U1',
    replyTargetTableId: 'app:subject:drop:todo:001',
    replyTargetModelId: 0,
    replyTargetPin: 'result',
    businessRecords: [mt('submitted_text', 'str', 'principal result', 1)],
  });
  const parsed = parsePrincipalRuntimePinPayload({ version: 'v1', type: 'pin_payload', payload: records });

  assert.equal(parsed.ok, true, 'principal runtime parser must accept pin_payload.v2 response records');
  assert.equal(parsed.payloadModelId, 1);
  assert.deepEqual(parsed.payloadRecords, [mt('submitted_text', 'str', 'principal result', 1)]);
  assert.equal(parsed.nestedPayload, undefined, 'principal runtime parser must not expose nested payload');

  return { key: 'principal_runtime_parser_accepts_pin_payload_v2_response', status: 'PASS' };
}

function test_principal_runtime_parser_rejects_removed_pin_payload_shapes() {
  const base = {
    messageRole: 'response',
    topic: 'UIPUT/ws/dam/pic/de/U1/1055/result',
    responseTopic: 'UIPUT/ws/dam/pic/de/U1/1055/result',
    endpointWorkerId: 'U1',
    endpointTableId: 'host',
    endpointModelId: 1055,
    endpointPin: 'result',
  };
  const legacy = parsePrincipalRuntimePinPayload({
    version: 'v1',
    type: 'pin_payload',
    payload: validPinPayloadV2({ ...base, kind: 'pin_payload.v1' }),
  });
  assert.equal(legacy.ok, false, 'principal runtime parser must reject pin_payload.v1');
  assert.equal(legacy.code, 'legacy_pin_payload_kind_removed');

  const nested = parsePrincipalRuntimePinPayload({
    version: 'v1',
    type: 'pin_payload',
    payload: validPinPayloadV2({ ...base, includeNestedPayload: true }),
  });
  assert.equal(nested.ok, false, 'principal runtime parser must reject nested payload.v');
  assert.equal(nested.code, 'nested_payload_removed');

  return { key: 'principal_runtime_parser_rejects_removed_pin_payload_shapes', status: 'PASS' };
}

const tests = [
  test_removed_feishu_label_types_are_rejected,
  test_pin_payload_v2_record_array_is_valid_bus_value,
  test_pin_payload_v2_rejects_nested_formal_payload,
  test_pin_payload_v2_requires_origin_table_qualified_ref,
  test_pin_payload_v2_requires_reply_target_table_qualified_ref,
  test_pin_payload_v1_formal_transport_is_removed,
  test_mt_bus_send_generates_pin_payload_v2_without_nested_payload,
  test_mt_bus_send_rejects_nested_formal_payload,
  test_positive_model_pin_rejects_malformed_pin_payload_v2,
  test_imported_host_egress_bridge_generates_non_nested_bus_send,
];

const serverTests = [
  test_server_parser_accepts_pin_payload_v2_non_nested_records,
  test_server_parser_rejects_removed_pin_payload_shapes,
  test_server_bus_payload_array_accepts_pin_payload_v2,
  test_server_workspace_bundle_request_builder_emits_pin_payload_v2,
  test_server_mgmt_bus_console_builder_emits_pin_payload_v2,
  test_principal_runtime_parser_accepts_pin_payload_v2_response,
  test_principal_runtime_parser_rejects_removed_pin_payload_shapes,
];

const failures = [];
const passes = [];
const runtimeCases = [
  ['cjs', CjsModelTableRuntime],
  ['esm', EsmModelTableRuntime],
];
for (const [runtimeKey, RuntimeClass] of runtimeCases) {
  for (const test of tests) {
    try {
      const result = test(RuntimeClass);
      passes.push({ ...result, key: `${runtimeKey}:${result.key}` });
    } catch (err) {
      failures.push({ key: `${runtimeKey}:${test.name}`, error: err && err.message ? err.message : String(err) });
    }
  }
}
for (const test of serverTests) {
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
