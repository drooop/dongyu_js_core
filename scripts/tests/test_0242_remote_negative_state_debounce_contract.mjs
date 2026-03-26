#!/usr/bin/env node

import assert from 'node:assert/strict';

const BASE_URL = 'http://127.0.0.1:39092';

function makeSnapshot() {
  return {
    models: {
      '-1': {
        cells: {
          '0,0,1': {
            labels: {
              ui_event: { k: 'ui_event', t: 'event', v: null },
              ui_event_last_op_id: { k: 'ui_event_last_op_id', t: 'str', v: '' },
              ui_event_error: { k: 'ui_event_error', t: 'json', v: null },
            },
          },
        },
      },
      '-2': {
        cells: {
          '0,0,0': {
            labels: {
              example_input_draft: { k: 'example_input_draft', t: 'str', v: '' },
            },
          },
        },
      },
    },
    v1nConfig: { local_mqtt: null, global_mqtt: null },
  };
}

function mailboxLabelFor(target, value, opId) {
  return {
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
        meta: { op_id: opId },
        target,
        value,
      },
    },
  };
}

function readValue(snapshot, ref) {
  const model = snapshot.models[String(ref.model_id)];
  if (!model) return undefined;
  const cell = model.cells[`${ref.p},${ref.r},${ref.c}`];
  if (!cell || !cell.labels) return undefined;
  const label = cell.labels[ref.k];
  return label ? label.v : undefined;
}

function countUiEventCalls(fetchCalls) {
  return fetchCalls.filter((call) => String(call.url).endsWith('/ui_event'));
}

const snapshotPayload = makeSnapshot();
const fetchCalls = [];

global.window = { location: { origin: BASE_URL } };
global.fetch = async (url, options = {}) => {
  fetchCalls.push({ url: String(url), options });
  if (String(url).endsWith('/snapshot')) {
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ snapshot: structuredClone(snapshotPayload) }),
    };
  }
  if (String(url).endsWith('/api/runtime/mode')) {
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ ok: true }),
    };
  }
  if (String(url).endsWith('/ui_event')) {
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ ok: true, result: 'ok' }),
    };
  }
  throw new Error(`unexpected fetch url: ${url}`);
};
global.EventSource = class FakeEventSource {
  addEventListener() {}
  close() {}
};

const { createRemoteStore } = await import('../../packages/ui-model-demo-frontend/src/remote_store.js');

const store = createRemoteStore({ baseUrl: BASE_URL });
await new Promise((resolve) => setTimeout(resolve, 0));

const draftRef = { model_id: -2, p: 0, r: 0, c: 0, k: 'example_input_draft' };

store.dispatchAddLabel(mailboxLabelFor(draftRef, { t: 'str', v: 'h' }, 'draft_1'));
store.dispatchAddLabel(mailboxLabelFor(draftRef, { t: 'str', v: 'he' }, 'draft_2'));
store.dispatchAddLabel(mailboxLabelFor(draftRef, { t: 'str', v: 'hello' }, 'draft_3'));

assert.equal(
  readValue(store.snapshot, draftRef),
  'hello',
  'negative-state input must patch local snapshot immediately with latest value',
);
assert.equal(
  countUiEventCalls(fetchCalls).length,
  0,
  'negative-state typing must not POST /ui_event immediately',
);

await new Promise((resolve) => setTimeout(resolve, 120));
assert.equal(
  countUiEventCalls(fetchCalls).length,
  0,
  'negative-state typing must still be coalesced before 200ms',
);

await new Promise((resolve) => setTimeout(resolve, 140));
const uiEventCalls = countUiEventCalls(fetchCalls);
assert.equal(
  uiEventCalls.length,
  1,
  'coalesced negative-state typing must flush exactly one /ui_event after idle debounce',
);

const body = JSON.parse(uiEventCalls[0].options.body);
assert.deepEqual(body.payload.target, draftRef, 'debounce flush must target the same negative state label');
assert.equal(body.payload.value.t, 'str', 'debounce flush must preserve typed value type');
assert.equal(body.payload.value.v, 'hello', 'debounce flush must commit the latest typed value only');
assert.equal(body.payload.meta.op_id, 'draft_3', 'debounce flush must retain the latest op_id');

console.log('PASS test_0242_remote_negative_state_debounce_contract');
