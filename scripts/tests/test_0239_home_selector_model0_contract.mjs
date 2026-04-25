#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

import { createServerState } from '../../packages/ui-model-demo-server/server.mjs';
import { createDemoStore } from '../../packages/ui-model-demo-frontend/src/demo_modeltable.js';

const require = createRequire(import.meta.url);
const { createRenderer } = require('../../packages/ui-renderer/src');

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

function stateLabels(snapshot) {
  return snapshot?.models?.['-2']?.cells?.['0,0,0']?.labels ?? {};
}

function assertHasModel0Option(labels, message) {
  const options = Array.isArray(labels.editor_model_options_json?.v) ? labels.editor_model_options_json.v : [];
  assert(options.some((entry) => entry && entry.value === 0), message);
}

function createIsolatedServerState() {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0239-home-selector-'));
  const previousEnv = {
    DY_AUTH: process.env.DY_AUTH,
    WORKER_BASE_WORKSPACE: process.env.WORKER_BASE_WORKSPACE,
    WORKER_BASE_DATA_ROOT: process.env.WORKER_BASE_DATA_ROOT,
    DOCS_ROOT: process.env.DOCS_ROOT,
    STATIC_PROJECTS_ROOT: process.env.STATIC_PROJECTS_ROOT,
  };
  process.env.DY_AUTH = '0';
  process.env.WORKER_BASE_WORKSPACE = `it0239_home_selector_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static_projects');
  const state = createServerState({ dbPath: null });
  return {
    state,
    cleanup() {
      rmSync(tempRoot, { recursive: true, force: true });
      for (const [key, value] of Object.entries(previousEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    },
  };
}

async function test_server_startup_home_selector_contains_model0_and_baseline_zero() {
  const isolated = createIsolatedServerState();
  try {
    const labels = stateLabels(isolated.state.clientSnap());
    assert.equal(labels.ui_page?.v, 'home', 'server_home_selector_startup_page_must_be_home');
    assert.equal(String(labels.selected_model_id?.v), '0', 'server_home_selector_startup_selected_model_must_be_zero');
    assertHasModel0Option(labels, 'server_home_selector_startup_model0_option_missing');
  } finally {
    isolated.cleanup();
  }
}

async function test_server_home_route_reconciles_stray_selected_model_to_zero() {
  const isolated = createIsolatedServerState();
  try {
    const baseTarget = { model_id: -2, p: 0, r: 0, c: 0 };
    let result = await isolated.state.submitEnvelope(mailboxEnvelope('label_update', {
      opId: 'server_force_selected_model_stray',
      target: { ...baseTarget, k: 'selected_model_id' },
      value: { t: 'str', v: '1007' },
    }));
    assert.equal(result.result, 'ok', 'server_force_selected_model_stray_must_succeed');

    result = await isolated.state.submitEnvelope(mailboxEnvelope('label_update', {
      opId: 'server_force_home_page',
      target: { ...baseTarget, k: 'ui_page' },
      value: { t: 'str', v: 'home' },
    }));
    assert.equal(result.result, 'ok', 'server_force_home_page_must_succeed');

    const labels = stateLabels(isolated.state.clientSnap());
    assert.equal(labels.ui_page?.v, 'home', 'server_force_home_page_must_leave_page_at_home');
    assert.equal(String(labels.selected_model_id?.v), '0', 'server_home_route_must_reset_selected_model_to_zero');
    assertHasModel0Option(labels, 'server_home_route_model0_option_missing');
  } finally {
    isolated.cleanup();
  }
}

function sendMailbox(store, envelope) {
  store.dispatchAddLabel({ p: 0, r: 0, c: 1, k: 'ui_event', t: 'event', v: envelope });
  store.consumeOnce();
}

function test_local_store_startup_home_selector_contains_model0_and_baseline_zero() {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const labels = stateLabels(store.snapshot);
  assert.equal(labels.ui_page?.v, 'home', 'local_home_selector_startup_page_must_be_home');
  assert.equal(String(labels.selected_model_id?.v), '0', 'local_home_selector_startup_selected_model_must_be_zero');
  assertHasModel0Option(labels, 'local_home_selector_startup_model0_option_missing');
}

function test_local_store_home_route_reconciles_stray_selected_model_to_zero() {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const baseTarget = { model_id: -2, p: 0, r: 0, c: 0 };
  sendMailbox(store, mailboxEnvelope('label_update', {
    opId: 'local_force_selected_model_stray',
    target: { ...baseTarget, k: 'selected_model_id' },
    value: { t: 'str', v: '-100' },
  }));
  sendMailbox(store, mailboxEnvelope('label_update', {
    opId: 'local_force_home_page',
    target: { ...baseTarget, k: 'ui_page' },
    value: { t: 'str', v: 'home' },
  }));
  const labels = stateLabels(store.snapshot);
  assert.equal(labels.ui_page?.v, 'home', 'local_force_home_page_must_leave_page_at_home');
  assert.equal(String(labels.selected_model_id?.v), '0', 'local_home_route_must_reset_selected_model_to_zero');
}

function test_renderer_select_coerces_equivalent_option_value_types() {
  const host = {
    getSnapshot() {
      return {
        models: {
          '-2': {
            cells: {
              '0,0,0': {
                labels: {
                  selected_model_id: { t: 'str', v: '0' },
                },
              },
            },
          },
        },
      };
    },
    dispatchAddLabel() {},
    dispatchRmLabel() {},
  };
  const vue = {
    h(type, props, children) {
      return { type, props, children };
    },
    resolveComponent(name) {
      return name;
    },
  };
  const renderer = createRenderer({ host, vue });
  const vnode = renderer.renderVNode({
    type: 'Select',
    props: {
      options: [
        { label: 'Model 0', value: 0 },
        { label: 'Model 1', value: 1 },
      ],
    },
    bind: {
      read: { model_id: -2, p: 0, r: 0, c: 0, k: 'selected_model_id' },
    },
  });
  assert.equal(vnode.props.modelValue, 0, 'renderer_select_must_match_numeric_option_value_for_string_state');
}

const tests = [
  test_server_startup_home_selector_contains_model0_and_baseline_zero,
  test_server_home_route_reconciles_stray_selected_model_to_zero,
  test_local_store_startup_home_selector_contains_model0_and_baseline_zero,
  test_local_store_home_route_reconciles_stray_selected_model_to_zero,
  test_renderer_select_coerces_equivalent_option_value_types,
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  try {
    await test();
    console.log(`[PASS] ${test.name}`);
    passed += 1;
  } catch (error) {
    console.log(`[FAIL] ${test.name}: ${error.message}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
