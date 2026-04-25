#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const source = fs.readFileSync(path.join(repoRoot, 'packages/ui-model-demo-server/server.mjs'), 'utf8');

function test_static_projects_keep_public_p_route() {
  assert.match(source, /url:\s*`\/p\/\$\{name\}\/`/, 'listStaticProjects_must_publish_p_prefix_url');
  assert.match(source, /url\.pathname\.startsWith\('\/p\/'\)/, 'server_must_serve_static_projects_from_p_prefix');
  return { key: 'static_projects_keep_public_p_route', status: 'PASS' };
}

const tests = [test_static_projects_keep_public_p_route];

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
