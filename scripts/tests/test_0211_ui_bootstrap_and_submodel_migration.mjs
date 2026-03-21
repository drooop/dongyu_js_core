#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function readText(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function readPatch(relPath) {
  return JSON.parse(readText(relPath));
}

function findRootLabelValue(patch, modelId, key) {
  const record = (patch.records || []).find((item) =>
    item
    && item.op === 'add_label'
    && item.model_id === modelId
    && item.p === 0
    && item.r === 0
    && item.c === 0
    && item.k === key
  );
  return record ? record.v : undefined;
}

function readPageCatalog() {
  const navPatch = readPatch('packages/worker-base/system-models/nav_catalog_ui.json');
  return findRootLabelValue(navPatch, -2, 'ui_page_catalog_json') || [];
}

function test_non_workspace_page_catalogs_stop_using_root_ui_ast_bootstrap() {
  const catalog = readPageCatalog();
  const expected = [
    ['home', 'packages/worker-base/system-models/home_catalog_ui.json', -22],
    ['docs', 'packages/worker-base/system-models/docs_catalog_ui.json', -23],
    ['static', 'packages/worker-base/system-models/static_catalog_ui.json', -24],
    ['prompt', 'packages/worker-base/system-models/prompt_catalog_ui.json', -21],
    ['test', 'packages/worker-base/system-models/editor_test_catalog_ui.json', -26],
    ['gallery', 'packages/worker-base/system-models/gallery_catalog_ui.json', -103],
  ];

  for (const [page, relPath, modelId] of expected) {
    const entry = catalog.find((item) => item && item.page === page);
    assert.ok(entry, `missing_page_entry:${page}`);
    assert.notEqual(entry.asset_type, 'ui_ast_model', `legacy_ui_ast_model_entry:${page}`);
    const patch = readPatch(relPath);
    assert.equal(findRootLabelValue(patch, modelId, 'ui_ast_v0'), undefined, `legacy_root_ui_ast_v0:${page}`);
  }
}

function test_non_workspace_bootstrap_consumers_stop_reading_root_ui_ast() {
  const checks = [
    ['packages/ui-model-demo-frontend/src/page_asset_resolver.js', /asset_type === 'ui_ast_model'/, 'legacy_page_asset_resolver_ui_ast_model'],
    ['packages/ui-model-demo-frontend/src/demo_modeltable.js', /cell\.labels\.get\('ui_ast_v0'\)/, 'legacy_demo_store_ui_ast_fallback'],
    ['packages/ui-model-demo-frontend/src/gallery_store.js', /cell\.labels\.get\('ui_ast_v0'\)/, 'legacy_gallery_store_ui_ast_fallback'],
    ['packages/ui-model-demo-frontend/src/remote_store.js', /k:\s*'ui_ast_v0'/, 'legacy_remote_store_ui_ast_fallback'],
  ];

  for (const [relPath, pattern, code] of checks) {
    assert.doesNotMatch(readText(relPath), pattern, code);
  }
}

function test_workspace_projection_stops_using_shared_ast_truth_sources() {
  const workspacePatch = readPatch('packages/worker-base/system-models/workspace_catalog_ui.json');
  assert.equal(findRootLabelValue(workspacePatch, -25, 'ui_ast_v0'), undefined, 'legacy_workspace_root_ui_ast_v0');
  assert.doesNotMatch(readText('packages/worker-base/system-models/workspace_catalog_ui.json'), /"k":\s*"ws_selected_ast"/, 'legacy_workspace_ws_selected_ast_ref');
  assert.match(readText('packages/worker-base/system-models/workspace_catalog_ui.json'), /"t":\s*"model\.submt"/, 'workspace_explicit_mounts_missing');
  assert.doesNotMatch(readText('packages/ui-model-demo-server/server.mjs'), /overwriteStateLabel\(runtime,\s*'ws_selected_ast'/, 'legacy_server_ws_selected_ast_write');
  assert.doesNotMatch(readText('packages/ui-model-demo-frontend/src/editor_page_state_derivers.js'), /root\.labels\.ui_ast_v0/, 'legacy_workspace_selected_root_ui_ast');
  assert.doesNotMatch(readText('packages/ui-model-demo-frontend/src/local_bus_adapter.js'), /k:\s*'ui_ast_v0'/, 'legacy_local_bus_shared_ui_ast_writeback');
}

const tests = [
  test_non_workspace_page_catalogs_stop_using_root_ui_ast_bootstrap,
  test_non_workspace_bootstrap_consumers_stop_reading_root_ui_ast,
  test_workspace_projection_stops_using_shared_ast_truth_sources,
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
