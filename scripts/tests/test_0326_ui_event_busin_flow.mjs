#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { createLocalBusAdapter } from '../../packages/ui-model-demo-frontend/src/local_bus_adapter.js';
import {
  buildWriteLabelPayloadValue,
  normalizeBusEventV2ValueToPinPayload,
} from '../../packages/ui-model-demo-frontend/src/bus_event_v2.js';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

const CHILD_MODEL_ID = 220;
const EDITOR_MODEL_ID = -1;

function wait(ms = 120) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

async function pollUntil(check, { timeoutMs = 1200, intervalMs = 40 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = check();
    if (result) return result;
    await wait(intervalMs);
  }
  return check();
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0326-flow-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0326_flow_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null });
  try {
    await state.activateRuntimeMode('running');
    return await fn(state);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.WORKER_BASE_WORKSPACE;
    delete process.env.WORKER_BASE_DATA_ROOT;
    delete process.env.DOCS_ROOT;
    delete process.env.STATIC_PROJECTS_ROOT;
    delete process.env.DY_PERSISTED_ASSET_ROOT;
  }
}

function seedBusInHarness(state) {
  const rt = state.runtime;
  const model0 = rt.getModel(0);
  const child = rt.createModel({ id: CHILD_MODEL_ID, name: 'it0326_child', type: 'app' });
  rt.addLabel(child, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'UI.Test0326Child' });
  rt.addLabel(child, 0, 0, 0, { k: 'ui_submit', t: 'pin.in', v: null });
  rt.addLabel(child, 0, 0, 0, {
    k: 'ui_submit_route',
    t: 'pin.connect.label',
    v: [{ from: '(self, ui_submit)', to: ['(self, mt_bus_receive_in)'] }],
  });
  rt.addLabel(model0, 0, 0, 0, {
    k: 'ui_submit_route',
    t: 'pin.connect.model',
    v: [{ from: [0, 'ui_submit'], to: [[CHILD_MODEL_ID, 'ui_submit']] }],
  });
  return child;
}

function v2Envelope(overrides = {}) {
  const intent = overrides.intent || {
    target_cell: { p: 2, r: 0, c: 0 },
    target_pin: 'submit_request',
    value: [{ id: 0, p: 0, r: 0, c: 0, k: 'text', t: 'str', v: 'hello-0326' }],
  };
  const payloadValue = Object.prototype.hasOwnProperty.call(overrides, 'value')
    ? overrides.value
    : buildWriteLabelPayloadValue({
      targetCell: intent.target_cell,
      targetPin: intent.target_pin,
      value: intent.value,
      requestId: overrides.opId || `it0326_${Date.now()}`,
    });
  return {
    type: 'bus_event_v2',
    bus_in_key: 'ui_submit',
    value: payloadValue,
    meta: { op_id: overrides.opId || `it0326_${Date.now()}` },
    __intent: intent,
    ...overrides,
  };
}

function assertWriteLabelPayload(actual, originalValue, message) {
  assert.ok(Array.isArray(actual), `${message}: payload must be temporary ModelTable array`);
  const byKey = new Map(actual.map((record) => [record && record.k, record]));
  assert.equal(byKey.get('__mt_payload_kind')?.v, 'write_label.v1', `${message}: payload kind`);
  assert.equal(byKey.get('__mt_target_cell')?.t, 'json', `${message}: target cell type`);
  assert.deepEqual(byKey.get('__mt_target_cell')?.v, originalValue.target_cell, `${message}: target cell`);
  const userLabel = byKey.get(originalValue.target_pin);
  assert.ok(userLabel, `${message}: target pin user label`);
  assert.equal(userLabel.t, 'pin.in', `${message}: target pin type`);
  assert.deepEqual(userLabel.v, originalValue.value, `${message}: target pin value`);
}

function malformedWriteLabelPayload() {
  return [
    { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'write_label.v1' },
    { id: 0, p: 0, r: 0, c: 0, k: '__mt_request_id', t: 'str', v: 'bad_target_cell' },
    { id: 0, p: 0, r: 0, c: 0, k: '__mt_target_cell', t: 'json', v: { p: '2', r: 0, c: 0 } },
    { id: 0, p: 0, r: 0, c: 0, k: 'submit_request', t: 'pin.in', v: { text: 'bad' } },
  ];
}

async function test_legacy_ui_event_shape_rejected() {
  return withServerState(async (state) => {
    seedBusInHarness(state);
    const result = await state.submitEnvelope({
      type: 'ui_event',
      payload: {
        action: 'submit',
        meta: { op_id: `legacy_${Date.now()}` },
        target: { model_id: CHILD_MODEL_ID, p: 0, r: 0, c: 0 },
        pin: 'submit_request',
        value: { text: 'legacy' },
      },
    });
    assert.equal(result?.result, 'error', 'legacy ui_event shape must be rejected');
    assert.equal(result?.code, 'legacy_event_shape', 'legacy ui_event shape must fail with legacy_event_shape');
    return { key: 'legacy_ui_event_shape_rejected', status: 'PASS' };
  });
}

