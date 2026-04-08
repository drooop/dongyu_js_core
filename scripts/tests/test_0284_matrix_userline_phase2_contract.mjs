#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

const MATRIX_WORKSPACE_APP_MODEL_ID = 1016;
const MATRIX_SESSION_MODEL_ID = 1017;
const MATRIX_ROOM_DIRECTORY_MODEL_ID = 1018;
const MATRIX_ACTIVE_CONVERSATION_MODEL_ID = 1019;
const MATRIX_ACTIVE_ROOM_MEMBERS_MODEL_ID = 1020;
const MATRIX_CHAT_UI_STATE_MODEL_ID = 1021;

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relPath), 'utf8'));
}

function getRecords(relPath) {
  return Array.isArray(readJson(relPath)?.records) ? readJson(relPath).records : [];
}

function findRecord(records, predicate) {
  return records.find((record) => predicate(record)) || null;
}

function findBind(records, modelId, nodeId) {
  return findRecord(records, (record) => (
    record?.model_id === modelId
    && record?.k === 'ui_bind_json'
    && record?.op === 'add_label'
    && findRecord(records, (nodeRecord) => (
      nodeRecord?.model_id === modelId
      && nodeRecord?.k === 'ui_node_id'
      && nodeRecord?.v === nodeId
      && nodeRecord?.p === record?.p
      && nodeRecord?.r === record?.r
      && nodeRecord?.c === record?.c
    ))
  ));
}

async function test_model_ids_export_matrix_phase2_constants() {
  const ids = await import(path.join(repoRoot, 'packages/ui-model-demo-frontend/src/model_ids.js'));
  assert.equal(
    ids.MATRIX_ACTIVE_ROOM_MEMBERS_MODEL_ID,
    MATRIX_ACTIVE_ROOM_MEMBERS_MODEL_ID,
    'model_ids_missing_matrix_active_room_members_model_id',
  );
  assert.equal(
    ids.MATRIX_CHAT_UI_STATE_MODEL_ID,
    MATRIX_CHAT_UI_STATE_MODEL_ID,
    'model_ids_missing_matrix_chat_ui_state_model_id',
  );
  return { key: 'model_ids_export_matrix_phase2_constants', status: 'PASS' };
}

