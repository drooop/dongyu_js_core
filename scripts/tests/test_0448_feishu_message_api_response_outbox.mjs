import assert from 'node:assert/strict';
import { loadSsotDeActor } from '../lib/ssot_de_actor_test_helpers.mjs';
import {
  DEFAULT_TOPIC_BASE,
  externalPacket,
  mt,
  payloadRecords,
  payloadValue,
  pinPayloadV2Records,
} from '../lib/pin_payload_v2_test_helpers.mjs';

const model3200Id = 3200;
const responseModelId = 21;
const responseTopic = `${DEFAULT_TOPIC_BASE}/U1/${responseModelId}/result`;
let requestSequence = 0;

function recordAt(k, t, v, { p = 0, r = 0, c = 0 } = {}) {
  return { id: 1, p, r, c, k, t, v };
}

function resourceRows() {
  return [
    recordAt('type', 'str', 'UI', { c: 1 }),
    recordAt('resource', 'list', ['UI.app1'], { c: 1 }),
  ];
}

function taskRows() {
  return [
    recordAt('model_type', 'model.single', 'Data.Single', { c: 1 }),
    recordAt('title', 'str', '任务标题', { c: 1 }),
    recordAt('body', 'str', '任务内容', { c: 1 }),
    recordAt('publisher', 'str', '任务发布者', { c: 1 }),
    recordAt('publish_time', 'str', '任务发布时间', { c: 1 }),
  ];
}

function model3200Request({
  pin,
  sysMsgType,
  payloadRecords: businessRecords,
  isNeedResponse = true,
  actualResponseTopic = responseTopic,
  routeKind = 'control',
  sendUser = '',
  receiveUser = '',
} = {}) {
  requestSequence += 1;
  const requestTopic = `${DEFAULT_TOPIC_BASE}/R1/${model3200Id}/${pin}`;
  return pinPayloadV2Records({
    opId: `0457_response_${pin}_${requestSequence}`,
    endpointWorkerId: 'R1',
    endpointTableId: 'host',
    endpointModelId: model3200Id,
    endpointPin: pin,
    topic: requestTopic,
    responseTopic: actualResponseTopic,
    routeKind,
    originWorkerId: 'U1',
    originTableId: 'app:0457:response-contract',
    originModelId: responseModelId,
    originPin: 'send',
    replyTargetWorkerId: 'U1',
    replyTargetTableId: 'app:0457:response-contract',
    replyTargetModelId: responseModelId,
    replyTargetPin: 'result',
    payloadModelId: 7,
    payloadRecords: [
      recordAt('model_type', 'model.table', 'Data'),
      recordAt('sys_msg_type', 'str', sysMsgType),
      ...businessRecords,
    ],
    extraRecords: [
      mt('is_need_response', 'bool', isNeedResponse),
      mt('message_server', 'str', 'local'),
      mt('between', 'str', 'DEM_V1N'),
      ...(sendUser ? [mt('send_user', 'str', sendUser)] : []),
      ...(receiveUser ? [mt('receive_user', 'str', receiveUser)] : []),
    ],
    timestamp: 1700000004800 + requestSequence,
  });
}

function setupActor() {
  const actor = loadSsotDeActor('r1');
  assert.equal(actor.loadRejected, 0, 'R1 patches must load without rejection');
  actor.runtime.setRuntimeMode('edit');
  const mqttStart = actor.runtime.startMqttLoop({
    transport: 'mock',
    host: 'localhost',
    port: 1883,
    client_id: '0457-response-r1',
    topic_mode: 'uiput_mm_v1',
    topic_base: DEFAULT_TOPIC_BASE,
    worker_id: 'R1',
    payload_mode: 'pin_payload_v1',
  });
  assert.equal(mqttStart.status, 'running', 'R1 mock MQTT client must start');
  actor.runtime.setRuntimeMode('running');
  return actor;
}

async function settlePropagation() {
  for (let index = 0; index < 12; index += 1) {
    await new Promise((resolvePromise) => setImmediate(resolvePromise));
  }
}

async function dispatch(actor, records, pin) {
  const handled = actor.runtime.mqttIncoming(
    `${DEFAULT_TOPIC_BASE}/R1/${model3200Id}/${pin}`,
    externalPacket(records),
  );
  await settlePropagation();
  return handled;
}

function model3200Root(actor) {
  return actor.runtime.getModel(model3200Id).getCell(0, 0, 0);
}

function model0Root(actor) {
  return actor.runtime.getModel(0).getCell(0, 0, 0);
}

