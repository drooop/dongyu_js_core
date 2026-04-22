#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const EDITOR_MODEL_ID = -1;

function wait(ms = 120) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0329-last-op-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0329_lastop_${Date.now()}`;
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

function pinEnvelope(target, pin, value = undefined) {
  return {
    event_id: Date.now(),
    type: pin,
    payload: {
      meta: { op_id: `it0329_pin_${Date.now()}` },
      target,
      pin,
      ...(value !== undefined ? { value } : {}),
    },
    source: 'ui_renderer',
    ts: Date.now(),
  };
}

async function main() {
  await withServerState(async (state) => {
    const envelope = pinEnvelope(
      { model_id: 100, p: 1, r: 0, c: 0 },
      'click',
      { input_value: 'snapshot-release-check' },
    );
    const expectedOpId = envelope.payload.meta.op_id;
    const result = await state.submitEnvelope(envelope);
    assert.equal(result?.result, 'ok', 'pin_submit_must_be_accepted');
    await wait();
    const live = state.runtime.getCell(state.runtime.getModel(EDITOR_MODEL_ID), 0, 0, 1).labels.get('bus_event_last_op_id')?.v;
    const snap = state.clientSnap().models['-1']?.cells?.['0,0,1']?.labels?.bus_event_last_op_id?.v;
    assert.equal(live, expectedOpId, 'runtime_mailbox_last_op_id_must_track_latest_pin_submit');
    assert.equal(snap, expectedOpId, 'snapshot_mailbox_last_op_id_must_track_latest_pin_submit');
    console.log('PASS test_0329_bus_event_last_op_id_snapshot_contract');
  });
}

main().catch((err) => {
  console.error(`FAIL test_0329_bus_event_last_op_id_snapshot_contract: ${err.message}`);
  process.exit(1);
});
