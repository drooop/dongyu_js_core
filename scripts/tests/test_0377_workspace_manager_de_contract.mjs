#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { WorkerEngineV0, loadSystemPatch } from '../worker_engine_v0.mjs';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

const patchPath = 'deploy/sys-v1ns/workspace-manager/patches/00_workspace_manager_dem_config.json';
const workspacePositiveModelsPath = 'packages/worker-base/system-models/workspace_positive_models.json';
const remoteWorkerRunnerPath = 'scripts/run_worker_remote_v1.mjs';
const localWorkersManifestPath = 'k8s/local/workers.yaml';
const cloudWorkersManifestPath = 'k8s/cloud/workers.yaml';

function readJson(pathname) {
  return JSON.parse(fs.readFileSync(pathname, 'utf8'));
}

function mt(k, t, v) {
  return { id: 0, p: 0, r: 0, c: 0, k, t, v };
}

function record(records, key) {
  return Array.isArray(records) ? records.find((item) => item && item.k === key) || null : null;
}

function payloadString(records, key) {
  const item = record(records, key);
  return item && item.t === 'str' ? item.v : '';
}

function payloadInt(records, key) {
  const item = record(records, key);
  return item && item.t === 'int' ? item.v : null;
}

function payloadJson(records, key) {
  const item = record(records, key);
  return item && item.t === 'json' ? item.v : null;
}

function wait(ms = 30) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestPayload() {
  const businessPayload = [
    mt('model_type', 'model.single', 'Data.WorkspaceManagerRefresh'),
    mt('request_kind', 'str', 'asset_tree'),
  ];
  return [
    mt('__mt_payload_kind', 'str', 'pin_payload.v1'),
    mt('__mt_request_id', 'str', '0377_wm_refresh'),
    mt('op_id', 'str', '0377_wm_refresh'),
    mt('message_role', 'str', 'request'),
    mt('topic', 'str', 'UIPUT/ws/dam/pic/de/sw/WM1/4000/refresh'),
    mt('route_kind', 'str', 'control'),
    mt('bus', 'str', 'control'),
    mt('endpoint_worker_id', 'str', 'WM1'),
    mt('endpoint_model_id', 'int', 4000),
    mt('endpoint_pin', 'str', 'refresh'),
    mt('origin_worker_id', 'str', 'U1'),
    mt('origin_model_id', 'int', 2000),
    mt('origin_pin', 'str', 'refresh'),
    mt('reply_target_worker_id', 'str', 'U1'),
    mt('reply_target_model_id', 'int', 2000),
    mt('reply_target_pin', 'str', 'result'),
    mt('payload', 'json', businessPayload),
    mt('timestamp', 'int', 1700000000000),
  ];
}

function loadWorkspaceManagerRuntime() {
  const rt = new ModelTableRuntime();
  loadSystemPatch(rt);
  const result = rt.applyPatch(readJson(patchPath), {
    allowCreateModel: true,
    trustedBootstrap: true,
  });
  assert.equal(result.rejected, 0, 'workspace-manager patch must load without rejected records');
  if (!rt.isRuntimeRunning || !rt.isRuntimeRunning()) {
    if (!rt.getRuntimeMode || rt.getRuntimeMode() === 'boot') rt.setRuntimeMode('edit');
    rt.setRuntimeMode('running');
  }
  return rt;
}

function loadUiServerPositiveRuntime() {
  const rt = new ModelTableRuntime();
  loadSystemPatch(rt);
  const result = rt.applyPatch(readJson(workspacePositiveModelsPath), {
    allowCreateModel: true,
    trustedBootstrap: true,
  });
  assert.equal(result.rejected, 0, 'workspace positive models must load without rejected records');
  return rt;
}

function drainWorkerEngine(rt) {
  const mqttPublished = [];
  const mgmtPublished = [];
  const engine = new WorkerEngineV0({
    runtime: rt,
    mqttPublish: (topic, payload) => mqttPublished.push({ topic, payload }),
    mgmtAdapter: { publish: async (event) => mgmtPublished.push(event) },
  });
  engine.tick();
  return { mqttPublished, mgmtPublished };
}

function test_docs_only_contract_terms() {
  const docs = [
    'docs/architecture_mantanet_and_workers.md',
    'docs/user-guide/slide-app-runtime/slide_app_runtime_developer_guide.md',
    'docs/iterations/0377-default-workspace-manager-de/plan.md',
    'docs/iterations/0377-default-workspace-manager-de/resolution.md',
  ].map((pathname) => fs.readFileSync(pathname, 'utf8')).join('\n');
  assert.match(docs, /Workspace-Manager-DE/u, 'docs must name Workspace-Manager-DE');
  assert.match(docs, /PICS-DE/u, 'docs must name PICS-DE as future default DE');
  assert.match(docs, /UI-Server 是滑动 App 宿主/u, 'docs must state UI-Server host boundary');
  assert.doesNotMatch(docs, /Workspace Manager.*UI-Server 内置业务页面/u, 'docs must not make Workspace Manager a UI-Server built-in business page');
  return { key: 'docs_only_contract_terms', status: 'PASS' };
}

