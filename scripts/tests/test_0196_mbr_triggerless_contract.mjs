#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function loadJson(relPath) {
  return JSON.parse(read(relPath));
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
  assert.ok(funcConfigKeys.has('mbr_matrix_func'), 'mbr patch must declare mbr_matrix_func');
  assert.ok(funcConfigKeys.has('mbr_mqtt_func'), 'mbr patch must declare mbr_mqtt_func');
  assert.ok(funcConfigKeys.has('mbr_ready_func'), 'mbr patch must declare mbr_ready_func');
  assert.ok(funcConfigKeys.has('mbr_heartbeat_func'), 'mbr patch must declare mbr_heartbeat_func');
}

function test_mbr_runner_executes_functions_without_run_triggers() {
  const source = read('scripts/run_worker_v0.mjs');

  assert.ok(!source.includes('mbr_matrix_trigger'), 'runner must not read mbr_matrix_trigger');
  assert.ok(!source.includes('mbr_mqtt_trigger'), 'runner must not read mbr_mqtt_trigger');
  assert.ok(!source.includes("run_mbr_ready"), 'runner must not emit run_mbr_ready');
  assert.ok(!source.includes("run_mbr_heartbeat"), 'runner must not emit run_mbr_heartbeat');

  assert.match(source, /mbr_matrix_func/, 'runner must read mbr_matrix_func config');
  assert.match(source, /mbr_mqtt_func/, 'runner must read mbr_mqtt_func config');
  assert.match(source, /mbr_ready_func/, 'runner must read mbr_ready_func config');
  assert.match(source, /mbr_heartbeat_func/, 'runner must read mbr_heartbeat_func config');
  assert.match(source, /engine\.executeFunction\(matrixFunc\)/, 'runner must execute matrix function directly');
  assert.match(source, /engine\.executeFunction\(mqttFunc\)/, 'runner must execute mqtt function directly');
  assert.match(source, /engine\.executeFunction\(readyFunc\)/, 'runner must execute ready function directly');
  assert.match(source, /engine\.executeFunction\(heartbeatFunc\)/, 'runner must execute heartbeat function directly');
}

const tests = [
  test_mbr_patch_drops_legacy_trigger_labels,
  test_mbr_runner_executes_functions_without_run_triggers,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    test();
    console.log(`[PASS] ${test.name}`);
    passed += 1;
  } catch (err) {
    console.log(`[FAIL] ${test.name}: ${err.message}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
