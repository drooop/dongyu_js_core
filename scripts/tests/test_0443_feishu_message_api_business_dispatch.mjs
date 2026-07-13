import assert from 'node:assert/strict';
import { loadSsotDeActor } from '../lib/ssot_de_actor_test_helpers.mjs';
import {
  DEFAULT_TOPIC_BASE,
  externalPacket,
  mt,
  payloadValue,
  pinPayloadV2Records,
} from '../lib/pin_payload_v2_test_helpers.mjs';

const model3200Id = 3200;
const responseTopic = `${DEFAULT_TOPIC_BASE}/U1/21/result`;
let requestSequence = 0;

const legacyBehaviorPrefixes = [
  'feishu_message_api_',
  'feishu_resource_manager_',
  'feishu_data_manager_',
  'feishu_ui_manager_',
  'feishu_task_manager_',
];

function recordAt(k, t, v, { id = 1, p = 0, r = 0, c = 0 } = {}) {
  return { id, p, r, c, k, t, v };
}

function resourceRecords(id = 1) {
  return [
    recordAt('type', 'str', 'UI', { id, c: 1 }),
    recordAt('resource', 'list', ['UI.dispatch'], { id, c: 1 }),
    recordAt('type', 'str', 'service', { id, c: 2 }),
    recordAt('resource', 'list', ['calculator'], { id, c: 2 }),
  ];
}

function dataRecords(id = 1) {
  return [
    recordAt('model_type', 'model.single', 'Data.Single', { id, p: 1 }),
    recordAt('data_key', 'str', 'dispatch-alpha', { id, p: 1 }),
    recordAt('data_value', 'int', 7, { id, p: 1 }),
  ];
}

function uiRecords(id = 1) {
  return [
    recordAt('text', 'str', 'dispatch-aa', { id, p: 1 }),
    recordAt('button', 'str', 'dispatch-bb', { id, r: 1 }),
  ];
}

function taskRecords({ includeTitle = true, id = 1 } = {}) {
  return [
    recordAt('model_type', 'model.single', 'Data.Single', { id, c: 1 }),
    ...(includeTitle ? [recordAt('title', 'str', '任务标题', { id, c: 1 })] : []),
    recordAt('body', 'str', '任务内容', { id, c: 1 }),
    recordAt('publisher', 'str', '任务发布者', { id, c: 1 }),
    recordAt('publish_time', 'str', '2026-07-13 10:00', { id, c: 1 }),
  ];
}

function businessRequest({
  endpointPin,
  sysMsgType,
  payloadRecords,
  payloadModelId = 1,
  payloadType = 'Data',
}) {
  requestSequence += 1;
  const opId = `0457_business_dispatch_${endpointPin}_${requestSequence}`;
  const topic = `${DEFAULT_TOPIC_BASE}/R1/${model3200Id}/${endpointPin}`;
  const records = pinPayloadV2Records({
    opId,
    endpointWorkerId: 'R1',
    endpointTableId: 'host',
    endpointModelId: model3200Id,
    endpointPin,
    topic,
    responseTopic,
    routeKind: 'control',
    originWorkerId: 'U1',
    originTableId: 'app:0457:business-dispatch',
    originModelId: 21,
    originPin: 'send',
    replyTargetWorkerId: 'U1',
    replyTargetTableId: 'app:0457:business-dispatch',
    replyTargetModelId: 21,
    replyTargetPin: 'result',
    payloadModelId,
    payloadRecords: [
      recordAt('model_type', 'model.table', payloadType, { id: payloadModelId }),
      recordAt('sys_msg_type', 'str', sysMsgType, { id: payloadModelId }),
      ...payloadRecords,
    ],
    extraRecords: [
      mt('is_need_response', 'bool', true),
      mt('message_server', 'str', 'local'),
      mt('between', 'str', 'DEM_V1N'),
    ],
    timestamp: 1700000004430 + requestSequence,
  });
  assert.equal(payloadValue(records, '__mt_payload_kind'), 'pin_payload.v2', 'request must use formal pin_payload.v2');
  return { opId, records, topic };
}

function setupActor() {
  const actor = loadSsotDeActor('r1');
  assert.equal(actor.loadRejected, 0, 'real SSOT R1 patches must load without rejection');
  assert.equal(actor.workerAlias, 'R1', 'the tested actor must use the SSOT R1 worker alias');
  assert.equal(actor.workerRole, 'V1N', 'the tested R1 actor must use the SSOT V1N role');
  actor.runtime.setRuntimeMode('edit');
  const mqttStart = actor.runtime.startMqttLoop({
    transport: 'mock',
    host: 'localhost',
    port: 1883,
    client_id: `0457-business-dispatch-r1-${requestSequence + 1}`,
    topic_mode: 'uiput_mm_v1',
    topic_base: DEFAULT_TOPIC_BASE,
    worker_id: 'R1',
    payload_mode: 'pin_payload_v1',
  });
  assert.equal(mqttStart.status, 'running', 'local mock MQTT must be running');
  actor.runtime.setRuntimeMode('running');
  return actor;
}

