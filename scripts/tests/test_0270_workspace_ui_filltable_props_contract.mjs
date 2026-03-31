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
  const controlsProps = findRecord((record) => (
    record?.model_id === WORKSPACE_FILLTABLE_EXAMPLE_APP_MODEL_ID
    && record?.k === 'ui_props_json'
    && record?.v?.layout === 'row'
    && record?.v?.style?.flexDirection?.$label?.model_id === WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID
    && record?.v?.style?.flexDirection?.$label?.k === 'layout_direction'
  ));
  assert.ok(controlsProps, 'controls_container_must_bind_layout_direction_into_flex_direction');

  const inputProps = findRecord((record) => (
    record?.model_id === WORKSPACE_FILLTABLE_EXAMPLE_APP_MODEL_ID
    && record?.k === 'ui_props_json'
    && record?.v?.style?.fontSize?.$label?.model_id === WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID
    && record?.v?.style?.fontSize?.$label?.k === 'input_font_size'
  ));
  assert.ok(inputProps, 'input_component_must_bind_input_font_size');

  const buttonProps = findRecord((record) => (
    record?.model_id === WORKSPACE_FILLTABLE_EXAMPLE_APP_MODEL_ID
    && record?.k === 'ui_props_json'
    && record?.v?.type?.$label?.model_id === WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID
    && record?.v?.type?.$label?.k === 'button_variant'
    && record?.v?.style?.backgroundColor?.$label?.model_id === WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID
    && record?.v?.style?.backgroundColor?.$label?.k === 'button_color'
  ));
  assert.ok(buttonProps, 'button_component_must_bind_variant_and_color');
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
