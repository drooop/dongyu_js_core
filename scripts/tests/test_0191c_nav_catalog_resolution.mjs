#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createDemoStore } from '../../packages/ui-model-demo-frontend/src/demo_modeltable.js';
import { readPageCatalog } from '../../packages/ui-model-demo-frontend/src/page_asset_resolver.js';
import { readAppShellRouteSyncState } from '../../packages/ui-model-demo-frontend/src/app_shell_route_sync.js';

function test_demo_store_seeds_page_catalog_as_model_asset() {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const catalog = readPageCatalog(store.snapshot);
  assert.ok(Array.isArray(catalog) && catalog.length >= 6, 'page_catalog_missing');
  assert.ok(catalog.some((entry) => entry && entry.page === 'prompt' && entry.path === '/prompt'), 'prompt_catalog_entry_missing');
  assert.ok(catalog.some((entry) => entry && entry.page === 'gallery' && entry.path === '/gallery'), 'gallery_catalog_entry_missing');
}

function test_route_sync_uses_catalog_for_prompt_path() {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const state = readAppShellRouteSyncState(store.snapshot, '/prompt');
  assert.equal(state.targetPage, 'prompt');
  assert.equal(state.pending, true);
}

const tests = [
  test_demo_store_seeds_page_catalog_as_model_asset,
  test_route_sync_uses_catalog_for_prompt_path,
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
