#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function wait(ms = 160) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

async function withServerState(fn, options = {}) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0303-hard-cut-'));
  const previousWorkerId = process.env.DY_UI_SERVER_WORKER_ID;
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.DY_UI_SERVER_WORKER_ID = options.workerId || 'ui-server-0303';
  process.env.WORKER_BASE_WORKSPACE = `it0303_hard_cut_${Date.now()}`;
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
    if (previousWorkerId == null) {
      delete process.env.DY_UI_SERVER_WORKER_ID;
    } else {
      process.env.DY_UI_SERVER_WORKER_ID = previousWorkerId;
    }
  }
}

function payloadFor(text) {
  return [
    { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.single', v: 'Data.RemoteSubmit' },
    { id: 0, p: 0, r: 0, c: 0, k: 'message_text', t: 'str', v: text },
  ];
}

function payloadValue(packet, key) {
  const record = Array.isArray(packet?.payload)
    ? packet.payload.find((item) => item && item.k === key)
    : null;
  return record ? record.v : undefined;
}

function assertPinPayloadPacket(packet, {
  endpointModelId,
  originModelId,
  replyTargetModelId,
  workerId = 'R1',
  uiWorkerId = 'ui-server-0303',
  pin = 'submit',
}) {
  assert.deepEqual(Object.keys(packet || {}).sort(), ['payload', 'type', 'version'], 'published packet must use strict pin_payload top-level keys');
  assert.equal(packet.version, 'v1');
  assert.equal(packet.type, 'pin_payload');
  assert.equal(payloadValue(packet, '__mt_payload_kind'), 'pin_payload.v1');
  assert.ok(typeof payloadValue(packet, '__mt_request_id') === 'string' && payloadValue(packet, '__mt_request_id').length > 0);
  assert.ok(typeof payloadValue(packet, 'op_id') === 'string' && payloadValue(packet, 'op_id').length > 0);
  assert.equal(payloadValue(packet, 'endpoint_worker_id'), workerId);
  assert.equal(payloadValue(packet, 'endpoint_model_id'), endpointModelId);
  assert.equal(payloadValue(packet, 'endpoint_pin'), pin);
  assert.equal(payloadValue(packet, 'origin_worker_id'), uiWorkerId);
  assert.equal(payloadValue(packet, 'origin_model_id'), originModelId);
  assert.equal(payloadValue(packet, 'origin_pin'), pin);
  assert.equal(payloadValue(packet, 'reply_target_worker_id'), uiWorkerId);
  assert.equal(payloadValue(packet, 'reply_target_model_id'), replyTargetModelId);
  assert.equal(payloadValue(packet, 'reply_target_pin'), 'result');
  assert.ok(Array.isArray(payloadValue(packet, 'payload')), 'nested business payload must remain a ModelTable records array');
}

async function test_legacy_model0_egress_label_is_not_dispatched() {
  return withServerState(async (state) => {
    const runtime = state.runtime;
    const model0 = runtime.getModel(0);
    assert.ok(model0, 'model0_missing');
    const published = [];
    state.programEngine.matrixAdapter = { publish: async (packet) => published.push(packet) };
    state.programEngine.matrixRoomId = '!hard-cut:local';
    state.programEngine.matrixDmPeerUserId = '@mbr:local';

    runtime.addLabel(model0, 0, 0, 0, {
      k: 'model100_submit_out',
      t: 'pin.in',
      v: payloadFor('legacy must not send'),
    });
    await state.programEngine.tick();
    await wait();

    assert.equal(published.length, 0, 'legacy Model 0 egress label must not publish');
    assert.equal(
      runtime.intercepts.list().some((item) => item.type === 'run_func' && String(item.payload?.func || '').includes('forward_model100')),
      false,
      'legacy Model 0 egress label must not schedule old forward function',
    );
    return { key: 'legacy_model0_egress_label_is_not_dispatched', status: 'PASS' };
  });
}

async function test_model100_submit_pin_uses_generated_route_adapter() {
  return withServerState(async (state) => {
    const runtime = state.runtime;
    const model100 = runtime.getModel(100);
    assert.ok(model100, 'model100_missing');
    const published = [];
    state.programEngine.matrixAdapter = { publish: async (packet) => published.push(packet) };
    state.programEngine.matrixRoomId = '!route-generated:local';
    state.programEngine.matrixDmPeerUserId = '@mbr:local';

    runtime.addLabel(model100, 0, 0, 0, { k: 'submit', t: 'pin.out', v: payloadFor('model100 route') });
    await state.programEngine.tick();
    await wait();

    assert.equal(published.length, 1, 'Model 100 submit pin must publish once through generated adapter');
    assertPinPayloadPacket(published[0], { endpointModelId: 100, originModelId: 100, replyTargetModelId: 100 });
    return { key: 'model100_submit_pin_uses_generated_route_adapter', status: 'PASS' };
  });
}

async function test_indirect_seeded_models_get_generated_route_adapters() {
  return withServerState(async (state) => {
    const runtime = state.runtime;
    const published = [];
    state.programEngine.matrixAdapter = { publish: async (packet) => published.push(packet) };
    state.programEngine.matrixRoomId = '!route-generated-indirect:local';
    state.programEngine.matrixDmPeerUserId = '@mbr:local';

    for (const modelId of [1010, 1019]) {
      const model = runtime.getModel(modelId);
      assert.ok(model, `model_${modelId}_missing`);
      runtime.addLabel(model, 0, 0, 0, { k: 'submit', t: 'pin.out', v: payloadFor(`model ${modelId} route`) });
      await state.programEngine.tick();
      await wait();
    }

    const byModel = new Map(published.map((packet) => [payloadValue(packet, 'origin_model_id'), packet]));
    for (const modelId of [1010, 1019]) {
      const packet = byModel.get(modelId);
      assert.ok(packet, `model_${modelId}_must_publish_through_generated_adapter`);
      assertPinPayloadPacket(packet, { endpointModelId: modelId, originModelId: modelId, replyTargetModelId: modelId });
    }
    return { key: 'indirect_seeded_models_get_generated_route_adapters', status: 'PASS' };
  });
}

async function test_update_derived_refreshes_flow_shell_after_model100_return() {
  return withServerState(async (state) => {
    const runtime = state.runtime;
    const model100 = runtime.getModel(100);
    assert.ok(model100, 'model100_missing');

    runtime.addLabel(model100, 0, 0, 0, { k: 'status', t: 'str', v: 'loading' });
    runtime.addLabel(model100, 0, 0, 0, { k: 'submit_inflight', t: 'bool', v: true });
    runtime.addLabel(model100, 0, 0, 0, { k: 'submit_inflight_started_at', t: 'int', v: Date.now() });
    state.updateDerived();
    let snap = state.clientSnap();
    assert.equal(
      snap.models[-2].cells['0,0,0'].labels.flow_app_status_text.v,
      'loading',
      'flow shell must show model100 loading state before return',
    );

    runtime.addLabel(model100, 0, 0, 0, { k: 'status', t: 'str', v: 'processed' });
    runtime.addLabel(model100, 0, 0, 0, { k: 'submit_inflight', t: 'bool', v: false });
    state.updateDerived();
    snap = state.clientSnap();
    assert.equal(
      snap.models[-2].cells['0,0,0'].labels.flow_app_status_text.v,
      'processed',
      'flow shell must refresh from model100 after external return materializes',
    );
    assert.notEqual(
      snap.models[-2].cells['0,0,0'].labels.flow_app_status.v,
      'warning',
      'flow shell badge must not remain in loading warning after return',
    );
    return { key: 'update_derived_refreshes_flow_shell_after_model100_return', status: 'PASS' };
  });
}

async function test_client_snapshot_reads_do_not_write_modeltable_events() {
  return withServerState(async (state) => {
    state.updateDerived();
    state.clientSnap();
    state.runtime.eventLog.reset();

    state.clientSnap();
    state.clientSnap();

    assert.equal(
      state.runtime.eventLog.list().length,
      0,
      'clientSnap reads must not remove/add derived labels or append ModelTable events',
    );
    return { key: 'client_snapshot_reads_do_not_write_modeltable_events', status: 'PASS' };
  });
}

const tests = [
  test_legacy_model0_egress_label_is_not_dispatched,
  test_model100_submit_pin_uses_generated_route_adapter,
  test_indirect_seeded_models_get_generated_route_adapters,
  test_update_derived_refreshes_flow_shell_after_model100_return,
  test_client_snapshot_reads_do_not_write_modeltable_events,
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
      console.log(`[FAIL] ${test.name}: ${error.stack || error.message}`);
      failed += 1;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
  process.exit(failed > 0 ? 1 : 0);
})();
