#!/usr/bin/env node

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRenderer as createEsmRenderer } from '../../packages/ui-renderer/src/renderer.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');
const { createRenderer: createCjsRenderer } = await import(path.join(repoRoot, 'packages/ui-renderer/src/renderer.js'));

function makeSnapshot(openKey, value) {
  return {
    models: {
      '-2': {
        cells: {
          '0,0,0': {
            labels: {
              [openKey]: { k: openKey, t: 'bool', v: value },
            },
          },
        },
      },
    },
  };
}

function makeOverlayNode(type, openKey) {
  return {
    id: `${type.toLowerCase()}_noop_fixture`,
    type,
    props: { title: `${type} fixture` },
    bind: {
      read: { model_id: -2, p: 0, r: 0, c: 0, k: openKey },
      write: { action: 'ui_owner_label_update', target_ref: { model_id: -2, p: 0, r: 0, c: 0, k: openKey } },
    },
    children: [],
  };
}

function renderOverlay(createRenderer, type, currentValue) {
  const openKey = `${type.toLowerCase()}_open`;
  const emitted = [];
  const host = {
    getSnapshot: () => makeSnapshot(openKey, currentValue),
    dispatchAddLabel: (label) => emitted.push(label),
    dispatchRmLabel: () => {},
  };
  const renderer = createRenderer({
    host,
    vue: {
      h: (tag, props, children) => ({ tag, props: props || {}, children }),
      resolveComponent: (name) => name,
    },
  });
  return {
    emitted,
    vnode: renderer.renderVNode(makeOverlayNode(type, openKey)),
  };
}

function assertOverlaySkipsNoopUpdates(createRenderer, label, type) {
  const closed = renderOverlay(createRenderer, type, false);
  assert.equal(closed.vnode.props.modelValue, false, `${label}_${type}_closed_fixture_not_closed`);
  closed.vnode.props['onUpdate:modelValue'](false);
  assert.equal(closed.emitted.length, 0, `${label}_${type}_noop_close_must_not_dispatch`);

  const opened = renderOverlay(createRenderer, type, true);
  assert.equal(opened.vnode.props.modelValue, true, `${label}_${type}_open_fixture_not_open`);
  opened.vnode.props['onUpdate:modelValue'](false);
  assert.equal(opened.emitted.length, 1, `${label}_${type}_real_close_must_dispatch`);
  assert.equal(opened.emitted[0]?.v?.payload?.target?.k, `${type.toLowerCase()}_open`, `${label}_${type}_real_close_target_mismatch`);
  assert.equal(opened.emitted[0]?.v?.payload?.value?.v, false, `${label}_${type}_real_close_value_mismatch`);
}

function run() {
  for (const [label, createRenderer] of [['esm', createEsmRenderer], ['cjs', createCjsRenderer]]) {
    for (const type of ['Dialog', 'Drawer']) {
      assertOverlaySkipsNoopUpdates(createRenderer, label, type);
    }
  }
  console.log('PASS test_0412_overlay_noop_model_value_contract');
}

run();
