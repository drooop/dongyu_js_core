#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs, { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { buildAstFromCellwiseModel } from '../../packages/ui-model-demo-frontend/src/ui_cellwise_projection.js';
import { WorkerEngineV0 } from '../worker_engine_v0.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

const workspacePatchPath = 'packages/worker-base/system-models/workspace_positive_models.json';
const workspaceCatalogPath = 'packages/worker-base/system-models/workspace_catalog_ui.json';
const systemPatchPath = 'packages/worker-base/system-models/system_models.json';
const mbrRolePath = 'deploy/sys-v1ns/mbr/patches/mbr_role_v0.json';
const serverPath = 'packages/ui-model-demo-server/server.mjs';
const consoleModelId = 1036;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relPath), 'utf8'));
}

function readText(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function recordsForModel(records, modelId) {
  return (Array.isArray(records) ? records : []).filter((record) => record?.model_id === modelId);
}

function findRecord(records, predicate) {
  return (Array.isArray(records) ? records : []).find(predicate) || null;
}

function rootRecord(records, key) {
  return findRecord(records, (record) => (
    record?.model_id === consoleModelId
    && record?.p === 0
    && record?.r === 0
    && record?.c === 0
    && record?.k === key
  ));
}

function makeSnapshot(records, sourceLabels = []) {
  const models = {};
  const ensureModel = (modelId) => {
    const key = String(modelId);
    if (!models[key]) {
      models[key] = {
        id: modelId,
        name: `Model ${modelId}`,
        cells: {},
      };
    }
    return models[key];
  };
  const addLabel = (modelId, p, r, c, label) => {
    const model = ensureModel(modelId);
    const cellKey = `${p},${r},${c}`;
    if (!model.cells[cellKey]) model.cells[cellKey] = { labels: {} };
    model.cells[cellKey].labels[label.k] = label;
  };

  for (const record of recordsForModel(records, consoleModelId)) {
    if (record.op !== 'add_label') continue;
    addLabel(consoleModelId, record.p, record.r, record.c, { k: record.k, t: record.t, v: record.v });
  }
  for (const label of sourceLabels) {
    addLabel(-2, 0, 0, 0, label);
  }
  return { models };
}

function findNodeById(node, id) {
  if (!node || typeof node !== 'object') return null;
  if (node.id === id) return node;
  for (const child of Array.isArray(node.children) ? node.children : []) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

function flattenRecords(records) {
  return (Array.isArray(records) ? records : []).map((record) => JSON.stringify(record)).join('\n');
}

function test_workspace_asset_tree_uses_compact_actions() {
  const records = readJson(workspaceCatalogPath).records || [];
  const actionsCol = findRecord(records, (record) => record?.k === 'ui_props_json' && record?.v?.label === 'Actions');
  const sourceCol = findRecord(records, (record) => record?.k === 'ui_props_json' && record?.v?.prop === 'source');
  const sourceParent = findRecord(records, (record) => record?.k === 'ui_parent' && record?.model_id === -25 && record?.p === 2 && record?.r === 5 && record?.c === 0);
  const openButton = findRecord(records, (record) => record?.k === 'ui_props_json' && record?.model_id === -25 && record?.p === 2 && record?.r === 7 && record?.c === 0);
  const deleteButton = findRecord(records, (record) => record?.k === 'ui_props_json' && record?.model_id === -25 && record?.p === 2 && record?.r === 7 && record?.c === 1);

  assert.ok(actionsCol, 'Workspace actions column must exist');
  assert.ok(actionsCol.v.width <= 84, 'Workspace actions column must be compact enough to stop covering names');
  assert.equal(actionsCol.v.fixed, undefined, 'Workspace actions column must not use fixed overlay in the narrow asset tree');
  assert.ok(sourceCol, 'Workspace source column contract record must remain declared');
  assert.notEqual(sourceParent?.v, 'tbl_workspace_apps', 'Workspace source column must not render as a squeezed visible column');
  assert.equal(openButton?.v?.size, 'small', 'Open button must use compact sizing');
  assert.equal(deleteButton?.v?.label, 'Del', 'Delete button must use a short visible label');
  assert.equal(deleteButton?.v?.size, 'small', 'Delete button must use compact sizing');
  return { key: 'workspace_asset_tree_uses_compact_actions', status: 'PASS' };
}

function test_model1036_declares_local_state_and_source_owned_response_projection() {
  const records = readJson(workspacePatchPath).records || [];
  const expected = {
    target_user_id: '@mbr:localhost',
    message_status: 'idle',
    last_sent_text: '',
  };
  for (const [key, value] of Object.entries(expected)) {
    const record = rootRecord(records, key);
    assert.ok(record, `Model ${consoleModelId} must declare ${key}`);
    assert.equal(record.v, value, `${key} default value mismatch`);
  }
  for (const key of ['last_received_from', 'last_received_text', 'last_received_op_id', 'message_transcript', 'dual_bus_model']) {
    assert.equal(rootRecord(records, key), null, `Model ${consoleModelId} must not own external response truth: ${key}`);
  }

  const snapshot = makeSnapshot(records, [
    { k: 'mgmt_bus_console_event_rows_json', t: 'json', v: [] },
    { k: 'mgmt_bus_console_event_inspector_json', t: 'json', v: [] },
    { k: 'mgmt_bus_console_event_inspector_text', t: 'str', v: '' },
    { k: 'mgmt_bus_console_composer_actions_json', t: 'json', v: [] },
    { k: 'mgmt_bus_console_message_transcript', t: 'str', v: 'No messages sent yet.' },
  ]);
  const ast = buildAstFromCellwiseModel(snapshot, consoleModelId);
  const targetInput = findNodeById(ast, 'mgmt_bus_target_input');
  const transcript = findNodeById(ast, 'mgmt_bus_message_transcript');
  const composerStatus = findNodeById(ast, 'mgmt_bus_composer_status');

  assert.ok(targetInput, 'Mgmt Bus Console target user input missing');
  assert.equal(targetInput.type, 'Input', 'target user must use the existing Input component');
  assert.equal(targetInput.bind?.read?.k, 'target_user_id', 'target input must read target_user_id');
  assert.equal(targetInput.bind?.write?.target_ref?.k, 'target_user_id', 'target input must write target_user_id');
  assert.equal(targetInput.bind?.write?.commit_policy, 'immediate', 'target user edits must commit immediately');

  assert.ok(transcript, 'Mgmt Bus Console message transcript missing');
  assert.equal(transcript.type, 'Terminal', 'message transcript must use existing Terminal component');
  assert.equal(transcript.bind?.read?.model_id, -2, 'message transcript must read source-owned projection state');
  assert.equal(transcript.bind?.read?.k, 'mgmt_bus_console_message_transcript', 'message transcript must read Mgmt Bus Console projection');

  assert.ok(composerStatus, 'Mgmt Bus Console send status badge missing');
  assert.equal(composerStatus.type, 'StatusBadge', 'send status must use the existing StatusBadge component');
  assert.equal(composerStatus.bind?.read?.model_id, 1036, 'send status must read Model 1036 local state');
  assert.equal(composerStatus.bind?.read?.k, 'message_status', 'send status must expose send/reject status, not route health');
  return { key: 'model1036_declares_local_state_and_source_owned_response_projection', status: 'PASS' };
}

function test_send_payload_includes_mbr_target_user() {
  const records = readJson(workspacePatchPath).records || [];
  const snapshot = makeSnapshot(records);
  const ast = buildAstFromCellwiseModel(snapshot, consoleModelId);
  const sendButton = findNodeById(ast, 'mgmt_bus_send_button');
  const valueRef = sendButton?.bind?.write?.value_ref;

  assert.ok(sendButton, 'Mgmt Bus Console send button missing');
  assert.equal(sendButton.bind?.write?.bus_event_v2, true, 'send must remain a bus_event_v2 action');
  assert.equal(sendButton.bind?.write?.bus_in_key, 'mgmt_bus_console_send', 'send must enter Model 0 bus.in');
  assert.ok(Array.isArray(valueRef), 'send payload must be a temporary ModelTable record array');
  assert.ok(valueRef.some((record) => record.k === 'target_user_id' && record.v?.$label?.k === 'target_user_id'), 'send payload must include target_user_id from Model 1036');
  assert.ok(valueRef.some((record) => record.k === 'draft' && record.v?.$label?.k === 'composer_draft'), 'send payload must include draft text from Model 1036');
  assert.ok(valueRef.some((record) => record.k === '__mt_payload_kind' && record.v === 'mgmt_bus_console.send.v1'), 'send payload kind must remain explicit');
  return { key: 'send_payload_includes_mbr_target_user', status: 'PASS' };
}

function test_console_composer_keeps_message_input_usable() {
  const records = readJson(workspacePatchPath).records || [];
  const snapshot = makeSnapshot(records);
  const ast = buildAstFromCellwiseModel(snapshot, consoleModelId);
  const row = findNodeById(ast, 'mgmt_bus_composer_row');
  const targetInput = findNodeById(ast, 'mgmt_bus_target_input');
  const messageInput = findNodeById(ast, 'mgmt_bus_composer_input');
  const sendButton = findNodeById(ast, 'mgmt_bus_send_button');
  const refreshButton = findNodeById(ast, 'mgmt_bus_refresh_button');

  assert.equal(row?.props?.wrap, true, 'composer row must wrap instead of squeezing the message input');
  assert.equal(targetInput?.props?.style?.width, '170px', 'target input must leave space for the message input');
  assert.equal(messageInput?.props?.style?.minWidth, '260px', 'message input must keep a usable minimum width');
  assert.equal(messageInput?.props?.style?.flex, '1 1 260px', 'message input must take remaining row space');
  assert.equal(sendButton?.props?.size, 'small', 'send button must use compact sizing');
  assert.equal(refreshButton?.props?.label, 'Refresh', 'refresh button must keep its existing model-table label');
  assert.equal(refreshButton?.props?.size, 'small', 'refresh button must use compact sizing');
  return { key: 'console_composer_keeps_message_input_usable', status: 'PASS' };
}

async function test_server_forwards_console_intent_to_matrix() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'dy-0342-console-send-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0342_console_send_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = path.join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = path.join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = path.join(tempRoot, 'static');
  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null });
  const sent = [];
  try {
    state.runtime.setRuntimeMode('running');
    state.programEngine.matrixRoomId = '!unit:localhost';
    state.programEngine.matrixDmPeerUserId = '@mbr:localhost';
    state.programEngine.matrixAdapter = {
      publish: async (payload) => {
        sent.push(payload);
        return { ok: true, event_id: '$unit', room_id: '!unit:localhost' };
      },
    };

    const result = await state.submitEnvelope({
      type: 'bus_event_v2',
      bus_in_key: 'mgmt_bus_console_send',
      value: [
        { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'mgmt_bus_console.send.v1' },
        { id: 0, p: 0, r: 0, c: 0, k: 'source_model_id', t: 'int', v: 1036 },
        { id: 0, p: 0, r: 0, c: 0, k: 'target_user_id', t: 'str', v: '@mbr:localhost' },
        { id: 0, p: 0, r: 0, c: 0, k: 'draft', t: 'str', v: 'hello from 0342' },
      ],
      meta: { op_id: 'it0342_console_send' },
    });
    await wait(50);

    assert.equal(result.result, 'ok', 'server must accept valid console send bus_event_v2');
    assert.equal(sent.length, 1, 'server must forward one Matrix packet for console send');
    assert.equal(sent[0].version, 'v1', 'forwarded packet must use pin_payload v1');
    assert.equal(sent[0].type, 'pin_payload', 'forwarded packet type must be pin_payload');
    assert.equal(sent[0].source_model_id, 1036, 'forwarded packet must identify Model 1036 as source');
    assert.equal(sent[0].pin, 'submit', 'forwarded packet must use submit pin');
    assert.ok(Array.isArray(sent[0].payload), 'forwarded packet payload must remain a ModelTable record array');
    assert.ok(sent[0].payload.some((record) => record.k === 'target_user_id' && record.v === '@mbr:localhost'), 'forwarded packet must preserve target_user_id');
    assert.ok(sent[0].payload.some((record) => record.k === 'draft' && record.v === 'hello from 0342'), 'forwarded packet must preserve draft text');
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.DY_AUTH;
    delete process.env.DY_PERSISTED_ASSET_ROOT;
    delete process.env.WORKER_BASE_WORKSPACE;
    delete process.env.WORKER_BASE_DATA_ROOT;
    delete process.env.DOCS_ROOT;
    delete process.env.STATIC_PROJECTS_ROOT;
  }
  return { key: 'server_forwards_console_intent_to_matrix', status: 'PASS' };
}

