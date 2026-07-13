#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  actorCellLabels,
  loadSsotDeActor,
} from '../lib/ssot_de_actor_test_helpers.mjs';
import {
  DEFAULT_TOPIC_BASE,
  externalPacket,
  mt,
  pinPayloadV2Records,
} from '../lib/pin_payload_v2_test_helpers.mjs';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const model3200Patch = 'deploy/sys-v1ns/remote-worker/patches/15_model3200_feishu_message_api.json';
const model3200PatchPath = resolve(repoRoot, model3200Patch);
const model3200Id = 3200;
const publicInputPins = [
  'resource',
  'data',
  'ui',
  'add_task',
  'add_task_return',
  'edit_task',
  'delete_task',
  'receive_task',
  'finish_task',
  'archive_task',
];

function recordAt(k, t, v, { id = 0, p = 0, r = 0, c = 0 } = {}) {
  return { id, p, r, c, k, t, v };
}

function model3200Request({
  pin = 'resource',
  sysMsgType = 'resource.report',
  payloadType = 'Data',
  routeKind = 'control',
  bus = routeKind,
  isNeedResponse = true,
  messageServer,
  between,
  sendUser,
  receiveUser,
  omit = [],
  payloadRecords = [recordAt('type', 'str', 'UI', { p: 1 }), recordAt('resource', 'list', ['UI.app1'], { p: 1 })],
} = {}) {
  const topic = `${DEFAULT_TOPIC_BASE}/R1/${model3200Id}/${pin}`;
  const responseTopic = `${DEFAULT_TOPIC_BASE}/U1/1/result`;
  const extraRecords = [
    mt('is_need_response', 'bool', isNeedResponse),
    ...(messageServer === undefined ? [] : [mt('message_server', 'str', messageServer)]),
    ...(between === undefined ? [] : [mt('between', 'str', between)]),
    ...(sendUser === undefined ? [] : [mt('send_user', 'str', sendUser)]),
    ...(receiveUser === undefined ? [] : [mt('receive_user', 'str', receiveUser)]),
  ];
  let records = pinPayloadV2Records({
    opId: `0457_model3200_${pin}_${sysMsgType.replaceAll('.', '_')}`,
    endpointWorkerId: 'R1',
    endpointTableId: 'host',
    endpointModelId: model3200Id,
    endpointPin: pin,
    topic,
    responseTopic,
    routeKind,
    originWorkerId: 'U1',
    originTableId: 'app:0457:feishu-contract',
    originModelId: 1,
    originPin: 'send',
    replyTargetWorkerId: 'U1',
    replyTargetTableId: 'app:0457:feishu-contract',
    replyTargetModelId: 1,
    replyTargetPin: 'result',
    payloadModelId: 1,
    payloadRecords: [
      recordAt('model_type', 'model.table', payloadType),
      recordAt('sys_msg_type', 'str', sysMsgType),
      ...payloadRecords,
    ],
    extraRecords,
    timestamp: 1700000003200,
  });
  records = records.map((record) => record.k === 'bus' ? { ...record, v: bus } : record);
  const omitted = new Set(omit);
  return records.filter((record) => !omitted.has(record.k));
}

function replaceRecord(records, key, patchRecord) {
  return records.map((record) => record.k === key ? { ...record, ...patchRecord } : record);
}

function rootValue(records, key) {
  return records.find((record) => record.id === 0 && record.p === 0 && record.r === 0 && record.c === 0 && record.k === key)?.v;
}

function positiveModelSnapshot(runtime, modelId) {
  return runtime.snapshot().models[String(modelId)] ?? null;
}

async function settlePropagation() {
  for (let index = 0; index < 12; index += 1) {
    await new Promise((resolvePromise) => setImmediate(resolvePromise));
  }
}

function test_model3200_patch_is_versioned() {
  assert.equal(existsSync(model3200PatchPath), true, `${model3200Patch} must be committed`);
}

