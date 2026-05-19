#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadSystemPatch } from '../worker_engine_v0.mjs';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

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

function pinPayloadPacket({ opId, topic, routeKind, endpoint, origin, replyTarget, payload, messageRole = 'response' }) {
  return externalPacket([
    mt('__mt_payload_kind', 'str', 'pin_payload.v1'),
    mt('__mt_request_id', 'str', opId),
    mt('op_id', 'str', opId),
    mt('message_role', 'str', messageRole),
    mt('topic', 'str', topic),
    mt('route_kind', 'str', routeKind),
    mt('bus', 'str', routeKind),
    mt('endpoint_worker_id', 'str', endpoint.worker_id),
    mt('endpoint_model_id', 'int', endpoint.model_id),
    mt('endpoint_pin', 'str', endpoint.pin),
    mt('origin_worker_id', 'str', origin.worker_id),
    mt('origin_model_id', 'int', origin.model_id),
    mt('origin_pin', 'str', origin.pin),
    mt('reply_target_worker_id', 'str', replyTarget.worker_id),
    mt('reply_target_model_id', 'int', replyTarget.model_id),
    mt('reply_target_pin', 'str', replyTarget.pin),
    mt('payload', 'json', payload),
    mt('timestamp', 'int', 1700000000000),
  ]);
}

