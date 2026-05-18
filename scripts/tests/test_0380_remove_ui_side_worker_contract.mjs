#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

const removedPaths = [
  'scripts/run_worker_ui_side_v0.mjs',
  'scripts/ops/verify_ui_side_worker_snapshot_delta.sh',
  'k8s/Dockerfile.ui-side-worker',
  'k8s/local/ui-side-worker.yaml',
  'k8s/cloud/ui-side-worker.yaml',
  'deploy/sys-v1ns/ui-side-worker',
  'docs/user-guide/dual_worker_slide_e2e_v0.md',
];

const activeFiles = [
  'scripts/ops/deploy_local.sh',
  'scripts/ops/deploy_cloud_full.sh',
  'scripts/ops/deploy_cloud_app.sh',
  'scripts/ops/check_runtime_baseline.sh',
  'scripts/ops/ensure_runtime_baseline.sh',
  'scripts/ops/sync_cloud_source.sh',
  'scripts/ops/sync_local_persisted_assets.sh',
  'scripts/ops/model_mounting_analyzer.mjs',
  'scripts/ops/README.md',
  'docs/user-guide/README.md',
];

const forbidden = /ui-side-worker|ui_side_worker|run_worker_ui_side|DY_UI_WORKER|dy-ui-side-worker|Dockerfile\.ui-side-worker/u;

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function test_removed_files_are_absent() {
  for (const relPath of removedPaths) {
    assert.equal(fs.existsSync(path.join(repoRoot, relPath)), false, `${relPath} must be removed`);
  }
}

function test_active_ops_and_docs_do_not_depend_on_removed_worker() {
  for (const relPath of activeFiles) {
    assert.doesNotMatch(read(relPath), forbidden, `${relPath} must not depend on removed ui-side worker`);
  }
}

function test_deploy_contract_keeps_current_worker_set() {
  const baseline = read('scripts/ops/ensure_runtime_baseline.sh');
  assert.match(
    baseline,
    /DEPLOYMENTS=\(mosquitto synapse remote-worker workspace-manager mbr-worker ui-server\)/u,
    'baseline deployment set must contain only active local runtime deployments',
  );

  const cloudApp = read('scripts/ops/deploy_cloud_app.sh');
  assert.match(
    cloudApp,
    /ui-server\|mbr-worker\|remote-worker\|workspace-manager/u,
    'single-target cloud deploy must expose only active app targets',
  );
}

const tests = [
  test_removed_files_are_absent,
  test_active_ops_and_docs_do_not_depend_on_removed_worker,
  test_deploy_contract_keeps_current_worker_set,
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
