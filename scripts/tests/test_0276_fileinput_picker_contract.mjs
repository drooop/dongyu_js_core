#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const rendererSource = fs.readFileSync(resolve(repoRoot, 'packages/ui-renderer/src/renderer.mjs'), 'utf8');

function test_fileinput_uses_explicit_trigger_button_and_hidden_input() {
  assert.match(rendererSource, /node\.type === 'FileInput'/, 'fileinput_branch_missing');
  assert.match(rendererSource, /inputEl\.click\(\)/, 'fileinput_must_programmatically_trigger_native_picker');
  assert.match(rendererSource, /type:\s*'button'/, 'fileinput_must_render_explicit_button');
  assert.match(rendererSource, /display:\s*'none'/, 'fileinput_native_input_should_be_hidden');
  return { key: 'fileinput_uses_explicit_trigger_button_and_hidden_input', status: 'PASS' };
}

const tests = [test_fileinput_uses_explicit_trigger_button_and_hidden_input];
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
