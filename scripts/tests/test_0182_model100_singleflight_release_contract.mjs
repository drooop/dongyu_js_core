#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const patch = JSON.parse(fs.readFileSync(path.join(repoRoot, 'packages/worker-base/system-models/workspace_positive_models.json'), 'utf8'));
const records = Array.isArray(patch.records) ? patch.records : [];

function findRecord(predicate) {
  return records.find((record) => record && record.op === 'add_label' && predicate(record)) || null;
}

const submitNodeRecord = findRecord((record) =>
  record.model_id === 100
  && record.p === 1
  && record.r === 0
  && record.c === 0
  && record.k === 'ui_node_id'
  && record.v === 'submit_button'
);

assert.ok(submitNodeRecord, 'workspace_positive_models.json must define Model 100 cellwise submit_button node');

const submitLabelRecord = findRecord((record) =>
  record.model_id === 100
  && record.p === submitNodeRecord.p
  && record.r === submitNodeRecord.r
  && record.c === submitNodeRecord.c
  && record.k === 'ui_label'
);

const submitPropsRecord = findRecord((record) =>
  record
  && record.model_id === 100
  && record.p === submitNodeRecord.p
  && record.r === submitNodeRecord.r
  && record.c === submitNodeRecord.c
  && record.k === 'ui_props_json'
);

assert.ok(submitPropsRecord, 'workspace_positive_models.json must define Model 100 submit_button ui_props_json');
assert.equal(submitLabelRecord?.v, 'Generate Color', 'submit_button ui_label must still describe the Generate Color button');

const props = submitPropsRecord.v || {};
assert.deepEqual(
  props.loading,
  { $label: { model_id: 100, p: 0, r: 0, c: 0, k: 'submit_inflight' } },
  'button loading must still reflect submit_inflight business state',
);

assert.ok(props.singleFlight && typeof props.singleFlight === 'object', 'submit button must define singleFlight');
assert.deepEqual(
  props.singleFlight.releaseRef,
  { model_id: -1, p: 0, r: 0, c: 1, k: 'bus_event_last_op_id' },
  'singleFlight releaseRef must track mailbox bus_event_last_op_id instead of submit_inflight',
);
assert.ok(
  !Object.prototype.hasOwnProperty.call(props.singleFlight, 'releaseWhen'),
  'singleFlight release must rely on mailbox op-id change, not a hard-coded releaseWhen literal',
);

console.log('PASS test_0182_model100_singleflight_release_contract');
