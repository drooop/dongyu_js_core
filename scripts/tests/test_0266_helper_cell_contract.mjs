#!/usr/bin/env node

import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');
const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');

function wait(ms = 80) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setRunning(rt) {
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
}

function mtRecord(k, t, v) {
  return { id: 0, p: 0, r: 0, c: 0, k, t, v };
}

async function test_positive_model_does_not_seed_reserved_helper_cell() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 26601, name: 'helper_removed', type: 'app' });
  const helper = rt.getCell(model, 0, 1, 0);
  const forbidden = ['helper_executor', 'scope_privileged', 'owner_apply', 'owner_materialize', 'owner_apply_route'];
  for (const key of forbidden) {
    assert.equal(helper.labels.has(key), false, `helper cell must not seed retired label ${key}`);
  }
  return { key: 'positive_model_does_not_seed_reserved_helper_cell', status: 'PASS' };
}

async function test_negative_model_does_not_seed_helper_cell() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: -26602, name: 'negative_helper', type: 'system' });
  const helper = rt.getCell(model, 0, 1, 0);
  assert.equal(helper.labels.size, 0, 'negative model must not auto-seed helper cell');
  return { key: 'negative_model_does_not_seed_helper_cell', status: 'PASS' };
}

async function test_retired_owner_apply_has_no_materialization_semantics() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 26603, name: 'owner_apply_retired', type: 'app' });
  setRunning(rt);
  rt.addLabel(model, 0, 1, 0, {
    k: 'owner_apply',
    t: 'pin.in',
    v: [
      mtRecord('x', 'str', 'must_not_materialize'),
    ],
  });
  await wait();
  const label = rt.getCell(model, 2, 0, 0).labels.get('x');
  assert.equal(label, undefined, 'retired owner_apply must not materialize records');
  return { key: 'retired_owner_apply_has_no_materialization_semantics', status: 'PASS' };
}

async function test_canonical_mt_write_materializes_same_model_record() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 26604, name: 'canonical_mt_write', type: 'app' });
  rt.addLabel(model, 0, 0, 0, {
    k: 'bucket_c_cell_routes',
    t: 'pin.connect.cell',
    v: [
      {
        from: [1, 0, 0, 'write_label_req'],
        to: [[0, 0, 0, 'mt_write_req']],
      },
    ],
  });
  rt.addLabel(model, 1, 0, 0, {
    k: 'writer',
    t: 'func.js',
    v: {
      code: "V1N.writeLabel(2, 0, 0, { k: 'x', t: 'str', v: 'ok' });",
      modelName: 'canonical_mt_write',
    },
  });
  rt.addLabel(model, 1, 0, 0, {
    k: 'run_writer',
    t: 'pin.connect.label',
    v: [{ from: 'run', to: ['writer:in'] }],
  });
  setRunning(rt);
  rt.addLabel(model, 1, 0, 0, { k: 'run', t: 'pin.in', v: [mtRecord('trigger', 'str', 'go')] });
  await wait();
  const label = rt.getCell(model, 2, 0, 0).labels.get('x');
  assert.equal(label?.v, 'ok', 'canonical mt_write route must materialize same-model record');
  return { key: 'canonical_mt_write_materializes_same_model_record', status: 'PASS' };
}

async function test_runtime_contains_no_helper_executor_privilege_path() {
  const text = fs.readFileSync(path.join(REPO_ROOT, 'packages/worker-base/src/runtime.mjs'), 'utf8');
  assert.equal(text.includes('_cellHasHelperExecutor'), false, 'runtime must not keep helper_executor privilege helper');
  assert.equal(text.includes("cell.labels.get('helper_executor')"), false, 'runtime must not inspect helper_executor for privileges');
  return { key: 'runtime_contains_no_helper_executor_privilege_path', status: 'PASS' };
}

const tests = [
  test_positive_model_does_not_seed_reserved_helper_cell,
  test_negative_model_does_not_seed_helper_cell,
  test_retired_owner_apply_has_no_materialization_semantics,
  test_canonical_mt_write_materializes_same_model_record,
  test_runtime_contains_no_helper_executor_privilege_path,
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
