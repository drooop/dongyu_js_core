#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildAstFromCellwiseModel } from '../../packages/ui-model-demo-frontend/src/ui_cellwise_projection.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const workspacePatch = JSON.parse(fs.readFileSync(path.join(repoRoot, 'packages/worker-base/system-models/workspace_positive_models.json'), 'utf8'));
const records = Array.isArray(workspacePatch?.records) ? workspacePatch.records : [];

function findRecord(predicate) {
  return records.find((record) => predicate(record)) || null;
}

function hasRecord(predicate) {
  return records.some((record) => predicate(record));
}

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

function test_0270_target_nodes_no_longer_use_ui_props_json_for_basic_layout_and_copy() {
  for (const key of [
    { model_id: 1009, r: 1, c: 0 },
    { model_id: 1009, r: 2, c: 0 },
    { model_id: 1009, r: 3, c: 0 },
    { model_id: 1009, r: 4, c: 0 },
  ]) {
    assert.equal(
      hasRecord((record) => record?.model_id === key.model_id && record?.p === 2 && record?.r === key.r && record?.c === key.c && record?.k === 'ui_props_json'),
      false,
      `0270_target_cell_${key.r}_${key.c}_must_not_use_ui_props_json`,
    );
  }
  return { key: '0270_target_nodes_no_longer_use_ui_props_json_for_basic_layout_and_copy', status: 'PASS' };
}

function test_0276_target_nodes_no_longer_use_ui_props_json_for_doc_content() {
  for (const row of [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 19, 20, 21]) {
    assert.equal(
      hasRecord((record) => record?.model_id === 1013 && record?.p === 2 && record?.r === row && record?.c === 0 && record?.k === 'ui_props_json'),
      false,
      `0276_row_${row}_must_not_use_ui_props_json`,
    );
  }
  return { key: '0276_target_nodes_no_longer_use_ui_props_json_for_doc_content', status: 'PASS' };
}

function test_static_target_nodes_no_longer_use_ui_props_json_for_basic_surface() {
  for (const row of [6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]) {
    assert.equal(
      hasRecord((record) => record?.model_id === 1011 && record?.p === 2 && record?.r === row && record?.c === 0 && record?.k === 'ui_props_json'),
      false,
      `static_row_${row}_must_not_use_ui_props_json`,
    );
  }
  return { key: 'static_target_nodes_no_longer_use_ui_props_json_for_basic_surface', status: 'PASS' };
}

