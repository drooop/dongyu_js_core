#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

function sleep(ms = 20) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeSubmitEnvelope(inputValue = 'runtime-mailbox-submit') {
  return {
    event_id: Date.now(),
    type: 'submit',
    payload: {
      action: 'submit',
      meta: { op_id: `rt_submit_${Date.now()}` },
      target: { model_id: 100, p: 0, r: 0, c: 0 },
      value: {
        t: 'event',
        v: {
          action: 'submit',
          input_value: inputValue,
        },
      },
    },
    source: 'ui_renderer',
    ts: Date.now(),
  };
}

function makeSystemActionEnvelope(action, target = null, value = null) {
  return {
    event_id: Date.now(),
    type: action,
    payload: {
      action,
      meta: { op_id: `${action}_${Date.now()}` },
      ...(target ? { target } : {}),
      ...(value !== null ? { value } : {}),
    },
    source: 'ui_renderer',
    ts: Date.now(),
  };
}

function readPayload(records, key) {
  const rec = Array.isArray(records)
    ? records.find((item) => item && item.id === 0 && item.p === 0 && item.r === 0 && item.c === 0 && item.k === key)
    : null;
  return rec ? rec.v : undefined;
}

async function test_runtime_mailbox_submit_routes_into_model0_and_target_pin() {
  const rt = new ModelTableRuntime();
  const mailbox = rt.createModel({ id: -1, name: 'editor_mailbox', type: 'system' });
  const model100 = rt.createModel({ id: 100, name: 'model100', type: 'app' });

  const model0 = rt.getModel(0);
  rt.addLabel(model0, 0, 0, 0, { k: 'is_DEM', t: 'bool', v: true });
  rt.addLabel(model0, 9, 0, 100, { k: 'model_type', t: 'model.submt', v: 100 });
  rt.addLabel(model0, 9, 0, 100, { k: 'submit_request', t: 'pin.in', v: null });
  rt.addLabel(model0, 0, 0, 0, {
    k: 'model100_submit_ingress_route',
    t: 'pin.connect.cell',
    v: [{ from: [0, 0, 0, 'ui_event_submit_100_0_0_0'], to: [[9, 0, 100, 'submit_request']] }],
  });
  rt.addLabel(model100, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'UI.RemoteColorForm' });
  rt.addLabel(model100, 0, 0, 0, { k: 'submit_request', t: 'pin.in', v: null });

  rt.addLabel(mailbox, 0, 0, 1, { k: 'ui_event', t: 'event', v: makeSubmitEnvelope() });
  await sleep();

  const ingress = rt.getCell(rt.getModel(0), 0, 0, 0).labels.get('ui_event_submit_100_0_0_0');
  assert(ingress, 'runtime_must_materialize_model0_ingress_label');
  assert.equal(ingress.t, 'pin.bus.mb.in', 'runtime_ingress_label_must_use_pin_bus_mb_in');

  const target = rt.getCell(model100, 0, 0, 0).labels.get('submit_request');
  assert(target, 'runtime_must_route_mailbox_submit_into_target_pin');
  assert.equal(target.t, 'pin.in', 'runtime_target_pin_must_use_pin_in');
  assert.equal(readPayload(target.v, 'input_value'), 'runtime-mailbox-submit', 'runtime_target_pin_must_preserve_input_value');
  assert.deepEqual(readPayload(target.v, 'target'), { model_id: 100, p: 0, r: 0, c: 0 }, 'runtime_target_pin_must_preserve_target_coords');

  return { key: 'runtime_mailbox_submit_routes_into_model0_and_target_pin', status: 'PASS' };
}

async function test_runtime_mailbox_system_action_routes_into_model0_and_negative_handler_pin() {
  const rt = new ModelTableRuntime();
  const mailbox = rt.createModel({ id: -1, name: 'editor_mailbox', type: 'system' });
  const systemModel = rt.createModel({ id: -10, name: 'system_handlers', type: 'system' });

  const model0 = rt.getModel(0);
  rt.addLabel(model0, 0, 0, 0, { k: 'is_DEM', t: 'bool', v: true });
  rt.addLabel(model0, 9, 0, 10, { k: 'model_type', t: 'model.submt', v: -10 });
  rt.addLabel(model0, 9, 0, 10, { k: 'slide_app_create_request', t: 'pin.in', v: null });
  rt.addLabel(model0, 0, 0, 0, {
    k: 'slide_app_create_ingress_route',
    t: 'pin.connect.cell',
    v: [{ from: [0, 0, 0, 'ui_event_slide_app_create'], to: [[9, 0, 10, 'slide_app_create_request']] }],
  });
  rt.addLabel(systemModel, 0, 0, 0, { k: 'slide_app_create_request', t: 'pin.in', v: null });

  rt.addLabel(mailbox, 0, 0, 1, {
    k: 'ui_event',
    t: 'event',
    v: makeSystemActionEnvelope('slide_app_create', { model_id: 1035, p: 0, r: 0, c: 0 }),
  });
  await sleep();

  const ingress = rt.getCell(rt.getModel(0), 0, 0, 0).labels.get('ui_event_slide_app_create');
  assert(ingress, 'runtime_must_materialize_model0_ingress_label_for_system_action');
  assert.equal(ingress.t, 'pin.bus.mb.in', 'runtime_system_ingress_label_must_use_pin_bus_mb_in');

  const target = rt.getCell(systemModel, 0, 0, 0).labels.get('slide_app_create_request');
  assert(target, 'runtime_must_route_system_action_into_negative_handler_pin');
  assert.equal(target.t, 'pin.in', 'runtime_negative_handler_pin_must_use_pin_in');
  assert.equal(readPayload(target.v, 'action'), 'slide_app_create', 'runtime_negative_handler_pin_must_preserve_action');
  assert.deepEqual(readPayload(target.v, 'target'), { model_id: 1035, p: 0, r: 0, c: 0 }, 'runtime_negative_handler_pin_must_preserve_target');

  return { key: 'runtime_mailbox_system_action_routes_into_model0_and_negative_handler_pin', status: 'PASS' };
}

const tests = [
  test_runtime_mailbox_submit_routes_into_model0_and_target_pin,
  test_runtime_mailbox_system_action_routes_into_model0_and_negative_handler_pin,
];

(async () => {
  let passed = 0;
  let failed = 0;
  for (const test of tests) {
    try {
      const result = await test();
      console.log(`[${result.status}] ${result.key}`);
      passed += 1;
    } catch (error) {
      console.log(`[FAIL] ${test.name}: ${error.message}`);
      failed += 1;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
  process.exit(failed > 0 ? 1 : 0);
})();
