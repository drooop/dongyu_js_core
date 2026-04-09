#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function wait(ms = 120) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0306-model100-chain-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0306_model100_chain_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null });
  try {
    await state.activateRuntimeMode('running');
    return await fn(state);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.WORKER_BASE_WORKSPACE;
    delete process.env.WORKER_BASE_DATA_ROOT;
    delete process.env.DOCS_ROOT;
    delete process.env.STATIC_PROJECTS_ROOT;
    delete process.env.DY_PERSISTED_ASSET_ROOT;
  }
}

async function test_legacy_model100_action_submit_is_retired() {
  return withServerState(async (state) => {
    const result = await state.submitEnvelope({
      event_id: Date.now(),
      type: 'submit',
      payload: {
        action: 'submit',
        meta: { op_id: `m100_pin_chain_${Date.now()}`, model_id: 100 },
        target: { model_id: 100, p: 0, r: 0, c: 0 },
        value: {
          t: 'event',
          v: {
            action: 'submit',
            input_value: 'pin-chain-submit',
          },
        },
      },
      source: 'ui_renderer',
      ts: Date.now(),
    });
    assert.equal(result.result, 'error', 'legacy_model100_action_submit_must_be_rejected');
    assert.equal(result.code, 'legacy_action_protocol_retired', 'legacy_model100_action_submit_must_report_retired_code');
    return { key: 'legacy_model100_action_submit_is_retired', status: 'PASS' };
  });
}

const tests = [
  test_legacy_model100_action_submit_is_retired,
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
