#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createDemoStore } from '../../packages/ui-model-demo-frontend/src/demo_modeltable.js';
import { buildAstFromSchema } from '../../packages/ui-model-demo-frontend/src/ui_schema_projection.js';
import { resolveRouteUiAst } from '../../packages/ui-model-demo-frontend/src/route_ui_projection.js';
import { resolveNavigableRoutePath } from '../../packages/ui-model-demo-frontend/src/app_shell_route_sync.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function setStateLabel(store, key, t, v) {
  const model = store.runtime.getModel(-2);
  store.runtime.addLabel(model, 0, 0, 0, { k: key, t, v });
  store.refreshSnapshot();
}

function textPayload(ast) {
  if (!ast || typeof ast !== 'object') return '';
  const props = ast.props && typeof ast.props === 'object' ? ast.props : {};
  return String(props.text ?? props.title ?? '');
}

function test_prompt_route_prefers_local_path_over_shared_ui_page() {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  setStateLabel(store, 'ws_apps_registry', 'json', [{ model_id: 100, name: 'Model 100', source: 'k8s-worker' }]);
  setStateLabel(store, 'ui_page', 'str', 'workspace');
  setStateLabel(store, 'ws_app_selected', 'int', 100);
  setStateLabel(store, 'selected_model_id', 'str', '100');

  const resolved = resolveRouteUiAst(store.snapshot, '/prompt', { projectSchemaModel: buildAstFromSchema });
  assert.equal(resolved.pageName, 'prompt');
  assert.notEqual(textPayload(resolved.ast), '请从左侧选择一个应用', 'prompt route must not project the shared workspace placeholder');
}

function test_workspace_route_prefers_local_path_over_shared_ui_page() {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  setStateLabel(store, 'ws_apps_registry', 'json', [{ model_id: 100, name: 'Model 100', source: 'k8s-worker' }]);
  setStateLabel(store, 'ui_page', 'str', 'prompt');
  setStateLabel(store, 'ws_app_selected', 'int', 100);
  setStateLabel(store, 'selected_model_id', 'str', '0');

  const resolved = resolveRouteUiAst(store.snapshot, '/workspace', { projectSchemaModel: buildAstFromSchema });
  assert.equal(resolved.pageName, 'workspace');
  assert.notEqual(
    textPayload(resolved.ast),
    '请从左侧选择一个应用',
    'workspace route must not fall back to the empty selection placeholder when ws_app_selected exists',
  );
}

const tests = [
  test_prompt_route_prefers_local_path_over_shared_ui_page,
  test_workspace_route_prefers_local_path_over_shared_ui_page,
  function test_deep_link_survives_before_catalog_bootstrap() {
    const emptySnapshot = { models: { '-2': { cells: { '0,0,0': { labels: {} } } } } };
    assert.equal(
      resolveNavigableRoutePath(emptySnapshot, '/workspace'),
      '/workspace',
      'route normalization must not rewrite a known hash path to home before page catalog is available',
    );
  },
  function test_store_route_path_is_modeled_as_reactive_state() {
    const localSource = fs.readFileSync(path.join(repoRoot, 'packages/ui-model-demo-frontend/src/demo_modeltable.js'), 'utf8');
    const remoteSource = fs.readFileSync(path.join(repoRoot, 'packages/ui-model-demo-frontend/src/remote_store.js'), 'utf8');
    assert.match(localSource, /routeState\s*=\s*reactive\(\{\s*path:\s*'\/'\s*\}\)/, 'local demo store route path must be reactive');
    assert.match(remoteSource, /routeState\s*=\s*reactive\(\{\s*path:\s*'\/'\s*\}\)/, 'remote store route path must be reactive');
  },
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
