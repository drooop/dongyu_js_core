#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const PUBLIC_DOCS = [
  'docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md',
  'docs/user-guide/slide-app-runtime/minimal_submit_app_provider_visualized.md',
  'docs/user-guide/slide-app-runtime/minimal_submit_app_provider_interactive.html',
];
const PATCH_FILES = [
  'deploy/sys-v1ns/remote-worker/patches/13_model3000_minimal_submit.json',
  'test_files/minimal_submit_dual_bus_app_payload.json',
];
const MINIMAL_SUBMIT_PATCH_KEYS = [
  'model_type',
  'app_name',
  'source_worker',
  'slide_capable',
  'slide_surface_type',
  'from_user',
  'to_user',
  'ui_authoring_version',
  'ui_root_node_id',
  'input_text',
  'display_text',
  'remote_status',
  'submit_inflight',
  'last_submit_payload',
  'host_ingress_v1',
  'remote_bus_endpoint_v1',
  'dual_bus_model',
  'submit_request',
  'submit1',
  'submit_request_wiring',
  'root_routes',
  'handle_submit',
  'ui_node_id',
  'ui_component',
  'ui_layout',
  'ui_gap',
  'ui_parent',
  'ui_order',
  'ui_title',
  'ui_placeholder',
  'ui_bind_json',
  'ui_label',
  'ui_variant',
  'click_chain',
  'ui_text_ref_model_id',
  'ui_text_ref_p',
  'ui_text_ref_r',
  'ui_text_ref_c',
  'ui_text_ref_k',
];

function readText(path) { return fs.readFileSync(resolve(repoRoot, path), 'utf8'); }
function readJson(path) { return JSON.parse(readText(path)); }
function findRecord(records, predicate) { return records.find((record) => record && predicate(record)) || null; }
function assertNoOld(text, path) {
  assert.equal(text.includes('/1050/'), false, path + ' must not mention old 1050 topics');
  assert.equal(text.includes('bus_event_submit_1050_0_0_0'), false, path + ' must not mention old fixed bus key');
  assert.equal(text.includes('mbr_route_'), false, path + ' must not mention static mbr_route');
}

function test_all_public_docs_cover_required_operational_steps() {
  for (const path of PUBLIC_DOCS) {
    const text = readText(path);
    assert.match(text, /remote-worker `RE`|remote-worker RE|RE \/ 3000/u, path + ' must explain RE');
    assert.match(text, /endpoint_worker_id/u, path + ' must explain endpoint records');
    assert.match(text, /reply_target_worker_id/u, path + ' must explain reply target records');
    assert.match(text, /submit1/u, path + ' must explain submit1');
    assert.match(text, /submit_request/u, path + ' must explain submit_request');
    assert.match(text, /click_chain/u, path + ' must explain click_chain button pin');
    assert.match(text, /handle_submit/u, path + ' must explain handle_submit program model');
    assert.match(text, /3000/u, path + ' must include provider model 3000');
    assert.match(text, /2000/u, path + ' must include local installed model example 2000');
    assert.match(text, /Submitted: <输入内容>|Submitted: &lt;输入内容&gt;/u, path + ' must describe visible submitted result');
    assertNoOld(text, path);
  }
  const guide = readText(PUBLIC_DOCS[0]);
  assert.match(guide, /test_files\/minimal_submit_dual_bus_app_payload\.json/u, 'guide must reference saved JSON payload');
  assert.match(guide, /test_files\/minimal_submit_dual_bus\.zip/u, 'guide must reference saved ZIP payload');
  assert.equal(guide.includes('return payload;'), false, 'guide must not teach returning raw payload from public result path');
  assert.equal(guide.includes('return resultPayload;'), false, 'guide must not teach returning raw resultPayload from public result path');
  assert.equal(guide.includes('!replyTo || !replyTo.worker_id'), false, 'guide must not teach truthy-only reply_to validation');
  assert.match(guide, /pin_payload\.v1/u, 'guide must teach wrapping remote result as pin_payload.v1');
  assert.match(readText(PUBLIC_DOCS[1]), /pin_payload\.v1/u, 'visualized doc must show pin_payload.v1 wrapper on public result path');
  assert.equal(readText(PUBLIC_DOCS[1]).includes('resultPayload<br/>'), false, 'visualized doc must not show raw resultPayload on public result path');
  assert.match(guide, /return null/u, 'guide must teach returning null when endpoint records are invalid');
  return { key: 'all_public_docs_cover_required_operational_steps', status: 'PASS' };
}

