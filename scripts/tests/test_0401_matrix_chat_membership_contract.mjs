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
const ROOM_A = '!leaveA0401:synapse.dongyudigital.com';
const ROOM_B = '!leaveB0401:synapse.dongyudigital.com';
const PEOPLE_ROOM = '!peopleLeave0401:synapse.dongyudigital.com';
const CREATED_DM_ROOM = '!createdDm0401:synapse.dongyudigital.com';
const INVITE_ROOM = '!invite0401:synapse.dongyudigital.com';
const JOINED_INVITE_ROOM = '!joinedInvite0401:synapse.dongyudigital.com';
const DROP = '@drop:synapse.dongyudigital.com';
const MBR = '@mbr:synapse.dongyudigital.com';
const workspacePath = 'packages/worker-base/system-models/workspace_positive_models.json';
const hierarchyPath = 'packages/worker-base/system-models/runtime_hierarchy_mounts.json';

function readJson(pathname) {
  return JSON.parse(fs.readFileSync(pathname, 'utf8'));
}

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
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

async function withServerState(options, fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0401-matrix-chat-membership-'));
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0401_membership_${Date.now()}`;
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
    meta: { op_id: `it0401_membership_${action}_${Date.now()}` },
  });
  assert.equal(result.result, 'ok', `${action} must route through Model 0`);
  assert.equal(result.routed_by, 'model0_busin', `${action} must use model0 bus ingress`);
  await wait();
}

function chatLabels(state) {
  return state.clientSnap().models[String(CHAT_APP_MODEL_ID)].cells['0,0,0'].labels;
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

function assertBusEventTarget(node, label) {
  assert.equal(node?.bind?.write?.bus_event_v2, true, `${label} must use bus_event_v2`);
  assert.equal(node?.bind?.write?.bus_in_key, CHAT_BUS_KEY, `${label} must target Matrix Chat Model 0 ingress`);
}

function seedRooms(state, activeRoomId = ROOM_A) {
  const model = state.runtime.getModel(CHAT_APP_MODEL_ID);
  state.runtime.addLabel(model, 0, 0, 0, {
    k: 'rooms_json',
    t: 'json',
    v: [
      { id: ROOM_A, name: 'Leave A', kind: 'room', conversation_group: 'rooms', members: [DROP], member_count: 1, can_leave: true, archived: false },
      { id: ROOM_B, name: 'Leave B', kind: 'room', conversation_group: 'rooms', members: [DROP], member_count: 1, can_leave: true, archived: false },
      {
        id: PEOPLE_ROOM,
        name: 'Drop MBR',
        list_title: 'mbr',
        kind: 'person',
        conversation_group: 'people',
        dm_user_id: MBR,
        dm_display_name: 'mbr',
        members: [DROP, MBR],
        member_count: 2,
        can_leave: true,
        archived: false,
      },
    ],
  });
  state.runtime.addLabel(model, 0, 0, 0, { k: 'active_room_id', t: 'str', v: activeRoomId });
  state.runtime.addLabel(model, 0, 0, 0, { k: 'target_room_id', t: 'str', v: activeRoomId });
}

function seedInviteRoom(state) {
  const model = state.runtime.getModel(CHAT_APP_MODEL_ID);
  state.runtime.addLabel(model, 0, 0, 0, {
    k: 'rooms_json',
    t: 'json',
    v: [{
      id: INVITE_ROOM,
      name: 'Invite From MBR',
      kind: 'invite',
      conversation_group: 'invites',
      invited_by: MBR,
      member_status: 'invite',
      history_status: 'invite',
      power_status: 'invite',
      can_join: true,
      can_leave: true,
      archived: false,
    }],
  });
  state.runtime.addLabel(model, 0, 0, 0, { k: 'active_room_id', t: 'str', v: INVITE_ROOM });
  state.runtime.addLabel(model, 0, 0, 0, { k: 'target_room_id', t: 'str', v: INVITE_ROOM });
}

async function test_leave_room_removes_room_from_active_projection() {
  const calls = [];
  return withServerState({
    matrixSuiteMatrixImpl: {
      leaveRoom: async (input) => {
        calls.push(input);
        return { ok: true };
      },
    },
  }, async (state) => {
    seedRooms(state, ROOM_A);
    await dispatchChat(state, 'leave_room');
    const root = chatLabels(state);
    assert.equal(calls.length, 1, 'leave_room must call Matrix leave');
    assert.equal(calls[0].roomId, ROOM_A);
    assert.equal(root.rooms_json.v.some((room) => room.id === ROOM_A), false, 'left room must be removed from active room list');
    assert.equal(root.active_room_id.v, ROOM_B, 'active selection must move to the next active room');
    assert.equal(root.target_room_id.v, ROOM_B, 'target room must also move to the next active room');
    assert.equal(root.rooms_json.v.some((room) => room.archived === true), false, 'active room list must not keep disabled archived rows');
    return { key: 'leave_room_removes_room_from_active_projection', status: 'PASS' };
  });
}

async function test_delete_friend_removes_people_room_from_people_projection() {
  const calls = [];
  return withServerState({
    matrixSuiteMatrixImpl: {
      leaveRoom: async (input) => {
        calls.push(input);
        return { ok: true };
      },
    },
  }, async (state) => {
    seedRooms(state, PEOPLE_ROOM);
    await dispatchChat(state, 'delete_friend');
    const root = chatLabels(state);
    assert.equal(calls.length, 1, 'delete_friend must call Matrix leave');
    assert.equal(calls[0].roomId, PEOPLE_ROOM);
    assert.equal(root.rooms_json.v.some((room) => room.id === PEOPLE_ROOM), false, 'left People room must be removed from active list');
    assert.equal(root.rooms_json.v.some((room) => room.conversation_group === 'people'), false, 'People tab must not keep stale left one-to-one row');
    assert.equal(root.active_room_id.v, ROOM_A, 'active selection must move to a valid active room');
    return { key: 'delete_friend_removes_people_room_from_people_projection', status: 'PASS' };
  });
}

async function test_refresh_does_not_reintroduce_locally_left_room_when_matrix_omits_it() {
  return withServerState({
    matrixSuiteMatrixImpl: {
      leaveRoom: async () => ({ ok: true }),
      refreshRooms: async () => ({
        ok: true,
        rooms: [
          { room_id: ROOM_B, id: ROOM_B, name: 'Leave B', kind: 'room', conversation_group: 'rooms', members: [DROP], member_count: 1, can_leave: true },
        ],
        events: [],
      }),
    },
  }, async (state) => {
    seedRooms(state, ROOM_A);
    await dispatchChat(state, 'leave_room');
    await dispatchChat(state, 'refresh_rooms');
    const root = chatLabels(state);
    assert.equal(root.rooms_json.v.some((room) => room.id === ROOM_A), false, 'refresh must not reintroduce a room Matrix no longer reports as joined');
    assert.equal(root.active_room_id.v, ROOM_B, 'refresh must keep selection on a valid joined room');
    return { key: 'refresh_does_not_reintroduce_locally_left_room_when_matrix_omits_it', status: 'PASS' };
  });
}

async function test_leave_last_room_clears_active_and_target_room_ids() {
  return withServerState({
    matrixSuiteMatrixImpl: {
      leaveRoom: async () => ({ ok: true }),
    },
  }, async (state) => {
    const model = state.runtime.getModel(CHAT_APP_MODEL_ID);
    state.runtime.addLabel(model, 0, 0, 0, {
      k: 'rooms_json',
      t: 'json',
      v: [{ id: ROOM_A, name: 'Only Room', kind: 'room', conversation_group: 'rooms', members: [DROP], member_count: 1, can_leave: true, archived: false }],
    });
    state.runtime.addLabel(model, 0, 0, 0, { k: 'active_room_id', t: 'str', v: ROOM_A });
    state.runtime.addLabel(model, 0, 0, 0, { k: 'target_room_id', t: 'str', v: ROOM_A });
    await dispatchChat(state, 'leave_room');
    const root = chatLabels(state);
    assert.deepEqual(root.rooms_json.v, [], 'leaving the last room must leave an empty active room list');
    assert.equal(root.active_room_id.v, '', 'active_room_id must not keep a stale deleted room id');
    assert.equal(root.target_room_id.v, '', 'target_room_id must not keep a stale deleted room id');
    assert.match(root.active_room_summary.v, /No active Matrix rooms/u, 'empty state must be explicit');
    return { key: 'leave_last_room_clears_active_and_target_room_ids', status: 'PASS' };
  });
}

async function test_create_dm_then_delete_friend_uses_people_path() {
  const calls = [];
  return withServerState({
    matrixSuiteMatrixImpl: {
      createRoom: async (input) => ({
        ok: true,
        roomId: CREATED_DM_ROOM,
        name: input.name,
        kind: input.kind,
      }),
      leaveRoom: async (input) => {
        calls.push(input);
        return { ok: true };
      },
    },
  }, async (state) => {
    seedRooms(state, ROOM_A);
    await dispatchChat(state, 'create_channel', [
      mt('channel_name', 'str', MBR),
      mt('channel_kind', 'str', 'dm'),
    ]);
    let root = chatLabels(state);
    const created = root.rooms_json.v.find((room) => room.id === CREATED_DM_ROOM);
    assert.equal(created.kind, 'dm', 'created one-to-one room may use dm kind');
    assert.equal(created.conversation_group, 'people', 'created dm must appear in People projection');
    assert.equal(root.active_room_id.v, CREATED_DM_ROOM, 'created dm must become active');

    await dispatchChat(state, 'delete_friend');
    root = chatLabels(state);
    assert.equal(calls.length, 1, 'delete_friend on a created dm must call Matrix leave');
    assert.equal(calls[0].roomId, CREATED_DM_ROOM);
    assert.equal(root.rooms_json.v.some((room) => room.id === CREATED_DM_ROOM), false, 'created dm must be removable through delete_friend');
    assert.equal(root.status_text.v.includes('delete_friend_requires_people_room'), false, 'created dm must not fail People validation');
    return { key: 'create_dm_then_delete_friend_uses_people_path', status: 'PASS' };
  });
}

async function test_refresh_zero_rooms_clears_active_and_target_room_ids() {
  return withServerState({
    matrixSuiteMatrixImpl: {
      refreshRooms: async () => ({ ok: true, rooms: [], events: [] }),
    },
  }, async (state) => {
    seedRooms(state, ROOM_A);
    await dispatchChat(state, 'refresh_rooms');
    const root = chatLabels(state);
    assert.deepEqual(root.rooms_json.v, [], 'zero joined rooms refresh must clear active room list');
    assert.equal(root.active_room_id.v, '', 'zero joined rooms refresh must clear active room id');
    assert.equal(root.target_room_id.v, '', 'zero joined rooms refresh must clear target room id');
    assert.match(root.active_room_summary.v, /No active Matrix rooms/u, 'zero joined rooms refresh must show explicit empty state');
    return { key: 'refresh_zero_rooms_clears_active_and_target_room_ids', status: 'PASS' };
  });
}

async function test_refresh_preserves_dm_kind_as_people_and_delete_friend_works() {
  const calls = [];
  return withServerState({
    matrixSuiteMatrixImpl: {
      refreshRooms: async () => ({
        ok: true,
        rooms: [{
          room_id: CREATED_DM_ROOM,
          id: CREATED_DM_ROOM,
          kind: 'dm',
          name: 'mbr direct',
          list_title: 'mbr',
          members: [DROP, MBR],
          member_count: 2,
          can_leave: true,
        }],
        events: [],
      }),
      leaveRoom: async (input) => {
        calls.push(input);
        return { ok: true };
      },
    },
  }, async (state) => {
    seedRooms(state, ROOM_A);
    await dispatchChat(state, 'refresh_rooms');
    let root = chatLabels(state);
    const refreshedDm = root.rooms_json.v.find((room) => room.id === CREATED_DM_ROOM);
    assert.equal(refreshedDm.kind, 'dm', 'refresh must preserve dm kind');
    assert.equal(refreshedDm.conversation_group, 'people', 'refresh must keep dm in People projection');
    assert.equal(root.active_room_id.v, CREATED_DM_ROOM, 'refreshed dm must become active when it is the only joined room');

    await dispatchChat(state, 'delete_friend');
    root = chatLabels(state);
    assert.equal(calls.length, 1, 'delete_friend after refresh dm must call Matrix leave');
    assert.equal(calls[0].roomId, CREATED_DM_ROOM);
    assert.equal(root.status_text.v.includes('delete_friend_requires_people_room'), false, 'refreshed dm must not fail People validation');
    assert.equal(root.rooms_json.v.some((room) => room.id === CREATED_DM_ROOM), false, 'refreshed dm must be removable through delete_friend');
    return { key: 'refresh_preserves_dm_kind_as_people_and_delete_friend_works', status: 'PASS' };
  });
}

async function test_fetch_rooms_includes_matrix_invites_from_sync() {
  const { fetchMgmtBusConsoleJoinedRooms } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const result = await fetchMgmtBusConsoleJoinedRooms({
    homeserverUrl: 'https://matrix.dongyudigital.com',
    accessToken: 'drop-token',
    userId: DROP,
  }, {
    fetchImpl: async (url) => {
      const parsed = new URL(url);
      const decodedPath = decodeURIComponent(parsed.pathname);
      if (decodedPath.endsWith('/joined_rooms')) {
        return response(200, { joined_rooms: [ROOM_A] });
      }
      if (decodedPath.endsWith(`/user/${DROP}/account_data/m.direct`)) {
        return response(200, {});
      }
      if (decodedPath.endsWith('/sync')) {
        return response(200, {
          rooms: {
            invite: {
              [INVITE_ROOM]: {
                invite_state: {
                  events: [
                    { type: 'm.room.name', content: { name: 'Invite From MBR' } },
                    { type: 'm.room.topic', content: { topic: 'temporary invite' } },
                    { type: 'm.room.member', sender: MBR, state_key: DROP, content: { membership: 'invite', displayname: 'drop' } },
                  ],
                },
              },
            },
          },
        });
      }
      if (decodedPath.includes(`/rooms/${ROOM_A}/state/m.room.name`)) return response(200, { name: 'Joined A' });
      if (decodedPath.includes(`/rooms/${ROOM_A}/state/m.room.canonical_alias`)) return response(404, {});
      if (decodedPath.includes(`/rooms/${ROOM_A}/state/m.room.topic`)) return response(200, { topic: 'joined room' });
      if (decodedPath.includes(`/rooms/${ROOM_A}/state/m.room.power_levels`)) return response(200, { users: { [DROP]: 100 }, users_default: 0, invite: 0, kick: 50 });
      if (decodedPath.includes(`/rooms/${ROOM_A}/joined_members`)) return response(200, { joined: { [DROP]: { display_name: 'drop' } } });
      if (decodedPath.includes(`/rooms/${ROOM_A}/messages`)) return response(200, { chunk: [] });
      return response(404, { errcode: 'M_NOT_FOUND', error: `Unhandled ${decodedPath}` });
    },
  });
  assert.equal(result.ok, true, 'refresh must succeed with joined rooms and invite rooms');
  const invite = result.rooms.find((room) => room.id === INVITE_ROOM);
  assert.ok(invite, 'Matrix invitations from /sync must be projected into the room list');
  assert.equal(invite.kind, 'invite', 'Matrix invite must keep an invite kind');
  assert.equal(invite.conversation_group, 'invites', 'Matrix invite must be filterable as invitations');
  assert.equal(invite.member_status, 'invite', 'Matrix invite must expose invitation status');
  assert.equal(invite.can_join, true, 'Matrix invite must declare it can be accepted');
  assert.equal(invite.invited_by, MBR, 'Matrix invite should expose the inviter');
  return { key: 'fetch_rooms_includes_matrix_invites_from_sync', status: 'PASS' };
}

async function test_accept_invite_joins_then_refreshes_projection() {
  const calls = [];
  return withServerState({
    matrixSuiteMatrixImpl: {
      joinRoom: async (input) => {
        calls.push({ kind: 'joinRoom', input });
        return { ok: true, roomId: input.roomId };
      },
      refreshRooms: async () => {
        calls.push({ kind: 'refreshRooms', input: {} });
        return {
          ok: true,
          rooms: [{
            id: JOINED_INVITE_ROOM,
            room_id: JOINED_INVITE_ROOM,
            name: 'Joined Invite',
            kind: 'room',
            conversation_group: 'rooms',
            members: [DROP, MBR],
            member_count: 2,
            can_invite: true,
            can_kick: true,
            can_leave: true,
          }],
          events: [],
        };
      },
    },
  }, async (state) => {
    seedInviteRoom(state);
    await dispatchChat(state, 'accept_invite');
    const root = chatLabels(state);
    assert.deepEqual(calls.map((call) => call.kind), ['joinRoom', 'refreshRooms'], 'accept_invite must join the invited Matrix room and then refresh real projection');
    assert.equal(calls[0].input.roomId, INVITE_ROOM);
    assert.equal(root.rooms_json.v.some((room) => room.id === INVITE_ROOM), false, 'accepted invite row must not remain as a stale invitation');
    assert.equal(root.rooms_json.v.some((room) => room.id === JOINED_INVITE_ROOM), true, 'accepted room must be visible after refresh');
    assert.equal(root.active_room_id.v, JOINED_INVITE_ROOM, 'accepted room refresh must select a valid joined room');
    assert.match(root.status_text.v, /Accepted Matrix invite/u, 'status must confirm the real accept path');
    return { key: 'accept_invite_joins_then_refreshes_projection', status: 'PASS' };
  });
}

async function test_accept_invite_keeps_invite_when_refresh_fails_after_join() {
  const calls = [];
  return withServerState({
    matrixSuiteMatrixImpl: {
      joinRoom: async (input) => {
        calls.push({ kind: 'joinRoom', input });
        return { ok: true, roomId: input.roomId };
      },
      refreshRooms: async () => {
        calls.push({ kind: 'refreshRooms', input: {} });
        return { ok: false, code: 'matrix_rooms_refresh_failed', detail: 'temporary refresh outage' };
      },
    },
  }, async (state) => {
    seedInviteRoom(state);
    await dispatchChat(state, 'accept_invite');
    const root = chatLabels(state);
    assert.deepEqual(calls.map((call) => call.kind), ['joinRoom', 'refreshRooms'], 'accept_invite must attempt refresh after a successful join');
    assert.equal(root.rooms_json.v.some((room) => room.id === INVITE_ROOM), true, 'refresh failure must not remove the invite row without a fresh Matrix projection');
    assert.equal(root.active_room_id.v, INVITE_ROOM, 'refresh failure must keep selection on the known invite row');
    assert.equal(root.connection_status.v, 'warning', 'join succeeded but refresh failed must be a warning, not a fake online success');
    assert.match(root.status_text.v, /refresh failed.*Refresh/u, 'status must tell the user to refresh again');
    return { key: 'accept_invite_keeps_invite_when_refresh_fails_after_join', status: 'PASS' };
  });
}

function test_matrix_chat_declares_invite_filter_and_accept_control() {
  const rt = loadRuntime();
  const ast = buildAstFromCellwiseModel(rt.snapshot(), CHAT_APP_MODEL_ID);
  const inviteTab = findNode(ast, 'matrix_chat_tab_invites');
  const acceptButton = findNode(ast, 'matrix_chat_accept_invite_button');
  assert.equal(inviteTab?.type, 'TabPane', 'Matrix Chat must expose an Invitations tab');
  assert.equal(inviteTab?.props?.name, 'invites', 'Invitations tab must filter conversation_group=invites');
  assert.equal(acceptButton?.type, 'Button', 'room detail dialog must include an Accept invite button');
  assertBusEventTarget(acceptButton, 'accept invite button');
  assert.match(JSON.stringify(acceptButton?.bind?.write?.value_ref || []), /accept_invite/u, 'accept invite button must emit accept_invite');
  return { key: 'matrix_chat_declares_invite_filter_and_accept_control', status: 'PASS' };
}

const tests = [
  test_fetch_rooms_includes_matrix_invites_from_sync,
  test_leave_room_removes_room_from_active_projection,
  test_delete_friend_removes_people_room_from_people_projection,
  test_refresh_does_not_reintroduce_locally_left_room_when_matrix_omits_it,
  test_leave_last_room_clears_active_and_target_room_ids,
  test_create_dm_then_delete_friend_uses_people_path,
  test_refresh_zero_rooms_clears_active_and_target_room_ids,
  test_refresh_preserves_dm_kind_as_people_and_delete_friend_works,
  test_accept_invite_joins_then_refreshes_projection,
  test_accept_invite_keeps_invite_when_refresh_fails_after_join,
  test_matrix_chat_declares_invite_filter_and_accept_control,
];

for (const test of tests) {
  const result = await test();
  console.log(`${result.key}: ${result.status}`);
}
