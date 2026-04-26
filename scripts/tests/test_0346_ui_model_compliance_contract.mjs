#!/usr/bin/env node

import assert from 'node:assert/strict';
import { auditUiModelCompliance } from '../audit_ui_model_compliance.mjs';

const report = auditUiModelCompliance();

function formatFindings(items) {
  return items.map((item) => `[${item.severity}] ${item.scope}: ${item.message}`).join('\n');
}

assert.ok(report.visibleModels.length > 0, 'ui_compliance_audit_must_find_visible_surfaces');
assert.equal(
  report.violations.length,
  0,
  `ui_model_compliance_violations_must_be_fixed:\n${formatFindings(report.violations)}`,
);

console.log(`test_0346_ui_model_compliance_contract: PASS (${report.visibleModels.length} visible surfaces, ${report.warnings.length} warnings)`);