function test_provider_assets_have_no_compatibility_route() {
  for (const path of PATCH_FILES) assertNoOld(readText(path), path);
  const uiPayload = readJson('test_files/minimal_submit_dual_bus_app_payload.json');
  assert.equal(Array.isArray(uiPayload), true, 'minimal submit JSON patch must be a ModelTable record array');
  assert.equal(uiPayload.length, 61, 'minimal submit JSON patch must keep the reviewed 61-label shape');
  assert.equal(JSON.stringify(uiPayload).includes('route.reply_to'), false, 'minimal submit JSON patch must not include server-owned route.reply_to');
  assert.equal(uiPayload.some((record) => record && record.k === 'remote_bus_endpoint_v1' && record.v?.to?.worker_id === 'RE' && record.v?.to?.model_id === 3000 && !Object.prototype.hasOwnProperty.call(record.v.to, 'pin')), true, 'minimal submit JSON patch must declare remote endpoint without to.pin');
  assert.equal(uiPayload.some((record) => record && record.k === 'dual_bus_model' && Array.isArray(record.v?.egress_pins) && record.v.egress_pins.includes('submit1')), true, 'minimal submit JSON patch must declare submit1 as public egress pin');
  assert.equal(uiPayload.some((record) => record && record.k === 'ui_bind_json' && record.p === 2 && record.r === 3 && record.v?.write?.pin === 'click_chain'), true, 'minimal submit JSON patch must bind Submit button to click_chain');
  assert.equal(uiPayload.some((record) => record && record.k === 'root_routes' && record.t === 'pin.connect.cell'), true, 'minimal submit JSON patch must connect click_chain to root submit_request');
  assert.equal(uiPayload.some((record) => record && record.k === 'submit_request_wiring' && record.t === 'pin.connect.label'), true, 'minimal submit JSON patch must wire submit_request to handle_submit');
  const remoteRecords = readJson('deploy/sys-v1ns/remote-worker/patches/13_model3000_minimal_submit.json').records || [];
  const remoteCode = findRecord(remoteRecords, (record) => record.k === 'submit1' && record.t === 'func.js')?.v?.code || '';
  assert.equal(remoteCode.includes('input_value'), false, 'remote 3000 handler must not keep input_value fallback');
  assert.equal(remoteCode.includes('message_text'), false, 'remote 3000 handler must not keep message_text fallback');
  assert.match(remoteCode, /recordOf\(businessPayload, 'text'\)/u, 'remote 3000 handler must read the current text record');
  assert.match(remoteCode, /replyTarget/u, 'remote 3000 handler must use reply_target records');
  assert.equal(remoteCode.includes('V1N.table'), false, 'remote 3000 non-root handler must not use V1N.table');

  const uiPayloadText = readText('test_files/minimal_submit_dual_bus_app_payload.json');
  assert.equal(uiPayloadText.includes("readPayload('value'"), false, 'minimal submit UI handler must not keep nested value fallback');
  assert.equal(uiPayloadText.includes('nestedValue'), false, 'minimal submit UI handler must not keep nested value fallback variable');
  const workspaceSeedText = readText('packages/worker-base/system-models/workspace_positive_models.json');
  const model1050 = (readJson('packages/worker-base/system-models/workspace_positive_models.json').records || [])
    .filter((record) => record && record.model_id === 1050);
  const model1050SubmitCode = findRecord(model1050, (record) => record.k === 'handle_submit' && record.t === 'func.js')?.v?.code || '';
  const model1050StatusRef = findRecord(model1050, (record) => record.p === 2 && record.r === 5 && record.c === 0 && record.k === 'ui_text_ref_model_id');
  assert.equal(model1050SubmitCode.includes("readPayload('value'"), false, 'workspace seed Model 1050 handler must not keep nested value fallback');
  assert.equal(model1050SubmitCode.includes('nestedValue'), false, 'workspace seed Model 1050 handler must not keep nested value fallback variable');
  assert.equal(model1050SubmitCode.includes('value.text'), false, 'workspace seed Model 1050 handler must not keep value.text fallback');
  assert.equal(model1050SubmitCode.includes('value.source'), false, 'workspace seed Model 1050 handler must not keep value.source fallback');
  assert.match(model1050SubmitCode, /readPayload\('text', ''\)/u, 'workspace seed Model 1050 handler must read only text record');
  assert.match(model1050SubmitCode, /readPayload\('source', 'ui_button'\)/u, 'workspace seed Model 1050 handler must read source record with fixed default');
  assert.equal(workspaceSeedText.includes("readPayload('text', nestedValue"), false, 'workspace seed must not keep nested text fallback text');
  assert.equal(model1050StatusRef?.v, 1050, 'workspace seed Model 1050 status badge must read its own remote_status, not Model 0');
  assert.match(uiPayloadText, /"host_ingress_v1"/u, 'minimal submit UI payload must declare host_ingress_v1');
  assert.match(uiPayloadText, /"submit_request"/u, 'minimal submit UI payload must declare submit_request pin');
  assert.match(uiPayloadText, /"click_chain"/u, 'minimal submit UI payload must declare button click_chain pin');
  assert.match(uiPayloadText, /"root_routes"/u, 'minimal submit UI payload must declare root_routes pin.connect.cell');
  assert.match(uiPayloadText, /"handle_submit"/u, 'minimal submit UI payload must declare handle_submit program model');
  return { key: 'provider_assets_have_no_compatibility_route', status: 'PASS' };
}

