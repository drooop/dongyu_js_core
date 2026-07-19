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

function mt(k, t, v, id = 0) {
  return { id, p: 0, r: 0, c: 0, k, t, v };
}

function requestRecords({ opId = 'mbr_ok_001', payloadRecords = null, payloadModelId = 1 } = {}) {
  return [
    mt('__mt_payload_kind', 'str', 'pin_payload.v2'),
    mt('__mt_request_id', 'str', opId),
    mt('op_id', 'str', opId),
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
    mt('origin_table_id', 'str', 'app:test:0177'),
    mt('origin_model_id', 'int', 1),
    mt('origin_pin', 'str', 'send'),
    mt('reply_target_worker_id', 'str', 'U1'),
    mt('reply_target_table_id', 'str', 'app:test:0177'),
    mt('reply_target_model_id', 'int', 1),
    mt('reply_target_pin', 'str', 'result'),
    mt('payload_model_id', 'int', payloadModelId),
    mt('timestamp', 'int', 1700000000000),
    mt('is_need_response', 'bool', true),
    mt('message_server', 'str', 'local'),
    mt('between', 'str', 'WSM_DEM'),
    mt('send_user', 'str', 'U1'),
    mt('receive_user', 'str', 'R1'),
    ...(payloadRecords || [
      mt('model_type', 'model.table', 'Data', 1),
      mt('sys_msg_type', 'str', 'test.mbr.submit', 1),
      mt('input_value', 'str', 'hello', 1),
    ]),
  ];
}

function payloadValue(records, key, id = 0) {
  return Array.isArray(records)
    ? records.find((record) => record && record.id === id && record.k === key)?.v
    : undefined;
}

function assertNumericFlatV2(records) {
  assert.equal(payloadValue(records, '__mt_payload_kind'), 'pin_payload.v2');
  assert.equal(records.some((record) => record.k === 'payload'), false, 'nested payload is removed');
  for (const record of records) {
    assert.deepEqual(Object.keys(record).sort(), ['c', 'id', 'k', 'p', 'r', 't', 'v']);
    for (const key of ['id', 'p', 'r', 'c']) assert.equal(Number.isInteger(record[key]), true, `${key} must be numeric`);
  }
}

async function test_model100_pin_payload_writes_control_bus_out() {
  const rt = loadRuntime();
  const records = requestRecords();
  assertNumericFlatV2(records);
  const write = rt.addLabel(rt.getModel(0), 0, 0, 0, { k: 'mbr_mb_in', t: 'pin.bus.mb.in', v: records });
  assert.equal(write.applied, true);
  await settlePropagation();

  assert.deepEqual(parentLabel(rt, 'mbr_mb_ingress')?.v, records, 'management ingress must traverse parent Cell');
  assert.deepEqual(rootLabel(rt, -10, 'mbr_mb_ingress')?.v, records, 'parent Cell must feed Model -10 ingress');
  assert.deepEqual(rootLabel(rt, -10, 'mbr_cb_egress')?.v, records, 'bridge must emit declared control PIN');
  assert.deepEqual(parentLabel(rt, 'mbr_cb_egress')?.v, records, 'control PIN must return through parent Cell');
  assert.deepEqual(rootLabel(rt, 0, 'mbr_cb_out')?.v, records, 'parent Cell must reach Model 0 BUS_OUT');

  const published = drainMqtt(rt);
  assert.equal(published.length, 1);
  assert.equal(published[0].topic, 'UIPUT/ws/dam/pic/de/R1/100/submit');
  assertNumericFlatV2(published[0].packet.payload);
  assert.equal(payloadValue(published[0].packet.payload, 'endpoint_table_id'), 'host');
  assert.equal(payloadValue(published[0].packet.payload, 'origin_table_id'), 'app:test:0177');
  assert.equal(payloadValue(published[0].packet.payload, 'reply_target_table_id'), 'app:test:0177');
  assert.equal(payloadValue(published[0].packet.payload, 'input_value', 1), 'hello');
}

async function test_generic_crud_events_are_rejected() {
  const rt = loadRuntime();
  const records = requestRecords({
    opId: 'mbr_reject_001',
    payloadRecords: [
      mt('model_type', 'model.table', 'Data', 1),
      mt('sys_msg_type', 'str', 'direct.model.mutation', 1),
      mt('action', 'str', 'label_add', 1),
      mt('source_model_id', 'int', 100, 1),
    ],
  });
  assertNumericFlatV2(records);
  const write = rt.addLabel(rt.getModel(0), 0, 0, 0, { k: 'mbr_mb_in', t: 'pin.bus.mb.in', v: records });
  assert.equal(write.applied, false, 'legacy direct-model mutation metadata must be rejected at Model 0');
  await settlePropagation();
  assert.equal(rootLabel(rt, 0, 'bus_in_error')?.v?.code, 'legacy_pin_payload_metadata_removed', 'rejection must be visible in ModelTable');
  assert.equal(rootLabel(rt, 0, 'bus_in_error')?.v?.label_key, 'mbr_mb_in');
  assert.equal(rootLabel(rt, -10, 'mbr_mb_ingress')?.v, null, 'rejected input must not enter Model -10');
  assert.equal(rootLabel(rt, 0, 'mbr_cb_out')?.v, null, 'rejected input must not reach control BUS_OUT');
  assert.equal(drainMqtt(rt).length, 0);
}

async function test_invalid_records_are_rejected() {
  const rt = loadRuntime();
  const records = requestRecords({
    opId: 'mbr_bad_records',
    payloadModelId: 7,
    payloadRecords: [
      mt('model_type', 'model.table', 'Data', 1),
      mt('sys_msg_type', 'str', 'test.mbr.invalid', 1),
    ],
  });
  assertNumericFlatV2(records);
  const write = rt.addLabel(rt.getModel(0), 0, 0, 0, { k: 'mbr_mb_in', t: 'pin.bus.mb.in', v: records });
  assert.equal(write.applied, false, 'payload_model_id without matching records must be rejected');
  await settlePropagation();
  assert.equal(rootLabel(rt, 0, 'bus_in_error')?.v?.code, 'bus_in_missing_payload_records', 'invalid payload error must be visible in ModelTable');
  assert.equal(rootLabel(rt, 0, 'bus_in_error')?.v?.label_key, 'mbr_mb_in');
  assert.equal(rootLabel(rt, -10, 'mbr_mb_ingress')?.v, null, 'invalid input must not enter Model -10');
  assert.equal(rootLabel(rt, 0, 'mbr_cb_out')?.v, null, 'invalid input must not reach control BUS_OUT');
  assert.equal(drainMqtt(rt).length, 0);
}

const tests = [test_model100_pin_payload_writes_control_bus_out, test_generic_crud_events_are_rejected, test_invalid_records_are_rejected];
let passed = 0;
for (const test of tests) {
  await test();
  console.log(`[PASS] ${test.name}`);
  passed += 1;
}
console.log(`\n${passed} passed, 0 failed out of ${tests.length}`);