function test_compiler_supports_new_direct_and_ref_style_fields() {
  const snapshot = makeSnapshot(9300, {
    '0,0,0': {
      ui_authoring_version: { t: 'str', v: 'cellwise.ui.v1' },
      ui_root_node_id: { t: 'str', v: 'root' },
    },
    '1,0,0': {
      ui_node_id: { t: 'str', v: 'root' },
      ui_component: { t: 'str', v: 'Container' },
      ui_layout: { t: 'str', v: 'row' },
      ui_gap: { t: 'int', v: 10 },
      ui_style_width: { t: 'str', v: '100%' },
      ui_style_align_items: { t: 'str', v: 'center' },
      ui_style_flex_direction_ref_model_id: { t: 'int', v: 9301 },
      ui_style_flex_direction_ref_p: { t: 'int', v: 0 },
      ui_style_flex_direction_ref_r: { t: 'int', v: 0 },
      ui_style_flex_direction_ref_c: { t: 'int', v: 0 },
      ui_style_flex_direction_ref_k: { t: 'str', v: 'layout_direction' },
    },
    '2,0,0': {
      ui_node_id: { t: 'str', v: 'cta' },
      ui_component: { t: 'str', v: 'Button' },
      ui_parent: { t: 'str', v: 'root' },
      ui_order: { t: 'int', v: 10 },
      ui_label: { t: 'str', v: 'Confirm' },
      ui_variant_ref_model_id: { t: 'int', v: 9301 },
      ui_variant_ref_p: { t: 'int', v: 0 },
      ui_variant_ref_r: { t: 'int', v: 0 },
      ui_variant_ref_c: { t: 'int', v: 0 },
      ui_variant_ref_k: { t: 'str', v: 'button_variant' },
      ui_style_background_color_ref_model_id: { t: 'int', v: 9301 },
      ui_style_background_color_ref_p: { t: 'int', v: 0 },
      ui_style_background_color_ref_r: { t: 'int', v: 0 },
      ui_style_background_color_ref_c: { t: 'int', v: 0 },
      ui_style_background_color_ref_k: { t: 'str', v: 'button_color' },
    },
    '3,0,0': {
      ui_node_id: { t: 'str', v: 'section' },
      ui_component: { t: 'str', v: 'Section' },
      ui_parent: { t: 'str', v: 'root' },
      ui_order: { t: 'int', v: 20 },
      ui_title_ref_model_id: { t: 'int', v: 9301 },
      ui_title_ref_p: { t: 'int', v: 0 },
      ui_title_ref_r: { t: 'int', v: 0 },
      ui_title_ref_c: { t: 'int', v: 0 },
      ui_title_ref_k: { t: 'str', v: 'section_title' },
      ui_section_number_ref_model_id: { t: 'int', v: 9301 },
      ui_section_number_ref_p: { t: 'int', v: 0 },
      ui_section_number_ref_r: { t: 'int', v: 0 },
      ui_section_number_ref_c: { t: 'int', v: 0 },
      ui_section_number_ref_k: { t: 'str', v: 'section_num' },
      ui_style_min_width: { t: 'str', v: '280px' },
    },
    '4,0,0': {
      ui_node_id: { t: 'str', v: 'upload' },
      ui_component: { t: 'str', v: 'FileInput' },
      ui_parent: { t: 'str', v: 'root' },
      ui_order: { t: 'int', v: 30 },
      ui_accept: { t: 'str', v: '.html,.zip' },
      ui_button_label: { t: 'str', v: '选择文件' },
      ui_empty_text: { t: 'str', v: '未选择任何文件' },
      ui_selected_text_ref_model_id: { t: 'int', v: 9301 },
      ui_selected_text_ref_p: { t: 'int', v: 0 },
      ui_selected_text_ref_r: { t: 'int', v: 0 },
      ui_selected_text_ref_c: { t: 'int', v: 0 },
      ui_selected_text_ref_k: { t: 'str', v: 'file_name' },
      ui_name_target_model_id: { t: 'int', v: 9301 },
      ui_name_target_p: { t: 'int', v: 0 },
      ui_name_target_r: { t: 'int', v: 0 },
      ui_name_target_c: { t: 'int', v: 0 },
      ui_name_target_k: { t: 'str', v: 'file_name' },
    },
    '5,0,0': {
      ui_node_id: { t: 'str', v: 'delete_btn' },
      ui_component: { t: 'str', v: 'Button' },
      ui_parent: { t: 'str', v: 'root' },
      ui_order: { t: 'int', v: 40 },
      ui_label: { t: 'str', v: 'Delete' },
      ui_write_action: { t: 'str', v: 'static_project_delete' },
      ui_write_target_model_id: { t: 'int', v: 9301 },
      ui_write_target_p: { t: 'int', v: 0 },
      ui_write_target_r: { t: 'int', v: 0 },
      ui_write_target_c: { t: 'int', v: 0 },
      ui_write_target_k: { t: 'str', v: 'project_name' },
      ui_write_value_t: { t: 'str', v: 'str' },
      ui_write_value_ref: { t: 'str', v: 'row.name' },
    },
  });
  snapshot.models['9301'] = {
    id: 9301,
    name: 'ref-model',
    cells: {
      '0,0,0': {
        labels: {
          layout_direction: { k: 'layout_direction', t: 'str', v: 'row-reverse' },
          button_variant: { k: 'button_variant', t: 'str', v: 'primary' },
          button_color: { k: 'button_color', t: 'str', v: '#ff0000' },
          section_title: { k: 'section_title', t: 'str', v: 'Section Title' },
          section_num: { k: 'section_num', t: 'int', v: 7 },
          file_name: { k: 'file_name', t: 'str', v: 'demo.html' },
        },
      },
    },
  };
  const ast = buildAstFromCellwiseModel(snapshot, 9300);
  assert.equal(ast.props.style.width, '100%', 'ui_style_width_must_compile');
  assert.deepEqual(ast.props.style.flexDirection, { $label: { model_id: 9301, p: 0, r: 0, c: 0, k: 'layout_direction' } }, 'ui_style_flex_direction_ref_must_compile');
  assert.deepEqual(ast.children[0].props.type, { $label: { model_id: 9301, p: 0, r: 0, c: 0, k: 'button_variant' } }, 'ui_variant_ref_must_compile');
  assert.deepEqual(ast.children[0].props.style.backgroundColor, { $label: { model_id: 9301, p: 0, r: 0, c: 0, k: 'button_color' } }, 'ui_style_background_color_ref_must_compile');
  assert.deepEqual(ast.children[1].props.title, { $label: { model_id: 9301, p: 0, r: 0, c: 0, k: 'section_title' } }, 'ui_title_ref_must_compile');
  assert.deepEqual(ast.children[1].props.sectionNumber, { $label: { model_id: 9301, p: 0, r: 0, c: 0, k: 'section_num' } }, 'ui_section_number_ref_must_compile');
  assert.equal(ast.children[2].props.buttonLabel, '选择文件', 'ui_button_label_must_compile');
  assert.deepEqual(ast.children[2].props.nameTargetRef, { model_id: 9301, p: 0, r: 0, c: 0, k: 'file_name' }, 'ui_name_target_must_compile');
  assert.deepEqual(ast.children[3].bind.write.value_ref, { t: 'str', v: { $ref: 'row.name' } }, 'ui_write_value_ref_must_compile');
  return { key: 'compiler_supports_new_direct_and_ref_style_fields', status: 'PASS' };
}

const tests = [
  test_0270_target_nodes_no_longer_use_ui_props_json_for_basic_layout_and_copy,
  test_0276_target_nodes_no_longer_use_ui_props_json_for_doc_content,
  test_static_target_nodes_no_longer_use_ui_props_json_for_basic_surface,
  test_compiler_supports_new_direct_and_ref_style_fields,
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
