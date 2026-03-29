#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  UI_EXAMPLE_CHILD_MODEL_ID,
  UI_EXAMPLE_PAGE_ASSET_MODEL_ID,
  UI_EXAMPLE_PARENT_MODEL_ID,
  UI_EXAMPLE_PROMOTE_CHILD_ACTION,
  UI_EXAMPLE_SCHEMA_MODEL_ID,
} from '../../packages/ui-model-demo-frontend/src/model_ids.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function readText(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function readPatch(relPath) {
  return JSON.parse(readText(relPath));
}

function getPatchRecords(patch) {
  return Array.isArray(patch?.records) ? patch.records : [];
}

function findRecord(records, predicate) {
  return records.find((record) => predicate(record)) || null;
}

function getModelRecords(records, modelId) {
  return records.filter((record) => record && record.model_id === modelId);
}

function hasSchemaSurface(records, modelId) {
  return Boolean(findRecord(records, (record) => (
    record?.model_id === modelId
    && record?.op === 'add_label'
    && record?.p === 1
    && record?.r === 0
    && record?.c === 0
    && record?.k === '_field_order'
  )));
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

const demoStoreSource = readText('packages/ui-model-demo-frontend/src/demo_modeltable.js');
const serverSource = readText('packages/ui-model-demo-server/server.mjs');
const localAdapterSource = readText('packages/ui-model-demo-frontend/src/local_bus_adapter.js');
const workspacePositivePatch = readPatch('packages/worker-base/system-models/workspace_positive_models.json');
const workspaceCatalogPatch = readPatch('packages/worker-base/system-models/workspace_catalog_ui.json');
const intentDispatchPatch = readPatch('packages/worker-base/system-models/intent_dispatch_config.json');
const intentHandlersExamplesPatch = readPatch('packages/worker-base/system-models/intent_handlers_ui_examples.json');

function test_workspace_seed_authority_and_legacy_boundary_are_explicit() {
  assert.match(
    demoStoreSource,
    /workspace_positive_models\.json/,
    'local_demo_must_bootstrap_workspace_positive_models_json',
  );
  assert.match(
    serverSource,
    /workspace_positive_models\.json/,
    'server_seed_must_bootstrap_workspace_positive_models_json',
  );
  assert.doesNotMatch(
    demoStoreSource,
    /workspace_demo_apps\.json/,
    'local_demo_must_not_consume_workspace_demo_apps_json',
  );
  assert.doesNotMatch(
    serverSource,
    /workspace_demo_apps\.json/,
    'server_seed_must_not_consume_workspace_demo_apps_json',
  );
}

function test_canonical_examples_exist_on_authoritative_surfaces() {
  const positiveRecords = getPatchRecords(workspacePositivePatch);
  const workspaceRecords = getPatchRecords(workspaceCatalogPatch);

  for (const modelId of [
    UI_EXAMPLE_SCHEMA_MODEL_ID,
    UI_EXAMPLE_PAGE_ASSET_MODEL_ID,
    UI_EXAMPLE_PARENT_MODEL_ID,
    UI_EXAMPLE_CHILD_MODEL_ID,
  ]) {
    assert.ok(
      findRecord(positiveRecords, (record) => (
        record?.model_id === modelId
        && record?.op === 'add_label'
        && record?.p === 0
        && record?.r === 0
        && record?.c === 0
        && record?.k === 'model_type'
        && record?.t === 'model.table'
      )),
      `model_${modelId}_root_model_type_missing`,
    );
  }

  assert.equal(
    hasSchemaSurface(positiveRecords, UI_EXAMPLE_SCHEMA_MODEL_ID),
    true,
    'schema_example_must_define_schema_surface',
  );
  assert.equal(
    getPageAsset(positiveRecords, UI_EXAMPLE_SCHEMA_MODEL_ID),
    null,
    'schema_example_must_not_define_page_asset_v0',
  );

  assert.ok(
    getRootLabel(positiveRecords, UI_EXAMPLE_PAGE_ASSET_MODEL_ID, 'ui_authoring_version') === 'cellwise.ui.v1',
    'page_asset_example_must_define_cellwise_authoring_root',
  );
  assert.equal(
    hasSchemaSurface(positiveRecords, UI_EXAMPLE_PAGE_ASSET_MODEL_ID),
    false,
    'page_asset_example_must_not_fall_back_to_schema_surface',
  );
  assert.equal(
    getPageAsset(positiveRecords, UI_EXAMPLE_PAGE_ASSET_MODEL_ID),
    null,
    'page_asset_example_must_not_keep_page_asset_v0_source',
  );

  assert.ok(
    getRootLabel(positiveRecords, UI_EXAMPLE_PARENT_MODEL_ID, 'ui_authoring_version') === 'cellwise.ui.v1',
    'parent_example_must_define_cellwise_authoring_root',
  );
  assert.ok(
    getRootLabel(positiveRecords, UI_EXAMPLE_CHILD_MODEL_ID, 'ui_authoring_version') === 'cellwise.ui.v1',
    'child_example_must_define_child_cellwise_authoring_root',
  );
  assert.equal(
    getPageAsset(positiveRecords, UI_EXAMPLE_PARENT_MODEL_ID),
    null,
    'parent_example_must_not_keep_parent_page_asset_v0_source',
  );
  assert.equal(
    getPageAsset(positiveRecords, UI_EXAMPLE_CHILD_MODEL_ID),
    null,
    'child_example_must_not_keep_child_page_asset_v0_source',
  );
  assert.equal(
    hasSchemaSurface(positiveRecords, UI_EXAMPLE_CHILD_MODEL_ID),
    false,
    'child_example_must_not_expose_workspace_schema_surface',
  );
  assert.equal(
    Boolean(findRecord(getModelRecords(positiveRecords, UI_EXAMPLE_CHILD_MODEL_ID), (record) => record?.k === 'app_name')),
    false,
    'child_example_must_not_register_workspace_app_name',
  );

  for (const modelId of [
    UI_EXAMPLE_SCHEMA_MODEL_ID,
    UI_EXAMPLE_PAGE_ASSET_MODEL_ID,
    UI_EXAMPLE_PARENT_MODEL_ID,
  ]) {
    assert.ok(
      findRecord(workspaceRecords, (record) => (
        record?.model_id === -25
        && record?.k === 'model_type'
        && record?.t === 'model.submt'
        && record?.v === modelId
      )),
      `workspace_catalog_must_mount_model_${modelId}`,
    );
  }
  assert.equal(
    Boolean(findRecord(workspaceRecords, (record) => (
      record?.model_id === -25
      && record?.k === 'model_type'
      && record?.t === 'model.submt'
      && record?.v === UI_EXAMPLE_CHILD_MODEL_ID
    ))),
    false,
    'workspace_catalog_must_not_mount_child_example_directly',
  );

  assert.ok(
    findRecord(positiveRecords, (record) => (
      record?.model_id === UI_EXAMPLE_PARENT_MODEL_ID
      && record?.k === 'model_type'
      && record?.t === 'model.submt'
      && record?.v === UI_EXAMPLE_CHILD_MODEL_ID
    )),
    'parent_example_must_explicitly_mount_child_via_model_submt',
  );
}

function test_page_asset_and_parent_mounted_patterns_use_expected_components() {
  const positiveRecords = getPatchRecords(workspacePositivePatch);
  const pageAssetModelRecords = getModelRecords(positiveRecords, UI_EXAMPLE_PAGE_ASSET_MODEL_ID);
  const parentModelRecords = getModelRecords(positiveRecords, UI_EXAMPLE_PARENT_MODEL_ID);
  const childModelRecords = getModelRecords(positiveRecords, UI_EXAMPLE_CHILD_MODEL_ID);

  assert.equal(
    getRootLabel(pageAssetModelRecords, UI_EXAMPLE_PAGE_ASSET_MODEL_ID, 'ui_root_node_id'),
    'ui_examples_asset_root',
    'page_asset_example_root_id_must_be_stable',
  );
  assert.ok(
    findRecord(pageAssetModelRecords, (record) => record?.k === 'ui_node_id' && record?.v === 'ui_examples_asset_status'),
    'page_asset_example_must_include_status_badge_node',
  );
  assert.ok(
    findRecord(pageAssetModelRecords, (record) => record?.k === 'ui_node_id' && record?.v === 'ui_examples_asset_stat_cards'),
    'page_asset_example_must_include_stat_card_row_node',
  );
  assert.ok(
    findRecord(pageAssetModelRecords, (record) => record?.k === 'ui_node_id' && record?.v === 'ui_examples_asset_log_terminal'),
    'page_asset_example_must_include_terminal_node',
  );

  assert.equal(
    getRootLabel(parentModelRecords, UI_EXAMPLE_PARENT_MODEL_ID, 'ui_root_node_id'),
    'ui_examples_parent_root',
    'parent_example_root_id_must_be_stable',
  );
  assert.equal(
    Boolean(findRecord(parentModelRecords, (record) => record?.k === 'ui_node_id' && record?.v === 'ui_examples_parent_include_child')),
    false,
    'parent_example_must_not_keep_include_child_node',
  );
  assert.ok(
    findRecord(parentModelRecords, (record) => record?.k === 'ui_node_id' && record?.v === 'ui_examples_parent_child_card'),
    'parent_example_must_inline_child_projection',
  );
  assert.ok(
    findRecord(parentModelRecords, (record) => record?.k === 'ui_node_id' && record?.v === 'ui_examples_parent_promote_button'),
    'parent_example_must_expose_formal_promote_action_button',
  );

  assert.equal(
    getRootLabel(childModelRecords, UI_EXAMPLE_CHILD_MODEL_ID, 'ui_root_node_id'),
    'ui_examples_child_root',
    'child_example_root_id_must_be_stable',
  );
  assert.ok(
    findRecord(childModelRecords, (record) => record?.k === 'ui_node_id' && record?.v === 'ui_examples_child_stage_badge'),
    'child_example_must_include_status_badge_node',
  );
  assert.ok(
    findRecord(childModelRecords, (record) => record?.k === 'ui_node_id' && record?.v === 'ui_examples_child_log_terminal'),
    'child_example_must_include_terminal_node',
  );
}

function test_formal_data_path_contract_is_registered() {
  const dispatchRecord = findRecord(getPatchRecords(intentDispatchPatch), (record) => (
    record?.model_id === -10
    && record?.k === 'intent_dispatch_table'
    && record?.t === 'json'
  ));
  const dispatchTable = dispatchRecord?.v && typeof dispatchRecord.v === 'object' ? dispatchRecord.v : {};
  assert.equal(
    dispatchTable[UI_EXAMPLE_PROMOTE_CHILD_ACTION],
    'handle_ui_examples_promote_child_stage',
    'intent_dispatch_table_must_register_ui_examples_promote_child_stage',
  );
  assert.ok(
    findRecord(getPatchRecords(intentHandlersExamplesPatch), (record) => (
      record?.model_id === -10
      && record?.k === 'handle_ui_examples_promote_child_stage'
      && record?.t === 'func.js'
    )),
    'intent_handlers_ui_examples_must_define_promote_handler',
  );
  assert.match(
    localAdapterSource,
    /UI_EXAMPLE_PROMOTE_CHILD_ACTION/,
    'local_adapter_must_explicitly_recognize_ui_examples_promote_child_stage',
  );
  assert.match(
    localAdapterSource,
    /ui_examples_remote_only/,
    'local_adapter_must_fail_ui_examples_action_with_explicit_unsupported_detail',
  );
}

const tests = [
  test_workspace_seed_authority_and_legacy_boundary_are_explicit,
  test_canonical_examples_exist_on_authoritative_surfaces,
  test_page_asset_and_parent_mounted_patterns_use_expected_components,
  test_formal_data_path_contract_is_registered,
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
