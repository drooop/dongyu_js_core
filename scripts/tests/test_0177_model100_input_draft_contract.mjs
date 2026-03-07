#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildModel100Ast, MODEL_100_ID } from '../../packages/ui-model-demo-frontend/src/model100_ast.js';

const EDITOR_STATE_MODEL_ID = -2;
const INPUT_DRAFT_REF = { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'model100_input_draft' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

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

function assertInputFieldContract(bind, label) {
  assert.ok(bind && typeof bind === 'object', `${label}: input bind must exist`);
  assert.deepEqual(bind.read, INPUT_DRAFT_REF, `${label}: input read must come from negative draft state`);
  assert.equal(bind.write?.action, 'label_update', `${label}: input write must stay a normal label_update`);
  assert.deepEqual(bind.write?.target_ref, INPUT_DRAFT_REF, `${label}: input write target must stay in negative draft state`);
}

function assertSubmitDraftContract(write, label) {
  assert.ok(write && typeof write === 'object', `${label}: submit write must exist`);
  assert.deepEqual(
    write.value_ref?.v?.input_value,
    { $label: INPUT_DRAFT_REF },
    `${label}: submit payload must read input_value from negative draft state`,
  );
  assert.equal(write.meta?.model_id, MODEL_100_ID, `${label}: submit meta.model_id must still target model100`);
}

const workspacePatchPath = path.join(repoRoot, 'packages/worker-base/system-models/workspace_positive_models.json');
const workspacePatch = JSON.parse(fs.readFileSync(workspacePatchPath, 'utf8'));
const schemaRecords = new Map(
  (Array.isArray(workspacePatch.records) ? workspacePatch.records : [])
    .filter((record) => record && record.model_id === MODEL_100_ID && record.p === 1 && record.r === 0 && record.c === 0)
    .map((record) => [record.k, record]),
);

assertInputFieldContract(schemaRecords.get('input_value__bind')?.v, 'workspace_positive_models.json');
assertSubmitDraftContract(schemaRecords.get('submit__bind')?.v?.write, 'workspace_positive_models.json');

const ast = buildModel100Ast();
assertInputFieldContract(findNodeById(ast, 'input_field')?.bind, 'buildModel100Ast');
assertSubmitDraftContract(findNodeById(ast, 'submit_button')?.bind?.write, 'buildModel100Ast');

console.log('PASS test_0177_model100_input_draft_contract');
