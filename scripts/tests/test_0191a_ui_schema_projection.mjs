#!/usr/bin/env node

import assert from 'node:assert/strict';
import { buildAstFromSchema } from '../../packages/ui-model-demo-frontend/src/ui_schema_projection.js';

function makeSnapshot() {
  return {
    models: {
      '3001': {
        id: 3001,
        cells: {
          '0,0,0': {
            labels: {
              title: { t: 'str', v: 'Hello World' },
              enabled: { t: 'bool', v: true },
            },
          },
          '1,0,0': {
            labels: {
              _title: { t: 'str', v: 'Sample Form' },
              _subtitle: { t: 'str', v: 'Projection contract sample' },
              _field_order: { t: 'json', v: ['title', 'enabled', 'submit'] },
              title: { t: 'str', v: 'Input' },
              title__label: { t: 'str', v: 'Title' },
              title__props: { t: 'json', v: { placeholder: 'Type here' } },
              enabled: { t: 'str', v: 'Switch' },
              enabled__label: { t: 'str', v: 'Enabled' },
              submit: { t: 'str', v: 'Button' },
              submit__no_wrap: { t: 'bool', v: true },
              submit__props: { t: 'json', v: { label: 'Apply', type: 'primary' } },
              submit__bind: {
                t: 'json',
                v: {
                  write: {
                    action: 'label_add',
                    target_ref: { model_id: 3001, p: 0, r: 0, c: 1, k: 'submit_event' },
                    value_ref: { t: 'json', v: { action: 'apply' } },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

function findNode(node, id) {
  if (!node || typeof node !== 'object') return null;
  if (node.id === id) return node;
  const children = Array.isArray(node.children) ? node.children : [];
  for (const child of children) {
    const hit = findNode(child, id);
    if (hit) return hit;
  }
  return null;
}

function test_schema_projection_builds_form_and_standalone_nodes() {
  const ast = buildAstFromSchema(makeSnapshot(), 3001);
  assert.ok(ast && ast.type === 'Container', 'schema root must be Container');
  assert.equal(ast.id, 'schema_root_3001');

  const titleNode = findNode(ast, 'schema_title_3001');
  assert.equal(titleNode?.props?.text, 'Sample Form');

  const formNode = findNode(ast, 'schema_form_3001');
  assert.ok(formNode && formNode.type === 'Form', 'form node missing');
  assert.equal(formNode.children.length, 2, 'wrapped fields should stay in Form');

  const inputNode = findNode(ast, 'schema_3001_title');
  assert.equal(inputNode?.type, 'Input');
  assert.equal(inputNode?.props?.placeholder, 'Type here');
  assert.deepEqual(inputNode?.bind?.read, { model_id: 3001, p: 0, r: 0, c: 0, k: 'title' });

  const standaloneButton = findNode(ast, 'schema_3001_submit');
  assert.equal(standaloneButton?.type, 'Button');
  assert.equal(standaloneButton?.props?.label, 'Apply');
  assert.equal(standaloneButton?.bind?.write?.target_ref?.k, 'submit_event');
}

function test_schema_projection_returns_null_without_valid_field_order() {
  const snapshot = {
    models: {
      '3002': {
        id: 3002,
        cells: {
          '1,0,0': { labels: { _title: { t: 'str', v: 'Broken' } } },
        },
      },
    },
  };
  assert.equal(buildAstFromSchema(snapshot, 3002), null);
}

const tests = [
  test_schema_projection_builds_form_and_standalone_nodes,
  test_schema_projection_returns_null_without_valid_field_order,
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  try {
    test();
    console.log(`[PASS] ${test.name}`);
    passed += 1;
  } catch (err) {
    console.log(`[FAIL] ${test.name}: ${err.message}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