async function test_server_rejects_malformed_console_send_payload() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'dy-0342-console-bad-send-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0342_console_bad_send_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = path.join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = path.join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = path.join(tempRoot, 'static');
  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null });
  const sent = [];
  try {
    state.runtime.setRuntimeMode('running');
    state.programEngine.matrixRoomId = '!unit:localhost';
    state.programEngine.matrixDmPeerUserId = '@mbr:localhost';
    state.programEngine.matrixAdapter = {
      publish: async (payload) => {
        sent.push(payload);
        return { ok: true, event_id: '$bad-send', room_id: '!unit:localhost' };
      },
    };

    const sys = state.runtime.getModel(-10);
    state.runtime.addLabel(sys, 0, 0, 0, {
      k: 'mgmt_bus_console_intent',
      t: 'pin.in',
      v: [
        { k: '__mt_payload_kind', t: 'str', v: 'mgmt_bus_console.send.v1' },
        { k: 'target_user_id', t: 'str', v: '@mbr:localhost' },
        { k: 'draft', t: 'str', v: 'malformed send must reject' },
      ],
    });
    state.programEngine.processEventsSnapshot();
    await wait(50);

    assert.equal(sent.length, 0, 'server must not forward malformed console send payloads');
    const error = state.runtime.getLabelValue(sys, 0, 0, 0, 'mgmt_bus_console_error');
    assert.equal(error?.code, 'invalid_bus_payload', 'server must mark malformed console send payloads as invalid_bus_payload');
    assert.equal(error?.detail, 'temporary_modeltable_required', 'server must require a temporary ModelTable record array');
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.DY_AUTH;
    delete process.env.DY_PERSISTED_ASSET_ROOT;
    delete process.env.WORKER_BASE_WORKSPACE;
    delete process.env.WORKER_BASE_DATA_ROOT;
    delete process.env.DOCS_ROOT;
    delete process.env.STATIC_PROJECTS_ROOT;
  }
  return { key: 'server_rejects_malformed_console_send_payload', status: 'PASS' };
}

