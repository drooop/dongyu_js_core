#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createRenderer } from '../../packages/ui-renderer/src/renderer.mjs';

function main() {
  const dispatched = [];
  const snapshot = {
    models: {
      '-2': {
        cells: {
          '0,0,0': {
            labels: {
              model100_input_draft: { k: 'model100_input_draft', t: 'str', v: '' },
            },
          },
        },
      },
    },
  };

  const host = {
    getSnapshot: () => snapshot,
    getEffectiveLabelValue(ref) {
      if (ref && ref.model_id === -2 && ref.k === 'model100_input_draft') return 'overlay draft text';
      return undefined;
    },
    dispatchAddLabel(label) {
      dispatched.push(label);
    },
    dispatchRmLabel() {},
  };

  const renderer = createRenderer({
    host,
    vue: {
      h(type, props, children) {
        return { type, props: props || {}, children };
      },
      resolveComponent(name) {
        return name;
      },
    },
  });

  const vnode = renderer.renderVNode({
    id: 'overlay_submit_button',
    type: 'Button',
    props: { label: 'Generate Color' },
    bind: {
      write: {
        action: 'submit',
        meta: { model_id: 100 },
        value_ref: {
          t: 'event',
          v: {
            action: 'submit',
            input_value: {
              $label: { model_id: -2, p: 0, r: 0, c: 0, k: 'model100_input_draft' },
            },
          },
        },
      },
    },
  });

  assert.equal(typeof vnode.props?.onClick, 'function', 'button_onClick_missing');
  vnode.props.onClick();

  assert.equal(dispatched.length, 1, 'button_click_must_dispatch_single_event');
  const envelope = dispatched[0]?.v;
  assert.equal(envelope?.payload?.action, 'submit', 'button_dispatch_action_must_be_submit');
  assert.equal(
    envelope?.payload?.value?.v?.input_value,
    'overlay draft text',
    'button_value_ref_must_use_overlay_effective_value',
  );
  console.log('[PASS] button_value_ref_uses_overlay_effective_value');
}

try {
  main();
} catch (error) {
  console.log(`[FAIL] main: ${error.message}`);
  process.exit(1);
}
