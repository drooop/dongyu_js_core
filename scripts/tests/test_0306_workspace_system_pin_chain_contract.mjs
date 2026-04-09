#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const ROUTE_CASES = [
  { action: 'slide_app_import', sourcePin: 'ui_event_slide_app_import', targetPin: 'slide_app_import_request' },
  { action: 'slide_app_create', sourcePin: 'ui_event_slide_app_create', targetPin: 'slide_app_create_request' },
  { action: 'ws_app_add', sourcePin: 'ui_event_ws_app_add', targetPin: 'ws_app_add_request' },
  { action: 'ws_app_delete', sourcePin: 'ui_event_ws_app_delete', targetPin: 'ws_app_delete_request' },
  { action: 'ws_select_app', sourcePin: 'ui_event_ws_select_app', targetPin: 'ws_select_app_request' },
  { action: 'ws_app_select', sourcePin: 'ui_event_ws_app_select', targetPin: 'ws_select_app_request' },
];

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0306-system-contract-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0306_system_contract_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null });
  try {
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

async function test_workspace_system_actions_declare_runtime_pin_routes_and_pins() {
  return withServerState(async (state) => {
    const model0 = state.runtime.getModel(0);
    const systemModel = state.runtime.getModel(-10);
    assert.ok(model0, 'model0_missing');
    assert.ok(systemModel, 'system_model_missing');

    const model0Root = state.runtime.getCell(model0, 0, 0, 0).labels;
    const systemRoot = state.runtime.getCell(systemModel, 0, 0, 0).labels;

    for (const routeCase of ROUTE_CASES) {
      const routeTargets = state.runtime.modelConnectionRoutes.get(`0|${routeCase.sourcePin}`) || [];
      assert.ok(
        routeTargets.some((target) => target?.model_id === -10 && target?.k === routeCase.targetPin),
        `runtime_route_missing_for_${routeCase.action}`,
      );
      const pinLabel = systemRoot.get(routeCase.targetPin);
      assert.ok(pinLabel, `system_pin_missing_for_${routeCase.action}`);
      assert.equal(pinLabel.t, 'pin.in', `system_pin_type_invalid_for_${routeCase.action}`);
      const wiring = systemRoot.get(`${routeCase.targetPin}_wiring`);
      assert.ok(wiring, `system_wiring_missing_for_${routeCase.action}`);
      assert.equal(wiring.t, 'pin.connect.label', `system_wiring_type_invalid_for_${routeCase.action}`);
      assert.match(
        JSON.stringify(wiring.v),
        new RegExp(`${routeCase.targetPin.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}.*handle_`),
        `system_wiring_target_missing_for_${routeCase.action}`,
      );
      assert.ok(
        [...model0Root.keys()].some((key) => key.includes(routeCase.action)),
        `model0_route_label_not_materialized_for_${routeCase.action}`,
      );
    }

    return { key: 'workspace_system_actions_declare_runtime_pin_routes_and_pins', status: 'PASS' };
  });
}

const tests = [
  test_workspace_system_actions_declare_runtime_pin_routes_and_pins,
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
