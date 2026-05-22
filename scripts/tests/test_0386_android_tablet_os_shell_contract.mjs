#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

import { createRenderer as createEsmRenderer } from '../../packages/ui-renderer/src/renderer.mjs';
import registryRaw from '../../packages/ui-renderer/src/component_registry_v1.json' with { type: 'json' };
import { createDemoStore } from '../../packages/ui-model-demo-frontend/src/demo_modeltable.js';
import { resolveNavigableRoutePath } from '../../packages/ui-model-demo-frontend/src/app_shell_route_sync.js';
import { resolveRouteUiAst } from '../../packages/ui-model-demo-frontend/src/route_ui_projection.js';
import { deriveWorkspaceRegistryFromSnapshot } from '../../packages/ui-model-demo-server/server.mjs';

const REQUIRED_SHELL_COMPONENTS = Object.freeze([
  'StatusBar',
  'Taskbar',
  'NavigationRail',
  'DesktopGrid',
  'AppCard',
  'WidgetPanel',
  'QuickSettingsPanel',
  'AppWindow',
  'SplitPaneWindow',
  'AppSwitcher',
  'HostSlot',
]);

const require = createRequire(import.meta.url);
const { createRenderer: createCjsRenderer } = require('../../packages/ui-renderer/src');

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

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function readText(path) {
  return readFileSync(path, 'utf8');
}

function getRootLabels(snapshot, modelId) {
  return snapshot?.models?.[String(modelId)]?.cells?.['0,0,0']?.labels ?? {};
}

function getWorkspaceRegistry(snapshot) {
  const raw = snapshot?.models?.['-2']?.cells?.['0,0,0']?.labels?.ws_apps_registry?.v;
  return Array.isArray(raw) ? raw : [];
}

function test_iteration_index_registers_0386_0387() {
  const text = readText('docs/ITERATIONS.md');

  assert.match(text, /0386-android-tablet-os-shell-contract/, 'iteration_index_must_register_0386');
  assert.match(text, /0387-android-tablet-os-shell-mvp/, 'iteration_index_must_register_0387');
  assert.match(text, /dropx\/dev_0386-0387-android-tablet-os-shell/, 'iteration_index_must_use_current_branch');

  return { key: 'iteration_index_registers_0386_0387', status: 'PASS' };
}

function test_required_shell_components_registered() {
  const components = registryRaw?.components ?? {};

  for (const type of REQUIRED_SHELL_COMPONENTS) {
    assert.equal(components[type]?.tree_kind, type, `${type}_tree_kind_missing`);
    assert.equal(components[type]?.vnode_kind, type, `${type}_vnode_kind_missing`);
  }

  return { key: 'required_shell_components_registered', status: 'PASS' };
}

function test_renderer_supports_required_shell_components() {
  const source = readText('packages/ui-renderer/src/renderer.mjs');

  for (const type of REQUIRED_SHELL_COMPONENTS) {
    assert.match(source, new RegExp(`node\\.type === '${type}'`), `${type}_renderer_branch_missing`);
  }

  return { key: 'renderer_supports_required_shell_components', status: 'PASS' };
}

function test_cjs_esm_renderer_shell_parity() {
  const shellAst = {
    id: 'shell_root',
    type: 'StatusBar',
    props: { title: 'Shell', subtitle: 'Parity', status: 'online' },
    children: [
      { id: 'shell_slot', type: 'HostSlot', props: { name: 'rightActions' } },
      { id: 'shell_card', type: 'AppCard', props: { title: 'Color', summary: 'Generate colors', mark: 'Co' } },
    ],
  };
  const host = {
    getSnapshot: () => ({ models: {} }),
    dispatchAddLabel: () => {},
    dispatchRmLabel: () => {},
  };
  const esmTree = createEsmRenderer({ host }).renderTree(shellAst);
  const cjsTree = createCjsRenderer({ host }).renderTree(shellAst);
  assert.equal(esmTree.children.length, 2, 'esm_shell_tree_must_keep_children');
  assert.equal(cjsTree.children.length, 2, 'cjs_shell_tree_must_keep_children');
  assert.deepEqual(cjsTree, esmTree, 'cjs_shell_tree_must_match_esm_shell_tree');

  const makeH = (tag, props, children) => ({ tag, props: props || {}, children });
  const esmVNode = createEsmRenderer({ host, vue: { h: makeH } }).renderVNode(shellAst, {
    slots: { rightActions: () => makeH('button', { id: 'injected' }, 'Injected') },
  });
  const cjsVNode = createCjsRenderer({ host, vue: { h: makeH } }).renderVNode(shellAst, {
    slots: { rightActions: () => makeH('button', { id: 'injected' }, 'Injected') },
  });
  const esmActions = esmVNode.children[1].children;
  const cjsActions = cjsVNode.children[1].children;
  assert.ok(esmActions.some((child) => child?.props?.id === 'injected'), 'esm_hostslot_must_inject_slot_content');
  assert.ok(cjsActions.some((child) => child?.props?.id === 'injected'), 'cjs_hostslot_must_inject_slot_content');
  assert.deepEqual(cjsVNode, esmVNode, 'cjs_shell_vnode_must_match_esm_shell_vnode');

  return { key: 'cjs_esm_renderer_shell_parity', status: 'PASS' };
}

