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

const STATIC_WORKSPACE_APP_MODEL_ID = 1011;
const STATIC_WORKSPACE_TRUTH_MODEL_ID = 1012;

function test_static_workspace_models_and_mounts_exist() {
  assert.ok(
    findRecord(workspaceRecords, (record) => record?.op === 'create_model' && record?.model_id === STATIC_WORKSPACE_APP_MODEL_ID),
    'static_workspace_app_model_missing',
  );
  assert.ok(
    findRecord(workspaceRecords, (record) => record?.op === 'create_model' && record?.model_id === STATIC_WORKSPACE_TRUTH_MODEL_ID),
    'static_workspace_truth_model_missing',
  );
  assert.ok(
    findRecord(hierarchyRecords, (record) => record?.model_id === 0 && record?.t === 'model.submt' && record?.v === STATIC_WORKSPACE_APP_MODEL_ID),
    'static_workspace_app_must_mount_under_model0',
  );
  assert.ok(
    findRecord(workspaceRecords, (record) => (
      record?.model_id === STATIC_WORKSPACE_APP_MODEL_ID
      && record?.k === 'model_type'
      && record?.t === 'model.submt'
      && record?.v === STATIC_WORKSPACE_TRUTH_MODEL_ID
    )),
    'static_workspace_truth_must_mount_under_app',
  );
  return { key: 'static_workspace_models_and_mounts_exist', status: 'PASS' };
}

function test_static_truth_owns_upload_state() {
  const truthRecords = workspaceRecords.filter((record) => record?.model_id === STATIC_WORKSPACE_TRUTH_MODEL_ID);
  for (const key of [
    'static_project_name',
    'static_upload_kind',
    'static_media_uri',
    'static_media_name',
    'static_status',
    'static_projects_json',
    'mounted_path_prefix',
  ]) {
    assert.ok(truthRecords.some((record) => record?.k === key), `static_truth_missing_${key}`);
  }
  return { key: 'static_truth_owns_upload_state', status: 'PASS' };
}

const tests = [
  test_static_workspace_models_and_mounts_exist,
  test_static_truth_owns_upload_state,
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
