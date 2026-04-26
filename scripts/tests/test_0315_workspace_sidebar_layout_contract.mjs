#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const patch = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'packages/worker-base/system-models/workspace_catalog_ui.json'), 'utf8'),
);
const records = Array.isArray(patch.records) ? patch.records : [];

function findRecord(predicate) {
  return records.find(predicate) || null;
}

function test_workspace_sidebar_keeps_panel_width_but_rebalances_columns() {
  const leftPanel = findRecord((record) => record?.k === 'ui_props_json' && record?.v?.title === '资产树 ASSET TREE');
  const nameCol = findRecord((record) => record?.k === 'ui_props_json' && record?.v?.label === 'name' && record?.v?.prop === 'name');
  const sourceCol = findRecord((record) => record?.k === 'ui_props_json' && record?.v?.prop === 'source');
  const sourceParent = findRecord((record) => record?.k === 'ui_parent' && record?.model_id === -25 && record?.p === 2 && record?.r === 5 && record?.c === 0);
  const actionsCol = findRecord((record) => record?.k === 'ui_props_json' && record?.v?.label === 'Actions');
  const openButton = findRecord((record) => record?.k === 'ui_props_json' && record?.model_id === -25 && record?.p === 2 && record?.r === 7 && record?.c === 0);
  const deleteButton = findRecord((record) => record?.k === 'ui_props_json' && record?.model_id === -25 && record?.p === 2 && record?.r === 7 && record?.c === 1);

  assert.equal(leftPanel?.v?.style?.width, '260px', 'workspace_sidebar_panel_width_must_stay_260px');
  assert.equal(nameCol?.v?.minWidth, 180, 'workspace_name_column_must_expand_to_180');
  assert.ok(sourceCol, 'workspace_source_column_contract_record_must_remain_declared');
  assert.notEqual(sourceParent?.v, 'tbl_workspace_apps', 'workspace_source_column_must_not_render_as_a_squeezed_visible_column');
  assert.ok(actionsCol?.v?.width <= 84, 'workspace_actions_column_must_be_compact');
  assert.equal(actionsCol?.v?.fixed, undefined, 'workspace_actions_column_must_not_overlay_names');
  assert.equal(openButton?.v?.size, 'small', 'workspace_open_button_must_be_compact');
  assert.equal(deleteButton?.v?.label, 'Del', 'workspace_delete_button_must_use_short_label');
  assert.equal(deleteButton?.v?.size, 'small', 'workspace_delete_button_must_be_compact');
  return { key: 'workspace_sidebar_keeps_panel_width_but_rebalances_columns', status: 'PASS' };
}

const tests = [
  test_workspace_sidebar_keeps_panel_width_but_rebalances_columns,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    const result = test();
    console.log(`[${result.status}] ${result.key}`);
    passed += 1;
  } catch (error) {
    console.log(`[FAIL] ${test.name}: ${error.message}`);
    failed += 1;
  }
}
console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
