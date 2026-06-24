#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createProjectionStore } from '../../packages/ui-model-demo-frontend/src/projection_store.js';
import { createRemoteStore } from '../../packages/ui-model-demo-frontend/src/remote_store.js';

const originalFetch = globalThis.fetch;
const originalEventSource = globalThis.EventSource;
const originalConsoleWarn = console.warn;

function isProfiledSnapshotRequest(rawUrl) {
  let url;
  try {
    url = new URL(String(rawUrl));
  } catch (_) {
    return false;
  }
  return url.pathname === '/snapshot' && url.searchParams.get('profile') === 'bootstrap';
}

function assertNoImplicitFullSnapshotRequest(urls, context) {
  for (const rawUrl of urls) {
    let url;
    try {
      url = new URL(String(rawUrl));
    } catch (_) {
      continue;
    }
    if (url.pathname !== '/snapshot' && url.pathname !== '/stream') continue;
    const profile = url.searchParams.get('profile');
    assert.equal(
      profile === 'bootstrap' || profile === 'visible',
      true,
      `${context} must not request implicit full snapshot/stream: ${rawUrl}`,
    );
  }
}

function assertRequestedInitialProjection(urls, context) {
  const matched = urls.some((rawUrl) => {
    let url;
    try {
      url = new URL(String(rawUrl));
    } catch (_) {
      return false;
    }
    return url.pathname === '/snapshot'
      && url.searchParams.get('profile') === 'bootstrap'
      && url.searchParams.get('initial_projection') === '1';
  });
  assert.equal(matched, true, `${context} must request bootstrap initial_projection=1 on startup`);
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

function label(k, t, v) {
  return { k, t, v };
}

function ref(modelId, k, p = 0, r = 0, c = 0) {
  return { model_id: modelId, p, r, c, k };
}

function snapshotWithLabels(labels, modelId = 100, cellKey = '0,0,0') {
  const [p, r, c] = cellKey.split(',').map((part) => Number.parseInt(part, 10));
  return {
    models: {
      [String(modelId)]: {
        id: modelId,
        cells: {
          [cellKey]: {
            p,
            r,
            c,
            labels,
          },
        },
      },
    },
    v1nConfig: { local_mqtt: null, global_mqtt: null },
  };
}

function waitFor(predicate, message, timeoutMs = 1000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      try {
        if (predicate()) {
          resolve();
          return;
        }
      } catch (error) {
        reject(error);
        return;
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error(message));
        return;
      }
      setTimeout(tick, 5);
    };
    tick();
  });
}

async function test_projection_store_hydrates_and_patches_label_atoms() {
  const projection = createProjectionStore();
  const titleRef = ref(100, 'title');
  const statusRef = ref(100, 'status');

  projection.hydrateSnapshot(snapshotWithLabels({
    title: label('title', 'str', 'Before'),
    status: label('status', 'str', 'idle'),
  }), { snapshot_seq: 1 });

  const titleAtom = projection.getLabelAtom(titleRef);
  const statusAtom = projection.getLabelAtom(statusRef);
  const initialStatusVersion = statusAtom.version;

  assert.equal(titleAtom.exists, true);
  assert.equal(titleAtom.value, 'Before');
  assert.equal(statusAtom.value, 'idle');

  projection.applySnapshotPatch({
    patch_kind: 'json_replace_v1',
    snapshot_seq: 2,
    base_snapshot_seq: 1,
    ops: [
      {
        op: 'replace_label',
        model_id: 100,
        cell_key: '0,0,0',
        label_key: 'title',
        value: label('title', 'str', 'After'),
      },
    ],
  });

  assert.equal(projection.getLabelAtom(titleRef), titleAtom, 'updated label atom identity must stay stable');
  assert.equal(projection.getLabelAtom(statusRef), statusAtom, 'unrelated label atom identity must stay stable');
  assert.equal(titleAtom.value, 'After');
  assert.equal(titleAtom.version > 0, true);
  assert.equal(statusAtom.value, 'idle');
  assert.equal(statusAtom.version, initialStatusVersion, 'unrelated atom version must not change');
}

