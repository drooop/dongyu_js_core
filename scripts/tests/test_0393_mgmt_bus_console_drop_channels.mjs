#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ModelTableRuntime } from '../../packages/worker-base/src/index.mjs';
import {
  createServerState,
  fetchMgmtBusConsoleJoinedRooms,
  resolveMgmtBusConsoleMatrixSession,
} from '../../packages/ui-model-demo-server/server.mjs';
import { buildAstFromCellwiseModel } from '../../packages/ui-model-demo-frontend/src/ui_cellwise_projection.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const serverPath = path.join(repoRoot, 'packages/ui-model-demo-server/server.mjs');

function readServerText() {
  return fs.readFileSync(serverPath, 'utf8');
}

function rootLabel(snapshot, modelId, key) {
  return snapshot?.models?.[String(modelId)]?.cells?.['0,0,0']?.labels?.[key]?.v;
}

function findNodeById(node, id) {
  if (!node || typeof node !== 'object') return null;
  if (node.id === id) return node;
  for (const child of Array.isArray(node.children) ? node.children : []) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

function addMatrixBootstrap(runtime) {
  runtime.createModel({ id: 0, name: 'root', type: 'system' });
  const model0 = runtime.getModel(0);
  runtime.addLabel(model0, 0, 0, 0, { k: 'matrix_server', t: 'matrix.server', v: 'http://matrix.local' });
  runtime.addLabel(model0, 0, 0, 0, { k: 'matrix_user', t: 'matrix.user', v: '@drop:localhost' });
  runtime.addLabel(model0, 0, 0, 0, { k: 'matrix_token', t: 'matrix.token', v: 'SECRET_SHOULD_NOT_RENDER' });
  runtime.addLabel(model0, 0, 0, 0, { k: 'matrix_passwd', t: 'matrix.passwd', v: 'SECRET_SHOULD_NOT_RENDER' });
}

function test_resolves_drop_matrix_session_from_model0_without_render_fields() {
  assert.equal(typeof resolveMgmtBusConsoleMatrixSession, 'function', 'server must export Mgmt Bus Console Matrix session resolver');
  const runtime = new ModelTableRuntime();
  addMatrixBootstrap(runtime);
  const session = resolveMgmtBusConsoleMatrixSession(runtime, {});
  assert.equal(session.ok, true, 'session resolver must accept Model 0 Matrix bootstrap labels');
  assert.equal(session.data.homeserverUrl, 'http://matrix.local');
  assert.equal(session.data.userId, '@drop:localhost');
  assert.equal(session.data.accessToken, 'SECRET_SHOULD_NOT_RENDER');
  assert.doesNotMatch(
    JSON.stringify({
      homeserverUrl: session.data.homeserverUrl,
      userId: session.data.userId,
    }),
    /SECRET_SHOULD_NOT_RENDER|matrix_passwd|password/u,
    'display-safe session fields must not include credentials',
  );

  const noTokenRuntime = new ModelTableRuntime();
  noTokenRuntime.createModel({ id: 0, name: 'root', type: 'system' });
  const noTokenModel0 = noTokenRuntime.getModel(0);
  noTokenRuntime.addLabel(noTokenModel0, 0, 0, 0, { k: 'matrix_server', t: 'matrix.server', v: 'http://matrix.local' });
  noTokenRuntime.addLabel(noTokenModel0, 0, 0, 0, { k: 'matrix_user', t: 'matrix.user', v: '@drop:localhost' });
  const missing = resolveMgmtBusConsoleMatrixSession(noTokenRuntime, {
    MATRIX_ACCESS_TOKEN: 'SECRET_SHOULD_NOT_RENDER',
    MATRIX_USER: '@somebody-else:localhost',
  });
  assert.equal(missing.ok, false, 'resolver must not fall back to non-Model-0 env token for Mgmt Bus Console drop channels');
  assert.equal(missing.code, 'matrix_session_missing');
  return { key: 'resolves_drop_matrix_session_from_model0_without_render_fields', status: 'PASS' };
}

async function test_fetches_joined_rooms_and_room_display_metadata() {
  assert.equal(typeof fetchMgmtBusConsoleJoinedRooms, 'function', 'server must export Mgmt Bus Console joined-room fetcher');
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    if (String(url).endsWith('/_matrix/client/v3/joined_rooms')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ joined_rooms: ['!ops:localhost', '!nameless:localhost'] }),
      };
    }
    if (String(url).includes(encodeURIComponent('!ops:localhost')) && String(url).endsWith('/state/m.room.name')) {
      return { ok: true, status: 200, json: async () => ({ name: 'Drop Operations' }) };
    }
    if (String(url).includes(encodeURIComponent('!ops:localhost')) && String(url).endsWith('/state/m.room.canonical_alias')) {
      return { ok: true, status: 200, json: async () => ({ alias: '#ops:localhost' }) };
    }
    return { ok: false, status: 404, json: async () => ({ errcode: 'M_NOT_FOUND' }) };
  };

  const result = await fetchMgmtBusConsoleJoinedRooms({
    homeserverUrl: 'http://matrix.local',
    accessToken: 'SECRET_SHOULD_NOT_RENDER',
    userId: '@drop:localhost',
  }, { fetchImpl });

  assert.equal(result.ok, true, 'joined-room fetch must succeed');
  assert.deepEqual(result.rooms, [
    { room_id: '!ops:localhost', name: 'Drop Operations', canonical_alias: '#ops:localhost' },
    { room_id: '!nameless:localhost', name: '', canonical_alias: '' },
  ]);
  assert.ok(calls.some((url) => url.includes('/joined_rooms')), 'fetcher must call Matrix joined_rooms');
  assert.ok(calls.some((url) => url.includes('/state/m.room.name')), 'fetcher must read room name state');
  assert.doesNotMatch(JSON.stringify(result.rooms), /SECRET_SHOULD_NOT_RENDER|access_token|password/u);
  return { key: 'fetches_joined_rooms_and_room_display_metadata', status: 'PASS' };
}

