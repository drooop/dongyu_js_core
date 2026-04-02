#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relPath), 'utf8'));
}

function getRecords(patch) {
  return Array.isArray(patch?.records) ? patch.records : [];
}

function findRecord(records, predicate) {
  return records.find((record) => predicate(record)) || null;
}

const workspacePatch = readJson('packages/worker-base/system-models/workspace_positive_models.json');
const hierarchyPatch = readJson('packages/worker-base/system-models/runtime_hierarchy_mounts.json');
const workspaceRecords = getRecords(workspacePatch);
const hierarchyRecords = getRecords(hierarchyPatch);

const DOC_WORKSPACE_APP_MODEL_ID = 1013;
const DOC_WORKSPACE_TRUTH_MODEL_ID = 1014;

function test_doc_workspace_models_and_mounts_exist() {
  assert.ok(findRecord(workspaceRecords, (record) => record?.op === 'create_model' && record?.model_id === DOC_WORKSPACE_APP_MODEL_ID), 'doc_workspace_app_model_missing');
  assert.ok(findRecord(workspaceRecords, (record) => record?.op === 'create_model' && record?.model_id === DOC_WORKSPACE_TRUTH_MODEL_ID), 'doc_workspace_truth_model_missing');
  assert.ok(findRecord(hierarchyRecords, (record) => record?.model_id === 0 && record?.t === 'model.submt' && record?.v === DOC_WORKSPACE_APP_MODEL_ID), 'doc_workspace_app_must_mount_under_model0');
  assert.ok(findRecord(workspaceRecords, (record) => record?.model_id === DOC_WORKSPACE_APP_MODEL_ID && record?.t === 'model.submt' && record?.v === DOC_WORKSPACE_TRUTH_MODEL_ID), 'doc_workspace_truth_must_mount_under_app');
  return { key: 'doc_workspace_models_and_mounts_exist', status: 'PASS' };
}

function test_doc_workspace_sidebar_entry_and_label_defined_layout_exist() {
  assert.ok(findRecord(workspaceRecords, (record) => record?.model_id === DOC_WORKSPACE_APP_MODEL_ID && record?.k === 'app_name'), 'doc_workspace_app_name_missing');
  assert.ok(findRecord(workspaceRecords, (record) => record?.model_id === DOC_WORKSPACE_APP_MODEL_ID && record?.k === 'ui_component' && record?.v === 'Section'), 'doc_workspace_must_use_section');
  assert.ok(findRecord(workspaceRecords, (record) => record?.model_id === DOC_WORKSPACE_APP_MODEL_ID && record?.k === 'ui_component' && record?.v === 'Heading'), 'doc_workspace_must_use_heading');
  assert.ok(findRecord(workspaceRecords, (record) => record?.model_id === DOC_WORKSPACE_APP_MODEL_ID && record?.k === 'ui_component' && record?.v === 'Callout'), 'doc_workspace_must_use_callout');
  assert.ok(findRecord(workspaceRecords, (record) => record?.model_id === DOC_WORKSPACE_APP_MODEL_ID && record?.k === 'ui_layout' && typeof record?.v === 'string'), 'doc_workspace_layout_labels_missing');
  return { key: 'doc_workspace_sidebar_entry_and_label_defined_layout_exist', status: 'PASS' };
}

const tests = [
  test_doc_workspace_models_and_mounts_exist,
  test_doc_workspace_sidebar_entry_and_label_defined_layout_exist,
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
