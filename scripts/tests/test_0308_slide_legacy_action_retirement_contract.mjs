#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function test_slide_action_ingress_mapping_is_removed_from_server_source() {
  const source = fs.readFileSync(path.join(repoRoot, 'packages/ui-model-demo-server/server.mjs'), 'utf8');
  assert.ok(!source.includes('const RUNTIME_PIN_SYSTEM_ACTION_SPECS = ['), 'runtime_pin_system_action_specs_must_be_retired');
  assert.ok(!source.includes('function buildUiEventIngressPort('), 'legacy_action_to_ingress_helper_must_be_retired');
  assert.ok(!source.includes('function ensureRuntimePinSystemActionBuildout('), 'legacy_runtime_pin_system_buildout_must_be_retired');
  return { key: 'slide_action_ingress_mapping_is_removed_from_server_source', status: 'PASS' };
}

function test_non_slide_and_infra_paths_remain_declared() {
  const source = fs.readFileSync(path.join(repoRoot, 'packages/ui-model-demo-server/server.mjs'), 'utf8');
  assert.match(source, /event_trigger_map/, 'scene_context_trigger_path_must_remain');
  assert.match(source, /intent_dispatch_table/, 'non_slide_dispatch_table_must_remain');
  assert.match(source, /buildMailboxEventLabel|setMailboxEnvelope/, 'mailbox_transport_path_must_remain');
  return { key: 'non_slide_and_infra_paths_remain_declared', status: 'PASS' };
}

const tests = [
  test_slide_action_ingress_mapping_is_removed_from_server_source,
  test_non_slide_and_infra_paths_remain_declared,
];

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
