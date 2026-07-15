#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { WorkerEngineV0, loadSystemPatch } from '../worker_engine_v0.mjs';
import { pinPayloadV2Records } from '../lib/pin_payload_v2_test_helpers.mjs';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');
const fs = require('node:fs');

function readJson(pathname) {
  return JSON.parse(fs.readFileSync(pathname, 'utf8'));
}

function loadRuntime() {
  const rt = new ModelTableRuntime();
  loadSystemPatch(rt);
  if (!rt.getModel(-10)) rt.createModel({ id: -10, name: 'system', type: 'system' });
  rt.applyPatch(readJson('deploy/sys-v1ns/mbr/patches/mbr_role_v0.json'), { allowCreateModel: true, trustedBootstrap: true });
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  return rt;
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

function pinPayloadRecords({
  opId = 'test_0179_mbr_route_contract_001',
  messageRole = 'request',
  endpointWorkerId = 'R1',
  endpointModelId = 3000,
  endpointPin = 'task',
  originWorkerId = 'ui-server-test',
  originModelId = 101,
  originPin = 'task',
  replyTargetWorkerId = 'ui-server-test',
  replyTargetModelId = 101,
  replyTargetPin = 'result',
  payloadRecords = payload('hello'),
  timestamp = 1700000000000,
} = {}) {
  return pinPayloadV2Records({
    opId,
    messageRole,
    routeKind: 'management',
    endpointWorkerId,
    endpointModelId,
    endpointPin,
    originWorkerId,
    originModelId,
    originPin,
    replyTargetWorkerId,
    replyTargetModelId,
    replyTargetPin,
    payloadRecords,
    timestamp,
  });
}

function payloadValue(records, key, id = 0) {
  return Array.isArray(records)
    ? records.find((record) => record && record.id === id && record.k === key)?.v
    : undefined;
}

async function waitUntil(predicate, { timeoutMs = 1000, intervalMs = 20 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    if (predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return Boolean(predicate());
}

function assertStrictPacket(packet, message = 'packet') {
  assert.deepEqual(Object.keys(packet || {}).sort(), ['payload', 'type', 'version'], `${message} must only expose version/type/payload`);
  assert.equal(packet.version, 'v1', `${message} must be v1`);
  assert.equal(packet.type, 'pin_payload', `${message} must carry pin_payload`);
  assert.equal(Array.isArray(packet.payload), true, `${message} payload must be Temporary ModelTable records`);
}

const rt = loadRuntime();
const model0 = rt.getModel(0);
const inputRecords = pinPayloadRecords();
const ingress = rt.addLabel(model0, 0, 0, 0, {
  k: 'mbr_mb_in',
  t: 'pin.bus.mb.in',
  v: inputRecords,
});
assert.equal(ingress.applied, true, 'current pin_payload.v2 management ingress must be accepted on Model 0');
assert.equal(
  await waitUntil(() => payloadValue(rt.getCell(model0, 0, 0, 0).labels.get('mbr_cb_out')?.v, 'op_id') === 'test_0179_mbr_route_contract_001'),
  true,
  'management ingress must traverse the declared Model 0 -> Model -10 -> Model 0 pin chain',
);
const packet = toExternalPacket(rt, 'mbr_cb_out');
assertStrictPacket(packet, 'control bus out');
assert.equal(payloadValue(packet.payload, '__mt_payload_kind'), 'pin_payload.v2');
assert.equal(payloadValue(packet.payload, 'message_role'), 'request');
assert.equal(payloadValue(packet.payload, 'endpoint_pin'), 'task');
assert.equal(payloadValue(packet.payload, 'origin_model_id'), 101);
const published = drainMqtt(rt);
assert.equal(published.length, 1);
assert.equal(published[0].topic, 'UIPUT/ws/dam/pic/de/R1/3000/task');
assertStrictPacket(published[0].payload, 'published payload');
const payloadModelId = payloadValue(published[0].payload.payload, 'payload_model_id');
assert.equal(payloadValue(published[0].payload.payload, 'input_value', payloadModelId), 'hello');
assert.equal(published[0].payload.records, undefined);
console.log('PASS test_0179_mbr_route_contract');
