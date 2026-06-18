#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import http from 'node:http';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRemoteStore } from '../../packages/ui-model-demo-frontend/src/remote_store.js';

const originalFetch = globalThis.fetch;
const originalEventSource = globalThis.EventSource;
const BOOTSTRAP_MODEL0_LABEL_KEYS = new Set([
  'sys_worker_id',
  'sys_worker_role',
  'runtime_mode',
]);

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
  const roles = Array.isArray(payload.roles) ? payload.roles : [];
  const body = {
    iss: issuer,
    aud: audience,
    sub: payload.sub || 'it0418-user',
    exp: now + 300,
    iat: now,
    nonce,
    email: payload.email || 'it0418@example.test',
    email_verified: true,
    name: payload.name || 'it0418',
    preferred_username: payload.username || 'it0418',
    'urn:zitadel:iam:org:project:roles': Object.fromEntries(
      roles.map((role) => [role, { 'org:primary': 'Dongyu' }]),
    ),
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
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
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

async function waitListening(server) {
  if (server.listening) return;
  await once(server, 'listening');
}

async function importFreshServerModule() {
  return import(new URL(`../../packages/ui-model-demo-server/server.mjs?it0418=${Date.now()}_${Math.random()}`, import.meta.url));
}

async function createMockOidcProvider({ roles = ['dongyu.viewer'] } = {}) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = `it0418-key-${Math.random()}`;
  let issuer = '';
  let issuedNonce = '';
  const publicJwk = publicKey.export({ format: 'jwk' });
  publicJwk.kid = kid;
  publicJwk.alg = 'RS256';
  publicJwk.use = 'sig';

  const server = await createJsonServer(async (req, res) => {
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
      const idToken = signJwt({ roles, sub: 'it0418-viewer' }, {
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
        sub: 'it0418-viewer',
        email: 'it0418-viewer@example.test',
        name: 'it0418 viewer',
        preferred_username: 'it0418-viewer',
        'urn:zitadel:iam:org:project:roles': Object.fromEntries(
          roles.map((role) => [role, { 'org:primary': 'Dongyu' }]),
        ),
      }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  issuer = serverBaseUrl(server);
  return {
    server,
    issuer,
    setNonce(value) {
      issuedNonce = value;
    },
  };
}

async function loginViaMockOidc(appBase, provider) {
  const start = await fetch(`${appBase}/auth/sso/start?returnTo=%2F`, { redirect: 'manual' });
  assert.equal(start.status, 302, `mock_oidc_start_must_redirect: status=${start.status} body=${await start.clone().text().catch(() => '')}`);
  const location = new URL(start.headers.get('location'));
  provider.setNonce(location.searchParams.get('nonce'));
  const state = location.searchParams.get('state');
  const cookie = start.headers.get('set-cookie') || '';
  const callback = await fetch(`${appBase}/auth/sso/callback?code=valid-code&state=${encodeURIComponent(state)}`, {
    redirect: 'manual',
    headers: { cookie },
  });
  assert.equal(callback.status, 302, `mock_oidc_login_must_succeed: status=${callback.status} body=${await callback.clone().text().catch(() => '')}`);
  return callback.headers.get('set-cookie') || '';
}

async function withFreshServerEnv(extraEnvOrFn, maybeFn) {
  const extraEnv = typeof extraEnvOrFn === 'function' ? {} : (extraEnvOrFn || {});
  const fn = typeof extraEnvOrFn === 'function' ? extraEnvOrFn : maybeFn;
  const envKeys = new Set([
    'DY_AUTH',
    'DY_PERSISTED_ASSET_ROOT',
    'WORKER_BASE_WORKSPACE',
    'WORKER_BASE_DATA_ROOT',
    'DOCS_ROOT',
    'STATIC_PROJECTS_ROOT',
    'DY_UI_SERVER_WORKER_ID',
    ...Object.keys(extraEnv),
  ]);
  const previous = {};
  for (const key of envKeys) previous[key] = process.env[key];
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0418-visible-snapshot-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0418_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  process.env.DY_UI_SERVER_WORKER_ID = 'U1';
  for (const [key, value] of Object.entries(extraEnv)) {
    process.env[key] = value;
  }
  try {
    const mod = await importFreshServerModule();
    return await fn(mod, tempRoot);
  } finally {
    const restore = (key, value) => {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    };
    for (const key of envKeys) restore(key, previous[key]);
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function withAppServer(fn, extraEnv = {}) {
  await withFreshServerEnv(extraEnv, async ({ startServer }) => {
    const appServer = startServer({
      port: 0,
      dbPath: null,
      skipFrontendBuild: true,
    });
    await waitListening(appServer);
    try {
      return await fn(serverBaseUrl(appServer));
    } finally {
      await closeServer(appServer);
    }
  });
}

async function waitUntil(predicate, label, timeoutMs = 1000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail(label);
}

async function readJson(resp) {
  const text = await resp.text();
  return text ? JSON.parse(text) : {};
}

function responseSnapshot(body) {
  return body && body.snapshot && body.snapshot.models ? body.snapshot : body;
}

function modelMap(snapshot) {
  return snapshot && snapshot.models ? snapshot.models : {};
}

function modelIds(snapshot) {
  return Object.keys(modelMap(snapshot))
    .map((id) => Number.parseInt(id, 10))
    .filter((id) => Number.isInteger(id))
    .sort((a, b) => a - b);
}

function getModel(snapshot, modelId) {
  const models = modelMap(snapshot);
  return models[String(modelId)] || models[modelId] || null;
}

function rootLabels(snapshot, modelId) {
  return getModel(snapshot, modelId)?.cells?.['0,0,0']?.labels || {};
}

function snapshotBytes(body) {
  return Buffer.byteLength(JSON.stringify(body), 'utf8');
}

function clonePlainJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function modelLabelPatchOps(message, modelId) {
  return (message?.data?.snapshot_patch?.ops || []).filter((op) => op?.model_id === modelId);
}

function createVisibleModelSnapshot(modelId, appName) {
  return {
    models: {
      [String(modelId)]: {
        id: modelId,
        cells: {
          '0,0,0': {
            p: 0,
            r: 0,
            c: 0,
            labels: {
              app_name: { k: 'app_name', t: 'str', v: appName },
              ui_root_node_id: { k: 'ui_root_node_id', t: 'str', v: 'root' },
            },
          },
        },
      },
    },
    v1nConfig: {},
  };
}

function labelList(snapshot) {
  const labels = [];
  for (const [modelId, model] of Object.entries(modelMap(snapshot))) {
    for (const [cellKey, cell] of Object.entries(model?.cells || {})) {
      for (const [labelKey, label] of Object.entries(cell?.labels || {})) {
        labels.push({ modelId, cellKey, labelKey, label });
      }
    }
  }
  return labels;
}

function assertNoClientSecrets(snapshot, context) {
  for (const item of labelList(snapshot)) {
    const key = String(item.labelKey || '').toLowerCase();
    const type = String(item.label?.t || '').toLowerCase();
    assert.notEqual(type, 'func.js', `${context} must not expose func.js labels`);
    assert.notEqual(type, 'func.python', `${context} must not expose func.python labels`);
    assert.equal(isSensitiveKey(key), false, `${context} must not expose sensitive label key ${item.labelKey}`);
    assert.equal(containsSensitiveJsonKey(item.label?.v), false, `${context} must not expose sensitive nested value at ${item.modelId}:${item.cellKey}:${item.labelKey}`);
  }
  assert.equal(containsSensitiveJsonKey(snapshot?.v1nConfig), false, `${context} must not expose sensitive v1nConfig keys`);
  assert.equal(containsSensitiveJsonValue(snapshot?.v1nConfig), false, `${context} must not expose sensitive v1nConfig values`);
}

function isSensitiveKey(key) {
  const normalized = String(key || '').toLowerCase();
  return normalized === 'token'
    || normalized.endsWith('_token')
    || normalized.includes('access_token')
    || normalized.includes('refresh_token')
    || normalized.includes('matrix_token')
    || normalized.includes('password')
    || normalized.includes('passwd')
    || normalized.includes('secret');
}

function containsSensitiveJsonKey(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some((item) => containsSensitiveJsonKey(item));
  for (const [key, nested] of Object.entries(value)) {
    if (isSensitiveKey(key)) return true;
    if (containsSensitiveJsonKey(nested)) return true;
  }
  return false;
}

function containsSensitiveJsonValue(value) {
  if (typeof value === 'string') return /syt_|it0418-secret|ChangeMeLocal2026/u.test(value);
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some((item) => containsSensitiveJsonValue(item));
  return Object.values(value).some((nested) => containsSensitiveJsonValue(nested));
}

function workspaceRegistry(snapshot) {
  const labels = rootLabels(snapshot, -2);
  return Array.isArray(labels.ws_apps_registry?.v) ? labels.ws_apps_registry.v : [];
}

function visibleWorkspaceAppModelIds(snapshot) {
  return workspaceRegistry(snapshot)
    .map((entry) => (entry && Number.isInteger(entry.model_id) ? entry.model_id : null))
    .filter((modelId) => Number.isInteger(modelId) && modelId > 0 && getModel(snapshot, modelId));
}

function findVisibleFixtureIds(fullSnapshot) {
  const ids = visibleWorkspaceAppModelIds(fullSnapshot);
  const target = ids.find((modelId) => modelId !== 100) || ids[0];
  const unrelated = ids.find((modelId) => modelId !== target);
  assert.equal(Number.isInteger(target), true, 'full snapshot fixture must contain at least one positive workspace app model');
  assert.equal(Number.isInteger(unrelated), true, 'full snapshot fixture must contain at least two positive workspace app models');
  return { target, unrelated };
}

function assertBootstrapShellRootLabels(snapshot, context) {
  const labels = rootLabels(snapshot, -2);
  const required = [
    'ui_page',
    'ui_page_catalog_json',
    'ws_apps_registry',
    'desktop_foreground_app_json',
    'desktop_task_stack_json',
    'desktop_task_switcher_open',
    'desktop_app_view_mode',
  ];
  for (const key of required) {
    assert.equal(Boolean(labels[key]), true, `${context} must include shell root label ${key}`);
  }
  assert.equal(Array.isArray(labels.ui_page_catalog_json.v), true, `${context} ui_page_catalog_json must remain a page catalog array`);
  assert.equal(Array.isArray(labels.ws_apps_registry.v), true, `${context} ws_apps_registry must remain an app registry array`);
}

function assertBootstrapModel0Minimal(snapshot, context) {
  const model0 = getModel(snapshot, 0);
  assert.equal(Boolean(model0), true, `${context} must include minimal Model 0`);
  assert.deepEqual(Object.keys(model0.cells || {}), ['0,0,0'], `${context} Model 0 must expose only root cell`);
  const labels = rootLabels(snapshot, 0);
  assert.equal(Boolean(labels.sys_worker_id), true, `${context} Model 0 must include sys_worker_id`);
  assert.equal(Boolean(labels.sys_worker_role), true, `${context} Model 0 must include sys_worker_role`);
  assert.equal(Boolean(labels.runtime_mode), true, `${context} Model 0 must include runtime_mode`);
  for (const key of Object.keys(labels)) {
    assert.equal(
      BOOTSTRAP_MODEL0_LABEL_KEYS.has(key),
      true,
      `${context} Model 0 must not expose non-bootstrap label ${key}`,
    );
  }
}

function assertNoPositiveWorkspaceAppBodies(snapshot, appModelIds, context) {
  for (const modelId of appModelIds) {
    assert.equal(Boolean(getModel(snapshot, modelId)), false, `${context} must exclude non-visible workspace app model ${modelId}`);
  }
}

function bootstrapAllowedModelIds(fullSnapshot) {
  void fullSnapshot;
  return new Set([0, -2, -28, -29, -102, -23, -103]);
}

function assertBootstrapModelAllowlist(snapshot, fullSnapshot, context, extraAllowed = []) {
  const allowed = bootstrapAllowedModelIds(fullSnapshot);
  for (const modelId of extraAllowed) {
    if (Number.isInteger(modelId)) allowed.add(modelId);
  }
  for (const modelId of modelIds(snapshot)) {
    assert.equal(allowed.has(modelId), true, `${context} must not include non-bootstrap model ${modelId}`);
  }
}

async function polluteVisibleAppState(baseUrl, modelId) {
  const polluted = {
    id: `polluted-${modelId}`,
    kind: 'workspace',
    page: 'workspace',
    path: '/workspace',
    model_id: modelId,
    title: `Polluted ${modelId}`,
  };
  const writes = [
    ['desktop_foreground_app_json', 'json', polluted],
    ['desktop_task_stack_json', 'json', [polluted]],
    ['ws_app_selected', 'int', modelId],
  ];
  for (const [key, type, value] of writes) {
    const resp = await fetch(`${baseUrl}/ui_event`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        event_id: Date.now(),
        type: 'label_update',
        source: 'ui_renderer',
        ts: Date.now(),
        payload: {
          action: 'label_update',
          target: { model_id: -2, p: 0, r: 0, c: 0, k: key },
          value: { t: type, v: value },
          meta: { op_id: `it0418_pollute_${key}_${Date.now()}` },
        },
      }),
    });
    assert.equal(resp.status, 200, `polluting ${key} must be accepted as local shell state`);
    const body = await readJson(resp);
    assert.equal(body.result, 'ok', `polluting ${key} must write UI-local state successfully`);
  }
  const fullResp = await fetch(`${baseUrl}/snapshot?profile=full`);
  assert.equal(fullResp.status, 200, 'polluted state readback must be available');
  const fullSnapshot = responseSnapshot(await readJson(fullResp));
  const labels = rootLabels(fullSnapshot, -2);
  assert.equal(labels.desktop_foreground_app_json?.v?.model_id, modelId, 'polluted foreground must point to disallowed model');
  assert.equal(labels.desktop_task_stack_json?.v?.[0]?.model_id, modelId, 'polluted task stack must point to disallowed model');
  assert.equal(labels.ws_app_selected?.v, modelId, 'polluted workspace selection must point to disallowed model');
}

async function polluteWorkspaceRegistry(baseUrl, modelId) {
  const fullResp = await fetch(`${baseUrl}/snapshot?profile=full`);
  assert.equal(fullResp.status, 200, 'workspace registry pollution setup must read full snapshot');
  const fullSnapshot = responseSnapshot(await readJson(fullResp));
  const currentRegistry = workspaceRegistry(fullSnapshot);
  const pollutedRegistry = [
    ...currentRegistry,
    {
      model_id: modelId,
      name: `Polluted Registry ${modelId}`,
      summary: 'polluted mutable registry entry',
      app_origin: 'slid_in',
      slide_capable: true,
      slide_surface_type: 'workspace.page',
    },
  ];
  const resp = await fetch(`${baseUrl}/ui_event`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      event_id: Date.now(),
      type: 'label_update',
      source: 'ui_renderer',
      ts: Date.now(),
      payload: {
        action: 'label_update',
        target: { model_id: -2, p: 0, r: 0, c: 0, k: 'ws_apps_registry' },
        value: { t: 'json', v: pollutedRegistry },
        meta: { op_id: `it0418_pollute_ws_registry_${Date.now()}` },
      },
    }),
  });
  assert.equal(resp.status, 200, 'polluting ws_apps_registry must be accepted as UI-local state');
  const body = await readJson(resp);
  assert.equal(body.result, 'ok', 'polluting ws_apps_registry must write UI-local state successfully');
  const readbackResp = await fetch(`${baseUrl}/snapshot?profile=full`);
  assert.equal(readbackResp.status, 200, 'polluted workspace registry readback must be available');
  const readbackSnapshot = responseSnapshot(await readJson(readbackResp));
  assert.equal(
    workspaceRegistry(readbackSnapshot).some((entry) => entry && entry.model_id === modelId),
    true,
    'polluted ws_apps_registry must include disallowed model before visible allowlist check',
  );
}

