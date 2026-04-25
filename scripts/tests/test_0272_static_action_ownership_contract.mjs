#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const text = fs.readFileSync(path.join(repoRoot, 'packages/worker-base/system-models/intent_handlers_static.json'), 'utf8');

function test_static_handlers_must_not_depend_on_minus2_state() {
  assert.doesNotMatch(text, /ctx\.getState\('static_(project_name|upload_kind|media_uri|media_name|status|projects_json)'/, 'static_handlers_must_not_read_truth_via_minus2_state_api');
  assert.doesNotMatch(text, /model_id:\s*-2,\s*p:\s*0,\s*r:\s*0,\s*c:\s*0,\s*k:\s*'static_(project_name|upload_kind|media_uri|media_name|status|projects_json)'/, 'static_handlers_must_not_write_truth_back_to_minus2');
  assert.match(text, /meta\.model_id|source_model_id|target_model_id|payload\.target/, 'static_handlers_must_use_explicit_positive_target_model');
  return { key: 'static_handlers_must_not_depend_on_minus2_state', status: 'PASS' };
}

const tests = [test_static_handlers_must_not_depend_on_minus2_state];
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
