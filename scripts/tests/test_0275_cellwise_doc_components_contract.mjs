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

function test_cellwise_doc_components_compile_new_label_k_fields() {
  const snapshot = makeSnapshot(1015, {
    '0,0,0': {
      ui_authoring_version: { t: 'str', v: 'cellwise.ui.v1' },
      ui_root_node_id: { t: 'str', v: 'doc_root' },
    },
    '1,0,0': {
      ui_node_id: { t: 'str', v: 'doc_root' },
      ui_component: { t: 'str', v: 'Section' },
      ui_title: { t: 'str', v: '文档章节' },
      ui_section_number: { t: 'int', v: 1 },
      ui_variant: { t: 'str', v: 'hero' },
    },
    '2,0,0': {
      ui_node_id: { t: 'str', v: 'heading_1' },
      ui_component: { t: 'str', v: 'Heading' },
      ui_parent: { t: 'str', v: 'doc_root' },
      ui_order: { t: 'int', v: 10 },
      ui_text: { t: 'str', v: '标题' },
      ui_heading_level: { t: 'int', v: 2 },
    },
    '3,0,0': {
      ui_node_id: { t: 'str', v: 'para_1' },
      ui_component: { t: 'str', v: 'Paragraph' },
      ui_parent: { t: 'str', v: 'doc_root' },
      ui_order: { t: 'int', v: 20 },
      ui_text: { t: 'str', v: '第一段\n第二行' },
    },
    '4,0,0': {
      ui_node_id: { t: 'str', v: 'callout_1' },
      ui_component: { t: 'str', v: 'Callout' },
      ui_parent: { t: 'str', v: 'doc_root' },
      ui_order: { t: 'int', v: 30 },
      ui_title: { t: 'str', v: '提示' },
      ui_text: { t: 'str', v: '请阅读说明' },
      ui_callout_type: { t: 'str', v: 'tip' },
    },
    '5,0,0': {
      ui_node_id: { t: 'str', v: 'list_1' },
      ui_component: { t: 'str', v: 'List' },
      ui_parent: { t: 'str', v: 'doc_root' },
      ui_order: { t: 'int', v: 40 },
      ui_list_type: { t: 'str', v: 'ordered' },
    },
    '6,0,0': {
      ui_node_id: { t: 'str', v: 'item_1' },
      ui_component: { t: 'str', v: 'ListItem' },
      ui_parent: { t: 'str', v: 'list_1' },
      ui_order: { t: 'int', v: 10 },
      ui_text: { t: 'str', v: '步骤一' },
    },
    '7,0,0': {
      ui_node_id: { t: 'str', v: 'image_1' },
      ui_component: { t: 'str', v: 'Image' },
      ui_parent: { t: 'str', v: 'doc_root' },
      ui_order: { t: 'int', v: 50 },
      ui_image_src: { t: 'str', v: '/demo.png' },
      ui_image_alt: { t: 'str', v: 'demo image' },
    },
    '8,0,0': {
      ui_node_id: { t: 'str', v: 'mermaid_1' },
      ui_component: { t: 'str', v: 'MermaidDiagram' },
      ui_parent: { t: 'str', v: 'doc_root' },
      ui_order: { t: 'int', v: 60 },
      ui_mermaid_code: { t: 'str', v: 'graph TD;A-->B;' },
    },
  });

  const ast = buildAstFromCellwiseModel(snapshot, 1015);
  assert(ast, 'doc_ast_missing');
  assert.equal(ast.type, 'Section', 'root_must_compile_as_section');
  assert.equal(ast.props.title, '文档章节', 'section_title_must_compile');
  assert.equal(ast.props.sectionNumber, 1, 'ui_section_number_must_compile');
  assert.equal(ast.props.type, 'hero', 'ui_variant_must_still_flow_into_type');
  assert.equal(ast.children[0].type, 'Heading', 'heading_must_compile');
  assert.equal(ast.children[0].props.level, 2, 'ui_heading_level_must_compile');
  assert.equal(ast.children[2].props.calloutType, 'tip', 'ui_callout_type_must_compile');
  assert.equal(ast.children[3].props.listType, 'ordered', 'ui_list_type_must_compile');
  assert.equal(ast.children[4].props.src, '/demo.png', 'ui_image_src_must_compile');
  assert.equal(ast.children[4].props.alt, 'demo image', 'ui_image_alt_must_compile');
  assert.equal(ast.children[5].props.code, 'graph TD;A-->B;', 'ui_mermaid_code_must_compile');
  return { key: 'cellwise_doc_components_compile_new_label_k_fields', status: 'PASS' };
}

const tests = [test_cellwise_doc_components_compile_new_label_k_fields];
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
