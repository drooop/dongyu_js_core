#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildBusEventV2 } from '../../packages/ui-model-demo-frontend/src/bus_event_v2.js';
import { createAuthStore } from '../../packages/ui-model-demo-frontend/src/auth_store.js';
import { createRemoteStore } from '../../packages/ui-model-demo-frontend/src/remote_store.js';
import { createRenderer } from '../../packages/ui-renderer/src/renderer.mjs';

const originalFetch = globalThis.fetch;
const originalEventSource = globalThis.EventSource;
const originalWindow = globalThis.window;

function mt(k, t, v) {
  return { id: 0, p: 0, r: 0, c: 0, k, t, v };
}

function label(k, t, v) {
  return { k, t, v };
}

function ref(modelId, k, p = 0, r = 0, c = 0) {
  return { model_id: modelId, p, r, c, k };
}

function snapshotWithModel(modelId, labels) {
  return {
    models: {
      [String(modelId)]: {
        id: modelId,
        cells: {
          '0,0,0': { p: 0, r: 0, c: 0, labels },
        },
      },
    },
    v1nConfig: { local_mqtt: null, global_mqtt: null },
  };
}

function fakeVue() {
  return {
    h(type, props, children) {
      let normalized = children;
      if (children && typeof children === 'object' && typeof children.default === 'function') {
        normalized = children.default();
      }
      return { type, props: props || {}, children: normalized };
    },
    resolveComponent(name) {
      return name;
    },
  };
}

function hostWithSnapshot(snapshot) {
  const dispatched = [];
  const staged = [];
  const localValues = new Map();
  const keyForRef = (target) => `${target.model_id}:${target.p}:${target.r}:${target.c}:${target.k}`;
  return {
    dispatched,
    staged,
    getSnapshot() {
      return snapshot;
    },
    dispatchAddLabel(value) {
      dispatched.push(value);
      return value;
    },
    dispatchRmLabel(value) {
      dispatched.push({ rm: value });
    },
    getEffectiveLabelValue(target) {
      const key = keyForRef(target);
      if (localValues.has(key)) return localValues.get(key);
      return labelValueFromSnapshot(snapshot, target);
    },
    stageOverlayValue(value) {
      staged.push(value);
      localValues.set(keyForRef(value.ref), value.value);
    },
  };
}

