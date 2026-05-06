import { createRequire } from 'node:module';
import assert from 'node:assert';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

const mt = (k, t, v) => [{ id: 0, p: 0, r: 0, c: 0, k, t, v }];
const wait = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms));

async function test_host_pin_in_forwards_to_child_root() {
  const rt = new ModelTableRuntime();
  const parent = rt.getModel(0);
  rt.addLabel(parent, 1, 0, 0, { k: 'model_type', t: 'model.submt', v: 100 });
  rt.addLabel(parent, 1, 0, 0, { k: 'input', t: 'pin.in', v: null });
  rt.addLabel(parent, 0, 0, 0, {
    k: 'routes',
    t: 'pin.connect.cell',
    v: [{ from: [0, 0, 0, 'cmd'], to: [[1, 0, 0, 'input']] }],
  });
  const child = rt.getModel(100);
  rt.addLabel(child, 0, 0, 0, { k: 'input', t: 'pin.in', v: null });
  const payload = mt('message', 'str', 'payload');
  rt.addLabel(parent, 0, 0, 0, { k: 'cmd', t: 'pin.in', v: payload });
  await wait();
  assert.deepEqual(child.getCell(0, 0, 0).labels.get('input')?.v, payload);
  return { key: 'host_pin_in_forwards_to_child_root', status: 'PASS' };
}

async function test_child_root_pin_out_returns_to_host_pin_out() {
  const rt = new ModelTableRuntime();
  const parent = rt.getModel(0);
  rt.addLabel(parent, 2, 0, 0, { k: 'model_type', t: 'model.submt', v: 200 });
  rt.addLabel(parent, 2, 0, 0, { k: 'result', t: 'pin.out', v: null });
  rt.addLabel(parent, 0, 0, 0, { k: 'output', t: 'pin.in', v: null });
  rt.addLabel(parent, 0, 0, 0, {
    k: 'routes',
    t: 'pin.connect.cell',
    v: [{ from: [2, 0, 0, 'result'], to: [[0, 0, 0, 'output']] }],
  });
  const child = rt.getModel(200);
  const payload = mt('result', 'str', 'done');
  rt.addLabel(child, 0, 0, 0, { k: 'result', t: 'pin.out', v: payload });
  await wait();
  assert.deepEqual(parent.getCell(0, 0, 0).labels.get('output')?.v, payload);
  return { key: 'child_root_pin_out_returns_to_host_pin_out', status: 'PASS' };
}

async function test_full_round_trip_through_host_cell_boundaries() {
  const rt = new ModelTableRuntime();
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  const parent = rt.getModel(0);
  rt.addLabel(parent, 1, 0, 0, { k: 'model_type', t: 'model.submt', v: 300 });
  rt.addLabel(parent, 1, 0, 0, { k: 'input', t: 'pin.in', v: null });
  rt.addLabel(parent, 1, 0, 0, { k: 'output', t: 'pin.out', v: null });
  rt.addLabel(parent, 0, 0, 0, { k: 'data_out', t: 'pin.in', v: null });
  rt.addLabel(parent, 0, 0, 0, {
    k: 'parent_routes',
    t: 'pin.connect.cell',
    v: [
      { from: [0, 0, 0, 'data_in'], to: [[1, 0, 0, 'input']] },
      { from: [1, 0, 0, 'output'], to: [[0, 0, 0, 'data_out']] },
    ],
  });

  const child = rt.getModel(300);
  rt.addLabel(child, 0, 0, 0, { k: 'output', t: 'pin.out', v: null });
  rt.addLabel(child, 0, 0, 0, {
    k: 'child_routes',
    t: 'pin.connect.cell',
    v: [
      { from: [0, 0, 0, 'input'], to: [[1, 0, 0, 'raw']] },
      { from: [1, 0, 0, 'processed'], to: [[0, 0, 0, 'output']] },
    ],
  });
  rt.addLabel(child, 1, 0, 0, { k: 'raw', t: 'pin.in', v: null });
  rt.addLabel(child, 1, 0, 0, { k: 'processed', t: 'pin.out', v: null });
  rt.addLabel(child, 1, 0, 0, {
    k: 'transform',
    t: 'func.js',
    v: { code: "return [{ id: 0, p: 0, r: 0, c: 0, k: 'message', t: 'str', v: 'input_transformed' }];" },
  });
  rt.addLabel(child, 1, 0, 0, {
    k: 'wiring',
    t: 'pin.connect.label',
    v: [{ from: 'raw', to: ['transform:in'] }, { from: 'transform:out', to: ['processed'] }],
  });
  rt.addLabel(parent, 0, 0, 0, { k: 'data_in', t: 'pin.in', v: mt('message', 'str', 'input') });
  await wait();
  assert.deepEqual(parent.getCell(0, 0, 0).labels.get('data_out')?.v, mt('message', 'str', 'input_transformed'));
  return { key: 'full_round_trip_through_host_cell_boundaries', status: 'PASS' };
}

const tests = [
  test_host_pin_in_forwards_to_child_root,
  test_child_root_pin_out_returns_to_host_pin_out,
  test_full_round_trip_through_host_cell_boundaries,
];

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
