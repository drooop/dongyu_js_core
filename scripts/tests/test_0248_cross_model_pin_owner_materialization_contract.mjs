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
const triggerPayload = [{ id: 0, p: 0, r: 0, c: 0, k: 'trigger', t: 'str', v: 'go' }];

function addFuncCell(rt, modelId, p, r, c, funcName, code, wiringFromSelfKey) {
  rt.applyPatch({
    version: 'mt.v0',
    records: [
      {
        op: 'add_label',
        model_id: modelId,
        p,
        r,
        c,
        k: 'wiring',
        t: 'pin.connect.label',
        v: [{ from: `(self, ${wiringFromSelfKey})`, to: [`(func, ${funcName}:in)`] }],
      },
      {
        op: 'add_label',
        model_id: modelId,
        p,
        r,
        c,
        k: funcName,
        t: 'func.js',
        v: { code, modelName: 'test_0248_cross_model_pin_owner_materialization_contract' },
      },
    ],
  }, { trustedBootstrap: true });
}

async function test_table_out_routes_to_target_owner_table_in_and_materializes_add() {
  const rt = new ModelTableRuntime();
  const source = rt.createModel({ id: 4101, name: 'source_table', type: 'app' });
  const target = rt.createModel({ id: 4102, name: 'target_table', type: 'app' });
  const system = rt.getModel(0);

  rt.setRuntimeMode('edit');
  rt.addLabel(source, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'Flow' });
  rt.addLabel(target, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'Flow' });

  rt.applyPatch({
    version: 'mt.v0',
    records: [{
      op: 'add_label',
      model_id: system.id,
      p: 0,
      r: 0,
      c: 0,
      k: 'owner_route',
      t: 'pin.connect.model',
      v: [{ from: [4101, 'write_req'], to: [[4102, 'apply_req']] }],
    }],
  }, { trustedBootstrap: true });

  addFuncCell(
    rt,
    4101,
    0,
    0,
    0,
    'emit_request',
    `
      const mt = (k, t, v) => ({ id: 0, p: 0, r: 0, c: 0, k, t, v });
      V1N.addLabel('write_req', 'pin.out', [
        mt('__mt_payload_kind', 'str', 'owner_request.v1'),
        mt('__mt_request_id', 'str', 'req_0248_add'),
        mt('target_model_id', 'int', 4102),
        mt('write_labels', 'json', [{ p: 1, r: 0, c: 0, k: 'greeting', t: 'str', v: 'hello-owner' }]),
        mt('remove_labels', 'json', []),
      ]);
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
      const payload = Array.isArray(label.v) ? label.v : [];
      const read = (key, fallback) => {
        const rec = payload.find((item) => item && item.id === 0 && item.p === 0 && item.r === 0 && item.c === 0 && item.k === key);
        return rec && Object.prototype.hasOwnProperty.call(rec, 'v') ? rec.v : fallback;
      };
      if (read('target_model_id', null) !== 4102) throw new Error('target_scope_rejected');
      const writeLabels = read('write_labels', []);
      for (const item of writeLabels) {
        if (!item || Object.prototype.hasOwnProperty.call(item, 'op') || Object.prototype.hasOwnProperty.call(item, 'model_id')) throw new Error('invalid_request_shape');
        V1N.table.addLabel(item.p, item.r, item.c, item.k, item.t, item.v);
      }
    `,
    'apply_req',
  );

  setRunning(rt);
  rt.addLabel(source, 0, 0, 0, { k: 'go', t: 'pin.in', v: triggerPayload });
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

  rt.setRuntimeMode('edit');
  rt.addLabel(source, 0, 0, 0, { k: 'model_type', t: 'model.single', v: 'Code.JS' });
  rt.addLabel(target, 0, 0, 0, { k: 'model_type', t: 'model.single', v: 'Code.JS' });
  rt.addLabel(target, 0, 0, 0, { k: 'victim', t: 'str', v: 'remove-me' });

  rt.applyPatch({
    version: 'mt.v0',
    records: [{
      op: 'add_label',
      model_id: system.id,
      p: 0,
      r: 0,
      c: 0,
      k: 'owner_route_single',
      t: 'pin.connect.model',
      v: [{ from: [4201, 'remove_req'], to: [[4202, 'apply_remove']] }],
    }],
  }, { trustedBootstrap: true });

  addFuncCell(
    rt,
    4201,
    0,
    0,
    0,
    'emit_remove',
    `
      const mt = (k, t, v) => ({ id: 0, p: 0, r: 0, c: 0, k, t, v });
      V1N.addLabel('remove_req', 'pin.out', [
        mt('__mt_payload_kind', 'str', 'owner_request.v1'),
        mt('__mt_request_id', 'str', 'req_0248_remove'),
        mt('target_model_id', 'int', 4202),
        mt('write_labels', 'json', []),
        mt('remove_labels', 'json', [{ p: 0, r: 0, c: 0, k: 'victim' }]),
      ]);
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
      const payload = Array.isArray(label.v) ? label.v : [];
      const read = (key, fallback) => {
        const rec = payload.find((item) => item && item.id === 0 && item.p === 0 && item.r === 0 && item.c === 0 && item.k === key);
        return rec && Object.prototype.hasOwnProperty.call(rec, 'v') ? rec.v : fallback;
      };
      if (read('target_model_id', null) !== 4202) throw new Error('target_scope_rejected');
      const removeLabels = read('remove_labels', []);
      for (const item of removeLabels) {
        if (!item || Object.prototype.hasOwnProperty.call(item, 'op') || Object.prototype.hasOwnProperty.call(item, 'model_id')) throw new Error('invalid_request_shape');
        V1N.table.removeLabel(item.p, item.r, item.c, item.k);
      }
    `,
    'apply_remove',
  );

  setRunning(rt);
  rt.addLabel(source, 0, 0, 0, { k: 'go', t: 'pin.in', v: triggerPayload });
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
