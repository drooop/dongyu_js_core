#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZipPkg from 'adm-zip';

const AdmZip = AdmZipPkg && AdmZipPkg.default ? AdmZipPkg.default : AdmZipPkg;
const repoRoot = new URL('../..', import.meta.url).pathname;
const payloadPath = join(repoRoot, 'test_files', 'todo_save_mqtt_event_app_payload.json');
const basicGuidePath = join(repoRoot, 'docs', 'user-guide', 'ui_model_basic_filltable_guide.md');
const guidePath = join(repoRoot, 'docs', 'user-guide', 'slide-app-runtime', 'todo_save_mqtt_event_example.md');
const responseGuidePath = join(repoRoot, 'docs', 'user-guide', 'slide-app-runtime', 'mqtt_response_to_ui_materialization.md');
const runtimeReadmePath = join(repoRoot, 'docs', 'user-guide', 'slide-app-runtime', 'README.md');

function wait(ms = 180) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

function readPayload() {
  return JSON.parse(readFileSync(payloadPath, 'utf8'));
}

function buildZipBuffer(payload) {
  const zip = new AdmZip();
  zip.addFile('app_payload.json', Buffer.from(JSON.stringify(payload, null, 2), 'utf8'));
  return zip.toBuffer();
}

function writeLabelPayload(targetCell, targetLabel, targetType, value, requestId = `req_${Date.now()}`) {
  return [
    { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'write_label.v1' },
    { id: 0, p: 0, r: 0, c: 0, k: '__mt_request_id', t: 'str', v: requestId },
    { id: 0, p: 0, r: 0, c: 0, k: '__mt_from_cell', t: 'json', v: { p: 0, r: 0, c: 0 } },
    { id: 0, p: 0, r: 0, c: 0, k: '__mt_target_cell', t: 'json', v: targetCell },
    { id: 0, p: 0, r: 0, c: 0, k: targetLabel, t: targetType, v: value },
  ];
}

function uiEventPayload(labels = []) {
  return [
    { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'ui_event.v1' },
    ...labels.map((label) => ({ id: 0, p: 0, r: 0, c: 0, ...label })),
  ];
}

function slideImportClickBusEvent() {
  const value = uiEventPayload([
    { k: 'target', t: 'json', v: { model_id: 1031, p: 0, r: 0, c: 0 } },
  ]);
  return {
    type: 'bus_event_v2',
    bus_in_key: 'slide_import_click',
    value: writeLabelPayload({ p: 2, r: 4, c: 0 }, 'click', 'pin.in', value, `slide_import_click_${Date.now()}`),
    meta: { op_id: `slide_import_click_${Date.now()}`, source: 'test_0409' },
  };
}

function busEventV2Envelope(busInKey, value, opId = `it0409_${Date.now()}`) {
  return {
    type: 'bus_event_v2',
    bus_in_key: busInKey,
    value,
    meta: { op_id: opId },
  };
}

function payloadRecord(records, key) {
  return Array.isArray(records) ? records.find((record) => record && record.k === key) || null : null;
}

function payloadString(records, key) {
  const record = payloadRecord(records, key);
  return record && record.t === 'str' ? record.v : undefined;
}

function payloadInt(records, key) {
  const record = payloadRecord(records, key);
  return record && record.t === 'int' ? record.v : undefined;
}

function payloadJson(records, key) {
  const record = payloadRecord(records, key);
  return record && record.t === 'json' ? record.v : undefined;
}

