#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createDemoStore } from '../../packages/ui-model-demo-frontend/src/demo_modeltable.js';
import { resolvePageAsset } from '../../packages/ui-model-demo-frontend/src/page_asset_resolver.js';

function test_home_page_prefers_explicit_model_label_asset() {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const result = resolvePageAsset(store.snapshot, { pageName: 'home' });
  assert.equal(result.source, 'model_asset');
  assert.equal(result.assetType, 'model_label');
  assert.equal(result.modelId, -22);
  assert.equal(result.ast?.id, 'root_home');
  const root = store.snapshot.models['-22']?.cells?.['0,0,0']?.labels ?? {};
  assert.equal(root.model_type?.t, 'model.single');
  assert.equal(root.model_type?.v, 'UI.HomeCatalog');
  assert.equal(root.ui_ast_v0, undefined, 'home_root_ui_ast_v0_must_be_removed');
}

const tests = [test_home_page_prefers_explicit_model_label_asset];

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
