#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const text = fs.readFileSync(path.join(repoRoot, 'packages/ui-model-demo-server/server.mjs'), 'utf8');

function test_upload_route_must_fallback_to_runtime_matrix_bootstrap() {
  const start = text.indexOf("if (req.method === 'POST' && url.pathname === '/api/media/upload') {");
  const end = text.indexOf("if (req.method === 'GET' && url.pathname === '/media/')", start);
  const section = start >= 0 && end > start ? text.slice(start, end) : text;
  assert.match(section, /readMatrixBootstrapConfig/, 'upload_route_must_read_runtime_matrix_bootstrap_when_session_missing');
  assert.match(section, /matrixConfig|refreshMatrixBootstrapConfig/, 'upload_route_must_use_runtime_bootstrap_values');
  return { key: 'upload_route_must_fallback_to_runtime_matrix_bootstrap', status: 'PASS' };
}

const tests = [test_upload_route_must_fallback_to_runtime_matrix_bootstrap];

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
