#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const require = createRequire(import.meta.url);

function fakeH(type, props, children) {
  return { type, props: props || {}, children };
}

function fakeResolve(name) {
  return name;
}

async function main() {
  const { createRenderer } = require(path.join(repoRoot, 'packages/ui-renderer/src/index.js'));

  const calls = [];
  const host = {
    getSnapshot: () => ({
      models: {
        '200': {
          cells: {
            '0,0,0': {
              labels: {
                slider_value: { k: 'slider_value', t: 'int', v: 0 },
                title: { k: 'title', t: 'str', v: 'old' },
              },
            },
          },
        },
        '-1': { cells: { '0,0,1': { labels: {} } } },
      },
    }),
    getEffectiveLabelValue: (ref) => {
      if (ref.k === 'slider_value') return 12;
      if (ref.k === 'title') return 'draft title';
      return undefined;
    },
    stageOverlayValue: (payload) => { calls.push({ type: 'stage', payload }); },
    commitOverlayValue: (payload) => { calls.push({ type: 'commit', payload }); },
    dispatchAddLabel: (label) => { calls.push({ type: 'dispatch', label }); },
    dispatchRmLabel: () => {},
  };

  const renderer = createRenderer({ host, vue: { h: fakeH, resolveComponent: fakeResolve } });

  const sliderNode = {
    id: 'slider_overlay',
    type: 'Slider',
    props: { min: 0, max: 100 },
    bind: {
      read: { model_id: 200, p: 0, r: 0, c: 0, k: 'slider_value' },
      write: {
        action: 'label_update',
        target_ref: { model_id: 200, p: 0, r: 0, c: 0, k: 'slider_value' },
        commit_policy: 'on_change',
      },
    },
  };

  const sliderVNode = renderer.renderVNode(sliderNode);
  assert.equal(sliderVNode.props.modelValue, 12, 'renderer must read effective overlay value when host exposes it');
  sliderVNode.props['onUpdate:modelValue'](25);
  assert.equal(calls.at(-1).type, 'stage', 'slider on_change must stage overlay during drag');
  sliderVNode.props.onChange(25);
  assert.equal(calls.at(-1).type, 'commit', 'slider on_change must commit overlay on change');
  assert.equal(
    calls.filter((entry) => entry.type === 'dispatch').length,
    0,
    'overlay_then_commit slider must not dispatch mailbox writes on every update',
  );

  calls.length = 0;
  const sliderWithChangeNode = {
    id: 'slider_overlay_with_change',
    type: 'Slider',
    props: { min: 0, max: 100 },
    bind: {
      read: { model_id: -102, p: 0, r: 3, c: 0, k: 'slider_demo' },
      write: {
        action: 'label_update',
        target_ref: { model_id: -102, p: 0, r: 3, c: 0, k: 'slider_demo' },
        commit_policy: 'on_change',
      },
      change: {
        action: 'label_update',
        target_ref: { model_id: -102, p: 0, r: 3, c: 1, k: 'slider_change' },
      },
    },
  };
  const sliderWithChangeVNode = renderer.renderVNode(sliderWithChangeNode);
  sliderWithChangeVNode.props['onUpdate:modelValue'](100);
  sliderWithChangeVNode.props.onChange(100);
  assert.equal(
    calls.some((entry) => entry.type === 'commit'),
    true,
    'slider with extra change target must still commit its staged main value on change',
  );
  assert.equal(
    calls.some((entry) => entry.type === 'dispatch'),
    true,
    'slider with extra change target must still dispatch the explicit change action',
  );

  const inputNode = {
    id: 'input_overlay',
    type: 'Input',
    props: {},
    bind: {
      read: { model_id: 200, p: 0, r: 0, c: 0, k: 'title' },
      write: {
        action: 'label_update',
        target_ref: { model_id: 200, p: 0, r: 0, c: 0, k: 'title' },
        commit_policy: 'on_blur',
      },
    },
  };

  const inputVNode = renderer.renderVNode(inputNode);
  assert.equal(inputVNode.props.modelValue, 'draft title', 'input must also render effective overlay value');
  inputVNode.props['onUpdate:modelValue']('next draft');
  assert.equal(calls.at(-1).type, 'stage', 'input on_blur must stage overlay during typing');
  assert.equal(typeof inputVNode.props.onBlur, 'function', 'input on_blur must wire a blur commit hook');
  inputVNode.props.onBlur();
  assert.equal(calls.at(-1).type, 'commit', 'input on_blur must commit overlay on blur');

  console.log('PASS test_0186_renderer_commit_policy_contract');
}

main().catch((err) => {
  console.error(`FAIL test_0186_renderer_commit_policy_contract: ${err.message}`);
  process.exitCode = 1;
});
