#!/usr/bin/env node

import { createRequire } from 'node:module';
import assert from 'node:assert';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

function wait(ms = 60) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setRunning(rt) {
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
}

async function test_positive_model_create_seeds_reserved_helper_cell() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 26601, name: 'seeded_helper', type: 'app' });
  const helper = rt.getCell(model, 0, 1, 0);
  assert.equal(helper.labels.get('helper_executor')?.v, true, 'helper_executor flag must exist');
  assert.equal(helper.labels.get('scope_privileged')?.v, true, 'helper cell must be scope privileged');
  assert.equal(helper.labels.get('owner_apply')?.t, 'pin.in', 'helper cell must expose owner_apply pin.in');
  assert.equal(helper.labels.get('owner_materialize')?.t, 'func.js', 'helper cell must define owner_materialize');
  assert.equal(helper.labels.get('owner_apply_route')?.t, 'pin.connect.label', 'helper cell must wire owner_apply to owner_materialize');
  return { key: 'positive_model_create_seeds_reserved_helper_cell', status: 'PASS' };
}

async function test_negative_model_does_not_auto_seed_helper_cell() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: -26602, name: 'negative_helper', type: 'system' });
  const helper = rt.getCell(model, 0, 1, 0);
  assert.equal(helper.labels.size, 0, 'negative model must not auto-seed helper cell');
  return { key: 'negative_model_does_not_auto_seed_helper_cell', status: 'PASS' };
}

async function test_reserved_helper_cell_materializes_same_model_records() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 26603, name: 'materialize_helper', type: 'app' });
  setRunning(rt);
  rt.addLabel(model, 0, 1, 0, {
    k: 'owner_apply',
    t: 'pin.in',
    v: {
      op: 'apply_records',
      target_model_id: 26603,
      records: [{ op: 'add_label', model_id: 26603, p: 2, r: 0, c: 0, k: 'x', t: 'str', v: 'ok' }],
    },
  });
  await wait();
  const label = rt.getCell(model, 2, 0, 0).labels.get('x');
  assert.equal(label?.v, 'ok', 'helper cell must materialize same-model record');
  return { key: 'reserved_helper_cell_materializes_same_model_records', status: 'PASS' };
}

async function test_reserved_helper_cell_can_materialize_single_model() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 26604, name: 'single_helper', type: 'app' });
  rt.addLabel(model, 0, 0, 0, { k: 'model_type', t: 'model.single', v: 'Code.JS' });
  setRunning(rt);
  rt.addLabel(model, 0, 1, 0, {
    k: 'owner_apply',
    t: 'pin.in',
    v: {
      op: 'apply_records',
      target_model_id: 26604,
      records: [{ op: 'add_label', model_id: 26604, p: 0, r: 0, c: 0, k: 'single_state', t: 'str', v: 'ok' }],
    },
  });
  await wait();
  const err = rt.getCell(model, 0, 1, 0).labels.get('__error_owner_materialize');
  assert.equal(err, undefined, 'helper cell must not fail on single-model owner materialization');
  const label = rt.getCell(model, 0, 0, 0).labels.get('single_state');
  assert.equal(label?.v, 'ok', 'helper cell must materialize single-model records');
  return { key: 'reserved_helper_cell_can_materialize_single_model', status: 'PASS' };
}

const tests = [
  test_positive_model_create_seeds_reserved_helper_cell,
  test_negative_model_does_not_auto_seed_helper_cell,
  test_reserved_helper_cell_materializes_same_model_records,
  test_reserved_helper_cell_can_materialize_single_model,
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
