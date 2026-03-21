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

function test_page_catalog_entries_are_explicit_and_disable_legacy_fallback() {
  const navPatch = readPatch('packages/worker-base/system-models/nav_catalog_ui.json');
  const catalog = findRootLabelValue(navPatch, -2, 'ui_page_catalog_json');
  assert.ok(Array.isArray(catalog), 'ui_page_catalog_json_missing');

  const expected = new Map([
    ['home', -22],
    ['gallery', -103],
    ['docs', -23],
    ['static', -24],
    ['workspace', -25],
    ['prompt', -21],
    ['test', -26],
  ]);

  for (const [page, modelId] of expected.entries()) {
    const entry = catalog.find((item) => item && item.page === page);
    assert.ok(entry, `missing_page_entry:${page}`);
    assert.equal(entry.asset_type, 'ui_ast_model', `unexpected_asset_type:${page}`);
    assert.equal(entry.model_id, modelId, `unexpected_model_id:${page}`);
    assert.equal(entry.legacy_fallback, false, `legacy_fallback_must_be_false:${page}`);
  }
}

function test_root_ui_ast_bootstrap_models_match_0211_migration_surface() {
  const expectedFiles = [
    ['packages/worker-base/system-models/home_catalog_ui.json', -22],
    ['packages/worker-base/system-models/docs_catalog_ui.json', -23],
    ['packages/worker-base/system-models/static_catalog_ui.json', -24],
    ['packages/worker-base/system-models/workspace_catalog_ui.json', -25],
    ['packages/worker-base/system-models/prompt_catalog_ui.json', -21],
    ['packages/worker-base/system-models/editor_test_catalog_ui.json', -26],
    ['packages/worker-base/system-models/gallery_catalog_ui.json', -103],
  ];

  for (const [relPath, modelId] of expectedFiles) {
    const patch = readPatch(relPath);
    const ast = findRootLabelValue(patch, modelId, 'ui_ast_v0');
    assert.ok(ast && typeof ast === 'object', `missing_root_ui_ast_v0:${relPath}`);
  }
}

function test_known_legacy_consumers_are_still_present_in_code_paths() {
  const checks = [
    ['packages/ui-model-demo-frontend/src/page_asset_resolver.js', /asset_type === 'ui_ast_model'/],
    ['packages/ui-model-demo-frontend/src/remote_store.js', /k:\s*'ui_ast_v0'/],
    ['packages/ui-model-demo-frontend/src/demo_modeltable.js', /cell\.labels\.get\('ui_ast_v0'\)/],
    ['packages/ui-model-demo-frontend/src/gallery_store.js', /cell\.labels\.get\('ui_ast_v0'\)/],
    ['packages/ui-model-demo-frontend/src/editor_page_state_derivers.js', /root\.labels\.ui_ast_v0/],
    ['packages/ui-model-demo-frontend/src/local_bus_adapter.js', /k:\s*'ui_ast_v0'/],
    ['packages/ui-model-demo-server/server.mjs', /overwriteStateLabel\(runtime,\s*'ws_selected_ast'/],
    ['packages/worker-base/system-models/workspace_catalog_ui.json', /"k":\s*"ws_selected_ast"/],
  ];

  for (const [relPath, pattern] of checks) {
    assert.match(readText(relPath), pattern, `missing_inventory_marker:${relPath}`);
  }
}

function test_rejected_direct_mutation_surface_is_explicitly_blocked() {
  const source = readText('packages/ui-model-demo-frontend/src/local_bus_adapter.js');
  assert.match(source, /direct_model_mutation_disabled/, 'missing_direct_mutation_rejection');
  assert.match(source, /'submodel_create'/, 'missing_submodel_create_surface');
}

const tests = [
  test_page_catalog_entries_are_explicit_and_disable_legacy_fallback,
  test_root_ui_ast_bootstrap_models_match_0211_migration_surface,
  test_known_legacy_consumers_are_still_present_in_code_paths,
  test_rejected_direct_mutation_surface_is_explicitly_blocked,
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
