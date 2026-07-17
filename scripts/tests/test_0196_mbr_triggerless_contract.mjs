#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { loadSystemPatch } from '../worker_engine_v0.mjs';
import { validateUnifiedMatrixEventPacket } from '../run_worker_v0.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function loadJson(relPath) {
  return JSON.parse(read(relPath));
}

function mt(k, t, v, id = 0) {
  return { id, p: 0, r: 0, c: 0, k, t, v };
}

function tableQualifiedManagementRecords() {
  const opId = '0196_table_qualified_model0';
  return [
    mt('__mt_payload_kind', 'str', 'pin_payload.v2'),
    mt('__mt_request_id', 'str', opId),
    mt('op_id', 'str', opId),
    mt('message_role', 'str', 'request'),
    mt('bus', 'str', 'management'),
    mt('route_kind', 'str', 'management'),
    mt('topic', 'str', 'UIPUT/ws/dam/pic/de/R1/3000/submit1'),
    mt('response_topic', 'str', 'UIPUT/ws/dam/pic/de/U1/2000/result'),
    mt('endpoint_worker_id', 'str', 'R1'),
    mt('endpoint_table_id', 'str', 'host'),
    mt('endpoint_model_id', 'int', 3000),
    mt('endpoint_pin', 'str', 'submit1'),
    mt('origin_worker_id', 'str', 'U1'),
    mt('origin_table_id', 'str', 'app:0196:root'),
    mt('origin_model_id', 'int', 0),
    mt('origin_pin', 'str', 'submit1'),
    mt('reply_target_worker_id', 'str', 'U1'),
    mt('reply_target_table_id', 'str', 'app:0196:root'),
    mt('reply_target_model_id', 'int', 0),
    mt('reply_target_pin', 'str', 'result'),
    mt('payload_model_id', 'int', 1),
    mt('timestamp', 'int', 1),
    mt('model_type', 'model.table', 'Data.MinimalSubmit', 1),
    mt('text', 'str', 'table-qualified root', 1),
  ];
}

async function settlePropagation() {
  for (let index = 0; index < 8; index += 1) {
    await new Promise((resolvePromise) => setImmediate(resolvePromise));
  }
}

function test_mbr_patch_drops_legacy_trigger_labels() {
  const patch = loadJson('deploy/sys-v1ns/mbr/patches/mbr_role_v0.json');
  const records = Array.isArray(patch.records) ? patch.records : [];

  const wildcardLabels = records.filter((record) => record && record.t === 'MQTT_WILDCARD_SUB');
  assert.equal(wildcardLabels.length, 0, 'mbr patch must not declare MQTT_WILDCARD_SUB after 0196');

  const triggerLabels = records.filter((record) => (
    record
    && record.op === 'add_label'
    && typeof record.k === 'string'
    && (record.k === 'mbr_matrix_trigger' || record.k === 'mbr_mqtt_trigger')
  ));
  assert.equal(triggerLabels.length, 0, 'mbr patch must not keep trigger config labels after 0196');

  const runLabels = records.filter((record) => (
    record
    && record.op === 'add_label'
    && typeof record.k === 'string'
    && record.k.startsWith('run_mbr_')
  ));
  assert.equal(runLabels.length, 0, 'mbr patch must not define run_mbr_* labels');

  const funcConfigKeys = new Set(records.filter((record) => record && record.op === 'add_label').map((record) => record.k));
  assert.ok(!funcConfigKeys.has('mbr_matrix_func'), 'mbr patch must not keep direct Matrix function config');
  assert.ok(!funcConfigKeys.has('mbr_mqtt_func'), 'mbr patch must not keep direct MQTT function config');
  assert.ok(!funcConfigKeys.has('mbr_matrix_inbox_label'), 'mbr patch must not keep direct Matrix inbox config');
  assert.ok(!funcConfigKeys.has('mbr_mqtt_inbox_label'), 'mbr patch must not keep direct MQTT inbox config');
  assert.ok(funcConfigKeys.has('mbr_mb_ingress'), 'mbr patch must declare management ingress PIN');
  assert.ok(funcConfigKeys.has('mbr_cb_ingress'), 'mbr patch must declare control ingress PIN');
  assert.ok(funcConfigKeys.has('mbr_ready_func'), 'mbr patch must declare mbr_ready_func');
  assert.ok(funcConfigKeys.has('mbr_heartbeat_func'), 'mbr patch must declare mbr_heartbeat_func');
}

