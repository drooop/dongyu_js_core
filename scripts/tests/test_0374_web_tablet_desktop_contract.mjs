#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createDemoStore } from '../../packages/ui-model-demo-frontend/src/demo_modeltable.js';
import { readPageCatalog, findPageEntryByPath } from '../../packages/ui-model-demo-frontend/src/page_asset_resolver.js';
import { resolveRouteUiAst } from '../../packages/ui-model-demo-frontend/src/route_ui_projection.js';
import { buildAstFromCellwiseModel } from '../../packages/ui-model-demo-frontend/src/ui_cellwise_projection.js';
import { createRenderer } from '../../packages/ui-renderer/src/renderer.mjs';
import { DESKTOP_CATALOG_MODEL_ID } from '../../packages/ui-model-demo-frontend/src/model_ids.js';
import { dispatchAppShellStateUpdate } from '../../packages/ui-model-demo-frontend/src/app_shell_state_dispatch.js';
import { createRemoteStore } from '../../packages/ui-model-demo-frontend/src/remote_store.js';
import { resolveNavigableRoutePath } from '../../packages/ui-model-demo-frontend/src/app_shell_route_sync.js';
import {
  DESKTOP_FOREGROUND_APP_LABEL,
  DESKTOP_TASK_STACK_LABEL,
  DESKTOP_TASK_SWITCHER_OPEN_LABEL,
  readDesktopTaskStack,
  removeDesktopTaskFromStack,
} from '../../packages/ui-model-demo-frontend/src/desktop_app_state.js';

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

function getEditorStateValue(snapshot, key) {
  return snapshot?.models?.['-2']?.cells?.['0,0,0']?.labels?.[key]?.v;
}

function findWorkspaceAppEntry(snapshot, modelId) {
  const registry = getEditorStateValue(snapshot, 'ws_apps_registry');
  return Array.isArray(registry) ? registry.find((entry) => entry && entry.model_id === modelId) || null : null;
}

