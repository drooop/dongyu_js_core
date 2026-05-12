#!/usr/bin/env node

import assert from 'node:assert/strict';

import { createDemoStore } from '../../packages/ui-model-demo-frontend/src/demo_modeltable.js';
import { buildAstFromCellwiseModel } from '../../packages/ui-model-demo-frontend/src/ui_cellwise_projection.js';
import { DESKTOP_CATALOG_MODEL_ID } from '../../packages/ui-model-demo-frontend/src/model_ids.js';

function findNodeById(ast, id) {
  let found = null;
  const visit = (node) => {
    if (!node || typeof node !== 'object' || found) return;
    if (node.id === id) {
      found = node;
      return;
    }
    for (const child of Array.isArray(node.children) ? node.children : []) visit(child);
  };
  visit(ast);
  return found;
}

function collectNodes(ast, predicate) {
  const out = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (predicate(node)) out.push(node);
    for (const child of Array.isArray(node.children) ? node.children : []) visit(child);
  };
  visit(ast);
  return out;
}

function getRootLabels(snapshot, modelId) {
  return snapshot?.models?.[String(modelId)]?.cells?.['0,0,0']?.labels ?? {};
}

function test_desktop_catalog_model_is_cellwise_ui_surface() {
  assert.equal(DESKTOP_CATALOG_MODEL_ID, -28, 'desktop_catalog_model_id_must_be_reserved_negative_ui_model');
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const labels = getRootLabels(store.snapshot, DESKTOP_CATALOG_MODEL_ID);

  assert.equal(labels.model_type?.v, 'UI.DesktopCatalog', 'desktop_model_type_missing');
  assert.equal(labels.ui_surface_role?.v, 'desktop.launcher', 'desktop_surface_role_missing');
  assert.equal(labels.ui_authoring_version?.v, 'cellwise.ui.v1', 'desktop_must_use_cellwise_ui_v1');
  assert.equal(labels.ui_root_node_id?.v, 'desktop_root', 'desktop_root_node_id_missing');

  const ast = buildAstFromCellwiseModel(store.snapshot, DESKTOP_CATALOG_MODEL_ID);
  assert.equal(ast?.id, 'desktop_root', 'desktop_ast_root_missing');
  assert.equal(ast?.type, 'Container', 'desktop_root_must_be_container');

  return { key: 'desktop_catalog_model_is_cellwise_ui_surface', status: 'PASS' };
}

function test_desktop_exposes_required_system_app_icons() {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const ast = buildAstFromCellwiseModel(store.snapshot, DESKTOP_CATALOG_MODEL_ID);

  for (const appId of ['gallery', 'docs', 'modeltable', 'prompt', 'static']) {
    const node = findNodeById(ast, `desktop_app_${appId}`);
    assert.ok(node, `desktop_missing_${appId}_app_icon`);
    assert.equal(node.type, 'Button', `${appId}_app_icon_must_be_button`);
    assert.ok(String(node.props?.label ?? '').trim(), `${appId}_app_icon_must_have_label`);
  }

  return { key: 'desktop_exposes_required_system_app_icons', status: 'PASS' };
}

function test_desktop_exposes_workspace_slide_app_icons_from_registry() {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const ast = buildAstFromCellwiseModel(store.snapshot, DESKTOP_CATALOG_MODEL_ID);
  const slideButtons = collectNodes(ast, (node) => (
    node.type === 'Button'
    && typeof node.id === 'string'
    && node.id.startsWith('desktop_slide_app_')
  ));

  assert.ok(slideButtons.length >= 2, 'desktop_must_include_workspace_slide_app_icons');
  assert.ok(findNodeById(ast, 'desktop_slide_app_100'), 'desktop_must_include_model100_slide_app');
  assert.ok(findNodeById(ast, 'desktop_slide_app_1030'), 'desktop_must_include_slide_importer_app');

  return { key: 'desktop_exposes_workspace_slide_app_icons_from_registry', status: 'PASS' };
}

const tests = [
  test_desktop_catalog_model_is_cellwise_ui_surface,
  test_desktop_exposes_required_system_app_icons,
  test_desktop_exposes_workspace_slide_app_icons_from_registry,
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  try {
    const result = test();
    console.log(`[${result.status}] ${result.key}`);
    passed += 1;
  } catch (error) {
    console.log(`[FAIL] ${test.name}: ${error.message}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
