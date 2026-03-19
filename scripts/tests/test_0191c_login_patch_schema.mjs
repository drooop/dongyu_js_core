#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import loginCatalogPatch from '../../packages/worker-base/system-models/login_catalog_ui.json' with { type: 'json' };
import { buildAstFromSchema } from '../../packages/ui-model-demo-frontend/src/ui_schema_projection.js';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

function test_login_patch_seeds_schema_and_builds_ast() {
  const runtime = new ModelTableRuntime();
  runtime.createModel({ id: -3, name: 'login_form', type: 'ui' });
  const result = runtime.applyPatch(loginCatalogPatch, { allowCreateModel: true, trustedBootstrap: true });
  assert.equal(result.rejected, 0, 'login_patch_apply_rejected');

  const snapshot = runtime.snapshot();
  const loginLoading = snapshot.models['-3'].cells['0,0,0'].labels.login_loading;
  assert.equal(loginLoading?.t, 'bool', 'login_loading_type_must_be_bool');
  assert.equal(loginLoading?.v, false, 'login_loading_default_must_be_false');
  const ast = buildAstFromSchema(snapshot, -3);
  assert.ok(ast && ast.type === 'Container', 'login_ast_missing');
  assert.equal(ast.id, 'schema_root_-3');
}

const tests = [
  test_login_patch_seeds_schema_and_builds_ast,
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  try {
    test();
    console.log(`[PASS] ${test.name}`);
    passed += 1;
  } catch (err) {
    console.log(`[FAIL] ${test.name}: ${err.message}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
