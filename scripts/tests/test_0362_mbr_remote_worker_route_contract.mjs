#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { WorkerEngineV0, buildWorkerHostApi, loadSystemPatch } from '../worker_engine_v0.mjs';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

function readJson(pathname) {
  return JSON.parse(fs.readFileSync(pathname, 'utf8'));
}

function getFunctionCode(label) {
  if (!label) return '';
  if (typeof label.v === 'string') return label.v;
  if (label.v && typeof label.v === 'object' && typeof label.v.code === 'string') return label.v.code;
  return '';
}

function mt(k, t, v) {
  return { id: 0, p: 0, r: 0, c: 0, k, t, v };
}

function tempPayload(text = 'hello endpoint') {
  return [
    mt('model_type', 'model.single', 'Data.MinimalSubmit'),
    mt('text', 'str', text),
  ];
}

function pinPayloadRecords({
  opId = '0362_endpoint_ok',
  endpointWorkerId = 'RE',
  endpointModelId = 3000,
  endpointPin = 'submit1',
  originWorkerId = 'ui-server-local',
  originModelId = 2000,
  originPin = 'submit1',
  replyTargetWorkerId = 'ui-server-local',
  replyTargetModelId = 2000,
  replyTargetPin = 'result',
  payload = tempPayload(),
  timestamp = 1700000000000,
} = {}) {
  return [
    mt('__mt_payload_kind', 'str', 'pin_payload.v1'),
    mt('__mt_request_id', 'str', opId),
    mt('op_id', 'str', opId),
    mt('endpoint_worker_id', 'str', endpointWorkerId),
    mt('endpoint_model_id', 'int', endpointModelId),
    mt('endpoint_pin', 'str', endpointPin),
    mt('origin_worker_id', 'str', originWorkerId),
    mt('origin_model_id', 'int', originModelId),
    mt('origin_pin', 'str', originPin),
    mt('reply_target_worker_id', 'str', replyTargetWorkerId),
    mt('reply_target_model_id', 'int', replyTargetModelId),
    mt('reply_target_pin', 'str', replyTargetPin),
    mt('payload', 'json', payload),
    mt('timestamp', 'int', timestamp),
  ];
}

function withoutRecords(records, keys) {
  const deny = new Set(keys);
  return records.filter((record) => !deny.has(record.k));
}

function externalPacket(records) {
  return { version: 'v1', type: 'pin_payload', payload: records };
}

function payloadRecord(records, key) {
  return Array.isArray(records) ? records.find((record) => record && record.k === key) || null : null;
}

function payloadString(records, key) {
  const record = payloadRecord(records, key);
  return record && record.t === 'str' ? record.v : '';
}

function payloadInt(records, key) {
  const record = payloadRecord(records, key);
  return record && record.t === 'int' ? record.v : null;
}

function payloadJson(records, key) {
  const record = payloadRecord(records, key);
  return record && record.t === 'json' ? record.v : null;
}

function loadMbrRuntime() {
  const rt = new ModelTableRuntime();
  loadSystemPatch(rt);
  if (!rt.getModel(-10)) rt.createModel({ id: -10, name: 'system', type: 'system' });
  rt.applyPatch(readJson('deploy/sys-v1ns/mbr/patches/mbr_role_v0.json'), {
    allowCreateModel: true,
    trustedBootstrap: true,
  });
  return rt;
}

function loadRemoteRuntime() {
  const rt = new ModelTableRuntime();
  loadSystemPatch(rt);
  if (!rt.getModel(-10)) rt.createModel({ id: -10, name: 'system', type: 'system' });
  for (const pathname of [
    'deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json',
    'deploy/sys-v1ns/remote-worker/patches/13_model3000_minimal_submit.json',
  ]) {
    rt.applyPatch(readJson(pathname), {
      allowCreateModel: true,
      trustedBootstrap: true,
    });
  }
  return rt;
}

async function wait(ms = 80) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function toExternalPinPacket(rt, label) {
  if (!label || typeof rt._pinBusOutValueToExternalPayload !== 'function') return null;
  return rt._pinBusOutValueToExternalPayload(label.v);
}

