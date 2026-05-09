#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const ROUTE_CASES = [
  {
    name: 'slide_import_click',
    routeLabel: 'slide_import_click_route',
    from: [0, 0, 0, 'slide_import_click'],
    to: [2, 0, 13, 'mt_bus_receive_in'],
  },
  {
    name: 'slide_import_media_uri_update',
    routeLabel: 'slide_import_media_uri_update_route',
    from: [0, 0, 0, 'slide_import_media_uri_update'],
    to: [2, 0, 13, 'slide_import_media_uri_update'],
  },
  {
    name: 'slide_import_request',
    routeLabel: 'slide_import_request_route',
    from: [2, 0, 13, 'slide_import_request'],
    to: [1, 0, 3, 'slide_app_import_request'],
    systemPin: 'slide_app_import_request',
    systemFunc: 'handle_slide_app_import',
  },
  {
    name: 'slide_create_request',
    routeLabel: 'slide_create_request_route',
    from: [2, 0, 15, 'slide_create_request'],
    to: [1, 0, 3, 'slide_app_create_request'],
    systemPin: 'slide_app_create_request',
    systemFunc: 'handle_slide_app_create',
  },
  {
    name: 'mgmt_bus_console_send',
    routeLabel: 'mgmt_bus_console_send_route',
    from: [0, 0, 0, 'mgmt_bus_console_send'],
    to: [1, 0, 3, 'mgmt_bus_console_intent'],
  },
  {
    name: 'mgmt_bus_console_refresh',
    routeLabel: 'mgmt_bus_console_refresh_route',
    from: [0, 0, 0, 'mgmt_bus_console_refresh'],
    to: [1, 0, 3, 'mgmt_bus_console_refresh_intent'],
  },
];

const SYSTEM_HANDLER_CASES = [
  ['ws_select_app_request', 'handle_ws_select_app'],
  ['ws_app_add_request', 'handle_ws_app_add'],
  ['ws_app_delete_request', 'handle_ws_app_delete'],
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

function routeKey(modelId, endpoint) {
  return `${modelId}|${endpoint[0]}|${endpoint[1]}|${endpoint[2]}|${endpoint[3]}`;
}

function includesTarget(targets, endpoint) {
  return targets.some((target) => (
    target
    && target.model_id === 0
    && target.p === endpoint[0]
    && target.r === endpoint[1]
    && target.c === endpoint[2]
    && target.k === endpoint[3]
  ));
}

function wiringTargetsFunction(wiring, pinName, funcName) {
  const routes = Array.isArray(wiring?.v) ? wiring.v : [];
  return routes.some((route) => (
    route
    && route.from === pinName
    && Array.isArray(route.to)
    && route.to.includes(`${funcName}:in`)
  ));
}

async function test_workspace_system_actions_declare_runtime_pin_routes_and_pins() {
  return withServerState(async (state) => {
    const model0 = state.runtime.getModel(0);
    const systemModel = state.runtime.getModel(-10);
    assert.ok(model0, 'model0_missing');
    assert.ok(systemModel, 'system_model_missing');
    assert.equal(
      Object.prototype.hasOwnProperty.call(state.runtime, 'modelConnectionRoutes'),
      false,
      'removed_model_connection_routes_state_must_not_exist',
    );

    const model0Root = state.runtime.getCell(model0, 0, 0, 0).labels;
    const systemRoot = state.runtime.getCell(systemModel, 0, 0, 0).labels;

    for (const routeCase of ROUTE_CASES) {
      const routeLabel = model0Root.get(routeCase.routeLabel);
      assert.equal(routeLabel?.t, 'pin.connect.cell', `model0_route_label_invalid_for_${routeCase.name}`);
      const routeTargets = state.runtime.cellConnectionRoutes.get(routeKey(0, routeCase.from)) || [];
      assert.ok(includesTarget(routeTargets, routeCase.to), `runtime_route_missing_for_${routeCase.name}`);
      const targetCellLabels = state.runtime.getCell(model0, routeCase.to[0], routeCase.to[1], routeCase.to[2]).labels;
      assert.ok(targetCellLabels.has(routeCase.to[3]), `target_pin_missing_for_${routeCase.name}`);

      if (routeCase.systemPin) {
        const pinLabel = systemRoot.get(routeCase.systemPin);
        assert.equal(pinLabel?.t, 'pin.in', `system_pin_type_invalid_for_${routeCase.name}`);
        const wiring = systemRoot.get(`${routeCase.systemPin}_wiring`);
        assert.equal(wiring?.t, 'pin.connect.label', `system_wiring_type_invalid_for_${routeCase.name}`);
        assert.ok(
          wiringTargetsFunction(wiring, routeCase.systemPin, routeCase.systemFunc),
          `system_wiring_target_missing_for_${routeCase.name}`,
        );
      }
    }

    for (const [pinName, funcName] of SYSTEM_HANDLER_CASES) {
      const pinLabel = systemRoot.get(pinName);
      assert.equal(pinLabel?.t, 'pin.in', `system_handler_pin_missing_for_${pinName}`);
      const wiring = systemRoot.get(`${pinName}_wiring`);
      assert.equal(wiring?.t, 'pin.connect.label', `system_handler_wiring_missing_for_${pinName}`);
      assert.ok(wiringTargetsFunction(wiring, pinName, funcName), `system_handler_target_missing_for_${pinName}`);
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
