#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const serverText = fs.readFileSync(path.join(repoRoot, 'packages/ui-model-demo-server/server.mjs'), 'utf8');

assert.match(
  serverText,
  /model100_submit_out/,
  'server must define a Model 0 egress observation point for color-generator submit',
);

assert.match(
  serverText,
  /source_model_id|sourceModelId/,
  'server contract must still preserve source_model_id=100 on the color-generator egress path',
);

console.log('PASS test_0182_server_model0_egress_contract');
