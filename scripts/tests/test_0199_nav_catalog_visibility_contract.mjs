#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

function readVisiblePages() {
  const file = path.join(repoRoot, 'packages/worker-base/system-models/nav_catalog_ui.json');
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  const record = doc.records.find((entry) => entry && entry.op === 'add_label' && entry.k === 'ui_page_catalog_json');
  assert.ok(record, 'ui_page_catalog_json_record_missing');
  return record.v.filter((entry) => entry && entry.nav_visible === true).map((entry) => entry.page);
}

function main() {
  const visiblePages = readVisiblePages();
  assert.deepEqual(
    visiblePages,
    ['home', 'workspace', 'prompt'],
    'Header visible pages must be limited to home/workspace/prompt',
  );
  console.log('PASS test_0199_nav_catalog_visibility_contract');
}

try {
  main();
} catch (err) {
  console.error(`FAIL test_0199_nav_catalog_visibility_contract: ${err.message}`);
  process.exitCode = 1;
}
