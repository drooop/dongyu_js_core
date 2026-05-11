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

function test_model100_pin_payload_writes_control_bus_out() {
  const rt = loadRuntime();
  const sys = rt.getModel(-10);
  rt.addLabel(sys, 0, 0, 0, { k: 'mbr_mgmt_inbox', t: 'json', v: { version: 'v1', type: 'pin_payload', op_id: 'mbr_ok_001', source_model_id: 100, pin: 'submit', route: route(100, 'submit'), payload: payload(), timestamp: Date.now() } });
  runMbrFunction(rt, 'mbr_mgmt_to_mqtt');
  const packet = toExternalPacket(rt, 'mbr_cb_out');
  assert.equal(packet?.type, 'pin_payload');
  const published = drainMqtt(rt);
  assert.equal(published.length, 1);
  assert.equal(published[0].topic, 'UIPUT/ws/dam/pic/de/sw/worker/RE/model/100/pin/submit');
  assert.equal(published[0].payload?.payload?.[1]?.v, 'hello');
}

function test_generic_crud_events_are_rejected() {
  const rt = loadRuntime();
  const sys = rt.getModel(-10);
  rt.addLabel(sys, 0, 0, 0, { k: 'mbr_mgmt_inbox', t: 'json', v: { version: 'v0', type: 'snapshot_delta', op_id: 'mbr_reject_001', payload: { action: 'label_add' } } });
  runMbrFunction(rt, 'mbr_mgmt_to_mqtt');
  assert.equal(drainMqtt(rt).length, 0);
  assert.equal(rt.getCell(sys, 0, 0, 0).labels.get('mbr_mgmt_error')?.v?.code, 'direct_model_mutation_disabled');
}

function test_invalid_records_are_rejected() {
  const rt = loadRuntime();
  const sys = rt.getModel(-10);
  rt.addLabel(sys, 0, 0, 0, { k: 'mbr_mgmt_inbox', t: 'json', v: { version: 'v1', type: 'pin_payload', op_id: 'mbr_bad_records', source_model_id: 100, pin: 'submit', route: route(100, 'submit'), payload: [{ id: 0, p: 0, r: 0, c: 0, k: 'input_value', t: 'str' }], timestamp: Date.now() } });
  runMbrFunction(rt, 'mbr_mgmt_to_mqtt');
  assert.equal(drainMqtt(rt).length, 0);
  assert.equal(rt.getCell(sys, 0, 0, 0).labels.get('mbr_mgmt_error')?.v?.detail, 'temporary_modeltable_required');
}

const tests = [test_model100_pin_payload_writes_control_bus_out, test_generic_crud_events_are_rejected, test_invalid_records_are_rejected];
let passed = 0;
for (const test of tests) { test(); console.log('[PASS] ' + test.name); passed += 1; }
console.log('\n' + passed + ' passed, 0 failed out of ' + tests.length);
