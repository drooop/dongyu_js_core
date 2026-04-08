#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function wait(ms = 120) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0303-egress-recovery-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0303_egress_recovery_${Date.now()}`;
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

async function test_stale_model0_egress_payload_gets_forwarded_on_next_tick() {
  return withServerState(async (state) => {
    const runtime = state.runtime;
    const model0 = runtime.getModel(0);
    const model100 = runtime.getModel(100);
    assert.ok(model0 && model100, 'required_models_missing');

    runtime.addLabel(model100, 0, 0, 0, { k: 'submit_inflight', t: 'bool', v: true });
    runtime.addLabel(model100, 0, 0, 0, { k: 'status', t: 'str', v: 'loading' });
    runtime.addLabel(model0, 0, 0, 0, {
      k: 'model100_submit_out',
      t: 'pin.in',
      v: [
        { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.single', v: 'Data.RemoteSubmit' },
        { id: 0, p: 0, r: 0, c: 0, k: 'input_value', t: 'str', v: 'stale egress payload' },
        { id: 0, p: 0, r: 0, c: 0, k: 'route_mode', t: 'str', v: 'remote' },
      ],
    });

    state.programEngine.eventCursor = runtime.eventLog.list().length;
    state.programEngine.interceptCursor = runtime.intercepts.list().length;
    await state.programEngine.tick();
    await wait();

    const snap = state.clientSnap();
    const rootLabels = snap.models?.['100']?.cells?.['0,0,0']?.labels || {};
    const model0Labels = snap.models?.['0']?.cells?.['0,0,0']?.labels || {};

    assert.equal(model0Labels.model100_submit_out?.v ?? null, null, 'stale_model0_egress_label_must_be_cleared');
    assert.equal(rootLabels.submit_inflight?.v, false, 'stale_model0_egress_must_release_inflight');
    assert.equal(rootLabels.status?.v, 'matrix_unavailable', 'stale_model0_egress_must_still_run_forward_func');
    return { key: 'stale_model0_egress_payload_gets_forwarded_on_next_tick', status: 'PASS' };
  });
}

function mailboxEnvelope(action, options = {}) {
  const payload = {
    action,
    meta: { op_id: options.opId || `${action}_${Date.now()}` },
  };
  if (options.value !== undefined) payload.value = options.value;
  if (options.target !== undefined) payload.target = options.target;
  if (Number.isInteger(options.modelId)) payload.meta.model_id = options.modelId;
  return {
    event_id: Date.now(),
    type: action,
    payload,
    source: 'ui_renderer',
    ts: Date.now(),
  };
}

async function test_plain_object_submit_value_is_forwarded_as_event_payload() {
  return withServerState(async (state) => {
    const result = await state.submitEnvelope(mailboxEnvelope('submit', {
      modelId: 100,
      value: {
        action: 'submit',
        input_value: 'plain object submit',
      },
    }));
    assert.equal(result.result, 'ok', 'plain_object_submit_must_be_accepted');
    await wait();

    const rootLabels = state.clientSnap().models?.['100']?.cells?.['0,0,0']?.labels || {};
    assert.equal(rootLabels.status?.v, 'matrix_unavailable', 'plain_object_submit_must_still_run_forward_path');
    const model0Root = state.clientSnap().models?.['0']?.cells?.['0,0,0']?.labels || {};
    assert.equal(model0Root.model100_submit_out?.v ?? null, null, 'plain_object_submit_must_clear_model0_egress_after_forward');
    return { key: 'plain_object_submit_value_is_forwarded_as_event_payload', status: 'PASS' };
  });
}

const tests = [
  test_stale_model0_egress_payload_gets_forwarded_on_next_tick,
  test_plain_object_submit_value_is_forwarded_as_event_payload,
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