async function test_joined_room_fetch_times_out_cleanly() {
  const startedAt = Date.now();
  const fetchImpl = async (_url, init = {}) => new Promise((_resolve, reject) => {
    if (init.signal) {
      init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    }
  });
  await assert.rejects(
    () => fetchMgmtBusConsoleJoinedRooms({
      homeserverUrl: 'http://matrix.local',
      accessToken: 'SECRET_SHOULD_NOT_RENDER',
      userId: '@drop:localhost',
    }, { fetchImpl, timeoutMs: 20 }),
    /aborted|timeout|Abort/u,
  );
  assert.ok(Date.now() - startedAt < 500, 'joined-room fetch timeout must fail quickly');
  return { key: 'joined_room_fetch_times_out_cleanly', status: 'PASS' };
}

function test_server_has_explicit_ui_event_endpoint_for_local_state() {
  const serverText = readServerText();
  assert.match(serverText, /const UI_EVENT_ENDPOINT_PATH = ['"]\/ui_event['"]/u);
  assert.match(
    serverText,
    /url\.pathname === BUS_EVENT_ENDPOINT_PATH \|\| url\.pathname === UI_EVENT_ENDPOINT_PATH/u,
    'server must explicitly accept /ui_event for local UI state sync',
  );
  return { key: 'server_has_explicit_ui_event_endpoint_for_local_state', status: 'PASS' };
}

async function test_submit_envelope_updates_mgmt_console_local_state_like_ui_event() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'dy-0393-ui-event-'));
  const prior = {
    DY_AUTH: process.env.DY_AUTH,
    DY_PERSISTED_ASSET_ROOT: process.env.DY_PERSISTED_ASSET_ROOT,
    WORKER_BASE_WORKSPACE: process.env.WORKER_BASE_WORKSPACE,
    WORKER_BASE_DATA_ROOT: process.env.WORKER_BASE_DATA_ROOT,
    DOCS_ROOT: process.env.DOCS_ROOT,
    STATIC_PROJECTS_ROOT: process.env.STATIC_PROJECTS_ROOT,
  };
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0393_ui_event_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = path.join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = path.join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = path.join(tempRoot, 'static');

  try {
    const state = createServerState({ dbPath: null });
    const result = await state.submitEnvelope({
      event_id: Date.now(),
      type: 'label_update',
      source: 'ui_renderer',
      payload: {
        action: 'label_update',
        meta: { op_id: 'it0393_ui_event_select_subject' },
        target: {
          model_id: 1036,
          p: 0,
          r: 0,
          c: 0,
          k: 'selected_subject_id',
        },
        value: { t: 'str', v: '!ops:localhost' },
      },
    });
    assert.equal(result?.consumed, true, 'server submitEnvelope must consume /ui_event-style local state updates');
    assert.equal(
      state.runtime.getLabelValue(state.runtime.getModel(1036), 0, 0, 0, 'selected_subject_id'),
      '!ops:localhost',
      'Mgmt Bus Console local subject selection must update on server',
    );
  } finally {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(tempRoot, { recursive: true, force: true });
  }
  return { key: 'submit_envelope_updates_mgmt_console_local_state_like_ui_event', status: 'PASS' };
}

