#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const activeRoots = [
  'packages/ui-model-demo-server',
  'packages/worker-base/src',
  'packages/worker-base/system-models',
  'deploy/sys-v1ns',
  'scripts',
];
const skippedSegments = new Set([
  'node_modules',
  'scripts/tests',
]);
const scannedExts = new Set(['.js', '.mjs', '.cjs', '.json', '.sh']);
const legacyCallPattern = /ctx\.(writeLabel|getLabel|rmLabel)\b/;
const legacyCtxDefinitionPattern = /\b(writeLabel|getLabel|rmLabel)\s*:\s*(?:async\s*)?\(/;
const obviousObjectPinPayloadPatterns = [
  /['"]pin\.(?:in|out|bus\.in|bus\.out)['"]\s*,\s*ack\b/,
  /['"]pin\.(?:in|out|bus\.in|bus\.out)['"]\s*,\s*event\b/,
  /['"]pin\.(?:in|out|bus\.in|bus\.out)['"]\s*,\s*req\.body\b/,
  /t\s*:\s*['"]pin\.(?:in|out|bus\.in|bus\.out)['"]\s*,\s*v\s*:\s*\{/,
  /"t"\s*:\s*"pin\.(?:in|out|bus\.in|bus\.out)"\s*,\s*"v"\s*:\s*\{/,
];
const legacyObjectPayloadFallbackPattern = /typeof labelValue === ['"]object['"] \? labelValue|if \(!req\) return;/;
const legacyOwnerPayloadPatterns = [
  /readPayload\(labelValue, ['"]request['"]/,
  /mtPayloadRecord\(['"](?:op|request)['"]/,
  /\{\s*id\s*:\s*0\s*,\s*op\s*:/,
  /"id"\s*:\s*0\s*,\s*"op"\s*:/,
  /\breq\.op\b/,
];

function toRel(absPath) {
  return path.relative(repoRoot, absPath).replace(/\\/g, '/');
}

function shouldSkip(relPath) {
  if (relPath.includes('.legacy')) return true;
  for (const segment of skippedSegments) {
    if (relPath === segment || relPath.startsWith(`${segment}/`)) return true;
  }
  return false;
}

function walk(absDir, out = []) {
  if (!fs.existsSync(absDir)) return out;
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    const absPath = path.join(absDir, entry.name);
    const relPath = toRel(absPath);
    if (shouldSkip(relPath)) continue;
    if (entry.isDirectory()) {
      walk(absPath, out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!scannedExts.has(path.extname(entry.name))) continue;
    out.push(absPath);
  }
  return out;
}

function test_no_active_legacy_ctx_api() {
  const files = activeRoots.flatMap((relRoot) => walk(path.join(repoRoot, relRoot)));
  const offenders = [];
  const pinPayloadOffenders = [];
  for (const file of files) {
    const relPath = toRel(file);
    const source = fs.readFileSync(file, 'utf8');
    if (legacyCallPattern.test(source) || legacyCtxDefinitionPattern.test(source)) {
      offenders.push(relPath);
    }
    if (legacyObjectPayloadFallbackPattern.test(source)) {
      offenders.push(`${relPath} (legacy object payload fallback)`);
    }
    if (legacyOwnerPayloadPatterns.some((pattern) => pattern.test(source))) {
      offenders.push(`${relPath} (legacy owner payload shape)`);
    }
    if (obviousObjectPinPayloadPatterns.some((pattern) => pattern.test(source))) {
      pinPayloadOffenders.push(relPath);
    }
  }
  assert.deepEqual(offenders, [], `active surfaces must not expose legacy ctx label APIs:\n${offenders.join('\n')}`);
  assert.deepEqual(
    pinPayloadOffenders,
    [],
    `active surfaces must not write obvious object values to pin labels:\n${pinPayloadOffenders.join('\n')}`,
  );
  return { key: 'no_active_legacy_ctx_api', status: 'PASS', scanned: files.length };
}

try {
  const result = test_no_active_legacy_ctx_api();
  console.log(`[${result.status}] ${result.key} scanned=${result.scanned}`);
} catch (err) {
  console.log(`[FAIL] test_no_active_legacy_ctx_api: ${err.message}`);
  process.exit(1);
}
