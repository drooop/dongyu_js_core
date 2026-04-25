#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODEL_100_ID } from '../../packages/ui-model-demo-frontend/src/model_ids.js';
import { buildAstFromCellwiseModel } from '../../packages/ui-model-demo-frontend/src/ui_cellwise_projection.js';

const EDITOR_STATE_MODEL_ID = -2;
const INPUT_DRAFT_REF = { model_id: EDITOR_STATE_MODEL_ID, p: 0, r: 0, c: 0, k: 'model100_input_draft' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

function makeSnapshotFromRecords(records, modelId) {
  const cells = {};
  for (const record of Array.isArray(records) ? records : []) {
    if (!record || record.op !== 'add_label' || record.model_id !== modelId) continue;
    const key = `${record.p},${record.r},${record.c}`;
    if (!cells[key]) cells[key] = { labels: {} };
    cells[key].labels[record.k] = { k: record.k, t: record.t, v: record.v };
  }
  return {
    models: {
      [String(modelId)]: {
        id: modelId,
        name: `Model ${modelId}`,
        cells,
      },
    },
  };
}

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
  assert.equal(bind.write?.commit_policy, 'on_submit', `${label}: input write must wait for submit`);
}

function assertSubmitDraftContract(write, label) {
  assert.ok(write && typeof write === 'object', `${label}: submit write must exist`);
  assert.equal(write.pin, 'click', `${label}: submit write must target the click pin`);
  assert.ok(Array.isArray(write.value_ref), `${label}: submit payload must be a temporary ModelTable array`);
  const inputValueRecord = write.value_ref.find((record) => record && record.k === 'input_value');
  assert.deepEqual(
    inputValueRecord?.v,
    { $label: INPUT_DRAFT_REF },
    `${label}: submit payload must read input_value from negative draft state`,
  );
}

const workspacePatchPath = path.join(repoRoot, 'packages/worker-base/system-models/workspace_positive_models.json');
const workspacePatch = JSON.parse(fs.readFileSync(workspacePatchPath, 'utf8'));
const ast = buildAstFromCellwiseModel(makeSnapshotFromRecords(workspacePatch.records, MODEL_100_ID), MODEL_100_ID);

assertInputFieldContract(findNodeById(ast, 'model100_input')?.bind, 'workspace_positive_models.json');
assertSubmitDraftContract(findNodeById(ast, 'submit_button')?.bind?.write, 'workspace_positive_models.json');

console.log('PASS test_0177_model100_input_draft_contract');