async function test_server_rejects_empty_console_send_payload_at_ingress() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'dy-0342-console-empty-send-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0342_console_empty_send_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = path.join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = path.join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = path.join(tempRoot, 'static');
  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null });
  const sent = [];
  try {
    state.runtime.setRuntimeMode('running');
    state.programEngine.matrixRoomId = '!unit:localhost';
    state.programEngine.matrixDmPeerUserId = '@mbr:localhost';
    state.programEngine.matrixAdapter = {
      publish: async (payload) => {
        sent.push(payload);
        return { ok: true, event_id: '$empty-send', room_id: '!unit:localhost' };
      },
    };

    const result = await state.submitEnvelope({
      type: 'bus_event_v2',
      bus_in_key: 'mgmt_bus_console_send',
      value: [],
      meta: { op_id: 'it0342_empty_console_send' },
    });
    await wait(50);

    assert.equal(result.result, 'error', 'server must reject empty console send payloads at ingress');
    assert.equal(result.code, 'invalid_bus_payload', 'empty console send payloads must be invalid_bus_payload');
    assert.equal(result.detail, 'temporary_modeltable_required', 'empty console send payloads must require a temporary ModelTable record array');
    assert.equal(sent.length, 0, 'server must not forward empty console send payloads');
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.DY_AUTH;
    delete process.env.DY_PERSISTED_ASSET_ROOT;
    delete process.env.WORKER_BASE_WORKSPACE;
    delete process.env.WORKER_BASE_DATA_ROOT;
    delete process.env.DOCS_ROOT;
    delete process.env.STATIC_PROJECTS_ROOT;
  }
  return { key: 'server_rejects_empty_console_send_payload_at_ingress', status: 'PASS' };
}

