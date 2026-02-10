import { createRequire } from 'node:module';
import assert from 'node:assert';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

function test_route_from_to() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 999, name: 'test', type: 'test' });
  rt.addLabel(model, 0, 0, 0, {
    k: 'routing',
    t: 'cell_connection',
    v: [{ from: [0, 0, 0, 'input'], to: [[1, 0, 0, 'cmd']] }],
  });
  rt._routeViaCellConnection(999, 0, 0, 0, 'input', 'hello');
  const cell = rt.getCell(model, 1, 0, 0);
  const label = cell.labels.get('cmd');
  assert(label, 'target cell should have cmd label');
  assert.strictEqual(label.t, 'IN');
  assert.strictEqual(label.v, 'hello');
  return { key: 'route_from_to', status: 'PASS' };
}

function test_route_multi_target() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 998, name: 'test', type: 'test' });
  rt.addLabel(model, 0, 0, 0, {
    k: 'routing',
    t: 'cell_connection',
    v: [{ from: [0, 0, 0, 'input'], to: [[1, 0, 0, 'a'], [2, 0, 0, 'b']] }],
  });
  rt._routeViaCellConnection(998, 0, 0, 0, 'input', 'data');
  const cellA = rt.getCell(model, 1, 0, 0);
  const cellB = rt.getCell(model, 2, 0, 0);
  assert(cellA.labels.get('a'), 'cell A should have label a');
  assert(cellB.labels.get('b'), 'cell B should have label b');
  assert.strictEqual(cellA.labels.get('a').v, 'data');
  assert.strictEqual(cellB.labels.get('b').v, 'data');
  return { key: 'route_multi_target', status: 'PASS' };
}

function test_route_no_match() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 997, name: 'test', type: 'test' });
  // No routes registered
  rt._routeViaCellConnection(997, 0, 0, 0, 'nonexistent', 'data');
  // Should not throw
  return { key: 'route_no_match', status: 'PASS' };
}

function test_route_append_not_overwrite() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 996, name: 'test', type: 'test' });
  // Two separate cell_connection labels with overlapping from keys
  rt.addLabel(model, 0, 0, 0, {
    k: 'routing1',
    t: 'cell_connection',
    v: [{ from: [0, 0, 0, 'input'], to: [[1, 0, 0, 'a']] }],
  });
  rt.addLabel(model, 0, 0, 0, {
    k: 'routing2',
    t: 'cell_connection',
    v: [{ from: [0, 0, 0, 'input'], to: [[2, 0, 0, 'b']] }],
  });
  const targets = rt.cellConnectionRoutes.get('996|0|0|0|input');
  assert(targets, 'should have routes');
  assert.strictEqual(targets.length, 2, 'should append, not overwrite');
  return { key: 'route_append_not_overwrite', status: 'PASS' };
}

// --- Run all tests ---
const tests = [
  test_route_from_to,
  test_route_multi_target,
  test_route_no_match,
  test_route_append_not_overwrite,
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
