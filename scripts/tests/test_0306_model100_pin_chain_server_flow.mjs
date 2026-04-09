#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function wait(ms = 120) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0306-model100-chain-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0306_model100_chain_${Date.now()}`;
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

async function test_model100_submit_uses_runtime_pin_chain_when_ingress_route_exists() {
  return withServerState(async (state) => {
    const result = await state.submitEnvelope({
      event_id: Date.now(),
      type: 'submit',
      payload: {
        action: 'submit',
        meta: { op_id: `m100_pin_chain_${Date.now()}`, model_id: 100 },
        target: { model_id: 100, p: 0, r: 0, c: 0 },
        value: {
          t: 'event',
          v: {
            action: 'submit',
            input_value: 'pin-chain-submit',
          },
        },
      },
      source: 'ui_renderer',
      ts: Date.now(),
    });
    assert.equal(result.result, 'ok', 'model100_pin_chain_submit_must_be_accepted');
    await wait();

    const events = state.runtime.eventLog.list();
    assert.ok(
      events.some((event) => event.op === 'add_label' && event.cell?.model_id === 0 && event.cell?.p === 0 && event.cell?.r === 0 && event.cell?.c === 0 && event.label?.k === 'ui_event_submit_100_0_0_0' && event.label?.t === 'pin.bus.in'),
      'runtime_pin_chain_must_write_model0_ingress_label',
    );
    assert.ok(
      events.some((event) => event.op === 'add_label' && event.cell?.model_id === 100 && event.cell?.p === 0 && event.cell?.r === 0 && event.cell?.c === 0 && event.label?.k === 'submit_request' && event.label?.t === 'pin.in'),
      'runtime_pin_chain_must_route_to_model100_submit_request',
    );
    assert.ok(
      !events.some((event) => event.op === 'add_label' && event.cell?.model_id === 100 && event.cell?.p === 0 && event.cell?.r === 0 && event.cell?.c === 2 && event.label?.k === 'ui_event' && event.label?.v),
      'runtime_pin_chain_must_not_require_direct_model100_ui_event_write_when_route_exists',
    );

    const rootLabels = state.clientSnap().models?.['100']?.cells?.['0,0,0']?.labels || {};
    const model0Labels = state.clientSnap().models?.['0']?.cells?.['0,0,0']?.labels || {};
    assert.equal(rootLabels.status?.v, 'matrix_unavailable', 'runtime_pin_chain_submit_must_still_run_forward_path');
    assert.equal(rootLabels.submit_inflight?.v, false, 'runtime_pin_chain_submit_must_release_inflight');
    assert.equal(model0Labels.model100_submit_out?.v ?? null, null, 'runtime_pin_chain_submit_must_clear_model0_egress');

    return { key: 'model100_submit_uses_runtime_pin_chain_when_ingress_route_exists', status: 'PASS' };
  });
}

const tests = [
  test_model100_submit_uses_runtime_pin_chain_when_ingress_route_exists,
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
