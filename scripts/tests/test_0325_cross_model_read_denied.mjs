#!/usr/bin/env node
// 0325 Step 1 — V1N.readLabel cross-model denial contract.
// V1N.readLabel only accepts (p, r, c, k) — no model_id parameter, no ref form.
// Anything resembling cross-model access must throw or be impossible.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

function wait(ms = 80) { return new Promise((r) => setTimeout(r, ms)); }

async function test_v1n_readLabel_signature_rejects_ref_form() {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  const modelA = rt.createModel({ id: 301, name: 'a', type: 'test' });
  rt.addLabel(modelA, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'A' });
  const modelB = rt.createModel({ id: 302, name: 'b', type: 'test' });
  rt.addLabel(modelB, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'B' });
  rt.addLabel(modelB, 0, 0, 0, { k: 'secret', t: 'str', v: 'leaked' });

  rt.addLabel(modelA, 1, 0, 0, {
    k: 'fn', t: 'func.js',
    v: {
      code: [
        "let outcome = 'unknown';",
        "try {",
        "  const bad = V1N.readLabel({ model_id: 302, p: 0, r: 0, c: 0, k: 'secret' });",
        "  outcome = 'leaked:' + JSON.stringify(bad);",
        "} catch (err) { outcome = 'rejected:' + (err && err.message ? err.message : String(err)); }",
        "V1N.addLabel('_cross_probe', 'str', outcome);",
        "return;",
      ].join('\n'),
    },
  });
  rt.addLabel(modelA, 1, 0, 0, { k: 'fn_in', t: 'pin.in', v: null });
  rt.addLabel(modelA, 1, 0, 0, {
    k: 'fn_wiring', t: 'pin.connect.label',
    v: [{ from: '(self, fn_in)', to: ['(func, fn:in)'] }],
  });
  await rt.setRuntimeMode('running');
  rt.addLabel(modelA, 1, 0, 0, { k: 'fn_in', t: 'pin.in', v: 'trigger' });
  await wait();
  const probe = rt.getCell(modelA, 1, 0, 0).labels.get('_cross_probe');
  assert.ok(probe, 'probe label must exist');
  assert.ok(typeof probe.v === 'string' && probe.v.startsWith('rejected:'),
    `cross-model ref-form read MUST be rejected, got: ${probe.v}`);
  return { key: 'v1n_readLabel_rejects_ref_form', status: 'PASS' };
}

async function test_v1n_readLabel_positional_cannot_cross_model() {
  // V1N.readLabel(p, r, c, k) has no model_id — it must always read self model only.
  // Validate by reading same (p,r,c,k) on two models and checking values differ.
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  const modelA = rt.createModel({ id: 303, name: 'a', type: 'test' });
  rt.addLabel(modelA, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'A' });
  rt.addLabel(modelA, 2, 0, 0, { k: 'data', t: 'str', v: 'from-A' });
  const modelB = rt.createModel({ id: 304, name: 'b', type: 'test' });
  rt.addLabel(modelB, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'B' });
  rt.addLabel(modelB, 2, 0, 0, { k: 'data', t: 'str', v: 'from-B' });

  const code = "const got = V1N.readLabel(2, 0, 0, 'data'); V1N.addLabel('_got', 'json', got); return;";
  for (const model of [modelA, modelB]) {
    rt.addLabel(model, 1, 0, 0, { k: 'fn', t: 'func.js', v: { code } });
    rt.addLabel(model, 1, 0, 0, { k: 'fn_in', t: 'pin.in', v: null });
    rt.addLabel(model, 1, 0, 0, {
      k: 'fn_wiring', t: 'pin.connect.label',
      v: [{ from: '(self, fn_in)', to: ['(func, fn:in)'] }],
    });
  }
  await rt.setRuntimeMode('running');
  rt.addLabel(modelA, 1, 0, 0, { k: 'fn_in', t: 'pin.in', v: 'goA' });
  rt.addLabel(modelB, 1, 0, 0, { k: 'fn_in', t: 'pin.in', v: 'goB' });
  await wait();
  const probeA = rt.getCell(modelA, 1, 0, 0).labels.get('_got');
  const probeB = rt.getCell(modelB, 1, 0, 0).labels.get('_got');
  assert.ok(probeA && probeB, 'both probes must exist');
  assert.equal(probeA.v?.v, 'from-A', 'model A fn must read A-side data');
  assert.equal(probeB.v?.v, 'from-B', 'model B fn must read B-side data');
  return { key: 'v1n_readLabel_positional_cannot_cross_model', status: 'PASS' };
}

const tests = [test_v1n_readLabel_signature_rejects_ref_form, test_v1n_readLabel_positional_cannot_cross_model];

(async () => {
  let passed = 0, failed = 0;
  for (const t of tests) {
    try { const r = await t(); console.log(`[${r.status}] ${r.key}`); passed += 1; }
    catch (e) { console.log(`[FAIL] ${t.name}: ${e.message}`); failed += 1; }
  }
  console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
  process.exit(failed > 0 ? 1 : 0);
})();
