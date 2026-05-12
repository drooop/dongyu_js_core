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

function externalPinPacket(rt, key) {
  const model0 = rt.getModel(0);
  const label = model0 ? rt.getCell(model0, 0, 0, 0).labels.get(key) : null;
  return label && typeof rt._pinBusOutValueToExternalPayload === 'function'
    ? rt._pinBusOutValueToExternalPayload(label.v)
    : null;
}

function payloadRecord(records, key) {
  return (Array.isArray(records) ? records : []).find((record) => (
    record && record.id === 0 && record.p === 0 && record.r === 0 && record.c === 0 && record.k === key
  )) || null;
}

function mtRecord(k, t, v) {
  return { id: 0, p: 0, r: 0, c: 0, k, t, v };
}

function packetOpId(packet) {
  return payloadRecord(packet?.payload, 'op_id')?.v;
}

function makeSplitBusPinPayloadValue(opId, text = 'hello') {
  return [
    mtRecord('__mt_payload_kind', 'str', 'pin_payload.v1'),
    mtRecord('__mt_request_id', 'str', opId),
    mtRecord('op_id', 'str', opId),
    mtRecord('endpoint_worker_id', 'str', 'mbr'),
    mtRecord('endpoint_model_id', 'int', 1036),
    mtRecord('endpoint_pin', 'str', 'submit'),
    mtRecord('origin_worker_id', 'str', 'ui-server-test'),
    mtRecord('origin_model_id', 'int', 1036),
    mtRecord('origin_pin', 'str', 'submit'),
    mtRecord('reply_target_worker_id', 'str', 'ui-server-test'),
    mtRecord('reply_target_model_id', 'int', 1036),
    mtRecord('reply_target_pin', 'str', 'result'),
    mtRecord('payload', 'json', [mtRecord('reply_text', 'str', text)]),
    mtRecord('timestamp', 'int', Date.now()),
  ];
}

