#!/usr/bin/env node

import assert from 'node:assert/strict';
import path from 'node:path';
import { createServerState } from '../../packages/ui-model-demo-server/server.mjs';
import { deriveHomeTableRows } from '../../packages/ui-model-demo-frontend/src/editor_page_state_derivers.js';

function setStateLabel(runtime, key, t, v) {
  const model = runtime.getModel(-2);
  runtime.addLabel(model, 0, 0, 0, { k: key, t, v });
}

async function test_debug_table_shows_structural_labels() {
  const state = createServerState({ dbPath: null, assetRoot: null });
  const runtime = state.runtime;
  const model0 = runtime.getModel(0);
  runtime.addLabel(model0, 0, 9, 9, { k: 'debug_route', t: 'pin.connect.label', v: [{ from: '(self, in)', to: ['(self, out)'] }] });
  setStateLabel(runtime, 'selected_model_id', 'str', '0');
  const rows = deriveHomeTableRows(state.clientSnap().snapshot, -2);
  assert.ok(rows.some((row) => row && row.t === 'model.submt'), 'debug table must show model.submt labels');
  assert.ok(rows.some((row) => row && row.t === 'pin.connect.label' && row.k === 'debug_route'), 'debug table must show structural pin/connect labels');
}

async function test_home_save_label_allows_model0_structural_type() {
  const state = createServerState({ dbPath: null, assetRoot: null });
  const runtime = state.runtime;
  setStateLabel(runtime, 'selected_model_id', 'str', '0');
  setStateLabel(runtime, 'dt_edit_model_id', 'str', '0');
  setStateLabel(runtime, 'dt_edit_p', 'str', '0');
  setStateLabel(runtime, 'dt_edit_r', 'str', '9');
  setStateLabel(runtime, 'dt_edit_c', 'str', '0');
  setStateLabel(runtime, 'dt_edit_k', 'str', 'debug_child_mount');
  setStateLabel(runtime, 'dt_edit_t', 'str', 'model.submt');
  setStateLabel(runtime, 'dt_edit_v_text', 'str', '1004');

  const result = await state.submitEnvelope({
    event_id: Date.now(),
    type: 'home_save_label',
    source: 'test',
    ts: Date.now(),
    payload: { action: 'home_save_label', meta: { op_id: 'debug_save_model0_submt' } },
  });
  assert.equal(result.result, 'ok', 'debug CRUD must allow saving structural labels on Model 0');
  const label = runtime.getCell(runtime.getModel(0), 0, 9, 0).labels.get('debug_child_mount');
  assert.equal(label?.t, 'model.submt');
  assert.equal(label?.v, 1004);
}

async function test_home_delete_label_allows_negative_model() {
  const state = createServerState({ dbPath: null, assetRoot: null });
  const runtime = state.runtime;
  const model = runtime.getModel(-2);
  runtime.addLabel(model, 0, 9, 0, { k: 'debug_hidden_label', t: 'str', v: 'x' });

  const result = await state.submitEnvelope({
    event_id: Date.now(),
    type: 'home_delete_label',
    source: 'test',
    ts: Date.now(),
    payload: {
      action: 'home_delete_label',
      meta: { op_id: 'debug_delete_negative' },
      target: { model_id: -2, p: 0, r: 9, c: 0, k: 'debug_hidden_label' },
    },
  });
  assert.equal(result.result, 'ok', 'debug CRUD must allow deleting labels on negative models');
  assert.equal(runtime.getCell(model, 0, 9, 0).labels.has('debug_hidden_label'), false);
}

const tests = [
  test_debug_table_shows_structural_labels,
  test_home_save_label_allows_model0_structural_type,
  test_home_delete_label_allows_negative_model,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    await test();
    console.log(`[PASS] ${test.name}`);
    passed += 1;
  } catch (err) {
    console.log(`[FAIL] ${test.name}: ${err.message}`);
    failed += 1;
  }
}
console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
