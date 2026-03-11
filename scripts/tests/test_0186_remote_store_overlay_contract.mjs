#!/usr/bin/env node

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const originalFetch = global.fetch;
const originalEventSource = global.EventSource;
const originalWindow = global.window;

function makeResponse(body) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: () => 'application/json' },
    async json() { return body; },
    async text() { return JSON.stringify(body); },
  };
}

function mailboxLabel(envelope) {
  return {
    p: 0,
    r: 0,
    c: 1,
    k: 'ui_event',
    t: 'event',
    v: envelope,
  };
}

async function main() {
  const fetchCalls = [];
  global.window = { location: { origin: 'http://127.0.0.1:9000' } };
  global.EventSource = class FakeEventSource {
    addEventListener() {}
    close() {}
  };
  global.fetch = async (url, options = {}) => {
    fetchCalls.push({ url: String(url), options });
    if (String(url).endsWith('/snapshot')) return makeResponse({ snapshot: { models: {}, v1nConfig: {} } });
    if (String(url).endsWith('/api/runtime/mode')) return makeResponse({ ok: true, mode: 'running' });
    if (String(url).endsWith('/ui_event')) {
      return makeResponse({ ok: true, result: 'ok', snapshot: { models: {}, v1nConfig: {} } });
    }
    throw new Error(`unexpected fetch ${url}`);
  };

  const mod = await import(pathToFileURL(path.join(repoRoot, 'packages/ui-model-demo-frontend/src/remote_store.js')).href);
  const { createRemoteStore } = mod;
  const store = createRemoteStore({ baseUrl: 'http://127.0.0.1:9000' });
  await new Promise((resolve) => setTimeout(resolve, 0));

  store.snapshot.models['200'] = {
    cells: {
      '0,0,0': {
        labels: {
          slider_value: { k: 'slider_value', t: 'int', v: 0 },
          title: { k: 'title', t: 'str', v: 'old' },
        },
      },
    },
  };
  store.snapshot.models['-1'] = {
    cells: {
      '0,0,1': {
        labels: {
          ui_event: { k: 'ui_event', t: 'event', v: null },
          ui_event_last_op_id: { k: 'ui_event_last_op_id', t: 'str', v: '' },
          ui_event_error: { k: 'ui_event_error', t: 'json', v: null },
        },
      },
    },
  };

  assert.equal(typeof store.getEffectiveLabelValue, 'function', 'remote store must expose getEffectiveLabelValue for overlay-aware rendering');
  assert.equal(typeof store.stageOverlayValue, 'function', 'remote store must expose stageOverlayValue for overlay_then_commit labels');

  store.stageOverlayValue({
    ref: { model_id: 200, p: 0, r: 0, c: 0, k: 'slider_value' },
    value: 42,
    writeTarget: {
      action: 'label_update',
      target_ref: { model_id: 200, p: 0, r: 0, c: 0, k: 'slider_value' },
      commit_policy: 'on_change',
    },
  });

  assert.equal(
    store.getEffectiveLabelValue({ model_id: 200, p: 0, r: 0, c: 0, k: 'slider_value' }),
    42,
    'staged overlay value must override committed snapshot for reads',
  );
  assert.equal(
    store.snapshot.models['200'].cells['0,0,0'].labels.slider_value.v,
    0,
    'staging overlay must not mutate committed snapshot directly',
  );

  store.stageOverlayValue({
    ref: { model_id: 200, p: 0, r: 0, c: 0, k: 'title' },
    value: 'draft',
    writeTarget: {
      action: 'label_update',
      target_ref: { model_id: 200, p: 0, r: 0, c: 0, k: 'title' },
      commit_policy: 'on_submit',
    },
  });

  await store.dispatchAddLabel(mailboxLabel({
    event_id: 1,
    type: 'submit',
    source: 'ui_renderer',
    ts: 0,
    payload: {
      action: 'submit',
      meta: { op_id: 'submit_0186', model_id: 200 },
      value: { t: 'event', v: { action: 'submit' } },
    },
  }));

  const uiEventBodies = fetchCalls
    .filter((call) => call.url.endsWith('/ui_event'))
    .map((call) => JSON.parse(call.options.body));

  assert.equal(uiEventBodies.length, 2, 'on_submit overlay must flush one label_update before the triggering action');
  assert.equal(uiEventBodies[0].payload.action, 'label_update', 'overlay flush must commit as label_update first');
  assert.deepEqual(
    uiEventBodies[0].payload.target,
    { model_id: 200, p: 0, r: 0, c: 0, k: 'title' },
    'overlay flush must target the declared commit ref',
  );
  assert.equal(uiEventBodies[0].payload.value.v, 'draft', 'overlay flush must commit the staged value');
  assert.equal(uiEventBodies[1].payload.action, 'submit', 'triggering action must be sent after overlay flush');
  await new Promise((resolve) => setTimeout(resolve, 0));

  console.log('PASS test_0186_remote_store_overlay_contract');
}

main()
  .catch((err) => {
    console.error(`FAIL test_0186_remote_store_overlay_contract: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => {
    global.fetch = originalFetch;
    global.EventSource = originalEventSource;
    global.window = originalWindow;
  });
