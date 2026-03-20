#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function test_cloud_env_example_defaults_to_drop_user() {
  const source = read('deploy/env/cloud.env.example');
  assert.match(source, /^SSH_USER=drop$/m, 'cloud.env.example must default SSH_USER to drop');
  assert.match(source, /^REMOTE_REPO=\/home\/wwpic\/dongyuapp$/m, 'cloud.env.example must declare canonical remote repo path');
  assert.match(source, /^REMOTE_REPO_OWNER=wwpic$/m, 'cloud.env.example must declare canonical remote repo owner');
}

function test_sync_cloud_source_supports_drop_to_wwpic_repo() {
  const source = read('scripts/ops/sync_cloud_source.sh');
  assert.match(source, /deploy\/env\/cloud\.env/, 'sync_cloud_source must support loading cloud.env defaults');
  assert.match(source, /sudo -n -u '\$REMOTE_REPO_OWNER'/, 'sync_cloud_source must support sudo handoff to remote repo owner');
  assert.match(source, /remote repo is not a git worktree; using git archive fallback/, 'sync_cloud_source must keep archive fallback path');
}

function test_ops_docs_and_fallback_examples_use_drop() {
  const readme = read('scripts/ops/README.md');
  const fallback = read('scripts/ops/deploy_cloud_ui_server_from_local.sh');

  assert.match(readme, /--ssh-user drop/, 'ops README must document drop as ssh deploy user');
  assert.doesNotMatch(readme, /--ssh-user wwpic/, 'ops README must stop documenting wwpic as deploy ssh user');
  assert.match(fallback, /--ssh-user drop --ssh-host 124\.71\.43\.80/, 'fallback deploy helper usage must document drop as ssh user');
  assert.match(fallback, /REMOTE_REPO_OWNER=/, 'fallback deploy helper must expose remote repo owner');
  assert.match(fallback, /sync_cloud_source\.sh/, 'fallback deploy helper must delegate remote source sync to canonical sync_cloud_source.sh');
  assert.match(fallback, /--remote-repo-owner/, 'fallback deploy helper must pass remote repo owner to canonical source sync');
}

const tests = [
  test_cloud_env_example_defaults_to_drop_user,
  test_sync_cloud_source_supports_drop_to_wwpic_repo,
  test_ops_docs_and_fallback_examples_use_drop,
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
