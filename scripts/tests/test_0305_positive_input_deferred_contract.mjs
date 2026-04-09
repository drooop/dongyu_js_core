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
    if (String(url).endsWith('/ui_event')) return makeResponse({ ok: true, result: 'ok', snapshot: { models: {}, v1nConfig: {} } });
    throw new Error(`unexpected fetch ${url}`);
  };

  const mod = await import(pathToFileURL(path.join(repoRoot, 'packages/ui-model-demo-frontend/src/remote_store.js')).href);
  const { createRemoteStore } = mod;
  const store = createRemoteStore({ baseUrl: 'http://127.0.0.1:9000' });
  await new Promise((resolve) => setTimeout(resolve, 0));

  store.snapshot.models['501'] = {
    cells: {
      '0,0,0': {
        labels: {
          body_text: { k: 'body_text', t: 'str', v: 'committed text' },
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

  const ref = { model_id: 501, p: 0, r: 0, c: 0, k: 'body_text' };
  const writeTarget = {
    action: 'ui_owner_label_update',
    target_ref: ref,
    commit_policy: 'on_blur',
  };

  store.stageOverlayValue({ ref, value: 'draft body text', writeTarget });

  assert.equal(
    store.getEffectiveLabelValue(ref),
    'draft body text',
    'positive_overlay_must_override_committed_read_before_blur',
  );
  assert.equal(
    store.snapshot.models['501'].cells['0,0,0'].labels.body_text.v,
    'committed text',
    'positive_overlay_must_not_mutate_snapshot_before_blur_commit',
  );
  assert.equal(
    fetchCalls.filter((call) => call.url.endsWith('/ui_event')).length,
    0,
    'positive_overlay_must_not_flush_ui_event_before_blur',
  );

  await store.commitOverlayValue({ ref, writeTarget });

  const uiEventBodies = fetchCalls
    .filter((call) => call.url.endsWith('/ui_event'))
    .map((call) => JSON.parse(call.options.body));

  assert.equal(uiEventBodies.length, 1, 'positive_on_blur_commit_must_flush_once');
  assert.equal(uiEventBodies[0].payload.action, 'ui_owner_label_update', 'positive_on_blur_commit_must_use_owner_update');
  assert.deepEqual(uiEventBodies[0].payload.target, ref, 'positive_on_blur_commit_must_target_positive_model_ref');
  assert.equal(uiEventBodies[0].payload.value.v, 'draft body text', 'positive_on_blur_commit_must_flush_staged_value');

  console.log('PASS test_0305_positive_input_deferred_contract');
}

main()
  .catch((err) => {
    console.error(`FAIL test_0305_positive_input_deferred_contract: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => {
    global.fetch = originalFetch;
    global.EventSource = originalEventSource;
    global.window = originalWindow;
  });
