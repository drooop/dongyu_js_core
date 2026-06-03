#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs, { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadSystemPatch } from '../worker_engine_v0.mjs';
import { buildAstFromCellwiseModel } from '../../packages/ui-model-demo-frontend/src/ui_cellwise_projection.js';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

const MODEL_ID = 1086;
const BUS_KEY = 'todo_1086_bus_event';
const REQ_PIN = 'todo_request';
const workspacePath = 'packages/worker-base/system-models/workspace_positive_models.json';
const hierarchyPath = 'packages/worker-base/system-models/runtime_hierarchy_mounts.json';
const modelIdsPath = 'packages/ui-model-demo-frontend/src/model_ids.js';

function readJson(pathname) {
  return JSON.parse(fs.readFileSync(pathname, 'utf8'));
}

function recordsOf(pathname) {
  return readJson(pathname).records || [];
}

function loadRuntime() {
  const rt = new ModelTableRuntime();
  loadSystemPatch(rt);
  for (const pathname of [workspacePath, hierarchyPath]) {
    const result = rt.applyPatch(readJson(pathname), { allowCreateModel: true, trustedBootstrap: true });
    assert.equal(result.rejected, 0, `${pathname} must load without rejected records`);
  }
  return rt;
}

function rootLabel(rt, key) {
  const model = rt.getModel(MODEL_ID);
  assert.ok(model, `missing model ${MODEL_ID}`);
  return rt.getCell(model, 0, 0, 0).labels.get(key)?.v;
}

function payload(action, extra = []) {
  return [
    { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'ui_event.v1' },
    { id: 0, p: 0, r: 0, c: 0, k: 'todo_action', t: 'str', v: action },
    ...extra,
  ];
}

async function dispatch(state, action, extra = []) {
  const result = await state.submitEnvelope({
    type: 'bus_event_v2',
    bus_in_key: BUS_KEY,
    value: payload(action, extra),
    meta: { op_id: `it0405_${action}_${Date.now()}` },
  });
  assert.equal(result.result, 'ok', `${action} must route through Model 0 bus_event_v2`);
  assert.equal(result.routed_by, 'model0_busin', `${action} must enter through Model 0 mounted ingress`);
  await new Promise((resolve) => setTimeout(resolve, 160));
  return result;
}

