#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs, { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadSystemPatch } from '../worker_engine_v0.mjs';
import { buildAstFromCellwiseModel } from '../../packages/ui-model-demo-frontend/src/ui_cellwise_projection.js';
import { WORKSPACE_ENTRY_MODEL_IDS } from '../../packages/ui-model-demo-frontend/src/model_ids.js';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

const CHAT_APP_MODEL_ID = 1083;
const MATRIX_SUITE_MODEL_ID = 1080;
const CHAT_BUS_KEY = 'matrix_chat_1083_bus_event';
const workspacePath = 'packages/worker-base/system-models/workspace_positive_models.json';
const hierarchyPath = 'packages/worker-base/system-models/runtime_hierarchy_mounts.json';
const rendererPath = 'packages/ui-renderer/src/renderer.mjs';

function readJson(pathname) {
  return JSON.parse(fs.readFileSync(pathname, 'utf8'));
}

function records(pathname) {
  return readJson(pathname).records || [];
}

function rootLabel(allRecords, modelId, key) {
  return allRecords.find((record) => record.model_id === modelId
    && record.p === 0
    && record.r === 0
    && record.c === 0
    && record.k === key);
}

function cellLabel(allRecords, modelId, p, r, c, key) {
  return allRecords.find((record) => record.model_id === modelId
    && record.p === p
    && record.r === r
    && record.c === c
    && record.k === key);
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

function loadRuntime() {
  const rt = new ModelTableRuntime();
  loadSystemPatch(rt);
  for (const pathname of [workspacePath, hierarchyPath]) {
    const result = rt.applyPatch(readJson(pathname), { allowCreateModel: true, trustedBootstrap: true });
    assert.equal(result.rejected, 0, `${pathname} must load without rejected records`);
  }
  return rt;
}

function assertBusEventTarget(node, label) {
  assert.equal(node?.bind?.write?.bus_event_v2, true, `${label} must use bus_event_v2`);
  assert.equal(node?.bind?.write?.bus_in_key, CHAT_BUS_KEY, `${label} must target Matrix Chat Model 0 ingress`);
}

function wait(ms = 180) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mt(k, t, v) {
  return { id: 0, p: 0, r: 0, c: 0, k, t, v };
}

function payload(action, extra = []) {
  return [
    mt('__mt_payload_kind', 'str', 'ui_event.v1'),
    mt('action', 'str', action),
    ...extra,
  ];
}

async function withServerState(options, fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0399-matrix-chat-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0399_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  process.env.DY_UI_SERVER_WORKER_ID = 'U1';
  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null, ...options });
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

async function dispatchChat(state, action, extra = []) {
  const result = await state.submitEnvelope({
    type: 'bus_event_v2',
    bus_in_key: CHAT_BUS_KEY,
    value: payload(action, extra),
    meta: { op_id: `it0399_${action}_${Date.now()}` },
  });
  assert.equal(result.result, 'ok', `${action} must route through Model 0`);
  assert.equal(result.routed_by, 'model0_busin', `${action} must use model0 bus ingress`);
  await wait();
  return result;
}

function chatLabels(state) {
  return state.clientSnap().models[String(CHAT_APP_MODEL_ID)].cells['0,0,0'].labels;
}

function test_formal_chat_app_is_separate_builtin_model() {
  const allRecords = records(workspacePath);
  const suiteName = rootLabel(allRecords, MATRIX_SUITE_MODEL_ID, 'app_name');
  const appName = rootLabel(allRecords, CHAT_APP_MODEL_ID, 'app_name');
  const summary = rootLabel(allRecords, CHAT_APP_MODEL_ID, 'slide_app_summary');
  const rootId = rootLabel(allRecords, CHAT_APP_MODEL_ID, 'ui_root_node_id');
  const handler = rootLabel(allRecords, CHAT_APP_MODEL_ID, 'handle_matrix_chat_event');
  const workspaceApps = rootLabel(allRecords, -2, 'ws_apps_registry')?.v || [];
  assert.equal(suiteName?.v, 'Matrix Suite', 'existing Matrix Suite test app must remain');
  assert.equal(appName?.v, 'Matrix Chat', 'formal chat app must use a distinct Matrix Chat model');
  assert.match(String(summary?.v || ''), /聊天|chat|Matrix/u, 'formal chat app must explain it is the user-facing chat client');
  assert.equal(rootId?.v, 'matrix_chat_root', 'formal chat app must expose a stable cellwise root');
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  assert.doesNotThrow(() => new AsyncFunction('ctx', 'label', 'V1N', handler?.v?.code || ''), 'Matrix Chat program model must compile before it can trigger host actions');
  assert.ok(workspaceApps.some((item) => item?.model_id === CHAT_APP_MODEL_ID && item?.name === 'Matrix Chat'), 'Matrix Chat must be listed as a built-in workspace app');
  assert.ok(WORKSPACE_ENTRY_MODEL_IDS.includes(CHAT_APP_MODEL_ID), 'Matrix Chat must be included in the shared workspace allowlist');
  return { key: 'formal_chat_app_is_separate_builtin_model', status: 'PASS' };
}

