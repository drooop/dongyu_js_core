#!/usr/bin/env node

import { createRequire } from 'node:module';
import assert from 'node:assert';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

function wait(ms = 50) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setRunning(rt) {
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
}

function addFuncCell(rt, modelId, p, r, c, funcName, code, wiringFromSelfKey) {
  const model = rt.getModel(modelId);
  rt.addLabel(model, p, r, c, {
    k: 'wiring',
    t: 'pin.connect.label',
    v: [{ from: `(self, ${wiringFromSelfKey})`, to: [`(func, ${funcName}:in)`] }],
  });
  rt.addLabel(model, p, r, c, {
    k: funcName,
    t: 'func.js',
    v: { code, modelName: 'test_0248_cross_model_pin_owner_materialization_contract' },
  });
}

async function test_table_out_routes_to_target_owner_table_in_and_materializes_add() {
  const rt = new ModelTableRuntime();
  const source = rt.createModel({ id: 4101, name: 'source_table', type: 'app' });
  const target = rt.createModel({ id: 4102, name: 'target_table', type: 'app' });
  const system = rt.getModel(0);

  rt.addLabel(source, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'Flow' });
  rt.addLabel(target, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'Flow' });

  rt.addLabel(system, 0, 0, 0, {
    k: 'owner_route',
    t: 'pin.connect.model',
    v: [{ from: [4101, 'write_req'], to: [[4102, 'apply_req']] }],
  });

  addFuncCell(
    rt,
    4101,
    0,
    0,
    0,
    'emit_request',
    `
      ctx.writeLabel(
        { model_id: 4101, p: 0, r: 0, c: 0, k: 'write_req' },
        'pin.table.out',
        {
          op: 'add_label',
          target_model_id: 4102,
          target_cell: { p: 1, r: 0, c: 0 },
          label: { k: 'greeting', t: 'str', v: 'hello-owner' },
          origin: { model_id: 4101, p: 0, r: 0, c: 0, action: 'emit_request' },
          request_id: 'req-0248-add',
          ts: 1,
        },
      );
    `,
    'go',
  );

  addFuncCell(
    rt,
    4102,
    0,
    0,
    0,
    'materialize',
    `
      const req = label.v;
      if (!req || req.op !== 'add_label') return;
      ctx.writeLabel(
        {
          model_id: req.target_model_id,
          p: req.target_cell.p,
          r: req.target_cell.r,
          c: req.target_cell.c,
          k: req.label.k,
        },
        req.label.t,
        req.label.v,
      );
    `,
    'apply_req',
  );

  setRunning(rt);
  rt.addLabel(source, 0, 0, 0, { k: 'go', t: 'pin.in', v: 'go' });
  await wait(120);

  const targetValue = rt.getCell(target, 1, 0, 0).labels.get('greeting');
  assert(targetValue && targetValue.v === 'hello-owner', 'target_owner_must_materialize_add_label');
  return { key: 'table_out_routes_to_target_owner_table_in_and_materializes_add', status: 'PASS' };
}

async function test_single_out_routes_to_target_owner_single_in_and_materializes_remove() {
  const rt = new ModelTableRuntime();
  const source = rt.createModel({ id: 4201, name: 'source_single', type: 'app' });
  const target = rt.createModel({ id: 4202, name: 'target_single', type: 'app' });
  const system = rt.getModel(0);

  rt.addLabel(source, 0, 0, 0, { k: 'model_type', t: 'model.single', v: 'Code.JS' });
  rt.addLabel(target, 0, 0, 0, { k: 'model_type', t: 'model.single', v: 'Code.JS' });
  rt.addLabel(target, 0, 0, 0, { k: 'victim', t: 'str', v: 'remove-me' });

  rt.addLabel(system, 0, 0, 0, {
    k: 'owner_route_single',
    t: 'pin.connect.model',
    v: [{ from: [4201, 'remove_req'], to: [[4202, 'apply_remove']] }],
  });

  addFuncCell(
    rt,
    4201,
    0,
    0,
    0,
    'emit_remove',
    `
      ctx.writeLabel(
        { model_id: 4201, p: 0, r: 0, c: 0, k: 'remove_req' },
        'pin.single.out',
        {
          op: 'rm_label',
          target_model_id: 4202,
          target_cell: { p: 0, r: 0, c: 0 },
          label: { k: 'victim' },
          origin: { model_id: 4201, p: 0, r: 0, c: 0, action: 'emit_remove' },
          request_id: 'req-0248-rm',
          ts: 2,
        },
      );
    `,
    'go',
  );

  addFuncCell(
    rt,
    4202,
    0,
    0,
    0,
    'materialize_remove',
    `
      const req = label.v;
      if (!req || req.op !== 'rm_label') return;
      ctx.rmLabel({
        model_id: req.target_model_id,
        p: req.target_cell.p,
        r: req.target_cell.r,
        c: req.target_cell.c,
        k: req.label.k,
      });
    `,
    'apply_remove',
  );

  setRunning(rt);
  rt.addLabel(source, 0, 0, 0, { k: 'go', t: 'pin.in', v: 'go' });
  await wait(120);

  const targetValue = rt.getCell(target, 0, 0, 0).labels.get('victim');
  assert.equal(targetValue, undefined, 'target_owner_must_materialize_remove_label');
  return { key: 'single_out_routes_to_target_owner_single_in_and_materializes_remove', status: 'PASS' };
}

const tests = [
  test_table_out_routes_to_target_owner_table_in_and_materializes_add,
  test_single_out_routes_to_target_owner_single_in_and_materializes_remove,
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