function test_workspace_patch_defines_phase2_models_and_layout() {
  const workspaceRecords = getRecords('packages/worker-base/system-models/workspace_positive_models.json');

  for (const modelId of [
    MATRIX_ACTIVE_ROOM_MEMBERS_MODEL_ID,
    MATRIX_CHAT_UI_STATE_MODEL_ID,
  ]) {
    assert.ok(
      findRecord(workspaceRecords, (record) => record?.op === 'create_model' && record?.model_id === modelId),
      `workspace_patch_missing_model_${modelId}`,
    );
    assert.ok(
      findRecord(workspaceRecords, (record) => (
        record?.model_id === MATRIX_WORKSPACE_APP_MODEL_ID
        && record?.k === 'model_type'
        && record?.t === 'model.submt'
        && record?.v === modelId
      )),
      `workspace_app_missing_child_submt_${modelId}`,
    );
  }

  const roomsRecord = findRecord(workspaceRecords, (record) => (
    record?.model_id === MATRIX_ROOM_DIRECTORY_MODEL_ID
    && record?.k === 'rooms_json'
  ));
  assert.ok(Array.isArray(roomsRecord?.v), 'room_directory_missing_rooms_json');
  assert.ok(roomsRecord.v.some((room) => room && room.kind === 'dm'), 'phase2_requires_dm_room_seed');
  assert.ok(roomsRecord.v.some((room) => room && room.kind === 'group'), 'phase2_requires_group_room_seed');

  assert.ok(
    findRecord(workspaceRecords, (record) => record?.model_id === MATRIX_ACTIVE_CONVERSATION_MODEL_ID && record?.k === 'timeline_json'),
    'conversation_truth_missing_timeline_json',
  );
  assert.ok(
    findRecord(workspaceRecords, (record) => record?.model_id === MATRIX_ACTIVE_CONVERSATION_MODEL_ID && record?.k === 'timeline_text'),
    'conversation_truth_missing_timeline_text',
  );
  assert.ok(
    findRecord(workspaceRecords, (record) => record?.model_id === MATRIX_ACTIVE_ROOM_MEMBERS_MODEL_ID && record?.k === 'room_members_json'),
    'members_truth_missing_room_members_json',
  );
  assert.ok(
    findRecord(workspaceRecords, (record) => record?.model_id === MATRIX_ACTIVE_ROOM_MEMBERS_MODEL_ID && record?.k === 'active_members_summary'),
    'members_truth_missing_active_members_summary',
  );
  assert.ok(
    findRecord(workspaceRecords, (record) => record?.model_id === MATRIX_CHAT_UI_STATE_MODEL_ID && record?.k === 'composer_draft'),
    'ui_state_missing_composer_draft',
  );
  assert.ok(
    findRecord(workspaceRecords, (record) => record?.model_id === MATRIX_CHAT_UI_STATE_MODEL_ID && record?.k === 'member_panel_open'),
    'ui_state_missing_member_panel_open',
  );

  for (const nodeId of [
    'matrix_phase2_room_list_card',
    'matrix_phase2_timeline_card',
    'matrix_phase2_members_card',
  ]) {
    assert.ok(
      findRecord(workspaceRecords, (record) => record?.model_id === MATRIX_WORKSPACE_APP_MODEL_ID && record?.k === 'ui_node_id' && record?.v === nodeId),
      `workspace_ui_missing_${nodeId}`,
    );
  }

  const composerBind = findBind(workspaceRecords, MATRIX_WORKSPACE_APP_MODEL_ID, 'matrix_phase2_composer_input');
  assert.equal(
    composerBind?.v?.read?.model_id,
    MATRIX_CHAT_UI_STATE_MODEL_ID,
    'composer_input_must_bind_to_ui_state_model',
  );
  assert.equal(
    composerBind?.v?.read?.k,
    'composer_draft',
    'composer_input_must_bind_to_composer_draft',
  );

  const roomButtonBind = findBind(workspaceRecords, MATRIX_WORKSPACE_APP_MODEL_ID, 'matrix_phase2_room_button_group');
  assert.equal(roomButtonBind?.v?.write?.action, 'submit', 'room_button_must_dispatch_submit_action');
  assert.equal(roomButtonBind?.v?.write?.meta?.model_id, MATRIX_ACTIVE_CONVERSATION_MODEL_ID, 'room_button_must_target_active_conversation_model');
  assert.equal(roomButtonBind?.v?.write?.value_ref?.t, 'event', 'room_button_must_send_event_value');
  assert.equal(roomButtonBind?.v?.write?.value_ref?.v?.action, 'select_room', 'room_button_must_use_select_room_action');

  return { key: 'workspace_patch_defines_phase2_models_and_layout', status: 'PASS' };
}

function test_remote_patch_updates_timeline_projection() {
  const remoteRecords = getRecords('deploy/sys-v1ns/remote-worker/patches/12_model1019.json');
  const handler = findRecord(remoteRecords, (record) => (
    record?.model_id === MATRIX_ACTIVE_CONVERSATION_MODEL_ID
    && record?.k === 'on_matrix_phase2_remote_submit_in'
    && record?.t === 'func.js'
  ));
  assert.ok(handler?.v?.code, 'remote_worker_missing_phase2_submit_handler');
  const code = String(handler.v.code);
  assert.match(code, /room_timelines_json/, 'remote_worker_must_persist_room_timelines');
  assert.match(code, /timeline_text/, 'remote_worker_must_emit_timeline_text');
  assert.match(code, /timeline_json/, 'remote_worker_must_emit_timeline_json');
  return { key: 'remote_patch_updates_timeline_projection', status: 'PASS' };
}

const tests = [
  test_model_ids_export_matrix_phase2_constants,
  test_workspace_patch_defines_phase2_models_and_layout,
  test_remote_patch_updates_timeline_projection,
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
