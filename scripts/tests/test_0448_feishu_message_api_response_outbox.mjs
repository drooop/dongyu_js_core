import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cjsRuntime = require('../../packages/worker-base/src/runtime.js');
const esmRuntime = await import('../../packages/worker-base/src/runtime.mjs');

const runtimeVariants = [
  ['cjs', cjsRuntime.ModelTableRuntime],
  ['esm', esmRuntime.ModelTableRuntime],
];

const requestTopic = 'UIPUT/ws/dam/pic/de/R1/3000/resource';
const taskTopic = 'UIPUT/ws/dam/pic/de/R1/3000/add_task';
const responseTopic = 'UIPUT/ws/dam/pic/de/U1/2000/result';

function mt(k, t, v, id = '0', p = 0, r = 0, c = 0) {
  return { id, p, r, c, k, t, v };
}

function label(rt, key) {
  return rt.getModel(0).getCell(0, 0, 0).labels.get(key) || null;
}

function payloadValue(records, key, id = 0) {
  return Array.isArray(records)
    ? records.find((record) => record && record.id === id && record.k === key)?.v
    : undefined;
}

function payloadRecords(records) {
  const payloadModelId = payloadValue(records, 'payload_model_id');
  return Number.isInteger(payloadModelId)
    ? records.filter((record) => record && record.id === payloadModelId)
    : [];
}

function feishuMessage({
  sysMsgType,
  endpointPin = requestTopic,
  responsePin = responseTopic,
  isNeedResponse = true,
  payloadType = 'Data',
  payloadRecords: records = [],
}) {
  return [
    mt('model_type', 'model.subtable', 'Data'),
    mt('model_type', 'model.single', 'Data.Single', '0', 0, 0, 1),
    mt('__mt_payload_kind', 'str', 'pin_payload.v1', '0', 0, 0, 1),
    mt('is_need_response', 'bool', isNeedResponse, '0', 0, 0, 1),
    mt('model_type', 'model.matrix', 'Data', '0', 0, 1, 0),
    mt('model_size', 'model.matrix.size', {
      min_p: 0,
      min_r: 1,
      min_c: 0,
      max_p: 0,
      max_r: 1,
      max_c: 2,
    }, '0', 0, 1, 0),
    mt('route_kind', 'str', 'control', '0', 0, 1, 0),
    mt('origin_pin', 'str', responseTopic, '0', 0, 1, 0),
    mt('endpoint_pin', 'str', endpointPin, '0', 0, 1, 0),
    ...(isNeedResponse ? [mt('response_pin', 'str', responsePin, '0', 0, 1, 0)] : []),
    mt('model_type', 'model.single', 'Data.Single', '0', 0, 1, 1),
    mt('message_server', 'str', 'local', '0', 0, 1, 1),
    mt('between', 'str', 'DEM_V1N', '0', 0, 1, 1),
    mt('model_type', 'model.subtableconnection', 1, '0', 0, 2, 0),
    mt('model_type', 'model.subtable', payloadType, '0.1'),
    mt('model_name', 'model.name', 'payload', '0.1'),
    mt('sys_msg_type', 'str', sysMsgType, '0.1'),
    ...records,
  ];
}

function dispatch(rt, message) {
  return rt.addLabel(rt.getModel(0), 0, 0, 0, {
    k: 'in3',
    t: 'pin.bus.cb.in',
    v: message,
  });
}

function resourceRows() {
  return [
    mt('type', 'str', 'UI', '0.1', 0, 0, 1),
    mt('resource', 'list', ['UI.app1'], '0.1', 0, 0, 1),
  ];
}

function taskPayloadRecords() {
  return [
    mt('model_type', 'model.single', 'Data.Single', '0.1', 0, 0, 1),
    mt('title', 'str', '任务标题', '0.1', 0, 0, 1),
    mt('body', 'str', '任务内容', '0.1', 0, 0, 1),
    mt('publisher', 'str', '任务发布者', '0.1', 0, 0, 1),
    mt('publish_time', 'str', '任务发布时间', '0.1', 0, 0, 1),
  ];
}

function responsePacket(rt) {
  const out = label(rt, 'feishu_message_api_response_out');
  assert.equal(out?.t, 'pin.bus.cb.out', 'response outbox must be a control bus out label');
  const packet = rt._pinBusOutValueToExternalPayload(out.v);
  assert.equal(packet?.type, 'pin_payload', 'response outbox must parse as formal pin_payload packet');
  return packet;
}

