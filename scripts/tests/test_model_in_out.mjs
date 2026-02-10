import { createRequire } from 'node:module';
import assert from 'node:assert';
const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

function test_model_in_register() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 100, name: 'test', type: 'sub' });
  rt.addLabel(model, 0, 0, 0, { k: 'cmd', t: 'MODEL_IN', v: null });
  assert(rt.modelInPorts.has('100:cmd'), 'should register MODEL_IN port');
  return { key: 'model_in_register', status: 'PASS' };
}

function test_model_in_wrong_position() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 101, name: 'test', type: 'sub' });
  rt.addLabel(model, 1, 0, 0, { k: 'cmd', t: 'MODEL_IN', v: null });
  const errors = rt.eventLog._events.filter((e) => e.reason === 'model_in_wrong_position');
  assert(errors.length >= 1, 'should record error');
  return { key: 'model_in_wrong_position', status: 'PASS' };
}

function test_model_in_triggers_routing() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 102, name: 'test', type: 'sub' });
  rt.addLabel(model, 0, 0, 0, {
    k: 'routing',
    t: 'cell_connection',
    v: [{ from: [0, 0, 0, 'cmd'], to: [[1, 0, 0, 'process_in']] }],
  });
  rt.addLabel(model, 0, 0, 0, { k: 'cmd', t: 'MODEL_IN', v: 'test_data' });
  const cell1 = rt.getCell(model, 1, 0, 0);
  const pi = cell1.labels.get('process_in');
  assert(pi, 'should route to cell 1');
  assert.strictEqual(pi.v, 'test_data');
  return { key: 'model_in_triggers_routing', status: 'PASS' };
}

function test_model_out_register() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 103, name: 'test', type: 'sub' });
  rt.addLabel(model, 0, 0, 0, { k: 'result', t: 'MODEL_OUT', v: null });
  assert(rt.modelOutPorts.has('103:result'), 'should register MODEL_OUT port');
  return { key: 'model_out_register', status: 'PASS' };
}

function test_model_out_wrong_position() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 104, name: 'test', type: 'sub' });
  rt.addLabel(model, 2, 0, 0, { k: 'result', t: 'MODEL_OUT', v: null });
  const errors = rt.eventLog._events.filter((e) => e.reason === 'model_out_wrong_position');
  assert(errors.length >= 1, 'should record error');
  return { key: 'model_out_wrong_position', status: 'PASS' };
}

async function test_model_out_notifies_parent() {
  const rt = new ModelTableRuntime();
  const parent = rt.createModel({ id: 50, name: 'parent', type: 'app' });
  // Register child
  rt.addLabel(parent, 1, 0, 0, { k: '60', t: 'subModel', v: { alias: 'child' } });
  // Parent CELL_CONNECT: (60, result) → (self, final_out)
  rt.addLabel(parent, 1, 0, 0, {
    k: 'bridge',
    t: 'CELL_CONNECT',
    v: { '(60, result)': ['(self, final_out)'] },
  });
  const child = rt.getModel(60);
  // Write MODEL_OUT on child
  rt.addLabel(child, 0, 0, 0, { k: 'result', t: 'MODEL_OUT', v: 'child_result' });
  // Wait for async propagation
  await new Promise((resolve) => setTimeout(resolve, 100));
  // Parent cell 1,0,0 should have final_out
  const parentCell = rt.getCell(parent, 1, 0, 0);
  const finalOut = parentCell.labels.get('final_out');
  assert(finalOut, 'parent should have final_out');
  assert.strictEqual(finalOut.v, 'child_result');
  return { key: 'model_out_notifies_parent', status: 'PASS' };
}

// --- Run all tests ---
const tests = [
  test_model_in_register,
  test_model_in_wrong_position,
  test_model_in_triggers_routing,
  test_model_out_register,
  test_model_out_wrong_position,
  test_model_out_notifies_parent,
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

