#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZipPkg from 'adm-zip';

const AdmZip = AdmZipPkg && AdmZipPkg.default ? AdmZipPkg.default : AdmZipPkg;

const DOC_PATH = 'docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md';
const ROOT_README_PATH = 'docs/user-guide/README.md';
const SLIDE_README_PATH = 'docs/user-guide/slide-app-runtime/README.md';

function readRepoText(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

function extractMarkedFence(text, markerName, language) {
  const start = `<!-- ${markerName}:start -->`;
  const end = `<!-- ${markerName}:end -->`;
  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end);
  assert.ok(startIndex >= 0, `${markerName} start marker missing`);
  assert.ok(endIndex > startIndex, `${markerName} end marker missing`);
  const section = text.slice(startIndex + start.length, endIndex);
  const match = section.match(new RegExp(`\\\`\\\`\\\`${language}\\n([\\s\\S]*?)\\n\\\`\\\`\\\``));
  assert.ok(match, `${markerName} ${language} fence missing`);
  return match[1];
}

function buildZipBuffer(payload) {
  const zip = new AdmZip();
  zip.addFile('app_payload.json', Buffer.from(JSON.stringify(payload, null, 2), 'utf8'));
  return zip.toBuffer();
}

function pinEnvelope(target, pin, value = undefined) {
  return {
    event_id: Date.now(),
    type: pin,
    payload: {
      meta: { op_id: `${pin}_${Date.now()}` },
      target,
      pin,
      ...(value !== undefined ? { value } : {}),
    },
    source: 'ui_renderer',
    ts: Date.now(),
  };
}

function wait(ms = 120) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0351-guide-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0351_guide_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null });
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

function label(records, p, r, c, key) {
  return records.find((record) => (
    record
    && record.p === p
    && record.r === r
    && record.c === c
    && record.k === key
  )) || null;
}

function assertTemporaryRecordShape(records) {
  assert.ok(Array.isArray(records), 'payload must be an array');
  assert.ok(records.length >= 20, 'payload must include a complete app, not a fragment');
  for (const record of records) {
    assert.equal(Object.prototype.hasOwnProperty.call(record, 'op'), false, 'provider payload must not include patch op');
    assert.equal(Object.prototype.hasOwnProperty.call(record, 'model_id'), false, 'provider payload must not include installed model_id');
    assert.equal(Number.isInteger(record.id), true, 'record.id must be integer');
    assert.equal(Number.isInteger(record.p), true, 'record.p must be integer');
    assert.equal(Number.isInteger(record.r), true, 'record.r must be integer');
    assert.equal(Number.isInteger(record.c), true, 'record.c must be integer');
    assert.equal(typeof record.k, 'string', 'record.k must be string');
    assert.equal(typeof record.t, 'string', 'record.t must be string');
    assert.equal(Object.prototype.hasOwnProperty.call(record, 'v'), true, 'record.v must exist');
  }
}

function test_doc_has_provider_facing_contract() {
  const doc = readRepoText(DOC_PATH);
  assert.match(doc, /不需要先理解本项目的宿主、管理总线、Model 0 或内部导入器细节/u);
  assert.match(doc, /Input \+ Submit Button \+ Display Label/u);
  assert.match(doc, /你不需要在交付包里写安装后的正式 `model_id`/u);
  assert.match(doc, /不要让按钮直接写 `display_text`/u);
  assert.match(doc, /zip 结构如下/u);
  return { key: 'doc_has_provider_facing_contract', status: 'PASS' };
}

function test_full_payload_is_parseable_and_cellwise() {
  const doc = readRepoText(DOC_PATH);
  const payload = JSON.parse(extractMarkedFence(doc, 'minimal-submit-app-payload', 'json'));
  assertTemporaryRecordShape(payload);

  assert.equal(label(payload, 0, 0, 0, 'model_type')?.t, 'model.table');
  assert.equal(label(payload, 0, 0, 0, 'app_name')?.v, 'Minimal Submit App');
  assert.equal(label(payload, 0, 0, 0, 'ui_authoring_version')?.v, 'cellwise.ui.v1');
  assert.equal(label(payload, 0, 0, 0, 'host_ingress_v1')?.t, 'json');
  assert.equal(label(payload, 0, 0, 0, 'submit_request')?.t, 'pin.in');
  assert.equal(label(payload, 0, 0, 0, 'submit_request_wiring')?.t, 'pin.connect.label');

  const componentLabels = payload.filter((record) => record.k === 'ui_component').map((record) => record.v);
  for (const component of ['Container', 'Text', 'Input', 'Button']) {
    assert.ok(componentLabels.includes(component), `component missing: ${component}`);
  }
  assert.ok(payload.some((record) => record.k === 'ui_bind_json' && record.v?.write?.pin === 'submit_request'), 'submit button binding missing');
  assert.ok(payload.some((record) => record.k === 'ui_bind_json' && record.v?.read?.k === 'display_text'), 'display read binding missing');
  return { key: 'full_payload_is_parseable_and_cellwise', status: 'PASS' };
}

