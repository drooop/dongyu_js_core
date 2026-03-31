#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function mailboxEnvelope(action, options = {}) {
  const payload = {
    action,
    meta: { op_id: options.opId || `${action}_${Date.now()}`, model_id: 100 },
  };
  if (options.value !== undefined) payload.value = options.value;
  return {
    event_id: Date.now(),
    type: action,
    payload,
    source: 'ui_renderer',
    ts: Date.now(),
  };
}

async function test_model100_submit_uses_minus10_even_if_other_negative_model_has_funcs() {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0269-live-submit-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0269_model100_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');

  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null });

  try {
    await state.activateRuntimeMode('running');
    const modelNeg101 = state.runtime.getModel(-101);
    state.runtime.addLabel(modelNeg101, 0, 0, 0, {
      k: 'dummy_before_system_root',
      t: 'func.js',
      v: { code: 'return null;', modelName: 'test_0269' },
    });

    const before = state.clientSnap().models['100'].cells['0,0,0'].labels.status?.v;
    const result = await state.submitEnvelope(mailboxEnvelope('submit', {
      opId: 'test_0269_submit',
      value: { t: 'event', v: { action: 'submit', meta: { op_id: 'test_0269_submit', model_id: 100 } } },
    }));
    assert.equal(result.result, 'ok', 'submit envelope must be accepted');

    const afterSnap = state.clientSnap();
    const afterStatus = afterSnap.models['100'].cells['0,0,0'].labels.status?.v;
    assert.notEqual(afterStatus, before, 'model100 status must change after submit path runs');
    assert.notEqual(afterStatus, 'processed', 'model100 status must not stay stale processed immediately after submit');
    return { key: 'model100_submit_uses_minus10_even_if_other_negative_model_has_funcs', status: 'PASS' };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.WORKER_BASE_WORKSPACE;
    delete process.env.WORKER_BASE_DATA_ROOT;
    delete process.env.DOCS_ROOT;
    delete process.env.STATIC_PROJECTS_ROOT;
    delete process.env.DY_PERSISTED_ASSET_ROOT;
  }
}

const tests = [test_model100_submit_uses_minus10_even_if_other_negative_model_has_funcs];

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
