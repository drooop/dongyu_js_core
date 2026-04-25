#!/usr/bin/env node

import { createDemoStore } from '../src/demo_modeltable.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function walk(node, fn) {
  if (!node || typeof node !== 'object') return;
  fn(node);
  const children = Array.isArray(node.children) ? node.children : [];
  for (const child of children) walk(child, fn);
}

function main() {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const ast = store.getUiAst();

  assert(ast && ast.id === 'root_home', 'expected root_home ast');

  const texts = [];
  const titles = [];
  const ids = [];

  walk(ast, (node) => {
    if (typeof node.id === 'string') ids.push(node.id);
    if (typeof node?.props?.text === 'string') texts.push(node.props.text);
    if (typeof node?.props?.title === 'string') titles.push(node.props.title);
  });

  const joinedTexts = texts.join('\n');
  const joinedTitles = titles.join('\n');
  const joinedIds = ids.join('\n');

  assert(!joinedTexts.includes('home-datatable'), 'home surface must not expose legacy home-datatable marker');
  assert(!joinedTitles.includes('DataTable'), 'home surface must not expose legacy DataTable title');
  assert(!joinedIds.includes('card_home_datatable'), 'home surface must not expose legacy datatable card id');

  console.log('validate_home_surface_local: PASS');
}

try {
  main();
} catch (error) {
  console.error(`validate_home_surface_local: FAIL: ${error.message}`);
  process.exit(1);
}
