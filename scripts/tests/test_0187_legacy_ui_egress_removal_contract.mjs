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

function readJson(relPath) {
  return JSON.parse(readText(relPath));
}

const forwarder = readJson('packages/worker-base/system-models/ui_to_matrix_forwarder.json');
const intentDispatch = readJson('packages/worker-base/system-models/intent_dispatch_config.json');
const serverText = readText('packages/ui-model-demo-server/server.mjs');

const forwardRecord = Array.isArray(forwarder.records)
  ? forwarder.records.find((record) => record && record.k === 'forward_ui_events')
  : null;

assert.equal(
  forwardRecord,
  undefined,
  'legacy ui_to_matrix_forwarder.json must not keep forward_ui_events as a direct Matrix send function',
);

const triggerRecord = Array.isArray(intentDispatch.records)
  ? intentDispatch.records.find((record) => record && record.k === 'event_trigger_map')
  : null;

const uiEventTriggers = triggerRecord && triggerRecord.v && Array.isArray(triggerRecord.v.ui_event)
  ? triggerRecord.v.ui_event
  : [];

assert.ok(
  !uiEventTriggers.includes('forward_ui_events'),
  'event_trigger_map.ui_event must not route mailbox events to forward_ui_events after legacy egress removal',
);

assert.doesNotMatch(
  serverText,
  /fallback to forward_ui_events/,
  'server processEventsSnapshot must not fallback to forward_ui_events after legacy egress removal',
);

assert.doesNotMatch(
  serverText,
  /sys\.hasFunction\('forward_ui_events'\)/,
  'server must not special-case forward_ui_events after legacy egress removal',
);

console.log('PASS test_0187_legacy_ui_egress_removal_contract');
