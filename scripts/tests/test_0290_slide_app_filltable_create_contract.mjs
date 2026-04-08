#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

const SLIDE_CREATOR_APP_MODEL_ID = 1034;
const SLIDE_CREATOR_TRUTH_MODEL_ID = 1035;

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relPath), 'utf8'));
}

function getRecords(relPath) {
  return Array.isArray(readJson(relPath)?.records) ? readJson(relPath).records : [];
}

function findRecord(records, predicate) {
  return records.find((record) => predicate(record)) || null;
}

async function test_model_ids_export_slide_creator_constants() {
  const ids = await import(path.join(repoRoot, 'packages/ui-model-demo-frontend/src/model_ids.js'));
  assert.equal(ids.SLIDE_CREATOR_APP_MODEL_ID, SLIDE_CREATOR_APP_MODEL_ID, 'model_ids_missing_slide_creator_app_model_id');
  assert.equal(ids.SLIDE_CREATOR_TRUTH_MODEL_ID, SLIDE_CREATOR_TRUTH_MODEL_ID, 'model_ids_missing_slide_creator_truth_model_id');
  return { key: 'model_ids_export_slide_creator_constants', status: 'PASS' };
}

async function test_creator_reserved_ids_do_not_overlap_first_zip_import_range() {
  const ids = await import(path.join(repoRoot, 'packages/ui-model-demo-frontend/src/model_ids.js'));
  assert.ok(ids.SLIDE_CREATOR_APP_MODEL_ID > 1033, 'slide_creator_app_model_id_must_avoid_legacy_zip_import_ids');
  assert.equal(ids.SLIDE_CREATOR_TRUTH_MODEL_ID, ids.SLIDE_CREATOR_APP_MODEL_ID + 1, 'slide_creator_truth_must_follow_creator_app_id');
  return { key: 'creator_reserved_ids_do_not_overlap_first_zip_import_range', status: 'PASS' };
}

function test_workspace_patch_defines_slide_creator_models() {
  const workspaceRecords = getRecords('packages/worker-base/system-models/workspace_positive_models.json');
  const hierarchyRecords = getRecords('packages/worker-base/system-models/runtime_hierarchy_mounts.json');
  const creatorMount = findRecord(
    hierarchyRecords,
    (record) => record?.model_id === 0 && record?.t === 'model.submt' && record?.v === SLIDE_CREATOR_APP_MODEL_ID,
  );

  assert.ok(
    findRecord(workspaceRecords, (record) => record?.op === 'create_model' && record?.model_id === SLIDE_CREATOR_APP_MODEL_ID),
    'slide_creator_app_model_missing',
  );
  assert.ok(
    findRecord(workspaceRecords, (record) => record?.op === 'create_model' && record?.model_id === SLIDE_CREATOR_TRUTH_MODEL_ID),
    'slide_creator_truth_model_missing',
  );
  assert.ok(
    creatorMount,
    'slide_creator_app_must_mount_under_model0',
  );
  assert.ok(creatorMount.c > 14, 'slide_creator_mount_must_avoid_legacy_first_import_slot');
  assert.ok(
    findRecord(workspaceRecords, (record) => (
      record?.model_id === SLIDE_CREATOR_APP_MODEL_ID
      && record?.k === 'model_type'
      && record?.t === 'model.submt'
      && record?.v === SLIDE_CREATOR_TRUTH_MODEL_ID
    )),
    'slide_creator_truth_must_mount_under_creator_app',
  );

  for (const key of [
    'create_app_name',
    'create_source_worker',
    'create_slide_surface_type',
    'create_headline',
    'create_body_text',
    'create_status',
    'create_last_app_id',
    'create_last_app_name',
    'create_last_truth_id',
  ]) {
    assert.ok(
      findRecord(workspaceRecords, (record) => record?.model_id === SLIDE_CREATOR_TRUTH_MODEL_ID && record?.k === key),
      `slide_creator_truth_missing_${key}`,
    );
  }

  return { key: 'workspace_patch_defines_slide_creator_models', status: 'PASS' };
}

function test_creator_ui_and_action_route_exist() {
  const workspaceRecords = getRecords('packages/worker-base/system-models/workspace_positive_models.json');
  const dispatchRecords = getRecords('packages/worker-base/system-models/intent_dispatch_config.json');
  const syncScript = fs.readFileSync(path.join(repoRoot, 'scripts/ops/sync_local_persisted_assets.sh'), 'utf8');

  const createButton = findRecord(workspaceRecords, (record) => (
    record?.model_id === SLIDE_CREATOR_APP_MODEL_ID
    && record?.k === 'ui_label'
    && record?.v === '创建 Slide App'
  ));
  assert.ok(createButton, 'slide_creator_button_missing');
  assert.ok(
    findRecord(workspaceRecords, (record) => (
      record?.model_id === SLIDE_CREATOR_APP_MODEL_ID
      && record?.p === createButton.p
      && record?.r === createButton.r
      && record?.c === createButton.c
      && record?.k === 'ui_bind_json'
      && record?.v?.write?.action === 'slide_app_create'
    )),
    'slide_creator_button_missing_slide_app_create_action',
  );

  assert.ok(
    findRecord(dispatchRecords, (record) => record?.k === 'intent_dispatch_table' && record?.v?.slide_app_create === 'handle_slide_app_create'),
    'intent_dispatch_missing_slide_app_create_route',
  );
  assert.match(syncScript, /intent_handlers_slide_create\.json/, 'local_asset_sync_missing_slide_create_handler');
  return { key: 'creator_ui_and_action_route_exist', status: 'PASS' };
}

const tests = [
  test_model_ids_export_slide_creator_constants,
  test_creator_reserved_ids_do_not_overlap_first_zip_import_range,
  test_workspace_patch_defines_slide_creator_models,
  test_creator_ui_and_action_route_exist,
];

(async () => {
  let passed = 0;
  let failed = 0;
  for (const test of tests) {
    try {
      const result = await test();
      console.log(`[${result.status}] ${result.key}`);
      passed += 1;
    } catch (error) {
      console.log(`[FAIL] ${test.name}: ${error.message}`);
      failed += 1;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
  process.exit(failed > 0 ? 1 : 0);
})();