async function settlePropagation() {
  for (let index = 0; index < 12; index += 1) {
    await new Promise((resolvePromise) => setImmediate(resolvePromise));
  }
}

async function dispatch(actor, request) {
  const handled = actor.runtime.mqttIncoming(request.topic, externalPacket(request.records));
  await settlePropagation();
  return handled;
}

function modelRoot(actor, modelId) {
  return actor.runtime.getModel(modelId).getCell(0, 0, 0);
}

function model3200Value(actor, key) {
  return modelRoot(actor, model3200Id).labels.get(key)?.v;
}

function mqttPublishCount(actor) {
  return actor.runtime.mqttTrace.list().filter((entry) => entry.type === 'publish').length;
}

function assertTraversedR1DispatchChain(actor, request) {
  const model0Ingress = modelRoot(actor, 0).labels.get('r1_cb_in');
  const dispatcherOutput = modelRoot(actor, -10).labels.get(`r1_dispatch_3200_${request.endpointPin}`);
  const model3200Input = modelRoot(actor, model3200Id).labels.get(request.endpointPin);
  assert.equal(model0Ingress?.t, 'pin.bus.cb.in', 'request must enter the R1 Model 0 control bus');
  assert.equal(dispatcherOutput?.t, 'pin.out', 'request must leave the R1 Model -10 dispatcher');
  assert.equal(model3200Input?.t, 'pin.in', 'request must enter the real Model 3200 business pin');
  assert.deepEqual(
    [model0Ingress, dispatcherOutput, model3200Input].map((label) => payloadValue(label.v, 'op_id')),
    [request.opId, request.opId, request.opId],
    'one formal v2 request must traverse Model 0, Model -10, and Model 3200 unchanged',
  );
}

function assertNoLegacyModel0Behavior(actor) {
  const model0 = modelRoot(actor, 0);
  const isLegacyBehaviorName = (value) => (
    typeof value === 'string' && legacyBehaviorPrefixes.some((prefix) => value.startsWith(prefix))
  );
  const legacyLabels = [...model0.labels.keys()].filter(isLegacyBehaviorName);
  const legacyIntercepts = actor.runtime.intercepts.list()
    .map((entry) => entry?.type)
    .filter(isLegacyBehaviorName);
  assert.deepEqual(legacyLabels, [], 'Model 0 must not contain legacy Feishu dispatch or manager state');
  assert.deepEqual(legacyIntercepts, [], 'runtime must not record legacy Feishu dispatch or manager intercepts');
}

function requestWithEndpoint(options) {
  const request = businessRequest(options);
  return { ...request, endpointPin: options.endpointPin };
}

async function test_resource_report_dispatches_into_model3200() {
  const actor = setupActor();
  const request = requestWithEndpoint({
    endpointPin: 'resource',
    sysMsgType: 'resource.report',
    payloadRecords: resourceRecords(),
  });
  assert.equal(await dispatch(actor, request), true, 'generic transport must deliver resource.report');
  assertTraversedR1DispatchChain(actor, request);
  assert.deepEqual(model3200Value(actor, 'feishu_resource_manager_catalog'), {
    UI: ['UI.dispatch'],
    service: ['calculator'],
  }, 'resource.report must update the Model 3200 catalog');
  assert.deepEqual(
    {
      status: model3200Value(actor, 'feishu_resource_manager_last_result')?.status,
      action: model3200Value(actor, 'feishu_resource_manager_last_result')?.action,
    },
    { status: 'accepted', action: 'report' },
    'resource.report must expose the real Model 3200 result',
  );
  assertNoLegacyModel0Behavior(actor);
}

async function test_data_save_modeltable_dispatches_into_model3200() {
  const actor = setupActor();
  const payloadModelId = 7;
  const request = requestWithEndpoint({
    endpointPin: 'data',
    sysMsgType: 'data.save_modeltable',
    payloadModelId,
    payloadRecords: dataRecords(payloadModelId),
  });
  assert.equal(await dispatch(actor, request), true, 'generic transport must deliver data.save_modeltable');
  assertTraversedR1DispatchChain(actor, request);
  const saved = model3200Value(actor, 'feishu_data_manager_store')?.modeltable?.saved;
  assert.equal(saved?.payload_model_id, payloadModelId, 'data state must use the declared v2 payload_model_id');
  assert.equal(saved?.record_count, 3, 'data.save_modeltable must persist all business records');
  assert.equal(saved?.records?.find((record) => record.k === 'data_key')?.v, 'dispatch-alpha', 'saved state must contain the business value');
  assert.deepEqual(
    {
      status: model3200Value(actor, 'feishu_data_manager_last_result')?.status,
      action: model3200Value(actor, 'feishu_data_manager_last_result')?.action,
      kind: model3200Value(actor, 'feishu_data_manager_last_result')?.kind,
    },
    { status: 'accepted', action: 'save_modeltable', kind: 'modeltable' },
    'data.save_modeltable must expose the real Model 3200 result',
  );
  assertNoLegacyModel0Behavior(actor);
}

