#!/usr/bin/env node
// 0325 Step 1 — V1N.addLabel static-self-cell write guard.
// V1N.addLabel(k, t, v) must write only to the cell where the func is running,
// regardless of any attempt to encode cross-cell intent.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

function wait(ms = 80) { return new Promise((r) => setTimeout(r, ms)); }

async function test_v1n_addLabel_writes_only_running_cell() {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  const model = rt.createModel({ id: 401, name: 'sc', type: 'test' });
  rt.addLabel(model, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'SC' });
  // func at (2, 3, 0) — must write only to (2, 3, 0)
  rt.addLabel(model, 2, 3, 0, {
    k: 'fn', t: 'func.js',
    v: { code: "V1N.addLabel('self_probe', 'str', 'here'); return;" },
  });
  rt.addLabel(model, 2, 3, 0, { k: 'fn_in', t: 'pin.in', v: null });
  rt.addLabel(model, 2, 3, 0, {
    k: 'fn_wiring', t: 'pin.connect.label',
    v: [{ from: '(self, fn_in)', to: ['(func, fn:in)'] }],
  });
  await rt.setRuntimeMode('running');
  rt.addLabel(model, 2, 3, 0, { k: 'fn_in', t: 'pin.in', v: 'go' });
  await wait();
  // Assert (2,3,0) has the probe
  const hostCell = rt.getCell(model, 2, 3, 0).labels.get('self_probe');
  assert.ok(hostCell, 'self_probe must appear on (2,3,0) — func running cell');
  assert.equal(hostCell.v, 'here');
  // Assert no other cell has it
  const leaked = [];
  for (const cellKey of model.cells.keys()) {
    const [p, r, c] = cellKey.split(',').map(Number);
    if (p === 2 && r === 3 && c === 0) continue;
    const lbl = model.cells.get(cellKey).labels.get('self_probe');
    if (lbl) leaked.push(cellKey);
  }
  assert.equal(leaked.length, 0, `self_probe leaked to cells: ${leaked.join(',')}`);
  return { key: 'v1n_addLabel_writes_only_running_cell', status: 'PASS' };
}

async function test_v1n_addLabel_rejects_multi_arg_ref_form() {
  // Calling V1N.addLabel with a ref-like object (legacy style) should be impossible
  // because the signature is (k, t, v). Passing an object as k should either throw
  // (invalid_v1n_api_signature) or write a label with k being "[object Object]"-ish —
  // but guard is preferred.
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  const model = rt.createModel({ id: 402, name: 'sc', type: 'test' });
  rt.addLabel(model, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'SC' });
  rt.addLabel(model, 1, 0, 0, {
    k: 'fn', t: 'func.js',
    v: {
      code: [
        "let outcome = 'unknown';",
        "try {",
        "  V1N.addLabel({ model_id: ctx.self.model_id, p: 5, r: 5, c: 5, k: 'bad' }, 'str', 'should-fail');",
        "  outcome = 'unexpectedly_accepted';",
        "} catch (err) { outcome = 'rejected:' + (err && err.message ? err.message : String(err)); }",
        "V1N.addLabel('_sig_probe', 'str', outcome);",
        "return;",
      ].join('\n'),
    },
  });
  rt.addLabel(model, 1, 0, 0, { k: 'fn_in', t: 'pin.in', v: null });
  rt.addLabel(model, 1, 0, 0, {
    k: 'fn_wiring', t: 'pin.connect.label',
    v: [{ from: '(self, fn_in)', to: ['(func, fn:in)'] }],
  });
  await rt.setRuntimeMode('running');
  rt.addLabel(model, 1, 0, 0, { k: 'fn_in', t: 'pin.in', v: 'go' });
  await wait();
  const probe = rt.getCell(model, 1, 0, 0).labels.get('_sig_probe');
  assert.ok(probe, 'probe must exist');
  assert.ok(typeof probe.v === 'string' && probe.v.startsWith('rejected:'),
    `legacy ref-form call must be rejected, got: ${probe.v}`);
  // ensure (5,5,5) has no leak
  const leakedCell = rt.getCell(model, 5, 5, 5).labels;
  assert.ok(!leakedCell.has('bad'), 'no label should leak to (5,5,5)');
  return { key: 'v1n_addLabel_rejects_ref_form', status: 'PASS' };
}

const tests = [test_v1n_addLabel_writes_only_running_cell, test_v1n_addLabel_rejects_multi_arg_ref_form];

(async () => {
  let passed = 0, failed = 0;
  for (const t of tests) {
    try { const r = await t(); console.log(`[${r.status}] ${r.key}`); passed += 1; }
    catch (e) { console.log(`[FAIL] ${t.name}: ${e.message}`); failed += 1; }
  }
  console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
  process.exit(failed > 0 ? 1 : 0);
})();
