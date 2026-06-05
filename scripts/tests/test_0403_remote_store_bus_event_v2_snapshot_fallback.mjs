#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createRemoteStore } from '../../packages/ui-model-demo-frontend/src/remote_store.js';

const CHAT_APP_MODEL_ID = 1083;
const CHAT_BUS_KEY = 'matrix_chat_1083_bus_event';

const originalFetch = globalThis.fetch;
const originalEventSource = globalThis.EventSource;

function snapshotWithRoom(roomId, name) {
  return {
    models: {
      [String(CHAT_APP_MODEL_ID)]: {
        cells: {
          '0,0,0': {
            labels: {
              rooms_json: {
                k: 'rooms_json',
                t: 'json',
                v: [{ id: roomId, name }],
              },
            },
          },
        },
      },
    },
    v1nConfig: { local_mqtt: null, global_mqtt: null },
  };
}

function roomId(store) {
  return store.snapshot?.models?.[String(CHAT_APP_MODEL_ID)]
    ?.cells?.['0,0,0']?.labels?.rooms_json?.v?.[0]?.id || '';
}

function busEventV2Label(opId = '0403_refresh_fallback') {
  return {
    p: 0,
    r: 0,
    c: 0,
    k: 'bus_in_event',
    t: 'event',
    v: {
      type: 'bus_event_v2',
      bus_in_key: CHAT_BUS_KEY,
      value: [
        { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'ui_event.v1' },
        { id: 0, p: 0, r: 0, c: 0, k: 'action', t: 'str', v: 'refresh_rooms' },
      ],
      meta: { op_id: opId, source: 'ui_renderer' },
    },
  };
}

function jsonResponse(body) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: () => 'application/json' },
    async json() { return body; },
    async text() { return JSON.stringify(body); },
  };
}

async function withRemoteStore({ busEventBody, snapshotBody }, fn) {
  const calls = [];
  globalThis.EventSource = class FakeEventSource {
    addEventListener() {}
    close() {}
  };
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET' });
    if (String(url).endsWith('/bus_event')) return jsonResponse(busEventBody);
    if (String(url).endsWith('/snapshot')) return jsonResponse({ snapshot: snapshotBody });
    throw new Error(`unexpected fetch ${url}`);
  };
  const store = createRemoteStore({ baseUrl: 'http://127.0.0.1:30900', autoBootstrap: false });
  store.snapshot.models = snapshotWithRoom('!seed:ui.local', 'Seed Room').models;
  store.snapshot.v1nConfig = { local_mqtt: null, global_mqtt: null };
  try {
    await fn({ store, calls });
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
  }
}

async function test_bus_event_v2_success_without_snapshot_fetches_latest_snapshot() {
  await withRemoteStore({
    busEventBody: { ok: true, consumed: true, result: 'ok' },
    snapshotBody: snapshotWithRoom('!remote:synapse.dongyudigital.com', 'Remote Room'),
  }, async ({ store, calls }) => {
    await store.dispatchAddLabel(busEventV2Label());
    assert.equal(roomId(store), '!remote:synapse.dongyudigital.com');
    assert.equal(calls.filter((call) => call.url.endsWith('/snapshot')).length, 1);
  });
  return { key: 'bus_event_v2_success_without_snapshot_fetches_latest_snapshot', status: 'PASS' };
}

async function test_bus_event_v2_response_snapshot_does_not_fetch_fallback_snapshot() {
  await withRemoteStore({
    busEventBody: {
      ok: true,
      consumed: true,
      result: 'ok',
      snapshot: snapshotWithRoom('!response:synapse.dongyudigital.com', 'Response Room'),
    },
    snapshotBody: snapshotWithRoom('!fallback:synapse.dongyudigital.com', 'Fallback Room'),
  }, async ({ store, calls }) => {
    await store.dispatchAddLabel(busEventV2Label('0403_response_snapshot'));
    assert.equal(roomId(store), '!response:synapse.dongyudigital.com');
    assert.equal(calls.filter((call) => call.url.endsWith('/snapshot')).length, 0);
  });
  return { key: 'bus_event_v2_response_snapshot_does_not_fetch_fallback_snapshot', status: 'PASS' };
}

async function test_bus_event_v2_error_without_snapshot_fetches_latest_snapshot() {
  await withRemoteStore({
    busEventBody: { ok: true, consumed: true, result: 'error', code: 'matrix_session_missing' },
    snapshotBody: snapshotWithRoom('!fallback:synapse.dongyudigital.com', 'Fallback Room'),
  }, async ({ store, calls }) => {
    await store.dispatchAddLabel(busEventV2Label('0403_error_snapshot'));
    assert.equal(roomId(store), '!fallback:synapse.dongyudigital.com');
    assert.equal(calls.filter((call) => call.url.endsWith('/snapshot')).length, 1);
  });
  return { key: 'bus_event_v2_error_without_snapshot_fetches_latest_snapshot', status: 'PASS' };
}

const tests = [
  test_bus_event_v2_success_without_snapshot_fetches_latest_snapshot,
  test_bus_event_v2_response_snapshot_does_not_fetch_fallback_snapshot,
  test_bus_event_v2_error_without_snapshot_fetches_latest_snapshot,
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
