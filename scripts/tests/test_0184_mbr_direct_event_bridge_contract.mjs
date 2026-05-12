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

function mt(k, t, v) {
  return { id: 0, p: 0, r: 0, c: 0, k, t, v };
}

function pinPayloadRecords({
  opId = 'test_0184_mbr_direct_event_bridge_contract_001',
  messageRole = 'request',
  endpointWorkerId = 'R1',
  endpointModelId = 100,
  endpointPin = 'submit',
  originWorkerId = 'ui-server-test',
  originModelId = 100,
  originPin = 'submit',
  replyTargetWorkerId = 'ui-server-test',
  replyTargetModelId = 100,
  replyTargetPin = 'result',
  payloadRecords = payload('hello'),
  timestamp = 1700000000000,
} = {}) {
  return [
    mt('__mt_payload_kind', 'str', 'pin_payload.v1'),
    mt('__mt_request_id', 'str', opId),
    mt('op_id', 'str', opId),
    mt('message_role', 'str', messageRole),
    mt('endpoint_worker_id', 'str', endpointWorkerId),
    mt('endpoint_model_id', 'int', endpointModelId),
    mt('endpoint_pin', 'str', endpointPin),
    mt('origin_worker_id', 'str', originWorkerId),
    mt('origin_model_id', 'int', originModelId),
    mt('origin_pin', 'str', originPin),
    mt('reply_target_worker_id', 'str', replyTargetWorkerId),
    mt('reply_target_model_id', 'int', replyTargetModelId),
    mt('reply_target_pin', 'str', replyTargetPin),
    mt('payload', 'json', payloadRecords),
    mt('timestamp', 'int', timestamp),
  ];
}

function externalPacket(records) {
  return { version: 'v1', type: 'pin_payload', payload: records };
}

function payloadValue(records, key) {
  return Array.isArray(records) ? records.find((record) => record && record.k === key)?.v : undefined;
}

function assertStrictPacket(packet, message = 'packet') {
  assert.deepEqual(Object.keys(packet || {}).sort(), ['payload', 'type', 'version'], `${message} must only expose version/type/payload`);
  assert.equal(packet.version, 'v1', `${message} must be v1`);
  assert.equal(packet.type, 'pin_payload', `${message} must carry pin_payload`);
  assert.equal(Array.isArray(packet.payload), true, `${message} payload must be Temporary ModelTable records`);
}

const rt = loadRuntime();
const sys = rt.getModel(-10);
rt.addLabel(sys, 0, 0, 0, {
  k: 'mbr_mgmt_inbox',
  t: 'json',
  v: externalPacket(pinPayloadRecords()),
});
runMbrFunction(rt, 'mbr_mgmt_to_mqtt');
const packet = toExternalPacket(rt, 'mbr_cb_out');
assertStrictPacket(packet, 'control bus out');
assert.equal(payloadValue(packet.payload, 'message_role'), 'request');
assert.equal(payloadValue(packet.payload, 'endpoint_pin'), 'submit');
assert.equal(payloadValue(packet.payload, 'origin_model_id'), 100);
const published = drainMqtt(rt);
assert.equal(published.length, 1);
assert.equal(published[0].topic, 'UIPUT/ws/dam/pic/de/sw/R1/100/submit');
assertStrictPacket(published[0].payload, 'published payload');
assert.equal(payloadValue(payloadValue(published[0].payload.payload, 'payload'), 'input_value'), 'hello');
assert.equal(published[0].payload.records, undefined);
console.log('PASS test_0184_mbr_direct_event_bridge_contract');
