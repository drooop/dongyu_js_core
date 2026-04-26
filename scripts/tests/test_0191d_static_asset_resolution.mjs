#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createDemoStore } from '../../packages/ui-model-demo-frontend/src/demo_modeltable.js';
import { resolvePageAsset } from '../../packages/ui-model-demo-frontend/src/page_asset_resolver.js';
import { buildAstFromCellwiseModel } from '../../packages/ui-model-demo-frontend/src/ui_cellwise_projection.js';

function findNodeById(ast, id) {
  if (!ast) return null;
  if (ast.id === id) return ast;
  const children = ast.children || [];
  for (const child of children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

function test_static_page_prefers_explicit_cellwise_model_asset_and_uses_disabled_label() {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  store.runtime.addLabel(store.runtime.getModel(-2), 0, 0, 0, { k: 'ui_page', t: 'str', v: 'static' });
  store.consumeOnce();
  const result = resolvePageAsset(store.snapshot, {
    pageName: 'static',
    projectCellwiseModel: buildAstFromCellwiseModel,
  });
  assert.equal(result.source, 'model_asset');
  assert.equal(result.assetType, 'cellwise_model');
  assert.equal(result.modelId, -24);
  const root = store.snapshot.models['-24']?.cells?.['0,0,0']?.labels ?? {};
  assert.equal(root.ui_ast_v0, undefined, 'static_root_ui_ast_v0_must_be_removed');
  const btn = findNodeById(result.ast, 'btn_static_upload');
  assert.ok(btn, 'btn_static_upload_missing');
}

const tests = [test_static_page_prefers_explicit_cellwise_model_asset_and_uses_disabled_label];

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
