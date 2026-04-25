#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function hasWorkerBaseSystemModelsCopy(source) {
  return /COPY\s+packages\/worker-base\/system-models\/\s+\.\/packages\/worker-base\/system-models\//.test(source)
    || /COPY\s+packages\/worker-base\/\s+\.\/packages\/worker-base\//.test(source);
}

function run() {
  const targets = [
    'k8s/Dockerfile.remote-worker',
    'k8s/Dockerfile.mbr-worker',
    'k8s/Dockerfile.ui-side-worker',
  ];

  for (const relPath of targets) {
    const source = read(relPath);
    assert(
      hasWorkerBaseSystemModelsCopy(source),
      `${relPath} must copy packages/worker-base/system-models so runtime.mjs can import default_table_programs.json`,
    );
  }

  console.log('PASS test_0328_worker_images_include_runtime_assets');
}

try {
  run();
} catch (err) {
  console.error(`FAIL test_0328_worker_images_include_runtime_assets: ${err.message}`);
  process.exit(1);
}