function dispatchDesktopButton(store, node) {
  const host = {
    getSnapshot: () => store.snapshot,
    dispatchAddLabel: (label) => store.dispatchAddLabel(label),
    dispatchRmLabel: (labelRef) => store.dispatchRmLabel(labelRef),
  };
  const renderer = createRenderer({ host });
  renderer.dispatchEvent(node, { click: true });
  const result = store.consumeOnce();
  assert.equal(result?.result, 'ok', 'desktop_button_event_must_be_consumed');
  return getEditorStateValue(store.snapshot, 'desktop_foreground_app_json');
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function localStateMailboxLabel(target, value, opId) {
  return {
    p: 0,
    r: 0,
    c: 1,
    k: 'ui_event',
    t: 'event',
    v: {
      event_id: Date.now(),
      type: 'label_update',
      source: 'ui_renderer',
      ts: 0,
      payload: {
        action: 'label_update',
        meta: { op_id: opId },
        target,
        value,
      },
    },
  };
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
  const ast = resolveRouteUiAst(store.snapshot, '/')?.ast;

  for (const title of ['Gallery', 'Docs', 'ModelTable', 'Static']) {
    const node = collectNodes(ast, (item) => item.type === 'AppCard' && item.props?.title === title)[0];
    assert.ok(node, `desktop_missing_${title}_app_card`);
    assert.ok(String(node.props?.summary ?? '').trim(), `${title}_app_card_must_have_summary`);
  }

  return { key: 'desktop_exposes_required_system_app_icons', status: 'PASS' };
}

function test_desktop_exposes_workspace_slide_app_icons_from_registry() {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const ast = resolveRouteUiAst(store.snapshot, '/')?.ast;
  const registry = getEditorStateValue(store.snapshot, 'ws_apps_registry');
  const appIds = Array.isArray(registry)
    ? registry
      .filter((entry) => entry && Number.isInteger(entry.model_id) && (entry.slide_capable === true || entry.app_origin === 'builtin'))
      .map((entry) => entry.model_id)
    : [];
  const slideButtons = collectNodes(ast, (node) => (
    (node.type === 'Button' || node.type === 'AppCard')
    && typeof node.id === 'string'
    && node.id.startsWith('desktop_slide_app_')
  ));

  assert.ok(appIds.length >= 3, 'workspace_registry_must_have_apps_for_desktop_contract');
  assert.equal(slideButtons.length, appIds.length, 'desktop_must_project_every_registry_app');
  for (const modelId of appIds) {
    const node = findNodeById(ast, `desktop_slide_app_${modelId}`);
    assert.ok(node, `desktop_must_include_slide_app_${modelId}`);
    assert.equal(node?.props?.modelId, modelId, `desktop_slide_app_${modelId}_must_keep_model_id`);
    assert.equal(node?.bind?.write?.target_ref?.k, DESKTOP_FOREGROUND_APP_LABEL, `desktop_slide_app_${modelId}_must_launch_foreground_app`);
  }

  return { key: 'desktop_exposes_workspace_slide_app_icons_from_registry', status: 'PASS' };
}

function test_desktop_does_not_fallback_to_static_workspace_icons_without_registry() {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const stateLabels = store.snapshot?.models?.['-2']?.cells?.['0,0,0']?.labels;
  assert.ok(stateLabels, 'editor_state_labels_missing');
  delete stateLabels.ws_apps_registry;
  const ast = resolveRouteUiAst(store.snapshot, '/')?.ast;
  const slideButtons = collectNodes(ast, (node) => (
    (node.type === 'Button' || node.type === 'AppCard')
    && typeof node.id === 'string'
    && node.id.startsWith('desktop_slide_app_')
  ));

  assert.deepEqual(
    slideButtons.map((node) => node.id),
    [],
    'desktop_must_not_fallback_to_static_workspace_icons_when_registry_missing',
  );

  return { key: 'desktop_does_not_fallback_to_static_workspace_icons_without_registry', status: 'PASS' };
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
  assert.equal(modelTableEntry, null, 'modeltable_deeplink_must_not_resolve_to_legacy_home_model');
  assert.equal(resolveNavigableRoutePath(store.snapshot, '/modeltable'), '/', 'modeltable_deeplink_must_return_to_desktop_launcher');
  assert.deepEqual(visiblePages, [], 'tablet_desktop_shell_must_not_expose_top_nav_links');

  const resolved = resolveRouteUiAst(store.snapshot, '/');
  assert.equal(resolved?.pageName, 'desktop', 'root_route_projection_page_must_be_desktop');
  assert.equal(resolved?.modelId, DESKTOP_CATALOG_MODEL_ID, 'root_route_projection_model_must_be_desktop');
  assert.equal(resolved?.ast?.id, 'desktop_root', 'root_route_projection_ast_must_be_desktop');

  return { key: 'root_route_resolves_desktop_and_nav_links_are_hidden', status: 'PASS' };
}

function test_desktop_icon_launches_single_foreground_app_state() {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const ast = resolveRouteUiAst(store.snapshot, '/')?.ast;
  const docsButton = findNodeById(ast, 'desktop_slide_app_-23');
  assert.ok(docsButton?.bind?.write, 'desktop_docs_button_must_have_launch_write');

  const foreground = dispatchDesktopButton(store, docsButton);
  assert.equal(foreground?.id, 'docs', 'desktop_docs_button_must_open_docs_id');
  assert.equal(foreground?.kind, 'system', 'desktop_docs_button_must_open_docs_kind');
  assert.equal(foreground?.page, 'docs', 'desktop_docs_button_must_open_docs_page');
  assert.equal(foreground?.path, '/docs', 'desktop_docs_button_must_open_docs_path');

  return { key: 'desktop_icon_launches_single_foreground_app_state', status: 'PASS' };
}

function test_workspace_icon_launches_foreground_and_selects_workspace_model() {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const ast = resolveRouteUiAst(store.snapshot, '/')?.ast;
  const model100Entry = findWorkspaceAppEntry(store.snapshot, 100);
  const model100Button = findNodeById(ast, 'desktop_slide_app_100');
  assert.ok(model100Button?.bind?.write, 'desktop_workspace_button_must_have_launch_write');
  assert.ok(model100Entry, 'workspace_registry_must_include_model100');

  const foreground = dispatchDesktopButton(store, model100Button);
  assert.equal(foreground?.id, 'workspace:100', 'desktop_workspace_button_must_open_model100_id');
  assert.equal(foreground?.kind, 'workspace', 'desktop_workspace_button_must_open_workspace_kind');
  assert.equal(foreground?.page, 'workspace', 'desktop_workspace_button_must_open_workspace_page');
  assert.equal(foreground?.path, '/workspace', 'desktop_workspace_button_must_open_workspace_path');
  assert.equal(foreground?.title, model100Entry.name, 'desktop_workspace_button_must_keep_title');
  assert.equal(foreground?.model_id, 100, 'desktop_workspace_button_must_keep_model_id');
  assert.equal(getEditorStateValue(store.snapshot, 'ws_app_selected'), 100, 'workspace_foreground_must_select_model100');

  return { key: 'workspace_icon_launches_foreground_and_selects_workspace_model', status: 'PASS' };
}

function test_desktop_launch_records_task_stack_and_switcher_state() {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const ast = resolveRouteUiAst(store.snapshot, '/')?.ast;

  dispatchDesktopButton(store, findNodeById(ast, 'desktop_slide_app_-23'));
  dispatchDesktopButton(store, findNodeById(ast, 'desktop_slide_app_100'));

  const foreground = getEditorStateValue(store.snapshot, 'desktop_foreground_app_json');
  const taskStack = readDesktopTaskStack(store.snapshot);
  const taskSwitcherButton = findNodeById(ast, 'desktop_taskbar_tasks');

  assert.equal(foreground?.id, 'workspace:100', 'desktop_must_keep_single_latest_foreground_app');
  assert.deepEqual(
    taskStack.map((task) => task.id),
    ['workspace:100', 'docs'],
    'desktop_task_stack_must_keep_recent_apps_latest_first',
  );
  assert.equal(getEditorStateValue(store.snapshot, DESKTOP_TASK_SWITCHER_OPEN_LABEL), false, 'task_switcher_must_default_closed');
  assert.ok(taskSwitcherButton?.bind?.write, 'desktop_must_expose_task_switcher_button');

  return { key: 'desktop_launch_records_task_stack_and_switcher_state', status: 'PASS' };
}

function test_desktop_task_close_removes_only_target_task() {
  const currentStack = [
    { id: 'workspace:100', kind: 'workspace', page: 'workspace', path: '/workspace', title: 'Color E2E', model_id: 100 },
    { id: 'docs', kind: 'system', page: 'docs', path: '/docs', title: 'Docs' },
    { id: 'gallery', kind: 'system', page: 'gallery', path: '/gallery', title: 'Gallery' },
  ];

  const nextStack = removeDesktopTaskFromStack(currentStack, 'docs');

  assert.deepEqual(
    nextStack.map((task) => task.id),
    ['workspace:100', 'gallery'],
    'desktop_task_close_must_remove_only_the_requested_task',
  );

  return { key: 'desktop_task_close_removes_only_target_task', status: 'PASS' };
}

function test_app_shell_state_dispatch_sequences_multiple_local_writes() {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });

  assert.doesNotThrow(() => {
    dispatchAppShellStateUpdate(store, {
      target: { model_id: -2, p: 0, r: 0, c: 0, k: 'ui_page' },
      value: { t: 'str', v: 'workspace' },
    });
    dispatchAppShellStateUpdate(store, {
      target: { model_id: -2, p: 0, r: 0, c: 0, k: 'ws_app_selected' },
      value: { t: 'int', v: 100 },
    });
  }, 'app_shell_must_consume_between_local_state_writes');

  assert.equal(getEditorStateValue(store.snapshot, 'ui_page'), 'workspace', 'app_shell_sequence_must_set_ui_page');
  assert.equal(getEditorStateValue(store.snapshot, 'ws_app_selected'), 100, 'app_shell_sequence_must_set_workspace_selection');

  return { key: 'app_shell_state_dispatch_sequences_multiple_local_writes', status: 'PASS' };
}