function test_no_mui_or_quasar_runtime_dependency() {
  const packageFiles = [
    'package.json',
    'packages/ui-model-demo-frontend/package.json',
  ];
  const sourceFiles = [
    'packages/ui-renderer/src/renderer.mjs',
    'packages/ui-model-demo-frontend/src/demo_app.js',
    'packages/ui-model-demo-frontend/src/route_ui_projection.js',
  ];

  for (const path of packageFiles) {
    const text = readText(path);
    assert.doesNotMatch(text, /"(@mui\/|quasar")/, `${path}_must_not_add_mui_or_quasar_dependency`);
  }
  for (const path of sourceFiles) {
    const text = readText(path);
    assert.doesNotMatch(text, /from ['"](@mui\/|quasar)/, `${path}_must_not_import_mui_or_quasar`);
  }

  return { key: 'no_mui_or_quasar_runtime_dependency', status: 'PASS' };
}

function test_slide_apps_have_summary_metadata() {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const registry = getWorkspaceRegistry(store.snapshot)
    .filter((entry) => entry?.slide_capable === true && Number.isInteger(entry.model_id) && entry.model_id > 0);

  assert.ok(registry.length >= 5, 'workspace_registry_must_have_current_slide_apps');
  for (const entry of registry) {
    const labels = getRootLabels(store.snapshot, entry.model_id);
    const summary = labels.slide_app_summary?.v;
    assert.equal(typeof summary, 'string', `slide_app_${entry.model_id}_summary_label_missing`);
    assert.ok(summary.trim().length >= 8, `slide_app_${entry.model_id}_summary_too_short`);
  }

  return { key: 'slide_apps_have_summary_metadata', status: 'PASS' };
}

function test_workspace_registry_exposes_app_summary() {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const registry = getWorkspaceRegistry(store.snapshot)
    .filter((entry) => entry?.slide_capable === true && Number.isInteger(entry.model_id) && entry.model_id > 0);
  const serverRegistry = deriveWorkspaceRegistryFromSnapshot({
    snapshot: store.snapshot,
    getParentInfo: () => ({ parentModelId: 0 }),
  }).filter((entry) => entry?.slide_capable === true && Number.isInteger(entry.model_id) && entry.model_id > 0);

  for (const entry of registry) {
    assert.equal(typeof entry.summary, 'string', `registry_entry_${entry.model_id}_summary_missing`);
    assert.ok(entry.summary.trim().length >= 8, `registry_entry_${entry.model_id}_summary_too_short`);
    assert.ok(String(entry.slide_surface_type ?? '').trim(), `registry_entry_${entry.model_id}_surface_type_missing`);
  }
  for (const entry of serverRegistry) {
    assert.equal(typeof entry.summary, 'string', `server_registry_entry_${entry.model_id}_summary_missing`);
    assert.ok(entry.summary.trim().length >= 8, `server_registry_entry_${entry.model_id}_summary_too_short`);
    assert.ok(String(entry.slide_surface_type ?? '').trim(), `server_registry_entry_${entry.model_id}_surface_type_missing`);
  }

  return { key: 'workspace_registry_exposes_app_summary', status: 'PASS' };
}

function test_workspace_registry_does_not_silent_fallback_missing_summary() {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const projectionSnapshot = cloneJson(store.snapshot);
  const registry = projectionSnapshot.models['-2'].cells['0,0,0'].labels.ws_apps_registry.v;
  const target = registry.find((entry) => entry?.slide_capable === true && Number.isInteger(entry.model_id) && entry.model_id > 0);
  assert.ok(target, 'test_must_have_slide_capable_entry');
  target.summary = '';
  assert.throws(
    () => resolveRouteUiAst(projectionSnapshot, '/'),
    /missing required slide_app_summary/,
    'desktop_projection_must_reject_summaryless_slide_apps',
  );

  const serverSnapshot = cloneJson(store.snapshot);
  delete serverSnapshot.models[String(target.model_id)].cells['0,0,0'].labels.slide_app_summary;
  assert.throws(
    () => deriveWorkspaceRegistryFromSnapshot({
      snapshot: serverSnapshot,
      getParentInfo: () => ({ parentModelId: 0 }),
    }),
    /missing required slide_app_summary/,
    'server_registry_must_reject_summaryless_slide_apps',
  );

  return { key: 'workspace_registry_does_not_silent_fallback_missing_summary', status: 'PASS' };
}

function test_root_projection_uses_android_tablet_shell_nodes() {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  assert.equal(resolveNavigableRoutePath(store.snapshot, '/'), '/', 'home_route_must_not_redirect_to_workspace');
  const ast = resolveRouteUiAst(store.snapshot, '/')?.ast;
  const types = new Set(collectNodes(ast, (node) => REQUIRED_SHELL_COMPONENTS.includes(node.type)).map((node) => node.type));

  for (const type of ['StatusBar', 'Taskbar', 'DesktopGrid', 'AppCard']) {
    assert.ok(types.has(type), `root_projection_missing_${type}`);
  }
  for (const type of ['NavigationRail', 'WidgetPanel', 'QuickSettingsPanel']) {
    assert.ok(!types.has(type), `root_projection_must_not_render_${type}_after_0390`);
  }
  const appCards = collectNodes(ast, (node) => node.type === 'AppCard');
  assert.ok(appCards.length >= 5, 'root_projection_must_render_workspace_app_cards');
  for (const card of appCards) {
    assert.ok(String(card.props?.title ?? card.props?.label ?? '').trim(), `${card.id}_must_have_title`);
    assert.ok(String(card.props?.summary ?? '').trim().length >= 8, `${card.id}_must_have_summary`);
  }

  return { key: 'root_projection_uses_android_tablet_shell_nodes', status: 'PASS' };
}

function test_local_persisted_asset_sync_includes_desktop_catalog() {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-assets-0387-'));
  try {
    execFileSync('bash', ['scripts/ops/sync_local_persisted_assets.sh'], {
      cwd: process.cwd(),
      env: { ...process.env, LOCAL_PERSISTED_ASSET_ROOT: tempRoot },
      stdio: 'pipe',
    });
    const desktopPath = join(tempRoot, 'system/ui/desktop_catalog_ui.json');
    assert.ok(existsSync(desktopPath), 'local_asset_sync_must_publish_desktop_catalog_file');
    const manifest = JSON.parse(readFileSync(join(tempRoot, 'manifest.v0.json'), 'utf8'));
    assert.ok(
      manifest.entries?.some((entry) => entry?.path === 'system/ui/desktop_catalog_ui.json' && entry?.scope?.includes('ui-server')),
      'local_asset_sync_manifest_must_include_desktop_catalog',
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }

  return { key: 'local_persisted_asset_sync_includes_desktop_catalog', status: 'PASS' };
}

function test_foreground_shell_exposes_focused_window_drawer() {
  const source = readText('packages/ui-model-demo-frontend/src/desktop_foreground_shell_ast.js');
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const ast = resolveRouteUiAst(store.snapshot, '/')?.ast;

  assert.match(source, /buildForegroundShellAst/, 'foreground_shell_must_build_modeltable_shell_ast');
  assert.match(source, /buildAstFromCellwiseModel/, 'foreground_shell_must_use_cellwise_template');
  const desktopCatalog = readText('packages/worker-base/system-models/desktop_catalog_ui.json');
  assert.match(desktopCatalog, /desktop_foreground_shell_model/, 'foreground_shell_template_must_live_in_cellwise_model');
  assert.ok(collectNodes(ast, (node) => node.type === 'StatusBar').length > 0, 'foreground_shell_must_use_statusbar_component');
  assert.doesNotMatch(source, /type:\s*'QuickSettingsPanel'/, 'foreground_shell_must_not_use_inline_quicksettings_component');
  assert.doesNotMatch(source, /type:\s*'SplitPaneWindow'/, 'foreground_shell_must_not_use_splitpane_component_after_0390');
  assert.match(desktopCatalog, /\"v\": \"Drawer\"/, 'foreground_shell_must_use_drawer_for_details');
  assert.match(desktopCatalog, /\"v\": \"AppWindow\"/, 'foreground_shell_must_use_appwindow_component');
  assert.match(desktopCatalog, /\"v\": \"HostSlot\"/, 'foreground_shell_must_use_hostslot_for_app_content');
  assert.match(desktopCatalog, /desktop-foreground-player/, 'foreground_shell_must_keep_foreground_player');
  assert.match(desktopCatalog, /desktop-app-detail-drawer/, 'foreground_shell_must_hide_details_in_drawer');

  return { key: 'foreground_shell_exposes_focused_window_drawer', status: 'PASS' };
}

const tests = [
  test_iteration_index_registers_0386_0387,
  test_required_shell_components_registered,
  test_renderer_supports_required_shell_components,
  test_cjs_esm_renderer_shell_parity,
  test_no_mui_or_quasar_runtime_dependency,
  test_slide_apps_have_summary_metadata,
  test_workspace_registry_exposes_app_summary,
  test_workspace_registry_does_not_silent_fallback_missing_summary,
  test_root_projection_uses_android_tablet_shell_nodes,
  test_local_persisted_asset_sync_includes_desktop_catalog,
  test_foreground_shell_exposes_focused_window_drawer,
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
