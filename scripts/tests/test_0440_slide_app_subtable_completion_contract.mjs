#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  buildClientSnapshotForPrincipal,
  buildScopedVisibleClientSnapshotForRuntime,
  createServerState,
  deriveWorkspaceRegistryFromSnapshot,
} from '../../packages/ui-model-demo-server/server.mjs';
import {
  BUILTIN_WORKSPACE_APP_MODEL_IDS,
  WORKSPACE_ENTRY_MODEL_IDS,
} from '../../packages/ui-model-demo-frontend/src/model_ids.js';

const MIGRATED_SOURCE_APPS = Object.freeze([
  { sourceHostModelId: 100, name: 'E2E 颜色生成器', sourceDe: 'RemoteWorker R1' },
  { sourceHostModelId: 1007, name: 'Three Scene', sourceDe: 'workspace', closureModels: [0, 1] },
  { sourceHostModelId: 1011, name: 'Static', sourceDe: 'workspace', closureModels: [0, 1] },
  { sourceHostModelId: 1030, name: '滑动 APP 导入', sourceDe: 'zip-import', closureModels: [0, 1] },
  { sourceHostModelId: 1036, name: 'Mgmt Bus Console', sourceDe: 'UI Server' },
  { sourceHostModelId: 1050, name: '最小 Submit 双总线示例', sourceDe: 'RemoteWorker R1' },
  { sourceHostModelId: 1051, name: '工作区管理器', sourceDe: 'Workspace-Manager-DE' },
  { sourceHostModelId: 1080, name: 'Matrix Suite', sourceDe: 'UI Server' },
  { sourceHostModelId: 1081, name: 'Settings', sourceDe: 'UI Server' },
  { sourceHostModelId: 1082, name: 'ModelTable', sourceDe: 'UI Server' },
  { sourceHostModelId: 1083, name: 'Matrix Chat', sourceDe: 'UI Server' },
  { sourceHostModelId: 1086, name: 'To Do Board', sourceDe: 'UI Server' },
]);

const HIDDEN_SOURCE_TEMPLATE_IDS = Object.freeze([1034, 1037]);

function principal(subject) {
  return {
    subject,
    userId: subject,
    capabilities: [
      'app:read',
      'app:write',
      'workspace:read',
      'workspace:write',
      'slide_app:use',
      'matrix:read',
      'admin:read',
    ],
  };
}

