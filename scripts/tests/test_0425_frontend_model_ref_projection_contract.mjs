#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createProjectionStore } from '../../packages/ui-model-demo-frontend/src/projection_store.js';
import { createRemoteStore } from '../../packages/ui-model-demo-frontend/src/remote_store.js';
import { buildAstFromCellwiseModel } from '../../packages/ui-model-demo-frontend/src/ui_cellwise_projection.js';
import { buildFocusedWorkspaceAppContentAst } from '../../packages/ui-model-demo-frontend/src/desktop_focused_app_content.js';
import { getForegroundModelLoadState } from '../../packages/ui-model-demo-frontend/src/foreground_app_load_state.js';
import { readAvailableDesktopForegroundApp, readAvailableDesktopTaskStack } from '../../packages/ui-model-demo-frontend/src/desktop_app_state.js';
import { normalizeDesktopWorkspaceApps } from '../../packages/ui-model-demo-frontend/src/route_ui_projection.js';

const originalFetch = globalThis.fetch;
const originalEventSource = globalThis.EventSource;

function label(k, t, v) {
  return { k, t, v };
}

function ref(tableId, modelId, k, p = 0, r = 0, c = 0) {
  return { table_id: tableId, model_id: modelId, p, r, c, k };
}

function fixtureSnapshot() {
  return {
    models: {
      1: {
        table_id: 'host',
        id: 1,
        cells: {
          '0,0,0': { p: 0, r: 0, c: 0, labels: { title: label('title', 'str', 'Host title') } },
        },
      },
    },
    tables: {
      'app:a': {
        table_id: 'app:a',
        models: {
          1: {
            table_id: 'app:a',
            id: 1,
            cells: {
              '0,0,0': { p: 0, r: 0, c: 0, labels: { title: label('title', 'str', 'App A title') } },
            },
          },
        },
      },
      'app:b': {
        table_id: 'app:b',
        models: {
          1: {
            table_id: 'app:b',
            id: 1,
            cells: {
              '0,0,0': { p: 0, r: 0, c: 0, labels: { title: label('title', 'str', 'App B title') } },
            },
          },
        },
      },
    },
    v1nConfig: {},
  };
}

function uiSnapshot() {
  return {
    models: {
      1: {
        table_id: 'host',
        id: 1,
        cells: {
          '0,0,0': {
            p: 0,
            r: 0,
            c: 0,
            labels: {
              ui_authoring_version: label('ui_authoring_version', 'str', 'cellwise.ui.v1'),
              ui_root_node_id: label('ui_root_node_id', 'str', 'host_root'),
            },
          },
          '1,0,0': {
            p: 1,
            r: 0,
            c: 0,
            labels: {
              ui_node_id: label('ui_node_id', 'str', 'host_root'),
              ui_component: label('ui_component', 'str', 'Text'),
              ui_text: label('ui_text', 'str', 'Host UI'),
            },
          },
        },
      },
    },
    tables: {
      'app:ui': {
        table_id: 'app:ui',
        models: {
          1: {
            table_id: 'app:ui',
            id: 1,
            cells: {
              '0,0,0': {
                p: 0,
                r: 0,
                c: 0,
                labels: {
                  ui_authoring_version: label('ui_authoring_version', 'str', 'cellwise.ui.v1'),
                  ui_root_node_id: label('ui_root_node_id', 'str', 'root'),
                },
              },
              '1,0,0': {
                p: 1,
                r: 0,
                c: 0,
                labels: {
                  ui_node_id: label('ui_node_id', 'str', 'root'),
                  ui_component: label('ui_component', 'str', 'Text'),
                  ui_text: label('ui_text', 'str', 'App UI'),
                  ui_text_ref_table_id: label('ui_text_ref_table_id', 'str', 'app:ui'),
                  ui_text_ref_model_id: label('ui_text_ref_model_id', 'int', 1),
                  ui_text_ref_p: label('ui_text_ref_p', 'int', 0),
                  ui_text_ref_r: label('ui_text_ref_r', 'int', 0),
                  ui_text_ref_c: label('ui_text_ref_c', 'int', 0),
                  ui_text_ref_k: label('ui_text_ref_k', 'str', 'title'),
                },
              },
            },
          },
        },
      },
    },
    v1nConfig: {},
  };
}

