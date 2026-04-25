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

  const host = {
    getSnapshot: () => ({
      models: {
        '-2': {
          id: -2,
          cells: {
            '0,0,0': {
              labels: {
                ws_selected_title: { k: 'ws_selected_title', t: 'str', v: 'Workspace / Gallery' },
              },
            },
          },
        },
      },
    }),
    dispatchAddLabel: () => {},
    dispatchRmLabel: () => {},
  };

  const renderer = createRenderer({ host, vue: { h: fakeH, resolveComponent: fakeResolve } });
  const vnode = renderer.renderVNode({
    id: 'ws_right_panel',
    type: 'Card',
    props: {
      title: { $label: { model_id: -2, p: 0, r: 0, c: 0, k: 'ws_selected_title' } },
    },
    children: [],
  });

  const headerValue = vnode.children.header();
  assert.equal(headerValue, 'Workspace / Gallery', 'Card header must resolve $label to string value');
  console.log('PASS test_0199_card_title_label_resolution');
}

main().catch((err) => {
  console.error(`FAIL test_0199_card_title_label_resolution: ${err.message}`);
  process.exitCode = 1;
});
