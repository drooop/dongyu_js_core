#!/usr/bin/env node

import assert from 'node:assert/strict';

import { createRemoteStore } from '../../packages/ui-model-demo-frontend/src/remote_store.js';

function jsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : String(status),
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

function emptySnapshot() {
  return {
    models: {},
    tables: {},
    v1nConfig: { local_mqtt: null, global_mqtt: null },
  };
}

function appTableSnapshot(ref, title = 'App table title') {
  return {
    models: {},
    tables: {
      [ref.table_id]: {
        table_id: ref.table_id,
        models: {
          [String(ref.model_id)]: {
            table_id: ref.table_id,
            id: ref.model_id,
            cells: {
              '0,0,0': {
                p: 0,
                r: 0,
                c: 0,
                labels: {
                  title: { k: 'title', t: 'str', v: title },
                },
              },
            },
          },
        },
      },
    },
    v1nConfig: { local_mqtt: null, global_mqtt: null },
  };
}

async function waitFor(predicate, message, timeoutMs = 1000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(message);
}

function installFakeEventSource(onPatchListener) {
  const createdUrls = [];
  globalThis.EventSource = class FakeEventSource {
    constructor(url) {
      this.url = String(url);
      this.readyState = 1;
      createdUrls.push(this.url);
    }

    addEventListener(type, listener) {
      if (type === 'snapshot_patch') onPatchListener(listener);
    }

    close() {
      this.readyState = 2;
    }
  };
  return createdUrls;
}

function installFakeWindowTimer() {
  const originalWindow = globalThis.window;
  globalThis.window = {
    setTimeout: (fn) => setTimeout(fn, 0),
    clearTimeout: (timer) => clearTimeout(timer),
  };
  return () => {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  };
}

function mismatchPatch() {
  return {
    patch_kind: 'json_replace_v1',
    snapshot_seq: 1000,
    base_snapshot_seq: 999,
    op_id: 'it0426_patch_base_mismatch',
    ops: [],
  };
}

async function test_mismatch_recovery_uses_table_qualified_visible_refs_without_full_or_bare_snapshot() {
  const originalFetch = globalThis.fetch;
  const originalEventSource = globalThis.EventSource;
  const visibleRef = { table_id: 'app:todo:a', model_id: 1 };
  let patchListener = null;
  const snapshotUrls = [];
  installFakeEventSource((listener) => {
    patchListener = listener;
  });
  globalThis.fetch = async (url) => {
    const href = String(url);
    if (href.includes('/snapshot?')) {
      snapshotUrls.push(href);
      const parsed = new URL(href);
      if (parsed.searchParams.get('profile') === 'visible') {
        const refs = parsed.searchParams.getAll('visible_model_ref').map((value) => JSON.parse(value));
        assert.deepEqual(refs, [visibleRef], 'visible lazy-load must request the app table ref');
        return jsonResponse({
          snapshot: appTableSnapshot(visibleRef),
          snapshot_seq: 1,
          visible_model_refs: [visibleRef],
        });
      }
      if (parsed.searchParams.get('profile') === 'bootstrap') {
        return jsonResponse({
          snapshot: appTableSnapshot(visibleRef, 'Recovered app table title'),
          snapshot_seq: 2,
          visible_model_refs: [visibleRef],
        });
      }
    }
    throw new Error(`unexpected fetch ${href}`);
  };
  try {
    const store = createRemoteStore({
      baseUrl: 'http://127.0.0.1:30900',
      autoBootstrap: false,
    });
    assert.equal(await store.ensureVisibleModelLoaded(visibleRef), true);
    await waitFor(() => typeof patchListener === 'function', 'snapshot_patch listener was not registered');
    patchListener({ data: JSON.stringify({ snapshot_patch: mismatchPatch() }) });
    await waitFor(
      () => snapshotUrls.some((href) => new URL(href).searchParams.get('profile') === 'bootstrap'),
      'mismatch recovery did not request an active bootstrap profile snapshot',
    );

    const recoveryUrl = snapshotUrls.find((href) => new URL(href).searchParams.get('profile') === 'bootstrap');
    const recoveryParams = new URL(recoveryUrl).searchParams;
    assert.equal(
      snapshotUrls.some((href) => new URL(href).searchParams.get('profile') === 'full'),
      false,
      'mismatch recovery must not widen to profile=full',
    );
    assert.equal(
      recoveryParams.getAll('visible_model_id').length,
      0,
      'app table recovery must not degrade to host visible_model_id',
    );
    assert.deepEqual(
      recoveryParams.getAll('visible_model_ref').map((value) => JSON.parse(value)),
      [visibleRef],
      'mismatch recovery must preserve table-qualified visible_model_ref',
    );
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
  }
}

