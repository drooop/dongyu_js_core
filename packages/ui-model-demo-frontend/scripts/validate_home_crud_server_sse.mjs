#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { EDITOR_STATE_MODEL_ID } from '../src/model_ids.js';

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

const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0243-home-crud-'));
process.env.DY_AUTH = '0';
process.env.DY_PERSISTED_ASSET_ROOT = '';
process.env.WORKER_BASE_WORKSPACE = `it0243_home_crud_${Date.now()}`;
process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
process.env.DOCS_ROOT = join(tempRoot, 'docs');
process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static_projects');

const { createServerState } = await import(new URL('../../ui-model-demo-server/server.mjs', import.meta.url));
const state = createServerState({ dbPath: null });

try {
  await state.activateRuntimeMode('running');

  let result = await state.submitEnvelope(mailboxEnvelope('label_update', {
    opId: 'home_set_model',
    target: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'selected_model_id' },
    value: { t: 'str', v: '1003' },
  }));
  assert.equal(result.result, 'ok', 'set_selected_model_id_failed');

  result = await state.submitEnvelope(mailboxEnvelope('home_open_create', {
    opId: 'home_open_create',
    target: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'selected_model_id' },
  }));
  assert.equal(result.result, 'ok', 'home_open_create_failed');

  let snapshot = state.clientSnap();
  let labels = snapshot.models['-2'].cells['0,0,0'].labels;
  assert.equal(labels.dt_edit_open?.v, true, 'home_open_create_must_open_dialog');
  assert.equal(labels.home_form_mode?.v, 'create', 'home_open_create_must_set_create_mode');
  assert.equal(String(labels.dt_edit_model_id?.v), '1003', 'home_open_create_must_target_selected_model');

  async function setState(key, type, value, opId) {
    return state.submitEnvelope(mailboxEnvelope('label_update', {
      opId,
      target: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: key },
      value: { t: type, v: value },
    }));
  }

  await setState('dt_edit_p', 'str', '0', 'set_p');
  await setState('dt_edit_r', 'str', '0', 'set_r');
  await setState('dt_edit_c', 'str', '0', 'set_c');
  await setState('dt_edit_k', 'str', 'demo_home_crud_label', 'set_k');
  await setState('dt_edit_t', 'str', 'str', 'set_t');
  await setState('dt_edit_v_text', 'str', 'hello-home', 'set_v');

  result = await state.submitEnvelope(mailboxEnvelope('home_save_label', {
    opId: 'home_save_create',
    target: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_edit_model_id' },
  }));
  assert.equal(result.result, 'ok', 'home_save_label_create_failed');

  snapshot = state.clientSnap();
  let targetLabel = snapshot.models['1003'].cells['0,0,0'].labels.demo_home_crud_label;
  assert.equal(targetLabel?.t, 'str', 'created_label_type_must_match');
  assert.equal(targetLabel?.v, 'hello-home', 'created_label_value_must_match');

  result = await state.submitEnvelope(mailboxEnvelope('home_view_detail', {
    opId: 'home_view_detail',
    target: { model_id: 1003, p: 0, r: 0, c: 0, k: 'demo_home_crud_label' },
  }));
  assert.equal(result.result, 'ok', 'home_view_detail_failed');
  snapshot = state.clientSnap();
  labels = snapshot.models['-2'].cells['0,0,0'].labels;
  assert.equal(labels.dt_detail_open?.v, true, 'detail_dialog_must_open');
  assert.match(String(labels.dt_detail_title?.v || ''), /demo_home_crud_label/, 'detail_title_must_include_key');
  assert.match(String(labels.dt_detail_text?.v || ''), /hello-home/, 'detail_text_must_include_value');

  result = await state.submitEnvelope(mailboxEnvelope('home_close_detail', {
    opId: 'home_close_detail',
    target: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_detail_open' },
  }));
  assert.equal(result.result, 'ok', 'home_close_detail_failed');

  result = await state.submitEnvelope(mailboxEnvelope('home_open_edit', {
    opId: 'home_open_edit',
    target: { model_id: 1003, p: 0, r: 0, c: 0, k: 'demo_home_crud_label' },
  }));
  assert.equal(result.result, 'ok', 'home_open_edit_failed');
  await setState('dt_edit_v_text', 'str', 'hello-home-updated', 'set_v_updated');

  result = await state.submitEnvelope(mailboxEnvelope('home_save_label', {
    opId: 'home_save_edit',
    target: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_edit_model_id' },
  }));
  assert.equal(result.result, 'ok', 'home_save_label_edit_failed');
  snapshot = state.clientSnap();
  targetLabel = snapshot.models['1003'].cells['0,0,0'].labels.demo_home_crud_label;
  assert.equal(targetLabel?.v, 'hello-home-updated', 'edited_label_value_must_update');

  result = await state.submitEnvelope(mailboxEnvelope('home_select_row', {
    opId: 'home_select_row',
    target: { model_id: 1003, p: 0, r: 0, c: 0, k: 'demo_home_crud_label' },
  }));
  assert.equal(result.result, 'ok', 'home_select_row_failed');
  snapshot = state.clientSnap();
  labels = snapshot.models['-2'].cells['0,0,0'].labels;
  assert.equal(String(labels.draft_k?.v), 'demo_home_crud_label', 'home_select_row_must_load_draft_k');

  result = await state.submitEnvelope(mailboxEnvelope('home_delete_label', {
    opId: 'home_delete_label',
    target: { model_id: 1003, p: 0, r: 0, c: 0, k: 'demo_home_crud_label' },
  }));
  assert.equal(result.result, 'ok', 'home_delete_label_failed');
  snapshot = state.clientSnap();
  assert.equal(
    Boolean(snapshot.models['1003'].cells['0,0,0'].labels.demo_home_crud_label),
    false,
    'home_delete_label_must_remove_target_label',
  );

  console.log('validate_home_crud_server_sse: PASS');
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
  delete process.env.WORKER_BASE_WORKSPACE;
  delete process.env.WORKER_BASE_DATA_ROOT;
  delete process.env.DOCS_ROOT;
  delete process.env.STATIC_PROJECTS_ROOT;
  delete process.env.DY_PERSISTED_ASSET_ROOT;
}
