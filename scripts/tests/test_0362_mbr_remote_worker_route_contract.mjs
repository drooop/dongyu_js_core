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

function tempPayload(text = 'hello route') {
  return [
    { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.single', v: 'Data.MinimalSubmit' },
    { id: 0, p: 0, r: 0, c: 0, k: 'text', t: 'str', v: text },
  ];
}

function routeFor(localModelId = 2000) {
  return {
    to: { worker_id: 'RE', model_id: 3000, pin: 'submit1' },
    reply_to: { worker_id: 'ui-server-local', model_id: localModelId, pin: 'result' },
  };
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
    'UIPUT/ws/dam/pic/de/sw/worker/RE/model/100/pin/submit',
    'UIPUT/ws/dam/pic/de/sw/worker/RE/model/1010/pin/submit',
    'UIPUT/ws/dam/pic/de/sw/worker/RE/model/1019/pin/submit',
    'UIPUT/ws/dam/pic/de/sw/worker/RE/model/3000/pin/submit1',
  ], 'remote-worker subscriptions must be route-addressed worker/model/pin topics only');
  assert.equal(
    workerBootstrap.includes("`${base}/worker/+/model/+/pin/+`"),
    true,
    'MBR worker bootstrap must subscribe to route-addressed worker/model/pin wildcard topics',
  );
  assert.equal(
    workerBootstrap.includes("`${base}/${mid}/result`"),
    false,
    'MBR worker bootstrap must not subscribe through fixed legacy model result topics',
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
    assert.equal(text.includes('return buildReplyBusPayload(resultPayload) || resultPayload;'), false, pathname + ' must not keep raw result fallback');
    assert.equal(text.includes('return resultPayload;'), false, pathname + ' must not return raw public result payload');
    assert.equal(text.includes('return payload;'), false, pathname + ' must not return raw public input payload');
  }
  return { key: 'remote_worker_patches_do_not_keep_raw_result_fallbacks', status: 'PASS' };
}

function test_mbr_uses_message_route_to_and_rejects_missing_route() {
  const rt = loadMbrRuntime();
  const sys = rt.getModel(-10);
  const fn = new Function('ctx', getFunctionCode(rt.getCell(sys, 0, 0, 0).labels.get('mbr_mgmt_to_mqtt')));
  rt.addLabel(sys, 0, 0, 0, {
    k: 'mbr_mgmt_inbox',
    t: 'json',
    v: {
      version: 'v1',
      type: 'pin_payload',
      op_id: '0362_route_ok',
      source_model_id: 2000,
      pin: 'submit1',
      route: routeFor(2000),
      payload: tempPayload('mbr route'),
      timestamp: 1700000000000,
    },
  });
  fn({ hostApi: buildWorkerHostApi(rt) });
  const cbOut = rt.getCell(rt.getModel(0), 0, 0, 0).labels.get('mbr_cb_out');
  const packet = toExternalPinPacket(rt, cbOut);
  assert.equal(cbOut?.t, 'pin.bus.cb.out', 'MBR must write route packet to control-bus out pin');
  assert.equal(packet?.type, 'pin_payload', 'control-bus out pin must carry pin_payload');
  const { mqttPublished: published } = drainWorkerEngine(rt);
  assert.equal(published.length, 1, 'MBR must publish route-addressed packet');
  assert.equal(published[0].topic, 'UIPUT/ws/dam/pic/de/sw/worker/RE/model/3000/pin/submit1', 'MBR topic must come from route.to');
  assert.equal(published[0].payload?.source_model_id, 2000, 'MBR must preserve local installed source model id');
  assert.equal(published[0].payload?.route?.reply_to?.model_id, 2000, 'MBR must preserve server-owned reply_to');

  rt.addLabel(sys, 0, 0, 0, {
    k: 'mbr_mgmt_inbox',
    t: 'json',
    v: {
      version: 'v1',
      type: 'pin_payload',
      op_id: '0362_route_missing',
      source_model_id: 2000,
      pin: 'submit1',
      payload: tempPayload('missing route'),
      timestamp: 1700000000001,
    },
  });
  fn({ hostApi: buildWorkerHostApi(rt) });
  assert.equal(published.length, 1, 'missing route must not publish');
  assert.equal(rt.getCell(sys, 0, 0, 0).labels.get('mbr_mgmt_error')?.v?.detail, 'missing_route_to', 'missing route rejection must be explicit');
  return { key: 'mbr_uses_message_route_to_and_rejects_missing_route', status: 'PASS' };
}

