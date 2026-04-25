#!/usr/bin/env node

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function test_server_snapshot_delta_no_longer_direct_applies_patch() {
  const text = read('packages/ui-model-demo-server/server.mjs');
  const handleSection = text.slice(text.indexOf('handleDyBusEvent(content) {'), text.indexOf("if (content.type === 'mbr_ready')"));
  assert.doesNotMatch(handleSection, /this\.runtime\.applyPatch\(patch,\s*\{\s*allowCreateModel:\s*false\s*\}\)/, 'snapshot_delta handler must not direct-apply return patch');
  assert.match(handleSection, /routeSnapshotDeltaViaOwnerMaterialization|ensureGenericOwnerMaterializer|owner materialize|owner_request/, 'snapshot_delta handler must route via owner/helper path');
  return { key: 'server_snapshot_delta_no_longer_direct_applies_patch', status: 'PASS' };
}

function test_server_legacy_function_ctx_uses_runtime_view() {
  const text = read('packages/ui-model-demo-server/server.mjs');
  assert.match(text, /const runtimeView = \{/, 'server executeFunction must build a safe runtime view');
  assert.match(text, /runtime:\s*runtimeView/, 'server code-string ctx must expose runtimeView instead of live runtime');
  return { key: 'server_legacy_function_ctx_uses_runtime_view', status: 'PASS' };
}

function test_model100_patch_no_longer_uses_runtime_apply_patch() {
  const text = read('packages/worker-base/system-models/test_model_100_ui.json');
  assert.doesNotMatch(text, /ctx\.runtime\.applyPatch/, 'model100 return handler must not use ctx.runtime.applyPatch');
  assert.match(text, /owner_request|owner_materialize|apply_records/, 'model100 patch must define helper/owner materialization path');
  return { key: 'model100_patch_no_longer_uses_runtime_apply_patch', status: 'PASS' };
}

const tests = [
  test_server_snapshot_delta_no_longer_direct_applies_patch,
  test_server_legacy_function_ctx_uses_runtime_view,
  test_model100_patch_no_longer_uses_runtime_apply_patch,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    const result = test();
    console.log(`[${result.status}] ${result.key}`);
    passed += 1;
  } catch (err) {
    console.log(`[FAIL] ${test.name}: ${err.message}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
