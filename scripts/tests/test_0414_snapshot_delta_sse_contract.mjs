#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildBusEventV2 } from '../../packages/ui-model-demo-frontend/src/bus_event_v2.js';
import { createRemoteStore } from '../../packages/ui-model-demo-frontend/src/remote_store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const originalFetch = globalThis.fetch;
const originalEventSource = globalThis.EventSource;

function mt(k, t, v) {
  return { id: 0, p: 0, r: 0, c: 0, k, t, v };
}

function jsonResponse(body) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: () => 'application/json' },
    async json() { return body; },
    async text() { return JSON.stringify(body); },
  };
}

function snapshotWithBusEventLastOpId(opId) {
  return {
    models: {
      '-1': {
        id: -1,
        cells: {
          '0,0,1': {
            p: 0,
            r: 0,
            c: 1,
            labels: {
              bus_event_last_op_id: { k: 'bus_event_last_op_id', t: 'str', v: opId },
            },
          },
        },
      },
    },
    v1nConfig: {},
  };
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function signJwt(payload, { privateKey, kid, issuer, audience, nonce }) {
  const header = { alg: 'RS256', typ: 'JWT', kid };
  const now = Math.floor(Date.now() / 1000);
  const body = {
    iss: issuer,
    aud: audience,
    sub: '268746183297-drop',
    exp: now + 300,
    iat: now,
    nonce,
    email: 'drop.yang@dongyudigital.com',
    email_verified: true,
    name: 'drop',
    preferred_username: 'drop',
    'urn:zitadel:iam:org:project:375910753992966374:roles': {
      'dongyu.admin': { 'org:primary': 'Dongyu' },
    },
    ...payload,
  };
  const encoded = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(body))}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(encoded), privateKey);
  return `${encoded}.${base64url(signature)}`;
}

function createJsonServer(handler) {
  const server = http.createServer(async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: String(error && error.message ? error.message : error) }));
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function closeServer(server) {
  if (!server || !server.listening) return Promise.resolve();
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

function serverBaseUrl(server) {
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

function waitListening(server) {
  if (server.listening) return Promise.resolve();
  return new Promise((resolve) => server.once('listening', resolve));
}

async function importFreshServerModule() {
  const url = pathToFileURL(path.join(repoRoot, 'packages/ui-model-demo-server/server.mjs'));
  url.search = `t=${Date.now()}-${Math.random()}`;
  return import(url.href);
}

async function withServerEnv(extraEnv, fn) {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'dy-0414-snapshot-delta-'));
  const prior = {
    DY_AUTH: process.env.DY_AUTH,
    DY_PERSISTED_ASSET_ROOT: process.env.DY_PERSISTED_ASSET_ROOT,
    WORKER_BASE_WORKSPACE: process.env.WORKER_BASE_WORKSPACE,
    WORKER_BASE_DATA_ROOT: process.env.WORKER_BASE_DATA_ROOT,
    DOCS_ROOT: process.env.DOCS_ROOT,
    STATIC_PROJECTS_ROOT: process.env.STATIC_PROJECTS_ROOT,
    DY_UI_SERVER_WORKER_ID: process.env.DY_UI_SERVER_WORKER_ID,
  };
  process.env.DY_AUTH = extraEnv.DY_AUTH || '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0414_delta_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  process.env.WORKER_BASE_DATA_ROOT = path.join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = path.join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = path.join(tempRoot, 'static');
  process.env.DY_UI_SERVER_WORKER_ID = 'U1';
  for (const [key, value] of Object.entries(extraEnv || {})) {
    process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function readResponseJson(resp) {
  const text = await resp.text();
  return text ? JSON.parse(text) : {};
}

async function withAuthenticatedAppServer(fn) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = 'test-key';
  let issuer = '';
  let issuedNonce = '';
  const publicJwk = publicKey.export({ format: 'jwk' });
  publicJwk.kid = kid;
  publicJwk.alg = 'RS256';
  publicJwk.use = 'sig';

  const oidcServer = await createJsonServer(async (req, res) => {
    const url = new URL(req.url || '/', issuer);
    if (url.pathname === '/.well-known/openid-configuration') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        issuer,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        userinfo_endpoint: `${issuer}/userinfo`,
        jwks_uri: `${issuer}/keys`,
      }));
      return;
    }
    if (url.pathname === '/keys') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ keys: [publicJwk] }));
      return;
    }
    if (url.pathname === '/token') {
      const idToken = signJwt({}, {
        privateKey,
        kid,
        issuer,
        audience: 'dongyu-app',
        nonce: issuedNonce,
      });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        access_token: 'mock-access-token',
        token_type: 'Bearer',
        expires_in: 300,
        id_token: idToken,
      }));
      return;
    }
    if (url.pathname === '/userinfo') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        sub: '268746183297-drop',
        email: 'drop.yang@dongyudigital.com',
        name: 'drop',
        preferred_username: 'drop',
        'urn:zitadel:iam:org:project:375910753992966374:roles': {
          'dongyu.admin': { 'org:primary': 'Dongyu' },
        },
      }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  issuer = serverBaseUrl(oidcServer);

  let appServer = null;
  try {
    return await withServerEnv({
      DY_AUTH: '1',
      DY_OIDC_ISSUER: issuer,
      DY_OIDC_CLIENT_ID: 'dongyu-app',
      DY_OIDC_REDIRECT_URI: 'http://127.0.0.1:0/auth/sso/callback',
    }, async () => {
      const { startServer } = await importFreshServerModule();
      appServer = startServer({ port: 0, dbPath: null, skipFrontendBuild: true });
      await waitListening(appServer);
      const appBase = serverBaseUrl(appServer);
      const startResp = await fetch(`${appBase}/auth/sso/start?returnTo=%2F%23%2F`, { redirect: 'manual' });
      const authorizeUrl = new URL(startResp.headers.get('location'));
      issuedNonce = authorizeUrl.searchParams.get('nonce');
      const state = authorizeUrl.searchParams.get('state');
      const startCookie = startResp.headers.get('set-cookie') || '';
      const callbackResp = await fetch(`${appBase}/auth/sso/callback?code=valid-code&state=${encodeURIComponent(state)}`, {
        redirect: 'manual',
        headers: { cookie: startCookie },
      });
      assert.equal(callbackResp.status, 302, 'valid callback must create app-write session');
      const sessionCookie = callbackResp.headers.get('set-cookie') || '';
      assert.match(sessionCookie, /dy_session=/, 'valid callback must set dy_session');
      return fn({ appServer, appBase, sessionCookie });
    });
  } finally {
    await closeServer(appServer);
    await closeServer(oidcServer);
  }
}

