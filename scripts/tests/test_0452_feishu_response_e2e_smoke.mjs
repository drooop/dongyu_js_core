import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cjsRuntime = require('../../packages/worker-base/src/runtime.js');
const esmRuntime = await import('../../packages/worker-base/src/runtime.mjs');

const runtimeVariants = [
  ['cjs', cjsRuntime.ModelTableRuntime],
  ['esm', esmRuntime.ModelTableRuntime],
];

const topicBase = 'UIPUT/ws/dam/pic/de';
const requestTopic = `${topicBase}/R1/3000/resource`;
const responseTopic = `${topicBase}/U1/2000/result`;

function mt(k, t, v, id = '0', p = 0, r = 0, c = 0) {
  return { id, p, r, c, k, t, v };
}

function rootLabel(rt, key) {
  return rt.getModel(0).getCell(0, 0, 0).labels.get(key) || null;
}

function cellLabel(model, key, p = 0, r = 0, c = 0) {
  return model.getCell(p, r, c).labels.get(key) || null;
}

function payloadValue(records, key, id = 0) {
  return Array.isArray(records)
    ? records.find((record) => record && record.id === id && record.k === key)?.v
    : undefined;
}

function payloadRecord(records, key, id = 1) {
  return Array.isArray(records)
    ? records.find((record) => record && record.id === id && record.k === key) || null
    : null;
}

function feishuResourceReportMessage() {
  return [
    mt('model_type', 'model.subtable', 'Data'),
    mt('model_type', 'model.single', 'Data.Single', '0', 0, 0, 1),
    mt('__mt_payload_kind', 'str', 'pin_payload.v1', '0', 0, 0, 1),
    mt('is_need_response', 'bool', true, '0', 0, 0, 1),
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
    mt('endpoint_pin', 'str', requestTopic, '0', 0, 1, 0),
    mt('response_pin', 'str', responseTopic, '0', 0, 1, 0),
    mt('model_type', 'model.single', 'Data.Single', '0', 0, 1, 1),
    mt('message_server', 'str', 'local', '0', 0, 1, 1),
    mt('between', 'str', 'DEM_V1N', '0', 0, 1, 1),
    mt('model_type', 'model.subtableconnection', 1, '0', 0, 2, 0),
    mt('model_type', 'model.subtable', 'Data', '0.1'),
    mt('model_name', 'model.name', 'payload', '0.1'),
    mt('sys_msg_type', 'str', 'resource.report', '0.1'),
    mt('type', 'str', 'UI', '0.1', 0, 0, 1),
    mt('resource', 'list', ['UI.app1', 'UI.app2'], '0.1', 0, 0, 1),
  ];
}

async function setupRuntime(Runtime, { createReplyTarget = true } = {}) {
  const rt = new Runtime();
  await rt.setRuntimeMode('edit');
  const model0 = rt.getModel(0);
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_topic_mode', t: 'str', v: 'uiput_mm_v1' });
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_topic_base', t: 'str', v: topicBase });
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_worker_id', t: 'str', v: 'U1' });
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_payload_mode', t: 'str', v: 'pin_payload_v1' });
  const replyTarget = createReplyTarget
    ? rt.createModel({ id: 2000, name: 'it0452_reply_target', type: 'test' })
    : null;
  if (replyTarget) {
    rt.addLabel(replyTarget, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'E2E.ReplyTarget' });
  }
  await rt.setRuntimeMode('running');
  const publishes = [];
  rt.mqttClient = {
    publish(topic, payload) {
      publishes.push({ topic, payload });
    },
  };
  return { rt, replyTarget, publishes };
}

function dispatchFeishuMessage(rt) {
  return rt.addLabel(rt.getModel(0), 0, 0, 0, {
    k: 'in3',
    t: 'pin.bus.cb.in',
    v: feishuResourceReportMessage(),
  });
}

