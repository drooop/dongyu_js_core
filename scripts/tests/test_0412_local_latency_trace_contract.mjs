#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs, { mkdtempSync, rmSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { buildBusEventV2 } from '../../packages/ui-model-demo-frontend/src/bus_event_v2.js';
import { createRemoteStore } from '../../packages/ui-model-demo-frontend/src/remote_store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const require = createRequire(import.meta.url);
const { createRenderer: createCjsRenderer } = require(path.join(repoRoot, 'packages/ui-renderer/src/index.js'));

const originalFetch = globalThis.fetch;
const originalEventSource = globalThis.EventSource;

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

function createSlowMatrixServer() {
  return createJsonServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (url.pathname.includes('/sync')) {
      return;
    }
    if (url.pathname.endsWith('/account/whoami')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ user_id: '@it0412:local' }));
      return;
    }
    if (url.pathname.includes('/join/')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ room_id: '!it0412:local' }));
      return;
    }
    if (url.pathname.endsWith('/versions')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ versions: ['v1.1'], unstable_features: {} }));
      return;
    }
    if (url.pathname.endsWith('/capabilities')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ capabilities: {} }));
      return;
    }
    if (url.pathname.endsWith('/pushrules/')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ global: { override: [], content: [], room: [], sender: [], underride: [] } }));
      return;
    }
    if (url.pathname.endsWith('/filter')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ filter_id: 'it0412-filter' }));
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({}));
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

