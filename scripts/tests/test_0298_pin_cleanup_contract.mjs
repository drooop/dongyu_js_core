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
    ['packages/ui-model-demo-frontend/src/local_bus_adapter.js', /pin\.bus\.in|pin\.bus\.out|pin\.connect\.model/],
    ['packages/ui-model-demo-frontend/src/gallery_store.js', /pin\.bus\.in|pin\.bus\.out|pin\.connect\.model/],
    ['packages/ui-model-demo-frontend/src/demo_modeltable.js', /pin\.bus\.in|pin\.bus\.out|pin\.connect\.model/],
    ['packages/worker-base/system-models/intent_handlers_home.json', /pin\.table\.in|pin\.table\.out|pin\.single\.in|pin\.single\.out/],
    ['packages/worker-base/system-models/home_catalog_ui.json', /pin\.table\.in|pin\.table\.out|pin\.single\.in|pin\.single\.out/],
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
  assert.doesNotMatch(text, /pin\.bus\.in|pin\.bus\.out/, 'CLAUDE.md must not keep removed unsplit bus pins');
  const start = text.indexOf('PIN_SYSTEM');
  assert(start >= 0, 'CLAUDE.md must define PIN_SYSTEM');
  const section = text.slice(start, start + 1400);
  assert.match(section, /pin\.in/, 'PIN_SYSTEM must still define pin.in');
  assert.match(section, /pin\.out/, 'PIN_SYSTEM must still define pin.out');
  assert.match(section, /pin\.bus\.cb\.in/, 'PIN_SYSTEM must define control bus input');
  assert.match(section, /pin\.bus\.cb\.out/, 'PIN_SYSTEM must define control bus output');
  assert.match(section, /pin\.bus\.mb\.in/, 'PIN_SYSTEM must define management bus input');
  assert.match(section, /pin\.bus\.mb\.out/, 'PIN_SYSTEM must define management bus output');
  assert.doesNotMatch(section, /pin\.bus\.in|pin\.bus\.out/, 'PIN_SYSTEM must not keep removed unsplit bus pins');
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