async function polluteUiPageCatalog(baseUrl, modelId) {
  const fullResp = await fetch(`${baseUrl}/snapshot?profile=full`);
  assert.equal(fullResp.status, 200, 'page catalog pollution setup must read full snapshot');
  const fullSnapshot = responseSnapshot(await readJson(fullResp));
  const labels = rootLabels(fullSnapshot, -2);
  const currentCatalog = Array.isArray(labels.ui_page_catalog_json?.v) ? labels.ui_page_catalog_json.v : [];
  const pollutedCatalog = [
    ...currentCatalog,
    {
      id: `polluted-page-${modelId}`,
      path: `/polluted-${modelId}`,
      title: `Polluted Page ${modelId}`,
      model_id: modelId,
    },
  ];
  const resp = await fetch(`${baseUrl}/ui_event`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      event_id: Date.now(),
      type: 'label_update',
      source: 'ui_renderer',
      ts: Date.now(),
      payload: {
        action: 'label_update',
        target: { model_id: -2, p: 0, r: 0, c: 0, k: 'ui_page_catalog_json' },
        value: { t: 'json', v: pollutedCatalog },
        meta: { op_id: `it0418_pollute_page_catalog_${Date.now()}` },
      },
    }),
  });
  assert.equal(resp.status, 200, 'polluting ui_page_catalog_json must be accepted as UI-local state');
  const body = await readJson(resp);
  assert.equal(body.result, 'ok', 'polluting ui_page_catalog_json must write UI-local state successfully');
  const readbackResp = await fetch(`${baseUrl}/snapshot?profile=full`);
  assert.equal(readbackResp.status, 200, 'polluted page catalog readback must be available');
  const readbackSnapshot = responseSnapshot(await readJson(readbackResp));
  const readbackCatalog = rootLabels(readbackSnapshot, -2).ui_page_catalog_json?.v;
  assert.equal(
    Array.isArray(readbackCatalog) && readbackCatalog.some((entry) => entry && entry.model_id === modelId),
    true,
    'polluted ui_page_catalog_json must include non-bootstrap model before bootstrap allowlist check',
  );
}

