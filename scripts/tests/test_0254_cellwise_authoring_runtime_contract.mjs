#!/usr/bin/env node

import assert from 'node:assert/strict';
import { buildAstFromCellwiseModel } from '../../packages/ui-model-demo-frontend/src/ui_cellwise_projection.js';

function makeSnapshot(modelId, labelsByCell) {
  const cells = {};
  for (const [cellKey, labels] of Object.entries(labelsByCell)) {
    const out = {};
    for (const [k, { t, v }] of Object.entries(labels)) out[k] = { k, t, v };
    cells[cellKey] = { labels: out };
  }
  return {
    models: {
      [String(modelId)]: {
        id: modelId,
        name: `Model ${modelId}`,
        cells,
      },
    },
  };
}

function test_cellwise_model_compiles_basic_tree() {
  const snapshot = makeSnapshot(9100, {
    '0,0,0': {
      ui_authoring_version: { t: 'str', v: 'cellwise.ui.v1' },
      ui_root_node_id: { t: 'str', v: 'root' },
    },
    '1,0,0': {
      ui_node_id: { t: 'str', v: 'root' },
      ui_component: { t: 'str', v: 'Container' },
      ui_layout: { t: 'str', v: 'column' },
      ui_gap: { t: 'int', v: 12 },
    },
    '2,0,0': {
      ui_node_id: { t: 'str', v: 'title' },
      ui_component: { t: 'str', v: 'Text' },
      ui_parent: { t: 'str', v: 'root' },
      ui_order: { t: 'int', v: 10 },
      ui_text: { t: 'str', v: 'Cellwise Title' },
      ui_variant: { t: 'str', v: 'title' },
    },
    '3,0,0': {
      ui_node_id: { t: 'str', v: 'input' },
      ui_component: { t: 'str', v: 'Input' },
      ui_parent: { t: 'str', v: 'root' },
      ui_order: { t: 'int', v: 20 },
      ui_placeholder: { t: 'str', v: 'Type here' },
      ui_read_model_id: { t: 'int', v: -2 },
      ui_read_p: { t: 'int', v: 0 },
      ui_read_r: { t: 'int', v: 0 },
      ui_read_c: { t: 'int', v: 0 },
      ui_read_k: { t: 'str', v: 'draft_value' },
      ui_write_action: { t: 'str', v: 'label_update' },
      ui_write_target_model_id: { t: 'int', v: -2 },
      ui_write_target_p: { t: 'int', v: 0 },
      ui_write_target_r: { t: 'int', v: 0 },
      ui_write_target_c: { t: 'int', v: 0 },
      ui_write_target_k: { t: 'str', v: 'draft_value' },
    },
    '4,0,0': {
      ui_node_id: { t: 'str', v: 'save' },
      ui_component: { t: 'str', v: 'Button' },
      ui_parent: { t: 'str', v: 'root' },
      ui_order: { t: 'int', v: 30 },
      ui_text: { t: 'str', v: 'Save' },
      ui_write_action: { t: 'str', v: 'home_save_label' },
      ui_write_mode: { t: 'str', v: 'intent' },
    },
  });

  const ast = buildAstFromCellwiseModel(snapshot, 9100);
  assert(ast, 'cellwise_ast_missing');
  assert.equal(ast.type, 'Container', 'root_type_must_be_container');
  assert.equal(ast.props.layout, 'column', 'root_layout_must_compile');
  assert.equal(ast.props.gap, 12, 'root_gap_must_compile');
  assert.equal(ast.children.length, 3, 'root_children_count_must_match');
  assert.equal(ast.children[0].id, 'title', 'child_order_title_first');
  assert.equal(ast.children[1].id, 'input', 'child_order_input_second');
  assert.equal(ast.children[2].id, 'save', 'child_order_button_third');
  assert.equal(ast.children[0].props.text, 'Cellwise Title', 'text_prop_must_compile');
  assert.equal(ast.children[1].props.placeholder, 'Type here', 'placeholder_prop_must_compile');
  assert.deepEqual(
    ast.children[1].bind.read,
    { model_id: -2, p: 0, r: 0, c: 0, k: 'draft_value' },
    'read_bind_must_compile',
  );
  assert.deepEqual(
    ast.children[1].bind.write,
    {
      action: 'label_update',
      target_ref: { model_id: -2, p: 0, r: 0, c: 0, k: 'draft_value' },
    },
    'local_write_bind_must_compile',
  );
  assert.deepEqual(
    ast.children[2].bind.write,
    {
      action: 'home_save_label',
      mode: 'intent',
    },
    'intent_write_bind_must_compile',
  );
  return { key: 'cellwise_model_compiles_basic_tree', status: 'PASS' };
}

function test_non_cellwise_model_returns_null() {
  const snapshot = makeSnapshot(9101, {
    '0,0,0': {
      app_name: { t: 'str', v: 'legacy' },
    },
  });
  const ast = buildAstFromCellwiseModel(snapshot, 9101);
  assert.equal(ast, null, 'legacy_model_must_not_compile_as_cellwise');
  return { key: 'non_cellwise_model_returns_null', status: 'PASS' };
}