function drainWorkerEngine(rt, options = {}) {
  const mqttPublished = [];
  const mgmtPublished = [];
  const engine = new WorkerEngineV0({
    runtime: rt,
    mqttPublish: options.mqttPublish || ((topic, payload) => mqttPublished.push({ topic, payload })),
    mgmtAdapter: options.mgmtAdapter || {
      publish: async (event) => mgmtPublished.push(event),
    },
  });
  if (!rt.isRuntimeRunning || !rt.isRuntimeRunning()) {
    if (!rt.getRuntimeMode || rt.getRuntimeMode() === 'boot') rt.setRuntimeMode('edit');
    rt.setRuntimeMode('running');
  }
  engine.tick();
  return { mqttPublished, mgmtPublished };
}

function test_no_static_mbr_route_or_model_subscription_residue() {
  const system = readJson('packages/worker-base/system-models/system_models.json');
  const mbr = readJson('deploy/sys-v1ns/mbr/patches/mbr_role_v0.json');
  const config = readJson('deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json');
  const workerBootstrap = fs.readFileSync('scripts/run_worker_v0.mjs', 'utf8');
  const systemText = JSON.stringify(system);
  const mbrText = JSON.stringify(mbr);
  const subscriptions = config.records.find((record) => record && record.k === 'remote_subscriptions')?.v || [];
  const workerId = config.records.find((record) => record && record.k === 'mqtt_worker_id')?.v || '';

  assert.equal(systemText.includes('mbr_route_'), false, 'system model must not seed mbr_route_*');
  assert.equal(mbrText.includes('mbr_route_'), false, 'MBR patch must not read mbr_route_*');
  assert.equal(mbrText.includes('mbr_mqtt_model_ids'), false, 'MBR patch must not seed static MQTT model ids');
  assert.equal(workerId, 'RE', 'remote-worker runtime must declare its worker id for topic guard');
  assert.deepEqual(subscriptions, [
    'UIPUT/ws/dam/pic/de/sw/RE/100/submit',
    'UIPUT/ws/dam/pic/de/sw/RE/1010/submit',
    'UIPUT/ws/dam/pic/de/sw/RE/1019/submit',
    'UIPUT/ws/dam/pic/de/sw/RE/3000/submit1',
  ], 'remote-worker subscriptions must be unified worker/model/pin endpoint topics only');
  assert.equal(
    workerBootstrap.includes('$' + '{base}/+/+/+'),
    true,
    'worker bootstrap must subscribe to the unified worker/model/pin wildcard topic',
  );
  assert.equal(
    workerBootstrap.includes('$' + '{base}/worker/+/model/+/pin/+'),
    false,
    'worker bootstrap must not subscribe through old worker/model/pin wildcard topics',
  );
  return { key: 'no_static_mbr_route_or_model_subscription_residue', status: 'PASS' };
}

function test_remote_worker_patches_do_not_keep_raw_result_fallbacks() {
  for (const pathname of [
    'deploy/sys-v1ns/remote-worker/patches/10_model100.json',
    'deploy/sys-v1ns/remote-worker/patches/11_model1010.json',
    'deploy/sys-v1ns/remote-worker/patches/12_model1019.json',
    'deploy/sys-v1ns/remote-worker/patches/13_model3000_minimal_submit.json',
  ]) {
    const text = fs.readFileSync(pathname, 'utf8');
    assert.equal(text.includes('ctx.publishMqtt'), false, pathname + ' must not publish transport directly');
    assert.equal(text.includes('source_model_id'), false, pathname + ' must not use legacy source_model_id metadata');
    assert.equal(text.includes('reply_to'), false, pathname + ' must not use legacy reply_to metadata');
    assert.equal(text.includes("k === 'route'"), false, pathname + ' must not read legacy route records');
    assert.equal(text.includes('return buildReplyBusPayload(resultPayload) || resultPayload;'), false, pathname + ' must not keep raw result fallback');
    assert.equal(text.includes('return resultPayload;'), false, pathname + ' must not return raw public result payload');
    assert.equal(text.includes('return payload;'), false, pathname + ' must not return raw public input payload');
  }
  return { key: 'remote_worker_patches_do_not_keep_raw_result_fallbacks', status: 'PASS' };
}

