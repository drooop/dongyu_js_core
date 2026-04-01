#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const registry = JSON.parse(fs.readFileSync(resolve(repoRoot, 'packages/ui-renderer/src/component_registry_v1.json'), 'utf8'));
const components = registry && typeof registry === 'object' && registry.components && typeof registry.components === 'object'
  ? registry.components
  : {};
const docComponents = ['Heading', 'Paragraph', 'List', 'ListItem', 'Callout', 'Image', 'MermaidDiagram', 'Section'];

function test_doc_components_are_registered_under_components_object() {
  for (const name of docComponents) {
    assert.ok(components[name], `${name}_missing_from_components_registry`);
    assert.equal(components[name].tree_kind, name, `${name}_tree_kind_must_match`);
    assert.ok(typeof components[name].vnode_kind === 'string' && components[name].vnode_kind.length > 0, `${name}_vnode_kind_missing`);
  }
  return { key: 'doc_components_are_registered_under_components_object', status: 'PASS' };
}

const tests = [test_doc_components_are_registered_under_components_object];
let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    const result = test();
    console.log(`[${result.status}] ${result.key}`);
    passed += 1;
  } catch (error) {
    console.log(`[FAIL] ${test.name}: ${error.message}`);
    failed += 1;
  }
}
console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