function labelValue(runtime, modelId, p, r, c, key) {
  const model = runtime.getModel(modelId);
  assert.ok(model, `missing model ${modelId}`);
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

function remoteBundleRequestPacket(assetId = 'r1-color-generator') {
  return pinPayloadPacket({
    opId: `0384_bundle_request_${assetId}`,
    topic: 'UIPUT/ws/dam/pic/de/sw/R1/3100/bundle_request',
    routeKind: 'control',
    endpoint: { worker_id: 'R1', model_id: 3100, pin: 'bundle_request' },
    origin: { worker_id: 'U1', model_id: 1051, pin: 'workspace_asset_install' },
    replyTarget: { worker_id: 'U1', model_id: 1051, pin: 'result' },
    messageRole: 'request',
    payload: [
      mt('__mt_payload_kind', 'str', 'slide_app_bundle_request.v1'),
      mt('asset_id', 'str', assetId),
      mt('requested_version', 'str', 'current'),
    ],
  });
}

function makeBundleResponse({ opId, topic, endpoint, replyTarget, bundlePayload, assetId = 'r1-color-generator', routeKind = 'control' }) {
  return pinPayloadPacket({
    opId,
    topic,
    routeKind,
    endpoint,
    origin: { worker_id: endpoint.worker_id, model_id: endpoint.model_id, pin: endpoint.pin },
    replyTarget,
    messageRole: 'response',
    payload: [
      mt('__mt_payload_kind', 'str', 'slide_app_bundle_response.v1'),
      mt('asset_id', 'str', assetId),
      mt('bundle_payload', 'json', bundlePayload),
      mt('bundle_sha256', 'str', ''),
    ],
  });
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
    assert.equal(result.topic, 'UIPUT/ws/dam/pic/de/sw/R1/3100/bundle_request', 'install request must use computed provider topic');
    const afterMax = Math.max(...Array.from(runtime.models.keys()).filter((id) => Number.isInteger(id) && id > 0));
    assert.equal(afterMax, beforeMax, 'request phase must not create a local model');
    const pending = labelValue(runtime, 1051, 0, 0, 0, 'asset_install_pending');
    assert.equal(pending?.asset_id, 'r1-color-generator', 'pending install state must record asset_id');
    assert.equal(pending?.topic, 'UIPUT/ws/dam/pic/de/sw/R1/3100/bundle_request', 'pending install state must record computed topic');
    assert.deepEqual(pending?.provider_endpoint, { worker_id: 'R1', model_id: 3100, pin: 'bundle_request' }, 'pending install state must record provider endpoint');
    const busLabel = runtime.getCell(runtime.getModel(0), 0, 0, 0).labels.get('workspace_asset_bundle_request_bus');
    assert.equal(busLabel?.t, 'pin.bus.cb.out', 'install request must leave through Model 0 control bus out');
    assert.equal(payloadString(busLabel?.v, '__mt_payload_kind'), 'pin_payload.v1', 'request bus payload must be pin_payload.v1');
    assert.equal(payloadString(busLabel?.v, 'message_role'), 'request', 'request bus payload must mark message_role=request');
    assert.equal(payloadString(busLabel?.v, 'topic'), 'UIPUT/ws/dam/pic/de/sw/R1/3100/bundle_request', 'request bus payload must carry provider topic');
    const nested = payloadJson(busLabel?.v, 'payload');
    assert.equal(payloadString(nested, '__mt_payload_kind'), 'slide_app_bundle_request.v1', 'nested payload must be slide app bundle request');
    assert.equal(payloadString(nested, 'asset_id'), 'r1-color-generator', 'nested payload must carry selected asset_id');
    return { key: 'install_action_sends_provider_bundle_request_without_materializing', status: 'PASS' };
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
          topic: pending.topic,
          endpoint: pending.provider_endpoint,
          replyTarget: pending.reply_target,
          assetId: 'wrong-asset',
          bundlePayload: exportResult.data.payload,
        }),
        topic: pending.topic,
      },
      {
        name: 'op_id',
        packet: makeBundleResponse({
          opId: `${pending.op_id}_wrong`,
          topic: pending.topic,
          endpoint: pending.provider_endpoint,
          replyTarget: pending.reply_target,
          bundlePayload: exportResult.data.payload,
        }),
        topic: pending.topic,
      },
      {
        name: 'topic',
        packet: makeBundleResponse({
          opId: pending.op_id,
          topic: 'UIPUT/ws/dam/pic/de/sw/R1/3100/wrong_bundle_request',
          endpoint: pending.provider_endpoint,
          replyTarget: pending.reply_target,
          bundlePayload: exportResult.data.payload,
        }),
        topic: pending.topic,
      },
      {
        name: 'route_kind',
        packet: makeBundleResponse({
          opId: pending.op_id,
          topic: pending.topic,
          routeKind: 'management',
          endpoint: pending.provider_endpoint,
          replyTarget: pending.reply_target,
          bundlePayload: exportResult.data.payload,
        }),
        topic: pending.topic,
      },
      {
        name: 'endpoint',
        packet: makeBundleResponse({
          opId: pending.op_id,
          topic: pending.topic,
          endpoint: { ...pending.provider_endpoint, model_id: 3101 },
          replyTarget: pending.reply_target,
          bundlePayload: exportResult.data.payload,
        }),
        topic: pending.topic,
      },
      {
        name: 'reply_target',
        packet: makeBundleResponse({
          opId: pending.op_id,
          topic: pending.topic,
          endpoint: pending.provider_endpoint,
          replyTarget: { ...pending.reply_target, model_id: 1052 },
          bundlePayload: exportResult.data.payload,
        }),
        topic: pending.topic,
      },
    ];
    for (const mismatch of mismatches) {
      const wrongHandled = await state.programEngine.handleControlBusPacket(mismatch.topic, mismatch.packet);
      assert.equal(wrongHandled, false, `mismatched ${mismatch.name} response must be rejected`);
      assert.equal(Math.max(...Array.from(runtime.models.keys()).filter((id) => Number.isInteger(id) && id > 0)), beforeMax, `mismatched ${mismatch.name} response must not create a model`);
    }

    const goodResponse = makeBundleResponse({
      opId: pending.op_id,
      topic: pending.topic,
      endpoint: pending.provider_endpoint,
      replyTarget: pending.reply_target,
      bundlePayload: exportResult.data.payload,
    });
    const handled = await state.programEngine.handleControlBusPacket(pending.topic, goodResponse);
    assert.equal(handled, true, 'matched provider bundle response must be handled');
    await wait();
    const installedId = labelValue(runtime, 1051, 0, 0, 0, 'last_installed_model_id');
    assert.ok(Number.isInteger(installedId) && installedId > beforeMax, 'provider response must materialize a new app model');
    assert.equal(labelValue(runtime, installedId, 0, 0, 0, 'app_name'), 'E2E 颜色生成器', 'installed app must use provider bundle payload');
    assert.equal(labelValue(runtime, 1051, 0, 0, 0, 'asset_install_pending'), null, 'successful install must clear pending install state');
    assert.match(labelValue(runtime, 1051, 0, 0, 0, 'asset_install_status'), /installed E2E 颜色生成器 as model/u, 'successful install must write visible status');
    return { key: 'provider_bundle_response_materializes_new_workspace_app_and_rejects_mismatches', status: 'PASS' };
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
    assert.ok(Array.isArray(subs) && subs.includes('UIPUT/ws/dam/pic/de/sw/R1/3100/bundle_request'), 'R1 must subscribe to provider bundle endpoint');
    const handled = rt.mqttIncoming('UIPUT/ws/dam/pic/de/sw/R1/3100/bundle_request', remoteBundleRequestPacket(assetId));
    assert.equal(handled, true, `R1 runtime must accept provider bundle request topic for ${assetId}`);
    await wait(120);
    const response = rt.getCell(rt.getModel(0), 0, 0, 0).labels.get('remote_result_bus')?.v;
    assert.equal(payloadString(response, '__mt_payload_kind'), 'pin_payload.v1', 'provider response must be strict pin_payload.v1');
    assert.equal(payloadString(response, 'message_role'), 'response', 'provider response must use message_role=response');
    assert.equal(payloadInt(response, 'origin_model_id'), 3100, 'provider response must originate from model 3100');
    const nested = payloadJson(response, 'payload');
    assert.equal(payloadString(nested, '__mt_payload_kind'), 'slide_app_bundle_response.v1', 'provider nested payload must be bundle response');
    assert.equal(payloadString(nested, 'asset_id'), assetId, 'provider response must preserve catalog asset_id');
    const bundlePayload = payloadJson(nested, 'bundle_payload');
    assert.ok(Array.isArray(bundlePayload) && bundlePayload.some((record) => record.k === 'app_name' && record.v === appName), `provider response must include ${appName} ModelTable bundle payload`);
  }
  return { key: 'remote_worker_r1_bundle_provider_patch_returns_modeltable_bundle_response', status: 'PASS' };
}

