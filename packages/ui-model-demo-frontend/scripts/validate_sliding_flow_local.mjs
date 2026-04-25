#!/usr/bin/env node

import { createDemoStore } from '../src/demo_modeltable.js';
import { buildAstFromSchema } from '../src/ui_schema_projection.js';
import { resolveRouteUiAst } from '../src/route_ui_projection.js';
import {
  ACTION_LIFECYCLE_MODEL_ID,
  EDITOR_STATE_MODEL_ID,
  FLOW_SHELL_TAB_LABEL,
  SCENE_CONTEXT_MODEL_ID,
} from '../src/model_ids.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function setRuntimeLabel(store, modelId, p, r, c, label) {
  const model = store.runtime.getModel(modelId);
  if (!model) throw new Error(`missing_model_${modelId}`);
  store.runtime.addLabel(model, p, r, c, label);
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

try {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  setRuntimeLabel(store, EDITOR_STATE_MODEL_ID, 0, 0, 0, { k: 'ws_app_selected', t: 'int', v: 100 });
  setRuntimeLabel(store, EDITOR_STATE_MODEL_ID, 0, 0, 0, { k: 'selected_model_id', t: 'str', v: '100' });
  setRuntimeLabel(store, SCENE_CONTEXT_MODEL_ID, 0, 0, 0, {
    k: 'scene_context',
    t: 'json',
    v: {
      current_app: 100,
      active_flow: 'submit_color_request',
      flow_step: 2,
      recent_intents: [{ action: 'submit', op_id: 'op_local', ts: 123, model_id: 100 }],
      last_action_result: null,
      session_vars: { mode: 'local-validator' },
    },
  });
  setRuntimeLabel(store, ACTION_LIFECYCLE_MODEL_ID, 0, 0, 1, {
    k: 'action_lifecycle',
    t: 'json',
    v: {
      op_id: 'op_local',
      action: 'submit',
      status: 'running',
      started_at: 123,
      completed_at: null,
      result: null,
      confidence: 0.9,
    },
  });
  store.refreshSnapshot();

  const resolved = resolveRouteUiAst(store.snapshot, '/workspace', { projectSchemaModel: buildAstFromSchema });
  const ast = resolved && resolved.ast && typeof resolved.ast === 'object' ? resolved.ast : null;
  assert(ast, 'workspace_ast_missing');
  assert(findNodeById(ast, 'sliding_flow_root')?.type === 'Container', 'sliding_flow_root_missing');
  assert(findNodeById(ast, 'sliding_flow_tabs')?.type === 'Tabs', 'sliding_flow_tabs_missing');
  assert(findNodeById(ast, 'sliding_flow_process_table')?.type === 'Table', 'sliding_flow_process_table_missing');
  assert(findNodeById(ast, 'sliding_flow_debug_table')?.type === 'Table', 'sliding_flow_debug_table_missing');
  assert(findNodeById(ast, 'sliding_flow_progress')?.type === 'ProgressBar', 'sliding_flow_progress_missing');
  assert(findNodeById(ast, 'model100_cellwise_root')?.type === 'Container', 'selected_app_schema_missing');
  assert(
    findNodeById(ast, 'sliding_flow_tabs')?.bind?.write?.target_ref?.k === FLOW_SHELL_TAB_LABEL,
    'flow_tabs_write_target_missing',
  );

  const promptAst = resolveRouteUiAst(store.snapshot, '/prompt', { projectSchemaModel: buildAstFromSchema }).ast;
  assert(findNodeById(promptAst, 'sliding_flow_root') === null, 'prompt_route_must_not_use_sliding_flow_shell');

  console.log('validate_sliding_flow_local: PASS');
  process.exit(0);
} catch (err) {
  console.error('validate_sliding_flow_local: FAIL');
  console.error(err && err.message ? err.message : String(err));
  process.exit(1);
}