function test_mbr_uses_endpoint_records_and_rejects_missing_endpoint() {
  const rt = loadMbrRuntime();
  const sys = rt.getModel(-10);
  const fn = new Function('ctx', getFunctionCode(rt.getCell(sys, 0, 0, 0).labels.get('mbr_mgmt_to_mqtt')));
  rt.addLabel(sys, 0, 0, 0, {
    k: 'mbr_mgmt_inbox',
    t: 'json',
    v: externalPacket(pinPayloadRecords({ opId: '0362_endpoint_ok', payload: tempPayload('mbr endpoint') })),
  });
  fn({ hostApi: buildWorkerHostApi(rt) });
  const cbOut = rt.getCell(rt.getModel(0), 0, 0, 0).labels.get('mbr_cb_out');
  const packet = toExternalPinPacket(rt, cbOut);
  assert.equal(cbOut?.t, 'pin.bus.cb.out', 'MBR must write endpoint packet to control-bus out pin');
  assert.equal(packet?.type, 'pin_payload', 'control-bus out pin must carry pin_payload');
  assert.deepEqual(Object.keys(packet).sort(), ['payload', 'type', 'version'], 'MBR transport packet must not carry loose route/source/pin fields');
  const { mqttPublished: published } = drainWorkerEngine(rt);
  assert.equal(published.length, 1, 'MBR must publish endpoint-addressed packet');
  assert.equal(published[0].topic, 'UIPUT/ws/dam/pic/de/sw/RE/3000/submit1', 'MBR topic must come from endpoint records');
  assert.equal(payloadString(published[0].payload.payload, 'origin_worker_id'), 'ui-server-local', 'MBR must preserve local origin worker id');
  assert.equal(payloadInt(published[0].payload.payload, 'origin_model_id'), 2000, 'MBR must preserve local origin model id');
  assert.equal(payloadString(published[0].payload.payload, 'reply_target_worker_id'), 'ui-server-local', 'MBR must preserve server-owned reply target');

  rt.addLabel(sys, 0, 0, 0, {
    k: 'mbr_mgmt_inbox',
    t: 'json',
    v: externalPacket(withoutRecords(pinPayloadRecords({ opId: '0362_endpoint_missing' }), ['endpoint_worker_id'])),
  });
  fn({ hostApi: buildWorkerHostApi(rt) });
  assert.equal(published.length, 1, 'missing endpoint records must not publish');
  assert.equal(rt.getCell(sys, 0, 0, 0).labels.get('mbr_mgmt_error')?.v?.detail, 'invalid_pin_payload_records', 'missing endpoint rejection must be explicit');
  return { key: 'mbr_uses_endpoint_records_and_rejects_missing_endpoint', status: 'PASS' };
}

function test_mbr_does_not_echo_own_control_publish_to_management_bus() {
  const rt = loadMbrRuntime();
  const sys = rt.getModel(-10);
  const mgmtFn = new Function('ctx', getFunctionCode(rt.getCell(sys, 0, 0, 0).labels.get('mbr_mgmt_to_mqtt')));
  const mqttFn = new Function('ctx', getFunctionCode(rt.getCell(sys, 0, 0, 0).labels.get('mbr_mqtt_to_mgmt')));

  rt.addLabel(sys, 0, 0, 0, {
    k: 'mbr_mgmt_inbox',
    t: 'json',
    v: externalPacket(pinPayloadRecords({ opId: '0362_no_echo', payload: tempPayload('no echo') })),
  });
  mgmtFn({ hostApi: buildWorkerHostApi(rt) });
  const { mqttPublished: published } = drainWorkerEngine(rt);
  assert.equal(published.length, 1, 'MBR must publish the outbound MQTT packet once');

  rt.addLabel(sys, 0, 0, 0, {
    k: 'mbr_mqtt_inbox',
    t: 'json',
    v: { topic: published[0].topic, payload: published[0].payload },
  });
  mqttFn({ hostApi: buildWorkerHostApi(rt) });
  assert.equal(rt.getCell(rt.getModel(0), 0, 0, 0).labels.get('mbr_mb_out')?.v, null, 'MBR must not bridge its own endpoint request back to Matrix');
  return { key: 'mbr_does_not_echo_own_control_publish_to_management_bus', status: 'PASS' };
}

