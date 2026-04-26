#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs, { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { buildAstFromCellwiseModel } from '../../packages/ui-model-demo-frontend/src/ui_cellwise_projection.js';
import { createRemoteStore } from '../../packages/ui-model-demo-frontend/src/remote_store.js';
import { deriveMgmtBusConsoleProjection } from '../../packages/ui-model-demo-server/mgmt_bus_console_projection.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const require = createRequire(import.meta.url);
const { createRenderer } = require('../../packages/ui-renderer/src/index.js');

const workspacePatchPath = 'packages/worker-base/system-models/workspace_positive_models.json';
const serverPath = 'packages/ui-model-demo-server/server.mjs';
const consoleModelId = 1036;
const sourceModelId = -2;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function defaultEventRows() {
  return [
    {
      event_id: 'evt-source-1',
      ts_ms: 1714100000000,
      direction: 'inbound',
      source: 'matrix',
      subject_id: '!safe-room:localhost',
      subject_label: 'Matrix Debug Room',
      route_key: 'mgmt_bus_console_send',
      pin: 'pin.bus.in',
      kind: 'mgmt_bus_console.send.v1',
      status: 'received',
      preview: 'redacted event preview from source',
      op_id: 'op-source-1',
    },
    {
      event_id: 'evt-source-2',
      ts_ms: 1714100000500,
      direction: 'internal',
      source: 'model0',
      subject_id: 'model0',
      subject_label: 'Model 0 bus',
      route_key: 'mgmt_bus_console_refresh',
      pin: 'pin.bus.in',
      kind: 'mgmt_bus_console.refresh.v1',
      status: 'applied',
      preview: 'refresh routed through Model 0',
      op_id: 'op-source-2',
    },
  ];
}

function defaultSourceLabels() {
  return [
    {
      k: 'mgmt_bus_console_subject_rows_json',
      t: 'json',
      v: [
        { label: 'Matrix Adapter LIVE', value: 'matrix', status: 'ready' },
        { label: 'Trace Buffer LIVE', value: 'trace', status: 'monitoring' },
      ],
    },
    {
      k: 'mgmt_bus_console_timeline_text',
      t: 'str',
      v: 'timeline summary from source projection',
    },
    {
      k: 'mgmt_bus_console_inspector_text',
      t: 'str',
      v: 'legacy inspector summary from source projection',
    },
    {
      k: 'mgmt_bus_console_event_rows_json',
      t: 'json',
      v: defaultEventRows(),
    },
    {
      k: 'mgmt_bus_console_event_inspector_json',
      t: 'json',
      v: [
        { field: 'event_id', value: 'evt-source-1' },
        { field: 'status', value: 'received' },
        { field: 'preview', value: 'redacted event preview from source' },
      ],
    },
    {
      k: 'mgmt_bus_console_event_inspector_text',
      t: 'str',
      v: 'selected event evt-source-1 from source projection',
    },
    {
      k: 'mgmt_bus_console_route_rows_json',
      t: 'json',
      v: [
        { route: 'mgmt_bus_console_send', status: 'configured', target: '-10.mgmt_bus_console_intent' },
        { route: 'mgmt_bus_console_refresh', status: 'configured', target: '-10.mgmt_bus_console_refresh_intent' },
      ],
    },
    {
      k: 'mgmt_bus_console_route_status',
      t: 'str',
      v: 'live',
    },
    {
      k: 'mgmt_bus_console_composer_actions_json',
      t: 'json',
      v: [
        { action: 'refresh', payload_kind: 'mgmt_bus_console.refresh.v1', status: 'enabled' },
        { action: 'send', payload_kind: 'mgmt_bus_console.send.v1', status: 'enabled' },
      ],
    },
  ];
}

