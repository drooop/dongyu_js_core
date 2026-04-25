#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const serverText = fs.readFileSync(path.join(repoRoot, 'packages/ui-model-demo-server/server.mjs'), 'utf8');
const guidePath = path.join(repoRoot, 'docs/user-guide/slide_upload_auth_and_cache_contract_v1.md');
const readmePath = path.join(repoRoot, 'docs/user-guide/README.md');
const mainlinePath = path.join(repoRoot, 'docs/user-guide/slide_ui_mainline_guide.md');
const deliveryGuidePath = path.join(repoRoot, 'docs/user-guide/slide_matrix_delivery_v1.md');

function getUploadSection() {
  const start = serverText.indexOf('async function handleMediaUploadRequest(');
  const end = serverText.indexOf('function readPathEnv(', start);
  assert(start >= 0, 'upload_handler_start_not_found');
  assert(end > start, 'upload_handler_end_not_found');
  return serverText.slice(start, end);
}

function test_upload_route_must_guard_auth_before_runtime_fallback() {
  const section = getUploadSection();
  const authGuardIndex = section.indexOf("if (AUTH_ENABLED && !isAuthenticated(req)) {");
  const sessionIndex = section.indexOf('const session = getSessionWithToken(req);');
  const fallbackIndex = section.indexOf(': (!AUTH_ENABLED');
  assert(authGuardIndex >= 0, 'upload_route_missing_not_authenticated_guard');
  assert(sessionIndex > authGuardIndex, 'upload_route_must_check_auth_before_reading_session');
  assert(fallbackIndex > sessionIndex, 'upload_route_runtime_fallback_must_only_exist_after_auth_guard');
  assert.match(section, /error:\s*'not_authenticated'/, 'upload_route_must_emit_not_authenticated');
  assert.match(section, /error:\s*'matrix_session_missing'/, 'upload_route_must_emit_matrix_session_missing');
  return { key: 'upload_route_must_guard_auth_before_runtime_fallback', status: 'PASS' };
}

function test_slide_upload_contract_doc_and_entry_links_exist() {
  assert.ok(fs.existsSync(guidePath), 'slide_upload_auth_and_cache_contract_doc_missing');
  const guideText = fs.readFileSync(guidePath, 'utf8');
  const readmeText = fs.readFileSync(readmePath, 'utf8');
  const mainlineText = fs.readFileSync(mainlinePath, 'utf8');
  const deliveryText = fs.readFileSync(deliveryGuidePath, 'utf8');
  assert.match(guideText, /如果开启了鉴权/, 'contract_doc_must_describe_auth_enabled_mode');
  assert.match(guideText, /如果没有开启鉴权/, 'contract_doc_must_describe_auth_disabled_mode');
  assert.match(guideText, /not_authenticated/, 'contract_doc_must_include_not_authenticated');
  assert.match(guideText, /matrix_session_missing/, 'contract_doc_must_include_matrix_session_missing');
  assert.match(readmeText, /slide_upload_auth_and_cache_contract_v1\.md/, 'user_guide_readme_must_link_contract_doc');
  assert.match(mainlineText, /slide_upload_auth_and_cache_contract_v1\.md/, 'mainline_guide_must_link_contract_doc');
  assert.match(deliveryText, /slide_upload_auth_and_cache_contract_v1\.md/, 'delivery_guide_must_link_contract_doc');
  return { key: 'slide_upload_contract_doc_and_entry_links_exist', status: 'PASS' };
}

const tests = [
  test_upload_route_must_guard_auth_before_runtime_fallback,
  test_slide_upload_contract_doc_and_entry_links_exist,
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