async function polluteNestedSecretLabel(baseUrl) {
  const resp = await fetch(`${baseUrl}/ui_event`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      event_id: Date.now(),
      type: 'label_update',
      source: 'ui_renderer',
      ts: Date.now(),
      payload: {
        action: 'label_update',
        target: { model_id: -2, p: 0, r: 0, c: 0, k: 'it0418_nested_secret_json' },
        value: {
          t: 'json',
          v: {
            public_name: 'visible shell metadata',
            credentials: {
              access_token: 'it0418-secret-access-token',
              matrix_token: 'syt_IT0418SecretTokenValue',
            },
          },
        },
        meta: { op_id: `it0418_pollute_nested_secret_${Date.now()}` },
      },
    }),
  });
  assert.equal(resp.status, 200, 'polluting nested secret label must be accepted so client redaction can be tested');
  const body = await readJson(resp);
  assert.equal(body.result, 'ok', 'polluting nested secret label must write local state successfully');
}

async function readFirstSseEvent(baseUrl, query = '') {
  const ctrl = new AbortController();
  const resp = await fetch(`${baseUrl}/stream${query}`, { signal: ctrl.signal });
  assert.equal(resp.status, 200, 'stream request must succeed');
  const reader = resp.body.getReader();
  let text = '';
  const deadline = Date.now() + 5000;
  try {
    while (Date.now() < deadline) {
      const { value, done } = await reader.read();
      if (done) break;
      text += Buffer.from(value).toString('utf8');
      const events = text.split('\n\n');
      const completeEventCount = text.endsWith('\n\n') ? events.length : events.length - 1;
      for (const eventText of events.slice(0, Math.max(0, completeEventCount))) {
        if (!eventText.includes('event:')) continue;
        const event = parseSseEvent(eventText);
        if (event.event === 'snapshot' || event.event === 'snapshot_patch') {
          return event;
        }
      }
    }
  } finally {
    ctrl.abort();
  }
  throw new Error(`snapshot_sse_event_not_found:${text.slice(0, 200)}`);
}

function parseSseEvent(eventText) {
  let event = 'message';
  const dataLines = [];
  for (const line of eventText.split('\n')) {
    if (line.startsWith('event:')) event = line.slice('event:'.length).trim();
    if (line.startsWith('data:')) dataLines.push(line.slice('data:'.length).trimStart());
  }
  const dataText = dataLines.join('\n');
  return { event, data: dataText ? JSON.parse(dataText) : null };
}

async function test_snapshot_profiles_expose_bootstrap_and_visible_shapes() {
  await withAppServer(async (baseUrl) => {
    const fullResp = await fetch(`${baseUrl}/snapshot?profile=full`);
    assert.equal(fullResp.status, 200, 'full profile must remain available');
    const fullBody = await readJson(fullResp);
    const fullSnapshot = responseSnapshot(fullBody);
    const { target, unrelated } = findVisibleFixtureIds(fullSnapshot);
    const allPositiveWorkspaceAppIds = visibleWorkspaceAppModelIds(fullSnapshot);

    const bootstrapResp = await fetch(`${baseUrl}/snapshot?profile=bootstrap`);
    assert.equal(bootstrapResp.status, 200, 'bootstrap profile must be available');
    const bootstrapBody = await readJson(bootstrapResp);
    const bootstrapSnapshot = responseSnapshot(bootstrapBody);
    assert.equal(Boolean(getModel(bootstrapSnapshot, -2)), true, 'bootstrap must include editor state/shell model');
    assert.equal(Boolean(getModel(bootstrapSnapshot, -28)), true, 'bootstrap must include desktop catalog model for first-screen launcher rendering');
    assertBootstrapModel0Minimal(bootstrapSnapshot, 'bootstrap snapshot');
    assertBootstrapShellRootLabels(bootstrapSnapshot, 'bootstrap snapshot');
    assertBootstrapModelAllowlist(bootstrapSnapshot, fullSnapshot, 'bootstrap snapshot');
    assert.equal(workspaceRegistry(bootstrapSnapshot).length > 0, true, 'bootstrap must keep workspace app registry');
    assertNoPositiveWorkspaceAppBodies(bootstrapSnapshot, allPositiveWorkspaceAppIds, 'bootstrap snapshot');
    assert.equal(snapshotBytes(bootstrapBody) < snapshotBytes(fullBody), true, 'bootstrap must be materially smaller than full');
    assertNoClientSecrets(bootstrapSnapshot, 'bootstrap snapshot');

    const defaultResp = await fetch(`${baseUrl}/snapshot`);
    assert.equal(defaultResp.status, 200, 'default snapshot route must remain available');
    const defaultBody = await readJson(defaultResp);
    const defaultSnapshot = responseSnapshot(defaultBody);
    assert.equal(Boolean(getModel(defaultSnapshot, -28)), true, 'default snapshot must include desktop catalog model for first-screen launcher rendering');
    assertBootstrapModel0Minimal(defaultSnapshot, 'default snapshot');
    assertBootstrapShellRootLabels(defaultSnapshot, 'default snapshot');
    assertBootstrapModelAllowlist(defaultSnapshot, fullSnapshot, 'default snapshot');
    assertNoPositiveWorkspaceAppBodies(defaultSnapshot, allPositiveWorkspaceAppIds, 'default snapshot');
    assertNoClientSecrets(defaultSnapshot, 'default snapshot');
    assert.equal(snapshotBytes(defaultBody) < snapshotBytes(fullBody), true, 'default snapshot must not be implicit full snapshot');

    const visibleResp = await fetch(`${baseUrl}/snapshot?profile=visible&model_id=${target}`);
    assert.equal(visibleResp.status, 200, 'visible profile must accept requested allowed model');
    const visibleBody = await readJson(visibleResp);
    const visibleSnapshot = responseSnapshot(visibleBody);
    assert.equal(Boolean(getModel(visibleSnapshot, target)), true, 'visible profile must include requested model');
    assert.equal(Boolean(getModel(visibleSnapshot, unrelated)), false, 'visible profile must exclude unrelated app model');
    assertBootstrapModel0Minimal(visibleSnapshot, 'visible snapshot');
    assertBootstrapShellRootLabels(visibleSnapshot, 'visible snapshot');
    assertBootstrapModelAllowlist(visibleSnapshot, fullSnapshot, 'visible snapshot', [target]);
    assertNoPositiveWorkspaceAppBodies(
      visibleSnapshot,
      allPositiveWorkspaceAppIds.filter((modelId) => modelId !== target),
      'visible snapshot',
    );
    assertNoClientSecrets(visibleSnapshot, 'visible snapshot');
  });

  await withAppServer(async (baseUrl) => {
    const fullBody = await readJson(await fetch(`${baseUrl}/snapshot?profile=full`));
    const fullSnapshot = responseSnapshot(fullBody);
    await polluteUiPageCatalog(baseUrl, -101);

    const pollutedBootstrap = responseSnapshot(await readJson(await fetch(`${baseUrl}/snapshot?profile=bootstrap`)));
    assertBootstrapModelAllowlist(pollutedBootstrap, fullSnapshot, 'polluted page catalog bootstrap snapshot');
    assert.equal(Boolean(getModel(pollutedBootstrap, -101)), false, 'polluted page catalog bootstrap snapshot must not include gallery mailbox model');

    const pollutedDefault = responseSnapshot(await readJson(await fetch(`${baseUrl}/snapshot`)));
    assertBootstrapModelAllowlist(pollutedDefault, fullSnapshot, 'polluted page catalog default snapshot');
    assert.equal(Boolean(getModel(pollutedDefault, -101)), false, 'polluted page catalog default snapshot must not include gallery mailbox model');
  });

  await withAppServer(async (baseUrl) => {
    await polluteNestedSecretLabel(baseUrl);

    const pollutedFull = responseSnapshot(await readJson(await fetch(`${baseUrl}/snapshot?profile=full`)));
    assertNoClientSecrets(pollutedFull, 'polluted nested secret full snapshot');
    assert.equal(rootLabels(pollutedFull, -2).it0418_nested_secret_json, undefined, 'full snapshot must drop nested secret label');

    const pollutedBootstrap = responseSnapshot(await readJson(await fetch(`${baseUrl}/snapshot?profile=bootstrap`)));
    assertNoClientSecrets(pollutedBootstrap, 'polluted nested secret bootstrap snapshot');
    assert.equal(rootLabels(pollutedBootstrap, -2).it0418_nested_secret_json, undefined, 'bootstrap snapshot must drop nested secret label');

    const pollutedStream = await readFirstSseEvent(baseUrl, '?profile=bootstrap');
    assertNoClientSecrets(responseSnapshot(pollutedStream.data), 'polluted nested secret stream initial snapshot');
  });

  return { key: 'snapshot_profiles_expose_bootstrap_and_visible_shapes', status: 'PASS' };
}

