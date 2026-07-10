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

function drainMqtt(rt) {
  const published = [];
  const engine = new WorkerEngineV0({
    runtime: rt,
    mqttPublish: (topic, packet) => published.push({ topic, packet }),
    mgmtAdapter: { publish: async () => {} },
  });
  engine.tick();
  return published;
}

function rootLabel(rt, modelId, key) {
  return rt.getCell(rt.getModel(modelId), 0, 0, 0).labels.get(key);
}

function parentLabel(rt, key) {
  return rt.getCell(rt.getModel(0), 1, 0, 0).labels.get(key);
}

function toExternalPacket(rt, key) {
  const label = rootLabel(rt, 0, key);
  return label && typeof rt._pinBusOutValueToExternalPayload === 'function'
    ? rt._pinBusOutValueToExternalPayload(label.v)
    : null;
}

function mt(k, t, v, id = 0) {
  return { id, p: 0, r: 0, c: 0, k, t, v };
}

function pinPayloadV2({
  opId,
  messageRole,
  bus,
  topic,
  responseTopic,
  endpoint,
  origin,
  replyTarget,
  payloadRecords,
  payloadModelId = 1,
}) {
  const records = [
    mt('__mt_payload_kind', 'str', 'pin_payload.v2'),
    mt('__mt_request_id', 'str', opId),
    mt('op_id', 'str', opId),
    mt('message_role', 'str', messageRole),
    mt('bus', 'str', bus),
    mt('route_kind', 'str', bus),
    mt('topic', 'str', topic),
    mt('response_topic', 'str', responseTopic),
    mt('endpoint_worker_id', 'str', endpoint.workerId),
    mt('endpoint_table_id', 'str', endpoint.tableId),
    mt('endpoint_model_id', 'int', endpoint.modelId),
    mt('endpoint_pin', 'str', endpoint.pin),
    mt('origin_worker_id', 'str', origin.workerId),
    mt('origin_table_id', 'str', origin.tableId),
    mt('origin_model_id', 'int', origin.modelId),
    mt('origin_pin', 'str', origin.pin),
    mt('reply_target_worker_id', 'str', replyTarget.workerId),
    mt('reply_target_table_id', 'str', replyTarget.tableId),
    mt('reply_target_model_id', 'int', replyTarget.modelId),
    mt('reply_target_pin', 'str', replyTarget.pin),
    mt('payload_model_id', 'int', payloadModelId),
    mt('timestamp', 'int', 1700000000000),
    mt('is_need_response', 'bool', true),
    mt('message_server', 'str', 'local'),
    mt('between', 'str', 'WSM_DEM'),
  ];
  if (bus === 'management') {
    records.push(mt('send_user', 'str', origin.workerId));
    records.push(mt('receive_user', 'str', endpoint.workerId));
  }
  records.push(...payloadRecords);
  return records;
}

function requestRecords(opId = 'test_0144_001') {
  return pinPayloadV2({
    opId,
    messageRole: 'request',
    bus: 'management',
    topic: 'UIPUT/ws/dam/pic/de/R1/100/submit',
    responseTopic: 'UIPUT/ws/dam/pic/de/U1/1/result',
    endpoint: { workerId: 'R1', tableId: 'host', modelId: 100, pin: 'submit' },
    origin: { workerId: 'U1', tableId: 'app:test:0144', modelId: 1, pin: 'send' },
    replyTarget: { workerId: 'U1', tableId: 'app:test:0144', modelId: 1, pin: 'result' },
    payloadRecords: [
      mt('model_type', 'model.table', 'Data', 1),
      mt('sys_msg_type', 'str', 'test.mbr.submit', 1),
      mt('input_value', 'str', 'abc', 1),
    ],
  });
}

function responseRecords(opId = 'test_0144_002') {
  return pinPayloadV2({
    opId,
    messageRole: 'response',
    bus: 'management',
    topic: 'UIPUT/ws/dam/pic/de/U1/1/result',
    responseTopic: 'UIPUT/ws/dam/pic/de/U1/1/result',
    endpoint: { workerId: 'U1', tableId: 'host', modelId: 1, pin: 'result' },
    origin: { workerId: 'R1', tableId: 'host', modelId: 100, pin: 'submit' },
    replyTarget: { workerId: 'U1', tableId: 'host', modelId: 1, pin: 'result' },
    payloadRecords: [
      mt('model_type', 'model.table', 'Data', 1),
      mt('sys_msg_type', 'str', 'test.mbr.result', 1),
      mt('bg_color', 'str', '#FF0000', 1),
    ],
  });
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
  assert.equal(payloadValue(packet.payload, '__mt_payload_kind'), 'pin_payload.v2', `${message} inner payload must be v2`);
  assert.equal(packet.payload.some((record) => record.k === 'payload'), false, `${message} must not contain nested payload`);
  for (const record of packet.payload) {
    assert.deepEqual(Object.keys(record).sort(), ['c', 'id', 'k', 'p', 'r', 't', 'v'], `${message} record shape`);
    for (const key of ['id', 'p', 'r', 'c']) assert.equal(Number.isInteger(record[key]), true, `${message} ${key} must be numeric`);
  }
}

function assertManagementToControlChain(rt, records) {
  assert.deepEqual(rootLabel(rt, 0, 'mbr_mb_in')?.v, records, 'Matrix input must land on Model 0 management BUS_IN');
  assert.deepEqual(parentLabel(rt, 'mbr_mb_ingress')?.v, records, 'management BUS_IN must reach the parent connection Cell');
  assert.deepEqual(rootLabel(rt, -10, 'mbr_mb_ingress')?.v, records, 'parent Cell must deliver to Model -10 management ingress');
  assert.deepEqual(rootLabel(rt, -10, 'mbr_cb_egress')?.v, records, 'Model -10 bridge must emit its declared control egress PIN');
  assert.deepEqual(parentLabel(rt, 'mbr_cb_egress')?.v, records, 'Model -10 control egress must return through the parent Cell');
  assert.deepEqual(rootLabel(rt, 0, 'mbr_cb_out')?.v, records, 'parent Cell must route to Model 0 control BUS_OUT');
}

