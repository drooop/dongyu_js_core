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

const tests = [
  test_cellwise_model_compiles_basic_tree,
  test_non_cellwise_model_returns_null,
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
