#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const legacyTemplatePath = path.join(repoRoot, 'packages/worker-base/system-models/templates/data_array_v0.json');

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function test_legacy_data_array_contract_is_not_a_current_runtime_contract() {
  const patch = loadJson(legacyTemplatePath);
  assert.match(String(patch.status || ''), /superseded/, 'legacy Data.Array contract must be superseded');
  assert.deepEqual(patch.records, [], 'legacy Data.Array contract must not apply runnable records');
  const source = JSON.stringify(patch);
  for (const forbidden of ['Data.Array"', 'add_data_in', 'get_data_out', 'next_index', 'Data.ArrayResult']) {
    assert.equal(source.includes(forbidden), false, `legacy contract must not preserve ${forbidden}`);
  }
}

const tests = [test_legacy_data_array_contract_is_not_a_current_runtime_contract];

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