function assertPortablePayloadShape() {
  const payload = readPayload();
  assert.equal(Array.isArray(payload), true, 'todo_save_mqtt_payload_must_be_array');
  assert.equal(payload.length > 0, true, 'todo_save_mqtt_payload_must_not_be_empty');
  const text = JSON.stringify(payload);
  const recordsWithModelId = payload
    .filter((record) => JSON.stringify(record?.v ?? null).includes('"model_id"'))
    .map((record) => record.k);
  assert.deepEqual(recordsWithModelId, ['remote_bus_endpoint_v1'], 'only_remote_endpoint_may_name_a_model_id');
  assert.equal(text.includes('"pin.bus.cb.out"'), false, 'provider_payload_must_not_declare_bus_pin_directly');
  assert.equal(text.includes('"pin.bus.mb.out"'), false, 'provider_payload_must_not_declare_management_bus_pin_directly');
  assert.equal(text.includes('bus_event_submit_0_0_0_0'), true, 'button_must_use_import_remappable_submit_key');
  assert.equal(text.includes('"bus_in_key":"submit_request"'), false, 'payload_must_not_use_internal_submit_request_as_bus_key');
  assert.equal(payload.some((record) => record.k === 'host_ingress_v1'), true, 'payload_must_declare_host_ingress');
  assert.equal(payload.some((record) => record.k === 'remote_bus_endpoint_v1'), true, 'payload_must_declare_remote_endpoint');
  assert.equal(payload.some((record) => record.k === 'dual_bus_model'), true, 'payload_must_declare_dual_bus_model');
  assert.equal(payload.some((record) => record.k === 'submit1' && record.t === 'pin.out'), true, 'payload_must_declare_public_submit1_out');
}

function assertDocsTeachCurrentMqttEgressPath() {
  const basicGuide = readFileSync(basicGuidePath, 'utf8');
  const guide = readFileSync(guidePath, 'utf8');
  const responseGuide = readFileSync(responseGuidePath, 'utf8');
  const runtimeReadme = readFileSync(runtimeReadmePath, 'utf8');
  assert.match(basicGuide, /`bus_event_submit_0_0_0_0`/u, 'basic_guide_must_teach_import_remappable_submit_key');
  assert.doesNotMatch(basicGuide, /"bus_in_key": "submit_request"/u, 'basic_guide_must_not_teach_internal_submit_request_bus_key');
  assert.match(guide, /test_files\/todo_save_mqtt_event_app_payload\.json/u, 'todo_mqtt_guide_must_reference_complete_payload');
  assert.match(guide, /`submit_request` 是 App 内部 pin/u, 'todo_mqtt_guide_must_explain_internal_pin_boundary');
  assert.match(guide, /UIPUT\/ws\/dam\/pic\/de\/R1\/3000\/submit1/u, 'todo_mqtt_guide_must_name_generated_request_topic');
  assert.match(guide, /只改按钮 `ui_bind_json`.*不够/u, 'todo_mqtt_guide_must_warn_button_only_is_insufficient');
  assert.match(runtimeReadme, /mqtt_response_to_ui_materialization\.md/u, 'runtime_readme_must_link_response_materialization_guide');
  assert.match(responseGuide, /回包仍然是 `pin_payload\.v1`/u, 'response_guide_must_keep_pin_payload_v1_contract');
  assert.match(responseGuide, /`message_role`\s*\|\s*必须是 `response`/u, 'response_guide_must_require_response_role');
  assert.match(responseGuide, /`topic`\s*\|\s*必须等于 request 中的 `response_topic`/u, 'response_guide_must_require_response_topic');
  assert.match(responseGuide, /`payload`\s*\|\s*要写回界面的 labels，仍是 ModelTable records array/u, 'response_guide_must_require_nested_modeltable_payload');
  assert.match(responseGuide, /`payload` record 的 `v` 也是 ModelTable records array/u, 'response_guide_must_require_payload_record_v_modeltable_records');
  assert.match(responseGuide, /`reply_target_model_id`/u, 'response_guide_must_explain_reply_target_model_id');
  assert.match(responseGuide, /只按 `reply_target_model_id` 找到本地已安装 App/u, 'response_guide_must_teach_reply_target_materialization');
  assert.match(responseGuide, /界面组件不需要订阅 MQTT/u, 'response_guide_must_forbid_ui_mqtt_subscription');
  assert.match(responseGuide, /UI 组件读取更新后的 labels/u, 'response_guide_must_teach_ui_reads_materialized_labels');
  assert.match(responseGuide, /UI 组件直接订阅 MQTT\s*\|\s*绕过 ModelTable/u, 'response_guide_must_warn_against_direct_ui_mqtt');
  assert.match(responseGuide, /remote-worker 直接写 UI label\s*\|\s*远端不拥有本地模型表/u, 'response_guide_must_warn_remote_worker_cannot_write_ui_label');
  assert.match(responseGuide, /不要在 remote-worker 程序里直接调用 MQTT 客户端/u, 'response_guide_must_keep_remote_worker_on_pin_path');
}

