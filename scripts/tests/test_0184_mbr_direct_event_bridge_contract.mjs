#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { WorkerEngineV0, loadSystemPatch } from '../worker_engine_v0.mjs';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

function readJson(pathname) {
  return JSON.parse(fs.readFileSync(pathname, 'utf8'));
}

function loadRuntime() {
  const rt = new ModelTableRuntime();
  loadSystemPatch(rt);
  if (!rt.getModel(-10)) rt.createModel({ id: -10, name: 'system', type: 'system' });
  const applied = rt.applyPatch(readJson('deploy/sys-v1ns/mbr/patches/mbr_role_v0.json'), {
    allowCreateModel: true,
    trustedBootstrap: true,
  });
  assert.equal(applied.rejected, 0, 'MBR role patch must apply without rejected records');
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  return rt;
}

async function settlePropagation() {
  for (let index = 0; index < 8; index += 1) {
    await new Promise((resolvePromise) => setImmediate(resolvePromise));
  }
}

function rootLabel(rt, modelId, key) {
  return rt.getCell(rt.getModel(modelId), 0, 0, 0).labels.get(key);
}

function parentLabel(rt, key) {
  return rt.getCell(rt.getModel(0), 1, 0, 0).labels.get(key);
}

function mt(k, t, v, id = 0) {
  return { id, p: 0, r: 0, c: 0, k, t, v };
}

function pinPayloadRecords() {
  return [
    mt('__mt_payload_kind', 'str', 'pin_payload.v2'),
    mt('__mt_request_id', 'str', 'test_0184_mbr_direct_event_bridge_contract_001'),
    mt('op_id', 'str', 'test_0184_mbr_direct_event_bridge_contract_001'),
    mt('message_role', 'str', 'request'),
    mt('bus', 'str', 'management'),
    mt('route_kind', 'str', 'management'),
    mt('topic', 'str', 'UIPUT/ws/dam/pic/de/R1/100/submit'),
    mt('response_topic', 'str', 'UIPUT/ws/dam/pic/de/U1/1/result'),
    mt('endpoint_worker_id', 'str', 'R1'),
    mt('endpoint_table_id', 'str', 'host'),
    mt('endpoint_model_id', 'int', 100),
    mt('endpoint_pin', 'str', 'submit'),
    mt('origin_worker_id', 'str', 'U1'),
    mt('origin_table_id', 'str', 'app:test:0184'),
    mt('origin_model_id', 'int', 1),
    mt('origin_pin', 'str', 'send'),
    mt('reply_target_worker_id', 'str', 'U1'),
    mt('reply_target_table_id', 'str', 'app:test:0184'),
    mt('reply_target_model_id', 'int', 1),
    mt('reply_target_pin', 'str', 'result'),
    mt('payload_model_id', 'int', 1),
    mt('timestamp', 'int', 1700000000000),
    mt('is_need_response', 'bool', true),
    mt('message_server', 'str', 'local'),
    mt('between', 'str', 'WSM_DEM'),
    mt('send_user', 'str', 'U1'),
    mt('receive_user', 'str', 'R1'),
    mt('model_type', 'model.table', 'Data', 1),
    mt('sys_msg_type', 'str', 'test.mbr.direct-event', 1),
    mt('input_value', 'str', 'hello', 1),
  ];
}

function payloadValue(records, key, id = 0) {
  return Array.isArray(records)
    ? records.find((record) => record && record.id === id && record.k === key)?.v
    : undefined;
}

function assertStrictPacket(packet, message = 'packet') {
  assert.deepEqual(Object.keys(packet || {}).sort(), ['payload', 'type', 'version'], `${message} must only expose version/type/payload`);
  assert.equal(packet.version, 'v1', `${message} outer transport wrapper must remain v1`);
  assert.equal(packet.type, 'pin_payload', `${message} must carry pin_payload`);
  assert.equal(Array.isArray(packet.payload), true, `${message} payload must be Temporary ModelTable records`);
  assert.equal(payloadValue(packet.payload, '__mt_payload_kind'), 'pin_payload.v2');
  assert.equal(packet.payload.some((record) => record.k === 'payload'), false, 'nested payload must be absent');
  for (const record of packet.payload) {
    assert.deepEqual(Object.keys(record).sort(), ['c', 'id', 'k', 'p', 'r', 't', 'v']);
    for (const key of ['id', 'p', 'r', 'c']) assert.equal(Number.isInteger(record[key]), true, `${key} must be numeric`);
  }
}

const rt = loadRuntime();
const records = pinPayloadRecords();
const model0 = rt.getModel(0);
const allowedInfrastructureFunctions = new Set(['mt_write', 'mt_bus_receive', 'mt_bus_send']);
assert.deepEqual(
  [...rt.getCell(model0, 0, 0, 0).labels.values()]
    .filter((label) => label.t === 'func.js' && !allowedInfrastructureFunctions.has(label.k))
    .map((label) => label.k),
  [],
  'Model 0 must not execute MBR business functions',
);

const write = rt.addLabel(model0, 0, 0, 0, { k: 'mbr_mb_in', t: 'pin.bus.mb.in', v: records });
assert.equal(write.applied, true, 'direct management event must enter only through Model 0 BUS_IN');
await settlePropagation();

assert.deepEqual(rootLabel(rt, 0, 'mbr_mb_in')?.v, records, 'event must land on Model 0 management BUS_IN');
assert.deepEqual(parentLabel(rt, 'mbr_mb_ingress')?.v, records, 'event must cross the parent connection Cell');
assert.deepEqual(rootLabel(rt, -10, 'mbr_mb_ingress')?.v, records, 'parent Cell must deliver to Model -10 declared ingress PIN');
assert.deepEqual(rootLabel(rt, -10, 'mbr_cb_egress')?.v, records, 'Model -10 must emit its declared control egress PIN');
assert.deepEqual(parentLabel(rt, 'mbr_cb_egress')?.v, records, 'Model -10 output must return through the parent Cell');
assert.deepEqual(rootLabel(rt, 0, 'mbr_cb_out')?.v, records, 'parent Cell must terminate at Model 0 control BUS_OUT');

const packet = rt._pinBusOutValueToExternalPayload(rootLabel(rt, 0, 'mbr_cb_out').v);
assertStrictPacket(packet, 'control bus out');
assert.equal(payloadValue(packet.payload, 'endpoint_pin'), 'submit');
assert.equal(payloadValue(packet.payload, 'endpoint_table_id'), 'host');
assert.equal(payloadValue(packet.payload, 'origin_table_id'), 'app:test:0184');
assert.equal(payloadValue(packet.payload, 'reply_target_table_id'), 'app:test:0184');
assert.equal(payloadValue(packet.payload, 'input_value', 1), 'hello');

const published = [];
const engine = new WorkerEngineV0({
  runtime: rt,
  mqttPublish: (topic, outbound) => published.push({ topic, outbound }),
  mgmtAdapter: { publish: async () => {} },
});
engine.tick();
assert.equal(published.length, 1);
assert.equal(published[0].topic, 'UIPUT/ws/dam/pic/de/R1/100/submit');
assertStrictPacket(published[0].outbound, 'published payload');
assert.equal(published[0].outbound.records, undefined);
assert.equal(rootLabel(rt, -10, 'mbr_mgmt_error'), undefined, 'successful bridge must not write an error');
console.log('PASS test_0184_mbr_direct_event_bridge_contract');
