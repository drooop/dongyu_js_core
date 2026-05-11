#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const GUIDE = 'docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md';
const REMOTE_PATCH = 'deploy/sys-v1ns/remote-worker/patches/13_model3000_minimal_submit.json';

function read(path) { return fs.readFileSync(resolve(repoRoot, path), 'utf8'); }
function json(path) { return JSON.parse(read(path)); }
function records(path) { return json(path).records || []; }
function find(recs, pred) { return recs.find((record) => record && pred(record)) || null; }
function assertNoOld(text, label) {
  assert.equal(text.includes('/1050/'), false, label + ' must not mention old 1050 topics');
  assert.equal(text.includes('bus_event_submit_1050_0_0_0'), false, label + ' must not mention old fixed bus key');
  assert.equal(text.includes('mbr_route_'), false, label + ' must not mention static MBR routes');
}

function test_doc_has_self_described_route_contract() {
  const doc = read(GUIDE);
  assert.match(doc, /remote-worker `RE`|remote-worker RE/u, 'guide must explain RE remote-worker');
  assert.match(doc, /route\.to/u, 'guide must explain route.to');
  assert.match(doc, /route\.reply_to/u, 'guide must explain route.reply_to');
  assert.match(doc, /model `3000`|model 3000/u, 'guide must explain provider model 3000');
  assert.match(doc, /submit1/u, 'guide must explain public submit1 pin');
  assert.match(doc, /UIPUT\/ws\/dam\/pic\/de\/sw\/worker\/RE\/model\/3000\/pin\/submit1/u, 'guide must document route-addressed submit topic');
  assert.match(doc, /worker\/ui-server-U1\/model\/2000\/pin\/result/u, 'guide must document reply topic');
  assert.match(doc, /test_files\/minimal_submit_dual_bus_app_payload\.json/u, 'guide must reference payload fixture');
  assert.match(doc, /test_files\/minimal_submit_dual_bus\.zip/u, 'guide must reference zip fixture');
  assertNoOld(doc, 'guide');
  return { key: 'doc_has_self_described_route_contract', status: 'PASS' };
}

function test_remote_worker_provider_patch_matches_contract() {
  const recs = records(REMOTE_PATCH);
  assert.ok(find(recs, (record) => record.op === 'create_model' && record.model_id === 3000), 'provider model 3000 must be created');
  assert.equal(find(recs, (record) => record.model_id === 3000 && record.k === 'submit1')?.t, 'pin.in', 'provider root submit1 must be pin.in');
  assert.equal(find(recs, (record) => record.model_id === 3000 && record.k === 'result')?.t, 'pin.out', 'provider root result must be pin.out');
  assert.equal(find(recs, (record) => record.model_id === 3000 && record.k === 'result_out_topic'), null, 'provider must not use static result_out_topic');
  assert.ok(find(recs, (record) => record.model_id === 3000 && record.k === 'submit1_route' && record.t === 'pin.connect.cell'), 'provider must route root submit1 via pin.connect.cell');
  const code = find(recs, (record) => record.model_id === 3000 && record.k === 'submit1' && record.t === 'func.js')?.v?.code || '';
  assert.match(code, /reply_to/u, 'provider function must use reply_to');
  assert.equal(code.includes('ctx.publishMqtt'), false, 'provider function must not publish MQTT directly');
  assert.equal(code.includes('message_text'), false, 'provider function must not keep message_text fallback');
  assert.match(code, /pin_payload\.v1/u, 'provider function must return a ModelTable-shaped pin payload');
  assert.equal(code.includes('V1N.table'), false, 'provider function in non-root cell must not use V1N.table');
  assertNoOld(code, 'provider code');
  return { key: 'remote_worker_provider_patch_matches_contract', status: 'PASS' };
}

function test_provider_guide_embedded_submit_handler_result_fields_match_current_patch() {
  const doc = read(GUIDE);
  const staleSingleFieldPayload = "const resultPayload = [{ id: 0, p: 0, r: 0, c: 0, k: 'display_text', t: 'str', v: 'Submitted: ' + (text || '(empty)') }];";
  assert.equal(doc.includes(staleSingleFieldPayload), false, 'guide embedded JSON must not keep stale display_text-only submit handler');
  for (const required of [
    "k: 'remote_status', t: 'str', v: 'remote_processed'",
    "k: 'last_submit_payload', t: 'json', v: businessPayload",
    "k: 'submit_inflight', t: 'bool', v: false",
  ]) {
    assert.ok(doc.includes(required), 'guide embedded JSON must include current provider result field: ' + required);
  }
  const businessPayloadReferences = doc.match(/v: businessPayload/g) || [];
  assert.ok(businessPayloadReferences.length >= 2, 'guide final JSON snippets must use businessPayload for returned last_submit_payload');
  return { key: 'provider_guide_embedded_submit_handler_result_fields_match_current_patch', status: 'PASS' };
}

function test_mbr_and_remote_config_use_route_topics() {
  const mbrText = read('deploy/sys-v1ns/mbr/patches/mbr_role_v0.json');
  const systemText = read('packages/worker-base/system-models/system_models.json');
  const subscriptions = find(records('deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json'), (record) => record.k === 'remote_subscriptions')?.v || [];
  assert.equal(mbrText.includes('mbr_route_'), false, 'MBR patch must not use static mbr_route');
  assert.equal(systemText.includes('mbr_route_'), false, 'system models must not seed static mbr_route');
  assert.ok(subscriptions.includes('UIPUT/ws/dam/pic/de/sw/worker/RE/model/3000/pin/submit1'), 'remote config must subscribe provider route topic');
  assert.equal(subscriptions.some((topic) => String(topic).includes('/1050/')), false, 'remote config must not include old 1050 topics');
  return { key: 'mbr_and_remote_config_use_route_topics', status: 'PASS' };
}

function test_user_guide_indexes_link_new_doc() {
  const index = read('docs/user-guide/slide-app-runtime/README.md');
  assert.match(index, /minimal_submit_app_provider_guide\.md/u, 'runtime user-guide index must link provider guide');
  return { key: 'user_guide_indexes_link_new_doc', status: 'PASS' };
}

const tests = [
  test_doc_has_self_described_route_contract,
  test_remote_worker_provider_patch_matches_contract,
  test_provider_guide_embedded_submit_handler_result_fields_match_current_patch,
  test_mbr_and_remote_config_use_route_topics,
  test_user_guide_indexes_link_new_doc,
];
let passed = 0;
let failed = 0;
for (const test of tests) {
  try { const result = test(); console.log('[' + result.status + '] ' + result.key); passed += 1; }
  catch (error) { console.log('[FAIL] ' + test.name + ': ' + (error.stack || error.message)); failed += 1; }
}
console.log('\n' + passed + ' passed, ' + failed + ' failed out of ' + tests.length);
process.exit(failed > 0 ? 1 : 0);
