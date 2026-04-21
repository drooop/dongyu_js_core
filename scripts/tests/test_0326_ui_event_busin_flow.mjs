#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const CHILD_MODEL_ID = 220;
const EDITOR_MODEL_ID = -1;

function wait(ms = 120) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

async function pollUntil(check, { timeoutMs = 1200, intervalMs = 40 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = check();
    if (result) return result;
    await wait(intervalMs);
  }
  return check();
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0326-flow-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0326_flow_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null });
  try {
    await state.activateRuntimeMode('running');
    return await fn(state);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.WORKER_BASE_WORKSPACE;
    delete process.env.WORKER_BASE_DATA_ROOT;
    delete process.env.DOCS_ROOT;
    delete process.env.STATIC_PROJECTS_ROOT;
    delete process.env.DY_PERSISTED_ASSET_ROOT;
  }
}

function seedBusInHarness(state) {
  const rt = state.runtime;
  const model0 = rt.getModel(0);
  const child = rt.createModel({ id: CHILD_MODEL_ID, name: 'it0326_child', type: 'app' });
  rt.addLabel(child, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'UI.Test0326Child' });
  rt.addLabel(child, 0, 0, 0, { k: 'ui_submit', t: 'pin.in', v: null });
  rt.addLabel(child, 0, 0, 0, {
    k: 'ui_submit_route',
    t: 'pin.connect.label',
    v: [{ from: '(self, ui_submit)', to: ['(self, mt_bus_receive_in)'] }],
  });
  rt.addLabel(model0, 0, 0, 0, {
    k: 'ui_submit_route',
    t: 'pin.connect.model',
    v: [{ from: [0, 'ui_submit'], to: [[CHILD_MODEL_ID, 'ui_submit']] }],
  });
  return child;
}

function v2Envelope(overrides = {}) {
  return {
    type: 'bus_event_v2',
    bus_in_key: 'ui_submit',
    value: {
      target_cell: { p: 2, r: 0, c: 0 },
      target_pin: 'submit_request',
      value: { text: 'hello-0326' },
    },
    meta: { op_id: `it0326_${Date.now()}` },
    ...overrides,
  };
}

async function test_legacy_ui_event_shape_rejected() {
  return withServerState(async (state) => {
    seedBusInHarness(state);
    const result = await state.submitEnvelope({
      type: 'ui_event',
      payload: {
        action: 'submit',
        meta: { op_id: `legacy_${Date.now()}` },
        target: { model_id: CHILD_MODEL_ID, p: 0, r: 0, c: 0 },
        pin: 'submit_request',
        value: { text: 'legacy' },
      },
    });
    assert.equal(result?.result, 'error', 'legacy ui_event shape must be rejected');
    assert.equal(result?.code, 'legacy_event_shape', 'legacy ui_event shape must fail with legacy_event_shape');
    return { key: 'legacy_ui_event_shape_rejected', status: 'PASS' };
  });
}

async function test_unknown_bus_in_key_rejected() {
  return withServerState(async (state) => {
    seedBusInHarness(state);
    const result = await state.submitEnvelope(v2Envelope({ bus_in_key: 'ui_unknown' }));
    assert.equal(result?.result, 'error', 'unknown bus_in_key must be rejected');
    assert.equal(result?.code, 'invalid_bus_in_key', 'unknown bus_in_key must fail with invalid_bus_in_key');
    return { key: 'unknown_bus_in_key_rejected', status: 'PASS' };
  });
}

async function test_ui_event_writes_model0_busin_and_skips_mailbox() {
  return withServerState(async (state) => {
    const rt = state.runtime;
    seedBusInHarness(state);
    const envelope = v2Envelope();
    const result = await state.submitEnvelope(envelope);
    assert.equal(result?.result, 'ok', 'v2 submit must be accepted');

    const model0Root = rt.getCell(rt.getModel(0), 0, 0, 0).labels;
    const model0Value = await pollUntil(() => model0Root.get('ui_submit')?.v);
    assert.deepEqual(model0Value, envelope.value, 'Model 0 root bus.in must receive v2 payload');
    const mailbox = rt.getCell(rt.getModel(EDITOR_MODEL_ID), 0, 0, 1).labels.get('ui_event');
    assert.equal(mailbox?.v ?? null, null, 'legacy editor mailbox ui_event must stay empty');
    return { key: 'ui_event_writes_model0_busin_and_skips_mailbox', status: 'PASS' };
  });
}

async function test_busin_routes_via_pin_connect_model_to_child() {
  return withServerState(async (state) => {
    const rt = state.runtime;
    seedBusInHarness(state);
    const envelope = v2Envelope();
    const result = await state.submitEnvelope(envelope);
    assert.equal(result?.result, 'ok', 'v2 submit must be accepted');

    const childRoot = rt.getCell(rt.getModel(CHILD_MODEL_ID), 0, 0, 0).labels;
    const childValue = await pollUntil(() => childRoot.get('ui_submit')?.v);
    assert.deepEqual(childValue, envelope.value, 'child root pin.in must receive the Model 0 routed payload');
    return { key: 'busin_routes_via_pin_connect_model_to_child', status: 'PASS' };
  });
}

async function test_mt_bus_receive_dispatches_to_target_pin() {
  return withServerState(async (state) => {
    const rt = state.runtime;
    seedBusInHarness(state);
    const envelope = v2Envelope();
    const result = await state.submitEnvelope(envelope);
    assert.equal(result?.result, 'ok', 'v2 submit must be accepted');

    const targetCell = await pollUntil(() => rt.getCell(rt.getModel(CHILD_MODEL_ID), 2, 0, 0).labels.get('submit_request'));
    assert.deepEqual(
      targetCell?.v,
      envelope.value.value,
      'mt_bus_receive must dispatch payload value to target pin'
    );
    return { key: 'mt_bus_receive_dispatches_to_target_pin', status: 'PASS' };
  });
}

const tests = [
  test_legacy_ui_event_shape_rejected,
  test_unknown_bus_in_key_rejected,
  test_ui_event_writes_model0_busin_and_skips_mailbox,
  test_busin_routes_via_pin_connect_model_to_child,
  test_mt_bus_receive_dispatches_to_target_pin,
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
