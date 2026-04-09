#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function wait(ms = 120) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0306-submit-fallback-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0306_submit_fallback_${Date.now()}`;
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

async function test_legacy_submit_protocol_is_rejected_after_model0_ingress_materialization() {
  return withServerState(async (state) => {
    const model0 = state.runtime.getModel(0);
    state.runtime.rmLabel(model0, 0, 0, 0, 'model100_submit_ingress_route');

    const result = await state.submitEnvelope({
      event_id: Date.now(),
      type: 'submit',
      payload: {
        action: 'submit',
        meta: { op_id: `m100_fallback_${Date.now()}`, model_id: 100 },
        target: { model_id: 100, p: 0, r: 0, c: 0 },
        value: {
          t: 'event',
          v: {
            action: 'submit',
            input_value: 'fallback-submit',
          },
        },
      },
      source: 'ui_renderer',
      ts: Date.now(),
    });
    assert.equal(result.result, 'error', 'legacy_submit_must_be_rejected_after_0308');
    assert.equal(result.code, 'legacy_action_protocol_retired', 'legacy_submit_must_report_retired_protocol_code');

    const events = state.runtime.eventLog.list();
    assert.ok(
      events.some((event) => event.op === 'add_label' && event.cell?.model_id === 0 && event.cell?.p === 0 && event.cell?.r === 0 && event.cell?.c === 0 && event.label?.k === 'ui_event_submit_100_0_0_0' && event.label?.t === 'pin.bus.in'),
      'legacy_submit_must_still_materialize_model0_ingress_before_protocol_rejection',
    );
    assert.ok(
      !events.some((event) => event.op === 'add_label' && event.cell?.model_id === 100 && event.cell?.p === 0 && event.cell?.r === 0 && event.cell?.c === 2 && event.label?.k === 'ui_event' && event.label?.v),
      'legacy_submit_must_not_fall_back_to_direct_model_ui_event_path',
    );
    assert.ok(
      !events.some((event) => event.op === 'add_label' && event.cell?.model_id === 100 && event.cell?.p === 0 && event.cell?.r === 0 && event.cell?.c === 0 && event.label?.k === 'submit_request' && event.label?.t === 'pin.in' && event.label?.v),
      'legacy_submit_must_not_reach_model100_submit_request',
    );
    return { key: 'legacy_submit_protocol_is_rejected_after_model0_ingress_materialization', status: 'PASS' };
  });
}

const tests = [
  test_legacy_submit_protocol_is_rejected_after_model0_ingress_materialization,
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