function test_model3200_declares_exact_public_actor_surface() {
  const r1 = loadSsotDeActor('r1');
  const model = r1.runtime.getModel(model3200Id);
  assert.ok(model, 'R1 must load positive Model 3200 from its versioned patches');
  const root = actorCellLabels(r1, model3200Id);
  assert.equal(root.model_type?.type, 'model.submt', 'Model 3200 root form');
  assert.equal(root.model_type?.value, 'Flow', 'Model 3200 registered business type');
  assert.deepEqual(
    Object.values(root).filter((entry) => entry.type === 'pin.in').map((entry) => entry.key).sort(),
    [...publicInputPins].sort(),
    'Model 3200 root input surface must be exact',
  );
  assert.deepEqual(
    Object.values(root).filter((entry) => entry.type === 'pin.out').map((entry) => entry.key).sort(),
    ['result'],
    'Model 3200 root output surface must contain only generic result',
  );
  for (const pin of publicInputPins) {
    assert.equal(root[pin]?.type, 'pin.in', `Model 3200 public ${pin} must be pin.in`);
  }
  assert.equal(root.result?.type, 'pin.out', 'Model 3200 public result must be pin.out');
  assert.notEqual(root.add_task_return?.type, 'pin.out', 'F-08 dedicated add_task_return output must not be implemented');

  const mount = r1.mounts.find((entry) => entry.child_model_id === model3200Id);
  assert.ok(mount, 'Model 3200 must be mounted from R1 Model 0');
  assert.equal(mount.source_file, model3200Patch, 'Model 3200 mount must come from the versioned actor patch');
  const parent = actorCellLabels(r1, 0, mount.p, mount.r, mount.c);
  assert.deepEqual(
    Object.values(parent).filter((entry) => entry.type === 'pin.in').map((entry) => entry.key).sort(),
    [...publicInputPins].sort(),
    'Model 3200 parent connection input surface must be exact',
  );
  assert.deepEqual(
    Object.values(parent).filter((entry) => entry.type === 'pin.out').map((entry) => entry.key).sort(),
    ['result'],
    'Model 3200 parent connection output surface must contain only generic result',
  );
  for (const pin of publicInputPins) {
    assert.equal(parent[pin]?.type, 'pin.in', `Model 3200 parent connection ${pin} must be pin.in`);
  }
  assert.equal(parent.result?.type, 'pin.out', 'Model 3200 parent connection result must be pin.out');
}

function test_model3200_routes_every_public_request_through_dispatcher() {
  const r1 = loadSsotDeActor('r1');
  const routeTable = actorCellLabels(r1, -10).r1_endpoint_route_table?.value;
  const subscriptions = actorCellLabels(r1, -10).remote_subscriptions?.value;
  assert.equal(Array.isArray(routeTable), true, 'R1 route table must be declared');
  assert.equal(Array.isArray(subscriptions), true, 'R1 subscriptions must be declared');
  const mount = r1.mounts.find((entry) => entry.child_model_id === model3200Id);
  assert.ok(mount, 'Model 3200 mount must exist before route validation');
  const model0Routes = actorCellLabels(r1, 0).r1_dispatch_routes?.value;
  const resultRoutes = actorCellLabels(r1, 0).remote_result_routes?.value;

  for (const pin of publicInputPins) {
    const outputPin = `r1_dispatch_${model3200Id}_${pin}`;
    assert.equal(
      routeTable.some((entry) => entry?.model_id === model3200Id && entry.pin === pin && entry.output_pin === outputPin),
      true,
      `${pin}: Model -10 route-table entry`,
    );
    assert.equal(subscriptions.includes(`${DEFAULT_TOPIC_BASE}/R1/${model3200Id}/${pin}`), true, `${pin}: MQTT subscription`);
    assert.equal(actorCellLabels(r1, -10)[outputPin]?.type, 'pin.out', `${pin}: dispatcher output pin`);
    assert.equal(
      model0Routes.some((route) => (
        JSON.stringify(route?.from) === JSON.stringify([1, 0, 1, outputPin])
        && route.to?.some((target) => JSON.stringify(target) === JSON.stringify([mount.p, mount.r, mount.c, pin]))
      )),
      true,
      `${pin}: dispatcher parent Cell must route to Model 3200 parent connection`,
    );
  }
  assert.equal(
    resultRoutes.some((route) => (
      JSON.stringify(route?.from) === JSON.stringify([mount.p, mount.r, mount.c, 'result'])
      && route.to?.some((target) => JSON.stringify(target) === JSON.stringify([0, 0, 0, 'remote_result_bus']))
    )),
    true,
    'Model 3200 result must return through R1 Model 0 control-bus output',
  );
}