async function test_projection_store_handles_cell_model_and_config_ops() {
  const projection = createProjectionStore();
  const titleRef = ref(100, 'title');
  const statusRef = ref(100, 'status');
  projection.hydrateSnapshot(snapshotWithLabels({
    title: label('title', 'str', 'Before'),
    status: label('status', 'str', 'idle'),
  }), { snapshot_seq: 1 });
  const titleAtom = projection.getLabelAtom(titleRef);
  const statusAtom = projection.getLabelAtom(statusRef);

  projection.applySnapshotPatch({
    patch_kind: 'json_replace_v1',
    snapshot_seq: 2,
    base_snapshot_seq: 1,
    ops: [{ op: 'delete_label', model_id: 100, cell_key: '0,0,0', label_key: 'status' }],
  });
  assert.equal(statusAtom.exists, false);
  assert.equal(statusAtom.value, undefined);

  projection.applySnapshotPatch({
    patch_kind: 'json_replace_v1',
    snapshot_seq: 3,
    base_snapshot_seq: 2,
    ops: [{
      op: 'replace_cell',
      model_id: 100,
      cell_key: '0,0,0',
      value: { p: 0, r: 0, c: 0, labels: { title: label('title', 'str', 'Cell Replace') } },
    }],
  });
  assert.equal(titleAtom.value, 'Cell Replace');
  assert.equal(statusAtom.exists, false, 'cell replacement must keep removed labels absent');

  projection.applySnapshotPatch({
    patch_kind: 'json_replace_v1',
    snapshot_seq: 4,
    base_snapshot_seq: 3,
    ops: [{ op: 'delete_model', model_id: 100 }],
  });
  assert.equal(titleAtom.exists, false);

  projection.applySnapshotPatch({
    patch_kind: 'json_replace_v1',
    snapshot_seq: 5,
    base_snapshot_seq: 4,
    ops: [{ op: 'replace_v1n_config', value: { local_mqtt: { url: 'mqtt://local' } } }],
  });
  assert.equal(projection.v1nConfig.value.local_mqtt.url, 'mqtt://local');
}

