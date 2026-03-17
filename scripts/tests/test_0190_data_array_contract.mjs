#!/usr/bin/env node

import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const templatePath = path.join(repoRoot, 'packages/worker-base/system-models/templates/data_array_v0.json');
const fixturePath = path.join(repoRoot, 'scripts/fixtures/0190_data_array_cases.json');

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function settle(ms = 20) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function buildRuntimeFromTemplate() {
  const runtime = new ModelTableRuntime();
  const patch = loadJson(templatePath);
  const result = runtime.applyPatch(patch, { allowCreateModel: true, trustedBootstrap: true });
  assert.equal(result.rejected, 0, 'template patch should apply without rejections');
  runtime.setRuntimeMode('edit');
  runtime.setRuntimeMode('running');
  const model = runtime.getModel(2001);
  assert.ok(model, 'Data.Array template must create model 2001');
  return { runtime, model };
}

async function test_add_get_size_and_get_all_contract() {
  const { runtime, model } = await buildRuntimeFromTemplate();
  const fixture = loadJson(fixturePath).cases.find((item) => item.name === 'add_two_items_and_read_size_and_all');
  assert.ok(fixture, 'missing fixture case add_two_items_and_read_size_and_all');

  for (const step of fixture.steps) {
    runtime.addLabel(model, 0, 0, 0, { k: step.pin, t: 'pin.in', v: step.payload });
  }
  await settle();

  assert.equal(runtime.getLabelValue(model, 0, 0, 0, 'size_now'), fixture.expected.size_now);
  assert.equal(runtime.getLabelValue(model, 0, 0, 0, 'next_index'), fixture.expected.next_index);
  assert.equal(runtime.getLabelValue(model, 0, 1, 0, 'value'), fixture.expected.rows['1']);
  assert.equal(runtime.getLabelValue(model, 0, 2, 0, 'value'), fixture.expected.rows['2']);
  assert.deepEqual(runtime.getLabelValue(model, 0, 0, 0, 'get_size_out'), fixture.expected.get_size_out);
  assert.deepEqual(runtime.getLabelValue(model, 0, 0, 0, 'get_all_data_out'), fixture.expected.get_all_data_out);
}

async function test_get_by_index_and_delete_compacts_array() {
  const { runtime, model } = await buildRuntimeFromTemplate();
  const fixture = loadJson(fixturePath).cases.find((item) => item.name === 'get_by_index_and_delete_with_compact');
  assert.ok(fixture, 'missing fixture case get_by_index_and_delete_with_compact');

  for (const step of fixture.steps) {
    runtime.addLabel(model, 0, 0, 0, { k: step.pin, t: 'pin.in', v: step.payload });
  }
  await settle();

  assert.deepEqual(runtime.getLabelValue(model, 0, 0, 0, 'get_data_out'), fixture.expected.get_data_out);
  assert.equal(runtime.getLabelValue(model, 0, 0, 0, 'size_now'), fixture.expected.size_now, 'delete must decrement size');
  assert.equal(runtime.getLabelValue(model, 0, 0, 0, 'next_index'), fixture.expected.next_index, 'delete must compact and reset next_index');
  assert.equal(runtime.getLabelValue(model, 0, 1, 0, 'value'), fixture.expected.rows['1'], 'delete must compact following values');
  assert.equal(runtime.getLabelValue(model, 0, 2, 0, 'value'), fixture.expected.rows['2'], 'delete must compact following values');
  assert.equal(runtime.getLabelValue(model, 0, 3, 0, 'value'), undefined, 'delete must not leave tail value behind');
}

const tests = [
  test_add_get_size_and_get_all_contract,
  test_get_by_index_and_delete_compacts_array,
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  try {
    await test();
    console.log(`[PASS] ${test.name}`);
    passed += 1;
  } catch (err) {
    console.log(`[FAIL] ${test.name}: ${err.message}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
