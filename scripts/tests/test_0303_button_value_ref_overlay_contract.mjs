#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function checkSource(text, label) {
  assert.match(
    text,
    /function resolveRefsDeep\(value, ctx, snapshot, host\)/,
    `${label}_resolveRefsDeep_must_accept_host`,
  );
  assert.match(
    text,
    /return snapshot \? getEffectiveLabelValue\(snapshot, ref, host\) : undefined;/,
    `${label}_label_refs_must_use_effective_value`,
  );
  assert.match(
    text,
    /out\.value = resolveRefsDeep\(target\.value_ref, ctx, snapshot, host\);/,
    `${label}_button_value_ref_must_pass_host_into_resolver`,
  );
  assert.match(
    text,
    /out\.meta = resolveRefsDeep\(target\.meta_ref, ctx, snapshot, host\);/,
    `${label}_meta_ref_must_pass_host_into_resolver`,
  );
}

try {
  checkSource(read('packages/ui-renderer/src/renderer.mjs'), 'renderer_mjs');
  checkSource(read('packages/ui-renderer/src/renderer.js'), 'renderer_js');
  console.log('[PASS] button_value_ref_overlay_contract');
} catch (error) {
  console.log(`[FAIL] main: ${error.message}`);
  process.exit(1);
}
