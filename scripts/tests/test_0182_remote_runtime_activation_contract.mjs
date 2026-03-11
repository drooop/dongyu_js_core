#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const remoteStoreSource = fs.readFileSync(path.join(repoRoot, 'packages/ui-model-demo-frontend/src/remote_store.js'), 'utf8');

assert.match(
  remoteStoreSource,
  /\/api\/runtime\/mode/,
  'remote_store must know how to activate ui-server runtime via /api/runtime/mode',
);

assert.match(
  remoteStoreSource,
  /mode:\s*['"]running['"]/,
  'remote_store runtime activation contract must explicitly request mode=running',
);

console.log('PASS test_0182_remote_runtime_activation_contract');