function closeServer(server) {
  if (!server || !server.listening) return Promise.resolve();
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

async function readResponseJson(resp) {
  const text = await resp.text();
  return text ? JSON.parse(text) : {};
}

async function withEnv(env, fn) {
  const prior = {};
  for (const key of Object.keys(env)) {
    prior[key] = process.env[key];
    process.env[key] = env[key];
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function importFreshServerModule() {
  const url = pathToFileURL(path.join(repoRoot, 'packages/ui-model-demo-server/server.mjs'));
  url.search = `t=${Date.now()}-${Math.random()}`;
  return import(url.href);
}

function assertIncludes(haystack, needle, message) {
  assert.ok(String(haystack).includes(needle), message);
}

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

function fakeH(type, props, children) {
  let normalized = children;
  if (children && typeof children === 'object' && typeof children.default === 'function') {
    normalized = children.default();
  }
  return { type, props: props || {}, children: normalized };
}

function fakeResolve(name) {
  return name;
}

function flattenText(node) {
  if (node === null || node === undefined) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join('');
  if (typeof node === 'object') return flattenText(node.children);
  return '';
}

function walk(node, visitor) {
  if (!node) return;
  visitor(node);
  const children = Array.isArray(node.children) ? node.children : [node.children];
  for (const child of children) {
    if (child && typeof child === 'object') walk(child, visitor);
  }
}

function findButtonByText(root, text) {
  let found = null;
  walk(root, (node) => {
    if (found) return;
    if ((node.type === 'button' || node.type === 'ElButton') && flattenText(node).includes(text)) found = node;
  });
  return found;
}

function test_local_env_example_uses_remote_sso_client() {
  const source = fs.readFileSync(path.join(repoRoot, 'deploy/env/local.env.example'), 'utf8');
  assertIncludes(source, 'DY_AUTH=1', 'local env example must enable SSO for this latency trace target');
  assertIncludes(source, 'DY_OIDC_ISSUER=https://sso.dongyudigital.com', 'local env example must point to remote SSO issuer');
  assertIncludes(source, 'DY_OIDC_CLIENT_ID=375920990745592038', 'local env example must use the requested local OIDC client id');
  assertIncludes(source, 'DY_OIDC_REDIRECT_URI=http://localhost:30900/auth/sso/callback', 'local callback must match the registered local ZITADEL redirect URI');
  return { key: 'local_env_example_uses_remote_sso_client', status: 'PASS' };
}

function test_build_bus_event_v2_includes_client_dispatch_timing() {
  const event = buildBusEventV2({
    busInKey: 'todo_event',
    value: [mt('__mt_payload_kind', 'str', 'ui_event.v1')],
    opId: 'it0412_timing_helper',
    source: 'test',
  });
  assert.equal(event.type, 'bus_event_v2');
  assert.equal(event.meta.op_id, 'it0412_timing_helper');
  assert.equal(event.meta.source, 'test');
  assert.equal(Number.isFinite(event.meta.client_dispatch_ts), true, 'helper must stamp client dispatch wall-clock time');
  assert.equal(Number.isFinite(event.meta.client_dispatch_perf_ms), true, 'helper must stamp client dispatch monotonic time');
  return { key: 'build_bus_event_v2_includes_client_dispatch_timing', status: 'PASS' };
}

function test_renderer_bus_event_v2_includes_client_dispatch_timing() {
  const calls = [];
  const host = {
    getSnapshot: () => ({ models: {} }),
    dispatchAddLabel: (label) => calls.push(label),
    dispatchRmLabel: () => {},
  };
  const renderer = createCjsRenderer({ host, vue: { h: fakeH, resolveComponent: fakeResolve } });
  const vnode = renderer.renderVNode({
    id: 'trace_button',
    type: 'Button',
    props: { label: 'Trace Submit' },
    bind: {
      write: {
        bus_event_v2: true,
        bus_in_key: 'todo_event',
        value_ref: [mt('__mt_payload_kind', 'str', 'ui_event.v1')],
      },
    },
  });
  findButtonByText(vnode, 'Trace Submit').props.onClick();
  const envelope = calls.at(-1)?.v;
  assert.equal(envelope?.type, 'bus_event_v2');
  assert.equal(Number.isFinite(envelope.meta.client_dispatch_ts), true, 'renderer dispatch must carry client wall-clock timing');
  assert.equal(Number.isFinite(envelope.meta.client_dispatch_perf_ms), true, 'renderer dispatch must carry client monotonic timing');
  return { key: 'renderer_bus_event_v2_includes_client_dispatch_timing', status: 'PASS' };
}

async function test_esm_renderer_bus_event_v2_includes_client_dispatch_timing() {
  const { createRenderer } = await import(pathToFileURL(path.join(repoRoot, 'packages/ui-renderer/src/renderer.mjs')).href);
  const calls = [];
  const host = {
    getSnapshot: () => ({ models: {} }),
    dispatchAddLabel: (label) => calls.push(label),
    dispatchRmLabel: () => {},
  };
  const renderer = createRenderer({ host, vue: { h: fakeH, resolveComponent: fakeResolve } });
  const vnode = renderer.renderVNode({
    id: 'trace_button_esm',
    type: 'Button',
    props: { label: 'Trace Submit ESM' },
    bind: {
      write: {
        bus_event_v2: true,
        bus_in_key: 'todo_event',
        value_ref: [mt('__mt_payload_kind', 'str', 'ui_event.v1')],
      },
    },
  });
  findButtonByText(vnode, 'Trace Submit ESM').props.onClick();
  const envelope = calls.at(-1)?.v;
  assert.equal(envelope?.type, 'bus_event_v2');
  assert.equal(Number.isFinite(envelope.meta.client_dispatch_ts), true, 'ESM renderer dispatch must carry client wall-clock timing');
  assert.equal(Number.isFinite(envelope.meta.client_dispatch_perf_ms), true, 'ESM renderer dispatch must carry client monotonic timing');
  return { key: 'esm_renderer_bus_event_v2_includes_client_dispatch_timing', status: 'PASS' };
}

async function test_remote_store_returns_client_augmented_timing() {
  const calls = [];
  globalThis.EventSource = class FakeEventSource {
    addEventListener() {}
    close() {}
  };
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), body: options.body ? JSON.parse(options.body) : null });
    if (String(url).endsWith('/bus_event')) {
      return jsonResponse({
        ok: true,
        consumed: true,
        result: 'ok',
        timing: {
          op_id: 'it0412_remote_store',
          client_dispatch_ts: 100,
          server_received_at: 200,
          server_completed_at: 260,
          server_duration_ms: 60,
        },
      });
    }
    if (String(url).endsWith('/snapshot')) return jsonResponse({ snapshot: { models: {}, v1nConfig: {} } });
    throw new Error(`unexpected fetch ${url}`);
  };
  try {
    const store = createRemoteStore({ baseUrl: 'http://127.0.0.1:30900', autoBootstrap: false });
    const data = await store.dispatchAddLabel({
      p: 0,
      r: 0,
      c: 0,
      k: 'bus_in_event',
      t: 'event',
      v: buildBusEventV2({
        busInKey: 'todo_event',
        value: [mt('__mt_payload_kind', 'str', 'ui_event.v1')],
        opId: 'it0412_remote_store',
      }),
    });
    assert.equal(calls.some((call) => call.url.endsWith('/bus_event')), true, 'remote store must use formal /bus_event endpoint');
    assert.equal(data?.timing?.op_id, 'it0412_remote_store');
    assert.equal(Number.isFinite(data.timing.client_post_started_at), true, 'remote store must stamp fetch start time');
    assert.equal(Number.isFinite(data.timing.client_response_received_at), true, 'remote store must stamp response receipt time');
    assert.equal(Number.isFinite(data.timing.client_roundtrip_ms), true, 'remote store must compute client roundtrip duration');
    assert.equal(
      calls.some((call) => call.url.endsWith('/snapshot')),
      false,
      'successful bus_event_v2 response must not synchronously fetch full snapshot; SSE/deferred fallback should carry the update',
    );
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
  }
  return { key: 'remote_store_returns_client_augmented_timing', status: 'PASS' };
}

