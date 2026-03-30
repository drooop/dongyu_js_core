#!/usr/bin/env node

import assert from 'node:assert/strict';
import { deriveEditorModelOptions, deriveHomeMissingModelText, deriveHomeSelectedLabelText, deriveHomeTableRows } from '../../packages/ui-model-demo-frontend/src/editor_page_state_derivers.js';

const EDITOR_STATE_MODEL_ID = -2;

function makeSnapshot(selectedModelId = '') {
  return {
    models: {
      '-2': {
        id: -2,
        name: 'editor_state',
        cells: {
          '0,0,0': {
            labels: {
              selected_model_id: { k: 'selected_model_id', t: 'str', v: selectedModelId },
              dt_filter_p: { k: 'dt_filter_p', t: 'str', v: '' },
              dt_filter_r: { k: 'dt_filter_r', t: 'str', v: '' },
              dt_filter_c: { k: 'dt_filter_c', t: 'str', v: '' },
              dt_filter_ktv: { k: 'dt_filter_ktv', t: 'str', v: '' },
              dt_filter_model_query: { k: 'dt_filter_model_query', t: 'str', v: '' },
              draft_p: { k: 'draft_p', t: 'str', v: '0' },
              draft_r: { k: 'draft_r', t: 'str', v: '0' },
              draft_c: { k: 'draft_c', t: 'str', v: '0' },
              draft_k: { k: 'draft_k', t: 'str', v: 'title' },
              draft_t: { k: 'draft_t', t: 'str', v: 'str' },
            },
          },
        },
      },
      '0': {
        id: 0,
        name: 'MT',
        cells: {
          '0,0,0': { labels: { model_type: { k: 'model_type', t: 'str', v: 'main' } } },
        },
      },
      '1': {
        id: 1,
        name: 'one',
        cells: {
          '0,0,0': { labels: { title: { k: 'title', t: 'str', v: 'one' } } },
        },
      },
      '2': {
        id: 2,
        name: 'two',
        cells: {
          '0,0,0': { labels: { title: { k: 'title', t: 'str', v: 'two' } } },
          '1,0,0': { labels: { enabled: { k: 'enabled', t: 'bool', v: true } } },
        },
      },
    },
  };
}

function test_editor_model_options_include_all_models() {
  const options = deriveEditorModelOptions(makeSnapshot(''), EDITOR_STATE_MODEL_ID);
  assert.equal(options[0]?.value, '', 'All models option must be first');
  assert.match(String(options[0]?.label || ''), /all models/i, 'All models option must be labeled');
  return { key: 'editor_model_options_include_all_models', status: 'PASS' };
}

function test_home_table_rows_expand_to_multiple_models_when_all_selected() {
  const rows = deriveHomeTableRows(makeSnapshot(''), EDITOR_STATE_MODEL_ID);
  const modelIds = [...new Set(rows.map((row) => row.model_id))].sort((a, b) => a - b);
  assert.deepEqual(modelIds, [-2, 0, 1, 2], 'All models selection must include every model, including negative system models');
  return { key: 'home_table_rows_expand_to_multiple_models_when_all_selected', status: 'PASS' };
}

function test_home_selected_label_text_reports_all_models_mode() {
  const text = deriveHomeSelectedLabelText(makeSnapshot(''), EDITOR_STATE_MODEL_ID);
  assert.match(text, /all models/i, 'selected label text must explicitly show all-models mode');
  assert.equal(deriveHomeMissingModelText(makeSnapshot(''), EDITOR_STATE_MODEL_ID), '', 'all-models mode must not report missing model');
  return { key: 'home_selected_label_text_reports_all_models_mode', status: 'PASS' };
}

const tests = [
  test_editor_model_options_include_all_models,
  test_home_table_rows_expand_to_multiple_models_when_all_selected,
  test_home_selected_label_text_reports_all_models_mode,
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
