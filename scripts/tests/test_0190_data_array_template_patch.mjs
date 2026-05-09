#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const legacyTemplatePath = path.join(repoRoot, 'packages/worker-base/system-models/templates/data_array_v0.json');
const arrayOneTemplatePath = path.join(repoRoot, 'packages/worker-base/system-models/templates/data_array_one_v1.json');

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function test_0190_data_array_template_is_superseded_tombstone() {
  const patch = loadJson(legacyTemplatePath);
  assert.match(String(patch.status || ''), /superseded/, '0190 Data.Array template must be superseded');
  assert.deepEqual(patch.records, [], '0190 Data.Array template must not remain runnable');
}

function test_0355_data_array_one_is_current_template() {
  const patch = loadJson(arrayOneTemplatePath);
  assert.equal(patch.op_id, '0355_data_array_one_v1');
  const root = patch.records.find((record) => record && record.op === 'add_label' && record.k === 'model_type');
  assert.equal(root?.t, 'model.table');
  assert.equal(root?.v, 'Data.Array.One');
}

const tests = [
  test_0190_data_array_template_is_superseded_tombstone,
  test_0355_data_array_one_is_current_template,
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