function test_mbr_runner_routes_messages_by_bus_and_keeps_readiness_direct() {
  const source = read('scripts/run_worker_v0.mjs');

  assert.ok(!source.includes('mbr_matrix_trigger'), 'runner must not read mbr_matrix_trigger');
  assert.ok(!source.includes('mbr_mqtt_trigger'), 'runner must not read mbr_mqtt_trigger');
  assert.ok(!source.includes("run_mbr_ready"), 'runner must not emit run_mbr_ready');
  assert.ok(!source.includes("run_mbr_heartbeat"), 'runner must not emit run_mbr_heartbeat');

  assert.doesNotMatch(source, /mbr_matrix_func/, 'runner must not read direct Matrix function config');
  assert.doesNotMatch(source, /mbr_mqtt_func/, 'runner must not read direct MQTT function config');
  assert.match(source, /mbr_ready_func/, 'runner must read mbr_ready_func config');
  assert.match(source, /mbr_heartbeat_func/, 'runner must read mbr_heartbeat_func config');
  assert.match(source, /k:\s*'mbr_mb_in',[\s\S]*?t:\s*'pin\.bus\.mb\.in',[\s\S]*?v:\s*event\.payload/, 'runner must write Matrix records to Model 0 management ingress');
  assert.match(source, /k:\s*'mbr_cb_in',[\s\S]*?t:\s*'pin\.bus\.cb\.in',[\s\S]*?v:\s*packet\.payload/, 'runner must write MQTT records to Model 0 control ingress');
  assert.doesNotMatch(source, /engine\.executeFunction\((?:matrix|mqtt)Func\)/, 'runner must not execute message functions directly');
  assert.match(source, /engine\.executeFunction\(readyFunc\)/, 'runner must execute ready function directly');
  assert.match(source, /engine\.executeFunction\(heartbeatFunc\)/, 'runner must execute heartbeat function directly');
}

async function test_mbr_accepts_table_qualified_app_root_origin_and_reply() {
  const records = tableQualifiedManagementRecords();
  const packet = { version: 'v1', type: 'pin_payload', payload: records };
  assert.equal(validateUnifiedMatrixEventPacket(packet).ok, true, 'runner must accept non-host table Model 0 origin/reply');

  const runtime = new ModelTableRuntime();
  loadSystemPatch(runtime);
  runtime.applyPatch(loadJson('deploy/sys-v1ns/mbr/patches/mbr_role_v0.json'), {
    allowCreateModel: true,
    trustedBootstrap: true,
  });
  runtime.setRuntimeMode('edit');
  runtime.setRuntimeMode('running');
  const model0 = runtime.getModel(0);
  const result = runtime.addLabel(model0, 0, 0, 0, {
    k: 'mbr_mb_in',
    t: 'pin.bus.mb.in',
    v: records,
  });
  assert.equal(result.applied, true, 'management ingress write must apply');
  await settlePropagation();
  const cbOut = runtime.getCell(model0, 0, 0, 0).labels.get('mbr_cb_out');
  assert.deepEqual(cbOut?.v, records, 'MBR must preserve the table-qualified records through its PIN chain');
  assert.equal(runtime.getCell(runtime.getModel(-10), 0, 0, 0).labels.has('mbr_mgmt_error'), false, 'table-qualified Model 0 must not be rejected');
}

const tests = [
  test_mbr_patch_drops_legacy_trigger_labels,
  test_mbr_runner_routes_messages_by_bus_and_keeps_readiness_direct,
  test_mbr_accepts_table_qualified_app_root_origin_and_reply,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    await test();
    console.log(`[PASS] ${test.name}`);
    passed += 1;
  } catch (err) {
    console.log(`[FAIL] ${test.name}: ${err.message}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