async function test_resource_response_outbox_uses_response_topic() {
  for (const [name, Runtime] of runtimeVariants) {
    const rt = new Runtime();
    const result = dispatch(rt, feishuMessage({
      sysMsgType: 'resource.report',
      endpointPin: requestTopic,
      responsePin: responseTopic,
      payloadRecords: resourceRows(),
    }));
    assert.equal(result.applied, true, `${name}: resource.report must be accepted`);
    const packet = responsePacket(rt);
    assert.equal(payloadValue(packet.payload, 'message_role'), 'response', `${name}: response role`);
    assert.equal(payloadValue(packet.payload, 'topic'), responseTopic, `${name}: response topic`);
    assert.equal(payloadValue(packet.payload, 'response_topic'), responseTopic, `${name}: response_topic`);
    assert.equal(payloadValue(packet.payload, 'endpoint_worker_id'), 'U1', `${name}: response endpoint worker`);
    assert.equal(payloadValue(packet.payload, 'origin_worker_id'), 'R1', `${name}: response origin worker`);
    assert.equal(payloadValue(packet.payload, 'reply_target_worker_id'), 'U1', `${name}: reply target worker`);
    assert.equal(payloadRecords(packet.payload).find((record) => record.k === 'sys_msg_type')?.v, 'resource.report', `${name}: response payload sys_msg_type`);
    assert.equal(payloadRecords(packet.payload).find((record) => record.k === 'family')?.v, 'resource', `${name}: response payload family`);
    assert.notEqual(payloadValue(packet.payload, 'topic'), requestTopic, `${name}: response must not use request topic`);
  }
}

async function test_task_add_response_outbox_contains_task_id() {
  for (const [name, Runtime] of runtimeVariants) {
    const rt = new Runtime();
    const result = dispatch(rt, feishuMessage({
      sysMsgType: 'task_data',
      endpointPin: taskTopic,
      responsePin: responseTopic,
      payloadRecords: taskPayloadRecords(),
    }));
    assert.equal(result.applied, true, `${name}: task add_task must be accepted`);
    const packet = responsePacket(rt);
    const handlerResult = payloadRecords(packet.payload).find((record) => record.k === 'handler_result')?.v;
    assert.equal(handlerResult?.task_id, 1, `${name}: response handler result task id`);
    assert.equal(handlerResult?.action, 'add_task', `${name}: response handler result action`);
  }
}

async function test_no_response_flag_does_not_write_response_outbox() {
  for (const [name, Runtime] of runtimeVariants) {
    const rt = new Runtime();
    const result = dispatch(rt, feishuMessage({
      sysMsgType: 'resource.report',
      endpointPin: requestTopic,
      isNeedResponse: false,
      payloadRecords: resourceRows(),
    }));
    assert.equal(result.applied, true, `${name}: no-response resource.report must still be accepted`);
    assert.equal(label(rt, 'feishu_message_api_response_out'), null, `${name}: no response outbox`);
    assert.equal(label(rt, 'feishu_message_api_response_last_result')?.v?.status, 'skipped', `${name}: skipped response result`);
    assert.equal(label(rt, 'feishu_message_api_response_last_result')?.v?.reason, 'response_not_required', `${name}: skipped reason`);
  }
}

async function test_invalid_response_pin_never_falls_back_to_request_topic() {
  for (const [name, Runtime] of runtimeVariants) {
    const rt = new Runtime();
    const result = dispatch(rt, feishuMessage({
      sysMsgType: 'resource.report',
      endpointPin: requestTopic,
      responsePin: 'UIPUT/ws/dam/pic/de/U1/0.2000/result',
      payloadRecords: resourceRows(),
    }));
    assert.equal(result.applied, true, `${name}: invalid-response-pin resource.report remains accepted`);
    assert.equal(label(rt, 'feishu_message_api_response_out'), null, `${name}: invalid response pin must not write outbox`);
    assert.equal(label(rt, 'feishu_message_api_response_last_result')?.v?.status, 'skipped', `${name}: invalid response pin skip status`);
    assert.equal(label(rt, 'feishu_message_api_response_last_result')?.v?.reason, 'invalid_response_pin', `${name}: invalid response pin skip reason`);
  }
}

const tests = [
  test_resource_response_outbox_uses_response_topic,
  test_task_add_response_outbox_contains_task_id,
  test_no_response_flag_does_not_write_response_outbox,
  test_invalid_response_pin_never_falls_back_to_request_topic,
];

let failed = 0;
for (const test of tests) {
  try {
    await test();
    console.log(`[PASS] ${test.name}`);
  } catch (error) {
    failed += 1;
    console.error(`[FAIL] ${test.name}`);
    console.error(error && error.stack ? error.stack : error);
  }
}

if (failed > 0) {
  console.error(`${failed} failed, ${tests.length - failed} passed out of ${tests.length}`);
  process.exit(1);
}

console.log(`${tests.length} passed, 0 failed out of ${tests.length}`);