function test_model0_mbr_remote_worker_contract_is_complete() {
  const systemRecords = readJson('packages/worker-base/system-models/system_models.json').records || [];
  const mbrRecords = readJson('deploy/sys-v1ns/mbr/patches/mbr_role_v0.json').records || [];
  const remoteConfigRecords = readJson('deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json').records || [];
  const subscriptions = findRecord(remoteConfigRecords, (record) => record.k === 'remote_subscriptions')?.v || [];
  assert.equal(systemRecords.some((record) => String(record.k || '').startsWith('mbr_route_')), false, 'system models must not seed static MBR routes');
  assert.equal(mbrRecords.some((record) => record.k === 'mbr_mqtt_model_ids'), false, 'MBR must not use static MQTT model id list');
  assert.ok(readText('deploy/sys-v1ns/mbr/patches/mbr_role_v0.json').includes('endpoint_worker_id'), 'MBR function must derive destination from endpoint records');
  assert.ok(subscriptions.includes('UIPUT/ws/dam/pic/de/sw/RE/3000/submit1'), 'remote-worker must subscribe provider submit1 endpoint topic');
  assert.equal(subscriptions.some((topic) => String(topic).includes('/1050/')), false, 'remote-worker must not subscribe old 1050 topics');
  return { key: 'model0_mbr_remote_worker_contract_is_complete', status: 'PASS' };
}

function test_provider_docs_result_payload_examples_keep_current_shape() {
  for (const path of PUBLIC_DOCS) {
    const doc = readText(path);
    const manualResultIndex = doc.indexOf('manual_result_2000_001');
    assert.ok(manualResultIndex >= 0, `${path} must include manual result example`);
    const manualResult = doc.slice(manualResultIndex, manualResultIndex + 2500);
    for (const required of [
      '"k": "display_text"',
      '"k": "remote_status"',
      '"k": "last_submit_payload"',
      '"k": "submit_inflight"',
    ]) {
      assert.ok(manualResult.includes(required), `${path} manual result example must include current result field: ${required}`);
    }
  }
  for (const path of PUBLIC_DOCS) {
    const text = readText(path);
    assert.match(text, /remote_processed/u, path + ' must mention remote_processed result status');
  }
  return { key: 'provider_docs_result_payload_examples_keep_current_shape', status: 'PASS' };
}

function test_minimal_submit_docs_explain_full_patch_labels_and_submit_chain() {
  const guide = readText('docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md');
  const interactive = readText('docs/user-guide/slide-app-runtime/minimal_submit_app_provider_interactive.html');
  for (const [path, text] of [
    ['minimal_submit_app_provider_guide.md', guide],
    ['minimal_submit_app_provider_interactive.html', interactive],
  ]) {
    assert.match(text, /61 条 record/u, path + ' must state the reviewed patch record count');
    assert.match(text, /完整 patch label/u, path + ' must include a full patch label explanation section');
    for (const key of MINIMAL_SUBMIT_PATCH_KEYS) {
      assert.ok(text.includes(key), `${path} must explain patch label ${key}`);
    }
    for (const required of [
      'ui_bind_json',
      'click_chain',
      'root_routes',
      'submit_request_wiring',
      'handle_submit:in',
      'submit1 pin.out',
      'generated host egress adapter',
      'pin.bus.mb.out',
      'endpoint_worker_id',
      'reply_target_worker_id',
      'RE / 3000 / submit1',
      'display_text',
      'remote_status',
    ]) {
      assert.ok(text.includes(required), `${path} must explain submit chain detail: ${required}`);
    }
  }
  return { key: 'minimal_submit_docs_explain_full_patch_labels_and_submit_chain', status: 'PASS' };
}