function desktopRegistrySnapshot() {
  return {
    models: {
      '-2': {
        table_id: 'host',
        id: -2,
        cells: {
          '0,0,0': {
            p: 0,
            r: 0,
            c: 0,
            labels: {
              ws_apps_registry: label('ws_apps_registry', 'json', [
                {
                  table_id: 'app:a',
                  model_id: 1,
                  name: 'Todo A',
                  summary: 'A table app',
                  slide_capable: true,
                  source_de: 'R1',
                  deletable: true,
                },
                {
                  table_id: 'app:b',
                  model_id: 1,
                  name: 'Todo B',
                  summary: 'B table app',
                  slide_capable: true,
                  source_de: 'R1',
                  deletable: true,
                },
              ]),
              desktop_foreground_app_json: label('desktop_foreground_app_json', 'json', {
                id: 'workspace:app:b:1',
                kind: 'workspace',
                page: 'workspace',
                path: '/workspace',
                title: 'Todo B',
                table_id: 'app:b',
                model_id: 1,
              }),
              desktop_task_stack_json: label('desktop_task_stack_json', 'json', [
                {
                  id: 'workspace:app:a:1',
                  kind: 'workspace',
                  page: 'workspace',
                  path: '/workspace',
                  title: 'Todo A',
                  table_id: 'app:a',
                  model_id: 1,
                },
                {
                  id: 'workspace:host:1',
                  kind: 'workspace',
                  page: 'workspace',
                  path: '/workspace',
                  title: 'Wrong host duplicate',
                  model_id: 1,
                },
              ]),
            },
          },
        },
      },
    },
    tables: {},
    v1nConfig: {},
  };
}

function jsonResponse(body) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: () => 'application/json' },
    async json() { return body; },
    async text() { return JSON.stringify(body); },
  };
}

function test_projection_store_table_qualified_atoms_do_not_collide() {
  const projection = createProjectionStore();
  projection.hydrateSnapshot(fixtureSnapshot(), { snapshot_seq: 1 });

  const hostAtom = projection.getLabelAtom(ref('host', 1, 'title'));
  const appAAtom = projection.getLabelAtom(ref('app:a', 1, 'title'));
  const appBAtom = projection.getLabelAtom(ref('app:b', 1, 'title'));

  assert.equal(hostAtom.value, 'Host title');
  assert.equal(appAAtom.value, 'App A title');
  assert.equal(appBAtom.value, 'App B title');
  assert.notEqual(hostAtom, appAAtom, 'host and app table atoms must not collide');
  assert.notEqual(appAAtom, appBAtom, 'same model_id in two app tables must not collide');

  projection.applySnapshotPatch({
    patch_kind: 'json_replace_v1',
    snapshot_seq: 2,
    base_snapshot_seq: 1,
    ops: [{
      op: 'replace_label',
      table_id: 'app:a',
      model_id: 1,
      cell_key: '0,0,0',
      label_key: 'title',
      value: label('title', 'str', 'App A after'),
    }],
  });

  assert.equal(hostAtom.value, 'Host title');
  assert.equal(appAAtom.value, 'App A after');
  assert.equal(appBAtom.value, 'App B title');
}

