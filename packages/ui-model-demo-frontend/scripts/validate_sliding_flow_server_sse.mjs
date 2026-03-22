#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildAstFromSchema } from '../src/ui_schema_projection.js';
import { resolveRouteUiAst } from '../src/route_ui_projection.js';
import {
  ACTION_LIFECYCLE_MODEL_ID,
  EDITOR_STATE_MODEL_ID,
  FLOW_SHELL_TAB_LABEL,
  SCENE_CONTEXT_MODEL_ID,
} from '../src/model_ids.js';

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

function findNodeById(ast, id) {
  let found = null;
  const visit = (node) => {
    if (!node || typeof node !== 'object' || found) return;
    if (node.id === id) {
      found = node;
      return;
    }
    const children = Array.isArray(node.children) ? node.children : [];
    for (const child of children) visit(child);
  };
  visit(ast);
  return found;
}

const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0214-sliding-flow-server-'));
process.env.DY_AUTH = '0';
process.env.WORKER_BASE_WORKSPACE = `it0214_sliding_flow_server_${Date.now()}`;
process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
process.env.DOCS_ROOT = join(tempRoot, 'docs');
process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static_projects');

const { createServerState } = await import(new URL('../../ui-model-demo-server/server.mjs', import.meta.url));
const state = createServerState({ dbPath: null });

try {
  state.runtime.addLabel(state.runtime.getModel(SCENE_CONTEXT_MODEL_ID), 0, 0, 0, {
    k: 'scene_context',
    t: 'json',
    v: {
      current_app: 100,
      active_flow: 'submit_color_request',
      flow_step: 2,
      recent_intents: [{ action: 'submit', op_id: 'op_server_validator', ts: 123, model_id: 100 }],
      last_action_result: null,
      session_vars: { mode: 'server-validator' },
    },
  });
  state.runtime.addLabel(state.runtime.getModel(ACTION_LIFECYCLE_MODEL_ID), 0, 0, 1, {
    k: 'action_lifecycle',
    t: 'json',
    v: {
      op_id: 'op_server_validator',
      action: 'submit',
      status: 'running',
      started_at: 123,
      completed_at: null,
      result: null,
      confidence: 0.95,
    },
  });

  let result = await state.submitEnvelope(mailboxEnvelope('label_update', {
    opId: 'server_flow_route_workspace',
    target: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'ui_page' },
    value: { t: 'str', v: 'workspace' },
  }));
  assert.equal(result.result, 'ok', 'server workspace route init failed');

  result = await state.submitEnvelope(mailboxEnvelope('label_update', {
    opId: 'server_flow_select_model100',
    target: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'ws_app_selected' },
    value: { t: 'int', v: 100 },
  }));
  assert.equal(result.result, 'ok', 'server ws_app_selected update failed');

  let snapshot = state.clientSnap();
  let ast = resolveRouteUiAst(snapshot, '/workspace', { projectSchemaModel: buildAstFromSchema }).ast;
  assert.equal(findNodeById(ast, 'sliding_flow_root')?.type, 'Container', 'server sliding_flow_root_missing');
  assert.equal(findNodeById(ast, 'sliding_flow_tabs')?.type, 'Tabs', 'server sliding_flow_tabs_missing');
  assert.equal(findNodeById(ast, 'sliding_flow_debug_table')?.type, 'Table', 'server sliding_flow_debug_table_missing');
  assert.equal(findNodeById(ast, 'schema_root_100')?.type, 'Container', 'server selected_app_schema_missing');

  await state.activateRuntimeMode('running');
  result = await state.submitEnvelope(mailboxEnvelope('matrix_debug_summarize', {
    opId: 'server_flow_debug_summarize',
    target: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'matrix_debug_subject_selected' },
  }));
  assert.equal(result.result, 'ok', 'server matrix_debug_summarize failed');

  result = await state.submitEnvelope(mailboxEnvelope('label_update', {
    opId: 'server_flow_switch_debug_tab',
    target: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: FLOW_SHELL_TAB_LABEL },
    value: { t: 'str', v: 'debug' },
  }));
  assert.equal(result.result, 'ok', 'server flow_tab_selected update failed');

  snapshot = state.clientSnap();
  assert.equal(
    snapshot?.models?.['-2']?.cells?.['0,0,0']?.labels?.flow_tab_selected?.v,
    'debug',
    'server snapshot must reflect flow_tab_selected=debug',
  );

  ast = resolveRouteUiAst(snapshot, '/workspace', { projectSchemaModel: buildAstFromSchema }).ast;
  assert.equal(findNodeById(ast, 'sliding_flow_root')?.type, 'Container', 'server shell must survive debug summarize');
  assert.equal(findNodeById(ast, 'sliding_flow_process_table')?.type, 'Table', 'server process table missing after debug summarize');

  const promptAst = resolveRouteUiAst(snapshot, '/prompt', { projectSchemaModel: buildAstFromSchema }).ast;
  assert.equal(findNodeById(promptAst, 'sliding_flow_root'), null, 'prompt route must not reuse sliding flow shell on server snapshot');
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
  delete process.env.WORKER_BASE_WORKSPACE;
  delete process.env.WORKER_BASE_DATA_ROOT;
  delete process.env.DOCS_ROOT;
  delete process.env.STATIC_PROJECTS_ROOT;
}

console.log('validate_sliding_flow_server_sse: PASS');
