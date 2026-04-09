#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function mailboxEnvelope(action, options = {}) {
  const payload = {
    action,
    meta: { op_id: options.opId || `${action}_${Date.now()}` },
  };
  if (options.target !== undefined) payload.target = options.target;
  if (options.value !== undefined) payload.value = options.value;
  return {
    event_id: Date.now(),
    type: action,
    payload,
    source: 'ui_renderer',
    ts: Date.now(),
  };
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0308-retire-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0308_retire_${Date.now()}`;
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

async function test_slide_legacy_actions_are_rejected() {
  return withServerState(async (state) => {
    const cases = [
      mailboxEnvelope('submit', {
        target: { model_id: 100, p: 0, r: 0, c: 0 },
        value: { t: 'event', v: { action: 'submit', input_value: 'legacy' } },
      }),
      mailboxEnvelope('slide_app_import', {
        target: { model_id: 1031, p: 0, r: 0, c: 0, k: 'slide_import_media_uri' },
      }),
      mailboxEnvelope('slide_app_create', {
        target: { model_id: 1035, p: 0, r: 0, c: 0, k: 'create_app_name' },
      }),
      mailboxEnvelope('ws_app_add'),
      mailboxEnvelope('ws_app_select', { value: { t: 'int', v: 100 } }),
      mailboxEnvelope('ws_app_delete', { value: { t: 'int', v: 100 } }),
    ];

    for (const envelope of cases) {
      const result = await state.submitEnvelope(envelope);
      assert.equal(result.result, 'error', `legacy_action_${envelope.payload.action}_must_be_rejected`);
      assert.equal(result.code, 'legacy_action_protocol_retired', `legacy_action_${envelope.payload.action}_must_report_retired_code`);
    }
    return { key: 'slide_legacy_actions_are_rejected', status: 'PASS' };
  });
}

const tests = [
  test_slide_legacy_actions_are_rejected,
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
