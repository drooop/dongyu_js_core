#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHAT_BUS_KEY = 'matrix_chat_1083_bus_event';

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
    sub: payload.sub || '268746183297-drop',
    exp: now + 300,
    iat: now,
    nonce,
    email: 'drop.yang@dongyudigital.com',
    email_verified: true,
    name: 'drop',
    preferred_username: 'drop',
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

function serverBaseUrl(server) {
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

function waitListening(server) {
  if (server.listening) return Promise.resolve();
  return new Promise((resolve) => server.once('listening', resolve));
}

async function readJson(resp) {
  const text = await resp.text();
  return text ? JSON.parse(text) : {};
}

async function withServerEnv(env, fn) {
  const prior = {};
  for (const key of Object.keys(env)) {
    prior[key] = process.env[key];
    process.env[key] = env[key];
  }
  try {
    const suffix = `?t=${Date.now()}-${Math.random()}`;
    const mod = await import(`../../packages/ui-model-demo-server/server.mjs${suffix}`);
    return await fn(mod);
  } finally {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function createMockOidcProvider({ roles }) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = `test-key-${Math.random()}`;
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
      const idToken = signJwt({ roles }, {
        privateKey,
        kid,
        issuer,
        audience: 'dongyu-app',
        nonce: issuedNonce,
      });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        access_token: 'mock-zitadel-access-token',
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
  const start = await fetch(`${appBase}/auth/sso/start?returnTo=%2Fworkspace`, { redirect: 'manual' });
  assert.equal(start.status, 302, 'mock_oidc_start_must_redirect');
  const location = new URL(start.headers.get('location'));
  provider.setNonce(location.searchParams.get('nonce'));
  const state = location.searchParams.get('state');
  const oidcCookie = start.headers.get('set-cookie') || '';
  const callback = await fetch(`${appBase}/auth/sso/callback?code=valid-code&state=${encodeURIComponent(state)}`, {
    redirect: 'manual',
    headers: { cookie: oidcCookie },
  });
  assert.equal(callback.status, 302, 'mock_oidc_login_must_succeed');
  return callback.headers.get('set-cookie') || '';
}

async function createMockMatrixHomeserver() {
  let base = '';
  const calls = [];
  const server = await createJsonServer(async (req, res) => {
    const url = new URL(req.url || '/', base);
    calls.push({ method: req.method, pathname: url.pathname, search: url.search });
    if (req.method === 'GET' && url.pathname === '/_matrix/client/v3/login') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        flows: [
          { type: 'm.login.sso' },
          { type: 'm.login.token' },
        ],
      }));
      return;
    }
    if (req.method === 'GET' && url.pathname === '/_matrix/client/v3/login/sso/redirect') {
      const redirectUrl = url.searchParams.get('redirectUrl') || '';
      const target = new URL(redirectUrl);
      target.searchParams.set('loginToken', 'valid-login-token');
      res.writeHead(302, { location: target.toString() });
      res.end();
      return;
    }
    if (req.method === 'POST' && url.pathname === '/_matrix/client/v3/login') {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const body = raw ? JSON.parse(raw) : {};
      calls.push({ method: req.method, pathname: url.pathname, body });
      if (body.type !== 'm.login.token' || body.token !== 'valid-login-token') {
        res.writeHead(403, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ errcode: 'M_FORBIDDEN', error: 'bad token' }));
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        user_id: '@drop:matrix.test',
        access_token: 'matrix-access-token-secret',
        device_id: 'DONGYUDEVICE',
      }));
      return;
    }
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ errcode: 'M_NOT_FOUND' }));
  });
  base = serverBaseUrl(server);
  return { server, base, calls };
}