function test_generic_v2_requires_exact_transport_envelope() {
  const { runtime } = loadSsotDeActor('r1');
  const valid = model3200Request();
  assert.equal(runtime._validatePinPayloadRecords(valid).ok, true, 'complete Model 3200 transport envelope must pass generic v2');
  const invalidCases = [
    ['missing_bus', valid.filter((record) => record.k !== 'bus'), 'missing_bus'],
    ['missing_route_kind', valid.filter((record) => record.k !== 'route_kind'), 'missing_route_kind'],
    ['bus_route_kind_mismatch', replaceRecord(valid, 'bus', { v: 'management' }), 'bus_route_kind_mismatch'],
    ['missing_timestamp', valid.filter((record) => record.k !== 'timestamp'), 'missing_timestamp'],
    ['invalid_timestamp', replaceRecord(valid, 'timestamp', { t: 'str', v: '1700000003200' }), 'invalid_timestamp'],
    ['removed_manage_route', replaceRecord(valid, 'route_kind', { v: 'manage' }), 'invalid_route_kind'],
    ['request_topic_reuse', replaceRecord(valid, 'response_topic', { v: `${DEFAULT_TOPIC_BASE}/R1/${model3200Id}/resource` }), 'response_topic_mismatch'],
    ['full_topic_endpoint_pin', replaceRecord(valid, 'endpoint_pin', { v: `${DEFAULT_TOPIC_BASE}/R1/${model3200Id}/resource` }), 'invalid_pin_payload_records'],
    ['legacy_response_pin', [...valid, mt('response_pin', 'str', `${DEFAULT_TOPIC_BASE}/U1/1/result`)], 'legacy_pin_payload_metadata_removed'],
    ['invalid_payload_model_id', valid.map((record) => {
      if (record.k === 'payload_model_id') return { ...record, v: 0 };
      return record.id === 1 ? { ...record, id: 0 } : record;
    }), 'invalid_payload_model_id'],
  ];
  for (const [name, records, code] of invalidCases) {
    const parsed = runtime._validatePinPayloadRecords(records);
    assert.equal(parsed.ok, false, `${name}: exact v2 envelope must reject`);
    assert.equal(parsed.code, code, `${name}: exact rejection code`);
  }

  assert.throws(
    () => runtime._buildPinPayloadValue({
      opId: '0457_builder_bus_route_conflict',
      payload: [recordAt('value', 'str', 'conflict', { id: 1 })],
      payloadModelId: 1,
      endpoint: { worker_id: 'R1', table_id: 'host', model_id: 100, pin: 'submit' },
      origin: { worker_id: 'U1', table_id: 'host', model_id: 1, pin: 'send' },
      replyTarget: { worker_id: 'U1', table_id: 'host', model_id: 1, pin: 'result' },
      topic: `${DEFAULT_TOPIC_BASE}/R1/100/submit`,
      responseTopic: `${DEFAULT_TOPIC_BASE}/U1/1/result`,
      routeKind: 'management',
      bus: 'control',
    }),
    /bus_route_kind_mismatch/,
    'canonical emitter must reject conflicting bus and route_kind instead of emitting an invalid packet',
  );
}

