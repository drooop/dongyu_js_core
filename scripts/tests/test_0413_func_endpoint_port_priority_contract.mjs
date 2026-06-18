#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

function wait(ms = 120) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uiEventPayload() {
  return [
    { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'ui_event.v1' },
    { id: 0, p: 0, r: 0, c: 0, k: 'todo_action', t: 'str', v: 'open_create' },
  ];
}

async function test_function_endpoint_wins_when_matching_pin_label_exists() {
  const rt = new ModelTableRuntime();
  rt.setRuntimeMode('edit');
  const model = rt.createModel({ id: 413, name: 'func-port-priority', type: 'test' });
  rt.addLabel(model, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'Test.FuncPortPriority' });
  rt.addLabel(model, 0, 0, 0, { k: 'todo_request', t: 'pin.in', v: null });
  rt.addLabel(model, 0, 0, 0, { k: 'handle_todo_event', t: 'func.js', v: {
    code: "V1N.table.addLabel(0, 0, 0, 'create_dialog_open', 'bool', true); V1N.table.addLabel(0, 0, 0, 'last_action', 'str', 'open_create');",
  } });
  rt.addLabel(model, 0, 0, 0, { k: 'handle_todo_event:in', t: 'pin.in', v: null });
  rt.addLabel(model, 0, 0, 0, { k: 'handle_todo_event:out', t: 'pin.out', v: null });
  rt.addLabel(model, 0, 0, 0, {
    k: 'todo_request_wiring',
    t: 'pin.connect.label',
    v: [{ from: 'todo_request', to: ['handle_todo_event:in'] }],
  });

  rt.setRuntimeMode('running');
  rt.addLabel(model, 0, 0, 0, { k: 'todo_request', t: 'pin.in', v: uiEventPayload() });
  await wait();

  const root = rt.getCell(model, 0, 0, 0);
  assert.equal(root.labels.get('create_dialog_open')?.v, true, 'function endpoint must execute even when handle_todo_event:in pin label exists');
  assert.equal(root.labels.get('last_action')?.v, 'open_create', 'function body must write state labels');
  return { key: 'function_endpoint_wins_when_matching_pin_label_exists', status: 'PASS' };
}

const tests = [test_function_endpoint_wins_when_matching_pin_label_exists];

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
