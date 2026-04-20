#!/usr/bin/env node
// Unit test for runtime.mjs tier-1 symmetry: rmLabel of pin.bus.out on Model 0 (0,0,0)
// must clear busOutPorts entry. Covers 0322's +3-line interpreter tweak.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

function test_bus_out_port_is_registered_on_add() {
  const rt = new ModelTableRuntime();
  const model0 = rt.getModel(0);
  rt.addLabel(model0, 0, 0, 0, { k: 'egress_submit', t: 'pin.bus.out', v: null });
  assert.ok(rt.busOutPorts.has('egress_submit'), 'busOutPorts must register on addLabel of pin.bus.out');
  return { key: 'bus_out_port_is_registered_on_add', status: 'PASS' };
}

function test_bus_out_port_is_cleared_on_remove() {
  const rt = new ModelTableRuntime();
  const model0 = rt.getModel(0);
  rt.addLabel(model0, 0, 0, 0, { k: 'egress_submit', t: 'pin.bus.out', v: null });
  assert.ok(rt.busOutPorts.has('egress_submit'), 'precondition: port must exist');
  rt.rmLabel(model0, 0, 0, 0, 'egress_submit');
  assert.ok(!rt.busOutPorts.has('egress_submit'), 'rmLabel of pin.bus.out must clear busOutPorts');
  return { key: 'bus_out_port_is_cleared_on_remove', status: 'PASS' };
}

function test_bus_in_and_bus_out_cleanup_are_independent() {
  const rt = new ModelTableRuntime();
  const model0 = rt.getModel(0);
  rt.addLabel(model0, 0, 0, 0, { k: 'x_in', t: 'pin.bus.in', v: null });
  rt.addLabel(model0, 0, 0, 0, { k: 'x_out', t: 'pin.bus.out', v: null });
  rt.rmLabel(model0, 0, 0, 0, 'x_in');
  assert.ok(!rt.busInPorts.has('x_in'), 'busInPorts cleared');
  assert.ok(rt.busOutPorts.has('x_out'), 'busOutPorts unaffected by bus.in removal');
  rt.rmLabel(model0, 0, 0, 0, 'x_out');
  assert.ok(!rt.busOutPorts.has('x_out'), 'busOutPorts cleared on out removal');
  return { key: 'bus_in_and_bus_out_cleanup_are_independent', status: 'PASS' };
}

const tests = [
  test_bus_out_port_is_registered_on_add,
  test_bus_out_port_is_cleared_on_remove,
  test_bus_in_and_bus_out_cleanup_are_independent,
];

let passed = 0;
let failed = 0;
for (const t of tests) {
  try {
    const r = t();
    console.log(`[${r.status}] ${r.key}`);
    passed += 1;
  } catch (err) {
    console.log(`[FAIL] ${t.name}: ${err.message}`);
    failed += 1;
  }
}
console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
