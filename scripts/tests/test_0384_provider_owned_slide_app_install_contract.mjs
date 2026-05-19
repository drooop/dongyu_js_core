#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = {
  ingress: 'docs/ssot/imported_slide_app_host_ingress_semantics_v1.md',
  payload: 'docs/ssot/temporary_modeltable_payload_v1.md',
  developerGuide: 'docs/user-guide/slide-app-runtime/slide_app_runtime_developer_guide.md',
  modeltableGuide: 'docs/user-guide/modeltable_user_guide.md',
  resolution: 'docs/iterations/0384-provider-owned-slide-app-install/resolution.md',
  standalonePlan: 'docs/plans/2026-05-19-provider-owned-slide-app-install.md',
  workspaceAssetManager: 'packages/worker-base/system-models/workspace_manager_asset_manager_ui.json',
  server: 'packages/ui-model-demo-server/server.mjs',
  workspaceAssetTest: 'scripts/tests/test_0378_workspace_asset_manager_contract.mjs',
};

function read(pathname) {
  return fs.readFileSync(pathname, 'utf8');
}

function assertIncludes(text, needle, label) {
  assert.ok(text.includes(needle), `${label} must include ${needle}`);
}

function assertAllInclude(text, needles, label) {
  for (const needle of needles) assertIncludes(text, needle, label);
}

function test_ssot_freezes_provider_owned_install_contract() {
  const text = read(files.ingress);
  assertAllInclude(text, [
    'Provider-Owned Bundle Install',
    'Workspace Manager DEM ModelTable',
    'source_model_id',
    'asset_id',
    'provider_worker_id',
    'provider_model_id',
    'provider_bundle_pin',
    'provider_route_kind',
    'slide_app_bundle_request.v1',
    'slide_app_bundle_response.v1',
    'bundle_payload',
    'bundle_sha256',
    'pending install state',
    'remote_bus_endpoint_v1',
  ], files.ingress);
  assertIncludes(text, '0384 current contract', files.ingress);
  assertIncludes(text, '已落地的 provider-owned 安装 current truth', files.ingress);
  assert.equal(text.includes('不得把本小节当作已实现行为引用'), false, '0384 SSOT must no longer describe provider-owned install as future-only');
  assertIncludes(text, '不得把 `source_model_id` 当作安装来源', files.ingress);
  assertIncludes(text, 'UI Server 从 Model 0 `mqtt_topic_base`', files.ingress);
  assertIncludes(text, 'computed `topic`', files.ingress);
  assertIncludes(text, '`route_kind`', files.ingress);
  assertIncludes(text, 'wrong endpoint', files.ingress);
  assertIncludes(text, 'wrong topic', files.ingress);
  assertIncludes(text, 'wrong route_kind', files.ingress);
  assertIncludes(text, 'wrong reply target', files.ingress);
  return { key: 'ssot_freezes_provider_owned_install_contract', status: 'PASS' };
}

function test_temporary_payload_defines_request_response_records() {
  const text = read(files.payload);
  assertAllInclude(text, [
    'Provider-Owned Slide App Bundle Payload',
    'format is ModelTable-like, persistence is explicit materialization',
    'slide_app_bundle_request.v1',
    'slide_app_bundle_response.v1',
    'asset_id',
    'requested_version',
    'bundle_payload',
    'bundle_sha256',
    'computed `topic`',
    '`route_kind`',
    '`reply_target`',
    'stale / mismatched response',
  ], files.payload);
  return { key: 'temporary_payload_defines_request_response_records', status: 'PASS' };
}

function test_user_guides_explain_provider_install_path() {
  const developerGuide = read(files.developerGuide);
  const modeltableGuide = read(files.modeltableGuide);
  assertAllInclude(developerGuide, [
    'Workspace Manager 安装 provider-owned APP',
    '不再从 UI Server 本地模型复制 `source_model_id`',
    'provider_worker_id',
    'provider_model_id',
    'provider_bundle_pin',
    'provider_route_kind',
    'slide_app_bundle_request.v1',
    'slide_app_bundle_response.v1',
    'bundle_payload',
    'pending install state',
    '0384 current contract',
    '现在是 current truth',
  ], files.developerGuide);
  assert.equal(developerGuide.includes('不是 Step 1 时已经完成的运行现状'), false, 'developer guide must no longer present 0384 provider install as unimplemented');
  assertAllInclude(modeltableGuide, [
    '0384',
    'provider-owned 滑动 APP 安装 current contract',
    'Workspace Manager DEM ModelTable',
    'slide_app_bundle_request.v1',
    'slide_app_bundle_response.v1',
    'bundle_payload',
    '`source_model_id` 不再是 Workspace Manager 安装来源',
  ], files.modeltableGuide);
  return { key: 'user_guides_explain_provider_install_path', status: 'PASS' };
}

