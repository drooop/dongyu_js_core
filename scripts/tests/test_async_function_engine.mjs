import { createRequire } from 'node:module';
import assert from 'node:assert';
const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');
const mt = (k, t, v) => [{ id: 0, p: 0, r: 0, c: 0, k, t, v }];

async function test_func_execution() {
  const rt = new ModelTableRuntime();
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  const model = rt.createModel({ id: 999, name: 'test', type: 'test' });
  rt.addLabel(model, 1, 0, 0, { k: 'result', t: 'pin.out', v: null });
  rt.addLabel(model, 1, 0, 0, {
    k: 'wiring',
    t: 'pin.connect.label',
    v: [
      { from: 'cmd', to: ['process:in'] },
      { from: 'process:out', to: ['result'] },
    ],
  });
  rt.addLabel(model, 1, 0, 0, {
    k: 'process',
    t: 'func.js',
    v: { code: "const rec = Array.isArray(label.v) ? label.v.find((r) => r && r.k === 'message') : null;\nreturn [{ id: 0, p: 0, r: 0, c: 0, k: 'message', t: 'str', v: String(rec && rec.v || '') + '_processed' }];", modelName: 'test_async_function_engine' },
  });

  await rt._propagateCellConnect(999, 1, 0, 0, 'self', 'cmd', mt('message', 'str', 'hello'));

  const cell = rt.getCell(model, 1, 0, 0);
  const result = cell.labels.get('result');
  assert(result, 'should have result label');
  assert.deepStrictEqual(result.v, mt('message', 'str', 'hello_processed'));
  return { key: 'func_execution', status: 'PASS' };
}

async function test_func_error_capture() {
  const rt = new ModelTableRuntime();
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  const model = rt.createModel({ id: 998, name: 'test', type: 'test' });
  rt.addLabel(model, 0, 0, 0, {
    k: 'wiring',
    t: 'pin.connect.label',
    v: [{ from: 'cmd', to: ['bad:in'] }],
  });
  rt.addLabel(model, 0, 0, 0, {
    k: 'bad',
    t: 'func.js',
    v: { code: 'throw new Error("intentional error");', modelName: 'test_async_function_engine' },
  });

  await rt._propagateCellConnect(998, 0, 0, 0, 'self', 'cmd', mt('trigger', 'str', 'test'));

  const cell = rt.getCell(model, 0, 0, 0);
  const err = cell.labels.get('__error_bad');
  assert(err, 'should have error label');
  assert(err.v.error.includes('intentional error'), 'error message should match');
  return { key: 'func_error_capture', status: 'PASS' };
}

async function test_cycle_detection() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 997, name: 'test', type: 'test' });
  // Create a cycle: self:a -> self:b, self:b -> self:a
  rt.addLabel(model, 0, 0, 0, {
    k: 'wiring',
    t: 'pin.connect.label',
    v: [
      { from: 'a', to: ['b'] },
      { from: 'b', to: ['a'] },
    ],
  });

  // Should not throw or infinite loop
  await rt._propagateCellConnect(997, 0, 0, 0, 'self', 'a', 'test');

  const cycles = rt.eventLog._events.filter((e) => e.reason === 'cycle_detected');
  assert(cycles.length >= 1, 'should detect cycle');
  return { key: 'cycle_detection', status: 'PASS' };
}

async function test_func_does_not_fallback_to_model_minus10() {
  const rt = new ModelTableRuntime();
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  const model = rt.createModel({ id: 996, name: 'test', type: 'test' });
  const sysModel = rt.createModel({ id: -10, name: 'system', type: 'system' });
  rt.addLabel(sysModel, 0, 0, 0, {
    k: 'shared_func',
    t: 'func.js',
    v: { code: "return 'from_system';", modelName: 'test_async_function_engine' },
  });
  rt.addLabel(model, 0, 0, 0, {
    k: 'wiring',
    t: 'pin.connect.label',
    v: [
      { from: 'cmd', to: ['shared_func:in'] },
      { from: 'shared_func:out', to: ['out'] },
    ],
  });

  await rt._propagateCellConnect(996, 0, 0, 0, 'self', 'cmd', mt('trigger', 'str', 'test'));

  const cell = rt.getCell(model, 0, 0, 0);
  const out = cell.labels.get('out');
  assert.equal(out, undefined, 'same-cell function wiring must not fallback to Model -10');
  return { key: 'func_does_not_fallback_model_minus10', status: 'PASS' };
}

async function test_multi_target_concurrent() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 995, name: 'test', type: 'test' });
  rt.addLabel(model, 0, 0, 0, { k: 'out_a', t: 'pin.out', v: null });
  rt.addLabel(model, 0, 0, 0, { k: 'out_b', t: 'pin.out', v: null });
  rt.addLabel(model, 0, 0, 0, {
    k: 'wiring',
    t: 'pin.connect.label',
    v: [
      { from: 'cmd', to: ['out_a', 'out_b'] },
    ],
  });

  const payload = mt('data', 'str', 'value');
  await rt._propagateCellConnect(995, 0, 0, 0, 'self', 'cmd', payload);

  const cell = rt.getCell(model, 0, 0, 0);
  assert(cell.labels.get('out_a'), 'should have out_a');
  assert(cell.labels.get('out_b'), 'should have out_b');
  assert.deepStrictEqual(cell.labels.get('out_a').v, payload);
  assert.deepStrictEqual(cell.labels.get('out_b').v, payload);
  return { key: 'multi_target_concurrent', status: 'PASS' };
}

async function test_no_graph_no_error() {
  const rt = new ModelTableRuntime();
  // No CELL_CONNECT registered, should just return silently
  await rt._propagateCellConnect(0, 0, 0, 0, 'self', 'cmd', 'test');
  return { key: 'no_graph_no_error', status: 'PASS' };
}

// --- Run all tests ---
const tests = [
  test_func_execution,
  test_func_error_capture,
  test_cycle_detection,
  test_func_does_not_fallback_to_model_minus10,
  test_multi_target_concurrent,
  test_no_graph_no_error,
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
