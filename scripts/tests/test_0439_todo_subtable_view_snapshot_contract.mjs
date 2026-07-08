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

const TODO_APP_NAME = 'To Do Board';
const TODO_HOST_MODEL_ID = 1086;

function principal(subject) {
  return {
    subject,
    userId: subject,
    capabilities: ['app:read', 'app:write', 'workspace:read', 'workspace:write', 'slide_app:use'],
  };
}

function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0439-todo-subtable-'));
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
  process.env.WORKER_BASE_WORKSPACE = `it0439_todo_subtable_${Date.now()}`;
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

function labelsAt(modelSnap, cellKey = '0,0,0') {
  return modelSnap?.cells?.[cellKey]?.labels || {};
}

function registryForPrincipal(runtime, subject) {
  return deriveWorkspaceRegistryFromSnapshot({
    snapshot: buildClientSnapshotForPrincipal(runtime.snapshot(), principal(subject)),
  });
}

function todoEntriesForPrincipal(runtime, subject) {
  return registryForPrincipal(runtime, subject).filter((entry) => entry.name === TODO_APP_NAME);
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

function assertConnectionCellBoundaryOnly(match) {
  const allowedTypes = new Set(['model.subtableconnection', 'pin.in', 'pin.out', 'pin.login', 'pin.logout']);
  for (const [key, label] of match.cell.labels.entries()) {
    assert.equal(
      allowedTypes.has(label.t),
      true,
      `todo_connection_cell_must_not_hold_business_label:${key}:${label.t}`,
    );
  }
}

function test_todo_board_is_registered_only_as_principal_app_table() {
  return withServerState((state) => {
    const registry = registryForPrincipal(state.runtime, 'local-dev');
    const hostEntry = registry.find((entry) => entry.table_id === 'host' && entry.model_id === TODO_HOST_MODEL_ID);
    assert.equal(hostEntry, undefined, 'host_model1086_must_not_remain_todo_workspace_app_entry');

    const todoEntries = registry.filter((entry) => entry.name === TODO_APP_NAME);
    assert.equal(todoEntries.length, 1, 'todo_board_must_have_exactly_one_workspace_entry');
    const todoEntry = todoEntries[0];
    assert.equal(typeof todoEntry.table_id, 'string', 'todo_board_must_publish_table_id');
    assert.notEqual(todoEntry.table_id, 'host', 'todo_board_must_be_registered_as_child_app_table');
    assert.equal(todoEntry.model_id, 0, 'todo_board_app_table_root_model_id_must_be_zero');
    assert.equal(todoEntry.source_de, 'UI Server', 'todo_board_migrated_app_table_must_keep_clear_source_de');

    const snapshot = buildClientSnapshotForPrincipal(state.runtime.snapshot(), principal('local-dev'));
    const appRoot = snapshot.tables?.[todoEntry.table_id]?.models?.['0'];
    assert.ok(appRoot, 'todo_board_child_app_table_root_must_exist_in_principal_snapshot');
    assert.equal(labelsAt(appRoot).model_type?.t, 'model.subtable', 'todo_board_child_app_table_root_must_declare_model_subtable');
    assert.equal(labelsAt(appRoot).slide_capable?.v, true, 'todo_board_app_table_root_must_be_slide_capable');
    assert.equal(labelsAt(appRoot).app_name?.v, TODO_APP_NAME, 'todo_board_app_table_root_must_keep_app_name');
    assert.ok(Array.isArray(labelsAt(appRoot).tasks_json?.v), 'todo_board_app_table_root_must_keep_tasks_json');

    const connections = findHostSubtableConnections(state.runtime, todoEntry.table_id);
    assert.equal(connections.length, 1, 'host_must_have_one_model_subtableconnection_for_todo_board');
    assert.deepEqual(
      connections[0].label.v,
      {
        table_id: todoEntry.table_id,
        root_model_id: 0,
        mount_kind: 'slide_app',
        owner_principal_id: 'local-dev',
      },
      'todo_board_model_subtableconnection_must_have_strict_shape',
    );
    assertConnectionCellBoundaryOnly(connections[0]);
    return { key: 'todo_board_is_registered_only_as_principal_app_table', status: 'PASS' };
  });
}

function test_seeded_todo_board_is_principal_scoped() {
  return withServerState((state) => {
    const localEntries = todoEntriesForPrincipal(state.runtime, 'local-dev');
    assert.equal(localEntries.length, 1, 'local_dev_must_see_one_todo_board_app_table');

    const model0 = state.runtime.getModel(0);
    state.runtime.principalRuntimeKey = 'subject:drop-test';
    state.runtime.addLabel(model0, 0, 0, 0, { k: 'principal_runtime_key', t: 'str', v: 'subject:drop-test' });
    const seeded = state.ensureSeededSlidInAppSubtables();
    assert.equal(seeded.some((entry) => entry.status === 'created' && entry.sourceHostModelId === TODO_HOST_MODEL_ID), true, 'new_principal_must_create_own_todo_board_app_table');

    const dropEntries = todoEntriesForPrincipal(state.runtime, 'drop-test');
    assert.equal(dropEntries.length, 1, 'drop_test_must_see_one_todo_board_app_table');
    assert.notEqual(dropEntries[0].table_id, localEntries[0].table_id, 'principals_must_not_share_seeded_todo_app_table');
    assert.equal(findHostSubtableConnections(state.runtime, localEntries[0].table_id)[0].label.v.owner_principal_id, 'local-dev');
    assert.equal(findHostSubtableConnections(state.runtime, dropEntries[0].table_id)[0].label.v.owner_principal_id, 'drop-test');
    return { key: 'seeded_todo_board_is_principal_scoped', status: 'PASS' };
  });
}

function test_existing_seeded_todo_board_repairs_missing_source_metadata() {
  return withServerState((state) => {
    const [todoEntry] = todoEntriesForPrincipal(state.runtime, 'local-dev');
    assert.ok(todoEntry && todoEntry.source_de === 'UI Server', 'todo entry with clear source_de required');
    const model = state.runtime.getModel({ table_id: todoEntry.table_id, model_id: 0 });
    assert.ok(model, 'todo app table root model required');
    state.runtime.rmLabel(model, 0, 0, 0, 'source_de');

    const beforeRepair = todoEntriesForPrincipal(state.runtime, 'local-dev')[0];
    assert.equal(beforeRepair.source_de, 'source unknown', 'fixture must simulate persisted app table missing source_de');
    const seeded = state.ensureSeededSlidInAppSubtables();
    assert.equal(seeded.some((entry) => entry.status === 'existing' && entry.sourceHostModelId === TODO_HOST_MODEL_ID), true, 'existing seeded todo table must be detected');

    const afterRepair = todoEntriesForPrincipal(state.runtime, 'local-dev')[0];
    assert.equal(afterRepair.table_id, todoEntry.table_id, 'repair must keep existing todo app table');
    assert.equal(afterRepair.source_de, 'UI Server', 'existing seeded todo app table must repair source_de');
    return { key: 'existing_seeded_todo_board_repairs_missing_source_metadata', status: 'PASS' };
  });
}

function test_visible_snapshot_for_todo_returns_target_app_table_only() {
  return withServerState((state) => {
    const [todoEntry] = todoEntriesForPrincipal(state.runtime, 'local-dev');
    assert.ok(todoEntry && todoEntry.table_id !== 'host', 'todo_board_app_table_entry_required_for_visible_snapshot_test');

    const visible = buildScopedVisibleClientSnapshotForRuntime(
      { state, principal: principal('local-dev') },
      { profile: 'visible', visibleModelRefs: [{ table_id: todoEntry.table_id, model_id: 0 }] },
    );
    assert.equal(visible.ok, true, `visible snapshot must accept own todo app table: ${visible.error || ''}`);
    assert.deepEqual(Object.keys(visible.snapshot.models || {}), [], 'todo visible snapshot must not include host models');
    assert.deepEqual(Object.keys(visible.snapshot.tables || {}), [todoEntry.table_id], 'todo visible snapshot must include only target app table');
    assert.deepEqual(Object.keys(visible.snapshot.tables[todoEntry.table_id].models || {}), ['0'], 'todo visible snapshot must include only root model0');
    assert.ok(labelsAt(visible.snapshot.tables[todoEntry.table_id].models['0']).tasks_json, 'todo visible snapshot must include current view data labels');
    return { key: 'visible_snapshot_for_todo_returns_target_app_table_only', status: 'PASS' };
  });
}

function test_cross_principal_visible_snapshot_rejects_other_todo_table() {
  return withServerState((state) => {
    const model0 = state.runtime.getModel(0);
    state.runtime.principalRuntimeKey = 'subject:drop-test';
    state.runtime.addLabel(model0, 0, 0, 0, { k: 'principal_runtime_key', t: 'str', v: 'subject:drop-test' });
    state.ensureSeededSlidInAppSubtables();
    const [dropEntry] = todoEntriesForPrincipal(state.runtime, 'drop-test');
    assert.ok(dropEntry && dropEntry.table_id !== 'host', 'drop_test_todo_app_table_required_for_cross_principal_test');

    state.runtime.principalRuntimeKey = 'subject:local-dev';
    state.runtime.addLabel(model0, 0, 0, 0, { k: 'principal_runtime_key', t: 'str', v: 'subject:local-dev' });
    const denied = buildScopedVisibleClientSnapshotForRuntime(
      { state, principal: principal('local-dev') },
      { profile: 'visible', visibleModelRefs: [{ table_id: dropEntry.table_id, model_id: 0 }] },
    );
    assert.equal(denied.ok, false, 'visible snapshot must reject another principal todo app table');
    assert.equal(denied.status, 403, 'cross-principal todo app visible snapshot must fail closed');
    assert.equal(denied.error, 'model_not_visible', 'cross-principal visible snapshot must report model_not_visible');
    return { key: 'cross_principal_visible_snapshot_rejects_other_todo_table', status: 'PASS' };
  });
}

function test_developer_guide_documents_subtable_authoring_and_visible_scope() {
  const guide = readFileSync('docs/user-guide/slide-app-runtime/slide_app_runtime_developer_guide.md', 'utf8');
  for (const phrase of [
    '子表化滑动 APP 的 authoring checklist',
    '安装器 materialize 后会在 App table root 写 `t="model.subtable"`',
    'host Model 0 的 index cell 写 `model.subtableconnection`',
    '把它改成安装器可 remap 的占位 key',
    'bus_event_submit_0_0_0_0',
    'visibleModelRefs=[{ table_id, model_id }]',
    '只返回当前 principal 可见的目标 App table/model body',
    'A 和 B 看到的 `table_id` 不同',
  ]) {
    assert.ok(guide.includes(phrase), `developer_guide_must_document:${phrase}`);
  }
  return { key: 'developer_guide_documents_subtable_authoring_and_visible_scope', status: 'PASS' };
}

const tests = [
  test_todo_board_is_registered_only_as_principal_app_table,
  test_seeded_todo_board_is_principal_scoped,
  test_existing_seeded_todo_board_repairs_missing_source_metadata,
  test_visible_snapshot_for_todo_returns_target_app_table_only,
  test_cross_principal_visible_snapshot_rejects_other_todo_table,
  test_developer_guide_documents_subtable_authoring_and_visible_scope,
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
