#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const require = createRequire(import.meta.url);

function fakeH(type, props, children) {
  let normalized = children;
  if (children && typeof children === 'object' && typeof children.default === 'function') {
    normalized = children.default();
  }
  return { type, props: props || {}, children: normalized };
}

function fakeResolve(name) {
  return name;
}

function walk(node, visitor) {
  if (!node) return;
  visitor(node);
  const children = Array.isArray(node.children) ? node.children : [node.children];
  for (const child of children) {
    if (child && typeof child === 'object') walk(child, visitor);
  }
}

function flattenText(node) {
  if (node === null || node === undefined) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join('');
  if (typeof node === 'object') return flattenText(node.children);
  return '';
}

function findButtonByText(root, text) {
  let found = null;
  walk(root, (node) => {
    if (found) return;
    if (node.type === 'button' && flattenText(node).includes(text)) {
      found = node;
    }
  });
  return found;
}

function recordsToObject(records) {
  const out = {};
  for (const record of Array.isArray(records) ? records : []) {
    if (record && record.id === 0 && record.p === 0 && record.r === 0 && record.c === 0) {
      out[record.k] = record.v;
    }
  }
  return out;
}

function main() {
  const registryPath = path.join(repoRoot, 'packages/ui-renderer/src/component_registry_v1.json');
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  assert.ok(registry.components.TodoBoard, 'TodoBoard_must_be_registered');
  assert.ok(registry.components.TodoFocusList, 'TodoFocusList_must_be_registered');

  const { createRenderer } = require(path.join(repoRoot, 'packages/ui-renderer/src/index.js'));
  const calls = [];
  const snapshot = {
    models: {
      '1086': {
        cells: {
          '0,0,0': {
            labels: {
              tasks_json: {
                k: 'tasks_json',
                t: 'json',
                v: [
                  { id: 'task_1', title: 'Write guide validator', body: 'Use model labels to render the board.', status: 'todo', updated_at: '2026-06-03T01:00:00.000Z' },
                  { id: 'task_2', title: 'Ship local demo', body: 'Verify create, edit, move, and focus view.', status: 'doing', updated_at: '2026-06-03T02:00:00.000Z' },
                  { id: 'task_3', title: 'Archive old draft', body: 'This should not show in focus unfinished view.', status: 'archived', updated_at: '2026-06-03T03:00:00.000Z' },
                ],
              },
            },
          },
        },
      },
    },
  };
  const host = {
    getSnapshot: () => snapshot,
    dispatchAddLabel: (label) => calls.push(label),
    dispatchRmLabel: () => {},
  };
  const renderer = createRenderer({ host, vue: { h: fakeH, resolveComponent: fakeResolve } });
  const actionTarget = { bus_event_v2: true, bus_in_key: 'todo_event' };
  const tasksRef = { model_id: 1086, p: 0, r: 0, c: 0, k: 'tasks_json' };
  const columns = [
    { value: 'todo', label: '还未开始' },
    { value: 'doing', label: '正在进行' },
    { value: 'done', label: '已完成' },
    { value: 'archived', label: '已归档' },
  ];

  const board = renderer.renderVNode({
    id: 'todo_board',
    type: 'TodoBoard',
    props: { tasksRef, columns },
    bind: { write: actionTarget },
  });

  assert.equal(flattenText(board).includes('Write guide validator'), true, 'board_must_render_task_title');
  assert.equal(flattenText(board).includes('还未开始'), true, 'board_must_render_status_column_label');
  assert.equal(flattenText(board).includes('正在进行'), true, 'board_must_render_second_status_column_label');

  const editButton = findButtonByText(board, '编辑');
  assert.ok(editButton, 'task_card_must_have_edit_action');
  editButton.props.onClick();
  let dispatched = calls.at(-1);
  assert.equal(dispatched.p, 0, 'todo_component_must_dispatch_to_model0_mailbox');
  assert.equal(dispatched.c, 0, 'todo_component_must_dispatch_bus_in_event');
  assert.equal(dispatched.k, 'bus_in_event', 'todo_component_must_use_bus_event_v2_dispatch_label');
  assert.equal(dispatched.v.type, 'bus_event_v2', 'todo_component_must_emit_bus_event_v2');
  assert.equal(dispatched.v.bus_in_key, 'todo_event', 'todo_component_must_preserve_configured_bus_in_key');
  assert.equal(recordsToObject(dispatched.v.value).todo_action, 'open_edit', 'edit_must_emit_open_edit_action');
  assert.equal(recordsToObject(dispatched.v.value).task_id, 'task_1', 'edit_must_emit_task_id');

  const doneButton = findButtonByText(board, '完成');
  assert.ok(doneButton, 'task_card_must_have_move_done_action');
  doneButton.props.onClick();
  dispatched = calls.at(-1);
  assert.equal(recordsToObject(dispatched.v.value).todo_action, 'move_status', 'move_button_must_emit_move_status_action');
  assert.equal(recordsToObject(dispatched.v.value).status, 'done', 'move_button_must_emit_target_status');

  let dropTarget = null;
  walk(board, (node) => {
    if (!dropTarget && node.props && node.props['data-status'] === 'done') dropTarget = node;
  });
  assert.ok(dropTarget, 'todo_board_must_expose_drop_column_by_status');
  assert.equal(typeof dropTarget.props.onDrop, 'function', 'todo_board_column_must_support_drop');
  dropTarget.props.onDrop({
    preventDefault() {},
    dataTransfer: { getData: () => 'task_2' },
  });
  dispatched = calls.at(-1);
  assert.equal(recordsToObject(dispatched.v.value).todo_action, 'move_status', 'drop_must_emit_move_status_action');
  assert.equal(recordsToObject(dispatched.v.value).task_id, 'task_2', 'drop_must_emit_dragged_task_id');
  assert.equal(recordsToObject(dispatched.v.value).status, 'done', 'drop_must_emit_drop_column_status');

  calls.length = 0;
  const focusList = renderer.renderVNode({
    id: 'todo_focus_list',
    type: 'TodoFocusList',
    props: { tasksRef, filterText: 'ship' },
    bind: { write: actionTarget },
  });
  const focusText = flattenText(focusList);
  assert.equal(focusText.includes('Ship local demo'), true, 'focus_view_must_show_matching_unfinished_task');
  assert.equal(focusText.includes('Write guide validator'), false, 'focus_view_must_apply_filter_text');
  assert.equal(focusText.includes('Archive old draft'), false, 'focus_view_must_hide_archived_tasks');
  const focusEditButton = findButtonByText(focusList, '编辑');
  assert.ok(focusEditButton, 'focus_view_task_must_have_edit_action');
  focusEditButton.props.onClick();
  dispatched = calls.at(-1);
  assert.equal(recordsToObject(dispatched.v.value).todo_action, 'open_edit', 'focus_edit_must_emit_open_edit_action');
  assert.equal(recordsToObject(dispatched.v.value).task_id, 'task_2', 'focus_edit_must_emit_filtered_task_id');

  console.log('PASS test_0405_todo_components_contract');
}

try {
  main();
} catch (err) {
  console.error(`FAIL test_0405_todo_components_contract: ${err.message}`);
  process.exitCode = 1;
}
