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
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0182-workspace-init-'));
  const port = 39200 + Math.floor(Math.random() * 300);
  const env = {
    ...process.env,
    DY_AUTH: '0',
    HOST: '127.0.0.1',
    PORT: String(port),
    WORKER_BASE_WORKSPACE: `it0182_workspace_${Date.now()}`,
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

async function postJson(baseUrl, pathname, body) {
  const resp = await fetch(`${baseUrl}${pathname}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: resp.status, json: await resp.json() };
}

function buildUiEventEnvelope(action, extra = {}) {
  const extraMeta = extra && extra.meta && typeof extra.meta === 'object' ? extra.meta : null;
  const { meta: _ignoredMeta, ...rest } = extra || {};
  return {
    event_id: Date.now(),
    type: action,
    source: { node_type: 'Button', node_id: `${action}_btn` },
    ts: 0,
    payload: {
      action,
      meta: { op_id: `op_${action}_${Date.now()}_${Math.random().toString(16).slice(2)}`, ...(extraMeta || {}) },
      ...rest,
    },
  };
}

function stateLabels(snapshotJson) {
  return snapshotJson?.snapshot?.models?.['-2']?.cells?.['0,0,0']?.labels ?? {};
}

async function test_workspace_route_init_contract() {
  const handle = await startServerForContractTest();
  try {
    const startup = await getJson(handle.baseUrl, '/snapshot');
    assert.equal(startup.status, 200, 'snapshot endpoint must be reachable');
    const startupLabels = stateLabels(startup.json);
    const startupRegistry = Array.isArray(startupLabels.ws_apps_registry?.v) ? startupLabels.ws_apps_registry.v : [];
    assert.ok(startupRegistry.length > 0, 'startup workspace registry must contain at least one app');

    const toWorkspace = await postJson(handle.baseUrl, '/ui_event', buildUiEventEnvelope('label_update', {
      target: { model_id: -2, p: 0, r: 0, c: 0, k: 'ui_page' },
      value: { t: 'str', v: 'workspace' },
    }));
    assert.equal(toWorkspace.status, 200, 'ui_page workspace label_update must be accepted');
    assert.equal(toWorkspace.json?.result, 'ok', 'ui_page workspace label_update must succeed');

    const afterWorkspace = await getJson(handle.baseUrl, '/snapshot');
    const afterWorkspaceLabels = stateLabels(afterWorkspace.json);
    const selectedPage = afterWorkspaceLabels.ui_page?.v;
    const selectedApp = afterWorkspaceLabels.ws_app_selected?.v;
    const selectedModelId = afterWorkspaceLabels.selected_model_id?.v;

    assert.equal(selectedPage, 'workspace', 'ui_page must be workspace after route update');
    assert.ok(Number.isInteger(selectedApp) && selectedApp !== 0, 'workspace route must resolve a non-zero ws_app_selected');
    assert.equal(
      String(selectedModelId),
      String(selectedApp),
      'entering workspace must synchronize selected_model_id with ws_app_selected',
    );

    const registry = Array.isArray(afterWorkspaceLabels.ws_apps_registry?.v) ? afterWorkspaceLabels.ws_apps_registry.v : [];
    const alternative = registry.find((item) => item && Number.isInteger(item.model_id) && item.model_id !== selectedApp);
    assert.ok(alternative, 'workspace registry must offer an alternative app for selection sync testing');

    const selectAlternative = await postJson(handle.baseUrl, '/ui_event', buildUiEventEnvelope('label_update', {
      target: { model_id: -2, p: 0, r: 0, c: 0, k: 'ws_app_selected' },
      value: { t: 'int', v: alternative.model_id },
    }));
    assert.equal(selectAlternative.status, 200, 'ws_app_selected label_update must be accepted');
    assert.equal(selectAlternative.json?.result, 'ok', 'ws_app_selected label_update must succeed');

    const afterSelection = await getJson(handle.baseUrl, '/snapshot');
    const afterSelectionLabels = stateLabels(afterSelection.json);
    assert.equal(
      String(afterSelectionLabels.selected_model_id?.v),
      String(alternative.model_id),
      'changing ws_app_selected inside workspace must keep selected_model_id synchronized',
    );
  } finally {
    await stopServer(handle);
  }
}

await test_workspace_route_init_contract();

console.log('PASS test_0182_workspace_route_init_contract');
