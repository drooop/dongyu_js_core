#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const EDITOR_MODEL_ID = -1;

function wait(ms = 200) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0330-model100-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0330_model100_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  process.env.DY_UI_SERVER_WORKER_ID = 'ui-server-it0330';
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
    delete process.env.DY_UI_SERVER_WORKER_ID;
  }
}

function pinEnvelope(target, pin, value = undefined) {
  return {
    event_id: Date.now(),
    type: pin,
    payload: {
      meta: { op_id: `it0330_${Date.now()}` },
      target,
      pin,
      ...(value !== undefined ? { value } : {}),
    },
    source: 'ui_renderer',
    ts: Date.now(),
  };
}

function tempPayload(records = []) {
  return [
    { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'ui_event.v1' },
    ...records,
  ];
}

async function main() {
  await withServerState(async (state) => {
    const published = [];
    state.programEngine.matrixAdapter = { publish: async (packet) => published.push(packet) };
    state.programEngine.matrixRoomId = '!it0330:local';
    state.programEngine.matrixDmPeerUserId = '@mbr:local';

    const legacyObjectResult = await state.submitEnvelope(pinEnvelope(
      { model_id: 100, p: 1, r: 0, c: 0 },
      'click',
      { input_value: 'legacy-object-check' },
    ));
    assert.notEqual(legacyObjectResult?.result, 'ok', 'model100_direct_pin_must_reject_plain_object_payload');

    const result = await state.submitEnvelope(pinEnvelope(
      { model_id: 100, p: 1, r: 0, c: 0 },
      'click',
      tempPayload([{ id: 0, p: 0, r: 0, c: 0, k: 'input_value', t: 'str', v: '0330-local-check' }]),
    ));
    assert.equal(result?.result, 'ok', 'model100_local_click_must_be_accepted');
    await wait(800);
    const snap = state.clientSnap();
    const root = snap.models['100']?.cells?.['0,0,0']?.labels ?? {};
    const model0Root = snap.models['0']?.cells?.['0,0,0']?.labels ?? {};
    const err = root.__error_prepare_model100_submit_from_pin?.v ?? null;
    assert.equal(err, null, 'model100_local_submit_must_not_leave_prepare_error');
    assert.equal(root.status?.v, 'loading', 'model100_local_submit_must_wait_for_remote_result_after_generated_publish');
    assert.equal(root.submit_inflight?.v, true, 'model100_local_submit_must_stay_inflight_until_remote_result');
    assert.equal(Object.prototype.hasOwnProperty.call(model0Root, 'model100_submit_out'), false, 'model100_local_submit_must_not_create_old_model0_egress_label');
    assert.equal(published.length, 1, 'model100_local_submit_must_publish_once_through_generated_adapter');
    assert.deepEqual(published[0]?.route?.to, { worker_id: 'RE', model_id: 100, pin: 'submit' });
    assert.deepEqual(published[0]?.route?.reply_to, { worker_id: 'ui-server-it0330', model_id: 100, pin: 'result' });
    const mailboxLast = snap.models[String(EDITOR_MODEL_ID)]?.cells?.['0,0,1']?.labels?.bus_event_last_op_id?.v;
    assert.ok(typeof mailboxLast === 'string' && mailboxLast.length > 0, 'model100_local_submit_must_update_bus_event_last_op_id');
    console.log('PASS test_0330_model100_local_submit_contract');
  });
}

main().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error(`FAIL test_0330_model100_local_submit_contract: ${err.message}`);
  process.exit(1);
});
