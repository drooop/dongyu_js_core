#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function assertContains(text, needle, file) {
  assert.ok(text.includes(needle), `${file} missing: ${needle}`);
}

function assertNotContains(text, needle, file) {
  assert.ok(!text.includes(needle), `${file} must not contain: ${needle}`);
}

function test_fast_deploy_script_is_docs_static_only() {
  const file = 'scripts/ops/deploy_cloud_public_docs_fast.sh';
  const text = read(file);
  const stat = fs.statSync(path.join(repoRoot, file));
  assert.equal(Boolean(stat.mode & 0o111), true, `${file} must be executable`);
  for (const needle of [
    'sync_cloud_source.sh',
    'sync_ui_public_docs.sh',
    'CLOUD_DY_PERSIST_ROOT',
    'STATIC_PROJECT_NAME',
    'slide-app-runtime-minimal-submit-provider',
    'minimal_submit_app_provider_interactive.html',
    'sudo -n bash -lc',
    '.deploy-source-revision',
    'Cloud public docs fast deploy complete',
    'STATIC_URL=/p/$STATIC_PROJECT_NAME/minimal_submit_app_provider_interactive.html',
  ]) {
    assertContains(text, needle, file);
  }
  for (const forbidden of [
    'docker build',
    'docker save',
    'images import',
    'rollout restart',
    'deploy_cloud_app.sh',
    'deploy_cloud_full.sh',
  ]) {
    assertNotContains(text, forbidden, file);
  }
  return { key: 'fast_deploy_script_is_docs_static_only', status: 'PASS' };
}

function test_fast_deploy_docs_record_paths_and_verification() {
  const files = [
    'scripts/ops/README.md',
    'docs/deployment/cloud_public_docs_fast_deploy.md',
  ];
  for (const file of files) {
    const text = read(file);
    for (const needle of [
      'Cloud Public Docs Fast Deploy',
      'deploy_cloud_public_docs_fast.sh',
      '/home/wwpic/dongyuapp',
      '/home/wwpic/dongyu/volume/persist/ui-server',
      'static_projects/slide-app-runtime-minimal-submit-provider',
      'minimal_submit_app_provider_interactive.html',
      'https://app.dongyudigital.com/p/slide-app-runtime-minimal-submit-provider/',
      'https://app.dongyudigital.com/p/slide-app-runtime-minimal-submit-provider/minimal_submit_app_provider_interactive.html',
      'Playwright',
      '不执行 Docker build',
      '不触发',
    ]) {
      assertContains(text, needle, file);
    }
  }
  return { key: 'fast_deploy_docs_record_paths_and_verification', status: 'PASS' };
}

const tests = [
  test_fast_deploy_script_is_docs_static_only,
  test_fast_deploy_docs_record_paths_and_verification,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    const result = test();
    console.log(`[${result.status}] ${result.key}`);
    passed += 1;
  } catch (error) {
    console.log(`[FAIL] ${test.name}: ${error.stack || error.message}`);
    failed += 1;
  }
}
console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
