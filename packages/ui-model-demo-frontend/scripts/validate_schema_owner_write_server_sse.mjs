#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function envelope(action, target, value) {
  return {
    event_id: Date.now(),
    type: action,
    payload: {
      action,
      meta: { op_id: `${action}_${Date.now()}` },
      target,
      value,
    },
    source: 'ui_renderer',
    ts: Date.now(),
  };
}

const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0255-schema-owner-'));
process.env.DY_AUTH = '0';
process.env.DY_PERSISTED_ASSET_ROOT = '';
process.env.WORKER_BASE_WORKSPACE = `it0255_schema_owner_${Date.now()}`;
process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
process.env.DOCS_ROOT = join(tempRoot, 'docs');
process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static_projects');

const { createServerState } = await import(new URL('../../ui-model-demo-server/server.mjs', import.meta.url));
const state = createServerState({ dbPath: null });

try {
  await state.activateRuntimeMode('running');
  const result = await state.submitEnvelope(envelope(
    'ui_owner_label_update',
    { model_id: 1001, p: 0, r: 0, c: 0, k: 'applicant' },
    { t: 'str', v: 'owner-write-user' },
  ));
  assert.equal(result.result, 'ok', 'ui_owner_label_update_failed');
  assert.equal(result.routed_by, 'pin', 'ui_owner_label_update_must_route_by_pin');
  const snap = state.clientSnap();
  assert.equal(
    snap.models['1001'].cells['0,0,0'].labels.applicant?.v,
    'owner-write-user',
    'owner_write_value_must_materialize',
  );
  console.log('validate_schema_owner_write_server_sse: PASS');
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
  delete process.env.WORKER_BASE_WORKSPACE;
  delete process.env.WORKER_BASE_DATA_ROOT;
  delete process.env.DOCS_ROOT;
  delete process.env.STATIC_PROJECTS_ROOT;
  delete process.env.DY_PERSISTED_ASSET_ROOT;
}
