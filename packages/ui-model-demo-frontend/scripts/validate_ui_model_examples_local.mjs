#!/usr/bin/env node

import { createDemoStore } from '../src/demo_modeltable.js';
import {
  EDITOR_STATE_MODEL_ID,
  UI_EXAMPLE_CHILD_MODEL_ID,
  UI_EXAMPLE_PAGE_ASSET_MODEL_ID,
  UI_EXAMPLE_PARENT_MODEL_ID,
  UI_EXAMPLE_PROMOTE_CHILD_ACTION,
  UI_EXAMPLE_SCHEMA_MODEL_ID,
} from '../src/model_ids.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

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

function selectWorkspaceModel(store, modelId) {
  const stateModel = store.runtime.getModel(EDITOR_STATE_MODEL_ID);
  store.runtime.addLabel(stateModel, 0, 0, 0, { k: 'ui_page', t: 'str', v: 'workspace' });
  store.runtime.addLabel(stateModel, 0, 0, 0, { k: 'ws_app_selected', t: 'int', v: modelId });
  store.runtime.addLabel(stateModel, 0, 0, 0, { k: 'selected_model_id', t: 'str', v: String(modelId) });
  store.refreshSnapshot();
  store.setRoutePath('/workspace');
  return store.getUiAst();
}

try {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const workspaceRegistry = store.runtime.getLabelValue(store.runtime.getModel(EDITOR_STATE_MODEL_ID), 0, 0, 0, 'ws_apps_registry');
  assert(Array.isArray(workspaceRegistry), 'workspace_registry_missing');
  assert(workspaceRegistry.some((entry) => entry?.model_id === UI_EXAMPLE_SCHEMA_MODEL_ID), 'workspace_registry_missing_schema_example');
  assert(workspaceRegistry.some((entry) => entry?.model_id === UI_EXAMPLE_PAGE_ASSET_MODEL_ID), 'workspace_registry_missing_page_asset_example');
  assert(workspaceRegistry.some((entry) => entry?.model_id === UI_EXAMPLE_PARENT_MODEL_ID), 'workspace_registry_missing_parent_example');
  assert(workspaceRegistry.every((entry) => entry?.model_id !== UI_EXAMPLE_CHILD_MODEL_ID), 'workspace_registry_must_not_expose_child_example');

  let ast = selectWorkspaceModel(store, UI_EXAMPLE_SCHEMA_MODEL_ID);
  assert(findNodeById(ast, 'ui_examples_cellwise_root')?.type === 'Container', 'cellwise_example_workspace_ast_missing');
  assert(findNodeById(ast, 'ui_examples_cellwise_status')?.type === 'StatusBadge', 'cellwise_example_status_missing');

  ast = selectWorkspaceModel(store, UI_EXAMPLE_PAGE_ASSET_MODEL_ID);
  assert(findNodeById(ast, 'ui_examples_asset_root')?.type === 'Container', 'page_asset_example_root_missing');
  assert(findNodeById(ast, 'ui_examples_asset_status')?.type === 'StatusBadge', 'page_asset_example_status_missing');
  assert(findNodeById(ast, 'ui_examples_asset_log_terminal')?.type === 'Terminal', 'page_asset_example_terminal_missing');

  ast = selectWorkspaceModel(store, UI_EXAMPLE_PARENT_MODEL_ID);
  const includeNode = findNodeById(ast, 'ui_examples_parent_include_child');
  assert(findNodeById(ast, 'ui_examples_parent_root')?.type === 'Container', 'parent_example_root_missing');
  assert(includeNode?.type === 'Include', 'parent_example_include_missing');
  assert(includeNode?.props?.ref?.model_id === UI_EXAMPLE_CHILD_MODEL_ID, 'parent_example_include_ref_invalid');
  assert(findNodeById(ast, 'ui_examples_parent_promote_button')?.bind?.write?.action === UI_EXAMPLE_PROMOTE_CHILD_ACTION, 'parent_example_action_missing');

  assert(
    store.runtime.getLabelValue(store.runtime.getModel(UI_EXAMPLE_CHILD_MODEL_ID), 0, 0, 0, 'review_stage') === 'draft',
    'local_child_stage_baseline_missing',
  );

  store.dispatchAddLabel({
    p: 0,
    r: 0,
    c: 1,
    k: 'ui_event',
    t: 'event',
    v: mailboxEnvelope(UI_EXAMPLE_PROMOTE_CHILD_ACTION, {
      opId: 'ui_examples_local_promote',
      target: { model_id: UI_EXAMPLE_CHILD_MODEL_ID, p: 0, r: 0, c: 0, k: 'review_stage' },
    }),
  });
  const result = store.consumeOnce();
  const eventError = store.runtime.getLabelValue(store.runtime.getModel(-1), 0, 0, 1, 'ui_event_error');
  assert(result?.result === 'error', 'local_ui_examples_action_must_fail');
  assert(result?.code === 'unsupported', 'local_ui_examples_action_must_fail_with_unsupported');
  assert(eventError?.detail === 'ui_examples_remote_only', 'local_ui_examples_action_must_explain_remote_only_boundary');
  assert(
    store.runtime.getLabelValue(store.runtime.getModel(UI_EXAMPLE_CHILD_MODEL_ID), 0, 0, 0, 'review_stage') === 'draft',
    'local_ui_examples_action_must_not_mutate_child_truth',
  );

  console.log('validate_ui_model_examples_local: PASS');
  process.exit(0);
} catch (err) {
  console.error('validate_ui_model_examples_local: FAIL');
  console.error(err && err.message ? err.message : String(err));
  process.exit(1);
}
