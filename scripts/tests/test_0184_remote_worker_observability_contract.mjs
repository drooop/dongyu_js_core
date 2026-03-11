#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const source = fs.readFileSync(path.join(repoRoot, 'scripts/run_worker_remote_v1.mjs'), 'utf8');

assert.match(
  source,
  /MQTT connected:/,
  'remote-worker startup script must log connected state for MQTT diagnostics',
);

assert.match(
  source,
  /MQTT subscriptions:/,
  'remote-worker startup script must print effective MQTT subscriptions',
);

assert.match(
  source,
  /mqttTrace\.list\(\)/,
  'remote-worker startup script must inspect mqttTrace for runtime diagnostics',
);

assert.match(
  source,
  /MQTT trace delta:/,
  'remote-worker startup script must emit incremental MQTT trace diagnostics',
);

console.log('PASS test_0184_remote_worker_observability_contract');
