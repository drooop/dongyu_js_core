#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZipPkg from 'adm-zip';

const AdmZip = AdmZipPkg && AdmZipPkg.default ? AdmZipPkg.default : AdmZipPkg;
const PROVIDER_MODEL_ID = 3000;
const PROVIDER_PATCH = 'deploy/sys-v1ns/remote-worker/patches/13_model3000_minimal_submit.json';
const GUIDE_DOC = 'docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md';
const VISUAL_DOC = 'docs/user-guide/slide-app-runtime/minimal_submit_app_provider_visualized.md';
const INTERACTIVE_DOC = 'docs/user-guide/slide-app-runtime/minimal_submit_app_provider_interactive.html';

function readJson(path) {
  return JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'));
}

function readText(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

function findRecord(records, predicate) {
  return records.find((record) => record && predicate(record)) || null;
}

function mt(k, t, v) {
  return { id: 0, p: 0, r: 0, c: 0, k, t, v };
}

function payloadValue(records, key) {
  return Array.isArray(records) ? records.find((record) => record && record.k === key)?.v : undefined;
}

function pinPayloadPacket({ opId, endpoint, origin, replyTarget, payload, messageRole = 'request', topic = null, responseTopic = null, routeKind = 'control' }) {
  const actualTopic = topic || `UIPUT/ws/dam/pic/de/${endpoint.worker_id}/${endpoint.model_id}/${endpoint.pin}`;
  const actualResponseTopic = responseTopic || `UIPUT/ws/dam/pic/de/${replyTarget.worker_id}/${replyTarget.model_id}/${replyTarget.pin}`;
  return {
    version: 'v1',
    type: 'pin_payload',
    payload: [
      mt('__mt_payload_kind', 'str', 'pin_payload.v1'),
      mt('__mt_request_id', 'str', opId),
      mt('op_id', 'str', opId),
      mt('message_role', 'str', messageRole),
      mt('topic', 'str', actualTopic),
      mt('response_topic', 'str', actualResponseTopic),
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
      mt('timestamp', 'int', Date.now()),
    ],
  };
}

function recordsFor(path) {
  return readJson(path).records || [];
}

function assertNoLegacyRouteSurface(text, label) {
  assert.equal(text.includes('pin.connect.model'), false, `${label} must not use pin.connect.model`);
  assert.equal(/ctx\.(writeLabel|getLabel|rmLabel)/u.test(text), false, `${label} must not use legacy ctx label APIs`);
  assert.equal(text.includes('mbr_route_'), false, `${label} must not use mbr_route_*`);
  assert.equal(text.includes('/1050/'), false, `${label} must not use old 1050 topics`);
}

function wait(ms = 350) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildZipBuffer(payload) {
  const zip = new AdmZip();
  zip.addFile('app_payload.json', Buffer.from(JSON.stringify(payload, null, 2), 'utf8'));
  return zip.toBuffer();
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0359-minimal-route-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.DY_UI_SERVER_WORKER_ID = 'ui-server-0359';
  process.env.WORKER_BASE_WORKSPACE = `it0359_minimal_route_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null });
  try {
    await state.activateRuntimeMode('running');
    return await fn(state);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.WORKER_BASE_WORKSPACE;
    delete process.env.WORKER_BASE_DATA_ROOT;
    delete process.env.DOCS_ROOT;
    delete process.env.STATIC_PROJECTS_ROOT;
    delete process.env.DY_PERSISTED_ASSET_ROOT;
    delete process.env.DY_UI_SERVER_WORKER_ID;
  }
}

function test_model0_mbr_remote_worker_contracts_use_route_metadata() {
  const systemRecords = recordsFor('packages/worker-base/system-models/system_models.json');
  const mbrRecords = recordsFor('deploy/sys-v1ns/mbr/patches/mbr_role_v0.json');
  const remoteConfigRecords = recordsFor('deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json');
  const systemText = JSON.stringify(systemRecords);
  const mbrText = JSON.stringify(mbrRecords);
  assert.equal(systemText.includes('mbr_route_'), false, 'system seed must not contain static mbr_route labels');
  assert.equal(mbrText.includes('mbr_route_'), false, 'MBR role must not contain static mbr_route lookup');
  assert.equal(mbrText.includes('mbr_mqtt_model_ids'), false, 'MBR role must not contain static model id subscription list');
  const subscriptions = findRecord(remoteConfigRecords, (record) => record.k === 'remote_subscriptions')?.v || [];
  assert.ok(subscriptions.includes('UIPUT/ws/dam/pic/de/R1/3000/submit1'), 'remote-worker must subscribe provider submit1 endpoint topic');
  assert.equal(subscriptions.some((topic) => String(topic).includes('/1050/')), false, 'remote-worker must not subscribe old 1050 topics');
  assert.equal(readText('scripts/run_worker_v0.mjs').includes('/worker/+/model/+/pin/+'), false, 'MBR runner must not subscribe legacy worker/model/pin wildcard');
  assert.equal(readText('scripts/run_worker_v0.mjs').includes('${base}/+/+/+'), true, 'MBR runner must subscribe unified endpoint wildcard');
  return { key: 'model0_mbr_remote_worker_contracts_use_route_metadata', status: 'PASS' };
}

function test_remote_worker_provider_patch_returns_reply_to_result() {
  assert.ok(existsSync(new URL(`../../${PROVIDER_PATCH}`, import.meta.url)), 'remote-worker model 3000 patch must exist');
  const records = recordsFor(PROVIDER_PATCH);
  assert.ok(findRecord(records, (record) => record.op === 'create_model' && record.model_id === PROVIDER_MODEL_ID), 'remote worker must create provider model 3000');
  assert.equal(findRecord(records, (record) => record.model_id === PROVIDER_MODEL_ID && record.k === 'submit1')?.t, 'pin.in', 'remote submit1 pin must be pin.in');
  assert.equal(findRecord(records, (record) => record.model_id === PROVIDER_MODEL_ID && record.k === 'result')?.t, 'pin.out', 'remote result pin must be pin.out');
  assert.equal(findRecord(records, (record) => record.model_id === PROVIDER_MODEL_ID && record.k === 'result_out_topic'), null, 'remote provider must not use static result_out_topic');
  assert.deepEqual(
    findRecord(records, (record) => record.model_id === PROVIDER_MODEL_ID && record.k === 'submit1_route')?.v,
    [
      { from: [0, 0, 0, 'submit1'], to: [[1, 1, 1, 'submit1_in']] },
      { from: [1, 1, 1, 'submit1_out'], to: [[0, 0, 0, 'result']] },
    ],
    'remote provider must route root submit1 to program cell and result back to root',
  );
  const func = findRecord(records, (record) => record.model_id === PROVIDER_MODEL_ID && record.p === 1 && record.r === 1 && record.c === 1 && record.k === 'submit1');
  assert.equal(func?.t, 'func.js', 'remote submit1 handler must be func.js');
  const code = func?.v?.code || '';
  assert.match(code, /Submitted: /u, 'remote handler must build Submitted display text');
  assert.match(code, /replyTarget/u, 'remote handler must read reply_target records');
  assert.equal(code.includes('ctx.publishMqtt'), false, 'remote handler must not publish MQTT directly');
  assert.equal(code.includes("pin_payload.v1"), true, 'remote handler must return ModelTable-shaped pin_payload');
  assert.equal(code.includes("mt('message_role', 'str', 'response')"), true, 'remote result must mark message_role=response');
  assert.equal(code.includes("mt('endpoint_model_id', 'int', replyTarget.model_id)"), true, 'remote result endpoint must match reply_target model id');
  assert.equal(code.includes("mt('response_topic', 'str', responseTopic)"), true, 'remote result must publish on response_topic');
  assert.equal(code.includes("mt('reply_target_model_id', 'int', replyTarget.model_id)"), true, 'remote result must carry reply_target model id in payload records');
  const remoteConfigRecords = recordsFor('deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json');
  assert.equal(
    findRecord(remoteConfigRecords, (record) => record.model_id === 0 && record.k === 'remote_result_bus')?.t,
    'pin.bus.cb.out',
    'remote worker Model 0 must expose control-bus result out pin',
  );
  assert.ok(
    findRecord(remoteConfigRecords, (record) => record.model_id === 0 && record.k === 'remote_result_routes')?.v
      ?.some((route) => JSON.stringify(route.from) === JSON.stringify([1, 0, 30, 'result'])),
    'remote worker Model 0 must route hosted model 3000 result to control-bus out pin',
  );
  assert.equal(code.includes('V1N.table'), false, 'non-root program cell must not use V1N.table');
  assertNoLegacyRouteSurface(code, 'remote submit handler');
  return { key: 'remote_worker_provider_patch_returns_reply_to_result', status: 'PASS' };
}

function test_docs_describe_real_matrix_roundtrip() {
  const guide = readText(GUIDE_DOC);
  const visual = readText(VISUAL_DOC);
  const html = readText(INTERACTIVE_DOC);
  for (const [label, text] of [['guide', guide], ['visual', visual], ['html', html]]) {
    assert.equal(text.includes('UIPUT/ws/dam/pic/de/R1/3000/submit1'), true, `${label} must document provider submit topic`);
    assert.equal(text.includes('reply_target_worker_id'), true, `${label} must document reply target records`);
    assert.equal(text.includes('endpoint_worker_id'), true, `${label} must document endpoint records`);
    assert.equal(text.includes('origin_worker_id'), true, `${label} must document origin records`);
    assert.match(text, /Submitted: <输入内容>|Submitted: &lt;输入内容&gt;/u, `${label} must document visible result`);
    assert.equal(text.includes('/1050/'), false, `${label} must not use old 1050 topics`);
    assert.equal(text.includes('mbr_route_'), false, `${label} must not use mbr_route_*`);
  }
  assert.equal(guide.includes('UI click -> Model 0 control bus -> MBR -> remote provider public pin -> response_topic -> reply_target records -> ui-server -> local UI model'), true);
  return { key: 'docs_describe_real_matrix_roundtrip', status: 'PASS' };
}

async function test_imported_zip_roundtrip_materializes_matrix_result_to_ui_model() {
  return withServerState(async (state) => {
    const payload = readJson('test_files/minimal_submit_dual_bus_app_payload.json');
    state.cacheUploadedMediaForTest('mxc://localhost/0359-minimal-route', {
      buffer: buildZipBuffer(payload),
      contentType: 'application/zip',
      filename: 'minimal_submit_dual_bus.zip',
      userId: '@manual:localhost',
    });
    const importResult = state.runtime.hostApi.slideImportAppFromMxc('mxc://localhost/0359-minimal-route');
    assert.equal(importResult.ok, true, 'minimal submit zip must import');
    const modelId = importResult.data?.model_id;
    state.programEngine.matrixRoomId = '!test-room:localhost';
    state.programEngine.matrixDmPeerUserId = '@mbr:localhost';
    state.runtime.addLabel(state.runtime.getModel(modelId), 0, 0, 0, {
      k: 'submit1',
      t: 'pin.out',
      v: [
        { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.single', v: 'Data.MinimalSubmit' },
        { id: 0, p: 0, r: 0, c: 0, k: 'text', t: 'str', v: 'hello matrix e2e' },
      ],
    });
    await state.programEngine.tick();
    const model0Labels = state.runtime.getCell(state.runtime.getModel(0), 0, 0, 0).labels;
    const busLabel = Array.from(model0Labels.values()).find((label) => label?.t === 'pin.bus.cb.out'
      && payloadValue(label.v, 'topic') === 'UIPUT/ws/dam/pic/de/R1/3000/submit1'
      && payloadValue(label.v, 'message_role') === 'request');
    assert.ok(busLabel, 'server must emit one control-bus pin_payload request');
    const requestRecords = busLabel.v;
    const responseTopic = payloadValue(requestRecords, 'response_topic');
    assert.equal(responseTopic, `UIPUT/ws/dam/pic/de/ui-server-0359/${modelId}/result`, 'request must include distinct response_topic');
    const replyTarget = {
      worker_id: payloadValue(requestRecords, 'reply_target_worker_id'),
      model_id: payloadValue(requestRecords, 'reply_target_model_id'),
      pin: payloadValue(requestRecords, 'reply_target_pin'),
    };
    const handled = await state.programEngine.handleControlBusPacket(responseTopic, pinPayloadPacket({
      opId: `result_${payloadValue(requestRecords, 'op_id')}`,
      messageRole: 'response',
      topic: responseTopic,
      responseTopic,
      endpoint: replyTarget,
      origin: { worker_id: 'R1', model_id: 3000, pin: 'submit1' },
      replyTarget,
      payload: [
        mt('display_text', 'str', 'Submitted: hello matrix e2e'),
        mt('remote_status', 'str', 'remote_processed'),
        mt('submit_inflight', 'bool', false),
      ],
    }));
    assert.equal(handled, true, 'control-bus response must be accepted');
    await wait(900);
    const root = state.clientSnap().models[String(modelId)]?.cells?.['0,0,0']?.labels || {};
    assert.equal(payloadValue(requestRecords, 'origin_model_id'), modelId, 'published packet origin model must be local installed model');
    assert.equal(payloadValue(requestRecords, 'origin_pin'), 'submit1', 'published packet origin pin must be public provider pin');
    assert.equal(payloadValue(requestRecords, 'endpoint_worker_id'), 'R1', 'published packet endpoint worker');
    assert.equal(payloadValue(requestRecords, 'endpoint_model_id'), 3000, 'published packet endpoint provider model');
    assert.equal(payloadValue(requestRecords, 'reply_target_worker_id'), 'ui-server-0359', 'published packet reply_target worker must be server-owned');
    assert.equal(payloadValue(requestRecords, 'reply_target_model_id'), modelId, 'published packet reply_target model must be local installed model');
    assert.equal(root.display_text?.v, 'Submitted: hello matrix e2e', 'Matrix result must materialize into the imported UI model label');
    return { key: 'imported_zip_roundtrip_materializes_matrix_result_to_ui_model', status: 'PASS' };
  });
}

async function test_imported_zip_rejects_result_route_to_mismatch() {
  return withServerState(async (state) => {
    const payload = readJson('test_files/minimal_submit_dual_bus_app_payload.json');
    state.cacheUploadedMediaForTest('mxc://localhost/0359-minimal-route-mismatch', {
      buffer: buildZipBuffer(payload),
      contentType: 'application/zip',
      filename: 'minimal_submit_dual_bus.zip',
      userId: '@manual:localhost',
    });
    const importResult = state.runtime.hostApi.slideImportAppFromMxc('mxc://localhost/0359-minimal-route-mismatch');
    assert.equal(importResult.ok, true, 'minimal submit zip must import');
    const modelId = importResult.data?.model_id;
    state.programEngine.handleDyBusEvent(pinPayloadPacket({
      opId: 'result_route_mismatch',
      messageRole: 'response',
      endpoint: { worker_id: 'R1', model_id: 3000, pin: 'submit1' },
      origin: { worker_id: 'R1', model_id: 3000, pin: 'submit1' },
      replyTarget: { worker_id: 'other-ui-server', model_id: modelId, pin: 'result' },
      payload: [mt('display_text', 'str', 'Submitted: should not apply')],
    }));
    await wait(450);
    const root = state.clientSnap().models[String(modelId)]?.cells?.['0,0,0']?.labels || {};
    assert.notEqual(root.display_text?.v, 'Submitted: should not apply', 'route.to mismatch must not materialize into the local UI model');
    return { key: 'imported_zip_rejects_result_route_to_mismatch', status: 'PASS' };
  });
}

const tests = [
  test_model0_mbr_remote_worker_contracts_use_route_metadata,
  test_remote_worker_provider_patch_returns_reply_to_result,
  test_docs_describe_real_matrix_roundtrip,
  test_imported_zip_roundtrip_materializes_matrix_result_to_ui_model,
  test_imported_zip_rejects_result_route_to_mismatch,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    const result = await test();
    console.log(`[${result.status}] ${result.key}`);
    passed += 1;
  } catch (error) {
    console.log(`[FAIL] ${test.name}: ${error && error.stack ? error.stack : error}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
