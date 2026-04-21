#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { EDITOR_STATE_MODEL_ID } from '../../packages/ui-model-demo-frontend/src/model_ids.js';

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

const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0249-home-pin-'));
process.env.DY_AUTH = '0';
process.env.WORKER_BASE_WORKSPACE = `it0249_home_pin_${Date.now()}`;
process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
process.env.DOCS_ROOT = join(tempRoot, 'docs');
process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static_projects');

const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
const state = createServerState({ dbPath: null });

try {
  await state.activateRuntimeMode('running');

  async function setState(key, type, value, opId) {
    return state.submitEnvelope(mailboxEnvelope('label_update', {
      opId,
      target: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: key },
      value: { t: type, v: value },
    }));
  }

  let result = await setState('selected_model_id', 'str', '1003', 'home_set_model');
  assert.equal(result.result, 'ok', 'set_selected_model_id_failed');

  result = await state.submitEnvelope(mailboxEnvelope('home_open_create', {
    opId: 'home_open_create',
    target: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'selected_model_id' },
  }));
  assert.equal(result.result, 'ok', 'home_open_create_failed');

  let stateModel = state.runtime.getModel(-2);
  let ownerRequest = state.runtime.getCell(stateModel, 0, 0, 0).labels.get('home_owner_request');
  assert(ownerRequest, 'home_open_create_must_write_owner_request_to_state_model');
  assert.match(String(ownerRequest.t || ''), /^pin\.(table|single)\.in$/, 'state_owner_request_must_use_model_input_pin');

  await setState('dt_edit_p', 'str', '0', 'set_p');
  await setState('dt_edit_r', 'str', '0', 'set_r');
  await setState('dt_edit_c', 'str', '0', 'set_c');
  await setState('dt_edit_k', 'str', 'demo_home_pin_label', 'set_k');
  await setState('dt_edit_t', 'str', 'str', 'set_t');
  await setState('dt_edit_v_text', 'str', 'hello-home-pin', 'set_v');

  result = await state.submitEnvelope(mailboxEnvelope('home_save_label', {
    opId: 'home_save_create',
    target: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'dt_edit_model_id' },
  }));
  assert.equal(result.result, 'ok', 'home_save_label_create_failed');

  const targetModel = state.runtime.getModel(1003);
  ownerRequest = state.runtime.getCell(targetModel, 0, 0, 0).labels.get('home_owner_request');
  assert(ownerRequest, 'home_save_label_must_write_owner_request_to_target_model');
  assert.match(String(ownerRequest.t || ''), /^pin\.(table|single)\.in$/, 'target_owner_request_must_use_model_input_pin');

  const created = state.runtime.getCell(targetModel, 0, 0, 0).labels.get('demo_home_pin_label');
  assert.equal(created?.v, 'hello-home-pin', 'owner_materialization_must_create_label');

  console.log('test_0249_home_crud_pin_contract: PASS');
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
  delete process.env.WORKER_BASE_WORKSPACE;
  delete process.env.WORKER_BASE_DATA_ROOT;
  delete process.env.DOCS_ROOT;
  delete process.env.STATIC_PROJECTS_ROOT;
}
