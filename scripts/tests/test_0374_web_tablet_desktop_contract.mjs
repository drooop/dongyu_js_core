#!/usr/bin/env node

import assert from 'node:assert/strict';

import { createDemoStore } from '../../packages/ui-model-demo-frontend/src/demo_modeltable.js';
import { readPageCatalog, findPageEntryByPath } from '../../packages/ui-model-demo-frontend/src/page_asset_resolver.js';
import { resolveRouteUiAst } from '../../packages/ui-model-demo-frontend/src/route_ui_projection.js';
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

function test_root_route_resolves_desktop_and_nav_links_are_hidden() {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const catalog = readPageCatalog(store.snapshot);
  const rootEntry = findPageEntryByPath(store.snapshot, '/');
  const modelTableEntry = findPageEntryByPath(store.snapshot, '/modeltable');
  const visiblePages = catalog
    .filter((entry) => entry && entry.nav_visible === true)
    .map((entry) => entry.page);

  assert.equal(rootEntry?.page, 'desktop', 'root_route_must_be_desktop_page');
  assert.equal(rootEntry?.model_id, DESKTOP_CATALOG_MODEL_ID, 'root_route_must_use_desktop_model');
  assert.equal(rootEntry?.asset_type, 'cellwise_model', 'desktop_route_must_use_cellwise_model');
  assert.equal(modelTableEntry?.page, 'home', 'modeltable_deeplink_must_preserve_existing_editor_page');
  assert.equal(modelTableEntry?.model_id, -22, 'modeltable_deeplink_must_use_existing_home_model');
  assert.deepEqual(visiblePages, [], 'tablet_desktop_shell_must_not_expose_top_nav_links');

  const resolved = resolveRouteUiAst(store.snapshot, '/');
  assert.equal(resolved?.pageName, 'desktop', 'root_route_projection_page_must_be_desktop');
  assert.equal(resolved?.modelId, DESKTOP_CATALOG_MODEL_ID, 'root_route_projection_model_must_be_desktop');
  assert.equal(resolved?.ast?.id, 'desktop_root', 'root_route_projection_ast_must_be_desktop');

  return { key: 'root_route_resolves_desktop_and_nav_links_are_hidden', status: 'PASS' };
}

const tests = [
  test_desktop_catalog_model_is_cellwise_ui_surface,
  test_desktop_exposes_required_system_app_icons,
  test_desktop_exposes_workspace_slide_app_icons_from_registry,
  test_root_route_resolves_desktop_and_nav_links_are_hidden,
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
