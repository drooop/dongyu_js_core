#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relPath), 'utf8'));
}

function getRecords(relPath) {
  return Array.isArray(readJson(relPath)?.records) ? readJson(relPath).records : [];
}

function findRecord(records, predicate) {
  return records.find((record) => predicate(record)) || null;
}

function recordsForCell(records, cellRecord) {
  return records.filter((record) => (
    record?.model_id === cellRecord?.model_id
    && record?.p === cellRecord?.p
    && record?.r === cellRecord?.r
    && record?.c === cellRecord?.c
  ));
}

function labelValue(records, key) {
  return findRecord(records, (record) => record?.k === key)?.v;
}

function assertTemporaryPayload(records, expectedKind) {
  assert.ok(Array.isArray(records), `${expectedKind}_payload_must_be_array`);
  assert.ok(records.length > 0, `${expectedKind}_payload_must_not_be_empty`);
  assert.ok(records.every((record) => (
    record
    && Number.isInteger(record.id)
    && Number.isInteger(record.p)
    && Number.isInteger(record.r)
    && Number.isInteger(record.c)
    && typeof record.k === 'string'
    && typeof record.t === 'string'
    && Object.prototype.hasOwnProperty.call(record, 'v')
    && !Object.prototype.hasOwnProperty.call(record, 'op')
    && !Object.prototype.hasOwnProperty.call(record, 'model_id')
  )), `${expectedKind}_payload_must_be_temporary_modeltable_records`);
  assert.equal(
    records.find((record) => record.k === '__mt_payload_kind')?.v,
    expectedKind,
    `${expectedKind}_payload_kind_missing`,
  );
}

async function test_slide_capable_constants_exist() {
  const ids = await import(path.join(repoRoot, 'packages/ui-model-demo-frontend/src/model_ids.js'));
  assert.equal(ids.MODEL_100_ID, 100, 'model100_constant_missing');
  assert.equal(ids.SLIDE_IMPORTER_APP_MODEL_ID, 1030, 'slide_importer_constant_missing');
  return { key: 'slide_capable_constants_exist', status: 'PASS' };
}

function test_no_hardcoded_model100_default_preference() {
  const serverSource = fs.readFileSync(path.join(repoRoot, 'packages/ui-model-demo-server/server.mjs'), 'utf8');
  assert.ok(!serverSource.includes('let preferred = 100;'), 'server_workspace_default_must_not_be_hardcoded_to_model100');
  const localSource = fs.readFileSync(path.join(repoRoot, 'packages/ui-model-demo-frontend/src/demo_modeltable.js'), 'utf8');
  const start = localSource.indexOf('function resolveDefaultWorkspaceAppId(apps) {');
  assert.ok(start >= 0, 'local_default_workspace_function_missing');
  const end = localSource.indexOf('function resolveWorkspaceSelection(', start);
  assert.ok(end > start, 'local_default_workspace_function_end_missing');
  const fnBody = localSource.slice(start, end);
  assert.ok(!fnBody.includes('MATRIX_DEBUG_MODEL_ID'), 'local_workspace_default_must_not_prefer_non_slide_debug_app');
  return { key: 'no_hardcoded_model100_default_preference', status: 'PASS' };
}

function test_registry_sources_have_unified_slide_metadata() {
  const workspaceRecords = getRecords('packages/worker-base/system-models/workspace_positive_models.json');

  for (const [modelId, name] of [
    [100, 'Model 100'],
    [1030, 'slide importer'],
  ]) {
    assert.ok(
      findRecord(workspaceRecords, (record) => record?.model_id === modelId && record?.k === 'slide_capable' && record?.v === true),
      `${name}_must_declare_slide_capable`,
    );
    assert.ok(
      findRecord(workspaceRecords, (record) => record?.model_id === modelId && record?.k === 'slide_surface_type' && typeof record?.v === 'string' && record.v.trim()),
      `${name}_must_declare_slide_surface_type`,
    );
    assert.ok(
      findRecord(workspaceRecords, (record) => record?.model_id === modelId && record?.k === 'deletable'),
      `${name}_must_declare_deletable_state`,
    );
  }

  return { key: 'registry_sources_have_unified_slide_metadata', status: 'PASS' };
}