async function test_bundle_payload_exception_is_scoped_to_slide_app_response() {
  return withServerState(async (state) => {
    const targetModelId = 1088;
    const targetModel = state.runtime.createModel({ id: targetModelId, name: 'it0384_scoped_bundle_payload_exception', type: 'test' });
    state.runtime.addLabel(targetModel, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'ReturnTarget' });

    const topLevelBundlePayload = pinPayloadPacket({
      opId: '0384_top_level_bundle_payload_must_reject',
      topic: 'UIPUT/ws/dam/pic/de/sw/R1/3100/bundle_request',
      routeKind: 'control',
      endpoint: { worker_id: 'R1', model_id: 3100, pin: 'bundle_request' },
      origin: { worker_id: 'R1', model_id: 3100, pin: 'bundle_request' },
      replyTarget: { worker_id: 'U1', model_id: targetModelId, pin: 'result' },
      messageRole: 'response',
      payload: [mt('display_text', 'str', 'must_not_materialize_top_bundle_payload')],
    });
    topLevelBundlePayload.payload.push(mt('bundle_payload', 'json', [{ source_model_id: 100 }]));
    const topHandled = await state.programEngine.handleControlBusPacket('UIPUT/ws/dam/pic/de/sw/R1/3100/bundle_request', topLevelBundlePayload);
    assert.equal(topHandled, false, 'top-level bundle_payload with legacy metadata must be rejected');
    assert.equal(labelValue(state.runtime, targetModelId, 0, 0, 0, 'display_text'), undefined, 'top-level legacy bundle_payload must not materialize');

    const nestedPlainBundlePayload = pinPayloadPacket({
      opId: '0384_nested_plain_bundle_payload_must_reject',
      topic: 'UIPUT/ws/dam/pic/de/sw/R1/3100/bundle_request',
      routeKind: 'control',
      endpoint: { worker_id: 'R1', model_id: 3100, pin: 'bundle_request' },
      origin: { worker_id: 'R1', model_id: 3100, pin: 'bundle_request' },
      replyTarget: { worker_id: 'U1', model_id: targetModelId, pin: 'result' },
      messageRole: 'response',
      payload: [
        mt('__mt_payload_kind', 'str', 'not_slide_app_bundle_response.v1'),
        mt('bundle_payload', 'json', [{ pin: 'legacy' }]),
      ],
    });
    const nestedHandled = await state.programEngine.handleControlBusPacket('UIPUT/ws/dam/pic/de/sw/R1/3100/bundle_request', nestedPlainBundlePayload);
    assert.equal(nestedHandled, false, 'non slide-app response bundle_payload with legacy metadata must be rejected');
    assert.equal(labelValue(state.runtime, targetModelId, 0, 0, 0, 'bundle_payload'), undefined, 'non slide-app legacy bundle_payload must not materialize');

    return { key: 'bundle_payload_exception_is_scoped_to_slide_app_response', status: 'PASS' };
  });
}

const tests = [
  test_install_action_sends_provider_bundle_request_without_materializing,
  test_provider_bundle_response_materializes_new_workspace_app_and_rejects_mismatches,
  test_remote_worker_r1_bundle_provider_patch_returns_modeltable_bundle_response,
  test_bundle_payload_exception_is_scoped_to_slide_app_response,
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
