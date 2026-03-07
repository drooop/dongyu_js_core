#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

const runtime = new ModelTableRuntime();
const parent = runtime.createModel({ id: 1, name: 'parent', type: 'app' });

runtime.addLabel(parent, 2, 0, 0, { k: 'out1', t: 'pin.out', v: null });
runtime.addLabel(parent, 2, 0, 0, { k: 'title', t: 'str', v: 'legacy' });

const submodelResult = runtime.addLabel(parent, 2, 0, 0, { k: '100', t: 'submt', v: { alias: 'child100' } });
assert.equal(submodelResult.applied, true, 'submt must be allowed at the mapped hosting cell');

const hostCell = runtime.getCell(parent, 2, 0, 0);
assert.ok(hostCell.labels.has('100'), 'hosting cell must keep the submt label');
assert.ok(hostCell.labels.has('out1'), 'hosting cell must retain pin labels');
assert.equal(hostCell.labels.has('title'), false, 'hosting cell must purge pre-existing non-pin labels once submt is installed');
assert.ok(runtime.parentChildMap.has(100), 'submt must register parentChildMap using the mapped cell');
assert.deepEqual(runtime.parentChildMap.get(100)?.hostingCell, { p: 2, r: 0, c: 0 }, 'parentChildMap must keep the mapped cell coordinates');
assert.ok(runtime.getModel(100), 'submt must still create the declared child model');

const forbiddenResult = runtime.addLabel(parent, 2, 0, 0, { k: 'note', t: 'str', v: 'forbidden' });
assert.equal(forbiddenResult.applied, false, 'non-pin labels must be rejected on a submt hosting cell');
assert.equal(hostCell.labels.has('note'), false, 'rejected non-pin label must not persist on the submt hosting cell');
assert.ok(
  runtime.eventLog._events.some((event) => event.reason === 'submodel_host_cell_forbidden_label'),
  'submt host cell rejection must be recorded in eventLog',
);

const pinAllowedResult = runtime.addLabel(parent, 2, 0, 0, { k: 'in1', t: 'pin.in', v: null });
assert.equal(pinAllowedResult.applied, true, 'pin labels must remain allowed on a submt hosting cell');
assert.ok(hostCell.labels.has('in1'), 'allowed pin label must persist on the submt hosting cell');

console.log('PASS test_0177_submt_mapping_contract');
