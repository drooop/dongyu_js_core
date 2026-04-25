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

const pageCatalogExpectations = new Map([
  ['home', -22],
  ['gallery', -103],
  ['docs', -23],
  ['static', -24],
  ['workspace', -25],
  ['prompt', -21],
  ['test', -26],
]);

const rootBootstrapInventory = [
  ['home', 'packages/worker-base/system-models/home_catalog_ui.json', -22],
  ['docs', 'packages/worker-base/system-models/docs_catalog_ui.json', -23],
  ['static', 'packages/worker-base/system-models/static_catalog_ui.json', -24],
  ['workspace', 'packages/worker-base/system-models/workspace_catalog_ui.json', -25],
  ['prompt', 'packages/worker-base/system-models/prompt_catalog_ui.json', -21],
  ['test', 'packages/worker-base/system-models/editor_test_catalog_ui.json', -26],
  ['gallery', 'packages/worker-base/system-models/gallery_catalog_ui.json', -103],
];

const migrationGuardAnchors = [
  /^function test_non_workspace_page_catalogs_stop_using_root_ui_ast_bootstrap\(\)/m,
  /^function test_non_workspace_bootstrap_consumers_stop_reading_root_ui_ast\(\)/m,
  /^function test_workspace_projection_stops_using_shared_ast_truth_sources\(\)/m,
];

const legacySurfaces = [
  ['page_asset_resolver_ui_ast_model', 'packages/ui-model-demo-frontend/src/page_asset_resolver.js', /asset_type === 'ui_ast_model'/],
  ['demo_modeltable_root_ui_ast_read', 'packages/ui-model-demo-frontend/src/demo_modeltable.js', /cell\.labels\.get\('ui_ast_v0'\)/],
  ['gallery_store_root_ui_ast_read', 'packages/ui-model-demo-frontend/src/gallery_store.js', /cell\.labels\.get\('ui_ast_v0'\)/],
  ['remote_store_editor_root_ui_ast_read', 'packages/ui-model-demo-frontend/src/remote_store.js', /k:\s*'ui_ast_v0'/],
  ['workspace_catalog_ws_selected_ast_ref', 'packages/worker-base/system-models/workspace_catalog_ui.json', /"k":\s*"ws_selected_ast"/],
  ['server_ws_selected_ast_write', 'packages/ui-model-demo-server/server.mjs', /overwriteStateLabel\(runtime,\s*'ws_selected_ast'/],
  ['workspace_deriver_root_ui_ast_read', 'packages/ui-model-demo-frontend/src/editor_page_state_derivers.js', /root\.labels\.ui_ast_v0/],
  ['local_bus_adapter_shared_ui_ast_writeback', 'packages/ui-model-demo-frontend/src/local_bus_adapter.js', /k:\s*'ui_ast_v0'/],
];

function test_page_catalog_entries_stay_explicit_while_allowing_asset_type_migration() {
  const navPatch = readPatch('packages/worker-base/system-models/nav_catalog_ui.json');
  const catalog = findRootLabelValue(navPatch, -2, 'ui_page_catalog_json');
  assert.ok(Array.isArray(catalog), 'ui_page_catalog_json_missing');

  for (const [page, modelId] of pageCatalogExpectations.entries()) {
    const entry = catalog.find((item) => item && item.page === page);
    assert.ok(entry, `missing_page_entry:${page}`);
    assert.equal(entry.model_id, modelId, `unexpected_model_id:${page}`);
    assert.ok(typeof entry.asset_type === 'string' && entry.asset_type.length > 0, `missing_asset_type:${page}`);
    assert.equal(entry.legacy_fallback, false, `legacy_fallback_must_be_false:${page}`);
    console.log(`[INFO] page_catalog:${page}:asset_type=${entry.asset_type}`);
  }
}

function test_root_ui_ast_bootstrap_inventory_records_current_or_migrated_state() {
  for (const [page, relPath, modelId] of rootBootstrapInventory) {
    const patch = readPatch(relPath);
    const ast = findRootLabelValue(patch, modelId, 'ui_ast_v0');
    const status = ast && typeof ast === 'object' ? 'legacy_present' : 'legacy_removed';
    console.log(`[INFO] root_ui_ast:${page}:${status}`);
  }
}

function test_known_legacy_consumers_are_bound_to_0211_guards() {
  const guardText = readText('scripts/tests/test_0211_ui_bootstrap_and_submodel_migration.mjs');
  for (const pattern of migrationGuardAnchors) {
    assert.match(guardText, pattern, `missing_0211_guard_anchor:${pattern}`);
  }
  for (const [surfaceId, relPath, pattern] of legacySurfaces) {
    const status = pattern.test(readText(relPath)) ? 'legacy_present' : 'legacy_removed';
    console.log(`[INFO] migration_surface:${surfaceId}:${status}`);
  }
}

function test_rejected_direct_mutation_surface_stays_explicit_during_migration() {
  const source = readText('packages/ui-model-demo-frontend/src/local_bus_adapter.js');
  assert.match(source, /direct_model_mutation_disabled/, 'missing_direct_mutation_rejection');
  const status = /'submodel_create'/.test(source) ? 'legacy_present' : 'legacy_removed';
  console.log(`[INFO] migration_surface:local_bus_adapter_submodel_create_surface:${status}`);
}

const tests = [
  test_page_catalog_entries_stay_explicit_while_allowing_asset_type_migration,
  test_root_ui_ast_bootstrap_inventory_records_current_or_migrated_state,
  test_known_legacy_consumers_are_bound_to_0211_guards,
  test_rejected_direct_mutation_surface_stays_explicit_during_migration,
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
