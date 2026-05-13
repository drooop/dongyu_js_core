#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { auditUiModelCompliance } from '../audit_ui_model_compliance.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const report = auditUiModelCompliance();

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relPath), 'utf8'));
}

function findRecord(records, modelId, p, r, c, key) {
  return records.find((record) => (
    record
    && record.op === 'add_label'
    && record.model_id === modelId
    && record.p === p
    && record.r === r
    && record.c === c
    && record.k === key
  )) || null;
}

function formatFindings(items) {
  return items.map((item) => `[${item.severity}] ${item.scope}: ${item.message}`).join('\n');
}

assert.ok(report.visibleModels.length > 0, 'ui_compliance_audit_must_find_visible_surfaces');
assert.equal(
  report.violations.length,
  0,
  `ui_model_compliance_violations_must_be_fixed:\n${formatFindings(report.violations)}`,
);

const workspaceCatalog = readJson('packages/worker-base/system-models/workspace_catalog_ui.json');
const workspaceRecords = workspaceCatalog.records || [];
assert.equal(
  JSON.stringify(workspaceCatalog).includes('Codex'),
  false,
  'workspace_catalog_must_not_show_codex_specific_app_names',
);
assert.equal(
  findRecord(workspaceRecords, -25, 2, 6, 0, 'ui_label')?.v,
  'Act',
  'workspace_sidebar_action_column_must_use_compact_label',
);
assert.equal(
  findRecord(workspaceRecords, -25, 2, 6, 0, 'ui_width')?.v,
  '70',
  'workspace_sidebar_action_column_must_stay_compact',
);
assert.equal(
  findRecord(workspaceRecords, -25, 2, 7, 1, 'ui_label')?.v,
  'Del',
  'workspace_sidebar_delete_button_must_use_compact_label',
);

console.log(`test_0346_ui_model_compliance_contract: PASS (${report.visibleModels.length} visible surfaces, ${report.warnings.length} warnings)`);
