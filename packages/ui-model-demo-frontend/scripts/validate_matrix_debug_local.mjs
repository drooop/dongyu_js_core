#!/usr/bin/env node

import { createDemoStore } from '../src/demo_modeltable.js';
import { MATRIX_DEBUG_MODEL_ID, EDITOR_STATE_MODEL_ID } from '../src/model_ids.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
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

function getStateValue(store, key) {
  return store.runtime.getLabelValue(store.runtime.getModel(EDITOR_STATE_MODEL_ID), 0, 0, 0, key);
}

try {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const traceModel = store.runtime.getModel(MATRIX_DEBUG_MODEL_ID);

  assert(traceModel, 'matrix_debug_model_missing');
  assert(Array.isArray(getStateValue(store, 'ws_apps_registry')), 'workspace_registry_missing');
  assert(getStateValue(store, 'ws_apps_registry').some((entry) => entry && entry.model_id === MATRIX_DEBUG_MODEL_ID), 'workspace_registry_missing_matrix_debug');

  store.runtime.addLabel(store.runtime.getModel(EDITOR_STATE_MODEL_ID), 0, 0, 0, {
    k: 'ws_app_selected',
    t: 'int',
    v: MATRIX_DEBUG_MODEL_ID,
  });
  store.refreshSnapshot();
  store.setRoutePath('/workspace');

  const ast = store.getUiAst();
  assert(ast && ast.type === 'Root', 'matrix_debug_workspace_ast_missing');
  assert(findNodeById(ast, 'matrix_debug_header_card')?.type === 'Card', 'matrix_debug_header_card_missing');
  assert(findNodeById(ast, 'matrix_debug_status_badge')?.type === 'StatusBadge', 'matrix_debug_status_badge_missing');
  assert(findNodeById(ast, 'matrix_debug_metrics_row')?.type === 'Container', 'matrix_debug_metrics_row_missing');
  assert(findNodeById(ast, 'matrix_debug_log_terminal')?.type === 'Terminal', 'matrix_debug_log_terminal_missing');

  console.log('validate_matrix_debug_local: PASS');
  process.exit(0);
} catch (err) {
  console.error('validate_matrix_debug_local: FAIL');
  console.error(err && err.message ? err.message : String(err));
  process.exit(1);
}