async function test_server_refresh_writes_drop_channels_to_mgmt_console_projection() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'dy-0393-drop-channels-'));
  const prior = {
    DY_AUTH: process.env.DY_AUTH,
    DY_PERSISTED_ASSET_ROOT: process.env.DY_PERSISTED_ASSET_ROOT,
    WORKER_BASE_WORKSPACE: process.env.WORKER_BASE_WORKSPACE,
    WORKER_BASE_DATA_ROOT: process.env.WORKER_BASE_DATA_ROOT,
    DOCS_ROOT: process.env.DOCS_ROOT,
    STATIC_PROJECTS_ROOT: process.env.STATIC_PROJECTS_ROOT,
    MODELTABLE_PATCH_JSON: process.env.MODELTABLE_PATCH_JSON,
  };
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0393_drop_channels_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = path.join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = path.join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = path.join(tempRoot, 'static');
  process.env.MODELTABLE_PATCH_JSON = JSON.stringify({
    version: 'mt.v0',
    records: [
      { op: 'add_label', model_id: 0, p: 0, r: 0, c: 0, k: 'matrix_server', t: 'matrix.server', v: 'http://matrix.local' },
      { op: 'add_label', model_id: 0, p: 0, r: 0, c: 0, k: 'matrix_user', t: 'matrix.user', v: '@drop:localhost' },
      { op: 'add_label', model_id: 0, p: 0, r: 0, c: 0, k: 'matrix_token', t: 'matrix.token', v: 'SECRET_SHOULD_NOT_RENDER' },
    ],
  });

  try {
    const state = createServerState({
      dbPath: null,
      mgmtBusConsoleJoinedRoomsImpl: async (session) => {
        assert.equal(session.userId, '@drop:localhost', 'Mgmt Bus Console must use drop Matrix identity');
        return {
          ok: true,
          rooms: [
            { room_id: '!ops:localhost', name: 'Drop Operations', canonical_alias: '#ops:localhost' },
            { room_id: '!general:localhost', name: 'General', canonical_alias: '#general:localhost' },
          ],
        };
      },
    });
    assert.equal(typeof state.refreshMgmtBusConsoleChannels, 'function', 'server state must expose an explicit channel refresh hook');
    const refresh = await state.refreshMgmtBusConsoleChannels();
    assert.equal(refresh.ok, true, 'channel refresh must succeed with injected Matrix fetcher');
    const snapshot = state.clientSnap();
    const subjectRows = rootLabel(snapshot, -2, 'mgmt_bus_console_subject_rows_json');
    assert.deepEqual(subjectRows, [
      {
        label: 'Drop Operations',
        value: '!ops:localhost',
        status: 'joined',
        room_id: '!ops:localhost',
        alias: '#ops:localhost',
        source: 'matrix.joined_room',
      },
      {
        label: 'General',
        value: '!general:localhost',
        status: 'joined',
        room_id: '!general:localhost',
        alias: '#general:localhost',
        source: 'matrix.joined_room',
      },
    ]);
    assert.equal(
      rootLabel(snapshot, 1036, 'selected_subject_tab'),
      'subjects',
      'Mgmt Bus Console subject tabs must declare an active tab so room rows are visible in browser',
    );
    const ast = buildAstFromCellwiseModel(snapshot, 1036);
    const subjectTabs = findNodeById(ast, 'mgmt_bus_subject_tabs');
    assert.deepEqual(
      subjectTabs?.bind?.read,
      { model_id: 1036, p: 0, r: 0, c: 0, k: 'selected_subject_tab' },
      'Mgmt Bus Console subject tabs must read the active tab from ModelTable',
    );
    assert.match(rootLabel(snapshot, -2, 'mgmt_bus_console_timeline_text'), /drop Matrix channels=2/u);
    assert.doesNotMatch(JSON.stringify(subjectRows), /SECRET_SHOULD_NOT_RENDER|matrix_token|password/u);
  } finally {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(tempRoot, { recursive: true, force: true });
  }
  return { key: 'server_refresh_writes_drop_channels_to_mgmt_console_projection', status: 'PASS' };
}

async function main() {
  const tests = [
    test_resolves_drop_matrix_session_from_model0_without_render_fields,
    test_fetches_joined_rooms_and_room_display_metadata,
    test_joined_room_fetch_times_out_cleanly,
    test_server_has_explicit_ui_event_endpoint_for_local_state,
    test_submit_envelope_updates_mgmt_console_local_state_like_ui_event,
    test_server_refresh_writes_drop_channels_to_mgmt_console_projection,
  ];
  const results = [];
  for (const test of tests) {
    results.push(await test());
  }
  console.log(JSON.stringify({ ok: true, results }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