function labelValueFromSnapshot(snapshot, target) {
  return snapshot.models[String(target.model_id)]?.cells?.[`${target.p},${target.r},${target.c}`]?.labels?.[target.k]?.v;
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function localDialogEnvelope(value) {
  return {
    event_id: Date.now(),
    type: 'label_update',
    source: 'ui_renderer',
    ts: 0,
    payload: {
      action: 'label_update',
      meta: { op_id: 'it0420_local_dialog' },
      target: { model_id: -2, p: 0, r: 0, c: 0, k: 'dialog_open' },
      value: { t: 'bool', v: value },
    },
  };
}

function formalSubmitEnvelope(opId = 'it0420_formal_submit') {
  return buildBusEventV2({
    busInKey: 'submit_request',
    value: [
      mt('__mt_payload_kind', 'str', 'ui_event.v1'),
      mt('draft_title', 'str', 'latest visible value'),
    ],
    opId,
    source: 'it0420',
  });
}

function dispatchEvent(store, envelope) {
  return store.dispatchAddLabel({
    p: 0,
    r: 0,
    c: 0,
    k: 'bus_in_event',
    t: 'event',
    v: envelope,
  });
}

async function test_default_input_submit_policy_is_local_only() {
  const draftRef = ref(9420, 'draft_title');
  const snapshot = snapshotWithModel(9420, {
    draft_title: label('draft_title', 'str', ''),
  });
  const host = hostWithSnapshot(snapshot);
  const renderer = createRenderer({ host, vue: fakeVue() });
  const input = renderer.renderVNode({
    id: 'it0420_draft_input',
    type: 'Input',
    cell_ref: { model_id: 9420, p: 2, r: 1, c: 0 },
    bind: {
      read: draftRef,
      write: {
        action: 'label_update',
        target_ref: draftRef,
      },
    },
  });

  input.props['onUpdate:modelValue']('abc');
  assert.equal(host.dispatched.length, 0, 'default Input typing must not dispatch ModelTable writes per keystroke');
  assert.equal(host.staged.length, 1, 'default Input typing must stage local overlay');
  assert.equal(host.staged[0].value, 'abc');
  assert.equal(labelValueFromSnapshot(snapshot, draftRef), '', 'Input overlay must not mutate committed snapshot directly');
  return { key: 'default_input_submit_policy_is_local_only', status: 'PASS' };
}

async function test_submit_reads_visible_overlay_and_keeps_model0_bus_path() {
  const draftRef = ref(9420, 'draft_title');
  const snapshot = snapshotWithModel(9420, {
    draft_title: label('draft_title', 'str', 'old snapshot value'),
  });
  const host = hostWithSnapshot(snapshot);
  const renderer = createRenderer({ host, vue: fakeVue() });
  const input = renderer.renderVNode({
    id: 'it0420_draft_input_for_submit',
    type: 'Input',
    cell_ref: { model_id: 9420, p: 2, r: 1, c: 0 },
    bind: {
      read: draftRef,
      write: {
        action: 'label_update',
        target_ref: draftRef,
      },
    },
  });
  input.props['onUpdate:modelValue']('visible latest value');

  const labelOut = renderer.dispatchEvent({
    id: 'it0420_submit_button',
    type: 'Button',
    cell_ref: { model_id: 9420, p: 2, r: 2, c: 0 },
    bind: {
      write: {
        bus_event_v2: true,
        bus_in_key: 'submit_request',
        value_t: 'modeltable',
        value_ref: [
          mt('__mt_payload_kind', 'str', 'ui_event.v1'),
          mt('draft_title', 'str', { $label: draftRef }),
        ],
        meta: { source: 'it0420' },
      },
    },
  }, { click: true });

  assert.equal(host.dispatched.length, 1, 'submit must dispatch exactly one event');
  assert.deepEqual(
    { p: labelOut.p, r: labelOut.r, c: labelOut.c, k: labelOut.k, t: labelOut.t },
    { p: 0, r: 0, c: 0, k: 'bus_in_event', t: 'event' },
    'submit must enter the Model 0 bus event mailbox',
  );
  assert.equal(labelOut.v.type, 'bus_event_v2', 'submit must use the formal bus_event_v2 envelope');
  const draftRecord = labelOut.v.value.find((record) => record.k === 'draft_title');
  assert.equal(draftRecord?.v, 'visible latest value', 'submit payload must use visible local overlay value');
  assert.equal(labelValueFromSnapshot(snapshot, draftRef), 'old snapshot value', 'submit must not direct-write business labels');
  return { key: 'submit_reads_visible_overlay_and_keeps_model0_bus_path', status: 'PASS' };
}

async function test_dialog_tabs_and_view_state_are_local_only() {
  const openRef = ref(9420, 'create_dialog_open');
  const viewRef = ref(9420, 'selected_view');
  const snapshot = snapshotWithModel(9420, {
    create_dialog_open: label('create_dialog_open', 'bool', false),
    selected_view: label('selected_view', 'str', 'board'),
  });
  const host = hostWithSnapshot(snapshot);
  const renderer = createRenderer({ host, vue: fakeVue() });
  const dialog = renderer.renderVNode({
    id: 'it0420_create_task_dialog',
    type: 'Dialog',
    cell_ref: { model_id: 9420, p: 2, r: 3, c: 0 },
    props: {
      ui_state: {
        state_id: 'create_task_dialog',
        state_kind: 'visibility',
        scope: 'local',
        persist_policy: 'never',
      },
    },
    bind: {
      read: openRef,
      write: {
        action: 'label_update',
        target_ref: openRef,
        persist_policy: 'never',
      },
    },
    children: [],
  });
  dialog.props['onUpdate:modelValue'](true);

  const tabs = renderer.renderVNode({
    id: 'it0420_todo_view_tabs',
    type: 'Tabs',
    cell_ref: { model_id: 9420, p: 2, r: 5, c: 0 },
    props: {
      ui_state: {
        state_id: 'todo_view',
        state_kind: 'selection',
        scope: 'local',
        persist_policy: 'never',
      },
    },
    bind: {
      read: viewRef,
      write: {
        action: 'label_update',
        target_ref: viewRef,
        persist_policy: 'never',
      },
    },
    children: [],
  });
  tabs.props['onUpdate:modelValue']('focus');

  assert.equal(host.dispatched.length, 0, 'local Dialog/Tabs state must not dispatch business ModelTable writes');
  assert.deepEqual(
    host.staged.map((entry) => ({ ref: entry.ref, value: entry.value })),
    [
      { ref: openRef, value: true },
      { ref: viewRef, value: 'focus' },
    ],
    'Dialog/Tabs must stage the correct local state refs and values',
  );
  assert.equal(labelValueFromSnapshot(snapshot, openRef), false, 'Dialog local state must not mutate snapshot business label');
  assert.equal(labelValueFromSnapshot(snapshot, viewRef), 'board', 'Tabs local state must not mutate snapshot business label');
  return { key: 'dialog_tabs_and_view_state_are_local_only', status: 'PASS' };
}

async function test_on_submit_overlay_flush_stays_before_formal_bus_event() {
  const fetchBodies = [];
  globalThis.EventSource = undefined;
  globalThis.fetch = async (url, options = {}) => {
    const href = String(url);
    const path = new URL(href).pathname;
    if (path === '/bus_event') {
      fetchBodies.push(JSON.parse(String(options.body || '{}')));
      return jsonResponse({ ok: true, result: 'ok', snapshot: { models: {}, v1nConfig: {} } });
    }
    if (path === '/snapshot') {
      return jsonResponse({ snapshot: { models: {}, v1nConfig: {} } });
    }
    throw new Error(`unexpected fetch ${href}`);
  };

  try {
    const store = createRemoteStore({
      baseUrl: 'http://127.0.0.1:30900',
      autoBootstrap: false,
      snapshotFallbackDelayMs: 60_000,
    });
    const draftRef = ref(9420, 'draft_title');
    store.stageOverlayValue({
      ref: draftRef,
      value: 'overlay value',
      writeTarget: {
        action: 'label_update',
        target_ref: draftRef,
        commit_policy: 'on_submit',
      },
    });

    await dispatchEvent(store, formalSubmitEnvelope());

    assert.equal(fetchBodies.length, 2, 'on_submit overlay must flush before formal bus_event_v2');
    assert.equal(fetchBodies[0]?.payload?.action, 'label_update', 'overlay flush must commit as label_update first');
    assert.deepEqual(fetchBodies[0]?.payload?.target, draftRef, 'overlay flush must target the declared commit ref');
    assert.equal(fetchBodies[0]?.payload?.value?.v, 'overlay value', 'overlay flush must carry the current overlay value');
    assert.equal(fetchBodies[1]?.type, 'bus_event_v2', 'formal event must still be dispatched as bus_event_v2');
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
  }
  return { key: 'on_submit_overlay_flush_stays_before_formal_bus_event', status: 'PASS' };
}

async function test_local_ui_sync_does_not_block_formal_bus_event_dispatch() {
  const calls = [];
  let resolveUiEvent = null;
  let busPromise = null;
  globalThis.EventSource = undefined;
  globalThis.fetch = async (url) => {
    const href = String(url);
    const path = new URL(href).pathname;
    calls.push({ path, at: Date.now() });
    if (path === '/ui_event') {
      return new Promise((resolve) => {
        resolveUiEvent = () => resolve(jsonResponse({ ok: true, result: 'ok' }));
      });
    }
    if (path === '/bus_event') {
      return jsonResponse({
        ok: true,
        consumed: true,
        result: 'ok',
        bus_event_last_op_id: 'it0420_formal_submit',
        timing: { op_id: 'it0420_formal_submit' },
      });
    }
    if (path === '/snapshot') {
      return jsonResponse({ snapshot: { models: {}, v1nConfig: {} } });
    }
    throw new Error(`unexpected fetch ${href}`);
  };

  try {
    const store = createRemoteStore({
      baseUrl: 'http://127.0.0.1:30900',
      autoBootstrap: false,
      snapshotFallbackDelayMs: 60_000,
    });
    dispatchEvent(store, localDialogEnvelope(true));
    await sleep(250);
    assert.equal(
      calls.some((call) => call.path === '/ui_event'),
      true,
      'test setup must have an in-flight local-only /ui_event before formal submit',
    );
    assert.equal(typeof resolveUiEvent, 'function', 'test setup must hold /ui_event open');

    busPromise = dispatchEvent(store, formalSubmitEnvelope());
    await sleep(20);

    assert.equal(
      calls.some((call) => call.path === '/bus_event'),
      true,
      'formal /bus_event must dispatch immediately even while local-only /ui_event is still pending',
    );

    resolveUiEvent();
    await busPromise;
  } finally {
    if (typeof resolveUiEvent === 'function') resolveUiEvent();
    if (busPromise && typeof busPromise.then === 'function') {
      await Promise.race([busPromise.catch(() => null), sleep(50)]);
    }
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
  }
  return { key: 'local_ui_sync_does_not_block_formal_bus_event_dispatch', status: 'PASS' };
}

async function test_readonly_authenticated_local_ui_state_stays_browser_local() {
  const calls = [];
  let authFailures = 0;
  globalThis.EventSource = undefined;
  globalThis.fetch = async (url) => {
    const href = String(url);
    const path = new URL(href).pathname;
    calls.push({ path, at: Date.now() });
    if (path === '/snapshot') {
      return jsonResponse({ snapshot: { models: {}, v1nConfig: {} } });
    }
    return jsonResponse({ ok: false, result: 'error', code: 'permission_denied' });
  };

  try {
    const store = createRemoteStore({
      baseUrl: 'http://127.0.0.1:30900',
      autoBootstrap: false,
      authStore: {
        state: {
          authenticated: true,
          capabilities: ['app:read', 'workspace:read', 'matrix:connect'],
        },
        handleAuthFailure() {
          authFailures += 1;
        },
      },
    });
    dispatchEvent(store, localDialogEnvelope(true));
    await sleep(250);

    assert.equal(
      calls.some((call) => call.path === '/ui_event'),
      false,
      'authenticated read-only local UI state must not post /ui_event',
    );
    assert.equal(authFailures, 0, 'read-only local UI state must not surface permission_denied');
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
  }
  return { key: 'readonly_authenticated_local_ui_state_stays_browser_local', status: 'PASS' };
}

async function test_app_write_authenticated_local_ui_state_still_syncs() {
  const calls = [];
  let authFailures = 0;
  globalThis.EventSource = undefined;
  globalThis.fetch = async (url) => {
    const href = String(url);
    const path = new URL(href).pathname;
    calls.push({ path, at: Date.now() });
    if (path === '/ui_event') {
      return jsonResponse({ ok: true, result: 'ok' });
    }
    if (path === '/snapshot') {
      return jsonResponse({ snapshot: { models: {}, v1nConfig: {} } });
    }
    throw new Error(`unexpected fetch ${href}`);
  };

  try {
    const store = createRemoteStore({
      baseUrl: 'http://127.0.0.1:30900',
      autoBootstrap: false,
      authStore: {
        state: {
          authenticated: true,
          capabilities: ['app:read', 'app:write', 'workspace:read'],
        },
        handleAuthFailure() {
          authFailures += 1;
        },
      },
    });
    dispatchEvent(store, localDialogEnvelope(true));
    await sleep(250);

    assert.equal(
      calls.some((call) => call.path === '/ui_event'),
      true,
      'authenticated app:write local UI state must still sync via /ui_event',
    );
    assert.equal(authFailures, 0, 'successful app:write local UI sync must not surface auth failure');
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
  }
  return { key: 'app_write_authenticated_local_ui_state_still_syncs', status: 'PASS' };
}

async function test_eventsource_closes_on_page_exit_to_prevent_auth_starvation() {
  const listeners = new Map();
  const instances = [];
  let closeCount = 0;
  class FakeEventSource {
    constructor(url, options = {}) {
      this.url = url;
      this.options = options;
      this.readyState = 1;
      instances.push(this);
    }

    addEventListener() {}

    close() {
      this.readyState = 2;
      closeCount += 1;
    }
  }

  globalThis.window = {
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
  };
  globalThis.EventSource = FakeEventSource;
  globalThis.fetch = async (url) => {
    const path = new URL(String(url)).pathname;
    if (path === '/snapshot') {
      return jsonResponse({ snapshot: { models: {}, v1nConfig: {} }, snapshot_seq: 1 });
    }
    throw new Error(`unexpected fetch ${url}`);
  };

  try {
    const store = createRemoteStore({
      baseUrl: 'http://127.0.0.1:30900',
    });
    await sleep(20);

    assert.equal(instances.length, 1, 'bootstrap must open exactly one EventSource');
    assert.equal(typeof listeners.get('pagehide'), 'function', 'store must register pagehide cleanup');
    assert.equal(typeof listeners.get('beforeunload'), 'function', 'store must register beforeunload cleanup');
    assert.equal(store.getVisibleSubscriptionState().eventSourceReadyState, 1, 'test setup must have an open EventSource');

    listeners.get('pagehide')();
    assert.equal(closeCount, 1, 'page exit must close the active EventSource');
    assert.equal(store.getVisibleSubscriptionState().eventSourceUrl, '', 'closed EventSource URL must be cleared');
    assert.equal(store.getVisibleSubscriptionState().eventSourceReadyState, null, 'closed EventSource handle must be cleared');
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
  return { key: 'eventsource_closes_on_page_exit_to_prevent_auth_starvation', status: 'PASS' };
}

async function test_formal_bus_events_remain_serialized_and_ordered() {
  const calls = [];
  let resolveFirstBusEvent = null;
  globalThis.EventSource = undefined;
  globalThis.fetch = async (url, options = {}) => {
    const href = String(url);
    const path = new URL(href).pathname;
    if (path === '/bus_event') {
      const body = JSON.parse(String(options.body || '{}'));
      const opId = body?.meta?.op_id || '';
      calls.push({ path, opId, at: Date.now() });
      if (opId === 'it0420_formal_first') {
        return new Promise((resolve) => {
          resolveFirstBusEvent = () => resolve(jsonResponse({
            ok: true,
            consumed: true,
            result: 'ok',
            bus_event_last_op_id: opId,
            timing: { op_id: opId },
          }));
        });
      }
      return jsonResponse({
        ok: true,
        consumed: true,
        result: 'ok',
        bus_event_last_op_id: opId,
        timing: { op_id: opId },
      });
    }
    if (path === '/snapshot') {
      return jsonResponse({ snapshot: { models: {}, v1nConfig: {} } });
    }
    throw new Error(`unexpected fetch ${href}`);
  };

  try {
    const store = createRemoteStore({
      baseUrl: 'http://127.0.0.1:30900',
      autoBootstrap: false,
      snapshotFallbackDelayMs: 60_000,
    });
    const firstPromise = dispatchEvent(store, formalSubmitEnvelope('it0420_formal_first'));
    await sleep(20);
    assert.equal(typeof resolveFirstBusEvent, 'function', 'test setup must hold first formal bus_event open');

    const secondPromise = dispatchEvent(store, formalSubmitEnvelope('it0420_formal_second'));
    await sleep(20);
    assert.deepEqual(
      calls.map((call) => call.opId),
      ['it0420_formal_first'],
      'second formal /bus_event must not start while the first formal /bus_event is pending',
    );

    resolveFirstBusEvent();
    await firstPromise;
    await secondPromise;
    assert.deepEqual(
      calls.map((call) => call.opId),
      ['it0420_formal_first', 'it0420_formal_second'],
      'formal /bus_event dispatch order must be preserved',
    );
  } finally {
    if (typeof resolveFirstBusEvent === 'function') resolveFirstBusEvent();
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
  }
  return { key: 'formal_bus_events_remain_serialized_and_ordered', status: 'PASS' };
}

async function test_auth_session_checking_is_distinct_from_confirmed_guest() {
  let resolveAuthMe = null;
  globalThis.fetch = async (url) => {
    const path = new URL(String(url)).pathname;
    if (path === '/auth/me') {
      return new Promise((resolve) => {
        resolveAuthMe = () => resolve({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          headers: { get: () => 'application/json' },
          async json() { return { ok: false, error: 'not_authenticated' }; },
          async text() { return JSON.stringify({ ok: false, error: 'not_authenticated' }); },
        });
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  };

  try {
    const authStore = createAuthStore({ baseUrl: 'http://127.0.0.1:30900' });
    const remoteStore = createRemoteStore({
      baseUrl: 'http://127.0.0.1:30900',
      authStore,
      autoBootstrap: false,
    });
    assert.equal(authStore.state.sessionChecked, false, 'new auth store must start before guest/authenticated is known');
    assert.equal(authStore.state.authenticated, false, 'session checking is not authenticated yet');
    assert.equal(remoteStore.authState, authStore.state, 'remote store must expose auth state for shell fallback rendering');

    const check = authStore.checkSession();
    assert.equal(authStore.state.loading, true, 'checkSession must mark auth state as loading synchronously');
    assert.equal(authStore.state.sessionChecked, false, 'loading auth state must not be treated as confirmed guest');
    assert.equal(typeof resolveAuthMe, 'function', 'test setup must hold /auth/me open');

    resolveAuthMe();
    await check;
    assert.equal(authStore.state.loading, false, 'auth loading must finish after /auth/me response');
    assert.equal(authStore.state.sessionChecked, true, '401 /auth/me response confirms guest state');
    assert.equal(authStore.state.authenticated, false, '401 /auth/me response remains unauthenticated');

    const demoSource = readFileSync(new URL('../../packages/ui-model-demo-frontend/src/demo_app.js', import.meta.url), 'utf8');
    assert.match(
      demoSource,
      /authState[\s\S]{0,180}sessionChecked[\s\S]{0,180}正在确认登录/u,
      'demo root fallback must show auth-checking text instead of page-unavailable while session is unresolved',
    );
  } finally {
    if (typeof resolveAuthMe === 'function') resolveAuthMe();
    globalThis.fetch = originalFetch;
  }
  return { key: 'auth_session_checking_is_distinct_from_confirmed_guest', status: 'PASS' };
}

async function test_startup_runtime_activation_requires_app_write_capability() {
  const source = readFileSync(new URL('../../packages/ui-model-demo-frontend/src/main.js', import.meta.url), 'utf8');
  assert.match(
    source,
    /capabilities\.includes\('app:write'\)/,
    'startup runtime activation must explicitly require app:write capability',
  );
  assert.match(
    source,
    /authStore\.state\.authenticated[\s\S]{0,260}capabilities\.includes\('app:write'\)[\s\S]{0,260}store\.ensureRuntimeRunning/,
    'Matrix-only authenticated sessions must not call ensureRuntimeRunning and surface permission_denied on startup',
  );
  return { key: 'startup_runtime_activation_requires_app_write_capability', status: 'PASS' };
}

async function test_app_shell_content_slot_prevents_outer_document_scroll() {
  const appShell = readFileSync(new URL('../../packages/ui-model-demo-frontend/src/demo_app.js', import.meta.url), 'utf8');
  assert.match(
    appShell,
    /'data-testid': isForeground \? 'foreground-content-slot' : 'app-content-slot'/,
    'normal and foreground routes must render through a bounded content slot',
  );
  assert.match(appShell, /height: '100dvh'/, 'AppShell root must own exactly one viewport height');
  assert.match(appShell, /flex: 1/, 'AppShell content slot must fill remaining height below auth header');
  assert.match(appShell, /minHeight: 0/, 'AppShell content slot must be shrinkable');
  assert.match(
    appShell,
    /contentOverflow = options\.contentOverflow \|\| \(isForeground \? 'hidden' : 'auto'\)/,
    'ordinary pages must keep internal scrolling while foreground apps stay clipped',
  );
  assert.match(appShell, /overflow: contentOverflow/, 'AppShell content slot must use the route-specific overflow policy');

  const desktopCatalog = JSON.parse(readFileSync(new URL('../../packages/worker-base/system-models/desktop_catalog_ui.json', import.meta.url), 'utf8'));
  const desktopRootProps = desktopCatalog.records.find((record) => record.model_id === -28
    && record.p === 2 && record.r === 0 && record.c === 0 && record.k === 'ui_props_json')?.v;
  assert.equal(desktopRootProps?.style?.height, '100%', 'desktop root must fill the AppShell content slot, not add another viewport height');
  const foregroundRootProps = desktopCatalog.records.find((record) => record.model_id === -29
    && record.p === 3 && record.r === 0 && record.c === 0 && record.k === 'ui_props_json')?.v;
  assert.equal(foregroundRootProps?.style?.height, '100%', 'foreground template must not keep a second viewport-relative height');

  const foregroundSource = readFileSync(new URL('../../packages/ui-model-demo-frontend/src/desktop_foreground_shell_ast.js', import.meta.url), 'utf8');
  assert.match(foregroundSource, /height: '100%'/, 'embedded foreground shell must fill parent content slot');
  assert.match(foregroundSource, /maxHeight: '100%'/, 'embedded foreground shell must not exceed parent content slot');
  return { key: 'app_shell_content_slot_prevents_outer_document_scroll', status: 'PASS' };
}

const tests = [
  test_default_input_submit_policy_is_local_only,
  test_submit_reads_visible_overlay_and_keeps_model0_bus_path,
  test_dialog_tabs_and_view_state_are_local_only,
  test_on_submit_overlay_flush_stays_before_formal_bus_event,
  test_local_ui_sync_does_not_block_formal_bus_event_dispatch,
  test_readonly_authenticated_local_ui_state_stays_browser_local,
  test_app_write_authenticated_local_ui_state_still_syncs,
  test_eventsource_closes_on_page_exit_to_prevent_auth_starvation,
  test_formal_bus_events_remain_serialized_and_ordered,
  test_auth_session_checking_is_distinct_from_confirmed_guest,
  test_startup_runtime_activation_requires_app_write_capability,
  test_app_shell_content_slot_prevents_outer_document_scroll,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    const result = await test();
    passed += 1;
    console.log(`PASS ${result.key}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${test.name}: ${err.message}`);
  }
}

if (failed > 0) {
  console.error(`FAIL test_0420_ui_local_state_latency_contract: ${failed} failed, ${passed} passed`);
  process.exit(1);
}

console.log(`PASS test_0420_ui_local_state_latency_contract: ${passed} passed`);
