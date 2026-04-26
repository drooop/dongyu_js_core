#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createRenderer as createEsmRenderer } from '../../packages/ui-renderer/src/renderer.mjs';

const require = createRequire(import.meta.url);
const { createRenderer: createCjsRenderer } = require('../../packages/ui-renderer/src/renderer.js');

function h(type, props, children) {
  return { type, props: props || {}, children };
}

function makeHost(markdown) {
  return {
    getSnapshot() {
      return {
        models: {
          9001: {
            id: 9001,
            cells: {
              '0,0,0': {
                labels: {
                  doc_markdown: { t: 'str', v: markdown },
                },
              },
            },
          },
        },
      };
    },
    dispatchAddLabel() {},
    dispatchRmLabel() {},
  };
}

function flatten(node, out = []) {
  if (node && typeof node === 'object') {
    out.push(node);
    const children = Array.isArray(node.children) ? node.children : [];
    for (const child of children) flatten(child, out);
  }
  return out;
}

function runCase(label, createRenderer) {
  const markdown = [
    '# UI Model Guide',
    '',
    'Use **cellwise labels** instead of JSON blobs.',
    '',
    '| Label | Meaning |',
    '| --- | --- |',
    '| `ui_component` | Component type |',
    '',
    '```mermaid',
    'flowchart LR',
    '  A[Cell] --> B[Renderer]',
    '```',
  ].join('\n');
  const renderer = createRenderer({
    host: makeHost(markdown),
    vue: { h, resolveComponent: (name) => name },
  });
  const ast = {
    id: 'markdown_doc',
    type: 'Markdown',
    bind: { read: { model_id: 9001, p: 0, r: 0, c: 0, k: 'doc_markdown' } },
    props: { markdown: 'fallback' },
  };

  const tree = renderer.renderTree(ast);
  assert.equal(tree.type, 'Markdown', `${label}:tree_type`);
  assert.equal(tree.text, markdown, `${label}:tree_text_must_use_bound_label`);

  const vnode = renderer.renderVNode(ast);
  assert.equal(vnode.type, 'article', `${label}:vnode_type`);
  const nodes = flatten(vnode);
  assert.ok(nodes.some((node) => node.type === 'h1'), `${label}:heading_must_render`);
  assert.ok(nodes.some((node) => node.type === 'table'), `${label}:table_must_render`);
  assert.ok(nodes.some((node) => node.type === 'div' && node.props?.class === 'markdown-mermaid'), `${label}:mermaid_fence_must_render_as_source_preview_block`);
}

runCase('esm', createEsmRenderer);
runCase('cjs', createCjsRenderer);

console.log('test_0346_markdown_renderer_contract: PASS');