async function test_server_rejects_non_array_console_intent_without_silent_skip() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'dy-0342-console-nonarray-intent-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0342_console_nonarray_intent_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = path.join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = path.join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = path.join(tempRoot, 'static');
  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null });
  const sent = [];
  try {
    state.runtime.setRuntimeMode('running');
    state.programEngine.matrixRoomId = '!unit:localhost';
    state.programEngine.matrixDmPeerUserId = '@mbr:localhost';
    state.programEngine.matrixAdapter = {
      publish: async (payload) => {
        sent.push(payload);
        return { ok: true, event_id: '$nonarray-intent', room_id: '!unit:localhost' };
      },
    };

    const sys = state.runtime.getModel(-10);
    const consoleModel = state.runtime.getModel(consoleModelId);
    state.runtime.addLabel(sys, 0, 0, 0, {
      k: 'mgmt_bus_console_intent',
      t: 'pin.in',
      v: {
        __mt_payload_kind: 'mgmt_bus_console.send.v1',
        target_user_id: '@mbr:localhost',
        draft: 'non-array intent must reject',
      },
    });
    state.programEngine.processEventsSnapshot();
    await wait(50);

    assert.equal(sent.length, 0, 'server must not forward non-array console intents');
    assert.equal(
      state.runtime.getLabelValue(consoleModel, 0, 0, 0, 'message_status'),
      'invalid_bus_payload',
      'server must mark non-array console intent as rejected instead of silently skipping',
    );
    const error = state.runtime.getLabelValue(sys, 0, 0, 0, 'mgmt_bus_console_error');
    assert.equal(error?.code, 'invalid_bus_payload', 'server must record invalid_bus_payload for non-array console intents');
    assert.equal(error?.detail, 'temporary_modeltable_required', 'server must require temporary ModelTable records for non-array console intents');
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.DY_AUTH;
    delete process.env.DY_PERSISTED_ASSET_ROOT;
    delete process.env.WORKER_BASE_WORKSPACE;
    delete process.env.WORKER_BASE_DATA_ROOT;
    delete process.env.DOCS_ROOT;
    delete process.env.STATIC_PROJECTS_ROOT;
  }
  return { key: 'server_rejects_non_array_console_intent_without_silent_skip', status: 'PASS' };
}

