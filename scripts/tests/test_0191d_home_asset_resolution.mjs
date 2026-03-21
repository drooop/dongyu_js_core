#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createDemoStore } from '../../packages/ui-model-demo-frontend/src/demo_modeltable.js';
import { resolvePageAsset } from '../../packages/ui-model-demo-frontend/src/page_asset_resolver.js';

function test_home_page_prefers_model_asset() {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const result = resolvePageAsset(store.snapshot, { pageName: 'home' });
  assert.equal(result.source, 'model_asset');
  assert.equal(result.modelId, -22);
  assert.equal(result.ast?.id, 'root_home');
}

const tests = [test_home_page_prefers_model_asset];

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
