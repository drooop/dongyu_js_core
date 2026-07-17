#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadSystemPatch } from '../worker_engine_v0.mjs';
import { payloadRecords as v2PayloadRecords, pinPayloadV2Records } from '../lib/pin_payload_v2_test_helpers.mjs';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');
const BUNDLE_RECORD_ID_OFFSET = 100;

function mt(k, t, v) {
  return { id: 0, p: 0, r: 0, c: 0, k, t, v };
}

function readJson(pathname) {
  return JSON.parse(fs.readFileSync(pathname, 'utf8'));
}

function payloadRecord(records, key) {
  return Array.isArray(records) ? records.find((record) => record && record.k === key) || null : null;
}

function payloadString(records, key) {
  const record = payloadRecord(records, key);
  return record && record.t === 'str' ? record.v : '';
}

function payloadInt(records, key) {
  const record = payloadRecord(records, key);
  return record && record.t === 'int' ? record.v : null;
}

function payloadJson(records, key) {
  const record = payloadRecord(records, key);
  return record && record.t === 'json' ? record.v : null;
}

function externalPacket(records) {
  return { version: 'v1', type: 'pin_payload', payload: records };
}

function pinPayloadPacket({
  opId,
  topic,
  responseTopic = null,
  routeKind,
  endpoint,
  origin,
  replyTarget,
  payload,
  messageRole = 'response',
  replyTargetPrincipalKey = '',
  extraRecords = [],
}) {
  const actualResponseTopic = responseTopic || `UIPUT/ws/dam/pic/de/${replyTarget.worker_id}/${replyTarget.model_id}/${replyTarget.pin}`;
  return externalPacket([
    ...pinPayloadV2Records({
      opId,
      messageRole,
      topic,
      responseTopic: actualResponseTopic,
      routeKind,
      endpointWorkerId: endpoint.worker_id,
      endpointModelId: endpoint.model_id,
      endpointPin: endpoint.pin,
      originWorkerId: origin.worker_id,
      originModelId: origin.model_id,
      originPin: origin.pin,
      replyTargetWorkerId: replyTarget.worker_id,
      replyTargetModelId: replyTarget.model_id,
      replyTargetPin: replyTarget.pin,
      replyTargetPrincipalKey,
      payloadRecords: payload,
      extraRecords,
      timestamp: 1700000000000,
    }),
  ]);
}

function encodedBundleRecords(bundlePayload) {
  return bundlePayload.map((record) => ({ ...record, id: BUNDLE_RECORD_ID_OFFSET + record.id }));
}

function decodedBundleRecords(records, businessRecords) {
  const offset = payloadInt(businessRecords, 'bundle_record_id_offset');
  assert.ok(Number.isInteger(offset) && offset > 1, 'bundle response must declare bundle_record_id_offset');
  return records
    .filter((record) => record && Number.isInteger(record.id) && record.id >= offset)
    .map((record) => ({ ...record, id: record.id - offset }));
}

function labelValue(runtime, modelId, p, r, c, key) {
  const model = runtime.getModel(modelId);
  assert.ok(model, `missing model ${modelId}`);
  return runtime.getCell(model, p, r, c).labels.get(key)?.v;
}

function labelValueRef(runtime, tableId, modelId, p, r, c, key) {
  const model = runtime.getModel({ table_id: tableId, model_id: modelId });
  assert.ok(model, `missing model ${tableId}/${modelId}`);
  return runtime.getCell(model, p, r, c).labels.get(key)?.v;
}

