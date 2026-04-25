#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { buildAstFromCellwiseModel } from '../../packages/ui-model-demo-frontend/src/ui_cellwise_projection.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const require = createRequire(import.meta.url);
const { createRenderer } = require('../../packages/ui-renderer/src/index.js');
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');
const workspacePatchPath = 'packages/worker-base/system-models/workspace_positive_models.json';
const systemModelsPath = 'packages/worker-base/system-models/system_models.json';
const runtimeHierarchyMountsPath = 'packages/worker-base/system-models/runtime_hierarchy_mounts.json';
const serverPath = 'packages/ui-model-demo-server/server.mjs';
const modelId = 1036;
const busInKey = 'mgmt_bus_console_send';

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relPath), 'utf8'));
}

function readText(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function recordsForModel(records, targetModelId) {
  return (Array.isArray(records) ? records : []).filter((record) => record && record.model_id === targetModelId);
}

function findRecord(records, predicate) {
  return (Array.isArray(records) ? records : []).find(predicate) || null;
}

function labelsByCell(records, targetModelId) {
  const out = new Map();
  for (const record of recordsForModel(records, targetModelId)) {
    if (record.op !== 'add_label') continue;
    const key = `${record.p},${record.r},${record.c}`;
    if (!out.has(key)) out.set(key, new Map());
    out.get(key).set(record.k, record);
  }
  return out;
}

function makeSnapshotFromRecords(records, targetModelId) {
  const cells = {};
  for (const record of recordsForModel(records, targetModelId)) {
    if (record.op !== 'add_label') continue;
    const key = `${record.p},${record.r},${record.c}`;
    if (!cells[key]) cells[key] = { labels: {} };
    cells[key].labels[record.k] = { k: record.k, t: record.t, v: record.v };
  }
  return {
    models: {
      [String(targetModelId)]: {
        id: targetModelId,
        name: `Model ${targetModelId}`,
        cells,
      },
    },
  };
}

function cloneRecordsWithChangedLabel(records, match, nextValue) {
  return records.map((record) => (
    record
    && record.op === 'add_label'
    && Object.entries(match).every(([key, value]) => record[key] === value)
      ? { ...record, v: nextValue }
      : record
  ));
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

function collectTypes(node, out = new Set()) {
  if (!node || typeof node !== 'object') return out;
  if (typeof node.type === 'string') out.add(node.type);
  for (const child of Array.isArray(node.children) ? node.children : []) {
    collectTypes(child, out);
  }
  return out;
}

function assertRootLabel(records, key, expectedValue) {
  assert.equal(
    findRecord(records, (record) => record?.model_id === modelId && record?.p === 0 && record?.r === 0 && record?.c === 0 && record?.k === key)?.v,
    expectedValue,
    `Model ${modelId} root label ${key} must be ${expectedValue}`,
  );
}

function test_model1036_declares_workspace_cellwise_console_contract() {
  const patch = readJson(workspacePatchPath);
  const records = patch.records || [];
  const mountRecords = readJson(runtimeHierarchyMountsPath).records || [];
  const modelRecords = recordsForModel(records, modelId);
  assert.ok(modelRecords.length > 0, `Model ${modelId} records missing`);
  assert.ok(
    findRecord(records, (record) => record?.op === 'create_model' && record?.model_id === modelId && record?.name === 'Mgmt Bus Console'),
    `Model ${modelId} must be created as Mgmt Bus Console`,
  );
  assertRootLabel(records, 'model_type', 'UI.MgmtBusConsole');
  assertRootLabel(records, 'app_name', 'Mgmt Bus Console');
  assertRootLabel(records, 'slide_capable', true);
  assertRootLabel(records, 'slide_surface_type', 'workspace.page');
  assertRootLabel(records, 'ui_authoring_version', 'cellwise.ui.v1');
  assertRootLabel(records, 'ui_root_node_id', 'mgmt_bus_console_root');
  assert.ok(
    findRecord(mountRecords, (record) => (
      record?.model_id === 0
      && record?.t === 'model.submt'
      && record?.v === modelId
    )),
    `Model ${modelId} must be mounted into Workspace hierarchy`,
  );
  return { key: 'model1036_declares_workspace_cellwise_console_contract', status: 'PASS' };
}

function test_model1036_projects_four_regions_from_cellwise_labels() {
  const records = readJson(workspacePatchPath).records || [];
  const ast = buildAstFromCellwiseModel(makeSnapshotFromRecords(records, modelId), modelId);
  assert.equal(ast?.id, 'mgmt_bus_console_root', 'Mgmt Bus Console must project from a stable cellwise root');
  assert.equal(ast?.type, 'Container', 'root component must be Container');
  assert.equal(ast?.props?.layout, 'column', 'root layout must be label-driven column layout');

  const requiredNodes = {
    mgmt_bus_title: 'Text',
    mgmt_bus_subjects: 'Card',
    mgmt_bus_timeline: 'Card',
    mgmt_bus_composer: 'Card',
    mgmt_bus_inspector: 'Card',
  };
  for (const [id, type] of Object.entries(requiredNodes)) {
    assert.equal(findNodeById(ast, id)?.type, type, `${id} must project as ${type}`);
  }

  const types = collectTypes(ast);
  for (const type of ['Container', 'Card', 'Tabs', 'Table', 'Terminal', 'Input', 'Button', 'StatusBadge']) {
    assert.ok(types.has(type), `Mgmt Bus Console must use existing component ${type}`);
  }

  assert.equal(findNodeById(ast, 'mgmt_bus_title')?.props?.text, 'Mgmt Bus Console', 'visible title must come from ui_text');
  const changed = cloneRecordsWithChangedLabel(records, {
    model_id: modelId,
    p: 2,
    r: 0,
    c: 0,
    k: 'ui_text',
  }, 'Mgmt Bus Console - label rewrite check');
  const changedAst = buildAstFromCellwiseModel(makeSnapshotFromRecords(changed, modelId), modelId);
  assert.equal(
    findNodeById(changedAst, 'mgmt_bus_title')?.props?.text,
    'Mgmt Bus Console - label rewrite check',
    'changing the title ui_text label must change projected title',
  );
  return { key: 'model1036_projects_four_regions_from_cellwise_labels', status: 'PASS' };
}

function test_model1036_does_not_copy_secret_or_external_truth_labels() {
  const records = readJson(workspacePatchPath).records || [];
  const forbiddenKey = /(token|password|passwd|secret|access_token|matrix_room_id|mbr_route_truth|model0_route_truth)/iu;
  for (const record of recordsForModel(records, modelId)) {
    assert.equal(
      forbiddenKey.test(String(record.k || '')),
      false,
      `Model ${modelId} must not copy secret or external truth key ${record.k}`,
    );
    const valueText = typeof record.v === 'string' ? record.v : JSON.stringify(record.v);
    assert.equal(
      /(access_token|password|passwd|secret)/iu.test(String(valueText || '')),
      false,
      `Model ${modelId} must not leak secret-like value in ${record.k}`,
    );
  }
  for (const key of ['subject_projection_rows_json', 'timeline_projection_rows_json', 'route_projection_rows_json']) {
    const projection = findRecord(records, (record) => (
      record?.model_id === modelId
      && record?.p === 0
      && record?.r === 0
      && record?.c === 0
      && record?.k === key
    ));
    assert.deepEqual(projection?.v, [], `${key} must be an empty projection slot, not copied external truth`);
  }
  assert.equal(
    findRecord(records, (record) => (
      record?.model_id === modelId
      && record?.p === 0
      && record?.r === 0
      && record?.c === 0
      && record?.k === 'selected_subject'
    ))?.v,
    '',
    'selected_subject must start empty; selecting an external subject is UI state, not seed truth',
  );
  return { key: 'model1036_does_not_copy_secret_or_external_truth_labels', status: 'PASS' };
}

function test_model1036_send_contract_targets_model0_bus_event_v2() {
  const records = readJson(workspacePatchPath).records || [];
  const ast = buildAstFromCellwiseModel(makeSnapshotFromRecords(records, modelId), modelId);
  const send = findNodeById(ast, 'mgmt_bus_send_button');
  assert.ok(send, 'send button missing');
  assert.equal(send.type, 'Button', 'send node must be a Button');
  assert.equal(send.props?.label, 'Send', 'send button label must be model-table driven');
  assert.equal(send.bind?.write?.bus_event_v2, true, 'send button must declare bus_event_v2 write');
  assert.equal(send.bind?.write?.bus_in_key, busInKey, 'send button must use the management console bus input key');
  assert.ok(Array.isArray(send.bind?.write?.value_ref), 'send value_ref must be a temporary ModelTable record array');
  assert.ok(
    send.bind.write.value_ref.some((record) => record?.k === '__mt_payload_kind' && record?.v === 'mgmt_bus_console.send.v1'),
    'send payload must identify the management console payload kind',
  );

  const snapshot = makeSnapshotFromRecords(records, modelId);
  const dispatched = [];
  const renderer = createRenderer({
    host: {
      getSnapshot: () => snapshot,
      dispatchAddLabel: (label) => dispatched.push(label),
      dispatchRmLabel: () => {},
    },
    vue: {
      h: (type, props, children) => ({ type, props, children }),
      resolveComponent: (name) => name,
    },
  });
  const label = renderer.dispatchEvent(send, { click: true });
  assert.equal(label?.p, 0, 'bus_event_v2 dispatch label must target Model 0 root p');
  assert.equal(label?.r, 0, 'bus_event_v2 dispatch label must target Model 0 root r');
  assert.equal(label?.c, 0, 'bus_event_v2 dispatch label must target Model 0 root c');
  assert.equal(label?.k, 'bus_in_event', 'bus_event_v2 dispatch label must use bus_in_event');
  assert.equal(label?.t, 'event', 'bus_event_v2 dispatch label must be an event label');
  assert.equal(label?.v?.type, 'bus_event_v2', 'dispatch envelope must be bus_event_v2');
  assert.equal(label?.v?.bus_in_key, busInKey, 'dispatch envelope must target the management bus ingress key');
  assert.ok(Array.isArray(label?.v?.value), 'dispatch value must be a ModelTable record array');
  assert.equal(dispatched.length, 1, 'renderer must dispatch exactly one label');
  assert.equal(dispatched[0], label, 'renderer must return the dispatched bus event label');
  return { key: 'model1036_send_contract_targets_model0_bus_event_v2', status: 'PASS' };
}

function test_model0_and_server_accept_management_console_bus_key() {
  const workspaceRecords = readJson(workspacePatchPath).records || [];
  const systemRecords = readJson(systemModelsPath).records || [];
  const route = findRecord(workspaceRecords, (record) => (
    record?.model_id === 0
    && record?.p === 0
    && record?.r === 0
    && record?.c === 0
    && record?.k === 'mgmt_bus_console_send_route'
    && record?.t === 'pin.connect.model'
  ));
  assert.deepEqual(
    route?.v,
    [{ from: [0, busInKey], to: [[-10, 'mgmt_bus_console_intent']] }],
    'Model 0 must route the console bus key to the existing management system model',
  );
  assert.ok(
    findRecord(systemRecords, (record) => (
      record?.model_id === -10
      && record?.p === 0
      && record?.r === 0
      && record?.c === 0
      && record?.k === 'mgmt_bus_console_intent'
      && record?.t === 'pin.in'
    )),
    'System model -10 must declare the management console target pin',
  );
  assert.match(
    readText(serverPath),
    /allowedBusInKeys\s*=\s*new Set\(\[[^\]]*['"]mgmt_bus_console_send['"]/su,
    'server bus_event_v2 allow-list must include mgmt_bus_console_send',
  );
  return { key: 'model0_and_server_accept_management_console_bus_key', status: 'PASS' };
}

function test_runtime_routes_management_console_bus_payload_to_system_model() {
  const rt = new ModelTableRuntime();
  rt.applyPatch(readJson(systemModelsPath), { allowCreateModel: true, trustedBootstrap: true });
  rt.applyPatch(readJson(workspacePatchPath), { allowCreateModel: true, trustedBootstrap: true });
  const model0 = rt.getModel(0);
  const sys = rt.getModel(-10);
  assert.ok(model0, 'Model 0 missing');
  assert.ok(sys, 'system model -10 missing');

  const payload = [
    { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'mgmt_bus_console.send.v1' },
    { id: 0, p: 0, r: 0, c: 0, k: 'source_model_id', t: 'int', v: modelId },
    { id: 0, p: 0, r: 0, c: 0, k: 'draft', t: 'str', v: 'runtime route check' },
  ];
  const addResult = rt.addLabel(model0, 0, 0, 0, {
    k: busInKey,
    t: 'pin.bus.in',
    v: payload,
  });
  assert.equal(addResult?.applied, true, 'Model 0 must accept the management console temporary ModelTable payload');
  const routed = rt.getCell(sys, 0, 0, 0).labels.get('mgmt_bus_console_intent');
  assert.ok(routed, 'management console payload must route to system model -10');
  assert.equal(routed.t, 'pin.in', 'routed management payload must be a system pin.in');
  assert.deepEqual(routed.v, payload, 'routed management payload must preserve the temporary ModelTable record array');

  const bad = rt.addLabel(model0, 0, 0, 0, {
    k: busInKey,
    t: 'pin.bus.in',
    v: { not: 'a temporary ModelTable array' },
  });
  assert.equal(bad?.applied, false, 'Model 0 must reject invalid management console payloads');
  assert.ok(
    rt.eventLog._events.some((event) => (
      event?.result === 'rejected'
      && event?.reason === 'pin_payload_not_modeltable'
      && event?.label?.k === busInKey
    )),
    'invalid management payload rejection must be observable in the runtime event log',
  );
  return { key: 'runtime_routes_management_console_bus_payload_to_system_model', status: 'PASS' };
}

function test_model1036_has_component_state_cells_not_monolithic_html() {
  const records = readJson(workspacePatchPath).records || [];
  const labels = labelsByCell(records, modelId);
  assert.ok(labels.size >= 18, 'Mgmt Bus Console must be decomposed across many cells');
  for (const cellLabels of labels.values()) {
    assert.equal(cellLabels.has('ui_html'), false, 'Mgmt Bus Console must not use monolithic ui_html');
    assert.equal(cellLabels.has('innerHTML'), false, 'Mgmt Bus Console must not use raw innerHTML labels');
  }
  return { key: 'model1036_has_component_state_cells_not_monolithic_html', status: 'PASS' };
}

async function main() {
  const tests = [
    test_model1036_declares_workspace_cellwise_console_contract,
    test_model1036_projects_four_regions_from_cellwise_labels,
    test_model1036_does_not_copy_secret_or_external_truth_labels,
    test_model1036_send_contract_targets_model0_bus_event_v2,
    test_model0_and_server_accept_management_console_bus_key,
    test_runtime_routes_management_console_bus_payload_to_system_model,
    test_model1036_has_component_state_cells_not_monolithic_html,
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
