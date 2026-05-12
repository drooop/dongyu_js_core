#!/usr/bin/env node
// 0364 — docs must describe the split management/control bus contract, not the removed unsplit bus surface.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function assertIncludes(text, needle, label) {
  assert.ok(text.includes(needle), `${label}_must_include:${needle}`);
}

function assertNotIncludes(text, needle, label) {
  assert.equal(text.includes(needle), false, `${label}_must_not_include:${needle}`);
}

function test_slide_runtime_docs_use_split_bus_only() {
  const files = [
    'docs/user-guide/slide-app-runtime/README.md',
    'docs/user-guide/slide-app-runtime/slide_app_runtime_developer_guide.md',
    'docs/user-guide/slide-app-runtime/slide_app_runtime_flow_visualized.html',
    'docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md',
    'docs/user-guide/slide-app-runtime/minimal_submit_app_provider_visualized.md',
    'docs/user-guide/slide-app-runtime/minimal_submit_app_provider_interactive.html',
  ];
  for (const relPath of files) {
    const text = read(relPath);
    assertNotIncludes(text, 'pin.bus.in', relPath);
    assertNotIncludes(text, 'pin.bus.out', relPath);
  }
  const guide = read('docs/user-guide/slide-app-runtime/slide_app_runtime_developer_guide.md');
  assertIncludes(guide, 'pin.bus.mb.in', 'slide_runtime_developer_guide');
  assertIncludes(guide, 'pin.bus.mb.out', 'slide_runtime_developer_guide');
  return { key: 'slide_runtime_docs_use_split_bus_only', status: 'PASS' };
}

function test_current_user_guides_use_split_bus_only() {
  const files = [
    'docs/user-guide/slide_delivery_and_runtime_overview_v1.md',
    'docs/user-guide/workspace_ui_filltable_example.md',
    'docs/user-guide/modeltable_user_guide.md',
    'docs/user-guide/ui_components_v2.md',
    'docs/user-guide/slide_matrix_delivery_v1.md',
    'docs/architecture_mantanet_and_workers.md',
    'docs/handover/dam-worker-guide.md',
  ];
  for (const relPath of files) {
    const text = read(relPath);
    assertNotIncludes(text, 'pin.bus.in', relPath);
    assertNotIncludes(text, 'pin.bus.out', relPath);
    assertNotIncludes(text, 'MGMT_OUT', relPath);
    assertNotIncludes(text, 'MGMT_IN', relPath);
  }
  return { key: 'current_user_guides_use_split_bus_only', status: 'PASS' };
}

function test_ssot_freezes_0364_as_current_contract() {
  const runtime = read('docs/ssot/runtime_semantics_modeltable_driven.md');
  const registry = read('docs/ssot/label_type_registry.md');
  const payload = read('docs/ssot/temporary_modeltable_payload_v1.md');
  const eventFlow = read('docs/ssot/ui_to_matrix_event_flow.md');
  const pinContract = read('docs/ssot/pin_connection_contract_v2.md');
  const importedSlide = read('docs/ssot/imported_slide_app_host_ingress_semantics_v1.md');
  const uiRouting = read('docs/ssot/ui_model_pin_routing_architecture.md');

  for (const [name, text] of [
    ['runtime_semantics', runtime],
    ['label_type_registry', registry],
    ['temporary_modeltable_payload', payload],
    ['ui_to_matrix_event_flow', eventFlow],
    ['pin_connection_contract', pinContract],
    ['imported_slide_ingress', importedSlide],
    ['ui_model_pin_routing', uiRouting],
  ]) {
    assertIncludes(text, 'pin.bus.cb.in', name);
    assertIncludes(text, 'pin.bus.mb.out', name);
    assertNotIncludes(text, 'MGMT_OUT', name);
    assertNotIncludes(text, 'MGMT_IN', name);
    assertNotIncludes(text, 'ctx.publishMqtt', name);
    assertNotIncludes(text, 'ctx.sendMatrix', name);
    assertNotIncludes(text, '0364 前', name);
    assertNotIncludes(text, 'current window', name);
    assertNotIncludes(text, 'current migration surface', name);
  }
  assertIncludes(runtime, 'bus_event_v2 -> Model 0 (0,0,0) pin.bus.mb.in', 'runtime_semantics');
  assertIncludes(payload, 'pin.bus.cb.in` / `pin.bus.cb.out` / `pin.bus.mb.in` / `pin.bus.mb.out', 'temporary_modeltable_payload');
  return { key: 'ssot_freezes_0364_as_current_contract', status: 'PASS' };
}

