#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRemoteStore } from '../../packages/ui-model-demo-frontend/src/remote_store.js';
import { buildAppShellStateUpdateLabel } from '../../packages/ui-model-demo-frontend/src/app_shell_state_dispatch.js';
import { DESKTOP_FOREGROUND_APP_LABEL } from '../../packages/ui-model-demo-frontend/src/desktop_app_state.js';
import { createServerState } from '../../packages/ui-model-demo-server/server.mjs';

const EDITOR_STATE_MODEL_ID = -2;
const DEMO_APP_SOURCE_PATH = 'packages/ui-model-demo-frontend/src/demo_app.js';

function snapshotWithState(labels = {}) {
  return {
    models: {
      [String(EDITOR_STATE_MODEL_ID)]: {
        cells: {
          '0,0,0': { labels },
        },
      },
    },
    v1nConfig: { local_mqtt: null, global_mqtt: null },
  };
}

function stateLabel(snapshot, key) {
  return snapshot?.models?.[String(EDITOR_STATE_MODEL_ID)]?.cells?.['0,0,0']?.labels?.[key]?.v;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function test_server_persists_editor_state_label_update() {
  const state = createServerState({ dbPath: null });
  const app = {
    id: 'workspace:100',
    kind: 'workspace',
    page: 'workspace',
    path: '/workspace',
    title: 'E2E 颜色生成器',
    model_id: 100,
  };
  const result = await state.submitEnvelope({
    event_id: 1,
    type: 'label_update',
    source: 'ui_renderer',
    ts: 0,
    payload: {
      action: 'label_update',
      target: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: DESKTOP_FOREGROUND_APP_LABEL },
      value: { t: 'json', v: app },
      meta: { op_id: '0388_server_state_update' },
    },
  });
  assert.equal(result.result, 'ok', 'server must accept editor-state label_update as UI-local state');
  assert.deepEqual(
    state.runtime.getLabelValue(state.runtime.getModel(EDITOR_STATE_MODEL_ID), 0, 0, 0, DESKTOP_FOREGROUND_APP_LABEL),
    app,
    'server must persist desktop foreground app label_update',
  );
}

async function test_remote_store_posts_ui_local_state_to_bus_event_endpoint() {
  const initialSnapshot = snapshotWithState({
    [DESKTOP_FOREGROUND_APP_LABEL]: { k: DESKTOP_FOREGROUND_APP_LABEL, t: 'json', v: null },
  });
  const calls = [];
  const originalFetch = globalThis.fetch;
  const originalEventSource = globalThis.EventSource;
  class FakeEventSource {
    constructor() {
      this.listeners = {};
    }
    addEventListener(name, handler) {
      this.listeners[name] = handler;
    }
  }
  globalThis.EventSource = FakeEventSource;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET' });
    if (String(url).endsWith('/snapshot')) {
      return { ok: true, json: async () => ({ snapshot: initialSnapshot }) };
    }
    if (String(url).endsWith('/api/runtime/mode')) {
      return { ok: true, headers: new Map([['content-type', 'application/json']]), json: async () => ({ ok: true }) };
    }
    if (String(url).endsWith('/bus_event')) {
      return { ok: true, headers: new Map([['content-type', 'application/json']]), json: async () => ({ ok: true }) };
    }
    return { ok: false, status: 404, statusText: 'not found', text: async () => 'not found', headers: new Map([['content-type', 'text/plain']]) };
  };

  try {
    const store = createRemoteStore({ baseUrl: 'http://127.0.0.1:30900' });
    await wait(0);
    const app = {
      id: 'workspace:100',
      kind: 'workspace',
      page: 'workspace',
      path: '/workspace',
      title: 'E2E 颜色生成器',
      model_id: 100,
    };
    store.dispatchAddLabel(buildAppShellStateUpdateLabel({
      target: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: DESKTOP_FOREGROUND_APP_LABEL },
      value: { t: 'json', v: app },
    }));
    await wait(260);
    assert.equal(
      calls.some((call) => call.method === 'POST' && call.url.endsWith('/ui_event')),
      false,
      'remote store must not post shell UI-local state to nonexistent /ui_event',
    );
    assert.equal(
      calls.some((call) => call.method === 'POST' && call.url.endsWith('/bus_event')),
      true,
      'remote store must sync shell UI-local state through /bus_event',
    );
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
  }
}

