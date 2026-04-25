#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZipPkg from 'adm-zip';
import { once } from 'node:events';

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
  process.env.MATRIX_HOMESERVER_URL = 'https://matrix.test';
  process.env.MATRIX_MBR_BOT_ACCESS_TOKEN = 'bot-token-0312';
  process.env.MATRIX_MBR_BOT_USER = '@bot:test';
  const originalFetch = global.fetch;
  global.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input && input.url ? input.url : String(input);
    if (url.startsWith('https://matrix.test/_matrix/media/v3/upload')) {
      assert.equal(init?.method, 'POST', 'matrix_upload_must_post');
      assert.equal(init?.headers?.authorization, 'Bearer bot-token-0312', 'matrix_upload_must_use_bot_token');
      return new Response(JSON.stringify({ content_uri: 'mxc://localhost/0312-uploaded' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return originalFetch(input, init);
  };
  const { createServerState, handleMediaUploadRequest } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null });
  await state.activateRuntimeMode('running');
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
    if (req.method === 'POST' && url.pathname === '/api/media/upload') {
      await handleMediaUploadRequest(req, res, state, null);
      return;
    }
    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'not_found' }));
  });
  server.listen(0, '127.0.0.1');
  try {
    if (!server.listening) {
      await once(server, 'listening');
    }
    return await fn(server, state);
  } finally {
    global.fetch = originalFetch;
    await new Promise((resolve) => server.close(() => resolve()));
    rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.WORKER_BASE_WORKSPACE;
    delete process.env.WORKER_BASE_DATA_ROOT;
    delete process.env.DOCS_ROOT;
    delete process.env.STATIC_PROJECTS_ROOT;
    delete process.env.DY_PERSISTED_ASSET_ROOT;
    delete process.env.MATRIX_HOMESERVER_URL;
    delete process.env.MATRIX_MBR_BOT_ACCESS_TOKEN;
    delete process.env.MATRIX_MBR_BOT_USER;
  }
}

async function readJson(response) {
  return response.json().catch(() => ({}));
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

function uiEventPayload(labels = []) {
  return [
    { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'ui_event.v1' },
    ...labels.map((label) => ({ id: 0, p: 0, r: 0, c: 0, ...label })),
  ];
}

function slideImportClickPayload() {
  return uiEventPayload([
    { k: 'target', t: 'json', v: { model_id: 1031, p: 0, r: 0, c: 0 } },
  ]);
}

async function test_slide_import_requires_cache_priming_before_import() {
  return withServerState(async (server, state) => {
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;
    const missing = state.runtime.hostApi.slideImportAppFromMxc('mxc://localhost/0312-missing');
    assert.equal(missing.ok, false, 'uncached_slide_import_must_fail');
    assert.equal(missing.code, 'invalid_target', 'uncached_slide_import_must_report_invalid_target');
    assert.equal(missing.detail, 'media_not_cached', 'uncached_slide_import_must_report_media_not_cached');

    const response = await fetch(`${baseUrl}/api/media/upload?filename=0312-cache-contract.zip`, {
      method: 'POST',
      headers: { 'content-type': 'application/zip' },
      body: buildImportZipBuffer(),
    });
    const data = await readJson(response);
    assert.equal(response.status, 200, 'upload_route_must_accept_zip');
    assert.equal(data.ok, true, 'upload_route_must_return_ok');
    assert.equal(data.uri, 'mxc://localhost/0312-uploaded', 'upload_route_must_return_matrix_uri');
    const ownerUpdate = await state.submitEnvelope({
      event_id: Date.now(),
      type: 'ui_owner_label_update',
      payload: {
        action: 'ui_owner_label_update',
        meta: { op_id: `owner_update_${Date.now()}` },
        target: { model_id: 1031, p: 0, r: 0, c: 0, k: 'slide_import_media_uri' },
        value: { t: 'str', v: data.uri },
      },
      source: 'ui_renderer',
      ts: Date.now(),
    });
    assert.equal(ownerUpdate.result, 'ok', 'owner_label_update_must_succeed');
    assert.equal(ownerUpdate.routed_by, 'pin', 'owner_label_update_must_route_by_pin');
    assert.equal(
      state.clientSnap().models?.['1031']?.cells?.['0,0,0']?.labels?.slide_import_media_uri?.v,
      data.uri,
      'owner_label_update_must_write_media_uri',
    );

    const importClick = await state.submitEnvelope(pinEnvelope(
      { model_id: 1030, p: 2, r: 4, c: 0 },
      'click',
      slideImportClickPayload(),
    ));
    assert.equal(importClick.result, 'ok', 'cached_click_must_be_accepted');

    const snap = state.clientSnap();
    const importedStatus = snap.models?.['1031']?.cells?.['0,0,0']?.labels?.slide_import_status?.v;
    const importedName = snap.models?.['1031']?.cells?.['0,0,0']?.labels?.slide_import_last_app_name?.v;
    const registry = snap.models?.['-2']?.cells?.['0,0,0']?.labels?.ws_apps_registry?.v || [];
    assert.equal(importedStatus, 'imported: 0312 Cache Contract App', 'uploaded_uri_must_be_cache_primed_for_import');
    assert.equal(importedName, '0312 Cache Contract App', 'cached_import_must_record_last_app_name');
    assert.ok(registry.some((entry) => entry && entry.name === '0312 Cache Contract App'), 'cached_import_must_materialize_workspace_entry');

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
