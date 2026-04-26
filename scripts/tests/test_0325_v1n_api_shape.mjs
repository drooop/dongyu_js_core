#!/usr/bin/env node
// 0325 Step 1 — V1N API shape contract tests.
// Verifies:
//   (1) V1N.addLabel / V1N.removeLabel / V1N.readLabel are available on ctx
//   (2) ctx.writeLabel / ctx.getLabel / ctx.rmLabel are removed (no compat shim)
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

function wait(ms = 80) { return new Promise((r) => setTimeout(r, ms)); }
const triggerPayload = [{ id: 0, p: 0, r: 0, c: 0, k: 'trigger', t: 'str', v: 'go' }];

async function seed(rt, modelId) {
  rt.setRuntimeMode('edit');
  const model = rt.createModel({ id: modelId, name: 'test', type: 'test' });
  rt.addLabel(model, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'TestApp' });
  return model;
}

async function installFunc(rt, model, p, r, c, funcName, code) {
  rt.applyPatch({
    version: 'mt.v0',
    records: [
      { op: 'add_label', model_id: model.id, p, r, c, k: funcName, t: 'func.js', v: { code } },
      { op: 'add_label', model_id: model.id, p, r, c, k: `${funcName}_in`, t: 'pin.in', v: null },
      {
        op: 'add_label',
        model_id: model.id,
        p,
        r,
        c,
        k: `${funcName}_wiring`,
        t: 'pin.connect.label',
        v: [{ from: `(self, ${funcName}_in)`, to: [`(func, ${funcName}:in)`] }],
      },
    ],
  }, { trustedBootstrap: true });
}

async function test_v1n_apis_exposed() {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  const model = await seed(rt, 201);
  await installFunc(rt, model, 1, 0, 0, 'fn',
    "const report = ['addLabel:' + typeof V1N.addLabel, 'removeLabel:' + typeof V1N.removeLabel, 'readLabel:' + typeof V1N.readLabel].join('|'); V1N.addLabel('_v1n_probe', 'str', report); return;");
  await rt.setRuntimeMode('running');
  rt.addLabel(model, 1, 0, 0, { k: 'fn_in', t: 'pin.in', v: triggerPayload });
  await wait();
  const probe = rt.getCell(model, 1, 0, 0).labels.get('_v1n_probe');
  assert.ok(probe, 'probe label must exist (V1N.addLabel must have worked)');
  assert.equal(probe.v, 'addLabel:function|removeLabel:function|readLabel:function',
    `V1N three APIs must all be functions, got: ${probe.v}`);
  return { key: 'v1n_apis_exposed', status: 'PASS' };
}

async function test_ctx_old_apis_removed() {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  const model = await seed(rt, 202);
  await installFunc(rt, model, 1, 0, 0, 'fn',
    "const report = ['writeLabel:' + typeof ctx.writeLabel, 'getLabel:' + typeof ctx.getLabel, 'rmLabel:' + typeof ctx.rmLabel].join('|'); V1N.addLabel('_ctx_probe', 'str', report); return;");
  await rt.setRuntimeMode('running');
  rt.addLabel(model, 1, 0, 0, { k: 'fn_in', t: 'pin.in', v: triggerPayload });
  await wait();
  const probe = rt.getCell(model, 1, 0, 0).labels.get('_ctx_probe');
  assert.ok(probe, 'probe label must exist');
  assert.equal(probe.v, 'writeLabel:undefined|getLabel:undefined|rmLabel:undefined',
    `legacy ctx.* apis must be removed, got: ${probe.v}`);
  return { key: 'ctx_old_apis_removed', status: 'PASS' };
}

async function test_v1n_readLabel_same_model() {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  const model = await seed(rt, 203);
  rt.addLabel(model, 2, 3, 0, { k: 'origin_label', t: 'str', v: 'origin_value' });
  await installFunc(rt, model, 1, 0, 0, 'fn',
    "const got = V1N.readLabel(2, 3, 0, 'origin_label'); V1N.addLabel('_read_probe', 'json', got); return;");
  await rt.setRuntimeMode('running');
  rt.addLabel(model, 1, 0, 0, { k: 'fn_in', t: 'pin.in', v: triggerPayload });
  await wait();
  const probe = rt.getCell(model, 1, 0, 0).labels.get('_read_probe');
  assert.ok(probe, 'probe label must exist');
  assert.ok(probe.v && probe.v.t === 'str' && probe.v.v === 'origin_value',
    `V1N.readLabel must return {t,v}, got: ${JSON.stringify(probe.v)}`);
  return { key: 'v1n_readLabel_same_model', status: 'PASS' };
}

const tests = [test_v1n_apis_exposed, test_ctx_old_apis_removed, test_v1n_readLabel_same_model];

(async () => {
  let passed = 0, failed = 0;
  for (const t of tests) {
    try { const r = await t(); console.log(`[${r.status}] ${r.key}`); passed += 1; }
    catch (e) { console.log(`[FAIL] ${t.name}: ${e.message}`); failed += 1; }
  }
  console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
  process.exit(failed > 0 ? 1 : 0);
})();