async function test_pending_shell_state_survives_stale_snapshot() {
  const staleSnapshot = snapshotWithState({
    [DESKTOP_FOREGROUND_APP_LABEL]: { k: DESKTOP_FOREGROUND_APP_LABEL, t: 'json', v: null },
  });
  const originalFetch = globalThis.fetch;
  const originalEventSource = globalThis.EventSource;
  const eventSources = [];
  class FakeEventSource {
    constructor() {
      this.listeners = {};
      eventSources.push(this);
    }
    addEventListener(name, handler) {
      this.listeners[name] = handler;
    }
  }
  globalThis.EventSource = FakeEventSource;
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).endsWith('/snapshot')) {
      return { ok: true, json: async () => ({ snapshot: clone(staleSnapshot) }) };
    }
    if (String(url).endsWith('/api/runtime/mode')) {
      return { ok: true, headers: new Map([['content-type', 'application/json']]), json: async () => ({ ok: true }) };
    }
    if (String(url).endsWith('/bus_event')) {
      return { ok: true, headers: new Map([['content-type', 'application/json']]), json: async () => ({ ok: true }) };
    }
    return { ok: false, status: 404, statusText: 'not found', text: async () => 'not found', headers: new Map([['content-type', 'text/plain']]) };
  };

  try {
    const store = createRemoteStore({ baseUrl: 'http://127.0.0.1:30900' });
    await wait(0);
    await wait(0);
    const app = {
      id: 'workspace:100',
      kind: 'workspace',
      page: 'workspace',
      path: '/workspace',
      title: 'E2E 颜色生成器',
      model_id: 100,
    };
    store.dispatchAddLabel(buildAppShellStateUpdateLabel({
      target: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: DESKTOP_FOREGROUND_APP_LABEL },
      value: { t: 'json', v: app },
    }));
    assert.deepEqual(stateLabel(store.snapshot, DESKTOP_FOREGROUND_APP_LABEL), app, 'click should update shell state immediately');
    const es = eventSources[0];
    assert.ok(es?.listeners?.snapshot, 'test must capture remote store SSE snapshot listener');
    es.listeners.snapshot({ data: JSON.stringify({ snapshot: clone(staleSnapshot) }) });
    assert.deepEqual(
      stateLabel(store.snapshot, DESKTOP_FOREGROUND_APP_LABEL),
      app,
      'stale SSE snapshot must not overwrite pending foreground shell state',
    );
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
  }
}

async function test_sent_shell_state_survives_stale_snapshot_until_confirmed() {
  const staleSnapshot = snapshotWithState({
    [DESKTOP_FOREGROUND_APP_LABEL]: { k: DESKTOP_FOREGROUND_APP_LABEL, t: 'json', v: null },
  });
  const originalFetch = globalThis.fetch;
  const originalEventSource = globalThis.EventSource;
  const eventSources = [];
  class FakeEventSource {
    constructor() {
      this.listeners = {};
      eventSources.push(this);
    }
    addEventListener(name, handler) {
      this.listeners[name] = handler;
    }
  }
  globalThis.EventSource = FakeEventSource;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/snapshot')) {
      return { ok: true, json: async () => ({ snapshot: clone(staleSnapshot) }) };
    }
    if (String(url).endsWith('/api/runtime/mode')) {
      return { ok: true, headers: new Map([['content-type', 'application/json']]), json: async () => ({ ok: true }) };
    }
    if (String(url).endsWith('/bus_event')) {
      return { ok: true, headers: new Map([['content-type', 'application/json']]), json: async () => ({ ok: true, result: 'ok' }) };
    }
    return { ok: false, status: 404, statusText: 'not found', text: async () => 'not found', headers: new Map([['content-type', 'text/plain']]) };
  };

  try {
    const store = createRemoteStore({ baseUrl: 'http://127.0.0.1:30900' });
    await wait(0);
    await wait(0);
    const app = {
      id: 'workspace:100',
      kind: 'workspace',
      page: 'workspace',
      path: '/workspace',
      title: 'E2E 颜色生成器',
      model_id: 100,
    };
    store.dispatchAddLabel(buildAppShellStateUpdateLabel({
      target: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: DESKTOP_FOREGROUND_APP_LABEL },
      value: { t: 'json', v: app },
    }));
    await wait(260);
    const es = eventSources[0];
    es.listeners.snapshot({ data: JSON.stringify({ snapshot: clone(staleSnapshot) }) });
    assert.deepEqual(
      stateLabel(store.snapshot, DESKTOP_FOREGROUND_APP_LABEL),
      app,
      'successful /bus_event response must not clear pending state before confirming snapshot arrives',
    );
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
  }
}

