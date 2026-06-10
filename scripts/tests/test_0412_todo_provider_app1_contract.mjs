#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { loadSystemPatch } from '../worker_engine_v0.mjs';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

const remoteProviderPath = 'deploy/sys-v1ns/remote-worker/patches/14_model3100_slide_app_bundle_provider.json';
const assetManagerPath = 'packages/worker-base/system-models/workspace_manager_asset_manager_ui.json';
const todoPayloadPath = 'test_files/todo_board_app_payload.json';
const cloudWorkersPath = 'k8s/cloud/workers.yaml';

function readJson(pathname) {
  return JSON.parse(fs.readFileSync(pathname, 'utf8'));
}

function mt(k, t, v) {
  return { id: 0, p: 0, r: 0, c: 0, k, t, v };
}

function payloadRecord(records, key) {
  return Array.isArray(records) ? records.find((record) => record && record.k === key) || null : null;
}

function payloadString(records, key) {
  const record = payloadRecord(records, key);
  return record && record.t === 'str' ? record.v : '';
}

function payloadJson(records, key) {
  const record = payloadRecord(records, key);
  return record && record.t === 'json' ? record.v : null;
}

function pinPayloadPacket({ opId, assetId }) {
  const responseTopic = 'UIPUT/ws/dam/pic/de/U1D/1051/result';
  return {
    version: 'v1',
    type: 'pin_payload',
    payload: [
      mt('__mt_payload_kind', 'str', 'pin_payload.v1'),
      mt('__mt_request_id', 'str', opId),
      mt('op_id', 'str', opId),
      mt('message_role', 'str', 'request'),
      mt('topic', 'str', 'UIPUT/ws/dam/pic/de/R1/3100/bundle_request'),
      mt('response_topic', 'str', responseTopic),
      mt('route_kind', 'str', 'control'),
      mt('bus', 'str', 'control'),
      mt('endpoint_worker_id', 'str', 'R1'),
      mt('endpoint_model_id', 'int', 3100),
      mt('endpoint_pin', 'str', 'bundle_request'),
      mt('origin_worker_id', 'str', 'U1D'),
      mt('origin_model_id', 'int', 1051),
      mt('origin_pin', 'str', 'workspace_asset_install'),
      mt('reply_target_worker_id', 'str', 'U1D'),
      mt('reply_target_model_id', 'int', 1051),
      mt('reply_target_pin', 'str', 'result'),
      mt('payload', 'json', [
        mt('__mt_payload_kind', 'str', 'slide_app_bundle_request.v1'),
        mt('__mt_request_id', 'str', opId),
        mt('asset_id', 'str', assetId),
        mt('requested_version', 'str', 'current'),
      ]),
      mt('timestamp', 'int', 1700000000000),
    ],
  };
}

function loadRemoteWorkerRuntime() {
  const rt = new ModelTableRuntime();
  loadSystemPatch(rt);
  const patchDir = 'deploy/sys-v1ns/remote-worker/patches';
  for (const filename of fs.readdirSync(patchDir).filter((name) => name.endsWith('.json')).sort()) {
    const result = rt.applyPatch(readJson(join(patchDir, filename)), {
      allowCreateModel: true,
      trustedBootstrap: true,
    });
    assert.equal(result.rejected, 0, `${filename} must load without rejected records`);
  }
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  return rt;
}

async function wait(ms = 120) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function test_r1_provider_patch_contains_todo_app_1_bundle() {
  const provider = readJson(remoteProviderPath);
  const records = provider.records || [];
  const sourcePayload = readJson(todoPayloadPath);
  const todoBundle = records.find((record) => record.model_id === 3100 && record.k === 'bundle_payload_r1_todo_app_1');
  assert.equal(todoBundle?.t, 'json', 'R1 provider must store To Do app 1 bundle as json');
  assert.deepEqual(todoBundle?.v, sourcePayload, 'R1 To Do app 1 bundle must match the validated portable To Do payload');
  assert.equal(JSON.stringify(todoBundle.v).includes('todo_1086_bus_event'), false, 'provider To Do bundle must not keep builtin ToDo bus key');
  assert.equal(JSON.stringify(todoBundle.v).includes('bus_event_submit_0_0_0_0'), true, 'provider To Do bundle must keep import-remappable submit placeholder');

  const handler = records.find((record) => record.model_id === 3100 && record.k === 'provide_slide_app_bundle')?.v?.code || '';
  assert.match(handler, /'r1-todo-app-1': 'bundle_payload_r1_todo_app_1'/u, 'R1 provider handler must route r1-todo-app-1 to the To Do bundle');
  return { key: 'r1_provider_patch_contains_todo_app_1_bundle', status: 'PASS' };
}