function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0440-slide-app-subtable-'));
  const previous = {
    DY_AUTH: process.env.DY_AUTH,
    DY_DEV_FAKE_LOGIN: process.env.DY_DEV_FAKE_LOGIN,
    DY_PERSISTED_ASSET_ROOT: process.env.DY_PERSISTED_ASSET_ROOT,
    WORKER_BASE_WORKSPACE: process.env.WORKER_BASE_WORKSPACE,
    WORKER_BASE_DATA_ROOT: process.env.WORKER_BASE_DATA_ROOT,
    DOCS_ROOT: process.env.DOCS_ROOT,
    STATIC_PROJECTS_ROOT: process.env.STATIC_PROJECTS_ROOT,
  };
  let state = null;
  process.env.DY_AUTH = '0';
  process.env.DY_DEV_FAKE_LOGIN = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0440_slide_app_subtable_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  try {
    state = createServerState({ dbPath: null });
    return fn(state);
  } finally {
    if (state?.runtime?.persistence && typeof state.runtime.persistence.close === 'function') {
      state.runtime.persistence.close();
    }
    rmSync(tempRoot, { recursive: true, force: true });
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function registryForPrincipal(runtime, subject) {
  return deriveWorkspaceRegistryFromSnapshot({
    snapshot: buildClientSnapshotForPrincipal(runtime.snapshot(), principal(subject)),
  });
}

function labelsAt(modelSnap, cellKey = '0,0,0') {
  return modelSnap?.cells?.[cellKey]?.labels || {};
}

function rootLabelsFor(runtime, ref) {
  const model = runtime.getModel(ref);
  assert.ok(model, `model required: ${ref.table_id}|${ref.model_id}`);
  const cell = runtime.getCell(model, 0, 0, 0);
  return cell && cell.labels ? cell.labels : new Map();
}

function entriesBySourceHostId(registry, sourceHostModelId) {
  return registry.filter((entry) => entry.source_host_model_id === sourceHostModelId);
}

function hostEntryFor(registry, sourceHostModelId) {
  return registry.find((entry) => entry.table_id === 'host' && entry.model_id === sourceHostModelId);
}

function appEntryFor(registry, sourceHostModelId) {
  const entries = entriesBySourceHostId(registry, sourceHostModelId);
  assert.equal(entries.length, 1, `source_${sourceHostModelId}_must_have_exactly_one_app_table_entry`);
  return entries[0];
}

function findHostSubtableConnections(runtime, tableId) {
  const model0 = runtime.getModel(0);
  const matches = [];
  for (const cell of model0.cells.values()) {
    for (const label of cell.labels.values()) {
      if (label && label.t === 'model.subtableconnection' && label.v?.table_id === tableId) {
        matches.push({ cell, label });
      }
    }
  }
  return matches;
}

function setRuntimePrincipal(state, subject) {
  const model0 = state.runtime.getModel(0);
  state.runtime.principalRuntimeKey = `subject:${subject}`;
  state.runtime.addLabel(model0, 0, 0, 0, { k: 'principal_runtime_key', t: 'str', v: `subject:${subject}` });
}

function test_workspace_allowlists_no_longer_expose_migrated_host_positive_apps() {
  const sourceIds = MIGRATED_SOURCE_APPS.map((app) => app.sourceHostModelId);
  for (const sourceId of sourceIds) {
    assert.equal(
      WORKSPACE_ENTRY_MODEL_IDS.includes(sourceId),
      false,
      `workspace_allowlist_must_not_expose_host_source_model_${sourceId}`,
    );
    assert.equal(
      BUILTIN_WORKSPACE_APP_MODEL_IDS.includes(sourceId),
      false,
      `builtin_allowlist_must_not_classify_host_source_model_${sourceId}`,
    );
  }
  for (const hiddenId of HIDDEN_SOURCE_TEMPLATE_IDS) {
    assert.equal(
      WORKSPACE_ENTRY_MODEL_IDS.includes(hiddenId),
      false,
      `hidden_source_template_${hiddenId}_must_not_become_workspace_visible`,
    );
  }
  return { key: 'workspace_allowlists_no_longer_expose_migrated_host_positive_apps', status: 'PASS' };
}

function test_all_user_visible_slide_apps_are_principal_app_table_entries() {
  return withServerState((state) => {
    const registry = registryForPrincipal(state.runtime, 'local-dev');
    for (const app of MIGRATED_SOURCE_APPS) {
      assert.equal(
        hostEntryFor(registry, app.sourceHostModelId),
        undefined,
        `host_source_model_${app.sourceHostModelId}_must_not_remain_user_facing`,
      );
      const entry = appEntryFor(registry, app.sourceHostModelId);
      assert.equal(entry.name, app.name, `source_${app.sourceHostModelId}_must_keep_app_name`);
      assert.equal(entry.table_id.startsWith('app:local-dev:'), true, `source_${app.sourceHostModelId}_must_use_principal_app_table`);
      assert.equal(entry.model_id, 0, `source_${app.sourceHostModelId}_app_table_root_must_use_model0`);
      assert.equal(entry.source_de, app.sourceDe, `source_${app.sourceHostModelId}_must_keep_source_de`);

      const labels = rootLabelsFor(state.runtime, { table_id: entry.table_id, model_id: 0 });
      assert.equal(labels.get('model_type')?.t, 'model.subtable', `source_${app.sourceHostModelId}_root_must_declare_model_subtable`);
      assert.equal(labels.get('slide_capable')?.v, true, `source_${app.sourceHostModelId}_root_must_remain_slide_capable`);
      assert.equal(labels.get('slid_in_source_host_model_id')?.v, app.sourceHostModelId, `source_${app.sourceHostModelId}_root_must_store_source_host_model_id`);

      const connections = findHostSubtableConnections(state.runtime, entry.table_id);
      assert.equal(connections.length, 1, `source_${app.sourceHostModelId}_must_have_one_host_subtableconnection`);
      assert.deepEqual(
        connections[0].label.v,
        {
          table_id: entry.table_id,
          root_model_id: 0,
          mount_kind: 'slide_app',
          owner_principal_id: 'local-dev',
        },
        `source_${app.sourceHostModelId}_subtableconnection_must_have_strict_owner_shape`,
      );
    }
    return { key: 'all_user_visible_slide_apps_are_principal_app_table_entries', status: 'PASS' };
  });
}

function test_visible_snapshot_includes_only_current_app_table_model_closure() {
  return withServerState((state) => {
    const registry = registryForPrincipal(state.runtime, 'local-dev');
    const threeScene = appEntryFor(registry, 1007);
    const visible = buildScopedVisibleClientSnapshotForRuntime(
      { state, principal: principal('local-dev') },
      { profile: 'visible', visibleModelRefs: [{ table_id: threeScene.table_id, model_id: 0 }] },
    );
    assert.equal(visible.ok, true, `visible snapshot must accept own Three Scene app table: ${visible.error || ''}`);
    assert.deepEqual(Object.keys(visible.snapshot.models || {}), [], 'visible snapshot must not include host models for app table request');
    assert.deepEqual(Object.keys(visible.snapshot.tables || {}), [threeScene.table_id], 'visible snapshot must include only the current app table');
    assert.deepEqual(
      Object.keys(visible.snapshot.tables[threeScene.table_id].models || {}).sort(),
      ['0', '1'],
      'visible snapshot must include the current app root and reachable same-table child model only',
    );
    assert.equal(
      labelsAt(visible.snapshot.tables[threeScene.table_id].models['1']).model_type?.t,
      'model.submt',
      'visible snapshot closure must include the app-local child model data',
    );
    return { key: 'visible_snapshot_includes_only_current_app_table_model_closure', status: 'PASS' };
  });
}

function test_ab_principals_get_isolated_app_tables_and_cross_reads_fail_closed() {
  return withServerState((state) => {
    const localRegistry = registryForPrincipal(state.runtime, 'local-dev');
    setRuntimePrincipal(state, 'drop-test');
    state.ensureSeededSlidInAppSubtables();
    const dropRegistry = registryForPrincipal(state.runtime, 'drop-test');

    for (const app of MIGRATED_SOURCE_APPS) {
      const localEntry = appEntryFor(localRegistry, app.sourceHostModelId);
      const dropEntry = appEntryFor(dropRegistry, app.sourceHostModelId);
      assert.notEqual(
        dropEntry.table_id,
        localEntry.table_id,
        `source_${app.sourceHostModelId}_must_not_share_app_table_across_principals`,
      );
      assert.equal(
        findHostSubtableConnections(state.runtime, localEntry.table_id)[0].label.v.owner_principal_id,
        'local-dev',
        `source_${app.sourceHostModelId}_local_owner_must_be_local_dev`,
      );
      assert.equal(
        findHostSubtableConnections(state.runtime, dropEntry.table_id)[0].label.v.owner_principal_id,
        'drop-test',
        `source_${app.sourceHostModelId}_drop_owner_must_be_drop_test`,
      );
    }

    const dropMatrixChat = appEntryFor(dropRegistry, 1083);
    setRuntimePrincipal(state, 'local-dev');
    const denied = buildScopedVisibleClientSnapshotForRuntime(
      { state, principal: principal('local-dev') },
      { profile: 'visible', visibleModelRefs: [{ table_id: dropMatrixChat.table_id, model_id: 0 }] },
    );
    assert.equal(denied.ok, false, 'visible snapshot must reject another principal migrated app table');
    assert.equal(denied.status, 403, 'cross-principal migrated app visible snapshot must fail closed');
    assert.equal(denied.error, 'model_not_visible', 'cross-principal migrated app visible snapshot must report model_not_visible');
    return { key: 'ab_principals_get_isolated_app_tables_and_cross_reads_fail_closed', status: 'PASS' };
  });
}

function test_developer_guide_documents_full_subtable_worker_authoring_path() {
  const guide = readFileSync('docs/user-guide/slide-app-runtime/slide_app_runtime_developer_guide.md', 'utf8');
  for (const phrase of [
    '子表化滑动 APP 的 authoring checklist',
    '`source_worker` / `source_de` / `from_user` / `to_user`',
    '安装器 materialize 后会在 App table root 写 `t="model.subtable"`',
    'host Model 0 的 index cell 写 `model.subtableconnection`',
    'RemoteWorker provider-owned bundle',
    'bundle_payload',
    'bus_event_submit_0_0_0_0',
    'visibleModelRefs=[{ table_id, model_id }]',
    '只返回当前 principal 可见的目标 App table',
    'A 和 B 看到的 `table_id` 不同',
  ]) {
    assert.ok(guide.includes(phrase), `developer_guide_must_document:${phrase}`);
  }
  return { key: 'developer_guide_documents_full_subtable_worker_authoring_path', status: 'PASS' };
}

const tests = [
  test_workspace_allowlists_no_longer_expose_migrated_host_positive_apps,
  test_all_user_visible_slide_apps_are_principal_app_table_entries,
  test_visible_snapshot_includes_only_current_app_table_model_closure,
  test_ab_principals_get_isolated_app_tables_and_cross_reads_fail_closed,
  test_developer_guide_documents_full_subtable_worker_authoring_path,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    const result = test();
    console.log(`[${result.status}] ${result.key}`);
    passed += 1;
  } catch (error) {
    console.log(`[FAIL] ${test.name}: ${error && error.stack ? error.stack : error}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
