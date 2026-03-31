#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID } from '../../packages/ui-model-demo-frontend/src/model_ids.js';

function wait(ms = 140) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mailboxEnvelope(action, options = {}) {
  const payload = {
    action,
    meta: { op_id: options.opId || `${action}_${Date.now()}`, model_id: options.modelId || WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID },
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

async function test_local_mode_switch_works_via_processor_routes_without_matrix_egress() {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0270-local-mode-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0270_local_mode_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');

  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null });

  try {
    await state.activateRuntimeMode('running');
    const truth = state.runtime.getModel(WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID);
    state.runtime.addLabel(truth, 1, 0, 0, {
      k: 'processor_routes',
      t: 'pin.connect.label',
      v: [{ from: '(self, confirm)', to: ['(func, dispatch_local:in)'] }],
    });
    state.runtime.addLabel(truth, 0, 0, 0, { k: 'input_draft', t: 'str', v: 'LocalOnly' });

    let publishCount = 0;
    state.programEngine.matrixAdapter = {
      publish: async () => { publishCount += 1; },
      subscribe: () => () => {},
    };
    state.programEngine.matrixRoomId = '!test:example';
    state.programEngine.matrixDmPeerUserId = '@peer:example';

    const result = await state.submitEnvelope(mailboxEnvelope('submit', {
      opId: 'test_0270_local_submit',
      modelId: WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID,
      value: { t: 'event', v: { action: 'submit', meta: { op_id: 'test_0270_local_submit', model_id: WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID } } },
    }));
    assert.equal(result.result, 'ok', 'local_submit_envelope_must_be_accepted');

    await wait();
    const labels = state.clientSnap().models[String(WORKSPACE_FILLTABLE_EXAMPLE_TRUTH_MODEL_ID)].cells['0,0,0'].labels;
    assert.equal(labels.result_status?.v, 'local_processed', 'local_mode_must_materialize_local_processed_status');
    assert.equal(labels.submit_route_mode?.v, 'local', 'local_mode_must_update_route_mode_label');
    assert.equal(labels.submit_inflight?.v, false, 'local_mode_must_clear_submit_inflight');
    assert.match(String(labels.generated_color_text?.v || ''), /^#[0-9a-f]{6}$/i, 'local_mode_must_materialize_hex_color_text');
    assert.equal(publishCount, 0, 'local_mode_must_not_publish_matrix_payload');
    return { key: 'local_mode_switch_works_via_processor_routes_without_matrix_egress', status: 'PASS' };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.WORKER_BASE_WORKSPACE;
    delete process.env.WORKER_BASE_DATA_ROOT;
    delete process.env.DOCS_ROOT;
    delete process.env.STATIC_PROJECTS_ROOT;
    delete process.env.DY_PERSISTED_ASSET_ROOT;
  }
}

const tests = [test_local_mode_switch_works_via_processor_routes_without_matrix_egress];

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
