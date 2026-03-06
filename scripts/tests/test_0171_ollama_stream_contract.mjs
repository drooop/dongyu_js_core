#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const serverText = fs.readFileSync(path.join(repoRoot, 'packages/ui-model-demo-server/server.mjs'), 'utf8');

assert.match(
  serverText,
  /stream:\s*true/,
  'llmInfer must request Ollama with stream:true to avoid truncated non-stream responses',
);

assert.match(
  serverText,
  /function\s+parseOllamaGenerateResponseText\s*\(/,
  'server.mjs must define parseOllamaGenerateResponseText() helper for Ollama NDJSON responses',
);

assert.match(
  serverText,
  /parseOllamaGenerateResponseText\(text,\s*modelRaw\)/,
  'llmInfer must parse Ollama generate response text through parseOllamaGenerateResponseText()',
);

console.log('test_0171_ollama_stream_contract: PASS');
