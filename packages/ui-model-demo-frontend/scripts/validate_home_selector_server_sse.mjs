#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createServerState } from '../../ui-model-demo-server/server.mjs';

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

const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0239-server-sse-'));
const previousEnv = {
  DY_AUTH: process.env.DY_AUTH,
  WORKER_BASE_WORKSPACE: process.env.WORKER_BASE_WORKSPACE,
  WORKER_BASE_DATA_ROOT: process.env.WORKER_BASE_DATA_ROOT,
  DOCS_ROOT: process.env.DOCS_ROOT,
  STATIC_PROJECTS_ROOT: process.env.STATIC_PROJECTS_ROOT,
};

process.env.DY_AUTH = '0';
process.env.WORKER_BASE_WORKSPACE = `it0239_server_sse_${Date.now()}`;
process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
process.env.DOCS_ROOT = join(tempRoot, 'docs');
process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static_projects');

try {
  const state = createServerState({ dbPath: null });

  async function postEnvelope(envelope) {
    const result = await state.submitEnvelope(envelope);
    assert.equal(result && result.result, 'ok', 'server_sse_ui_event_result_must_be_ok');
  }

  const baseTarget = { model_id: -2, p: 0, r: 0, c: 0 };
  await postEnvelope(mailboxEnvelope('label_update', {
    opId: 'server_sse_force_selected_model_stray',
    target: { ...baseTarget, k: 'selected_model_id' },
    value: { t: 'str', v: '-100' },
  }));
  await postEnvelope(mailboxEnvelope('label_update', {
    opId: 'server_sse_force_home_page',
    target: { ...baseTarget, k: 'ui_page' },
    value: { t: 'str', v: 'home' },
  }));

  const labels = state.clientSnap()?.models?.['-2']?.cells?.['0,0,0']?.labels ?? {};
  const options = Array.isArray(labels.editor_model_options_json?.v) ? labels.editor_model_options_json.v : [];

  assert.equal(labels.ui_page?.v, 'home', 'server_sse_home_page_must_be_home');
  assert.equal(String(labels.selected_model_id?.v), '0', 'server_sse_home_page_must_reset_selected_model_to_zero');
  assert(options.some((entry) => entry && entry.value === 0), 'server_sse_model0_option_missing');

  console.log('home_selector_server_sse: PASS');
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
