#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const source = readFileSync(resolve(repoRoot, 'scripts/run_worker_v0.mjs'), 'utf8');

assert.match(
  source,
  /adapter\.subscribe\(\(event\)\s*=>\s*\{[\s\S]*if\s*\(!rt\.isRuntimeRunning\(\)\)\s*\{[\s\S]*return;[\s\S]*\}[\s\S]*rt\.addLabel\(sys,\s*0,\s*0,\s*0,\s*\{\s*k:\s*matrixInboxLabel/s,
  'Matrix bridge callback must drop inbound events before runtime enters running',
);

assert.match(
  source,
  /mqttClient\.on\('message',\s*\(topic,\s*buf\)\s*=>\s*\{[\s\S]*if\s*\(!rt\.isRuntimeRunning\(\)\)\s*\{[\s\S]*return;[\s\S]*\}[\s\S]*rt\.addLabel\(sys,\s*0,\s*0,\s*0,\s*\{\s*k:\s*mqttInboxLabel/s,
  'MQTT bridge callback must drop inbound messages before runtime enters running',
);

console.log('PASS test_0179_mbr_runtime_mode_gate');
