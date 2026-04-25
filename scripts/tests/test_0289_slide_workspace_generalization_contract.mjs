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

  const deleteBind = findRecord(catalogRecords, (record) => (
    record?.p === deleteButton.p
    && record?.r === deleteButton.r
    && record?.c === deleteButton.c
    && record?.k === 'ui_bind_json'
  ));
  assert.equal(deleteBind?.v?.write?.action, 'ws_app_delete', 'delete_button_must_dispatch_ws_app_delete');
  assert.equal(deleteBind?.v?.write?.value_ref?.v?.$ref, 'row.model_id', 'delete_button_must_target_current_row_model_id');

  const deleteProps = findRecord(catalogRecords, (record) => (
    record?.p === deleteButton.p
    && record?.r === deleteButton.r
    && record?.c === deleteButton.c
    && record?.k === 'ui_props_json'
  ));
  assert.equal(deleteProps?.v?.disabled?.$ref, 'row.delete_disabled', 'delete_button_must_follow_row_delete_disabled');

  return { key: 'workspace_sidebar_renders_open_and_delete_states', status: 'PASS' };
}

const tests = [
  test_slide_capable_constants_exist,
  test_no_hardcoded_model100_default_preference,
  test_registry_sources_have_unified_slide_metadata,
  test_workspace_sidebar_renders_open_and_delete_states,
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
