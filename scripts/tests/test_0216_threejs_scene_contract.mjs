#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import * as modelIds from '../../packages/ui-model-demo-frontend/src/model_ids.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relPath), 'utf8'));
}

function readText(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function getPatchRecords(patch) {
  return Array.isArray(patch?.records) ? patch.records : [];
}

function findRecord(records, predicate) {
  return records.find((record) => predicate(record)) || null;
}

function getPageAsset(records, modelId) {
  const record = findRecord(records, (item) => (
    item?.model_id === modelId
    && item?.op === 'add_label'
    && item?.p === 0
    && item?.r === 1
    && item?.c === 0
    && item?.k === 'page_asset_v0'
  ));
  return record ? record.v : null;
}

function getRootLabel(records, modelId, key) {
  const record = findRecord(records, (item) => (
    item?.model_id === modelId
    && item?.op === 'add_label'
    && item?.p === 0
    && item?.r === 0
    && item?.c === 0
    && item?.k === key
  ));
  return record ? record.v : undefined;
}

function walkAst(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  const children = Array.isArray(node.children) ? node.children : [];
  for (const child of children) {
    walkAst(child, visit);
  }
}

function findNode(ast, predicate) {
  let found = null;
  walkAst(ast, (node) => {
    if (!found && predicate(node)) found = node;
  });
  return found;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function test_three_dependency_is_frozen_in_frontend_manifest() {
  const frontendManifest = readJson('packages/ui-model-demo-frontend/package.json');
  assert.equal(
    typeof frontendManifest?.dependencies?.three,
    'string',
    'frontend_manifest_must_declare_three_dependency',
  );
}

function test_three_dependency_is_locked_in_frontend_package_lock() {
  const frontendLockfile = readJson('packages/ui-model-demo-frontend/package-lock.json');
  assert.equal(
    frontendLockfile?.packages?.['']?.dependencies?.katex,
    '^0.16.22',
    'frontend_package_lock_must_include_existing_katex_dependency',
  );
  assert.equal(
    frontendLockfile?.packages?.['']?.dependencies?.three,
    '^0.174.0',
    'frontend_package_lock_must_include_three_dependency',
  );
  assert.equal(
    typeof frontendLockfile?.packages?.['node_modules/three']?.version,
    'string',
    'frontend_package_lock_must_materialize_three_package',
  );
}

function test_three_scene_contract_ids_are_frozen() {
  assert.equal(
    modelIds.THREE_SCENE_COMPONENT_TYPE,
    'ThreeScene',
    'three_scene_component_type_must_be_frozen',
  );
  assert.equal(
    modelIds.THREE_SCENE_APP_MODEL_ID,
    1007,
    'three_scene_app_model_id_must_be_1007',
  );
  assert.equal(
    modelIds.THREE_SCENE_CHILD_MODEL_ID,
    1008,
    'three_scene_child_model_id_must_be_1008',
  );
  assert.ok(
    modelIds.THREE_SCENE_CHILD_MODEL_ID > modelIds.THREE_SCENE_APP_MODEL_ID,
    'three_scene_child_model_id_must_follow_parent_model_id',
  );
}

function test_three_scene_actions_are_frozen() {
  assert.equal(
    modelIds.THREE_SCENE_CREATE_ENTITY_ACTION,
    'three_scene_create_entity',
    'three_scene_create_entity_action_must_be_frozen',
  );
  assert.equal(
    modelIds.THREE_SCENE_SELECT_ENTITY_ACTION,
    'three_scene_select_entity',
    'three_scene_select_entity_action_must_be_frozen',
  );
  assert.equal(
    modelIds.THREE_SCENE_UPDATE_ENTITY_ACTION,
    'three_scene_update_entity',
    'three_scene_update_entity_action_must_be_frozen',
  );
  assert.equal(
    modelIds.THREE_SCENE_DELETE_ENTITY_ACTION,
    'three_scene_delete_entity',
    'three_scene_delete_entity_action_must_be_frozen',
  );
}

function test_three_scene_authoritative_patches_and_workspace_mount_are_frozen() {
  const workspacePositivePatch = readJson('packages/worker-base/system-models/workspace_positive_models.json');
  const workspaceCatalogPatch = readJson('packages/worker-base/system-models/workspace_catalog_ui.json');
  const positiveRecords = getPatchRecords(workspacePositivePatch);
  const workspaceRecords = getPatchRecords(workspaceCatalogPatch);

  assert.ok(
    findRecord(positiveRecords, (record) => (
      record?.model_id === modelIds.THREE_SCENE_APP_MODEL_ID
      && record?.op === 'add_label'
      && record?.p === 0
      && record?.r === 0
      && record?.c === 0
      && record?.k === 'model_type'
      && record?.t === 'model.table'
    )),
    'three_scene_app_model_type_missing',
  );
  assert.ok(
    findRecord(positiveRecords, (record) => (
      record?.model_id === modelIds.THREE_SCENE_CHILD_MODEL_ID
      && record?.op === 'add_label'
      && record?.p === 0
      && record?.r === 0
      && record?.c === 0
      && record?.k === 'model_type'
      && record?.t === 'model.table'
    )),
    'three_scene_child_model_type_missing',
  );
  assert.ok(
    findRecord(positiveRecords, (record) => (
      record?.model_id === modelIds.THREE_SCENE_APP_MODEL_ID
      && record?.k === 'model_type'
      && record?.t === 'model.submt'
      && record?.v === modelIds.THREE_SCENE_CHILD_MODEL_ID
    )),
    'three_scene_app_must_mount_child_via_model_submt',
  );
  assert.ok(
    findRecord(workspaceRecords, (record) => (
      record?.model_id === -25
      && record?.k === 'model_type'
      && record?.t === 'model.submt'
      && record?.v === modelIds.THREE_SCENE_APP_MODEL_ID
    )),
    'workspace_catalog_must_mount_three_scene_app',
  );
  assert.equal(
    Boolean(findRecord(workspaceRecords, (record) => (
      record?.model_id === -25
      && record?.k === 'model_type'
      && record?.t === 'model.submt'
      && record?.v === modelIds.THREE_SCENE_CHILD_MODEL_ID
    ))),
    false,
    'workspace_catalog_must_not_mount_three_scene_child_directly',
  );
}

function test_three_scene_page_asset_and_truth_labels_are_frozen() {
  const workspacePositivePatch = readJson('packages/worker-base/system-models/workspace_positive_models.json');
  const positiveRecords = getPatchRecords(workspacePositivePatch);
  const appRecords = positiveRecords.filter((record) => record?.model_id === modelIds.THREE_SCENE_APP_MODEL_ID);

  assert.equal(getRootLabel(positiveRecords, modelIds.THREE_SCENE_APP_MODEL_ID, 'ui_authoring_version'), 'cellwise.ui.v1', 'three_scene_app_must_define_cellwise_authoring');
  assert.equal(getRootLabel(positiveRecords, modelIds.THREE_SCENE_APP_MODEL_ID, 'ui_root_node_id'), 'three_scene_app_root', 'three_scene_app_root_id_must_be_stable');
  assert.equal(getPageAsset(positiveRecords, modelIds.THREE_SCENE_APP_MODEL_ID), null, 'three_scene_app_must_not_keep_page_asset_v0_source');

  const hostNodeProps = findRecord(appRecords, (record) => record?.k === 'ui_props_json' && record?.v?.actions?.create === modelIds.THREE_SCENE_CREATE_ENTITY_ACTION)?.v;
  assert.ok(hostNodeProps, 'three_scene_host_props_missing');
  assert.deepEqual(
    hostNodeProps.sceneGraphRef,
    { model_id: modelIds.THREE_SCENE_CHILD_MODEL_ID, p: 0, r: 0, c: 0, k: 'scene_graph_v0' },
    'three_scene_host_must_bind_scene_graph_from_child_model',
  );
  assert.deepEqual(
    hostNodeProps.cameraStateRef,
    { model_id: modelIds.THREE_SCENE_CHILD_MODEL_ID, p: 0, r: 0, c: 0, k: 'camera_state_v0' },
    'three_scene_host_must_bind_camera_state_from_child_model',
  );
  assert.equal(hostNodeProps.actions?.create, modelIds.THREE_SCENE_CREATE_ENTITY_ACTION, 'three_scene_host_must_expose_create_action');
  assert.equal(hostNodeProps.actions?.delete, modelIds.THREE_SCENE_DELETE_ENTITY_ACTION, 'three_scene_host_must_expose_delete_action');

  const createButtonBind = findRecord(appRecords, (record) => record?.k === 'ui_bind_write_json' && record?.v?.action === modelIds.THREE_SCENE_CREATE_ENTITY_ACTION)?.v;
  assert.deepEqual(
    createButtonBind?.target_ref,
    { model_id: modelIds.THREE_SCENE_CHILD_MODEL_ID, p: 0, r: 0, c: 0, k: 'scene_graph_v0' },
    'three_scene_create_button_target_ref_invalid',
  );
  assert.equal(createButtonBind?.value_ref?.t, 'json', 'three_scene_create_button_value_type_must_be_json');

  const updateButtonBind = findRecord(appRecords, (record) => record?.k === 'ui_bind_write_json' && record?.v?.action === modelIds.THREE_SCENE_UPDATE_ENTITY_ACTION)?.v;
  assert.deepEqual(
    updateButtonBind?.target_ref,
    { model_id: modelIds.THREE_SCENE_CHILD_MODEL_ID, p: 0, r: 0, c: 0, k: 'scene_graph_v0' },
    'three_scene_update_button_target_ref_invalid',
  );
  assert.deepEqual(
    updateButtonBind?.value_ref?.v?.id,
    { $label: { model_id: modelIds.THREE_SCENE_CHILD_MODEL_ID, p: 0, r: 0, c: 0, k: 'selected_entity_id' } },
    'three_scene_update_button_must_resolve_selected_entity_id_from_label',
  );

  const deleteButtonBind = findRecord(appRecords, (record) => record?.k === 'ui_bind_write_json' && record?.v?.action === modelIds.THREE_SCENE_DELETE_ENTITY_ACTION)?.v;
  assert.deepEqual(
    deleteButtonBind?.target_ref,
    { model_id: modelIds.THREE_SCENE_CHILD_MODEL_ID, p: 0, r: 0, c: 0, k: 'selected_entity_id' },
    'three_scene_delete_button_target_ref_invalid',
  );
  assert.equal(deleteButtonBind?.value_ref?.t, 'str', 'three_scene_delete_button_value_type_must_be_str');
  assert.deepEqual(
    deleteButtonBind?.value_ref?.v,
    { $label: { model_id: modelIds.THREE_SCENE_CHILD_MODEL_ID, p: 0, r: 0, c: 0, k: 'selected_entity_id' } },
    'three_scene_delete_button_must_resolve_selected_entity_id_from_label',
  );

  for (const labelKey of [
    'scene_graph_v0',
    'camera_state_v0',
    'selected_entity_id',
    'scene_status',
    'scene_audit_log',
  ]) {
    assert.ok(
      findRecord(positiveRecords, (record) => (
        record?.model_id === modelIds.THREE_SCENE_CHILD_MODEL_ID
        && record?.op === 'add_label'
        && record?.p === 0
        && record?.r === 0
        && record?.c === 0
        && record?.k === labelKey
      )),
      `three_scene_child_truth_label_missing:${labelKey}`,
    );
  }
}

function test_three_scene_dispatch_and_local_guard_are_frozen() {
  const intentDispatchPatch = readJson('packages/worker-base/system-models/intent_dispatch_config.json');
  const handlersPatch = readJson('packages/worker-base/system-models/intent_handlers_three_scene.json');
  const localAdapterSource = readText('packages/ui-model-demo-frontend/src/local_bus_adapter.js');
  const dispatchRecords = getPatchRecords(intentDispatchPatch);
  const handlerRecords = getPatchRecords(handlersPatch);

  const dispatchTableRecord = findRecord(dispatchRecords, (record) => (
    record?.model_id === -10
    && record?.op === 'add_label'
    && record?.k === 'intent_dispatch_table'
    && record?.t === 'json'
  ));
  const dispatchTable = dispatchTableRecord?.v || {};
  assert.equal(
    dispatchTable[modelIds.THREE_SCENE_CREATE_ENTITY_ACTION],
    'handle_three_scene_create_entity',
    'intent_dispatch_table_must_register_three_scene_create_entity',
  );
  assert.equal(
    dispatchTable[modelIds.THREE_SCENE_SELECT_ENTITY_ACTION],
    'handle_three_scene_select_entity',
    'intent_dispatch_table_must_register_three_scene_select_entity',
  );
  assert.equal(
    dispatchTable[modelIds.THREE_SCENE_UPDATE_ENTITY_ACTION],
    'handle_three_scene_update_entity',
    'intent_dispatch_table_must_register_three_scene_update_entity',
  );
  assert.equal(
    dispatchTable[modelIds.THREE_SCENE_DELETE_ENTITY_ACTION],
    'handle_three_scene_delete_entity',
    'intent_dispatch_table_must_register_three_scene_delete_entity',
  );

  for (const handlerName of [
    'handle_three_scene_create_entity',
    'handle_three_scene_select_entity',
    'handle_three_scene_update_entity',
    'handle_three_scene_delete_entity',
  ]) {
    assert.ok(
      findRecord(handlerRecords, (record) => (
        record?.model_id === -10
        && record?.op === 'add_label'
        && record?.k === handlerName
        && record?.t === 'func.js'
      )),
      `three_scene_handler_missing:${handlerName}`,
    );
  }

  for (const constantName of [
    'THREE_SCENE_CREATE_ENTITY_ACTION',
    'THREE_SCENE_SELECT_ENTITY_ACTION',
    'THREE_SCENE_UPDATE_ENTITY_ACTION',
    'THREE_SCENE_DELETE_ENTITY_ACTION',
  ]) {
    assert.match(
      localAdapterSource,
      new RegExp(escapeRegExp(constantName)),
      `local_adapter_must_explicitly_recognize_${constantName}`,
    );
  }
  assert.match(
    localAdapterSource,
    new RegExp(escapeRegExp('THREE_SCENE_REMOTE_ONLY_DETAIL')),
    'local_adapter_must_explain_three_scene_remote_only_boundary_via_constant',
  );
}

const tests = [
  test_three_dependency_is_frozen_in_frontend_manifest,
  test_three_dependency_is_locked_in_frontend_package_lock,
  test_three_scene_contract_ids_are_frozen,
  test_three_scene_actions_are_frozen,
  test_three_scene_authoritative_patches_and_workspace_mount_are_frozen,
  test_three_scene_page_asset_and_truth_labels_are_frozen,
  test_three_scene_dispatch_and_local_guard_are_frozen,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    test();
    console.log(`[PASS] ${test.name}`);
    passed += 1;
  } catch (err) {
    console.log(`[FAIL] ${test.name}: ${err.message}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
