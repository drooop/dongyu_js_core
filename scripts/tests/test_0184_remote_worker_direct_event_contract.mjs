#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const patchText = fs.readFileSync(path.join(repoRoot, 'deploy/sys-v1ns/remote-worker/patches/10_model100.json'), 'utf8');

assert.doesNotMatch(
  patchText,
  /ctx\.getLabel\(\{\s*model_id:\s*100,\s*p:\s*1,\s*r:\s*0,\s*c:\s*0,\s*k:\s*'action'/,
  'remote-worker business function must not fall back to reading p=1 action label from bridge-written records',
);
assert.doesNotMatch(
  patchText,
  /ctx\.getLabel\(\{\s*model_id:\s*100,\s*p:\s*1,\s*r:\s*0,\s*c:\s*0,\s*k:\s*'data'/,
  'remote-worker business function must not fall back to reading p=1 data label from bridge-written records',
);
assert.match(
  patchText,
  /typeof trigger !== 'object' \|\| typeof trigger\.action !== 'string'/,
  'remote-worker business function must consume direct event object on its input pin',
);

console.log('PASS test_0184_remote_worker_direct_event_contract');
