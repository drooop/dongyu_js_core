#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

function loadJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relPath), 'utf8'));
}

function getRecord(records, predicate) {
  return Array.isArray(records) ? records.find(predicate) || null : null;
}

function getFunctionCode(label) {
  if (!label) return '';
  if (typeof label.v === 'string') return label.v;
  if (label.v && typeof label.v === 'object' && typeof label.v.code === 'string') return label.v.code;
  return '';
}

const workspacePatch = loadJson('packages/worker-base/system-models/workspace_positive_models.json');
const model100Patch = loadJson('packages/worker-base/system-models/test_model_100_ui.json');
const hierarchyPatch = loadJson('packages/worker-base/system-models/runtime_hierarchy_mounts.json');

const dualBusRecord = getRecord(
  workspacePatch.records,
  (record) => record && record.model_id === 100 && record.p === 0 && record.r === 0 && record.c === 0 && record.k === 'dual_bus_model',
);
assert.ok(dualBusRecord, 'workspace_positive_models.json must define model100 dual_bus_model');

const uiEventFunc = dualBusRecord.v?.ui_event_func;
assert.equal(typeof uiEventFunc, 'string', 'model100 dual_bus_model.ui_event_func must be a string');

const runtime = new ModelTableRuntime();
runtime.applyPatch(workspacePatch, { allowCreateModel: true, trustedBootstrap: true });
runtime.applyPatch(model100Patch, { allowCreateModel: true, trustedBootstrap: true });
runtime.applyPatch(hierarchyPatch, { allowCreateModel: true, trustedBootstrap: true });

const runtimeDualBus = runtime.getCell(runtime.getModel(100), 0, 0, 0).labels.get('dual_bus_model')?.v ?? null;
assert.equal(
  runtimeDualBus?.ui_event_func,
  uiEventFunc,
  'final runtime dual_bus_model.ui_event_func must stay aligned with workspace contract after all patches apply',
);

const systemModel = runtime.getModel(-10);
assert.ok(systemModel, 'system model -10 must exist after applying model100 patch');
const prepareFnLabel = runtime.getCell(systemModel, 0, 0, 0).labels.get(uiEventFunc);
assert.ok(prepareFnLabel, `system model must define ${uiEventFunc}`);

const code = getFunctionCode(prepareFnLabel);
assert.doesNotMatch(
  code,
  /sendMatrix\s*\(/,
  'model100 submit preparation function must not direct-call sendMatrix; submit must leave local runtime via existing chain',
);

const submitOutRecord = getRecord(
  workspacePatch.records,
  (record) => record && record.model_id === 100 && record.p === 0 && record.r === 0 && record.c === 0 && record.k === 'submit' && record.t === 'pin.out',
);
assert.ok(submitOutRecord, 'model100 root must declare pin.out submit');

const model0MountRecord = getRecord(
  hierarchyPatch.records,
  (record) => record && record.model_id === 0 && record.t === 'model.submt' && record.v === 100,
);
assert.ok(model0MountRecord, 'model100 must be mounted under model0 via runtime hierarchy');

const model0EgressRecord = getRecord(
  model100Patch.records,
  (record) => record && record.model_id === 0 && record.k === 'model100_submit_out',
);
assert.ok(model0EgressRecord, 'model0 must define a local egress label for model100 submit');

const model100 = runtime.getModel(100);
assert.ok(model100, 'model100 must exist');
runtime.addLabel(model100, 0, 0, 2, {
  k: 'ui_event',
  t: 'event',
  v: { action: 'submit', input_value: 'hello local-first' },
});

const ctx = {
  runtime,
  sendMatrix: async () => ({ ok: true }),
  rmLabel: (ref) => {
    const model = runtime.getModel(ref.model_id);
    if (!model) return;
    runtime.rmLabel(model, ref.p, ref.r, ref.c, ref.k);
  },
  writeLabel: (ref, t, v) => {
    const model = runtime.getModel(ref.model_id);
    if (!model) return;
    runtime.addLabel(model, ref.p, ref.r, ref.c, { k: ref.k, t, v });
  },
  getLabel: (ref) => {
    const model = runtime.getModel(ref.model_id);
    if (!model) return null;
    return runtime.getCell(model, ref.p, ref.r, ref.c).labels.get(ref.k)?.v ?? null;
  },
};

new Function('ctx', code)(ctx);
await new Promise((resolve) => setTimeout(resolve, 50));

const model0 = runtime.getModel(0);
const egressValue = runtime.getCell(model0, 0, 0, 0).labels.get('model100_submit_out')?.v ?? null;
assert.ok(Array.isArray(egressValue), 'preparing submit must relay temporary-modeltable payload array to model0 local egress label');
assert.ok(egressValue.some((record) => record && record.k === 'input_value' && record.v === 'hello local-first'), 'model0 egress payload must preserve input_value');
assert.ok(egressValue.every((record) => record && !Object.prototype.hasOwnProperty.call(record, 'action')), 'temporary-modeltable records must not carry action');

console.log('PASS test_0182_model100_submit_chain_contract');
