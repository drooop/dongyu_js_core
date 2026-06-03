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

const CHAT_APP_MODEL_ID = 1083;
const CHAT_BUS_KEY = 'matrix_chat_1083_bus_event';
const workspacePath = 'packages/worker-base/system-models/workspace_positive_models.json';
const hierarchyPath = 'packages/worker-base/system-models/runtime_hierarchy_mounts.json';
const HOMESERVER = 'https://matrix.dongyudigital.com';
const DROP = '@drop:synapse.dongyudigital.com';
const MBR = '@mbr:synapse.dongyudigital.com';
const DONGYU_LOCAL_TEST = '!OOuhOIkNosIGMCescc:synapse.dongyudigital.com';
const BROKEN_ROOM = '!brokenRemote:synapse.dongyudigital.com';

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function mockMatrixFetch(url) {
  const parsed = new URL(url);
  const path = parsed.pathname;
  const decodedPath = decodeURIComponent(path);
  if (decodedPath.endsWith('/joined_rooms')) {
    return Promise.resolve(response(200, { joined_rooms: [DONGYU_LOCAL_TEST, BROKEN_ROOM] }));
  }
  if (decodedPath.endsWith(`/user/${DROP}/account_data/m.direct`)) {
    return Promise.resolve(response(200, {}));
  }
  if (decodedPath.includes(`/rooms/${DONGYU_LOCAL_TEST}/state/m.room.name`)) {
    return Promise.resolve(response(200, { name: 'Dongyu Local Test' }));
  }
  if (decodedPath.includes(`/rooms/${DONGYU_LOCAL_TEST}/state/m.room.canonical_alias`)) {
    return Promise.resolve(response(404, { errcode: 'M_NOT_FOUND', error: 'No alias' }));
  }
  if (decodedPath.includes(`/rooms/${DONGYU_LOCAL_TEST}/state/m.room.topic`)) {
    return Promise.resolve(response(200, { topic: 'drop and mbr DM smoke room' }));
  }
  if (decodedPath.includes(`/rooms/${DONGYU_LOCAL_TEST}/state/m.room.power_levels`)) {
    return Promise.resolve(response(200, { users: { [DROP]: 100 }, users_default: 0, invite: 0, kick: 50 }));
  }
  if (decodedPath.includes(`/rooms/${DONGYU_LOCAL_TEST}/joined_members`)) {
    return Promise.resolve(response(200, {
      joined: {
        [DROP]: { display_name: 'drop' },
        [MBR]: { display_name: 'mbr' },
      },
    }));
  }
  if (decodedPath.includes(`/rooms/${DONGYU_LOCAL_TEST}/messages`)) {
    return Promise.resolve(response(200, {
      chunk: [
        {
          event_id: '$mbr-response',
          room_id: DONGYU_LOCAL_TEST,
          sender: MBR,
          type: 'm.room.message',
          origin_server_ts: 1760000002000,
          content: { msgtype: 'm.text', body: 'mbr reply' },
        },
        {
          event_id: '$drop-request',
          room_id: DONGYU_LOCAL_TEST,
          sender: DROP,
          type: 'm.room.message',
          origin_server_ts: 1760000001000,
          content: { msgtype: 'm.text', body: 'drop request' },
        },
      ],
    }));
  }
  if (decodedPath.includes(`/rooms/${BROKEN_ROOM}/state/m.room.name`)) {
    return Promise.resolve(response(200, { name: 'Remote Matrix Check' }));
  }
  if (decodedPath.includes(`/rooms/${BROKEN_ROOM}/state/m.room.canonical_alias`)) {
    return Promise.resolve(response(404, { errcode: 'M_NOT_FOUND', error: 'No alias' }));
  }
  if (decodedPath.includes(`/rooms/${BROKEN_ROOM}/state/m.room.topic`)) {
    return Promise.resolve(response(404, { errcode: 'M_NOT_FOUND', error: 'No topic' }));
  }
  if (decodedPath.includes(`/rooms/${BROKEN_ROOM}/state/m.room.power_levels`)) {
    return Promise.resolve(response(500, { errcode: 'M_UNKNOWN', error: 'broken power levels' }));
  }
  if (decodedPath.includes(`/rooms/${BROKEN_ROOM}/joined_members`)) {
    return Promise.resolve(response(500, { errcode: 'M_UNKNOWN', error: 'broken members' }));
  }
  if (decodedPath.includes(`/rooms/${BROKEN_ROOM}/messages`)) {
    return Promise.resolve(response(500, { errcode: 'M_UNKNOWN', error: 'broken messages' }));
  }
  return Promise.resolve(response(404, { errcode: 'M_NOT_FOUND', error: `Unhandled ${decodedPath}` }));
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

function readJson(pathname) {
  return JSON.parse(fs.readFileSync(pathname, 'utf8'));
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

async function withServerState(options, fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0400-matrix-chat-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0400_${Date.now()}`;
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
    meta: { op_id: `it0400_${action}_${Date.now()}` },
  });
  assert.equal(result.result, 'ok', `${action} must route through Model 0`);
  await wait();
}

function chatLabels(state) {
  return state.clientSnap().models[String(CHAT_APP_MODEL_ID)].cells['0,0,0'].labels;
}

async function test_fetch_joined_rooms_enriches_people_rooms_permissions_and_history() {
  const { fetchMgmtBusConsoleJoinedRooms } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const result = await fetchMgmtBusConsoleJoinedRooms({
    homeserverUrl: HOMESERVER,
    accessToken: 'token',
    userId: DROP,
  }, { fetchImpl: mockMatrixFetch, timeoutMs: 1000, messageLimit: 5 });

  assert.equal(result.ok, true, 'joined rooms fetch must succeed even when one room has partial API failures');
  assert.equal(result.rooms.length, 2);
  const peopleRoom = result.rooms.find((room) => room.room_id === DONGYU_LOCAL_TEST);
  assert.equal(peopleRoom.kind, 'person', 'drop+mbr two-member room without m.direct must be identified as a People/1v1 room, not a formal DM');
  assert.equal(peopleRoom.conversation_group, 'people', 'People tab must include two-person rooms even when Matrix m.direct is empty');
  assert.equal(peopleRoom.is_direct, false, 'Matrix m.direct is empty, so the room must not claim formal direct status');
  assert.equal(peopleRoom.dm_user_id, MBR, 'mbr must be identified as the one-to-one peer');
  assert.equal(peopleRoom.list_title, 'mbr', 'People list title must show the peer instead of the room name');
  assert.match(peopleRoom.list_subtitle, /Dongyu Local Test/u, 'People list subtitle must preserve the Matrix room name');
  assert.equal(peopleRoom.member_status, 'ok');
  assert.equal(peopleRoom.history_status, 'ok');
  assert.equal(peopleRoom.power_status, 'ok');
  assert.equal(peopleRoom.can_invite, true);
  assert.equal(peopleRoom.can_kick, true);
  assert.ok(peopleRoom.members.some((member) => member.includes(MBR)), 'member labels must include mbr');
  assert.ok(result.events.some((event) => event.event_id === '$mbr-response' && event.body === 'mbr reply'), 'history must be projected to timeline events');

  const broken = result.rooms.find((room) => room.room_id === BROKEN_ROOM);
  assert.equal(broken.member_status, 'error', 'member failure must be local to the room');
  assert.equal(broken.history_status, 'error', 'history failure must be local to the room');
  assert.equal(broken.power_status, 'error', 'permission failure must be local to the room');
  assert.equal(broken.name, 'Remote Matrix Check');
  return { key: 'fetch_joined_rooms_enriches_people_rooms_permissions_and_history', status: 'PASS' };
}

async function test_matrix_chat_refresh_materializes_enriched_rooms_and_timeline() {
  const calls = [];
  return withServerState({
    matrixSuiteMatrixImpl: {
      refreshRooms: async () => ({
        ok: true,
        rooms: [
          {
            room_id: DONGYU_LOCAL_TEST,
            name: 'Dongyu Local Test',
            kind: 'person',
            conversation_group: 'people',
            is_direct: false,
            dm_user_id: MBR,
            dm_display_name: 'mbr',
            list_title: 'mbr',
            list_subtitle: 'Dongyu Local Test · @mbr:synapse.dongyudigital.com: mbr reply',
            members: [`drop (${DROP})`, `mbr (${MBR})`],
            member_objects: [
              { user_id: DROP, display_name: 'drop', label: `drop (${DROP})` },
              { user_id: MBR, display_name: 'mbr', label: `mbr (${MBR})` },
            ],
            member_status: 'ok',
            history_status: 'ok',
            power_status: 'ok',
            can_invite: true,
            can_kick: true,
            can_leave: true,
            last_message: `${MBR}: mbr reply`,
          },
          {
            room_id: BROKEN_ROOM,
            name: 'Remote Matrix Check',
            member_status: 'error',
            member_error: { code: 'M_UNKNOWN', detail: 'broken members' },
            history_status: 'error',
            history_error: { code: 'M_UNKNOWN', detail: 'broken messages' },
            power_status: 'error',
            power_error: { code: 'M_UNKNOWN', detail: 'broken power levels' },
            members: [],
          },
        ],
        events: [
          {
            event_id: '$existing-local',
            room_id: DONGYU_LOCAL_TEST,
            sender: DROP,
            type: 'm.room.message',
            msgtype: 'm.text',
            body: 'confirmed local echo',
            ts: '09:59',
          },
          {
            event_id: '$mbr-response',
            room_id: DONGYU_LOCAL_TEST,
            sender: MBR,
            type: 'm.room.message',
            msgtype: 'm.text',
            body: 'mbr reply',
            ts: '10:00',
          },
        ],
      }),
      inviteMember: async (input) => {
        calls.push({ kind: 'inviteMember', input });
        return { ok: true };
      },
      removeMember: async (input) => {
        calls.push({ kind: 'removeMember', input });
        return { ok: true };
      },
      leaveRoom: async (input) => {
        calls.push({ kind: 'leaveRoom', input });
        return { ok: true };
      },
      createRoom: async (input) => {
        calls.push({ kind: 'createRoom', input });
        return {
          ok: true,
          roomId: '!created0400:synapse.dongyudigital.com',
          name: input.name,
          kind: input.kind,
        };
      },
    },
  }, async (state) => {
    const model = state.runtime.getModel(CHAT_APP_MODEL_ID);
    state.runtime.addLabel(model, 0, 0, 0, {
      k: 'timeline_json',
      t: 'json',
      v: [
        {
          event_id: '$existing-local',
          room_id: DONGYU_LOCAL_TEST,
          sender: DROP,
          type: 'm.room.message',
          msgtype: 'm.text',
          body: 'optimistic local echo',
          ts: '09:58',
        },
        {
          event_id: '$local-only',
          room_id: DONGYU_LOCAL_TEST,
          sender: DROP,
          type: 'm.room.message',
          msgtype: 'm.text',
          body: 'local-only message',
          ts: '09:57',
        },
      ],
    });
    await dispatchChat(state, 'refresh_rooms');
    let root = chatLabels(state);
    assert.equal(root.active_room_id.v, DONGYU_LOCAL_TEST, 'refresh must select the real mbr one-to-one room');
    assert.equal(root.active_room_name.v, 'mbr', 'active People title must show the peer display name');
    assert.match(root.active_room_summary.v, /1v1 room with mbr/u, 'summary must expose the mbr one-to-one peer without claiming Matrix DM');
    assert.match(root.active_room_summary.v, /invite=yes/u, 'summary must expose room permissions');
    const mbrRoom = root.rooms_json.v.find((room) => room.id === DONGYU_LOCAL_TEST);
    assert.equal(mbrRoom.kind, 'person', 'rooms_json must not claim a formal DM when m.direct is empty');
    assert.equal(mbrRoom.conversation_group, 'people', 'rooms_json must place the mbr one-to-one room in People');
    assert.equal(mbrRoom.list_title, 'mbr', 'rooms_json must expose mbr as the People list title');
    assert.match(mbrRoom.list_subtitle, /Dongyu Local Test/u, 'rooms_json must keep the Matrix room name as People subtitle');
    assert.ok(root.rooms_json.v.some((room) => room.id === BROKEN_ROOM && room.member_status === 'error'), 'partial room failures must be visible in rooms_json');
    assert.ok(root.timeline_json.v.some((event) => event.event_id === '$mbr-response'), 'refresh must materialize timeline events');
    assert.ok(root.timeline_json.v.some((event) => event.event_id === '$local-only'), 'refresh must preserve existing local timeline entries');
    assert.equal(root.timeline_json.v.filter((event) => event.event_id === '$existing-local').length, 1, 'refresh must de-duplicate echoed events by event id');
    assert.ok(root.timeline_json.v.some((event) => event.event_id === '$existing-local' && event.body === 'confirmed local echo'), 'refresh should prefer the confirmed Matrix event for duplicate ids');
    assert.match(root.room_detail_markdown.v, /mbr/u, 'room detail must include members');

    await dispatchChat(state, 'select_room', [mt('room_id', 'str', DONGYU_LOCAL_TEST)]);
    root = chatLabels(state);
    assert.equal(root.active_room_name.v, 'mbr', 'select_room must preserve the peer display name for People rooms');
    assert.match(root.active_room_summary.v, /1v1 room with mbr/u, 'select_room must preserve enriched People peer summary');
    assert.match(root.active_room_summary.v, /invite=yes/u, 'select_room must preserve permission summary');

    await dispatchChat(state, 'select_filter', [mt('filter', 'str', 'people')]);
    root = chatLabels(state);
    assert.equal(root.conversation_filter.v, 'people', 'People tab action must persist the model-backed conversation filter');

    await dispatchChat(state, 'create_channel', [
      mt('channel_name', 'str', '0400 Created Room'),
      mt('channel_kind', 'str', 'room'),
    ]);
    root = chatLabels(state);
    assert.equal(root.active_room_id.v, '!created0400:synapse.dongyudigital.com');
    assert.match(root.active_room_summary.v, /Room · 1 member\(s\) · invite=yes, remove=yes, leave=yes/u, 'created room must project owner permissions immediately');
    assert.ok(root.rooms_json.v.some((room) => room.id === '!created0400:synapse.dongyudigital.com' && room.can_invite === true && room.can_kick === true), 'created room model record must carry owner permission flags');

    await dispatchChat(state, 'invite_member', [mt('user_id', 'str', '@new:synapse.dongyudigital.com')]);
    root = chatLabels(state);
    assert.ok(root.rooms_json.v.some((room) => room.id === '!created0400:synapse.dongyudigital.com' && room.pending_invites?.includes('@new:synapse.dongyudigital.com')), 'invite_member must record pending invite on the selected room');
    await dispatchChat(state, 'remove_member', [mt('user_id', 'str', '@new:synapse.dongyudigital.com')]);
    root = chatLabels(state);
    assert.ok(root.rooms_json.v.some((room) => room.id === '!created0400:synapse.dongyudigital.com' && !(room.pending_invites || []).includes('@new:synapse.dongyudigital.com')), 'remove_member must clear a matching pending invite');
    calls.length = 0;

    await dispatchChat(state, 'select_room', [mt('room_id', 'str', DONGYU_LOCAL_TEST)]);
    await dispatchChat(state, 'invite_member', [mt('user_id', 'str', '@new:synapse.dongyudigital.com')]);
    await dispatchChat(state, 'remove_member', [mt('user_id', 'str', MBR)]);
    await dispatchChat(state, 'delete_friend');
    let currentRoot = chatLabels(state);
    const memberCalls = calls.filter((call) => ['inviteMember', 'removeMember', 'leaveRoom'].includes(call.kind));
    assert.deepEqual(memberCalls.map((call) => call.kind), ['inviteMember', 'removeMember', 'leaveRoom'], 'member actions must call the Matrix host adapter');
    assert.equal(memberCalls[0].input.roomId, DONGYU_LOCAL_TEST);
    assert.equal(memberCalls[0].input.userId, '@new:synapse.dongyudigital.com');
    assert.equal(memberCalls[1].input.userId, MBR);
    assert.equal(currentRoot.rooms_json.v.some((room) => room.id === DONGYU_LOCAL_TEST), false, 'delete_friend must remove the left DM room from active rooms');

    await dispatchChat(state, 'leave_room');
    currentRoot = chatLabels(state);
    assert.equal(calls.filter((call) => call.kind === 'leaveRoom').length, 2, 'leave_room must call the Matrix leave adapter');
    assert.equal(currentRoot.rooms_json.v.some((room) => room.id === BROKEN_ROOM), false, 'leave_room must remove the selected fallback room after Matrix leave succeeds');
    return { key: 'matrix_chat_refresh_materializes_enriched_rooms_and_timeline', status: 'PASS' };
  });
}

async function test_matrix_chat_member_post_retries_transient_network_error() {
  const roomId = '!retry0400:synapse.dongyudigital.com';
  return withServerState({}, async (state) => {
    const model0 = state.runtime.getModel(0);
    state.runtime.addLabel(model0, 0, 0, 0, { k: 'matrix_server', t: 'matrix.server', v: HOMESERVER });
    state.runtime.addLabel(model0, 0, 0, 0, { k: 'matrix_token', t: 'matrix.token', v: 'token' });
    state.runtime.addLabel(model0, 0, 0, 0, { k: 'matrix_user', t: 'matrix.user', v: DROP });

    const model = state.runtime.getModel(CHAT_APP_MODEL_ID);
    state.runtime.addLabel(model, 0, 0, 0, {
      k: 'rooms_json',
      t: 'json',
      v: [{
        id: roomId,
        kind: 'room',
        name: 'Retry Room',
        members: [`drop (${DROP})`, `mbr (${MBR})`],
        member_objects: [
          { user_id: DROP, label: `drop (${DROP})` },
          { user_id: MBR, label: `mbr (${MBR})` },
        ],
        member_count: 2,
        pending_invites: [MBR],
        can_invite: true,
        can_kick: true,
        can_leave: true,
      }],
    });
    state.runtime.addLabel(model, 0, 0, 0, { k: 'active_room_id', t: 'str', v: roomId });

    const originalFetch = globalThis.fetch;
    let attempts = 0;
    globalThis.fetch = async (url, options) => {
      attempts += 1;
      assert.match(String(url), new RegExp(`/rooms/${encodeURIComponent(roomId)}/kick$`, 'u'), 'remove_member must call the Matrix kick endpoint');
      assert.equal(options?.method, 'POST');
      if (attempts === 1) {
        const err = new Error('The socket connection was closed unexpectedly');
        err.code = 'UND_ERR_SOCKET';
        throw err;
      }
      return response(200, {});
    };
    try {
      await dispatchChat(state, 'remove_member', [mt('user_id', 'str', MBR)]);
    } finally {
      globalThis.fetch = originalFetch;
    }

    const root = chatLabels(state);
    const room = root.rooms_json.v.find((item) => item.id === roomId);
    assert.equal(attempts, 2, 'transient Matrix POST failures must be retried once');
    assert.ok(!(room.pending_invites || []).includes(MBR), 'successful retry must still clear pending invite');
    assert.equal(root.connection_status.v, 'online');
    assert.match(root.status_text.v, /Removed @mbr:synapse\.dongyudigital\.com via Matrix/u);
    return { key: 'matrix_chat_member_post_retries_transient_network_error', status: 'PASS' };
  });
}

function test_matrix_chat_room_detail_declares_member_action_controls() {
  const rt = loadRuntime();
  const ast = buildAstFromCellwiseModel(rt.snapshot(), CHAT_APP_MODEL_ID);
  const inviteInput = findNode(ast, 'matrix_chat_invite_user_input');
  const inviteButton = findNode(ast, 'matrix_chat_invite_button');
  const removeInput = findNode(ast, 'matrix_chat_remove_user_input');
  const removeButton = findNode(ast, 'matrix_chat_remove_button');
  const leaveButton = findNode(ast, 'matrix_chat_leave_room_button');
  const deleteFriendButton = findNode(ast, 'matrix_chat_delete_friend_button');

  assert.equal(inviteInput?.type, 'Input', 'room detail dialog must include invite user input');
  assert.equal(inviteInput?.bind?.write?.target_ref?.k, 'invite_user_id_draft', 'invite input must write a model label');
  assert.equal(removeInput?.type, 'Input', 'room detail dialog must include remove user input');
  assert.equal(removeInput?.bind?.write?.target_ref?.k, 'remove_user_id_draft', 'remove input must write a model label');
  for (const [node, label, action] of [
    [inviteButton, 'invite button', 'invite_member'],
    [removeButton, 'remove button', 'remove_member'],
    [leaveButton, 'leave room button', 'leave_room'],
    [deleteFriendButton, 'delete friend button', 'delete_friend'],
  ]) {
    assertBusEventTarget(node, label);
    assert.match(JSON.stringify(node?.bind?.write?.value_ref || []), new RegExp(action, 'u'), `${label} must emit ${action}`);
  }
  return { key: 'matrix_chat_room_detail_declares_member_action_controls', status: 'PASS' };
}

const tests = [
  test_fetch_joined_rooms_enriches_people_rooms_permissions_and_history,
  test_matrix_chat_refresh_materializes_enriched_rooms_and_timeline,
  test_matrix_chat_member_post_retries_transient_network_error,
  test_matrix_chat_room_detail_declares_member_action_controls,
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
