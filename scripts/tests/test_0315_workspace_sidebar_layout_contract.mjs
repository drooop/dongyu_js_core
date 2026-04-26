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
  const leftPanelProps = findRecord((record) => record?.k === 'ui_props_json' && record?.model_id === -25 && record?.p === 2 && record?.r === 2 && record?.c === 0);
  const leftPanelTitle = findRecord((record) => record?.k === 'ui_title' && record?.model_id === -25 && record?.p === 2 && record?.r === 2 && record?.c === 0);
  const nameColLabel = findRecord((record) => record?.k === 'ui_label' && record?.model_id === -25 && record?.p === 2 && record?.r === 4 && record?.c === 0);
  const nameColProp = findRecord((record) => record?.k === 'ui_prop' && record?.model_id === -25 && record?.p === 2 && record?.r === 4 && record?.c === 0);
  const nameColMinWidth = findRecord((record) => record?.k === 'ui_min_width' && record?.model_id === -25 && record?.p === 2 && record?.r === 4 && record?.c === 0);
  const sourceCol = findRecord((record) => record?.k === 'ui_prop' && record?.model_id === -25 && record?.v === 'source');
  const actionsColLabel = findRecord((record) => record?.k === 'ui_label' && record?.model_id === -25 && record?.p === 2 && record?.r === 6 && record?.c === 0);
  const actionsColWidth = findRecord((record) => record?.k === 'ui_width' && record?.model_id === -25 && record?.p === 2 && record?.r === 6 && record?.c === 0);
  const actionsColProps = findRecord((record) => record?.k === 'ui_props_json' && record?.model_id === -25 && record?.p === 2 && record?.r === 6 && record?.c === 0);
  const openButtonSize = findRecord((record) => record?.k === 'ui_size' && record?.model_id === -25 && record?.p === 2 && record?.r === 7 && record?.c === 0);
  const deleteButtonLabel = findRecord((record) => record?.k === 'ui_label' && record?.model_id === -25 && record?.p === 2 && record?.r === 7 && record?.c === 1);
  const deleteButtonSize = findRecord((record) => record?.k === 'ui_size' && record?.model_id === -25 && record?.p === 2 && record?.r === 7 && record?.c === 1);

  assert.equal(leftPanelProps?.v?.style?.width, '260px', 'workspace_sidebar_panel_width_must_stay_260px');
  assert.equal(leftPanelTitle?.v, '资产树 ASSET TREE', 'workspace_sidebar_title_must_use_dedicated_label');
  assert.equal(nameColLabel?.v, 'name', 'workspace_name_column_label_must_be_dedicated');
  assert.equal(nameColProp?.v, 'name', 'workspace_name_column_prop_must_be_dedicated');
  assert.equal(Number(nameColMinWidth?.v), 180, 'workspace_name_column_must_expand_to_180');
  assert.equal(sourceCol, null, 'workspace_source_column_must_not_render_as_a_squeezed_visible_column');
  assert.equal(actionsColLabel?.v, 'Actions', 'workspace_actions_column_label_must_be_dedicated');
  assert.ok(Number(actionsColWidth?.v) <= 84, 'workspace_actions_column_must_be_compact');
  assert.equal(actionsColProps?.v?.fixed, undefined, 'workspace_actions_column_must_not_overlay_names');
  assert.equal(openButtonSize?.v, 'small', 'workspace_open_button_must_be_compact');
  assert.equal(deleteButtonLabel?.v, 'Del', 'workspace_delete_button_must_use_short_label');
  assert.equal(deleteButtonSize?.v, 'small', 'workspace_delete_button_must_be_compact');
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