async function test_server_projects_mbr_response_from_trace_without_writing_model1036() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'dy-0342-console-recv-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0342_console_recv_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = path.join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = path.join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = path.join(tempRoot, 'static');
  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null });
  try {
    state.runtime.setRuntimeMode('running');
    state.programEngine.handleDyBusEvent({
      version: 'v1',
      type: 'mgmt_bus_console_ack',
      op_id: 'mbr_ack_it0342_mbr_ack',
      source_model_id: 1036,
      target_user_id: '@mbr:localhost',
      payload: [
        { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'mgmt_bus_console.ack.v1' },
        { id: 0, p: 0, r: 0, c: 0, k: 'target_user_id', t: 'str', v: '@mbr:localhost' },
        { id: 0, p: 0, r: 0, c: 0, k: 'reply_text', t: 'str', v: 'ack from @mbr:localhost: hello' },
      ],
      timestamp: Date.now(),
    });
    await state.programEngine.tick();
    state.clientSnap();
    await wait(80);

    const model = state.runtime.getModel(consoleModelId);
    const stateModel = state.runtime.getModel(-2);
    assert.equal(state.runtime.getLabelValue(model, 0, 0, 0, 'last_received_from'), undefined, 'server must not write response sender to Model 1036');
    assert.equal(state.runtime.getLabelValue(model, 0, 0, 0, 'message_transcript'), undefined, 'server must not write response transcript to Model 1036');
    assert.equal(
      state.runtime.getLabelValue(model, 0, 0, 0, 'message_status'),
      'ack_received',
      'server must update the visible send status after a valid MBR ack',
    );
    assert.match(
      state.runtime.getLabelValue(stateModel, 0, 0, 0, 'mgmt_bus_console_message_transcript') || '',
      /ack from @mbr:localhost: hello/u,
      'server must project MBR response transcript from source-owned trace state',
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.DY_AUTH;
    delete process.env.DY_PERSISTED_ASSET_ROOT;
    delete process.env.WORKER_BASE_WORKSPACE;
    delete process.env.WORKER_BASE_DATA_ROOT;
    delete process.env.DOCS_ROOT;
    delete process.env.STATIC_PROJECTS_ROOT;
  }
  return { key: 'server_projects_mbr_response_from_trace_without_writing_model1036', status: 'PASS' };
}

