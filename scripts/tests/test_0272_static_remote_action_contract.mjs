#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const STATIC_WORKSPACE_TRUTH_MODEL_ID = 1012;

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

async function test_static_project_list_materializes_into_truth_model() {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0272-static-list-'));
  const staticRoot = join(tempRoot, 'static_projects');
  const docsRoot = join(tempRoot, 'docs');
  const dataRoot = join(tempRoot, 'runtime');
  mkdirSync(join(staticRoot, 'demo-static'), { recursive: true });
  writeFileSync(join(staticRoot, 'demo-static', 'index.html'), '<html><body>demo</body></html>');

  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0272_static_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = dataRoot;
  process.env.DOCS_ROOT = docsRoot;
  process.env.STATIC_PROJECTS_ROOT = staticRoot;

  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null });

  try {
    await state.activateRuntimeMode('running');
    const result = await state.submitEnvelope(mailboxEnvelope('static_project_list', {
      opId: 'test_0272_static_list',
      target: { model_id: STATIC_WORKSPACE_TRUTH_MODEL_ID, p: 0, r: 0, c: 0, k: 'static_projects_json' },
    }));
    assert.equal(result.result, 'ok', 'static_project_list_action_must_succeed');

    const labels = state.clientSnap().models[String(STATIC_WORKSPACE_TRUTH_MODEL_ID)].cells['0,0,0'].labels;
    const projects = labels.static_projects_json?.v;
    assert.ok(Array.isArray(projects), 'truth_model_must_receive_projects_array');
    assert.equal(projects.some((entry) => entry && entry.name === 'demo-static' && entry.url === '/p/demo-static/'), true, 'truth_model_projects_must_include_public_p_route');
    return { key: 'static_project_list_materializes_into_truth_model', status: 'PASS' };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.WORKER_BASE_WORKSPACE;
    delete process.env.WORKER_BASE_DATA_ROOT;
    delete process.env.DOCS_ROOT;
    delete process.env.STATIC_PROJECTS_ROOT;
    delete process.env.DY_PERSISTED_ASSET_ROOT;
  }
}

const tests = [test_static_project_list_materializes_into_truth_model];

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