function test_workspace_manager_catalog_contains_todo_app_1() {
  const patch = readJson(assetManagerPath);
  const records = patch.records || [];
  const catalog = records.find((record) => record.model_id === 1051 && record.k === 'asset_catalog_json')?.v;
  assert.ok(Array.isArray(catalog), 'Workspace Manager must expose asset_catalog_json');
  const row = catalog.find((item) => item && item.id === 'r1-todo-app-1');
  assert.ok(row, 'Workspace Manager catalog must include r1-todo-app-1');
  assert.deepEqual(
    {
      name: row.name,
      owner_worker_id: row.owner_worker_id,
      asset_type: row.asset_type,
      provider_worker_id: row.provider_worker_id,
      provider_model_id: row.provider_model_id,
      provider_bundle_pin: row.provider_bundle_pin,
      provider_route_kind: row.provider_route_kind,
      runtime_endpoint_worker_id: row.runtime_endpoint_worker_id,
      runtime_endpoint_model_id: row.runtime_endpoint_model_id,
      installable: row.installable,
      action_label: row.action_label,
    },
    {
      name: 'To Do app 1',
      owner_worker_id: 'R1',
      asset_type: 'slide_app',
      provider_worker_id: 'R1',
      provider_model_id: 3100,
      provider_bundle_pin: 'bundle_request',
      provider_route_kind: 'control',
      runtime_endpoint_worker_id: 'R1',
      runtime_endpoint_model_id: 3100,
      installable: true,
      action_label: '安装',
    },
    'To Do app 1 catalog row must use the provider-owned install contract',
  );

  const maxR = records.find((record) => record.model_id === 1052 && record.p === 0 && record.r === 0 && record.c === 0 && record.k === 'max_r')?.v;
  assert.equal(Number.isInteger(maxR) && maxR >= 7, true, 'Workspace Manager Data.Array.One catalog must allocate a row for To Do app 1');
  const dataRows = records.filter((record) => record.model_id === 1052 && record.k === 'asset_id' && record.v === 'r1-todo-app-1');
  assert.equal(dataRows.length, 1, 'Workspace Manager Data.Array.One catalog must contain exactly one To Do app 1 asset_id row');
  const rowIndex = dataRows[0].r;
  const value = (key) => records.find((record) => record.model_id === 1052 && record.r === rowIndex && record.k === key)?.v;
  assert.equal(value('name'), 'To Do app 1', 'Data.Array.One row must carry To Do app 1 name');
  assert.equal(value('provider_bundle_pin'), 'bundle_request', 'Data.Array.One row must carry provider bundle pin');
  assert.equal(value('runtime_endpoint_model_id'), 3100, 'Data.Array.One row must declare R1 provider model as runtime endpoint for this debug asset');
  return { key: 'workspace_manager_catalog_contains_todo_app_1', status: 'PASS' };
}

async function test_r1_provider_runtime_returns_todo_app_1_bundle_response() {
  const rt = loadRemoteWorkerRuntime();
  const handled = rt.mqttIncoming(
    'UIPUT/ws/dam/pic/de/R1/3100/bundle_request',
    pinPayloadPacket({ opId: '0412_todo_provider_request', assetId: 'r1-todo-app-1' }),
  );
  assert.equal(handled, true, 'R1 runtime must accept To Do app 1 provider bundle request');
  await wait();
  const response = rt.getCell(rt.getModel(0), 0, 0, 0).labels.get('remote_result_bus')?.v;
  assert.equal(payloadString(response, '__mt_payload_kind'), 'pin_payload.v1', 'R1 response must be strict pin_payload.v1');
  assert.equal(payloadString(response, 'message_role'), 'response', 'R1 response must be message_role=response');
  assert.equal(payloadString(response, 'topic'), 'UIPUT/ws/dam/pic/de/U1D/1051/result', 'R1 response must publish to request response_topic');
  const nested = payloadJson(response, 'payload');
  assert.equal(payloadString(nested, '__mt_payload_kind'), 'slide_app_bundle_response.v1', 'R1 nested response must be slide_app_bundle_response.v1');
  assert.equal(payloadString(nested, 'asset_id'), 'r1-todo-app-1', 'R1 response must preserve To Do asset id');
  const bundlePayload = payloadJson(nested, 'bundle_payload');
  assert.ok(Array.isArray(bundlePayload), 'R1 response must include bundle payload array');
  assert.equal(bundlePayload.find((record) => record.k === 'app_name')?.v, 'To Do Board', 'R1 To Do app 1 bundle must install as To Do Board');
  assert.equal(bundlePayload.find((record) => record.k === 'host_ingress_v1')?.t, 'json', 'R1 To Do app 1 bundle must declare host ingress');
  return { key: 'r1_provider_runtime_returns_todo_app_1_bundle_response', status: 'PASS' };
}

function test_cloud_manifest_declares_isolated_ui_server_1() {
  const text = fs.readFileSync(cloudWorkersPath, 'utf8');
  for (const required of [
    'name: ui-server-1',
    'app: ui-server-1',
    '- app1.dongyudigital.com',
    '- host: app1.dongyudigital.com',
    'secretName: ui-server-1-tls',
    'DY_UI_SERVER_WORKER_ID',
    'value: "U1D"',
    'path: /home/wwpic/dongyu/volume/persist/ui-server-1',
  ]) {
    assert.ok(text.includes(required), `cloud manifest must include ${required}`);
  }
  assert.ok(!/name: ui-server-1[\s\S]*app=ui-server\n/u.test(text), 'ui-server-1 selectors must not target the production ui-server pods');
  return { key: 'cloud_manifest_declares_isolated_ui_server_1', status: 'PASS' };
}

const tests = [
  test_r1_provider_patch_contains_todo_app_1_bundle,
  test_workspace_manager_catalog_contains_todo_app_1,
  test_r1_provider_runtime_returns_todo_app_1_bundle_response,
  test_cloud_manifest_declares_isolated_ui_server_1,
];

try {
  for (const test of tests) {
    const result = await test();
    console.log(`${result.status} ${result.key}`);
  }
  console.log('PASS test_0412_todo_provider_app1_contract');
} catch (error) {
  console.error(`FAIL test_0412_todo_provider_app1_contract: ${error.message}`);
  process.exit(1);
}
