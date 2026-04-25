#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function mailboxEnvelope(action, options = {}) {
  const payload = {
    action,
    meta: { op_id: options.opId || `${action}_${Date.now()}` },
  };
  if (options.target) payload.target = options.target;
  if (options.value !== undefined) payload.value = options.value;
  return {
    event_id: Date.now(),
    type: action,
    payload,
    source: 'ui_renderer',
    ts: Date.now(),
  };
}

function stateLabels(snapshot) {
  return snapshot?.models?.['-2']?.cells?.['0,0,0']?.labels ?? {};
}

const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0182-workspace-init-'));
process.env.DY_AUTH = '0';
process.env.WORKER_BASE_WORKSPACE = `it0182_workspace_${Date.now()}`;
process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
process.env.DOCS_ROOT = join(tempRoot, 'docs');
process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static_projects');

const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
const state = createServerState({ dbPath: null });

try {
  const startupLabels = stateLabels(state.clientSnap());
  const startupRegistry = Array.isArray(startupLabels.ws_apps_registry?.v) ? startupLabels.ws_apps_registry.v : [];
  assert.ok(startupRegistry.length > 0, 'startup workspace registry must contain at least one app');

  let result = await state.submitEnvelope(mailboxEnvelope('label_update', {
    opId: 'workspace_route_init_workspace',
    target: { model_id: -2, p: 0, r: 0, c: 0, k: 'ui_page' },
    value: { t: 'str', v: 'workspace' },
  }));
  assert.equal(result.result, 'ok', 'ui_page workspace label_update must succeed');

  let afterWorkspaceLabels = stateLabels(state.clientSnap());
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

  result = await state.submitEnvelope(mailboxEnvelope('label_update', {
    opId: 'workspace_route_init_select_alt',
    target: { model_id: -2, p: 0, r: 0, c: 0, k: 'ws_app_selected' },
    value: { t: 'int', v: alternative.model_id },
  }));
  assert.equal(result.result, 'ok', 'ws_app_selected label_update must succeed');

  afterWorkspaceLabels = stateLabels(state.clientSnap());
  assert.equal(
    String(afterWorkspaceLabels.selected_model_id?.v),
    String(alternative.model_id),
    'changing ws_app_selected inside workspace must keep selected_model_id synchronized',
  );
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
  delete process.env.WORKER_BASE_WORKSPACE;
  delete process.env.WORKER_BASE_DATA_ROOT;
  delete process.env.DOCS_ROOT;
  delete process.env.STATIC_PROJECTS_ROOT;
}

console.log('PASS test_0182_workspace_route_init_contract');