async function test_unknown_bus_in_key_rejected() {
  return withServerState(async (state) => {
    seedBusInHarness(state);
    const result = await state.submitEnvelope(v2Envelope({ bus_in_key: 'ui_unknown' }));
    assert.equal(result?.result, 'error', 'unknown bus_in_key must be rejected');
    assert.equal(result?.code, 'invalid_bus_in_key', 'unknown bus_in_key must fail with invalid_bus_in_key');
    return { key: 'unknown_bus_in_key_rejected', status: 'PASS' };
  });
}

async function test_non_modeltable_bus_event_value_rejected() {
  return withServerState(async (state) => {
    seedBusInHarness(state);
    const result = await state.submitEnvelope(v2Envelope({
      value: { arbitrary: 'legacy-object' },
    }));
    assert.equal(result?.result, 'error', 'non-modeltable bus event value must be rejected');
    assert.equal(result?.code, 'invalid_bus_payload', 'non-modeltable bus event value must fail with invalid_bus_payload');
    const model0Root = state.runtime.getCell(state.runtime.getModel(0), 0, 0, 0).labels;
    assert.equal(model0Root.get('ui_submit')?.v ?? null, null, 'invalid bus event must not overwrite Model 0 bus.in value');
    return { key: 'non_modeltable_bus_event_value_rejected', status: 'PASS' };
  });
}

async function test_malformed_bus_event_target_cell_rejected() {
  return withServerState(async (state) => {
    seedBusInHarness(state);
    const malformed = v2Envelope({
      value: {
        target_cell: { p: '2', r: 0, c: 0 },
        target_pin: 'submit_request',
        value: { text: 'bad-coords' },
      },
    });
    const result = await state.submitEnvelope(malformed);
    assert.equal(result?.result, 'error', 'malformed target_cell coordinates must be rejected');
    assert.equal(result?.code, 'invalid_bus_payload', 'malformed target_cell coordinates must fail with invalid_bus_payload');
    const model0Root = state.runtime.getCell(state.runtime.getModel(0), 0, 0, 0).labels;
    assert.equal(model0Root.get('ui_submit')?.v ?? null, null, 'malformed target_cell must not overwrite Model 0 bus.in value');
    return { key: 'malformed_bus_event_target_cell_rejected', status: 'PASS' };
  });
}

async function test_malformed_bus_event_array_payload_rejected() {
  return withServerState(async (state) => {
    seedBusInHarness(state);
    const result = await state.submitEnvelope(v2Envelope({
      value: malformedWriteLabelPayload(),
    }));
    assert.equal(result?.result, 'error', 'malformed write_label.v1 array must be rejected on server bus_event_v2');
    assert.equal(result?.code, 'invalid_bus_payload', 'malformed write_label.v1 array must fail with invalid_bus_payload');
    const model0Root = state.runtime.getCell(state.runtime.getModel(0), 0, 0, 0).labels;
    assert.equal(model0Root.get('ui_submit')?.v ?? null, null, 'malformed write_label.v1 array must not overwrite Model 0 bus.in value');
    return { key: 'malformed_bus_event_array_payload_rejected', status: 'PASS' };
  });
}

async function test_bus_event_v2_null_value_rejected() {
  return withServerState(async (state) => {
    seedBusInHarness(state);
    const result = await state.submitEnvelope(v2Envelope({ value: null }));
    assert.equal(result?.result, 'error', 'bus_event_v2 null value must be rejected');
    assert.equal(result?.code, 'invalid_bus_payload', 'bus_event_v2 null value must fail with invalid_bus_payload');
    const model0Root = state.runtime.getCell(state.runtime.getModel(0), 0, 0, 0).labels;
    assert.equal(model0Root.get('ui_submit')?.v ?? null, null, 'null bus_event_v2 value must not overwrite Model 0 bus.in value');
    return { key: 'bus_event_v2_null_value_rejected', status: 'PASS' };
  });
}

async function test_bus_event_v2_missing_value_rejected() {
  return withServerState(async (state) => {
    seedBusInHarness(state);
    const envelope = v2Envelope();
    delete envelope.value;
    const result = await state.submitEnvelope(envelope);
    assert.equal(result?.result, 'error', 'bus_event_v2 missing value must be rejected');
    assert.equal(result?.code, 'invalid_bus_payload', 'bus_event_v2 missing value must fail with invalid_bus_payload');
    const model0Root = state.runtime.getCell(state.runtime.getModel(0), 0, 0, 0).labels;
    assert.equal(model0Root.get('ui_submit')?.v ?? null, null, 'missing bus_event_v2 value must not overwrite Model 0 bus.in value');
    return { key: 'bus_event_v2_missing_value_rejected', status: 'PASS' };
  });
}