function test_app_shell_state_dispatch_can_open_task_switcher() {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });

  dispatchAppShellStateUpdate(store, {
    target: { model_id: -2, p: 0, r: 0, c: 0, k: DESKTOP_TASK_SWITCHER_OPEN_LABEL },
    value: { t: 'bool', v: true },
  });

  assert.equal(getEditorStateValue(store.snapshot, DESKTOP_TASK_SWITCHER_OPEN_LABEL), true, 'task_switcher_open_must_be_local_ui_state');

  return { key: 'app_shell_state_dispatch_can_open_task_switcher', status: 'PASS' };
}

async function test_remote_store_flushes_derived_task_stack_for_fast_foreground_launches() {
  const originalFetch = globalThis.fetch;
  const originalEventSource = globalThis.EventSource;
  const originalWindow = globalThis.window;
  const requests = [];
  const stateRoot = {
    [DESKTOP_FOREGROUND_APP_LABEL]: { k: DESKTOP_FOREGROUND_APP_LABEL, t: 'json', v: null },
    [DESKTOP_TASK_STACK_LABEL]: { k: DESKTOP_TASK_STACK_LABEL, t: 'json', v: [] },
    [DESKTOP_TASK_SWITCHER_OPEN_LABEL]: { k: DESKTOP_TASK_SWITCHER_OPEN_LABEL, t: 'bool', v: false },
  };
  globalThis.window = { location: { origin: 'http://local.test' } };
  globalThis.EventSource = class {
    addEventListener() {}
    close() {}
  };
  globalThis.fetch = async (url, init = {}) => {
    const entry = { url: String(url), method: String(init?.method || 'GET').toUpperCase(), body: init?.body || '' };
    requests.push(entry);
    const json = entry.url.endsWith('/snapshot')
      ? { snapshot: { models: { '-2': { cells: { '0,0,0': { labels: structuredClone(stateRoot) } } } }, v1nConfig: {} } }
      : { ok: true, result: 'ok' };
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: () => 'application/json' },
      json: async () => json,
      text: async () => JSON.stringify(json),
    };
  };
  try {
    const store = createRemoteStore({ baseUrl: 'http://local.test' });
    await wait(0);
    requests.length = 0;
    const foregroundTarget = { model_id: -2, p: 0, r: 0, c: 0, k: DESKTOP_FOREGROUND_APP_LABEL };
    store.dispatchAddLabel(localStateMailboxLabel(foregroundTarget, {
      t: 'json',
      v: { id: 'docs', kind: 'system', page: 'docs', path: '/docs', title: 'Docs' },
    }, 'it0374_docs'));
    store.dispatchAddLabel(localStateMailboxLabel(foregroundTarget, {
      t: 'json',
      v: { id: 'workspace:100', kind: 'workspace', page: 'workspace', path: '/workspace', title: 'Color E2E', model_id: 100 },
    }, 'it0374_workspace_100'));
    await wait(260);

    const uiEventBodies = requests
      .filter((request) => request.method === 'POST' && request.url.endsWith('/bus_event'))
      .map((request) => JSON.parse(request.body));
    const taskStackBody = uiEventBodies.find((body) => body?.payload?.target?.k === DESKTOP_TASK_STACK_LABEL);

    assert.ok(taskStackBody, 'remote_fast_launch_must_flush_derived_task_stack_to_server');
    assert.deepEqual(
      taskStackBody.payload.value.v.map((task) => task.id),
      ['workspace:100', 'docs'],
      'remote_fast_launch_task_stack_must_include_coalesced_foreground_history',
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalEventSource === undefined) delete globalThis.EventSource;
    else globalThis.EventSource = originalEventSource;
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
  return { key: 'remote_store_flushes_derived_task_stack_for_fast_foreground_launches', status: 'PASS' };
}

