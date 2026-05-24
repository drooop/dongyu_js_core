#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = {
  guide: 'docs/user-guide/slide-app-runtime/workspace_manager_interaction_guide.md',
  readme: 'docs/user-guide/README.md',
  server: 'packages/ui-model-demo-server/server.mjs',
  assetManager: 'packages/worker-base/system-models/workspace_manager_asset_manager_ui.json',
};

function read(pathname) {
  return fs.readFileSync(pathname, 'utf8');
}

function assertIncludes(text, needle, label) {
  assert.ok(text.includes(needle), `${label} must include ${needle}`);
}

function test_guide_documents_topic_composition_contract() {
  const text = read(files.guide);
  for (const needle of [
    'mqtt_topic_base',
    '<mqtt_topic_base>/<provider_worker_id>/<provider_model_id>/<provider_bundle_pin>',
    '<mqtt_topic_base>/<remote_worker_id>/<remote_model_id>/<current_public_pin>',
    'provider_bundle_topic',
    '不能把 `provider_bundle_topic` 当作目录真源',
    '完整 endpoint topic 必须是 9 段',
    '任何段都不能包含 `/`、`+`、`#`',
  ]) {
    assertIncludes(text, needle, files.guide);
  }
  return { key: 'guide_documents_topic_composition_contract', status: 'PASS' };
}

function test_guide_documents_workspace_manager_asset_publication() {
  const text = read(files.guide);
  for (const needle of [
    'POST /api/media/upload?filename=<your-app>.zip',
    'bundle_resource_uri',
    'asset_id',
    'provider_worker_id',
    'provider_model_id',
    'provider_bundle_pin',
    'provider_route_kind',
    'runtime_endpoint_worker_id',
    'runtime_endpoint_model_id',
    'runtime_pins',
    'slide_app_bundle_request.v1',
    'slide_app_bundle_response.v1',
    'bundle_payload',
  ]) {
    assertIncludes(text, needle, files.guide);
  }
  return { key: 'guide_documents_workspace_manager_asset_publication', status: 'PASS' };
}

function test_user_guide_index_links_new_guide() {
  const text = read(files.readme);
  assertIncludes(text, 'slide-app-runtime/workspace_manager_interaction_guide.md', files.readme);
  return { key: 'user_guide_index_links_new_guide', status: 'PASS' };
}

function test_runtime_projection_supports_resource_uri_metadata() {
  const server = read(files.server);
  const assetManager = read(files.assetManager);
  assertIncludes(server, "'bundle_resource_uri'", files.server);
  assertIncludes(assetManager, '"bundle_resource_uri"', files.assetManager);
  return { key: 'runtime_projection_supports_resource_uri_metadata', status: 'PASS' };
}

const tests = [
  test_guide_documents_topic_composition_contract,
  test_guide_documents_workspace_manager_asset_publication,
  test_user_guide_index_links_new_guide,
  test_runtime_projection_supports_resource_uri_metadata,
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
