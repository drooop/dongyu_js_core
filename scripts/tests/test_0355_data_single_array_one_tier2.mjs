#!/usr/bin/env node

import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const arrayOneTemplatePath = path.join(repoRoot, 'packages/worker-base/system-models/templates/data_array_one_v1.json');
const legacyArrayTemplatePath = path.join(repoRoot, 'packages/worker-base/system-models/templates/data_array_v0.json');

const canonicalModelId = 2301;
const forbiddenLegacyKeys = [
  'add_data_in',
  'delete_data_in',
  'update_data_in',
  'get_data_in',
  'get_data_out',
  'get_all_data_in',
  'get_all_data_out',
  'get_size_in',
  'get_size_out',
  'next_index',
];

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function findAddLabel(records, key) {
  return records.find((record) => record && record.op === 'add_label' && record.k === key);
}

function remapPatchModelId(patch, fromId, toId) {
  const cloned = JSON.parse(JSON.stringify(patch));
  for (const record of cloned.records || []) {
    if (record && record.model_id === fromId) record.model_id = toId;
  }
  return cloned;
}

async function settle(ms = 50) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function dataSinglePayload(labels = {}) {
  const records = [
    { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.single', v: 'Data.Single' },
  ];
  for (const [k, value] of Object.entries(labels)) {
    const t = Number.isInteger(value) ? 'int' : (typeof value === 'boolean' ? 'bool' : 'str');
    records.push({ id: 0, p: 0, r: 0, c: 0, k, t, v: value });
  }
  return records;
}

function indexPayload(index) {
  return [
    { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.single', v: 'Data.Single' },
    { id: 0, p: 0, r: 0, c: 0, k: 'index', t: 'int', v: index },
  ];
}

function emptyQueryPayload() {
  return [
    { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.single', v: 'Data.Single' },
  ];
}

async function buildRuntimeFromPatch(patch, modelId) {
  const runtime = new ModelTableRuntime();
  const result = runtime.applyPatch(patch, { allowCreateModel: true, trustedBootstrap: true });
  assert.equal(result.rejected, 0, 'Data.Array.One template patch should apply without rejections');
  runtime.setRuntimeMode('edit');
  runtime.setRuntimeMode('running');
  const model = runtime.getModel(modelId);
  assert.ok(model, `Data.Array.One template must create model ${modelId}`);
  return { runtime, model };
}

async function buildRuntimeFromTemplate(modelId = canonicalModelId) {
  const patch = loadJson(arrayOneTemplatePath);
  const targetPatch = modelId === canonicalModelId ? patch : remapPatchModelId(patch, canonicalModelId, modelId);
  return buildRuntimeFromPatch(targetPatch, modelId);
}

function assertTemporaryRecords(value, message) {
  assert.ok(Array.isArray(value), `${message}: value must be a record array`);
  for (const record of value) {
    assert.equal(typeof record, 'object', `${message}: every record must be object`);
    for (const key of ['id', 'p', 'r', 'c']) {
      assert.ok(Number.isInteger(record[key]), `${message}: ${key} must be integer`);
    }
    assert.equal(typeof record.k, 'string', `${message}: k must be string`);
    assert.equal(typeof record.t, 'string', `${message}: t must be string`);
    assert.ok(Object.prototype.hasOwnProperty.call(record, 'v'), `${message}: v must exist`);
  }
}

function test_template_shape_uses_data_array_one_and_colon_pins() {
  assert.ok(fs.existsSync(arrayOneTemplatePath), `missing Data.Array.One template: ${arrayOneTemplatePath}`);
  const patch = loadJson(arrayOneTemplatePath);
  assert.equal(patch.op_id, '0355_data_array_one_v1');
  assert.ok(Array.isArray(patch.records), 'template must expose patch.records');

  const rootType = findAddLabel(patch.records, 'model_type');
  assert.ok(rootType, 'template must declare model_type');
  assert.equal(rootType.model_id, canonicalModelId);
  assert.equal(rootType.t, 'model.table');
  assert.equal(rootType.v, 'Data.Array.One');
  assert.equal(findAddLabel(patch.records, 'max_r')?.t, 'int', 'root must declare max_r metadata');

  for (const key of [
    'add_data:in',
    'delete_data:in',
    'update_data:in',
    'get_data:in',
    'get_all_data:in',
    'get_size:in',
  ]) {
    assert.equal(findAddLabel(patch.records, key)?.t, 'pin.in', `missing public input pin ${key}`);
  }
  for (const key of ['get_data:out', 'get_all_data:out', 'get_size:out']) {
    assert.equal(findAddLabel(patch.records, key)?.t, 'pin.out', `missing public output pin ${key}`);
  }
  for (const key of forbiddenLegacyKeys) {
    assert.equal(findAddLabel(patch.records, key), undefined, `template must not expose legacy key ${key}`);
  }

  const source = JSON.stringify(patch);
  assert.doesNotMatch(source, /\bctx\.(writeLabel|getLabel|rmLabel)\b/, 'new template must not use legacy ctx API');
  assert.doesNotMatch(source, /Data\.ArrayResult/, 'new template must not emit old Data.ArrayResult');
}

function test_legacy_array_template_is_not_runnable_target() {
  assert.ok(fs.existsSync(legacyArrayTemplatePath), 'legacy file should remain only as a tombstone artifact');
  const patch = loadJson(legacyArrayTemplatePath);
  assert.match(String(patch.status || ''), /superseded/, 'legacy Data.Array template must be marked superseded');
  assert.deepEqual(patch.records, [], 'legacy Data.Array template must not keep runnable records');
  const source = JSON.stringify(patch);
  assert.doesNotMatch(source, /"v":"Data\.Array"/, 'legacy tombstone must not keep Data.Array target records');
  assert.doesNotMatch(source, /add_data_in|get_data_out|next_index/, 'legacy tombstone must not keep old pin/metadata records');
}

async function test_add_get_get_all_and_size_materialize_data_single_cells() {
  const { runtime, model } = await buildRuntimeFromTemplate();

  runtime.addLabel(model, 0, 0, 0, {
    k: 'add_data:in',
    t: 'pin.in',
    v: dataSinglePayload({ title: 'alpha', count: 7 }),
  });
  runtime.addLabel(model, 0, 0, 0, {
    k: 'add_data:in',
    t: 'pin.in',
    v: dataSinglePayload({ title: 'beta', count: 9 }),
  });
  await settle();

  assert.equal(runtime.getLabelValue(model, 0, 0, 0, 'max_r'), 2);
  assert.equal(runtime.getLabelValue(model, 0, 1, 0, 'model_type'), 'Data.Single');
  assert.equal(runtime.getLabelValue(model, 0, 1, 0, 'title'), 'alpha');
  assert.equal(runtime.getLabelValue(model, 0, 1, 0, 'count'), 7);
  assert.equal(runtime.getLabelValue(model, 0, 1, 0, 'value'), undefined, 'Data.Array.One must not use value-only shortcut rows');

  runtime.addLabel(model, 0, 0, 0, { k: 'get_size:in', t: 'pin.in', v: emptyQueryPayload() });
  runtime.addLabel(model, 0, 0, 0, { k: 'get_data:in', t: 'pin.in', v: indexPayload(2) });
  runtime.addLabel(model, 0, 0, 0, { k: 'get_all_data:in', t: 'pin.in', v: emptyQueryPayload() });
  await settle();

  const sizeOut = runtime.getLabelValue(model, 0, 0, 0, 'get_size:out');
  assertTemporaryRecords(sizeOut, 'get_size:out');
  assert.equal(sizeOut.find((record) => record.k === 'size')?.v, 2);

  const getOut = runtime.getLabelValue(model, 0, 0, 0, 'get_data:out');
  assertTemporaryRecords(getOut, 'get_data:out');
  assert.equal(getOut.find((record) => record.k === 'found')?.v, true);
  assert.equal(getOut.find((record) => record.k === 'title')?.v, 'beta');
  assert.equal(getOut.find((record) => record.k === 'count')?.v, 9);

  const allOut = runtime.getLabelValue(model, 0, 0, 0, 'get_all_data:out');
  assertTemporaryRecords(allOut, 'get_all_data:out');
  assert.equal(allOut.find((record) => record.k === 'model_type')?.v, 'Data.Array.One');
  assert.equal(allOut.find((record) => record.r === 1 && record.k === 'title')?.v, 'alpha');
  assert.equal(allOut.find((record) => record.r === 2 && record.k === 'title')?.v, 'beta');
}

async function test_delete_and_update_use_generic_pins_without_legacy_aliases() {
  const { runtime, model } = await buildRuntimeFromTemplate();

  runtime.addLabel(model, 0, 0, 0, { k: 'add_data:in', t: 'pin.in', v: dataSinglePayload({ title: 'first' }) });
  runtime.addLabel(model, 0, 0, 0, { k: 'add_data:in', t: 'pin.in', v: dataSinglePayload({ title: 'second' }) });
  await settle();

  runtime.addLabel(model, 0, 0, 0, {
    k: 'update_data:in',
    t: 'pin.in',
    v: [
      ...indexPayload(2),
      { id: 0, p: 0, r: 0, c: 0, k: 'title', t: 'str', v: 'updated' },
      { id: 0, p: 0, r: 0, c: 0, k: 'flag', t: 'bool', v: true },
    ],
  });
  await settle();
  assert.equal(runtime.getLabelValue(model, 0, 2, 0, 'title'), 'updated');
  assert.equal(runtime.getLabelValue(model, 0, 2, 0, 'flag'), true);

  runtime.addLabel(model, 0, 0, 0, { k: 'delete_data:in', t: 'pin.in', v: indexPayload(1) });
  await settle();
  assert.equal(runtime.getLabelValue(model, 0, 0, 0, 'max_r'), 1);
  assert.equal(runtime.getLabelValue(model, 0, 1, 0, 'title'), 'updated', 'delete must compact following Data.Single cells');
  assert.equal(runtime.getLabelValue(model, 0, 2, 0, 'title'), undefined, 'delete must clear compacted tail cell');

  runtime.addLabel(model, 0, 0, 0, { k: 'add_data_in', t: 'pin.in', v: dataSinglePayload({ title: 'legacy' }) });
  await settle();
  assert.equal(runtime.getLabelValue(model, 0, 0, 0, 'max_r'), 1, 'legacy add_data_in must not materialize data');
}

async function test_malformed_payload_rejected_before_materialization() {
  const { runtime, model } = await buildRuntimeFromTemplate();

  runtime.addLabel(model, 0, 0, 0, {
    k: 'add_data:in',
    t: 'pin.in',
    v: [
      { id: 0, p: 0, r: 0, c: 0, k: 'title', t: 'str', v: 'missing Data.Single marker' },
    ],
  });
  await settle();

  assert.equal(runtime.getLabelValue(model, 0, 0, 0, 'max_r'), 0);
  assert.equal(runtime.getLabelValue(model, 0, 1, 0, 'title'), undefined);
  const err = runtime.getLabelValue(model, 0, 0, 0, '__error_array_one_add');
  assert.ok(err && String(err.error).includes('data_single_required'), 'invalid payload must surface a visible ModelTable error');
}

async function test_template_can_materialize_to_remapped_model_id() {
  const remappedModelId = 29355;
  const { runtime, model } = await buildRuntimeFromTemplate(remappedModelId);

  runtime.addLabel(model, 0, 0, 0, {
    k: 'add_data:in',
    t: 'pin.in',
    v: dataSinglePayload({ title: 'remapped' }),
  });
  await settle();

  assert.equal(runtime.getLabelValue(model, 0, 1, 0, 'model_type'), 'Data.Single');
  assert.equal(runtime.getLabelValue(model, 0, 1, 0, 'title'), 'remapped');
  assert.equal(runtime.getLabelValue(model, 0, 0, 0, 'max_r'), 1);
}

const tests = [
  test_template_shape_uses_data_array_one_and_colon_pins,
  test_legacy_array_template_is_not_runnable_target,
  test_add_get_get_all_and_size_materialize_data_single_cells,
  test_delete_and_update_use_generic_pins_without_legacy_aliases,
  test_malformed_payload_rejected_before_materialization,
  test_template_can_materialize_to_remapped_model_id,
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
