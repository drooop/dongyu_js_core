#!/usr/bin/env node

import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const rendererPath = path.join(repoRoot, 'packages/ui-renderer/src/renderer.js');
const require = createRequire(import.meta.url);

function fakeH(component, props, slots) {
  return { component, props, slots };
}

function fakeResolveComponent(name) {
  return name;
}

function buildHost() {
  const calls = [];
  return {
    host: {
      getSnapshot() {
        return { models: { '-1': { cells: { '0,0,1': { labels: { bus_event_last_op_id: { k: 'bus_event_last_op_id', t: 'str', v: 'op_1' } } } } } } };
      },
      dispatchAddLabel(label) {
        calls.push(label);
      },
      dispatchRmLabel() {},
    },
    calls,
  };
}

function buildButtonNode() {
  return {
    id: 'submit_button',
    type: 'Button',
    props: {
      label: 'Generate Color',
      singleFlight: {
        key: 'model100_submit',
        releaseRef: { model_id: -1, p: 0, r: 0, c: 1, k: 'bus_event_last_op_id' },
      },
    },
    bind: {
      write: {
        action: 'label_update',
        target_ref: { model_id: -2, p: 0, r: 0, c: 0, k: 'draft' },
      },
    },
    cell_ref: { model_id: 100, p: 1, r: 0, c: 0 },
  };
}

async function clickOnceWithFreshModule() {
  delete require.cache[rendererPath];
  const { createRenderer } = require(rendererPath);
  const { host, calls } = buildHost();
  const renderer = createRenderer({ host, vue: { h: fakeH, resolveComponent: fakeResolveComponent } });
  const vnode = renderer.renderVNode(buildButtonNode());
  assert.equal(typeof vnode.props.onClick, 'function', 'button_onClick_missing');
  vnode.props.onClick();
  assert.equal(calls.length, 1, 'dispatchAddLabel_must_be_called_once');
  return calls[0]?.v?.payload?.meta?.op_id ?? null;
}

async function main() {
  const first = await clickOnceWithFreshModule();
  const second = await clickOnceWithFreshModule();
  assert.ok(first, 'first_op_id_missing');
  assert.ok(second, 'second_op_id_missing');
  assert.notEqual(first, second, 'fresh_renderer_sessions_must_not_reuse_same_op_id');
  console.log('PASS test_0329_renderer_opid_uniqueness_contract');
}

main().catch((err) => {
  console.error(`FAIL test_0329_renderer_opid_uniqueness_contract: ${err.message}`);
  process.exit(1);
});
