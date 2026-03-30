#!/usr/bin/env node

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const { analyzeModelMounting } = await import('../ops/model_mounting_analyzer.mjs');

const result = await analyzeModelMounting({ repoRoot });
assert.ok(result.profiles && typeof result.profiles === 'object', 'analyzer must expose profile audits');

for (const profileId of ['ui-server', 'remote-worker', 'ui-side-worker', 'mbr-worker']) {
  const profile = result.profiles[profileId];
  assert.ok(profile, `missing profile ${profileId}`);
  assert.equal(profile.audit.unmountedCount, 0, `${profileId} must not keep unmounted models`);
  assert.equal(profile.audit.duplicateCount, 0, `${profileId} must not keep duplicate child mounts`);
}

const uiServerModels = new Set(result.profiles['ui-server'].models.map((model) => model.id));
for (const id of [-1, -2, -3, -10, -12, -21, -22, -23, -24, -25, -26, -100, -101, -102, -103, 1, 2, 100, 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008]) {
  assert.ok(uiServerModels.has(id), `ui-server profile must include model ${id}`);
}

console.log('PASS test_0263_model_mounting_profiles');