async function test_server_rejects_malformed_mbr_ack_payloads() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'dy-0342-console-bad-ack-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0342_console_bad_ack_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = path.join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = path.join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = path.join(tempRoot, 'static');
  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null });
  try {
    state.runtime.setRuntimeMode('running');
    const invalidAcks = [
      {
        version: 'v1',
        type: 'mgmt_bus_console_ack',
        op_id: 'bad_ack_no_payload',
        source_model_id: 1036,
        target_user_id: '@mbr:localhost',
        reply_text: 'top-level reply must not project',
        timestamp: Date.now(),
      },
      {
        version: 'v1',
        type: 'mgmt_bus_console_ack',
        op_id: 'bad_ack_payload_not_array',
        source_model_id: 1036,
        target_user_id: '@mbr:localhost',
        payload: { reply_text: 'object payload must not project' },
        timestamp: Date.now(),
      },
      {
        version: 'v1',
        type: 'mgmt_bus_console_ack',
        op_id: 'bad_ack_missing_kind',
        source_model_id: 1036,
        target_user_id: '@mbr:localhost',
        payload: [
          { id: 0, p: 0, r: 0, c: 0, k: 'target_user_id', t: 'str', v: '@mbr:localhost' },
          { id: 0, p: 0, r: 0, c: 0, k: 'reply_text', t: 'str', v: 'missing kind must not project' },
        ],
        timestamp: Date.now(),
      },
      {
        version: 'v1',
        type: 'mgmt_bus_console_ack',
        op_id: 'bad_ack_target_mismatch',
        source_model_id: 1036,
        target_user_id: '@mbr:other-host',
        payload: [
          { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'mgmt_bus_console.ack.v1' },
          { id: 0, p: 0, r: 0, c: 0, k: 'target_user_id', t: 'str', v: '@mbr:localhost' },
          { id: 0, p: 0, r: 0, c: 0, k: 'reply_text', t: 'str', v: 'target mismatch must not project' },
        ],
        timestamp: Date.now(),
      },
      {
        version: 'v1',
        type: 'mgmt_bus_console_ack',
        op_id: 'bad_ack_source_mismatch',
        source_model_id: 999,
        target_user_id: '@mbr:localhost',
        payload: [
          { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'mgmt_bus_console.ack.v1' },
          { id: 0, p: 0, r: 0, c: 0, k: 'target_user_id', t: 'str', v: '@mbr:localhost' },
          { id: 0, p: 0, r: 0, c: 0, k: 'reply_text', t: 'str', v: 'source mismatch must not project' },
        ],
        timestamp: Date.now(),
      },
    ];
    for (const ack of invalidAcks) {
      state.programEngine.handleDyBusEvent(ack);
    }
    await state.programEngine.tick();
    state.clientSnap();
    await wait(80);

    const stateModel = state.runtime.getModel(-2);
    const transcript = state.runtime.getLabelValue(stateModel, 0, 0, 0, 'mgmt_bus_console_message_transcript') || '';
    assert.doesNotMatch(transcript, /top-level reply|object payload|missing kind|target mismatch|source mismatch/u, 'malformed MBR acks must not project into the console transcript');
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.DY_AUTH;
    delete process.env.DY_PERSISTED_ASSET_ROOT;
    delete process.env.WORKER_BASE_WORKSPACE;
    delete process.env.WORKER_BASE_DATA_ROOT;
    delete process.env.DOCS_ROOT;
    delete process.env.STATIC_PROJECTS_ROOT;
  }
  return { key: 'server_rejects_malformed_mbr_ack_payloads', status: 'PASS' };
}