function makeSnapshot(records, sourceLabels = defaultSourceLabels()) {
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
    addLabel(consoleModelId, record.p, record.r, record.c, {
      k: record.k,
      t: record.t,
      v: record.v,
    });
  }
  for (const label of sourceLabels) {
    addLabel(sourceModelId, 0, 0, 0, label);
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

function makeVueAdapter() {
  return {
    h: (type, props, children) => {
      let nextChildren = children;
      if (children && typeof children === 'object' && typeof children.default === 'function') {
        nextChildren = children.default({});
      }
      return { type, props: props || {}, children: nextChildren };
    },
    resolveComponent: (name) => name,
  };
}

function renderNode(node, snapshot) {
  const renderer = createRenderer({
    host: {
      getSnapshot: () => snapshot,
      dispatchAddLabel: () => {},
      dispatchRmLabel: () => {},
    },
    vue: makeVueAdapter(),
  });
  return renderer.renderVNode(node);
}

function assertSourceRef(ref, key, nodeId) {
  assert.equal(ref?.model_id, sourceModelId, `${nodeId} must read from source-owned Model ${sourceModelId}`);
  assert.equal(ref?.p, 0, `${nodeId} source p must be 0`);
  assert.equal(ref?.r, 0, `${nodeId} source r must be 0`);
  assert.equal(ref?.c, 0, `${nodeId} source c must be 0`);
  assert.equal(ref?.k, key, `${nodeId} must read ${key}`);
}

function assertLocalRef(ref, key, nodeId) {
  assert.equal(ref?.model_id, consoleModelId, `${nodeId} must read local Model ${consoleModelId}`);
  assert.equal(ref?.p, 0, `${nodeId} local p must be 0`);
  assert.equal(ref?.r, 0, `${nodeId} local r must be 0`);
  assert.equal(ref?.c, 0, `${nodeId} local c must be 0`);
  assert.equal(ref?.k, key, `${nodeId} must read ${key}`);
}

function assertModel1036RootLabel(records, key, expectedValue = '') {
  const record = findRecord(records, (entry) => (
    entry?.model_id === consoleModelId
    && entry?.p === 0
    && entry?.r === 0
    && entry?.c === 0
    && entry?.k === key
  ));
  assert.ok(record, `Model ${consoleModelId} must declare local UI state label ${key}`);
  assert.equal(record.v, expectedValue, `${key} must default to ${JSON.stringify(expectedValue)}`);
}

function test_event_rows_and_inspector_read_source_owned_labels() {
  const records = readJson(workspacePatchPath).records || [];
  const snapshot = makeSnapshot(records);
  const ast = buildAstFromCellwiseModel(snapshot, consoleModelId);

  const eventTable = findNodeById(ast, 'mgmt_bus_event_table');
  const inspectorTable = findNodeById(ast, 'mgmt_bus_event_inspector_table');
  const inspectorTerminal = findNodeById(ast, 'mgmt_bus_event_inspector_terminal');
  const composerActions = findNodeById(ast, 'mgmt_bus_composer_actions_table');

  assert.ok(eventTable, 'event timeline table missing');
  assert.equal(eventTable.type, 'Table', 'event timeline must use existing Table component');
  assertSourceRef(eventTable.props?.data?.$label, 'mgmt_bus_console_event_rows_json', eventTable.id);
  assert.deepEqual(
    renderNode(eventTable, snapshot).props.data,
    defaultEventRows(),
    'event table data must resolve from Model -2 event rows',
  );

  assert.ok(inspectorTable, 'event inspector table missing');
  assert.equal(inspectorTable.type, 'Table', 'event inspector must use existing Table component');
  assertSourceRef(inspectorTable.props?.data?.$label, 'mgmt_bus_console_event_inspector_json', inspectorTable.id);
  assert.deepEqual(
    renderNode(inspectorTable, snapshot).props.data,
    defaultSourceLabels().find((label) => label.k === 'mgmt_bus_console_event_inspector_json').v,
    'event inspector rows must resolve from Model -2 inspector rows',
  );

  assert.ok(inspectorTerminal, 'event inspector terminal fallback missing');
  assertSourceRef(inspectorTerminal.bind?.read, 'mgmt_bus_console_event_inspector_text', inspectorTerminal.id);

  assert.ok(composerActions, 'composer action whitelist table missing');
  assertSourceRef(composerActions.props?.data?.$label, 'mgmt_bus_console_composer_actions_json', composerActions.id);
  return { key: 'event_rows_and_inspector_read_source_owned_labels', status: 'PASS' };
}

function test_model1036_owns_only_local_selection_and_no_event_truth() {
  const records = readJson(workspacePatchPath).records || [];
  assertModel1036RootLabel(records, 'selected_event_id');
  assertModel1036RootLabel(records, 'selected_subject_id');
  assertModel1036RootLabel(records, 'timeline_filter');
  assertModel1036RootLabel(records, 'inspector_tab', 'event');
  assertModel1036RootLabel(records, 'composer_action', 'send');

  const forbiddenTruth = /evt-source-1|evt-source-2|redacted event preview from source|SECRET_SHOULD_NOT_RENDER|syt_SECRET|ChangeMeLocal2026/u;
  for (const record of recordsForModel(records, consoleModelId)) {
    const valueText = typeof record.v === 'string' ? record.v : JSON.stringify(record.v);
    assert.equal(
      forbiddenTruth.test(String(valueText || '')),
      false,
      `Model ${consoleModelId} must not copy event truth or secrets into ${record.k}`,
    );
  }
  return { key: 'model1036_owns_only_local_selection_and_no_event_truth', status: 'PASS' };
}

function test_local_event_selection_is_not_formal_bus_ingress() {
  const records = readJson(workspacePatchPath).records || [];
  const snapshot = makeSnapshot(records);
  const ast = buildAstFromCellwiseModel(snapshot, consoleModelId);
  const selection = findNodeById(ast, 'mgmt_bus_selected_event_input');

  assert.ok(selection, 'selected event input missing');
  assert.equal(selection.type, 'Input', 'selected event control must use existing Input component');
  assertLocalRef(selection.bind?.read, 'selected_event_id', selection.id);
  assert.equal(selection.bind?.write?.action, 'label_update', 'selection must be a local label_update');
  assert.equal(selection.bind?.write?.commit_policy, 'immediate', 'selected event input must commit immediately in the real UI');
  assert.deepEqual(
    selection.bind?.write?.target_ref,
    { model_id: consoleModelId, p: 0, r: 0, c: 0, k: 'selected_event_id' },
    'selection write target must stay local to Model 1036',
  );
  assert.equal(selection.bind?.write?.bus_event_v2, undefined, 'selection must not declare bus_event_v2');

  const dispatched = [];
  const renderer = createRenderer({
    host: {
      getSnapshot: () => snapshot,
      dispatchAddLabel: (label) => dispatched.push(label),
      dispatchRmLabel: () => {},
    },
    vue: makeVueAdapter(),
  });
  const label = renderer.dispatchEvent(selection, { value: 'evt-source-1' });
  assert.equal(label?.p, 0, 'local selection dispatch p must target mailbox root');
  assert.equal(label?.r, 0, 'local selection dispatch r must target mailbox root');
  assert.equal(label?.c, 1, 'local selection dispatch c must target mailbox ui_event cell');
  assert.equal(label?.k, 'ui_event', 'local selection must dispatch ui_event, not bus_in_event');
  assert.equal(label?.v?.type, 'label_update', 'local selection envelope type must be label_update');
  assert.equal(label?.v?.payload?.target?.model_id, consoleModelId, 'local selection target model must be 1036');
  assert.equal(label?.v?.payload?.target?.k, 'selected_event_id', 'local selection target key must be selected_event_id');
  assert.deepEqual(label?.v?.payload?.value, { t: 'str', v: 'evt-source-1' });
  assert.equal(dispatched.length, 1, 'renderer must dispatch exactly one local selection label');
  return { key: 'local_event_selection_is_not_formal_bus_ingress', status: 'PASS' };
}

function test_projection_deriver_emits_redacted_event_rows_and_inspector() {
  const matrixProjection = {
    subjects: [
      { label: 'Matrix Adapter', value: 'matrix' },
      { label: 'Trace Buffer', value: 'trace' },
    ],
    selected: 'matrix',
    readinessText: 'runtime=running | matrix=connected | bridge=relay_ready',
    traceSummaryText: 'events=42 | throughput=2/s | error=0% | updated=12:00:00',
    subjectSummaryText: 'Matrix adapter status=connected. Bridge status=relay_ready.',
    events: [
      {
        event_id: '$raw-event-id',
        ts_ms: 1714100000000,
        direction: 'inbound',
        source: 'matrix',
        subject_id: '!room:localhost',
        subject_label: 'Room With syt_SECRET_IN_LABEL',
        route_key: 'mgmt_bus_console_send',
        pin: 'pin.bus.in',
        kind: 'mgmt_bus_console.send.v1',
        status: 'received',
        op_id: 'op-redaction',
        payload: {
          body: 'hello syt_SECRET_IN_BODY ChangeMeLocal2026',
          access_token: 'SECRET_SHOULD_NOT_RENDER',
          password: 'SECRET_SHOULD_NOT_RENDER',
        },
      },
    ],
  };
  const labels = new Map([
    ['0:mgmt_bus_console_send_route', [{ from: [0, 'mgmt_bus_console_send'], to: [[-10, 'mgmt_bus_console_intent']] }]],
    ['0:mgmt_bus_console_refresh_route', [{ from: [0, 'mgmt_bus_console_refresh'], to: [[-10, 'mgmt_bus_console_refresh_intent']] }]],
    ['-10:mbr_route_100', { pin: 'submit', type: 'pin_payload' }],
    ['-10:mbr_route_1010', { pin: 'submit', type: 'pin_payload' }],
    ['-10:mbr_route_1019', { pin: 'submit', type: 'pin_payload' }],
    ['-10:mbr_route_default', { pin: 'result', type: 'pin_payload' }],
  ]);
  const projection = deriveMgmtBusConsoleProjection({
    matrixProjection,
    readRootLabel: (modelId, key) => labels.get(`${modelId}:${key}`),
  });

  assert.ok(Array.isArray(projection.eventRows), 'projection must expose eventRows');
  assert.equal(projection.eventRows.length, 1, 'projection must include source event rows');
  assert.equal(projection.eventRows[0].event_id, '$raw-event-id');
  assert.equal(projection.eventRows[0].source, 'matrix');
  assert.equal(projection.eventRows[0].status, 'received');
  assert.match(projection.eventRows[0].preview, /hello/u, 'event preview must retain safe context');
  assert.doesNotMatch(
    JSON.stringify(projection.eventRows),
    /SECRET_SHOULD_NOT_RENDER|syt_SECRET|ChangeMeLocal2026|access_token|password/u,
    'event rows must redact secret-like keys and value patterns',
  );

  assert.ok(Array.isArray(projection.eventInspectorRows), 'projection must expose eventInspectorRows');
  assert.ok(
    projection.eventInspectorRows.some((row) => row.field === 'event_id' && row.value === '$raw-event-id'),
    'inspector rows must include selected event metadata',
  );
  assert.match(projection.eventInspectorText, /\$raw-event-id/u, 'inspector text must include selected event id');
  assert.ok(Array.isArray(projection.composerActions), 'projection must expose composer action rows');
  assert.ok(
    projection.composerActions.some((row) => row.action === 'send' && row.payload_kind === 'mgmt_bus_console.send.v1'),
    'composer actions must include explicit send action kind',
  );
  assert.doesNotMatch(
    JSON.stringify({
      rows: projection.eventInspectorRows,
      text: projection.eventInspectorText,
      actions: projection.composerActions,
    }),
    /SECRET_SHOULD_NOT_RENDER|syt_SECRET|ChangeMeLocal2026|access_token|password/u,
    'event inspector and composer projection must not expose secrets',
  );
  return { key: 'projection_deriver_emits_redacted_event_rows_and_inspector', status: 'PASS' };
}

function test_projection_deriver_honors_selected_event_id_and_invalid_selection() {
  const baseProjection = {
    selectedEventId: 'evt-source-2',
    events: defaultEventRows(),
  };
  const selectedProjection = deriveMgmtBusConsoleProjection({
    matrixProjection: baseProjection,
    readRootLabel: () => undefined,
  });
  assert.ok(
    selectedProjection.eventInspectorRows.some((row) => row.field === 'event_id' && row.value === 'evt-source-2'),
    'selected_event_id must drive inspector rows to the selected event',
  );
  assert.match(
    selectedProjection.eventInspectorText,
    /evt-source-2/u,
    'selected_event_id must drive inspector text to the selected event',
  );

  const invalidProjection = deriveMgmtBusConsoleProjection({
    matrixProjection: {
      ...baseProjection,
      selectedEventId: 'missing-event',
    },
    readRootLabel: () => undefined,
  });
  assert.deepEqual(
    invalidProjection.eventInspectorRows,
    [{ field: 'state', value: 'event not found: missing-event' }],
    'invalid selected_event_id must produce an explicit empty/error state',
  );
  assert.match(
    invalidProjection.eventInspectorText,
    /event not found: missing-event/u,
    'invalid selected_event_id must not fall back to unrelated event truth',
  );
  return { key: 'projection_deriver_honors_selected_event_id_and_invalid_selection', status: 'PASS' };
}

async function test_server_local_selected_event_updates_inspector_projection() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'dy-0341-event-selection-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0341_event_selection_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = path.join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = path.join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = path.join(tempRoot, 'static');
  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null });
  try {
    let labels = state.clientSnap()?.models?.[String(sourceModelId)]?.cells?.['0,0,0']?.labels || {};
    assert.match(
      labels.mgmt_bus_console_event_inspector_text?.v || '',
      /runtime-readiness/u,
      'startup inspector should show the first source-owned fallback event',
    );

    const selectResult = await state.submitEnvelope(mailboxEnvelope('label_update', {
      opId: 'it0341_select_event',
      target: { model_id: consoleModelId, p: 0, r: 0, c: 0, k: 'selected_event_id' },
      value: { t: 'str', v: 'model0-route-status' },
    }));
    assert.equal(selectResult.result, 'ok', 'selected_event_id local label_update must succeed on Model 1036');
    labels = state.clientSnap()?.models?.[String(sourceModelId)]?.cells?.['0,0,0']?.labels || {};
    assert.match(
      labels.mgmt_bus_console_event_inspector_text?.v || '',
      /model0-route-status/u,
      'server-derived inspector must follow selected_event_id',
    );
    assert.ok(
      (labels.mgmt_bus_console_event_inspector_json?.v || []).some((row) => row.field === 'event_id' && row.value === 'model0-route-status'),
      'server-derived inspector rows must follow selected_event_id',
    );

    const invalidResult = await state.submitEnvelope(mailboxEnvelope('label_update', {
      opId: 'it0341_select_missing_event',
      target: { model_id: consoleModelId, p: 0, r: 0, c: 0, k: 'selected_event_id' },
      value: { t: 'str', v: 'missing-event' },
    }));
    assert.equal(invalidResult.result, 'ok', 'invalid selected_event_id still updates local UI state');
    labels = state.clientSnap()?.models?.[String(sourceModelId)]?.cells?.['0,0,0']?.labels || {};
    assert.deepEqual(
      labels.mgmt_bus_console_event_inspector_json?.v,
      [{ field: 'state', value: 'event not found: missing-event' }],
      'server-derived inspector must show explicit missing state for invalid selected_event_id',
    );

    for (const action of ['label_add', 'label_remove', 'datatable_remove_label']) {
      const result = await state.submitEnvelope(mailboxEnvelope(action, {
        opId: `it0341_reject_${action}`,
        target: { model_id: consoleModelId, p: 0, r: 0, c: 0, k: 'selected_event_id' },
        value: { t: 'str', v: 'must-not-apply' },
      }));
      assert.equal(result.result, 'error', `${action} must be rejected for Model 1036 local state`);
      assert.equal(result.code, 'direct_model_mutation_disabled', `${action} rejection code must remain direct_model_mutation_disabled`);
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.DY_AUTH;
    delete process.env.DY_PERSISTED_ASSET_ROOT;
    delete process.env.WORKER_BASE_WORKSPACE;
    delete process.env.WORKER_BASE_DATA_ROOT;
    delete process.env.DOCS_ROOT;
    delete process.env.STATIC_PROJECTS_ROOT;
  }
  return { key: 'server_local_selected_event_updates_inspector_projection', status: 'PASS' };
}

