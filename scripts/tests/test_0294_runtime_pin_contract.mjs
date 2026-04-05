#!/usr/bin/env node

import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

function wait(ms = 50) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function test_root_pin_in_registers_model_input_and_routes_same_model() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 29041, name: 'table_model', type: 'app' });
  rt.addLabel(model, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'Flow' });
  rt.addLabel(model, 0, 0, 0, {
    k: 'routing',
    t: 'pin.connect.cell',
    v: [{ from: [0, 0, 0, 'submit'], to: [[1, 0, 0, 'next']] }],
  });

  rt.addLabel(model, 0, 0, 0, { k: 'submit', t: 'pin.in', v: 'payload_1' });
  const next = rt.getCell(model, 1, 0, 0).labels.get('next');

  assert(rt.modelInPorts.has('29041:submit'), 'root pin.in must register model input');
  assert(next && next.v === 'payload_1', 'root pin.in must route through cell connection');
  return { key: 'root_pin_in_registers_model_input_and_routes_same_model', status: 'PASS' };
}

async function test_root_pin_out_relays_to_parent_hosting_cell() {
  const rt = new ModelTableRuntime();
  const parent = rt.getModel(0);
  rt.addLabel(parent, 2, 0, 0, { k: '29042', t: 'submt', v: { alias: 'child29042' } });
  rt.addLabel(parent, 2, 0, 0, {
    k: 'bridge',
    t: 'pin.connect.label',
    v: [{ from: '(29042, result)', to: ['(self, final_out)'] }],
  });

  const child = rt.getModel(29042);
  rt.addLabel(child, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'Flow' });
  rt.addLabel(child, 0, 0, 0, { k: 'result', t: 'pin.out', v: 'child_result' });
  await wait();

  const parentCell = rt.getCell(parent, 2, 0, 0);
  const finalOut = parentCell.labels.get('final_out');

  assert(rt.modelOutPorts.has('29042:result'), 'root pin.out must register model output');
  assert(finalOut && finalOut.v === 'child_result', 'root pin.out must relay to parent hosting cell');
  return { key: 'root_pin_out_relays_to_parent_hosting_cell', status: 'PASS' };
}

function test_root_single_model_uses_pin_in_without_pin_single_types() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 29043, name: 'single_model', type: 'app' });
  rt.addLabel(model, 0, 0, 0, { k: 'model_type', t: 'model.single', v: 'Data.Single' });
  rt.addLabel(model, 0, 0, 0, {
    k: 'routing',
    t: 'pin.connect.cell',
    v: [{ from: [0, 0, 0, 'input'], to: [[1, 0, 0, 'next']] }],
  });
  rt.addLabel(model, 0, 0, 0, { k: 'input', t: 'pin.in', v: 'single_payload' });
  const next = rt.getCell(model, 1, 0, 0).labels.get('next');
  assert(rt.modelInPorts.has('29043:input'), 'root pin.in must register model input for model.single');
  assert(next && next.v === 'single_payload', 'root pin.in must route for model.single');
  return { key: 'root_single_model_uses_pin_in_without_pin_single_types', status: 'PASS' };
}

function test_multiple_default_program_endpoints_can_coexist_on_same_cell() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 29044, name: 'multi_pin_cell', type: 'app' });
  rt.addLabel(model, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'Flow' });
  rt.addLabel(model, 1, 0, 0, { k: 'left', t: 'pin.in', v: 'L' });
  rt.addLabel(model, 1, 0, 0, { k: 'right', t: 'pin.in', v: 'R' });
  const cell = rt.getCell(model, 1, 0, 0);
  assert.equal(cell.labels.get('left')?.v, 'L', 'left pin.in value must persist');
  assert.equal(cell.labels.get('right')?.v, 'R', 'right pin.in value must persist');
  return { key: 'multiple_default_program_endpoints_can_coexist_on_same_cell', status: 'PASS' };
}

const tests = [
  test_root_pin_in_registers_model_input_and_routes_same_model,
  test_root_pin_out_relays_to_parent_hosting_cell,
  test_root_single_model_uses_pin_in_without_pin_single_types,
  test_multiple_default_program_endpoints_can_coexist_on_same_cell,
];

(async () => {
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
})();