function snapshotWithBusEventLastOpId(opId) {
  return {
    models: {
      '-1': {
        cells: {
          '0,0,1': {
            labels: {
              bus_event_last_op_id: {
                k: 'bus_event_last_op_id',
                t: 'str',
                v: opId,
              },
            },
          },
        },
      },
    },
    v1nConfig: {},
  };
}

async function test_remote_store_keeps_deferred_snapshot_for_stale_sse_during_post() {
  let snapshotListener = null;
  let snapshotFetchCount = 0;
  globalThis.EventSource = class FakeEventSource {
    constructor() {
      this.readyState = 1;
    }
    addEventListener(type, listener) {
      if (type === 'snapshot') snapshotListener = listener;
    }
    close() {}
  };
  globalThis.fetch = async (url) => {
    const href = String(url);
    if (href.endsWith('/snapshot') || href.endsWith('/snapshot?profile=bootstrap')) {
      snapshotFetchCount += 1;
      return jsonResponse({ snapshot: { models: {}, v1nConfig: {} } });
    }
    if (href.endsWith('/bus_event')) {
      assert.equal(typeof snapshotListener, 'function', 'test setup must install SSE snapshot listener before bus_event');
      snapshotListener({
        data: JSON.stringify({ snapshot: snapshotWithBusEventLastOpId('unrelated_previous_op') }),
      });
      return jsonResponse({
        ok: true,
        consumed: true,
        result: 'ok',
        bus_event_last_op_id: 'it0412_remote_store_stale_sse',
        timing: {
          op_id: 'it0412_remote_store_stale_sse',
          server_received_at: 200,
          server_completed_at: 260,
        },
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  try {
    const store = createRemoteStore({
      baseUrl: 'http://127.0.0.1:30900',
      snapshotFallbackDelayMs: 1,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
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
        opId: 'it0412_remote_store_stale_sse',
      }),
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(
      snapshotFetchCount,
      1,
      'stale or unrelated SSE snapshot must not cancel the deferred bootstrap snapshot fallback',
    );
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
  }
  return { key: 'remote_store_keeps_deferred_snapshot_for_stale_sse_during_post', status: 'PASS' };
}

async function test_remote_store_skips_deferred_snapshot_when_matching_sse_arrives_during_post() {
  let snapshotListener = null;
  let snapshotFetchCount = 0;
  globalThis.EventSource = class FakeEventSource {
    constructor() {
      this.readyState = 1;
    }
    addEventListener(type, listener) {
      if (type === 'snapshot') snapshotListener = listener;
    }
    close() {}
  };
  globalThis.fetch = async (url) => {
    const href = String(url);
    if (href.endsWith('/snapshot') || href.endsWith('/snapshot?profile=bootstrap')) {
      snapshotFetchCount += 1;
      return jsonResponse({ snapshot: { models: {}, v1nConfig: {} } });
    }
    if (href.endsWith('/bus_event')) {
      assert.equal(typeof snapshotListener, 'function', 'test setup must install SSE snapshot listener before bus_event');
      snapshotListener({
        data: JSON.stringify({ snapshot: snapshotWithBusEventLastOpId('it0412_remote_store_sse_before_response') }),
      });
      return jsonResponse({
        ok: true,
        consumed: true,
        result: 'ok',
        bus_event_last_op_id: 'it0412_remote_store_sse_before_response',
        timing: {
          op_id: 'it0412_remote_store_sse_before_response',
          server_received_at: 200,
          server_completed_at: 260,
        },
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  try {
    const store = createRemoteStore({
      baseUrl: 'http://127.0.0.1:30900',
      snapshotFallbackDelayMs: 1,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
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
        opId: 'it0412_remote_store_sse_before_response',
      }),
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(
      snapshotFetchCount,
      0,
      'matching SSE snapshot applied during the POST should cancel the deferred bootstrap snapshot fallback',
    );
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
  }
  return { key: 'remote_store_skips_deferred_snapshot_when_matching_sse_arrives_during_post', status: 'PASS' };
}

async function test_server_submit_envelope_returns_timing() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'dy-0412-local-trace-'));
  const priorEnv = {
    DY_AUTH: process.env.DY_AUTH,
    DY_PERSISTED_ASSET_ROOT: process.env.DY_PERSISTED_ASSET_ROOT,
    WORKER_BASE_WORKSPACE: process.env.WORKER_BASE_WORKSPACE,
    WORKER_BASE_DATA_ROOT: process.env.WORKER_BASE_DATA_ROOT,
    DOCS_ROOT: process.env.DOCS_ROOT,
    STATIC_PROJECTS_ROOT: process.env.STATIC_PROJECTS_ROOT,
    DY_UI_SERVER_WORKER_ID: process.env.DY_UI_SERVER_WORKER_ID,
  };
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0412_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = path.join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = path.join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = path.join(tempRoot, 'static');
  process.env.DY_UI_SERVER_WORKER_ID = 'U1';
  try {
    const { createServerState } = await importFreshServerModule();
    const state = createServerState({ dbPath: null });
    await state.activateRuntimeMode('running');
    const envelope = buildBusEventV2({
      busInKey: 'ui_submit',
      value: [mt('__mt_payload_kind', 'str', 'ui_event.v1')],
      opId: 'it0412_server_timing',
      source: 'test',
    });
    const result = await state.submitEnvelope(envelope);
    assert.equal(result.result, 'ok');
    assert.equal(result.routed_by, 'model0_busin');
    assert.equal(result.timing?.op_id, 'it0412_server_timing');
    assert.equal(result.timing?.client_dispatch_ts, envelope.meta.client_dispatch_ts);
    assert.equal(Number.isFinite(result.timing.server_received_at), true, 'server must stamp receive time');
    assert.equal(Number.isFinite(result.timing.server_completed_at), true, 'server must stamp completion time');
    assert.equal(Number.isFinite(result.timing.server_duration_ms), true, 'server must report duration');
  } finally {
    for (const [key, value] of Object.entries(priorEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(tempRoot, { recursive: true, force: true });
  }
  return { key: 'server_submit_envelope_returns_timing', status: 'PASS' };
}

async function test_bus_event_http_route_returns_timing_with_authenticated_session() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'dy-0412-http-route-'));
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
  const priorEnv = {
    DY_AUTH: process.env.DY_AUTH,
    DY_OIDC_ISSUER: process.env.DY_OIDC_ISSUER,
    DY_OIDC_CLIENT_ID: process.env.DY_OIDC_CLIENT_ID,
    DY_OIDC_REDIRECT_URI: process.env.DY_OIDC_REDIRECT_URI,
    DY_PERSISTED_ASSET_ROOT: process.env.DY_PERSISTED_ASSET_ROOT,
    WORKER_BASE_WORKSPACE: process.env.WORKER_BASE_WORKSPACE,
    WORKER_BASE_DATA_ROOT: process.env.WORKER_BASE_DATA_ROOT,
    DOCS_ROOT: process.env.DOCS_ROOT,
    STATIC_PROJECTS_ROOT: process.env.STATIC_PROJECTS_ROOT,
    DY_UI_SERVER_WORKER_ID: process.env.DY_UI_SERVER_WORKER_ID,
  };
  try {
    await withEnv({
      DY_AUTH: '1',
      DY_OIDC_ISSUER: issuer,
      DY_OIDC_CLIENT_ID: 'dongyu-app',
      DY_OIDC_REDIRECT_URI: 'http://127.0.0.1:0/auth/sso/callback',
      DY_PERSISTED_ASSET_ROOT: '',
      WORKER_BASE_WORKSPACE: `it0412_http_${Date.now()}`,
      WORKER_BASE_DATA_ROOT: path.join(tempRoot, 'runtime'),
      DOCS_ROOT: path.join(tempRoot, 'docs'),
      STATIC_PROJECTS_ROOT: path.join(tempRoot, 'static'),
      DY_UI_SERVER_WORKER_ID: 'U1',
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

      const modeResp = await fetch(`${appBase}/api/runtime/mode`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: sessionCookie,
        },
        body: JSON.stringify({ mode: 'running' }),
      });
      const modeBody = await readResponseJson(modeResp);
      assert.equal(modeResp.status, 200, 'authenticated route test must activate running mode before bus_event');
      assert.equal(modeBody.ok, true);

      const envelope = buildBusEventV2({
        busInKey: 'ui_submit',
        value: [mt('__mt_payload_kind', 'str', 'ui_event.v1')],
        opId: 'it0412_http_route_timing',
        source: 'test',
      });
      const resp = await fetch(`${appBase}/bus_event`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: sessionCookie,
        },
        body: JSON.stringify(envelope),
      });
      const body = await readResponseJson(resp);
      assert.equal(resp.status, 200, 'authenticated /bus_event route must accept app:write session');
      assert.equal(body.ok, true);
      assert.equal(body.result, 'ok');
      assert.equal(body.routed_by, 'model0_busin');
      assert.equal(body.timing?.op_id, 'it0412_http_route_timing');
      assert.equal(body.timing?.client_dispatch_ts, envelope.meta.client_dispatch_ts);
      assert.equal(Number.isFinite(body.timing.server_received_at), true, 'HTTP response must include server receive time');
      assert.equal(Number.isFinite(body.timing.server_completed_at), true, 'HTTP response must include server completion time');
      assert.equal(Number.isFinite(body.timing.server_duration_ms), true, 'HTTP response must include server duration');
    });
  } finally {
    for (const [key, value] of Object.entries(priorEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await closeServer(appServer);
    await closeServer(oidcServer);
    rmSync(tempRoot, { recursive: true, force: true });
  }
  return { key: 'bus_event_http_route_returns_timing_with_authenticated_session', status: 'PASS' };
}

async function test_auth_disabled_http_routes_do_not_require_session() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'dy-0412-auth-disabled-http-'));
  let appServer = null;
  const priorEnv = {
    DY_AUTH: process.env.DY_AUTH,
    DY_PERSISTED_ASSET_ROOT: process.env.DY_PERSISTED_ASSET_ROOT,
    WORKER_BASE_WORKSPACE: process.env.WORKER_BASE_WORKSPACE,
    WORKER_BASE_DATA_ROOT: process.env.WORKER_BASE_DATA_ROOT,
    DOCS_ROOT: process.env.DOCS_ROOT,
    STATIC_PROJECTS_ROOT: process.env.STATIC_PROJECTS_ROOT,
    DY_UI_SERVER_WORKER_ID: process.env.DY_UI_SERVER_WORKER_ID,
  };
  try {
    await withEnv({
      DY_AUTH: '0',
      DY_PERSISTED_ASSET_ROOT: '',
      WORKER_BASE_WORKSPACE: `it0412_auth_disabled_${Date.now()}`,
      WORKER_BASE_DATA_ROOT: path.join(tempRoot, 'runtime'),
      DOCS_ROOT: path.join(tempRoot, 'docs'),
      STATIC_PROJECTS_ROOT: path.join(tempRoot, 'static'),
      DY_UI_SERVER_WORKER_ID: 'U1',
    }, async () => {
      const { startServer } = await importFreshServerModule();
      appServer = startServer({ port: 0, dbPath: null, skipFrontendBuild: true });
      await waitListening(appServer);
      const appBase = serverBaseUrl(appServer);

      const modeResp = await fetch(`${appBase}/api/runtime/mode`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'running' }),
      });
      const modeBody = await readResponseJson(modeResp);
      assert.equal(modeResp.status, 200, 'DY_AUTH=0 runtime mode route must not require a session');
      assert.equal(modeBody.ok, true);

      const envelope = buildBusEventV2({
        busInKey: 'ui_submit',
        value: [mt('__mt_payload_kind', 'str', 'ui_event.v1')],
        opId: 'it0412_auth_disabled_bus_event',
        source: 'test',
      });
      const resp = await fetch(`${appBase}/bus_event`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(envelope),
      });
      const body = await readResponseJson(resp);
      assert.equal(resp.status, 200, 'DY_AUTH=0 /bus_event must not require a session');
      assert.equal(body.ok, true);
      assert.equal(body.result, 'ok');
      assert.equal(body.routed_by, 'model0_busin');
      assert.equal(body.timing?.op_id, 'it0412_auth_disabled_bus_event');
    });
  } finally {
    for (const [key, value] of Object.entries(priorEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await closeServer(appServer);
    rmSync(tempRoot, { recursive: true, force: true });
  }
  return { key: 'auth_disabled_http_routes_do_not_require_session', status: 'PASS' };
}

async function test_runtime_mode_does_not_wait_for_slow_matrix_sync() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'dy-0412-runtime-mode-slow-matrix-'));
  let appServer = null;
  let matrixServer = null;
  const priorEnv = {
    DY_AUTH: process.env.DY_AUTH,
    DY_PERSISTED_ASSET_ROOT: process.env.DY_PERSISTED_ASSET_ROOT,
    WORKER_BASE_WORKSPACE: process.env.WORKER_BASE_WORKSPACE,
    WORKER_BASE_DATA_ROOT: process.env.WORKER_BASE_DATA_ROOT,
    DOCS_ROOT: process.env.DOCS_ROOT,
    STATIC_PROJECTS_ROOT: process.env.STATIC_PROJECTS_ROOT,
    DY_UI_SERVER_WORKER_ID: process.env.DY_UI_SERVER_WORKER_ID,
    DY_MATRIX_SYNC_TIMEOUT_MS: process.env.DY_MATRIX_SYNC_TIMEOUT_MS,
    MODELTABLE_PATCH_JSON: process.env.MODELTABLE_PATCH_JSON,
  };
  try {
    matrixServer = await createSlowMatrixServer();
    const matrixBase = serverBaseUrl(matrixServer);
    const matrixPatch = {
      records: [
        { op: 'add_label', model_id: 0, p: 0, r: 0, c: 0, k: 'matrix_room_id', t: 'str', v: '!it0412:local' },
        { op: 'add_label', model_id: 0, p: 0, r: 0, c: 0, k: 'matrix_server', t: 'matrix.server', v: matrixBase },
        { op: 'add_label', model_id: 0, p: 0, r: 0, c: 0, k: 'matrix_user', t: 'matrix.user', v: '@it0412:local' },
        { op: 'add_label', model_id: 0, p: 0, r: 0, c: 0, k: 'matrix_token', t: 'matrix.token', v: 'it0412-token' },
        { op: 'add_label', model_id: 0, p: 0, r: 0, c: 0, k: 'matrix_contuser', t: 'matrix.contuser', v: ['@mbr:local'] },
      ],
    };
    await withEnv({
      DY_AUTH: '0',
      DY_PERSISTED_ASSET_ROOT: '',
      WORKER_BASE_WORKSPACE: `it0412_slow_matrix_${Date.now()}`,
      WORKER_BASE_DATA_ROOT: path.join(tempRoot, 'runtime'),
      DOCS_ROOT: path.join(tempRoot, 'docs'),
      STATIC_PROJECTS_ROOT: path.join(tempRoot, 'static'),
      DY_UI_SERVER_WORKER_ID: 'U1',
      DY_MATRIX_SYNC_TIMEOUT_MS: '4000',
      MODELTABLE_PATCH_JSON: JSON.stringify(matrixPatch),
    }, async () => {
      const { startServer } = await importFreshServerModule();
      appServer = startServer({ port: 0, dbPath: null, skipFrontendBuild: true });
      await waitListening(appServer);
      const appBase = serverBaseUrl(appServer);
      const started = Date.now();
      const resp = await fetch(`${appBase}/api/runtime/mode`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'running' }),
      });
      const body = await readResponseJson(resp);
      const elapsedMs = Date.now() - started;
      assert.equal(resp.status, 200, 'runtime mode route must return even when Matrix sync is slow');
      assert.equal(body.ok, true);
      assert.ok(elapsedMs < 2000, `runtime mode route waited for Matrix sync (${elapsedMs}ms)`);
    });
  } finally {
    for (const [key, value] of Object.entries(priorEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await closeServer(appServer);
    await closeServer(matrixServer);
    rmSync(tempRoot, { recursive: true, force: true });
  }
  return { key: 'runtime_mode_does_not_wait_for_slow_matrix_sync', status: 'PASS' };
}

const tests = [
  test_local_env_example_uses_remote_sso_client,
  test_build_bus_event_v2_includes_client_dispatch_timing,
  test_renderer_bus_event_v2_includes_client_dispatch_timing,
  test_esm_renderer_bus_event_v2_includes_client_dispatch_timing,
  test_remote_store_returns_client_augmented_timing,
  test_remote_store_keeps_deferred_snapshot_for_stale_sse_during_post,
  test_remote_store_skips_deferred_snapshot_when_matching_sse_arrives_during_post,
  test_server_submit_envelope_returns_timing,
  test_bus_event_http_route_returns_timing_with_authenticated_session,
  test_auth_disabled_http_routes_do_not_require_session,
  test_runtime_mode_does_not_wait_for_slow_matrix_sync,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    const result = await test();
    passed += 1;
    console.log(`PASS ${result.key}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${test.name}: ${err.message}`);
  }
}

if (failed > 0) {
  console.error(`FAIL test_0412_local_latency_trace_contract: ${failed} failed, ${passed} passed`);
  process.exit(1);
}

console.log(`PASS test_0412_local_latency_trace_contract: ${passed} passed`);