async function test_model3200_rejects_invalid_feishu_extension_and_business_root() {
  const invalidCases = [
    ['missing_is_need_response', model3200Request({ omit: ['is_need_response'] }), 'missing_is_need_response'],
    ['invalid_message_server', model3200Request({ messageServer: 'remote' }), 'invalid_message_server'],
    ['invalid_between', model3200Request({ between: 'DEM_DEM' }), 'invalid_between'],
    ['management_missing_send_user', model3200Request({ routeKind: 'management', receiveUser: 'R1' }), 'missing_send_user'],
    ['management_missing_receive_user', model3200Request({ routeKind: 'management', sendUser: 'U1' }), 'missing_receive_user'],
    ['control_invalid_send_user_type', replaceRecord(model3200Request({ sendUser: 'U1' }), 'send_user', { t: 'int', v: 7 }), 'invalid_send_user'],
    ['control_blank_send_user', model3200Request({ sendUser: '' }), 'invalid_send_user'],
    ['control_invalid_receive_user_type', replaceRecord(model3200Request({ receiveUser: 'R1' }), 'receive_user', { t: 'int', v: 7 }), 'invalid_receive_user'],
    ['control_blank_receive_user', model3200Request({ receiveUser: '' }), 'invalid_receive_user'],
    ['missing_business_model_type', model3200Request({ omit: ['model_type'] }), 'missing_business_model_type'],
    ['invalid_business_model_type', model3200Request({ payloadType: 'Code.JS' }), 'invalid_business_model_type'],
    ['missing_sys_msg_type', model3200Request({ omit: ['sys_msg_type'] }), 'missing_sys_msg_type'],
    ['unknown_sys_msg_type', model3200Request({ sysMsgType: 'resource.unknown' }), 'unknown_sys_msg_type'],
  ];
  for (const [name, records, code] of invalidCases) {
    const r1 = loadSsotDeActor('r1');
    const model = r1.runtime.getModel(model3200Id);
    assert.ok(model, `${name}: Model 3200 must be loaded`);
    r1.runtime.setRuntimeMode('edit');
    r1.runtime.setRuntimeMode('running');
    const resultBefore = model.getCell(0, 0, 0).labels.get('result')?.v ?? null;
    const handled = r1.runtime.mqttIncoming(`${DEFAULT_TOPIC_BASE}/R1/${model3200Id}/resource`, externalPacket(records));
    assert.equal(handled, true, `${name}: generic transport should deliver to the Model 3200 actor`);
    await settlePropagation();
    const lastResult = model.getCell(0, 0, 0).labels.get('feishu_message_api_last_result');
    assert.equal(lastResult?.t, 'json', `${name}: actor rejection must be ModelTable-visible`);
    assert.equal(lastResult?.v?.status, 'rejected', `${name}: actor rejection status`);
    assert.equal(lastResult?.v?.code, code, `${name}: actor rejection code`);
    assert.deepEqual(model.getCell(0, 0, 0).labels.get('result')?.v ?? null, resultBefore, `${name}: invalid request must not emit result`);
  }
}