function test_formal_chat_app_projects_normal_chat_layout() {
  const rt = loadRuntime();
  const ast = buildAstFromCellwiseModel(rt.snapshot(), CHAT_APP_MODEL_ID);
  assert.ok(ast, 'Matrix Chat must build a cellwise UI AST');
  assert.equal(ast.id, 'matrix_chat_root', 'root id must match model root label');

  const conversationList = findNode(ast, 'matrix_chat_conversation_list');
  const timeline = findNode(ast, 'matrix_chat_timeline');
  const composer = findNode(ast, 'matrix_chat_composer');
  const settingsDialog = findNode(ast, 'matrix_chat_settings_dialog');
  const createDialog = findNode(ast, 'matrix_chat_create_dialog');
  const roomDetailDialog = findNode(ast, 'matrix_chat_room_detail_dialog');
  const editDialog = findNode(ast, 'matrix_chat_edit_dialog');
  const editConfirm = findNode(ast, 'matrix_chat_edit_confirm');
  const filePreview = findNode(ast, 'matrix_chat_attachment_preview');

  assert.equal(conversationList?.type, 'ConversationList', 'left side must be a conversation/channel list component');
  assert.equal(timeline?.type, 'MessageTimeline', 'main area must be a message timeline component');
  assert.equal(composer?.type, 'ComposerBar', 'bottom area must be a natural chat composer component');
  assert.equal(filePreview?.type, 'AttachmentPreview', 'selected single-file preview must be a dedicated card component');
  assert.equal(settingsDialog?.type, 'Dialog', 'settings must be layered in a Dialog');
  assert.equal(createDialog?.type, 'Dialog', 'create room/dm must be layered in a Dialog');
  assert.equal(roomDetailDialog?.type, 'Dialog', 'room id/detail must be layered in a Dialog');
  assert.equal(editDialog?.type, 'Dialog', 'message editing must be layered in a Dialog');

  assertBusEventTarget(conversationList, 'conversation selection');
  assertBusEventTarget(findNode(ast, 'matrix_chat_send_button'), 'send button');
  assertBusEventTarget(editConfirm, 'edit button');
  assertBusEventTarget(findNode(ast, 'matrix_chat_file_send_button'), 'file send button');
  assertBusEventTarget(findNode(ast, 'matrix_chat_refresh_rooms'), 'refresh rooms');
  assertBusEventTarget(findNode(ast, 'matrix_chat_create_confirm'), 'create room/dm');
  assert.match(JSON.stringify(editConfirm?.bind?.write?.value_ref || []), /edit_message/u, 'edit dialog confirm must emit an edit_message action');

  assert.equal(conversationList?.props?.primaryField, 'name', 'conversation list must use room name as primary text');
  assert.equal(conversationList?.props?.idField, 'id', 'conversation list must keep room id as metadata/id');
  assert.equal(conversationList?.props?.showId, false, 'conversation list must not show Matrix room id as primary text');
  assert.equal(conversationList?.props?.fallbackLabel, 'Unnamed room', 'nameless rooms must use a safe display fallback');

  const serialized = JSON.stringify(ast);
  assert.equal(serialized.includes('Password maintenance'), false, 'password maintenance must not be flat primary content');
  assert.equal(serialized.includes('Login'), false, 'login test controls must not be flat primary content');
  assert.equal(serialized.includes('Inspector / Route'), false, 'debug inspector must not be part of the formal chat main page');
  assert.equal(serialized.includes('Video call connected'), false, 'video conferencing must not be presented as already connected');
  assert.equal(serialized.includes('Screen sharing active'), false, 'screen sharing must not be presented as already active');
  assert.equal(serialized.includes('Voice recording sent'), false, 'voice input must not be presented as already sent');
  return { key: 'formal_chat_app_projects_normal_chat_layout', status: 'PASS' };
}

