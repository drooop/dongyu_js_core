#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function test_cleanup_scope_drops_legacy_pin_families() {
  const checks = [
    ['packages/worker-base/src/runtime.mjs', /pin\.table\.in|pin\.table\.out|pin\.single\.in|pin\.single\.out|pin\.log\.table\.in|pin\.log\.table\.out|pin\.log\.single\.in|pin\.log\.single\.out/],
    ['packages/worker-base/system-models/intent_handlers_home.json', /pin\.table\.in|pin\.table\.out|pin\.single\.in|pin\.single\.out/],
    ['packages/worker-base/system-models/home_catalog_ui.json', /pin\.table\.in|pin\.table\.out|pin\.single\.in|pin\.single\.out/],
    ['deploy/sys-v1ns/ui-side-worker/patches/10_ui_side_worker_demo.json', /pin\.table\.in|pin\.table\.out|pin\.single\.in|pin\.single\.out/],
    ['packages/worker-base/system-models/llm_cognition_config.json', /pin\.table\.in|pin\.table\.out|pin\.single\.in|pin\.single\.out|pin\.model\.in|pin\.model\.out/],
  ];
  for (const [relPath, pattern] of checks) {
    const text = read(relPath);
    assert.doesNotMatch(text, pattern, `${relPath} must not keep legacy pin families`);
  }
  return { key: 'cleanup_scope_drops_legacy_pin_families', status: 'PASS' };
}

function test_claude_pin_system_is_aligned_with_0292_0294() {
  const text = read('CLAUDE.md');
  const start = text.indexOf('PIN_SYSTEM');
  assert(start >= 0, 'CLAUDE.md must define PIN_SYSTEM');
  const section = text.slice(start, start + 1400);
  assert.match(section, /pin\.in/, 'PIN_SYSTEM must still define pin.in');
  assert.match(section, /pin\.out/, 'PIN_SYSTEM must still define pin.out');
  assert.match(section, /pin\.bus\.in/, 'PIN_SYSTEM must still define pin.bus.in');
  assert.match(section, /pin\.bus\.out/, 'PIN_SYSTEM must still define pin.bus.out');
  assert.doesNotMatch(section, /pin\.model\.in|pin\.model\.out|pin\.log\.model\.in|pin\.log\.model\.out/, 'PIN_SYSTEM must not keep model boundary pin family as normative');
  return { key: 'claude_pin_system_is_aligned_with_0292_0294', status: 'PASS' };
}

const tests = [
  test_cleanup_scope_drops_legacy_pin_families,
  test_claude_pin_system_is_aligned_with_0292_0294,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    const result = test();
    console.log(`[${result.status}] ${result.key}`);
    passed += 1;
  } catch (err) {
    console.log(`[FAIL] ${test.name}: ${err.message}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
