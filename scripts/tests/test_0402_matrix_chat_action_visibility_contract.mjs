#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs, { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadSystemPatch } from '../worker_engine_v0.mjs';
import { buildAstFromCellwiseModel } from '../../packages/ui-model-demo-frontend/src/ui_cellwise_projection.js';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

process.env.DY_AUTH = '0';

const CHAT_APP_MODEL_ID = 1083;
const CHAT_BUS_KEY = 'matrix_chat_1083_bus_event';
const workspacePath = 'packages/worker-base/system-models/workspace_positive_models.json';
const hierarchyPath = 'packages/worker-base/system-models/runtime_hierarchy_mounts.json';

function readJson(pathname) {
  return JSON.parse(fs.readFileSync(pathname, 'utf8'));
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

function wait(ms = 180) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function dispatchChat(state, action, extra = []) {
  const result = await state.submitEnvelope({
    type: 'bus_event_v2',
    bus_in_key: CHAT_BUS_KEY,
    value: payload(action, extra),
    meta: { op_id: `it0402_actions_${action}_${Date.now()}` },
  });
  assert.equal(result.result, 'ok', `${action} must route through Model 0`);
  assert.equal(result.routed_by, 'model0_busin', `${action} must use model0 bus ingress`);
  await wait();
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

function findNode(node, id) {
  if (!node || typeof node !== 'object') return null;
  if (node.id === id) return node;
  for (const child of node.children || []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function fakeVue() {
  return {
    h(type, props, children) {
      return {
        type,
        props: props || {},
        children: Array.isArray(children) ? children : (children == null ? [] : [children]),
      };
    },
    resolveComponent: (name) => name,
  };
}

function makeSnapshot(labels) {
  return {
    models: {
      [CHAT_APP_MODEL_ID]: {
        cells: {
          '0,0,0': {
            labels: Object.fromEntries(Object.entries(labels).map(([k, v]) => [k, { k, t: typeof v === 'boolean' ? 'bool' : 'str', v }])),
          },
        },
      },
    },
  };
}

function makeHost(snapshot) {
  return {
    getSnapshot: () => snapshot,
    dispatchAddLabel() {},
    dispatchRmLabel() {},
  };
}

async function withServerState(options, fn) {
  if (typeof options === 'function') {
    fn = options;
    options = {};
  }
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0402-matrix-chat-actions-'));
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0402_actions_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  process.env.DY_UI_SERVER_WORKER_ID = 'U1';
  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null, ...(options || {}) });
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

function chatRootLabels(state) {
  return state.clientSnap().models[String(CHAT_APP_MODEL_ID)].cells['0,0,0'].labels;
}

function seedRooms(state, rooms, activeRoomId) {
  const model = state.runtime.getModel(CHAT_APP_MODEL_ID);
  state.runtime.addLabel(model, 0, 0, 0, { k: 'rooms_json', t: 'json', v: rooms });
  state.runtime.addLabel(model, 0, 0, 0, { k: 'timeline_json', t: 'json', v: [] });
  state.runtime.addLabel(model, 0, 0, 0, { k: 'active_room_id', t: 'str', v: activeRoomId });
  state.runtime.addLabel(model, 0, 0, 0, { k: 'target_room_id', t: 'str', v: activeRoomId });
}

function test_matrix_chat_action_controls_declare_visibility_refs() {
  const rt = loadRuntime();
  const ast = buildAstFromCellwiseModel(rt.snapshot(), CHAT_APP_MODEL_ID);
  const expectations = [
    ['matrix_chat_invite_user_input', 'active_can_invite_members'],
    ['matrix_chat_invite_button', 'active_can_invite_members'],
    ['matrix_chat_remove_user_input', 'active_can_remove_members'],
    ['matrix_chat_remove_button', 'active_can_remove_members'],
    ['matrix_chat_leave_room_button', 'active_can_leave_room'],
    ['matrix_chat_delete_friend_button', 'active_can_leave_people'],
    ['matrix_chat_accept_invite_button', 'active_can_accept_invite'],
  ];
  for (const [nodeId, key] of expectations) {
    const node = findNode(ast, nodeId);
    assert.equal(node?.props?.visibleRef?.model_id, CHAT_APP_MODEL_ID, `${nodeId} must use a model-driven visibleRef`);
    assert.equal(node?.props?.visibleRef?.k, key, `${nodeId} must be controlled by ${key}`);
  }
  return { key: 'matrix_chat_action_controls_declare_visibility_refs', status: 'PASS' };
}

function test_matrix_chat_declares_dedicated_invite_panel() {
  const rt = loadRuntime();
  const ast = buildAstFromCellwiseModel(rt.snapshot(), CHAT_APP_MODEL_ID);
  const panel = findNode(ast, 'matrix_chat_invite_panel');
  const composer = findNode(ast, 'matrix_chat_composer');
  const acceptButton = findNode(ast, 'matrix_chat_accept_invite_button');
  const declineButton = findNode(ast, 'matrix_chat_decline_invite_button');
  assert.equal(panel?.type, 'Container', 'Matrix Chat must render invite handling in a dedicated panel');
  assert.equal(panel?.props?.visibleRef?.k, 'active_can_accept_invite', 'invite panel must only show for invited rooms');
  assert.equal(composer?.props?.visibleRef?.k, 'active_can_send_messages', 'normal composer must hide for invite rows');
  assert.equal(acceptButton?.props?.visibleRef?.k, 'active_can_accept_invite', 'Accept must only show for invited rooms');
  assert.equal(declineButton?.props?.visibleRef?.k, 'active_can_accept_invite', 'Decline must only show for invited rooms');
  assert.match(JSON.stringify(acceptButton?.bind?.write?.value_ref || []), /accept_invite/u, 'Accept button must emit accept_invite');
  assert.match(JSON.stringify(declineButton?.bind?.write?.value_ref || []), /decline_invite/u, 'Decline button must emit decline_invite');
  return { key: 'matrix_chat_declares_dedicated_invite_panel', status: 'PASS' };
}

async function test_matrix_chat_projection_writes_action_visibility_state() {
  await withServerState(async (state) => {
    const normalRoom = {
      id: '!room0402:synapse.dongyudigital.com',
      name: '0402 Room',
      kind: 'room',
      conversation_group: 'rooms',
      members: ['@drop:synapse.dongyudigital.com'],
      member_count: 1,
      can_invite: true,
      can_kick: true,
      can_leave: true,
    };
    const peopleRoom = {
      id: '!people0402:synapse.dongyudigital.com',
      name: '0402 DM',
      kind: 'dm',
      conversation_group: 'people',
      members: ['@drop:synapse.dongyudigital.com', '@mbr:synapse.dongyudigital.com'],
      member_count: 2,
      can_invite: false,
      can_kick: false,
      can_leave: true,
    };
    const inviteRoom = {
      id: '!invite0402:synapse.dongyudigital.com',
      name: '0402 Invite',
      kind: 'invite',
      conversation_group: 'invites',
      members: ['@drop:synapse.dongyudigital.com'],
      member_count: 1,
      can_invite: false,
      can_kick: false,
      can_leave: false,
      can_join: true,
    };
    const rooms = [normalRoom, peopleRoom, inviteRoom];

    seedRooms(state, rooms, normalRoom.id);
    await dispatchChat(state, 'select_room', [mt('room_id', 'str', normalRoom.id)]);
    let root = chatRootLabels(state);
    assert.equal(root.active_can_invite_members.v, true, 'normal room with permission must allow Invite controls');
    assert.equal(root.active_can_remove_members.v, true, 'normal room with kick permission must allow Remove controls');
    assert.equal(root.active_can_leave_room.v, true, 'normal room must allow Leave room');
    assert.equal(root.active_can_leave_people.v, false, 'normal room must not show Leave 1v1');
    assert.equal(root.active_can_accept_invite.v, false, 'normal room must not show Accept invite');
    assert.equal(root.active_can_send_messages.v, true, 'normal room must keep composer visible');

    await dispatchChat(state, 'select_room', [mt('room_id', 'str', peopleRoom.id)]);
    root = chatRootLabels(state);
    assert.equal(root.active_can_invite_members.v, false, 'DM must not show group invite controls');
    assert.equal(root.active_can_remove_members.v, false, 'DM must not show group remove controls');
    assert.equal(root.active_can_leave_room.v, false, 'DM must not show generic Leave room');
    assert.equal(root.active_can_leave_people.v, true, 'DM must show Leave 1v1');
    assert.equal(root.active_can_accept_invite.v, false, 'DM must not show Accept invite');
    assert.equal(root.active_can_send_messages.v, true, 'DM must keep composer visible');

    await dispatchChat(state, 'select_room', [mt('room_id', 'str', inviteRoom.id)]);
    root = chatRootLabels(state);
    assert.equal(root.active_can_invite_members.v, false, 'invite row must not show Invite controls');
    assert.equal(root.active_can_remove_members.v, false, 'invite row must not show Remove controls');
    assert.equal(root.active_can_leave_room.v, false, 'invite row must not show Leave room');
    assert.equal(root.active_can_leave_people.v, false, 'invite row must not show Leave 1v1');
    assert.equal(root.active_can_accept_invite.v, true, 'invite row must show Accept invite');
    assert.equal(root.active_can_send_messages.v, false, 'invite row must hide normal composer');
    assert.match(root.active_invite_notice_markdown.v, /0402 Invite/u, 'invite row must expose invite panel copy');
  });
  return { key: 'matrix_chat_projection_writes_action_visibility_state', status: 'PASS' };
}

async function test_decline_invite_rejects_matrix_invite_and_refreshes_projection() {
  const inviteRoomId = '!declineInvite0402:synapse.dongyudigital.com';
  const fallbackRoomId = '!fallback0402:synapse.dongyudigital.com';
  const calls = [];
  await withServerState({
    matrixSuiteMatrixImpl: {
      leaveRoom: async (input) => {
        calls.push({ kind: 'leaveRoom', input });
        return { ok: true };
      },
      refreshRooms: async () => {
        calls.push({ kind: 'refreshRooms', input: {} });
        return {
          ok: true,
          rooms: [{
            id: fallbackRoomId,
            room_id: fallbackRoomId,
            name: 'Fallback Room',
            kind: 'room',
            conversation_group: 'rooms',
            members: ['@drop:synapse.dongyudigital.com'],
            member_count: 1,
            can_invite: true,
            can_kick: false,
            can_leave: true,
          }],
          events: [],
        };
      },
    },
  }, async (state) => {
    seedRooms(state, [{
      id: inviteRoomId,
      name: 'Decline Invite 0402',
      kind: 'invite',
      conversation_group: 'invites',
      members: ['@drop:synapse.dongyudigital.com'],
      member_count: 1,
      invited_by: '@mbr:synapse.dongyudigital.com',
      can_join: true,
      can_leave: false,
    }, {
      id: fallbackRoomId,
      name: 'Fallback Room',
      kind: 'room',
      conversation_group: 'rooms',
      members: ['@drop:synapse.dongyudigital.com'],
      member_count: 1,
      can_invite: true,
      can_kick: false,
      can_leave: true,
    }], inviteRoomId);
    await dispatchChat(state, 'select_room', [mt('room_id', 'str', inviteRoomId)]);
    await dispatchChat(state, 'decline_invite');
    const root = chatRootLabels(state);
    assert.deepEqual(calls.map((call) => call.kind), ['leaveRoom', 'refreshRooms'], 'decline_invite must reject via Matrix leave and refresh rooms');
    assert.equal(calls[0].input.roomId, inviteRoomId);
    assert.equal(root.rooms_json.v.some((room) => room.id === inviteRoomId), false, 'declined invite row must be removed after refresh');
    assert.equal(root.active_room_id.v, fallbackRoomId, 'decline refresh must select a valid remaining room');
    assert.match(root.status_text.v, /Declined Matrix invite/u, 'status must confirm decline');
  });
  return { key: 'decline_invite_rejects_matrix_invite_and_refreshes_projection', status: 'PASS' };
}

async function test_accept_invite_prefers_joined_room_over_stale_invite_projection() {
  const inviteRoomId = '!acceptInvite0402:synapse.dongyudigital.com';
  const calls = [];
  await withServerState({
    matrixSuiteMatrixImpl: {
      joinRoom: async (input) => {
        calls.push({ kind: 'joinRoom', input });
        return { ok: true, roomId: inviteRoomId };
      },
      refreshRooms: async () => {
        calls.push({ kind: 'refreshRooms', input: {} });
        return {
          ok: true,
          rooms: [{
            id: inviteRoomId,
            room_id: inviteRoomId,
            name: 'Accepted Invite Room',
            kind: 'room',
            conversation_group: 'rooms',
            members: ['@drop:synapse.dongyudigital.com', '@mbr:synapse.dongyudigital.com'],
            member_count: 2,
            can_invite: false,
            can_kick: false,
            can_leave: true,
          }, {
            id: inviteRoomId,
            room_id: inviteRoomId,
            name: 'Stale Invite Shadow',
            kind: 'invite',
            conversation_group: 'invites',
            members: ['@drop:synapse.dongyudigital.com', '@mbr:synapse.dongyudigital.com'],
            member_count: 2,
            invited_by: '@mbr:synapse.dongyudigital.com',
            can_join: true,
            can_leave: false,
          }],
          events: [],
        };
      },
    },
  }, async (state) => {
    seedRooms(state, [{
      id: inviteRoomId,
      name: 'Accept Invite 0402',
      kind: 'invite',
      conversation_group: 'invites',
      members: ['@drop:synapse.dongyudigital.com', '@mbr:synapse.dongyudigital.com'],
      member_count: 2,
      invited_by: '@mbr:synapse.dongyudigital.com',
      can_join: true,
      can_leave: false,
    }], inviteRoomId);
    await dispatchChat(state, 'select_room', [mt('room_id', 'str', inviteRoomId)]);
    await dispatchChat(state, 'accept_invite');
    const root = chatRootLabels(state);
    const matchingRooms = root.rooms_json.v.filter((room) => room.id === inviteRoomId);
    assert.deepEqual(calls.map((call) => call.kind), ['joinRoom', 'refreshRooms'], 'accept_invite must join then refresh rooms');
    assert.equal(calls[0].input.roomId, inviteRoomId);
    assert.equal(matchingRooms.length, 1, 'accepted room must not keep a stale invite duplicate');
    assert.equal(matchingRooms[0].kind, 'room', 'joined room must be authoritative over stale invite sync');
    assert.equal(root.active_room_id.v, inviteRoomId, 'accepted room must stay selected');
    assert.equal(root.active_can_accept_invite.v, false, 'accepted room must hide invitation controls');
    assert.equal(root.active_can_send_messages.v, true, 'accepted room must restore the composer');
    assert.match(root.status_text.v, /Accepted Matrix invite/u, 'status must confirm accept');
  });
  return { key: 'accept_invite_prefers_joined_room_over_stale_invite_projection', status: 'PASS' };
}

async function test_decline_invite_filters_stale_invite_from_refresh_projection() {
  const inviteRoomId = '!staleDeclineInvite0402:synapse.dongyudigital.com';
  const fallbackRoomId = '!staleFallback0402:synapse.dongyudigital.com';
  await withServerState({
    matrixSuiteMatrixImpl: {
      leaveRoom: async () => ({ ok: true }),
      refreshRooms: async () => ({
        ok: true,
        rooms: [{
          id: inviteRoomId,
          room_id: inviteRoomId,
          name: 'Stale Declined Invite',
          kind: 'invite',
          conversation_group: 'invites',
          members: ['@drop:synapse.dongyudigital.com'],
          member_count: 1,
          invited_by: '@mbr:synapse.dongyudigital.com',
          can_join: true,
        }, {
          id: fallbackRoomId,
          room_id: fallbackRoomId,
          name: 'Stale Fallback Room',
          kind: 'room',
          conversation_group: 'rooms',
          members: ['@drop:synapse.dongyudigital.com'],
          member_count: 1,
          can_invite: true,
          can_kick: false,
          can_leave: true,
        }],
        events: [],
      }),
    },
  }, async (state) => {
    seedRooms(state, [{
      id: inviteRoomId,
      name: 'Stale Declined Invite',
      kind: 'invite',
      conversation_group: 'invites',
      members: ['@drop:synapse.dongyudigital.com'],
      member_count: 1,
      invited_by: '@mbr:synapse.dongyudigital.com',
      can_join: true,
    }, {
      id: fallbackRoomId,
      name: 'Stale Fallback Room',
      kind: 'room',
      conversation_group: 'rooms',
      members: ['@drop:synapse.dongyudigital.com'],
      member_count: 1,
      can_invite: true,
      can_kick: false,
      can_leave: true,
    }], inviteRoomId);
    await dispatchChat(state, 'select_room', [mt('room_id', 'str', inviteRoomId)]);
    await dispatchChat(state, 'decline_invite');
    const root = chatRootLabels(state);
    assert.equal(root.rooms_json.v.some((room) => room.id === inviteRoomId), false, 'declined invite must not reappear even if refresh still returns it');
    assert.equal(root.active_room_id.v, fallbackRoomId, 'stale refresh filtering must keep selection on a valid remaining room');
  });
  return { key: 'decline_invite_filters_stale_invite_from_refresh_projection', status: 'PASS' };
}

async function assertRendererVisibility(createRenderer, label) {
  const visibleRef = { model_id: CHAT_APP_MODEL_ID, p: 0, r: 0, c: 0, k: 'show_control' };
  const hiddenRef = { model_id: CHAT_APP_MODEL_ID, p: 0, r: 0, c: 0, k: 'hide_control' };
  const node = { id: 'visibility_test_button', type: 'Button', props: { label: 'Visible control', visibleRef, hiddenRef } };
  let renderer = createRenderer({ host: makeHost(makeSnapshot({ show_control: false, hide_control: false })), vue: fakeVue() });
  assert.equal(renderer.renderVNode(node), null, `${label} must hide when visibleRef is false`);
  renderer = createRenderer({ host: makeHost(makeSnapshot({ show_control: true, hide_control: true })), vue: fakeVue() });
  assert.equal(renderer.renderVNode(node), null, `${label} must hide when hiddenRef is true`);
  renderer = createRenderer({ host: makeHost(makeSnapshot({ show_control: true, hide_control: false })), vue: fakeVue() });
  const rendered = renderer.renderVNode(node);
  assert.ok(rendered, `${label} must render when visibleRef is true and hiddenRef is false`);
  assert.equal(rendered.props.visibleRef, undefined, `${label} must not leak visibleRef to DOM/component props`);
  assert.equal(rendered.props.hiddenRef, undefined, `${label} must not leak hiddenRef to DOM/component props`);
}

async function test_renderer_supports_model_driven_visibility_refs() {
  const esm = await import(new URL('../../packages/ui-renderer/src/renderer.mjs', import.meta.url));
  const cjs = require('../../packages/ui-renderer/src/renderer.js');
  await assertRendererVisibility(esm.createRenderer, 'ESM');
  await assertRendererVisibility(cjs.createRenderer, 'CJS');
  return { key: 'renderer_supports_model_driven_visibility_refs', status: 'PASS' };
}

const tests = [
  test_matrix_chat_action_controls_declare_visibility_refs,
  test_matrix_chat_declares_dedicated_invite_panel,
  test_matrix_chat_projection_writes_action_visibility_state,
  test_decline_invite_rejects_matrix_invite_and_refreshes_projection,
  test_accept_invite_prefers_joined_room_over_stale_invite_projection,
  test_decline_invite_filters_stale_invite_from_refresh_projection,
  test_renderer_supports_model_driven_visibility_refs,
];

for (const test of tests) {
  const result = await test();
  console.log(`${result.key}: ${result.status}`);
}
