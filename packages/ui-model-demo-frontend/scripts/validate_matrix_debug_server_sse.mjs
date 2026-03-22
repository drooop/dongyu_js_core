#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function mailboxEnvelope(action, options = {}) {
  const payload = {
    action,
    meta: { op_id: options.opId || `${action}_${Date.now()}` },
  };
  if (options.target) payload.target = options.target;
  if (options.value !== undefined) payload.value = options.value;
  return {
    event_id: Date.now(),
    type: action,
    payload,
    source: 'ui_renderer',
    ts: Date.now(),
  };
}

const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0213-matrix-debug-'));

process.env.DY_AUTH = '0';
process.env.WORKER_BASE_WORKSPACE = `it0213_matrix_debug_${Date.now()}`;
process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
process.env.DOCS_ROOT = join(tempRoot, 'docs');
process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static_projects');

const { createServerState } = await import(new URL('../../ui-model-demo-server/server.mjs', import.meta.url));
const state = createServerState({ dbPath: null });

try {
  let snapshot = state.clientSnap();
  const traceRoot = snapshot?.models?.['-100']?.cells?.['0,0,0']?.labels || {};
  const traceAsset = snapshot?.models?.['-100']?.cells?.['0,1,0']?.labels || {};
  const stateRoot = snapshot?.models?.['-2']?.cells?.['0,0,0']?.labels || {};

  assert(traceRoot.trace_status, 'matrix_debug_trace_status_missing');
  assert(traceAsset.page_asset_v0, 'matrix_debug_page_asset_missing_from_client_snapshot');
  assert(Array.isArray(stateRoot.matrix_debug_subjects_json?.v), 'matrix_debug_subjects_missing');
  assert.equal(typeof stateRoot.matrix_debug_readiness_text?.v, 'string', 'matrix_debug_readiness_text_missing');
  assert.equal(typeof stateRoot.matrix_debug_subject_summary_text?.v, 'string', 'matrix_debug_subject_summary_text_missing');

  await state.activateRuntimeMode('running');

  let result = await state.submitEnvelope(mailboxEnvelope('label_update', {
    opId: 'matrix_select_matrix',
    target: { model_id: -2, p: 0, r: 0, c: 0, k: 'matrix_debug_subject_selected' },
    value: { t: 'str', v: 'matrix' },
  }));
  assert.equal(result.result, 'ok', 'matrix_subject_select_request_failed');
  snapshot = state.clientSnap();
  assert.equal(
    snapshot?.models?.['-2']?.cells?.['0,0,0']?.labels?.matrix_debug_subject_selected?.v,
    'matrix',
    'matrix_subject_select_not_reflected',
  );

  result = await state.submitEnvelope(mailboxEnvelope('matrix_debug_refresh', {
    opId: 'matrix_refresh',
    target: { model_id: -2, p: 0, r: 0, c: 0, k: 'matrix_debug_subject_selected' },
  }));
  assert.equal(result.result, 'ok', 'matrix_debug_refresh_failed');
  snapshot = state.clientSnap();
  assert.match(
    String(snapshot?.models?.['-2']?.cells?.['0,0,0']?.labels?.matrix_debug_status_text?.v || ''),
    /refresh:/,
    'matrix_debug_refresh_status_missing',
  );

  result = await state.submitEnvelope(mailboxEnvelope('matrix_debug_summarize', {
    opId: 'matrix_summarize',
    target: { model_id: -2, p: 0, r: 0, c: 0, k: 'matrix_debug_subject_selected' },
  }));
  assert.equal(result.result, 'ok', 'matrix_debug_summarize_failed');
  snapshot = state.clientSnap();
  assert.match(
    String(snapshot?.models?.['-2']?.cells?.['0,0,0']?.labels?.matrix_debug_summary_text?.v || ''),
    /Matrix adapter status|Bridge status|Trace buffer status|Runtime mode/,
    'matrix_debug_summary_text_missing',
  );

  result = await state.submitEnvelope(mailboxEnvelope('matrix_debug_clear_trace', {
    opId: 'matrix_clear_trace',
    target: { model_id: -2, p: 0, r: 0, c: 0, k: 'matrix_debug_subject_selected' },
  }));
  assert.equal(result.result, 'ok', 'matrix_debug_clear_trace_failed');
  snapshot = state.clientSnap();
  assert.equal(
    snapshot?.models?.['-100']?.cells?.['0,0,0']?.labels?.trace_count?.v,
    0,
    'matrix_debug_trace_count_not_reset',
  );
  assert.match(
    String(snapshot?.models?.['-2']?.cells?.['0,0,0']?.labels?.matrix_debug_status_text?.v || ''),
    /trace cleared/,
    'matrix_debug_clear_status_missing',
  );

  const snapshotJson = JSON.stringify(snapshot || {});
  assert.equal(snapshotJson.includes('matrix_token'), false, 'matrix_debug_snapshot_leaks_matrix_token');
  assert.equal(snapshotJson.includes('matrix_passwd'), false, 'matrix_debug_snapshot_leaks_matrix_passwd');
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
  delete process.env.WORKER_BASE_WORKSPACE;
  delete process.env.WORKER_BASE_DATA_ROOT;
  delete process.env.DOCS_ROOT;
  delete process.env.STATIC_PROJECTS_ROOT;
}

console.log('validate_matrix_debug_server_sse: PASS');