function test_mbr_does_not_echo_own_route_to_mqtt_publish() {
  const rt = loadMbrRuntime();
  const sys = rt.getModel(-10);
  const mgmtFn = new Function('ctx', getFunctionCode(rt.getCell(sys, 0, 0, 0).labels.get('mbr_mgmt_to_mqtt')));
  const mqttFn = new Function('ctx', getFunctionCode(rt.getCell(sys, 0, 0, 0).labels.get('mbr_mqtt_to_mgmt')));

  rt.addLabel(sys, 0, 0, 0, {
    k: 'mbr_mgmt_inbox',
    t: 'json',
    v: {
      version: 'v1',
      type: 'pin_payload',
      op_id: '0362_no_echo',
      source_model_id: 2000,
      pin: 'submit1',
      route: routeFor(2000),
      payload: tempPayload('no echo'),
      timestamp: 1700000000005,
    },
  });
  mgmtFn({ hostApi: buildWorkerHostApi(rt) });
  const { mqttPublished: published } = drainWorkerEngine(rt);
  assert.equal(published.length, 1, 'MBR must publish the outbound MQTT packet once');

  rt.addLabel(sys, 0, 0, 0, {
    k: 'mbr_mqtt_inbox',
    t: 'json',
    v: {
      topic: published[0].topic,
      payload: published[0].payload,
    },
  });
  mqttFn({ hostApi: buildWorkerHostApi(rt) });
  assert.equal(rt.getCell(rt.getModel(0), 0, 0, 0).labels.get('mbr_mb_out')?.v, null, 'MBR must not bridge its own route.to MQTT publish back to Matrix');
  return { key: 'mbr_does_not_echo_own_route_to_mqtt_publish', status: 'PASS' };
}

async function test_remote_worker_submit1_receives_route_and_replies_to_reply_to() {
  const rt = loadRemoteRuntime();
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  const accepted = rt.mqttIncoming('UIPUT/ws/dam/pic/de/sw/worker/RE/model/3000/pin/submit1', {
    version: 'v1',
    type: 'pin_payload',
    op_id: '0362_remote_submit',
    source_model_id: 2000,
    pin: 'submit1',
    route: routeFor(2000),
    payload: tempPayload('browser submit'),
    timestamp: 1700000000002,
  });
  assert.equal(accepted, true, 'remote runtime must accept worker/model/pin submit1 topic');
  await wait();
  const model = rt.getModel(3000);
  const root = rt.getCell(model, 0, 0, 0).labels;
  assert.equal(root.get('result')?.v?.find((record) => record.k === 'payload')?.v?.find((record) => record.k === 'display_text')?.v, 'Submitted: browser submit', 'remote submit handler must emit provider result pin payload');
  const { mqttPublished: published } = drainWorkerEngine(rt);
  assert.equal(published.length, 1, 'remote submit handler must publish one reply');
  assert.equal(published[0].topic, 'UIPUT/ws/dam/pic/de/sw/worker/ui-server-local/model/2000/pin/result', 'reply topic must come from route.reply_to');
  assert.equal(published[0].payload?.source_model_id, 2000, 'reply payload source_model_id must target local installed model');
  assert.equal(published[0].payload?.pin, 'result', 'reply payload must use reply_to pin');
  assert.equal(published[0].payload?.payload?.find((record) => record.k === 'display_text')?.v, 'Submitted: browser submit', 'reply payload must carry display_text');
  return { key: 'remote_worker_submit1_receives_route_and_replies_to_reply_to', status: 'PASS' };
}

async function test_runtime_route_record_overrides_business_route_record() {
  const rt = loadRemoteRuntime();
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  const accepted = rt.mqttIncoming('UIPUT/ws/dam/pic/de/sw/worker/RE/model/3000/pin/submit1', {
    version: 'v1',
    type: 'pin_payload',
    op_id: '0362_remote_submit_route_shadow',
    source_model_id: 2000,
    pin: 'submit1',
    route: routeFor(2000),
    payload: [
      {
        id: 0,
        p: 0,
        r: 0,
        c: 0,
        k: 'route',
        t: 'json',
        v: {
          to: { worker_id: 'RE', model_id: 3000, pin: 'submit1' },
          reply_to: { worker_id: 'attacker', model_id: 9999, pin: 'result' },
        },
      },
      ...tempPayload('route shadow'),
    ],
    timestamp: 1700000000003,
  });
  assert.equal(accepted, true, 'remote runtime must accept the outer packet route');
  await wait();
  const { mqttPublished: published } = drainWorkerEngine(rt);
  assert.equal(published.length, 1, 'remote submit handler must publish one reply');
  assert.equal(
    published[0].topic,
    'UIPUT/ws/dam/pic/de/sw/worker/ui-server-local/model/2000/pin/result',
    'runtime-injected route metadata must override same-key business payload records',
  );
  return { key: 'runtime_route_record_overrides_business_route_record', status: 'PASS' };
}

