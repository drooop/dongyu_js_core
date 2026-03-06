import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function test_pin_connect_model_routes_bus_to_submodel() {
  const rt = new ModelTableRuntime();
  const child = rt.createModel({ id: 100, name: 'm100', type: 'app' });

  rt.addLabel(rt.getModel(0), 0, 0, 0, {
    k: 'bus_to_model',
    t: 'pin.connect.model',
    v: [{ from: [0, 'event'], to: [[100, 'input']] }],
  });

  rt.addLabel(rt.getModel(0), 0, 0, 0, { k: 'event', t: 'pin.bus.in', v: { op_id: 'x1' } });
  await sleep(10);

  const target = rt.getCell(child, 0, 0, 0).labels.get('input');
  assert(target, 'pin.connect.model should route to child model root label');
  return { key: 'pin_connect_model_routes_bus_to_submodel', status: 'PASS' };
}

function test_pin_table_in_rejects_model0() {
  const rt = new ModelTableRuntime();
  rt.addLabel(rt.getModel(0), 0, 0, 0, { k: 'bad', t: 'pin.table.in', v: 1 });
  const hasErr = rt.eventLog.list().some((e) => e.reason === 'model_in_on_model0_forbidden');
  assert(hasErr, 'model_id=0 should reject pin.table.in');
  return { key: 'pin_table_in_rejects_model0', status: 'PASS' };
}

function test_pin_single_in_requires_single_model() {
  const rt = new ModelTableRuntime();
  const m = rt.createModel({ id: 201, name: 'non_single', type: 'app' });
  rt.addLabel(m, 0, 0, 0, { k: 'bad', t: 'pin.single.in', v: 1 });
  const hasErr = rt.eventLog.list().some((e) => e.reason === 'single_in_on_non_single_model_forbidden');
  assert(hasErr, 'non-single model should reject pin.single.in');
  return { key: 'pin_single_in_requires_single_model', status: 'PASS' };
}

async function test_pin_connect_cell_and_pin_in_route() {
  const rt = new ModelTableRuntime();
  const m = rt.createModel({ id: 200, name: 'm200', type: 'app' });

  rt.addLabel(m, 0, 0, 0, {
    k: 'routes',
    t: 'pin.connect.cell',
    v: [{ from: [0, 0, 0, 'cmd'], to: [[1, 0, 0, 'evt']] }],
  });
  rt.addLabel(m, 0, 0, 0, { k: 'cmd', t: 'pin.in', v: 'hello' });

  await sleep(10);
  const routed = rt.getCell(m, 1, 0, 0).labels.get('evt');
  assert(routed, 'pin.in should route through pin.connect.cell');
  return { key: 'pin_connect_cell_and_pin_in_route', status: 'PASS' };
}

const tests = [
  test_pin_table_in_rejects_model0,
  test_pin_single_in_requires_single_model,
  test_pin_connect_model_routes_bus_to_submodel,
  test_pin_connect_cell_and_pin_in_route,
];

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