async function test_foreground_workspace_click_updates_selected_workspace_model_locally() {
  const initialSnapshot = snapshotWithState({
    [DESKTOP_FOREGROUND_APP_LABEL]: { k: DESKTOP_FOREGROUND_APP_LABEL, t: 'json', v: null },
    ws_app_selected: { k: 'ws_app_selected', t: 'int', v: 1082 },
  });
  const originalFetch = globalThis.fetch;
  const originalEventSource = globalThis.EventSource;
  class FakeEventSource {
    addEventListener() {}
  }
  globalThis.EventSource = FakeEventSource;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/snapshot')) {
      return { ok: true, json: async () => ({ snapshot: clone(initialSnapshot) }) };
    }
    if (String(url).endsWith('/api/runtime/mode')) {
      return { ok: true, headers: new Map([['content-type', 'application/json']]), json: async () => ({ ok: true }) };
    }
    if (String(url).endsWith('/bus_event')) {
      return { ok: true, headers: new Map([['content-type', 'application/json']]), json: async () => ({ ok: true }) };
    }
    return { ok: false, status: 404, statusText: 'not found', text: async () => 'not found', headers: new Map([['content-type', 'text/plain']]) };
  };

  try {
    const store = createRemoteStore({ baseUrl: 'http://127.0.0.1:30900' });
    await wait(0);
    await wait(0);
    const app = {
      id: 'workspace:100',
      kind: 'workspace',
      page: 'workspace',
      path: '/workspace',
      title: 'E2E 颜色生成器',
      model_id: 100,
    };
    store.dispatchAddLabel(buildAppShellStateUpdateLabel({
      target: { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: DESKTOP_FOREGROUND_APP_LABEL },
      value: { t: 'json', v: app },
    }));
    assert.equal(
      stateLabel(store.snapshot, 'ws_app_selected'),
      100,
      'workspace foreground launch must update selected workspace app immediately',
    );
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
  }
}

function test_app_shell_does_not_queue_workspace_selection_or_hash_before_foreground() {
  const source = readFileSync(DEMO_APP_SOURCE_PATH, 'utf8');
  const syncWorkspaceStart = source.indexOf('function syncWorkspaceSelection');
  const syncWorkspaceEnd = source.indexOf('function syncGalleryRoute', syncWorkspaceStart);
  assert.ok(syncWorkspaceStart > -1 && syncWorkspaceEnd > syncWorkspaceStart, 'test must locate syncWorkspaceSelection');
  const syncWorkspaceSource = source.slice(syncWorkspaceStart, syncWorkspaceEnd);
  assert.equal(
    syncWorkspaceSource.includes('queueMicrotask'),
    false,
    'workspace selection sync must not defer a stale selection into a later microtask',
  );

  const activateStart = source.indexOf('function activateDesktopTask');
  const activateEnd = source.indexOf('function closeDesktopTask', activateStart);
  assert.ok(activateStart > -1 && activateEnd > activateStart, 'test must locate activateDesktopTask');
  const activateSource = source.slice(activateStart, activateEnd);
  assert.ok(
    activateSource.indexOf('dispatchAppShellStateUpdate') > -1,
    'activateDesktopTask must write foreground state',
  );
  assert.ok(
    activateSource.indexOf('setHashPath(ROUTE_HOME)') > -1,
    'activateDesktopTask must navigate to home route',
  );
  assert.ok(
    activateSource.indexOf('dispatchAppShellStateUpdate') < activateSource.indexOf('setHashPath(ROUTE_HOME)'),
    'task activation must write foreground state before hash navigation to avoid stale hashchange sync',
  );
}

const tests = [
  test_server_persists_editor_state_label_update,
  test_remote_store_posts_ui_local_state_to_bus_event_endpoint,
  test_pending_shell_state_survives_stale_snapshot,
  test_sent_shell_state_survives_stale_snapshot_until_confirmed,
  test_foreground_workspace_click_updates_selected_workspace_model_locally,
  test_app_shell_does_not_queue_workspace_selection_or_hash_before_foreground,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    await test();
    console.log(`[PASS] ${test.name}`);
    passed += 1;
  } catch (err) {
    console.log(`[FAIL] ${test.name}: ${err && err.message ? err.message : err}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