async function withServerState(fn) {
  const previous = {
    dyAuth: process.env.DY_AUTH,
    persistedAssetRoot: process.env.DY_PERSISTED_ASSET_ROOT,
    uiWorkerId: process.env.DY_UI_SERVER_WORKER_ID,
    workspace: process.env.WORKER_BASE_WORKSPACE,
    dataRoot: process.env.WORKER_BASE_DATA_ROOT,
    docsRoot: process.env.DOCS_ROOT,
    staticRoot: process.env.STATIC_PROJECTS_ROOT,
  };
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0409-todo-mqtt-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.DY_UI_SERVER_WORKER_ID = 'U1';
  process.env.WORKER_BASE_WORKSPACE = `it0409_todo_mqtt_${Date.now()}`;
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
    const restore = (key, value) => {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    };
    restore('DY_AUTH', previous.dyAuth);
    restore('DY_PERSISTED_ASSET_ROOT', previous.persistedAssetRoot);
    restore('DY_UI_SERVER_WORKER_ID', previous.uiWorkerId);
    restore('WORKER_BASE_WORKSPACE', previous.workspace);
    restore('WORKER_BASE_DATA_ROOT', previous.dataRoot);
    restore('DOCS_ROOT', previous.docsRoot);
    restore('STATIC_PROJECTS_ROOT', previous.staticRoot);
  }
}