function test_iteration_plan_has_no_step1_red_test_contradiction() {
  const resolution = read(files.resolution);
  const standalonePlan = read(files.standalonePlan);
  assert.equal(resolution.includes('initially fails against current code'), false, 'Step 1 must not require a failing test and a PASS gate at the same time');
  assertIncludes(resolution, 'Step 1 tests pass by checking docs/contract content only', files.resolution);
  assertIncludes(resolution, 'Runtime/catalog rejection of existing `source_model_id` rows is not asserted until Step 2', files.resolution);
  assertIncludes(standalonePlan, 'runtime/catalog rejection of current `source_model_id` rows is asserted in Task 2', files.standalonePlan);
  assertAllInclude(standalonePlan, [
    'provider_route_kind',
    'computed topic',
    'provider-path-not-ready',
    'node scripts/tests/test_0384_provider_owned_slide_app_install_contract.mjs',
    'node scripts/tests/test_0378_workspace_asset_manager_contract.mjs',
    'node scripts/validate_ui_ast_v0x.mjs --case all',
    'git diff --check',
  ], files.standalonePlan);
  return { key: 'iteration_plan_has_no_step1_red_test_contradiction', status: 'PASS' };
}

function test_provider_install_uses_request_response_path_not_local_copy() {
  const assetManager = read(files.workspaceAssetManager);
  const server = read(files.server);
  const workspaceAssetTest = read(files.workspaceAssetTest);
  assert.equal(assetManager.includes('"source_model_id"'), false, 'Workspace Manager asset catalog must not keep source_model_id install truth');
  assert.equal(assetManager.includes('源模型'), false, 'Workspace Manager UI text must not describe local source-model install');
  assertAllInclude(assetManager, [
    '"provider_worker_id"',
    '"provider_model_id"',
    '"provider_bundle_pin"',
    '"provider_route_kind"',
    '"runtime_endpoint_worker_id"',
    '"runtime_endpoint_model_id"',
    '"runtime_pins"',
    '"v": 3100',
    '"v": "bundle_request"',
  ], files.workspaceAssetManager);
  assert.equal(server.includes('row.source_model_id'), false, 'Workspace Manager install action must not read row.source_model_id');
  assert.equal(server.includes('missing_source_model_id'), false, 'Workspace Manager install action must not expose missing_source_model_id path');
  assert.equal(server.includes('buildSlideAppExportPayload(runtime, row.'), false, 'Workspace Manager install action must not export a local row model');
  assertIncludes(server, 'validateWorkspaceAssetProviderEndpoint', files.server);
  assertIncludes(server, 'buildWorkspaceAssetBundleRequestPacket', files.server);
  assertIncludes(server, 'handleWorkspaceAssetBundleResponse', files.server);
  assertIncludes(server, 'workspace_asset_bundle_request_bus', files.server);
  assertIncludes(workspaceAssetTest, 'workspace_asset_bundle_request', files.workspaceAssetTest);
  assertIncludes(workspaceAssetTest, 'request phase must not allocate a new model before provider bundle response', files.workspaceAssetTest);
  return { key: 'provider_install_uses_request_response_path_not_local_copy', status: 'PASS' };
}

const tests = [
  test_ssot_freezes_provider_owned_install_contract,
  test_temporary_payload_defines_request_response_records,
  test_user_guides_explain_provider_install_path,
  test_iteration_plan_has_no_step1_red_test_contradiction,
  test_provider_install_uses_request_response_path_not_local_copy,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    const result = test();
    console.log(`[${result.status}] ${result.key}`);
    passed += 1;
  } catch (err) {
    console.log(`[FAIL] ${test.name}: ${err && err.stack ? err.stack : err}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
