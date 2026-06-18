#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createProjectionStore } from '../../packages/ui-model-demo-frontend/src/projection_store.js';
import { createRemoteStore } from '../../packages/ui-model-demo-frontend/src/remote_store.js';

const originalFetch = globalThis.fetch;
const originalEventSource = globalThis.EventSource;

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
  globalThis.EventSource = class FakeEventSource {
    constructor() {
      this.readyState = 1;
    }
    addEventListener(type, listener) {
      if (type === 'snapshot_patch') patchListener = listener;
    }
    close() {}
  };
  globalThis.fetch = async (url) => {
    const href = String(url);
    if (href.endsWith('/snapshot') || href.endsWith('/snapshot?profile=bootstrap')) {
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
  globalThis.EventSource = class FakeEventSource {
    addEventListener(type, listener) {
      if (type === 'snapshot') snapshotListener = listener;
    }
    close() {}
  };
  globalThis.fetch = async (url) => {
    const href = String(url);
    if (href.endsWith('/snapshot') || href.endsWith('/snapshot?profile=bootstrap')) {
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

    assert.equal(typeof snapshotListener, 'function', 'remote store must subscribe to full snapshot events');
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

const tests = [
  test_projection_store_hydrates_and_patches_label_atoms,
  test_projection_store_handles_cell_model_and_config_ops,
  test_remote_store_reads_patch_updates_from_projection_store,
  test_remote_store_local_pending_state_updates_projection_store,
];

let passed = 0;
for (const test of tests) {
  await test();
  passed += 1;
  console.log(`[PASS] ${test.name}`);
}

console.log(`PASS test_0415_reactive_projection_store_contract: ${passed} passed`);
