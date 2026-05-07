#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const DOCS = [
  'docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md',
  'docs/user-guide/slide-app-runtime/minimal_submit_app_provider_visualized.md',
  'docs/user-guide/slide-app-runtime/minimal_submit_app_provider_interactive.html',
];

const TARGETS = [
  'deploy/sys-v1ns/mbr/patches/mbr_role_v0.json',
  'deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json',
  'deploy/sys-v1ns/remote-worker/patches/13_model1050_minimal_submit.json',
  'packages/worker-base/system-models/workspace_positive_models.json',
  'packages/worker-base/system-models/system_models.json',
];

function readText(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

function readJson(path) {
  return JSON.parse(readText(path));
}

function findRecord(records, predicate) {
  return records.find((record) => record && predicate(record)) || null;
}

function test_all_public_docs_cover_required_operational_steps() {
  for (const path of DOCS) {
    const text = readText(path);
    assert.match(text, /最小 Submit 双总线示例/u, `${path} must name the real example`);
    assert.match(text, /remote-worker R1|R1/u, `${path} must explain R1`);
    assert.match(text, /滑动 APP 导入|Workspace 导入|怎么导入/u, `${path} must explain Workspace import`);
    assert.match(text, /app_payload\.json/u, `${path} must explain zip contents`);
    assert.match(text, /minimal-submit-dual-bus\.zip/u, `${path} must name the prepared zip`);
    assert.match(text, /bus_event_submit_1050_0_0_0/u, `${path} must include Model 0 bus key`);
    assert.match(text, /dy\.bus\.v0/u, `${path} must include Matrix event type`);
    assert.ok(
      text.includes('@mbr:<host_url>') || text.includes('@mbr:&lt;host_url&gt;'),
      `${path} must include Matrix target user`,
    );
    assert.match(text, /UIPUT\/ws\/dam\/pic\/de\/sw\/1050\/submit/u, `${path} must include submit topic`);
    assert.match(text, /UIPUT\/ws\/dam\/pic\/de\/sw\/1050\/result/u, `${path} must include result topic`);
    assert.match(text, /Submitted: (<|&lt;)输入内容(>|&gt;)|Submitted: hello from external client/u, `${path} must include visible result`);
    assert.equal(/ctx\.(writeLabel|getLabel|rmLabel)\s*\(/u.test(text), false, `${path} must not show callable legacy ctx APIs`);
  }
  return { key: 'all_public_docs_cover_required_operational_steps', status: 'PASS' };
}

function test_targeted_1050_assets_have_no_compatibility_route() {
  for (const path of TARGETS) {
    const text = readText(path);
    assert.equal(text.includes('pin.connect.model'), false, `${path} must not contain pin.connect.model`);
    assert.equal(/ctx\.(writeLabel|getLabel|rmLabel)\s*\(/u.test(text), false, `${path} must not call legacy ctx label APIs`);
  }
  const remoteRecords = readJson('deploy/sys-v1ns/remote-worker/patches/13_model1050_minimal_submit.json').records || [];
  const remoteCode = findRecord(remoteRecords, (record) => record.k === 'on_minimal_submit_matrix_remote_submit')?.v?.code || '';
  assert.equal(remoteCode.includes('input_value'), false, 'remote 1050 handler must not keep input_value fallback');
  assert.match(remoteCode, /record\.k === 'text'/u, 'remote 1050 handler must read the current text record');
  return { key: 'targeted_1050_assets_have_no_compatibility_route', status: 'PASS' };
}

function test_model0_mbr_remote_worker_contract_is_complete() {
  const workspaceRecords = readJson('packages/worker-base/system-models/workspace_positive_models.json').records || [];
  const systemRecords = readJson('packages/worker-base/system-models/system_models.json').records || [];
  const mbrRecords = readJson('deploy/sys-v1ns/mbr/patches/mbr_role_v0.json').records || [];
  const remoteConfigRecords = readJson('deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json').records || [];

  assert.equal(
    findRecord(workspaceRecords, (record) => record.model_id === 0 && record.k === 'minimal_submit_matrix_submit_route')?.t,
    'pin.connect.cell',
    'Model 0 route must use pin.connect.cell',
  );
  assert.deepEqual(
    findRecord(systemRecords, (record) => record.k === 'mbr_route_1050')?.v,
    { pin: 'submit', type: 'pin_payload' },
    'MBR route must bridge only the submit pin_payload for model 1050',
  );
  assert.ok((findRecord(mbrRecords, (record) => record.k === 'mbr_mqtt_model_ids')?.v || []).includes(1050), 'MBR MQTT model ids must include 1050');
  const subscriptions = findRecord(remoteConfigRecords, (record) => record.k === 'remote_subscriptions')?.v || [];
  assert.ok(subscriptions.includes('UIPUT/ws/dam/pic/de/sw/1050/submit'), 'remote-worker must subscribe submit topic');
  assert.ok(subscriptions.includes('UIPUT/ws/dam/pic/de/sw/1050/result'), 'remote-worker must subscribe result topic');
  return { key: 'model0_mbr_remote_worker_contract_is_complete', status: 'PASS' };
}

const tests = [
  test_all_public_docs_cover_required_operational_steps,
  test_targeted_1050_assets_have_no_compatibility_route,
  test_model0_mbr_remote_worker_contract_is_complete,
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