function test_workspace_manager_dem_patch_identity_and_bus_pins() {
  const patch = readJson(patchPath);
  const records = patch.records || [];
  const byKey = new Map(records.filter((item) => item.op === 'add_label').map((item) => [item.k, item]));

  assert.equal(byKey.get('sys_worker_id')?.t, 'worker.id', 'sys_worker_id must use worker.id label type');
  assert.equal(byKey.get('sys_worker_id')?.v, '5/10/28/36/16', 'workspace manager DEM must have stable worker id');
  assert.equal(byKey.get('sys_worker_role')?.t, 'worker.role', 'sys_worker_role must use worker.role label type');
  assert.equal(byKey.get('sys_worker_role')?.v, 'DEM', 'workspace manager worker must be a DEM');
  assert.equal(byKey.get('mqtt_worker_id')?.v, 'WM1', 'workspace manager MQTT worker id must be WM1');
  assert.equal(byKey.get('mqtt_ingress_pin')?.v, 'wm_cb_in', 'workspace manager MQTT ingress must enter Model 0 control-bus pin');
  const systemSubscriptions = records.filter((item) => item.model_id === -10 && item.p === 0 && item.r === 0 && item.c === 0 && item.k === 'remote_subscriptions');
  assert.equal(systemSubscriptions.length, 1, 'workspace manager runner reads remote_subscriptions from system model -10');
  assert.deepEqual(systemSubscriptions[0].v, [
    'UIPUT/ws/dam/pic/de/sw/WM1/4000/refresh',
  ], 'system model remote_subscriptions must contain the Workspace Manager endpoint topic');
  assert.equal(byKey.get('wm_cb_in')?.t, 'pin.bus.cb.in', 'DEM must expose control bus input');
  assert.equal(byKey.get('wm_cb_out')?.t, 'pin.bus.cb.out', 'DEM must expose control bus output');
  assert.equal(byKey.get('wm_mb_in')?.t, 'pin.bus.mb.in', 'DEM may expose management bus input');
  assert.equal(byKey.get('wm_mb_out')?.t, 'pin.bus.mb.out', 'DEM may expose management bus output');
  return { key: 'workspace_manager_dem_patch_identity_and_bus_pins', status: 'PASS' };
}

function test_workspace_manager_patch_has_no_legacy_inputs() {
  const text = fs.readFileSync(patchPath, 'utf8');
  for (const forbidden of [
    'pin.connect.model',
    '(self,',
    '(func,',
    'pin.log.',
    '"is_DEM"',
    '"v1n_id"',
    '"k": "worker.role"',
    '"t": "BUS_IN"',
    '"t": "BUS_OUT"',
  ]) {
    assert.equal(text.includes(forbidden), false, `workspace manager patch must not contain ${forbidden}`);
  }
  return { key: 'workspace_manager_patch_has_no_legacy_inputs', status: 'PASS' };
}

async function test_workspace_manager_patch_loads_and_returns_asset_tree_response() {
  const rt = loadWorkspaceManagerRuntime();
  const model0 = rt.getModel(0);
  rt.addLabel(model0, 0, 0, 0, {
    k: 'wm_cb_in',
    t: 'pin.bus.cb.in',
    v: requestPayload(),
  });
  await wait();
  const cell = rt.getCell(model0, 0, 0, 0);
  const out = cell.labels.get('wm_cb_out');
  assert.equal(out?.t, 'pin.bus.cb.out', 'refresh handler must write control-bus response');
  const response = out.v;
  assert.equal(payloadString(response, '__mt_payload_kind'), 'pin_payload.v1', 'response must be temporary ModelTable payload');
  assert.equal(payloadString(response, 'message_role'), 'response', 'response must mark message_role=response');
  assert.equal(payloadString(response, 'origin_worker_id'), 'WM1', 'response origin worker must be Workspace Manager');
  assert.equal(payloadInt(response, 'origin_model_id'), 4000, 'response origin model must be service model 4000');
  assert.equal(payloadString(response, 'reply_target_worker_id'), 'U1', 'response must preserve UI reply target');
  const resultPayload = payloadJson(response, 'payload');
  const tree = payloadJson(resultPayload, 'asset_tree_json');
  assert.ok(Array.isArray(tree), 'response payload must include asset_tree_json array');
  assert.ok(tree.some((item) => item && item.id === 'workspace-manager-dem' && item.kind === 'DEM'), 'tree must include Workspace Manager DEM');
  return { key: 'workspace_manager_patch_loads_and_returns_asset_tree_response', status: 'PASS' };
}

