#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

const SLIDE_IMPORTER_APP_MODEL_ID = 1030;
const SLIDE_IMPORTER_TRUTH_MODEL_ID = 1031;

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relPath), 'utf8'));
}

function getRecords(relPath) {
  return Array.isArray(readJson(relPath)?.records) ? readJson(relPath).records : [];
}

function findRecord(records, predicate) {
  return records.find((record) => predicate(record)) || null;
}

async function test_model_ids_export_slide_importer_constants() {
  const ids = await import(path.join(repoRoot, 'packages/ui-model-demo-frontend/src/model_ids.js'));
  assert.equal(ids.SLIDE_IMPORTER_APP_MODEL_ID, SLIDE_IMPORTER_APP_MODEL_ID, 'model_ids_missing_slide_importer_app_model_id');
  assert.equal(ids.SLIDE_IMPORTER_TRUTH_MODEL_ID, SLIDE_IMPORTER_TRUTH_MODEL_ID, 'model_ids_missing_slide_importer_truth_model_id');
  return { key: 'model_ids_export_slide_importer_constants', status: 'PASS' };
}

function test_workspace_patch_defines_importer_models() {
  const workspaceRecords = getRecords('packages/worker-base/system-models/workspace_positive_models.json');
  const hierarchyRecords = getRecords('packages/worker-base/system-models/runtime_hierarchy_mounts.json');

  assert.ok(
    findRecord(workspaceRecords, (record) => record?.op === 'create_model' && record?.model_id === SLIDE_IMPORTER_APP_MODEL_ID),
    'slide_importer_app_model_missing',
  );
  assert.ok(
    findRecord(workspaceRecords, (record) => record?.op === 'create_model' && record?.model_id === SLIDE_IMPORTER_TRUTH_MODEL_ID),
    'slide_importer_truth_model_missing',
  );
  assert.ok(
    findRecord(hierarchyRecords, (record) => record?.model_id === 0 && record?.t === 'model.submt' && record?.v === SLIDE_IMPORTER_APP_MODEL_ID),
    'slide_importer_app_must_mount_under_model0',
  );
  assert.ok(
    findRecord(workspaceRecords, (record) => (
      record?.model_id === SLIDE_IMPORTER_APP_MODEL_ID
      && record?.k === 'model_type'
      && record?.t === 'model.submt'
      && record?.v === SLIDE_IMPORTER_TRUTH_MODEL_ID
    )),
    'slide_importer_truth_must_mount_under_importer_app',
  );

  for (const key of [
    'slide_import_media_uri',
    'slide_import_media_name',
    'slide_import_status',
    'slide_import_last_app_id',
    'slide_import_last_app_name',
    'slide_import_last_from_user',
    'slide_import_last_to_user',
  ]) {
    assert.ok(
      findRecord(workspaceRecords, (record) => record?.model_id === SLIDE_IMPORTER_TRUTH_MODEL_ID && record?.k === key),
      `slide_import_truth_missing_${key}`,
    );
  }

  return { key: 'workspace_patch_defines_importer_models', status: 'PASS' };
}

function test_workspace_sidebar_defines_delete_action() {
  const workspaceCatalogRecords = getRecords('packages/worker-base/system-models/workspace_catalog_ui.json');
  const deleteButton = findRecord(workspaceCatalogRecords, (record) => (
    record?.k === 'ui_label'
    && record?.v === 'Del'
  ));
  assert.ok(deleteButton, 'workspace_sidebar_missing_delete_button');

  const deleteButtonParent = findRecord(workspaceCatalogRecords, (record) => (
    record?.p === deleteButton.p
    && record?.r === deleteButton.r
    && record?.c === deleteButton.c
    && record?.k === 'ui_parent'
    && record?.v === 'col_ws_actions'
  ));
  assert.ok(deleteButtonParent, 'workspace_delete_button_must_live_under_actions_column');

  const deleteAction = findRecord(workspaceCatalogRecords, (record) => (
    record?.p === deleteButton.p
    && record?.r === deleteButton.r
    && record?.c === deleteButton.c
    && record?.k === 'ui_bind_json'
    && record?.v?.write?.pin === 'click'
  ));
  assert.ok(deleteAction, 'workspace_delete_button_missing_click_pin_binding');

  assert.ok(
    findRecord(workspaceCatalogRecords, (record) => (
      record?.p === deleteButton.p
      && record?.r === deleteButton.r
      && record?.c === deleteButton.c
      && record?.k === 'click_route'
      && Array.isArray(record?.v)
      && record.v.some((route) => Array.isArray(route?.to) && route.to.includes('(func, handle_ws_delete_click:in)'))
    )),
    'workspace_delete_button_missing_click_route',
  );

  assert.ok(
    findRecord(workspaceCatalogRecords, (record) => (
      record?.p === deleteButton.p
      && record?.r === deleteButton.r
      && record?.c === deleteButton.c
      && record?.k === 'handle_ws_delete_click'
      && String(record?.v?.code || '').includes('wsDeleteApp')
    )),
    'workspace_delete_button_missing_delete_handler',
  );

  const intentDispatch = getRecords('packages/worker-base/system-models/intent_dispatch_config.json');
  assert.ok(
    findRecord(intentDispatch, (record) => record?.k === 'intent_dispatch_table' && record?.v?.slide_app_import === 'handle_slide_app_import'),
    'intent_dispatch_missing_slide_app_import_route',
  );

  return { key: 'workspace_sidebar_defines_delete_action', status: 'PASS' };
}

function test_local_asset_sync_includes_slide_import_handler() {
  const source = fs.readFileSync(path.join(repoRoot, 'scripts/ops/sync_local_persisted_assets.sh'), 'utf8');
  assert.match(source, /intent_handlers_slide_import\.json/, 'local_asset_sync_missing_slide_import_handler');
  return { key: 'local_asset_sync_includes_slide_import_handler', status: 'PASS' };
}

const tests = [
  test_model_ids_export_slide_importer_constants,
  test_workspace_patch_defines_importer_models,
  test_workspace_sidebar_defines_delete_action,
  test_local_asset_sync_includes_slide_import_handler,
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
