#!/usr/bin/env node

import { createDemoStore } from '../src/demo_modeltable.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function mailboxEnvelope(action, target) {
  return {
    event_id: Date.now(),
    type: action,
    payload: {
      action,
      meta: { op_id: `${action}_${Date.now()}` },
      target,
    },
    source: 'ui_renderer',
    ts: Date.now(),
  };
}

try {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  store.setRoutePath('/');
  const ast = store.getUiAst();

  const serialized = JSON.stringify(ast);
  for (const action of [
    'home_refresh',
    'home_select_row',
    'home_open_create',
    'home_open_edit',
    'home_save_label',
    'home_delete_label',
    'home_view_detail',
    'home_close_detail',
    'home_close_edit',
  ]) {
    assert(serialized.includes(action), `home_ast_missing_${action}`);
  }

  store.dispatchAddLabel({
    p: 0, r: 0, c: 1, k: 'ui_event', t: 'event',
    v: mailboxEnvelope('home_open_create', { model_id: -2, p: 0, r: 0, c: 0, k: 'selected_model_id' }),
  });
  const result = store.consumeOnce();
  const eventError = store.runtime.getLabelValue(store.runtime.getModel(-1), 0, 0, 1, 'ui_event_error');

  assert(result?.result === 'error', 'local_home_open_create_must_fail');
  assert(result?.code === 'unsupported', 'local_home_open_create_must_be_unsupported');
  assert(eventError?.detail === 'home_remote_only', 'local_home_open_create_must_explain_remote_only');

  console.log('validate_home_crud_local: PASS');
} catch (err) {
  console.error('validate_home_crud_local: FAIL');
  console.error(err && err.message ? err.message : String(err));
  process.exit(1);
}
