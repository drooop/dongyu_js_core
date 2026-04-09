#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function wait(ms = 120) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0311-model100-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0311_model100_${Date.now()}`;
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

async function test_model100_submit_accepts_direct_pin_envelope() {
  return withServerState(async (state) => {
    const result = await state.submitEnvelope({
      event_id: Date.now(),
      type: 'click',
      payload: {
        meta: { op_id: `m100_pin_${Date.now()}` },
        target: { model_id: 100, p: 1, r: 0, c: 0 },
        pin: 'click',
        value: { input_value: '0311 direct pin submit' },
      },
      source: 'ui_renderer',
      ts: Date.now(),
    });
    assert.equal(result.result, 'ok', 'model100_direct_pin_submit_must_be_accepted');
    await wait();

    const events = state.runtime.eventLog.list();
    assert.ok(
      events.some((event) => event.op === 'add_label' && event.cell?.model_id === 100 && event.cell?.p === 1 && event.cell?.r === 0 && event.cell?.c === 0 && event.label?.k === 'click' && event.label?.t === 'pin.in'),
      'model100_button_cell_must_receive_click_pin',
    );
    assert.ok(
      events.some((event) => event.op === 'add_label' && event.cell?.model_id === 100 && event.cell?.p === 0 && event.cell?.r === 0 && event.cell?.c === 0 && event.label?.k === 'submit_request' && event.label?.t === 'pin.in'),
      'model100_button_click_must_relay_into_root_submit_request',
    );

    const rootLabels = state.clientSnap().models?.['100']?.cells?.['0,0,0']?.labels || {};
    assert.equal(rootLabels.status?.v, 'matrix_unavailable', 'model100_direct_pin_submit_must_still_complete_business_path');
    return { key: 'model100_submit_accepts_direct_pin_envelope', status: 'PASS' };
  });
}

const tests = [
  test_model100_submit_accepts_direct_pin_envelope,
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
