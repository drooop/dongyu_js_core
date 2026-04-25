#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

const MATRIX_WORKSPACE_APP_MODEL_ID = 1016;
const MATRIX_SESSION_MODEL_ID = 1017;
const MATRIX_ROOM_DIRECTORY_MODEL_ID = 1018;
const MATRIX_ACTIVE_CONVERSATION_MODEL_ID = 1019;

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relPath), 'utf8'));
}

function getRecords(relPath) {
  return Array.isArray(readJson(relPath)?.records) ? readJson(relPath).records : [];
}

function findRecord(records, predicate) {
  return records.find((record) => predicate(record)) || null;
}

async function test_model_ids_export_matrix_phase1_constants() {
  const ids = await import(path.join(repoRoot, 'packages/ui-model-demo-frontend/src/model_ids.js'));
  assert.equal(ids.MATRIX_WORKSPACE_APP_MODEL_ID, MATRIX_WORKSPACE_APP_MODEL_ID, 'model_ids_missing_matrix_workspace_app_model_id');
  assert.equal(ids.MATRIX_SESSION_MODEL_ID, MATRIX_SESSION_MODEL_ID, 'model_ids_missing_matrix_session_model_id');
  assert.equal(ids.MATRIX_ROOM_DIRECTORY_MODEL_ID, MATRIX_ROOM_DIRECTORY_MODEL_ID, 'model_ids_missing_matrix_room_directory_model_id');
  assert.equal(ids.MATRIX_ACTIVE_CONVERSATION_MODEL_ID, MATRIX_ACTIVE_CONVERSATION_MODEL_ID, 'model_ids_missing_matrix_active_conversation_model_id');
  return { key: 'model_ids_export_matrix_phase1_constants', status: 'PASS' };
}

function test_workspace_patch_defines_matrix_phase1_models_and_mounts() {
  const workspaceRecords = getRecords('packages/worker-base/system-models/workspace_positive_models.json');
  const hierarchyRecords = getRecords('packages/worker-base/system-models/runtime_hierarchy_mounts.json');

  for (const modelId of [
    MATRIX_WORKSPACE_APP_MODEL_ID,
    MATRIX_SESSION_MODEL_ID,
    MATRIX_ROOM_DIRECTORY_MODEL_ID,
    MATRIX_ACTIVE_CONVERSATION_MODEL_ID,
  ]) {
    assert.ok(
      findRecord(workspaceRecords, (record) => record?.op === 'create_model' && record?.model_id === modelId),
      `workspace_patch_missing_model_${modelId}`,
    );
  }

  assert.ok(
    findRecord(hierarchyRecords, (record) => (
      record?.model_id === 0
      && record?.t === 'model.submt'
      && record?.v === MATRIX_WORKSPACE_APP_MODEL_ID
    )),
    'matrix_workspace_app_must_mount_under_model0',
  );

  for (const childId of [
    MATRIX_SESSION_MODEL_ID,
    MATRIX_ROOM_DIRECTORY_MODEL_ID,
    MATRIX_ACTIVE_CONVERSATION_MODEL_ID,
  ]) {
    assert.ok(
      findRecord(workspaceRecords, (record) => (
        record?.model_id === MATRIX_WORKSPACE_APP_MODEL_ID
        && record?.k === 'model_type'
        && record?.t === 'model.submt'
        && record?.v === childId
      )),
      `matrix_workspace_app_missing_child_submt_${childId}`,
    );
  }

  assert.ok(
    findRecord(workspaceRecords, (record) => record?.model_id === MATRIX_WORKSPACE_APP_MODEL_ID && record?.k === 'app_name'),
    'matrix_workspace_app_missing_app_name',
  );
  assert.ok(
    findRecord(workspaceRecords, (record) => record?.model_id === MATRIX_SESSION_MODEL_ID && record?.k === 'dual_bus_model'),
    'matrix_session_truth_missing_dual_bus_model',
  );
  assert.ok(
    findRecord(workspaceRecords, (record) => record?.model_id === MATRIX_ACTIVE_CONVERSATION_MODEL_ID && record?.k === 'dual_bus_model'),
    'matrix_conversation_truth_missing_dual_bus_model',
  );

  return { key: 'workspace_patch_defines_matrix_phase1_models_and_mounts', status: 'PASS' };
}

function test_system_and_remote_patches_cover_model1019_route() {
  const systemRecords = getRecords('packages/worker-base/system-models/system_models.json');
  const mbrRecords = getRecords('deploy/sys-v1ns/mbr/patches/mbr_role_v0.json');
  const remoteConfigRecords = getRecords('deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json');
  const remoteConversationRecords = getRecords('deploy/sys-v1ns/remote-worker/patches/12_model1019.json');

  assert.ok(findRecord(systemRecords, (record) => record?.k === 'mbr_route_1019'), 'system_models_missing_mbr_route_1019');
  assert.ok(
    findRecord(mbrRecords, (record) => record?.k === 'mbr_mqtt_model_ids' && Array.isArray(record?.v) && record.v.includes(MATRIX_ACTIVE_CONVERSATION_MODEL_ID)),
    'mbr_role_missing_model1019_in_mqtt_model_ids',
  );
  assert.ok(
    findRecord(remoteConfigRecords, (record) => (
      record?.k === 'remote_subscriptions'
      && Array.isArray(record?.v)
      && record.v.some((topic) => String(topic).endsWith('/1019/submit'))
      && record.v.some((topic) => String(topic).endsWith('/1019/result'))
    )),
    'remote_worker_config_missing_model1019_topics',
  );
  assert.ok(
    findRecord(remoteConversationRecords, (record) => record?.model_id === MATRIX_ACTIVE_CONVERSATION_MODEL_ID && record?.k === 'result_out_topic'),
    'remote_worker_patch_missing_model1019_result_out_topic',
  );

  return { key: 'system_and_remote_patches_cover_model1019_route', status: 'PASS' };
}

function test_local_persisted_asset_sync_includes_model1019_patch() {
  const source = fs.readFileSync(path.join(repoRoot, 'scripts/ops/sync_local_persisted_assets.sh'), 'utf8');
  assert.match(source, /12_model1019\.json/, 'sync_local_persisted_assets_must_include_model1019_patch');
  return { key: 'local_persisted_asset_sync_includes_model1019_patch', status: 'PASS' };
}

const tests = [
  test_model_ids_export_matrix_phase1_constants,
  test_workspace_patch_defines_matrix_phase1_models_and_mounts,
  test_system_and_remote_patches_cover_model1019_route,
  test_local_persisted_asset_sync_includes_model1019_patch,
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