async function test_bus_event_v2_value_action_does_not_fallback_to_legacy_direct_pin() {
  return withServerState(async (state) => {
    const model0 = state.runtime.getModel(0);
    state.runtime.addLabel(model0, 0, 0, 0, { k: 'ui_submit', t: 'pin.bus.in', v: null });
    const result = await state.submitEnvelope(v2Envelope({
      value: {
        action: 'ui_submit',
        target: { model_id: 0, p: 0, r: 0, c: 0 },
        pin: 'ui_submit',
        value: { arbitrary: 'legacy-direct-pin' },
      },
    }));
    assert.equal(result?.result, 'error', 'bus_event_v2 value.action must not fall back to legacy direct-pin routing');
    assert.equal(result?.code, 'invalid_bus_payload', 'legacy-looking bus_event_v2 value must fail as invalid_bus_payload');
    const model0Root = state.runtime.getCell(model0, 0, 0, 0).labels;
    assert.equal(model0Root.get('ui_submit')?.v ?? null, null, 'legacy-looking bus_event_v2 value must not overwrite Model 0 bus.in value');
    return { key: 'bus_event_v2_value_action_does_not_fallback_to_legacy_direct_pin', status: 'PASS' };
  });
}

async function test_bus_event_v2_valid_shaped_object_value_rejected() {
  return withServerState(async (state) => {
    seedBusInHarness(state);
    const intent = {
      target_cell: { p: 2, r: 0, c: 0 },
      target_pin: 'submit_request',
      value: { text: 'legacy-object-shape' },
    };
    const result = await state.submitEnvelope(v2Envelope({ value: intent }));
    assert.equal(result?.result, 'error', 'bus_event_v2 valid-shaped object value must be rejected');
    assert.equal(result?.code, 'invalid_bus_payload', 'valid-shaped object value must fail with invalid_bus_payload');
    const model0Root = state.runtime.getCell(state.runtime.getModel(0), 0, 0, 0).labels;
    assert.equal(model0Root.get('ui_submit')?.v ?? null, null, 'valid-shaped object value must not overwrite Model 0 bus.in value');
    return { key: 'bus_event_v2_valid_shaped_object_value_rejected', status: 'PASS' };
  });
}