function test_workspace_sidebar_renders_open_and_delete_states() {
  const catalogRecords = getRecords('packages/worker-base/system-models/workspace_catalog_ui.json');

  const deleteButton = findRecord(catalogRecords, (record) => record?.k === 'ui_node_id' && record?.v === 'btn_ws_delete');
  assert.ok(deleteButton, 'workspace_sidebar_missing_delete_button');
  const openButton = findRecord(catalogRecords, (record) => record?.k === 'ui_node_id' && record?.v === 'btn_ws_select');
  assert.ok(openButton, 'workspace_sidebar_missing_open_button');
  const addButton = findRecord(catalogRecords, (record) => record?.k === 'ui_node_id' && record?.v === 'btn_ws_add');
  assert.ok(addButton, 'workspace_sidebar_missing_add_button');

  const openCell = recordsForCell(catalogRecords, openButton);
  const openBind = labelValue(openCell, 'ui_bind_json');
  assert.equal(openBind?.write?.pin, 'click', 'open_button_must_dispatch_pin_click');
  assertTemporaryPayload(openBind?.write?.value_ref, 'ws_select_app.v1');
  assert.equal(
    openBind.write.value_ref.find((record) => record.k === 'model_id')?.v?.$ref,
    'row.model_id',
    'open_button_must_target_current_row_model_id',
  );

  const deleteCell = recordsForCell(catalogRecords, deleteButton);
  const deleteBind = labelValue(deleteCell, 'ui_bind_json');
  assert.equal(deleteBind?.write?.pin, 'click', 'delete_button_must_dispatch_pin_click');
  assertTemporaryPayload(deleteBind?.write?.value_ref, 'ws_delete_app.v1');
  assert.equal(
    deleteBind.write.value_ref.find((record) => record.k === 'model_id')?.v?.$ref,
    'row.model_id',
    'delete_button_must_target_current_row_model_id',
  );

  const deleteProps = labelValue(deleteCell, 'ui_props_json');
  assert.equal(deleteProps?.disabled?.$ref, 'row.delete_disabled', 'delete_button_must_follow_row_delete_disabled');

  const addCell = recordsForCell(catalogRecords, addButton);
  const addBind = labelValue(addCell, 'ui_bind_json');
  assert.equal(addBind?.write?.pin, 'click', 'add_button_must_dispatch_pin_click');
  assertTemporaryPayload(addBind?.write?.value_ref, 'ws_add_app.v1');

  return { key: 'workspace_sidebar_renders_open_and_delete_states', status: 'PASS' };
}

function test_workspace_pin_handlers_reject_legacy_payload_shapes() {
  const catalogRecords = getRecords('packages/worker-base/system-models/workspace_catalog_ui.json');
  const handlerCodes = [
    'handle_ws_select_click',
    'handle_ws_delete_click',
    'handle_ws_add_name_change',
    'handle_ws_add_click',
  ].map((key) => labelValue(catalogRecords, key)?.code || '');

  for (const code of handlerCodes) {
    assert.match(code, /records=Array\.isArray\(label&&label\.v\)\?label\.v:\[\]/, 'handler_must_read_array_payload_only');
    assert.match(code, /temporary_modeltable_required/, 'handler_must_reject_missing_modeltable_payload');
    assert.doesNotMatch(code, /Number\.isInteger\(label&&label\.v\)/, 'handler_must_not_accept_scalar_payload');
    assert.doesNotMatch(code, /label\.v\.value/, 'handler_must_not_accept_typed_object_payload');
    assert.doesNotMatch(code, /typeof label\.v==='string'/, 'handler_must_not_accept_string_payload');
  }

  return { key: 'workspace_pin_handlers_reject_legacy_payload_shapes', status: 'PASS' };
}

const tests = [
  test_slide_capable_constants_exist,
  test_no_hardcoded_model100_default_preference,
  test_registry_sources_have_unified_slide_metadata,
  test_workspace_sidebar_renders_open_and_delete_states,
  test_workspace_pin_handlers_reject_legacy_payload_shapes,
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
