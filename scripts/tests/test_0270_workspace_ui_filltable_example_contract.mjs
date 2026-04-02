#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  WORKSPACE_FILLTABLE_EXAMPLE_APP_MODEL_ID,
  WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID,
} from '../../packages/ui-model-demo-frontend/src/model_ids.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relPath), 'utf8'));
}

function getPatchRecords(patch) {
  return Array.isArray(patch?.records) ? patch.records : [];
}

function findRecord(records, predicate) {
  return records.find((record) => predicate(record)) || null;
}

function getModelRecords(records, modelId) {
  return records.filter((record) => record?.model_id === modelId);
}

const workspacePatch = readJson('packages/worker-base/system-models/workspace_positive_models.json');
const hierarchyPatch = readJson('packages/worker-base/system-models/runtime_hierarchy_mounts.json');
const positiveRecords = getPatchRecords(workspacePatch);
const hierarchyRecords = getPatchRecords(hierarchyPatch);

function test_workspace_filltable_example_models_and_mounts_exist() {
  assert.ok(
    findRecord(positiveRecords, (record) => (
      record?.op === 'create_model' && record?.model_id === WORKSPACE_FILLTABLE_EXAMPLE_APP_MODEL_ID
    )),
    'workspace_example_app_model_missing',
  );
  assert.ok(
    findRecord(positiveRecords, (record) => (
      record?.op === 'create_model' && record?.model_id === WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID
    )),
    'workspace_example_truth_model_missing',
  );
  assert.ok(
    findRecord(hierarchyRecords, (record) => (
      record?.model_id === 0 && record?.t === 'model.submt' && record?.v === WORKSPACE_FILLTABLE_EXAMPLE_APP_MODEL_ID
    )),
    'workspace_example_app_must_be_mounted_under_model0',
  );
  assert.ok(
    findRecord(positiveRecords, (record) => (
      record?.model_id === WORKSPACE_FILLTABLE_EXAMPLE_APP_MODEL_ID
      && record?.k === 'model_type'
      && record?.t === 'model.submt'
      && record?.v === WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID
    )),
    'workspace_example_truth_must_be_mounted_under_app_host',
  );
  assert.equal(
    Boolean(findRecord(hierarchyRecords, (record) => (
      record?.model_id === 0 && record?.t === 'model.submt' && record?.v === WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID
    ))),
    false,
    'workspace_example_truth_must_not_be_mounted_directly_under_model0',
  );
  return { key: 'workspace_filltable_example_models_and_mounts_exist', status: 'PASS' };
}

function test_workspace_filltable_example_sidebar_entry_and_ui_nodes_exist() {
  assert.equal(
    findRecord(positiveRecords, (record) => (
      record?.model_id === WORKSPACE_FILLTABLE_EXAMPLE_APP_MODEL_ID && record?.k === 'app_name'
    ))?.v,
    '0270 Fill-Table Workspace UI',
    'workspace_example_app_name_must_be_stable',
  );
  assert.equal(
    findRecord(positiveRecords, (record) => (
      record?.model_id === WORKSPACE_FILLTABLE_EXAMPLE_APP_MODEL_ID && record?.k === 'ui_root_node_id'
    ))?.v,
    'ws_filltable_example_root',
    'workspace_example_root_node_id_must_be_stable',
  );

  const appRecords = getModelRecords(positiveRecords, WORKSPACE_FILLTABLE_EXAMPLE_APP_MODEL_ID);
  assert.ok(findRecord(appRecords, (record) => record?.k === 'ui_component' && record?.v === 'Input'), 'workspace_example_must_include_input_component');
  assert.ok(findRecord(appRecords, (record) => record?.k === 'ui_component' && record?.v === 'Button'), 'workspace_example_must_include_button_component');
  assert.ok(findRecord(appRecords, (record) => record?.k === 'ui_component' && record?.v === 'Text'), 'workspace_example_must_include_result_text_component');
  return { key: 'workspace_filltable_example_sidebar_entry_and_ui_nodes_exist', status: 'PASS' };
}

function test_workspace_filltable_example_uses_truth_model_bindings_and_modes() {
  const appRecords = getModelRecords(positiveRecords, WORKSPACE_FILLTABLE_EXAMPLE_APP_MODEL_ID);
  const truthRecords = getModelRecords(positiveRecords, WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID);

  assert.ok(findRecord(appRecords, (record) => record?.k === 'ui_read_model_id' && record?.v === WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID), 'workspace_example_input_must_read_truth_model');
  assert.ok(findRecord(appRecords, (record) => record?.k === 'ui_read_k' && record?.v === 'input_draft'), 'workspace_example_input_must_read_truth_input_draft');
  assert.ok(findRecord(appRecords, (record) => record?.k === 'ui_write_action' && record?.v === 'ui_owner_label_update'), 'workspace_example_input_must_write_via_owner_update');
  assert.ok(findRecord(appRecords, (record) => record?.k === 'ui_write_target_model_id' && record?.v === WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID), 'workspace_example_input_must_target_truth_model');
  assert.ok(findRecord(appRecords, (record) => record?.k === 'ui_write_target_k' && record?.v === 'input_draft'), 'workspace_example_input_must_write_to_truth_input_draft');

  const buttonBind = findRecord(appRecords, (record) => (
    record?.k === 'ui_bind_json'
    && record?.v?.write?.action === 'submit'
    && record?.v?.write?.meta?.model_id === WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID
  ));
  assert.ok(buttonBind, 'workspace_example_button_must_target_truth_model_submit');

  assert.ok(findRecord(appRecords, (record) => record?.k === 'ui_read_model_id' && record?.v === WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID), 'workspace_example_result_label_must_read_truth_model');
  assert.ok(findRecord(appRecords, (record) => record?.k === 'ui_read_k' && record?.v === 'generated_color_text'), 'workspace_example_result_label_must_read_truth_generated_color_text');

  assert.ok(findRecord(truthRecords, (record) => record?.k === 'submit_route_mode' && record?.v === 'remote'), 'truth_model_must_seed_remote_mode');
  assert.ok(findRecord(truthRecords, (record) => record?.k === 'processor_routes' && record?.t === 'pin.connect.label'), 'truth_model_must_define_processor_routes');
  assert.ok(findRecord(truthRecords, (record) => record?.k === 'dispatch_remote' && record?.t === 'func.js'), 'truth_model_must_define_dispatch_remote');
  assert.ok(findRecord(truthRecords, (record) => record?.k === 'dispatch_local' && record?.t === 'func.js'), 'truth_model_must_define_dispatch_local');
  assert.ok(findRecord(truthRecords, (record) => record?.k === 'layout_direction' && record?.t === 'str'), 'truth_model_must_define_layout_direction');
  assert.ok(findRecord(truthRecords, (record) => record?.k === 'input_font_size' && record?.t === 'str'), 'truth_model_must_define_input_font_size');
  assert.ok(findRecord(truthRecords, (record) => record?.k === 'button_variant' && record?.t === 'str'), 'truth_model_must_define_button_variant');
  return { key: 'workspace_filltable_example_uses_truth_model_bindings_and_modes', status: 'PASS' };
}

const tests = [
  test_workspace_filltable_example_models_and_mounts_exist,
  test_workspace_filltable_example_sidebar_entry_and_ui_nodes_exist,
  test_workspace_filltable_example_uses_truth_model_bindings_and_modes,
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