async function test_principal_switch_clears_stale_visible_refs_before_mismatch_recovery() {
  const originalFetch = globalThis.fetch;
  const originalEventSource = globalThis.EventSource;
  const visibleRef = { table_id: 'app:todo:a', model_id: 1 };
  const authStore = {
    state: {
      authenticated: true,
      subject: 'user-a',
      capabilities: ['app:read', 'app:write', 'workspace:read'],
    },
  };
  let patchListener = null;
  const snapshotUrls = [];
  installFakeEventSource((listener) => {
    patchListener = listener;
  });
  globalThis.fetch = async (url) => {
    const href = String(url);
    if (href.includes('/snapshot?')) {
      snapshotUrls.push(href);
      const parsed = new URL(href);
      if (parsed.searchParams.get('profile') === 'visible') {
        return jsonResponse({
          snapshot: appTableSnapshot(visibleRef, 'User A app data'),
          snapshot_seq: 1,
          visible_model_refs: [visibleRef],
        });
      }
      if (parsed.searchParams.get('profile') === 'bootstrap') {
        return jsonResponse({
          snapshot: emptySnapshot(),
          snapshot_seq: 2,
          visible_model_refs: [],
        });
      }
    }
    throw new Error(`unexpected fetch ${href}`);
  };
  try {
    const store = createRemoteStore({
      baseUrl: 'http://127.0.0.1:30900',
      autoBootstrap: false,
      authStore,
    });
    assert.equal(await store.ensureVisibleModelLoaded(visibleRef), true);
    assert.equal(store.hasSnapshotModel(visibleRef), true, 'test setup must load user A app model');
    await waitFor(() => typeof patchListener === 'function', 'snapshot_patch listener was not registered');

    authStore.state.subject = 'user-b';
    patchListener({ data: JSON.stringify({ snapshot_patch: mismatchPatch() }) });
    await waitFor(
      () => snapshotUrls.some((href) => new URL(href).searchParams.get('profile') === 'bootstrap'),
      'principal switch mismatch recovery did not request bootstrap snapshot',
    );

    const recoveryUrl = snapshotUrls.find((href) => new URL(href).searchParams.get('profile') === 'bootstrap');
    const recoveryParams = new URL(recoveryUrl).searchParams;
    assert.equal(
      recoveryParams.getAll('visible_model_ref').length,
      0,
      'principal switch recovery must not reuse previous principal app table refs',
    );
    assert.equal(
      recoveryParams.getAll('visible_model_id').length,
      0,
      'principal switch recovery must not reuse previous principal host visible ids',
    );
    assert.deepEqual(
      store.getVisibleSubscriptionState().visibleModelRefs,
      [],
      'principal switch must clear visible model refs',
    );
    assert.equal(
      store.hasSnapshotModel(visibleRef),
      false,
      'principal switch must clear previous principal app table snapshot data',
    );
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
  }
}

async function test_persisted_asset_not_ready_json_sets_visible_status_and_retries() {
  const originalFetch = globalThis.fetch;
  const restoreWindow = installFakeWindowTimer();
  let fetchCount = 0;
  globalThis.fetch = async (url) => {
    const href = String(url);
    if (!href.includes('/snapshot?')) throw new Error(`unexpected fetch ${href}`);
    fetchCount += 1;
    if (fetchCount === 1) {
      return jsonResponse({
        ok: false,
        code: 'persisted_asset_not_ready',
        error: 'persisted_asset_manifest_missing:/tmp/assets/manifest.v0.json',
        retry_after_ms: 1,
      }, 503);
    }
    return jsonResponse({
      snapshot: emptySnapshot(),
      snapshot_seq: 42,
      visible_model_refs: [],
    });
  };
  try {
    const store = createRemoteStore({
      baseUrl: 'http://127.0.0.1:30900',
      autoBootstrap: false,
    });
    const ok = await store.refreshSnapshot('asset not ready json test');
    assert.equal(ok, false, 'first not-ready snapshot request must not report success');
    assert.equal(store.workspaceStatus.status, 'not_ready');
    assert.equal(store.workspaceStatus.code, 'persisted_asset_not_ready');
    await waitFor(() => fetchCount >= 2, 'persisted asset not-ready JSON did not schedule retry');
    await waitFor(() => store.workspaceStatus.status === 'ready', 'persisted asset retry did not recover to ready');
  } finally {
    globalThis.fetch = originalFetch;
    restoreWindow();
  }
}

async function test_persisted_asset_not_ready_sse_sets_visible_status_and_retries() {
  const originalFetch = globalThis.fetch;
  const originalEventSource = globalThis.EventSource;
  const restoreWindow = installFakeWindowTimer();
  let assetNotReadyListener = null;
  let fetchCount = 0;
  globalThis.EventSource = class FakeEventSource {
    constructor(url) {
      this.url = String(url);
      this.readyState = 1;
    }

    addEventListener(type, listener) {
      if (type === 'persisted_asset_not_ready') assetNotReadyListener = listener;
    }

    close() {
      this.readyState = 2;
    }
  };
  globalThis.fetch = async (url) => {
    const href = String(url);
    if (!href.includes('/snapshot?')) throw new Error(`unexpected fetch ${href}`);
    fetchCount += 1;
    return jsonResponse({
      snapshot: emptySnapshot(),
      snapshot_seq: fetchCount,
      visible_model_refs: [],
    });
  };
  try {
    const store = createRemoteStore({
      baseUrl: 'http://127.0.0.1:30900',
      autoBootstrap: true,
    });
    await waitFor(() => typeof assetNotReadyListener === 'function', 'persisted_asset_not_ready SSE listener was not registered');
    assetNotReadyListener({
      data: JSON.stringify({
        code: 'persisted_asset_not_ready',
        error: 'persisted_asset_manifest_missing:/tmp/assets/manifest.v0.json',
        retry_after_ms: 1,
      }),
    });
    assert.equal(store.workspaceStatus.status, 'not_ready');
    assert.equal(store.workspaceStatus.code, 'persisted_asset_not_ready');
    await waitFor(() => fetchCount >= 2, 'persisted asset not-ready SSE did not schedule retry');
    await waitFor(() => store.workspaceStatus.status === 'ready', 'persisted asset SSE retry did not recover to ready');
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
    restoreWindow();
  }
}

const tests = [
  test_mismatch_recovery_uses_table_qualified_visible_refs_without_full_or_bare_snapshot,
  test_principal_switch_clears_stale_visible_refs_before_mismatch_recovery,
  test_persisted_asset_not_ready_json_sets_visible_status_and_retries,
  test_persisted_asset_not_ready_sse_sets_visible_status_and_retries,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    await test();
    console.log(`[PASS] ${test.name}`);
    passed += 1;
  } catch (err) {
    console.log(`[FAIL] ${test.name}: ${err.stack || err.message}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