async function test_visible_profile_rejects_invalid_and_disallowed_targets() {
  await withAppServer(async (baseUrl) => {
    const cases = [
      ['/snapshot?profile=bad', 400, 'invalid_snapshot_profile'],
      ['/snapshot?profile=visible', 400, 'missing_model_id'],
      ['/snapshot?profile=visible&model_id=abc', 400, 'invalid_model_id'],
      ['/snapshot?profile=visible&model_id=99999999', 404, 'model_not_found'],
      ['/snapshot?profile=visible&model_id=-10', 403, 'model_not_allowed'],
      ['/snapshot?profile=visible&model_id=1035', 403, 'model_not_visible'],
      ['/snapshot?profile=visible&model_id=1031', 403, 'model_not_visible'],
      ['/snapshot?profile=visible&model_id=1008', 403, 'model_not_visible'],
      ['/snapshot?profile=visible&model_id=1', 403, 'model_not_visible'],
    ];
    for (const [path, expectedStatus, code] of cases) {
      const resp = await fetch(`${baseUrl}${path}`);
      assert.equal(resp.status, expectedStatus, `${code} must fail closed with expected status`);
      const body = await readJson(resp);
      assert.equal(body.error || body.code, code, `${code} response must include exact observable error code`);
    }
  });

  await withAppServer(async (baseUrl) => {
    await polluteVisibleAppState(baseUrl, 1035);
    const resp = await fetch(`${baseUrl}/snapshot?profile=visible&model_id=1035`);
    assert.equal(resp.status, 403, 'polluted foreground/task/selection state must not make internal model visible');
    const body = await readJson(resp);
    assert.equal(body.error || body.code, 'model_not_visible', 'polluted visible snapshot request must remain model_not_visible');
  });

  await withAppServer(async (baseUrl) => {
    await polluteWorkspaceRegistry(baseUrl, 1035);
    const resp = await fetch(`${baseUrl}/snapshot?profile=visible&model_id=1035`);
    assert.equal(resp.status, 403, 'polluted workspace registry must not make internal model visible');
    const body = await readJson(resp);
    assert.equal(body.error || body.code, 'model_not_visible', 'polluted workspace registry visible request must remain model_not_visible');
  });

  return { key: 'visible_profile_rejects_invalid_and_disallowed_targets', status: 'PASS' };
}

async function test_visible_profile_rejects_existing_capability_disallowed_model() {
  await withAppServer(async (baseUrl) => {
    const fullBody = await readJson(await fetch(`${baseUrl}/snapshot?profile=full`));
    const fullSnapshot = responseSnapshot(fullBody);
    assert.equal(Boolean(getModel(fullSnapshot, 1036)), true, 'test fixture must contain existing management-bus model 1036');
  });

  const provider = await createMockOidcProvider({ roles: ['dongyu.viewer'] });
  try {
    await withAppServer(async (baseUrl) => {
      const cookie = await loginViaMockOidc(baseUrl, provider);
      const resp = await fetch(`${baseUrl}/snapshot?profile=visible&model_id=1036`, {
        headers: { cookie },
      });
      assert.notEqual(resp.status, 200, 'viewer must not load existing management-bus model through visible profile');
      const body = await readJson(resp);
      assert.equal(body.error || body.code, 'permission_denied', 'capability-disallowed visible response must be permission_denied');
      assert.equal(body.requiredCapability, 'management_bus:use', 'capability-disallowed visible response must name the missing capability');
    }, {
      DY_AUTH: '1',
      DY_OIDC_ISSUER: provider.issuer,
      DY_OIDC_CLIENT_ID: 'dongyu-app',
    });
  } finally {
    await closeServer(provider.server);
  }
  return { key: 'visible_profile_rejects_existing_capability_disallowed_model', status: 'PASS' };
}

async function test_stream_bootstrap_initial_event_avoids_full_snapshot_path() {
  await withAppServer(async (baseUrl) => {
    const fullBody = await readJson(await fetch(`${baseUrl}/snapshot?profile=full`));
    const fullSnapshot = responseSnapshot(fullBody);
    const { target } = findVisibleFixtureIds(fullSnapshot);
    const allPositiveWorkspaceAppIds = visibleWorkspaceAppModelIds(fullSnapshot);

    const event = await readFirstSseEvent(baseUrl, '?profile=bootstrap');
    assert.equal(event.event, 'snapshot', 'stream bootstrap first snapshot must be a snapshot event');
    const streamSnapshot = responseSnapshot(event.data);
    assert.equal(Boolean(getModel(streamSnapshot, -2)), true, 'stream bootstrap must include shell/editor state');
    assertBootstrapModel0Minimal(streamSnapshot, 'stream bootstrap snapshot');
    assertBootstrapShellRootLabels(streamSnapshot, 'stream bootstrap snapshot');
    assertBootstrapModelAllowlist(streamSnapshot, fullSnapshot, 'stream bootstrap snapshot');
    assertNoPositiveWorkspaceAppBodies(streamSnapshot, allPositiveWorkspaceAppIds, 'stream bootstrap snapshot');
    assertNoClientSecrets(streamSnapshot, 'stream bootstrap snapshot');
    assert.equal(snapshotBytes(event.data) < snapshotBytes(fullBody), true, 'stream bootstrap initial event must be smaller than full snapshot');

    const defaultEvent = await readFirstSseEvent(baseUrl, '');
    assert.equal(defaultEvent.event, 'snapshot', 'default stream first event must be a snapshot event');
    const defaultStreamSnapshot = responseSnapshot(defaultEvent.data);
    assertBootstrapModel0Minimal(defaultStreamSnapshot, 'default stream snapshot');
    assertBootstrapShellRootLabels(defaultStreamSnapshot, 'default stream snapshot');
    assertBootstrapModelAllowlist(defaultStreamSnapshot, fullSnapshot, 'default stream snapshot');
    assertNoPositiveWorkspaceAppBodies(defaultStreamSnapshot, allPositiveWorkspaceAppIds, 'default stream snapshot');
    assertNoClientSecrets(defaultStreamSnapshot, 'default stream snapshot');
    assert.equal(snapshotBytes(defaultEvent.data) < snapshotBytes(fullBody), true, 'default stream must not be implicit full snapshot');

    const visibleEvent = await readFirstSseEvent(baseUrl, `?profile=bootstrap&visible_model_id=${target}`);
    assert.equal(visibleEvent.event, 'snapshot', 'stream visible subscription first event must be a snapshot event');
    const visibleStreamSnapshot = responseSnapshot(visibleEvent.data);
    assertBootstrapModel0Minimal(visibleStreamSnapshot, 'stream visible subscription snapshot');
    assertBootstrapShellRootLabels(visibleStreamSnapshot, 'stream visible subscription snapshot');
    assert.equal(Boolean(getModel(visibleStreamSnapshot, target)), true, 'stream visible subscription must include requested visible model');
    assertBootstrapModelAllowlist(visibleStreamSnapshot, fullSnapshot, 'stream visible subscription snapshot', [target]);
    assertNoPositiveWorkspaceAppBodies(
      visibleStreamSnapshot,
      allPositiveWorkspaceAppIds.filter((modelId) => modelId !== target),
      'stream visible subscription snapshot',
    );
    assertNoClientSecrets(visibleStreamSnapshot, 'stream visible subscription snapshot');
  });
  return { key: 'stream_bootstrap_initial_event_avoids_full_snapshot_path', status: 'PASS' };
}