async function test_remote_store_syncs_local_selection_via_ui_event_not_bus_event() {
  const priorFetch = globalThis.fetch;
  const priorEventSource = globalThis.EventSource;
  const requests = [];
  globalThis.fetch = async (url, init = {}) => {
    const entry = {
      url: String(url),
      method: String(init?.method || 'GET').toUpperCase(),
      body: init?.body || '',
    };
    requests.push(entry);
    const json = entry.url.endsWith('/snapshot')
      ? { snapshot: { models: {} } }
      : { ok: true, result: 'ok' };
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: () => 'application/json' },
      json: async () => json,
      text: async () => JSON.stringify(json),
    };
  };
  globalThis.EventSource = class {
    addEventListener() {}
  };
  try {
    const store = createRemoteStore({ baseUrl: 'http://local.test' });
    await wait(0);
    requests.length = 0;
    store.dispatchAddLabel({
      p: 0,
      r: 0,
      c: 1,
      k: 'ui_event',
      t: 'event',
      v: mailboxEnvelope('label_update', {
        opId: 'it0341_remote_store_select',
        target: { model_id: consoleModelId, p: 0, r: 0, c: 0, k: 'selected_event_id' },
        value: { t: 'str', v: 'model0-route-status' },
      }),
    });
    await wait(260);
    assert.ok(
      requests.some((request) => request.method === 'POST' && request.url.endsWith('/ui_event')),
      'remote store must sync local selected_event_id through /ui_event',
    );
    assert.equal(
      requests.some((request) => request.method === 'POST' && request.url.endsWith('/bus_event')),
      false,
      'local selected_event_id sync must not call /bus_event',
    );
  } finally {
    globalThis.fetch = priorFetch;
    if (priorEventSource === undefined) {
      delete globalThis.EventSource;
    } else {
      globalThis.EventSource = priorEventSource;
    }
  }
  return { key: 'remote_store_syncs_local_selection_via_ui_event_not_bus_event', status: 'PASS' };
}

function test_server_syncs_event_projection_labels() {
  const serverText = readText(serverPath);
  for (const key of [
    'mgmt_bus_console_event_rows_json',
    'mgmt_bus_console_event_inspector_json',
    'mgmt_bus_console_event_inspector_text',
    'mgmt_bus_console_composer_actions_json',
  ]) {
    assert.match(serverText, new RegExp(key, 'u'), `server must ensure and sync ${key}`);
  }
  return { key: 'server_syncs_event_projection_labels', status: 'PASS' };
}

async function main() {
  const tests = [
    test_event_rows_and_inspector_read_source_owned_labels,
    test_model1036_owns_only_local_selection_and_no_event_truth,
    test_local_event_selection_is_not_formal_bus_ingress,
    test_projection_deriver_emits_redacted_event_rows_and_inspector,
    test_projection_deriver_honors_selected_event_id_and_invalid_selection,
    test_server_local_selected_event_updates_inspector_projection,
    test_remote_store_syncs_local_selection_via_ui_event_not_bus_event,
    test_server_syncs_event_projection_labels,
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