function test_mbr_mqtt_inbound_bridges_remote_reply_to_management_bus() {
  const rt = loadMbrRuntime();
  const sys = rt.getModel(-10);
  const mqttFn = new Function('ctx', getFunctionCode(rt.getCell(sys, 0, 0, 0).labels.get('mbr_mqtt_to_mgmt')));
  const replyRecords = pinPayloadRecords({
    opId: '0362_remote_reply',
    endpointWorkerId: 'ui-server-local',
    endpointModelId: 2000,
    endpointPin: 'result',
    originWorkerId: 'RE',
    originModelId: 3000,
    originPin: 'submit1',
    replyTargetWorkerId: 'ui-server-local',
    replyTargetModelId: 2000,
    replyTargetPin: 'result',
    payload: [mt('display_text', 'str', 'Submitted: from remote')],
  });
  rt.addLabel(sys, 0, 0, 0, {
    k: 'mbr_mqtt_inbox',
    t: 'json',
    v: { topic: 'UIPUT/ws/dam/pic/de/sw/ui-server-local/2000/result', payload: externalPacket(replyRecords) },
  });
  mqttFn({ hostApi: buildWorkerHostApi(rt) });
  const mbOut = rt.getCell(rt.getModel(0), 0, 0, 0).labels.get('mbr_mb_out');
  const packet = toExternalPinPacket(rt, mbOut);
  assert.equal(mbOut?.t, 'pin.bus.mb.out', 'MBR must bridge remote replies to management-bus out pin');
  assert.equal(payloadString(packet.payload, 'endpoint_worker_id'), 'ui-server-local', 'remote reply endpoint must be preserved');
  assert.equal(payloadJson(packet.payload, 'payload')?.find((record) => record.k === 'display_text')?.v, 'Submitted: from remote', 'remote reply payload must be preserved');
  return { key: 'mbr_mqtt_inbound_bridges_remote_reply_to_management_bus', status: 'PASS' };
}

async function test_remote_worker_submit1_receives_endpoint_and_replies_to_reply_target() {
  const rt = loadRemoteRuntime();
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  const accepted = rt.mqttIncoming('UIPUT/ws/dam/pic/de/sw/RE/3000/submit1', externalPacket(pinPayloadRecords({
    opId: '0362_remote_submit',
    payload: tempPayload('browser submit'),
  })));
  assert.equal(accepted, true, 'remote runtime must accept unified submit1 endpoint topic');
  await wait();
  const model = rt.getModel(3000);
  const root = rt.getCell(model, 0, 0, 0).labels;
  const resultValue = root.get('result')?.v;
  assert.equal(payloadJson(resultValue, 'payload')?.find((record) => record.k === 'display_text')?.v, 'Submitted: browser submit', 'remote submit handler must emit provider result pin payload');
  const { mqttPublished: published } = drainWorkerEngine(rt);
  assert.equal(published.length, 1, 'remote submit handler must publish one reply');
  assert.equal(published[0].topic, 'UIPUT/ws/dam/pic/de/sw/ui-server-local/2000/result', 'reply topic must come from reply target records');
  assert.equal(payloadString(published[0].payload.payload, 'endpoint_worker_id'), 'ui-server-local', 'reply payload endpoint must target UI server');
  assert.equal(payloadString(published[0].payload.payload, 'origin_worker_id'), 'RE', 'reply payload origin must be remote worker');
  assert.equal(payloadJson(published[0].payload.payload, 'payload')?.find((record) => record.k === 'display_text')?.v, 'Submitted: browser submit', 'reply payload must carry display_text');
  return { key: 'remote_worker_submit1_receives_endpoint_and_replies_to_reply_target', status: 'PASS' };
}

async function test_runtime_rejects_legacy_business_route_record() {
  const rt = loadRemoteRuntime();
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  const accepted = rt.mqttIncoming('UIPUT/ws/dam/pic/de/sw/RE/3000/submit1', externalPacket(pinPayloadRecords({
    opId: '0362_reject_business_route',
    payload: [
      mt('route', 'json', { to: { worker_id: 'RE', model_id: 3000, pin: 'submit1' } }),
      ...tempPayload('route shadow'),
    ],
  })));
  assert.equal(accepted, false, 'runtime must reject legacy route records even inside business payload');
  const { mqttPublished: published } = drainWorkerEngine(rt);
  assert.equal(published.length, 0, 'rejected legacy business route must not publish a reply');
  return { key: 'runtime_rejects_legacy_business_route_record', status: 'PASS' };
}

async function test_remote_worker_rejects_missing_reply_target_without_public_result() {
  const rt = loadRemoteRuntime();
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  const accepted = rt.mqttIncoming('UIPUT/ws/dam/pic/de/sw/RE/3000/submit1', externalPacket(withoutRecords(pinPayloadRecords({
    opId: '0362_missing_reply_target',
    payload: tempPayload('missing reply target'),
  }), ['reply_target_worker_id', 'reply_target_model_id', 'reply_target_pin'])));
  assert.equal(accepted, false, 'remote runtime must reject packets missing reply target records at ingress');
  const model = rt.getModel(3000);
  const root = rt.getCell(model, 0, 0, 0).labels;
  assert.equal(root.get('result')?.v, null, 'missing reply target must not write public result pin');
  const { mqttPublished: published } = drainWorkerEngine(rt);
  assert.equal(published.length, 0, 'missing reply target must not publish a public bus result');
  return { key: 'remote_worker_rejects_missing_reply_target_without_public_result', status: 'PASS' };
}

