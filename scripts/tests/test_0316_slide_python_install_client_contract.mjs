#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const scriptPath = path.join(repoRoot, 'scripts/examples/slide_app_install_client.py');
const docPath = path.join(repoRoot, 'docs/user-guide/slide_python_install_client_v1.md');

function test_slide_python_client_example_exists_and_uses_supported_chain() {
  assert.ok(fs.existsSync(scriptPath), 'slide_python_client_script_missing');
  const text = fs.readFileSync(scriptPath, 'utf8');
  assert.match(text, /\/auth\/login/, 'slide_python_client_must_support_auth_login');
  assert.match(text, /\/api\/media\/upload/, 'slide_python_client_must_upload_via_ui_server');
  assert.match(text, /\/api\/runtime\/mode/, 'slide_python_client_must_activate_runtime_when_needed');
  assert.match(text, /ui_owner_label_update/, 'slide_python_client_must_use_owner_label_update');
  assert.match(text, /slide_import_media_uri/, 'slide_python_client_must_write_import_media_uri');
  assert.match(text, /"pin": "click"|pin['"]:\s*['"]click['"]/, 'slide_python_client_must_trigger_importer_click_pin');
  assert.match(text, /1031/, 'slide_python_client_must_target_importer_truth');
  assert.match(text, /1030/, 'slide_python_client_must_target_importer_host');
  return { key: 'slide_python_client_example_exists_and_uses_supported_chain', status: 'PASS' };
}

function test_slide_python_client_doc_exists() {
  assert.ok(fs.existsSync(docPath), 'slide_python_client_doc_missing');
  const text = fs.readFileSync(docPath, 'utf8');
  assert.match(text, /\/api\/media\/upload/, 'slide_python_client_doc_must_name_upload_route');
  assert.match(text, /slide_import_media_uri/, 'slide_python_client_doc_must_name_import_uri_write');
  assert.match(text, /click pin/, 'slide_python_client_doc_must_name_click_pin');
  return { key: 'slide_python_client_doc_exists', status: 'PASS' };
}

const tests = [
  test_slide_python_client_example_exists_and_uses_supported_chain,
  test_slide_python_client_doc_exists,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    const result = test();
    console.log(`[${result.status}] ${result.key}`);
    passed += 1;
  } catch (error) {
    console.log(`[FAIL] ${test.name}: ${error.message}`);
    failed += 1;
  }
}
console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
