#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { WorkerEngineV0, buildWorkerHostApi, loadSystemPatch } from '../worker_engine_v0.mjs';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');
const workerRunnerModule = await import('../run_worker_v0.mjs');

function readJson(pathname) {
  return JSON.parse(fs.readFileSync(pathname, 'utf8'));
}

function getFunctionCode(label) {
  if (!label) return '';
  if (typeof label.v === 'string') return label.v;
  if (label.v && typeof label.v === 'object' && typeof label.v.code === 'string') return label.v.code;
  return '';
}

function mt(k, t, v, id = 0) {
  return { id, p: 0, r: 0, c: 0, k, t, v };
}

function tempPayload(text = 'hello endpoint') {
  return [
    mt('model_type', 'model.table', 'Data.MinimalSubmit'),
    mt('text', 'str', text),
  ];
}

function pinPayloadRecords({
  opId = '0362_endpoint_ok',
  endpointWorkerId = 'R1',
  endpointTableId = 'host',
  endpointModelId = 3000,
  endpointPin = 'submit1',
  originWorkerId = 'U1',
  originTableId = 'host',
  originModelId = 2000,
  originPin = 'submit1',
  replyTargetWorkerId = 'U1',
  replyTargetTableId = 'host',
  replyTargetModelId = 2000,
  replyTargetPin = 'result',
  messageRole = 'request',
  payload = tempPayload(),
  timestamp = 1700000000000,
  topic = `UIPUT/ws/dam/pic/de/${endpointWorkerId}/${endpointModelId}/${endpointPin}`,
  responseTopic = `UIPUT/ws/dam/pic/de/${replyTargetWorkerId}/${replyTargetModelId}/${replyTargetPin}`,
  routeKind = 'control',
  payloadModelId = 1,
} = {}) {
  return [
    mt('__mt_payload_kind', 'str', 'pin_payload.v2'),
    mt('__mt_request_id', 'str', opId),
    mt('op_id', 'str', opId),
    mt('message_role', 'str', messageRole),
    mt('topic', 'str', topic),
    mt('response_topic', 'str', responseTopic),
    mt('route_kind', 'str', routeKind),
    mt('bus', 'str', routeKind),
    mt('endpoint_worker_id', 'str', endpointWorkerId),
    mt('endpoint_table_id', 'str', endpointTableId),
    mt('endpoint_model_id', 'int', endpointModelId),
    mt('endpoint_pin', 'str', endpointPin),
    mt('origin_worker_id', 'str', originWorkerId),
    mt('origin_table_id', 'str', originTableId),
    mt('origin_model_id', 'int', originModelId),
    mt('origin_pin', 'str', originPin),
    mt('reply_target_worker_id', 'str', replyTargetWorkerId),
    mt('reply_target_table_id', 'str', replyTargetTableId),
    mt('reply_target_model_id', 'int', replyTargetModelId),
    mt('reply_target_pin', 'str', replyTargetPin),
    mt('payload_model_id', 'int', payloadModelId),
    mt('timestamp', 'int', timestamp),
    ...payload.map((record) => ({ ...record, id: payloadModelId })),
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

function businessRecords(records) {
  const payloadModelId = payloadInt(records, 'payload_model_id');
  return Number.isInteger(payloadModelId)
    ? records.filter((record) => record && record.id === payloadModelId)
    : [];
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

async function writeMbrIngress(rt, key, type, records) {
  if (!rt.isRuntimeRunning || !rt.isRuntimeRunning()) {
    if (!rt.getRuntimeMode || rt.getRuntimeMode() === 'boot') rt.setRuntimeMode('edit');
    rt.setRuntimeMode('running');
  }
  const result = rt.addLabel(rt.getModel(0), 0, 0, 0, { k: key, t: type, v: records });
  await wait();
  return result;
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
  assert.equal(workerId, 'R1', 'remote-worker runtime must declare its worker id for topic guard');
  assert.deepEqual(subscriptions, [
    'UIPUT/ws/dam/pic/de/R1/100/submit',
    'UIPUT/ws/dam/pic/de/R1/1010/submit',
    'UIPUT/ws/dam/pic/de/R1/1019/submit',
    'UIPUT/ws/dam/pic/de/R1/3000/submit1',
    'UIPUT/ws/dam/pic/de/R1/3100/bundle_request',
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
    assert.equal(text.includes('parts.every((part) => part.length > 0)'), false, pathname + ' must not keep weaker topic segment validation');
    assert.equal(text.includes("value.trim() === value && parts.length === 8"), true, pathname + ' must reject untrimmed topic strings');
    assert.equal(text.includes('parts.every((part) => safeSegment(part))'), true, pathname + ' must validate every topic segment with safeSegment');
    assert.equal(text.includes('/^[1-9][0-9]*$/.test(parts[6])'), true, pathname + ' must require canonical positive model id in topic');
  }
  return { key: 'remote_worker_patches_do_not_keep_raw_result_fallbacks', status: 'PASS' };
}

async function test_mbr_routes_by_topic_and_rejects_missing_endpoint_metadata() {
  const rt = loadMbrRuntime();
  const sys = rt.getModel(-10);
  const records = pinPayloadRecords({ opId: '0362_endpoint_ok', routeKind: 'management', payload: tempPayload('mbr endpoint') });
  await writeMbrIngress(rt, 'mbr_mb_in', 'pin.bus.mb.in', records);
  const cbOut = rt.getCell(rt.getModel(0), 0, 0, 0).labels.get('mbr_cb_out');
  const packet = toExternalPinPacket(rt, cbOut);
  assert.equal(cbOut?.t, 'pin.bus.cb.out', 'MBR must write endpoint packet to control-bus out pin');
  assert.equal(packet?.type, 'pin_payload', 'control-bus out pin must carry pin_payload');
  assert.deepEqual(Object.keys(packet).sort(), ['payload', 'type', 'version'], 'MBR transport packet must not carry loose route/source/pin fields');
  const { mqttPublished: published } = drainWorkerEngine(rt);
  assert.equal(published.length, 1, 'MBR must publish endpoint-addressed packet');
  assert.equal(published[0].topic, 'UIPUT/ws/dam/pic/de/R1/3000/submit1', 'MBR topic must come from payload topic record');
  assert.equal(payloadString(published[0].payload.payload, 'origin_worker_id'), 'U1', 'MBR must preserve local origin worker id');
  assert.equal(payloadInt(published[0].payload.payload, 'origin_model_id'), 2000, 'MBR must preserve local origin model id');
  assert.equal(payloadString(published[0].payload.payload, 'reply_target_worker_id'), 'U1', 'MBR must preserve server-owned reply target');

  await writeMbrIngress(rt, 'mbr_mb_in', 'pin.bus.mb.in', withoutRecords(pinPayloadRecords({
    opId: '0362_endpoint_missing',
    routeKind: 'management',
  }), ['endpoint_worker_id']));
  assert.equal(published.length, 1, 'missing endpoint records must not publish');
  assert.equal(rt.getCell(rt.getModel(0), 0, 0, 0).labels.get('mbr_cb_out')?.v ?? null, null, 'missing endpoint records must fail before egress');
  assert.equal(
    rt.getCell(rt.getModel(0), 0, 0, 0).labels.get('bus_in_error')?.v?.code,
    'bus_in_invalid_pin_payload_records',
    'missing endpoint rejection must remain visible on Model 0',
  );
  return { key: 'mbr_routes_by_topic_and_rejects_missing_endpoint_metadata', status: 'PASS' };
}

async function test_mbr_does_not_echo_own_control_publish_to_management_bus() {
  const rt = loadMbrRuntime();
  await writeMbrIngress(rt, 'mbr_mb_in', 'pin.bus.mb.in', pinPayloadRecords({
    opId: '0362_no_echo',
    routeKind: 'management',
    payload: tempPayload('no echo'),
  }));
  const { mqttPublished: published } = drainWorkerEngine(rt);
  assert.equal(published.length, 1, 'MBR must publish the outbound MQTT packet once');

  await writeMbrIngress(rt, 'mbr_cb_in', 'pin.bus.cb.in', published[0].payload.payload);
  assert.equal(rt.getCell(rt.getModel(0), 0, 0, 0).labels.get('mbr_mb_out')?.v, null, 'MBR must not bridge its own endpoint request back to Matrix');
  return { key: 'mbr_does_not_echo_own_control_publish_to_management_bus', status: 'PASS' };
}

async function test_mbr_mqtt_inbound_does_not_echo_direct_control_reply() {
  const rt = loadMbrRuntime();
  const replyRecords = pinPayloadRecords({
    opId: '0362_remote_reply',
    messageRole: 'response',
    topic: 'UIPUT/ws/dam/pic/de/U1/2000/result',
    responseTopic: 'UIPUT/ws/dam/pic/de/U1/2000/result',
    endpointWorkerId: 'U1',
    endpointModelId: 2000,
    endpointPin: 'result',
    originWorkerId: 'R1',
    originModelId: 3000,
    originPin: 'submit1',
    replyTargetWorkerId: 'U1',
    replyTargetModelId: 2000,
    replyTargetPin: 'result',
    payload: [mt('display_text', 'str', 'Submitted: from remote')],
  });
  await writeMbrIngress(rt, 'mbr_cb_in', 'pin.bus.cb.in', replyRecords);
  const root = rt.getCell(rt.getModel(0), 0, 0, 0).labels;
  assert.equal(root.get('mbr_cb_out')?.v ?? null, null, 'MBR must not echo a direct control reply to MQTT');
  assert.equal(root.get('mbr_mb_out')?.v ?? null, null, 'direct control reply must not enter the management bus');
  assert.equal(
    rt.getCell(rt.getModel(-10), 0, 0, 0).labels.get('mbr_mqtt_error')?.v?.detail,
    'invalid_response_route',
    'direct control reply must be rejected visibly when injected into the bridge role',
  );
  return { key: 'mbr_mqtt_inbound_does_not_echo_direct_control_reply', status: 'PASS' };
}

async function test_remote_worker_submit1_receives_endpoint_and_replies_on_response_topic() {
  const rt = loadRemoteRuntime();
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  const accepted = rt.mqttIncoming('UIPUT/ws/dam/pic/de/R1/3000/submit1', externalPacket(pinPayloadRecords({
    opId: '0362_remote_submit',
    payload: tempPayload('browser submit'),
  })));
  assert.equal(accepted, true, 'remote runtime must accept unified submit1 endpoint topic');
  await wait();
  const model = rt.getModel(3000);
  const root = rt.getCell(model, 0, 0, 0).labels;
  const resultValue = root.get('result')?.v;
  assert.equal(businessRecords(resultValue).find((record) => record.k === 'display_text')?.v, 'Submitted: browser submit', 'remote submit handler must emit provider result pin payload');
  const { mqttPublished: published } = drainWorkerEngine(rt);
  assert.equal(published.length, 1, 'remote submit handler must publish one reply');
  assert.equal(published[0].topic, 'UIPUT/ws/dam/pic/de/U1/2000/result', 'reply topic must use response_topic');
  assert.equal(payloadString(published[0].payload.payload, 'message_role'), 'response', 'reply payload must mark response role');
  assert.equal(payloadString(published[0].payload.payload, 'endpoint_worker_id'), 'U1', 'reply payload endpoint must match reply target');
  assert.equal(payloadString(published[0].payload.payload, 'reply_target_worker_id'), 'U1', 'reply payload carries UI Server target in records');
  assert.equal(payloadString(published[0].payload.payload, 'origin_worker_id'), 'R1', 'reply payload origin must be remote worker');
  assert.equal(businessRecords(published[0].payload.payload).find((record) => record.k === 'display_text')?.v, 'Submitted: browser submit', 'reply payload must carry display_text');
  return { key: 'remote_worker_submit1_receives_endpoint_and_replies_on_response_topic', status: 'PASS' };
}

async function test_runtime_rejects_legacy_business_route_record() {
  const rt = loadRemoteRuntime();
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  const accepted = rt.mqttIncoming('UIPUT/ws/dam/pic/de/R1/3000/submit1', externalPacket(pinPayloadRecords({
    opId: '0362_reject_business_route',
    payload: [
      mt('route', 'json', { to: { worker_id: 'R1', model_id: 3000, pin: 'submit1' } }),
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
  const accepted = rt.mqttIncoming('UIPUT/ws/dam/pic/de/R1/3000/submit1', externalPacket(withoutRecords(pinPayloadRecords({
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
  const accepted = rt.mqttIncoming('UIPUT/ws/dam/pic/de/R1/3000/submit1', externalPacket(pinPayloadRecords({
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

async function test_mbr_mqtt_inbound_rejects_invalid_temporary_modeltable_records() {
  const rt = loadMbrRuntime();
  const sys = rt.getModel(-10);
  await writeMbrIngress(rt, 'mbr_cb_in', 'pin.bus.cb.in', pinPayloadRecords({
        opId: '0362_bad_mqtt_payload',
        messageRole: 'response',
        topic: 'UIPUT/ws/dam/pic/de/U1/2000/result',
        responseTopic: 'UIPUT/ws/dam/pic/de/U1/2000/result',
        endpointWorkerId: 'U1',
        endpointModelId: 2000,
        endpointPin: 'result',
        originWorkerId: 'R1',
        originModelId: 3000,
        originPin: 'submit1',
        replyTargetWorkerId: 'U1',
        replyTargetModelId: 2000,
        replyTargetPin: 'result',
        payload: [{ id: 0, p: 0, r: 0, c: 0, k: 'display_text', t: 'str' }],
      }));
  assert.equal(rt.getCell(rt.getModel(0), 0, 0, 0).labels.get('mbr_mb_out')?.v, null, 'invalid MQTT inbound payload must not be bridged to management-bus out pin');
  assert.equal(rt.getCell(sys, 0, 0, 0).labels.get('mbr_mb_egress')?.v ?? null, null, 'invalid records must not reach the child egress');
  assert.equal(rt.getCell(rt.getModel(0), 0, 0, 0).labels.get('bus_in_error')?.t, 'json', 'invalid bus records must write a visible Model 0 error');
  return { key: 'mbr_mqtt_inbound_rejects_invalid_temporary_modeltable_records', status: 'PASS' };
}

function test_mbr_runner_writes_invalid_adapter_errors_to_model0() {
  assert.equal(
    typeof workerRunnerModule.writeMbrIngressError,
    'function',
    'runner must export the Model 0 ingress error writer used by both adapters',
  );
  const rt = loadMbrRuntime();
  const model0 = rt.getModel(0);

  workerRunnerModule.writeMbrIngressError(rt, model0, 'matrix', 'invalid_payload_kind');
  assert.deepEqual(
    rt.getCell(model0, 0, 0, 0).labels.get('mbr_matrix_inbound_error')?.v,
    {
      code: 'invalid_mbr_matrix_ingress',
      reason: 'invalid_payload_kind',
    },
    'invalid Matrix input must be visible on Model 0 without copying the payload',
  );

  workerRunnerModule.writeMbrIngressError(rt, model0, 'mqtt', 'invalid_json');
  assert.deepEqual(
    rt.getCell(model0, 0, 0, 0).labels.get('mbr_mqtt_inbound_error')?.v,
    {
      code: 'invalid_mbr_mqtt_ingress',
      reason: 'invalid_json',
    },
    'invalid MQTT input must be visible on Model 0 without copying the payload',
  );

  const source = fs.readFileSync('scripts/run_worker_v0.mjs', 'utf8');
  assert.match(source, /writeMbrIngressError\(rt, model0, 'matrix', validation\.reason/, 'Matrix validation failure must call the Model 0 error writer');
  assert.ok(
    (source.match(/writeMbrIngressError\(rt, model0, 'mqtt'/g) || []).length >= 2,
    'MQTT validation and JSON parse failures must call the Model 0 error writer',
  );
  return { key: 'mbr_runner_writes_invalid_adapter_errors_to_model0', status: 'PASS' };
}

const tests = [
  test_no_static_mbr_route_or_model_subscription_residue,
  test_remote_worker_patches_do_not_keep_raw_result_fallbacks,
  test_mbr_routes_by_topic_and_rejects_missing_endpoint_metadata,
  test_mbr_does_not_echo_own_control_publish_to_management_bus,
  test_mbr_mqtt_inbound_does_not_echo_direct_control_reply,
  test_remote_worker_submit1_receives_endpoint_and_replies_on_response_topic,
  test_runtime_rejects_legacy_business_route_record,
  test_remote_worker_rejects_missing_reply_target_without_public_result,
  test_remote_worker_rejects_invalid_reply_target_without_public_result,
  test_mbr_mqtt_inbound_rejects_invalid_temporary_modeltable_records,
  test_mbr_runner_writes_invalid_adapter_errors_to_model0,
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
