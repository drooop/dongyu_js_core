#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { WorkerEngineV0, buildWorkerHostApi, loadSystemPatch } from '../worker_engine_v0.mjs';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');
const fs = require('node:fs');

function readJson(pathname) {
  return JSON.parse(fs.readFileSync(pathname, 'utf8'));
}

function getFunctionCode(label) {
  if (!label) return '';
  if (typeof label.v === 'string') return label.v;
  if (label.v && typeof label.v === 'object' && typeof label.v.code === 'string') return label.v.code;
  return '';
}

function loadRuntime() {
  const rt = new ModelTableRuntime();
  loadSystemPatch(rt);
  if (!rt.getModel(-10)) rt.createModel({ id: -10, name: 'system', type: 'system' });
  rt.applyPatch(readJson('deploy/sys-v1ns/mbr/patches/mbr_role_v0.json'), { allowCreateModel: true, trustedBootstrap: true });
  return rt;
}

function runMbrFunction(rt, name) {
  const sys = rt.getModel(-10);
  const fn = new Function('ctx', getFunctionCode(rt.getCell(sys, 0, 0, 0).labels.get(name)));
  fn({ hostApi: buildWorkerHostApi(rt) });
}

function drainMqtt(rt) {
  const published = [];
  const engine = new WorkerEngineV0({
    runtime: rt,
    mqttPublish: (topic, payload) => published.push({ topic, payload }),
    mgmtAdapter: { publish: async () => {} },
  });
  if (!rt.isRuntimeRunning()) {
    if (rt.getRuntimeMode() === 'boot') rt.setRuntimeMode('edit');
    rt.setRuntimeMode('running');
  }
  engine.tick();
  return published;
}

function toExternalPacket(rt, key) {
  const label = rt.getCell(rt.getModel(0), 0, 0, 0).labels.get(key);
  return label && typeof rt._pinBusOutValueToExternalPayload === 'function'
    ? rt._pinBusOutValueToExternalPayload(label.v)
    : null;
}

function payload(text = 'hello') {
  return [
    { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.single', v: 'Data.RemoteSubmit' },
    { id: 0, p: 0, r: 0, c: 0, k: 'input_value', t: 'str', v: text },
  ];
}

function route(sourceModelId = 100, pin = 'submit', targetModelId = sourceModelId) {
  return {
    to: { worker_id: 'RE', model_id: targetModelId, pin },
    reply_to: { worker_id: 'ui-server-test', model_id: sourceModelId, pin: 'result' },
  };
}

function test_mbr_patches_load() {
  const rt = loadRuntime();
  const sys = rt.getModel(-10);
  assert(sys, 'system model must exist');
  const cell = rt.getCell(sys, 0, 0, 0);
  for (const key of ['mbr_mgmt_to_mqtt', 'mbr_mqtt_to_mgmt', 'mbr_heartbeat', 'mbr_ready']) {
    assert.equal(cell.labels.get(key)?.t, 'func.js', key + ' must be func.js');
  }
}

function test_mbr_mgmt_to_mqtt_execute_model100() {
  const rt = loadRuntime();
  const sys = rt.getModel(-10);
  rt.addLabel(sys, 0, 0, 0, {
    k: 'mbr_mgmt_inbox',
    t: 'json',
    v: {
      version: 'v1', type: 'pin_payload', op_id: 'test_0144_001', source_model_id: 100, pin: 'submit',
      route: route(100, 'submit'), payload: payload('abc'), timestamp: Date.now(),
    },
  });
  runMbrFunction(rt, 'mbr_mgmt_to_mqtt');
  const packet = toExternalPacket(rt, 'mbr_cb_out');
  assert.equal(packet?.type, 'pin_payload', 'control bus out must carry pin_payload');
  const published = drainMqtt(rt);
  assert.equal(published.length, 1, 'control bus out must publish once through engine');
  assert.equal(published[0].topic, 'UIPUT/ws/dam/pic/de/sw/worker/RE/model/100/pin/submit');
  assert.equal(published[0].payload?.source_model_id, 100);
  assert.equal(published[0].payload?.route?.to?.worker_id, 'RE');
  assert(!rt.getCell(sys, 0, 0, 0).labels.has('mbr_mgmt_inbox'), 'inbox should be cleaned');
  assert(rt.getCell(sys, 0, 0, 0).labels.has('mbr_seen_test_0144_001'), 'dedup marker should exist');
}

function test_mbr_mqtt_to_mgmt_execute() {
  const rt = loadRuntime();
  const sys = rt.getModel(-10);
  const payloadValue = {
    version: 'v1',
    type: 'pin_payload',
    op_id: 'test_0144_002',
    source_model_id: 100,
    pin: 'result',
    route: { to: { worker_id: 'ui-server', model_id: 100, pin: 'result' } },
    payload: [{ id: 0, p: 0, r: 0, c: 0, k: 'bg_color', t: 'str', v: '#FF0000' }],
  };
  rt.addLabel(sys, 0, 0, 0, { k: 'mbr_mqtt_inbox', t: 'json', v: { topic: 'UIPUT/ws/dam/pic/de/sw/worker/ui-server/model/100/pin/result', payload: payloadValue } });
  runMbrFunction(rt, 'mbr_mqtt_to_mgmt');
  const packet = toExternalPacket(rt, 'mbr_mb_out');
  assert.equal(packet?.type, 'pin_payload', 'management bus out must carry pin_payload');
  assert.equal(packet?.op_id, 'test_0144_002');
  assert.deepEqual(packet?.route?.to, { worker_id: 'ui-server', model_id: 100, pin: 'result' }, 'management bus out must preserve route.to');
  assert(!rt.getCell(sys, 0, 0, 0).labels.has('mbr_mqtt_inbox'), 'inbox should be cleaned');
}

const tests = [test_mbr_patches_load, test_mbr_mgmt_to_mqtt_execute_model100, test_mbr_mqtt_to_mgmt_execute];
let passed = 0;
for (const test of tests) { test(); console.log('[PASS] ' + test.name); passed += 1; }
console.log('\n' + passed + ' passed, 0 failed out of ' + tests.length);
