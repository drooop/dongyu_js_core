#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createDemoStore } from '../../packages/ui-model-demo-frontend/src/demo_modeltable.js';
import { createGalleryStore } from '../../packages/ui-model-demo-frontend/src/gallery_store.js';
import { buildAstFromCellwiseModel } from '../../packages/ui-model-demo-frontend/src/ui_cellwise_projection.js';
import {
  GALLERY_CATALOG_MODEL_ID,
  GALLERY_STATE_MODEL_ID,
} from '../../packages/ui-model-demo-frontend/src/model_ids.js';

function getLabelValue(runtime, ref) {
  const model = runtime.getModel(ref.model_id);
  assert.ok(model, `missing_model:${ref.model_id}`);
  const cell = runtime.getCell(model, ref.p, ref.r, ref.c);
  const label = cell.labels.get(ref.k);
  return label ? label.v : undefined;
}

function test_gallery_ui_ast_is_loaded_from_explicit_model_label_asset() {
  const store = createGalleryStore();
  const ast = store.getUiAst();

  assert.ok(store.runtime.getModel(GALLERY_CATALOG_MODEL_ID), 'gallery_catalog_model_missing');
  assert.ok(ast && typeof ast === 'object', 'gallery_ast_missing');
  assert.deepEqual(
    ast,
    buildAstFromCellwiseModel(store.snapshot, GALLERY_CATALOG_MODEL_ID),
    'gallery_ast_must_come_from_cellwise_model_source',
  );
  assert.equal(
    getLabelValue(store.runtime, { model_id: GALLERY_CATALOG_MODEL_ID, p: 0, r: 0, c: 0, k: 'ui_ast_v0' }),
    undefined,
    'gallery_root_ui_ast_v0_must_be_removed',
  );
}

function test_gallery_state_defaults_are_seeded_as_model_assets() {
  const store = createGalleryStore();
  assert.equal(getLabelValue(store.runtime, { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 1, c: 0, k: 'checkbox_demo' }), false);
  assert.equal(getLabelValue(store.runtime, { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 3, c: 0, k: 'slider_demo' }), 42);
  assert.equal(getLabelValue(store.runtime, { model_id: GALLERY_STATE_MODEL_ID, p: 0, r: 6, c: 0, k: 'wave_b_tabs' }), 'alpha');
}

function test_shared_runtime_registers_gallery_for_workspace() {
  const demoStore = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  createGalleryStore({ runtime: demoStore.runtime, snapshot: demoStore.snapshot, refreshSnapshot: demoStore.refreshSnapshot });
  const registry = getLabelValue(demoStore.runtime, { model_id: -2, p: 0, r: 0, c: 0, k: 'ws_apps_registry' });
  assert.ok(Array.isArray(registry), 'ws_apps_registry_missing');
  assert.ok(registry.some((entry) => entry && entry.model_id === GALLERY_CATALOG_MODEL_ID), 'gallery_not_registered_in_workspace');
}

const tests = [
  test_gallery_ui_ast_is_loaded_from_explicit_model_label_asset,
  test_gallery_state_defaults_are_seeded_as_model_assets,
  test_shared_runtime_registers_gallery_for_workspace,
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
