#!/usr/bin/env node

import assert from 'node:assert/strict';

const BASE_URL = 'http://127.0.0.1:39091';

function makeSnapshot() {
  return {
    models: {
      '-1': {
        cells: {
          '0,0,0': { labels: { ui_ast_v0: { k: 'ui_ast_v0', t: 'json', v: { id: 'root', type: 'Root', children: [] } } } },
          '0,0,1': { labels: { ui_event: { k: 'ui_event', t: 'event', v: null } } },
        },
      },
      '-2': {
        cells: {
          '0,0,0': {
            labels: {
              model100_input_draft: { k: 'model100_input_draft', t: 'str', v: 'before-draft' },
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
      source: { node_type: 'Input', node_id: `node_${opId}` },
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
  constructor(url) {
    this.url = url;
  }
  addEventListener() {}
  close() {}
};

const { createRemoteStore } = await import('../../packages/ui-model-demo-frontend/src/remote_store.js');

const store = createRemoteStore({ baseUrl: BASE_URL });
await new Promise((resolve) => setTimeout(resolve, 0));

const draftRef = { model_id: -2, p: 0, r: 0, c: 0, k: 'model100_input_draft' };
const sliderRef = { model_id: -102, p: 0, r: 3, c: 0, k: 'slider_demo' };

store.dispatchAddLabel(mailboxLabelFor(draftRef, { t: 'str', v: 'after-draft' }, 'op_draft'));
assert.equal(
  readValue(store.snapshot, draftRef),
  'after-draft',
  'negative editor-state draft writes must patch local snapshot immediately',
);

store.dispatchAddLabel(mailboxLabelFor(sliderRef, { t: 'int', v: 77 }, 'op_slider'));
assert.equal(
  readValue(store.snapshot, sliderRef),
  77,
  'negative non-editor-state UI labels must materialize and patch local snapshot immediately',
);

const uiEventCallsBeforeFlush = fetchCalls.filter((call) => String(call.url).endsWith('/ui_event')).length;
assert.equal(uiEventCallsBeforeFlush, 0, 'local-first negative-state writes must not need immediate ui_event roundtrip to update UI');

console.log('PASS test_0185_remote_negative_state_local_first_contract');
