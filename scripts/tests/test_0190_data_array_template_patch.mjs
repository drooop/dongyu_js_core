#!/usr/bin/env node

import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const templatePath = path.join(repoRoot, 'packages/worker-base/system-models/templates/data_array_v0.json');

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function findAddLabel(records, k) {
  return records.find((record) => record.op === 'add_label' && record.k === k);
}

function test_template_exists_and_declares_data_array_root() {
  assert.ok(fs.existsSync(templatePath), `missing canonical template: ${templatePath}`);
  const patch = loadJson(templatePath);
  assert.ok(Array.isArray(patch.records), 'template must expose patch.records');
  const rootType = findAddLabel(patch.records, 'model_type');
  assert.ok(rootType, 'template must declare model_type');
  assert.equal(rootType.model_id, 2001, 'template should target canonical Data.Array example model_id=2001');
  assert.equal(rootType.p, 0);
  assert.equal(rootType.r, 0);
  assert.equal(rootType.c, 0);
  assert.equal(rootType.t, 'model.table');
  assert.equal(rootType.v, 'Data.Array');
}

function test_template_declares_unified_pins_and_functions() {
  const patch = loadJson(templatePath);
  for (const key of ['add_data_in', 'delete_data_in', 'get_data_in', 'get_all_data_in', 'get_size_in']) {
    const label = findAddLabel(patch.records, key);
    assert.ok(label, `template must declare input pin ${key}`);
    assert.equal(label.t, 'pin.in', `${key} must be pin.in`);
  }
  for (const key of ['get_data_out', 'get_all_data_out', 'get_size_out']) {
    const label = findAddLabel(patch.records, key);
    assert.ok(label, `template must declare output pin ${key}`);
    assert.equal(label.t, 'pin.out', `${key} must be pin.out`);
  }
  for (const key of ['array_add', 'array_delete', 'array_get', 'array_get_all', 'array_get_size']) {
    const label = findAddLabel(patch.records, key);
    assert.ok(label, `template must declare function ${key}`);
    assert.equal(label.t, 'func.js', `${key} must be func.js`);
    assert.equal(typeof label.v?.code, 'string', `${key} must provide code`);
  }
  const wiring = findAddLabel(patch.records, 'array_routing');
  assert.ok(wiring, 'template must declare pin.connect.label wiring');
  assert.equal(wiring.t, 'pin.connect.label');
}

const tests = [
  test_template_exists_and_declares_data_array_root,
  test_template_declares_unified_pins_and_functions,
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
