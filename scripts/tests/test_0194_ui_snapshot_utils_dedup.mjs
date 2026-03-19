#!/usr/bin/env node

import assert from 'node:assert/strict';

import {
  getSnapshotModel,
  getSnapshotLabelValue,
  parseSafeInt,
} from '../../packages/ui-model-demo-frontend/src/snapshot_utils.js';
import { deriveHomeTableRows } from '../../packages/ui-model-demo-frontend/src/editor_page_state_derivers.js';

function buildSnapshot() {
  return {
    models: {
      '-2': {
        id: -2,
        name: 'editor_state',
        cells: {
          '0,0,0': {
            labels: {
              selected_model_id: { t: 'str', v: '1' },
              dt_filter_p: { t: 'str', v: '' },
              dt_filter_r: { t: 'str', v: '' },
              dt_filter_c: { t: 'str', v: '' },
              dt_filter_ktv: { t: 'str', v: '' },
            },
          },
        },
      },
      '1': {
        id: 1,
        name: 'M1',
        cells: {
          '0,0,0': {
            labels: {
              title: { t: 'str', v: 'hello' },
            },
          },
        },
      },
    },
  };
}

function test_snapshot_utils_exports_and_behavior() {
  const snapshot = buildSnapshot();
  const model = getSnapshotModel(snapshot, 1);
  assert.equal(model?.id, 1, 'getSnapshotModel must resolve numeric model id');
  const title = getSnapshotLabelValue(snapshot, { model_id: 1, p: 0, r: 0, c: 0, k: 'title' });
  assert.equal(title, 'hello', 'getSnapshotLabelValue must resolve label value');
  assert.equal(parseSafeInt('42'), 42, 'parseSafeInt must parse safe integers');
  assert.equal(parseSafeInt('1.2'), null, 'parseSafeInt must reject non-integers');
}

function test_derive_home_table_rows_omits_model_id_is_editable() {
  const rows = deriveHomeTableRows(buildSnapshot(), -2);
  assert.equal(rows.length, 1, 'deriveHomeTableRows must emit one row');
  assert.equal(Object.prototype.hasOwnProperty.call(rows[0], 'model_id_is_editable'), false, 'model_id_is_editable must be removed');
}

const tests = [
  test_snapshot_utils_exports_and_behavior,
  test_derive_home_table_rows_omits_model_id_is_editable,
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  try {
    test();
    console.log(`[PASS] ${test.name}`);
    passed += 1;
  } catch (error) {
    console.log(`[FAIL] ${test.name}: ${error.message}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
