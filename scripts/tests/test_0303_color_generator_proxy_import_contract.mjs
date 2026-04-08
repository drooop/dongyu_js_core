#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import AdmZipPkg from 'adm-zip';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const AdmZip = AdmZipPkg && AdmZipPkg.default ? AdmZipPkg.default : AdmZipPkg;

const PAYLOAD_PATH = path.join(repoRoot, 'test_files', 'color_generator_proxy_app_payload.json');
const ZIP_PATH = path.join(repoRoot, 'test_files', 'color_generator_proxy_import.zip');

function readPayload() {
  return JSON.parse(fs.readFileSync(PAYLOAD_PATH, 'utf8'));
}

function findRecord(records, predicate) {
  return records.find((record) => predicate(record)) || null;
}

function test_proxy_payload_and_zip_exist() {
  assert.equal(fs.existsSync(PAYLOAD_PATH), true, 'color_generator_proxy_payload_missing');
  assert.equal(fs.existsSync(ZIP_PATH), true, 'color_generator_proxy_zip_missing');
  const zip = new AdmZip(ZIP_PATH);
  const entries = zip.getEntries().filter((entry) => entry && !entry.isDirectory);
  assert.equal(entries.length, 1, 'proxy_zip_must_contain_exactly_one_file');
  assert.equal(entries[0].entryName, 'app_payload.json', 'proxy_zip_file_name_must_be_app_payload_json');
  return { key: 'proxy_payload_and_zip_exist', status: 'PASS' };
}

function test_proxy_payload_matches_0302_root_contract() {
  const payload = readPayload();
  assert.ok(Array.isArray(payload) && payload.length > 0, 'proxy_payload_must_be_non_empty_array');

  const root = (key) => findRecord(payload, (record) => (
    record?.id === 0 && record?.p === 0 && record?.r === 0 && record?.c === 0 && record?.k === key
  ));

  assert.equal(root('model_type')?.t, 'model.table', 'proxy_root_model_type_t_must_be_model_table');
  assert.equal(root('app_name')?.v, 'Imported Color Generator', 'proxy_root_app_name_must_be_present');
  assert.equal(root('source_worker')?.v, 'model100-proxy', 'proxy_root_source_worker_must_be_present');
  assert.equal(root('slide_capable')?.v, true, 'proxy_root_slide_capable_must_be_true');
  assert.equal(root('slide_surface_type')?.v, 'workspace.page', 'proxy_root_slide_surface_type_must_be_workspace_page');
  assert.equal(root('from_user')?.v, '@test-user:localhost', 'proxy_root_from_user_must_be_present');
  assert.equal(root('to_user')?.v, '@drop:localhost', 'proxy_root_to_user_must_be_present');
  assert.equal(root('ui_authoring_version')?.v, 'cellwise.ui.v1', 'proxy_root_ui_authoring_version_must_match_0302');
  assert.equal(root('ui_root_node_id')?.v, 'color_proxy_root', 'proxy_root_node_id_must_be_present');
  return { key: 'proxy_payload_matches_0302_root_contract', status: 'PASS' };
}

function test_proxy_payload_binds_to_existing_model100_and_overlay_state() {
  const payload = readPayload();

  const colorBind = findRecord(payload, (record) => record?.k === 'ui_bind_json' && record?.v?.read?.k === 'bg_color');
  assert.equal(colorBind?.v?.read?.model_id, 100, 'proxy_color_bind_must_read_model100_bg_color');

  const inputBind = findRecord(payload, (record) => record?.k === 'ui_bind_json' && record?.v?.write?.target_ref?.k === 'model100_input_draft');
  assert.equal(inputBind?.v?.read?.model_id, -2, 'proxy_input_bind_must_read_overlay_state');
  assert.equal(inputBind?.v?.write?.target_ref?.model_id, -2, 'proxy_input_bind_must_write_overlay_state');
  assert.equal(inputBind?.v?.write?.commit_policy, 'on_submit', 'proxy_input_bind_must_keep_submit_commit_policy');

  const submitBind = findRecord(payload, (record) => record?.k === 'ui_bind_json' && record?.v?.write?.action === 'submit');
  assert.equal(submitBind?.v?.write?.meta?.model_id, 100, 'proxy_submit_must_target_model100');
  assert.equal(
    submitBind?.v?.write?.value_ref?.v?.input_value?.$label?.model_id,
    -2,
    'proxy_submit_event_must_source_input_from_overlay_state',
  );
  assert.equal(
    submitBind?.v?.write?.value_ref?.v?.input_value?.$label?.k,
    'model100_input_draft',
    'proxy_submit_event_must_read_model100_input_draft',
  );

  const systemReadyBind = findRecord(payload, (record) => record?.k === 'ui_bind_json' && record?.v?.read?.k === 'system_ready');
  assert.equal(systemReadyBind?.v?.read?.model_id, 100, 'proxy_system_ready_bind_must_read_model100');
  const statusBind = findRecord(payload, (record) => record?.k === 'ui_bind_json' && record?.v?.read?.k === 'status');
  assert.equal(statusBind?.v?.read?.model_id, 100, 'proxy_status_bind_must_read_model100');
  return { key: 'proxy_payload_binds_to_existing_model100_and_overlay_state', status: 'PASS' };
}

const tests = [
  test_proxy_payload_and_zip_exist,
  test_proxy_payload_matches_0302_root_contract,
  test_proxy_payload_binds_to_existing_model100_and_overlay_state,
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
