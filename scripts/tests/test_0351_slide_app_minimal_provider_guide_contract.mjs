#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const DOC_PATH = 'docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md';
const ROOT_README_PATH = 'docs/user-guide/README.md';
const SLIDE_README_PATH = 'docs/user-guide/slide-app-runtime/README.md';
const REMOTE_PATCH_PATH = 'deploy/sys-v1ns/remote-worker/patches/13_model1050_minimal_submit.json';
const MBR_PATCH_PATH = 'deploy/sys-v1ns/mbr/patches/mbr_role_v0.json';
const REMOTE_CONFIG_PATH = 'deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json';

function readRepoText(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

function readRepoJson(path) {
  return JSON.parse(readRepoText(path));
}

function findRecord(records, predicate) {
  return records.find((record) => record && predicate(record)) || null;
}

function assertNoLegacyCalls(text, label) {
  assert.equal(/ctx\.(writeLabel|getLabel|rmLabel)\s*\(/u.test(text), false, `${label} must not call legacy ctx label APIs`);
}

function assertNoLegacyRouteSurface(text, label) {
  assert.equal(text.includes('pin.connect.model'), false, `${label} must not contain pin.connect.model`);
  assert.equal(/ctx\.(writeLabel|getLabel|rmLabel)\s*\(/u.test(text), false, `${label} must not call legacy ctx label APIs`);
}

function test_doc_has_dual_bus_provider_contract() {
  const doc = readRepoText(DOC_PATH);
  assert.match(doc, /# 最小 Submit 双总线示例/u);
  assert.match(doc, /remote-worker R1/u);
  assert.match(doc, /Workspace 下的 `滑动 APP 导入`/u);
  assert.match(doc, /minimal-submit-dual-bus\.zip/u);
  assert.match(doc, /app_payload\.json/u);
  assert.match(doc, /@mbr:<host_url>/u);
  assert.match(doc, /dy\.bus\.v0/u);
  assert.match(doc, /UI click -> Model 0 -> Matrix -> MBR -> MQTT -> remote-worker -> MQTT -> MBR -> Matrix -> ui-server -> UI model/u);
  assert.match(doc, /UIPUT\/ws\/dam\/pic\/de\/sw\/1050\/submit/u);
  assert.match(doc, /UIPUT\/ws\/dam\/pic\/de\/sw\/1050\/result/u);
  assert.match(doc, /Submitted: <输入内容>/u);
  assert.match(doc, /外部客户端要模拟 `R1` 回包/u);
  assertNoLegacyCalls(doc, 'guide');
  return { key: 'doc_has_dual_bus_provider_contract', status: 'PASS' };
}

function test_remote_worker_r1_patch_matches_documented_contract() {
  const patch = readRepoJson(REMOTE_PATCH_PATH);
  const records = patch.records || [];
  assert.ok(findRecord(records, (record) => record.op === 'create_model' && record.model_id === 1050), 'R1 model 1050 must be created');
  assert.equal(findRecord(records, (record) => record.model_id === 1050 && record.k === 'model_type')?.t, 'model.table');
  assert.equal(findRecord(records, (record) => record.model_id === 1050 && record.k === 'submit')?.t, 'pin.in');
  assert.equal(findRecord(records, (record) => record.model_id === 1050 && record.k === 'result')?.t, 'pin.out');
  assert.equal(findRecord(records, (record) => record.model_id === 1050 && record.k === 'result_out_topic')?.v, 'UIPUT/ws/dam/pic/de/sw/1050/result');
  assert.deepEqual(
    findRecord(records, (record) => record.model_id === 1050 && record.k === 'root_routes')?.v,
    [
      { from: 'submit', to: ['on_minimal_submit_matrix_remote_submit:in'] },
      { from: 'on_minimal_submit_matrix_remote_submit:out', to: ['result'] },
    ],
  );
  const code = findRecord(records, (record) => record.model_id === 1050 && record.k === 'on_minimal_submit_matrix_remote_submit')?.v?.code || '';
  assert.match(code, /record\.k === 'text'/u, 'R1 handler must read text record');
  assert.equal(code.includes('input_value'), false, 'R1 handler must not keep input_value compatibility fallback');
  assert.match(code, /ctx\.publishMqtt\(topic,\s*\{ version: 'v1', type: 'pin_payload'/u, 'R1 handler must publish pin_payload result');
  assertNoLegacyRouteSurface(code, 'R1 handler');
  return { key: 'remote_worker_r1_patch_matches_documented_contract', status: 'PASS' };
}

function test_mbr_and_remote_config_route_1050_topics() {
  const mbrRecords = readRepoJson(MBR_PATCH_PATH).records || [];
  const configRecords = readRepoJson(REMOTE_CONFIG_PATH).records || [];
  const modelIds = findRecord(mbrRecords, (record) => record.k === 'mbr_mqtt_model_ids')?.v || [];
  assert.ok(modelIds.includes(1050), 'MBR must bridge model 1050');
  const subscriptions = findRecord(configRecords, (record) => record.k === 'remote_subscriptions')?.v || [];
  assert.ok(subscriptions.includes('UIPUT/ws/dam/pic/de/sw/1050/submit'), 'R1 config must subscribe submit topic');
  assert.ok(subscriptions.includes('UIPUT/ws/dam/pic/de/sw/1050/result'), 'R1 config must subscribe result topic');
  assertNoLegacyRouteSurface(readRepoText(MBR_PATCH_PATH), 'MBR patch');
  assertNoLegacyRouteSurface(readRepoText(REMOTE_CONFIG_PATH), 'remote config patch');
  return { key: 'mbr_and_remote_config_route_1050_topics', status: 'PASS' };
}

function test_user_guide_indexes_link_new_doc() {
  const rootReadme = readRepoText(ROOT_README_PATH);
  const slideReadme = readRepoText(SLIDE_README_PATH);
  assert.match(rootReadme, /0360/u);
  assert.match(rootReadme, /最小 Submit 双总线示例/u);
  assert.match(slideReadme, /minimal_submit_app_provider_guide\.md/u);
  assert.match(slideReadme, /R1 填表/u);
  assert.match(slideReadme, /外部 Matrix\/MQTT 收发测试/u);
  return { key: 'user_guide_indexes_link_new_doc', status: 'PASS' };
}

const tests = [
  test_doc_has_dual_bus_provider_contract,
  test_remote_worker_r1_patch_matches_documented_contract,
  test_mbr_and_remote_config_route_1050_topics,
  test_user_guide_indexes_link_new_doc,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    const result = test();
    console.log(`[${result.status}] ${result.key}`);
    passed += 1;
  } catch (error) {
    console.log(`[FAIL] ${test.name}: ${error.stack || error.message}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