function test_bus_event_v2_value_action_legacy_fallback_removed_from_local_paths() {
  const scopedFiles = [
    'packages/ui-model-demo-server/server.mjs',
    'packages/ui-model-demo-frontend/src/demo_modeltable.js',
    'packages/ui-model-demo-frontend/src/gallery_store.js',
  ];
  for (const file of scopedFiles) {
    const text = readFileSync(file, 'utf8');
    assert.doesNotMatch(
      text,
      /typeof\s+value\.action\s*===\s*['"]string['"][\s\S]{0,700}legacyEnvelope/,
      `${file} must not keep bus_event_v2 value.action legacy fallback`,
    );
  }
  return { key: 'bus_event_v2_value_action_legacy_fallback_removed_from_local_paths', status: 'PASS' };
}

function test_bus_event_v2_model0_paths_reject_nullish_payloads() {
  const scopedFiles = [
    'packages/ui-model-demo-server/server.mjs',
    'packages/ui-model-demo-frontend/src/demo_modeltable.js',
    'packages/ui-model-demo-frontend/src/gallery_store.js',
    'packages/ui-model-demo-frontend/src/local_bus_adapter.js',
  ];
  for (const file of scopedFiles) {
    const text = readFileSync(file, 'utf8');
    assert.doesNotMatch(
      text,
      /!==\s*null\s*&&\s*[^;\n]+!==\s*undefined\s*&&\s*!Array\.isArray/,
      `${file} must not allow nullish Model 0 bus_event_v2 payloads`,
    );
  }
  return { key: 'bus_event_v2_model0_paths_reject_nullish_payloads', status: 'PASS' };
}

function test_bus_event_v2_normalization_no_longer_converts_object_values() {
  const shapedObject = {
    target_cell: { p: 2, r: 0, c: 0 },
    target_pin: 'submit_request',
    value: { text: 'must-be-rejected' },
  };
  const normalized = normalizeBusEventV2ValueToPinPayload(shapedObject, { op_id: 'frontend_shaped_object_0332' });
  assert.equal(Array.isArray(normalized), false, 'frontend normalization must not build write_label.v1 from object values');
  return { key: 'bus_event_v2_normalization_no_longer_converts_object_values', status: 'PASS' };
}

function test_frontend_malformed_target_cell_is_not_converted_to_write_label_payload() {
  const malformed = {
    target_cell: { p: '2', r: 0, c: 0 },
    target_pin: 'submit_request',
    value: { text: 'bad-coords' },
  };
  const normalized = normalizeBusEventV2ValueToPinPayload(malformed, { op_id: 'frontend_bad_coords_0332' });
  assert.equal(Array.isArray(normalized), false, 'frontend normalization must not build write_label.v1 for malformed target_cell coordinates');
  return { key: 'frontend_malformed_target_cell_is_not_converted_to_write_label_payload', status: 'PASS' };
}

function test_frontend_malformed_array_payload_is_not_forwarded_as_valid_array() {
  const normalized = normalizeBusEventV2ValueToPinPayload(malformedWriteLabelPayload(), { op_id: 'frontend_bad_array_0332' });
  assert.equal(Array.isArray(normalized), false, 'frontend normalization must not forward malformed write_label.v1 arrays as valid arrays');
  return { key: 'frontend_malformed_array_payload_is_not_forwarded_as_valid_array', status: 'PASS' };
}

function submitToLocalAdapter(adapter, runtime, envelope) {
  const mailboxModel = runtime.getModel(-1);
  runtime.addLabel(mailboxModel, 0, 0, 1, { k: 'bus_event', t: 'event', v: envelope });
  return adapter.consumeOnce();
}

function test_local_adapter_reports_rejected_model0_busin_write() {
  const runtime = new ModelTableRuntime();
  runtime.createModel({ id: -1, name: 'editor_mailbox', type: 'ui' });
  runtime.createModel({ id: -2, name: 'editor_state', type: 'ui' });
  const model0 = runtime.getModel(0);
  runtime.addLabel(model0, 0, 0, 0, { k: 'ui_submit', t: 'pin.bus.in', v: null });
  const adapter = createLocalBusAdapter({
    runtime,
    eventLog: [],
    mode: 'v1',
    mailboxModelId: -1,
    editorStateModelId: -2,
  });
  const result = submitToLocalAdapter(adapter, runtime, {
    type: 'bus_event',
    source: { node_type: 'Button', node_id: 'submit' },
    payload: {
      meta: { op_id: 'local_bad_busin_0332' },
      target: { model_id: 0, p: 0, r: 0, c: 0 },
      pin: 'ui_submit',
      value: { arbitrary: 'legacy-object' },
    },
  });
  assert.equal(result?.result, 'error', 'local adapter must report runtime bus.in rejection');
  assert.equal(result?.code, 'invalid_bus_payload', 'local adapter bus.in rejection must surface invalid_bus_payload');
  assert.equal(model0.getCell(0, 0, 0).labels.get('ui_submit')?.v ?? null, null, 'rejected local bus.in write must not overwrite Model 0 bus.in value');
  return { key: 'local_adapter_reports_rejected_model0_busin_write', status: 'PASS' };
}

function test_local_adapter_rejects_malformed_write_label_array() {
  const runtime = new ModelTableRuntime();
  runtime.createModel({ id: -1, name: 'editor_mailbox', type: 'ui' });
  runtime.createModel({ id: -2, name: 'editor_state', type: 'ui' });
  const model0 = runtime.getModel(0);
  runtime.addLabel(model0, 0, 0, 0, { k: 'ui_submit', t: 'pin.bus.in', v: null });
  const adapter = createLocalBusAdapter({
    runtime,
    eventLog: [],
    mode: 'v1',
    mailboxModelId: -1,
    editorStateModelId: -2,
  });
  const result = submitToLocalAdapter(adapter, runtime, {
    type: 'bus_event',
    source: { node_type: 'Button', node_id: 'submit' },
    payload: {
      meta: { op_id: 'local_bad_array_0332' },
      target: { model_id: 0, p: 0, r: 0, c: 0 },
      pin: 'ui_submit',
      value: malformedWriteLabelPayload(),
    },
  });
  assert.equal(result?.result, 'error', 'local adapter must reject malformed write_label.v1 arrays');
  assert.equal(result?.code, 'invalid_bus_payload', 'local malformed write_label.v1 arrays must fail with invalid_bus_payload');
  assert.equal(model0.getCell(0, 0, 0).labels.get('ui_submit')?.v ?? null, null, 'malformed local array must not overwrite Model 0 bus.in value');
  return { key: 'local_adapter_rejects_malformed_write_label_array', status: 'PASS' };
}

function test_local_adapter_rejects_null_model0_busin_payload() {
  const runtime = new ModelTableRuntime();
  runtime.createModel({ id: -1, name: 'editor_mailbox', type: 'ui' });
  runtime.createModel({ id: -2, name: 'editor_state', type: 'ui' });
  const model0 = runtime.getModel(0);
  runtime.addLabel(model0, 0, 0, 0, { k: 'ui_submit', t: 'pin.bus.in', v: null });
  const adapter = createLocalBusAdapter({
    runtime,
    eventLog: [],
    mode: 'v1',
    mailboxModelId: -1,
    editorStateModelId: -2,
  });
  const result = submitToLocalAdapter(adapter, runtime, {
    type: 'bus_event',
    source: { node_type: 'Button', node_id: 'submit' },
    payload: {
      meta: { op_id: 'local_null_busin_0332' },
      target: { model_id: 0, p: 0, r: 0, c: 0 },
      pin: 'ui_submit',
      value: null,
    },
  });
  assert.equal(result?.result, 'error', 'local adapter must reject null Model 0 bus.in payload');
  assert.equal(result?.code, 'invalid_bus_payload', 'local null Model 0 bus.in payload must fail with invalid_bus_payload');
  assert.equal(model0.getCell(0, 0, 0).labels.get('ui_submit')?.v ?? null, null, 'null local bus.in payload must not overwrite Model 0 bus.in value');
  return { key: 'local_adapter_rejects_null_model0_busin_payload', status: 'PASS' };
}

function test_local_adapter_rejects_valid_shaped_object_model0_busin_payload() {
  const runtime = new ModelTableRuntime();
  runtime.createModel({ id: -1, name: 'editor_mailbox', type: 'ui' });
  runtime.createModel({ id: -2, name: 'editor_state', type: 'ui' });
  const model0 = runtime.getModel(0);
  runtime.addLabel(model0, 0, 0, 0, { k: 'ui_submit', t: 'pin.bus.in', v: null });
  const adapter = createLocalBusAdapter({
    runtime,
    eventLog: [],
    mode: 'v1',
    mailboxModelId: -1,
    editorStateModelId: -2,
  });
  const result = submitToLocalAdapter(adapter, runtime, {
    type: 'bus_event',
    source: { node_type: 'Button', node_id: 'submit' },
    payload: {
      meta: { op_id: 'local_object_busin_0332' },
      target: { model_id: 0, p: 0, r: 0, c: 0 },
      pin: 'ui_submit',
      value: {
        target_cell: { p: 2, r: 0, c: 0 },
        target_pin: 'submit_request',
        value: { text: 'legacy-object-shape' },
      },
    },
  });
  assert.equal(result?.result, 'error', 'local adapter must reject valid-shaped object Model 0 bus.in payload');
  assert.equal(result?.code, 'invalid_bus_payload', 'local valid-shaped object payload must fail with invalid_bus_payload');
  assert.equal(model0.getCell(0, 0, 0).labels.get('ui_submit')?.v ?? null, null, 'object local bus.in payload must not overwrite Model 0 bus.in value');
  return { key: 'local_adapter_rejects_valid_shaped_object_model0_busin_payload', status: 'PASS' };
}

function test_local_adapter_rejects_wrapped_modeltable_array_model0_busin_payload() {
  const runtime = new ModelTableRuntime();
  runtime.createModel({ id: -1, name: 'editor_mailbox', type: 'ui' });
  runtime.createModel({ id: -2, name: 'editor_state', type: 'ui' });
  const model0 = runtime.getModel(0);
  runtime.addLabel(model0, 0, 0, 0, { k: 'ui_submit', t: 'pin.bus.in', v: null });
  const adapter = createLocalBusAdapter({
    runtime,
    eventLog: [],
    mode: 'v1',
    mailboxModelId: -1,
    editorStateModelId: -2,
  });
  const validPayload = v2Envelope({ opId: 'local_wrapped_array_nested_0332' }).value;
  const result = submitToLocalAdapter(adapter, runtime, {
    type: 'bus_event',
    source: { node_type: 'Button', node_id: 'submit' },
    payload: {
      meta: { op_id: 'local_wrapped_array_0332' },
      target: { model_id: 0, p: 0, r: 0, c: 0 },
      pin: 'ui_submit',
      value: { t: 'json', v: validPayload },
    },
  });
  assert.equal(result?.result, 'error', 'local adapter must reject {t,v} wrapped Model 0 bus.in payload arrays');
  assert.equal(result?.code, 'invalid_bus_payload', 'local wrapped array payload must fail with invalid_bus_payload');
  assert.equal(model0.getCell(0, 0, 0).labels.get('ui_submit')?.v ?? null, null, 'wrapped local array must not overwrite Model 0 bus.in value');
  return { key: 'local_adapter_rejects_wrapped_modeltable_array_model0_busin_payload', status: 'PASS' };
}

async function test_server_direct_pin_model0_rejects_malformed_temporary_payload() {
  return withServerState(async (state) => {
    const model0 = state.runtime.getModel(0);
    state.runtime.addLabel(model0, 0, 0, 0, { k: 'ui_submit', t: 'pin.bus.in', v: null });
    const malformedPayload = [
      { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'write_label.v1' },
      { id: 0, p: 0, r: 0, c: 0, k: '__mt_target_cell', t: 'str', v: '{"p":2,"r":0,"c":0}' },
      { id: 0, p: 0, r: 0, c: 0, k: 'submit_request', t: 'pin.in', v: { text: 'bad' } },
    ];
    const result = await state.submitEnvelope({
      event_id: Date.now(),
      type: 'ui_submit',
      payload: {
        meta: { op_id: `direct_bad_payload_${Date.now()}` },
        target: { model_id: 0, p: 0, r: 0, c: 0 },
        pin: 'ui_submit',
        value: malformedPayload,
      },
      source: 'ui_renderer',
      ts: Date.now(),
    });
    assert.equal(result?.result, 'error', 'server direct-pin must report runtime Model 0 bus.in rejection');
    assert.equal(result?.code, 'invalid_bus_payload', 'malformed direct-pin bus payload must fail with invalid_bus_payload');
    const model0Root = state.runtime.getCell(model0, 0, 0, 0).labels;
    assert.equal(model0Root.get('ui_submit')?.v ?? null, null, 'malformed direct-pin payload must not overwrite Model 0 bus.in value');
    return { key: 'server_direct_pin_model0_rejects_malformed_temporary_payload', status: 'PASS' };
  });
}

async function test_server_direct_pin_model0_rejects_legacy_object_envelope() {
  return withServerState(async (state) => {
    const model0 = state.runtime.getModel(0);
    state.runtime.addLabel(model0, 0, 0, 0, { k: 'ui_submit', t: 'pin.bus.in', v: null });
    const result = await state.submitEnvelope({
      event_id: Date.now(),
      type: 'ui_submit',
      payload: {
        meta: { op_id: `direct_legacy_object_${Date.now()}` },
        target: { model_id: 0, p: 0, r: 0, c: 0 },
        pin: 'ui_submit',
        value: {
          op: 'write',
          records: [{ p: 2, r: 0, c: 0, k: 'submit_request', t: 'pin.in', v: { text: 'legacy' } }],
        },
      },
      source: 'ui_renderer',
      ts: Date.now(),
    });
    assert.equal(result?.result, 'error', 'legacy object direct-pin bus payload must be rejected');
    assert.equal(result?.code, 'invalid_bus_payload', 'legacy object direct-pin bus payload must fail with invalid_bus_payload');
    const model0Root = state.runtime.getCell(model0, 0, 0, 0).labels;
    assert.equal(model0Root.get('ui_submit')?.v ?? null, null, 'legacy object direct-pin payload must not be wrapped and stored on Model 0 bus.in');
    return { key: 'server_direct_pin_model0_rejects_legacy_object_envelope', status: 'PASS' };
  });
}

async function test_server_direct_pin_model0_rejects_generic_object_payload() {
  return withServerState(async (state) => {
    const model0 = state.runtime.getModel(0);
    state.runtime.addLabel(model0, 0, 0, 0, { k: 'ui_submit', t: 'pin.bus.in', v: null });
    const result = await state.submitEnvelope({
      event_id: Date.now(),
      type: 'ui_submit',
      payload: {
        meta: { op_id: `direct_generic_object_${Date.now()}` },
        target: { model_id: 0, p: 0, r: 0, c: 0 },
        pin: 'ui_submit',
        value: { arbitrary: 'object-shaped-payload' },
      },
      source: 'ui_renderer',
      ts: Date.now(),
    });
    assert.equal(result?.result, 'error', 'generic object direct-pin bus payload must be rejected');
    assert.equal(result?.code, 'invalid_bus_payload', 'generic object direct-pin bus payload must fail with invalid_bus_payload');
    const model0Root = state.runtime.getCell(model0, 0, 0, 0).labels;
    assert.equal(model0Root.get('ui_submit')?.v ?? null, null, 'generic object direct-pin payload must not be wrapped and stored on Model 0 bus.in');
    return { key: 'server_direct_pin_model0_rejects_generic_object_payload', status: 'PASS' };
  });
}

async function test_server_direct_pin_model0_rejects_wrapped_modeltable_array_payload() {
  return withServerState(async (state) => {
    const model0 = state.runtime.getModel(0);
    state.runtime.addLabel(model0, 0, 0, 0, { k: 'ui_submit', t: 'pin.bus.in', v: null });
    const validPayload = v2Envelope({ opId: 'direct_wrapped_array_nested_0332' }).value;
    const result = await state.submitEnvelope({
      event_id: Date.now(),
      type: 'ui_submit',
      payload: {
        meta: { op_id: `direct_wrapped_array_${Date.now()}` },
        target: { model_id: 0, p: 0, r: 0, c: 0 },
        pin: 'ui_submit',
        value: { t: 'json', v: validPayload },
      },
      source: 'ui_renderer',
      ts: Date.now(),
    });
    assert.equal(result?.result, 'error', 'server direct-pin must reject {t,v} wrapped Model 0 bus payload arrays');
    assert.equal(result?.code, 'invalid_bus_payload', 'wrapped array direct-pin bus payload must fail with invalid_bus_payload');
    const model0Root = state.runtime.getCell(model0, 0, 0, 0).labels;
    assert.equal(model0Root.get('ui_submit')?.v ?? null, null, 'wrapped array direct-pin payload must not overwrite Model 0 bus.in');
    return { key: 'server_direct_pin_model0_rejects_wrapped_modeltable_array_payload', status: 'PASS' };
  });
}

async function test_server_direct_pin_model0_rejects_null_missing_and_scalar_payloads() {
  return withServerState(async (state) => {
    const model0 = state.runtime.getModel(0);
    state.runtime.addLabel(model0, 0, 0, 0, { k: 'ui_submit', t: 'pin.bus.in', v: null });
    const cases = [
      { suffix: 'null', includeValue: true, value: null },
      { suffix: 'missing', includeValue: false },
      { suffix: 'scalar', includeValue: true, value: 'not-modeltable' },
    ];
    for (const item of cases) {
      const payload = {
        meta: { op_id: `direct_${item.suffix}_${Date.now()}` },
        target: { model_id: 0, p: 0, r: 0, c: 0 },
        pin: 'ui_submit',
      };
      if (item.includeValue) payload.value = item.value;
      const result = await state.submitEnvelope({
        event_id: Date.now(),
        type: 'ui_submit',
        payload,
        source: 'ui_renderer',
        ts: Date.now(),
      });
      assert.equal(result?.result, 'error', `${item.suffix} direct-pin bus payload must be rejected`);
      assert.equal(result?.code, 'invalid_bus_payload', `${item.suffix} direct-pin bus payload must fail with invalid_bus_payload`);
      const model0Root = state.runtime.getCell(model0, 0, 0, 0).labels;
      assert.equal(model0Root.get('ui_submit')?.v ?? null, null, `${item.suffix} direct-pin payload must not overwrite Model 0 bus.in`);
    }
    return { key: 'server_direct_pin_model0_rejects_null_missing_and_scalar_payloads', status: 'PASS' };
  });
}

async function test_server_direct_pin_model0_rejects_mismatched_external_packet() {
  return withServerState(async (state) => {
    const model0 = state.runtime.getModel(0);
    state.runtime.addLabel(model0, 0, 0, 0, { k: 'ui_submit', t: 'pin.bus.in', v: null });
    const nestedPayload = v2Envelope().value;
    const validPayload = normalizeBusEventV2ValueToPinPayload(nestedPayload, { op_id: 'direct_external_mismatch_nested' });
    const result = await state.submitEnvelope({
      event_id: Date.now(),
      type: 'ui_submit',
      payload: {
        meta: { op_id: `direct_external_mismatch_${Date.now()}` },
        target: { model_id: 0, p: 0, r: 0, c: 0 },
        pin: 'ui_submit',
        value: {
          version: 'v1',
          type: 'pin_payload',
          op_id: 'external_mismatch',
          source_model_id: 100,
          pin: 'other_pin',
          payload: validPayload,
        },
      },
      source: 'ui_renderer',
      ts: Date.now(),
    });
    assert.equal(result?.result, 'error', 'server direct-pin must reject mismatched external pin_payload.v1 pin');
    assert.equal(result?.code, 'invalid_bus_payload', 'mismatched external pin_payload.v1 must fail with invalid_bus_payload');
    const model0Root = state.runtime.getCell(model0, 0, 0, 0).labels;
    assert.equal(model0Root.get('ui_submit')?.v ?? null, null, 'mismatched external packet must not overwrite Model 0 bus.in');
    return { key: 'server_direct_pin_model0_rejects_mismatched_external_packet', status: 'PASS' };
  });
}

async function test_server_direct_pin_model0_unwraps_matched_external_packet() {
  return withServerState(async (state) => {
    const model0 = state.runtime.getModel(0);
    state.runtime.addLabel(model0, 0, 0, 0, { k: 'ui_submit', t: 'pin.bus.in', v: null });
    const originalValue = v2Envelope().value;
    const validPayload = normalizeBusEventV2ValueToPinPayload(originalValue, { op_id: 'direct_external_match_nested' });
    const result = await state.submitEnvelope({
      event_id: Date.now(),
      type: 'ui_submit',
      payload: {
        meta: { op_id: `direct_external_match_${Date.now()}` },
        target: { model_id: 0, p: 0, r: 0, c: 0 },
        pin: 'ui_submit',
        value: {
          version: 'v1',
          type: 'pin_payload',
          op_id: 'external_match',
          source_model_id: 100,
          pin: 'ui_submit',
          payload: validPayload,
        },
      },
      source: 'ui_renderer',
      ts: Date.now(),
    });
    assert.equal(result?.result, 'ok', 'server direct-pin must accept matched external pin_payload.v1');
    const model0Root = state.runtime.getCell(model0, 0, 0, 0).labels;
    assert.deepEqual(model0Root.get('ui_submit')?.v, validPayload, 'matched external packet must unwrap to nested temporary ModelTable payload');
    return { key: 'server_direct_pin_model0_unwraps_matched_external_packet', status: 'PASS' };
  });
}

async function test_ui_event_writes_model0_busin_and_skips_mailbox() {
  return withServerState(async (state) => {
    const rt = state.runtime;
    seedBusInHarness(state);
    const envelope = v2Envelope();
    const result = await state.submitEnvelope(envelope);
    assert.equal(result?.result, 'ok', 'v2 submit must be accepted');

    const model0Root = rt.getCell(rt.getModel(0), 0, 0, 0).labels;
    const model0Value = await pollUntil(() => model0Root.get('ui_submit')?.v);
    assertWriteLabelPayload(model0Value, envelope.__intent, 'Model 0 root bus.in must receive write_label.v1 payload');
    const mailbox = rt.getCell(rt.getModel(EDITOR_MODEL_ID), 0, 0, 1).labels.get('ui_event');
    assert.equal(mailbox?.v ?? null, null, 'legacy editor mailbox ui_event must stay empty');
    return { key: 'ui_event_writes_model0_busin_and_skips_mailbox', status: 'PASS' };
  });
}

async function test_busin_routes_via_pin_connect_model_to_child() {
  return withServerState(async (state) => {
    const rt = state.runtime;
    seedBusInHarness(state);
    const envelope = v2Envelope();
    const result = await state.submitEnvelope(envelope);
    assert.equal(result?.result, 'ok', 'v2 submit must be accepted');

    const childRoot = rt.getCell(rt.getModel(CHILD_MODEL_ID), 0, 0, 0).labels;
    const childValue = await pollUntil(() => childRoot.get('ui_submit')?.v);
    assertWriteLabelPayload(childValue, envelope.__intent, 'child root pin.in must receive the Model 0 routed payload');
    return { key: 'busin_routes_via_pin_connect_model_to_child', status: 'PASS' };
  });
}

async function test_mt_bus_receive_dispatches_to_target_pin() {
  return withServerState(async (state) => {
    const rt = state.runtime;
    seedBusInHarness(state);
    const envelope = v2Envelope();
    const result = await state.submitEnvelope(envelope);
    assert.equal(result?.result, 'ok', 'v2 submit must be accepted');

    const targetCell = await pollUntil(() => rt.getCell(rt.getModel(CHILD_MODEL_ID), 2, 0, 0).labels.get('submit_request'));
    assert.deepEqual(
      targetCell?.v,
      envelope.__intent.value,
      'mt_bus_receive must dispatch payload value to target pin'
    );
    return { key: 'mt_bus_receive_dispatches_to_target_pin', status: 'PASS' };
  });
}

const tests = [
  test_legacy_ui_event_shape_rejected,
  test_unknown_bus_in_key_rejected,
  test_non_modeltable_bus_event_value_rejected,
  test_malformed_bus_event_target_cell_rejected,
  test_malformed_bus_event_array_payload_rejected,
  test_bus_event_v2_null_value_rejected,
  test_bus_event_v2_missing_value_rejected,
  test_bus_event_v2_value_action_does_not_fallback_to_legacy_direct_pin,
  test_bus_event_v2_valid_shaped_object_value_rejected,
  test_bus_event_v2_value_action_legacy_fallback_removed_from_local_paths,
  test_bus_event_v2_model0_paths_reject_nullish_payloads,
  test_bus_event_v2_normalization_no_longer_converts_object_values,
  test_frontend_malformed_target_cell_is_not_converted_to_write_label_payload,
  test_frontend_malformed_array_payload_is_not_forwarded_as_valid_array,
  test_local_adapter_reports_rejected_model0_busin_write,
  test_local_adapter_rejects_malformed_write_label_array,
  test_local_adapter_rejects_null_model0_busin_payload,
  test_local_adapter_rejects_valid_shaped_object_model0_busin_payload,
  test_local_adapter_rejects_wrapped_modeltable_array_model0_busin_payload,
  test_server_direct_pin_model0_rejects_malformed_temporary_payload,
  test_server_direct_pin_model0_rejects_legacy_object_envelope,
  test_server_direct_pin_model0_rejects_generic_object_payload,
  test_server_direct_pin_model0_rejects_wrapped_modeltable_array_payload,
  test_server_direct_pin_model0_rejects_null_missing_and_scalar_payloads,
  test_server_direct_pin_model0_rejects_mismatched_external_packet,
  test_server_direct_pin_model0_unwraps_matched_external_packet,
  test_ui_event_writes_model0_busin_and_skips_mailbox,
  test_busin_routes_via_pin_connect_model_to_child,
  test_mt_bus_receive_dispatches_to_target_pin,
];

(async () => {
  let passed = 0;
  let failed = 0;
  for (const test of tests) {
    try {
      const result = await test();
      console.log(`[${result.status}] ${result.key}`);
      passed += 1;
    } catch (error) {
      console.log(`[FAIL] ${test.name}: ${error.message}`);
      failed += 1;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
  process.exit(failed > 0 ? 1 : 0);
})();