function createSseReader(resp) {
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  return {
    async nextEvent(timeoutMs = 5000) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const idx = buffer.indexOf('\n\n');
        if (idx >= 0) {
          const block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const lines = block.split(/\n/u);
          const eventLine = lines.find((line) => line.startsWith('event: '));
          const dataLines = lines.filter((line) => line.startsWith('data: ')).map((line) => line.slice(6));
          if (!eventLine && dataLines.length === 0) continue;
          return {
            event: eventLine ? eventLine.slice(7).trim() : 'message',
            dataText: dataLines.join('\n'),
            data: dataLines.length > 0 ? JSON.parse(dataLines.join('\n')) : null,
          };
        }
        const remaining = Math.max(1, deadline - Date.now());
        const read = await Promise.race([
          reader.read(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('sse_event_timeout')), remaining)),
        ]);
        if (read.done) throw new Error('sse_stream_closed');
        buffer += decoder.decode(read.value, { stream: true });
      }
      throw new Error('sse_event_timeout');
    },
    async close() {
      try { await reader.cancel(); } catch (_) {}
    },
  };
}

async function waitFor(predicate, message, timeoutMs = 1000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail(message);
}

async function test_server_stream_emits_patch_after_initial_snapshot() {
  await withAuthenticatedAppServer(async ({ appBase, sessionCookie }) => {
    let sse = null;
    try {
      const modeResp = await fetch(`${appBase}/api/runtime/mode`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: sessionCookie },
        body: JSON.stringify({ mode: 'running' }),
      });
      assert.equal(modeResp.status, 200, 'runtime mode activation must succeed before stream test');
      const streamResp = await fetch(`${appBase}/stream?profile=full`, { headers: { cookie: sessionCookie } });
      assert.equal(streamResp.status, 200, 'stream must open');
      sse = createSseReader(streamResp);
      const initial = await sse.nextEvent();
      assert.equal(initial.event, 'snapshot', 'explicit full-profile initial stream event must remain full snapshot');
      assert.equal(Number.isInteger(initial.data?.snapshot_seq), true, 'full snapshot event must carry snapshot_seq');
      const fullFrameBytes = Buffer.byteLength(initial.dataText, 'utf8');
      const event = buildBusEventV2({
        busInKey: 'ui_submit',
        value: [mt('__mt_payload_kind', 'str', 'ui_event.v1')],
        opId: 'it0414_stream_patch',
        source: 'test',
      });
      const busResp = await fetch(`${appBase}/bus_event`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: sessionCookie },
        body: JSON.stringify(event),
      });
      assert.equal(busResp.status, 200, 'bus_event must succeed');
      const next = await sse.nextEvent();
      assert.equal(next.event, 'snapshot_patch', 'second stream event after small bus_event must be snapshot_patch, not full snapshot');
      assert.equal(Number.isInteger(next.data?.snapshot_patch?.snapshot_seq), true, 'patch must carry snapshot_seq');
      assert.equal(Number.isInteger(next.data?.snapshot_patch?.base_snapshot_seq), true, 'patch must carry base_snapshot_seq');
      assert.equal(next.data.snapshot_patch.op_id, 'it0414_stream_patch', 'patch must carry op_id');
      const patchFrameBytes = Buffer.byteLength(next.dataText, 'utf8');
      assert.ok(patchFrameBytes < fullFrameBytes, `small patch frame must be smaller than full snapshot (${patchFrameBytes} < ${fullFrameBytes})`);
    } finally {
      if (sse) await sse.close();
    }
  });
}

