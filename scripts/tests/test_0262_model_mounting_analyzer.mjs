#!/usr/bin/env node

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const { analyzeModelMounting } = await import('../ops/model_mounting_analyzer.mjs');

const result = await analyzeModelMounting({ repoRoot });

assert.ok(result && typeof result === 'object', 'analyzer must return an object');
assert.ok(Array.isArray(result.models), 'analyzer must return models array');
assert.ok(Array.isArray(result.mounts), 'analyzer must return mounts array');
assert.ok(result.audit && typeof result.audit === 'object', 'analyzer must return audit summary');

const ids = new Set(result.models.map((model) => model.id));
assert.ok(ids.has(-1), 'editor mailbox model -1 must be declared via repo/runtime facts');
assert.ok(ids.has(-2), 'editor state model -2 must be declared via repo/runtime facts');
assert.ok(ids.has(-25), 'workspace catalog model -25 must be declared');
assert.ok(ids.has(-101), 'gallery mailbox -101 must be declared via server bootstrap facts');

const duplicateIds = new Set(result.audit.canonical.duplicateChildren.map((item) => item.child));
assert.ok(duplicateIds.has(100), 'canonical audit must detect model 100 duplicate parent mounts');
assert.ok(duplicateIds.has(1), 'canonical audit must detect model 1 duplicate parent mounts');

assert.equal(result.audit.canonical.unmountedCount, 13, 'canonical audit must expose the current 13 unmounted models');

const canonicalUnmounted = new Set(result.audit.canonical.unmountedModels.map((model) => model.id));
for (const id of [-1, -2, -3, -10, -12, -21, -22, -23, -24, -25, -26, -101, -102]) {
  assert.ok(canonicalUnmounted.has(id), `canonical audit must include unmounted model ${id}`);
}

console.log('PASS test_0262_model_mounting_analyzer');