function resultRecords(actor) {
  const result = model3200Root(actor).labels.get('result');
  assert.equal(result?.t, 'pin.out', 'Model 3200 generic result must be pin.out');
  assert.equal(Array.isArray(result.v), true, 'Model 3200 generic result must carry v2 records');
  return result.v;
}

function mqttPublishes(actor) {
  return actor.runtime.mqttTrace.list().filter((entry) => entry.type === 'publish');
}

function positiveModelSnapshot(actor) {
  return actor.runtime.snapshot().models[String(model3200Id)] ?? null;
}

async function test_resource_response_uses_generic_v2_result_and_response_topic() {
  const actor = setupActor();
  const request = model3200Request({ pin: 'resource', sysMsgType: 'resource.report', payloadRecords: resourceRows() });
  const requestId = payloadValue(request, 'op_id');
  assert.equal(await dispatch(actor, request, 'resource'), true, 'resource request transport');
  const result = resultRecords(actor);
  const handlerResult = payloadValue(result, 'handler_result', 1);
  assert.equal(payloadValue(result, '__mt_payload_kind'), 'pin_payload.v2', 'response payload kind');
  assert.equal(payloadValue(result, '__mt_request_id'), requestId, 'response preserves __mt_request_id');
  assert.equal(payloadValue(result, 'op_id'), requestId, 'response preserves op_id');
  assert.equal(payloadValue(result, 'message_role'), 'response', 'response role');
  assert.equal(payloadValue(result, 'topic'), responseTopic, 'response topic');
  assert.equal(payloadValue(result, 'response_topic'), responseTopic, 'response_topic');
  assert.equal(payloadValue(result, 'endpoint_worker_id'), 'U1', 'response endpoint worker');
  assert.equal(payloadValue(result, 'endpoint_table_id'), 'host', 'response endpoint table');
  assert.equal(payloadValue(result, 'endpoint_model_id'), responseModelId, 'response endpoint model');
  assert.equal(payloadValue(result, 'endpoint_pin'), 'result', 'response endpoint pin');
  assert.equal(payloadValue(result, 'origin_worker_id'), 'R1', 'response origin worker');
  assert.equal(payloadValue(result, 'origin_model_id'), model3200Id, 'response origin model');
  assert.equal(payloadValue(result, 'origin_pin'), 'resource', 'response origin pin');
  assert.equal(payloadValue(result, 'reply_target_worker_id'), 'U1', 'reply target worker');
  assert.equal(payloadValue(result, 'reply_target_table_id'), 'app:0457:response-contract', 'table-qualified reply target');
  assert.equal(payloadValue(result, 'reply_target_model_id'), responseModelId, 'reply target model');
  assert.equal(payloadValue(result, 'reply_target_pin'), 'result', 'reply target pin');
  assert.equal(payloadRecords(result).find((record) => record.k === 'family')?.v, 'resource', 'response family');
  assert.equal(payloadRecords(result).find((record) => record.k === 'action')?.v, 'report', 'response action');
  assert.equal(handlerResult?.action, 'report', 'response contains real resource handler action');
  assert.deepEqual(handlerResult?.catalog, { UI: ['UI.app1'] }, 'response contains real resource catalog');
  assert.deepEqual(model0Root(actor).labels.get('remote_result_bus')?.v, result, 'Model 0 generic return bus receives Model 3200 result');
  assert.equal(mqttPublishes(actor).length, 1, 'generic return bus publishes exactly once');
  assert.equal(mqttPublishes(actor)[0].payload.topic, responseTopic, 'generic publish uses response topic');
  assert.deepEqual(mqttPublishes(actor)[0].payload.payload.payload, result, 'published packet carries Model 3200 result');
  assert.notEqual(payloadValue(result, 'topic'), `${DEFAULT_TOPIC_BASE}/R1/${model3200Id}/resource`, 'response never reuses request topic');
}

async function test_management_response_preserves_bus_and_reverses_users() {
  const actor = setupActor();
  const request = model3200Request({
    pin: 'resource',
    sysMsgType: 'resource.report',
    payloadRecords: resourceRows(),
    routeKind: 'management',
    sendUser: 'U1',
    receiveUser: 'R1',
  });
  const requestId = payloadValue(request, 'op_id');
  assert.equal(await dispatch(actor, request, 'resource'), true, 'management request transport');
  const result = resultRecords(actor);
  assert.equal(payloadValue(result, 'op_id'), requestId, 'management response preserves op_id');
  assert.equal(payloadValue(result, 'route_kind'), 'management', 'management response route_kind');
  assert.equal(payloadValue(result, 'bus'), 'management', 'management response bus');
  assert.equal(payloadValue(result, 'send_user'), 'R1', 'management response sender is original receiver');
  assert.equal(payloadValue(result, 'receive_user'), 'U1', 'management response receiver is original sender');
  assert.deepEqual(model0Root(actor).labels.get('remote_result_bus')?.v, result, 'management response reaches generic return bus');
  assert.equal(mqttPublishes(actor).length, 1, 'management response publishes exactly once');
  assert.equal(mqttPublishes(actor)[0].payload.topic, responseTopic, 'management response uses response topic');
}

