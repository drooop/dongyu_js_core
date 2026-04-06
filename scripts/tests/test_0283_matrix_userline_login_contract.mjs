#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const MATRIX_SESSION_MODEL_ID = 1017;

function wait(ms = 120) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

function mailboxEnvelope(action, options = {}) {
  const payload = {
    action,
    meta: { op_id: options.opId || `${action}_${Date.now()}`, model_id: options.modelId || MATRIX_SESSION_MODEL_ID },
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

async function withServerState(options, fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0283-login-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0283_login_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null, ...options });
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

async function test_login_submit_materializes_session_truth() {
  const seen = [];
  return withServerState({
    matrixUserLoginImpl: async (homeserverUrl, username, password) => {
      seen.push({ homeserverUrl, username, password });
      return {
        ok: true,
        userId: '@phase1:localhost',
        displayName: 'Phase One',
        homeserverUrl: homeserverUrl || 'https://matrix.localhost',
      };
    },
  }, async (state) => {
    const truth = state.runtime.getModel(MATRIX_SESSION_MODEL_ID);
    state.runtime.addLabel(truth, 0, 0, 0, { k: 'homeserver_url_draft', t: 'str', v: 'https://matrix.localhost' });
    state.runtime.addLabel(truth, 0, 0, 0, { k: 'username_draft', t: 'str', v: 'drop' });
    state.runtime.addLabel(truth, 0, 0, 0, { k: 'password_draft', t: 'str', v: 'secret' });

    const result = await state.submitEnvelope(mailboxEnvelope('submit', {
      opId: 'test_0283_login_ok',
      modelId: MATRIX_SESSION_MODEL_ID,
      value: { t: 'event', v: { action: 'submit' } },
    }));
    assert.equal(result.result, 'ok', 'login_submit_must_be_accepted');
    await wait();

    assert.deepEqual(seen, [{ homeserverUrl: 'http://synapse.dongyu.svc.cluster.local:8008', username: 'drop', password: 'secret' }], 'matrix_user_login_impl_must_receive_host_reachable_credentials');
    const labels = state.clientSnap().models[String(MATRIX_SESSION_MODEL_ID)].cells['0,0,0'].labels;
    assert.equal(labels.session_authenticated?.v, true, 'login_success_must_set_session_authenticated');
    assert.equal(labels.session_user_id?.v, '@phase1:localhost', 'login_success_must_materialize_user_id');
    assert.equal(labels.session_display_name?.v, 'Phase One', 'login_success_must_materialize_display_name');
    assert.equal(labels.session_status?.v, 'authenticated', 'login_success_must_set_authenticated_status');
    assert.equal(labels.login_error?.v, '', 'login_success_must_clear_error');
    assert.equal(labels.password_draft?.v, '', 'login_success_must_clear_password_draft');
    return { key: 'login_submit_materializes_session_truth', status: 'PASS' };
  });
}

async function test_login_failure_materializes_error_truth() {
  return withServerState({
    matrixUserLoginImpl: async () => {
      throw new Error('login_failed');
    },
  }, async (state) => {
    const truth = state.runtime.getModel(MATRIX_SESSION_MODEL_ID);
    state.runtime.addLabel(truth, 0, 0, 0, { k: 'homeserver_url_draft', t: 'str', v: 'https://matrix.localhost' });
    state.runtime.addLabel(truth, 0, 0, 0, { k: 'username_draft', t: 'str', v: 'drop' });
    state.runtime.addLabel(truth, 0, 0, 0, { k: 'password_draft', t: 'str', v: 'bad-secret' });

    const result = await state.submitEnvelope(mailboxEnvelope('submit', {
      opId: 'test_0283_login_fail',
      modelId: MATRIX_SESSION_MODEL_ID,
      value: { t: 'event', v: { action: 'submit' } },
    }));
    assert.equal(result.result, 'ok', 'login_failure_submit_must_still_be_consumed');
    await wait();

    const labels = state.clientSnap().models[String(MATRIX_SESSION_MODEL_ID)].cells['0,0,0'].labels;
    assert.equal(labels.session_authenticated?.v, false, 'login_failure_must_leave_session_unauthenticated');
    assert.equal(labels.session_status?.v, 'login_failed', 'login_failure_must_materialize_failure_status');
    assert.equal(labels.login_error?.v, 'login_failed', 'login_failure_must_materialize_error_text');
    return { key: 'login_failure_materializes_error_truth', status: 'PASS' };
  });
}

const tests = [
  test_login_submit_materializes_session_truth,
  test_login_failure_materializes_error_truth,
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
