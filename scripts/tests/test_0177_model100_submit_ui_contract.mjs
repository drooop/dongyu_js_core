#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODEL_100_ID } from '../../packages/ui-model-demo-frontend/src/model_ids.js';
import { buildAstFromCellwiseModel } from '../../packages/ui-model-demo-frontend/src/ui_cellwise_projection.js';

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

function assertModel100SubmitWriteContract(write, label) {
  assert.ok(write && typeof write === 'object', `${label}: submit write binding must exist`);
  assert.equal(write.bus_event_v2, true, `${label}: submit button must use bus_event_v2`);
  assert.equal(write.bus_in_key, 'bus_event_submit_100_0_0_0', `${label}: submit button must enter Model 0 bus-in route`);
  assert.equal(write.pin, undefined, `${label}: submit button must not directly write a positive-model pin`);
  assert.equal(write.action, undefined, `${label}: submit button must not use legacy action write`);
  assert.ok(Array.isArray(write.value_ref), `${label}: submit payload must be a temporary ModelTable array`);
  assert.ok(
    write.value_ref.some((record) => record && record.k === '__mt_payload_kind' && record.v === 'ui_event.v1'),
    `${label}: submit payload must declare ui_event.v1`,
  );
  const inputValueRecord = write.value_ref.find((record) => record && record.k === 'input_value');
  assert.deepEqual(
    inputValueRecord?.v,
    { $label: { model_id: -2, p: 0, r: 0, c: 0, k: 'model100_input_draft' } },
    `${label}: submit payload must read input_value from the draft state`,
  );
}

const workspacePatchPath = path.join(repoRoot, 'packages/worker-base/system-models/workspace_positive_models.json');
const workspacePatch = JSON.parse(fs.readFileSync(workspacePatchPath, 'utf8'));
const ast = buildAstFromCellwiseModel(makeSnapshotFromRecords(workspacePatch.records, MODEL_100_ID), MODEL_100_ID);
const submitButton = findNodeById(ast, 'submit_button');

assert.ok(submitButton, 'workspace_positive_models.json must expose cellwise submit_button for model 100');
assert.equal(submitButton.props?.label, 'Generate Color', 'submit_button label must come from the model table');
assert.deepEqual(
  submitButton.cell_ref,
  { model_id: MODEL_100_ID, p: 1, r: 0, c: 0 },
  'submit_button must preserve the executable cell address',
);
assertModel100SubmitWriteContract(submitButton.bind?.write, 'workspace_positive_models.json');

const model100DraftRecord = workspacePatch.records.find((record) =>
  record
  && record.op === 'add_label'
  && record.model_id === -2
  && record.p === 0
  && record.r === 0
  && record.c === 0
  && record.k === 'model100_input_draft'
);
assert.ok(model100DraftRecord, 'workspace_positive_models.json must seed model100_input_draft');
assert.equal(model100DraftRecord.t, 'str', 'model100_input_draft must be a string draft');
assert.equal(model100DraftRecord.v, '', 'model100_input_draft must default to an empty string');

const serverPath = path.join(repoRoot, 'packages/ui-model-demo-server/server.mjs');
const serverSource = fs.readFileSync(serverPath, 'utf8');
assert.ok(
  serverSource.includes('isDeclaredModel0BusInRoute'),
  'server must admit dynamic bus_event_v2 keys only when declared by Model 0 pin.connect.cell route sources',
);
assert.ok(
  serverSource.includes("ensureStateLabel(runtime, 'model100_input_draft', 'str', '')"),
  'server bootstrap must seed model100_input_draft for no-input color submit',
);

console.log('PASS test_0177_model100_submit_ui_contract');
