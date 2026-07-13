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
const replyModelId = 22;
const requestTopic = `${DEFAULT_TOPIC_BASE}/R1/${model3200Id}/resource`;
const responseTopic = `${DEFAULT_TOPIC_BASE}/U1/${replyModelId}/result`;

function recordAt(k, t, v, { p = 0, r = 0, c = 0 } = {}) {
  return { id: 1, p, r, c, k, t, v };
}

function resourceRequest(opId) {
  return pinPayloadV2Records({
    opId,
    endpointWorkerId: 'R1',
    endpointTableId: 'host',
    endpointModelId: model3200Id,
    endpointPin: 'resource',
    topic: requestTopic,
    responseTopic,
    routeKind: 'control',
    originWorkerId: 'U1',
    originTableId: 'app:0457:publish-contract',
    originModelId: replyModelId,
    originPin: 'send',
    replyTargetWorkerId: 'U1',
    replyTargetTableId: 'app:0457:publish-contract',
    replyTargetModelId: replyModelId,
    replyTargetPin: 'result',
    payloadModelId: 7,
    payloadRecords: [
      recordAt('model_type', 'model.table', 'Data'),
      recordAt('sys_msg_type', 'str', 'resource.report'),
      recordAt('type', 'str', 'UI', { c: 1 }),
      recordAt('resource', 'list', ['UI.app1'], { c: 1 }),
    ],
    extraRecords: [
      mt('is_need_response', 'bool', true),
      mt('message_server', 'str', 'local'),
      mt('between', 'str', 'DEM_V1N'),
    ],
    timestamp: 1700000004900,
  });
}

function setupActorWithMockMqtt(clientId) {
  const actor = loadSsotDeActor('r1');
  assert.equal(actor.loadRejected, 0, 'R1 patches must load without rejection');
  actor.runtime.setRuntimeMode('edit');
  const mqttStart = actor.runtime.startMqttLoop({
    transport: 'mock',
    host: 'localhost',
    port: 1883,
    client_id: clientId,
    topic_mode: 'uiput_mm_v1',
    topic_base: DEFAULT_TOPIC_BASE,
    worker_id: 'R1',
    payload_mode: 'pin_payload_v1',
  });
  assert.equal(mqttStart.status, 'running', 'local mock MQTT client must start');
  assert.equal(
    actor.runtime.mqttTrace.list().some((entry) => entry.type === 'connect'),
    true,
    'local mock MQTT client must be active',
  );
  actor.runtime.setRuntimeMode('running');
  assert.equal(actor.runtime.getRuntimeMode(), 'running', 'runtime must enter running mode');
  return actor;
}

function setupActorWithoutMqtt() {
  const actor = loadSsotDeActor('r1');
  assert.equal(actor.loadRejected, 0, 'R1 patches must load without rejection');
  actor.runtime.setRuntimeMode('edit');
  actor.runtime.setRuntimeMode('running');
  assert.equal(actor.runtime.mqttClient, null, 'no MQTT client may be installed');
  return actor;
}

async function settlePropagation() {
  for (let index = 0; index < 12; index += 1) {
    await new Promise((resolvePromise) => setImmediate(resolvePromise));
  }
}

async function dispatchMqtt(actor, records) {
  const handled = actor.runtime.mqttIncoming(requestTopic, externalPacket(records));
  await settlePropagation();
  return handled;
}

function model3200Root(actor) {
  return actor.runtime.getModel(model3200Id).getCell(0, 0, 0);
}

function model0Root(actor) {
  return actor.runtime.getModel(0).getCell(0, 0, 0);
}

function resultRecords(actor, opId) {
  const result = model3200Root(actor).labels.get('result');
  assert.equal(result?.t, 'pin.out', 'Model 3200 result must use the generic output pin');
  assert.equal(Array.isArray(result.v), true, 'Model 3200 result must carry ModelTable records');
  assert.equal(payloadValue(result.v, '__mt_payload_kind'), 'pin_payload.v2', 'response payload kind');
  assert.equal(payloadValue(result.v, 'message_role'), 'response', 'response message role');
  assert.equal(payloadValue(result.v, 'op_id'), opId, 'response belongs to the current request');
  assert.equal(payloadValue(result.v, 'topic'), responseTopic, 'response records target response topic');
  return result.v;
}

function mqttPublishes(actor) {
  return actor.runtime.mqttTrace.list().filter((entry) => entry.type === 'publish');
}

async function test_running_mode_publishes_generic_response_exactly_once() {
  const opId = '0457_response_publish_running';
  const actor = setupActorWithMockMqtt('0457-response-publish-running');
  assert.equal(await dispatchMqtt(actor, resourceRequest(opId)), true, 'running request transport');

  const result = resultRecords(actor, opId);
  const returnBus = model0Root(actor).labels.get('remote_result_bus');
  assert.equal(returnBus?.t, 'pin.bus.cb.out', 'Model 0 generic return bus type');
  assert.deepEqual(returnBus.v, result, 'Model 0 return bus must carry the exact Model 3200 result');

  const publishes = mqttPublishes(actor);
  assert.equal(publishes.length, 1, 'running mode must publish exactly once');
  assert.equal(publishes[0].payload.topic, responseTopic, 'publish must target response topic');
  assert.equal(publishes[0].payload.payload?.type, 'pin_payload', 'publish must use the generic external packet');
  assert.deepEqual(publishes[0].payload.payload?.payload, result, 'published payload must equal Model 3200 result');
  assert.equal(
    publishes.some((entry) => entry.payload?.topic === requestTopic),
    false,
    'response must never publish back to the request topic',
  );
}

async function test_running_mode_without_mqtt_prepares_response_without_publish() {
  const opId = '0457_response_publish_without_mqtt';
  const actor = setupActorWithoutMqtt();
  assert.equal(await dispatchMqtt(actor, resourceRequest(opId)), true, 'real v2 ingress must work while transport client is absent');

  const result = resultRecords(actor, opId);
  const returnBus = model0Root(actor).labels.get('remote_result_bus');
  assert.equal(returnBus?.t, 'pin.bus.cb.out', 'runtime still prepares the Model 0 return bus');
  assert.deepEqual(returnBus.v, result, 'return bus must carry the exact Model 3200 result');
  assert.equal(mqttPublishes(actor).length, 0, 'missing MQTT client must produce no publish');
}

const tests = [
  test_running_mode_publishes_generic_response_exactly_once,
  test_running_mode_without_mqtt_prepares_response_without_publish,
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
