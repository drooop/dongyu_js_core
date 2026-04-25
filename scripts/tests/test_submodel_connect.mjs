import { createRequire } from 'node:module';
import assert from 'node:assert';
const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

async function test_numeric_prefix_to_child() {
  const rt = new ModelTableRuntime();
  const parent = rt.getModel(0);
  // Register subModel 100
  rt.addLabel(parent, 1, 0, 0, { k: '100', t: 'submt', v: { alias: 'child100' } });
  // CELL_CONNECT: (self, cmd) → (100, input)
  rt.addLabel(parent, 1, 0, 0, {
    k: 'bridge',
    t: 'pin.connect.label',
    v: [{ from: '(self, cmd)', to: ['(100, input)'] }],
  });
  const child = rt.getModel(100);
  rt.addLabel(child, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'Flow' });
  // Trigger: write IN to parent cell 1,0,0 → CELL_CONNECT → child table/single IN
  rt.addLabel(parent, 1, 0, 0, { k: 'cmd', t: 'pin.in', v: 'payload' });
  await new Promise((resolve) => setTimeout(resolve, 100));
  const childCell = rt.getCell(child, 0, 0, 0);
  const modelIn = childCell.labels.get('input');
  assert(modelIn, 'child should have model-boundary input label');
  assert.equal(modelIn.t, 'pin.in', 'child boundary input must use pin.in');
  assert.strictEqual(modelIn.v, 'payload');
  return { key: 'numeric_prefix_to_child', status: 'PASS' };
}

async function test_child_model_out_to_parent() {
  const rt = new ModelTableRuntime();
  const parent = rt.getModel(0);
  // Register subModel 200
  rt.addLabel(parent, 2, 0, 0, { k: '200', t: 'submt', v: { alias: 'child200' } });
  // Parent CELL_CONNECT: (200, result) → (self, output)
  rt.addLabel(parent, 2, 0, 0, {
    k: 'bridge',
    t: 'pin.connect.label',
    v: [{ from: '(200, result)', to: ['(self, output)'] }],
  });
  const child = rt.getModel(200);
  rt.addLabel(child, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'Flow' });
  // Child writes table OUT
  rt.addLabel(child, 0, 0, 0, { k: 'result', t: 'pin.out', v: 'done' });
  await new Promise((resolve) => setTimeout(resolve, 100));
  const parentCell = rt.getCell(parent, 2, 0, 0);
  const output = parentCell.labels.get('output');
  assert(output, 'parent should have output');
  assert.strictEqual(output.v, 'done');
  return { key: 'child_model_out_to_parent', status: 'PASS' };
}

async function test_unregistered_submodel_safe() {
  const rt = new ModelTableRuntime();
  const parent = rt.getModel(0);
  // CELL_CONNECT references child 999 that is NOT registered
  rt.addLabel(parent, 0, 0, 0, {
    k: 'bridge',
    t: 'pin.connect.label',
    v: [{ from: '(self, cmd)', to: ['(999, input)'] }],
  });
  rt.addLabel(parent, 0, 0, 0, { k: 'cmd', t: 'pin.in', v: 'test' });
  await new Promise((resolve) => setTimeout(resolve, 100));
  const errors = rt.eventLog._events.filter((e) => e.reason === 'submodel_not_registered');
  assert(errors.length >= 1, 'should record submodel_not_registered error');
  return { key: 'unregistered_submodel_safe', status: 'PASS' };
}

async function test_full_round_trip() {
  const rt = new ModelTableRuntime();
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  const parent = rt.getModel(0);
  // Setup: BUS_IN → cell_connection → hosting cell CELL_CONNECT → child model-boundary IN
  //        child model-boundary OUT → parent CELL_CONNECT → cell_connection → BUS_OUT
  rt.addLabel(parent, 0, 0, 0, {
    k: 'routing',
    t: 'pin.connect.cell',
    v: [
      { from: [0, 0, 0, 'data_in'], to: [[1, 0, 0, 'cmd']] },
      { from: [1, 0, 0, 'result_out'], to: [[0, 0, 0, 'data_out']] },
    ],
  });
  rt.addLabel(parent, 0, 0, 0, { k: 'data_in', t: 'pin.bus.in', v: null });
  rt.addLabel(parent, 0, 0, 0, { k: 'data_out', t: 'pin.bus.out', v: null });
  rt.addLabel(parent, 1, 0, 0, { k: '300', t: 'submt', v: { alias: 'processor' } });
  rt.addLabel(parent, 1, 0, 0, {
    k: 'bridge',
    t: 'pin.connect.label',
    v: [
      { from: '(self, cmd)', to: ['(300, input)'] },
      { from: '(300, output)', to: ['(self, result_out)'] },
    ],
  });
  const child = rt.getModel(300);
  rt.addLabel(child, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'Flow' });
  // Child: model-boundary IN(input) → cell_connection → process → model-boundary OUT(output)
  rt.addLabel(child, 0, 0, 0, {
    k: 'routing',
    t: 'pin.connect.cell',
    v: [
      { from: [0, 0, 0, 'input'], to: [[1, 0, 0, 'raw']] },
      { from: [1, 0, 0, 'processed'], to: [[0, 0, 0, 'output']] },
    ],
  });
  rt.addLabel(child, 1, 0, 0, {
    k: 'wiring',
    t: 'pin.connect.label',
    v: [
      { from: '(self, raw)', to: ['(func, transform:in)'] },
      { from: '(func, transform:out)', to: ['(self, processed)'] },
    ],
  });
  rt.addLabel(child, 1, 0, 0, {
    k: 'transform',
    t: 'func.js',
    v: { code: "return label.v + '_transformed';", modelName: 'test_submodel_connect' },
  });

  // Trigger: simulate BUS_IN arrival
  rt._handleBusInMessage('data_in', 'input_data');
  await new Promise((resolve) => setTimeout(resolve, 200));

  // Verify: child cell 1,0,0 should have processed result
  const childCell1 = rt.getCell(child, 1, 0, 0);
  const processed = childCell1.labels.get('processed');
  assert(processed, 'child cell should have processed');
  assert.strictEqual(processed.v, 'input_data_transformed');

  // Verify: child root receives boundary input using pin.in
  const childCell0 = rt.getCell(child, 0, 0, 0);
  const input = childCell0.labels.get('input');
  assert(input, 'child should have boundary input');
  assert.equal(input.t, 'pin.in', 'child boundary input must use pin.in');

  // Child root output is currently represented as pin.in by the cell_connection step;
  // Foundation B only requires the root boundary family to converge to pin.in/out.
  const output = childCell0.labels.get('output');
  assert(output && output.v === 'input_data_transformed', 'child root output port must receive transformed value');
  return { key: 'full_round_trip', status: 'PASS' };
}

// --- Run all tests ---
const tests = [
  test_numeric_prefix_to_child,
  test_child_model_out_to_parent,
  test_unregistered_submodel_safe,
  test_full_round_trip,
];

(async () => {
  let passed = 0;
  let failed = 0;
  for (const t of tests) {
    try {
      const r = await t();
      console.log(`[${r.status}] ${r.key}`);
      passed += 1;
    } catch (err) {
      console.log(`[FAIL] ${t.name}: ${err.message}`);
      failed += 1;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
  process.exit(failed > 0 ? 1 : 0);
})();
