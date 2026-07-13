import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadSsotDeActor } from '../lib/ssot_de_actor_test_helpers.mjs';
import {
  DEFAULT_TOPIC_BASE,
  externalPacket,
  mt,
  payloadRecords,
  payloadValue,
  pinPayloadV2Records,
} from '../lib/pin_payload_v2_test_helpers.mjs';

const require = createRequire(import.meta.url);
const cjsRuntime = require('../../packages/worker-base/src/runtime.js');
const esmRuntime = await import('../../packages/worker-base/src/runtime.mjs');

const consumerVariants = [
  ['cjs-consumer', cjsRuntime.ModelTableRuntime],
  ['esm-consumer', esmRuntime.ModelTableRuntime],
];

const model3200Id = 3200;
const responseEndpointModelId = 21;
const responseTargetModelId = 0;
const responseTargetTableId = 'app:0457:response-e2e';
const responseTopic = `${DEFAULT_TOPIC_BASE}/U1/${responseEndpointModelId}/result`;
let requestSequence = 0;

function recordAt(k, t, v, { p = 0, r = 0, c = 0 } = {}) {
  return { id: 1, p, r, c, k, t, v };
}

function resourceRows() {
  return [
    recordAt('type', 'str', 'UI', { c: 1 }),
    recordAt('resource', 'list', ['UI.app1', 'UI.app2'], { c: 1 }),
  ];
}

function resourceRequest({ replyTargetTableId = responseTargetTableId } = {}) {
  requestSequence += 1;
  const requestTopic = `${DEFAULT_TOPIC_BASE}/R1/${model3200Id}/resource`;
  return pinPayloadV2Records({
    opId: `0457_response_e2e_${requestSequence}`,
    endpointWorkerId: 'R1',
    endpointTableId: 'host',
    endpointModelId: model3200Id,
    endpointPin: 'resource',
    topic: requestTopic,
    responseTopic,
    routeKind: 'control',
    originWorkerId: 'U1',
    originTableId: replyTargetTableId,
    originModelId: responseTargetModelId,
    originPin: 'send',
    replyTargetWorkerId: 'U1',
    replyTargetTableId,
    replyTargetModelId: responseTargetModelId,
    replyTargetPin: 'result',
    payloadModelId: 7,
    payloadRecords: [
      recordAt('model_type', 'model.table', 'Data'),
      recordAt('sys_msg_type', 'str', 'resource.report'),
      ...resourceRows(),
    ],
    extraRecords: [
      mt('is_need_response', 'bool', true),
      mt('message_server', 'str', 'local'),
      mt('between', 'str', 'DEM_V1N'),
    ],
    timestamp: 1700000005200 + requestSequence,
  });
}

function setupProducer() {
  const actor = loadSsotDeActor('r1');
  assert.equal(actor.loadRejected, 0, 'R1 patches must load without rejection');
  actor.runtime.setRuntimeMode('edit');
  const mqttStart = actor.runtime.startMqttLoop({
    transport: 'mock',
    host: 'localhost',
    port: 1883,
    client_id: `0457-response-e2e-r1-${requestSequence + 1}`,
    topic_mode: 'uiput_mm_v1',
    topic_base: DEFAULT_TOPIC_BASE,
    worker_id: 'R1',
    payload_mode: 'pin_payload_v1',
  });
  assert.equal(mqttStart.status, 'running', 'R1 local mock MQTT must start');
  actor.runtime.setRuntimeMode('running');
  return actor;
}

function setupConsumer(Runtime, { createReplyTarget = true } = {}) {
  const runtime = new Runtime();
  runtime.setRuntimeMode('edit');
  const responseEndpoint = runtime.createModel({
    id: responseEndpointModelId,
    name: '0457 Response Endpoint',
    type: 'endpoint',
  });
  const replyTarget = createReplyTarget
    ? runtime.createModel({
      table_id: responseTargetTableId,
      id: responseTargetModelId,
      name: '0457 Response App',
      type: 'app',
    })
    : null;
  const mqttStart = runtime.startMqttLoop({
    transport: 'mock',
    host: 'localhost',
    port: 1883,
    client_id: `0457-response-e2e-u1-${requestSequence + 1}`,
    topic_mode: 'uiput_mm_v1',
    topic_base: DEFAULT_TOPIC_BASE,
    worker_id: 'U1',
    payload_mode: 'pin_payload_v1',
  });
  assert.equal(mqttStart.status, 'running', 'U1 local mock MQTT must start');
  runtime.setRuntimeMode('running');
  return { runtime, responseEndpoint, replyTarget };
}