async function test_snapshot_patch_server_helpers_diff_and_principal_reset() {
  const serverModule = await importFreshServerModule();
  const { buildClientSnapshotForPrincipal, buildClientSnapshotPatchMessage } = serverModule;
  assert.equal(typeof buildClientSnapshotForPrincipal, 'function', 'server must expose filtered snapshot helper for patch contract tests');
  assert.equal(typeof buildClientSnapshotPatchMessage, 'function', 'server must expose snapshot patch message builder');

  const previous = {
    models: {
      '100': { id: 100, cells: { '0,0,0': { p: 0, r: 0, c: 0, labels: { title: { k: 'title', t: 'str', v: 'Before' } } } } },
    },
    v1nConfig: {},
  };
  const next = {
    models: {
      '100': { id: 100, cells: { '0,0,0': { p: 0, r: 0, c: 0, labels: { title: { k: 'title', t: 'str', v: 'After' } } } } },
    },
    v1nConfig: {},
  };
  const message = buildClientSnapshotPatchMessage({
    previousSnapshot: previous,
    nextSnapshot: next,
    baseSnapshotSeq: 7,
    snapshotSeq: 8,
    opId: 'it0414_helper_patch',
    previousPrincipalKey: 'guest',
    currentPrincipalKey: 'guest',
  });
  assert.equal(message.event, 'snapshot_patch', 'same-principal small label change must produce patch');
  assert.deepEqual(
    message.data.snapshot_patch.ops,
    [
      {
        op: 'replace_label',
        model_id: 100,
        cell_key: '0,0,0',
        label_key: 'title',
        value: { k: 'title', t: 'str', v: 'After' },
      },
    ],
    'server helper must create the expected minimal label patch',
  );

  const rawSamePrincipalPrevious = {
    models: {
      '100': next.models['100'],
    },
    v1nConfig: {},
  };
  const rawAdminOnly = {
    models: {
      '-10': {
        id: -10,
        cells: {
          '0,0,0': {
            p: 0,
            r: 0,
            c: 0,
            labels: {
              matrix_token: { k: 'matrix_token', t: 'matrix.token', v: 'syt_secret_should_not_leak' },
              source: { k: 'source', t: 'func.js', v: 'return "secret";' },
            },
          },
        },
      },
      '100': previous.models['100'],
    },
    v1nConfig: {},
  };
  const principalCases = [
    { name: 'guest', principal: null, key: 'guest' },
    { name: 'viewer', principal: { capabilities: ['app:write'] }, key: 'viewer:app:write' },
    { name: 'admin', principal: { capabilities: ['app:write', 'matrix:connect', 'management_bus:use', 'slide_app:use'] }, key: 'admin:all' },
  ];
  for (const principalCase of principalCases) {
    const samePrincipalPrevious = buildClientSnapshotForPrincipal(rawSamePrincipalPrevious, principalCase.principal);
    const samePrincipalNext = buildClientSnapshotForPrincipal(rawAdminOnly, principalCase.principal);
    const samePrincipalMessage = buildClientSnapshotPatchMessage({
      previousSnapshot: samePrincipalPrevious,
      nextSnapshot: samePrincipalNext,
      baseSnapshotSeq: 11,
      snapshotSeq: 12,
      opId: `it0414_same_principal_redaction_${principalCase.name}`,
      previousPrincipalKey: principalCase.key,
      currentPrincipalKey: principalCase.key,
    });
    assert.equal(samePrincipalMessage.event, 'snapshot_patch', `${principalCase.name} same-principal filtered visible change must produce patch`);
    const samePrincipalPatchText = JSON.stringify(samePrincipalMessage.data);
    assert.equal(samePrincipalPatchText.includes('-10'), false, `${principalCase.name} same-principal patch must not expose restricted model id`);
    assert.equal(samePrincipalPatchText.includes('matrix_token'), false, `${principalCase.name} same-principal patch must not expose restricted key`);
    assert.equal(samePrincipalPatchText.includes('matrix.token'), false, `${principalCase.name} same-principal patch must not expose restricted type`);
    assert.equal(samePrincipalPatchText.includes('syt_secret_should_not_leak'), false, `${principalCase.name} same-principal patch must not expose token-like value`);
    assert.equal(samePrincipalPatchText.includes('func.js'), false, `${principalCase.name} same-principal patch must not expose function code labels`);
  }

  const guestFiltered = buildClientSnapshotForPrincipal(rawAdminOnly, null);
  const resetMessage = buildClientSnapshotPatchMessage({
    previousSnapshot: rawAdminOnly,
    nextSnapshot: guestFiltered,
    baseSnapshotSeq: 3,
    snapshotSeq: 4,
    opId: 'it0414_principal_reset',
    previousPrincipalKey: 'admin:app:write|matrix:connect',
    currentPrincipalKey: 'guest',
  });
  assert.equal(resetMessage.event, 'snapshot', 'principal/capability key change must full-reset, not cross-principal patch');
  const resetText = JSON.stringify(resetMessage.data);
  assert.equal(resetText.includes('matrix_token'), false, 'reset payload must not expose restricted key');
  assert.equal(resetText.includes('matrix.token'), false, 'reset payload must not expose restricted type');
  assert.equal(resetText.includes('syt_secret_should_not_leak'), false, 'reset payload must not expose token-like value');
  assert.equal(resetText.includes('func.js'), false, 'reset payload must not expose function code labels');
}

