#!/usr/bin/env node
// 0332 follow-up: Matrix live adapter must not replay historical room events
// into the current ModelTable state after reconnect/redeploy.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const source = readFileSync(resolve(repoRoot, 'packages/worker-base/src/matrix_live.js'), 'utf8');

assert.match(
  source,
  /Room\.timeline['"],\s*\(event,\s*room,\s*toStartOfTimeline,\s*removed,\s*data\)/,
  'matrix_live Room.timeline handler must receive timeline metadata',
);

assert.match(
  source,
  /data\.liveEvent\s*!==\s*true/,
  'matrix_live must ignore initial-sync/backfill events and only consume live Matrix events',
);

console.log('[PASS] matrix_live_ignores_initial_sync_timeline_events');