async function test_remote_worker_rejects_invalid_reply_target_without_public_result() {
  const rt = loadRemoteRuntime();
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  const accepted = rt.mqttIncoming('UIPUT/ws/dam/pic/de/sw/RE/3000/submit1', externalPacket(pinPayloadRecords({
    opId: '0362_invalid_reply_target',
    replyTargetWorkerId: '',
    replyTargetModelId: -1,
    replyTargetPin: 'bad/pin',
    payload: tempPayload('invalid reply target'),
  })));
  assert.equal(accepted, false, 'remote runtime must reject invalid reply target records at ingress');
  const model = rt.getModel(3000);
  const root = rt.getCell(model, 0, 0, 0).labels;
  assert.equal(root.get('result')?.v, null, 'invalid reply target must not write public result pin');
  const { mqttPublished: published } = drainWorkerEngine(rt);
  assert.equal(published.length, 0, 'invalid reply target must not publish a public bus result');
  return { key: 'remote_worker_rejects_invalid_reply_target_without_public_result', status: 'PASS' };
}

function test_mbr_mqtt_inbound_rejects_invalid_temporary_modeltable_records() {
  const rt = loadMbrRuntime();
  const sys = rt.getModel(-10);
  const fn = new Function('ctx', getFunctionCode(rt.getCell(sys, 0, 0, 0).labels.get('mbr_mqtt_to_mgmt')));
  rt.addLabel(sys, 0, 0, 0, {
    k: 'mbr_mqtt_inbox',
    t: 'json',
    v: {
      topic: 'UIPUT/ws/dam/pic/de/sw/ui-server-local/2000/result',
      payload: externalPacket(pinPayloadRecords({
        opId: '0362_bad_mqtt_payload',
        endpointWorkerId: 'ui-server-local',
        endpointModelId: 2000,
        endpointPin: 'result',
        originWorkerId: 'RE',
        originModelId: 3000,
        originPin: 'submit1',
        replyTargetWorkerId: 'ui-server-local',
        replyTargetModelId: 2000,
        replyTargetPin: 'result',
        payload: [{ id: 0, p: 0, r: 0, c: 0, k: 'display_text', t: 'str' }],
      })),
    },
  });
  fn({ hostApi: buildWorkerHostApi(rt) });
  assert.equal(rt.getCell(rt.getModel(0), 0, 0, 0).labels.get('mbr_mb_out')?.v, null, 'invalid MQTT inbound payload must not be bridged to management-bus out pin');
  assert.equal(
    rt.getCell(sys, 0, 0, 0).labels.get('mbr_mqtt_error')?.v?.detail,
    'invalid_pin_payload_records',
    'invalid MQTT inbound payload rejection must be visible',
  );
  return { key: 'mbr_mqtt_inbound_rejects_invalid_temporary_modeltable_records', status: 'PASS' };
}

const tests = [
  test_no_static_mbr_route_or_model_subscription_residue,
  test_remote_worker_patches_do_not_keep_raw_result_fallbacks,
  test_mbr_uses_endpoint_records_and_rejects_missing_endpoint,
  test_mbr_does_not_echo_own_control_publish_to_management_bus,
  test_mbr_mqtt_inbound_bridges_remote_reply_to_management_bus,
  test_remote_worker_submit1_receives_endpoint_and_replies_to_reply_target,
  test_runtime_rejects_legacy_business_route_record,
  test_remote_worker_rejects_missing_reply_target_without_public_result,
  test_remote_worker_rejects_invalid_reply_target_without_public_result,
  test_mbr_mqtt_inbound_rejects_invalid_temporary_modeltable_records,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    const result = await test();
    console.log('[' + result.status + '] ' + result.key);
    passed += 1;
  } catch (error) {
    console.log('[FAIL] ' + test.name + ': ' + (error && error.stack ? error.stack : error));
    failed += 1;
  }
}

console.log('\n' + passed + ' passed, ' + failed + ' failed out of ' + tests.length);
process.exit(failed > 0 ? 1 : 0);
