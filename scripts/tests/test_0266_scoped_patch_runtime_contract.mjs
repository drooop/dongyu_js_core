#!/usr/bin/env node

import { createRequire } from 'node:module';
import assert from 'node:assert';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

function wait(ms = 50) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setRunning(rt) {
  rt.setRuntimeMode('running');
}

async function executeFunc(rt, model, code, inputValue = [{ id: 0, p: 0, r: 0, c: 0, k: 'trigger', t: 'str', v: 'go' }]) {
  rt.setRuntimeMode('edit');
  rt.applyPatch({
    version: 'mt.v0',
    records: [
      { op: 'add_label', model_id: model.id, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.table', v: 'Flow' },
      {
        op: 'add_label',
        model_id: model.id,
        p: 0,
        r: 0,
        c: 0,
        k: 'wiring',
        t: 'pin.connect.label',
        v: [{ from: '(self, cmd)', to: ['(func, op:in)'] }],
      },
      { op: 'add_label', model_id: model.id, p: 0, r: 0, c: 0, k: 'op', t: 'func.js', v: { code, modelName: 'test_0266_scoped_patch_runtime_contract' } },
    ],
  }, { trustedBootstrap: true });
  setRunning(rt);
  rt.addLabel(model, 0, 0, 0, { k: 'cmd', t: 'pin.in', v: inputValue });
  await wait(80);
}

async function test_apply_scoped_patch_accepts_same_model_records() {
  const rt = new ModelTableRuntime();
  rt.createModel({ id: 26061, name: 'scoped_target', type: 'app' });
  const result = rt.applyScopedPatch(26061, {
    version: 'mt.v0',
    records: [{ op: 'add_label', model_id: 26061, p: 1, r: 0, c: 0, k: 'ok', t: 'str', v: 'yes' }],
  });
  assert.equal(result.applied, 1, 'same-model scoped patch must apply');
  assert.equal(result.rejected, 0, 'same-model scoped patch must not reject');
  const model = rt.getModel(26061);
  const label = rt.getCell(model, 1, 0, 0).labels.get('ok');
  assert.equal(label?.v, 'yes', 'same-model scoped patch must mutate target model');
  return { key: 'apply_scoped_patch_accepts_same_model_records', status: 'PASS' };
}

async function test_apply_scoped_patch_rejects_cross_model_records() {
  const rt = new ModelTableRuntime();
  rt.createModel({ id: 26062, name: 'source_scope', type: 'app' });
  rt.createModel({ id: 26063, name: 'other_scope', type: 'app' });
  const result = rt.applyScopedPatch(26062, {
    version: 'mt.v0',
    records: [{ op: 'add_label', model_id: 26063, p: 1, r: 0, c: 0, k: 'bad', t: 'str', v: 'no' }],
  });
  assert.equal(result.applied, 0, 'cross-model scoped patch must not apply');
  assert.equal(result.rejected, 1, 'cross-model scoped patch must reject offending record');
  const other = rt.getModel(26063);
  const label = rt.getCell(other, 1, 0, 0).labels.get('bad');
  assert.equal(label, undefined, 'cross-model scoped patch must not mutate other model');
  return { key: 'apply_scoped_patch_rejects_cross_model_records', status: 'PASS' };
}

async function test_apply_scoped_patch_rejects_create_model() {
  const rt = new ModelTableRuntime();
  rt.createModel({ id: 26064, name: 'scope_owner', type: 'app' });
  const result = rt.applyScopedPatch(26064, {
    version: 'mt.v0',
    records: [{ op: 'create_model', model_id: 26065, name: 'bad', type: 'app' }],
  });
  assert.equal(result.applied, 0, 'scoped patch must not create models');
  assert.equal(result.rejected, 1, 'scoped patch must reject create_model');
  assert.equal(rt.getModel(26065), undefined, 'scoped patch must not materialize new model');
  return { key: 'apply_scoped_patch_rejects_create_model', status: 'PASS' };
}

async function test_program_ctx_runtime_does_not_expose_apply_patch() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 26066, name: 'no_runtime_patch', type: 'app' });
  await executeFunc(rt, model, `
    if (ctx.runtime && typeof ctx.runtime.applyPatch === 'function') {
      ctx.runtime.applyPatch({
        version: 'mt.v0',
        records: [{ op: 'add_label', model_id: 26066, p: 1, r: 0, c: 0, k: 'bad', t: 'str', v: 'mutated' }],
      }, { allowCreateModel: false });
      return;
    }
    V1N.addLabel('marker', 'str', 'no_patch_surface');
  `);
  const root = rt.getCell(model, 0, 0, 0);
  const target = rt.getCell(model, 1, 0, 0).labels.get('bad');
  assert.equal(target, undefined, 'program ctx must not mutate through runtime.applyPatch');
  assert.equal(root.labels.get('marker')?.v, 'no_patch_surface', 'program ctx must observe missing applyPatch surface');
  return { key: 'program_ctx_runtime_does_not_expose_apply_patch', status: 'PASS' };
}

const tests = [
  test_apply_scoped_patch_accepts_same_model_records,
  test_apply_scoped_patch_rejects_cross_model_records,
  test_apply_scoped_patch_rejects_create_model,
  test_program_ctx_runtime_does_not_expose_apply_patch,
];

(async () => {
  let passed = 0;
  let failed = 0;
  for (const test of tests) {
    try {
      const result = await test();
      console.log(`[${result.status}] ${result.key}`);
      passed += 1;
    } catch (err) {
      console.log(`[FAIL] ${test.name}: ${err.message}`);
      failed += 1;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
  process.exit(failed > 0 ? 1 : 0);
})();