async function test_add_task_response_contains_real_task_id_without_dedicated_return_pin() {
  const actor = setupActor();
  const request = model3200Request({ pin: 'add_task', sysMsgType: 'task_data', payloadRecords: taskRows() });
  assert.equal(await dispatch(actor, request, 'add_task'), true, 'add_task request transport');
  const result = resultRecords(actor);
  const handlerResult = payloadValue(result, 'handler_result', 1);
  assert.equal(payloadValue(result, 'origin_pin'), 'add_task', 'task response origin pin');
  assert.equal(payloadRecords(result).find((record) => record.k === 'family')?.v, 'task', 'task response family');
  assert.equal(payloadRecords(result).find((record) => record.k === 'action')?.v, 'add_task', 'task response action');
  assert.equal(handlerResult?.task_id, 1, 'task response contains real task id');
  assert.equal(handlerResult?.task?.status, 'added_waiting_receive', 'task response contains real task state');
  assert.equal(model3200Root(actor).labels.get('add_task_return')?.t, 'pin.in', 'F-08 remains an input declaration only');
  assert.equal(model3200Root(actor).labels.get('add_task_return')?.v, null, 'add_task must not synthesize add_task_return input');
  assert.equal(
    [...model3200Root(actor).labels.values()].some((label) => label.k === 'add_task_return' && label.t === 'pin.out'),
    false,
    'F-08 dedicated output remains absent',
  );
}

async function test_no_response_flag_updates_business_state_without_any_output() {
  const actor = setupActor();
  const resultBefore = model3200Root(actor).labels.get('result')?.v ?? null;
  const busBefore = model0Root(actor).labels.get('remote_result_bus')?.v ?? null;
  const publishesBefore = mqttPublishes(actor).length;
  const request = model3200Request({
    pin: 'resource',
    sysMsgType: 'resource.report',
    payloadRecords: resourceRows(),
    isNeedResponse: false,
  });
  assert.equal(await dispatch(actor, request, 'resource'), true, 'no-response request transport');
  assert.deepEqual(model3200Root(actor).labels.get('feishu_resource_manager_catalog')?.v, { UI: ['UI.app1'] }, 'business state still updates');
  assert.deepEqual(model3200Root(actor).labels.get('result')?.v ?? null, resultBefore, 'Model 3200 result remains unchanged');
  assert.deepEqual(model0Root(actor).labels.get('remote_result_bus')?.v ?? null, busBefore, 'Model 0 return bus remains unchanged');
  assert.equal(mqttPublishes(actor).length, publishesBefore, 'no MQTT response publish');
}

async function test_invalid_response_topic_is_rejected_before_model3200() {
  for (const isNeedResponse of [true, false]) {
    const actor = setupActor();
    const before = positiveModelSnapshot(actor);
    const requestTopic = `${DEFAULT_TOPIC_BASE}/R1/${model3200Id}/resource`;
    const request = model3200Request({
      pin: 'resource',
      sysMsgType: 'resource.report',
      payloadRecords: resourceRows(),
      isNeedResponse,
      actualResponseTopic: requestTopic,
    });
    assert.equal(
      await dispatch(actor, request, 'resource'),
      false,
      `same request/response topic must fail before is_need_response=${isNeedResponse} can bypass validation`,
    );
    assert.deepEqual(positiveModelSnapshot(actor), before, 'transport rejection must not touch Model 3200');
    assert.equal(model3200Root(actor).labels.get('result')?.v ?? null, null, 'transport rejection emits no result');
    assert.equal(mqttPublishes(actor).length, 0, 'transport rejection publishes nothing');
    assert.equal(model0Root(actor).labels.get('mqtt_inbound_error')?.t, 'json', 'transport rejection is visible at Model 0');
  }
}

const tests = [
  test_resource_response_uses_generic_v2_result_and_response_topic,
  test_management_response_preserves_bus_and_reverses_users,
  test_add_task_response_contains_real_task_id_without_dedicated_return_pin,
  test_no_response_flag_updates_business_state_without_any_output,
  test_invalid_response_topic_is_rejected_before_model3200,
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