async function test_remote_store_reads_patch_updates_from_projection_store() {
  let patchListener = null;
  const requestedUrls = [];
  globalThis.EventSource = class FakeEventSource {
    constructor(url) {
      requestedUrls.push(String(url));
      this.readyState = 1;
    }
    addEventListener(type, listener) {
      if (type === 'snapshot_patch') patchListener = listener;
    }
    close() {}
  };
  globalThis.fetch = async (url) => {
    const href = String(url);
    requestedUrls.push(href);
    if (isProfiledSnapshotRequest(href)) {
      return jsonResponse({
        snapshot: snapshotWithLabels({
          title: label('title', 'str', 'Before'),
        }),
        snapshot_seq: 1,
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  };

  try {
    const store = createRemoteStore({ baseUrl: 'http://127.0.0.1:30900' });
    await waitFor(
      () => store.getEffectiveLabelValue(ref(100, 'title')) === 'Before' && typeof patchListener === 'function',
      'remote store must hydrate projection store and register patch listener',
    );
    assertNoImplicitFullSnapshotRequest(requestedUrls, 'projection-store startup');
    assertRequestedInitialProjection(requestedUrls, 'projection-store startup');
    const atom = store.projectionStore.getLabelAtom(ref(100, 'title'));

    patchListener({
      data: JSON.stringify({
        snapshot_patch: {
          patch_kind: 'json_replace_v1',
          snapshot_seq: 2,
          base_snapshot_seq: 1,
          ops: [{
            op: 'replace_label',
            model_id: 100,
            cell_key: '0,0,0',
            label_key: 'title',
            value: label('title', 'str', 'After'),
          }],
        },
      }),
    });

    await waitFor(
      () => store.getEffectiveLabelValue(ref(100, 'title')) === 'After',
      'remote store must read patched value through projection store',
    );
    assert.equal(store.projectionStore.getLabelAtom(ref(100, 'title')), atom);

    store.stageOverlayValue({
      ref: ref(100, 'title'),
      value: 'Overlay Wins',
      writeTarget: { commit_policy: 'on_submit' },
    });
    assert.equal(store.getEffectiveLabelValue(ref(100, 'title')), 'Overlay Wins', 'overlay must keep precedence over projection value');
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
  }
}

async function test_remote_store_local_pending_state_updates_projection_store() {
  let snapshotListener = null;
  const requestedUrls = [];
  globalThis.EventSource = class FakeEventSource {
    constructor(url) {
      requestedUrls.push(String(url));
    }
    addEventListener(type, listener) {
      if (type === 'snapshot') snapshotListener = listener;
    }
    close() {}
  };
  globalThis.fetch = async (url) => {
    const href = String(url);
    requestedUrls.push(href);
    if (isProfiledSnapshotRequest(href)) {
      return jsonResponse({
        snapshot: {
          models: {
            '-2': {
              id: -2,
              cells: {
                '0,0,0': {
                  p: 0,
                  r: 0,
                  c: 0,
                  labels: {
                    desktop_foreground_app_json: label('desktop_foreground_app_json', 'json', null),
                  },
                },
              },
            },
          },
          v1nConfig: {},
        },
        snapshot_seq: 1,
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  };

  try {
    const authStore = { state: { authenticated: false } };
    const store = createRemoteStore({ baseUrl: 'http://127.0.0.1:30900', authStore });
    const target = ref(-2, 'desktop_foreground_app_json');
    await waitFor(
      () => store.getEffectiveLabelValue(target) === null,
      'remote store must hydrate initial negative local state into projection store',
    );
    assertNoImplicitFullSnapshotRequest(requestedUrls, 'local-pending startup');
    assertRequestedInitialProjection(requestedUrls, 'local-pending startup');

    const nextApp = { id: 'workspace:100', kind: 'workspace', page: 'workspace', model_id: 100 };
    store.dispatchAddLabel({
      p: 0,
      r: 0,
      c: 1,
      k: 'ui_event',
      t: 'event',
      v: {
        event_id: Date.now(),
        type: 'label_update',
        source: 'ui_renderer',
        ts: 0,
        payload: {
          action: 'label_update',
          target,
          value: { t: 'json', v: nextApp },
        },
      },
    });

    assert.deepEqual(
      store.getEffectiveLabelValue(target),
      nextApp,
      'local pending UI state must update projection atom immediately',
    );

    assert.equal(typeof snapshotListener, 'function', 'remote store must subscribe to profiled snapshot events');
    snapshotListener({
      data: JSON.stringify({
        snapshot: {
          models: {
            '-2': {
              id: -2,
              cells: {
                '0,0,0': {
                  p: 0,
                  r: 0,
                  c: 0,
                  labels: {
                    desktop_foreground_app_json: label('desktop_foreground_app_json', 'json', null),
                  },
                },
              },
            },
          },
          v1nConfig: {},
        },
        snapshot_seq: 2,
      }),
    });

    assert.deepEqual(
      store.getEffectiveLabelValue(target),
      nextApp,
      'local pending UI state must survive unrelated full snapshot fallback while unauthenticated',
    );
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
  }
}

async function test_remote_store_ignores_stale_eventsource_patches_after_reconnect() {
  const requestedUrls = [];
  const streams = [];
  globalThis.EventSource = class FakeEventSource {
    constructor(url) {
      this.url = String(url);
      this.readyState = 1;
      this.listeners = new Map();
      streams.push(this);
      requestedUrls.push(this.url);
    }
    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    }
    close() {
      this.readyState = 2;
    }
    emit(type, data) {
      const listener = this.listeners.get(type);
      if (listener) listener({ data: JSON.stringify(data) });
    }
  };
  globalThis.fetch = async (url) => {
    const href = String(url);
    requestedUrls.push(href);
    const parsed = new URL(href);
    if (parsed.pathname === '/snapshot' && parsed.searchParams.get('profile') === 'bootstrap') {
      return jsonResponse({
        snapshot: snapshotWithLabels({ title: label('title', 'str', 'Bootstrap') }, 100),
        snapshot_seq: 1,
      });
    }
    if (parsed.pathname === '/snapshot' && parsed.searchParams.get('profile') === 'visible') {
      return jsonResponse({
        snapshot: snapshotWithLabels({ title: label('title', 'str', 'Visible') }, 200),
        snapshot_seq: 2,
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  };

  try {
    const store = createRemoteStore({ baseUrl: 'http://127.0.0.1:30900' });
    await waitFor(() => streams.length === 1, 'remote store must open initial bootstrap stream');
    await store.ensureVisibleModelLoaded(200);
    await waitFor(() => streams.length === 2, 'remote store must reconnect stream after visible model load');
    const snapshotCountBeforeStalePatch = requestedUrls.filter((url) => String(url).includes('/snapshot')).length;

    streams[0].emit('snapshot_patch', {
      snapshot_patch: {
        patch_kind: 'json_replace_v1',
        snapshot_seq: 99,
        base_snapshot_seq: -1,
        ops: [{
          op: 'replace_label',
          model_id: 100,
          cell_key: '0,0,0',
          label_key: 'title',
          value: label('title', 'str', 'stale should be ignored'),
        }],
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 20));

    const snapshotCountAfterStalePatch = requestedUrls.filter((url) => String(url).includes('/snapshot')).length;
    assert.equal(
      snapshotCountAfterStalePatch,
      snapshotCountBeforeStalePatch,
      'stale EventSource patch must not trigger snapshot recovery',
    );
    assert.equal(
      store.getEffectiveLabelValue(ref(100, 'title')),
      'Bootstrap',
      'stale EventSource patch must not mutate the active projection',
    );
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
  }
}

async function test_remote_store_handles_lagging_active_stream_patches_by_freshness() {
  const requestedUrls = [];
  let patchListener = null;
  let recoverySnapshotSeq = 5;
  globalThis.EventSource = class FakeEventSource {
    constructor(url) {
      this.url = String(url);
      this.readyState = 1;
      requestedUrls.push(this.url);
    }
    addEventListener(type, listener) {
      if (type === 'snapshot_patch') patchListener = listener;
    }
    close() {
      this.readyState = 2;
    }
  };
  console.warn = () => {};
  globalThis.fetch = async (url) => {
    const href = String(url);
    requestedUrls.push(href);
    const parsed = new URL(href);
    if (parsed.pathname === '/snapshot' && parsed.searchParams.get('profile') === 'bootstrap') {
      return jsonResponse({
        snapshot: snapshotWithLabels({ title: label('title', 'str', 'Current') }, 100),
        snapshot_seq: recoverySnapshotSeq,
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  };

  try {
    const store = createRemoteStore({ baseUrl: 'http://127.0.0.1:30900' });
    await waitFor(
      () => store.getEffectiveLabelValue(ref(100, 'title')) === 'Current' && typeof patchListener === 'function',
      'remote store must hydrate current snapshot and register patch listener',
    );
    const snapshotCountBeforeOldPatch = requestedUrls.filter((url) => String(url).includes('/snapshot')).length;

    patchListener({
      data: JSON.stringify({
        snapshot_patch: {
          patch_kind: 'json_replace_v1',
          snapshot_seq: 4,
          base_snapshot_seq: 3,
          ops: [{
            op: 'replace_label',
            model_id: 100,
            cell_key: '0,0,0',
            label_key: 'title',
            value: label('title', 'str', 'Old patch should be ignored'),
          }],
        },
      }),
    });
    await new Promise((resolve) => setTimeout(resolve, 20));

    const snapshotCountAfterOldPatch = requestedUrls.filter((url) => String(url).includes('/snapshot')).length;
    assert.equal(
      snapshotCountAfterOldPatch,
      snapshotCountBeforeOldPatch,
      'already-obsolete active-stream patch must not trigger snapshot recovery',
    );
    assert.equal(
      store.getEffectiveLabelValue(ref(100, 'title')),
      'Current',
      'already-obsolete active-stream patch must not overwrite the newer current snapshot',
    );

    recoverySnapshotSeq = 6;
    patchListener({
      data: JSON.stringify({
        snapshot_patch: {
          patch_kind: 'json_replace_v1',
          snapshot_seq: 6,
          base_snapshot_seq: 4,
          ops: [{
            op: 'replace_label',
            model_id: 100,
            cell_key: '0,0,0',
            label_key: 'title',
            value: label('title', 'str', 'Fresh lagging patch needs recovery'),
          }],
        },
      }),
    });
    await waitFor(
      () => requestedUrls.filter((url) => String(url).includes('/snapshot')).length > snapshotCountAfterOldPatch,
      'fresh-but-lagging active-stream patch must trigger active profile snapshot recovery',
    );
    assert.equal(
      store.getEffectiveLabelValue(ref(100, 'title')),
      'Current',
      'fresh-but-lagging recovery must keep the recovered snapshot as truth',
    );
  } finally {
    console.warn = originalConsoleWarn;
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
  }
}

const tests = [
  test_projection_store_hydrates_and_patches_label_atoms,
  test_projection_store_handles_cell_model_and_config_ops,
  test_remote_store_reads_patch_updates_from_projection_store,
  test_remote_store_local_pending_state_updates_projection_store,
  test_remote_store_ignores_stale_eventsource_patches_after_reconnect,
  test_remote_store_handles_lagging_active_stream_patches_by_freshness,
];

let passed = 0;
for (const test of tests) {
  await test();
  passed += 1;
  console.log(`[PASS] ${test.name}`);
}

console.log(`PASS test_0415_reactive_projection_store_contract: ${passed} passed`);
