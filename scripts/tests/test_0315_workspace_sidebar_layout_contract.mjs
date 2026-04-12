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
  const sourceCol = findRecord((record) => record?.k === 'ui_props_json' && record?.v?.label === 'source' && record?.v?.prop === 'source');
  const actionsCol = findRecord((record) => record?.k === 'ui_props_json' && record?.v?.label === 'Actions');

  assert.equal(leftPanel?.v?.style?.width, '260px', 'workspace_sidebar_panel_width_must_stay_260px');
  assert.equal(nameCol?.v?.minWidth, 180, 'workspace_name_column_must_expand_to_180');
  assert.equal(sourceCol?.v?.width, 72, 'workspace_source_column_must_shrink_to_72');
  assert.equal(actionsCol?.v?.width, 124, 'workspace_actions_column_must_shrink_to_124');
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