async function test_ui_update_data_dispatches_into_model3200() {
  const actor = setupActor();
  const payloadModelId = 11;
  const request = requestWithEndpoint({
    endpointPin: 'ui',
    sysMsgType: 'ui.update_data',
    payloadModelId,
    payloadRecords: uiRecords(payloadModelId),
  });
  assert.equal(await dispatch(actor, request), true, 'generic transport must deliver ui.update_data');
  assertTraversedR1DispatchChain(actor, request);
  const state = model3200Value(actor, 'feishu_ui_manager_state');
  assert.equal(state?.update?.current?.payload_model_id, payloadModelId, 'UI state must use the declared v2 payload_model_id');
  assert.equal(state?.update?.current?.record_count, 2, 'ui.update_data must persist both business records');
  assert.equal(state?.update?.history?.length, 1, 'ui.update_data must append Model 3200 history');
  assert.deepEqual(
    {
      status: model3200Value(actor, 'feishu_ui_manager_last_result')?.status,
      action: model3200Value(actor, 'feishu_ui_manager_last_result')?.action,
    },
    { status: 'accepted', action: 'update_data' },
    'ui.update_data must expose the real Model 3200 result',
  );
  assertNoLegacyModel0Behavior(actor);
}

async function test_task_add_task_dispatches_into_model3200() {
  const actor = setupActor();
  const payloadModelId = 13;
  const request = requestWithEndpoint({
    endpointPin: 'add_task',
    sysMsgType: 'task_data',
    payloadModelId,
    payloadRecords: taskRecords({ id: payloadModelId }),
  });
  assert.equal(await dispatch(actor, request), true, 'generic transport must deliver task add_task');
  assertTraversedR1DispatchChain(actor, request);
  const tasks = model3200Value(actor, 'feishu_task_manager_tasks');
  assert.deepEqual(tasks?.map((task) => ({ id: task.id, title: task.title, status: task.status })), [
    { id: 1, title: '任务标题', status: 'added_waiting_receive' },
  ], 'add_task must create the Model 3200 task state');
  assert.deepEqual(
    {
      action: model3200Value(actor, 'feishu_task_manager_last_result')?.action,
      task_id: model3200Value(actor, 'feishu_task_manager_last_result')?.task_id,
      status: model3200Value(actor, 'feishu_task_manager_last_result')?.status,
    },
    { action: 'add_task', task_id: 1, status: 'added_waiting_receive' },
    'add_task must expose the real Model 3200 result',
  );
  assertNoLegacyModel0Behavior(actor);
}

async function test_task_missing_required_field_fails_closed_inside_model3200() {
  const actor = setupActor();
  const model0 = modelRoot(actor, 0);
  const tasksBefore = structuredClone(model3200Value(actor, 'feishu_task_manager_tasks') ?? []);
  const resultBefore = structuredClone(model3200Value(actor, 'result') ?? null);
  const busBefore = structuredClone(model0.labels.get('remote_result_bus')?.v ?? null);
  const publishesBefore = mqttPublishCount(actor);
  const payloadModelId = 17;
  const request = requestWithEndpoint({
    endpointPin: 'add_task',
    sysMsgType: 'task_data',
    payloadModelId,
    payloadRecords: taskRecords({ includeTitle: false, id: payloadModelId }),
  });

  assert.equal(await dispatch(actor, request), true, 'generic transport must deliver the malformed business request');
  assertTraversedR1DispatchChain(actor, request);
  assert.deepEqual(
    {
      status: model3200Value(actor, 'feishu_task_manager_last_result')?.status,
      code: model3200Value(actor, 'feishu_task_manager_last_result')?.code,
    },
    { status: 'rejected', code: 'missing_task_field:title' },
    'Model 3200 must expose the exact missing-field rejection',
  );
  assert.deepEqual(model3200Value(actor, 'feishu_task_manager_tasks') ?? [], tasksBefore, 'rejected task must not mutate task state');
  assert.deepEqual(model3200Value(actor, 'result') ?? null, resultBefore, 'rejected task must not emit a Model 3200 result');
  assert.deepEqual(model0.labels.get('remote_result_bus')?.v ?? null, busBefore, 'rejected task must not reach the Model 0 result bus');
  assert.equal(mqttPublishCount(actor), publishesBefore, 'rejected task must not publish an MQTT response');
  assertNoLegacyModel0Behavior(actor);
}

const tests = [
  test_resource_report_dispatches_into_model3200,
  test_data_save_modeltable_dispatches_into_model3200,
  test_ui_update_data_dispatches_into_model3200,
  test_task_add_task_dispatches_into_model3200,
  test_task_missing_required_field_fails_closed_inside_model3200,
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
