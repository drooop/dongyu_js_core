import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const runtimeJsPath = path.join(repoRoot, 'packages/worker-base/src/runtime.js');

function test_runtime_js_is_shim_file() {
  const src = fs.readFileSync(runtimeJsPath, 'utf8');
  assert(!src.includes('class ModelTableRuntime'), 'runtime.js should not contain runtime implementation class');
  assert(src.includes("require('./runtime.mjs')"), 'runtime.js should require runtime.mjs');
  assert(src.includes('module.exports'), 'runtime.js should export CJS bindings');
  return { key: 'runtime_js_is_shim_file', status: 'PASS' };
}

function test_cjs_shim_exports_same_constructor() {
  const fromCjsShim = require('../../packages/worker-base/src/runtime.js');
  const fromEsmRuntime = require('../../packages/worker-base/src/runtime.mjs');
  assert.strictEqual(
    fromCjsShim.ModelTableRuntime,
    fromEsmRuntime.ModelTableRuntime,
    'runtime.js should re-export the same ModelTableRuntime from runtime.mjs',
  );
  return { key: 'cjs_shim_exports_same_constructor', status: 'PASS' };
}

const tests = [
  test_runtime_js_is_shim_file,
  test_cjs_shim_exports_same_constructor,
];

let passed = 0;
let failed = 0;
for (const t of tests) {
  try {
    const r = t();
    console.log(`[${r.status}] ${r.key}`);
    passed += 1;
  } catch (err) {
    console.log(`[FAIL] ${t.name}: ${err.message}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