function test_mbr_dispatch_replies_only_to_console_messages() {
  const rt = new ModelTableRuntime();
  rt.applyPatch(readJson(systemPatchPath), { allowCreateModel: true, trustedBootstrap: true });
  rt.applyPatch(readJson(mbrRolePath), { allowCreateModel: true, trustedBootstrap: true });
  const sys = rt.getModel(-10);
  const root = rt.getCell(sys, 0, 0, 0);
  const matrixFunc = root.labels.get('mbr_matrix_func')?.v;
  assert.equal(matrixFunc, 'mbr_mgmt_dispatch', 'MBR Matrix function must dispatch console messages before generic MQTT routing');

  const engine = new WorkerEngineV0({ runtime: rt, mqttPublish: () => {} });
  const dispatch = (packet) => {
    rt.rmLabel(sys, 0, 0, 0, 'mbr_mgmt_console_ack_out');
    rt.rmLabel(sys, 0, 0, 0, 'mbr_mgmt_error');
    rt.addLabel(sys, 0, 0, 0, { k: 'mbr_mgmt_inbox', t: 'json', v: packet });
    engine.executeFunction(matrixFunc);
    return {
      ack: root.labels.get('mbr_mgmt_console_ack_out')?.v,
      error: root.labels.get('mbr_mgmt_error')?.v,
    };
  };

  const valid = dispatch({
      version: 'v1',
      type: 'pin_payload',
      op_id: 'it0342_mbr_dispatch',
      source_model_id: 1036,
      pin: 'submit',
      payload: [
        { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'mgmt_bus_console.send.v1' },
        { id: 0, p: 0, r: 0, c: 0, k: 'target_user_id', t: 'str', v: '@mbr:localhost' },
        { id: 0, p: 0, r: 0, c: 0, k: 'draft', t: 'str', v: 'hello mbr dispatch' },
      ],
      timestamp: Date.now(),
  });
  const ack = valid.ack;
  assert.equal(ack?.version, 'v1', 'MBR dispatch must emit v1 response');
  assert.equal(ack?.type, 'mgmt_bus_console_ack', 'MBR dispatch response must be a console ack event, not a Model 1036 writeback');
  assert.equal(ack?.source_model_id, 1036, 'MBR dispatch response must correlate to Model 1036 without materializing into it');
  assert.equal(ack?.target_user_id, '@mbr:localhost', 'MBR dispatch response must preserve the explicit target');
  assert.ok(Array.isArray(ack?.payload), 'MBR dispatch response payload must be a ModelTable record array');
  assert.ok(ack.payload.some((record) => record.k === '__mt_payload_kind' && record.v === 'mgmt_bus_console.ack.v1'), 'MBR dispatch must mark the response payload kind');
  assert.ok(ack.payload.some((record) => record.k === 'reply_text' && /ack from @mbr:localhost/u.test(record.v)), 'MBR dispatch must return an ack text in the temporary payload');
  assert.equal(root.labels.has('mbr_mgmt_inbox'), false, 'MBR dispatch must clean the consumed inbox');

  const missingTarget = dispatch({
    version: 'v1',
    type: 'pin_payload',
    op_id: 'it0342_mbr_missing_target',
    source_model_id: 1036,
    pin: 'submit',
    payload: [
      { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'mgmt_bus_console.send.v1' },
      { id: 0, p: 0, r: 0, c: 0, k: 'draft', t: 'str', v: 'missing target must reject' },
    ],
    timestamp: Date.now(),
  });
  assert.equal(missingTarget.ack, undefined, 'MBR dispatch must reject missing target_user_id');
  assert.ok(missingTarget.error, 'MBR dispatch must record an error for missing target_user_id');

  const invalidTarget = dispatch({
    version: 'v1',
    type: 'pin_payload',
    op_id: 'it0342_mbr_invalid_target',
    source_model_id: 1036,
    pin: 'submit',
    payload: [
      { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'mgmt_bus_console.send.v1' },
      { id: 0, p: 0, r: 0, c: 0, k: 'target_user_id', t: 'str', v: '@not-mbr:localhost' },
      { id: 0, p: 0, r: 0, c: 0, k: 'draft', t: 'str', v: 'invalid target must reject' },
    ],
    timestamp: Date.now(),
  });
  assert.equal(invalidTarget.ack, undefined, 'MBR dispatch must reject non-MBR targets');
  assert.ok(invalidTarget.error, 'MBR dispatch must record an error for non-MBR targets');

  const generic = dispatch({
      version: 'v1',
      type: 'pin_payload',
      op_id: 'it0342_mbr_not_crud',
      source_model_id: 1036,
      pin: 'submit',
      payload: [
        { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'generic.crud.v1' },
      ],
      timestamp: Date.now(),
  });
  assert.ok(generic.error, 'MBR dispatch must not treat generic Model 1036 payloads as accepted CRUD');

  const malformed = dispatch({
      version: 'v1',
      type: 'pin_payload',
      op_id: 'it0342_mbr_malformed_send',
      source_model_id: 1036,
      pin: 'submit',
      payload: [
        { k: '__mt_payload_kind', t: 'str', v: 'mgmt_bus_console.send.v1' },
        { k: 'target_user_id', t: 'str', v: '@mbr:localhost' },
        { k: 'draft', t: 'str', v: 'malformed mbr send' },
      ],
      timestamp: Date.now(),
  });
  assert.equal(malformed.ack, undefined, 'MBR dispatch must reject non-ModelTable-record console sends');
  assert.ok(malformed.error, 'MBR dispatch must record an error for non-ModelTable-record console sends');
  assert.equal(malformed.error?.detail, 'temporary_modeltable_required', 'MBR dispatch must require a temporary ModelTable record array');

  const legacyRecordField = dispatch({
      version: 'v1',
      type: 'pin_payload',
      op_id: 'it0342_mbr_legacy_record_field',
      source_model_id: 1036,
      pin: 'submit',
      payload: [
        { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'mgmt_bus_console.send.v1' },
        { id: 0, p: 0, r: 0, c: 0, k: 'target_user_id', t: 'str', v: '@mbr:localhost' },
        { id: 0, p: 0, r: 0, c: 0, k: 'draft', t: 'str', v: 'legacy record fields must reject', op: 'add_label' },
      ],
      timestamp: Date.now(),
  });
  assert.equal(legacyRecordField.ack, undefined, 'MBR dispatch must reject records carrying legacy op/model_id fields');
  assert.ok(legacyRecordField.error, 'MBR dispatch must record an error for legacy record fields');
  assert.equal(legacyRecordField.error?.detail, 'temporary_modeltable_required', 'legacy record fields must fail the temporary ModelTable contract');

  const missingValueRecord = dispatch({
      version: 'v1',
      type: 'pin_payload',
      op_id: 'it0342_mbr_missing_value_record',
      source_model_id: 1036,
      pin: 'submit',
      payload: [
        { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'mgmt_bus_console.send.v1' },
        { id: 0, p: 0, r: 0, c: 0, k: 'target_user_id', t: 'str', v: '@mbr:localhost' },
        { id: 0, p: 0, r: 0, c: 0, k: 'draft', t: 'str', v: 'records missing v must reject' },
        { id: 0, p: 0, r: 0, c: 0, k: 'extra', t: 'str' },
      ],
      timestamp: Date.now(),
  });
  assert.equal(missingValueRecord.ack, undefined, 'MBR dispatch must reject records without an explicit v field');
  assert.ok(missingValueRecord.error, 'MBR dispatch must record an error for records missing v');
  assert.equal(missingValueRecord.error?.detail, 'temporary_modeltable_required', 'records missing v must fail the temporary ModelTable contract');
  return { key: 'mbr_dispatch_replies_only_to_console_messages', status: 'PASS' };
}