async function assertImportedTodoSavePublishesMqtt() {
  return withServerState(async (state) => {
    const model0 = state.runtime.getModel(0);
    state.runtime.addLabel(model0, 0, 0, 0, { k: 'mqtt_topic_mode', t: 'str', v: 'uiput_mm_v1' });
    state.runtime.addLabel(model0, 0, 0, 0, { k: 'mqtt_topic_base', t: 'str', v: 'UIPUT/ws/dam/pic/de' });
    state.runtime.addLabel(model0, 0, 0, 0, { k: 'mqtt_worker_id', t: 'str', v: 'U1' });
    state.runtime.addLabel(model0, 0, 0, 0, { k: 'mqtt_payload_mode', t: 'str', v: 'pin_payload_v1' });
    state.runtime.startMqttLoop({
      host: 'localhost',
      port: 1883,
      client_id: '0409-todo-mqtt',
      transport: 'mock',
    });

    state.cacheUploadedMediaForTest('mxc://localhost/0409-todo-save-mqtt', {
      buffer: buildZipBuffer(readPayload()),
      contentType: 'application/zip',
      filename: 'todo_save_mqtt_event.zip',
      userId: '@drop:localhost',
    });
    state.runtime.addLabel(state.runtime.getModel(1031), 0, 0, 0, {
      k: 'slide_import_media_uri',
      t: 'str',
      v: 'mxc://localhost/0409-todo-save-mqtt',
    });

    const importResult = await state.submitEnvelope(slideImportClickBusEvent());
    assert.equal(importResult.result, 'ok', 'todo_save_mqtt_import_request_must_be_accepted');
    await wait();

    const registry = state.clientSnap().models['-2']?.cells?.['0,0,0']?.labels?.ws_apps_registry?.v || [];
    const importedEntry = registry.find((entry) => entry && entry.name === 'To Do Save MQTT Example');
    assert.ok(importedEntry, 'todo_save_mqtt_app_must_appear_in_registry');
    const importedId = importedEntry.model_id;
    const ingressKey = `imported_host_submit_${importedId}`;
    const installedText = JSON.stringify(state.clientSnap().models[String(importedId)] || {});
    assert.equal(installedText.includes(ingressKey), true, 'installed_button_binding_must_use_generated_ingress_key');
    assert.equal(installedText.includes('bus_event_submit_0_0_0_0'), false, 'installed_payload_must_not_keep_placeholder_bus_key');
    assert.equal(installedText.includes('"bus_in_key":"submit_request"'), false, 'installed_payload_must_not_use_internal_submit_request_key');

    const invalidSubmitRequest = await state.submitEnvelope(busEventV2Envelope(
      'submit_request',
      uiEventPayload([{ k: 'todo_action', t: 'str', v: 'save_task' }]),
      `it0409_invalid_submit_request_${Date.now()}`,
    ));
    assert.equal(invalidSubmitRequest.result, 'error', 'internal_submit_request_must_not_be_accepted_as_bus_in_key');
    assert.equal(invalidSubmitRequest.code, 'invalid_bus_in_key', 'internal_submit_request_must_fail_with_invalid_bus_in_key');

    const invalidTodoRequest = await state.submitEnvelope(busEventV2Envelope(
      'todo_request',
      uiEventPayload([{ k: 'todo_action', t: 'str', v: 'save_task' }]),
      `it0409_invalid_todo_request_${Date.now()}`,
    ));
    assert.equal(invalidTodoRequest.result, 'error', 'internal_todo_request_must_not_be_accepted_as_bus_in_key');
    assert.equal(invalidTodoRequest.code, 'invalid_bus_in_key', 'internal_todo_request_must_fail_with_invalid_bus_in_key');

    const submitResult = await state.submitEnvelope(busEventV2Envelope(
      ingressKey,
      uiEventPayload([
        { k: 'todo_action', t: 'str', v: 'save_task' },
        { k: 'title', t: 'str', v: 'MQTT task title' },
        { k: 'body', t: 'str', v: 'Task body sent through host egress.' },
        { k: 'status', t: 'str', v: 'doing' },
      ]),
      `it0409_save_task_${Date.now()}`,
    ));
    assert.equal(submitResult.result, 'ok', 'todo_save_mqtt_submit_must_be_accepted');
    assert.equal(submitResult.routed_by, 'model0_busin', 'todo_save_mqtt_submit_must_enter_through_bus_event_v2_model0_ingress');
    await wait(260);

    const importedRoot = state.runtime.getCell(state.runtime.getModel(importedId), 0, 0, 0).labels;
    assert.equal(importedRoot.get('todo_save_status')?.v, 'sending: MQTT task title', 'handler_must_update_local_status');
    assert.equal(importedRoot.get('last_submit_payload')?.v?.find?.((record) => record && record.k === 'title')?.v, 'MQTT task title', 'handler_must_materialize_task_payload');

    const publish = state.runtime.mqttTrace.list().find((entry) => (
      entry.type === 'publish'
      && entry.payload?.topic === 'UIPUT/ws/dam/pic/de/R1/3000/submit1'
      && entry.payload?.payload?.type === 'pin_payload'
      && payloadString(entry.payload.payload.payload, 'message_role') === 'request'
      && payloadString(entry.payload.payload.payload, 'topic') === 'UIPUT/ws/dam/pic/de/R1/3000/submit1'
      && payloadString(entry.payload.payload.payload, 'response_topic') === `UIPUT/ws/dam/pic/de/U1/${importedId}/result`
      && payloadString(entry.payload.payload.payload, 'endpoint_worker_id') === 'R1'
      && payloadInt(entry.payload.payload.payload, 'endpoint_model_id') === 3000
      && payloadString(entry.payload.payload.payload, 'endpoint_pin') === 'submit1'
      && payloadString(entry.payload.payload.payload, 'origin_worker_id') === 'U1'
      && payloadInt(entry.payload.payload.payload, 'origin_model_id') === importedId
      && payloadString(entry.payload.payload.payload, 'origin_pin') === 'submit1'
      && payloadString(entry.payload.payload.payload, 'reply_target_worker_id') === 'U1'
      && payloadInt(entry.payload.payload.payload, 'reply_target_model_id') === importedId
      && payloadString(entry.payload.payload.payload, 'reply_target_pin') === 'result'
      && payloadJson(entry.payload.payload.payload, 'payload')?.find?.((record) => record && record.k === 'title')?.v === 'MQTT task title'
      && payloadJson(entry.payload.payload.payload, 'payload')?.find?.((record) => record && record.k === 'status')?.v === 'doing'
    ));
    assert.ok(publish, 'todo_save_mqtt_example_must_publish_request_to_remote_worker_topic');
  });
}

try {
  assertPortablePayloadShape();
  assertDocsTeachCurrentMqttEgressPath();
  await assertImportedTodoSavePublishesMqtt();
  console.log('PASS test_0409_todo_mqtt_egress_docs_contract');
} catch (error) {
  console.error(`FAIL test_0409_todo_mqtt_egress_docs_contract: ${error && error.stack ? error.stack : error}`);
  process.exit(1);
}
