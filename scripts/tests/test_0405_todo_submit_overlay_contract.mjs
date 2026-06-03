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
    if (String(url).endsWith('/bus_event')) return makeResponse({ ok: true, result: 'ok', snapshot: { models: {}, v1nConfig: {} } });
    throw new Error(`unexpected fetch ${url}`);
  };

  const { createRemoteStore } = await import(pathToFileURL(path.join(repoRoot, 'packages/ui-model-demo-frontend/src/remote_store.js')).href);
  const store = createRemoteStore({ baseUrl: 'http://127.0.0.1:9000' });
  await new Promise((resolve) => setTimeout(resolve, 0));

  store.snapshot.models['1086'] = {
    cells: {
      '0,0,0': {
        labels: {
          draft_title: { k: 'draft_title', t: 'str', v: '' },
        },
      },
    },
  };

  const ref = { model_id: 1086, p: 0, r: 0, c: 0, k: 'draft_title' };
  const writeTarget = {
    action: 'ui_owner_label_update',
    target_ref: ref,
    commit_policy: 'on_submit',
  };

  store.stageOverlayValue({ ref, value: 'visible title', writeTarget });
  assert.equal(store.getEffectiveLabelValue(ref), 'visible title', 'overlay_must_show_visible_draft');
  assert.equal(
    store.snapshot.models['1086'].cells['0,0,0'].labels.draft_title.v,
    '',
    'overlay_must_not_mutate_snapshot_before_submit',
  );

  const pinEnvelope = {
    event_id: 1,
    type: 'todo_event',
    source: 'ui_renderer',
    ts: 0,
    payload: {
      pin: 'todo_event',
      target: { model_id: 1086, p: 0, r: 0, c: 0 },
      value: [
        { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'ui_event.v1' },
        { id: 0, p: 0, r: 0, c: 0, k: 'todo_action', t: 'str', v: 'create_task' },
      ],
      meta: { op_id: 'todo_create_now' },
    },
  };

  await store.dispatchAddLabel({ p: 0, r: 0, c: 1, k: 'ui_event', t: 'event', v: pinEnvelope });

  const busEventBodies = fetchCalls
    .filter((call) => call.url.endsWith('/bus_event'))
    .map((call) => JSON.parse(call.options.body));

  assert.equal(busEventBodies.length, 2, 'pin_submit_must_flush_overlay_before_formal_pin');
  assert.equal(busEventBodies[0].payload.action, 'ui_owner_label_update', 'first_request_must_commit_visible_draft');
  assert.deepEqual(busEventBodies[0].payload.target, ref, 'overlay_commit_must_target_draft_label');
  assert.equal(busEventBodies[0].payload.value.v, 'visible title', 'overlay_commit_must_use_visible_value');
  assert.equal(busEventBodies[1].payload.pin, 'todo_event', 'second_request_must_be_formal_pin_event');
  assert.equal(busEventBodies[1].payload.meta.op_id, 'todo_create_now', 'pin_event_meta_must_be_preserved');

  store.stageOverlayValue({ ref, value: 'visible title v2', writeTarget });

  const busEventV2Envelope = {
    type: 'bus_event_v2',
    bus_in_key: 'todo_event',
    value: [
      { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'ui_event.v1' },
      { id: 0, p: 0, r: 0, c: 0, k: 'todo_action', t: 'str', v: 'create_task' },
    ],
    meta: { op_id: 'todo_create_v2_now', source: 'ui_renderer' },
  };

  await store.dispatchAddLabel({ p: 0, r: 0, c: 0, k: 'bus_in_event', t: 'event', v: busEventV2Envelope });

  const allBusEventBodies = fetchCalls
    .filter((call) => call.url.endsWith('/bus_event'))
    .map((call) => JSON.parse(call.options.body));
  const v2Bodies = allBusEventBodies.slice(2);
  assert.equal(v2Bodies.length, 2, 'bus_event_v2_submit_must_flush_overlay_before_formal_event');
  assert.equal(v2Bodies[0].payload.action, 'ui_owner_label_update', 'bus_event_v2_first_request_must_commit_visible_draft');
  assert.deepEqual(v2Bodies[0].payload.target, ref, 'bus_event_v2_overlay_commit_must_target_draft_label');
  assert.equal(v2Bodies[0].payload.value.v, 'visible title v2', 'bus_event_v2_overlay_commit_must_use_visible_value');
  assert.equal(v2Bodies[1].type, 'bus_event_v2', 'bus_event_v2_second_request_must_be_formal_event');
  assert.equal(v2Bodies[1].bus_in_key, 'todo_event', 'bus_event_v2_formal_event_must_preserve_bus_in_key');
  assert.equal(v2Bodies[1].meta.op_id, 'todo_create_v2_now', 'bus_event_v2_meta_must_be_preserved');

  console.log('PASS test_0405_todo_submit_overlay_contract');
}

main()
  .catch((err) => {
    console.error(`FAIL test_0405_todo_submit_overlay_contract: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => {
    global.fetch = originalFetch;
    global.EventSource = originalEventSource;
    global.window = originalWindow;
  });
