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
let requestSequence = 0;

function recordAt(k, t, v, { id = 1, p = 0, r = 0, c = 0 } = {}) {
  return { id, p, r, c, k, t, v };
}

function modeltableRecords(id = 1) {
  return [
    recordAt('model_type', 'model.single', 'Data.Single', { id, p: 1 }),
    recordAt('data_key', 'str', 'alpha', { id, p: 1 }),
    recordAt('data_value', 'int', 7, { id, p: 1 }),
  ];
}

function flowRecords(id = 1) {
  return [
    recordAt('flow_name', 'str', '审批流', { id, r: 1 }),
    recordAt('flow_steps', 'list', ['start', 'review', 'end'], { id, r: 1 }),
  ];
}

function dataRequest(sysMsgType, payloadType, payloadRecords = [], { isNeedResponse = true, payloadModelId = 1 } = {}) {
  requestSequence += 1;
  return pinPayloadV2Records({
    opId: `0457_data_${sysMsgType.replaceAll('.', '_')}_${requestSequence}`,
    endpointWorkerId: 'R1',
    endpointTableId: 'host',
    endpointModelId: model3200Id,
    endpointPin: 'data',
    topic: `${DEFAULT_TOPIC_BASE}/R1/${model3200Id}/data`,
    responseTopic: `${DEFAULT_TOPIC_BASE}/U1/1/result`,
    routeKind: 'control',
    originWorkerId: 'U1',
    originTableId: 'app:0457:data-contract',
    originModelId: 1,
    originPin: 'send',
    replyTargetWorkerId: 'U1',
    replyTargetTableId: 'app:0457:data-contract',
    replyTargetModelId: 1,
    replyTargetPin: 'result',
    payloadModelId,
    payloadRecords: [
      recordAt('model_type', 'model.table', payloadType, { id: payloadModelId }),
      recordAt('sys_msg_type', 'str', sysMsgType, { id: payloadModelId }),
      ...payloadRecords,
    ],
    extraRecords: [
      mt('is_need_response', 'bool', isNeedResponse),
      mt('message_server', 'str', 'local'),
      mt('between', 'str', 'DEM_V1N'),
    ],
    timestamp: 1700000004600 + requestSequence,
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
    client_id: '0457-data-r1',
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

async function dispatchData(actor, sysMsgType, payloadType, payloadRecords = [], options = {}) {
  const handled = actor.runtime.mqttIncoming(
    `${DEFAULT_TOPIC_BASE}/R1/${model3200Id}/data`,
    externalPacket(dataRequest(sysMsgType, payloadType, payloadRecords, options)),
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

function rootValue(actor, key) {
  return model3200Root(actor).labels.get(key)?.v;
}

function store(actor) {
  return rootValue(actor, 'feishu_data_manager_store') || {};
}

function lastResult(actor) {
  return rootValue(actor, 'feishu_data_manager_last_result') || {};
}

function responseHandlerResult(actor) {
  const result = model3200Root(actor).labels.get('result');
  return result && Array.isArray(result.v) ? payloadValue(result.v, 'handler_result', 1) : null;
}

function publishCount(actor) {
  return actor.runtime.mqttTrace.list().filter((entry) => entry.type === 'publish').length;
}

function assertDataRequestTraversedR1Chain(actor) {
  const model0Ingress = model0Root(actor).labels.get('r1_cb_in');
  const dispatcherOutput = actor.runtime.getModel(-10)?.getCell(0, 0, 0).labels.get('r1_dispatch_3200_data');
  const model3200Input = model3200Root(actor).labels.get('data');
  assert.equal(model0Ingress?.t, 'pin.bus.cb.in', 'request must enter Model 0 control bus');
  assert.equal(dispatcherOutput?.t, 'pin.out', 'request must leave Model -10 data dispatcher');
  assert.equal(model3200Input?.t, 'pin.in', 'request must enter Model 3200 data pin');
  const opIds = [model0Ingress, dispatcherOutput, model3200Input].map((label) => payloadValue(label.v, 'op_id'));
  assert.match(opIds[0], /^0457_data_/, 'data op_id must be visible at Model 0 ingress');
  assert.deepEqual(opIds, [opIds[0], opIds[0], opIds[0]], 'same data request must traverse Model 0, Model -10, and Model 3200');
}

async function test_save_modeltable_writes_model3200_store_and_real_response() {
  const actor = setupActor();
  const payloadModelId = 7;
  assert.equal(
    await dispatchData(actor, 'data.save_modeltable', 'Data', modeltableRecords(payloadModelId), { payloadModelId }),
    true,
    'generic transport must deliver data.save_modeltable',
  );
  assertDataRequestTraversedR1Chain(actor);
  assert.equal(store(actor).modeltable?.saved?.record_count, 3, 'Model 3200 saved ModelTable record count');
  assert.equal(store(actor).modeltable?.saved?.records?.[1]?.k, 'data_key', 'Model 3200 saved ModelTable record');
  assert.equal(store(actor).modeltable?.saved?.payload_model_id, payloadModelId, 'store uses declared v2 payload_model_id');
  assert.equal(Object.prototype.hasOwnProperty.call(store(actor).modeltable.saved, 'payload_table_id'), false, 'store must not retain v1 payload_table_id');
  assert.equal(lastResult(actor).action, 'save_modeltable', 'save ModelTable result action');
  assert.equal(lastResult(actor).kind, 'modeltable', 'save ModelTable result kind');
  assert.equal(lastResult(actor).payload_model_id, payloadModelId, 'last result uses v2 payload_model_id');
  assert.equal(Object.prototype.hasOwnProperty.call(lastResult(actor), 'payload_table_id'), false, 'last result must not retain v1 payload_table_id');
  assert.equal(responseHandlerResult(actor)?.action, 'save_modeltable', 'response comes from data handler');
  assert.equal(responseHandlerResult(actor)?.record_count, 3, 'response contains data record count');
  assert.equal(responseHandlerResult(actor)?.payload_model_id, payloadModelId, 'handler response uses v2 payload_model_id');
  assert.equal(Object.prototype.hasOwnProperty.call(responseHandlerResult(actor), 'payload_table_id'), false, 'handler response must not retain v1 payload_table_id');
  assert.equal(publishCount(actor), 1, 'response-enabled save proves MQTT publish baseline');
}

async function test_load_modeltable_writes_loaded_slot_without_response() {
  const actor = setupActor();
  const resultBefore = rootValue(actor, 'result') ?? null;
  const remoteResultBefore = model0Root(actor).labels.get('remote_result_bus')?.v ?? null;
  const publishesBefore = publishCount(actor);
  assert.equal(
    await dispatchData(actor, 'data.load_modeltable', 'Data', modeltableRecords(), { isNeedResponse: false }),
    true,
    'generic transport must deliver data.load_modeltable',
  );
  assert.equal(store(actor).modeltable?.loaded?.record_count, 3, 'Model 3200 loaded ModelTable record count');
  assert.equal(lastResult(actor).action, 'load_modeltable', 'load ModelTable result action');
  assert.deepEqual(rootValue(actor, 'result') ?? null, resultBefore, 'load ModelTable must not emit result when response is disabled');
  assert.deepEqual(model0Root(actor).labels.get('remote_result_bus')?.v ?? null, remoteResultBefore, 'load ModelTable must not reach Model 0 result bus');
  assert.equal(publishCount(actor), publishesBefore, 'load ModelTable must not publish MQTT response');
}

async function test_save_and_load_flow_use_model3200_flow_slots() {
  const actor = setupActor();
  assert.equal(await dispatchData(actor, 'data.save_flow', 'Flow', flowRecords()), true, 'generic transport must deliver data.save_flow');
  assert.equal(store(actor).flow?.saved?.record_count, 2, 'Model 3200 saved Flow record count');
  assert.equal(responseHandlerResult(actor)?.kind, 'flow', 'save Flow response comes from data handler');
  const resultBefore = structuredClone(rootValue(actor, 'result'));
  const remoteResultBefore = structuredClone(model0Root(actor).labels.get('remote_result_bus')?.v ?? null);
  const publishesBefore = publishCount(actor);
  assert.equal(
    await dispatchData(actor, 'data.load_flow', 'Flow', flowRecords(), { isNeedResponse: false }),
    true,
    'generic transport must deliver data.load_flow',
  );
  assert.equal(store(actor).flow?.loaded?.records?.[0]?.k, 'flow_name', 'Model 3200 loaded Flow record');
  assert.equal(lastResult(actor).action, 'load_flow', 'load Flow result action');
  assert.equal(lastResult(actor).kind, 'flow', 'load Flow result kind');
  assert.deepEqual(rootValue(actor, 'result'), resultBefore, 'load Flow must preserve prior result when response is disabled');
  assert.deepEqual(model0Root(actor).labels.get('remote_result_bus')?.v ?? null, remoteResultBefore, 'load Flow must preserve Model 0 result bus');
  assert.equal(publishCount(actor), publishesBefore, 'load Flow must not publish MQTT response');
}

async function assertInvalidDataRejects({ sysMsgType, payloadType, payloadRecords, payloadModelId = 1, code, name }) {
  const actor = setupActor();
  const storeBefore = structuredClone(store(actor));
  const resultBefore = rootValue(actor, 'result') ?? null;
  const remoteResultBefore = model0Root(actor).labels.get('remote_result_bus')?.v ?? null;
  const publishesBefore = publishCount(actor);
  assert.equal(
    await dispatchData(actor, sysMsgType, payloadType, payloadRecords, { payloadModelId }),
    true,
    `${name}: generic transport must deliver malformed business payload`,
  );
  assert.equal(lastResult(actor).status, 'rejected', `${name}: actor-visible rejection status`);
  assert.equal(lastResult(actor).code, code, `${name}: exact rejection code`);
  assert.deepEqual(store(actor), storeBefore, `${name}: invalid data must not mutate store`);
  assert.deepEqual(rootValue(actor, 'result') ?? null, resultBefore, `${name}: invalid data must not emit result`);
  assert.deepEqual(model0Root(actor).labels.get('remote_result_bus')?.v ?? null, remoteResultBefore, `${name}: invalid data must not reach Model 0 result bus`);
  assert.equal(publishCount(actor), publishesBefore, `${name}: invalid data must not publish MQTT response`);
}

const actionCases = [
  ['data.save_modeltable', 'Data', 'Flow'],
  ['data.load_modeltable', 'Data', 'Flow'],
  ['data.save_flow', 'Flow', 'Data'],
  ['data.load_flow', 'Flow', 'Data'],
];

const tests = [
  { name: test_save_modeltable_writes_model3200_store_and_real_response.name, run: test_save_modeltable_writes_model3200_store_and_real_response },
  { name: test_load_modeltable_writes_loaded_slot_without_response.name, run: test_load_modeltable_writes_loaded_slot_without_response },
  { name: test_save_and_load_flow_use_model3200_flow_slots.name, run: test_save_and_load_flow_use_model3200_flow_slots },
  ...actionCases.flatMap(([sysMsgType, validType, wrongType]) => [
    {
      name: `test_${sysMsgType.replaceAll('.', '_')}_rejects_empty_payload_inside_model3200`,
      run: () => assertInvalidDataRejects({
        sysMsgType,
        payloadType: validType,
        payloadRecords: [],
        payloadModelId: sysMsgType === 'data.save_modeltable' ? 9 : 1,
        code: 'missing_data_payload_records',
        name: `${sysMsgType}/empty_payload`,
      }),
    },
    {
      name: `test_${sysMsgType.replaceAll('.', '_')}_rejects_wrong_payload_root_inside_model3200`,
      run: () => assertInvalidDataRejects({
        sysMsgType,
        payloadType: wrongType,
        payloadRecords: sysMsgType === 'data.save_modeltable'
          ? modeltableRecords(9)
          : (sysMsgType.includes('flow') ? flowRecords() : modeltableRecords()),
        payloadModelId: sysMsgType === 'data.save_modeltable' ? 9 : 1,
        code: 'invalid_data_payload_type',
        name: `${sysMsgType}/wrong_payload_root`,
      }),
    },
  ]),
];

let failed = 0;
for (const test of tests) {
  try {
    await test.run();
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