async function test_workspace_manager_control_bus_out_publishes_to_payload_topic() {
  const rt = loadWorkspaceManagerRuntime();
  const model0 = rt.getModel(0);
  rt.addLabel(model0, 0, 0, 0, {
    k: 'wm_cb_in',
    t: 'pin.bus.cb.in',
    v: requestPayload(),
  });
  await wait();
  const { mqttPublished, mgmtPublished } = drainWorkerEngine(rt);
  assert.equal(mqttPublished.length, 1, 'worker engine must publish one control-bus response');
  assert.equal(mqttPublished[0].topic, 'UIPUT/ws/dam/pic/de/sw/WM1/4000/refresh', 'publish topic must come from payload topic');
  assert.equal(mgmtPublished.length, 0, 'control refresh must not publish management bus event');
  return { key: 'workspace_manager_control_bus_out_publishes_to_payload_topic', status: 'PASS' };
}

async function test_workspace_manager_runtime_accepts_endpoint_topic_via_model0_boundary() {
  const rt = loadWorkspaceManagerRuntime();
  const model0 = rt.getModel(0);
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_target_host', t: 'str', v: 'localhost' });
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_target_port', t: 'int', v: 1883 });
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_target_client_id', t: 'str', v: 'wm-0377-test' });
  rt.startMqttLoop({ transport: 'mock' });
  rt.setRuntimeMode('running');
  const packet = { version: 'v1', type: 'pin_payload', payload: requestPayload() };
  const accepted = rt.mqttIncoming('UIPUT/ws/dam/pic/de/sw/WM1/4000/refresh', packet);
  await wait();
  assert.equal(accepted, true, 'workspace-manager runtime must accept WM1/4000/refresh endpoint topic');
  assert.equal(model0.getCell(0, 0, 0).labels.get('wm_cb_in')?.t, 'pin.bus.cb.in', 'endpoint topic must first enter Model 0 control-bus boundary');
  assert.deepEqual(model0.getCell(0, 0, 0).labels.get('wm_cb_in')?.v, packet.payload, 'Model 0 control-bus boundary must receive the strict pin payload records');
  const service = rt.getModel(4000);
  assert.equal(service.getCell(0, 0, 0).labels.get('refresh')?.t, 'pin.in', 'Model 0 wm_cb_in route must deliver to model 4000 refresh pin');
  const publish = rt.mqttTrace.list().find((entry) => entry.type === 'publish' && entry.payload?.topic === 'UIPUT/ws/dam/pic/de/sw/WM1/4000/refresh');
  assert.ok(publish, 'workspace-manager response must publish on the payload topic');
  assert.equal(publish.payload?.payload?.type, 'pin_payload', 'published response must use strict pin_payload packet');
  return { key: 'workspace_manager_runtime_accepts_endpoint_topic_via_model0_boundary', status: 'PASS' };
}