function assertControlToManagementChain(rt, records) {
  assert.deepEqual(rootLabel(rt, 0, 'mbr_cb_in')?.v, records, 'MQTT input must land on Model 0 control BUS_IN');
  assert.deepEqual(parentLabel(rt, 'mbr_cb_ingress')?.v, records, 'control BUS_IN must reach the parent connection Cell');
  assert.deepEqual(rootLabel(rt, -10, 'mbr_cb_ingress')?.v, records, 'parent Cell must deliver to Model -10 control ingress');
  assert.deepEqual(rootLabel(rt, -10, 'mbr_mb_egress')?.v, records, 'Model -10 bridge must emit its declared management egress PIN');
  assert.deepEqual(parentLabel(rt, 'mbr_mb_egress')?.v, records, 'Model -10 management egress must return through the parent Cell');
  assert.deepEqual(rootLabel(rt, 0, 'mbr_mb_out')?.v, records, 'parent Cell must route to Model 0 management BUS_OUT');
}

function test_mbr_patches_load() {
  const rt = loadRuntime();
  const model0Cell = rt.getCell(rt.getModel(0), 0, 0, 0);
  const sysCell = rt.getCell(rt.getModel(-10), 0, 0, 0);
  const allowedInfrastructureFunctions = new Set(['mt_write', 'mt_bus_receive', 'mt_bus_send']);
  assert.equal(model0Cell.labels.get('model_type')?.t, 'model.v1n');
  assert.deepEqual(
    [...model0Cell.labels.values()]
      .filter((label) => label.t === 'func.js' && !allowedInfrastructureFunctions.has(label.k))
      .map((label) => label.k),
    [],
    'Model 0 must not contain MBR business functions',
  );
  for (const key of ['mbr_mgmt_to_mqtt', 'mbr_mqtt_to_mgmt', 'mbr_heartbeat', 'mbr_ready']) {
    assert.equal(sysCell.labels.get(key)?.t, 'func.js', `${key} must be a Model -10 func.js`);
  }
  assert.equal(parentLabel(rt, 'model_type')?.t, 'model.submtconnection', 'MBR must mount Model -10 through a parent connection Cell');
  assert.equal(model0Cell.labels.get('mbr_bus_routes')?.t, 'pin.connect.cell', 'Model 0 must declare the parent Cell routes');
  assert.equal(sysCell.labels.get('mbr_dispatch_wiring')?.t, 'pin.connect.label', 'Model -10 must wire ingress PINs to bridge functions');
}

async function test_mbr_mgmt_to_mqtt_execute_model100() {
  const rt = loadRuntime();
  const records = requestRecords();
  const write = rt.addLabel(rt.getModel(0), 0, 0, 0, { k: 'mbr_mb_in', t: 'pin.bus.mb.in', v: records });
  assert.equal(write.applied, true, 'management BUS_IN write must apply');
  await settlePropagation();
  assertManagementToControlChain(rt, records);

  const packet = toExternalPacket(rt, 'mbr_cb_out');
  assertStrictPacket(packet, 'control bus out');
  const published = drainMqtt(rt);
  assert.equal(published.length, 1, 'control bus out must publish once through engine');
  assert.equal(published[0].topic, 'UIPUT/ws/dam/pic/de/R1/100/submit');
  assertStrictPacket(published[0].packet, 'published payload');
  assert.equal(payloadValue(published[0].packet.payload, 'endpoint_table_id'), 'host');
  assert.equal(payloadValue(published[0].packet.payload, 'origin_table_id'), 'app:test:0144');
  assert.equal(payloadValue(published[0].packet.payload, 'reply_target_table_id'), 'app:test:0144');
  assert.equal(payloadValue(published[0].packet.payload, 'input_value', 1), 'abc');
  assert.equal(rootLabel(rt, -10, 'mbr_mgmt_error'), undefined, 'valid management packet must not write an error');
}

async function test_mbr_mqtt_to_mgmt_execute() {
  const rt = loadRuntime();
  const records = responseRecords();
  const write = rt.addLabel(rt.getModel(0), 0, 0, 0, { k: 'mbr_cb_in', t: 'pin.bus.cb.in', v: records });
  assert.equal(write.applied, true, 'control BUS_IN write must apply');
  await settlePropagation();
  assertControlToManagementChain(rt, records);

  const packet = toExternalPacket(rt, 'mbr_mb_out');
  assertStrictPacket(packet, 'management bus out');
  assert.equal(payloadValue(packet.payload, 'op_id'), 'test_0144_002');
  assert.equal(payloadValue(packet.payload, 'message_role'), 'response');
  assert.equal(payloadValue(packet.payload, 'endpoint_table_id'), 'host');
  assert.equal(payloadValue(packet.payload, 'reply_target_table_id'), 'host');
  assert.equal(payloadValue(packet.payload, 'bg_color', 1), '#FF0000');
  assert.equal(rootLabel(rt, -10, 'mbr_mqtt_error'), undefined, 'valid control response must not write an error');
}

const tests = [test_mbr_patches_load, test_mbr_mgmt_to_mqtt_execute_model100, test_mbr_mqtt_to_mgmt_execute];
let passed = 0;
for (const test of tests) {
  await test();
  console.log(`[PASS] ${test.name}`);
  passed += 1;
}
console.log(`\n${passed} passed, 0 failed out of ${tests.length}`);