async function test_model3200_accepts_valid_control_and_management_schema() {
  const validCases = [
    {
      name: 'control_local_dem_v1n',
      records: model3200Request({
        messageServer: 'local',
        between: 'DEM_V1N',
      }),
      routeKind: 'control',
    },
    {
      name: 'management_global_wsm_dem',
      records: model3200Request({
        routeKind: 'management',
        messageServer: 'global',
        between: 'WSM_DEM',
        sendUser: 'U1',
        receiveUser: 'R1',
      }),
      routeKind: 'management',
    },
  ];
  for (const testCase of validCases) {
    const r1 = loadSsotDeActor('r1');
    const model = r1.runtime.getModel(model3200Id);
    assert.ok(model, `${testCase.name}: Model 3200 must be loaded`);
    r1.runtime.setRuntimeMode('edit');
    r1.runtime.setRuntimeMode('running');
    const requestTopic = `${DEFAULT_TOPIC_BASE}/R1/${model3200Id}/resource`;
    const handled = r1.runtime.mqttIncoming(requestTopic, externalPacket(testCase.records));
    assert.equal(handled, true, `${testCase.name}: generic transport must accept`);
    await settlePropagation();
    const root = model.getCell(0, 0, 0);
    const lastResult = root.labels.get('feishu_message_api_last_result');
    assert.equal(lastResult?.t, 'json', `${testCase.name}: accepted request must be visible`);
    assert.equal(lastResult?.v?.status, 'accepted', `${testCase.name}: accepted schema status`);
    const result = root.labels.get('result');
    assert.equal(result?.t, 'pin.out', `${testCase.name}: valid request must return through generic result`);
    assert.equal(result.v.find((record) => record.id === 0 && record.k === '__mt_payload_kind')?.v, 'pin_payload.v2');
    assert.equal(result.v.find((record) => record.id === 0 && record.k === 'message_role')?.v, 'response');
    assert.equal(result.v.find((record) => record.id === 0 && record.k === 'topic')?.v, `${DEFAULT_TOPIC_BASE}/U1/1/result`);
    assert.equal(result.v.find((record) => record.id === 0 && record.k === 'response_topic')?.v, `${DEFAULT_TOPIC_BASE}/U1/1/result`);
    assert.equal(result.v.find((record) => record.id === 0 && record.k === 'endpoint_worker_id')?.v, 'U1');
    assert.equal(result.v.find((record) => record.id === 0 && record.k === 'endpoint_table_id')?.v, 'host');
    assert.equal(result.v.find((record) => record.id === 0 && record.k === 'endpoint_model_id')?.v, 1);
    assert.equal(result.v.find((record) => record.id === 0 && record.k === 'endpoint_pin')?.v, 'result');
    assert.equal(result.v.find((record) => record.id === 0 && record.k === 'origin_worker_id')?.v, 'R1');
    assert.equal(result.v.find((record) => record.id === 0 && record.k === 'origin_table_id')?.v, 'host');
    assert.equal(result.v.find((record) => record.id === 0 && record.k === 'origin_model_id')?.v, model3200Id);
    assert.equal(result.v.find((record) => record.id === 0 && record.k === 'origin_pin')?.v, 'resource');
    assert.equal(result.v.find((record) => record.id === 0 && record.k === 'reply_target_worker_id')?.v, 'U1');
    assert.equal(result.v.find((record) => record.id === 0 && record.k === 'reply_target_table_id')?.v, 'app:0457:feishu-contract');
    assert.equal(result.v.find((record) => record.id === 0 && record.k === 'reply_target_model_id')?.v, 1);
    assert.equal(result.v.find((record) => record.id === 0 && record.k === 'reply_target_pin')?.v, 'result');
    assert.equal(result.v.find((record) => record.id === 0 && record.k === 'bus')?.v, testCase.routeKind);
    assert.equal(result.v.find((record) => record.id === 0 && record.k === 'route_kind')?.v, testCase.routeKind);

    const receiver = new r1.runtime.constructor();
    const receiverRoot = receiver.getModel(0);
    receiver.addLabel(receiverRoot, 0, 0, 0, { k: 'mqtt_topic_mode', t: 'str', v: 'uiput_mm_v1' });
    receiver.addLabel(receiverRoot, 0, 0, 0, { k: 'mqtt_topic_base', t: 'str', v: DEFAULT_TOPIC_BASE });
    receiver.addLabel(receiverRoot, 0, 0, 0, { k: 'mqtt_worker_id', t: 'str', v: 'U1' });
    receiver.addLabel(receiverRoot, 0, 0, 0, { k: 'mqtt_payload_mode', t: 'str', v: 'pin_payload_v1' });
    const target = receiver.createModel({
      table_id: 'app:0457:feishu-contract',
      id: 1,
      name: `${testCase.name} reply target`,
      type: 'app',
    });
    receiver.addLabel(target, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'Data' });
    receiver.setRuntimeMode('edit');
    receiver.setRuntimeMode('running');
    assert.equal(
      receiver.mqttIncoming(rootValue(result.v, 'topic'), externalPacket(result.v)),
      true,
      `${testCase.name}: real Model 3200 response must materialize by its table-qualified reply target`,
    );
    assert.equal(target.getCell(0, 0, 0).labels.get('status')?.v, 'accepted', `${testCase.name}: response status materialized`);
    assert.equal(target.getCell(0, 0, 0).labels.get('handler_result')?.v?.status, 'accepted', `${testCase.name}: handler result materialized`);
  }
}