async function wait(ms = 60) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0384-provider-install-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0384_provider_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  process.env.DY_UI_SERVER_WORKER_ID = 'U1';
  try {
    const { createServerState, buildSlideAppExportPayload } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
    const state = createServerState({ dbPath: null });
    await state.activateRuntimeMode('running');
    return await fn(state, buildSlideAppExportPayload);
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

function remoteBundleRequestPacket(assetId = 'r1-color-generator', replyTargetPrincipalKey = 'subject:it0384-provider') {
  return pinPayloadPacket({
    opId: `0384_bundle_request_${assetId}`,
    topic: 'UIPUT/ws/dam/pic/de/R1/3100/bundle_request',
    routeKind: 'control',
    endpoint: { worker_id: 'R1', model_id: 3100, pin: 'bundle_request' },
    origin: { worker_id: 'U1', model_id: 1051, pin: 'workspace_asset_install' },
    replyTarget: { worker_id: 'U1', model_id: 1051, pin: 'result' },
    messageRole: 'request',
    replyTargetPrincipalKey,
    payload: [
      mt('__mt_payload_kind', 'str', 'slide_app_bundle_request.v1'),
      mt('asset_id', 'str', assetId),
      mt('requested_version', 'str', 'current'),
    ],
  });
}

function makeBundleResponse({
  opId,
  topic,
  endpoint,
  replyTarget,
  bundlePayload,
  assetId = 'r1-color-generator',
  routeKind = 'control',
  replyTargetPrincipalKey = '',
}) {
  return pinPayloadPacket({
    opId,
    topic,
    responseTopic: topic,
    routeKind,
    endpoint: replyTarget,
    origin: { worker_id: endpoint.worker_id, model_id: endpoint.model_id, pin: endpoint.pin },
    replyTarget,
    messageRole: 'response',
    replyTargetPrincipalKey,
    payload: [
      mt('__mt_payload_kind', 'str', 'slide_app_bundle_response.v1'),
      mt('asset_id', 'str', assetId),
      mt('bundle_record_id_offset', 'int', BUNDLE_RECORD_ID_OFFSET),
      mt('bundle_sha256', 'str', ''),
    ],
    extraRecords: encodedBundleRecords(bundlePayload),
  });
}

async function withServerModule(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0384-provider-registry-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0384_registry_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  process.env.DY_UI_SERVER_WORKER_ID = 'U1';
  try {
    const mod = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
    return await fn(mod);
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
}

async function test_install_action_sends_provider_bundle_request_without_materializing() {
  return withServerState(async (state) => {
    const runtime = state.runtime;
    const rows = labelValue(runtime, 1051, 0, 0, 0, 'asset_catalog_json');
    const slide = rows.find((row) => row.id === 'r1-color-generator');
    assert.ok(slide, 'catalog must include r1-color-generator');
    const beforeMax = Math.max(...Array.from(runtime.models.keys()).filter((id) => Number.isInteger(id) && id > 0));
    const result = await state.submitEnvelope({
      type: 'workspace_asset_primary_action',
      payload: {
        action: 'workspace_asset_primary_action',
        value: slide,
        meta: { op_id: '0384_install_request_color' },
      },
    });
    assert.equal(result.result, 'ok', 'install action must send a provider bundle request');
    assert.equal(result.routed_by, 'workspace_asset_bundle_request', 'install action must use provider request path');
    assert.equal(result.topic, 'UIPUT/ws/dam/pic/de/R1/3100/bundle_request', 'install request must use computed provider topic');
    const afterMax = Math.max(...Array.from(runtime.models.keys()).filter((id) => Number.isInteger(id) && id > 0));
    assert.equal(afterMax, beforeMax, 'request phase must not create a local model');
    const pending = labelValue(runtime, 1051, 0, 0, 0, 'asset_install_pending');
    assert.equal(pending?.asset_id, 'r1-color-generator', 'pending install state must record asset_id');
    assert.equal(pending?.topic, 'UIPUT/ws/dam/pic/de/R1/3100/bundle_request', 'pending install state must record computed topic');
    assert.deepEqual(pending?.provider_endpoint, { worker_id: 'R1', table_id: 'host', model_id: 3100, pin: 'bundle_request' }, 'pending install state must record provider endpoint');
    const busLabel = runtime.getCell(runtime.getModel(0), 0, 0, 0).labels.get('workspace_asset_bundle_request_bus');
    assert.equal(busLabel?.t, 'pin.bus.cb.out', 'install request must leave through Model 0 control bus out');
    assert.equal(payloadString(busLabel?.v, '__mt_payload_kind'), 'pin_payload.v2', 'request bus payload must be pin_payload.v2');
    assert.equal(payloadString(busLabel?.v, 'message_role'), 'request', 'request bus payload must mark message_role=request');
    assert.equal(payloadString(busLabel?.v, 'topic'), 'UIPUT/ws/dam/pic/de/R1/3100/bundle_request', 'request bus payload must carry provider topic');
    assert.equal(payloadJson(busLabel?.v, 'payload'), null, 'request bus payload must not carry nested payload');
    const business = v2PayloadRecords(busLabel?.v);
    assert.equal(payloadString(business, '__mt_payload_kind'), 'slide_app_bundle_request.v1', 'business records must be slide app bundle request');
    assert.equal(payloadString(business, 'asset_id'), 'r1-color-generator', 'business records must carry selected asset_id');
    const beforeRetryEvents = runtime.eventLog.list().length;
    const retryResult = await state.submitEnvelope({
      type: 'workspace_asset_primary_action',
      payload: {
        action: 'workspace_asset_primary_action',
        value: slide,
        meta: { op_id: '0384_install_request_color_retry' },
      },
    });
    assert.equal(retryResult.result, 'ok', 'retry install action must send a fresh provider bundle request');
    const retryEvents = runtime.eventLog.list().slice(beforeRetryEvents);
    assert.ok(
      retryEvents.some((event) => event.op === 'rm_label' && event.cell?.model_id === 0 && event.label?.k === 'workspace_asset_bundle_request_bus'),
      'retry install request must remove the old one-shot bus output before sending a new request',
    );
    assert.ok(
      retryEvents.some((event) => event.op === 'add_label' && event.cell?.model_id === 0 && event.label?.k === 'workspace_asset_bundle_request_bus' && event.label?.t === 'pin.bus.cb.out'),
      'retry install request must add a fresh control-bus output label',
    );
    return { key: 'install_action_sends_provider_bundle_request_without_materializing', status: 'PASS' };
  });
}

async function test_principal_install_request_preserves_runtime_key_after_model0_label_loss() {
  return withServerState(async (state) => {
    const runtime = state.runtime;
    runtime.principalRuntimeKey = 'subject:it0384-principal';
    const model0 = runtime.getModel(0);
    runtime.rmLabel(model0, 0, 0, 0, 'principal_runtime_key');
    const rows = labelValue(runtime, 1051, 0, 0, 0, 'asset_catalog_json');
    const slide = rows.find((row) => row.id === 'r1-color-generator');
    const result = await state.submitEnvelope({
      type: 'workspace_asset_primary_action',
      payload: {
        action: 'workspace_asset_primary_action',
        value: slide,
        meta: { op_id: '0384_principal_install_request' },
      },
    });
    assert.equal(result.result, 'ok', 'principal install action must still send provider request');
    const busLabel = runtime.getCell(model0, 0, 0, 0).labels.get('workspace_asset_bundle_request_bus');
    assert.equal(
      payloadString(busLabel?.v, 'reply_target_principal_key'),
      'subject:it0384-principal',
      'install request must use runtime principal key even if the Model 0 label is missing',
    );
    return { key: 'principal_install_request_preserves_runtime_key_after_model0_label_loss', status: 'PASS' };
  });
}

async function test_provider_bundle_response_materializes_new_workspace_app_and_rejects_mismatches() {
  return withServerState(async (state, buildSlideAppExportPayload) => {
    const runtime = state.runtime;
    const rows = labelValue(runtime, 1051, 0, 0, 0, 'asset_catalog_json');
    const slide = rows.find((row) => row.id === 'r1-color-generator');
    const beforeMax = Math.max(...Array.from(runtime.models.keys()).filter((id) => Number.isInteger(id) && id > 0));
    const requestResult = await state.submitEnvelope({
      type: 'workspace_asset_primary_action',
      payload: {
        action: 'workspace_asset_primary_action',
        value: slide,
        meta: { op_id: '0384_install_response_color' },
      },
    });
    assert.equal(requestResult.result, 'ok', 'install request must be accepted before response');
    const pending = labelValue(runtime, 1051, 0, 0, 0, 'asset_install_pending');
    assert.ok(pending?.op_id, 'pending install must include op_id');
    const exportResult = buildSlideAppExportPayload(runtime, 100);
    assert.equal(exportResult.ok, true, 'test fixture must export local color app payload');

    const mismatches = [
      {
        name: 'asset',
        packet: makeBundleResponse({
          opId: pending.op_id,
          topic: pending.response_topic,
          endpoint: pending.provider_endpoint,
          replyTarget: pending.reply_target,
          assetId: 'wrong-asset',
          bundlePayload: exportResult.data.payload,
        }),
        topic: pending.response_topic,
      },
      {
        name: 'op_id',
        packet: makeBundleResponse({
          opId: `${pending.op_id}_wrong`,
          topic: pending.response_topic,
          endpoint: pending.provider_endpoint,
          replyTarget: pending.reply_target,
          bundlePayload: exportResult.data.payload,
        }),
        topic: pending.response_topic,
      },
      {
        name: 'topic',
        packet: makeBundleResponse({
          opId: pending.op_id,
          topic: 'UIPUT/ws/dam/pic/de/R1/3100/wrong_bundle_request',
          endpoint: pending.provider_endpoint,
          replyTarget: pending.reply_target,
          bundlePayload: exportResult.data.payload,
        }),
        topic: pending.response_topic,
      },
      {
        name: 'route_kind',
        packet: makeBundleResponse({
          opId: pending.op_id,
          topic: pending.response_topic,
          routeKind: 'management',
          endpoint: pending.provider_endpoint,
          replyTarget: pending.reply_target,
          bundlePayload: exportResult.data.payload,
        }),
        topic: pending.response_topic,
      },
      {
        name: 'endpoint',
        packet: makeBundleResponse({
          opId: pending.op_id,
          topic: pending.response_topic,
          endpoint: { ...pending.provider_endpoint, model_id: 3101 },
          replyTarget: pending.reply_target,
          bundlePayload: exportResult.data.payload,
        }),
        topic: pending.response_topic,
      },
      {
        name: 'reply_target',
        packet: makeBundleResponse({
          opId: pending.op_id,
          topic: pending.response_topic,
          endpoint: pending.provider_endpoint,
          replyTarget: { ...pending.reply_target, model_id: 1052 },
          bundlePayload: exportResult.data.payload,
        }),
        topic: pending.response_topic,
      },
    ];
    for (const mismatch of mismatches) {
      const wrongHandled = await state.programEngine.handleControlBusPacket(mismatch.topic, mismatch.packet);
      assert.equal(wrongHandled, false, `mismatched ${mismatch.name} response must be rejected`);
      assert.equal(Math.max(...Array.from(runtime.models.keys()).filter((id) => Number.isInteger(id) && id > 0)), beforeMax, `mismatched ${mismatch.name} response must not create a model`);
    }

    const goodResponse = makeBundleResponse({
      opId: pending.op_id,
      topic: pending.response_topic,
      endpoint: pending.provider_endpoint,
      replyTarget: pending.reply_target,
      bundlePayload: exportResult.data.payload,
    });
    const handled = await state.programEngine.handleControlBusPacket(pending.response_topic, goodResponse);
    assert.equal(handled, true, 'matched provider bundle response must be handled');
    await wait();
    const installedId = labelValue(runtime, 1051, 0, 0, 0, 'last_installed_model_id');
    const installedTableId = labelValue(runtime, 1051, 0, 0, 0, 'last_installed_table_id');
    assert.equal(installedId, 0, 'provider response must preserve package-local root model id');
    assert.ok(typeof installedTableId === 'string' && installedTableId.startsWith('app:local-dev:'), 'provider response must allocate an app instance table');
    assert.equal(labelValueRef(runtime, installedTableId, installedId, 0, 0, 0, 'app_name'), 'E2E 颜色生成器', 'installed app must use provider bundle payload');
    assert.equal(labelValue(runtime, 1051, 0, 0, 0, 'asset_install_pending'), null, 'successful install must clear pending install state');
    assert.match(labelValue(runtime, 1051, 0, 0, 0, 'asset_install_status'), /installed E2E 颜色生成器 as app:local-dev:.*\/0/u, 'successful install must write visible status');
    assert.equal(labelValue(runtime, 1051, 0, 0, 0, 'asset_install_dialog_open'), true, 'successful install must open a UI-model install-complete dialog');
    assert.equal(labelValue(runtime, 1051, 0, 0, 0, 'asset_install_dialog_title'), '安装完毕', 'install dialog must use the required title');
    assert.match(labelValue(runtime, 1051, 0, 0, 0, 'asset_install_dialog_text'), /E2E 颜色生成器.*app:local-dev:.*\/0/u, 'install dialog body must mention the installed app and model ref');
    assert.deepEqual(
      labelValue(runtime, 1051, 0, 0, 0, 'asset_install_dialog_target_json'),
      {
        id: `workspace:${installedTableId}:${installedId}`,
        kind: 'workspace',
        page: 'workspace',
        path: '/workspace',
        table_id: installedTableId,
        model_id: installedId,
        title: 'E2E 颜色生成器',
      },
      'install dialog must store the exact launch payload for the installed app',
    );
    const registry = labelValue(runtime, -2, 0, 0, 0, 'ws_apps_registry');
    assert.ok(
      Array.isArray(registry) && registry.some((entry) => entry?.table_id === installedTableId && entry?.model_id === installedId && entry?.name === 'E2E 颜色生成器'),
      'successful install must refresh ws_apps_registry so desktop list sees the new app without reload',
    );
    const duplicateHandled = await state.programEngine.handleControlBusPacket(pending.response_topic, goodResponse);
    assert.equal(duplicateHandled, true, 'duplicate provider response with the same op_id must be handled idempotently');
    assert.equal(labelValue(runtime, 1051, 0, 0, 0, 'last_installed_model_id'), installedId, 'duplicate response must not create or switch to another model');
    assert.equal(labelValue(runtime, 1051, 0, 0, 0, 'last_installed_table_id'), installedTableId, 'duplicate response must not create or switch to another table');
    assert.equal(labelValue(runtime, 1051, 0, 0, 0, 'asset_install_dialog_open'), true, 'duplicate response must not close the success dialog');
    assert.match(labelValue(runtime, 1051, 0, 0, 0, 'asset_install_status'), /installed E2E 颜色生成器 as app:local-dev:.*\/0/u, 'duplicate response must not overwrite success status with an error');
    return { key: 'provider_bundle_response_materializes_new_workspace_app_and_rejects_mismatches', status: 'PASS' };
  });
}

async function test_provider_installed_submit_app_rewrites_ingress_and_publishes_request() {
  return withServerState(async (state) => {
    const runtime = state.runtime;
    const model0 = runtime.getModel(0);
    runtime.addLabel(model0, 0, 0, 0, { k: 'mqtt_topic_mode', t: 'str', v: 'uiput_mm_v1' });
    runtime.addLabel(model0, 0, 0, 0, { k: 'mqtt_topic_base', t: 'str', v: 'UIPUT/ws/dam/pic/de' });
    runtime.addLabel(model0, 0, 0, 0, { k: 'mqtt_worker_id', t: 'str', v: 'U1' });
    runtime.addLabel(model0, 0, 0, 0, { k: 'mqtt_payload_mode', t: 'str', v: 'pin_payload_v2' });
    runtime.startMqttLoop({
      host: 'localhost',
      port: 1883,
      client_id: '0384-provider-submit-app',
      transport: 'mock',
    });
    const publishedPackets = [];
    state.programEngine.controlBusClient = {
      connected: true,
      publish(topic, payload, callback) {
        publishedPackets.push({ topic, payload: JSON.parse(payload) });
        if (typeof callback === 'function') callback(null);
      },
    };

    const rows = labelValue(runtime, 1051, 0, 0, 0, 'asset_catalog_json');
    const slide = rows.find((row) => row.id === 'r1-minimal-submit');
    assert.ok(slide, 'catalog must include r1-minimal-submit');
    const requestResult = await state.submitEnvelope({
      type: 'workspace_asset_primary_action',
      payload: {
        action: 'workspace_asset_primary_action',
        value: slide,
        meta: { op_id: '0384_install_response_minimal_submit' },
      },
    });
    assert.equal(requestResult.result, 'ok', 'minimal submit install request must be accepted');
    const pending = labelValue(runtime, 1051, 0, 0, 0, 'asset_install_pending');
    assert.ok(pending?.op_id, 'pending minimal submit install must include op_id');

    const providerRuntime = loadRemoteWorkerRuntime();
    const handledRequest = providerRuntime.mqttIncoming(
      'UIPUT/ws/dam/pic/de/R1/3100/bundle_request',
      remoteBundleRequestPacket('r1-minimal-submit', 'subject:it0384-provider-submit'),
    );
    assert.equal(handledRequest, true, 'remote worker fixture must accept minimal submit bundle request');
    await wait(120);
    const response = providerRuntime.getCell(providerRuntime.getModel(0), 0, 0, 0).labels.get('remote_result_bus')?.v;
    const business = v2PayloadRecords(response);
    const bundlePayload = decodedBundleRecords(response, business);
    assert.ok(Array.isArray(bundlePayload) && bundlePayload.some((record) => record.k === 'app_name' && record.v === '最小 Submit 双总线示例'), 'remote worker fixture must return minimal submit bundle payload');

    const goodResponse = makeBundleResponse({
      opId: pending.op_id,
      topic: pending.response_topic,
      endpoint: pending.provider_endpoint,
      replyTarget: pending.reply_target,
      assetId: 'r1-minimal-submit',
      bundlePayload,
    });
    const handledResponse = await state.programEngine.handleControlBusPacket(pending.response_topic, goodResponse);
    assert.equal(handledResponse, true, 'matched minimal submit provider response must install app');
    await wait();

    const installedId = labelValue(runtime, 1051, 0, 0, 0, 'last_installed_model_id');
    const installedTableId = labelValue(runtime, 1051, 0, 0, 0, 'last_installed_table_id');
    assert.equal(installedId, 0, 'provider installed submit app must keep package-local model id 0');
    assert.ok(typeof installedTableId === 'string' && installedTableId.startsWith('app:local-dev:'), 'provider installed submit app must allocate an app table');
    const installedRoot = runtime.getCell(runtime.getModel({ table_id: installedTableId, model_id: installedId }), 0, 0, 0).labels;
    const generatedLabels = installedRoot.get('host_ingress_generated_model0_labels')?.v || [];
    const ingressKey = generatedLabels.find((key) => typeof key === 'string' && key.startsWith('imported_host_submit_'));
    assert.ok(ingressKey, 'installed submit app must record generated host ingress key');
    const installedText = JSON.stringify(state.clientSnap().tables?.[installedTableId]?.models?.[String(installedId)] || {});
    assert.equal(installedText.includes('bus_event_submit_0_0_0_0'), false, 'installed submit app must not keep import placeholder bus key');
    assert.equal(installedText.includes(ingressKey), true, 'installed submit app button binding must use generated host ingress key');

    const ownerUpdateResult = await state.submitEnvelope({
      type: 'ui_owner_label_update',
      payload: {
        action: 'ui_owner_label_update',
        meta: { op_id: '0384_provider_installed_owner_update' },
        target: { table_id: installedTableId, model_id: installedId, p: 0, r: 0, c: 0, k: 'input_text' },
        value: { t: 'str', v: 'provider installed local draft' },
      },
    });
    assert.equal(ownerUpdateResult.result, 'ok', `provider installed app root owner update must accept table-qualified model 0; got ${JSON.stringify(ownerUpdateResult)}`);
    assert.equal(
      runtime.getCell(runtime.getModel({ table_id: installedTableId, model_id: installedId }), 0, 0, 0).labels.get('input_text')?.v,
      'provider installed local draft',
      'provider installed app root owner update must materialize inside its app table',
    );

    const submitResult = await state.submitEnvelope({
      type: 'bus_event_v2',
      bus_in_key: ingressKey,
      value: [
        mt('__mt_payload_kind', 'str', 'ui_event.v1'),
        mt('text', 'str', 'provider installed submit works'),
        mt('source', 'str', 'it0384_provider_installed_submit'),
      ],
      meta: { op_id: '0384_provider_installed_submit_click' },
    });
    assert.equal(submitResult.result, 'ok', 'provider installed submit app must accept generated ingress key');
    assert.equal(submitResult.routed_by, 'model0_busin', 'provider installed submit app must route through Model 0 bus_event_v2');
    await wait(300);

    const publish = publishedPackets.find((entry) => (
      entry.topic === 'UIPUT/ws/dam/pic/de/R1/3000/submit1'
      && entry.payload?.type === 'pin_payload'
      && payloadString(entry.payload.payload, 'message_role') === 'request'
      && payloadString(entry.payload.payload, 'topic') === 'UIPUT/ws/dam/pic/de/R1/3000/submit1'
      && payloadString(entry.payload.payload, 'endpoint_worker_id') === 'R1'
      && payloadInt(entry.payload.payload, 'endpoint_model_id') === 3000
      && payloadString(entry.payload.payload, 'endpoint_pin') === 'submit1'
      && payloadString(entry.payload.payload, 'origin_worker_id') === 'U1'
      && payloadString(entry.payload.payload, 'origin_table_id') === installedTableId
      && payloadInt(entry.payload.payload, 'origin_model_id') === installedId
      && payloadString(entry.payload.payload, 'origin_pin') === 'submit1'
      && payloadString(entry.payload.payload, 'reply_target_worker_id') === 'U1'
      && payloadString(entry.payload.payload, 'reply_target_table_id') === installedTableId
      && payloadInt(entry.payload.payload, 'reply_target_model_id') === installedId
      && payloadString(entry.payload.payload, 'reply_target_pin') === 'result'
      && payloadString(entry.payload.payload, 'response_topic') !== 'UIPUT/ws/dam/pic/de/U1/0/result'
      && v2PayloadRecords(entry.payload.payload).some((record) => record.k === 'text' && record.v === 'provider installed submit works')
    ));
    assert.ok(publish, `provider installed submit app must publish pin_payload.v2 request to remote worker topic; published=${JSON.stringify(publishedPackets, null, 2)}`);
    return { key: 'provider_installed_submit_app_rewrites_ingress_and_publishes_request', status: 'PASS' };
  });
}

async function test_remote_worker_r1_bundle_provider_patch_returns_modeltable_bundle_response() {
  const cases = [
    ['r1-color-generator', 'E2E 颜色生成器'],
    ['r1-minimal-submit', '最小 Submit 双总线示例'],
  ];
  for (const [assetId, appName] of cases) {
    const rt = loadRemoteWorkerRuntime();
    const sys = rt.getModel(-10);
    const subs = sys ? rt.getLabelValue(sys, 0, 0, 0, 'remote_subscriptions') : [];
    assert.ok(Array.isArray(subs) && subs.includes('UIPUT/ws/dam/pic/de/R1/3100/bundle_request'), 'R1 must subscribe to provider bundle endpoint');
    const handled = rt.mqttIncoming('UIPUT/ws/dam/pic/de/R1/3100/bundle_request', remoteBundleRequestPacket(assetId));
    assert.equal(handled, true, `R1 runtime must accept provider bundle request topic for ${assetId}`);
    await wait(120);
    const response = rt.getCell(rt.getModel(0), 0, 0, 0).labels.get('remote_result_bus')?.v;
    assert.equal(payloadString(response, '__mt_payload_kind'), 'pin_payload.v2', 'provider response must be strict pin_payload.v2');
    assert.equal(payloadString(response, 'message_role'), 'response', 'provider response must use message_role=response');
    assert.equal(payloadString(response, 'reply_target_principal_key'), 'subject:it0384-provider', 'provider response must echo reply_target_principal_key for authenticated UI runtimes');
    assert.equal(payloadInt(response, 'origin_model_id'), 3100, 'provider response must originate from model 3100');
    assert.equal(payloadJson(response, 'payload'), null, 'provider response must not carry nested payload');
    const business = v2PayloadRecords(response);
    assert.equal(payloadString(business, '__mt_payload_kind'), 'slide_app_bundle_response.v1', 'provider business records must be bundle response');
    assert.equal(payloadString(business, 'asset_id'), assetId, 'provider response must preserve catalog asset_id');
    assert.equal(payloadJson(business, 'bundle_payload'), null, 'provider response must not nest bundle payload as json');
    const bundlePayload = decodedBundleRecords(response, business);
    assert.ok(Array.isArray(bundlePayload) && bundlePayload.some((record) => record.k === 'app_name' && record.v === appName), `provider response must include ${appName} ModelTable bundle payload`);
    assert.ok(
      bundlePayload.some((record) => record.k === 'slide_app_summary' && record.t === 'str' && record.v.length >= 8),
      `provider response for ${appName} must include slide_app_summary required by the OS shell`,
    );
  }
  return { key: 'remote_worker_r1_bundle_provider_patch_returns_modeltable_bundle_response', status: 'PASS' };
}

async function test_remote_worker_r1_bundle_provider_rejects_missing_table_refs() {
  for (const missingKey of ['endpoint_table_id', 'origin_table_id', 'reply_target_table_id']) {
    const rt = loadRemoteWorkerRuntime();
    const packet = remoteBundleRequestPacket('r1-color-generator');
    packet.payload = packet.payload.filter((record) => record.k !== missingKey);
    const handled = rt.mqttIncoming('UIPUT/ws/dam/pic/de/R1/3100/bundle_request', packet);
    assert.equal(handled, false, `R1 runtime must reject provider bundle request missing ${missingKey}`);
    await wait(120);
    const response = rt.getCell(rt.getModel(0), 0, 0, 0).labels.get('remote_result_bus')?.v;
    assert.equal(payloadString(response, '__mt_payload_kind'), '', `R1 provider must not emit response when ${missingKey} is missing`);
    assert.equal(
      rt.getCell(rt.getModel(0), 0, 0, 0).labels.get('mqtt_inbound_error')?.v?.code,
      `missing_${missingKey}`,
      `R1 provider must write the visible MQTT boundary error on Model 0 when ${missingKey} is missing`,
    );
    assert.equal(
      rt.getCell(rt.getModel(3100), 0, 0, 0).labels.has('mqtt_inbound_error'),
      false,
      `R1 provider must not pollute Model 3100 with a transport error when ${missingKey} is missing`,
    );
  }
  return { key: 'remote_worker_r1_bundle_provider_rejects_missing_table_refs', status: 'PASS' };
}

async function test_principal_registry_delegates_bundle_response_to_user_runtime_installer() {
  return withServerModule(async ({ createServerState, buildSlideAppExportPayload, createPrincipalRuntimeRegistry }) => {
    const readOnlyState = createServerState({ dbPath: null });
    const registry = createPrincipalRuntimeRegistry({
      readOnlyState,
      createState(principalKey) {
        const state = createServerState({ dbPath: null });
        state.runtime.principalRuntimeKey = principalKey;
        const model0 = state.runtime.getModel(0);
        state.runtime.addLabel(model0, 0, 0, 0, { k: 'principal_runtime_key', t: 'str', v: principalKey });
        state.programEngine.disableControlBusInbound = true;
        return state;
      },
    });
    const principal = { subject: 'it0384-principal-bundle' };
    const principalKey = registry.principalRuntimeKey(principal);
    const entry = registry.resolveMutableRuntime(principal);
    await entry.state.activateRuntimeMode('running');
    const runtime = entry.state.runtime;
    const rows = labelValue(runtime, 1051, 0, 0, 0, 'asset_catalog_json');
    const slide = rows.find((row) => row.id === 'r1-color-generator');
    assert.ok(slide, 'principal runtime catalog must include r1-color-generator');
    const requestResult = await entry.state.submitEnvelope({
      type: 'workspace_asset_primary_action',
      payload: {
        action: 'workspace_asset_primary_action',
        value: slide,
        meta: { op_id: '0384_principal_bundle_install' },
      },
    });
    assert.equal(requestResult.result, 'ok', 'principal runtime install request must be accepted');
    const pending = labelValue(runtime, 1051, 0, 0, 0, 'asset_install_pending');
    assert.equal(pending?.asset_id, 'r1-color-generator', 'principal runtime must record pending install');
    const exportResult = buildSlideAppExportPayload(runtime, 100);
    assert.equal(exportResult.ok, true, 'principal runtime fixture must export color app payload');
    const response = makeBundleResponse({
      opId: pending.op_id,
      topic: pending.response_topic,
      endpoint: pending.provider_endpoint,
      replyTarget: pending.reply_target,
      bundlePayload: exportResult.data.payload,
      replyTargetPrincipalKey: principalKey,
    });
    const handled = await registry.handleControlBusPacket(pending.response_topic, response);
    assert.equal(handled, true, 'principal registry must handle bundle response for the addressed user runtime');
    await wait();
    const installedId = labelValue(runtime, 1051, 0, 0, 0, 'last_installed_model_id');
    const installedTableId = labelValue(runtime, 1051, 0, 0, 0, 'last_installed_table_id');
    assert.equal(installedId, 0, 'principal bundle response must preserve package-local root model id');
    assert.ok(
      typeof installedTableId === 'string' && installedTableId.startsWith('app:it0384-principal-bundle:'),
      `principal bundle response must allocate a principal-owned app instance table, got ${installedTableId}`,
    );
    assert.equal(labelValue(runtime, 1051, 0, 0, 0, 'asset_install_pending'), null, 'principal bundle install must clear pending state');
    assert.equal(labelValue(runtime, 1051, 0, 0, 0, 'asset_install_dialog_open'), true, 'principal bundle install must open success dialog');
    assert.equal(labelValueRef(runtime, installedTableId, installedId, 0, 0, 0, 'app_name'), 'E2E 颜色生成器', 'principal bundle install must use provider payload');
    assert.equal(labelValue(runtime, 1051, 0, 0, 0, 'bundle_payload'), undefined, 'principal registry must not materialize raw bundle response labels on workspace manager');
    return { key: 'principal_registry_delegates_bundle_response_to_user_runtime_installer', status: 'PASS' };
  });
}

async function test_two_principals_install_same_provider_app_into_separate_tables() {
  return withServerModule(async ({ createServerState, buildSlideAppExportPayload, createPrincipalRuntimeRegistry }) => {
    const readOnlyState = createServerState({ dbPath: null });
    const registry = createPrincipalRuntimeRegistry({
      readOnlyState,
      createState(principalKey) {
        const state = createServerState({ dbPath: null });
        state.runtime.principalRuntimeKey = principalKey;
        const model0 = state.runtime.getModel(0);
        state.runtime.addLabel(model0, 0, 0, 0, { k: 'principal_runtime_key', t: 'str', v: principalKey });
        state.programEngine.disableControlBusInbound = true;
        return state;
      },
    });

    async function installForSubject(subject, opId) {
      const principal = { subject };
      const principalKey = registry.principalRuntimeKey(principal);
      const entry = registry.resolveMutableRuntime(principal);
      await entry.state.activateRuntimeMode('running');
      const runtime = entry.state.runtime;
      const rows = labelValue(runtime, 1051, 0, 0, 0, 'asset_catalog_json');
      const slide = rows.find((row) => row.id === 'r1-color-generator');
      const requestResult = await entry.state.submitEnvelope({
        type: 'workspace_asset_primary_action',
        payload: {
          action: 'workspace_asset_primary_action',
          value: slide,
          meta: { op_id: opId },
        },
      });
      assert.equal(requestResult.result, 'ok', `install request must be accepted for ${subject}`);
      const pending = labelValue(runtime, 1051, 0, 0, 0, 'asset_install_pending');
      const exportResult = buildSlideAppExportPayload(runtime, 100);
      assert.equal(exportResult.ok, true, `fixture export must succeed for ${subject}`);
      const response = makeBundleResponse({
        opId: pending.op_id,
        topic: pending.response_topic,
        endpoint: pending.provider_endpoint,
        replyTarget: pending.reply_target,
        bundlePayload: exportResult.data.payload,
        replyTargetPrincipalKey: principalKey,
      });
      const handled = await registry.handleControlBusPacket(pending.response_topic, response);
      assert.equal(handled, true, `bundle response must be handled for ${subject}`);
      await wait();
      return {
        runtime,
        tableId: labelValue(runtime, 1051, 0, 0, 0, 'last_installed_table_id'),
        modelId: labelValue(runtime, 1051, 0, 0, 0, 'last_installed_model_id'),
      };
    }

    const first = await installForSubject('it0384-principal-alpha', '0384_principal_alpha_install');
    const second = await installForSubject('it0384-principal-beta', '0384_principal_beta_install');
    assert.notEqual(first.tableId, second.tableId, 'two principals installing the same provider app must receive different app tables');
    assert.ok(first.tableId.startsWith('app:it0384-principal-alpha:'), 'first principal table must be owned by alpha');
    assert.ok(second.tableId.startsWith('app:it0384-principal-beta:'), 'second principal table must be owned by beta');
    assert.equal(first.modelId, 0, 'first principal app root id must remain package-local 0');
    assert.equal(second.modelId, 0, 'second principal app root id must remain package-local 0');
    assert.equal(labelValueRef(first.runtime, first.tableId, 0, 0, 0, 0, 'app_name'), 'E2E 颜色生成器', 'first principal app table must contain provider payload');
    assert.equal(labelValueRef(second.runtime, second.tableId, 0, 0, 0, 0, 'app_name'), 'E2E 颜色生成器', 'second principal app table must contain provider payload');
    return { key: 'two_principals_install_same_provider_app_into_separate_tables', status: 'PASS' };
  });
}

async function test_bundle_payload_exception_is_scoped_to_slide_app_response() {
  return withServerState(async (state) => {
    const targetModelId = 1088;
    const targetModel = state.runtime.createModel({ id: targetModelId, name: 'it0384_scoped_bundle_payload_exception', type: 'test' });
    state.runtime.addLabel(targetModel, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'ReturnTarget' });

    const topLevelBundlePayload = pinPayloadPacket({
      opId: '0384_top_level_bundle_payload_must_reject',
      topic: `UIPUT/ws/dam/pic/de/U1/${targetModelId}/result`,
      responseTopic: `UIPUT/ws/dam/pic/de/U1/${targetModelId}/result`,
      routeKind: 'control',
      endpoint: { worker_id: 'U1', model_id: targetModelId, pin: 'result' },
      origin: { worker_id: 'R1', model_id: 3100, pin: 'bundle_request' },
      replyTarget: { worker_id: 'U1', model_id: targetModelId, pin: 'result' },
      messageRole: 'response',
      payload: [mt('display_text', 'str', 'must_not_materialize_top_bundle_payload')],
    });
    topLevelBundlePayload.payload.push(mt('bundle_payload', 'json', [{ source_model_id: 100 }]));
    const topHandled = await state.programEngine.handleControlBusPacket(`UIPUT/ws/dam/pic/de/U1/${targetModelId}/result`, topLevelBundlePayload);
    assert.equal(topHandled, false, 'top-level bundle_payload with legacy metadata must be rejected');
    assert.equal(labelValue(state.runtime, targetModelId, 0, 0, 0, 'display_text'), undefined, 'top-level legacy bundle_payload must not materialize');

    const nestedPlainBundlePayload = pinPayloadPacket({
      opId: '0384_nested_plain_bundle_payload_must_reject',
      topic: `UIPUT/ws/dam/pic/de/U1/${targetModelId}/result`,
      responseTopic: `UIPUT/ws/dam/pic/de/U1/${targetModelId}/result`,
      routeKind: 'control',
      endpoint: { worker_id: 'U1', model_id: targetModelId, pin: 'result' },
      origin: { worker_id: 'R1', model_id: 3100, pin: 'bundle_request' },
      replyTarget: { worker_id: 'U1', model_id: targetModelId, pin: 'result' },
      messageRole: 'response',
      payload: [
        mt('__mt_payload_kind', 'str', 'not_slide_app_bundle_response.v1'),
        mt('bundle_payload', 'json', [{ pin: 'legacy' }]),
      ],
    });
    const nestedHandled = await state.programEngine.handleControlBusPacket(`UIPUT/ws/dam/pic/de/U1/${targetModelId}/result`, nestedPlainBundlePayload);
    assert.equal(nestedHandled, false, 'non slide-app response bundle_payload with legacy metadata must be rejected');
    assert.equal(labelValue(state.runtime, targetModelId, 0, 0, 0, 'bundle_payload'), undefined, 'non slide-app legacy bundle_payload must not materialize');

    const slideResponseWithLegacyBundleLabel = pinPayloadPacket({
      opId: '0384_slide_response_legacy_bundle_label_must_reject',
      topic: 'UIPUT/ws/dam/pic/de/R1/3100/bundle_request',
      routeKind: 'control',
      endpoint: { worker_id: 'R1', model_id: 3100, pin: 'bundle_request' },
      origin: { worker_id: 'R1', model_id: 3100, pin: 'bundle_request' },
      replyTarget: { worker_id: 'U1', model_id: targetModelId, pin: 'result' },
      messageRole: 'response',
      payload: [
        mt('__mt_payload_kind', 'str', 'slide_app_bundle_response.v1'),
        mt('asset_id', 'str', 'r1-color-generator'),
        mt('bundle_payload', 'json', [
          mt('app_name', 'str', 'must_not_install_legacy_bundle_label'),
          mt('source_model_id', 'int', 100),
        ]),
      ],
    });
    const legacyBundleHandled = await state.programEngine.handleControlBusPacket('UIPUT/ws/dam/pic/de/R1/3100/bundle_request', slideResponseWithLegacyBundleLabel);
    assert.equal(legacyBundleHandled, false, 'slide-app response bundle_payload with legacy ModelTable label key must be rejected');
    assert.equal(labelValue(state.runtime, targetModelId, 0, 0, 0, 'source_model_id'), undefined, 'legacy bundle label key must not materialize');

    return { key: 'bundle_payload_exception_is_scoped_to_slide_app_response', status: 'PASS' };
  });
}

async function test_desktop_management_delete_removes_installed_slide_app() {
  return withServerState(async (state, buildSlideAppExportPayload) => {
    const runtime = state.runtime;
    const rows = labelValue(runtime, 1051, 0, 0, 0, 'asset_catalog_json');
    const slide = rows.find((row) => row.id === 'r1-color-generator');
    const requestResult = await state.submitEnvelope({
      type: 'workspace_asset_primary_action',
      payload: {
        action: 'workspace_asset_primary_action',
        value: slide,
        meta: { op_id: '0384_desktop_delete_install' },
      },
    });
    assert.equal(requestResult.result, 'ok', 'install request must be accepted before desktop delete');
    const pending = labelValue(runtime, 1051, 0, 0, 0, 'asset_install_pending');
    const exportResult = buildSlideAppExportPayload(runtime, 100);
    const goodResponse = makeBundleResponse({
      opId: pending.op_id,
      topic: pending.response_topic,
      endpoint: pending.provider_endpoint,
      replyTarget: pending.reply_target,
      bundlePayload: exportResult.data.payload,
    });
    const handled = await state.programEngine.handleControlBusPacket(pending.response_topic, goodResponse);
    assert.equal(handled, true, 'matched provider bundle response must install fixture app');
    await wait();

    const installedId = labelValue(runtime, 1051, 0, 0, 0, 'last_installed_model_id');
    const installedTableId = labelValue(runtime, 1051, 0, 0, 0, 'last_installed_table_id');
    assert.ok(Number.isInteger(installedId), 'installed model id must be available before deletion');
    assert.ok(typeof installedTableId === 'string' && installedTableId.startsWith('app:local-dev:'), 'installed table id must be available before deletion');
    const installedModel = runtime.getModel({ table_id: installedTableId, model_id: installedId });
    assert.ok(installedModel, 'installed model must exist before deletion');
    assert.ok(runtime.getModel({ table_id: 'host', model_id: installedId }), 'host model with same local id must exist before deletion');
    const installedRootLabels = runtime.getCell(installedModel, 0, 0, 0).labels;
    const generatedIngressModel0Labels = installedRootLabels.get('host_ingress_generated_model0_labels')?.v || [];
    const generatedEgressModel0Labels = installedRootLabels.get('host_egress_generated_model0_labels')?.v || [];
    const generatedIngressMount = installedRootLabels.get('host_ingress_generated_mount')?.v || null;
    const generatedEgressMount = installedRootLabels.get('host_egress_generated_mount')?.v || null;
    const generatedModel0Labels = [...generatedIngressModel0Labels, ...generatedEgressModel0Labels].filter((key) => typeof key === 'string' && key);
    assert.ok(generatedModel0Labels.length > 0, 'installed app table root must record host Model 0 generated labels before deletion');
    const model0 = runtime.getModel(0);
    for (const key of generatedModel0Labels) {
      assert.ok(runtime.getCell(model0, 0, 0, 0).labels.has(key), `host Model 0 generated label must exist before deletion: ${key}`);
    }
    const generatedMountLabels = [];
    for (const mount of [generatedIngressMount, generatedEgressMount]) {
      if (!mount || !Number.isInteger(mount.p) || !Number.isInteger(mount.r) || !Number.isInteger(mount.c)) continue;
      for (const key of Array.isArray(mount.keys) ? mount.keys : []) {
        if (typeof key === 'string' && key) generatedMountLabels.push({ p: mount.p, r: mount.r, c: mount.c, k: key });
      }
    }
    assert.ok(generatedMountLabels.length > 0, 'installed app table root must record host mount generated labels before deletion');
    for (const item of generatedMountLabels) {
      assert.ok(runtime.getCell(model0, item.p, item.r, item.c).labels.has(item.k), `host mount generated label must exist before deletion: ${item.k}`);
    }

    const requestDelete = await state.submitEnvelope({
      type: 'desktop_app_request_delete',
      payload: {
        action: 'desktop_app_request_delete',
        value: { table_id: installedTableId, model_id: installedId, title: 'E2E 颜色生成器' },
        meta: { op_id: '0384_desktop_delete_request' },
      },
    });
    assert.equal(requestDelete.result, 'ok', 'desktop delete request must open confirmation dialog');
    assert.equal(labelValue(runtime, -2, 0, 0, 0, 'desktop_delete_confirm_open'), true, 'delete request must open confirm dialog');
    assert.match(labelValue(runtime, -2, 0, 0, 0, 'desktop_delete_confirm_text'), /E2E 颜色生成器/u, 'confirm dialog must mention selected app');
    assert.deepEqual(
      labelValue(runtime, -2, 0, 0, 0, 'desktop_delete_confirm_target_json'),
      { table_id: installedTableId, model_id: installedId, title: 'E2E 颜色生成器' },
      'confirm dialog must store exact delete target',
    );

    const confirmDelete = await state.submitEnvelope({
      type: 'desktop_app_confirm_delete',
      payload: {
        action: 'desktop_app_confirm_delete',
        meta: { op_id: '0384_desktop_delete_confirm' },
      },
    });
    assert.equal(confirmDelete.result, 'ok', 'desktop confirm delete must succeed');
    assert.equal(runtime.getModel({ table_id: installedTableId, model_id: installedId }), undefined, 'confirmed desktop delete must remove installed app-table model');
    assert.ok(runtime.getModel({ table_id: 'host', model_id: installedId }), 'confirmed desktop delete must not remove host model with the same local id');
    for (const key of generatedModel0Labels) {
      assert.equal(runtime.getCell(model0, 0, 0, 0).labels.has(key), false, `confirmed desktop delete must remove host Model 0 generated label: ${key}`);
    }
    for (const item of generatedMountLabels) {
      assert.equal(runtime.getCell(model0, item.p, item.r, item.c).labels.has(item.k), false, `confirmed desktop delete must remove host mount generated label: ${item.k}`);
    }
    assert.equal(labelValue(runtime, -2, 0, 0, 0, 'desktop_delete_confirm_open'), false, 'confirm dialog must close after deletion');
    assert.equal(labelValue(runtime, -2, 0, 0, 0, 'desktop_delete_result_open'), true, 'delete success dialog must open');
    assert.match(labelValue(runtime, -2, 0, 0, 0, 'desktop_delete_result_text'), /已删除 E2E 颜色生成器/u, 'delete success dialog must tell user the app was deleted');
    const registry = labelValue(runtime, -2, 0, 0, 0, 'ws_apps_registry');
    assert.ok(
      Array.isArray(registry) && !registry.some((entry) => entry?.table_id === installedTableId && entry?.model_id === installedId),
      'desktop registry must refresh after deletion',
    );
    return { key: 'desktop_management_delete_removes_installed_slide_app', status: 'PASS' };
  });
}

const tests = [
  test_install_action_sends_provider_bundle_request_without_materializing,
  test_principal_install_request_preserves_runtime_key_after_model0_label_loss,
  test_provider_bundle_response_materializes_new_workspace_app_and_rejects_mismatches,
  test_provider_installed_submit_app_rewrites_ingress_and_publishes_request,
  test_remote_worker_r1_bundle_provider_patch_returns_modeltable_bundle_response,
  test_remote_worker_r1_bundle_provider_rejects_missing_table_refs,
  test_principal_registry_delegates_bundle_response_to_user_runtime_installer,
  test_two_principals_install_same_provider_app_into_separate_tables,
  test_bundle_payload_exception_is_scoped_to_slide_app_response,
  test_desktop_management_delete_removes_installed_slide_app,
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