function test_no_browser_or_ui_direct_matrix_path_added() {
  const forbiddenBrowser = /matrix-js-sdk|sendMatrix\s*\(|\/_matrix\/client/u;
  for (const relPath of [
    'packages/ui-model-demo-frontend/src/remote_store.js',
    'packages/ui-renderer/src/renderer.mjs',
    'packages/ui-renderer/src/renderer.js',
  ]) {
    assert.doesNotMatch(readText(relPath), forbiddenBrowser, `${relPath} must not gain direct Matrix calls`);
  }
  assert.match(readText(serverPath), /mgmt_bus_console_intent/u, 'server must process the already-routed management console intent');
  assert.doesNotMatch(
    flattenRecords(recordsForModel(readJson(workspacePatchPath).records || [], consoleModelId)),
    /access_token|matrix_token|matrix_passwd|password/u,
    'Mgmt Bus Console model must not embed Matrix secrets',
  );
  return { key: 'no_browser_or_ui_direct_matrix_path_added', status: 'PASS' };
}

async function main() {
  const tests = [
    test_workspace_asset_tree_uses_compact_actions,
    test_model1036_declares_local_state_and_source_owned_response_projection,
    test_send_payload_includes_mbr_target_user,
    test_console_composer_keeps_message_input_usable,
    test_server_forwards_console_intent_to_matrix,
    test_server_rejects_malformed_console_send_payload,
    test_server_rejects_empty_console_send_payload_at_ingress,
    test_server_rejects_non_array_console_intent_without_silent_skip,
    test_server_projects_mbr_response_from_trace_without_writing_model1036,
    test_server_rejects_malformed_mbr_ack_payloads,
    test_mbr_dispatch_replies_only_to_console_messages,
    test_no_browser_or_ui_direct_matrix_path_added,
  ];
  const results = [];
  for (const test of tests) {
    results.push(await test());
  }
  console.log(JSON.stringify({ ok: true, results }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
