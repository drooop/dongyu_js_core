#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const source = fs.readFileSync(path.join(repoRoot, 'packages/ui-model-demo-server/server.mjs'), 'utf8');

function test_static_server_must_serve_wasm_as_application_wasm() {
  assert.match(source, /if \(ext === '\.wasm'\) return 'application\/wasm';/, 'static_server_must_map_wasm_to_application_wasm');
  return { key: 'static_server_must_serve_wasm_as_application_wasm', status: 'PASS' };
}

const tests = [test_static_server_must_serve_wasm_as_application_wasm];
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
