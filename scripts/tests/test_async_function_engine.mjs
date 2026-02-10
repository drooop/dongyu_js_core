import { createRequire } from 'node:module';
import assert from 'node:assert';
const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

async function test_func_execution() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 999, name: 'test', type: 'test' });
  rt.addLabel(model, 1, 0, 0, {
    k: 'wiring',
    t: 'CELL_CONNECT',
    v: {
      '(self, cmd)': ['(func, process:in)'],
      '(func, process:out)': ['(self, result)'],
    },
  });
  rt.addLabel(model, 1, 0, 0, {
    k: 'process',
    t: 'function',
    v: "return label.v + '_processed';",
  });

  await rt._propagateCellConnect(999, 1, 0, 0, 'self', 'cmd', 'hello');

  const cell = rt.getCell(model, 1, 0, 0);
  const result = cell.labels.get('result');
  assert(result, 'should have result label');
  assert.strictEqual(result.v, 'hello_processed');
  return { key: 'func_execution', status: 'PASS' };
}

async function test_func_error_capture() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 998, name: 'test', type: 'test' });
  rt.addLabel(model, 0, 0, 0, {
    k: 'wiring',
    t: 'CELL_CONNECT',
    v: { '(self, cmd)': ['(func, bad:in)'] },
  });
  rt.addLabel(model, 0, 0, 0, {
    k: 'bad',
    t: 'function',
    v: 'throw new Error("intentional error");',
  });

  await rt._propagateCellConnect(998, 0, 0, 0, 'self', 'cmd', 'test');

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
    t: 'CELL_CONNECT',
    v: {
      '(self, a)': ['(self, b)'],
      '(self, b)': ['(self, a)'],
    },
  });

  // Should not throw or infinite loop
  await rt._propagateCellConnect(997, 0, 0, 0, 'self', 'a', 'test');

  const cycles = rt.eventLog._events.filter((e) => e.reason === 'cycle_detected');
  assert(cycles.length >= 1, 'should detect cycle');
  return { key: 'cycle_detection', status: 'PASS' };
}

async function test_func_fallback_to_model_minus10() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 996, name: 'test', type: 'test' });
  const sysModel = rt.createModel({ id: -10, name: 'system', type: 'system' });
  rt.addLabel(sysModel, 0, 0, 0, {
    k: 'shared_func',
    t: 'function',
    v: "return 'from_system';",
  });
  rt.addLabel(model, 0, 0, 0, {
    k: 'wiring',
    t: 'CELL_CONNECT',
    v: {
      '(self, cmd)': ['(func, shared_func:in)'],
      '(func, shared_func:out)': ['(self, out)'],
    },
  });

  await rt._propagateCellConnect(996, 0, 0, 0, 'self', 'cmd', 'test');

  const cell = rt.getCell(model, 0, 0, 0);
  const out = cell.labels.get('out');
  assert(out, 'should have out label');
  assert.strictEqual(out.v, 'from_system');
  return { key: 'func_fallback_model_minus10', status: 'PASS' };
}

async function test_multi_target_concurrent() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 995, name: 'test', type: 'test' });
  rt.addLabel(model, 0, 0, 0, {
    k: 'wiring',
    t: 'CELL_CONNECT',
    v: {
      '(self, cmd)': ['(self, out_a)', '(self, out_b)'],
    },
  });

  await rt._propagateCellConnect(995, 0, 0, 0, 'self', 'cmd', 'data');

  const cell = rt.getCell(model, 0, 0, 0);
  assert(cell.labels.get('out_a'), 'should have out_a');
  assert(cell.labels.get('out_b'), 'should have out_b');
  assert.strictEqual(cell.labels.get('out_a').v, 'data');
  assert.strictEqual(cell.labels.get('out_b').v, 'data');
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
  test_func_fallback_to_model_minus10,
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

