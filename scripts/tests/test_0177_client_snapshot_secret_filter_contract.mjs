#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const repoRoot = resolve(import.meta.dirname, '..', '..');

async function waitForServer(baseUrl, child) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 20000) {
    if (child.exitCode !== null) {
      throw new Error(`server exited early with code=${child.exitCode}`);
    }
    try {
      const resp = await fetch(`${baseUrl}/snapshot`);
      if (resp.ok) return;
    } catch (_) {
      // keep polling
    }
    await new Promise((resolveLater) => setTimeout(resolveLater, 200));
  }
  throw new Error('timeout_waiting_for_server');
}

async function startServerForContractTest() {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0177-secret-filter-'));
  const port = 39000 + Math.floor(Math.random() * 1000);
  const modelTablePatch = JSON.stringify({
    version: 'mt.v0',
    op_id: 'test_0177_secret_snapshot_bootstrap',
    records: [
      { op: 'add_label', model_id: 0, p: 0, r: 0, c: 0, k: 'matrix_server', t: 'matrix.server', v: 'http://synapse.local:8008' },
      { op: 'add_label', model_id: 0, p: 0, r: 0, c: 0, k: 'matrix_user', t: 'matrix.user', v: '@drop:localhost' },
      { op: 'add_label', model_id: 0, p: 0, r: 0, c: 0, k: 'matrix_passwd', t: 'matrix.passwd', v: 'super-secret-password' },
      { op: 'add_label', model_id: 0, p: 0, r: 0, c: 0, k: 'matrix_token', t: 'matrix.token', v: 'secret-token-value' },
    ],
  });
  const env = {
    ...process.env,
    DY_AUTH: '0',
    HOST: '127.0.0.1',
    PORT: String(port),
    MODELTABLE_PATCH_JSON: modelTablePatch,
    WORKER_BASE_WORKSPACE: `it0177_secret_filter_${Date.now()}`,
    WORKER_BASE_DATA_ROOT: join(tempRoot, 'runtime'),
    DOCS_ROOT: join(tempRoot, 'docs'),
    STATIC_PROJECTS_ROOT: join(tempRoot, 'static_projects'),
  };
  const child = spawn('bun', ['packages/ui-model-demo-server/server.mjs'], {
    cwd: repoRoot,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await waitForServer(baseUrl, child);
    return { child, baseUrl, tempRoot, stdoutRef: () => stdout, stderrRef: () => stderr };
  } catch (err) {
    child.kill('SIGTERM');
    rmSync(tempRoot, { recursive: true, force: true });
    throw new Error(`${err.message}\nstdout:\n${stdout}\nstderr:\n${stderr}`);
  }
}

async function stopServer(handle) {
  if (handle.child.exitCode === null) {
    handle.child.kill('SIGTERM');
    await new Promise((resolveLater) => {
      handle.child.once('exit', resolveLater);
      setTimeout(resolveLater, 3000);
    });
  }
  rmSync(handle.tempRoot, { recursive: true, force: true });
}

async function getJson(baseUrl, pathname) {
  const resp = await fetch(`${baseUrl}${pathname}`);
  return { status: resp.status, json: await resp.json() };
}

const handle = await startServerForContractTest();
try {
  const snapshotResp = await getJson(handle.baseUrl, '/snapshot');
  assert.equal(snapshotResp.status, 200, 'snapshot endpoint must be reachable');

  const rootLabels = snapshotResp.json?.snapshot?.models?.['0']?.cells?.['0,0,0']?.labels || {};
  assert.equal(rootLabels.matrix_token, undefined, 'client snapshot must not expose matrix_token');
  assert.equal(rootLabels.matrix_passwd, undefined, 'client snapshot must not expose matrix_passwd');

  const snapshotJson = JSON.stringify(snapshotResp.json?.snapshot || {});
  assert.equal(snapshotJson.includes('matrix_token'), false, 'client-facing snapshot payload must not leak matrix_token via ui_ast_v0');
  assert.equal(snapshotJson.includes('matrix_passwd'), false, 'client-facing snapshot payload must not leak matrix_passwd via ui_ast_v0');
  assert.equal(snapshotJson.includes('secret-token-value'), false, 'client-facing snapshot payload must not leak matrix token value via ui_ast_v0');
  assert.equal(snapshotJson.includes('super-secret-password'), false, 'client-facing snapshot payload must not leak matrix password value via ui_ast_v0');
} finally {
  await stopServer(handle);
}

console.log('PASS test_0177_client_snapshot_secret_filter_contract');
