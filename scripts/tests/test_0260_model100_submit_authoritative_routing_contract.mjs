#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function envelopeForModel100Submit(opId, inputValue = 'cli-submit-probe') {
  return {
    event_id: Date.now(),
    type: 'submit',
    payload: {
      action: 'submit',
      meta: { op_id: opId, model_id: 100 },
      target: { model_id: 100, p: 0, r: 0, c: 2, k: 'ui_event' },
      value: {
        t: 'event',
        v: {
          action: 'submit',
          input_value: inputValue,
        },
      },
    },
    source: 'ui_renderer',
    ts: 0,
  };
}

async function createTempServerState(prefix) {
  const tempRoot = mkdtempSync(join(tmpdir(), prefix));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `${prefix}_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static_projects');
  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null });
  return { tempRoot, state };
}

function cleanupTempServerState(tempRoot) {
  rmSync(tempRoot, { recursive: true, force: true });
  delete process.env.WORKER_BASE_WORKSPACE;
  delete process.env.WORKER_BASE_DATA_ROOT;
  delete process.env.DOCS_ROOT;
  delete process.env.STATIC_PROJECTS_ROOT;
  delete process.env.DY_PERSISTED_ASSET_ROOT;
}

async function test_server_model100_submit_is_not_misrouted_to_home_dispatch() {
  const { tempRoot, state } = await createTempServerState('dy-0260-submit-route-');
  try {
    await state.activateRuntimeMode('running');
    const result = await state.submitEnvelope(envelopeForModel100Submit('m100_route_probe'));
    assert.notEqual(result.code, 'home_dispatch_blocked', 'model100_submit_must_not_be_routed_to_home_dispatch');
    assert.notEqual(result.routed_by, 'llm', 'model100_submit_must_not_fall_back_to_llm_dispatch');
    return { key: 'server_model100_submit_is_not_misrouted_to_home_dispatch', status: 'PASS' };
  } finally {
    cleanupTempServerState(tempRoot);
  }
}

async function test_server_model100_submit_recovers_stale_inflight_before_submit() {
  const { tempRoot, state } = await createTempServerState('dy-0260-stale-inflight-');
  try {
    await state.activateRuntimeMode('running');
    state.runtime.addLabel(state.runtime.getModel(100), 0, 0, 0, { k: 'submit_inflight', t: 'bool', v: true });
    state.runtime.addLabel(state.runtime.getModel(100), 0, 0, 0, { k: 'submit_inflight_started_at', t: 'int', v: Date.now() - 60000 });
    state.runtime.addLabel(state.runtime.getModel(100), 0, 0, 0, { k: 'status', t: 'str', v: 'loading' });

    const result = await state.submitEnvelope(envelopeForModel100Submit('m100_stale_probe'));
    assert.notEqual(result.code, 'busy', 'stale_model100_submit_inflight_must_not_block_new_submit');
    const snap = state.clientSnap();
    const labels = snap.models['100']?.cells?.['0,0,0']?.labels || {};
    assert.notEqual(labels.submit_inflight?.v, true, 'stale_inflight_must_not_remain_true_after_recovery_attempt');
    return { key: 'server_model100_submit_recovers_stale_inflight_before_submit', status: 'PASS' };
  } finally {
    cleanupTempServerState(tempRoot);
  }
}

async function test_server_snapshot_recovers_stale_model100_inflight_preemptively() {
  const { tempRoot, state } = await createTempServerState('dy-0260-stale-snap-');
  try {
    state.runtime.addLabel(state.runtime.getModel(100), 0, 0, 0, { k: 'submit_inflight', t: 'bool', v: true });
    state.runtime.addLabel(state.runtime.getModel(100), 0, 0, 0, { k: 'submit_inflight_started_at', t: 'int', v: Date.now() - 60000 });
    state.runtime.addLabel(state.runtime.getModel(100), 0, 0, 0, { k: 'status', t: 'str', v: 'loading' });
    const snap = state.clientSnap();
    const labels = snap.models['100']?.cells?.['0,0,0']?.labels || {};
    assert.equal(labels.submit_inflight?.v, false, 'server_snapshot_must_clear_stale_submit_inflight_before_browser_reads_it');
    assert.equal(labels.status?.v, 'ready', 'server_snapshot_must_restore_ready_status_after_stale_inflight_recovery');
    return { key: 'server_snapshot_recovers_stale_model100_inflight_preemptively', status: 'PASS' };
  } finally {
    cleanupTempServerState(tempRoot);
  }
}

const tests = [
  test_server_model100_submit_is_not_misrouted_to_home_dispatch,
  test_server_model100_submit_recovers_stale_inflight_before_submit,
  test_server_snapshot_recovers_stale_model100_inflight_preemptively,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    const result = await test();
    console.log(`[PASS] ${result.key}`);
    passed += 1;
  } catch (error) {
    console.log(`[FAIL] ${test.name}: ${error.message}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
