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

const RESERVED_ENVELOPE_EXTENSION_EXACT_KEYS = [
  '__mt_payload_kind',
  '__mt_request_id',
  'op_id',
  'request_id',
  'correlation_id',
  'message_role',
  'bus',
  'bus_out_key',
  'route_kind',
  'topic',
  'response_topic',
  'timestamp',
  'payload',
  'payload_model_id',
  'bundle_record_id_offset',
  'worker_id',
  'model_id',
  'table_id',
  'pin',
  'principal_ref',
  'principal_id',
  'authority',
  'identity',
  'source_model_id',
  'route',
  'reply_to',
  'route.reply_to',
  'response_pin',
  'return_topic',
  'returnTopic',
  'result_topic',
  'envelope_extension_keys',
];

const RESERVED_ENVELOPE_EXTENSION_PREFIXES = [
  '__mt_',
  'endpoint_',
  'origin_',
  'reply_target_',
  'principal_',
  'owner_',
  'payload_',
  'response_',
  'return_',
  'route_',
  'source_',
  'model_',
  'sys_',
];

const EXACT_MAX_LENGTH_EXTENSION_KEY = `x${'a'.repeat(63)}`;
const EXACT_MAX_EXTENSION_KEYS = [
  'is_need_response',
  'message_server',
  'between',
  'send_user',
  'receive_user',
  'custom_trace',
  ...Array.from({ length: 9 }, (_, index) => `boundary_${index}`),
  EXACT_MAX_LENGTH_EXTENSION_KEY,
];

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
    mt('timestamp', 'int', 1700000000430),
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
    envelopeExtensions = [],
    declaredEnvelopeExtensionKeys = envelopeExtensions.map((record) => record.k),
    includeEnvelopeExtensionDeclaration = envelopeExtensions.length > 0,
    envelopeExtensionDeclarationType = 'json',
    envelopeExtensionDeclarationValue = declaredEnvelopeExtensionKeys,
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
    ...(includeEnvelopeExtensionDeclaration
      ? [mt('envelope_extension_keys', envelopeExtensionDeclarationType, envelopeExtensionDeclarationValue)]
      : []),
    ...envelopeExtensions,
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
  const workerRoot = rt.addLabel(root, 0, 0, 0, {
    k: 'model_type',
    t: 'model.v1n',
    v: '',
  });
  assert.equal(workerRoot.applied, true, 'model.v1n is the current software-worker host root declaration');
  const cases = [
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

function test_mt_bus_send_preserves_safe_envelope_extensions(RuntimeClass) {
  const rt = createRuntime(RuntimeClass);
  const root = rt.getModel(0);
  const genericExtensionValue = { source: 'generic', nested: { count: 1 } };
  const extensions = [
    mt('is_need_response', 'bool', true),
    mt('message_server', 'str', 'local'),
    mt('between', 'str', 'DEM_V1N'),
    mt('send_user', 'str', '@ui:localhost'),
    mt('receive_user', 'str', '@mbr:localhost'),
    mt('custom_trace', 'json', genericExtensionValue),
  ];
  const result = rt._applyBusSendPayload(root, 0, 0, 0, validBusSendV2Input({
    opId: 'req_0430_safe_extensions',
    busOutKey: 'safe_extension_bus_out',
    envelopeExtensions: extensions,
  }));
  const busOut = root.getCell(0, 0, 0).labels.get('safe_extension_bus_out');

  assert.equal(result.status, 'ok', 'generic bus_send must accept safe unique root extensions');
  for (const extension of extensions) {
    assert.deepEqual(
      rootRecord(busOut?.v || [], extension.k),
      extension,
      `${extension.k} must remain an envelope Model 0 record`,
    );
    assert.equal(
      payloadRecords(busOut?.v || []).some((record) => record.k === extension.k),
      false,
      `${extension.k} must not be remapped into business payload Model 1`,
    );
  }
  assert.equal(
    rootRecord(busOut?.v || [], 'envelope_extension_keys'),
    null,
    'internal extension declaration must never be emitted in external pin_payload.v2',
  );
  assert.deepEqual(payloadRecords(busOut?.v || []), [mt('title', 'str', 'hello from bus_send', 1)]);
  genericExtensionValue.nested.count = 999;
  assert.deepEqual(
    rootRecord(busOut?.v || [], 'custom_trace')?.v,
    { source: 'generic', nested: { count: 1 } },
    'generic extension values must be deep-cloned before external publication',
  );
  assert.equal(rt._parsePinPayloadValue(busOut.v).ok, true, 'extended output must remain valid generic pin_payload.v2');

  const declaredTrace = { pin: 'resource', scope: 'envelope', route: 'control' };
  const businessTrace = { pin: 'resource', scope: 'payload', route: 'control' };
  const declaredTraceResult = rt._applyBusSendPayload(root, 0, 0, 0, validBusSendV2Input({
    opId: 'req_0430_declared_trace_with_business_keys',
    busOutKey: 'declared_trace_with_business_keys_bus_out',
    envelopeExtensions: [mt('custom_trace', 'json', declaredTrace)],
    businessRecords: [
      mt('custom_trace', 'json', businessTrace, 1),
      mt('title', 'str', 'declared extension trace', 1),
    ],
  }));
  const declaredTraceBusOut = root.getCell(0, 0, 0).labels.get('declared_trace_with_business_keys_bus_out');
  assert.equal(
    declaredTraceResult.status,
    'ok',
    'declared extension values may contain ordinary business pin/route keys',
  );
  assert.deepEqual(rootRecord(declaredTraceBusOut?.v || [], 'custom_trace')?.v, declaredTrace);
  assert.deepEqual(
    payloadRecords(declaredTraceBusOut?.v || []).find((record) => record.k === 'custom_trace')?.v,
    businessTrace,
    'the declared key must protect only matching record values while preserving payload placement',
  );
  assert.equal(
    rt._parsePinPayloadValue(declaredTraceBusOut.v).ok,
    true,
    'the generated formal v2 payload must validate before transport',
  );
  assert.equal(
    rootRecord(declaredTraceBusOut.v, 'envelope_extension_keys'),
    null,
    'the internal declaration must not become a public ModelTable record',
  );
  const wirePacket = JSON.parse(JSON.stringify(rt._pinBusOutValueToExternalPayload(declaredTraceBusOut.v)));
  const receivingRuntime = createRuntime(RuntimeClass);
  const received = receivingRuntime._parsePinPayloadValue(wirePacket.payload);
  assert.equal(received.ok, true, 'declared extensions must survive Runtime to JSON to receiving Runtime validation');
  assert.deepEqual(rootRecord(received.packet.payload, 'custom_trace')?.v, declaredTrace);
  assert.deepEqual(
    payloadRecords(received.packet.payload).find((record) => record.k === 'custom_trace')?.v,
    businessTrace,
    'the receiving Runtime must preserve both envelope and business records after JSON transport',
  );
  receivingRuntime.setRuntimeMode('edit');
  const receivingRoot = receivingRuntime.getModel(0);
  receivingRuntime.addLabel(receivingRoot, 0, 0, 0, { k: 'mqtt_topic_mode', t: 'str', v: 'uiput_mm_v1' });
  receivingRuntime.addLabel(receivingRoot, 0, 0, 0, { k: 'mqtt_topic_base', t: 'str', v: 'UIPUT/ws/dam/pic/de' });
  receivingRuntime.addLabel(receivingRoot, 0, 0, 0, { k: 'mqtt_worker_id', t: 'str', v: 'R1' });
  receivingRuntime.addLabel(receivingRoot, 0, 0, 0, { k: 'mqtt_payload_mode', t: 'str', v: 'pin_payload_v1' });
  receivingRuntime.addLabel(receivingRoot, 0, 0, 0, { k: 'mqtt_ingress_pin', t: 'str', v: 'runtime_cb_in' });
  receivingRuntime.addLabel(receivingRoot, 0, 0, 0, { k: 'runtime_cb_in', t: 'pin.bus.cb.in', v: null });
  receivingRuntime.setRuntimeMode('running');
  assert.equal(
    receivingRuntime.mqttIncoming('UIPUT/ws/dam/pic/de/R1/3000/submit1', wirePacket),
    true,
    'the receiving Runtime must accept the JSON-round-tripped packet through its public MQTT boundary',
  );
  assert.deepEqual(
    receivingRoot.getCell(0, 0, 0).labels.get('runtime_cb_in')?.v,
    wirePacket.payload,
    'the complete round trip must deliver the formal v2 records through the receiving Runtime Model 0 boundary',
  );

  const trueLegacyInsideExtension = JSON.parse(JSON.stringify(wirePacket.payload));
  rootRecord(trueLegacyInsideExtension, 'custom_trace').v = { source_model_id: 3000 };
  assert.deepEqual(
    receivingRuntime._parsePinPayloadValue(trueLegacyInsideExtension),
    { ok: false, code: 'legacy_pin_payload_metadata_removed', opId: 'req_0430_declared_trace_with_business_keys' },
    'a safe extension key must not hide true retired transport metadata',
  );
  const undeclaredBusinessTrace = wirePacket.payload.filter((record) => !(record.id === 0 && record.k === 'custom_trace'));
  assert.deepEqual(
    receivingRuntime._parsePinPayloadValue(undeclaredBusinessTrace),
    { ok: false, code: 'legacy_pin_payload_metadata_removed', opId: 'req_0430_declared_trace_with_business_keys' },
    'business records do not gain extension treatment without a matching safe envelope record',
  );

  assert.equal(EXACT_MAX_EXTENSION_KEYS.length, 16);
  assert.equal(EXACT_MAX_LENGTH_EXTENSION_KEY.length, 64);
  const boundaryValues = EXACT_MAX_EXTENSION_KEYS.map((key, index) => ({
    key,
    value: { index, key_length: key.length, nested: { count: 1 } },
  }));
  const boundaryExtensions = boundaryValues.map(({ key, value }) => mt(key, 'json', value));
  const boundaryResult = rt._applyBusSendPayload(root, 0, 0, 0, validBusSendV2Input({
    opId: 'req_0430_exact_extension_limits',
    busOutKey: 'exact_extension_limits_bus_out',
    envelopeExtensions: boundaryExtensions,
  }));
  assert.equal(boundaryResult.status, 'ok', 'bus_send must accept exactly 16 unique declared extension keys');
  const boundaryBusOut = root.getCell(0, 0, 0).labels.get('exact_extension_limits_bus_out');
  assert.equal(rootRecord(boundaryBusOut?.v || [], 'envelope_extension_keys'), null);
  for (const extension of boundaryExtensions) {
    assert.deepEqual(
      rootRecord(boundaryBusOut?.v || [], extension.k),
      extension,
      `boundary extension must remain a root envelope record: ${extension.k}`,
    );
  }
  const maxLengthSource = boundaryValues.find(({ key }) => key === EXACT_MAX_LENGTH_EXTENSION_KEY)?.value;
  assert.ok(maxLengthSource, '64-character boundary extension fixture must exist');
  maxLengthSource.nested.count = 999;
  assert.deepEqual(
    rootRecord(boundaryBusOut?.v || [], EXACT_MAX_LENGTH_EXTENSION_KEY)?.v,
    {
      index: EXACT_MAX_EXTENSION_KEYS.length - 1,
      key_length: 64,
      nested: { count: 1 },
    },
    'the accepted 64-character extension must be externally published with deep-clone isolation',
  );
  assert.equal(rt._parsePinPayloadValue(boundaryBusOut.v).ok, true, '16/64 boundary output must remain formal v2');

  return { key: 'mt_bus_send_preserves_safe_envelope_extensions', status: 'PASS' };
}

function test_mt_bus_send_rejects_duplicate_envelope_extension_declaration(RuntimeClass) {
  const rt = createRuntime(RuntimeClass);
  const root = rt.getModel(0);
  const busOutKey = 'duplicate_envelope_extension_declaration_bus_out';
  const input = validBusSendV2Input({
    opId: 'req_0430_duplicate_envelope_extension_declaration',
    busOutKey,
    includeEnvelopeExtensionDeclaration: true,
    envelopeExtensionDeclarationValue: ['custom_trace'],
  });
  input.push(mt('envelope_extension_keys', 'json', ['custom_trace']));
  assert.equal(
    input.filter((record) => (
      record.id === 0
      && record.p === 0
      && record.r === 0
      && record.c === 0
      && record.k === 'envelope_extension_keys'
    )).length,
    2,
    'fixture must contain exactly two Model 0 root envelope_extension_keys declarations',
  );
  assert.equal(root.getCell(0, 0, 0).labels.has(busOutKey), false, 'target bus output starts absent');

  const result = rt._applyBusSendPayload(root, 0, 0, 0, input);

  assert.deepEqual(
    { status: result.status, code: result.code },
    { status: 'rejected', code: 'duplicate_envelope_extension_declaration' },
    'duplicate internal envelope-extension declarations must fail closed with an explicit reason',
  );
  assert.equal(
    root.getCell(0, 0, 0).labels.has(busOutKey),
    false,
    'duplicate declaration rejection must not create or replace the target bus output',
  );

  return { key: 'mt_bus_send_rejects_duplicate_envelope_extension_declaration', status: 'PASS' };
}

function test_mt_bus_send_rejects_unsafe_envelope_extension_shapes(RuntimeClass) {
  const cases = [
    {
      name: 'duplicate_extension',
      records: [mt('is_need_response', 'bool', true), mt('is_need_response', 'bool', false)],
      code: 'duplicate_envelope_extension',
    },
    {
      name: 'non_root_extension',
      records: [{ ...mt('is_need_response', 'bool', true), p: 1 }],
      code: 'invalid_envelope_extension_placement',
    },
    {
      name: 'undeclared_payload_model',
      records: [mt('other_model_value', 'str', 'forbidden', 2)],
      code: 'invalid_payload_record_scope',
    },
    {
      name: 'duplicate_host_owned_key',
      records: [mt('endpoint_worker_id', 'str', 'attacker')],
      code: 'duplicate_bus_send_metadata',
    },
    {
      name: 'authority_extension',
      records: [mt('principal_id', 'str', 'attacker')],
      code: 'client_authority_metadata_rejected',
    },
    {
      name: 'legacy_route_extension',
      records: [mt('source_model_id', 'int', 999)],
      code: 'legacy_pin_payload_metadata_removed',
    },
    {
      name: 'reserved_identity_namespace',
      records: [mt('principal_runtime_key', 'str', 'attacker')],
      code: 'invalid_envelope_extension_declaration',
    },
  ];

  for (const testCase of cases) {
    const rt = createRuntime(RuntimeClass);
    const root = rt.getModel(0);
    const result = rt._applyBusSendPayload(root, 0, 0, 0, validBusSendV2Input({
      opId: `req_0430_${testCase.name}`,
      busOutKey: `unsafe_${testCase.name}_bus_out`,
      envelopeExtensions: testCase.records,
    }));
    assert.deepEqual(
      { status: result.status, code: result.code },
      { status: 'rejected', code: testCase.code },
      `${testCase.name} must fail closed with an exact reason`,
    );
    assert.equal(
      root.getCell(0, 0, 0).labels.has(`unsafe_${testCase.name}_bus_out`),
      false,
      `${testCase.name} must not write a bus output`,
    );
  }

  {
    const rt = createRuntime(RuntimeClass);
    const root = rt.getModel(0);
    const result = rt._applyBusSendPayload(root, 0, 0, 0, validBusSendV2Input({
      opId: 'req_0430_undeclared_extension',
      busOutKey: 'unsafe_undeclared_extension_bus_out',
      envelopeExtensions: [mt('is_need_response', 'bool', true)],
      declaredEnvelopeExtensionKeys: [],
      includeEnvelopeExtensionDeclaration: true,
    }));
    assert.deepEqual(
      { status: result.status, code: result.code },
      { status: 'rejected', code: 'undeclared_envelope_extension' },
      'a safe extension still requires an explicit internal declaration',
    );
  }

  {
    const rt = createRuntime(RuntimeClass);
    const root = rt.getModel(0);
    const result = rt._applyBusSendPayload(root, 0, 0, 0, validBusSendV2Input({
      opId: 'req_0430_missing_extension_declaration',
      busOutKey: 'unsafe_missing_extension_declaration_bus_out',
      envelopeExtensions: [mt('custom_trace', 'json', { trace: 'missing-declaration' })],
      includeEnvelopeExtensionDeclaration: false,
    }));
    assert.deepEqual(
      { status: result.status, code: result.code },
      { status: 'rejected', code: 'undeclared_envelope_extension' },
      'an extension without the internal declaration label must fail closed',
    );
  }

  for (const [name, type, value] of [
    ['wrong_declaration_type', 'str', ['custom_trace']],
    ['null_declaration_value', 'json', null],
    ['string_declaration_value', 'json', 'custom_trace'],
    ['object_declaration_value', 'json', { key: 'custom_trace' }],
    ['null_declaration_entry', 'json', [null]],
    ['number_declaration_entry', 'json', [7]],
    ['object_declaration_entry', 'json', [{ key: 'custom_trace' }]],
  ]) {
    const rt = createRuntime(RuntimeClass);
    const root = rt.getModel(0);
    const result = rt._applyBusSendPayload(root, 0, 0, 0, validBusSendV2Input({
      opId: `req_0430_${name}`,
      busOutKey: `unsafe_${name}_bus_out`,
      includeEnvelopeExtensionDeclaration: true,
      envelopeExtensionDeclarationType: type,
      envelopeExtensionDeclarationValue: value,
    }));
    assert.deepEqual(
      { status: result.status, code: result.code },
      { status: 'rejected', code: 'invalid_envelope_extension_declaration' },
      `${name} must fail closed before publication`,
    );
    assert.equal(root.getCell(0, 0, 0).labels.has(`unsafe_${name}_bus_out`), false);
  }

  {
    const rt = createRuntime(RuntimeClass);
    const root = rt.getModel(0);
    const tooMany = Array.from({ length: 17 }, (_, index) => `custom_${index}`);
    const result = rt._applyBusSendPayload(root, 0, 0, 0, validBusSendV2Input({
      opId: 'req_0430_too_many_extension_keys',
      busOutKey: 'unsafe_too_many_extension_keys_bus_out',
      declaredEnvelopeExtensionKeys: tooMany,
      includeEnvelopeExtensionDeclaration: true,
    }));
    assert.deepEqual(
      { status: result.status, code: result.code },
      { status: 'rejected', code: 'invalid_envelope_extension_declaration' },
      'internal extension declaration must enforce the shared count limit',
    );
  }

  const invalidDeclarations = [
    ['duplicate_declared_key', ['custom_hint', 'custom_hint']],
    ['invalid_declared_key_grammar', ['Bad-Key']],
    ['declared_key_too_long', [`custom_${'x'.repeat(58)}`]],
    ...RESERVED_ENVELOPE_EXTENSION_EXACT_KEYS.map((key) => [
      `reserved_exact_${key.replace(/[^a-z0-9]+/giu, '_')}`,
      [key],
    ]),
    ...RESERVED_ENVELOPE_EXTENSION_PREFIXES.map((prefix) => [
      `reserved_prefix_${prefix.replace(/[^a-z0-9]+/giu, '_')}`,
      [`${prefix}shadow`],
    ]),
  ];
  for (const [name, declaredEnvelopeExtensionKeys] of invalidDeclarations) {
    const rt = createRuntime(RuntimeClass);
    const root = rt.getModel(0);
    const result = rt._applyBusSendPayload(root, 0, 0, 0, validBusSendV2Input({
      opId: `req_0430_${name}`,
      busOutKey: `unsafe_${name}_bus_out`,
      declaredEnvelopeExtensionKeys,
      includeEnvelopeExtensionDeclaration: true,
    }));
    assert.deepEqual(
      { status: result.status, code: result.code },
      { status: 'rejected', code: 'invalid_envelope_extension_declaration' },
      `${name} must use the same shared declaration rule as UI Server import`,
    );
    assert.equal(root.getCell(0, 0, 0).labels.has(`unsafe_${name}_bus_out`), false);
  }

  return { key: 'mt_bus_send_rejects_unsafe_envelope_extension_shapes', status: 'PASS' };
}

function test_mt_bus_send_rejects_records_outside_declared_payload_model(RuntimeClass) {
  const rt = createRuntime(RuntimeClass);
  const root = rt.getModel(0);
  const busOutKey = 'mixed_payload_models_bus_out';
  const result = rt._applyBusSendPayload(root, 0, 0, 0, validBusSendV2Input({
    opId: 'req_0430_mixed_payload_models',
    busOutKey,
    payloadModelId: 1,
    businessRecords: [
      mt('title', 'str', 'legal Model 1 payload', 1),
      mt('unexpected_model_value', 'str', 'forbidden Model 2 payload', 2),
    ],
  }));

  assert.deepEqual(
    { status: result.status, code: result.code },
    { status: 'rejected', code: 'invalid_payload_record_scope' },
    'bus_send must reject a legal payload Model 1 mixed with an undeclared Model 2',
  );
  assert.equal(
    root.getCell(0, 0, 0).labels.has(busOutKey),
    false,
    'mixed payload-model input must not write any bus output',
  );

  return { key: 'mt_bus_send_rejects_records_outside_declared_payload_model', status: 'PASS' };
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

function test_table_qualified_adapter_keys_are_stable_and_collision_resistant(RuntimeClass) {
  const parseQualifiedRef = (value) => {
    const slash = value.lastIndexOf('/');
    assert.ok(slash > 0, `invalid reviewer model ref: ${value}`);
    const tableId = value.slice(0, slash);
    const modelIdText = value.slice(slash + 1);
    assert.match(modelIdText, /^(?:0|[1-9][0-9]*)$/u);
    return { table_id: tableId, model_id: Number(modelIdText) };
  };
  const refs = [
    parseQualifiedRef('app:a-b:c:2-0-0:1/0'),
    parseQualifiedRef('app:a:b-c:2-0-0:1/0'),
  ];
  const oldLossySuffix = (ref) => `${ref.table_id.toLowerCase().replace(/[^a-z0-9._-]+/gu, '-')}_${ref.model_id}`;
  assert.equal(oldLossySuffix(refs[0]), oldLossySuffix(refs[1]), 'reviewer refs must reproduce the old lossy collision');

  const materializeKeys = () => {
    const rt = createRuntime(RuntimeClass);
    return refs.map((ref, index) => {
      const root = rt.createModel({ table_id: ref.table_id, id: ref.model_id, name: `Collision Ref ${index}`, type: 'model.table' });
      rt.addLabel(root, 0, 0, 0, { k: 'submit', t: 'pin.out', v: null });
      return materializeImportedHostEgressAdapter(
        rt,
        ref,
        { p: 8, r: 0, c: index },
        { semantic: 'submit', pinName: 'submit', routeKind: 'control', envelopeExtensionKeys: [] },
        { transport: 'mqtt', to: { worker_id: 'R1', model_id: 3000 }, route_kind: 'control' },
      );
    });
  };

  const first = materializeKeys();
  const second = materializeKeys();
  assert.notEqual(first[0].busOutKey, first[1].busOutKey, 'distinct table-qualified refs must never share an adapter key');
  assert.notEqual(first[0].bridgeFunc, first[1].bridgeFunc, 'distinct table-qualified refs must never share a bridge function');
  assert.deepEqual(second, first, 'adapter keys must remain stable across independent Runtime instances');
  return { key: 'table_qualified_adapter_keys_are_stable_and_collision_resistant', status: 'PASS' };
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

  const zeroPayloadModelId = parsePinPayloadRecordEnvelope({
    version: 'v1',
    type: 'pin_payload',
    payload: validPinPayloadV2({ payloadModelId: 0 }),
  });
  assert.equal(zeroPayloadModelId.ok, false, 'server parser must reject payload_model_id=0');
  assert.equal(zeroPayloadModelId.code, 'invalid_payload_model_id');

  const duplicateExtension = parsePinPayloadRecordEnvelope({
    version: 'v1',
    type: 'pin_payload',
    payload: [
      ...validPinPayloadV2(),
      mt('is_need_response', 'bool', true),
      mt('is_need_response', 'bool', false),
    ],
  });
  assert.equal(duplicateExtension.ok, false, 'server parser must reject duplicate Model 0 extension keys');
  assert.equal(duplicateExtension.code, 'invalid_pin_payload_records');

  const nonRootExtension = mt('is_need_response', 'bool', true);
  nonRootExtension.c = 1;
  const nonRootModelZero = parsePinPayloadRecordEnvelope({
    version: 'v1',
    type: 'pin_payload',
    payload: [...validPinPayloadV2(), nonRootExtension],
  });
  assert.equal(nonRootModelZero.ok, false, 'server parser must reject non-root Model 0 envelope records');
  assert.equal(nonRootModelZero.code, 'invalid_pin_payload_records');

  return { key: 'server_parser_rejects_removed_pin_payload_shapes', status: 'PASS' };
}

function test_server_parsers_reject_invalid_bus_route_and_timestamp_metadata() {
  const principalBase = {
    messageRole: 'response',
    topic: 'UIPUT/ws/dam/pic/de/U1/1055/result',
    responseTopic: 'UIPUT/ws/dam/pic/de/U1/1055/result',
    endpointWorkerId: 'U1',
    endpointTableId: 'host',
    endpointModelId: 1055,
    endpointPin: 'result',
  };
  const parsers = [
    {
      name: 'server envelope parser',
      records: validPinPayloadV2(),
      parse: (records) => parsePinPayloadRecordEnvelope({ version: 'v1', type: 'pin_payload', payload: records }),
    },
    {
      name: 'principal runtime parser',
      records: validPinPayloadV2(principalBase),
      parse: (records) => parsePrincipalRuntimePinPayload({ version: 'v1', type: 'pin_payload', payload: records }),
    },
  ];
  const replace = (records, key, patch) => records.map((record) => (
    record.id === 0 && record.p === 0 && record.r === 0 && record.c === 0 && record.k === key
      ? { ...record, ...patch }
      : record
  ));
  const remove = (records, key) => records.filter((record) => !(
    record.id === 0 && record.p === 0 && record.r === 0 && record.c === 0 && record.k === key
  ));

  for (const parser of parsers) {
    const cases = [
      ['missing_bus', remove(parser.records, 'bus'), 'missing_bus'],
      ['invalid_bus_value', replace(parser.records, 'bus', { v: 'other' }), 'invalid_bus'],
      ['invalid_bus_type', replace(parser.records, 'bus', { t: 'json', v: 'control' }), 'invalid_bus'],
      ['missing_route_kind', remove(parser.records, 'route_kind'), 'missing_route_kind'],
      ['invalid_route_kind_value', replace(parser.records, 'route_kind', { v: 'manage' }), 'invalid_route_kind'],
      ['invalid_route_kind_type', replace(parser.records, 'route_kind', { t: 'json', v: 'control' }), 'invalid_route_kind'],
      ['bus_route_kind_mismatch', replace(parser.records, 'bus', { v: 'management' }), 'bus_route_kind_mismatch'],
      ['missing_timestamp', remove(parser.records, 'timestamp'), 'missing_timestamp'],
      ['invalid_timestamp_type', replace(parser.records, 'timestamp', { t: 'str', v: '1700000000430' }), 'invalid_timestamp'],
    ];
    for (const [caseName, records, code] of cases) {
      assert.deepEqual(
        parser.parse(records),
        { ok: false, code },
        `${parser.name} must fail closed for ${caseName}`,
      );
    }
  }

  return { key: 'server_parsers_reject_invalid_bus_route_and_timestamp_metadata', status: 'PASS' };
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

  const zeroPayloadModelId = parsePrincipalRuntimePinPayload({
    version: 'v1',
    type: 'pin_payload',
    payload: validPinPayloadV2({ ...base, payloadModelId: 0 }),
  });
  assert.equal(zeroPayloadModelId.ok, false, 'principal runtime parser must reject payload_model_id=0');
  assert.equal(zeroPayloadModelId.code, 'invalid_payload_model_id');

  const duplicateExtension = parsePrincipalRuntimePinPayload({
    version: 'v1',
    type: 'pin_payload',
    payload: [
      ...validPinPayloadV2(base),
      mt('is_need_response', 'bool', true),
      mt('is_need_response', 'bool', false),
    ],
  });
  assert.equal(duplicateExtension.ok, false, 'principal runtime parser must reject duplicate Model 0 extension keys');
  assert.equal(duplicateExtension.code, 'invalid_pin_payload_records');

  const nonRootExtension = mt('is_need_response', 'bool', true);
  nonRootExtension.c = 1;
  const nonRootModelZero = parsePrincipalRuntimePinPayload({
    version: 'v1',
    type: 'pin_payload',
    payload: [...validPinPayloadV2(base), nonRootExtension],
  });
  assert.equal(nonRootModelZero.ok, false, 'principal runtime parser must reject non-root Model 0 envelope records');
  assert.equal(nonRootModelZero.code, 'invalid_pin_payload_records');

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
  test_mt_bus_send_preserves_safe_envelope_extensions,
  test_mt_bus_send_rejects_duplicate_envelope_extension_declaration,
  test_mt_bus_send_rejects_unsafe_envelope_extension_shapes,
  test_mt_bus_send_rejects_records_outside_declared_payload_model,
  test_positive_model_pin_rejects_malformed_pin_payload_v2,
  test_imported_host_egress_bridge_generates_non_nested_bus_send,
  test_table_qualified_adapter_keys_are_stable_and_collision_resistant,
];

const serverTests = [
  test_server_parser_accepts_pin_payload_v2_non_nested_records,
  test_server_parser_rejects_removed_pin_payload_shapes,
  test_server_parsers_reject_invalid_bus_route_and_timestamp_metadata,
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
