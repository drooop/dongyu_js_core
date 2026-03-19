#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function loadJson(relPath) {
  return JSON.parse(read(relPath));
}

function loadPatches(rt, relDir) {
  const dir = path.join(repoRoot, relDir);
  const files = fs.readdirSync(dir).filter((file) => file.endsWith('.json')).sort();
  for (const file of files) {
    rt.applyPatch(loadJson(path.join(relDir, file)), { allowCreateModel: true, trustedBootstrap: true });
  }
}

function getFunctionCode(label) {
  if (!label) return '';
  if (typeof label.v === 'string') return label.v;
  if (label.v && typeof label.v === 'object' && typeof label.v.code === 'string') return label.v.code;
  return '';
}

function buildCtx(rt) {
  return {
    getLabel(ref) {
      const model = rt.getModel(ref.model_id);
      if (!model) return null;
      const cell = rt.getCell(model, ref.p, ref.r, ref.c);
      return cell.labels.get(ref.k)?.v ?? null;
    },
    writeLabel(ref, t, v) {
      const model = rt.getModel(ref.model_id);
      if (!model) return;
      rt.addLabel(model, ref.p, ref.r, ref.c, { k: ref.k, t, v });
    },
    rmLabel(ref) {
      const model = rt.getModel(ref.model_id);
      if (!model) return;
      rt.rmLabel(model, ref.p, ref.r, ref.c, ref.k);
    },
    runtime: rt,
  };
}

function test_ui_side_worker_runner_is_patch_first() {
  const source = read('scripts/run_worker_ui_side_v0.mjs');
  assert.doesNotMatch(source, /createModel\(/, 'ui-side worker runner must not call createModel directly');
  assert.doesNotMatch(source, /addFunction\(/, 'ui-side worker runner must not define func.js labels directly');
  assert.doesNotMatch(source, /setLabel\(/, 'ui-side worker runner must not seed business labels directly');
  assert.match(source, /MODELTABLE_PATCH_JSON/, 'ui-side worker runner must support MODELTABLE_PATCH_JSON bootstrap');
  assert.match(source, /readMatrixBootstrapConfig/, 'ui-side worker runner must read Matrix bootstrap config from Model 0');
  assert.match(source, /ui_matrix_func/, 'ui-side worker runner must read ui_matrix_func config');
}

function test_ui_side_worker_patch_and_function_load() {
  const rt = new ModelTableRuntime();
  rt.applyPatch(loadJson('packages/worker-base/system-models/system_models.json'), { allowCreateModel: true, trustedBootstrap: true });
  loadPatches(rt, 'deploy/sys-v1ns/ui-side-worker/patches');

  const model1 = rt.getModel(1);
  assert.ok(model1, 'ui-side worker patch must create model 1');

  const root = rt.getCell(model1, 0, 0, 0);
  const modelType = root.labels.get('model_type');
  assert.ok(modelType, 'ui-side worker patch must declare model1 root model_type');
  assert.equal(modelType.t, 'model.single');
  assert.equal(modelType.v, 'UI.UiSideDemo');
  assert.equal(root.labels.get('slide_demo_text')?.v, '', 'ui-side worker patch must seed slide_demo_text');

  const sys = rt.getModel(-10);
  const sysRoot = rt.getCell(sys, 0, 0, 0);
  assert.equal(sysRoot.labels.get('ui_mgmt_inbox_label')?.v, 'ui_mgmt_inbox');
  assert.equal(sysRoot.labels.get('ui_matrix_func')?.v, 'ui_apply_snapshot_delta');

  rt.addLabel(sys, 0, 0, 0, {
    k: 'ui_mgmt_inbox',
    t: 'json',
    v: {
      version: 'v0',
      type: 'snapshot_delta',
      op_id: 'ui_side_001',
      payload: {
        version: 'mt.v0',
        op_id: 'ui_side_patch_001',
        records: [
          { op: 'add_label', model_id: 1, p: 0, r: 0, c: 0, k: 'slide_demo_text', t: 'str', v: 'patched' },
        ],
      },
    },
  });

  const fn = new Function('ctx', getFunctionCode(sysRoot.labels.get('ui_apply_snapshot_delta')));
  fn(buildCtx(rt));

  assert.equal(root.labels.get('slide_demo_text')?.v, 'patched', 'ui-side patch function must apply snapshot_delta payload');
  assert.equal(sysRoot.labels.has('ui_mgmt_inbox'), false, 'ui-side patch function must clear inbox');
}

function test_ui_side_worker_deploy_assets_exist() {
  const dockerfile = read('k8s/Dockerfile.ui-side-worker');
  const localManifest = read('k8s/local/ui-side-worker.yaml');
  const cloudManifest = read('k8s/cloud/ui-side-worker.yaml');

  assert.match(dockerfile, /run_worker_ui_side_v0\.mjs/, 'ui-side worker Dockerfile must run the ui-side worker script');
  assert.doesNotMatch(dockerfile, /deploy\/sys-v1ns\/ui-side-worker\/patches/, 'ui-side worker Dockerfile must not bake role patch dir after 0200b');
  assert.match(localManifest, /ui-side-worker/, 'local manifest must define ui-side-worker deployment');
  assert.match(cloudManifest, /ui-side-worker/, 'cloud manifest must define ui-side-worker deployment');
  assert.match(localManifest, /MODELTABLE_PATCH_JSON/, 'local manifest must wire MODELTABLE_PATCH_JSON');
  assert.match(cloudManifest, /MODELTABLE_PATCH_JSON/, 'cloud manifest must wire MODELTABLE_PATCH_JSON');
  assert.match(localManifest, /DY_PERSISTED_ASSET_ROOT/, 'local manifest must pass persisted asset root');
}

const tests = [
  test_ui_side_worker_runner_is_patch_first,
  test_ui_side_worker_patch_and_function_load,
  test_ui_side_worker_deploy_assets_exist,
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
