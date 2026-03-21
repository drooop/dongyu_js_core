#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createDemoStore } from '../../packages/ui-model-demo-frontend/src/demo_modeltable.js';
import { resolvePageAsset } from '../../packages/ui-model-demo-frontend/src/page_asset_resolver.js';

function test_prompt_page_prefers_model_asset_over_legacy_builder() {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  store.runtime.addLabel(store.runtime.getModel(-2), 0, 0, 0, { k: 'ui_page', t: 'str', v: 'prompt' });
  store.consumeOnce();

  const result = resolvePageAsset(store.snapshot, {
    pageName: 'prompt',
  });
  assert.equal(result.source, 'model_asset');
  assert.equal(result.modelId, -21);
  assert.equal(result.ast?.id, 'root_prompt_filltable');
}

const tests = [
  test_prompt_page_prefers_model_asset_over_legacy_builder,
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
