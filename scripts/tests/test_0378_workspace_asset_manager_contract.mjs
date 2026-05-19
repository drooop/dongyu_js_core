#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadSystemPatch } from '../worker_engine_v0.mjs';
import { buildAstFromCellwiseModel } from '../../packages/ui-model-demo-frontend/src/ui_cellwise_projection.js';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

const workspacePositiveModelsPath = 'packages/worker-base/system-models/workspace_positive_models.json';
const testModel100UiPath = 'packages/worker-base/system-models/test_model_100_ui.json';
const assetManagerPatchPath = 'packages/worker-base/system-models/workspace_manager_asset_manager_ui.json';

function readJson(pathname) {
  return JSON.parse(fs.readFileSync(pathname, 'utf8'));
}

function loadUiRuntimeWithAssetManager() {
  const rt = new ModelTableRuntime();
  loadSystemPatch(rt);
  for (const pathname of [workspacePositiveModelsPath, testModel100UiPath, assetManagerPatchPath]) {
    const result = rt.applyPatch(readJson(pathname), {
      allowCreateModel: true,
      trustedBootstrap: true,
    });
    assert.equal(result.rejected, 0, `${pathname} must load without rejected records`);
  }
  return rt;
}

function findNode(node, id) {
  if (!node || typeof node !== 'object') return null;
  if (node.id === id) return node;
  for (const child of node.children || []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function labelValue(runtime, modelId, p, r, c, key) {
  const model = runtime.getModel(modelId);
  assert.ok(model, `missing model ${modelId}`);
  return runtime.getCell(model, p, r, c).labels.get(key)?.v;
}

function buildProviderBundleTopic(runtime, row) {
  const base = labelValue(runtime, 0, 0, 0, 0, 'mqtt_topic_base') || 'UIPUT/ws/dam/pic/de/sw';
  if (!row.provider_worker_id || !Number.isInteger(row.provider_model_id) || !row.provider_bundle_pin) return '';
  return `${base}/${row.provider_worker_id}/${row.provider_model_id}/${row.provider_bundle_pin}`;
}

function deriveRowsFromCatalogModel(runtime) {
  const maxR = labelValue(runtime, 1052, 0, 0, 0, 'max_r');
  const rows = [];
  for (let row = 1; row <= maxR; row += 1) {
    const get = (key) => runtime.getCell(runtime.getModel(1052), 0, row, 0).labels.get(key)?.v;
    const id = get('asset_id');
    const name = get('name');
    if (!id || !name) continue;
    const installable = get('installable') === true;
    const providerModelId = get('provider_model_id');
    const runtimeEndpointModelId = get('runtime_endpoint_model_id');
    const rowData = {
      id,
      name,
      kind: get('kind') || '',
      asset_type: get('asset_type') || '',
      owner: get('owner') || '',
      owner_worker_id: get('owner_worker_id') || '',
      parent_asset_id: get('parent_asset_id') || '',
      provider_worker_id: get('provider_worker_id') || '',
      ...(Number.isInteger(providerModelId) ? { provider_model_id: providerModelId } : {}),
      provider_bundle_pin: get('provider_bundle_pin') || '',
      provider_route_kind: get('provider_route_kind') || '',
      runtime_endpoint_worker_id: get('runtime_endpoint_worker_id') || '',
      ...(Number.isInteger(runtimeEndpointModelId) ? { runtime_endpoint_model_id: runtimeEndpointModelId } : {}),
      runtime_pins: Array.isArray(get('runtime_pins')) ? get('runtime_pins') : [],
      bundle_sha256: get('bundle_sha256') || '',
      installable,
      action_label: get('action_label') || (installable ? '安装' : '详情'),
      action_type: installable ? 'primary' : 'default',
      summary_markdown: get('summary_markdown') || `### ${name}`,
      detail_markdown: get('detail_markdown') || `## ${name}`,
    };
    const topic = buildProviderBundleTopic(runtime, rowData);
    if (topic) rowData.provider_bundle_topic = topic;
    rows.push(rowData);
  }
  return rows;
}

function test_asset_catalog_patch_is_data_array_one_and_fixed_r1_catalog() {
  const patch = readJson(assetManagerPatchPath);
  const records = patch.records || [];
  const dataRootType = records.find((record) => record.model_id === 1052 && record.p === 0 && record.r === 0 && record.c === 0 && record.k === 'model_type');
  assert.equal(dataRootType?.t, 'model.table', 'asset catalog data model must be a ModelTable table');
  assert.equal(dataRootType?.v, 'Data.Array.One', 'asset catalog data model must use current Data.Array.One type');
  const catalog = records.find((record) => record.model_id === 1051 && record.k === 'asset_catalog_json')?.v;
  assert.ok(Array.isArray(catalog), 'Workspace Manager UI must expose a projected asset_catalog_json array');
  assert.ok(catalog.some((item) => item.id === 'r1' && item.owner_worker_id === 'R1'), 'catalog must include RemoteWorker R1');
  assert.deepEqual(
    catalog.filter((item) => item.owner_worker_id === 'R1' && item.asset_type === 'slide_app').map((item) => [
      item.name,
      item.provider_worker_id,
      item.provider_model_id,
      item.provider_bundle_pin,
      item.provider_route_kind,
      item.installable,
    ]),
    [
      ['E2E 颜色生成器', 'R1', 3100, 'bundle_request', 'control', true],
      ['最小 Submit 双总线示例', 'R1', 3100, 'bundle_request', 'control', true],
    ],
    'RemoteWorker R1 must expose the two installable slide-app assets through provider bundle endpoints',
  );
  assert.equal(JSON.stringify(catalog).includes('source_model_id'), false, 'Workspace Manager catalog must not expose local source_model_id install truth');
  return { key: 'asset_catalog_patch_is_data_array_one_and_fixed_r1_catalog', status: 'PASS' };
}

function test_workspace_asset_manager_ui_is_cellwise_interactive() {
  const rt = loadUiRuntimeWithAssetManager();
  const catalogModel = rt.getModel(1052);
  assert.ok(catalogModel, 'Data.Array.One asset catalog model 1052 must exist');
  assert.equal(labelValue(rt, 1052, 0, 0, 0, 'model_type'), 'Data.Array.One');
  assert.equal(labelValue(rt, 1051, 0, 0, 0, 'workspace_asset_catalog_model_id'), 1052);
  const ast = buildAstFromCellwiseModel(rt.snapshot(), 1051);
  assert.ok(ast, 'Workspace Manager must still build a cellwise UI AST');
  assert.equal(findNode(ast, 'workspace_asset_table')?.type, 'Table', 'asset manager must render a Table');
  assert.equal(findNode(ast, 'workspace_asset_detail_dialog')?.type, 'Dialog', 'asset manager must render a detail Dialog');
  assert.deepEqual(findNode(ast, 'workspace_asset_select_button')?.bind?.write, {
    action: 'workspace_asset_select',
    value_ref: { $ref: 'row' },
  }, 'row select button must dispatch the row payload');
  assert.deepEqual(findNode(ast, 'workspace_asset_primary_button')?.bind?.write, {
    action: 'workspace_asset_primary_action',
    value_ref: { $ref: 'row' },
  }, 'primary row action must dispatch the row payload');
  assert.equal(findNode(ast, 'workspace_asset_table')?.props?.data?.$label?.k, 'asset_catalog_json', 'table data must come from a ModelTable label');
  return { key: 'workspace_asset_manager_ui_is_cellwise_interactive', status: 'PASS' };
}

function test_workspace_asset_manager_patch_has_no_legacy_forms() {
  const text = fs.readFileSync(assetManagerPatchPath, 'utf8');
  for (const forbidden of [
    'pin.connect.model',
    '(self,',
    '(func,',
    '"source_model_id"',
    '源模型',
    '"is_DEM"',
    '"v1n_id"',
    '"t": "BUS_IN"',
    '"t": "BUS_OUT"',
    '"Data.Array"',
  ]) {
    assert.equal(text.includes(forbidden), false, `asset manager patch must not contain ${forbidden}`);
  }
  assert.ok(text.includes('Data.Array.One'), 'asset manager patch must explicitly use Data.Array.One');
  return { key: 'workspace_asset_manager_patch_has_no_legacy_forms', status: 'PASS' };
}

async function test_server_asset_selection_and_provider_install_sends_provider_bundle_request() {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0378-asset-manager-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0378_asset_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  process.env.DY_UI_SERVER_WORKER_ID = 'U1';
  try {
    const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
    const state = createServerState({ dbPath: null });
    const runtime = state.runtime;
    const rows = labelValue(runtime, 1051, 0, 0, 0, 'asset_catalog_json');
    assert.deepEqual(rows, deriveRowsFromCatalogModel(runtime), 'UI projection must be regenerated from Data.Array.One catalog model 1052');
    const ordinary = rows.find((row) => row.id === 'r1');
    const slide = rows.find((row) => row.id === 'r1-color-generator');
    assert.ok(ordinary, 'catalog must include ordinary R1 worker asset');
    assert.ok(slide, 'catalog must include color-generator slide-app asset');

    const selectResult = await state.submitEnvelope({
      type: 'workspace_asset_select',
      payload: {
        action: 'workspace_asset_select',
        value: ordinary,
        meta: { op_id: 'it0378_select_r1' },
      },
    });
    assert.equal(selectResult.result, 'ok', 'ordinary asset selection must be consumed');
    assert.equal(labelValue(runtime, 1051, 0, 0, 0, 'selected_asset_id'), 'r1', 'selection must update selected_asset_id');
    assert.match(labelValue(runtime, 1051, 0, 0, 0, 'selected_asset_summary_markdown'), /RemoteWorker R1/u, 'selection must update summary markdown');

    const beforeMax = Math.max(...Array.from(runtime.models.keys()).filter((id) => Number.isInteger(id) && id > 0));
    const installResult = await state.submitEnvelope({
      type: 'workspace_asset_primary_action',
      payload: {
        action: 'workspace_asset_primary_action',
        value: slide,
        meta: { op_id: 'it0378_install_color' },
      },
    });
    assert.equal(installResult.result, 'ok', 'provider-owned install must send a provider bundle request');
    assert.equal(installResult.routed_by, 'workspace_asset_bundle_request', 'install must use provider request path, not local-copy');
    assert.equal(installResult.topic, 'UIPUT/ws/dam/pic/de/sw/R1/3100/bundle_request', 'install result must show computed provider bundle topic');
    const afterMax = Math.max(...Array.from(runtime.models.keys()).filter((id) => Number.isInteger(id) && id > 0));
    assert.equal(afterMax, beforeMax, 'install request phase must not allocate a new model before provider bundle response');
    assert.match(labelValue(runtime, 1051, 0, 0, 0, 'asset_install_status'), /requesting E2E 颜色生成器 from UIPUT\/ws\/dam\/pic\/de\/sw\/R1\/3100\/bundle_request/u, 'Workspace Manager must show visible provider request status');
    assert.equal(labelValue(runtime, 1051, 0, 0, 0, 'last_installed_model_id'), undefined, 'request phase must not record installed model id');
    const pending = labelValue(runtime, 1051, 0, 0, 0, 'asset_install_pending');
    assert.equal(pending?.asset_id, 'r1-color-generator', 'request phase must record pending asset id');
    assert.deepEqual(pending?.provider_endpoint, { worker_id: 'R1', model_id: 3100, pin: 'bundle_request' }, 'request phase must record provider bundle endpoint');
    const busLabel = runtime.getCell(runtime.getModel(0), 0, 0, 0).labels.get('workspace_asset_bundle_request_bus');
    assert.equal(busLabel?.t, 'pin.bus.cb.out', 'request must leave through Model 0 control-bus out');
    const registry = runtime.getLabelValue(runtime.getModel(-2), 0, 0, 0, 'ws_apps_registry');
    assert.equal(Array.isArray(registry) && registry.some((entry) => entry.model_id > beforeMax), false, 'request phase must not add an app to Workspace registry');

    const forgedResult = await state.submitEnvelope({
      type: 'workspace_asset_primary_action',
      payload: {
        action: 'workspace_asset_primary_action',
        value: {
          id: 'forged-r1-color',
          name: 'Forged color app',
          asset_type: 'slide_app',
          installable: true,
          source_model_id: 100,
        },
        meta: { op_id: 'it0378_forged_asset' },
      },
    });
    assert.equal(forgedResult.result, 'error', 'forged non-catalog asset action must be rejected');
    assert.equal(forgedResult.detail, 'workspace_asset_row_required', 'forged action must fail before install materialization');
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.DY_AUTH;
    delete process.env.DY_PERSISTED_ASSET_ROOT;
    delete process.env.WORKER_BASE_WORKSPACE;
    delete process.env.WORKER_BASE_DATA_ROOT;
    delete process.env.DOCS_ROOT;
    delete process.env.STATIC_PROJECTS_ROOT;
    delete process.env.DY_UI_SERVER_WORKER_ID;
  }
  return { key: 'server_asset_selection_and_provider_install_sends_provider_bundle_request', status: 'PASS' };
}

const tests = [
  test_asset_catalog_patch_is_data_array_one_and_fixed_r1_catalog,
  test_workspace_asset_manager_ui_is_cellwise_interactive,
  test_workspace_asset_manager_patch_has_no_legacy_forms,
  test_server_asset_selection_and_provider_install_sends_provider_bundle_request,
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
