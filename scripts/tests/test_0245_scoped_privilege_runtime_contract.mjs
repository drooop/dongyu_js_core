#!/usr/bin/env node

import { createRequire } from 'node:module';
import assert from 'node:assert';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

function wait(ms = 30) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setRunning(rt) {
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
}

async function executeFunc(rt, model, p, r, c, code, inputValue = 'go', opts = {}) {
  if (opts.rootType) {
    rt.addLabel(model, 0, 0, 0, { k: 'model_type', t: opts.rootType, v: opts.rootType === 'model.matrix' ? 'Data.Array' : 'Flow' });
  }
  if (opts.cellType) {
    rt.addLabel(model, p, r, c, { k: 'model_type', t: opts.cellType, v: opts.cellType === 'model.matrix' ? 'Data.Array' : 'Flow' });
  }
  if (opts.privileged === true) {
    rt.addLabel(model, p, r, c, { k: 'scope_privileged', t: 'bool', v: true });
  }
  if (opts.matrixBounds) {
    for (const [k, v] of Object.entries(opts.matrixBounds)) {
      rt.addLabel(model, p, r, c, { k, t: 'int', v });
    }
  }
  rt.addLabel(model, p, r, c, {
    k: 'wiring',
    t: 'pin.connect.label',
    v: [{ from: '(self, cmd)', to: ['(func, op:in)'] }],
  });
  rt.addLabel(model, p, r, c, {
    k: 'op',
    t: 'func.js',
    v: { code, modelName: 'test_0245_scoped_privilege_runtime_contract' },
  });
  setRunning(rt);
  rt.addLabel(model, p, r, c, { k: 'cmd', t: 'pin.in', v: inputValue });
  await wait(50);
  return rt.getCell(model, p, r, c).labels.get('__error_op');
}

async function test_ordinary_cell_cannot_direct_write_sibling_same_model() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 2001, name: 'ordinary_table', type: 'app' });
  const err = await executeFunc(
    rt,
    model,
    1,
    0,
    0,
    "ctx.writeLabel({ model_id: 2001, p: 2, r: 0, c: 0, k: 'x' }, 'str', 'blocked');",
    'go',
    { rootType: 'model.table' },
  );
  assert(err, 'ordinary_cell_must_emit_error');
  assert.match(String(err.v.error || ''), /privilege_required/i, 'ordinary_cell_error_must_report_privilege_required');
  const target = rt.getCell(model, 2, 0, 0).labels.get('x');
  assert.equal(target, undefined, 'ordinary_cell_must_not_mutate_sibling');
  return { key: 'ordinary_cell_cannot_direct_write_sibling_same_model', status: 'PASS' };
}

async function test_table_root_auto_privilege_can_write_same_model_cell() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 2002, name: 'table_root', type: 'app' });
  const err = await executeFunc(
    rt,
    model,
    0,
    0,
    0,
    "ctx.writeLabel({ model_id: 2002, p: 1, r: 0, c: 0, k: 'x' }, 'str', 'ok');",
    'go',
    { rootType: 'model.table' },
  );
  assert.equal(err, undefined, 'table_root_auto_privilege_must_not_error');
  const target = rt.getCell(model, 1, 0, 0).labels.get('x');
  assert(target && target.v === 'ok', 'table_root_must_mutate_same_model_cell');
  return { key: 'table_root_auto_privilege_can_write_same_model_cell', status: 'PASS' };
}

async function test_explicit_privileged_non_root_can_write_same_model_cell() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 2003, name: 'explicit_privileged', type: 'app' });
  const err = await executeFunc(
    rt,
    model,
    5,
    0,
    0,
    "ctx.writeLabel({ model_id: 2003, p: 2, r: 0, c: 0, k: 'x' }, 'str', 'ok');",
    'go',
    { rootType: 'model.table', privileged: true },
  );
  assert.equal(err, undefined, 'explicit_privileged_non_root_must_not_error');
  const target = rt.getCell(model, 2, 0, 0).labels.get('x');
  assert(target && target.v === 'ok', 'explicit_privileged_non_root_must_mutate_same_model_cell');
  return { key: 'explicit_privileged_non_root_can_write_same_model_cell', status: 'PASS' };
}

async function test_matrix_privileged_root_can_write_inside_matrix_scope() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 2004, name: 'matrix_scope', type: 'app' });
  const err = await executeFunc(
    rt,
    model,
    10,
    0,
    0,
    "ctx.writeLabel({ model_id: 2004, p: 11, r: 1, c: 0, k: 'inside' }, 'str', 'ok');",
    'go',
    {
      rootType: 'model.table',
      cellType: 'model.matrix',
      privileged: true,
      matrixBounds: { scope_min_p: 10, scope_max_p: 12, scope_min_r: 0, scope_max_r: 2, scope_min_c: 0, scope_max_c: 1 },
    },
  );
  assert.equal(err, undefined, 'matrix_privileged_root_inside_scope_must_not_error');
  const target = rt.getCell(model, 11, 1, 0).labels.get('inside');
  assert(target && target.v === 'ok', 'matrix_privileged_root_must_mutate_inside_scope');
  return { key: 'matrix_privileged_root_can_write_inside_matrix_scope', status: 'PASS' };
}

