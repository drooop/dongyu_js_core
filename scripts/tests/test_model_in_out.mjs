import { createRequire } from 'node:module';
import assert from 'node:assert';
const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');
const mt = (k, t, v) => [{ id: 0, p: 0, r: 0, c: 0, k, t, v }];

function test_model_in_register() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 100, name: 'test', type: 'sub' });
  rt.addLabel(model, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'Flow' });
  rt.addLabel(model, 0, 0, 0, { k: 'cmd', t: 'pin.in', v: null });
  assert(rt.modelInPorts.has('100:cmd'), 'should register MODEL_IN port');
  return { key: 'model_in_register', status: 'PASS' };
}

function test_model_in_wrong_position() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 101, name: 'test', type: 'sub' });
  rt.addLabel(model, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'Flow' });
  const payload = mt('message', 'str', 'local');
  rt.addLabel(model, 1, 0, 0, { k: 'cmd', t: 'pin.in', v: payload });
  const cell = rt.getCell(model, 1, 0, 0);
  assert.deepEqual(cell.labels.get('cmd')?.v, payload, 'non-root pin.in should stay cell-local');
  assert.equal(rt.modelInPorts.has('101:cmd'), false, 'non-root pin.in must not register model boundary input');
  return { key: 'model_in_wrong_position', status: 'PASS' };
}

function test_model_in_triggers_routing() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 102, name: 'test', type: 'sub' });
  rt.addLabel(model, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'Flow' });
  rt.addLabel(model, 1, 0, 0, { k: 'process_in', t: 'pin.in', v: null });
  rt.addLabel(model, 0, 0, 0, {
    k: 'routing',
    t: 'pin.connect.cell',
    v: [{ from: [0, 0, 0, 'cmd'], to: [[1, 0, 0, 'process_in']] }],
  });
  const payload = mt('message', 'str', 'test_data');
  rt.addLabel(model, 0, 0, 0, { k: 'cmd', t: 'pin.in', v: payload });
  const cell1 = rt.getCell(model, 1, 0, 0);
  const pi = cell1.labels.get('process_in');
  assert(pi, 'should route to cell 1');
  assert.deepEqual(pi.v, payload);
  return { key: 'model_in_triggers_routing', status: 'PASS' };
}

function test_model_out_register() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 103, name: 'test', type: 'sub' });
  rt.addLabel(model, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'Flow' });
  rt.addLabel(model, 0, 0, 0, { k: 'result', t: 'pin.out', v: null });
  assert(rt.modelOutPorts.has('103:result'), 'should register MODEL_OUT port');
  return { key: 'model_out_register', status: 'PASS' };
}

function test_model_out_wrong_position() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 104, name: 'test', type: 'sub' });
  rt.addLabel(model, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'Flow' });
  const payload = mt('result', 'str', 'local_result');
  rt.addLabel(model, 2, 0, 0, { k: 'result', t: 'pin.out', v: payload });
  const cell = rt.getCell(model, 2, 0, 0);
  assert.deepEqual(cell.labels.get('result')?.v, payload, 'non-root pin.out should stay cell-local');
  assert.equal(rt.modelOutPorts.has('104:result'), false, 'non-root pin.out must not register model boundary output');
  return { key: 'model_out_wrong_position', status: 'PASS' };
}

async function test_model_out_notifies_parent() {
  const rt = new ModelTableRuntime();
  const parent = rt.createModel({ id: 50, name: 'parent', type: 'app' });
  rt.addLabel(parent, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'Flow' });
  rt.addLabel(parent, 1, 0, 0, { k: 'model_type', t: 'model.submt', v: 60 });
  rt.addLabel(parent, 1, 0, 0, { k: 'result', t: 'pin.out', v: null });
  rt.addLabel(parent, 1, 0, 0, { k: 'final_out', t: 'pin.out', v: null });
  rt.addLabel(parent, 0, 0, 0, {
    k: 'child_result_route',
    t: 'pin.connect.cell',
    v: [{ from: [1, 0, 0, 'result'], to: [[1, 0, 0, 'final_out']] }],
  });
  const child = rt.getModel(60);
  rt.addLabel(child, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'Flow' });
  const payload = mt('result', 'str', 'child_result');
  rt.addLabel(child, 0, 0, 0, { k: 'result', t: 'pin.out', v: payload });
  await new Promise((resolve) => setTimeout(resolve, 100));
  const parentCell = rt.getCell(parent, 1, 0, 0);
  const finalOut = parentCell.labels.get('final_out');
  assert(finalOut, 'parent should have final_out');
  assert.deepEqual(finalOut.v, payload);
  return { key: 'model_out_notifies_parent', status: 'PASS' };
}

function test_single_model_root_pin_in_registers_boundary() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 106, name: 'single', type: 'sub' });
  rt.addLabel(model, 0, 0, 0, { k: 'model_type', t: 'model.single', v: 'Code.JS' });
  rt.addLabel(model, 0, 0, 0, { k: 'cmd', t: 'pin.in', v: mt('value', 'int', 1) });
  assert(rt.modelInPorts.has('106:cmd'), 'model.single root pin.in should register boundary input');
  return { key: 'single_model_root_pin_in_registers_boundary', status: 'PASS' };
}

function test_single_model_accepts_root_pin_in() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 107, name: 'single', type: 'sub' });
  rt.addLabel(model, 0, 0, 0, { k: 'model_type', t: 'model.single', v: 'Code.JS' });
  rt.addLabel(model, 1, 0, 0, { k: 'next', t: 'pin.in', v: null });
  rt.addLabel(model, 0, 0, 0, {
    k: 'routing',
    t: 'pin.connect.cell',
    v: [{ from: [0, 0, 0, 'cmd'], to: [[1, 0, 0, 'next']] }],
  });
  const payload = mt('message', 'str', 'ok');
  rt.addLabel(model, 0, 0, 0, { k: 'cmd', t: 'pin.in', v: payload });
  const next = rt.getCell(model, 1, 0, 0).labels.get('next');
  assert.deepEqual(next?.v, payload, 'model.single should route root pin.in');
  return { key: 'single_model_accepts_root_pin_in', status: 'PASS' };
}

// --- Run all tests ---
const tests = [
  test_model_in_register,
  test_model_in_wrong_position,
  test_model_in_triggers_routing,
  test_model_out_register,
  test_model_out_wrong_position,
  test_model_out_notifies_parent,
  test_single_model_root_pin_in_registers_boundary,
  test_single_model_accepts_root_pin_in,
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