async function settlePropagation() {
  for (let index = 0; index < 12; index += 1) {
    await new Promise((resolvePromise) => setImmediate(resolvePromise));
  }
}

async function publishFromProducer(actor, records) {
  const requestTopic = `${DEFAULT_TOPIC_BASE}/R1/${model3200Id}/resource`;
  const accepted = actor.runtime.mqttIncoming(requestTopic, externalPacket(records));
  await settlePropagation();
  assert.equal(accepted, true, 'R1 must accept the real v2 resource request');
  assert.deepEqual(
    actor.runtime.getModel(model3200Id).getCell(0, 0, 0).labels.get('feishu_resource_manager_catalog')?.v,
    { UI: ['UI.app1', 'UI.app2'] },
    'R1 must execute the real resource handler before responding',
  );
  const publishes = actor.runtime.mqttTrace.list().filter((entry) => entry.type === 'publish');
  assert.equal(publishes.length, 1, 'R1 must publish exactly one response');
  assert.equal(publishes[0].payload.topic, responseTopic, 'R1 must publish to the response topic');
  assert.equal(publishes[0].payload.payload?.type, 'pin_payload', 'R1 must publish an external pin payload packet');
  return publishes[0];
}

function rootLabel(runtime, key) {
  return runtime.getModel(0).getCell(0, 0, 0).labels.get(key) ?? null;
}

function appLabel(replyTarget, key) {
  return replyTarget.getCell(0, 0, 0).labels.get(key) ?? null;
}