function test_minimal_submit_docs_explain_ui_server_install_materialization() {
  const guide = readText('docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md');
  const interactive = readText('docs/user-guide/slide-app-runtime/minimal_submit_app_provider_interactive.html');
  for (const [path, text] of [
    ['minimal_submit_app_provider_guide.md', guide],
    ['minimal_submit_app_provider_interactive.html', interactive],
  ]) {
    for (const required of [
      'UI Server 安装',
      'model.submt',
      'deletable',
      'installed_at',
      'imported_bundle_model_ids',
      'import_root_temp_id',
      'host_ingress_generated_model0_labels',
      'host_ingress_generated_mount',
      'host_ingress_generated_root_labels',
      'host_egress_generated_model0_labels',
      'host_egress_generated_mount',
      'ui_egress_submit1_binding',
      'ui.egress.binding.v1',
      'imported_host_submit_',
      'imported_submit1_',
      'bridge_imported_submit1_to_mt_bus_send_',
      'mt_bus_send_in',
      'pin.bus.mb.out',
      'endpoint_worker_id',
      'reply_target_worker_id',
      '侧边栏',
      'Model 0',
    ]) {
      assert.ok(text.includes(required), `${path} must explain UI Server install detail: ${required}`);
    }
    assert.match(text, /Model 0.*\(0,0,0\)/us, `${path} must mention Model 0 root cell`);
    assert.match(text, /Workspace mount|Workspace.*mount|mount cell/u, `${path} must mention Workspace mount cell`);
    assert.match(text, /imported root.*submit1.*Model 0/us, `${path} must describe imported root submit1 reaching Model 0`);
  }
  return { key: 'minimal_submit_docs_explain_ui_server_install_materialization', status: 'PASS' };
}

function test_minimal_submit_docs_explain_submit_button_modeltable_recipe() {
  const guide = readText('docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md');
  const interactive = readText('docs/user-guide/slide-app-runtime/minimal_submit_app_provider_interactive.html');
  for (const [path, text] of [
    ['minimal_submit_app_provider_guide.md', guide],
    ['minimal_submit_app_provider_interactive.html', interactive],
  ]) {
    for (const required of [
      'Submit 类提交按钮',
      '按钮 Cell labels',
      'ui_component',
      'Button',
      'ui_label',
      'click_chain',
      'ui_bind_json',
      'write.pin',
      'value_t',
      'modeltable',
      'value_ref',
      '__mt_payload_kind',
      'ui_event.v1',
      'text',
      'source',
      'input_text',
      'Root 入口',
      'submit_request',
      'root_routes',
      'submit_request_wiring',
      'handle_submit',
      'handle_submit:in',
      'submit1',
      'pin.out',
      'dual_bus_model',
      'egress_pins',
      'remote_bus_endpoint_v1',
      'host_ingress_v1',
      'submit_inflight',
      'last_submit_payload',
      'remote_status',
      'display_text',
      '生效顺序',
      '多个提交按钮',
      'approve_click_chain',
      'approve_request',
      'handle_approve',
      'approve1',
    ]) {
      assert.ok(text.includes(required), `${path} must explain submit-button ModelTable recipe detail: ${required}`);
    }
    assert.match(text, /ui_bind_json.*click_chain/us, `${path} must link ui_bind_json to click_chain`);
    assert.match(text, /click_chain.*submit_request/us, `${path} must link click_chain to submit_request`);
    assert.match(text, /submit_request.*handle_submit:in/us, `${path} must link submit_request to handle_submit`);
    assert.match(text, /handle_submit.*submit1.*pin\.out/us, `${path} must link handle_submit to submit1 pin.out`);
    assert.match(text, /dual_bus_model.*egress_pins.*submit1/us, `${path} must link egress_pins to submit1`);
    assert.match(text, /(?:display_text.*remote_status|remote_status.*display_text)/us, `${path} must explain result/status labels together`);
  }
  return { key: 'minimal_submit_docs_explain_submit_button_modeltable_recipe', status: 'PASS' };
}

const tests = [
  test_all_public_docs_cover_required_operational_steps,
  test_provider_assets_have_no_compatibility_route,
  test_model0_mbr_remote_worker_contract_is_complete,
  test_provider_docs_result_payload_examples_keep_current_shape,
  test_minimal_submit_docs_explain_full_patch_labels_and_submit_chain,
  test_minimal_submit_docs_explain_ui_server_install_materialization,
  test_minimal_submit_docs_explain_submit_button_modeltable_recipe,
];
let passed = 0;
let failed = 0;
for (const test of tests) {
  try { const result = test(); console.log('[' + result.status + '] ' + result.key); passed += 1; }
  catch (error) { console.log('[FAIL] ' + test.name + ': ' + (error.stack || error.message)); failed += 1; }
}
console.log('\n' + passed + ' passed, ' + failed + ' failed out of ' + tests.length);
process.exit(failed > 0 ? 1 : 0);
