#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { buildAstFromCellwiseModel } from '../../packages/ui-model-demo-frontend/src/ui_cellwise_projection.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relPath), 'utf8'));
}

function findRecord(records, predicate) {
  return (Array.isArray(records) ? records : []).find(predicate) || null;
}

function findNodeById(node, id) {
  if (!node || typeof node !== 'object') return null;
  if (node.id === id) return node;
  for (const child of Array.isArray(node.children) ? node.children : []) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

function test_ast_exposes_writable_pins_schema_for_pin_bound_node() {
  const snapshot = {
    models: {
      '700': {
        id: 700,
        name: 'pin_projection_demo',
        cells: {
          '0,0,0': {
            labels: {
              ui_authoring_version: { k: 'ui_authoring_version', t: 'str', v: 'cellwise.ui.v1' },
              ui_root_node_id: { k: 'ui_root_node_id', t: 'str', v: 'root_demo' },
            },
          },
          '2,0,0': {
            labels: {
              ui_node_id: { k: 'ui_node_id', t: 'str', v: 'root_demo' },
              ui_component: { k: 'ui_component', t: 'str', v: 'Container' },
            },
          },
          '2,5,0': {
            labels: {
              ui_node_id: { k: 'ui_node_id', t: 'str', v: 'submit_demo' },
              ui_component: { k: 'ui_component', t: 'str', v: 'Button' },
              ui_parent: { k: 'ui_parent', t: 'str', v: 'root_demo' },
              ui_bind_json: {
                k: 'ui_bind_json',
                t: 'json',
                v: {
                  write: {
                    pin: 'click',
                    value_ref: [
                      { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'ui_event.v1' },
                      { id: 0, p: 0, r: 0, c: 0, k: 'input_value', t: 'str', v: 'hello' },
                    ],
                    value_t: 'modeltable',
                    commit_policy: 'immediate',
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  const ast = buildAstFromCellwiseModel(snapshot, 700);
  const submitNode = findNodeById(ast, 'submit_demo');
  assert.ok(submitNode, 'pin_bound_node_missing');
  assert.deepEqual(
    submitNode.writable_pins,
    [{
      name: 'click',
      direction: 'in',
      trigger: 'click',
      value_t: 'modeltable',
      commit_policy: 'immediate',
      primary: true,
    }],
    'pin_bound_node_must_expose_frozen_writable_pins_schema',
  );
  return { key: 'ast_exposes_writable_pins_schema_for_pin_bound_node', status: 'PASS' };
}

function test_workspace_patches_pinize_existing_buttons() {
  const workspace = readJson('packages/worker-base/system-models/workspace_positive_models.json').records || [];
  const catalog = readJson('packages/worker-base/system-models/workspace_catalog_ui.json').records || [];

  const model100SubmitNode = findRecord(workspace, (record) => (
    record?.model_id === 100
    && record?.k === 'ui_node_id'
    && record?.v === 'submit_button'
    && record?.p === 1
    && record?.r === 0
    && record?.c === 0
  ));
  assert.ok(model100SubmitNode, 'model100_submit_button_cellwise_node_missing');

  const model100SubmitBind = findRecord(workspace, (record) => (
    record?.model_id === 100
    && record?.k === 'ui_bind_json'
    && record?.p === model100SubmitNode.p
    && record?.r === model100SubmitNode.r
    && record?.c === model100SubmitNode.c
  ));
  assert.equal(model100SubmitBind?.v?.write?.pin, 'click', 'model100_submit_must_use_pin_write');
  assert.ok(!model100SubmitBind?.v?.write?.action, 'model100_submit_must_not_require_action_write');

  const expectations = [
    { records: workspace, model_id: 1030, p: 2, r: 4, c: 0, node: 'slide_import_button', pin: 'click' },
    { records: workspace, model_id: 1034, p: 2, r: 8, c: 0, node: 'slide_creator_button', pin: 'click' },
    { records: catalog, model_id: -25, p: 2, r: 7, c: 0, node: 'btn_ws_select', pin: 'click' },
    { records: catalog, model_id: -25, p: 2, r: 7, c: 1, node: 'btn_ws_delete', pin: 'click' },
    { records: catalog, model_id: -25, node: 'btn_ws_add', pin: 'click' },
  ];

  for (const expectation of expectations) {
    const nodeRecord = findRecord(expectation.records, (record) => (
      record?.model_id === expectation.model_id
      && record?.k === 'ui_node_id'
      && record?.v === expectation.node
      && (expectation.p == null || (record?.p === expectation.p && record?.r === expectation.r && record?.c === expectation.c))
    ));
    assert.ok(nodeRecord, `${expectation.node}_node_missing`);
    const bind = findRecord(expectation.records, (record) => (
      record?.model_id === expectation.model_id
      && record?.p === nodeRecord.p
      && record?.r === nodeRecord.r
      && record?.c === nodeRecord.c
      && record?.k === 'ui_bind_json'
    ));
    assert.equal(bind?.v?.write?.pin, expectation.pin, `${expectation.node}_must_use_pin_write`);
    assert.ok(!bind?.v?.write?.action, `${expectation.node}_must_not_require_action_write`);
  }

  return { key: 'workspace_patches_pinize_existing_buttons', status: 'PASS' };
}

function test_renderer_and_server_have_pin_envelope_contract() {
  const renderer = fs.readFileSync(path.join(repoRoot, 'packages/ui-renderer/src/renderer.mjs'), 'utf8');
  const server = fs.readFileSync(path.join(repoRoot, 'packages/ui-model-demo-server/server.mjs'), 'utf8');
  const localAdapter = fs.readFileSync(path.join(repoRoot, 'packages/ui-model-demo-frontend/src/local_bus_adapter.js'), 'utf8');

  assert.match(renderer, /if \(target && Object\.prototype\.hasOwnProperty\.call\(target, 'pin'\)\)/, 'renderer_missing_pin_dispatch_branch');
  assert.match(renderer, /const out = \{ pin: target\.pin \};/, 'renderer_must_emit_pin_name');
  assert.match(server, /const pin = payload && typeof payload\.pin === 'string' \? payload\.pin\.trim\(\) : '';/, 'server_must_parse_pin_from_payload');
  assert.match(server, /if \(envelopeOrNull && pin\)/, 'server_must_handle_direct_pin_envelope');
  assert.match(localAdapter, /const pin = payload && typeof payload\.pin === 'string' \? payload\.pin\.trim\(\) : '';/, 'local_adapter_must_parse_pin_from_payload');

  return { key: 'renderer_and_server_have_pin_envelope_contract', status: 'PASS' };
}

const tests = [
  test_ast_exposes_writable_pins_schema_for_pin_bound_node,
  test_workspace_patches_pinize_existing_buttons,
  test_renderer_and_server_have_pin_envelope_contract,
];

(async () => {
  let passed = 0;
  let failed = 0;
  for (const test of tests) {
    try {
      const result = await test();
      console.log(`[${result.status}] ${result.key}`);
      passed += 1;
    } catch (error) {
      console.log(`[FAIL] ${test.name}: ${error.message}`);
      failed += 1;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
  process.exit(failed > 0 ? 1 : 0);
})();
