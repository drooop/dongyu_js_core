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

function remapPatchModelId(patch, fromId, toId) {
  const cloned = JSON.parse(JSON.stringify(patch));
  for (const record of cloned.records || []) {
    if (record && record.model_id === fromId) record.model_id = toId;
  }
  return cloned;
}

async function buildRuntimeFromRemappedTemplate(modelId) {
  const runtime = new ModelTableRuntime();
  const patch = remapPatchModelId(loadJson(templatePath), 2001, modelId);
  const result = runtime.applyPatch(patch, { allowCreateModel: true, trustedBootstrap: true });
  assert.equal(result.rejected, 0, 'remapped template patch should apply without rejections');
  runtime.setRuntimeMode('edit');
  runtime.setRuntimeMode('running');
  const model = runtime.getModel(modelId);
  assert.ok(model, `Data.Array remapped template must create model ${modelId}`);
  return { runtime, model };
}

async function applySteps(model, runtime, steps) {
  for (const step of steps) {
    runtime.addLabel(model, 0, 0, 0, { k: step.pin, t: 'pin.in', v: step.payload });
  }
  await settle();
}

function findCase(name) {
  const fixture = loadJson(fixturePath).cases.find((item) => item.name === name);
  assert.ok(fixture, `missing fixture case ${name}`);
  return fixture;
}

async function test_add_get_size_and_get_all_contract() {
  const { runtime, model } = await buildRuntimeFromTemplate();
  const fixture = findCase('add_two_items_and_read_size_and_all');

  await applySteps(model, runtime, fixture.steps);

  assert.equal(runtime.getLabelValue(model, 0, 0, 0, 'size_now'), fixture.expected.size_now);
  assert.equal(runtime.getLabelValue(model, 0, 0, 0, 'next_index'), fixture.expected.next_index);
  assert.equal(runtime.getLabelValue(model, 0, 1, 0, 'value'), fixture.expected.rows['1']);
  assert.equal(runtime.getLabelValue(model, 0, 2, 0, 'value'), fixture.expected.rows['2']);
  assert.deepEqual(runtime.getLabelValue(model, 0, 0, 0, 'get_size_out'), fixture.expected.get_size_out);
  assert.deepEqual(runtime.getLabelValue(model, 0, 0, 0, 'get_all_data_out'), fixture.expected.get_all_data_out);
}

async function test_get_by_index_and_delete_compacts_array() {
  const { runtime, model } = await buildRuntimeFromTemplate();
  const fixture = findCase('get_by_index_and_delete_with_compact');

  await applySteps(model, runtime, fixture.steps);

  assert.deepEqual(runtime.getLabelValue(model, 0, 0, 0, 'get_data_out'), fixture.expected.get_data_out);
  assert.equal(runtime.getLabelValue(model, 0, 0, 0, 'size_now'), fixture.expected.size_now, 'delete must decrement size');
  assert.equal(runtime.getLabelValue(model, 0, 0, 0, 'next_index'), fixture.expected.next_index, 'delete must compact and reset next_index');
  assert.equal(runtime.getLabelValue(model, 0, 1, 0, 'value'), fixture.expected.rows['1'], 'delete must compact following values');
  assert.equal(runtime.getLabelValue(model, 0, 2, 0, 'value'), fixture.expected.rows['2'], 'delete must compact following values');
  assert.equal(runtime.getLabelValue(model, 0, 3, 0, 'value'), undefined, 'delete must not leave tail value behind');
}

async function test_add_missing_value_field_raises_error() {
  const { runtime, model } = await buildRuntimeFromTemplate();
  const fixture = findCase('add_missing_value_field');
  await applySteps(model, runtime, fixture.steps);
  const err = runtime.getLabelValue(model, 0, 0, 0, fixture.expected_error.label);
  assert.ok(err && typeof err.error === 'string', 'add invalid payload must surface error label');
  assert.match(err.error, new RegExp(fixture.expected_error.contains));
}

async function test_delete_index_zero_raises_error() {
  const { runtime, model } = await buildRuntimeFromTemplate();
  const fixture = findCase('delete_index_zero_invalid');
  await applySteps(model, runtime, fixture.steps);
  const err = runtime.getLabelValue(model, 0, 0, 0, fixture.expected_error.label);
  assert.ok(err && typeof err.error === 'string', 'delete index=0 must surface error label');
  assert.match(err.error, new RegExp(fixture.expected_error.contains));
}

async function test_delete_out_of_range_raises_error() {
  const { runtime, model } = await buildRuntimeFromTemplate();
  const fixture = findCase('delete_out_of_range');
  await applySteps(model, runtime, fixture.steps);
  const err = runtime.getLabelValue(model, 0, 0, 0, fixture.expected_error.label);
  assert.ok(err && typeof err.error === 'string', 'delete out of range must surface error label');
  assert.match(err.error, new RegExp(fixture.expected_error.contains));
}

async function test_delete_on_empty_array_raises_error() {
  const { runtime, model } = await buildRuntimeFromTemplate();
  const fixture = findCase('delete_on_empty_array');
  await applySteps(model, runtime, fixture.steps);
  const err = runtime.getLabelValue(model, 0, 0, 0, fixture.expected_error.label);
  assert.ok(err && typeof err.error === 'string', 'delete empty array must surface error label');
  assert.match(err.error, new RegExp(fixture.expected_error.contains));
}

async function test_get_out_of_range_returns_not_found() {
  const { runtime, model } = await buildRuntimeFromTemplate();
  const fixture = findCase('get_out_of_range_returns_not_found');
  await applySteps(model, runtime, fixture.steps);
  assert.deepEqual(runtime.getLabelValue(model, 0, 0, 0, 'get_data_out'), fixture.expected.get_data_out);
}

async function test_get_all_requires_null_payload() {
  const { runtime, model } = await buildRuntimeFromTemplate();
  const fixture = findCase('get_all_requires_null_payload');
  await applySteps(model, runtime, fixture.steps);
  const err = runtime.getLabelValue(model, 0, 0, 0, fixture.expected_error.label);
  assert.ok(err && typeof err.error === 'string', 'get_all payload must surface error label');
  assert.match(err.error, new RegExp(fixture.expected_error.contains));
}

async function test_template_can_materialize_to_non_2001_model_id() {
  const { runtime, model } = await buildRuntimeFromRemappedTemplate(29061);
  runtime.addLabel(model, 0, 0, 0, {
    k: 'add_data_in',
    t: 'pin.in',
    v: [
      { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.single', v: 'Data.Single' },
      { id: 0, p: 0, r: 0, c: 0, k: 'value', t: 'json', v: 'X' },
    ],
  });
  await settle();
  assert.equal(runtime.getLabelValue(model, 0, 1, 0, 'value'), 'X', 'remapped template must still write into remapped model');
  assert.equal(runtime.getLabelValue(model, 0, 0, 0, 'size_now'), 1, 'remapped template must update size_now on remapped model');
}

const tests = [
  test_add_get_size_and_get_all_contract,
  test_get_by_index_and_delete_compacts_array,
  test_add_missing_value_field_raises_error,
  test_delete_index_zero_raises_error,
  test_delete_out_of_range_raises_error,
  test_delete_on_empty_array_raises_error,
  test_get_out_of_range_returns_not_found,
  test_get_all_requires_null_payload,
  test_template_can_materialize_to_non_2001_model_id,
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
