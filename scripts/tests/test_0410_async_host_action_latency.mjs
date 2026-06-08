#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const CHAT_BUS_KEY = 'matrix_chat_1083_bus_event';
const MGMT_BUS_REFRESH_KEY = 'mgmt_bus_console_refresh';

function delayMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function timeoutMs(ms, label) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`${label}_timeout_${ms}ms`)), ms);
  });
}

function mt(k, t, v) {
  return { id: 0, p: 0, r: 0, c: 0, k, t, v };
}

function uiPayload(action, extra = []) {
  return [
    mt('__mt_payload_kind', 'str', 'ui_event.v1'),
    mt('action', 'str', action),
    ...extra,
  ];
}

async function withIsolatedServerState(options, fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0410-async-host-action-'));
  const prior = {
    DY_AUTH: process.env.DY_AUTH,
    DY_PERSISTED_ASSET_ROOT: process.env.DY_PERSISTED_ASSET_ROOT,
    WORKER_BASE_WORKSPACE: process.env.WORKER_BASE_WORKSPACE,
    WORKER_BASE_DATA_ROOT: process.env.WORKER_BASE_DATA_ROOT,
    DOCS_ROOT: process.env.DOCS_ROOT,
    STATIC_PROJECTS_ROOT: process.env.STATIC_PROJECTS_ROOT,
    DY_UI_SERVER_WORKER_ID: process.env.DY_UI_SERVER_WORKER_ID,
  };
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0410_async_host_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  process.env.DY_UI_SERVER_WORKER_ID = 'U1';
  try {
    const mod = await import(`../../packages/ui-model-demo-server/server.mjs?it0410=${Date.now()}-${Math.random()}`);
    const state = mod.createServerState({ dbPath: null, ...options });
    await state.activateRuntimeMode('running');
    return await fn(state);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function labelValue(runtime, modelId, p, r, c, key) {
  const model = runtime.getModel(modelId);
  return model ? runtime.getLabelValue(model, p, r, c, key) : undefined;
}

async function test_slow_matrix_host_action_does_not_block_unrelated_local_action() {
  let refreshStartedResolve;
  const refreshStarted = new Promise((resolve) => { refreshStartedResolve = resolve; });
  let refreshFinishedResolve;
  const refreshFinished = new Promise((resolve) => { refreshFinishedResolve = resolve; });

  return withIsolatedServerState({
    matrixSuiteMatrixImpl: {
      refreshRooms: async () => {
        refreshStartedResolve();
        await delayMs(800);
        refreshFinishedResolve();
        return { ok: true, rooms: [], events: [] };
      },
    },
  }, async (state) => {
    const rows = labelValue(state.runtime, 1051, 0, 0, 0, 'asset_catalog_json') || [];
    const ordinary = rows.find((row) => row && row.id === 'r1') || rows[0];
    assert.ok(ordinary, 'workspace_asset_catalog_must_have_test_row');

    const first = state.submitEnvelope({
      type: 'bus_event_v2',
      bus_in_key: CHAT_BUS_KEY,
      value: uiPayload('refresh_rooms'),
      meta: { op_id: `it0410_slow_refresh_${Date.now()}` },
    }, {
      matrixSession: {
        homeserverUrl: 'https://matrix.example',
        accessToken: 'matrix-token-a',
        userId: '@a:matrix.example',
      },
    });

    await Promise.race([refreshStarted, timeoutMs(300, 'matrix_refresh_started')]);

    const secondStartedAt = Date.now();
    const secondResult = await state.submitEnvelope({
      type: 'workspace_asset_select',
      payload: {
        action: 'workspace_asset_select',
        value: ordinary,
        meta: { op_id: `it0410_unrelated_select_${Date.now()}` },
      },
    });
    const secondElapsedMs = Date.now() - secondStartedAt;

    assert.equal(secondResult.result, 'ok', 'unrelated workspace action must still complete');
    assert.equal(secondResult.routed_by, 'workspace_asset_select', 'unrelated action must use local workspace path');
    assert.ok(
      secondElapsedMs < 250,
      `unrelated action should not wait for slow Matrix host action; elapsed=${secondElapsedMs}ms`,
    );

    const firstResult = await first;
    assert.equal(firstResult.result, 'ok', 'slow Matrix action submit must still be accepted');
    await Promise.race([refreshFinished, timeoutMs(1200, 'matrix_refresh_finished')]);
    return { key: 'slow_matrix_host_action_does_not_block_unrelated_local_action', status: 'PASS' };
  });
}

async function test_slow_mgmt_bus_refresh_does_not_block_unrelated_local_action() {
  let refreshStartedResolve;
  const refreshStarted = new Promise((resolve) => { refreshStartedResolve = resolve; });
  let refreshFinishedResolve;
  const refreshFinished = new Promise((resolve) => { refreshFinishedResolve = resolve; });

  return withIsolatedServerState({
    mgmtBusConsoleJoinedRoomsImpl: async () => {
      refreshStartedResolve();
      await delayMs(800);
      refreshFinishedResolve();
      return { ok: true, rooms: [] };
    },
  }, async (state) => {
    const rows = labelValue(state.runtime, 1051, 0, 0, 0, 'asset_catalog_json') || [];
    const ordinary = rows.find((row) => row && row.id === 'r1') || rows[0];
    assert.ok(ordinary, 'workspace_asset_catalog_must_have_test_row');

    const first = state.submitEnvelope({
      type: 'bus_event_v2',
      bus_in_key: MGMT_BUS_REFRESH_KEY,
      value: [
        mt('__mt_payload_kind', 'str', 'mgmt_bus_console.refresh.v1'),
        mt('action', 'str', 'refresh'),
      ],
      meta: { op_id: `it0410_slow_mgmt_refresh_${Date.now()}` },
    }, {
      matrixSession: {
        homeserverUrl: 'https://matrix.example',
        accessToken: 'matrix-token-a',
        userId: '@a:matrix.example',
      },
    });

    await Promise.race([refreshStarted, timeoutMs(300, 'mgmt_bus_refresh_started')]);

    const secondStartedAt = Date.now();
    const secondResult = await state.submitEnvelope({
      type: 'workspace_asset_select',
      payload: {
        action: 'workspace_asset_select',
        value: ordinary,
        meta: { op_id: `it0410_unrelated_select_after_mgmt_${Date.now()}` },
      },
    });
    const secondElapsedMs = Date.now() - secondStartedAt;

    assert.equal(secondResult.result, 'ok', 'unrelated workspace action must still complete');
    assert.equal(secondResult.routed_by, 'workspace_asset_select', 'unrelated action must use local workspace path');
    assert.ok(
      secondElapsedMs < 250,
      `unrelated action should not wait for slow management-bus refresh; elapsed=${secondElapsedMs}ms`,
    );

    const firstResult = await first;
    assert.equal(firstResult.result, 'ok', 'slow management-bus refresh submit must still be accepted');
    await Promise.race([refreshFinished, timeoutMs(1200, 'mgmt_bus_refresh_finished')]);
    return { key: 'slow_mgmt_bus_refresh_does_not_block_unrelated_local_action', status: 'PASS' };
  });
}

const tests = [
  test_slow_matrix_host_action_does_not_block_unrelated_local_action,
  test_slow_mgmt_bus_refresh_does_not_block_unrelated_local_action,
];

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
