#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const rendererSource = fs.readFileSync(resolve(repoRoot, 'packages/ui-renderer/src/renderer.mjs'), 'utf8');
const workspace = JSON.parse(fs.readFileSync(resolve(repoRoot, 'packages/worker-base/system-models/workspace_positive_models.json'), 'utf8')).records || [];

function findRecord(predicate) {
  return workspace.find(predicate) || null;
}

function test_fileinput_uses_explicit_trigger_button_and_hidden_input() {
  assert.match(rendererSource, /node\.type === 'FileInput'/, 'fileinput_branch_missing');
  assert.match(rendererSource, /inputEl\.click\(\)/, 'fileinput_must_programmatically_trigger_native_picker');
  assert.match(rendererSource, /type:\s*'button'/, 'fileinput_must_render_explicit_button');
  assert.match(rendererSource, /display:\s*'none'/, 'fileinput_native_input_should_be_hidden');
  return { key: 'fileinput_uses_explicit_trigger_button_and_hidden_input', status: 'PASS' };
}

function test_slide_import_fileinput_dispatches_uploaded_uri_through_model0_bus_event() {
  assert.match(rendererSource, /dispatchEvent\(node, target, \{ value: uploaded\[0\]\.uri \}/, 'fileinput_must_dispatch_uploaded_uri_as_value');
  assert.match(rendererSource, /if \(target && target\.bus_event_v2 === true\)/, 'renderer_must_support_bus_event_v2_fileinput_bind');
  assert.match(rendererSource, /resolveRefsDeep\(target\.value_ref, eventCtx, snapshot, host\)/, 'bus_event_v2_must_resolve_value_ref_from_upload_context');

  const fileInputBind = findRecord((record) => (
    record?.model_id === 1030
    && record?.p === 2
    && record?.r === 3
    && record?.c === 0
    && record?.k === 'ui_bind_json'
  ));
  const write = fileInputBind?.v?.write || {};
  assert.equal(write.bus_event_v2, true, 'slide_import_fileinput_must_use_model0_bus_event');
  assert.equal(write.bus_in_key, 'slide_import_media_uri_update', 'slide_import_fileinput_must_use_uri_update_bus_key');
  assert.equal(write.value_t, 'modeltable', 'slide_import_fileinput_must_send_modeltable_payload');
  assert.ok(!write.action, 'slide_import_fileinput_must_not_use_direct_owner_label_update');
  assert.ok(
    Array.isArray(write.value_ref)
      && write.value_ref.some((record) => (
        record?.k === 'slide_import_media_uri'
        && record?.t === 'str'
        && record?.v?.$ref === 'value'
      )),
    'slide_import_fileinput_must_write_uploaded_uri_via_modeltable_record',
  );
  return { key: 'slide_import_fileinput_dispatches_uploaded_uri_through_model0_bus_event', status: 'PASS' };
}

const tests = [
  test_fileinput_uses_explicit_trigger_button_and_hidden_input,
  test_slide_import_fileinput_dispatches_uploaded_uri_through_model0_bus_event,
];
let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    const result = test();
    console.log(`[${result.status}] ${result.key}`);
    passed += 1;
  } catch (error) {
    console.log(`[FAIL] ${test.name}: ${error.message}`);
    failed += 1;
  }
}
console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