async function test_stream_visible_model_id_rejects_invalid_and_disallowed_targets() {
  await withAppServer(async (baseUrl) => {
    const cases = [
      [`${baseUrl}/stream?profile=bad`, 400, 'invalid_snapshot_profile'],
      [`${baseUrl}/stream?profile=bootstrap&visible_model_id=abc`, 400, 'invalid_model_id'],
      [`${baseUrl}/stream?profile=bootstrap&visible_model_id=99999999`, 404, 'model_not_found'],
      [`${baseUrl}/stream?profile=bootstrap&visible_model_id=-10`, 403, 'model_not_allowed'],
      [`${baseUrl}/stream?profile=bootstrap&visible_model_id=1035`, 403, 'model_not_visible'],
      [`${baseUrl}/stream?profile=bootstrap&visible_model_id=1031`, 403, 'model_not_visible'],
      [`${baseUrl}/stream?profile=bootstrap&visible_model_id=1008`, 403, 'model_not_visible'],
      [`${baseUrl}/stream?profile=bootstrap&visible_model_id=1`, 403, 'model_not_visible'],
    ];
    for (const [url, expectedStatus, code] of cases) {
      const resp = await fetch(url);
      assert.equal(resp.status, expectedStatus, `${code} stream visible_model_id must fail closed`);
      const body = await readJson(resp);
      assert.equal(body.error || body.code, code, `${code} stream response must include exact observable error code`);
    }
  });

  await withAppServer(async (baseUrl) => {
    await polluteVisibleAppState(baseUrl, 1035);
    const resp = await fetch(`${baseUrl}/stream?profile=bootstrap&visible_model_id=1035`);
    assert.equal(resp.status, 403, 'polluted foreground/task/selection state must not make internal model stream-visible');
    const body = await readJson(resp);
    assert.equal(body.error || body.code, 'model_not_visible', 'polluted stream visible request must remain model_not_visible');
  });

  await withAppServer(async (baseUrl) => {
    await polluteWorkspaceRegistry(baseUrl, 1035);
    const resp = await fetch(`${baseUrl}/stream?profile=bootstrap&visible_model_id=1035`);
    assert.equal(resp.status, 403, 'polluted workspace registry must not make internal model stream-visible');
    const body = await readJson(resp);
    assert.equal(body.error || body.code, 'model_not_visible', 'polluted workspace registry stream request must remain model_not_visible');
  });

  const provider = await createMockOidcProvider({ roles: ['dongyu.viewer'] });
  try {
    await withAppServer(async (baseUrl) => {
      const cookie = await loginViaMockOidc(baseUrl, provider);
      const resp = await fetch(`${baseUrl}/stream?profile=bootstrap&visible_model_id=1036`, {
        headers: { cookie },
      });
      assert.equal(resp.status, 403, 'viewer must not subscribe to management-bus model through stream visible_model_id');
      const body = await readJson(resp);
      assert.equal(body.error || body.code, 'permission_denied', 'capability-disallowed stream visible response must be permission_denied');
      assert.equal(body.requiredCapability, 'management_bus:use', 'capability-disallowed stream visible response must name the missing capability');
    }, {
      DY_AUTH: '1',
      DY_OIDC_ISSUER: provider.issuer,
      DY_OIDC_CLIENT_ID: 'dongyu-app',
    });
  } finally {
    await closeServer(provider.server);
  }
  return { key: 'stream_visible_model_id_rejects_invalid_and_disallowed_targets', status: 'PASS' };
}