async function test_matrix_privileged_root_cannot_write_outside_matrix_scope() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 2005, name: 'matrix_scope_outside', type: 'app' });
  const err = await executeFunc(
    rt,
    model,
    10,
    0,
    0,
    "ctx.writeLabel({ model_id: 2005, p: 20, r: 0, c: 0, k: 'outside' }, 'str', 'blocked');",
    'go',
    {
      rootType: 'model.table',
      cellType: 'model.matrix',
      privileged: true,
      matrixBounds: { scope_min_p: 10, scope_max_p: 12, scope_min_r: 0, scope_max_r: 2, scope_min_c: 0, scope_max_c: 1 },
    },
  );
  assert(err, 'matrix_privileged_root_outside_scope_must_error');
  assert.match(String(err.v.error || ''), /matrix_scope/i, 'matrix_privileged_root_error_must_report_scope');
  const target = rt.getCell(model, 20, 0, 0).labels.get('outside');
  assert.equal(target, undefined, 'matrix_privileged_root_must_not_mutate_outside_scope');
  return { key: 'matrix_privileged_root_cannot_write_outside_matrix_scope', status: 'PASS' };
}

async function test_table_root_can_write_nested_matrix_cell_same_model() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 2006, name: 'table_over_matrix', type: 'app' });
  rt.addLabel(model, 10, 0, 0, { k: 'model_type', t: 'model.matrix', v: 'Data.Array' });
  const err = await executeFunc(
    rt,
    model,
    0,
    0,
    0,
    "ctx.writeLabel({ model_id: 2006, p: 11, r: 1, c: 0, k: 'nested' }, 'str', 'ok');",
    'go',
    { rootType: 'model.table' },
  );
  assert.equal(err, undefined, 'table_root_over_nested_matrix_must_not_error');
  const target = rt.getCell(model, 11, 1, 0).labels.get('nested');
  assert(target && target.v === 'ok', 'table_root_must_mutate_nested_matrix_cell');
  return { key: 'table_root_can_write_nested_matrix_cell_same_model', status: 'PASS' };
}

async function test_parent_cannot_direct_write_child_model_via_submt() {
  const rt = new ModelTableRuntime();
  const parent = rt.getModel(0);
  rt.addLabel(parent, 1, 0, 0, { k: '3001', t: 'submt', v: { alias: 'child3001' } });
  const err = await executeFunc(
    rt,
    parent,
    0,
    0,
    0,
    "ctx.writeLabel({ model_id: 3001, p: 0, r: 0, c: 0, k: 'x' }, 'str', 'blocked');",
    'go',
    { rootType: 'model.table' },
  );
  assert(err, 'parent_to_child_direct_write_must_error');
  assert.match(String(err.v.error || ''), /cross_model|submt/i, 'parent_to_child_error_must_report_boundary');
  const child = rt.getModel(3001);
  const target = rt.getCell(child, 0, 0, 0).labels.get('x');
  assert.equal(target, undefined, 'parent_must_not_mutate_child_model_directly');
  return { key: 'parent_cannot_direct_write_child_model_via_submt', status: 'PASS' };
}

async function test_cross_model_direct_write_fails() {
  const rt = new ModelTableRuntime();
  const modelA = rt.createModel({ id: 2007, name: 'modelA', type: 'app' });
  rt.createModel({ id: 2008, name: 'modelB', type: 'app' });
  const err = await executeFunc(
    rt,
    modelA,
    0,
    0,
    0,
    "ctx.writeLabel({ model_id: 2008, p: 0, r: 0, c: 0, k: 'x' }, 'str', 'blocked');",
    'go',
    { rootType: 'model.table' },
  );
  assert(err, 'cross_model_direct_write_must_error');
  assert.match(String(err.v.error || ''), /cross_model/i, 'cross_model_error_must_report_cross_model');
  const modelB = rt.getModel(2008);
  const target = rt.getCell(modelB, 0, 0, 0).labels.get('x');
  assert.equal(target, undefined, 'cross_model_direct_write_must_not_mutate_target');
  return { key: 'cross_model_direct_write_fails', status: 'PASS' };
}

const tests = [
  test_ordinary_cell_cannot_direct_write_sibling_same_model,
  test_table_root_auto_privilege_can_write_same_model_cell,
  test_explicit_privileged_non_root_can_write_same_model_cell,
  test_matrix_privileged_root_can_write_inside_matrix_scope,
  test_matrix_privileged_root_cannot_write_outside_matrix_scope,
  test_table_root_can_write_nested_matrix_cell_same_model,
  test_parent_cannot_direct_write_child_model_via_submt,
  test_cross_model_direct_write_fails,
];

(async () => {
  let passed = 0;
  let failed = 0;
  for (const test of tests) {
    try {
      const r = await test();
      console.log(`[${r.status}] ${r.key}`);
      passed += 1;
    } catch (err) {
      console.log(`[FAIL] ${test.name}: ${err.message}`);
      failed += 1;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
  process.exit(failed > 0 ? 1 : 0);
})();