async function test_snapshot_patch_client_apply_helper_matches_full_snapshot() {
  const serverModule = await importFreshServerModule();
  const { buildClientSnapshotPatchMessage } = serverModule;
  const remoteStoreModule = await import(pathToFileURL(path.join(repoRoot, 'packages/ui-model-demo-frontend/src/remote_store.js')).href);
  const { applyClientSnapshotPatch } = remoteStoreModule;
  assert.equal(typeof applyClientSnapshotPatch, 'function', 'remote store must expose patch apply helper');
  const previous = {
    models: {
      '100': { id: 100, cells: { '0,0,0': { p: 0, r: 0, c: 0, labels: { title: { k: 'title', t: 'str', v: 'Before' } } } } },
    },
    v1nConfig: {},
  };
  const next = {
    models: {
      '100': { id: 100, cells: { '0,0,0': { p: 0, r: 0, c: 0, labels: { title: { k: 'title', t: 'str', v: 'After' } } } } },
    },
    v1nConfig: {},
  };
  const message = buildClientSnapshotPatchMessage({
    previousSnapshot: previous,
    nextSnapshot: next,
    baseSnapshotSeq: 7,
    snapshotSeq: 8,
    opId: 'it0414_client_apply',
    previousPrincipalKey: 'guest',
    currentPrincipalKey: 'guest',
  });
  assert.equal(message.event, 'snapshot_patch');
  assert.deepEqual(applyClientSnapshotPatch(previous, message.data.snapshot_patch), next, 'patch apply must match full next snapshot');

  const deleteBase = {
    models: {
      '100': {
        id: 100,
        cells: {
          '0,0,0': {
            p: 0,
            r: 0,
            c: 0,
            labels: {
              title: { k: 'title', t: 'str', v: 'Before' },
              status: { k: 'status', t: 'str', v: 'open' },
            },
          },
          '0,1,0': {
            p: 0,
            r: 1,
            c: 0,
            labels: { archived: { k: 'archived', t: 'bool', v: true } },
          },
        },
      },
      '101': { id: 101, cells: { '0,0,0': { p: 0, r: 0, c: 0, labels: { title: { k: 'title', t: 'str', v: 'Remove model' } } } } },
    },
    v1nConfig: { local_mqtt: { host: 'before' } },
  };
  const deletePatch = {
    patch_kind: 'json_replace_v1',
    snapshot_seq: 9,
    base_snapshot_seq: 8,
    op_id: 'it0414_delete_ops',
    ops: [
      { op: 'delete_label', model_id: 100, cell_key: '0,0,0', label_key: 'status' },
      { op: 'delete_cell', model_id: 100, cell_key: '0,1,0' },
      { op: 'delete_model', model_id: 101 },
      { op: 'replace_v1n_config', value: { local_mqtt: { host: 'after' } } },
    ],
  };
  const deleteNext = applyClientSnapshotPatch(deleteBase, deletePatch);
  assert.equal(deleteNext.models['100'].cells['0,0,0'].labels.status, undefined, 'delete_label must remove label');
  assert.equal(deleteNext.models['100'].cells['0,1,0'], undefined, 'delete_cell must remove cell');
  assert.equal(deleteNext.models['101'], undefined, 'delete_model must remove model');
  assert.deepEqual(deleteNext.v1nConfig, { local_mqtt: { host: 'after' } }, 'replace_v1n_config must replace v1nConfig');
  assert.equal(deleteBase.models['101'].id, 101, 'patch apply must not mutate base snapshot');
}