async function test_profile_patch_consistency_and_metrics() {
  const {
    buildClientSnapshotProfile,
    buildClientSnapshotPatchMessage,
  } = await importFreshServerModule();
  assert.equal(typeof buildClientSnapshotProfile, 'function', 'server must expose profile helper for deterministic patch/profile contract tests');
  assert.equal(typeof buildClientSnapshotPatchMessage, 'function', 'server must expose patch message helper');

  const previous = {
    models: {
      '0': { id: 0, cells: { '0,0,0': { p: 0, r: 0, c: 0, labels: { sys_worker_id: { k: 'sys_worker_id', t: 'worker.id', v: 'ws/dam/pic/de/U1' }, sys_worker_role: { k: 'sys_worker_role', t: 'worker.role', v: 'V1N' }, runtime_mode: { k: 'runtime_mode', t: 'str', v: 'running' } } } } },
      '-2': {
        id: -2,
        cells: {
          '0,0,0': {
            p: 0,
            r: 0,
            c: 0,
            labels: {
              ui_page: { k: 'ui_page', t: 'str', v: 'desktop' },
              ui_page_catalog_json: { k: 'ui_page_catalog_json', t: 'json', v: [] },
              ws_apps_registry: {
                k: 'ws_apps_registry',
                t: 'json',
                v: [
                  { model_id: 4100, name: 'Patch App A', slide_capable: true },
                  { model_id: 4200, name: 'Patch App B', slide_capable: true },
                ],
              },
              desktop_foreground_app_json: { k: 'desktop_foreground_app_json', t: 'json', v: null },
              desktop_task_stack_json: { k: 'desktop_task_stack_json', t: 'json', v: [] },
              desktop_task_switcher_open: { k: 'desktop_task_switcher_open', t: 'bool', v: false },
              desktop_app_view_mode: { k: 'desktop_app_view_mode', t: 'str', v: 'grid' },
            },
          },
        },
      },
      ...createVisibleModelSnapshot(4100, 'Patch App A').models,
      ...createVisibleModelSnapshot(4200, 'Patch App B').models,
    },
    v1nConfig: {
      publicMode: 'demo',
      nested: {
        access_token: 'it0418-secret-v1n-token',
        safe_flag: true,
      },
    },
  };
  const next = clonePlainJson(previous);
  next.models['4100'].cells['0,0,0'].labels.app_name = { k: 'app_name', t: 'str', v: 'Patch App A Updated' };
  next.models['4200'].cells['0,0,0'].labels.app_name = { k: 'app_name', t: 'str', v: 'Patch App B Updated' };
  const v1nNext = clonePlainJson(next);
  v1nNext.v1nConfig.publicMode = 'demo-updated';
  v1nNext.v1nConfig.refresh_token = 'it0418-secret-v1n-refresh-token';

  const fullPrev = buildClientSnapshotProfile(previous, { profile: 'full' });
  const bootstrapPrev = buildClientSnapshotProfile(previous, { profile: 'bootstrap', visibleModelIds: [] });
  const bootstrapNext = buildClientSnapshotProfile(next, { profile: 'bootstrap', visibleModelIds: [] });
  const visibleAPrev = buildClientSnapshotProfile(previous, { profile: 'bootstrap', visibleModelIds: [4100] });
  const visibleANext = buildClientSnapshotProfile(next, { profile: 'bootstrap', visibleModelIds: [4100] });
  const visibleAV1nNext = buildClientSnapshotProfile(v1nNext, { profile: 'bootstrap', visibleModelIds: [4100] });

  assert.equal(containsSensitiveJsonKey(fullPrev.v1nConfig), false, 'full profile helper must sanitize sensitive v1nConfig keys');
  assert.equal(containsSensitiveJsonValue(fullPrev.v1nConfig), false, 'full profile helper must sanitize sensitive v1nConfig values');
  assert.equal(containsSensitiveJsonKey(visibleAV1nNext.v1nConfig), false, 'visible profile helper must sanitize sensitive v1nConfig keys');
  assert.equal(containsSensitiveJsonValue(visibleAV1nNext.v1nConfig), false, 'visible profile helper must sanitize sensitive v1nConfig values');
  assert.equal(Boolean(getModel(bootstrapPrev, 4100)), false, 'bootstrap profile baseline must not include app A body');
  assert.equal(Boolean(getModel(bootstrapPrev, 4200)), false, 'bootstrap profile baseline must not include app B body');
  assert.equal(Boolean(getModel(visibleAPrev, 4100)), true, 'visible(A) profile baseline must include app A body');
  assert.equal(Boolean(getModel(visibleAPrev, 4200)), false, 'visible(A) profile baseline must not include app B body');

  const bootstrapMessage = buildClientSnapshotPatchMessage({
    previousSnapshot: bootstrapPrev,
    nextSnapshot: bootstrapNext,
    baseSnapshotSeq: 20,
    snapshotSeq: 21,
    opId: 'it0418_bootstrap_profile_patch',
    previousPrincipalKey: 'guest',
    currentPrincipalKey: 'guest',
  });
  assert.equal(bootstrapMessage.event, 'noop', 'bootstrap-only client must not receive app body patches for hidden app model changes');

  const visibleAMessage = buildClientSnapshotPatchMessage({
    previousSnapshot: visibleAPrev,
    nextSnapshot: visibleANext,
    baseSnapshotSeq: 21,
    snapshotSeq: 22,
    opId: 'it0418_visible_a_profile_patch',
    previousPrincipalKey: 'guest',
    currentPrincipalKey: 'guest',
  });
  assert.equal(visibleAMessage.event, 'snapshot_patch', 'visible(A) client must receive a patch for app A changes');
  assert.equal(modelLabelPatchOps(visibleAMessage, 4100).length, 1, 'visible(A) patch must contain app A label update');
  assert.equal(modelLabelPatchOps(visibleAMessage, 4200).length, 0, 'visible(A) patch must not contain hidden app B changes');
  assert.equal(visibleAMessage.data.patch_stats.bytes, snapshotBytes(visibleAMessage.data.snapshot_patch), 'visible(A) patch_stats.bytes must match serialized patch bytes');
  assert.equal(visibleAMessage.data.patch_stats.bytes < snapshotBytes({ snapshot: fullPrev }), true, 'visible(A) representative patch must stay smaller than full snapshot payload');
  assert.equal(snapshotBytes({ snapshot: bootstrapPrev }) < snapshotBytes({ snapshot: fullPrev }), true, 'bootstrap metric must be smaller than full profile metric');
  assert.equal(snapshotBytes({ snapshot: visibleAPrev }) < snapshotBytes({ snapshot: fullPrev }), true, 'single visible app metric must be smaller than full profile metric');

  const visibleAV1nMessage = buildClientSnapshotPatchMessage({
    previousSnapshot: visibleANext,
    nextSnapshot: visibleAV1nNext,
    baseSnapshotSeq: 22,
    snapshotSeq: 23,
    opId: 'it0418_visible_a_v1n_profile_patch',
    previousPrincipalKey: 'guest',
    currentPrincipalKey: 'guest',
  });
  assert.equal(visibleAV1nMessage.event, 'snapshot_patch', 'visible(A) v1nConfig changes must still produce a patch');
  assert.equal(containsSensitiveJsonKey(visibleAV1nMessage.data.snapshot_patch), false, 'visible(A) v1nConfig patch must not expose sensitive keys');
  assert.equal(containsSensitiveJsonValue(visibleAV1nMessage.data.snapshot_patch), false, 'visible(A) v1nConfig patch must not expose sensitive values');
  assert.equal(containsSensitiveJsonKey(visibleAMessage.data.snapshot_patch), false, 'visible(A) patch must not expose sensitive v1nConfig keys');
  assert.equal(containsSensitiveJsonValue(visibleAMessage.data.snapshot_patch), false, 'visible(A) patch must not expose sensitive v1nConfig values');

  const resetMessage = buildClientSnapshotPatchMessage({
    previousSnapshot: null,
    nextSnapshot: visibleANext,
    baseSnapshotSeq: 0,
    snapshotSeq: 23,
    opId: 'it0418_profile_reset',
    previousPrincipalKey: '',
    currentPrincipalKey: 'guest',
  });
  assert.equal(resetMessage.event, 'snapshot', 'missing profile baseline must fall back to explicit snapshot reset');
  assert.equal(resetMessage.data.patch_kind, 'reset', 'profile reset snapshot must carry observable patch_kind');

  return { key: 'profile_patch_consistency_and_metrics', status: 'PASS' };
}

