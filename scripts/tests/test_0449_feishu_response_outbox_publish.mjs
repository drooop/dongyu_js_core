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
  endpointPin = requestTopic,
  responsePin = responseTopic,
  isNeedResponse = true,
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
    mt('model_type', 'model.subtable', 'Data', '0.1'),
    mt('model_name', 'model.name', 'payload', '0.1'),
    mt('sys_msg_type', 'str', 'resource.report', '0.1'),
    mt('type', 'str', 'UI', '0.1', 0, 0, 1),
    mt('resource', 'list', ['UI.app1'], '0.1', 0, 0, 1),
  ];
}

function dispatch(rt, message) {
  return rt.addLabel(rt.getModel(0), 0, 0, 0, {
    k: 'in3',
    t: 'pin.bus.cb.in',
    v: message,
  });
}

async function setRunning(rt) {
  await rt.setRuntimeMode('edit');
  await rt.setRuntimeMode('running');
}

async function setEdit(rt) {
  await rt.setRuntimeMode('edit');
}

function installPublishRecorder(rt) {
  const publishes = [];
  rt.mqttClient = {
    publish(topic, payload) {
      publishes.push({ topic, payload });
    },
  };
  return publishes;
}

async function test_running_runtime_publishes_response_outbox_to_response_pin() {
  for (const [name, Runtime] of runtimeVariants) {
    const rt = new Runtime();
    await setRunning(rt);
    const publishes = installPublishRecorder(rt);

    const result = dispatch(rt, feishuMessage({}));

    assert.equal(result.applied, true, `${name}: Feishu message must be accepted`);
    assert.equal(publishes.length, 1, `${name}: response outbox publish count`);
    assert.equal(publishes[0].topic, responseTopic, `${name}: publish target must be response_pin`);
    assert.equal(payloadValue(publishes[0].payload.payload, 'message_role'), 'response', `${name}: published packet role`);
    assert.equal(payloadValue(publishes[0].payload.payload, 'topic'), responseTopic, `${name}: published packet topic`);
    assert.equal(payloadValue(publishes[0].payload.payload, 'response_topic'), responseTopic, `${name}: published packet response_topic`);
    assert.equal(payloadRecords(publishes[0].payload.payload).find((record) => record.k === 'family')?.v, 'resource', `${name}: published payload family`);
    assert.equal(label(rt, 'feishu_message_api_response_last_result')?.v?.publish_status, 'published', `${name}: visible publish status`);
    assert.equal(label(rt, 'feishu_message_api_response_last_result')?.v?.publish_topic, responseTopic, `${name}: visible publish topic`);
    assert.equal(
      publishes.some((entry) => entry.topic === requestTopic),
      false,
      `${name}: response outbox must not publish to request topic`,
    );
  }
}

async function test_edit_runtime_records_prepared_without_publish() {
  for (const [name, Runtime] of runtimeVariants) {
    const rt = new Runtime();
    await setEdit(rt);
    const publishes = installPublishRecorder(rt);

    const result = dispatch(rt, feishuMessage({}));

    assert.equal(result.applied, true, `${name}: edit-mode Feishu message must be accepted`);
    assert.equal(publishes.length, 0, `${name}: edit-mode must not publish`);
    assert.equal(label(rt, 'feishu_message_api_response_out')?.t, 'pin.bus.cb.out', `${name}: edit-mode still prepares outbox`);
    assert.equal(label(rt, 'feishu_message_api_response_last_result')?.v?.publish_status, 'prepared_not_published', `${name}: visible prepared status`);
  }
}

async function test_invalid_response_pin_does_not_publish_in_running_runtime() {
  for (const [name, Runtime] of runtimeVariants) {
    const rt = new Runtime();
    await setRunning(rt);
    const publishes = installPublishRecorder(rt);

    const result = dispatch(rt, feishuMessage({
      responsePin: 'UIPUT/ws/dam/pic/de/U1/0.2000/result',
    }));

    assert.equal(result.applied, true, `${name}: invalid response pin message remains accepted`);
    assert.equal(publishes.length, 0, `${name}: invalid response pin must not publish`);
    assert.equal(label(rt, 'feishu_message_api_response_out'), null, `${name}: invalid response pin must not keep outbox`);
    assert.equal(label(rt, 'feishu_message_api_response_last_result')?.v?.status, 'skipped', `${name}: skipped status`);
    assert.equal(label(rt, 'feishu_message_api_response_last_result')?.v?.reason, 'invalid_response_pin', `${name}: skipped reason`);
  }
}

const tests = [
  test_running_runtime_publishes_response_outbox_to_response_pin,
  test_edit_runtime_records_prepared_without_publish,
  test_invalid_response_pin_does_not_publish_in_running_runtime,
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
