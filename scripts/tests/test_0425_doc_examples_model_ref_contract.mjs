#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function assertIncludes(file, text, message = '') {
  const content = read(file);
  assert.ok(content.includes(text), message || `${file} must include ${text}`);
}

function assertNotIncludes(file, text, message = '') {
  const content = read(file);
  assert.ok(!content.includes(text), message || `${file} must not include ${text}`);
}

function test_slide_runtime_guide_uses_subtable_install_language() {
  const file = 'docs/user-guide/slide-app-runtime/slide_app_runtime_developer_guide.md';
  assertIncludes(file, 'App instance `table_id`');
  assertIncludes(file, '`model.subtable`');
  assertIncludes(file, '`visible_model_ref={table_id,model_id}`');
  assertNotIncludes(file, '会被 remap 成正式正数模型 id');
  assertNotIncludes(file, '为临时模型 id 分配正式正数模型 id');
  assertNotIncludes(file, '写 `model.submt`，把 APP 挂到 Workspace');
}

function test_minimal_submit_docs_are_table_qualified() {
  const files = [
    'docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md',
    'docs/user-guide/slide-app-runtime/minimal_submit_app_provider_visualized.md',
    'docs/user-guide/slide-app-runtime/minimal_submit_app_provider_interactive.html',
    'docs/user-guide/slide-app-runtime/mqtt_response_to_ui_materialization.md',
  ];
  for (const file of files) {
    assertIncludes(file, 'origin_table_id', `${file} must teach origin_table_id`);
    assertIncludes(file, 'reply_target_table_id', `${file} must teach reply_target_table_id`);
    assertNotIncludes(file, 'reply_target_worker_id / reply_target_model_id / reply_target_pin', `${file} must not teach bare reply target`);
    assertNotIncludes(file, 'UIPUT/ws/dam/pic/de/U1/2000/result', `${file} must not use stale response topic example`);
    assertNotIncludes(file, 'endpoint_* 与 `reply_target_*` 描述同一个本地目标', `${file} must not couple endpoint and reply target`);
    assertNotIncludes(file, 'endpoint_*</code> 必须与 <code>reply_target_*</code> 一致', `${file} must not couple endpoint and reply target`);
    assertNotIncludes(file, 'endpoint_* 必须与 reply_target_* 一致', `${file} must not couple endpoint and reply target`);
  }
  assertIncludes(
    'docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md',
    '/api/slide-apps/export.zip?table_id=<encoded-table-id>&model_id=0',
  );
  assertIncludes(
    'docs/user-guide/slide-app-runtime/minimal_submit_app_provider_interactive.html',
    '/api/slide-apps/export.zip?table_id=&lt;encoded-table-id&gt;&amp;model_id=0',
  );
  assertIncludes(
    'docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md',
    'transportEndpointFromTopic(responseTopic)',
  );
  assertNotIncludes(
    'docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md',
    "mt('endpoint_table_id', 'str', replyTarget.table_id)",
  );
}

function test_modeltable_user_guide_lists_subtable_and_payload_tables() {
  const file = 'docs/user-guide/modeltable_user_guide.md';
  assertIncludes(file, '`model.subtable`');
  assertIncludes(file, 'ModelRef = { table_id, model_id }');
  assertIncludes(file, 'origin_table_id');
  assertIncludes(file, 'reply_target_table_id');
}

function test_ssot_payload_contract_allows_host_endpoint_with_app_reply_target() {
  assertIncludes(
    'docs/ssot/temporary_modeltable_payload_v1.md',
    'host transport endpoint',
  );
  assertIncludes(
    'docs/ssot/temporary_modeltable_payload_v1.md',
    'App instance 目标下二者通常不同',
  );
  assertIncludes(
    'docs/ssot/runtime_semantics_modeltable_driven.md',
    'App instance 目标下二者通常不同',
  );
}

function test_visible_snapshot_docs_use_table_qualified_refs() {
  const files = [
    'docs/ssot/runtime_semantics_modeltable_driven.md',
    'docs/ssot/ui_to_matrix_event_flow.md',
  ];
  for (const file of files) {
    assertIncludes(file, 'visibleModelRefs', `${file} must mention table-qualified visibleModelRefs`);
    assertNotIncludes(file, '客户端用 `visible_model_id` 明确订阅', `${file} must not teach bare visible_model_id subscriptions`);
    assertNotIncludes(file, '订阅 `visible_model_id=A`', `${file} must not teach bare visible_model_id subscriptions`);
  }
}

const tests = [
  test_slide_runtime_guide_uses_subtable_install_language,
  test_minimal_submit_docs_are_table_qualified,
  test_modeltable_user_guide_lists_subtable_and_payload_tables,
  test_ssot_payload_contract_allows_host_endpoint_with_app_reply_target,
  test_visible_snapshot_docs_use_table_qualified_refs,
];

const results = [];
for (const test of tests) {
  try {
    test();
    results.push({ key: test.name, status: 'PASS' });
  } catch (error) {
    results.push({ key: test.name, status: 'FAIL', message: error?.message || String(error) });
  }
}

const failed = results.filter((result) => result.status !== 'PASS');
console.log(JSON.stringify({ ok: failed.length === 0, results }, null, 2));
if (failed.length > 0) process.exit(1);
