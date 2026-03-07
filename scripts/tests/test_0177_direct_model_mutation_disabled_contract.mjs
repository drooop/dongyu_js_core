#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createLocalBusAdapter } from '../../packages/ui-model-demo-frontend/src/local_bus_adapter.js';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

const repoRoot = resolve(import.meta.dirname, '..', '..');

function buildRuntimeForAdapter() {
  const rt = new ModelTableRuntime();
  rt.createModel({ id: -1, name: 'editor_mailbox', type: 'ui' });
  rt.createModel({ id: -2, name: 'editor_state', type: 'ui' });
  rt.createModel({ id: 100, name: 'main', type: 'app' });
  return rt;
}

function mailboxEnvelope(action, extra = {}) {
  return {
    type: action,
    source: { node_type: 'Button', node_id: `${action}_btn` },
    payload: {
      action,
      meta: { op_id: `op_${action}` },
      ...extra,
    },
  };
}

function submitToAdapter(adapter, runtime, envelope) {
  const mailboxModel = runtime.getModel(-1);
  runtime.addLabel(mailboxModel, 0, 0, 1, { k: 'ui_event', t: 'event', v: envelope });
  return adapter.consumeOnce();
}

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
      // continue polling
    }
    await new Promise((resolveLater) => setTimeout(resolveLater, 200));
  }
  throw new Error('timeout_waiting_for_server');
}

async function startServerForContractTest() {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0177-server-'));
  const port = 39000 + Math.floor(Math.random() * 1000);
  const env = {
    ...process.env,
    DY_AUTH: '0',
    HOST: '127.0.0.1',
    PORT: String(port),
    WORKER_BASE_WORKSPACE: `it0177_${Date.now()}`,
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

async function postJson(baseUrl, pathname, body) {
  const resp = await fetch(`${baseUrl}${pathname}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await resp.json();
  return { status: resp.status, json };
}

async function getJson(baseUrl, pathname) {
  const resp = await fetch(`${baseUrl}${pathname}`);
  return { status: resp.status, json: await resp.json() };
}

function test_local_bus_adapter_mutations_are_disabled() {
  const runtime = buildRuntimeForAdapter();
  const adapter = createLocalBusAdapter({
    runtime,
    eventLog: [],
    mode: 'v1',
    mailboxModelId: -1,
    editorStateModelId: -2,
  });

  const createResult = submitToAdapter(adapter, runtime, mailboxEnvelope('submodel_create', {
    value: { t: 'json', v: { id: 101, name: 'M101', type: 'app' } },
  }));
  assert.equal(createResult.code, 'direct_model_mutation_disabled', 'submodel_create must be rejected');
  assert.equal(runtime.getModel(101), undefined, 'rejected submodel_create must not create model');

  const addLabelResult = submitToAdapter(adapter, runtime, mailboxEnvelope('label_add', {
    target: { model_id: 100, p: 1, r: 1, c: 1, k: 'title' },
    value: { t: 'str', v: 'hello' },
  }));
  assert.equal(addLabelResult.code, 'direct_model_mutation_disabled', 'label_add must be rejected');

  const cell = runtime.getCell(runtime.getModel(100), 1, 1, 1);
  assert.equal(cell.labels.has('title'), false, 'rejected label_add must not write target label');

  const removeResult = submitToAdapter(adapter, runtime, mailboxEnvelope('datatable_remove_label', {
    target: { model_id: 100, p: 1, r: 1, c: 1, k: 'title' },
  }));
  assert.equal(removeResult.code, 'direct_model_mutation_disabled', 'datatable_remove_label must be rejected');
}

async function test_ui_server_patch_api_disabled_and_runtime_mode_endpoint() {
  const handle = await startServerForContractTest();
  try {
    const snapshotBefore = await getJson(handle.baseUrl, '/snapshot');
    assert.equal(snapshotBefore.status, 200, 'snapshot endpoint must be reachable');
    const runtimeMode = snapshotBefore.json?.snapshot?.models?.['0']?.cells?.['0,0,0']?.labels?.runtime_mode?.v;
    assert.equal(runtimeMode, 'edit', 'ui-server must start in edit mode');

    const patchResp = await postJson(handle.baseUrl, '/api/modeltable/patch', {
      version: 'mt.v0',
      op_id: 'direct_patch_attempt',
      records: [{ op: 'create_model', model_id: 1, name: 'M1', type: 'app' }],
    });
    assert.equal(patchResp.status, 400, 'direct patch API must reject with 400');
    assert.equal(patchResp.json?.error, 'direct_patch_api_disabled', 'direct patch API must expose direct_patch_api_disabled');

    const modeResp = await postJson(handle.baseUrl, '/api/runtime/mode', { mode: 'running' });
    assert.equal(modeResp.status, 200, 'runtime mode endpoint must accept explicit activation');
    assert.equal(modeResp.json?.ok, true, 'runtime mode activation must succeed');

    const snapshotAfter = await getJson(handle.baseUrl, '/snapshot');
    const runtimeModeAfter = snapshotAfter.json?.snapshot?.models?.['0']?.cells?.['0,0,0']?.labels?.runtime_mode?.v;
    assert.equal(runtimeModeAfter, 'running', 'runtime mode endpoint must switch snapshot-visible mode to running');
  } finally {
    await stopServer(handle);
  }
}

const tests = [
  test_local_bus_adapter_mutations_are_disabled,
  test_ui_server_patch_api_disabled_and_runtime_mode_endpoint,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    await test();
    console.log(`[PASS] ${test.name}`);
    passed += 1;
  } catch (err) {
    console.log(`[FAIL] ${test.name}: ${err.message}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
