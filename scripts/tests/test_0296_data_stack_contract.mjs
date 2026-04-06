#!/usr/bin/env node

import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const templatePath = path.join(repoRoot, 'packages/worker-base/system-models/templates/data_stack_v0.json');
const fixturePath = path.join(repoRoot, 'scripts/fixtures/0296_data_model_cases.json');

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
  assert.equal(result.rejected, 0, 'stack template patch should apply without rejections');
  runtime.setRuntimeMode('edit');
  runtime.setRuntimeMode('running');
  const model = runtime.getModel(2201);
  assert.ok(model, 'Data.Stack template must create model 2201');
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
  const patch = remapPatchModelId(loadJson(templatePath), 2201, modelId);
  const result = runtime.applyPatch(patch, { allowCreateModel: true, trustedBootstrap: true });
  assert.equal(result.rejected, 0, 'remapped stack template patch should apply without rejections');
  runtime.setRuntimeMode('edit');
  runtime.setRuntimeMode('running');
  const model = runtime.getModel(modelId);
  assert.ok(model, `Data.Stack template must create remapped model ${modelId}`);
  return { runtime, model };
}

function findCase(name) {
  const fixture = loadJson(fixturePath).stack[name];
  assert.ok(fixture, `missing stack fixture case ${name}`);
  return fixture;
}

async function applySteps(model, runtime, steps) {
  for (const step of steps) {
    runtime.addLabel(model, 0, 0, 0, { k: step.pin, t: 'pin.in', v: step.payload });
  }
  await settle();
}

async function test_push_pop_lifo_contract() {
  const { runtime, model } = await buildRuntimeFromTemplate();
  const fixture = findCase('push_pop_lifo');
  await applySteps(model, runtime, fixture.steps);

  assert.equal(runtime.getLabelValue(model, 0, 0, 0, 'size_now'), fixture.expected.size_now);
  assert.equal(runtime.getLabelValue(model, 0, 0, 0, 'next_index'), fixture.expected.next_index);
  assert.equal(runtime.getLabelValue(model, 0, 1, 0, 'value'), fixture.expected.rows['1']);
  assert.deepEqual(runtime.getLabelValue(model, 0, 0, 0, 'peek_data_out'), fixture.expected.peek_data_out);
  assert.deepEqual(runtime.getLabelValue(model, 0, 0, 0, 'pop_data_out'), fixture.expected.pop_data_out);
  assert.deepEqual(runtime.getLabelValue(model, 0, 0, 0, 'get_all_data_out'), fixture.expected.get_all_data_out);
  assert.deepEqual(runtime.getLabelValue(model, 0, 0, 0, 'get_size_out'), fixture.expected.get_size_out);
}

async function test_stack_template_can_materialize_to_non_2201_model_id() {
  const { runtime, model } = await buildRuntimeFromRemappedTemplate(29261);
  runtime.addLabel(model, 0, 0, 0, {
    k: 'push_data_in',
    t: 'pin.in',
    v: [
      { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.single', v: 'Data.Single' },
      { id: 0, p: 0, r: 0, c: 0, k: 'value', t: 'json', v: 'S' },
    ],
  });
  await settle();
  assert.equal(runtime.getLabelValue(model, 0, 1, 0, 'value'), 'S', 'remapped stack template must still write into remapped model');
  assert.equal(runtime.getLabelValue(model, 0, 0, 0, 'size_now'), 1, 'remapped stack template must update size_now');
}

const tests = [test_push_pop_lifo_contract, test_stack_template_can_materialize_to_non_2201_model_id];

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