function test_task_switcher_exposes_per_task_close_control() {
  const source = readFileSync('packages/ui-model-demo-frontend/src/demo_app.js', 'utf8');

  assert.match(source, /desktop-task-close-/, 'task_switcher_must_render_a_close_control_for_each_task');
  assert.match(source, /removeDesktopTaskFromStack/, 'task_switcher_close_must_remove_the_target_task_from_stack');

  return { key: 'task_switcher_exposes_per_task_close_control', status: 'PASS' };
}

const tests = [
  test_desktop_catalog_model_is_cellwise_ui_surface,
  test_desktop_exposes_required_system_app_icons,
  test_desktop_exposes_workspace_slide_app_icons_from_registry,
  test_desktop_does_not_fallback_to_static_workspace_icons_without_registry,
  test_root_route_resolves_desktop_and_nav_links_are_hidden,
  test_desktop_icon_launches_single_foreground_app_state,
  test_workspace_icon_launches_foreground_and_selects_workspace_model,
  test_desktop_launch_records_task_stack_and_switcher_state,
  test_desktop_task_close_removes_only_target_task,
  test_app_shell_state_dispatch_sequences_multiple_local_writes,
  test_app_shell_state_dispatch_can_open_task_switcher,
  test_remote_store_flushes_derived_task_stack_for_fast_foreground_launches,
  test_task_switcher_exposes_per_task_close_control,
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  try {
    const result = await test();
    console.log(`[${result.status}] ${result.key}`);
    passed += 1;
  } catch (error) {
    console.log(`[FAIL] ${test.name}: ${error.message}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
