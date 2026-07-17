#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const patch = JSON.parse(fs.readFileSync(path.join(repoRoot, 'deploy/sys-v1ns/remote-worker/patches/10_model100.json'), 'utf8'));
const handler = patch.records.find((record) => (
  record && record.op === 'add_label' && record.model_id === 100
  && record.k === 'on_model100_submit_in' && record.t === 'func.js'
));

assert.ok(handler, 'remote-worker patch must declare the model100 submit handler');
const handlerCode = handler.v?.code || '';

assert.doesNotMatch(
  handlerCode,
  /ctx\.getLabel\(\{\s*model_id:\s*100,\s*p:\s*1,\s*r:\s*0,\s*c:\s*0,\s*k:\s*'action'/,
  'remote-worker business function must not fall back to reading p=1 action label from bridge-written records',
);
assert.doesNotMatch(
  handlerCode,
  /ctx\.getLabel\(\{\s*model_id:\s*100,\s*p:\s*1,\s*r:\s*0,\s*c:\s*0,\s*k:\s*'data'/,
  'remote-worker business function must not fall back to reading p=1 data label from bridge-written records',
);
assert.match(
  handlerCode,
  /const inputRecords = Array\.isArray\(label && label\.v\) \? label\.v : \[\]/,
  'remote-worker business function must consume Temporary ModelTable records from its input pin',
);
assert.match(
  handlerCode,
  /parsePinPayloadV2\(inputRecords,/,
  'remote-worker business function must validate the current pin_payload.v2 contract',
);
assert.doesNotMatch(
  handlerCode,
  /trigger\.(?:action|data)/,
  'remote-worker business function must not depend on the removed direct event object shape',
);

console.log('PASS test_0184_remote_worker_direct_event_contract');
