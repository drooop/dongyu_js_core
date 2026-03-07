#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

function test_submt_wrong_position_rejected() {
  const rt = new ModelTableRuntime();
  const parent = rt.createModel({ id: 10, name: 'parent', type: 'app' });

  rt.addLabel(parent, 1, 0, 0, { k: '11', t: 'submt', v: { alias: 'child11' } });

  assert.equal(rt.parentChildMap.has(11), false, 'submt outside (0,0,0) must not register parentChildMap');
  assert.equal(rt.getModel(11), undefined, 'submt outside (0,0,0) must not auto-create child model');
  assert(
    rt.eventLog.list().some((entry) => entry.reason === 'submodel_wrong_position'),
    'submt outside (0,0,0) must record submodel_wrong_position',
  );
}

function test_submt_root_position_allowed() {
  const rt = new ModelTableRuntime();
  const parent = rt.createModel({ id: 20, name: 'parent20', type: 'app' });

  rt.addLabel(parent, 0, 0, 0, { k: '21', t: 'submt', v: { alias: 'child21' } });

  const info = rt.parentChildMap.get(21);
  assert(info, 'submt at (0,0,0) must register parentChildMap');
  assert.deepEqual(info.hostingCell, { p: 0, r: 0, c: 0 }, 'root-position submt must point to root cell');
  assert(rt.getModel(21), 'submt at (0,0,0) must create child model');
}

const tests = [
  test_submt_wrong_position_rejected,
  test_submt_root_position_allowed,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    test();
    console.log(`[PASS] ${test.name}`);
    passed += 1;
  } catch (err) {
    console.log(`[FAIL] ${test.name}: ${err.message}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
