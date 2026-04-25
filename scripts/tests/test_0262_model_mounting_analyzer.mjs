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
assert.ok(result.profiles && typeof result.profiles === 'object', 'analyzer must return profile audits');

const ids = new Set(result.models.map((model) => model.id));
assert.ok(ids.has(-1), 'editor mailbox model -1 must be declared via repo/runtime facts');
assert.ok(ids.has(-2), 'editor state model -2 must be declared via repo/runtime facts');
assert.ok(ids.has(-25), 'workspace catalog model -25 must be declared');
assert.ok(ids.has(-101), 'gallery mailbox -101 must be declared via server bootstrap facts');

const uiServer = result.profiles['ui-server'];
assert.ok(uiServer, 'ui-server profile must exist');
assert.ok(Array.isArray(uiServer.models), 'ui-server profile must include models');
assert.ok(Array.isArray(uiServer.mounts), 'ui-server profile must include mounts');

const uiServerIds = new Set(uiServer.models.map((model) => model.id));
for (const id of [-1, -2, -3, -10, -12, -21, -22, -23, -24, -25, -26, -100, -101, -102, -103, 1, 2, 100]) {
  assert.ok(uiServerIds.has(id), `ui-server profile must include model ${id}`);
}

console.log('PASS test_0262_model_mounting_analyzer');