function test_formal_chat_app_declares_model0_ingress_route() {
  const allRecords = records(workspacePath);
  const hierarchyRecords = records(hierarchyPath);
  const pin = cellLabel(allRecords, 0, 9, 0, CHAT_APP_MODEL_ID, 'matrix_chat_request');
  const route = rootLabel(allRecords, 0, 'matrix_chat_1083_ingress_route');
  const mount = cellLabel(hierarchyRecords, 0, 9, 0, CHAT_APP_MODEL_ID, 'model_type');
  assert.equal(mount?.t, 'model.submt', 'Matrix Chat must be mounted under Model 0 before routing to its hosting cell');
  assert.equal(mount?.v, CHAT_APP_MODEL_ID, 'Matrix Chat hosting cell must mount the formal chat app model');
  assert.equal(pin?.t, 'pin.in', 'Matrix Chat request pin must be declared on Model 0 hosting cell');
  assert.equal(route?.t, 'pin.connect.cell', 'Matrix Chat ingress route must be a Model 0 pin.connect.cell label');
  assert.ok(Array.isArray(route?.v), 'Matrix Chat ingress route must use model-table connection records');
  assert.ok(route.v.some((entry) => JSON.stringify(entry?.from) === JSON.stringify([0, 0, 0, CHAT_BUS_KEY])
    && Array.isArray(entry?.to)
    && entry.to.some((target) => JSON.stringify(target) === JSON.stringify([9, 0, CHAT_APP_MODEL_ID, 'matrix_chat_request']))), 'Matrix Chat bus key must route from Model 0 root to the app request pin');
  return { key: 'formal_chat_app_declares_model0_ingress_route', status: 'PASS' };
}

async function test_matrix_chat_bus_events_reach_real_host_actions() {
  const calls = [];
  return withServerState({
    matrixSuiteMatrixImpl: {
      refreshRooms: async (input) => {
        calls.push({ kind: 'refreshRooms', input });
        return {
          ok: true,
          rooms: [{ room_id: '!formal-chat:synapse.dongyudigital.com', name: 'Formal Chat Room', canonical_alias: '' }],
        };
      },
      sendMessage: async (input) => {
        calls.push({ kind: 'sendMessage', input });
        return { ok: true, eventId: '$formal_chat_0399', ts: '13:39' };
      },
      editMessage: async (input) => {
        calls.push({ kind: 'editMessage', input });
        return { ok: true, eventId: '$formal_chat_0399_edit', ts: '13:40' };
      },
      shareFile: async (input) => {
        calls.push({ kind: 'shareFile', input });
        return { ok: true, eventId: '$formal_chat_0399_file', ts: '13:41' };
      },
      createRoom: async (input) => {
        calls.push({ kind: 'createRoom', input });
        return { ok: true, roomId: '!formal-chat-created:synapse.dongyudigital.com', name: input.name, kind: input.kind };
      },
    },
  }, async (state) => {
    await dispatchChat(state, 'refresh_rooms');
    let root = chatLabels(state);
    assert.deepEqual(calls.map((call) => call.kind), ['refreshRooms'], 'refresh_rooms must call the Matrix host adapter');
    assert.equal(root.active_room_id.v, '!formal-chat:synapse.dongyudigital.com', 'refresh must materialize Matrix Chat active room');
    assert.equal(root.active_room_name.v, 'Formal Chat Room', 'refresh must materialize readable room name');

    await dispatchChat(state, 'send_message', [mt('draft_text', 'str', '0399 formal chat send')]);
    root = chatLabels(state);
    assert.deepEqual(calls.map((call) => call.kind), ['refreshRooms', 'sendMessage'], 'send_message must call the Matrix host adapter after refresh');
    assert.equal(calls[1].input.roomId, '!formal-chat:synapse.dongyudigital.com', 'send_message must target the selected formal chat room');
    assert.equal(calls[1].input.body, '0399 formal chat send');
    assert.ok((root.timeline_json.v || []).some((event) => event.event_id === '$formal_chat_0399'), 'timeline_json must include the host event id');

    state.runtime.addLabel(state.runtime.getModel(CHAT_APP_MODEL_ID), 0, 0, 0, { k: 'edit_dialog_open', t: 'bool', v: true });
    await dispatchChat(state, 'edit_message', [
      mt('event_id', 'str', '$formal_chat_0399'),
      mt('edit_text', 'str', '0399 formal chat edited'),
    ]);
    root = chatLabels(state);
    assert.deepEqual(calls.map((call) => call.kind), ['refreshRooms', 'sendMessage', 'editMessage'], 'edit_message must call the Matrix host adapter');
    assert.equal(calls[2].input.eventId, '$formal_chat_0399', 'edit_message must target the original event');
    assert.ok((root.timeline_json.v || []).some((event) => event.event_id === '$formal_chat_0399' && event.edited === true && event.body === '0399 formal chat edited'), 'timeline_json must mark edited events');
    assert.equal(root.edit_dialog_open.v, false, 'successful edit must close the edit dialog');

    await dispatchChat(state, 'share_file', [
      mt('media_uri', 'str', 'mxc://synapse.dongyudigital.com/formal-file'),
      mt('file_name', 'str', 'formal-file.txt'),
    ]);
    root = chatLabels(state);
    assert.deepEqual(calls.map((call) => call.kind), ['refreshRooms', 'sendMessage', 'editMessage', 'shareFile'], 'share_file must call the Matrix host adapter');
    assert.equal(calls[3].input.mediaUri, 'mxc://synapse.dongyudigital.com/formal-file', 'share_file must send the selected media uri');
    assert.ok((root.timeline_json.v || []).some((event) => event.event_id === '$formal_chat_0399_file' && event.msgtype === 'm.file'), 'timeline_json must include the file event id');

    await dispatchChat(state, 'create_channel', [
      mt('channel_name', 'str', 'Formal Created Room'),
      mt('channel_kind', 'str', 'room'),
    ]);
    root = chatLabels(state);
    assert.deepEqual(calls.map((call) => call.kind), ['refreshRooms', 'sendMessage', 'editMessage', 'shareFile', 'createRoom'], 'create_channel must call the Matrix host adapter');
    assert.ok((root.rooms_json.v || []).some((room) => room.id === '!formal-chat-created:synapse.dongyudigital.com' && room.name === 'Formal Created Room'), 'rooms_json must include the created Matrix room');
    return { key: 'matrix_chat_bus_events_reach_real_host_actions', status: 'PASS' };
  });
}

