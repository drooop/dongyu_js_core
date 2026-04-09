#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { buildAstFromCellwiseModel } from '../../packages/ui-model-demo-frontend/src/ui_cellwise_projection.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function findNodeById(node, id) {
  if (!node || typeof node !== 'object') return null;
  if (node.id === id) return node;
  const children = Array.isArray(node.children) ? node.children : [];
  for (const child of children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

function test_cellwise_ast_exposes_current_cell_coordinates() {
  const snapshot = {
    models: {
      '700': {
        id: 700,
        name: 'cellwise_submit_demo',
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
              ui_layout: { k: 'ui_layout', t: 'str', v: 'column' },
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
                    action: 'submit',
                    meta: { model_id: 700 },
                    value_ref: { t: 'event', v: { action: 'submit' } },
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
  assert.ok(submitNode, 'cellwise_submit_node_missing');
  assert.deepEqual(
    submitNode.cell_ref,
    { model_id: 700, p: 2, r: 5, c: 0 },
    'cellwise_submit_node_must_expose_current_cell_coordinates',
  );
  return { key: 'cellwise_ast_exposes_current_cell_coordinates', status: 'PASS' };
}

function test_renderer_uses_node_cell_ref_when_target_ref_missing() {
  const text = fs.readFileSync(path.join(repoRoot, 'packages/ui-renderer/src/renderer.mjs'), 'utf8');
  assert.match(
    text,
    /else if \(node\.cell_ref && Number\.isInteger\(node\.cell_ref\.model_id\)\)/,
    'renderer_must_fall_back_to_node_cell_ref_for_event_target',
  );
  assert.match(
    text,
    /out\.target = \{ model_id: node\.cell_ref\.model_id, p: node\.cell_ref\.p, r: node\.cell_ref\.r, c: node\.cell_ref\.c \};/,
    'renderer_must_emit_current_model_current_cell_target',
  );
  return { key: 'renderer_uses_node_cell_ref_when_target_ref_missing', status: 'PASS' };
}

function test_server_contract_accepts_target_coordinates_for_business_events() {
  const text = fs.readFileSync(path.join(repoRoot, 'packages/ui-model-demo-server/server.mjs'), 'utf8');
  assert.match(
    text,
    /const targetModelId = target && Number\.isInteger\(target\.model_id\) \? target\.model_id : null;/,
    'server_must_parse_target_model_id_from_payload_target',
  );
  assert.match(
    text,
    /const businessTargetModelId = meta && Number\.isInteger\(meta\.model_id\)\s*\?\s*meta\.model_id\s*:\s*\(action === 'submit' \? targetModelId : null\);/,
    'server_must_fall_back_to_target_model_id_when_meta_model_id_missing',
  );
  assert.match(
    text,
    /if \(target && !normalizedEvent\.target\) normalizedEvent\.target = target;/,
    'server_must_preserve_target_coordinates_on_normalized_business_event',
  );
  return { key: 'server_contract_accepts_target_coordinates_for_business_events', status: 'PASS' };
}

const tests = [
  test_cellwise_ast_exposes_current_cell_coordinates,
  test_renderer_uses_node_cell_ref_when_target_ref_missing,
  test_server_contract_accepts_target_coordinates_for_business_events,
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