async function test_remote_store_table_qualified_patch_updates_only_matching_atom() {
  let patchListener = null;
  globalThis.EventSource = class FakeEventSource {
    constructor() {
      this.readyState = 1;
    }
    addEventListener(type, listener) {
      if (type === 'snapshot_patch') patchListener = listener;
    }
    close() {}
  };
  globalThis.fetch = async (url) => {
    const parsed = new URL(String(url));
    if (parsed.pathname === '/snapshot') {
      return jsonResponse({ snapshot: fixtureSnapshot(), snapshot_seq: 1 });
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  try {
    const store = createRemoteStore({ baseUrl: 'http://127.0.0.1:30900' });
    await new Promise((resolve, reject) => {
      const started = Date.now();
      const tick = () => {
        if (store.getEffectiveLabelValue(ref('app:a', 1, 'title')) === 'App A title' && typeof patchListener === 'function') {
          resolve();
          return;
        }
        if (Date.now() - started > 1000) {
          reject(new Error('remote store did not hydrate table-qualified snapshot'));
          return;
        }
        setTimeout(tick, 5);
      };
      tick();
    });

    patchListener({
      data: JSON.stringify({
        snapshot_patch: {
          patch_kind: 'json_replace_v1',
          snapshot_seq: 2,
          base_snapshot_seq: 1,
          ops: [{
            op: 'replace_label',
            table_id: 'app:a',
            model_id: 1,
            cell_key: '0,0,0',
            label_key: 'title',
            value: label('title', 'str', 'App A patched'),
          }],
        },
      }),
    });

    assert.equal(store.getEffectiveLabelValue(ref('host', 1, 'title')), 'Host title');
    assert.equal(store.getEffectiveLabelValue(ref('app:a', 1, 'title')), 'App A patched');
    assert.equal(store.getEffectiveLabelValue(ref('app:b', 1, 'title')), 'App B title');
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
  }
}

function test_cellwise_projection_emits_table_qualified_cell_and_label_refs() {
  const ast = buildAstFromCellwiseModel(uiSnapshot(), { table_id: 'app:ui', model_id: 1 });
  assert(ast, 'App table cellwise model must project');
  assert.deepEqual(
    ast.cell_ref,
    { table_id: 'app:ui', model_id: 1, p: 1, r: 0, c: 0 },
    'projected node cell_ref must be table-qualified',
  );
  assert.deepEqual(
    ast.props.text,
    { $label: { table_id: 'app:ui', model_id: 1, p: 0, r: 0, c: 0, k: 'title' } },
    'label refs authored in cellwise model must preserve table_id',
  );
}

function test_focused_app_content_uses_table_qualified_model_ref() {
  const ast = buildFocusedWorkspaceAppContentAst({
    id: 'workspace:app-ui',
    page: 'workspace',
    path: '/workspace',
    model_id: 1,
    table_id: 'app:ui',
  }, uiSnapshot());
  assert(ast, 'focused app content must render App table AST');
  assert.deepEqual(
    ast.props?.text,
    { $label: { table_id: 'app:ui', model_id: 1, p: 0, r: 0, c: 0, k: 'title' } },
    'focused app must render App table model, not host model with same model_id',
  );
  assert.equal(ast.cell_ref?.table_id, 'app:ui', 'focused app node cell_ref must keep table_id');
}

function test_foreground_lazy_load_uses_table_qualified_ref() {
  const demoAppSource = readFileSync('packages/ui-model-demo-frontend/src/demo_app.js', 'utf8');
  assert.match(
    demoAppSource,
    /const modelRef = typeof app\.table_id === 'string'[\s\S]*?model_id: app\.model_id/u,
    'foreground lazy-load helper must build a table-qualified ModelRef when app.table_id exists',
  );
  assert.match(
    demoAppSource,
    /mainStore\.ensureVisibleModelLoaded\(modelRef\)/u,
    'foreground lazy-load helper must pass ModelRef, not bare app.model_id',
  );
  assert.doesNotMatch(
    demoAppSource,
    /ensureVisibleModelLoaded\(app\.model_id\)/u,
    'foreground lazy-load helper must not request bare host model_id for App tables',
  );
}

function test_desktop_registry_keeps_same_local_model_id_across_app_tables() {
  const apps = normalizeDesktopWorkspaceApps(desktopRegistrySnapshot());
  assert.deepEqual(
    apps.map((app) => `${app.tableId}:${app.modelId}:${app.title}`),
    ['app:a:1:Todo A', 'app:b:1:Todo B'],
    'desktop registry must not dedupe two App tables by bare model_id',
  );
  assert.deepEqual(
    apps.map((app) => app.origin),
    ['slid_in', 'slid_in'],
    'non-host App table entries must not be treated as host built-ins',
  );
}

function test_desktop_registry_allows_app_table_root_model_zero() {
  const snapshot = desktopRegistrySnapshot();
  const labels = snapshot.models['-2'].cells['0,0,0'].labels;
  labels.ws_apps_registry.v = [
    {
      model_id: 0,
      name: 'Host Model 0 Must Stay Hidden',
      summary: 'host root',
      slide_capable: true,
    },
    {
      table_id: 'app:root',
      model_id: 0,
      name: 'App Root UI',
      summary: 'App table root model',
      slide_capable: true,
      source_de: 'R1',
      deletable: true,
    },
  ];
  const apps = normalizeDesktopWorkspaceApps(snapshot);
  assert.deepEqual(
    apps.map((app) => `${app.tableId}:${app.modelId}:${app.title}`),
    ['app:root:0:App Root UI'],
    'desktop registry must allow App table root model_id 0 while keeping host Model 0 hidden',
  );
}

function test_desktop_availability_filters_by_table_qualified_app_ref() {
  const snapshot = desktopRegistrySnapshot();
  const foreground = readAvailableDesktopForegroundApp(snapshot);
  const tasks = readAvailableDesktopTaskStack(snapshot);
  assert.equal(foreground?.id, 'workspace:app:b:1');
  assert.equal(foreground?.table_id, 'app:b');
  assert.deepEqual(
    tasks.map((task) => task.id),
    ['workspace:app:a:1'],
    'desktop task stack must reject host duplicate when only app:a/app:b registry entries exist',
  );
}

function test_foreground_load_state_uses_table_qualified_snapshot_model() {
  const snapshot = {
    models: {},
    tables: {
      'app:ui': {
        table_id: 'app:ui',
        models: {
          1: {
            table_id: 'app:ui',
            id: 1,
            cells: {},
          },
        },
      },
    },
  };
  const queried = [];
  const mainStore = {
    snapshot,
    hasSnapshotModel(refValue) {
      queried.push(refValue);
      return false;
    },
  };
  const state = getForegroundModelLoadState(mainStore, {
    id: 'workspace:app-ui:1',
    kind: 'workspace',
    page: 'workspace',
    path: '/workspace',
    table_id: 'app:ui',
    model_id: 1,
  });
  assert.deepEqual(state.modelRef, { table_id: 'app:ui', model_id: 1 });
  assert.equal(state.foregroundModel?.table_id, 'app:ui');
  assert.equal(state.waitingForVisibleModel, false, 'App table model already present must not show loading');
  assert.deepEqual(queried, [], 'hasSnapshotModel must not be queried when table-qualified model is present');
}

function test_app_table_root_overlay_can_stay_browser_local() {
  const store = createRemoteStore({ baseUrl: 'http://127.0.0.1:30900', autoBootstrap: false });
  const target = ref('app:a', 0, 'draft_text');
  store.stageOverlayValue({
    ref: target,
    value: 'typed locally',
    writeTarget: { commit_policy: 'on_submit' },
  });
  assert.equal(
    store.getEffectiveLabelValue(target),
    'typed locally',
    'App table root model_id 0 overlay must be allowed to stay browser-local until submit',
  );
  const rendererMjs = readFileSync('packages/ui-renderer/src/renderer.mjs', 'utf8');
  const rendererCjs = readFileSync('packages/ui-renderer/src/renderer.js', 'utf8');
  assert.doesNotMatch(rendererMjs, /if \(readRef\.model_id === 0 \|\| readRef\.model_id === -1\) return false/u);
  assert.doesNotMatch(rendererCjs, /if \(readRef\.model_id === 0 \|\| readRef\.model_id === -1\) return false/u);
  assert.match(rendererMjs, /tableId === 'host' && \(readRef\.model_id === 0 \|\| readRef\.model_id === -1\)/u);
  assert.match(rendererCjs, /tableId === 'host' && \(readRef\.model_id === 0 \|\| readRef\.model_id === -1\)/u);
}

const tests = [
  test_projection_store_table_qualified_atoms_do_not_collide,
  test_remote_store_table_qualified_patch_updates_only_matching_atom,
  test_cellwise_projection_emits_table_qualified_cell_and_label_refs,
  test_focused_app_content_uses_table_qualified_model_ref,
  test_foreground_lazy_load_uses_table_qualified_ref,
  test_desktop_registry_keeps_same_local_model_id_across_app_tables,
  test_desktop_registry_allows_app_table_root_model_zero,
  test_desktop_availability_filters_by_table_qualified_app_ref,
  test_foreground_load_state_uses_table_qualified_snapshot_model,
  test_app_table_root_overlay_can_stay_browser_local,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    await test();
    console.log(`[PASS] ${test.name}`);
    passed += 1;
  } catch (err) {
    console.log(`[FAIL] ${test.name}: ${err && err.message ? err.message : err}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