function test_formal_chat_app_has_single_file_pick_and_preview_binding() {
  const rt = loadRuntime();
  const ast = buildAstFromCellwiseModel(rt.snapshot(), CHAT_APP_MODEL_ID);
  const fileInput = findNode(ast, 'matrix_chat_file_input');
  const filePreview = findNode(ast, 'matrix_chat_attachment_preview');
  assert.equal(fileInput?.type, 'FileInput', 'composer must include a real single-file picker');
  assert.equal(fileInput?.props?.multiple, false, 'Matrix Chat must only allow one pending file per send');
  assert.equal(fileInput?.bind?.write?.target_ref?.k, 'pending_file_uri', 'file picker must write uploaded media uri');
  assert.equal(fileInput?.props?.nameTargetRef?.k, 'pending_file_name', 'file picker must write uploaded file name');
  assert.equal(filePreview?.props?.uriRef?.k, 'pending_file_uri', 'file preview must read pending media uri');
  assert.equal(filePreview?.props?.nameRef?.k, 'pending_file_name', 'file preview must read pending file name');
  return { key: 'formal_chat_app_has_single_file_pick_and_preview_binding', status: 'PASS' };
}

function test_renderer_supports_chat_components_without_direct_matrix_calls() {
  const renderer = fs.readFileSync(rendererPath, 'utf8');
  for (const component of ['ConversationList', 'MessageTimeline', 'AttachmentPreview', 'ComposerBar']) {
    assert.match(renderer, new RegExp(`node\\.type === '${component}'`, 'u'), `renderer must support ${component}`);
  }
  assert.equal(renderer.includes('matrix-js-sdk'), false, 'renderer must not import matrix-js-sdk');
  assert.equal(/sendEvent\s*\(/u.test(renderer), false, 'renderer must not directly send Matrix events');
  assert.equal(/_matrix\/client/u.test(renderer), false, 'renderer must not call Matrix Client API directly');
  return { key: 'renderer_supports_chat_components_without_direct_matrix_calls', status: 'PASS' };
}

function test_server_supports_matrix_chat_model_without_breaking_matrix_suite() {
  const server = fs.readFileSync('packages/ui-model-demo-server/server.mjs', 'utf8');
  assert.match(server, /MATRIX_CHAT_APP_MODEL_ID\s*=\s*1083/u, 'server must register the formal Matrix Chat app model id');
  assert.match(server, /matrix_chat_1083_bus_event/u, 'server or model code must route formal chat events through a dedicated bus key');
  assert.match(server, /runMatrixSuiteHostAction/u, 'existing Matrix Suite host action path must remain');
  return { key: 'server_supports_matrix_chat_model_without_breaking_matrix_suite', status: 'PASS' };
}

const tests = [
  test_formal_chat_app_is_separate_builtin_model,
  test_formal_chat_app_projects_normal_chat_layout,
  test_formal_chat_app_declares_model0_ingress_route,
  test_matrix_chat_bus_events_reach_real_host_actions,
  test_formal_chat_app_has_single_file_pick_and_preview_binding,
  test_renderer_supports_chat_components_without_direct_matrix_calls,
  test_server_supports_matrix_chat_model_without_breaking_matrix_suite,
];

(async () => {
  let passed = 0;
  let failed = 0;
  for (const test of tests) {
    try {
      const result = await test();
      console.log(`[${result.status}] ${result.key}`);
      passed += 1;
    } catch (error) {
      console.log(`[FAIL] ${test.name}: ${error.stack || error.message}`);
      failed += 1;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
  process.exit(failed > 0 ? 1 : 0);
})();
