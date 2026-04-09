#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import fs from 'node:fs';
import path from 'node:path';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZipPkg from 'adm-zip';

const AdmZip = AdmZipPkg && AdmZipPkg.default ? AdmZipPkg.default : AdmZipPkg;
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const guidePath = path.join(repoRoot, 'docs/user-guide/slide_upload_auth_and_cache_contract_v1.md');

function buildImportZipBuffer() {
  const payload = [
    { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.table', v: 'UI.SlideCacheContractApp' },
    { id: 0, p: 0, r: 0, c: 0, k: 'app_name', t: 'str', v: '0312 Cache Contract App' },
    { id: 0, p: 0, r: 0, c: 0, k: 'source_worker', t: 'str', v: 'zip-import' },
    { id: 0, p: 0, r: 0, c: 0, k: 'slide_capable', t: 'bool', v: true },
    { id: 0, p: 0, r: 0, c: 0, k: 'slide_surface_type', t: 'str', v: 'workspace.page' },
    { id: 0, p: 0, r: 0, c: 0, k: 'from_user', t: 'str', v: '@cache:localhost' },
    { id: 0, p: 0, r: 0, c: 0, k: 'to_user', t: 'str', v: '@drop:localhost' },
    { id: 0, p: 0, r: 0, c: 0, k: 'ui_authoring_version', t: 'str', v: 'cellwise.ui.v1' },
    { id: 0, p: 0, r: 0, c: 0, k: 'ui_root_node_id', t: 'str', v: 'cache_root' },
  ];
  const zip = new AdmZip();
  zip.addFile('app_payload.json', Buffer.from(JSON.stringify(payload, null, 2), 'utf8'));
  return zip.toBuffer();
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0312-cache-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0312_cache_${Date.now()}`;
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

async function test_slide_import_requires_cache_priming_before_import() {
  return withServerState(async (state) => {
    const missing = state.runtime.hostApi.slideImportAppFromMxc('mxc://localhost/0312-missing');
    assert.equal(missing.ok, false, 'uncached_slide_import_must_fail');
    assert.equal(missing.code, 'invalid_target', 'uncached_slide_import_must_report_invalid_target');
    assert.equal(missing.detail, 'media_not_cached', 'uncached_slide_import_must_report_media_not_cached');

    state.cacheUploadedMediaForTest('mxc://localhost/0312-cached', {
      buffer: buildImportZipBuffer(),
      contentType: 'application/zip',
      filename: '0312-cache-contract.zip',
      userId: '@drop:localhost',
    });
    const imported = state.runtime.hostApi.slideImportAppFromMxc('mxc://localhost/0312-cached');
    assert.equal(imported.ok, true, 'cached_slide_import_must_succeed');
    assert.equal(typeof imported.data?.model_id, 'number', 'cached_slide_import_must_return_model_id');

    assert.ok(fs.existsSync(guidePath), 'slide_upload_auth_and_cache_contract_doc_missing');
    const guideText = fs.readFileSync(guidePath, 'utf8');
    assert.match(guideText, /\/api\/media\/upload/, 'contract_doc_must_name_cache_priming_entrypoint');
    assert.match(guideText, /media_not_cached/, 'contract_doc_must_name_media_not_cached');
    assert.match(guideText, /当前 ui-server 已缓存/, 'contract_doc_must_state_server_cached_requirement');
    return { key: 'slide_import_requires_cache_priming_before_import', status: 'PASS' };
  });
}

const tests = [
  test_slide_import_requires_cache_priming_before_import,
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
