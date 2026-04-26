#!/usr/bin/env node

import assert from 'node:assert/strict';
import { ModelTableRuntime } from '../../packages/worker-base/src/index.mjs';
import { createDemoStore } from '../../packages/ui-model-demo-frontend/src/demo_modeltable.js';
import { resolvePageAsset } from '../../packages/ui-model-demo-frontend/src/page_asset_resolver.js';
import { buildAstFromCellwiseModel } from '../../packages/ui-model-demo-frontend/src/ui_cellwise_projection.js';

function test_prompt_page_prefers_model_asset_over_legacy_builder() {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  store.runtime.addLabel(store.runtime.getModel(-2), 0, 0, 0, { k: 'ui_page', t: 'str', v: 'prompt' });
  store.consumeOnce();

  const result = resolvePageAsset(store.snapshot, {
    pageName: 'prompt',
    projectCellwiseModel: buildAstFromCellwiseModel,
  });
  assert.equal(result.source, 'model_asset');
  assert.equal(result.assetType, 'cellwise_model');
  assert.equal(result.modelId, -21);
  assert.equal(result.ast?.id, 'root_prompt_filltable');
}

function test_prompt_page_upgrades_stale_persisted_catalog_to_cellwise_model() {
  const runtime = new ModelTableRuntime();
  const stateModel = runtime.createModel({ id: -2, name: 'editor_state', type: 'ui' });
  runtime.addLabel(stateModel, 0, 0, 0, {
    k: 'ui_page_catalog_json',
    t: 'json',
    v: [
      {
        page: 'prompt',
        path: '/prompt',
        asset_type: 'model_label',
        model_id: -21,
        asset_ref: { p: 0, r: 1, c: 0, k: 'page_asset_v0' },
      },
    ],
  });
  const promptModel = runtime.createModel({ id: -21, name: 'legacy_prompt_catalog', type: 'ui' });
  runtime.addLabel(promptModel, 0, 1, 0, {
    k: 'page_asset_v0',
    t: 'json',
    v: { id: 'legacy_prompt_root', type: 'Root', children: [] },
  });

  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1', runtime });
  const result = resolvePageAsset(store.snapshot, {
    pageName: 'prompt',
    projectCellwiseModel: buildAstFromCellwiseModel,
  });

  assert.equal(result.source, 'model_asset');
  assert.equal(result.assetType, 'cellwise_model');
  assert.equal(result.modelId, -21);
  assert.equal(result.ast?.id, 'root_prompt_filltable');
}

const tests = [
  test_prompt_page_prefers_model_asset_over_legacy_builder,
  test_prompt_page_upgrades_stale_persisted_catalog_to_cellwise_model,
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
