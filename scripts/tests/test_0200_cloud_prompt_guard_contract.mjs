#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const source = fs.readFileSync(path.join(repoRoot, 'scripts/ops/deploy_cloud_full.sh'), 'utf8');

assert.doesNotMatch(
  source,
  /llmPromptAvailable|txt_prompt_unavailable/,
  'cloud full deploy must not rely on legacy prompt source markers after the 0191 page modelization path',
);

assert.match(
  source,
  /llm_prompt_available=.*llm_prompt_notice=/,
  'cloud full deploy must verify prompt availability through current snapshot runtime labels',
);

console.log('PASS test_0200_cloud_prompt_guard_contract');