async function test_frontend_uses_bootstrap_and_visible_model_lazy_load_contract() {
  const requestedUrls = [];
  const visibleResponders = new Map();
  const bootstrapSnapshot = {
    models: {
      '-2': {
        id: -2,
        cells: {
          '0,0,0': {
            p: 0,
            r: 0,
            c: 0,
            labels: {
              ws_apps_registry: {
                k: 'ws_apps_registry',
                t: 'json',
                v: [
                  { model_id: 4100, name: 'Lazy App', slide_capable: true, summary: 'Lazy app summary.' },
                  { model_id: 4200, name: 'Second Lazy App', slide_capable: true, summary: 'Second lazy app summary.' },
                  { model_id: 4300, name: 'Third Lazy App', slide_capable: true, summary: 'Third lazy app summary.' },
                  { model_id: 4400, name: 'Fourth Lazy App', slide_capable: true, summary: 'Fourth lazy app summary.' },
                ],
              },
            },
          },
        },
      },
    },
    v1nConfig: {},
  };
  const visibleSnapshot = createVisibleModelSnapshot(4100, 'Lazy App');
  const visibleSnapshot4100And4200 = createVisibleModelSnapshot(4100, 'Lazy App');
  visibleSnapshot4100And4200.models['4200'] = createVisibleModelSnapshot(4200, 'Second Lazy App').models['4200'];
  const visibleSnapshot4100To4300 = createVisibleModelSnapshot(4100, 'Lazy App');
  visibleSnapshot4100To4300.models['4200'] = createVisibleModelSnapshot(4200, 'Second Lazy App From Newer Response').models['4200'];
  visibleSnapshot4100To4300.models['4300'] = createVisibleModelSnapshot(4300, 'Third Lazy App').models['4300'];
  const visibleSnapshot4200 = createVisibleModelSnapshot(4200, 'Second Lazy App');
  const visibleSnapshot4300 = createVisibleModelSnapshot(4300, 'Third Lazy App');
  const visibleSnapshot4400 = createVisibleModelSnapshot(4400, 'Fourth Lazy App');
  let latestSnapshotPatchListener = null;

  globalThis.EventSource = class MockEventSource {
    constructor(url) {
      requestedUrls.push(String(url));
    }
    addEventListener(type, listener) {
      if (type === 'snapshot_patch') latestSnapshotPatchListener = listener;
    }
    close() {}
  };
  globalThis.fetch = async (rawUrl) => {
    const url = String(rawUrl);
    requestedUrls.push(url);
    if (url.endsWith('/snapshot?profile=bootstrap')) {
      return jsonResponse({ snapshot: bootstrapSnapshot, snapshot_seq: 1, patch_kind: 'snapshot' });
    }
    if (url.endsWith('/snapshot?profile=visible&model_id=4100')) {
      return jsonResponse({ snapshot: visibleSnapshot, snapshot_seq: 2, patch_kind: 'visible_model' });
    }
    if (url.endsWith('/snapshot?profile=visible&model_id=4100&model_id=4200')) {
      return new Promise((resolve) => {
        visibleResponders.set(4200, () => resolve(jsonResponse({
          snapshot: visibleSnapshot4100And4200,
          snapshot_seq: 4,
          patch_kind: 'visible_model',
        })));
      });
    }
    if (url.endsWith('/snapshot?profile=visible&model_id=4100&model_id=4200&model_id=4300')) {
      return new Promise((resolve) => {
        visibleResponders.set(4300, () => resolve(jsonResponse({
          snapshot: visibleSnapshot4100To4300,
          snapshot_seq: 5,
          patch_kind: 'visible_model',
        })));
      });
    }
    if (url.endsWith('/snapshot?profile=visible&model_id=4100&model_id=4200&model_id=4300&model_id=4400')) {
      return jsonErrorResponse(403, { ok: false, error: 'model_not_visible' });
    }
    if (url.endsWith('/snapshot?profile=visible&model_id=4200')) {
      return jsonResponse({
        snapshot: visibleSnapshot4200,
        snapshot_seq: 7,
        patch_kind: 'visible_model',
      });
    }
    if (url.endsWith('/snapshot?profile=visible&model_id=4300')) {
      return jsonResponse({
        snapshot: visibleSnapshot4300,
        snapshot_seq: 7,
        patch_kind: 'visible_model',
      });
    }
    if (url.endsWith('/snapshot?profile=visible&model_id=4400')) {
      return jsonResponse({
        snapshot: visibleSnapshot4400,
        snapshot_seq: 7,
        patch_kind: 'visible_model',
      });
    }
    return jsonResponse({ ok: false, error: 'unexpected_url', url });
  };
  try {
    const store = createRemoteStore({ baseUrl: 'http://example.test' });
    await waitUntil(
      () => requestedUrls.includes('http://example.test/snapshot') || requestedUrls.includes('http://example.test/snapshot?profile=bootstrap'),
      'remote_store startup must fetch a startup snapshot',
    );
    assert.equal(
      requestedUrls.includes('http://example.test/snapshot?profile=bootstrap'),
      true,
      'remote_store startup snapshot must request bootstrap profile',
    );
    assert.equal(
      requestedUrls.includes('http://example.test/snapshot'),
      false,
      'remote_store startup must not fetch bare full-profile snapshot',
    );
    await waitUntil(
      () => requestedUrls.some((url) => url.startsWith('http://example.test/stream')),
      'remote_store startup must open an SSE stream',
    );
    assert.equal(
      requestedUrls.includes('http://example.test/stream?profile=bootstrap'),
      true,
      'remote_store startup stream must request bootstrap profile',
    );
    assert.equal(
      requestedUrls.includes('http://example.test/stream'),
      false,
      'remote_store startup must not open bare full-profile stream',
    );
    assertNoImplicitFullProfileRequests(requestedUrls, 'remote_store startup');
    await store.refreshSnapshot('it0418 manual refresh');
    assert.equal(
      requestedUrls.filter((url) => url === 'http://example.test/snapshot?profile=bootstrap').length >= 2,
      true,
      'remote_store refreshSnapshot must keep using bootstrap profile and must not fall back to bare full snapshot',
    );
    assert.equal(
      requestedUrls.includes('http://example.test/snapshot'),
      false,
      'remote_store refreshSnapshot must not fetch bare full-profile snapshot',
    );
    assertNoImplicitFullProfileRequests(requestedUrls, 'remote_store refreshSnapshot');
    assert.equal(typeof store.ensureVisibleModelLoaded, 'function', 'remote_store must expose ensureVisibleModelLoaded(modelId)');
    assert.equal(store.hasSnapshotModel(4100), false, 'bootstrap fixture must not include lazy app model before visible fetch');
    await store.ensureVisibleModelLoaded(4100);
    assert.equal(requestedUrls.includes('http://example.test/snapshot?profile=visible&model_id=4100'), true, 'remote_store must fetch visible model on demand');
    assert.equal(store.hasSnapshotModel(4100), true, 'visible model fetch must hydrate the requested model');
    assertNoImplicitFullProfileRequests(requestedUrls, 'remote_store visible lazy hydration');
    await waitUntil(
      () => hasRequestedStreamWithVisibleModelId(requestedUrls, 4100),
      'remote_store stream must stay bootstrap-profiled and include loaded visible model id after visible fetch',
    );
    assertStreamUrlIncludesVisibleModelIds(
      latestRequestedStreamUrl(requestedUrls),
      [4100],
      'latest remote_store stream must subscribe to the first visible model id',
    );
    assertVisibleSubscriptionState(store, [4100], 'visible subscription state must match first visible model id');
    const visibleLoad4200 = store.ensureVisibleModelLoaded(4200);
    await waitUntil(
      () => visibleResponders.has(4200),
      'remote_store must start the second visible model request before it resolves',
    );
    const visibleLoad4300 = store.ensureVisibleModelLoaded(4300);
    await waitUntil(
      () => visibleResponders.has(4300),
      'remote_store must start the third visible model request before the second request resolves',
    );
    visibleResponders.get(4300)();
    assert.equal(await visibleLoad4300, true, 'newer visible model request must resolve');
    assert.equal(store.hasSnapshotModel(4300), true, 'newer visible model response must hydrate its model');
    await waitUntil(
      () => store.projectionStore.getLabelValue({ model_id: 4200, p: 0, r: 0, c: 0, k: 'app_name' }) === 'Second Lazy App From Newer Response',
      'newer visible response must be able to update an already requested model before older response arrives',
    );
    visibleResponders.get(4200)();
    assert.equal(await visibleLoad4200, true, 'older visible model request must also resolve');
    assert.equal(store.hasSnapshotModel(4200), true, 'older visible model response must hydrate its model');
    assert.equal(
      store.hasSnapshotModel(4300),
      true,
      'late older visible model response must not delete models loaded by a newer visible response',
    );
    assert.equal(
      store.projectionStore.getLabelValue({ model_id: 4200, p: 0, r: 0, c: 0, k: 'app_name' }),
      'Second Lazy App From Newer Response',
      'late older visible model response must not overwrite a model already updated by a newer visible response',
    );
    assert.equal(typeof latestSnapshotPatchListener, 'function', 'remote_store must keep a snapshot_patch listener after visible stream reconnects');
    latestSnapshotPatchListener({
      data: JSON.stringify({
        snapshot_patch: {
          patch_kind: 'json_replace_v1',
          base_snapshot_seq: 5,
          snapshot_seq: 6,
          ops: [{
            op: 'replace_label',
            model_id: 4300,
            cell_key: '0,0,0',
            label_key: 'app_name',
            value: { k: 'app_name', t: 'str', v: 'Patched Third Lazy App' },
          }],
        },
      }),
    });
    await waitUntil(
      () => store.projectionStore.getLabelValue({ model_id: 4300, p: 0, r: 0, c: 0, k: 'app_name' }) === 'Patched Third Lazy App',
      'late older visible response must not regress snapshot_seq; next newer-base patch must still apply',
    );
    await waitUntil(
      () => hasRequestedStreamWithVisibleModelId(requestedUrls, 4200) && hasRequestedStreamWithVisibleModelId(requestedUrls, 4300),
      'remote_store stream must include every loaded visible model id after out-of-order visible fetches',
    );
    assertStreamUrlIncludesVisibleModelIds(
      latestRequestedStreamUrl(requestedUrls),
      [4100, 4200, 4300],
      'latest remote_store stream must subscribe to every currently visible model id after out-of-order visible fetches',
    );
    assertVisibleSubscriptionState(store, [4100, 4200, 4300], 'visible subscription state must match every currently visible model id');
    assert.equal(await store.ensureVisibleModelLoaded(4400), true, 'visible lazy load must recover when a stale visible id makes the combined request fail');
    assert.equal(
      requestedUrls.includes('http://example.test/snapshot?profile=visible&model_id=4100&model_id=4200&model_id=4300&model_id=4400'),
      true,
      'test fixture must first reproduce the combined visible request with stale ids',
    );
    assert.equal(
      requestedUrls.includes('http://example.test/snapshot?profile=visible&model_id=4400'),
      true,
      'remote_store must retry target-only visible fetch after stale id model_not_visible',
    );
    assert.equal(
      requestedUrls.filter((url) => url === 'http://example.test/snapshot?profile=visible&model_id=4100').length >= 2,
      true,
      'remote_store must revalidate already hydrated visible model 4100 after stale id recovery',
    );
    assert.equal(
      requestedUrls.includes('http://example.test/snapshot?profile=visible&model_id=4200'),
      true,
      'remote_store must revalidate already hydrated visible model 4200 after stale id recovery',
    );
    assert.equal(
      requestedUrls.includes('http://example.test/snapshot?profile=visible&model_id=4300'),
      true,
      'remote_store must revalidate already hydrated visible model 4300 after stale id recovery',
    );
    assert.equal(store.hasSnapshotModel(4100), true, 'stale-id recovery must keep valid existing visible model 4100');
    assert.equal(store.hasSnapshotModel(4200), true, 'stale-id recovery must keep valid existing visible model 4200');
    assert.equal(store.hasSnapshotModel(4300), true, 'stale-id recovery must keep valid existing visible model 4300');
    assert.equal(store.hasSnapshotModel(4400), true, 'target-only retry must hydrate the requested visible model');
    await waitUntil(
      () => hasRequestedStreamWithVisibleModelId(requestedUrls, 4100)
        && hasRequestedStreamWithVisibleModelId(requestedUrls, 4200)
        && hasRequestedStreamWithVisibleModelId(requestedUrls, 4300)
        && hasRequestedStreamWithVisibleModelId(requestedUrls, 4400),
      'remote_store stream must reconnect with the recovered visible model id without losing existing visible ids',
    );
    assertStreamUrlIncludesVisibleModelIds(
      latestRequestedStreamUrl(requestedUrls),
      [4100, 4200, 4300, 4400],
      'latest remote_store stream must subscribe to every recovered visible model id',
    );
    assertVisibleSubscriptionState(store, [4100, 4200, 4300, 4400], 'visible subscription state must match every recovered visible model id');

    assertDemoAppForegroundLazyLoadSourceContract();
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
  }
  return { key: 'frontend_uses_bootstrap_and_visible_model_lazy_load_contract', status: 'PASS' };
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

function jsonErrorResponse(status, body) {
  return {
    ok: false,
    status,
    statusText: 'Error',
    headers: { get: () => 'application/json' },
    async json() { return body; },
    async text() { return JSON.stringify(body); },
  };
}

function hasRequestedStreamWithVisibleModelId(urls, modelId) {
  const expected = String(modelId);
  return urls.some((rawUrl) => {
    let url;
    try {
      url = new URL(String(rawUrl));
    } catch (_) {
      return false;
    }
    if (url.origin !== 'http://example.test' || url.pathname !== '/stream') return false;
    if (url.searchParams.get('profile') !== 'bootstrap') return false;
    return url.searchParams.getAll('visible_model_id').includes(expected);
  });
}

function latestRequestedStreamUrl(urls) {
  for (let idx = urls.length - 1; idx >= 0; idx -= 1) {
    const rawUrl = urls[idx];
    let url;
    try {
      url = new URL(String(rawUrl));
    } catch (_) {
      continue;
    }
    if (url.origin === 'http://example.test' && url.pathname === '/stream') return String(rawUrl);
  }
  return '';
}

function assertStreamUrlIncludesVisibleModelIds(rawUrl, modelIds, message) {
  assert.ok(rawUrl, `${message}: missing stream url`);
  const url = new URL(String(rawUrl));
  assert.equal(url.pathname, '/stream', `${message}: wrong stream path`);
  assert.equal(url.searchParams.get('profile'), 'bootstrap', `${message}: stream must remain bootstrap-profiled`);
  const actual = url.searchParams.getAll('visible_model_id').map((value) => Number.parseInt(value, 10)).sort((a, b) => a - b);
  assert.deepEqual(actual, [...modelIds].sort((a, b) => a - b), message);
}

function assertVisibleSubscriptionState(store, modelIds, message) {
  assert.equal(typeof store.getVisibleSubscriptionState, 'function', `${message}: missing visible subscription debug state`);
  const state = store.getVisibleSubscriptionState();
  assert.deepEqual(state.visibleModelIds, [...modelIds].sort((a, b) => a - b), `${message}: visible ids`);
  assertStreamUrlIncludesVisibleModelIds(state.expectedStreamUrl, modelIds, `${message}: expected stream url`);
  assertStreamUrlIncludesVisibleModelIds(state.eventSourceUrl, modelIds, `${message}: active event source url`);
}

function assertNoImplicitFullProfileRequests(urls, context) {
  for (const rawUrl of urls) {
    let url;
    try {
      url = new URL(String(rawUrl));
    } catch (_) {
      continue;
    }
    if (url.origin !== 'http://example.test') continue;
    if (url.pathname !== '/snapshot' && url.pathname !== '/stream') continue;
    const profile = url.searchParams.get('profile');
    if (profile !== 'bootstrap' && profile !== 'visible') {
      assert.fail(`${context} must not make implicit full-profile request: ${rawUrl}`);
    }
  }
}

function extractFunctionBody(source, name) {
  const pattern = new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`, 'u');
  const match = pattern.exec(source);
  assert.ok(match, `source must contain function ${name}`);
  let depth = 1;
  let index = match.index + match[0].length;
  const start = index;
  while (index < source.length && depth > 0) {
    const ch = source[index];
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    index += 1;
  }
  assert.equal(depth, 0, `source function ${name} body must be balanced`);
  return source.slice(start, index - 1);
}

function assertDemoAppForegroundLazyLoadSourceContract() {
  const sourcePath = new URL('../../packages/ui-model-demo-frontend/src/demo_app.js', import.meta.url);
  const source = readFileSync(sourcePath, 'utf8');
  assert.match(
    source,
    /export\s+(async\s+)?function\s+ensureForegroundAppVisibleModelLoaded\s*\(/u,
    'demo app shell must export ensureForegroundAppVisibleModelLoaded for foreground workspace lazy-load wiring',
  );
  const helperBody = extractFunctionBody(source, 'ensureForegroundAppVisibleModelLoaded');
  assert.match(helperBody, /ensureVisibleModelLoaded\s*\(/u, 'foreground lazy-load helper must call store.ensureVisibleModelLoaded(modelId) inside its own function body');
  const ensureIndex = helperBody.indexOf('ensureVisibleModelLoaded');
  const hasSnapshotIndex = helperBody.indexOf('hasSnapshotModel');
  assert.equal(
    ensureIndex >= 0 && (hasSnapshotIndex < 0 || ensureIndex < hasSnapshotIndex),
    true,
    'foreground helper must prefer store.ensureVisibleModelLoaded so existing model bodies still join the visible stream subscription',
  );
  const syncBody = extractFunctionBody(source, 'syncDesktopForeground');
  assert.match(syncBody, /ensureForegroundAppVisibleModelLoaded\s*\(/u, 'syncDesktopForeground must call ensureForegroundAppVisibleModelLoaded inside its own function body');
  const playerBody = extractFunctionBody(source, 'ForegroundPlayer');
  assert.match(playerBody, /hasSnapshotModel\s*\([^)]*app\.model_id[^)]*\)/u, 'ForegroundPlayer must check store.hasSnapshotModel(app.model_id) inside its own function body');
  assert.match(playerBody, /foreground_visible_model_loading/u, 'ForegroundPlayer must render a loading state while foreground workspace model is still lazy-loading');
}

const tests = [
  test_snapshot_profiles_expose_bootstrap_and_visible_shapes,
  test_visible_profile_rejects_invalid_and_disallowed_targets,
  test_visible_profile_rejects_existing_capability_disallowed_model,
  test_stream_bootstrap_initial_event_avoids_full_snapshot_path,
  test_stream_visible_model_id_rejects_invalid_and_disallowed_targets,
  test_profile_patch_consistency_and_metrics,
  test_frontend_uses_bootstrap_and_visible_model_lazy_load_contract,
];

let failures = 0;
for (const test of tests) {
  try {
    const result = await test();
    console.log(`PASS ${result.key}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${test.name.replace(/^test_/, '')}: ${error && error.stack ? error.stack : error}`);
  }
}

if (failures > 0) {
  console.error(`FAIL ${failures}/${tests.length}`);
  process.exit(1);
}

console.log(`PASS ${tests.length}/${tests.length}`);
