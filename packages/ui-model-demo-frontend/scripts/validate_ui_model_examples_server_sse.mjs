#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildAstFromSchema } from '../src/ui_schema_projection.js';
import { resolveRouteUiAst } from '../src/route_ui_projection.js';
import {
  EDITOR_STATE_MODEL_ID,
  UI_EXAMPLE_CHILD_MODEL_ID,
  UI_EXAMPLE_PARENT_MODEL_ID,
  UI_EXAMPLE_PROMOTE_CHILD_ACTION,
  UI_EXAMPLE_SCHEMA_MODEL_ID,
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

const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0215-ui-model-examples-'));

process.env.DY_AUTH = '0';
process.env.WORKER_BASE_WORKSPACE = `it0215_ui_model_examples_${Date.now()}`;
process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
process.env.DOCS_ROOT = join(tempRoot, 'docs');
process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static_projects');

const { createServerState } = await import(new URL('../../ui-model-demo-server/server.mjs', import.meta.url));
const state = createServerState({ dbPath: null });

try {
  let snapshot = state.clientSnap();
  const workspaceRegistry = snapshot?.models?.['-2']?.cells?.['0,0,0']?.labels?.ws_apps_registry?.v;
  assert(Array.isArray(workspaceRegistry), 'server_workspace_registry_missing');
  assert(workspaceRegistry.some((entry) => entry?.model_id === UI_EXAMPLE_SCHEMA_MODEL_ID), 'server_workspace_registry_missing_schema_example');
  assert(workspaceRegistry.some((entry) => entry?.model_id === UI_EXAMPLE_PARENT_MODEL_ID), 'server_workspace_registry_missing_parent_example');
  assert(workspaceRegistry.every((entry) => entry?.model_id !== UI_EXAMPLE_CHILD_MODEL_ID), 'server_workspace_registry_must_not_expose_child_example');

  let result = await state.submitEnvelope(mailboxEnvelope('label_update', {
    opId: 'ui_examples_set_workspace_page',
    target: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'ui_page' },
    value: { t: 'str', v: 'workspace' },
  }));
  assert.equal(result.result, 'ok', 'server_ui_page_switch_failed');

  result = await state.submitEnvelope(mailboxEnvelope('label_update', {
    opId: 'ui_examples_select_parent',
    target: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'ws_app_selected' },
    value: { t: 'int', v: UI_EXAMPLE_PARENT_MODEL_ID },
  }));
  assert.equal(result.result, 'ok', 'server_workspace_parent_select_failed');

  snapshot = state.clientSnap();
  let ast = resolveRouteUiAst(snapshot, '/workspace', { projectSchemaModel: buildAstFromSchema }).ast;
  assert.equal(findNodeById(ast, 'ui_examples_parent_root')?.type, 'Container', 'server_parent_root_missing');
  assert.equal(findNodeById(ast, 'ui_examples_parent_include_child')?.type, 'Include', 'server_parent_include_missing');
  assert.equal(
    snapshot?.models?.[String(UI_EXAMPLE_CHILD_MODEL_ID)]?.cells?.['0,0,0']?.labels?.review_stage?.v,
    'draft',
    'server_child_stage_baseline_missing',
  );

  await state.activateRuntimeMode('running');

  result = await state.submitEnvelope(mailboxEnvelope(UI_EXAMPLE_PROMOTE_CHILD_ACTION, {
    opId: 'ui_examples_promote_review',
    target: { model_id: UI_EXAMPLE_CHILD_MODEL_ID, p: 0, r: 0, c: 0, k: 'review_stage' },
  }));
  assert.equal(result.result, 'ok', 'server_ui_examples_promote_review_failed');

  snapshot = state.clientSnap();
  assert.equal(
    snapshot?.models?.[String(UI_EXAMPLE_CHILD_MODEL_ID)]?.cells?.['0,0,0']?.labels?.review_stage?.v,
    'review',
    'server_ui_examples_child_stage_not_promoted_to_review',
  );
  assert.match(
    String(snapshot?.models?.[String(UI_EXAMPLE_PARENT_MODEL_ID)]?.cells?.['0,0,0']?.labels?.data_path_status?.v || ''),
    /review/,
    'server_parent_status_must_reflect_review_transition',
  );
  assert.match(
    String(snapshot?.models?.[String(UI_EXAMPLE_CHILD_MODEL_ID)]?.cells?.['0,0,0']?.labels?.audit_log?.v || ''),
    /review/,
    'server_child_audit_log_must_record_review_transition',
  );

  result = await state.submitEnvelope(mailboxEnvelope(UI_EXAMPLE_PROMOTE_CHILD_ACTION, {
    opId: 'ui_examples_promote_approved',
    target: { model_id: UI_EXAMPLE_CHILD_MODEL_ID, p: 0, r: 0, c: 0, k: 'review_stage' },
  }));
  assert.equal(result.result, 'ok', 'server_ui_examples_promote_approved_failed');

  snapshot = state.clientSnap();
  assert.equal(
    snapshot?.models?.[String(UI_EXAMPLE_CHILD_MODEL_ID)]?.cells?.['0,0,0']?.labels?.review_stage?.v,
    'approved',
    'server_ui_examples_child_stage_not_promoted_to_approved',
  );

  ast = resolveRouteUiAst(snapshot, '/workspace', { projectSchemaModel: buildAstFromSchema }).ast;
  assert.equal(findNodeById(ast, 'ui_examples_parent_root')?.type, 'Container', 'server_parent_root_must_survive_promotions');
  assert.equal(findNodeById(ast, 'ui_examples_parent_promote_button')?.type, 'Button', 'server_parent_action_button_missing_after_promotions');
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
  delete process.env.WORKER_BASE_WORKSPACE;
  delete process.env.WORKER_BASE_DATA_ROOT;
  delete process.env.DOCS_ROOT;
  delete process.env.STATIC_PROJECTS_ROOT;
}

console.log('validate_ui_model_examples_server_sse: PASS');
