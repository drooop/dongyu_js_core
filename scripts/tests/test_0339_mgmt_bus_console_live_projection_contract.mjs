#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { buildAstFromCellwiseModel } from '../../packages/ui-model-demo-frontend/src/ui_cellwise_projection.js';
import { deriveMgmtBusConsoleProjection } from '../../packages/ui-model-demo-server/mgmt_bus_console_projection.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const require = createRequire(import.meta.url);
const { createRenderer } = require('../../packages/ui-renderer/src/index.js');
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

const workspacePatchPath = 'packages/worker-base/system-models/workspace_positive_models.json';
const systemModelsPath = 'packages/worker-base/system-models/system_models.json';
const serverPath = 'packages/ui-model-demo-server/server.mjs';
const consoleModelId = 1036;
const sourceModelId = -2;
const refreshBusInKey = 'mgmt_bus_console_refresh';

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

function defaultSourceLabels() {
  return [
    {
      k: 'mgmt_bus_console_subject_rows_json',
      t: 'json',
      v: [
        { label: 'Matrix Adapter LIVE', status: 'ready' },
        { label: 'Trace Buffer LIVE', status: 'monitoring' },
      ],
    },
    {
      k: 'mgmt_bus_console_timeline_text',
      t: 'str',
      v: 'timeline from Model -100 / Matrix Debug source',
    },
    {
      k: 'mgmt_bus_console_inspector_text',
      t: 'str',
      v: 'inspector from selected source event',
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
  ];
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

function flattenText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'function') return flattenText(value({}));
  if (Array.isArray(value)) return value.map(flattenText).join('');
  if (typeof value === 'object') {
    return `${flattenText(value.children)}${flattenText(value.props?.text)}`;
  }
  return '';
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

function sourceRef(node, pathHint) {
  if (pathHint === 'props.data') return node?.props?.data?.$label;
  if (pathHint === 'bind.read') return node?.bind?.read;
  throw new Error(`Unknown path hint ${pathHint}`);
}

function assertSourceRef(node, pathHint, key) {
  const ref = sourceRef(node, pathHint);
  assert.equal(ref?.model_id, sourceModelId, `${node?.id || 'node'} ${pathHint} must read from source-owned Model ${sourceModelId}`);
  assert.equal(ref?.p, 0, `${node?.id || 'node'} ${pathHint} source p must be 0`);
  assert.equal(ref?.r, 0, `${node?.id || 'node'} ${pathHint} source r must be 0`);
  assert.equal(ref?.c, 0, `${node?.id || 'node'} ${pathHint} source c must be 0`);
  assert.equal(ref?.k, key, `${node?.id || 'node'} ${pathHint} must read ${key}`);
}

function test_live_projection_reads_source_owned_labels_and_updates_when_source_changes() {
  const records = readJson(workspacePatchPath).records || [];
  const snapshot = makeSnapshot(records);
  const ast = buildAstFromCellwiseModel(snapshot, consoleModelId);

  const subjectTable = findNodeById(ast, 'mgmt_bus_subject_table');
  const timeline = findNodeById(ast, 'mgmt_bus_timeline_terminal');
  const inspector = findNodeById(ast, 'mgmt_bus_event_terminal');
  const routeTable = findNodeById(ast, 'mgmt_bus_route_table');
  const status = findNodeById(ast, 'mgmt_bus_header_status');

  assertSourceRef(subjectTable, 'props.data', 'mgmt_bus_console_subject_rows_json');
  assertSourceRef(timeline, 'bind.read', 'mgmt_bus_console_timeline_text');
  assertSourceRef(inspector, 'bind.read', 'mgmt_bus_console_inspector_text');
  assertSourceRef(routeTable, 'props.data', 'mgmt_bus_console_route_rows_json');
  assertSourceRef(status, 'bind.read', 'mgmt_bus_console_route_status');

  assert.match(flattenText(renderNode(timeline, snapshot)), /timeline from Model -100/, 'timeline must render source timeline text');
  assert.match(flattenText(renderNode(inspector, snapshot)), /inspector from selected source event/, 'inspector must render source inspector text');
  assert.deepEqual(
    renderNode(subjectTable, snapshot).props.data,
    defaultSourceLabels()[0].v,
    'subject table data must be resolved from source projection rows',
  );
  assert.deepEqual(
    renderNode(routeTable, snapshot).props.data,
    defaultSourceLabels()[3].v,
    'route table data must be resolved from source route projection rows',
  );
  assert.match(flattenText(renderNode(status, snapshot)), /live/, 'status badge must render source route status');

  const changedSnapshot = makeSnapshot(records, [
    ...defaultSourceLabels().filter((label) => label.k !== 'mgmt_bus_console_timeline_text'),
    { k: 'mgmt_bus_console_timeline_text', t: 'str', v: 'timeline changed at source' },
  ]);
  const changedAst = buildAstFromCellwiseModel(changedSnapshot, consoleModelId);
  assert.match(
    flattenText(renderNode(findNodeById(changedAst, 'mgmt_bus_timeline_terminal'), changedSnapshot)),
    /timeline changed at source/,
    'changing the source-owned label must change the rendered console without editing Model 1036',
  );
  return { key: 'live_projection_reads_source_owned_labels_and_updates_when_source_changes', status: 'PASS' };
}

function test_model1036_does_not_seed_live_projection_truth() {
  const records = readJson(workspacePatchPath).records || [];
  const modelRecords = recordsForModel(records, consoleModelId);
  for (const record of modelRecords) {
    const valueText = typeof record.v === 'string' ? record.v : JSON.stringify(record.v);
    assert.equal(
      /Matrix Adapter LIVE|Trace Buffer LIVE|timeline from Model -100|mgmt_bus_console_refresh_intent/u.test(String(valueText || '')),
      false,
      `Model ${consoleModelId} must not seed source-owned live truth in ${record.k}`,
    );
  }
  for (const key of ['subject_projection_rows_json', 'timeline_projection_rows_json', 'route_projection_rows_json']) {
    const projection = findRecord(records, (record) => (
      record?.model_id === consoleModelId
      && record?.p === 0
      && record?.r === 0
      && record?.c === 0
      && record?.k === key
    ));
    assert.deepEqual(projection?.v, [], `${key} must remain an empty local overlay slot`);
  }
  return { key: 'model1036_does_not_seed_live_projection_truth', status: 'PASS' };
}

function test_refresh_button_targets_model0_bus_event_v2() {
  const records = readJson(workspacePatchPath).records || [];
  const snapshot = makeSnapshot(records);
  const ast = buildAstFromCellwiseModel(snapshot, consoleModelId);
  const refresh = findNodeById(ast, 'mgmt_bus_refresh_button');
  assert.ok(refresh, 'refresh button missing');
  assert.equal(refresh.type, 'Button', 'refresh node must be a Button');
  assert.equal(refresh.props?.label, 'Refresh', 'refresh button label must be model-table driven');
  assert.equal(refresh.bind?.write?.bus_event_v2, true, 'refresh button must declare bus_event_v2 write');
  assert.equal(refresh.bind?.write?.bus_in_key, refreshBusInKey, 'refresh button must target Model 0 refresh bus key');
  assert.ok(Array.isArray(refresh.bind?.write?.value_ref), 'refresh value_ref must be a temporary ModelTable record array');
  assert.ok(
    refresh.bind.write.value_ref.some((record) => record?.k === '__mt_payload_kind' && record?.v === 'mgmt_bus_console.refresh.v1'),
    'refresh payload must identify the refresh payload kind',
  );

  const dispatched = [];
  const renderer = createRenderer({
    host: {
      getSnapshot: () => snapshot,
      dispatchAddLabel: (label) => dispatched.push(label),
      dispatchRmLabel: () => {},
    },
    vue: makeVueAdapter(),
  });
  const label = renderer.dispatchEvent(refresh, { click: true });
  assert.equal(label?.p, 0, 'refresh dispatch label must target Model 0 root p');
  assert.equal(label?.r, 0, 'refresh dispatch label must target Model 0 root r');
  assert.equal(label?.c, 0, 'refresh dispatch label must target Model 0 root c');
  assert.equal(label?.k, 'bus_in_event', 'refresh dispatch label must use bus_in_event');
  assert.equal(label?.t, 'event', 'refresh dispatch label must be an event label');
  assert.equal(label?.v?.type, 'bus_event_v2', 'refresh dispatch envelope must be bus_event_v2');
  assert.equal(label?.v?.bus_in_key, refreshBusInKey, 'refresh dispatch envelope must target the refresh key');
  assert.ok(Array.isArray(label?.v?.value), 'refresh dispatch value must be a ModelTable record array');
  assert.equal(dispatched.length, 1, 'renderer must dispatch one refresh label');
  assert.equal(dispatched[0], label, 'renderer must return the dispatched refresh label');
  return { key: 'refresh_button_targets_model0_bus_event_v2', status: 'PASS' };
}

function test_model0_server_and_runtime_accept_refresh_payload_only_as_modeltable() {
  const workspaceRecords = readJson(workspacePatchPath).records || [];
  const systemRecords = readJson(systemModelsPath).records || [];
  const route = findRecord(workspaceRecords, (record) => (
    record?.model_id === 0
    && record?.p === 0
    && record?.r === 0
    && record?.c === 0
    && record?.k === 'mgmt_bus_console_refresh_route'
    && record?.t === 'pin.connect.model'
  ));
  assert.deepEqual(
    route?.v,
    [{ from: [0, refreshBusInKey], to: [[-10, 'mgmt_bus_console_refresh_intent']] }],
    'Model 0 must route refresh through the management bus system model',
  );
  assert.ok(
    findRecord(systemRecords, (record) => (
      record?.model_id === -10
      && record?.p === 0
      && record?.r === 0
      && record?.c === 0
      && record?.k === 'mgmt_bus_console_refresh_intent'
      && record?.t === 'pin.in'
    )),
    'System model -10 must declare the refresh target pin',
  );
  assert.match(
    readText(serverPath),
    /allowedBusInKeys\s*=\s*new Set\(\[[^\]]*['"]mgmt_bus_console_refresh['"]/su,
    'server bus_event_v2 allow-list must include mgmt_bus_console_refresh',
  );

  const rt = new ModelTableRuntime();
  rt.applyPatch(readJson(systemModelsPath), { allowCreateModel: true, trustedBootstrap: true });
  rt.applyPatch(readJson(workspacePatchPath), { allowCreateModel: true, trustedBootstrap: true });
  const model0 = rt.getModel(0);
  const sys = rt.getModel(-10);
  const payload = [
    { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'mgmt_bus_console.refresh.v1' },
    { id: 0, p: 0, r: 0, c: 0, k: 'source_model_id', t: 'int', v: consoleModelId },
  ];
  const addResult = rt.addLabel(model0, 0, 0, 0, {
    k: refreshBusInKey,
    t: 'pin.bus.in',
    v: payload,
  });
  assert.equal(addResult?.applied, true, 'Model 0 must accept refresh temporary ModelTable payloads');
  assert.deepEqual(
    rt.getCell(sys, 0, 0, 0).labels.get('mgmt_bus_console_refresh_intent')?.v,
    payload,
    'refresh payload must route to Model -10 without changing payload shape',
  );

  const bad = rt.addLabel(model0, 0, 0, 0, {
    k: refreshBusInKey,
    t: 'pin.bus.in',
    v: { invalid: 'not a ModelTable record array' },
  });
  assert.equal(bad?.applied, false, 'Model 0 must reject invalid refresh payloads');
  assert.ok(
    rt.eventLog._events.some((event) => (
      event?.result === 'rejected'
      && event?.reason === 'pin_payload_not_modeltable'
      && event?.label?.k === refreshBusInKey
    )),
    'invalid refresh payload rejection must be observable',
  );
  return { key: 'model0_server_and_runtime_accept_refresh_payload_only_as_modeltable', status: 'PASS' };
}

function test_server_projection_deriver_includes_mbr_health_and_sanitizes_routes() {
  const matrixProjection = {
    subjects: [
      { label: 'Trace Buffer', value: 'trace' },
      { label: 'Matrix Adapter', value: 'matrix' },
    ],
    selected: 'matrix',
    readinessText: 'runtime=running | matrix=connected | bridge=relay_ready',
    traceSummaryText: 'events=42 | throughput=2/s | error=0% | updated=12:00:00',
    subjectSummaryText: 'Matrix adapter status=connected. Bridge status=relay_ready.',
  };
  const labels = new Map([
    ['0:mgmt_bus_console_send_route', [{ from: [0, 'mgmt_bus_console_send'], to: [[-10, 'mgmt_bus_console_intent']] }]],
    ['0:mgmt_bus_console_refresh_route', [{ from: [0, 'mgmt_bus_console_refresh'], to: [[-10, 'mgmt_bus_console_refresh_intent']] }]],
    ['-10:mbr_route_100', { pin: 'submit', type: 'pin_payload', access_token: 'SECRET_SHOULD_NOT_RENDER' }],
    ['-10:mbr_route_1010', { pin: 'submit', type: 'pin_payload' }],
    ['-10:mbr_route_default', { pin: 'result', type: 'pin_payload', password: 'SECRET_SHOULD_NOT_RENDER' }],
  ]);
  const readRootLabel = (modelId, key) => labels.get(`${modelId}:${key}`);
  const partial = deriveMgmtBusConsoleProjection({ matrixProjection, readRootLabel });

  assert.equal(partial.routeStatus, 'route_missing', 'aggregate route status must include missing MBR routes');
  assert.deepEqual(partial.subjects, [
    { label: 'Trace Buffer', value: 'trace', status: 'available' },
    { label: 'Matrix Adapter', value: 'matrix', status: 'selected' },
  ]);
  assert.ok(
    partial.routeRows.some((row) => row.route === 'mbr_route_1019' && row.status === 'missing'),
    'missing MBR routes must be visible in the route projection',
  );
  assert.doesNotMatch(
    JSON.stringify(partial),
    /SECRET_SHOULD_NOT_RENDER|access_token|password/u,
    'derived management console projection must not expose secret-like route fields',
  );

  labels.set('-10:mbr_route_1019', { pin: 'submit', type: 'pin_payload' });
  const live = deriveMgmtBusConsoleProjection({ matrixProjection, readRootLabel });
  assert.equal(live.routeStatus, 'live', 'aggregate route status may be live only when Model 0 and MBR routes are configured');
  assert.match(live.timelineText, /runtime=running/, 'timeline projection must include source readiness');
  assert.match(live.inspectorText, /routes=6\/6/, 'inspector projection must summarize all checked routes');
  assert.match(
    readText(serverPath),
    /deriveMgmtBusConsoleProjection/su,
    'server must use the tested management console projection deriver',
  );
  return { key: 'server_projection_deriver_includes_mbr_health_and_sanitizes_routes', status: 'PASS' };
}

async function main() {
  const tests = [
    test_live_projection_reads_source_owned_labels_and_updates_when_source_changes,
    test_model1036_does_not_seed_live_projection_truth,
    test_refresh_button_targets_model0_bus_event_v2,
    test_model0_server_and_runtime_accept_refresh_payload_only_as_modeltable,
    test_server_projection_deriver_includes_mbr_health_and_sanitizes_routes,
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
