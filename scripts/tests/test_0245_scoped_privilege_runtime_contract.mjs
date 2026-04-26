#!/usr/bin/env node

import { createRequire } from 'node:module';
import assert from 'node:assert';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

function wait(ms = 50) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setRunning(rt) {
  rt.setRuntimeMode('running');
}

async function executeFunc(
  rt,
  model,
  p,
  r,
  c,
  code,
  inputValue = [{ id: 0, p: 0, r: 0, c: 0, k: 'trigger', t: 'str', v: 'go' }],
  opts = {},
) {
  const pinPayload = Array.isArray(inputValue)
    ? inputValue
    : [{ id: 0, p: 0, r: 0, c: 0, k: 'trigger', t: 'str', v: String(inputValue) }];
  rt.setRuntimeMode('edit');
  const records = [];
  if (opts.rootType) {
    records.push({ op: 'add_label', model_id: model.id, p: 0, r: 0, c: 0, k: 'model_type', t: opts.rootType, v: opts.rootType === 'model.matrix' ? 'Data.Array' : 'Flow' });
  }
  records.push({
    op: 'add_label',
    model_id: model.id,
    p,
    r,
    c,
    k: 'wiring',
    t: 'pin.connect.label',
    v: [{ from: '(self, cmd)', to: ['(func, op:in)'] }],
  });
  records.push({
    op: 'add_label',
    model_id: model.id,
    p,
    r,
    c,
    k: 'op',
    t: 'func.js',
    v: { code, modelName: 'test_0245_scoped_privilege_runtime_contract' },
  });
  rt.applyPatch({ version: 'mt.v0', records }, { trustedBootstrap: true });
  setRunning(rt);
  rt.addLabel(model, p, r, c, { k: 'cmd', t: 'pin.in', v: pinPayload });
  await wait();
  return rt.getCell(model, p, r, c).labels.get('__error_op');
}

async function test_non_root_cell_has_only_self_cell_v1n_write() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 2001, name: 'ordinary_table', type: 'app' });
  const err = await executeFunc(
    rt,
    model,
    1,
    0,
    0,
    "V1N.addLabel('self_marker', 'str', 'ok'); if (typeof V1N.table !== 'undefined') { V1N.table.addLabel(2, 0, 0, 'x', 'str', 'bad'); }",
    'go',
    { rootType: 'model.table' },
  );
  assert.equal(err, undefined, 'non_root_self_write_must_not_error');
  assert.equal(rt.getCell(model, 1, 0, 0).labels.get('self_marker')?.v, 'ok', 'non-root V1N.addLabel writes current cell');
  assert.equal(rt.getCell(model, 2, 0, 0).labels.get('x'), undefined, 'non-root cell must not expose V1N.table');
  return { key: 'non_root_cell_has_only_self_cell_v1n_write', status: 'PASS' };
}

async function test_v1n_write_label_requires_explicit_route() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 2002, name: 'route_required', type: 'app' });
  const err = await executeFunc(
    rt,
    model,
    1,
    0,
    0,
    "V1N.writeLabel(2, 0, 0, { k: 'x', t: 'str', v: 'blocked' });",
    'go',
    { rootType: 'model.table' },
  );
  assert.equal(err, undefined, 'route_missing_is_reported_as_label_not_throw');
  assert.equal(rt.getCell(model, 2, 0, 0).labels.get('x'), undefined, 'V1N.writeLabel must not mutate target without route');
  assert.equal(rt.getCell(model, 1, 0, 0).labels.get('write_label_req')?.t, 'pin.out', 'V1N.writeLabel emits a ModelTable payload request');
  assert.equal(rt.getCell(model, 1, 0, 0).labels.get('__error_write_label')?.v?.error, 'write_label_route_missing', 'missing route must be explicit');
  return { key: 'v1n_write_label_requires_explicit_route', status: 'PASS' };
}

async function test_table_root_can_write_same_model_cell_with_table_api() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 2003, name: 'table_root', type: 'app' });
  const err = await executeFunc(
    rt,
    model,
    0,
    0,
    0,
    "V1N.table.addLabel(1, 0, 0, 'x', 'str', 'ok');",
    'go',
    { rootType: 'model.table' },
  );
  assert.equal(err, undefined, 'table_root_table_api_must_not_error');
  assert.equal(rt.getCell(model, 1, 0, 0).labels.get('x')?.v, 'ok', 'table root can mutate same-model cells through V1N.table');
  return { key: 'table_root_can_write_same_model_cell_with_table_api', status: 'PASS' };
}

async function test_table_root_can_remove_same_model_cell_with_table_api() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 2004, name: 'table_root_remove', type: 'app' });
  rt.addLabel(model, 1, 0, 0, { k: 'victim', t: 'str', v: 'remove-me' });
  const err = await executeFunc(
    rt,
    model,
    0,
    0,
    0,
    "V1N.table.removeLabel(1, 0, 0, 'victim');",
    'go',
    { rootType: 'model.table' },
  );
  assert.equal(err, undefined, 'table_root_remove_must_not_error');
  assert.equal(rt.getCell(model, 1, 0, 0).labels.get('victim'), undefined, 'table root can remove same-model labels through V1N.table');
  return { key: 'table_root_can_remove_same_model_cell_with_table_api', status: 'PASS' };
}

async function test_v1n_read_label_reads_same_model_cells() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 2005, name: 'read_same_model', type: 'app' });
  rt.addLabel(model, 2, 0, 0, { k: 'origin', t: 'str', v: 'value' });
  const err = await executeFunc(
    rt,
    model,
    1,
    0,
    0,
    "const found = V1N.readLabel(2, 0, 0, 'origin'); V1N.addLabel('read_probe', 'json', found);",
    'go',
    { rootType: 'model.table' },
  );
  assert.equal(err, undefined, 'read_same_model_must_not_error');
  assert.deepEqual(rt.getCell(model, 1, 0, 0).labels.get('read_probe')?.v, { t: 'str', v: 'value' }, 'V1N.readLabel returns {t,v}');
  return { key: 'v1n_read_label_reads_same_model_cells', status: 'PASS' };
}

const tests = [
  test_non_root_cell_has_only_self_cell_v1n_write,
  test_v1n_write_label_requires_explicit_route,
  test_table_root_can_write_same_model_cell_with_table_api,
  test_table_root_can_remove_same_model_cell_with_table_api,
  test_v1n_read_label_reads_same_model_cells,
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