function makePinPayloadPacket({
  opId,
  endpoint = { worker_id: 'mbr', model_id: 1036, pin: 'submit' },
  origin = { worker_id: 'ui-server-test', model_id: 1036, pin: 'submit' },
  replyTarget = { worker_id: 'ui-server-test', model_id: 1036, pin: 'result' },
  payload = [],
  timestamp = Date.now(),
}) {
  return {
    version: 'v1',
    type: 'pin_payload',
    payload: [
      mtRecord('__mt_payload_kind', 'str', 'pin_payload.v1'),
      mtRecord('__mt_request_id', 'str', opId),
      mtRecord('op_id', 'str', opId),
      mtRecord('endpoint_worker_id', 'str', endpoint.worker_id),
      mtRecord('endpoint_model_id', 'int', endpoint.model_id),
      mtRecord('endpoint_pin', 'str', endpoint.pin),
      mtRecord('origin_worker_id', 'str', origin.worker_id),
      mtRecord('origin_model_id', 'int', origin.model_id),
      mtRecord('origin_pin', 'str', origin.pin),
      mtRecord('reply_target_worker_id', 'str', replyTarget.worker_id),
      mtRecord('reply_target_model_id', 'int', replyTarget.model_id),
      mtRecord('reply_target_pin', 'str', replyTarget.pin),
      mtRecord('payload', 'json', payload),
      mtRecord('timestamp', 'int', timestamp),
    ],
  };
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
  const cellLabel = (p, r, c, key) => findRecord(records, (record) => (
    record?.model_id === -25
    && record?.p === p
    && record?.r === r
    && record?.c === c
    && record?.k === key
  ));
  const actionsLabel = cellLabel(2, 6, 0, 'ui_label');
  const actionsWidth = cellLabel(2, 6, 0, 'ui_width');
  const actionsFixed = cellLabel(2, 6, 0, 'ui_fixed');
  const sourceVisibleCol = findRecord(records, (record) => (
    record?.model_id === -25
    && record?.k === 'ui_prop'
    && record?.v === 'source'
  ));
  const openSize = cellLabel(2, 7, 0, 'ui_size');
  const deleteLabel = cellLabel(2, 7, 1, 'ui_label');
  const deleteSize = cellLabel(2, 7, 1, 'ui_size');

  assert.equal(actionsLabel?.v, 'Actions', 'Workspace actions column must exist');
  assert.ok(Number(actionsWidth?.v) <= 84, 'Workspace actions column must be compact enough to stop covering names');
  assert.equal(actionsFixed, null, 'Workspace actions column must not use fixed overlay in the narrow asset tree');
  assert.equal(sourceVisibleCol, null, 'Workspace source column must not render as a squeezed visible column');
  assert.equal(openSize?.v, 'small', 'Open button must use compact sizing');
  assert.equal(deleteLabel?.v, 'Del', 'Delete button must use a short visible label');
  assert.equal(deleteSize?.v, 'small', 'Delete button must use compact sizing');
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
    assert.deepEqual(Object.keys(sent[0]).sort(), ['payload', 'type', 'version'], 'forwarded packet must not carry loose route/source/pin fields');
    assert.equal(payloadRecord(sent[0].payload, '__mt_payload_kind')?.v, 'pin_payload.v1', 'forwarded packet must declare outer pin_payload kind');
    assert.equal(payloadRecord(sent[0].payload, 'endpoint_worker_id')?.v, 'mbr', 'forwarded packet endpoint worker must target the MBR user');
    assert.equal(payloadRecord(sent[0].payload, 'endpoint_model_id')?.v, 1036, 'forwarded packet endpoint model must be Mgmt Bus Console');
    assert.equal(payloadRecord(sent[0].payload, 'endpoint_pin')?.v, 'submit', 'forwarded packet endpoint pin must be submit');
    assert.equal(payloadRecord(sent[0].payload, 'reply_target_worker_id')?.v, 'ui-server-local', 'forwarded packet reply target worker must be the UI server');
    assert.equal(payloadRecord(sent[0].payload, 'reply_target_model_id')?.v, 1036, 'forwarded packet reply target model must be Mgmt Bus Console');
    assert.equal(payloadRecord(sent[0].payload, 'reply_target_pin')?.v, 'result', 'forwarded packet reply target pin must be result');
    const businessPayload = payloadRecord(sent[0].payload, 'payload')?.v;
    assert.ok(Array.isArray(businessPayload), 'forwarded packet nested payload must remain a ModelTable record array');
    assert.ok(businessPayload.some((record) => record.k === 'target_user_id' && record.v === '@mbr:localhost'), 'forwarded packet must preserve target_user_id in nested payload');
    assert.ok(businessPayload.some((record) => record.k === 'draft' && record.v === 'hello from 0342'), 'forwarded packet must preserve draft text in nested payload');
    assert.ok(businessPayload.some((record) => record.k === 'message_text' && record.v === 'hello from 0342'), 'forwarded packet must normalize message_text in nested payload');
    const consoleModel = state.runtime.getModel(consoleModelId);
    assert.equal(state.runtime.getLabelValue(consoleModel, 0, 0, 0, 'last_sent_text'), 'hello from 0342', 'send projection must display nested message_text');
    assert.equal(state.runtime.getLabelValue(consoleModel, 0, 0, 0, 'target_user_id'), '@mbr:localhost', 'send projection must display nested target_user_id');
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
      type: 'pin_payload',
      payload: [
        mtRecord('__mt_payload_kind', 'str', 'pin_payload.v1'),
        mtRecord('__mt_request_id', 'str', 'mbr_ack_it0342_mbr_ack'),
        mtRecord('op_id', 'str', 'mbr_ack_it0342_mbr_ack'),
        mtRecord('endpoint_worker_id', 'str', 'ui-server-local'),
        mtRecord('endpoint_model_id', 'int', 1036),
        mtRecord('endpoint_pin', 'str', 'result'),
        mtRecord('origin_worker_id', 'str', 'mbr'),
        mtRecord('origin_model_id', 'int', 1036),
        mtRecord('origin_pin', 'str', 'submit'),
        mtRecord('reply_target_worker_id', 'str', 'ui-server-local'),
        mtRecord('reply_target_model_id', 'int', 1036),
        mtRecord('reply_target_pin', 'str', 'result'),
        mtRecord('payload', 'json', [
          mtRecord('__mt_payload_kind', 'str', 'mgmt_bus_console.ack.v1'),
          mtRecord('target_user_id', 'str', '@mbr:localhost'),
          mtRecord('reply_text', 'str', 'ack from @mbr:localhost: hello'),
        ]),
        mtRecord('timestamp', 'int', Date.now()),
      ],
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

async function test_server_split_bus_matrix_failures_are_observable_and_retryable() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'dy-0342-split-bus-failure-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0342_split_bus_failure_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = path.join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = path.join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = path.join(tempRoot, 'static');
  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null });
  try {
    state.runtime.setRuntimeMode('running');
    const model0 = state.runtime.getModel(0);
    const model0Root = state.runtime.getCell(model0, 0, 0, 0);

    state.runtime.addLabel(model0, 0, 0, 0, {
      k: 'unavailable_mb_out',
      t: 'pin.bus.mb.out',
      v: makeSplitBusPinPayloadValue('it0342_unavailable_mb_out', 'adapter unavailable'),
    });
    state.programEngine.schedulePendingModel0Egress(new Set());
    await wait(20);

    assert.equal(state.programEngine.bridgedBusOutPorts.get('unavailable_mb_out'), undefined, 'unavailable Matrix must not be marked bridged');
    assert.ok(model0Root.labels.has('unavailable_mb_out'), 'unavailable Matrix must retain the management bus out pin for retry');
    assert.equal(
      state.runtime.getLabelValue(model0, 0, 0, 0, 'split_bus_out_error')?.code,
      'missing_split_bus_matrix_adapter',
      'unavailable Matrix must write an observable split bus out error',
    );

    const rejected = [];
    state.programEngine.matrixRoomId = '!unit:localhost';
    state.programEngine.matrixDmPeerUserId = '@mbr:localhost';
    state.programEngine.matrixAdapter = {
      publish: async (payload) => {
        rejected.push(payload);
        throw new Error('matrix down');
      },
    };
    state.runtime.addLabel(model0, 0, 0, 0, {
      k: 'reject_mb_out',
      t: 'pin.bus.mb.out',
      v: makeSplitBusPinPayloadValue('it0342_reject_mb_out', 'adapter rejects'),
    });
    state.programEngine.schedulePendingModel0Egress(new Set());
    await wait(20);

    assert.equal(rejected.length, 2, 'rejecting Matrix adapter must receive one publish attempt for each retryable pending pin');
    assert.ok(rejected.some((packet) => packetOpId(packet) === 'it0342_unavailable_mb_out'), 'previous unavailable pin must retry once Matrix config becomes available');
    assert.ok(rejected.some((packet) => packetOpId(packet) === 'it0342_reject_mb_out'), 'new rejecting pin must attempt publish once');
    assert.equal(state.programEngine.bridgedBusOutPorts.get('reject_mb_out'), undefined, 'rejected Matrix publish must not be marked bridged');
    assert.ok(model0Root.labels.has('reject_mb_out'), 'rejected Matrix publish must retain the management bus out pin for retry');
    assert.equal(
      state.runtime.getLabelValue(model0, 0, 0, 0, 'split_bus_out_error')?.code,
      'split_bus_matrix_publish_failed',
      'rejected Matrix publish must write an observable split bus out error',
    );

    const sent = [];
    state.programEngine.matrixAdapter = {
      publish: async (payload) => {
        sent.push(payload);
        return { ok: true, event_id: '$retry', room_id: '!unit:localhost' };
      },
    };
    state.programEngine.schedulePendingModel0Egress(new Set());
    await wait(20);

    assert.ok(sent.some((packet) => packetOpId(packet) === 'it0342_unavailable_mb_out'), 'unavailable pin must be retryable after Matrix recovers');
    assert.ok(sent.some((packet) => packetOpId(packet) === 'it0342_reject_mb_out'), 'rejected pin must be retryable after Matrix recovers');
    assert.equal(state.programEngine.bridgedBusOutPorts.get('unavailable_mb_out'), 'it0342_unavailable_mb_out', 'successful retry must mark unavailable pin bridged');
    assert.equal(state.programEngine.bridgedBusOutPorts.get('reject_mb_out'), 'it0342_reject_mb_out', 'successful retry must mark rejected pin bridged');
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.DY_AUTH;
    delete process.env.DY_PERSISTED_ASSET_ROOT;
    delete process.env.WORKER_BASE_WORKSPACE;
    delete process.env.WORKER_BASE_DATA_ROOT;
    delete process.env.DOCS_ROOT;
    delete process.env.STATIC_PROJECTS_ROOT;
  }
  return { key: 'server_split_bus_matrix_failures_are_observable_and_retryable', status: 'PASS' };
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
    rt.rmLabel(rt.getModel(0), 0, 0, 0, 'mbr_mb_out');
    rt.rmLabel(sys, 0, 0, 0, 'mbr_mgmt_error');
    rt.addLabel(sys, 0, 0, 0, { k: 'mbr_mgmt_inbox', t: 'json', v: packet });
    engine.executeFunction(matrixFunc);
    return {
      ack: externalPinPacket(rt, 'mbr_mb_out'),
      error: root.labels.get('mbr_mgmt_error')?.v,
    };
  };
  const consolePayload = (opId, payload) => makePinPayloadPacket({ opId, payload });

  const valid = dispatch(consolePayload('it0342_mbr_dispatch', [
    mtRecord('__mt_payload_kind', 'str', 'mgmt_bus_console.send.v1'),
    mtRecord('target_user_id', 'str', '@mbr:localhost'),
    mtRecord('draft', 'str', 'hello mbr dispatch'),
  ]));
  const ack = valid.ack;
  assert.equal(ack?.version, 'v1', 'MBR dispatch must emit v1 response');
  assert.equal(ack?.type, 'pin_payload', 'MBR dispatch response must be emitted through the management-bus pin_payload path');
  assert.deepEqual(Object.keys(ack).sort(), ['payload', 'type', 'version'], 'MBR dispatch response must not carry loose route/source/pin fields');
  assert.equal(payloadRecord(ack.payload, 'endpoint_worker_id')?.v, 'ui-server-test', 'MBR dispatch response endpoint must target the UI Server worker');
  assert.equal(payloadRecord(ack.payload, 'endpoint_model_id')?.v, 1036, 'MBR dispatch response endpoint must target Model 1036');
  assert.equal(payloadRecord(ack.payload, 'endpoint_pin')?.v, 'result', 'MBR dispatch response endpoint must target the result pin');
  assert.equal(payloadRecord(ack.payload, 'origin_worker_id')?.v, 'mbr', 'MBR dispatch response origin must be MBR');
  assert.equal(payloadRecord(ack.payload, 'origin_model_id')?.v, 1036, 'MBR dispatch response origin must preserve the console model');
  assert.equal(payloadRecord(ack.payload, 'origin_pin')?.v, 'submit', 'MBR dispatch response origin must preserve the console ingress pin');
  assert.equal(payloadRecord(ack.payload, 'reply_target_worker_id')?.v, 'ui-server-test', 'MBR dispatch response reply target must be carried in payload records');
  assert.equal(payloadRecord(ack.payload, 'reply_target_model_id')?.v, 1036, 'MBR dispatch response reply target model must be carried in payload records');
  assert.equal(payloadRecord(ack.payload, 'reply_target_pin')?.v, 'result', 'MBR dispatch response reply target pin must be carried in payload records');
  const ackPayload = payloadRecord(ack.payload, 'payload')?.v;
  assert.ok(Array.isArray(ackPayload), 'MBR dispatch response business payload must be a ModelTable record array');
  assert.ok(ackPayload.some((record) => record.k === '__mt_payload_kind' && record.v === 'mgmt_bus_console.ack.v1'), 'MBR dispatch must mark the response payload kind');
  assert.ok(ackPayload.some((record) => record.k === 'target_user_id' && record.v === '@mbr:localhost'), 'MBR dispatch response must preserve the explicit target');
  assert.ok(ackPayload.some((record) => record.k === 'reply_text' && /ack from @mbr:localhost/u.test(record.v)), 'MBR dispatch must return an ack text in the temporary payload');
  assert.equal(root.labels.has('mbr_mgmt_inbox'), false, 'MBR dispatch must clean the consumed inbox');

  const missingTarget = dispatch(consolePayload('it0342_mbr_missing_target', [
    mtRecord('__mt_payload_kind', 'str', 'mgmt_bus_console.send.v1'),
    mtRecord('draft', 'str', 'missing target must reject'),
  ]));
  assert.equal(missingTarget.ack, null, 'MBR dispatch must reject missing target_user_id');
  assert.ok(missingTarget.error, 'MBR dispatch must record an error for missing target_user_id');

  const nonConsoleEndpoint = dispatch(makePinPayloadPacket({
    opId: 'it0342_mbr_non_console_endpoint',
    endpoint: { worker_id: 'R1', model_id: 3000, pin: 'submit1' },
    payload: [
      mtRecord('__mt_payload_kind', 'str', 'mgmt_bus_console.send.v1'),
      mtRecord('target_user_id', 'str', '@mbr:localhost'),
      mtRecord('draft', 'str', 'non-console endpoint must forward'),
    ],
  }));
  assert.equal(nonConsoleEndpoint.ack, null, 'MBR dispatch must not ack non-console endpoints');
  assert.equal(root.labels.get('run_mbr_mgmt_to_mqtt')?.v, '1', 'MBR dispatch must hand non-console endpoints to management-to-control forwarding');
  rt.rmLabel(sys, 0, 0, 0, 'run_mbr_mgmt_to_mqtt');

  const retryAfterBadPayload = dispatch(consolePayload('it0342_mbr_retry_after_bad_payload', [
    mtRecord('__mt_payload_kind', 'str', 'mgmt_bus_console.send.v1'),
    mtRecord('target_user_id', 'str', '@not-mbr:localhost'),
    mtRecord('draft', 'str', 'first bad payload'),
  ]));
  assert.equal(retryAfterBadPayload.ack, null, 'test setup must reject the first bad payload');
  const correctedRetry = dispatch(consolePayload('it0342_mbr_retry_after_bad_payload', [
    mtRecord('__mt_payload_kind', 'str', 'mgmt_bus_console.send.v1'),
    mtRecord('target_user_id', 'str', '@mbr:localhost'),
    mtRecord('draft', 'str', 'corrected payload retry'),
  ]));
  assert.ok(correctedRetry.ack, 'corrected retry with the same op_id must not be blocked by the rejected attempt');
  assert.ok(
    payloadRecord(correctedRetry.ack.payload, 'payload')?.v.some((record) => record.k === 'reply_text' && /corrected payload retry/u.test(record.v)),
    'corrected retry must produce the ack for the corrected payload',
  );

  const invalidTarget = dispatch(consolePayload('it0342_mbr_invalid_target', [
    mtRecord('__mt_payload_kind', 'str', 'mgmt_bus_console.send.v1'),
    mtRecord('target_user_id', 'str', '@not-mbr:localhost'),
    mtRecord('draft', 'str', 'invalid target must reject'),
  ]));
  assert.equal(invalidTarget.ack, null, 'MBR dispatch must reject non-MBR targets');
  assert.ok(invalidTarget.error, 'MBR dispatch must record an error for non-MBR targets');

  const generic = dispatch(consolePayload('it0342_mbr_not_crud', [
    mtRecord('__mt_payload_kind', 'str', 'generic.crud.v1'),
  ]));
  assert.ok(generic.error, 'MBR dispatch must not treat generic Model 1036 payloads as accepted CRUD');

  const malformed = dispatch(consolePayload('it0342_mbr_malformed_send', [
    { k: '__mt_payload_kind', t: 'str', v: 'mgmt_bus_console.send.v1' },
    { k: 'target_user_id', t: 'str', v: '@mbr:localhost' },
    { k: 'draft', t: 'str', v: 'malformed mbr send' },
  ]));
  assert.equal(malformed.ack, null, 'MBR dispatch must reject non-ModelTable-record console sends');
  assert.ok(malformed.error, 'MBR dispatch must record an error for non-ModelTable-record console sends');
  assert.equal(malformed.error?.detail, 'invalid_pin_payload_records', 'MBR dispatch must require a temporary ModelTable record array');

  const legacyEnvelopeField = dispatch({
    ...consolePayload('it0342_mbr_legacy_envelope_field', [
      mtRecord('__mt_payload_kind', 'str', 'mgmt_bus_console.send.v1'),
      mtRecord('target_user_id', 'str', '@mbr:localhost'),
      mtRecord('draft', 'str', 'legacy envelope fields must reject'),
    ]),
    source_model_id: 1036,
  });
  assert.equal(legacyEnvelopeField.ack, null, 'MBR dispatch must reject loose legacy envelope fields');
  assert.ok(legacyEnvelopeField.error, 'MBR dispatch must record an error for loose legacy envelope fields');
  assert.equal(legacyEnvelopeField.error?.detail, 'loose_pin_payload_fields_removed', 'loose legacy envelope fields must fail the strict packet contract');

  const legacyRecordField = dispatch(consolePayload('it0342_mbr_legacy_record_field', [
    mtRecord('__mt_payload_kind', 'str', 'mgmt_bus_console.send.v1'),
    mtRecord('target_user_id', 'str', '@mbr:localhost'),
    { id: 0, p: 0, r: 0, c: 0, k: 'draft', t: 'str', v: 'legacy record fields must reject', op: 'add_label' },
  ]));
  assert.equal(legacyRecordField.ack, null, 'MBR dispatch must reject records carrying legacy op/model_id fields');
  assert.ok(legacyRecordField.error, 'MBR dispatch must record an error for legacy record fields');
  assert.equal(legacyRecordField.error?.detail, 'invalid_pin_payload_records', 'legacy record fields must fail the temporary ModelTable contract');

  const missingValueRecord = dispatch(consolePayload('it0342_mbr_missing_value_record', [
    mtRecord('__mt_payload_kind', 'str', 'mgmt_bus_console.send.v1'),
    mtRecord('target_user_id', 'str', '@mbr:localhost'),
    mtRecord('draft', 'str', 'records missing v must reject'),
    { id: 0, p: 0, r: 0, c: 0, k: 'extra', t: 'str' },
  ]));
  assert.equal(missingValueRecord.ack, null, 'MBR dispatch must reject records without an explicit v field');
  assert.ok(missingValueRecord.error, 'MBR dispatch must record an error for records missing v');
  assert.equal(missingValueRecord.error?.detail, 'invalid_pin_payload_records', 'records missing v must fail the temporary ModelTable contract');
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
  const serverText = readText(serverPath);
  assert.match(serverText, /mgmt_bus_console_intent/u, 'server must process the already-routed management console intent');
  assert.match(serverText, /mgmt_bus_console_mb_out/u, 'server must write console send packets to a Model 0 management-bus out pin');
  assert.doesNotMatch(
    serverText,
    /mgmt_bus_console_intent[\s\S]{0,2500}sendMatrix\(packet\)/u,
    'server must not directly send Matrix from the console intent handler',
  );
  assert.doesNotMatch(
    serverText,
    /_pinBusOutValueToExternalPayload\(label\.v\)\s*:\s*\(label/u,
    'server split-bus bridge must not fall back to raw label.v payloads',
  );
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
    test_server_split_bus_matrix_failures_are_observable_and_retryable,
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
