#!/usr/bin/env node

import assert from 'node:assert/strict';

import { convertPageAssetAstToCellwiseRecords } from '../lib/page_asset_to_cellwise.mjs';

function findRecord(records, predicate) {
  return records.find((record) => predicate(record)) || null;
}

function test_convert_page_asset_root_and_children_to_cellwise_records() {
  const ast = {
    id: 'root_prompt_filltable',
    type: 'Root',
    children: [
      {
        id: 'layout_prompt',
        type: 'Container',
        props: { layout: 'column', gap: 12 },
        children: [
          {
            id: 'txt_prompt_desc',
            type: 'Text',
            props: { type: 'info', text: 'Prompt description' },
          },
          {
            id: 'btn_prompt_preview',
            type: 'Button',
            props: { label: 'Preview', type: 'primary' },
            bind: {
              write: {
                action: 'llm_filltable_preview',
                target_ref: { model_id: -2, p: 0, r: 0, c: 0, k: 'llm_prompt_text' },
                meta_ref: { local_only: true },
              },
            },
          },
        ],
      },
    ],
  };

  const records = convertPageAssetAstToCellwiseRecords({ modelId: -21, ast, plane: 2 });

  assert.equal(
    findRecord(records, (record) => record?.k === 'ui_authoring_version')?.v,
    'cellwise.ui.v1',
    'must_declare_cellwise_authoring_version',
  );
  assert.equal(
    findRecord(records, (record) => record?.k === 'ui_root_node_id')?.v,
    'root_prompt_filltable',
    'must_set_root_node_id_to_original_ast_root',
  );
  assert.equal(
    findRecord(records, (record) => record?.k === 'ui_node_id' && record?.v === 'root_prompt_filltable')?.model_id,
    -21,
    'must_emit_root_node_identity_record',
  );
  assert.deepEqual(
    findRecord(records, (record) => record?.k === 'ui_props_json' && record?.model_id === -21 && record?.r === 1)?.v,
    { layout: 'column', gap: 12 },
    'must_preserve_props_json_for_container',
  );
  assert.deepEqual(
    findRecord(records, (record) => record?.k === 'ui_bind_json' && record?.model_id === -21 && record?.r === 3)?.v,
    {
      write: {
        action: 'llm_filltable_preview',
        target_ref: { model_id: -2, p: 0, r: 0, c: 0, k: 'llm_prompt_text' },
        meta_ref: { local_only: true },
      },
    },
    'must_preserve_full_bind_json_without_loss',
  );
  return { key: 'convert_page_asset_root_and_children_to_cellwise_records', status: 'PASS' };
}

const tests = [
  test_convert_page_asset_root_and_children_to_cellwise_records,
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
