#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

function readText(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

const workspacePositiveModels = readText('packages/worker-base/system-models/workspace_positive_models.json');
const galleryModel = readText('packages/ui-model-demo-frontend/src/gallery_model.js');

assert.match(
  workspacePositiveModels,
  /"commit_policy"\s*:\s*"on_submit"/,
  'workspace model100 input_value__bind must opt in to commit_policy=on_submit',
);

assert.match(
  galleryModel,
  /commit_policy:\s*'on_change'/,
  'gallery slider binding must opt in to commit_policy=on_change',
);

console.log('PASS test_0186_real_binding_opt_in_contract');