function test_submit_handler_uses_current_v1n_path() {
  const doc = readRepoText(DOC_PATH);
  const payload = JSON.parse(extractMarkedFence(doc, 'minimal-submit-app-payload', 'json'));
  const handlerDoc = extractMarkedFence(doc, 'minimal-submit-handler', 'js');
  const handlerPayload = label(payload, 0, 0, 0, 'handle_submit')?.v?.code || '';

  assert.match(handlerDoc, /V1N\.addLabel\('display_text', 'str', displayText\)/u);
  assert.equal(handlerPayload.includes("V1N.addLabel('display_text', 'str', displayText);"), true, 'payload handler must write display_text');
  assert.equal(/ctx\.(writeLabel|getLabel|rmLabel)/u.test(handlerDoc), false, 'doc handler must not use legacy ctx label APIs');
  assert.equal(/V1N\.writeLabel/u.test(handlerDoc), false, 'doc handler must not use transitional writeLabel');
  assert.equal(/ctx\.(writeLabel|getLabel|rmLabel)/u.test(handlerPayload), false, 'payload handler must not use legacy ctx label APIs');
  assert.equal(/V1N\.writeLabel/u.test(handlerPayload), false, 'payload handler must not use transitional writeLabel');
  return { key: 'submit_handler_uses_current_v1n_path', status: 'PASS' };
}

async function test_documented_payload_imports_and_submit_updates_display_label() {
  const doc = readRepoText(DOC_PATH);
  const payload = JSON.parse(extractMarkedFence(doc, 'minimal-submit-app-payload', 'json'));
  return withServerState(async (state) => {
    const uri = 'mxc://localhost/0351-minimal-submit-guide';
    state.cacheUploadedMediaForTest(uri, {
      buffer: buildZipBuffer(payload),
      contentType: 'application/zip',
      filename: 'minimal-submit-app.zip',
      userId: '@drop:localhost',
    });

    const importResult = state.runtime.hostApi.slideImportAppFromMxc(uri);
    assert.equal(importResult.ok, true, `documented payload must import: ${importResult.detail || ''}`);
    const importedId = importResult.data?.model_id;
    assert.equal(Number.isInteger(importedId) && importedId > 0, true, 'imported model id must be positive');

    const importedLabelsBefore = state.clientSnap().models[String(importedId)]?.cells?.['0,0,0']?.labels || {};
    assert.equal(importedLabelsBefore.display_text?.v, 'Waiting for submit', 'initial display_text must be present');

    const result = await state.submitEnvelope(pinEnvelope(
      { model_id: importedId, p: 0, r: 0, c: 0 },
      'submit_request',
      [
        { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'ui_event.v1' },
        { id: 0, p: 0, r: 0, c: 0, k: 'text', t: 'str', v: 'hello provider' },
      ],
    ));
    assert.equal(result.result, 'ok', 'submit_request must be accepted');
    await wait();

    const importedLabelsAfter = state.clientSnap().models[String(importedId)]?.cells?.['0,0,0']?.labels || {};
    assert.equal(importedLabelsAfter.display_text?.v, 'Submitted: hello provider', 'submit handler must update display_text');
    assert.equal(Array.isArray(importedLabelsAfter.last_submit_payload?.v), true, 'submit handler must retain last payload as records');

    const inputBind = state.clientSnap().models[String(importedId)]?.cells?.['2,2,0']?.labels?.ui_bind_json?.v;
    const buttonBind = state.clientSnap().models[String(importedId)]?.cells?.['2,3,0']?.labels?.ui_bind_json?.v;
    assert.equal(inputBind?.read?.model_id, importedId, 'installer must remap input read model_id');
    assert.equal(inputBind?.write?.target_ref?.model_id, importedId, 'installer must remap input write model_id');
    assert.equal(buttonBind?.write?.target_ref?.model_id, importedId, 'installer must remap button target model_id');
    assert.equal(buttonBind?.write?.value_ref?.[1]?.v?.$label?.model_id, importedId, 'installer must remap button payload label ref');

    return { key: 'documented_payload_imports_and_submit_updates_display_label', status: 'PASS' };
  });
}

function test_user_guide_indexes_link_new_doc() {
  const rootReadme = readRepoText(ROOT_README_PATH);
  const slideReadme = readRepoText(SLIDE_README_PATH);
  assert.match(rootReadme, /最小 `Input \+ Submit \+ Display Label` 完整示例/u);
  assert.match(slideReadme, /minimal_submit_app_provider_guide\.md/u);
  return { key: 'user_guide_indexes_link_new_doc', status: 'PASS' };
}

const tests = [
  test_doc_has_provider_facing_contract,
  test_full_payload_is_parseable_and_cellwise,
  test_submit_handler_uses_current_v1n_path,
  test_documented_payload_imports_and_submit_updates_display_label,
  test_user_guide_indexes_link_new_doc,
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
      console.log(`[FAIL] ${test.name}: ${error.stack || error.message}`);
      failed += 1;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
  process.exit(failed > 0 ? 1 : 0);
})();