async function test_real_r1_response_materializes_in_a_distinct_u1_app_runtime() {
  for (const [name, Runtime] of consumerVariants) {
    const producer = setupProducer();
    const { runtime: consumer, responseEndpoint, replyTarget } = setupConsumer(Runtime);
    assert.notEqual(producer.runtime, consumer, `${name}: producer and consumer must be distinct runtimes`);
    assert.equal(
      producer.runtime.getModel({ table_id: responseTargetTableId, model_id: responseTargetModelId }) ?? null,
      null,
      `${name}: producer must not own the U1 app target`,
    );

    const request = resourceRequest();
    const requestId = payloadValue(request, 'op_id');
    const published = await publishFromProducer(producer, request);
    const publishedPacket = published.payload.payload;
    const publishedRecords = publishedPacket.payload;
    assert.equal(payloadValue(publishedRecords, '__mt_payload_kind'), 'pin_payload.v2', `${name}: response must stay v2`);
    assert.equal(payloadValue(publishedRecords, 'op_id'), requestId, `${name}: response must preserve op_id`);
    assert.equal(payloadValue(publishedRecords, 'reply_target_table_id'), responseTargetTableId, `${name}: response must preserve app table target`);
    assert.equal(payloadValue(publishedRecords, 'reply_target_model_id'), responseTargetModelId, `${name}: response must preserve app model target`);

    const accepted = consumer.mqttIncoming(published.payload.topic, publishedPacket);

    assert.equal(accepted, true, `${name}: U1 must accept the exact R1 published packet`);
    assert.equal(appLabel(replyTarget, 'sys_msg_type')?.v, 'resource.report', `${name}: sys_msg_type materialized`);
    assert.equal(appLabel(replyTarget, 'family')?.v, 'resource', `${name}: family materialized`);
    assert.equal(appLabel(replyTarget, 'action')?.v, 'report', `${name}: action materialized`);
    assert.equal(appLabel(replyTarget, 'status')?.v, 'accepted', `${name}: status materialized`);
    assert.deepEqual(appLabel(replyTarget, 'handler_result')?.v?.catalog, { UI: ['UI.app1', 'UI.app2'] }, `${name}: real handler result materialized`);
    assert.equal(responseEndpoint.getCell(0, 0, 0).labels.get('result'), undefined, `${name}: endpoint pin must not be written`);
    assert.equal(rootLabel(consumer, 'family'), null, `${name}: response must not fall back to host root`);
    assert.equal(rootLabel(consumer, 'pin_payload_response_materialize_last_result')?.v?.status, 'applied', `${name}: materialization status`);
    assert.equal(rootLabel(consumer, 'pin_payload_response_materialize_last_result')?.v?.reply_target_table_id, responseTargetTableId, `${name}: materialization records table target`);
    assert.equal(
      producer.runtime.getModel({ table_id: responseTargetTableId, model_id: responseTargetModelId }) ?? null,
      null,
      `${name}: materialization must remain isolated to the consumer`,
    );

    const producerModel3200 = producer.runtime.getModel(model3200Id).getCell(0, 0, 0);
    const producerModel0 = producer.runtime.getModel(0).getCell(0, 0, 0);
    const producerStateBeforeExternalMutation = structuredClone({
      catalog: producerModel3200.labels.get('feishu_resource_manager_catalog')?.v,
      last_result: producerModel3200.labels.get('feishu_resource_manager_last_result')?.v,
      result: producerModel3200.labels.get('result')?.v,
      return_bus: producerModel0.labels.get('remote_result_bus')?.v,
    });
    const sourceHandler = payloadRecords(publishedRecords).find((record) => record.k === 'handler_result');
    sourceHandler.v.catalog.UI.push('UI.mutated-after-delivery');
    assert.deepEqual(
      appLabel(replyTarget, 'handler_result')?.v?.catalog,
      { UI: ['UI.app1', 'UI.app2'] },
      `${name}: consumer must deep-clone materialized values`,
    );
    assert.deepEqual(
      {
        catalog: producerModel3200.labels.get('feishu_resource_manager_catalog')?.v,
        last_result: producerModel3200.labels.get('feishu_resource_manager_last_result')?.v,
        result: producerModel3200.labels.get('result')?.v,
        return_bus: producerModel0.labels.get('remote_result_bus')?.v,
      },
      producerStateBeforeExternalMutation,
      `${name}: externally visible publish packet must not alias any producer state`,
    );
  }
}

async function test_missing_non_host_target_rejects_without_host_fallback() {
  for (const [name, Runtime] of consumerVariants) {
    const missingTableId = `app:0457:missing-response-target:${name}`;
    const producer = setupProducer();
    const { runtime: consumer, responseEndpoint } = setupConsumer(Runtime, { createReplyTarget: false });
    const request = resourceRequest({ replyTargetTableId: missingTableId });
    const published = await publishFromProducer(producer, request);

    const accepted = consumer.mqttIncoming(published.payload.topic, published.payload.payload);

    assert.equal(accepted, false, `${name}: missing non-host target must be rejected`);
    assert.equal(rootLabel(consumer, 'pin_payload_response_materialize_last_result')?.v?.status, 'rejected', `${name}: rejection must be visible`);
    assert.equal(rootLabel(consumer, 'pin_payload_response_materialize_last_result')?.v?.reason, 'reply_target_model_not_found', `${name}: rejection reason`);
    assert.equal(rootLabel(consumer, 'sys_msg_type'), null, `${name}: missing app target must not fall back to host root`);
    assert.equal(rootLabel(consumer, 'family'), null, `${name}: no response field may land on host root`);
    assert.equal(responseEndpoint.getCell(0, 0, 0).labels.get('result'), undefined, `${name}: endpoint pin must remain untouched`);
    assert.equal(consumer.getModel({ table_id: missingTableId, model_id: responseTargetModelId }) ?? null, null, `${name}: consumer must not auto-create a missing reply target`);
  }
}

const tests = [
  test_real_r1_response_materializes_in_a_distinct_u1_app_runtime,
  test_missing_non_host_target_rejects_without_host_fallback,
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
