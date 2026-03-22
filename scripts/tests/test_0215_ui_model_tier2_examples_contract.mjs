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
    getPageAsset(positiveRecords, UI_EXAMPLE_PAGE_ASSET_MODEL_ID),
    'page_asset_example_must_define_page_asset_v0',
  );
  assert.equal(
    hasSchemaSurface(positiveRecords, UI_EXAMPLE_PAGE_ASSET_MODEL_ID),
    false,
    'page_asset_example_must_not_fall_back_to_schema_surface',
  );

  assert.ok(
    getPageAsset(positiveRecords, UI_EXAMPLE_PARENT_MODEL_ID),
    'parent_example_must_define_parent_page_asset_v0',
  );
  assert.ok(
    getPageAsset(positiveRecords, UI_EXAMPLE_CHILD_MODEL_ID),
    'child_example_must_define_child_page_asset_v0',
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
  const pageAssetAst = getPageAsset(positiveRecords, UI_EXAMPLE_PAGE_ASSET_MODEL_ID);
  const parentAssetAst = getPageAsset(positiveRecords, UI_EXAMPLE_PARENT_MODEL_ID);
  const childAssetAst = getPageAsset(positiveRecords, UI_EXAMPLE_CHILD_MODEL_ID);

  assert.equal(pageAssetAst?.id, 'ui_examples_asset_root', 'page_asset_example_root_id_must_be_stable');
  assert.equal(
    findNode(pageAssetAst, (node) => node?.id === 'ui_examples_asset_status' && node?.type === 'StatusBadge')?.type,
    'StatusBadge',
    'page_asset_example_must_include_status_badge',
  );
  assert.equal(
    findNode(pageAssetAst, (node) => node?.id === 'ui_examples_asset_stat_cards' && node?.type === 'Container')?.type,
    'Container',
    'page_asset_example_must_include_stat_card_row',
  );
  assert.equal(
    findNode(pageAssetAst, (node) => node?.id === 'ui_examples_asset_log_terminal' && node?.type === 'Terminal')?.type,
    'Terminal',
    'page_asset_example_must_include_terminal_log',
  );

  assert.equal(parentAssetAst?.id, 'ui_examples_parent_root', 'parent_example_root_id_must_be_stable');
  const includeNode = findNode(parentAssetAst, (node) => node?.id === 'ui_examples_parent_include_child');
  assert.equal(includeNode?.type, 'Include', 'parent_example_must_include_child_asset');
  assert.deepEqual(
    includeNode?.props?.ref,
    { model_id: UI_EXAMPLE_CHILD_MODEL_ID, p: 0, r: 1, c: 0, k: 'page_asset_v0' },
    'parent_example_include_must_point_to_child_page_asset_v0',
  );
  assert.equal(
    findNode(parentAssetAst, (node) => (
      node?.id === 'ui_examples_parent_promote_button'
      && node?.bind?.write?.action === UI_EXAMPLE_PROMOTE_CHILD_ACTION
    ))?.type,
    'Button',
    'parent_example_must_expose_formal_promote_action_button',
  );

  assert.equal(childAssetAst?.id, 'ui_examples_child_root', 'child_example_root_id_must_be_stable');
  assert.equal(
    findNode(childAssetAst, (node) => node?.id === 'ui_examples_child_stage_badge' && node?.type === 'StatusBadge')?.type,
    'StatusBadge',
    'child_example_must_include_status_badge',
  );
  assert.equal(
    findNode(childAssetAst, (node) => node?.id === 'ui_examples_child_log_terminal' && node?.type === 'Terminal')?.type,
    'Terminal',
    'child_example_must_include_terminal',
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
