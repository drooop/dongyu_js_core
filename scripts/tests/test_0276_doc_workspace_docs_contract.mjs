#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');

function read(relPath) {
  return fs.readFileSync(resolve(repoRoot, relPath), 'utf8');
}

function test_user_guide_mentions_doc_workspace_example() {
  const indexText = read('docs/user-guide/README.md');
  assert.match(indexText, /doc_workspace_filltable_example\.md/u, 'user_guide_index_must_link_doc_workspace_example');
  const guideText = read('docs/user-guide/doc_workspace_filltable_example.md');
  assert.match(guideText, /Workspace/u, 'guide_must_cover_workspace_mount');
  assert.match(guideText, /1013/u, 'guide_must_cover_app_model');
  assert.match(guideText, /1014/u, 'guide_must_cover_truth_model');
  assert.match(guideText, /ui_layout/u, 'guide_must_cover_layout_labels');
  return { key: 'user_guide_mentions_doc_workspace_example', status: 'PASS' };
}

const tests = [test_user_guide_mentions_doc_workspace_example];
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
