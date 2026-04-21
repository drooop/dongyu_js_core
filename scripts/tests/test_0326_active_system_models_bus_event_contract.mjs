#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

const TARGET_FILES = [
  'packages/worker-base/system-models/cognition_handlers.json',
  'packages/worker-base/system-models/intent_handlers_docs.json',
  'packages/worker-base/system-models/intent_handlers_home.json',
  'packages/worker-base/system-models/intent_handlers_matrix_debug.json',
  'packages/worker-base/system-models/intent_handlers_prompt_filltable.json',
  'packages/worker-base/system-models/intent_handlers_slide_create.json',
  'packages/worker-base/system-models/intent_handlers_slide_import.json',
  'packages/worker-base/system-models/intent_handlers_static.json',
  'packages/worker-base/system-models/intent_handlers_three_scene.json',
  'packages/worker-base/system-models/intent_handlers_ui_examples.json',
  'packages/worker-base/system-models/intent_handlers_ws.json',
  'packages/worker-base/system-models/intent_dispatch_config.json',
  'packages/worker-base/system-models/prompt_catalog_ui.json',
  'packages/worker-base/system-models/test_model_100_ui.json',
];

function loadText(relPath) {
  return readFileSync(join(ROOT, relPath), 'utf8');
}

function test_active_system_models_stop_using_ui_event_symbols() {
  const offenders = [];
  for (const relPath of TARGET_FILES) {
    const text = loadText(relPath);
    if (
      text.includes('ui_event')
      || text.includes('ui_event_error')
      || text.includes('ui_event_last_op_id')
      || text.includes('ui_event_func')
    ) {
      offenders.push(relPath);
    }
  }
  assert.deepEqual(offenders, [], `active system-model files must stop using ui_event symbols: ${offenders.join(', ')}`);
  return { key: 'active_system_models_stop_using_ui_event_symbols', status: 'PASS' };
}

const tests = [test_active_system_models_stop_using_ui_event_symbols];

(async () => {
  let passed = 0;
  let failed = 0;
  for (const test of tests) {
    try {
      const result = await test();
      console.log(`[${result.status}] ${result.key}`);
      passed += 1;
    } catch (error) {
      console.log(`[FAIL] ${test.name}: ${error.message}`);
      failed += 1;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
  process.exit(failed > 0 ? 1 : 0);
})();
