#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0177-secret-filter-'));

process.env.DY_AUTH = '0';
process.env.WORKER_BASE_WORKSPACE = `it0177_secret_filter_${Date.now()}`;
process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
process.env.DOCS_ROOT = join(tempRoot, 'docs');
process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static_projects');
process.env.MODELTABLE_PATCH_JSON = JSON.stringify({
  version: 'mt.v0',
  op_id: 'test_0177_secret_snapshot_bootstrap',
  records: [
    { op: 'add_label', model_id: 0, p: 0, r: 0, c: 0, k: 'matrix_server', t: 'matrix.server', v: 'http://synapse.local:8008' },
    { op: 'add_label', model_id: 0, p: 0, r: 0, c: 0, k: 'matrix_user', t: 'matrix.user', v: '@drop:localhost' },
    { op: 'add_label', model_id: 0, p: 0, r: 0, c: 0, k: 'matrix_passwd', t: 'matrix.passwd', v: 'super-secret-password' },
    { op: 'add_label', model_id: 0, p: 0, r: 0, c: 0, k: 'matrix_token', t: 'matrix.token', v: 'secret-token-value' },
  ],
});

const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
const state = createServerState({ dbPath: null });

try {
  const snapshot = state.clientSnap();
  const rootLabels = snapshot?.models?.['0']?.cells?.['0,0,0']?.labels || {};

  assert.equal(rootLabels.matrix_token, undefined, 'client snapshot must not expose matrix_token');
  assert.equal(rootLabels.matrix_passwd, undefined, 'client snapshot must not expose matrix_passwd');

  const snapshotJson = JSON.stringify(snapshot || {});
  assert.equal(snapshotJson.includes('matrix_token'), false, 'client-facing snapshot payload must not leak matrix_token via ui_ast_v0');
  assert.equal(snapshotJson.includes('matrix_passwd'), false, 'client-facing snapshot payload must not leak matrix_passwd via ui_ast_v0');
  assert.equal(snapshotJson.includes('secret-token-value'), false, 'client-facing snapshot payload must not leak matrix token value via ui_ast_v0');
  assert.equal(snapshotJson.includes('super-secret-password'), false, 'client-facing snapshot payload must not leak matrix password value via ui_ast_v0');
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
  delete process.env.MODELTABLE_PATCH_JSON;
  delete process.env.WORKER_BASE_WORKSPACE;
  delete process.env.WORKER_BASE_DATA_ROOT;
  delete process.env.DOCS_ROOT;
  delete process.env.STATIC_PROJECTS_ROOT;
}

console.log('PASS test_0177_client_snapshot_secret_filter_contract');