async function test_remote_store_patch_op_id_alone_does_not_cancel_fallback() {
  let patchListener = null;
  let snapshotFetchCount = 0;
  globalThis.EventSource = class FakeEventSource {
    constructor() {
      this.readyState = 1;
    }
    addEventListener(type, listener) {
      if (type === 'snapshot_patch') patchListener = listener;
    }
    close() {}
  };
  globalThis.fetch = async (url) => {
    const href = String(url);
    if (href.endsWith('/snapshot') || href.endsWith('/snapshot?profile=bootstrap')) {
      snapshotFetchCount += 1;
      return jsonResponse({ snapshot: { models: {}, v1nConfig: {} }, snapshot_seq: 1 });
    }
    if (href.endsWith('/bus_event')) {
      assert.equal(typeof patchListener, 'function', 'test setup must install snapshot_patch listener before bus_event');
      patchListener({
        data: JSON.stringify({
          snapshot_patch: {
            patch_kind: 'json_replace_v1',
            snapshot_seq: 2,
            base_snapshot_seq: 1,
            op_id: 'it0414_op_id_only',
            ops: [],
          },
        }),
      });
      return jsonResponse({
        ok: true,
        consumed: true,
        result: 'ok',
        bus_event_last_op_id: 'it0414_op_id_only',
        timing: { op_id: 'it0414_op_id_only' },
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  try {
    const store = createRemoteStore({
      baseUrl: 'http://127.0.0.1:30900',
      snapshotFallbackDelayMs: 1,
    });
    await waitFor(
      () => typeof patchListener === 'function',
      'remote store must register snapshot_patch listener before bus_event dispatch',
    );
    snapshotFetchCount = 0;
    await store.dispatchAddLabel({
      p: 0,
      r: 0,
      c: 0,
      k: 'bus_in_event',
      t: 'event',
      v: buildBusEventV2({
        busInKey: 'todo_event',
        value: [mt('__mt_payload_kind', 'str', 'ui_event.v1')],
        opId: 'it0414_op_id_only',
      }),
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(snapshotFetchCount, 1, 'patch envelope op_id alone must not cancel deferred fallback');
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
  }
}

async function test_remote_store_matching_patch_cancels_fallback() {
  let patchListener = null;
  let snapshotFetchCount = 0;
  globalThis.EventSource = class FakeEventSource {
    constructor() {
      this.readyState = 1;
    }
    addEventListener(type, listener) {
      if (type === 'snapshot_patch') patchListener = listener;
    }
    close() {}
  };
  globalThis.fetch = async (url) => {
    const href = String(url);
    if (href.endsWith('/snapshot') || href.endsWith('/snapshot?profile=bootstrap')) {
      snapshotFetchCount += 1;
      return jsonResponse({ snapshot: { models: {}, v1nConfig: {} }, snapshot_seq: 1 });
    }
    if (href.endsWith('/bus_event')) {
      assert.equal(typeof patchListener, 'function', 'test setup must install snapshot_patch listener before bus_event');
      patchListener({
        data: JSON.stringify({
          snapshot_patch: {
            patch_kind: 'json_replace_v1',
            snapshot_seq: 2,
            base_snapshot_seq: 1,
            op_id: 'it0414_matching_patch',
            ops: [
              {
                op: 'replace_label',
                model_id: -1,
                cell_key: '0,0,1',
                label_key: 'bus_event_last_op_id',
                value: { k: 'bus_event_last_op_id', t: 'str', v: 'it0414_matching_patch' },
              },
            ],
          },
        }),
      });
      return jsonResponse({
        ok: true,
        consumed: true,
        result: 'ok',
        bus_event_last_op_id: 'it0414_matching_patch',
        timing: { op_id: 'it0414_matching_patch' },
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  try {
    const store = createRemoteStore({
      baseUrl: 'http://127.0.0.1:30900',
      snapshotFallbackDelayMs: 1,
    });
    await waitFor(
      () => typeof patchListener === 'function',
      'remote store must register snapshot_patch listener before bus_event dispatch',
    );
    snapshotFetchCount = 0;
    await store.dispatchAddLabel({
      p: 0,
      r: 0,
      c: 0,
      k: 'bus_in_event',
      t: 'event',
      v: buildBusEventV2({
        busInKey: 'todo_event',
        value: [mt('__mt_payload_kind', 'str', 'ui_event.v1')],
        opId: 'it0414_matching_patch',
      }),
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(snapshotFetchCount, 0, 'patch that updates visible bus_event_last_op_id must cancel deferred fallback');
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
  }
}

async function test_remote_store_invalid_patch_seq_recovers_bootstrap_snapshot() {
  let patchListener = null;
  let snapshotFetchCount = 0;
  let currentOpId = '';
  const badPatches = [
    {
      name: 'missing_snapshot_seq',
      patch: {
        patch_kind: 'json_replace_v1',
        base_snapshot_seq: 1,
        op_id: 'it0414_missing_snapshot_seq',
        ops: [],
      },
    },
    {
      name: 'missing_base_snapshot_seq',
      patch: {
        patch_kind: 'json_replace_v1',
        snapshot_seq: 3,
        op_id: 'it0414_missing_base_seq',
        ops: [],
      },
    },
    {
      name: 'non_integer_base_snapshot_seq',
      patch: {
        patch_kind: 'json_replace_v1',
        snapshot_seq: 4,
        base_snapshot_seq: '1',
        op_id: 'it0414_bad_base_seq',
        ops: [],
      },
    },
    {
      name: 'mismatched_base_snapshot_seq',
      patch: {
        patch_kind: 'json_replace_v1',
        snapshot_seq: 5,
        base_snapshot_seq: 999,
        op_id: 'it0414_base_mismatch',
        ops: [],
      },
    },
  ];
  const originalWarn = console.warn;
  globalThis.EventSource = class FakeEventSource {
    constructor() {
      this.readyState = 1;
    }
    addEventListener(type, listener) {
      if (type === 'snapshot_patch') patchListener = listener;
    }
    close() {}
  };
  globalThis.fetch = async (url) => {
    const href = String(url);
    if (href.endsWith('/snapshot') || href.endsWith('/snapshot?profile=bootstrap')) {
      snapshotFetchCount += 1;
      return jsonResponse({ snapshot: snapshotWithBusEventLastOpId(currentOpId), snapshot_seq: 1 });
    }
    if (href.endsWith('/bus_event')) {
      const badPatch = badPatches.shift();
      assert.ok(badPatch, 'test must provide a bad patch for each bus_event call');
      currentOpId = badPatch.patch.op_id;
      patchListener({
        data: JSON.stringify({ snapshot_patch: badPatch.patch }),
      });
      return jsonResponse({
        ok: true,
        consumed: true,
        result: 'ok',
        bus_event_last_op_id: currentOpId,
        timing: { op_id: currentOpId },
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  try {
    console.warn = () => {};
    const store = createRemoteStore({
      baseUrl: 'http://127.0.0.1:30900',
      snapshotFallbackDelayMs: 1000,
    });
    await waitFor(
      () => typeof patchListener === 'function',
      'remote store must register snapshot_patch listener before mismatch test',
    );
    snapshotFetchCount = 0;
    for (const expectedFetchCount of [1, 2, 3, 4]) {
      await store.dispatchAddLabel({
        p: 0,
        r: 0,
        c: 0,
        k: 'bus_in_event',
        t: 'event',
        v: buildBusEventV2({
          busInKey: 'todo_event',
          value: [mt('__mt_payload_kind', 'str', 'ui_event.v1')],
          opId: badPatches[0]?.patch?.op_id || currentOpId || 'it0414_bad_patch_seq',
        }),
      });
      await new Promise((resolve) => setTimeout(resolve, 10));
      assert.equal(snapshotFetchCount, expectedFetchCount, 'invalid or mismatched patch seq must fetch bootstrap snapshot for recovery');
    }
  } finally {
    console.warn = originalWarn;
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
  }
}

async function test_remote_store_paused_patch_does_not_update_visible_state_or_cancel_fallback() {
  let patchListener = null;
  let snapshotFetchCount = 0;
  globalThis.EventSource = class FakeEventSource {
    constructor() {
      this.readyState = 1;
    }
    addEventListener(type, listener) {
      if (type === 'snapshot_patch') patchListener = listener;
    }
    close() {}
  };
  globalThis.fetch = async (url) => {
    const href = String(url);
    if (href.endsWith('/snapshot') || href.endsWith('/snapshot?profile=bootstrap')) {
      snapshotFetchCount += 1;
      return jsonResponse({
        snapshot: {
          models: {
            '-2': {
              id: -2,
              cells: {
                '0,0,0': {
                  p: 0,
                  r: 0,
                  c: 0,
                  labels: { dt_pause_sse: { k: 'dt_pause_sse', t: 'bool', v: true } },
                },
              },
            },
          },
          v1nConfig: {},
        },
        snapshot_seq: 1,
      });
    }
    if (href.endsWith('/bus_event')) {
      patchListener({
        data: JSON.stringify({
          snapshot_patch: {
            patch_kind: 'json_replace_v1',
            snapshot_seq: 2,
            base_snapshot_seq: 1,
            op_id: 'it0414_paused_patch',
            ops: [
              {
                op: 'replace_label',
                model_id: -1,
                cell_key: '0,0,1',
                label_key: 'bus_event_last_op_id',
                value: { k: 'bus_event_last_op_id', t: 'str', v: 'it0414_paused_patch' },
              },
            ],
          },
        }),
      });
      return jsonResponse({
        ok: true,
        consumed: true,
        result: 'ok',
        bus_event_last_op_id: 'it0414_paused_patch',
        timing: { op_id: 'it0414_paused_patch' },
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  try {
    const store = createRemoteStore({
      baseUrl: 'http://127.0.0.1:30900',
      snapshotFallbackDelayMs: 1,
    });
    await waitFor(
      () => typeof patchListener === 'function',
      'remote store must register snapshot_patch listener before pause test',
    );
    snapshotFetchCount = 0;
    await store.dispatchAddLabel({
      p: 0,
      r: 0,
      c: 0,
      k: 'bus_in_event',
      t: 'event',
      v: buildBusEventV2({
        busInKey: 'todo_event',
        value: [mt('__mt_payload_kind', 'str', 'ui_event.v1')],
        opId: 'it0414_paused_patch',
      }),
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(snapshotFetchCount, 1, 'paused patch must not apply visible bus_event_last_op_id or cancel fallback');
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
  }
}

const serverOnlyTests = [
  test_server_stream_emits_patch_after_initial_snapshot,
  test_snapshot_patch_server_helpers_diff_and_principal_reset,
];

const tests = process.argv.includes('--server-only') ? serverOnlyTests : [
  ...serverOnlyTests,
  test_snapshot_patch_client_apply_helper_matches_full_snapshot,
  test_remote_store_patch_op_id_alone_does_not_cancel_fallback,
  test_remote_store_matching_patch_cancels_fallback,
  test_remote_store_invalid_patch_seq_recovers_bootstrap_snapshot,
  test_remote_store_paused_patch_does_not_update_visible_state_or_cancel_fallback,
];

let failed = 0;
for (const test of tests) {
  try {
    await test();
    console.log(`[PASS] ${test.name}`);
  } catch (err) {
    failed += 1;
    console.error(`[FAIL] ${test.name}: ${err.message}`);
  }
}

if (failed > 0) {
  console.error(`\nFAIL test_0414_snapshot_delta_sse_contract: ${failed} failed`);
  process.exit(1);
}

console.log(`\nPASS test_0414_snapshot_delta_sse_contract: ${tests.length} passed`);
