'use strict';

const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

/**
 * 0141 Integration Test
 * Loads the fixture JSON and validates end-to-end:
 *   cell_connection route (0,0,0 input → 1,0,0 cmd)
 *   → CELL_CONNECT wiring (self:cmd → func:process:in → func:process:out → self:result)
 *   → cell_connection route (1,0,0 result → 0,0,0 output)
 */

async function test_e2e_fixture() {
  const fixturePath = path.join(__dirname, 'fixtures', 'test_cell_connect_model.json');
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

  const rt = new ModelTableRuntime();

  // Replay fixture records
  for (const rec of fixture.records) {
    if (rec.op === 'create_model') {
      rt.createModel({ id: rec.model_id, name: rec.name, type: rec.type });
    } else if (rec.op === 'add_label') {
      const model = rt.getModel(rec.model_id);
      assert(model, `model ${rec.model_id} should exist`);
      rt.addLabel(model, rec.p, rec.r, rec.c, rec.label);
    }
  }

  // Verify cell_connection routes parsed
  assert(rt.cellConnectionRoutes.has('999|0|0|0|input'), 'should have route for input');
  assert(rt.cellConnectionRoutes.has('999|1|0|0|result'), 'should have route for result');

  // Verify CELL_CONNECT graph parsed
  const graph = rt.cellConnectGraph.get('999|1|0|0');
  assert(graph, 'should have graph for cell 1,0,0');
  assert(graph.has('self:cmd'), 'should have self:cmd endpoint');
  assert(graph.has('func:process:out'), 'should have func:process:out endpoint');

  // Trigger the flow: simulate input arriving at cell 0,0,0
  rt._routeViaCellConnection(999, 0, 0, 0, 'input', 'hello_world');

  // cell_connection should have routed to cell 1,0,0 with label 'cmd', t='IN'
  const model = rt.getModel(999);
  const cell1 = rt.getCell(model, 1, 0, 0);
  const cmdLabel = cell1.labels.get('cmd');
  assert(cmdLabel, 'cell 1,0,0 should have cmd label');
  assert.strictEqual(cmdLabel.t, 'IN');
  assert.strictEqual(cmdLabel.v, 'hello_world');

  // The IN label write triggers _applyBuiltins → _propagateCellConnect
  // which is async. Wait a tick for it to complete.
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Verify function executed: result should be 'hello_world_processed'
  const resultLabel = cell1.labels.get('result');
  assert(resultLabel, 'cell 1,0,0 should have result label');
  assert.strictEqual(resultLabel.v, 'hello_world_processed');

  // Verify cell_connection routed result back to cell 0,0,0
  const cell0 = rt.getCell(model, 0, 0, 0);
  const outputLabel = cell0.labels.get('output');
  assert(outputLabel, 'cell 0,0,0 should have output label');
  assert.strictEqual(outputLabel.t, 'IN');
  assert.strictEqual(outputLabel.v, 'hello_world_processed');

  return { key: 'e2e_fixture', status: 'PASS' };
}

async function test_no_regression_basic_addlabel() {
  // Verify that basic addLabel still works for non-CELL_CONNECT labels
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 1, name: 'test', type: 'test' });
  rt.addLabel(model, 0, 0, 0, { k: 'foo', t: 'json', v: { bar: 1 } });
  const cell = rt.getCell(model, 0, 0, 0);
  const label = cell.labels.get('foo');
  assert(label, 'should have foo label');
  assert.strictEqual(label.t, 'json');
  assert.deepStrictEqual(label.v, { bar: 1 });
  return { key: 'no_regression_basic_addlabel', status: 'PASS' };
}

async function test_no_regression_connect_keys() {
  // Verify that label.k='CELL_CONNECT' still triggers intercept via connectKeys
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 2, name: 'test', type: 'Data' });
  rt.addLabel(model, 0, 0, 0, { k: 'data_type', t: 'json', v: 'test' });
  rt.addLabel(model, 1, 0, 0, {
    k: 'CELL_CONNECT',
    t: 'CELL_CONNECT',
    v: { '(self, a)': ['(self, b)'] },
  });
  // label.t='CELL_CONNECT' should be parsed by _parseCellConnectLabel
  const graph = rt.cellConnectGraph.get('2|1|0|0');
  assert(graph, 'should have graph from label.t dispatch');
  assert(graph.has('self:a'), 'should have self:a');
  return { key: 'no_regression_connect_keys', status: 'PASS' };
}

// --- Run all tests ---
const tests = [
  test_e2e_fixture,
  test_no_regression_basic_addlabel,
  test_no_regression_connect_keys,
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