async function test_remote_worker_rejects_missing_reply_to_without_public_result() {
  const rt = loadRemoteRuntime();
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  const accepted = rt.mqttIncoming('UIPUT/ws/dam/pic/de/sw/worker/RE/model/3000/pin/submit1', {
    version: 'v1',
    type: 'pin_payload',
    op_id: '0362_missing_reply_to',
    source_model_id: 2000,
    pin: 'submit1',
    route: { to: { worker_id: 'RE', model_id: 3000, pin: 'submit1' } },
    payload: tempPayload('missing reply_to'),
    timestamp: 1700000000006,
  });
  assert.equal(accepted, true, 'remote runtime must accept packet before program-level reply_to validation');
  await wait();
  const model = rt.getModel(3000);
  const root = rt.getCell(model, 0, 0, 0).labels;
  const programCell = rt.getCell(model, 1, 1, 1).labels;
  assert.equal(root.get('result')?.v, null, 'missing reply_to must not write non-pin_payload data to public result pin');
  assert.equal(programCell.get('remote_status')?.v, 'route_reply_to_missing', 'missing reply_to must be visible on the program cell');
  const { mqttPublished: published } = drainWorkerEngine(rt);
  assert.equal(published.length, 0, 'missing reply_to must not publish a public bus result');
  return { key: 'remote_worker_rejects_missing_reply_to_without_public_result', status: 'PASS' };
}

async function test_remote_worker_rejects_invalid_reply_to_without_public_result() {
  const rt = loadRemoteRuntime();
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  const accepted = rt.mqttIncoming('UIPUT/ws/dam/pic/de/sw/worker/RE/model/3000/pin/submit1', {
    version: 'v1',
    type: 'pin_payload',
    op_id: '0362_invalid_reply_to',
    source_model_id: 2000,
    pin: 'submit1',
    route: {
      to: { worker_id: 'RE', model_id: 3000, pin: 'submit1' },
      reply_to: { worker_id: '', model_id: -1, pin: 'bad/pin' },
    },
    payload: tempPayload('invalid reply_to'),
    timestamp: 1700000000007,
  });
  assert.equal(accepted, true, 'remote runtime must accept packet before program-level invalid reply_to validation');
  await wait();
  const model = rt.getModel(3000);
  const root = rt.getCell(model, 0, 0, 0).labels;
  const programCell = rt.getCell(model, 1, 1, 1).labels;
  assert.equal(root.get('result')?.v, null, 'invalid reply_to must not write non-pin_payload data to public result pin');
  assert.equal(programCell.get('remote_status')?.v, 'route_reply_to_missing', 'invalid reply_to must be visible on the program cell');
  const { mqttPublished: published } = drainWorkerEngine(rt);
  assert.equal(published.length, 0, 'invalid reply_to must not publish a public bus result');
  return { key: 'remote_worker_rejects_invalid_reply_to_without_public_result', status: 'PASS' };
}

function test_mbr_mqtt_inbound_rejects_invalid_temporary_modeltable_records() {
  const rt = loadMbrRuntime();
  const sys = rt.getModel(-10);
  const fn = new Function('ctx', getFunctionCode(rt.getCell(sys, 0, 0, 0).labels.get('mbr_mqtt_to_mgmt')));
  rt.addLabel(sys, 0, 0, 0, {
    k: 'mbr_mqtt_inbox',
    t: 'json',
    v: {
      topic: 'UIPUT/ws/dam/pic/de/sw/worker/ui-server-local/model/2000/pin/result',
      payload: {
        version: 'v1',
        type: 'pin_payload',
        op_id: '0362_bad_mqtt_payload',
        source_model_id: 2000,
        pin: 'result',
        route: { to: { worker_id: 'ui-server-local', model_id: 2000, pin: 'result' } },
        payload: [{ id: 0, p: 0, r: 0, c: 0, k: 'display_text', t: 'str' }],
        timestamp: 1700000000004,
      },
    },
  });
  fn({ hostApi: buildWorkerHostApi(rt) });
  assert.equal(rt.getCell(rt.getModel(0), 0, 0, 0).labels.get('mbr_mb_out')?.v, null, 'invalid MQTT inbound payload must not be bridged to management-bus out pin');
  assert.equal(
    rt.getCell(sys, 0, 0, 0).labels.get('mbr_mqtt_error')?.v?.detail,
    'temporary_modeltable_required',
    'invalid MQTT inbound payload rejection must be visible',
  );
  return { key: 'mbr_mqtt_inbound_rejects_invalid_temporary_modeltable_records', status: 'PASS' };
}

const tests = [
  test_no_static_mbr_route_or_model_subscription_residue,
  test_remote_worker_patches_do_not_keep_raw_result_fallbacks,
  test_mbr_uses_message_route_to_and_rejects_missing_route,
  test_mbr_does_not_echo_own_route_to_mqtt_publish,
  test_remote_worker_submit1_receives_route_and_replies_to_reply_to,
  test_runtime_route_record_overrides_business_route_record,
  test_remote_worker_rejects_missing_reply_to_without_public_result,
  test_remote_worker_rejects_invalid_reply_to_without_public_result,
  test_mbr_mqtt_inbound_rejects_invalid_temporary_modeltable_records,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    const result = await test();
    console.log(`[${result.status}] ${result.key}`);
    passed += 1;
  } catch (error) {
    console.log(`[FAIL] ${test.name}: ${error && error.stack ? error.stack : error}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
