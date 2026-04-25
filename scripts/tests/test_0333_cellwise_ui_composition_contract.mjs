#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildAstFromCellwiseModel } from '../../packages/ui-model-demo-frontend/src/ui_cellwise_projection.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function label(t, v) {
  return { t, v };
}

function makeSnapshot(modelId, labelsByCell) {
  const cells = {};
  for (const [cellKey, labels] of Object.entries(labelsByCell)) {
    const out = {};
    for (const [k, value] of Object.entries(labels)) out[k] = { k, ...value };
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

function read(file) {
  return fs.readFileSync(path.join(repoRoot, file), 'utf8');
}

function findNodeById(node, id) {
  if (!node) return null;
  if (node.id === id) return node;
  for (const child of Array.isArray(node.children) ? node.children : []) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

function baseCompositionCells({ firstRowLayout = 'row', includeExtraRow = false } = {}) {
  return {
    '0,0,0': {
      ui_authoring_version: label('str', 'cellwise.ui.v1'),
      ui_root_node_id: label('str', 'root'),
    },
    '1,0,0': {
      ui_node_id: label('str', 'root'),
      ui_component: label('str', 'Container'),
      ui_layout: label('str', 'column'),
      ui_gap: label('int', 12),
    },
    '2,0,0': {
      ui_node_id: label('str', 'button_row'),
      ui_component: label('str', 'Container'),
      ui_parent: label('str', 'root'),
      ui_order: label('int', 10),
      ui_layout: label('str', firstRowLayout),
      ui_gap: label('int', 8),
    },
    '2,0,1': {
      ui_node_id: label('str', 'button_a'),
      ui_component: label('str', 'Button'),
      ui_parent: label('str', 'button_row'),
      ui_order: label('int', 10),
      ui_label: label('str', 'A'),
    },
    '2,0,2': {
      ui_node_id: label('str', 'button_b'),
      ui_component: label('str', 'Button'),
      ui_parent: label('str', 'button_row'),
      ui_order: label('int', 20),
      ui_label: label('str', 'B'),
    },
    '2,0,3': {
      ui_node_id: label('str', 'button_c'),
      ui_component: label('str', 'Button'),
      ui_parent: label('str', 'button_row'),
      ui_order: label('int', 30),
      ui_label: label('str', 'C'),
    },
    '3,0,0': {
      ui_node_id: label('str', 'form_row'),
      ui_component: label('str', 'Container'),
      ui_parent: label('str', 'root'),
      ui_order: label('int', 20),
      ui_layout: label('str', 'row'),
      ui_gap: label('int', 10),
    },
    '3,0,1': {
      ui_node_id: label('str', 'input_column'),
      ui_component: label('str', 'Container'),
      ui_parent: label('str', 'form_row'),
      ui_slot: label('str', 'main'),
      ui_order: label('int', 10),
      ui_layout: label('str', 'column'),
      ui_gap: label('int', 6),
    },
    '3,1,1': {
      ui_node_id: label('str', 'name_input'),
      ui_component: label('str', 'Input'),
      ui_parent: label('str', 'input_column'),
      ui_order: label('int', 10),
      ui_label: label('str', '姓名'),
      ui_placeholder: label('str', '请输入姓名'),
    },
    '3,2,1': {
      ui_node_id: label('str', 'reason_input'),
      ui_component: label('str', 'Input'),
      ui_parent: label('str', 'input_column'),
      ui_order: label('int', 20),
      ui_label: label('str', '理由'),
      ui_placeholder: label('str', '请输入理由'),
    },
    ...(includeExtraRow ? {
      '4,0,0': {
        ui_node_id: label('str', 'extra_row'),
        ui_component: label('str', 'Container'),
        ui_parent: label('str', 'root'),
        ui_order: label('int', 30),
        ui_layout: label('str', 'row'),
      },
      '4,0,1': {
        ui_node_id: label('str', 'extra_text'),
        ui_component: label('str', 'Text'),
        ui_parent: label('str', 'extra_row'),
        ui_order: label('int', 10),
        ui_text: label('str', '新增行'),
      },
    } : {}),
  };
}

function test_docs_freeze_cellwise_composition_rules() {
  const guide = read('docs/user-guide/modeltable_user_guide.md');
  const components = read('docs/user-guide/ui_components_v2.md');
  assert.match(guide, /UI Cellwise Composition Rules \(0333\)/u, 'modeltable guide must define 0333 composition rules');
  assert.match(guide, /ui_parent[\s\S]*visual containment/u, 'guide must state ui_parent is visual containment');
  assert.match(guide, /ui_order[\s\S]*sibling order/u, 'guide must state ui_order controls sibling order');
  assert.match(guide, /ui_layout[\s\S]*container child layout/u, 'guide must state ui_layout belongs to container child layout');
  assert.match(guide, /ui_slot[\s\S]*named region/u, 'guide must state ui_slot is a named region');
  assert.match(guide, /model\.submt[\s\S]*independent child model/u, 'guide must reserve model.submt for independent child models');
  assert.match(components, /cellwise\.ui\.v1 containment/u, 'component guide must include a cellwise containment section');
  assert.match(components, /one row with three buttons/u, 'component guide must document the three-button row example');
  assert.match(components, /nested input column/u, 'component guide must document nested input column example');
  return { key: 'docs_freeze_cellwise_composition_rules', status: 'PASS' };
}

function test_cellwise_projection_supports_nested_rows_columns_and_slots() {
  const snapshot = makeSnapshot(9333, baseCompositionCells());
  const ast = buildAstFromCellwiseModel(snapshot, 9333);
  assert.equal(ast?.props?.layout, 'column', 'root layout must come from root container label');
  assert.deepEqual(
    ast.children.map((child) => child.id),
    ['button_row', 'form_row'],
    'root children must follow ui_order',
  );
  const buttonRow = findNodeById(ast, 'button_row');
  assert.equal(buttonRow?.props?.layout, 'row', 'first row layout must come from ui_layout');
  assert.deepEqual(
    buttonRow.children.map((child) => child.id),
    ['button_a', 'button_b', 'button_c'],
    'first row must contain three ordered buttons',
  );
  const inputColumn = findNodeById(ast, 'input_column');
  assert.equal(inputColumn?.props?.layout, 'column', 'nested input column layout must come from ui_layout');
  assert.equal(inputColumn?.props?.slot, 'main', 'ui_slot must be preserved as the named region prop');
  assert.deepEqual(
    inputColumn.children.map((child) => child.id),
    ['name_input', 'reason_input'],
    'nested input column must contain two ordered inputs',
  );
  return { key: 'cellwise_projection_supports_nested_rows_columns_and_slots', status: 'PASS' };
}

function test_layout_label_change_changes_projected_ast() {
  const rowAst = buildAstFromCellwiseModel(makeSnapshot(9334, baseCompositionCells({ firstRowLayout: 'row' })), 9334);
  const columnAst = buildAstFromCellwiseModel(makeSnapshot(9334, baseCompositionCells({ firstRowLayout: 'column' })), 9334);
  assert.equal(findNodeById(rowAst, 'button_row')?.props?.layout, 'row', 'row snapshot must project row layout');
  assert.equal(findNodeById(columnAst, 'button_row')?.props?.layout, 'column', 'changed ui_layout label must change projected layout');
  return { key: 'layout_label_change_changes_projected_ast', status: 'PASS' };
}

function test_adding_node_cell_adds_projected_row() {
  const baseAst = buildAstFromCellwiseModel(makeSnapshot(9335, baseCompositionCells()), 9335);
  const addedAst = buildAstFromCellwiseModel(makeSnapshot(9335, baseCompositionCells({ includeExtraRow: true })), 9335);
  assert.equal(findNodeById(baseAst, 'extra_row'), null, 'base snapshot must not include extra row');
  assert.equal(findNodeById(addedAst, 'extra_row')?.type, 'Container', 'new UI node cell must add projected row');
  assert.equal(findNodeById(addedAst, 'extra_text')?.props?.text, '新增行', 'new child node cell must project inside added row');
  return { key: 'adding_node_cell_adds_projected_row', status: 'PASS' };
}

const tests = [
  test_docs_freeze_cellwise_composition_rules,
  test_cellwise_projection_supports_nested_rows_columns_and_slots,
  test_layout_label_change_changes_projected_ast,
  test_adding_node_cell_adds_projected_row,
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