function findNode(node, id) {
  if (!node || typeof node !== 'object') return null;
  if (node.id === id) return node;
  for (const child of node.children || []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function walkNodes(node, out = []) {
  if (!node) return out;
  out.push(node);
  for (const child of node.children || []) walkNodes(child, out);
  return out;
}

function test_workspace_entry_mount_and_route_contract() {
  const workspace = recordsOf(workspacePath);
  const hierarchy = recordsOf(hierarchyPath);
  const modelIds = fs.readFileSync(modelIdsPath, 'utf8');

  assert.ok(modelIds.includes('TODO_BOARD_APP_MODEL_ID = 1086'), 'frontend model ids must reserve To Do Board 1086');
  assert.ok(/WORKSPACE_ENTRY_MODEL_IDS[\s\S]*1086/u.test(modelIds), 'Workspace allowlist must include To Do Board');
  assert.ok(/BUILTIN_WORKSPACE_APP_MODEL_IDS[\s\S]*1086/u.test(modelIds), 'built-in app allowlist must include To Do Board');

  const registry = workspace.find((record) => record.model_id === -2 && record.k === 'ws_apps_registry')?.v;
  assert.ok(Array.isArray(registry) && registry.some((entry) => entry.model_id === MODEL_ID && entry.name === 'To Do Board'), 'Workspace registry must expose To Do Board');

  const mount = hierarchy.find((record) => record.model_id === 0 && record.p === 9 && record.r === 0 && record.c === MODEL_ID && record.k === 'model_type');
  assert.equal(mount?.t, 'model.submt', 'To Do Board must be mounted through a Model 0 hosting cell');
  assert.equal(mount?.v, MODEL_ID, 'hosting cell must mount model 1086');

  const mountPin = workspace.find((record) => record.model_id === 0 && record.p === 9 && record.r === 0 && record.c === MODEL_ID && record.k === REQ_PIN);
  assert.equal(mountPin?.t, 'pin.in', 'Model 0 hosting cell must declare To Do ingress pin');

  const route = workspace.find((record) => record.model_id === 0 && record.k === 'todo_1086_ingress_route')?.v?.[0];
  assert.deepEqual(route?.from, [0, 0, 0, BUS_KEY], 'Model 0 route must start at the bus_event_v2 ingress key');
  assert.deepEqual(route?.to, [[9, 0, MODEL_ID, REQ_PIN]], 'Model 0 route must target the hosting cell before the app root');
  return { key: 'workspace_entry_mount_and_route_contract', status: 'PASS' };
}

function test_cellwise_ui_fragmentation_and_sync_policy() {
  const rt = loadRuntime();
  const ast = buildAstFromCellwiseModel(rt.snapshot(), MODEL_ID);
  assert.ok(ast, 'To Do Board must build a cellwise UI AST');
  const nodes = walkNodes(ast);
  assert.ok(nodes.length >= 24, `To Do Board must be fragmented enough, got ${nodes.length} nodes`);

  for (const id of [
    'todo_root',
    'todo_header',
    'todo_create_button',
    'todo_tabs',
    'todo_board',
    'todo_focus_filter',
    'todo_focus_list',
    'todo_create_dialog',
    'todo_create_title',
    'todo_create_body',
    'todo_create_status',
    'todo_create_save',
    'todo_edit_dialog',
    'todo_edit_title',
    'todo_edit_body',
    'todo_edit_status',
    'todo_edit_save',
  ]) {
    assert.ok(findNode(ast, id), `missing required UI node ${id}`);
  }

  assert.equal(findNode(ast, 'todo_board')?.type, 'TodoBoard', 'board view must use TodoBoard');
  assert.equal(findNode(ast, 'todo_focus_list')?.type, 'TodoFocusList', 'focus view must use TodoFocusList');
  assert.equal(findNode(ast, 'todo_create_title')?.bind?.write?.commit_policy, 'on_submit', 'create title input must avoid per-keystroke persistence');
  assert.equal(findNode(ast, 'todo_create_body')?.bind?.write?.commit_policy, 'on_submit', 'create body input must avoid per-keystroke persistence');
  assert.equal(findNode(ast, 'todo_edit_title')?.bind?.write?.commit_policy, 'on_submit', 'edit title input must avoid per-keystroke persistence');
  assert.equal(findNode(ast, 'todo_edit_body')?.bind?.write?.commit_policy, 'on_submit', 'edit body input must avoid per-keystroke persistence');
  for (const id of ['todo_create_button', 'todo_create_save', 'todo_edit_save', 'todo_board', 'todo_focus_list']) {
    assert.equal(findNode(ast, id)?.bind?.write?.bus_event_v2, true, `${id} must use bus_event_v2`);
    assert.equal(findNode(ast, id)?.bind?.write?.bus_in_key, BUS_KEY, `${id} must target To Do Model 0 ingress`);
  }

  const tasks = rootLabel(rt, 'tasks_json');
  assert.ok(Array.isArray(tasks) && tasks.length >= 4, 'tasks_json must seed representative tasks');
  assert.ok(tasks.some((task) => task.status === 'todo'), 'seed tasks must include todo');
  assert.ok(tasks.some((task) => task.status === 'doing'), 'seed tasks must include doing');
  assert.ok(tasks.some((task) => task.status === 'done'), 'seed tasks must include done');
  assert.ok(tasks.some((task) => task.status === 'archived'), 'seed tasks must include archived');
  return { key: 'cellwise_ui_fragmentation_and_sync_policy', status: 'PASS' };
}

async function test_program_actions_route_and_update_tasks_json() {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0405-todo-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0405_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  process.env.DY_UI_SERVER_WORKER_ID = 'U1';
  try {
    const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
    const state = createServerState({ dbPath: null });
    await state.activateRuntimeMode('running');
    const runtime = state.runtime;
    const model = runtime.getModel(MODEL_ID);
    assert.ok(model, 'runtime must load To Do Board model');

    runtime.addLabel(model, 0, 0, 0, { k: 'draft_title', t: 'str', v: 'Browser-safe task' });
    runtime.addLabel(model, 0, 0, 0, { k: 'draft_body', t: 'str', v: 'Typed draft must be visible before save.' });
    runtime.addLabel(model, 0, 0, 0, { k: 'draft_status', t: 'str', v: 'doing' });
    await dispatch(state, 'create_task');
    let tasks = rootLabel(runtime, 'tasks_json');
    const created = tasks.find((task) => task.title === 'Browser-safe task');
    assert.ok(created, 'create_task must append the submitted task');
    assert.equal(created.status, 'doing', 'create_task must honor submitted draft status');
    assert.equal(rootLabel(runtime, 'create_dialog_open'), false, 'create_task must close create dialog');

    await dispatch(state, 'move_status', [
      { id: 0, p: 0, r: 0, c: 0, k: 'task_id', t: 'str', v: created.id },
      { id: 0, p: 0, r: 0, c: 0, k: 'status', t: 'str', v: 'done' },
    ]);
    tasks = rootLabel(runtime, 'tasks_json');
    assert.equal(tasks.find((task) => task.id === created.id)?.status, 'done', 'move_status must update task status');

    await dispatch(state, 'open_edit', [
      { id: 0, p: 0, r: 0, c: 0, k: 'task_id', t: 'str', v: created.id },
    ]);
    assert.equal(rootLabel(runtime, 'edit_dialog_open'), true, 'open_edit must open edit dialog');
    assert.equal(rootLabel(runtime, 'selected_task_id'), created.id, 'open_edit must select task id');

    runtime.addLabel(model, 0, 0, 0, { k: 'edit_title', t: 'str', v: 'Edited task title' });
    runtime.addLabel(model, 0, 0, 0, { k: 'edit_body', t: 'str', v: 'Edited task body' });
    runtime.addLabel(model, 0, 0, 0, { k: 'edit_status', t: 'str', v: 'todo' });
    await dispatch(state, 'save_edit');
    tasks = rootLabel(runtime, 'tasks_json');
    const edited = tasks.find((task) => task.id === created.id);
    assert.equal(edited.title, 'Edited task title', 'save_edit must update title');
    assert.equal(edited.body, 'Edited task body', 'save_edit must update body');
    assert.equal(edited.status, 'todo', 'save_edit must update status');
    assert.equal(rootLabel(runtime, 'edit_dialog_open'), false, 'save_edit must close edit dialog');

    await dispatch(state, 'filter_focus', [
      { id: 0, p: 0, r: 0, c: 0, k: 'filter_text', t: 'str', v: 'edited' },
    ]);
    assert.equal(rootLabel(runtime, 'filter_text'), 'edited', 'filter_focus must update focus filter label');
    assert.equal(rootLabel(runtime, 'last_action'), 'filter_focus', 'last_action must record final action');
    return { key: 'program_actions_route_and_update_tasks_json', status: 'PASS' };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

const tests = [
  test_workspace_entry_mount_and_route_contract,
  test_cellwise_ui_fragmentation_and_sync_policy,
  test_program_actions_route_and_update_tasks_json,
];

(async () => {
  let passed = 0;
  let failed = 0;
  for (const test of tests) {
    try {
      const result = await test();
      console.log(`[${result.status}] ${result.key}`);
      passed += 1;
    } catch (error) {
      console.log(`[FAIL] ${test.name}: ${error.stack || error.message}`);
      failed += 1;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
  process.exit(failed > 0 ? 1 : 0);
})();