function test_cellwise_model_compiles_extended_props_and_bind_json() {
  const snapshot = makeSnapshot(9102, {
    '0,0,0': {
      ui_authoring_version: { t: 'str', v: 'cellwise.ui.v1' },
      ui_root_node_id: { t: 'str', v: 'root' },
    },
    '1,0,0': {
      ui_node_id: { t: 'str', v: 'root' },
      ui_component: { t: 'str', v: 'Container' },
      ui_layout: { t: 'str', v: 'column' },
      ui_gap: { t: 'int', v: 16 },
    },
    '2,0,0': {
      ui_node_id: { t: 'str', v: 'terminal' },
      ui_component: { t: 'str', v: 'Terminal' },
      ui_parent: { t: 'str', v: 'root' },
      ui_order: { t: 'int', v: 10 },
      ui_title: { t: 'str', v: 'Audit Log' },
      ui_props_json: { t: 'json', v: { maxHeight: '220px', style: { flex: 1 } } },
      ui_bind_read_json: { t: 'json', v: { model_id: 9102, p: 0, r: 0, c: 0, k: 'audit_log' } },
    },
    '3,0,0': {
      ui_node_id: { t: 'str', v: 'button' },
      ui_component: { t: 'str', v: 'Button' },
      ui_parent: { t: 'str', v: 'root' },
      ui_order: { t: 'int', v: 20 },
      ui_label: { t: 'str', v: 'Promote' },
      ui_props_json: { t: 'json', v: { type: 'primary' } },
      ui_bind_write_json: {
        t: 'json',
        v: {
          action: 'ui_examples_promote_child_stage',
          target_ref: { model_id: 9103, p: 0, r: 0, c: 0, k: 'review_stage' },
          value_ref: { t: 'str', v: 'approved' },
        },
      },
    },
  });

  const ast = buildAstFromCellwiseModel(snapshot, 9102);
  assert(ast, 'extended_cellwise_ast_missing');
  assert.equal(ast.children[0].props.title, 'Audit Log', 'explicit_title_prop_must_be_preserved');
  assert.equal(ast.children[0].props.maxHeight, '220px', 'props_json_max_height_must_compile');
  assert.deepEqual(ast.children[0].props.style, { flex: 1 }, 'props_json_style_must_compile');
  assert.deepEqual(
    ast.children[0].bind.read,
    { model_id: 9102, p: 0, r: 0, c: 0, k: 'audit_log' },
    'bind_read_json_must_compile',
  );
  assert.equal(ast.children[1].props.type, 'primary', 'props_json_button_type_must_compile');
  assert.deepEqual(
    ast.children[1].bind.write,
    {
      action: 'ui_examples_promote_child_stage',
      target_ref: { model_id: 9103, p: 0, r: 0, c: 0, k: 'review_stage' },
      value_ref: { t: 'str', v: 'approved' },
    },
    'bind_write_json_must_compile',
  );
  return { key: 'cellwise_model_compiles_extended_props_and_bind_json', status: 'PASS' };
}

function test_cellwise_model_compiles_full_bind_json() {
  const snapshot = makeSnapshot(9104, {
    '0,0,0': {
      ui_authoring_version: { t: 'str', v: 'cellwise.ui.v1' },
      ui_root_node_id: { t: 'str', v: 'root' },
    },
    '1,0,0': {
      ui_node_id: { t: 'str', v: 'root' },
      ui_component: { t: 'str', v: 'Container' },
      ui_layout: { t: 'str', v: 'column' },
    },
    '2,0,0': {
      ui_node_id: { t: 'str', v: 'pager' },
      ui_component: { t: 'str', v: 'Pagination' },
      ui_parent: { t: 'str', v: 'root' },
      ui_order: { t: 'int', v: 10 },
      ui_props_json: { t: 'json', v: { layout: 'prev, pager, next' } },
      ui_bind_json: {
        t: 'json',
        v: {
          models: {
            currentPage: {
              read: { model_id: -2, p: 0, r: 0, c: 0, k: 'page' },
              write: { action: 'label_update', target_ref: { model_id: -2, p: 0, r: 0, c: 0, k: 'page' } },
            },
          },
          change: { action: 'home_refresh' },
        },
      },
    },
  });
  const ast = buildAstFromCellwiseModel(snapshot, 9104);
  assert(ast, 'full_bind_json_ast_missing');
  assert.deepEqual(
    ast.children[0].bind,
    {
      models: {
        currentPage: {
          read: { model_id: -2, p: 0, r: 0, c: 0, k: 'page' },
          write: { action: 'label_update', target_ref: { model_id: -2, p: 0, r: 0, c: 0, k: 'page' } },
        },
      },
      change: { action: 'home_refresh' },
    },
    'full_bind_json_must_compile_without_loss',
  );
  return { key: 'cellwise_model_compiles_full_bind_json', status: 'PASS' };
}

const tests = [
  test_cellwise_model_compiles_basic_tree,
  test_non_cellwise_model_returns_null,
  test_cellwise_model_compiles_extended_props_and_bind_json,
  test_cellwise_model_compiles_full_bind_json,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    const result = test();
    console.log(`[PASS] ${result.key}`);
    passed += 1;
  } catch (error) {
    console.log(`[FAIL] ${test.name}: ${error.message}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
