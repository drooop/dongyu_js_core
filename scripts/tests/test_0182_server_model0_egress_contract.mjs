#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const serverText = fs.readFileSync(path.join(repoRoot, 'packages/ui-model-demo-server/server.mjs'), 'utf8');

assert.doesNotMatch(
  serverText,
  /model100_submit_out/,
  'server must not keep old Model 0 egress observation point for color-generator submit',
);

assert.match(
  serverText,
  /materializeDeclaredHostEgressAdapters/,
  'server must materialize generated host egress adapters from model declarations',
);

assert.match(
  serverText,
  /remote_bus_endpoint_v1/,
  'server must read remote_bus_endpoint_v1 for self-described outbound routes',
);

assert.match(
  serverText,
  /reply_to/,
  'server must synthesize route.reply_to on outbound pin_payload packets',
);

console.log('PASS test_0182_server_model0_egress_contract');
