#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');

function read(path) {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

const syncScriptPath = resolve(repoRoot, 'scripts/ops/sync_cloud_source.sh');
assert.ok(existsSync(syncScriptPath), '0183 contract requires scripts/ops/sync_cloud_source.sh');

const syncText = read('scripts/ops/sync_cloud_source.sh');
assert.match(syncText, /--revision/, 'sync_cloud_source.sh must accept --revision');
assert.match(syncText, /git(?:\s+-C\s+\S+)?\s+fetch/, 'sync_cloud_source.sh must prefer remote git fetch');
assert.match(syncText, /git(?:\s+-C\s+\S+)?\s+checkout/, 'sync_cloud_source.sh must checkout the requested revision');

const readmeText = read('scripts/ops/README.md');
assert.doesNotMatch(
  readmeText,
  /## Cloud Local-Build \+ Remote-Import（推荐）/,
  'scp tar path must no longer be documented as the recommended cloud deploy path',
);
assert.match(
  readmeText,
  /remote build|远端.*build/i,
  'ops README must document remote build as the canonical cloud deploy direction',
);

const localHelperText = read('scripts/ops/deploy_cloud_ui_server_from_local.sh');
assert.match(
  localHelperText,
  /fallback|后备|非 canonical|not the canonical/i,
  'local tar helper must be explicitly demoted to fallback-only',
);

console.log('PASS test_0183_cloud_remote_build_contract');