function assertPublishedResponse(name, publishes) {
  assert.equal(publishes.length, 1, `${name}: exactly one response publish`);
  const published = publishes[0];
  assert.equal(published.topic, responseTopic, `${name}: response published to response topic`);
  assert.equal(published.payload?.type, 'pin_payload', `${name}: published payload type`);
  assert.equal(payloadValue(published.payload.payload, '__mt_payload_kind'), 'pin_payload.v2', `${name}: published packet kind`);
  assert.equal(payloadValue(published.payload.payload, 'message_role'), 'response', `${name}: published role`);
  assert.equal(payloadValue(published.payload.payload, 'topic'), responseTopic, `${name}: published topic`);
  assert.equal(payloadValue(published.payload.payload, 'response_topic'), responseTopic, `${name}: published response_topic`);
  assert.equal(payloadValue(published.payload.payload, 'reply_target_worker_id'), 'U1', `${name}: reply target worker`);
  assert.equal(payloadValue(published.payload.payload, 'reply_target_table_id'), 'host', `${name}: reply target table`);
  assert.equal(payloadValue(published.payload.payload, 'reply_target_model_id'), 2000, `${name}: reply target model`);
  assert.equal(payloadRecord(published.payload.payload, 'family')?.v, 'resource', `${name}: payload family`);
  assert.equal(payloadRecord(published.payload.payload, 'status')?.v, 'accepted', `${name}: payload status`);
  assert.equal(payloadRecord(published.payload.payload, 'handler_result')?.v?.action, 'report', `${name}: payload handler action`);
  return published;
}

function retargetPublishedResponse(published, { tableId, modelId }) {
  return {
    ...published.payload,
    payload: published.payload.payload.map((record) => {
      if (record && record.id === 0 && record.k === 'reply_target_table_id') {
        return { ...record, v: tableId };
      }
      if (record && record.id === 0 && record.k === 'reply_target_model_id') {
        return { ...record, v: modelId };
      }
      return { ...record };
    }),
  };
}

async function test_resource_response_publishes_and_materializes_to_reply_target() {
  for (const [name, Runtime] of runtimeVariants) {
    const { rt, replyTarget, publishes } = await setupRuntime(Runtime);

    const dispatched = dispatchFeishuMessage(rt);
    assert.equal(dispatched.applied, true, `${name}: Feishu message accepted`);
    assert.deepEqual(rootLabel(rt, 'feishu_resource_manager_catalog')?.v, {
      UI: ['UI.app1', 'UI.app2'],
    }, `${name}: resource handler state`);

    const published = assertPublishedResponse(name, publishes);
    const looped = rt.mqttIncoming(published.topic, published.payload);

    assert.equal(looped, true, `${name}: published response loopback accepted`);
    assert.equal(cellLabel(replyTarget, 'sys_msg_type')?.v, 'resource.report', `${name}: sys_msg_type materialized`);
    assert.equal(cellLabel(replyTarget, 'family')?.v, 'resource', `${name}: family materialized`);
    assert.equal(cellLabel(replyTarget, 'action')?.v, 'report', `${name}: action materialized`);
    assert.equal(cellLabel(replyTarget, 'status')?.v, 'accepted', `${name}: status materialized`);
    assert.equal(cellLabel(replyTarget, 'handler_result')?.v?.action, 'report', `${name}: handler result materialized`);
    assert.equal(cellLabel(replyTarget, 'result'), null, `${name}: endpoint pin.in must not be written`);
    assert.equal(rootLabel(rt, 'pin_payload_response_materialize_last_result')?.v?.status, 'applied', `${name}: materialization status`);
    assert.equal(rootLabel(rt, 'pin_payload_response_materialize_last_result')?.v?.reply_target_model_id, 2000, `${name}: materialization target`);
    assert.equal(publishes.some((entry) => entry.topic === requestTopic), false, `${name}: response never published to request topic`);
  }
}

async function test_loopback_missing_non_host_reply_target_rejects_without_host_fallback() {
  for (const [name, Runtime] of runtimeVariants) {
    const { rt, publishes } = await setupRuntime(Runtime, { createReplyTarget: true });
    const dispatched = dispatchFeishuMessage(rt);
    assert.equal(dispatched.applied, true, `${name}: Feishu message accepted before retarget`);
    const published = assertPublishedResponse(name, publishes);
    const missingTargetPacket = retargetPublishedResponse(published, {
      tableId: 'missing_app_table_0452',
      modelId: 0,
    });

    const looped = rt.mqttIncoming(published.topic, missingTargetPacket);

    assert.equal(looped, false, `${name}: missing non-host reply target rejected`);
    assert.equal(rootLabel(rt, 'pin_payload_response_materialize_last_result')?.v?.status, 'rejected', `${name}: rejection status`);
    assert.equal(rootLabel(rt, 'pin_payload_response_materialize_last_result')?.v?.reason, 'reply_target_model_not_found', `${name}: rejection reason`);
    assert.equal(rootLabel(rt, 'sys_msg_type'), null, `${name}: missing target must not fallback to host root`);
  }
}

const tests = [
  test_resource_response_publishes_and_materializes_to_reply_target,
  test_loopback_missing_non_host_reply_target_rejects_without_host_fallback,
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
