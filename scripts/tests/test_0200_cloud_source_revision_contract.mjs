#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const source = fs.readFileSync(path.join(repoRoot, 'scripts/ops/deploy_cloud_full.sh'), 'utf8');

assert.match(
  source,
  /\.deploy-source-revision/,
  'cloud full deploy must accept .deploy-source-revision as a source revision fallback after archive sync',
);

console.log('PASS test_0200_cloud_source_revision_contract');