async function test_normal_v2_request_does_not_require_feishu_only_fields() {
  const r1 = loadSsotDeActor('r1');
  r1.runtime.setRuntimeMode('edit');
  r1.runtime.setRuntimeMode('running');
  const records = pinPayloadV2Records({
    opId: '0457_plain_non_feishu_request',
    endpointWorkerId: 'R1',
    endpointModelId: 100,
    endpointPin: 'submit',
    originWorkerId: 'U1',
    originModelId: 1,
    originPin: 'send',
    replyTargetWorkerId: 'U1',
    replyTargetModelId: 1,
    replyTargetPin: 'result',
    payloadRecords: [recordAt('input_value', 'str', 'plain-v2-without-feishu-fields')],
  });
  assert.equal(records.some((record) => record.k === 'is_need_response'), false);
  assert.equal(records.some((record) => record.k === 'sys_msg_type'), false);
  assert.equal(records.some((record) => record.k === 'message_server'), false);
  assert.equal(records.some((record) => record.k === 'between'), false);
  const handled = r1.runtime.mqttIncoming(`${DEFAULT_TOPIC_BASE}/R1/100/submit`, externalPacket(records));
  assert.equal(handled, true, 'ordinary v2 request must not require Feishu-only fields');
  await settlePropagation();
  assert.equal(r1.runtime.getCell(r1.runtime.getModel(100), 0, 0, 0).labels.get('status')?.v, 'processed');
}

async function test_non3200_sys_msg_type_remains_normal_transport() {
  const r1 = loadSsotDeActor('r1');
  r1.runtime.setRuntimeMode('edit');
  r1.runtime.setRuntimeMode('running');
  const model3200Before = positiveModelSnapshot(r1.runtime, model3200Id);
  const records = pinPayloadV2Records({
    opId: '0457_non3200_sys_msg_type',
    endpointWorkerId: 'R1',
    endpointModelId: 100,
    endpointPin: 'submit',
    originWorkerId: 'U1',
    originModelId: 1,
    originPin: 'send',
    replyTargetWorkerId: 'U1',
    replyTargetModelId: 1,
    replyTargetPin: 'result',
    payloadRecords: [
      recordAt('model_type', 'model.table', 'Data.RemoteSubmit'),
      recordAt('sys_msg_type', 'str', 'resource.report'),
      recordAt('input_value', 'str', 'normal-model100-request'),
    ],
  });
  const handled = r1.runtime.mqttIncoming(`${DEFAULT_TOPIC_BASE}/R1/100/submit`, externalPacket(records));
  assert.equal(handled, true, 'non-3200 packet must remain a normal v2 request');
  await settlePropagation();
  assert.equal(r1.runtime.getCell(r1.runtime.getModel(100), 0, 0, 0).labels.get('status')?.v, 'processed');
  assert.deepEqual(positiveModelSnapshot(r1.runtime, model3200Id), model3200Before, 'sys_msg_type outside Model 3200 must not trigger Feishu state');
}

const tests = [
  test_model3200_patch_is_versioned,
  test_model3200_declares_exact_public_actor_surface,
  test_model3200_routes_every_public_request_through_dispatcher,
  test_generic_v2_requires_exact_transport_envelope,
  test_model3200_rejects_invalid_feishu_extension_and_business_root,
  test_model3200_accepts_valid_control_and_management_schema,
  test_normal_v2_request_does_not_require_feishu_only_fields,
  test_non3200_sys_msg_type_remains_normal_transport,
];

let failed = 0;
for (const test of tests) {
  try {
    await test();
    console.log(`[PASS] ${test.name}`);
  } catch (error) {
    failed += 1;
    console.error(`[FAIL] ${test.name}`);
    console.error(error && error.message ? error.message : error);
  }
}

if (failed > 0) {
  console.error(`${failed} failed, ${tests.length - failed} passed out of ${tests.length}`);
  process.exit(1);
}

console.log(`${tests.length} passed, 0 failed out of ${tests.length}`);
