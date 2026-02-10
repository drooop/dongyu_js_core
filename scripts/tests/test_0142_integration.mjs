'use strict';

const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

/**
 * 0142 Integration Test
 * Full round-trip: BUS_IN → cell_connection → CELL_CONNECT → subModel MODEL_IN
 *   → child processing → MODEL_OUT → parent CELL_CONNECT → cell_connection → BUS_OUT
 */

async function test_full_e2e_model0_framework() {
  const rt = new ModelTableRuntime();

  // Load model_0 framework fixture
  const fixturePath = path.join(__dirname, 'fixtures', 'test_model0_framework.json');
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
  const model0 = rt.getModel(0);
  for (const rec of fixture.records) {
    if (rec.op === 'add_label') {
      const model = rt.getModel(rec.model_id);
      assert(model, `model ${rec.model_id} should exist`);
      rt.addLabel(model, rec.p, rec.r, rec.c, rec.label);
    }
  }

  // Verify subModel registered
  assert(rt.parentChildMap.has(100), 'child 100 should be registered');
  assert(rt.getModel(100), 'child model 100 should be created');

  // Setup child model 100 with processing
  const child = rt.getModel(100);
  rt.addLabel(child, 0, 0, 0, {
    k: 'routing',
    t: 'cell_connection',
    v: [
      { from: [0, 0, 0, 'cmd'], to: [[1, 0, 0, 'input']] },
      { from: [1, 0, 0, 'output'], to: [[0, 0, 0, 'result']] },
    ],
  });
  rt.addLabel(child, 1, 0, 0, {
    k: 'wiring',
    t: 'CELL_CONNECT',
    v: {
      '(self, input)': ['(func, process:in)'],
      '(func, process:out)': ['(self, output)'],
    },
  });
  rt.addLabel(child, 1, 0, 0, {
    k: 'process',
    t: 'function',
    v: "return 'processed:' + label.v;",
  });

  // Trigger: BUS_IN arrival
  rt._handleBusInMessage('test_in', 'hello');
  await new Promise((resolve) => setTimeout(resolve, 200));

  // Verify: BUS_IN routes to hosting cell
  const hostCell = rt.getCell(model0, 1, 0, 0);
  const cmd = hostCell.labels.get('cmd');
  assert(cmd, 'hosting cell should have cmd (from cell_connection)');

  // Verify: child receives MODEL_IN
  const childCell0 = rt.getCell(child, 0, 0, 0);
  const modelIn = childCell0.labels.get('cmd');
  assert(modelIn, 'child should have MODEL_IN cmd');
  assert.strictEqual(modelIn.t, 'MODEL_IN');

  // Verify: child function executes
  const childCell1 = rt.getCell(child, 1, 0, 0);
  const output = childCell1.labels.get('output');
  assert(output, 'child cell 1 should have output');
  assert.strictEqual(output.v, 'processed:hello');

  return { key: 'full_e2e_model0_framework', status: 'PASS' };
}

async function test_bus_in_priority_over_pin() {
  const rt = new ModelTableRuntime();
  const model0 = rt.getModel(0);
  // Register BUS_IN
  rt.addLabel(model0, 0, 0, 0, { k: 'data', t: 'BUS_IN', v: null });
  rt.addLabel(model0, 0, 0, 0, {
    k: 'routing',
    t: 'cell_connection',
    v: [{ from: [0, 0, 0, 'data'], to: [[1, 0, 0, 'received']] }],
  });

  // Simulate _handleBusInMessage
  rt._handleBusInMessage('data', { val: 42 });

  // Verify routing happened
  const cell1 = rt.getCell(model0, 1, 0, 0);
  const received = cell1.labels.get('received');
  assert(received, 'should route via cell_connection');
  assert.deepStrictEqual(received.v, { val: 42 });
  return { key: 'bus_in_priority_over_pin', status: 'PASS' };
}

function test_submodel_lifecycle() {
  const rt = new ModelTableRuntime();
  const parent = rt.createModel({ id: 10, name: 'app', type: 'app' });
  // Register subModel
  rt.addLabel(parent, 0, 0, 0, { k: '20', t: 'subModel', v: { alias: 'worker' } });
  // Verify parentChildMap
  const info = rt.parentChildMap.get(20);
  assert(info, 'should have parentChildMap entry');
  assert.strictEqual(info.parentModelId, 10);
  // Verify model created
  const child = rt.getModel(20);
  assert(child, 'child model should exist');
  assert.strictEqual(child.name, 'worker');
  assert.strictEqual(child.type, 'sub');
  return { key: 'submodel_lifecycle', status: 'PASS' };
}

// --- Run all tests ---
const tests = [
  test_full_e2e_model0_framework,
  test_bus_in_priority_over_pin,
  test_submodel_lifecycle,
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
