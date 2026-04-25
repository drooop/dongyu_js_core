#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolve } from 'node:path';

import {
  WORKSPACE_FILLTABLE_EXAMPLE_APP_MODEL_ID,
  WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID,
} from '../../packages/ui-model-demo-frontend/src/model_ids.js';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const records = JSON.parse(fs.readFileSync(resolve(repoRoot, 'packages/worker-base/system-models/workspace_positive_models.json'), 'utf8')).records || [];
const rendererSource = fs.readFileSync(resolve(repoRoot, 'packages/ui-renderer/src/renderer.mjs'), 'utf8');

function findRecord(predicate) {
  return records.find((record) => predicate(record)) || null;
}

function test_props_labels_exist_on_truth_model() {
  assert.ok(findRecord((record) => record?.model_id === WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID && record?.k === 'layout_direction' && record?.t === 'str'), 'layout_direction_missing');
  assert.ok(findRecord((record) => record?.model_id === WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID && record?.k === 'input_font_size' && record?.t === 'str'), 'input_font_size_missing');
  assert.ok(findRecord((record) => record?.model_id === WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID && record?.k === 'button_variant' && record?.t === 'str'), 'button_variant_missing');
  assert.ok(findRecord((record) => record?.model_id === WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID && record?.k === 'button_color' && record?.t === 'str'), 'button_color_missing');
  return { key: 'props_labels_exist_on_truth_model', status: 'PASS' };
}

function test_props_bindings_are_consumed_by_ui_nodes() {
  assert.ok(findRecord((record) => (
    record?.model_id === WORKSPACE_FILLTABLE_EXAMPLE_APP_MODEL_ID
    && record?.k === 'ui_layout'
    && record?.v === 'row'
  )), 'controls_container_must_keep_row_layout');
  assert.ok(findRecord((record) => (
    record?.model_id === WORKSPACE_FILLTABLE_EXAMPLE_APP_MODEL_ID
    && record?.k === 'ui_style_flex_direction_ref_model_id'
    && record?.v === WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID
  )), 'controls_container_must_bind_layout_direction_into_flex_direction');
  assert.ok(findRecord((record) => (
    record?.model_id === WORKSPACE_FILLTABLE_EXAMPLE_APP_MODEL_ID
    && record?.k === 'ui_style_flex_direction_ref_k'
    && record?.v === 'layout_direction'
  )), 'controls_container_layout_direction_ref_key_missing');

  assert.ok(findRecord((record) => (
    record?.model_id === WORKSPACE_FILLTABLE_EXAMPLE_APP_MODEL_ID
    && record?.k === 'ui_style_font_size_ref_model_id'
    && record?.v === WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID
  )), 'input_component_must_bind_input_font_size');
  assert.ok(findRecord((record) => (
    record?.model_id === WORKSPACE_FILLTABLE_EXAMPLE_APP_MODEL_ID
    && record?.k === 'ui_style_font_size_ref_k'
    && record?.v === 'input_font_size'
  )), 'input_font_size_ref_key_missing');

  assert.ok(findRecord((record) => (
    record?.model_id === WORKSPACE_FILLTABLE_EXAMPLE_APP_MODEL_ID
    && record?.k === 'ui_variant_ref_model_id'
    && record?.v === WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID
  )), 'button_component_must_bind_variant');
  assert.ok(findRecord((record) => (
    record?.model_id === WORKSPACE_FILLTABLE_EXAMPLE_APP_MODEL_ID
    && record?.k === 'ui_variant_ref_k'
    && record?.v === 'button_variant'
  )), 'button_variant_ref_key_missing');
  assert.ok(findRecord((record) => (
    record?.model_id === WORKSPACE_FILLTABLE_EXAMPLE_APP_MODEL_ID
    && record?.k === 'ui_style_background_color_ref_model_id'
    && record?.v === WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID
  )), 'button_component_must_bind_color');
  assert.ok(findRecord((record) => (
    record?.model_id === WORKSPACE_FILLTABLE_EXAMPLE_APP_MODEL_ID
    && record?.k === 'ui_style_background_color_ref_k'
    && record?.v === 'button_color'
  )), 'button_color_ref_key_missing');
  return { key: 'props_bindings_are_consumed_by_ui_nodes', status: 'PASS' };
}

function test_renderer_supports_reverse_layout_values() {
  assert.match(rendererSource, /layout === 'row-reverse'/, 'renderer_must_support_row_reverse_layout');
  return { key: 'renderer_supports_reverse_layout_values', status: 'PASS' };
}

const tests = [
  test_props_labels_exist_on_truth_model,
  test_props_bindings_are_consumed_by_ui_nodes,
  test_renderer_supports_reverse_layout_values,
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
