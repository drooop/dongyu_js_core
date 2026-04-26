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

function payloadLabel(payload, key) {
  return Array.isArray(payload)
    ? payload.find((record) => record && record.id === 0 && record.p === 0 && record.r === 0 && record.c === 0 && record.k === key) || null
    : null;
}

function mtPayloadRecord(k, t, v) {
  return { id: 0, p: 0, r: 0, c: 0, k, t, v };
}

function assertHomeOwnerRequestPayload(label, messagePrefix) {
  assert(label, `${messagePrefix}_missing`);
  assert.equal(label.t, 'pin.in', `${messagePrefix}_must_use_pin_in`);
  assert.equal(payloadLabel(label.v, '__mt_payload_kind')?.v, 'home_owner_request.v1', `${messagePrefix}_must_use_modeltable_payload`);
  assert.equal(payloadLabel(label.v, 'request'), null, `${messagePrefix}_must_not_embed_legacy_request_label`);
  assert(Array.isArray(payloadLabel(label.v, 'write_labels')?.v), `${messagePrefix}_must_embed_write_labels`);
  assert(Array.isArray(payloadLabel(label.v, 'remove_labels')?.v), `${messagePrefix}_must_embed_remove_labels`);
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

  let result = await state.submitEnvelope({
    event_id: Date.now(),
    type: 'system_pin_direct_reject',
    payload: {
      action: 'system_pin_direct_reject',
      pin: 'debug_bad_pin',
      meta: { op_id: 'system_pin_direct_reject' },
      target: { model_id: -10, p: 0, r: 0, c: 0 },
      value: { legacy: true },
    },
    source: 'ui_renderer',
    ts: Date.now(),
  });
  assert.equal(result.result, 'error', 'negative_system_direct_pin_object_must_be_rejected');
  assert.equal(result.detail, 'temporary_modeltable_required', 'negative_system_direct_pin_reject_reason_must_require_modeltable');
  assert.equal(
    state.runtime.getCell(state.runtime.getModel(-10), 0, 0, 0).labels.get('debug_bad_pin'),
    undefined,
    'negative_system_direct_pin_object_must_not_be_written',
  );

  result = await state.submitEnvelope({
    event_id: Date.now(),
    type: 'system_pin_direct_accept_modeltable',
    payload: {
      action: 'system_pin_direct_accept_modeltable',
      pin: 'debug_good_pin',
      meta: { op_id: 'system_pin_direct_accept_modeltable' },
      target: { model_id: -10, p: 0, r: 0, c: 0 },
      value: [mtPayloadRecord('__mt_payload_kind', 'str', 'debug.system_pin.v1')],
    },
    source: 'ui_renderer',
    ts: Date.now(),
  });
  assert.equal(result.result, 'ok', 'negative_system_direct_pin_modeltable_must_be_accepted');
  assert.equal(
    payloadLabel(state.runtime.getCell(state.runtime.getModel(-10), 0, 0, 0).labels.get('debug_good_pin')?.v, '__mt_payload_kind')?.v,
    'debug.system_pin.v1',
    'negative_system_direct_pin_modeltable_payload_must_be_written',
  );

  async function setState(key, type, value, opId) {
    return state.submitEnvelope(mailboxEnvelope('label_update', {
      opId,
      target: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: key },
      value: { t: type, v: value },
    }));
  }

  result = await setState('selected_model_id', 'str', '1003', 'home_set_model');
  assert.equal(result.result, 'ok', 'set_selected_model_id_failed');

  result = await state.submitEnvelope(mailboxEnvelope('home_open_create', {
    opId: 'home_open_create',
    target: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'selected_model_id' },
  }));
  assert.equal(result.result, 'ok', 'home_open_create_failed');

  let stateModel = state.runtime.getModel(-2);
  let ownerRequest = state.runtime.getCell(stateModel, 0, 0, 0).labels.get('home_owner_request');
  assertHomeOwnerRequestPayload(ownerRequest, 'home_open_create_must_write_owner_request_to_state_model');

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
  assertHomeOwnerRequestPayload(ownerRequest, 'home_save_label_must_write_owner_request_to_target_model');

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
