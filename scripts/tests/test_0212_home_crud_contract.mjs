#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolve } from 'node:path';

import {
  EDITOR_STATE_MODEL_ID,
  SYSTEM_MODEL_ID,
} from '../../packages/ui-model-demo-frontend/src/model_ids.js';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const claudeSource = fs.readFileSync(resolve(repoRoot, 'CLAUDE.md'), 'utf8');
const homeCatalogPatch = JSON.parse(fs.readFileSync(resolve(repoRoot, 'packages/worker-base/system-models/home_catalog_ui.json'), 'utf8'));
const intentDispatchPatch = JSON.parse(fs.readFileSync(resolve(repoRoot, 'packages/worker-base/system-models/intent_dispatch_config.json'), 'utf8'));
const intentHandlersHomePatchPath = resolve(repoRoot, 'packages/worker-base/system-models/intent_handlers_home.json');
const intentHandlersHomePatch = fs.existsSync(intentHandlersHomePatchPath)
  ? JSON.parse(fs.readFileSync(intentHandlersHomePatchPath, 'utf8'))
  : { records: [] };
const localAdapterSource = fs.readFileSync(resolve(repoRoot, 'packages/ui-model-demo-frontend/src/local_bus_adapter.js'), 'utf8');
const serverSource = fs.readFileSync(resolve(repoRoot, 'packages/ui-model-demo-server/server.mjs'), 'utf8');

const EXPECTED_HOME_CRUD_ACTIONS = Object.freeze([
  'home_refresh',
  'home_select_row',
  'home_open_create',
  'home_open_edit',
  'home_save_label',
  'home_delete_label',
  'home_view_detail',
  'home_close_detail',
  'home_close_edit',
]);

const HOME_EXECUTION_CONTRACT = Object.freeze({
  ui_state_model_id: -2,
  hidden_helper_model_id: -10,
  page_asset_model_id: -22,
  remote_authoritative: true,
  local_mode: 'shared_dispatch_or_explicit_unsupported',
});

function getPatchRecords(patch) {
  return Array.isArray(patch?.records) ? patch.records : [];
}

function getRecord(records, predicate) {
  return records.find((record) => predicate(record)) || null;
}

function collectWriteActions(node, acc = []) {
  if (!node || typeof node !== 'object') return acc;
  const write = node.bind && typeof node.bind === 'object' ? node.bind.write : null;
  if (write && typeof write.action === 'string') {
    acc.push(write.action);
  }
  const children = Array.isArray(node.children) ? node.children : [];
  for (const child of children) {
    collectWriteActions(child, acc);
  }
  return acc;
}

function test_home_crud_action_contract_definition_is_explicit() {
  assert.deepEqual(EXPECTED_HOME_CRUD_ACTIONS, [
    'home_refresh',
    'home_select_row',
    'home_open_create',
    'home_open_edit',
    'home_save_label',
    'home_delete_label',
    'home_view_detail',
    'home_close_detail',
    'home_close_edit',
  ]);
  assert.equal(new Set(EXPECTED_HOME_CRUD_ACTIONS).size, EXPECTED_HOME_CRUD_ACTIONS.length, 'home_action_set_must_be_unique');
  assert(EXPECTED_HOME_CRUD_ACTIONS.every((action) => action.startsWith('home_')), 'home_action_set_must_use_home_prefix');
}

function test_home_model_placement_contract_is_registered() {
  assert.equal(EDITOR_STATE_MODEL_ID, HOME_EXECUTION_CONTRACT.ui_state_model_id, 'editor_state_model_id_must_stay_-2');
  assert.equal(SYSTEM_MODEL_ID, HOME_EXECUTION_CONTRACT.hidden_helper_model_id, 'system_model_id_must_stay_-10');
  assert.match(claudeSource, /Model -2\s+system capability layer: editor\/home UI state projection model\./, 'claude_model_minus_2_registry_missing');
  assert.match(claudeSource, /Model -10\s+system capability layer: infrastructure logic expressed as function labels:/, 'claude_model_minus_10_registry_missing');
  assert.match(claudeSource, /Model -22\s+system capability layer: Home page asset model\./, 'claude_model_minus_22_registry_missing');
}

function test_home_page_asset_contract_inventory_is_safe() {
  const records = getPatchRecords(homeCatalogPatch);
  const assetRecord = getRecord(records, (record) => (
    record?.model_id === HOME_EXECUTION_CONTRACT.page_asset_model_id
    && record?.p === 0
    && record?.r === 1
    && record?.c === 0
    && record?.k === 'page_asset_v0'
  ));
  assert(assetRecord, 'home_page_asset_v0_record_missing');
  assert.equal(assetRecord.v?.id, 'root_home', 'home_page_asset_root_id_must_be_root_home');

  const actions = collectWriteActions(assetRecord.v);
  for (const action of EXPECTED_HOME_CRUD_ACTIONS) {
    assert(actions.includes(action), `home_asset_must_materialize_action:${action}`);
  }
  const legacyHomeActions = actions.filter((action) => action.startsWith('datatable_'));
  assert.equal(legacyHomeActions.length, 0, 'home_asset_must_not_keep_legacy_datatable_actions');
}

function test_home_dispatch_boundary_contract_inventory_exists() {
  const dispatchRecords = getPatchRecords(intentDispatchPatch);
  const dispatchTableRecord = getRecord(dispatchRecords, (record) => (
    record?.model_id === HOME_EXECUTION_CONTRACT.hidden_helper_model_id
    && record?.k === 'intent_dispatch_table'
  ));
  assert(dispatchTableRecord, 'intent_dispatch_table_record_missing');
  assert.equal(typeof dispatchTableRecord.v, 'object', 'intent_dispatch_table_must_be_json_object');
  const dispatchTable = dispatchTableRecord.v;
  for (const action of EXPECTED_HOME_CRUD_ACTIONS) {
    assert.equal(
      typeof dispatchTable[action],
      'string',
      `intent_dispatch_table_must_register_${action}`,
    );
  }
  const homeHandlerRecords = getPatchRecords(intentHandlersHomePatch);
  for (const action of EXPECTED_HOME_CRUD_ACTIONS) {
    const funcName = dispatchTable[action];
    assert(
      getRecord(homeHandlerRecords, (record) => (
        record?.model_id === HOME_EXECUTION_CONTRACT.hidden_helper_model_id
        && record?.k === funcName
        && record?.t === 'func.js'
      )),
      `intent_handlers_home_must_define_${funcName}`,
    );
  }
  for (const action of EXPECTED_HOME_CRUD_ACTIONS) {
    assert.match(
      localAdapterSource,
      new RegExp(action),
      `local_adapter_must_explicitly_recognize_${action}`,
    );
  }
  assert.match(localAdapterSource, /direct_model_mutation_disabled/, 'local_adapter_direct_mutation_guard_missing');
  assert.match(serverSource, /finishError\('direct_model_mutation_disabled', action\)/, 'server_direct_mutation_guard_missing');
  assert.match(serverSource, /intent_dispatch_table/, 'server_intent_dispatch_lookup_missing');
}

const tests = [
  test_home_crud_action_contract_definition_is_explicit,
  test_home_model_placement_contract_is_registered,
  test_home_page_asset_contract_inventory_is_safe,
  test_home_dispatch_boundary_contract_inventory_exists,
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  try {
    test();
    console.log(`[PASS] ${test.name}`);
    passed += 1;
  } catch (error) {
    console.log(`[FAIL] ${test.name}: ${error.message}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