function test_workspace_manager_slide_app_contract_is_cellwise_and_host_egress_only() {
  const rt = loadUiServerPositiveRuntime();
  const model = rt.getModel(1051);
  assert.ok(model, 'workspace manager slide app model 1051 must exist');
  const root = rt.getCell(model, 0, 0, 0);

  assert.equal(root.labels.get('app_name')?.v, '工作区管理器', 'Workspace Manager app name must be model-defined');
  assert.equal(root.labels.get('source_worker')?.v, 'Workspace-Manager-DE', 'app source must point to Workspace-Manager-DE');
  assert.equal(root.labels.get('slide_capable')?.v, true, 'Workspace Manager must be slide capable');
  assert.equal(root.labels.get('ui_authoring_version')?.v, 'cellwise.ui.v1', 'Workspace Manager must use cellwise UI');
  assert.equal(root.labels.get('ui_root_node_id')?.v, 'workspace_manager_root', 'Workspace Manager must declare UI root node');
  assert.deepEqual(root.labels.get('remote_bus_endpoint_v1')?.v, {
    transport: 'mqtt',
    to: { worker_id: 'WM1', model_id: 4000 },
  }, 'Workspace Manager app must target Workspace-Manager-DE DEM service endpoint');
  assert.deepEqual(root.labels.get('dual_bus_model')?.v, {
    mode: 'imported_host_egress',
    egress_pins: ['refresh'],
  }, 'Workspace Manager app must declare host egress through ordinary root pin');
  assert.equal(root.labels.get('refresh')?.t, 'pin.out', 'Workspace Manager app root must expose ordinary refresh pin.out');
  assert.deepEqual(root.labels.get('root_routes')?.v, [], 'Workspace Manager app root must not keep a direct internal click route');
  const model0Root = rt.getCell(rt.getModel(0), 0, 0, 0);
  assert.deepEqual(model0Root.labels.get('workspace_manager_refresh_ingress_route')?.v, [{
    from: [0, 0, 0, 'bus_event_refresh_1051_0_0_0'],
    to: [[9, 0, 1051, 'refresh_request']],
  }], 'Workspace Manager app button event must enter through UI-Server Model 0 ingress route');

  const refreshButton = rt.getCell(model, 2, 3, 0);
  assert.deepEqual(refreshButton.labels.get('ui_bind_json')?.v?.write, {
    bus_event_v2: true,
    bus_in_key: 'bus_event_refresh_1051_0_0_0',
    value_ref: [
      mt('__mt_payload_kind', 'str', 'ui_event.v1'),
      mt('request_kind', 'str', 'asset_tree'),
      mt('source', 'str', 'ui_button'),
    ],
    value_t: 'modeltable',
    commit_policy: 'immediate',
  }, 'Workspace Manager refresh button must use bus_event_v2 Model 0 ingress, not a direct positive-model pin write');
  assert.equal(Object.prototype.hasOwnProperty.call(refreshButton.labels.get('ui_bind_json')?.v?.write || {}, 'pin'), false, 'Workspace Manager refresh button must not directly write click_event');

  const statusCell = rt.getCell(model, 2, 4, 0);
  assert.deepEqual(statusCell.labels.get('ui_bind_json')?.v, {
    read: { model_id: 1051, p: 0, r: 0, c: 0, k: 'workspace_manager_status' },
  }, 'Workspace Manager status badge must use current ui_bind_json.read binding');
  assert.equal([...statusCell.labels.keys()].some((key) => key.startsWith('ui_text_ref_')), false, 'Workspace Manager status badge must not keep old ui_text_ref_* bindings');
  const terminalCell = rt.getCell(model, 2, 5, 0);
  assert.deepEqual(terminalCell.labels.get('ui_bind_json')?.v, {
    read: { model_id: 1051, p: 0, r: 0, c: 0, k: 'asset_tree_text' },
  }, 'Workspace Manager terminal must use current ui_bind_json.read binding');
  assert.equal([...terminalCell.labels.keys()].some((key) => key.startsWith('ui_text_ref_')), false, 'Workspace Manager terminal must not keep old ui_text_ref_* bindings');

  let uiNodeCount = 0;
  for (const cell of model.cells.values()) {
    const component = cell.labels.get('ui_component');
    if (component) uiNodeCount += 1;
    for (const label of cell.labels.values()) {
      assert.equal(label.t === 'pin.bus.cb.in' || label.t === 'pin.bus.cb.out' || label.t === 'pin.bus.mb.in' || label.t === 'pin.bus.mb.out', false, 'positive slide app must not declare bus pins');
      assert.notEqual(label.t, 'html', 'Workspace Manager UI must not be an HTML blob');
    }
  }
  assert.ok(uiNodeCount >= 5, 'Workspace Manager UI must be split into multiple cellwise nodes');
  return { key: 'workspace_manager_slide_app_contract_is_cellwise_and_host_egress_only', status: 'PASS' };
}

function test_workspace_manager_worker_scope_is_deployable() {
  const runner = fs.readFileSync(remoteWorkerRunnerPath, 'utf8');
  assert.match(runner, /DY_WORKER_SCOPE/, 'generic worker runner must accept an explicit persisted-asset scope');
  assert.match(runner, /loadSystemPatch\(rt, \{ assetRoot: ASSET_ROOT, scope: WORKER_SCOPE \}\)/, 'runner must load system base for the selected scope');
  assert.match(runner, /scope: WORKER_SCOPE/, 'runner must load role patches for the selected scope');

  for (const manifestPath of [localWorkersManifestPath, cloudWorkersManifestPath]) {
    const manifest = fs.readFileSync(manifestPath, 'utf8');
    assert.match(manifest, /name: workspace-manager-config/, `${manifestPath} must declare workspace-manager config`);
    assert.match(manifest, /name: workspace-manager\n  namespace: dongyu\n  labels:\n    app: workspace-manager/s, `${manifestPath} must declare workspace-manager deployment`);
    assert.match(manifest, /DY_WORKER_SCOPE:\s*"workspace-manager"/, `${manifestPath} must set workspace-manager worker scope`);
    assert.match(manifest, /WORKER_ID:\s*"WM1"/, `${manifestPath} must set workspace-manager worker id`);
    assert.match(manifest, /image:\s*dy-remote-worker:v3/, `${manifestPath} must run the generic fill-table worker image`);
  }
  return { key: 'workspace_manager_worker_scope_is_deployable', status: 'PASS' };
}

