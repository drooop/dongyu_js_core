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

function test_remote_worker_patch_uses_current_tier2_shape() {
  const configPatch = loadJson('deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json');
  const modelPatch = loadJson('deploy/sys-v1ns/remote-worker/patches/10_model100.json');

  const configRecords = Array.isArray(configPatch.records) ? configPatch.records : [];
  const modelRecords = Array.isArray(modelPatch.records) ? modelPatch.records : [];
  const allRecords = [...configRecords, ...modelRecords];

  assert.equal(allRecords.some((record) => record && record.t === 'MQTT_WILDCARD_SUB'), false, 'remote worker patch must not depend on MQTT_WILDCARD_SUB after 0197');
  assert.equal(allRecords.some((record) => record && record.model_id === 100 && record.k === 'ui_type'), false, 'remote worker patch must drop ui_type from model100 root');
  assert.equal(allRecords.some((record) => record && record.model_id === 100 && record.k === 'routing'), false, 'remote worker patch must drop legacy routing key');
  assert.equal(allRecords.some((record) => record && record.model_id === 100 && record.k === 'wiring'), false, 'remote worker patch must drop legacy wiring key');

  const rootType = modelRecords.find((record) => (
    record && record.op === 'add_label' && record.model_id === 100
    && record.p === 0 && record.r === 0 && record.c === 0
    && record.k === 'model_type'
  ));
  assert.ok(rootType, 'remote worker patch must declare model100 root model_type');
  assert.equal(rootType.t, 'model.table', 'remote worker patch must use model.table for model100');

  const rootEventPin = modelRecords.find((record) => (
    record && record.op === 'add_label' && record.model_id === 100
    && record.p === 0 && record.r === 0 && record.c === 0
    && record.t === 'pin.in' && record.k === 'submit'
  ));
  assert.ok(rootEventPin, 'remote worker patch must declare root pin.in submit');

  const rootPatchPin = modelRecords.find((record) => (
    record && record.op === 'add_label' && record.model_id === 100
    && record.p === 0 && record.r === 0 && record.c === 0
    && record.t === 'pin.out' && record.k === 'result'
  ));
  assert.ok(rootPatchPin, 'remote worker patch must declare root pin.out result');

  const funcRecord = modelRecords.find((record) => (
    record && record.op === 'add_label' && record.model_id === 100
    && record.p === 0 && record.r === 0 && record.c === 0
    && record.k === 'on_model100_submit_in' && record.t === 'func.js'
  ));
  assert.ok(funcRecord, 'remote worker patch must place on_model100_submit_in on model100 D0');

  const topicBaseRecord = modelRecords.find((record) => (
    record && record.op === 'add_label' && record.model_id === 100
    && record.p === 0 && record.r === 0 && record.c === 0
    && record.k === 'mqtt_topic_base' && record.t === 'str'
  ));
  assert.ok(topicBaseRecord, 'remote worker root must declare mqtt_topic_base');
  assert.equal(String(topicBaseRecord.v), 'UIPUT/ws/dam/pic/de', 'mqtt_topic_base must declare the shared routed topic base');
  assert.equal(
    modelRecords.some((record) => record && record.model_id === 100 && record.k === 'result_out_topic'),
    false,
    'remote worker patch must not use static result_out_topic',
  );

  const subConfig = configRecords.find((record) => (
    record && record.op === 'add_label' && record.model_id === -10
    && record.k === 'remote_subscriptions' && record.t === 'json'
  ));
  assert.ok(subConfig, 'remote worker config patch must declare remote_subscriptions');
  assert.ok(Array.isArray(subConfig.v) && subConfig.v.includes('UIPUT/ws/dam/pic/de/R1/100/submit'), 'remote_subscriptions must include the routed model100 submit topic');
  assert.equal(subConfig.v.some((s) => String(s).endsWith('/100/result')), false, 'remote_subscriptions must not include static model100 result topic');
}

function test_remote_runner_reads_subscription_config() {
  const source = read('scripts/run_worker_remote_v1.mjs');
  assert.match(source, /remote_subscriptions/, 'remote runner must read remote_subscriptions from patch config');
  assert.match(source, /rt\.mqttClient\.subscribe/, 'remote runner must subscribe configured topics explicitly');
}

const tests = [
  test_remote_worker_patch_uses_current_tier2_shape,
  test_remote_runner_reads_subscription_config,
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
