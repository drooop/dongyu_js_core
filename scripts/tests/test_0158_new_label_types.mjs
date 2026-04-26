import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mt(k, t, v) {
  return { id: 0, p: 0, r: 0, c: 0, k, t, v };
}

async function test_pin_connect_model_routes_bus_to_submodel() {
  const rt = new ModelTableRuntime();
  const child = rt.createModel({ id: 100, name: 'm100', type: 'app' });

  rt.addLabel(rt.getModel(0), 0, 0, 0, {
    k: 'bus_to_model',
    t: 'pin.connect.model',
    v: [{ from: [0, 'event'], to: [[100, 'input']] }],
  });

  rt.addLabel(rt.getModel(0), 0, 0, 0, { k: 'event', t: 'pin.bus.in', v: [mt('__mt_payload_kind', 'str', 'test.pin.v1'), mt('op_id', 'str', 'x1')] });
  await sleep(10);

  const target = rt.getCell(child, 0, 0, 0).labels.get('input');
  assert(target, 'pin.connect.model should route to child model root label');
  return { key: 'pin_connect_model_routes_bus_to_submodel', status: 'PASS' };
}

function test_legacy_pin_table_in_has_no_runtime_semantics() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 301, name: 'legacy_table', type: 'app' });
  rt.addLabel(model, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'Flow' });
  rt.addLabel(model, 0, 0, 0, {
    k: 'routes',
    t: 'pin.connect.cell',
    v: [{ from: [0, 0, 0, 'bad'], to: [[1, 0, 0, 'next']] }],
  });
  rt.addLabel(model, 0, 0, 0, { k: 'bad', t: 'pin.table.in', v: 'legacy' });
  assert.equal(rt.modelInPorts.has('301:bad'), false, 'legacy pin.table.in must not register model boundary semantics');
  assert.equal(rt.getCell(model, 1, 0, 0).labels.get('next'), undefined, 'legacy pin.table.in must not route');
  return { key: 'legacy_pin_table_in_has_no_runtime_semantics', status: 'PASS' };
}

function test_legacy_pin_single_in_has_no_runtime_semantics() {
  const rt = new ModelTableRuntime();
  const m = rt.createModel({ id: 201, name: 'legacy_single', type: 'app' });
  rt.addLabel(m, 0, 0, 0, { k: 'model_type', t: 'model.single', v: 'Code.JS' });
  rt.addLabel(m, 0, 0, 0, {
    k: 'routes',
    t: 'pin.connect.cell',
    v: [{ from: [0, 0, 0, 'bad'], to: [[1, 0, 0, 'next']] }],
  });
  rt.addLabel(m, 0, 0, 0, { k: 'bad', t: 'pin.single.in', v: 1 });
  assert.equal(rt.modelInPorts.has('201:bad'), false, 'legacy pin.single.in must not register model boundary semantics');
  assert.equal(rt.getCell(m, 1, 0, 0).labels.get('next'), undefined, 'legacy pin.single.in must not route');
  return { key: 'legacy_pin_single_in_has_no_runtime_semantics', status: 'PASS' };
}

async function test_pin_connect_cell_and_pin_in_route() {
  const rt = new ModelTableRuntime();
  const m = rt.createModel({ id: 200, name: 'm200', type: 'app' });

  rt.addLabel(m, 0, 0, 0, {
    k: 'routes',
    t: 'pin.connect.cell',
    v: [{ from: [0, 0, 0, 'cmd'], to: [[1, 0, 0, 'evt']] }],
  });
  rt.addLabel(m, 0, 0, 0, { k: 'cmd', t: 'pin.in', v: [mt('__mt_payload_kind', 'str', 'test.pin.v1'), mt('message', 'str', 'hello')] });

  await sleep(10);
  const routed = rt.getCell(m, 1, 0, 0).labels.get('evt');
  assert(routed, 'pin.in should route through pin.connect.cell');
  return { key: 'pin_connect_cell_and_pin_in_route', status: 'PASS' };
}

const tests = [
  test_legacy_pin_table_in_has_no_runtime_semantics,
  test_legacy_pin_single_in_has_no_runtime_semantics,
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