async function test_ui_server_materializes_workspace_manager_host_egress_adapter() {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0377-wm-app-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0377_wm_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  process.env.DY_UI_SERVER_WORKER_ID = 'U1';
  try {
    const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
    const state = createServerState({ dbPath: null });
    const runtime = state.runtime;
    const model = runtime.getModel(1051);
    assert.ok(model, 'ui-server state must load Workspace Manager model 1051');
    const root = runtime.getCell(model, 0, 0, 0);
    const generated = root.labels.get('host_egress_generated_model0_labels')?.v || [];
    assert.ok(generated.includes('imported_refresh_1051_bus'), 'ui-server must materialize host egress bus label for Workspace Manager refresh');
    const model0 = runtime.getModel(0);
    const root0 = runtime.getCell(model0, 0, 0, 0);
    const mount = runtime.getCell(model0, 9, 0, 1051);
    assert.equal(mount.labels.get('refresh_request')?.t, 'pin.in', 'ui-server must expose the child refresh_request ingress on the Model 0 mount cell');
    assert.equal(root0.labels.get('imported_refresh_1051_bus')?.t, 'pin.bus.cb.out', 'host egress bus label must be control bus out');
    assert.equal(root0.labels.get('bridge_imported_refresh_to_mt_bus_send_1051')?.t, 'func.js', 'host bridge function must be modelized');
    const beforeReasons = runtime.eventLog.list().map((entry) => entry.reason).filter(Boolean);
    assert.equal(beforeReasons.includes('cell_connection_target_pin_missing'), false, 'host egress materialization must not leave missing target pins');
    runtime.setRuntimeMode('running');
    runtime.addLabel(model0, 0, 0, 0, {
      k: 'bus_event_refresh_1051_0_0_0',
      t: 'pin.bus.cb.in',
      v: [
        mt('__mt_payload_kind', 'str', 'ui_event.v1'),
        mt('request_kind', 'str', 'asset_tree'),
        mt('source', 'str', 'contract_test'),
      ],
    });
    await wait(30);
    assert.equal(root.labels.get('workspace_manager_status')?.v, 'refreshing', 'Model 0 ingress event must reach model 1051 refresh_request and trigger handle_refresh');
    assert.equal(Array.isArray(root.labels.get('refresh')?.v), true, 'handle_refresh must emit a ModelTable payload through the host egress pin');
    assert.equal(root0.labels.get('mt_bus_send_in')?.t, 'pin.in', 'host egress bridge must convert the refresh pin into a Model 0 bus-send request');
    const afterReasons = runtime.eventLog.list().map((entry) => entry.reason).filter(Boolean);
    assert.equal(afterReasons.includes('cell_connection_target_pin_missing'), false, 'bus_event_v2 route must not miss the mounted refresh_request target pin');
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.WORKER_BASE_WORKSPACE;
    delete process.env.WORKER_BASE_DATA_ROOT;
    delete process.env.DOCS_ROOT;
    delete process.env.STATIC_PROJECTS_ROOT;
    delete process.env.DY_PERSISTED_ASSET_ROOT;
    delete process.env.DY_UI_SERVER_WORKER_ID;
  }
  return { key: 'ui_server_materializes_workspace_manager_host_egress_adapter', status: 'PASS' };
}

const tests = process.argv.includes('--docs-only')
  ? [test_docs_only_contract_terms]
  : [
      test_docs_only_contract_terms,
      test_workspace_manager_dem_patch_identity_and_bus_pins,
      test_workspace_manager_patch_has_no_legacy_inputs,
      test_workspace_manager_patch_loads_and_returns_asset_tree_response,
      test_workspace_manager_control_bus_out_publishes_to_payload_topic,
      test_workspace_manager_runtime_accepts_endpoint_topic_via_model0_boundary,
      test_workspace_manager_slide_app_contract_is_cellwise_and_host_egress_only,
      test_workspace_manager_worker_scope_is_deployable,
      test_ui_server_materializes_workspace_manager_host_egress_adapter,
    ];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    const result = await test();
    console.log(`[${result.status}] ${result.key}`);
    passed += 1;
  } catch (err) {
    console.log(`[FAIL] ${test.name}: ${err && err.stack ? err.stack : err}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