function test_provider_import_docs_forbid_all_host_owned_bus_surface() {
  const files = [
    'docs/user-guide/slide_executable_import_v1.md',
    'docs/user-guide/slide_matrix_delivery_v1.md',
  ];
  for (const relPath of files) {
    const text = read(relPath);
    for (const required of [
      'pin.bus.cb.in',
      'pin.bus.cb.out',
      'pin.bus.mb.in',
      'pin.bus.mb.out',
      'ui.egress.binding.v1',
    ]) {
      assertIncludes(text, required, relPath);
    }
  }
  return { key: 'provider_import_docs_forbid_all_host_owned_bus_surface', status: 'PASS' };
}

function test_public_guides_use_canonical_worker_topic_shape() {
  const canonicalTopic = 'UIPUT/<ws_id>/<dam_id>/<pic_id>/<de_id>/<sw_id>/<worker_id>/<model_id>/<pin>';
  const wrongTopic = 'UIPUT/<ws_id>/<dam_id>/<pic_id>/<de_id>/<sw_id>/worker/<worker_id>/model/<model_id>/pin/<pin>';
  const runtime = read('docs/ssot/runtime_semantics_modeltable_driven.md');
  const userGuide = read('docs/user-guide/modeltable_user_guide.md');

  assertIncludes(runtime, canonicalTopic, 'runtime_semantics');
  assertIncludes(userGuide, canonicalTopic, 'modeltable_user_guide');
  assert.match(runtime, /旧格式 `UIPUT\/\.\.\.\/worker\/<worker_id>\/model\/<model_id>\/pin\/<pin>`.*必须 fail closed/u, 'runtime_semantics must mention old topic only as forbidden');
  assert.match(userGuide, /旧的 `UIPUT\/\.\.\.\/worker\/<worker_id>\/model\/<model_id>\/pin\/<pin>`/u, 'modeltable_user_guide must mention old topic only as forbidden');
  return { key: 'public_guides_use_canonical_worker_topic_shape', status: 'PASS' };
}

function test_worker_label_docs_use_current_table_shape() {
  const registry = read('docs/ssot/label_type_registry.md');
  const userGuide = read('docs/user-guide/modeltable_user_guide.md');

  for (const [name, text] of [
    ['label_type_registry', registry],
    ['modeltable_user_guide', userGuide],
  ]) {
    assertIncludes(text, 'Worker：软件工人类型标签', name);
    assertIncludes(text, '| `worker.role` | 软件工人类型 | `sys_worker_role` |', name);
    assertIncludes(text, '`WSM` 社区管理；`DEM` 数字员工管理；`V1N` 普通软件工人', name);
    assertIncludes(text, '| `worker.id` | 软件工人 ID | `sys_worker_id` |', name);
    assertIncludes(text, 'ws/dam/pic/de/sw', name);
    assertIncludes(text, '"k":"sys_worker_role","t":"worker.role","v":"DEM"', name);
    assertIncludes(text, '"k":"sys_worker_id","t":"worker.id","v":"5/10/28/35/13"', name);
  }
  return { key: 'worker_label_docs_use_current_table_shape', status: 'PASS' };
}

const tests = [
  test_slide_runtime_docs_use_split_bus_only,
  test_current_user_guides_use_split_bus_only,
  test_ssot_freezes_0364_as_current_contract,
  test_provider_import_docs_forbid_all_host_owned_bus_surface,
  test_public_guides_use_canonical_worker_topic_shape,
  test_worker_label_docs_use_current_table_shape,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    const result = test();
    console.log(`[${result.status}] ${result.key}`);
    passed += 1;
  } catch (error) {
    console.log(`[FAIL] ${test.name}: ${error && error.stack ? error.stack : error}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
