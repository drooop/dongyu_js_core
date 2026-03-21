#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const rendererSource = fs.readFileSync(path.join(repoRoot, 'packages/ui-renderer/src/renderer.mjs'), 'utf8');

assert.doesNotMatch(
  rendererSource,
  /classList\.add\('is-loading'\)/,
  'singleFlight buttons must not manually add is-loading to DOM; loading state must come from reactive props only',
);

assert.doesNotMatch(
  rendererSource,
  /classList\.remove\('is-loading'\)/,
  'singleFlight buttons must not manually remove is-loading from DOM; loading state must come from reactive props only',
);

assert.match(
  rendererSource,
  /props\.loading\s*=\s*pendingLocal/,
  'singleFlight renderer contract must explicitly derive button loading from pendingLocal state',
);

console.log('PASS test_0182_singleflight_button_release_contract');
