#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildModel100Ast, MODEL_100_ID } from '../../packages/ui-model-demo-frontend/src/model100_ast.js';

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

function assertModel100SubmitWriteContract(write, label) {
  assert.ok(write && typeof write === 'object', `${label}: submit write binding must exist`);
  assert.equal(write.action, 'submit', `${label}: submit button must use business action submit`);
  assert.deepEqual(
    write.target_ref,
    { model_id: MODEL_100_ID, p: 0, r: 0, c: 0 },
    `${label}: submit button must declare current model/current cell target coordinates`,
  );
  assert.deepEqual(
    write.meta,
    { model_id: MODEL_100_ID },
    `${label}: submit button must route through business model meta.model_id`,
  );
  assert.equal(write.value_ref?.t, 'event', `${label}: submit payload type must be event`);
  assert.equal(write.value_ref?.v?.action, 'submit', `${label}: submit payload action must be submit`);
}

const workspacePatchPath = path.join(repoRoot, 'packages/worker-base/system-models/workspace_positive_models.json');
const workspacePatch = JSON.parse(fs.readFileSync(workspacePatchPath, 'utf8'));
const submitBindRecord = Array.isArray(workspacePatch.records)
  ? workspacePatch.records.find((record) => record && record.model_id === MODEL_100_ID && record.p === 1 && record.r === 0 && record.c === 0 && record.k === 'submit__bind')
  : null;
assert.ok(submitBindRecord, 'workspace_positive_models.json must define submit__bind for model 100');
assertModel100SubmitWriteContract(submitBindRecord.v?.write, 'workspace_positive_models.json');

const model100Ast = buildModel100Ast();
const submitButton = findNodeById(model100Ast, 'submit_button');
assert.ok(submitButton, 'buildModel100Ast must expose submit_button');
assertModel100SubmitWriteContract(submitButton.bind?.write, 'buildModel100Ast');

console.log('PASS test_0177_model100_submit_ui_contract');
