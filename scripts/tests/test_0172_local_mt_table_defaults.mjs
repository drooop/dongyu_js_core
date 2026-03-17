#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

const localWorkers = read('k8s/local/workers.yaml');
const startLocal = read('scripts/ops/start_local_ui_server_with_ollama.sh');
const run0155 = read('scripts/ops/run_0155_prompt_filltable_local.sh');

assert.match(localWorkers, /name:\s*DY_LLM_MODEL[\s\S]*value:\s*"mt-label"/, 'local ui-server must default DY_LLM_MODEL to mt-label');
assert.match(localWorkers, /name:\s*DY_LLM_FALLBACK_MODEL[\s\S]*value:\s*"mt-label"/, 'local ui-server must default DY_LLM_FALLBACK_MODEL to mt-label');
assert.match(localWorkers, /name:\s*DY_LLM_MAX_TOKENS[\s\S]*value:\s*"1024"/, 'local ui-server must reserve enough tokens for schema-aware mt-label filltable JSON');
assert.match(localWorkers, /name:\s*DY_LLM_TIMEOUT_MS[\s\S]*value:\s*"180000"/, 'local ui-server must allow schema-aware mt-label filltable JSON enough time to finish');

assert.match(startLocal, /LLM_MODEL="\$\{LLM_MODEL:-mt-label\}"/, 'start_local_ui_server_with_ollama.sh must default to mt-label');
assert.match(run0155, /LLM_MODEL="\$\{LLM_MODEL:-mt-label\}"/, 'run_0155_prompt_filltable_local.sh must default to mt-label');

console.log('test_0172_local_mt_table_defaults: PASS');