async function withMockAppAndMatrix(roles, fn, extraEnv = {}) {
  const provider = await createMockOidcProvider({ roles });
  const matrix = await createMockMatrixHomeserver();
  try {
    await withServerEnv({
      DY_AUTH: '1',
      DY_OIDC_ISSUER: provider.issuer,
      DY_OIDC_CLIENT_ID: 'dongyu-app',
      MATRIX_HOMESERVER_URL: matrix.base,
      ...extraEnv,
    }, async ({ startServer }) => {
      const appServer = startServer({ port: 0, dbPath: null, skipFrontendBuild: true });
      await waitListening(appServer);
      const appBase = serverBaseUrl(appServer);
      try {
        await fn({ appBase, provider, matrix });
      } finally {
        appServer.close();
      }
    });
  } finally {
    provider.server.close();
    matrix.server.close();
  }
}

function delayMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mt(k, t, v) {
  return { id: 0, p: 0, r: 0, c: 0, k, t, v };
}

function uiPayload(action, extra = []) {
  return [
    mt('__mt_payload_kind', 'str', 'ui_event.v1'),
    mt('action', 'str', action),
    ...extra,
  ];
}

async function withIsolatedServerState(options, fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0403-matrix-sso-state-'));
  const prior = {
    DY_PERSISTED_ASSET_ROOT: process.env.DY_PERSISTED_ASSET_ROOT,
    WORKER_BASE_WORKSPACE: process.env.WORKER_BASE_WORKSPACE,
    WORKER_BASE_DATA_ROOT: process.env.WORKER_BASE_DATA_ROOT,
    DOCS_ROOT: process.env.DOCS_ROOT,
    STATIC_PROJECTS_ROOT: process.env.STATIC_PROJECTS_ROOT,
    DY_UI_SERVER_WORKER_ID: process.env.DY_UI_SERVER_WORKER_ID,
  };
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0403_matrix_sso_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  process.env.DY_UI_SERVER_WORKER_ID = 'U1';
  try {
    const mod = await import(`../../packages/ui-model-demo-server/server.mjs?state=${Date.now()}-${Math.random()}`);
    const state = mod.createServerState({ dbPath: null, ...options });
    await state.activateRuntimeMode('running');
    return await fn(state);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function getMatrixRedirectState(location) {
  const redirect = new URL(location);
  assert.equal(redirect.pathname, '/_matrix/client/v3/login/sso/redirect');
  const redirectUrl = new URL(redirect.searchParams.get('redirectUrl'));
  assert.equal(redirectUrl.pathname, '/auth/matrix/callback');
  const state = redirectUrl.searchParams.get('state');
  assert.ok(state, 'matrix_sso_redirectUrl_must_include_state');
  return state;
}

async function test_matrix_sso_start_requires_login_and_matrix_capability() {
  await withMockAppAndMatrix(['dongyu.viewer'], async ({ appBase, provider, matrix }) => {
    const guest = await fetch(`${appBase}/auth/matrix/start?homeserverUrl=${encodeURIComponent(matrix.base)}&returnTo=%2Fworkspace`, {
      redirect: 'manual',
    });
    const guestBody = await readJson(guest);
    assert.equal(guest.status, 401);
    assert.equal(guestBody.error, 'login_required');

    const viewerCookie = await loginViaMockOidc(appBase, provider);
    const denied = await fetch(`${appBase}/auth/matrix/start?homeserverUrl=${encodeURIComponent(matrix.base)}&returnTo=%2Fworkspace`, {
      redirect: 'manual',
      headers: { cookie: viewerCookie },
    });
    const deniedBody = await readJson(denied);
    assert.equal(denied.status, 403);
    assert.equal(deniedBody.error, 'permission_denied');
    assert.equal(deniedBody.requiredCapability, 'matrix:connect');
  });
  return { key: 'matrix_sso_start_requires_login_and_matrix_capability', status: 'PASS' };
}

async function test_matrix_sso_start_builds_one_time_state_and_redirects_to_homeserver() {
  await withMockAppAndMatrix(['dongyu.admin'], async ({ appBase, provider, matrix }) => {
    const cookie = await loginViaMockOidc(appBase, provider);
    const start = await fetch(`${appBase}/auth/matrix/start?homeserverUrl=${encodeURIComponent(matrix.base)}&returnTo=%2Fworkspace`, {
      redirect: 'manual',
      headers: { cookie },
    });
    assert.equal(start.status, 302, 'matrix_sso_start_must_redirect');
    const state = getMatrixRedirectState(start.headers.get('location') || '');
    assert.ok(state.length >= 32, 'matrix_sso_state_must_be_unguessable');
    assert.ok(
      matrix.calls.some((call) => call.method === 'GET' && call.pathname === '/_matrix/client/v3/login'),
      'matrix_sso_start_must_check_supported_login_flows',
    );
  });
  return { key: 'matrix_sso_start_builds_one_time_state_and_redirects_to_homeserver', status: 'PASS' };
}

async function test_matrix_sso_start_rejects_unapproved_homeserver_url() {
  await withMockAppAndMatrix(['dongyu.admin'], async ({ appBase, provider }) => {
    const cookie = await loginViaMockOidc(appBase, provider);
    const start = await fetch(`${appBase}/auth/matrix/start?homeserverUrl=${encodeURIComponent('http://127.0.0.1:9')}&returnTo=%2Fworkspace`, {
      redirect: 'manual',
      headers: { cookie },
    });
    const body = await readJson(start);
    assert.equal(start.status, 400);
    assert.equal(body.error, 'homeserver_not_allowed');
  });
  return { key: 'matrix_sso_start_rejects_unapproved_homeserver_url', status: 'PASS' };
}

async function test_matrix_sso_callback_exchanges_login_token_without_exposing_matrix_token() {
  await withMockAppAndMatrix(['dongyu.admin'], async ({ appBase, provider, matrix }) => {
    const cookie = await loginViaMockOidc(appBase, provider);
    const start = await fetch(`${appBase}/auth/matrix/start?homeserverUrl=${encodeURIComponent(matrix.base)}&returnTo=%2Fworkspace`, {
      redirect: 'manual',
      headers: { cookie },
    });
    assert.equal(start.status, 302, 'matrix_sso_start_must_redirect_before_callback');
    const state = getMatrixRedirectState(start.headers.get('location') || '');

    const callback = await fetch(`${appBase}/auth/matrix/callback?state=${encodeURIComponent(state)}&loginToken=valid-login-token`, {
      redirect: 'manual',
    });
    assert.equal(callback.status, 302, 'matrix_sso_callback_must_redirect_back');
    assert.equal(callback.headers.get('location'), '/workspace');

    const tokenLogin = matrix.calls.find((call) => call.method === 'POST' && call.body);
    assert.deepEqual(
      { type: tokenLogin.body.type, token: tokenLogin.body.token },
      { type: 'm.login.token', token: 'valid-login-token' },
      'matrix_sso_callback_must_exchange_loginToken_with_m_login_token',
    );

    const me = await fetch(`${appBase}/auth/me`, { headers: { cookie } });
    const meBody = await readJson(me);
    assert.equal(me.status, 200);
    assert.equal(meBody.provider, 'zitadel');
    assert.equal(meBody.userId.startsWith('zitadel:'), true);
    assert.equal(meBody.matrixConnected, true);
    assert.equal(meBody.matrixUserId, '@drop:matrix.test');
    assert.equal(JSON.stringify(meBody).includes('matrix-access-token-secret'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(meBody, 'accessToken'), false);

    const status = await fetch(`${appBase}/auth/matrix/status`, { headers: { cookie } });
    const statusBody = await readJson(status);
    assert.equal(status.status, 200);
    assert.equal(statusBody.matrixConnected, true);
    assert.equal(statusBody.matrixUserId, '@drop:matrix.test');
    assert.equal(JSON.stringify(statusBody).includes('matrix-access-token-secret'), false);
  });
  return { key: 'matrix_sso_callback_exchanges_login_token_without_exposing_matrix_token', status: 'PASS' };
}

async function test_matrix_sso_callback_rejects_unknown_replayed_and_deleted_session_state() {
  await withMockAppAndMatrix(['dongyu.admin'], async ({ appBase, provider, matrix }) => {
    const unknown = await fetch(`${appBase}/auth/matrix/callback?state=missing&loginToken=valid-login-token`, {
      redirect: 'manual',
    });
    const unknownBody = await readJson(unknown);
    assert.equal(unknown.status, 400);
    assert.equal(unknownBody.error, 'invalid_matrix_sso_state');

    const cookie = await loginViaMockOidc(appBase, provider);
    const start = await fetch(`${appBase}/auth/matrix/start?homeserverUrl=${encodeURIComponent(matrix.base)}&returnTo=%2Fworkspace`, {
      redirect: 'manual',
      headers: { cookie },
    });
    assert.equal(start.status, 302, 'matrix_sso_start_must_redirect_before_replay_check');
    const state = getMatrixRedirectState(start.headers.get('location') || '');
    const first = await fetch(`${appBase}/auth/matrix/callback?state=${encodeURIComponent(state)}&loginToken=valid-login-token`, {
      redirect: 'manual',
    });
    assert.equal(first.status, 302);
    const replay = await fetch(`${appBase}/auth/matrix/callback?state=${encodeURIComponent(state)}&loginToken=valid-login-token`, {
      redirect: 'manual',
    });
    const replayBody = await readJson(replay);
    assert.equal(replay.status, 400);
    assert.equal(replayBody.error, 'invalid_matrix_sso_state');

    const secondStart = await fetch(`${appBase}/auth/matrix/start?homeserverUrl=${encodeURIComponent(matrix.base)}&returnTo=%2Fworkspace`, {
      redirect: 'manual',
      headers: { cookie },
    });
    assert.equal(secondStart.status, 302, 'matrix_sso_start_must_redirect_before_deleted_session_check');
    const deletedSessionState = getMatrixRedirectState(secondStart.headers.get('location') || '');
    const logout = await fetch(`${appBase}/auth/logout`, { method: 'POST', headers: { cookie } });
    assert.equal(logout.status, 200);
    const deleted = await fetch(`${appBase}/auth/matrix/callback?state=${encodeURIComponent(deletedSessionState)}&loginToken=valid-login-token`, {
      redirect: 'manual',
    });
    const deletedBody = await readJson(deleted);
    assert.equal(deleted.status, 401);
    assert.equal(deletedBody.error, 'matrix_session_missing');
  });
  return { key: 'matrix_sso_callback_rejects_unknown_replayed_and_deleted_session_state', status: 'PASS' };
}

async function test_matrix_sso_callback_rejects_expired_state() {
  await withMockAppAndMatrix(['dongyu.admin'], async ({ appBase, provider, matrix }) => {
    const cookie = await loginViaMockOidc(appBase, provider);
    const start = await fetch(`${appBase}/auth/matrix/start?homeserverUrl=${encodeURIComponent(matrix.base)}&returnTo=%2Fworkspace`, {
      redirect: 'manual',
      headers: { cookie },
    });
    assert.equal(start.status, 302, 'matrix_sso_start_must_redirect_before_expiry_check');
    const state = getMatrixRedirectState(start.headers.get('location') || '');
    await delayMs(10);
    const expired = await fetch(`${appBase}/auth/matrix/callback?state=${encodeURIComponent(state)}&loginToken=valid-login-token`, {
      redirect: 'manual',
    });
    const expiredBody = await readJson(expired);
    assert.equal(expired.status, 400);
    assert.equal(expiredBody.error, 'invalid_matrix_sso_state');
  }, { DY_MATRIX_SSO_PENDING_TTL_MS: '1' });
  return { key: 'matrix_sso_callback_rejects_expired_state', status: 'PASS' };
}

async function test_matrix_sso_disconnect_clears_session_matrix_identity() {
  await withMockAppAndMatrix(['dongyu.admin'], async ({ appBase, provider, matrix }) => {
    const cookie = await loginViaMockOidc(appBase, provider);
    const start = await fetch(`${appBase}/auth/matrix/start?homeserverUrl=${encodeURIComponent(matrix.base)}&returnTo=%2Fworkspace`, {
      redirect: 'manual',
      headers: { cookie },
    });
    assert.equal(start.status, 302, 'matrix_sso_start_must_redirect_before_disconnect');
    const state = getMatrixRedirectState(start.headers.get('location') || '');
    const callback = await fetch(`${appBase}/auth/matrix/callback?state=${encodeURIComponent(state)}&loginToken=valid-login-token`, {
      redirect: 'manual',
    });
    assert.equal(callback.status, 302);

    const disconnected = await fetch(`${appBase}/auth/matrix/disconnect`, {
      method: 'POST',
      headers: { cookie },
    });
    const disconnectedBody = await readJson(disconnected);
    assert.equal(disconnected.status, 200);
    assert.equal(disconnectedBody.ok, true);
    assert.equal(disconnectedBody.matrixConnected, false);

    const me = await fetch(`${appBase}/auth/me`, { headers: { cookie } });
    const meBody = await readJson(me);
    assert.equal(me.status, 200);
    assert.equal(meBody.provider, 'zitadel');
    assert.equal(meBody.matrixConnected, false);
    assert.equal(meBody.matrixUserId, '');
    assert.equal(meBody.homeserverUrl, '');
  });
  return { key: 'matrix_sso_disconnect_clears_session_matrix_identity', status: 'PASS' };
}

async function test_matrix_chat_does_not_reuse_previous_session_token_when_current_session_has_none() {
  await withIsolatedServerState({
    matrixSuiteMatrixImpl: {
      refreshRooms: async () => ({ ok: true, rooms: [], events: [] }),
    },
  }, async (state) => {
    state.programEngine.matrixSuiteSession = {
      homeserverUrl: 'https://matrix.example',
      accessToken: 'previous-session-token',
      userId: '@previous:example',
      displayName: '@previous:example',
    };
    await state.submitEnvelope({
      type: 'bus_event_v2',
      bus_in_key: CHAT_BUS_KEY,
      value: uiPayload('refresh_rooms'),
      meta: { op_id: `it0403_no_leak_${Date.now()}` },
    }, { matrixSession: null });
    assert.equal(state.programEngine.matrixSuiteSession, null, 'current request without Matrix session must clear stale Matrix identity');
  });
  return { key: 'matrix_chat_does_not_reuse_previous_session_token_when_current_session_has_none', status: 'PASS' };
}

async function test_mgmt_bus_refresh_uses_explicit_session_matrix_identity() {
  let seenSession = null;
  await withIsolatedServerState({
    mgmtBusConsoleJoinedRoomsImpl: async (session) => {
      seenSession = session;
      return { ok: true, rooms: [] };
    },
  }, async (state) => {
    const explicitSession = {
      homeserverUrl: 'https://matrix.example',
      accessToken: 'session-matrix-token',
      userId: '@session:matrix.example',
      displayName: '@session:matrix.example',
    };
    const result = await state.refreshMgmtBusConsoleChannels(explicitSession);
    assert.equal(result.ok, true);
    assert.equal(seenSession?.accessToken, 'session-matrix-token');
    assert.equal(seenSession?.userId, '@session:matrix.example');
  });
  return { key: 'mgmt_bus_refresh_uses_explicit_session_matrix_identity', status: 'PASS' };
}

async function test_concurrent_matrix_chat_actions_keep_each_request_session() {
  const observations = [];
  let firstStartedResolve = null;
  const firstStarted = new Promise((resolve) => { firstStartedResolve = resolve; });
  let stateRef = null;
  await withIsolatedServerState({
    matrixSuiteMatrixImpl: {
      refreshRooms: async () => {
        const before = stateRef.programEngine.matrixSuiteSession?.accessToken || '';
        if (observations.length === 0 && typeof firstStartedResolve === 'function') {
          firstStartedResolve();
          await delayMs(30);
        }
        const after = stateRef.programEngine.matrixSuiteSession?.accessToken || '';
        observations.push({ before, after });
        return { ok: true, rooms: [], events: [] };
      },
    },
  }, async (state) => {
    stateRef = state;
    const first = state.submitEnvelope({
      type: 'bus_event_v2',
      bus_in_key: CHAT_BUS_KEY,
      value: uiPayload('refresh_rooms'),
      meta: { op_id: `it0403_concurrent_a_${Date.now()}` },
    }, {
      matrixSession: {
        homeserverUrl: 'https://matrix.example',
        accessToken: 'matrix-token-a',
        userId: '@a:matrix.example',
      },
    });
    await firstStarted;
    const second = state.submitEnvelope({
      type: 'bus_event_v2',
      bus_in_key: CHAT_BUS_KEY,
      value: uiPayload('refresh_rooms'),
      meta: { op_id: `it0403_concurrent_b_${Date.now()}` },
    }, {
      matrixSession: {
        homeserverUrl: 'https://matrix.example',
        accessToken: 'matrix-token-b',
        userId: '@b:matrix.example',
      },
    });
    await Promise.all([first, second]);
    await delayMs(80);
  });
  assert.deepEqual(observations, [
    { before: 'matrix-token-a', after: 'matrix-token-a' },
    { before: 'matrix-token-b', after: 'matrix-token-b' },
  ]);
  return { key: 'concurrent_matrix_chat_actions_keep_each_request_session', status: 'PASS' };
}

async function test_mgmt_bus_refresh_without_explicit_session_does_not_use_runtime_token_when_auth_enabled() {
  let called = false;
  await withIsolatedServerState({
    mgmtBusConsoleJoinedRoomsImpl: async () => {
      called = true;
      return { ok: true, rooms: [] };
    },
  }, async (state) => {
    const model0 = state.runtime.getModel(0);
    state.runtime.addLabel(model0, 0, 0, 0, { k: 'matrix_server', t: 'matrix.server', v: 'https://matrix.example' });
    state.runtime.addLabel(model0, 0, 0, 0, { k: 'matrix_user', t: 'matrix.user', v: '@runtime:matrix.example' });
    state.runtime.addLabel(model0, 0, 0, 0, { k: 'matrix_token', t: 'matrix.token', v: 'runtime-token-should-not-render' });
    const result = await state.refreshMgmtBusConsoleChannels();
    assert.equal(result.ok, false);
    assert.equal(result.code, 'matrix_session_missing');
    assert.equal(called, false, 'AUTH-enabled user projection must not use runtime Matrix token without explicit session');
  });
  return { key: 'mgmt_bus_refresh_without_explicit_session_does_not_use_runtime_token_when_auth_enabled', status: 'PASS' };
}

const tests = [
  test_matrix_sso_start_requires_login_and_matrix_capability,
  test_matrix_sso_start_builds_one_time_state_and_redirects_to_homeserver,
  test_matrix_sso_start_rejects_unapproved_homeserver_url,
  test_matrix_sso_callback_exchanges_login_token_without_exposing_matrix_token,
  test_matrix_sso_callback_rejects_unknown_replayed_and_deleted_session_state,
  test_matrix_sso_callback_rejects_expired_state,
  test_matrix_sso_disconnect_clears_session_matrix_identity,
  test_matrix_chat_does_not_reuse_previous_session_token_when_current_session_has_none,
  test_mgmt_bus_refresh_uses_explicit_session_matrix_identity,
  test_concurrent_matrix_chat_actions_keep_each_request_session,
  test_mgmt_bus_refresh_without_explicit_session_does_not_use_runtime_token_when_auth_enabled,
];

let passed = 0;
const failures = [];

for (const test of tests) {
  try {
    const result = await test();
    passed += 1;
    console.log(`PASS ${result.key}`);
  } catch (error) {
    failures.push({ test: test.name, error });
    console.error(`FAIL ${test.name}:`, error && error.stack ? error.stack : error);
  }
}

if (failures.length > 0) {
  console.error(`test_0403_matrix_sso_bridge: ${passed} passed, ${failures.length} failed out of ${tests.length}`);
  process.exit(1);
}

console.log(`test_0403_matrix_sso_bridge: ${passed} passed, 0 failed out of ${tests.length}`);
