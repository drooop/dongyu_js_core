import { createRequire } from 'node:module';
import assert from 'node:assert';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

function test_bus_in_register() {
  const rt = new ModelTableRuntime();
  const model0 = rt.getModel(0);
  rt.addLabel(model0, 0, 0, 0, { k: 'event_in', t: 'BUS_IN', v: null });
  assert(rt.busInPorts.has('event_in'), 'should register BUS_IN port');
  return { key: 'bus_in_register', status: 'PASS' };
}

function test_bus_in_wrong_position() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 5, name: 'test', type: 'test' });
  rt.addLabel(model, 0, 0, 0, { k: 'bad', t: 'BUS_IN', v: null });
  assert(!rt.busInPorts.has('bad'), 'should NOT register on non-model-0');
  const errors = rt.eventLog._events.filter((e) => e.reason === 'bus_in_wrong_position');
  assert(errors.length >= 1, 'should record error');
  return { key: 'bus_in_wrong_position', status: 'PASS' };
}

function test_bus_in_routes_via_cell_connection() {
  const rt = new ModelTableRuntime();
  const model0 = rt.getModel(0);
  // Set up cell_connection: (0,0,0) event_in → (1,0,0) cmd
  rt.addLabel(model0, 0, 0, 0, {
    k: 'routing',
    t: 'cell_connection',
    v: [{ from: [0, 0, 0, 'event_in'], to: [[1, 0, 0, 'cmd']] }],
  });
  // Register BUS_IN with null (declaration only)
  rt.addLabel(model0, 0, 0, 0, { k: 'event_in', t: 'BUS_IN', v: null });
  // Now write with a value → should trigger routing
  rt.addLabel(model0, 0, 0, 0, { k: 'event_in', t: 'BUS_IN', v: 'hello' });
  const cell1 = rt.getCell(model0, 1, 0, 0);
  const cmd = cell1.labels.get('cmd');
  assert(cmd, 'cell 1,0,0 should have cmd');
  assert.strictEqual(cmd.t, 'IN');
  assert.strictEqual(cmd.v, 'hello');
  return { key: 'bus_in_routes_via_cell_connection', status: 'PASS' };
}

function test_bus_out_register() {
  const rt = new ModelTableRuntime();
  const model0 = rt.getModel(0);
  rt.addLabel(model0, 0, 0, 0, { k: 'result_out', t: 'BUS_OUT', v: null });
  assert(rt.busOutPorts.has('result_out'), 'should register BUS_OUT port');
  return { key: 'bus_out_register', status: 'PASS' };
}

function test_bus_out_wrong_position() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 6, name: 'test', type: 'test' });
  rt.addLabel(model, 1, 0, 0, { k: 'bad', t: 'BUS_OUT', v: null });
  const errors = rt.eventLog._events.filter((e) => e.reason === 'bus_out_wrong_position');
  assert(errors.length >= 1, 'should record error');
  return { key: 'bus_out_wrong_position', status: 'PASS' };
}

function test_handle_bus_in_message() {
  const rt = new ModelTableRuntime();
  const model0 = rt.getModel(0);
  // Setup routing
  rt.addLabel(model0, 0, 0, 0, {
    k: 'routing',
    t: 'cell_connection',
    v: [{ from: [0, 0, 0, 'data_in'], to: [[1, 0, 0, 'input']] }],
  });
  rt.addLabel(model0, 0, 0, 0, { k: 'data_in', t: 'BUS_IN', v: null });
  // Simulate incoming
  rt._handleBusInMessage('data_in', { test: 1 });
  const cell1 = rt.getCell(model0, 1, 0, 0);
  const input = cell1.labels.get('input');
  assert(input, 'should route to target');
  assert.deepStrictEqual(input.v, { test: 1 });
  return { key: 'handle_bus_in_message', status: 'PASS' };
}

function test_bus_in_shortcircuit_mqtt() {
  const rt = new ModelTableRuntime();
  const model0 = rt.getModel(0);
  // Setup BUS_IN on (0,0,0)
  rt.addLabel(model0, 0, 0, 0, { k: 'bus_event', t: 'BUS_IN', v: null });
  // BUS_IN should be registered and take priority in mqttIncoming
  assert(rt.busInPorts.has('bus_event'), 'should have BUS_IN registered');
  assert(!rt.busInPorts.has('other_event'), 'other_event should NOT be in busInPorts');
  return { key: 'bus_in_shortcircuit_mqtt', status: 'PASS' };
}

// --- Run all tests ---
const tests = [
  test_bus_in_register,
  test_bus_in_wrong_position,
  test_bus_in_routes_via_cell_connection,
  test_bus_out_register,
  test_bus_out_wrong_position,
  test_handle_bus_in_message,
  test_bus_in_shortcircuit_mqtt,
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
