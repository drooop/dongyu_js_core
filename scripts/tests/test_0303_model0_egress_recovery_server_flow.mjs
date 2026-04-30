#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function wait(ms = 120) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

async function withServerState(fn, options = {}) {
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
    if (options.activate !== false) {
      await state.activateRuntimeMode('running');
    }
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

async function test_pending_model0_egress_is_not_rescheduled_while_unchanged() {
  return withServerState(async (state) => {
    const runtime = state.runtime;
    const model0 = runtime.getModel(0);
    const model100 = runtime.getModel(100);
    assert.ok(model0 && model100, 'required_models_missing');

    const payload = [
      { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.single', v: 'Data.RemoteSubmit' },
      { id: 0, p: 0, r: 0, c: 0, k: 'input_value', t: 'str', v: 'unchanged pending payload' },
      { id: 0, p: 0, r: 0, c: 0, k: 'route_mode', t: 'str', v: 'remote' },
    ];
    const changedPayload = [
      { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.single', v: 'Data.RemoteSubmit' },
      { id: 0, p: 0, r: 0, c: 0, k: 'input_value', t: 'str', v: 'changed pending payload' },
      { id: 0, p: 0, r: 0, c: 0, k: 'route_mode', t: 'str', v: 'remote' },
    ];

    runtime.addLabel(model0, 0, 0, 0, {
      k: 'model100_submit_out',
      t: 'pin.in',
      v: payload,
    });

    state.programEngine.eventCursor = runtime.eventLog.list().length;
    state.programEngine.interceptCursor = runtime.intercepts.list().length;

    state.programEngine.schedulePendingModel0Egress(new Set());
    state.programEngine.schedulePendingModel0Egress(new Set());

    const scheduled = runtime.intercepts.list()
      .filter((item) => item.type === 'run_func'
        && item.payload
        && item.payload.func === 'forward_model100_submit_from_model0');
    assert.equal(scheduled.length, 1, 'unchanged_pending_egress_must_only_schedule_once');

    runtime.addLabel(model0, 0, 0, 0, {
      k: 'model100_submit_out',
      t: 'pin.in',
      v: changedPayload,
    });
    state.programEngine.schedulePendingModel0Egress(new Set());

    const changedScheduled = runtime.intercepts.list()
      .filter((item) => item.type === 'run_func'
        && item.payload
        && item.payload.func === 'forward_model100_submit_from_model0');
    assert.equal(changedScheduled.length, 2, 'changed_pending_egress_must_schedule_again');

    runtime.addLabel(model0, 0, 0, 0, {
      k: 'model100_submit_out',
      t: 'pin.in',
      v: null,
    });
    state.programEngine.schedulePendingModel0Egress(new Set());

    runtime.addLabel(model0, 0, 0, 0, {
      k: 'model100_submit_out',
      t: 'pin.in',
      v: payload,
    });
    state.programEngine.schedulePendingModel0Egress(new Set());

    const rescheduled = runtime.intercepts.list()
      .filter((item) => item.type === 'run_func'
        && item.payload
        && item.payload.func === 'forward_model100_submit_from_model0');
    assert.equal(rescheduled.length, 3, 'cleared_then_readded_egress_must_schedule_again');
    return { key: 'pending_model0_egress_is_not_rescheduled_while_unchanged', status: 'PASS' };
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

async function test_runtime_activation_drains_stale_model0_egress_before_returning() {
  const previousDrainMs = process.env.DY_RUNTIME_ACTIVATION_DRAIN_MS;
  process.env.DY_RUNTIME_ACTIVATION_DRAIN_MS = '2000';
  try {
    return await withServerState(async (state) => {
      const runtime = state.runtime;
      const model0 = runtime.getModel(0);
      const model100 = runtime.getModel(100);
      assert.ok(model0 && model100, 'required_models_missing');

      runtime.addLabel(model0, 0, 0, 0, { k: 'matrix_room_id', t: 'str', v: '!test-room:local' });
      runtime.addLabel(model0, 0, 0, 0, { k: 'matrix_contuser', t: 'matrix.contuser', v: ['@peer:local'] });

      const published = [];
      state.programEngine.matrixAdapter = {
        publish: async (payload) => {
          published.push(payload);
          setTimeout(() => {
            state.programEngine.handleDyBusEvent({
              version: 'v1',
              type: 'pin_payload',
              op_id: payload.op_id,
              source_model_id: 100,
              pin: 'result',
              payload: [
                { id: 0, p: 0, r: 0, c: 0, k: 'bg_color', t: 'str', v: '#010203' },
                { id: 0, p: 0, r: 0, c: 0, k: 'status', t: 'str', v: 'processed' },
                { id: 0, p: 0, r: 0, c: 0, k: 'submit_inflight', t: 'bool', v: false },
                { id: 0, p: 0, r: 0, c: 0, k: 'submit_inflight_started_at', t: 'int', v: 0 },
              ],
            });
          }, 80);
        },
      };
      state.programEngine.matrixRoomId = '!test-room:local';
      state.programEngine.matrixDmPeerUserId = '@peer:local';

      runtime.addLabel(model100, 0, 0, 0, { k: 'submit_inflight', t: 'bool', v: true });
      runtime.addLabel(model100, 0, 0, 0, { k: 'submit_inflight_started_at', t: 'int', v: Date.now() });
      runtime.addLabel(model100, 0, 0, 0, { k: 'status', t: 'str', v: 'loading' });
      runtime.addLabel(model0, 0, 0, 0, {
        k: 'model100_submit_out',
        t: 'pin.in',
        v: [
          { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.single', v: 'Data.RemoteSubmit' },
          { id: 0, p: 0, r: 0, c: 0, k: 'input_value', t: 'str', v: 'activation stale egress' },
          { id: 0, p: 0, r: 0, c: 0, k: 'route_mode', t: 'str', v: 'remote' },
        ],
      });

      const started = Date.now();
      const result = await state.activateRuntimeMode('running');
      const elapsedMs = Date.now() - started;
      assert.equal(result.mode, 'running', 'runtime_must_activate_running');

      const snap = state.clientSnap();
      const rootLabels = snap.models?.['100']?.cells?.['0,0,0']?.labels || {};
      const model0Labels = snap.models?.['0']?.cells?.['0,0,0']?.labels || {};

      assert.equal(published.length, 1, 'stale_model0_egress_must_be_forwarded_once');
      assert.ok(elapsedMs >= 60, `activation_must_wait_for_stale_response elapsed_ms=${elapsedMs}`);
      assert.equal(model0Labels.model100_submit_out?.v ?? null, null, 'activation_drain_must_clear_stale_model0_egress');
      assert.equal(rootLabels.submit_inflight?.v, false, 'activation_drain_must_release_inflight');
      assert.equal(rootLabels.bg_color?.v, '#010203', 'activation_drain_must_apply_stale_result_before_returning');
      return { key: 'runtime_activation_drains_stale_model0_egress_before_returning', status: 'PASS' };
    }, { activate: false });
  } finally {
    if (previousDrainMs == null) {
      delete process.env.DY_RUNTIME_ACTIVATION_DRAIN_MS;
    } else {
      process.env.DY_RUNTIME_ACTIVATION_DRAIN_MS = previousDrainMs;
    }
  }
}

async function test_runtime_activation_quarantines_late_stale_model0_egress_after_timeout() {
  const previousDrainMs = process.env.DY_RUNTIME_ACTIVATION_DRAIN_MS;
  process.env.DY_RUNTIME_ACTIVATION_DRAIN_MS = '20';
  try {
    return await withServerState(async (state) => {
      const runtime = state.runtime;
      const model0 = runtime.getModel(0);
      const model100 = runtime.getModel(100);
      assert.ok(model0 && model100, 'required_models_missing');

      runtime.addLabel(model0, 0, 0, 0, { k: 'matrix_room_id', t: 'str', v: '!test-room:local' });
      runtime.addLabel(model0, 0, 0, 0, { k: 'matrix_contuser', t: 'matrix.contuser', v: ['@peer:local'] });

      const published = [];
      state.programEngine.matrixAdapter = {
        publish: async (payload) => {
          published.push(payload);
          setTimeout(() => {
            state.programEngine.handleDyBusEvent({
              version: 'v1',
              type: 'pin_payload',
              op_id: payload.op_id,
              source_model_id: 100,
              pin: 'result',
              payload: [
                { id: 0, p: 0, r: 0, c: 0, k: 'bg_color', t: 'str', v: '#0a0b0c' },
                { id: 0, p: 0, r: 0, c: 0, k: 'status', t: 'str', v: 'late_stale_processed' },
                { id: 0, p: 0, r: 0, c: 0, k: 'submit_inflight', t: 'bool', v: false },
                { id: 0, p: 0, r: 0, c: 0, k: 'submit_inflight_started_at', t: 'int', v: 0 },
              ],
            });
          }, 120);
        },
      };
      state.programEngine.matrixRoomId = '!test-room:local';
      state.programEngine.matrixDmPeerUserId = '@peer:local';

      runtime.addLabel(model100, 0, 0, 0, { k: 'bg_color', t: 'str', v: '#ffffff' });
      runtime.addLabel(model100, 0, 0, 0, { k: 'submit_inflight', t: 'bool', v: true });
      runtime.addLabel(model100, 0, 0, 0, { k: 'submit_inflight_started_at', t: 'int', v: Date.now() });
      runtime.addLabel(model100, 0, 0, 0, { k: 'status', t: 'str', v: 'loading' });
      runtime.addLabel(model0, 0, 0, 0, {
        k: 'model100_submit_out',
        t: 'pin.in',
        v: [
          { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.single', v: 'Data.RemoteSubmit' },
          { id: 0, p: 0, r: 0, c: 0, k: 'input_value', t: 'str', v: 'activation stale timeout' },
          { id: 0, p: 0, r: 0, c: 0, k: 'route_mode', t: 'str', v: 'remote' },
        ],
      });

      const result = await state.activateRuntimeMode('running');
      assert.equal(result.mode, 'running', 'runtime_must_activate_running_after_quarantine');
      assert.equal(published.length, 1, 'stale_model0_egress_must_be_forwarded_once_before_quarantine');

      const snapAfterActivation = state.clientSnap();
      const labelsAfterActivation = snapAfterActivation.models?.['100']?.cells?.['0,0,0']?.labels || {};
      assert.equal(labelsAfterActivation.submit_inflight?.v, false, 'quarantine_must_release_inflight');
      assert.equal(labelsAfterActivation.status?.v, 'activation_egress_timeout', 'quarantine_must_mark_timeout_status');

      await wait(220);

      const snapAfterLateReturn = state.clientSnap();
      const labelsAfterLateReturn = snapAfterLateReturn.models?.['100']?.cells?.['0,0,0']?.labels || {};
      assert.equal(labelsAfterLateReturn.bg_color?.v, '#ffffff', 'quarantined_late_stale_return_must_not_update_color');
      assert.equal(labelsAfterLateReturn.status?.v, 'activation_egress_timeout', 'quarantined_late_stale_return_must_not_update_status');
      assert.equal(labelsAfterLateReturn.submit_inflight?.v, false, 'quarantined_late_stale_return_must_keep_inflight_released');
      return { key: 'runtime_activation_quarantines_late_stale_model0_egress_after_timeout', status: 'PASS' };
    }, { activate: false });
  } finally {
    if (previousDrainMs == null) {
      delete process.env.DY_RUNTIME_ACTIVATION_DRAIN_MS;
    } else {
      process.env.DY_RUNTIME_ACTIVATION_DRAIN_MS = previousDrainMs;
    }
  }
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

async function test_stale_dual_bus_config_is_repaired_before_submit_forward() {
  return withServerState(async (state) => {
    const runtime = state.runtime;
    const model100 = runtime.getModel(100);
    assert.ok(model100, 'model100_missing');

    runtime.rmLabel(model100, 0, 0, 0, 'dual_bus_model');
    runtime.addLabel(model100, 0, 0, 0, {
      k: 'dual_bus_model',
      t: 'json',
      v: {
        ui_event_func: 'prepare_model100_submit',
        patch_in_func: 'on_model100_patch_in',
        patch_in_pin: 'patch',
      },
    });

    const result = await state.submitEnvelope(mailboxEnvelope('submit', {
      modelId: 100,
      value: {
        t: 'event',
        v: {
          action: 'submit',
          input_value: 'stale dual bus repair',
        },
      },
    }));
    assert.equal(result.result, 'ok', 'typed_event_submit_must_be_accepted');
    await wait();

    const snap = state.clientSnap();
    const root100 = snap.models?.['100']?.cells?.['0,0,0']?.labels || {};
    const model0Root = snap.models?.['0']?.cells?.['0,0,0']?.labels || {};
    const dualBusConfig = root100.dual_bus_model?.v || null;

    assert.equal(dualBusConfig?.model0_egress_label, 'model100_submit_out', 'stale_dual_bus_config_must_restore_model0_egress_label');
    assert.equal(dualBusConfig?.model0_egress_func, 'forward_model100_submit_from_model0', 'stale_dual_bus_config_must_restore_model0_egress_func');
    assert.equal(root100.status?.v, 'matrix_unavailable', 'repaired_dual_bus_submit_must_still_run_forward_path');
    assert.equal(root100.submit_inflight?.v, false, 'repaired_dual_bus_submit_must_release_inflight');
    assert.equal(model0Root.model100_submit_out?.v ?? null, null, 'repaired_dual_bus_submit_must_clear_model0_egress');
    return { key: 'stale_dual_bus_config_is_repaired_before_submit_forward', status: 'PASS' };
  });
}

const tests = [
  test_stale_model0_egress_payload_gets_forwarded_on_next_tick,
  test_pending_model0_egress_is_not_rescheduled_while_unchanged,
  test_runtime_activation_drains_stale_model0_egress_before_returning,
  test_runtime_activation_quarantines_late_stale_model0_egress_after_timeout,
  test_plain_object_submit_value_is_forwarded_as_event_payload,
  test_stale_dual_bus_config_is_repaired_before_submit_forward,
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
