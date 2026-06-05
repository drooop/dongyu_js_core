#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';

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
    sub: payload.sub || '268746183297-drop',
    exp: now + 300,
    iat: now,
    nonce,
    email: 'drop.yang@dongyudigital.com',
    email_verified: true,
    name: 'drop',
    preferred_username: 'drop',
    'urn:zitadel:iam:org:project:roles': Object.fromEntries(
      (payload.roles || []).map((role) => [role, { 'org:primary': 'Dongyu' }]),
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

function assertSnapshotDoesNotExposeRestrictedContent(snapshot, label) {
  const models = snapshot && snapshot.models ? snapshot.models : {};
  for (const modelId of ['1016', '1020', '1021', '1050', '1080', '1083', '1036', '-100', '-10']) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(models, modelId),
      false,
      `${label}_snapshot_must_hide_model_${modelId}`,
    );
  }
  const serialized = JSON.stringify(snapshot || {}).toLowerCase();
  for (const token of ['matrix chat', 'matrix_userline', 'mgmt_bus', 'func.js', 'password']) {
    assert.equal(serialized.includes(token), false, `${label}_snapshot_must_not_expose_${token}`);
  }
  for (const modelId of ['1016', '1020', '1021', '1050', '1080', '1083', '1036', '-100', '-10']) {
    const directModelReference = new RegExp(`"(model_id|value|id)"\\\\s*:\\\\s*"?${modelId}"?`, 'u');
    assert.equal(directModelReference.test(serialized), false, `${label}_snapshot_must_not_reference_model_${modelId}`);
    const exactModelIdReference = new RegExp(`(^|[^0-9-])${modelId.replace('-', '\\\\-')}([^0-9]|$)`, 'u');
    assert.equal(exactModelIdReference.test(serialized), false, `${label}_snapshot_must_not_contain_model_id_${modelId}`);
  }
}

function createSseSnapshotReader(resp) {
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  return {
    async next() {
      for (;;) {
        const blocks = text.split('\n\n');
        for (let index = 0; index < blocks.length - 1; index += 1) {
          const block = blocks[index];
          text = blocks.slice(index + 1).join('\n\n');
          if (!block.includes('event: snapshot')) break;
          const dataLine = block.split('\n').find((line) => line.startsWith('data: '));
          if (dataLine) return JSON.parse(dataLine.slice(6)).snapshot;
        }
        const { value, done } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
      }
      assert.fail('sse_snapshot_must_include_data_line');
    },
    async close() {
      await reader.cancel().catch(() => {});
    },
  };
}

async function readSseSnapshot(resp) {
  const sse = createSseSnapshotReader(resp);
  try {
    return await sse.next();
  } finally {
    await sse.close();
  }
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
  const location = new URL(start.headers.get('location'));
  provider.setNonce(location.searchParams.get('nonce'));
  const state = location.searchParams.get('state');
  const cookie = start.headers.get('set-cookie') || '';
  const callback = await fetch(`${appBase}/auth/sso/callback?code=valid-code&state=${encodeURIComponent(state)}`, {
    redirect: 'manual',
    headers: { cookie },
  });
  assert.equal(callback.status, 302, 'mock_oidc_login_must_succeed');
  return callback.headers.get('set-cookie') || '';
}

async function test_guest_can_read_filtered_snapshot_but_cannot_write() {
  await withServerEnv({ DY_AUTH: '1' }, async ({ startServer }) => {
    const appServer = startServer({ port: 0, dbPath: null, skipFrontendBuild: true });
    await waitListening(appServer);
    const appBase = serverBaseUrl(appServer);
    try {
      const snapResp = await fetch(`${appBase}/snapshot`);
      const snapBody = await readJson(snapResp);
      assert.equal(snapResp.status, 200, 'guest_snapshot_must_be_public_read');
      assertSnapshotDoesNotExposeRestrictedContent(snapBody.snapshot, 'guest');
      const stateLabels = snapBody.snapshot?.models?.['-2']?.cells?.['0,0,0']?.labels || {};
      const pageCatalog = stateLabels.ui_page_catalog_json?.v;
      assert.equal(Array.isArray(pageCatalog), true, 'guest_snapshot_must_keep_public_page_catalog');
      assert.equal(pageCatalog.some((entry) => entry && entry.path === '/' && entry.page === 'desktop'), true, 'guest_snapshot_must_keep_public_home_route');

      const writeResp = await fetch(`${appBase}/bus_event`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'noop' }),
      });
      const writeBody = await readJson(writeResp);
      assert.equal(writeResp.status, 401);
      assert.equal(writeBody.error, 'login_required');
      assert.equal(writeBody.returnTo, '/bus_event');
    } finally {
      appServer.close();
    }
  });
  return { key: 'guest_can_read_filtered_snapshot_but_cannot_write', status: 'PASS' };
}

async function test_authenticated_viewer_gets_permission_denied_for_restricted_actions() {
  const provider = await createMockOidcProvider({ roles: ['dongyu.viewer'] });
  try {
    await withServerEnv({
      DY_AUTH: '1',
      DY_OIDC_ISSUER: provider.issuer,
      DY_OIDC_CLIENT_ID: 'dongyu-app',
    }, async ({ startServer }) => {
      const appServer = startServer({ port: 0, dbPath: null, skipFrontendBuild: true });
      await waitListening(appServer);
      const appBase = serverBaseUrl(appServer);
      try {
        const cookie = await loginViaMockOidc(appBase, provider);
        const snapResp = await fetch(`${appBase}/snapshot`, { headers: { cookie } });
        const snapBody = await readJson(snapResp);
        assert.equal(snapResp.status, 200, 'viewer_snapshot_must_be_readable');
        assertSnapshotDoesNotExposeRestrictedContent(snapBody.snapshot, 'viewer');

        for (const [label, pathName, body, capability] of [
          ['bus_event', '/bus_event', { type: 'noop' }, 'app:write'],
          ['runtime_mode', '/api/runtime/mode', { mode: 'running' }, 'app:write'],
          ['media_upload', '/api/media/upload', {}, 'matrix:connect'],
        ]) {
          const resp = await fetch(`${appBase}${pathName}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', cookie },
            body: JSON.stringify(body),
          });
          const json = await readJson(resp);
          assert.equal(resp.status, 403, `${label}_must_be_permission_denied`);
          assert.equal(json.error, 'permission_denied');
          assert.equal(json.requiredCapability, capability);
        }
        const deleteHomeserverResp = await fetch(`${appBase}/auth/homeservers?url=${encodeURIComponent('https://matrix.example.test')}`, {
          method: 'DELETE',
          headers: { cookie },
        });
        const deleteHomeserverJson = await readJson(deleteHomeserverResp);
        assert.equal(deleteHomeserverResp.status, 403, 'viewer_delete_homeserver_must_be_permission_denied');
        assert.equal(deleteHomeserverJson.error, 'permission_denied');
        assert.equal(deleteHomeserverJson.requiredCapability, 'matrix:connect');
      } finally {
        appServer.close();
      }
    });
  } finally {
    provider.server.close();
  }
  return { key: 'authenticated_viewer_gets_permission_denied_for_restricted_actions', status: 'PASS' };
}

async function test_dongyu_admin_can_pass_write_gate() {
  const provider = await createMockOidcProvider({ roles: ['dongyu.admin'] });
  try {
    await withServerEnv({
      DY_AUTH: '1',
      DY_OIDC_ISSUER: provider.issuer,
      DY_OIDC_CLIENT_ID: 'dongyu-app',
    }, async ({ startServer }) => {
      const appServer = startServer({ port: 0, dbPath: null, skipFrontendBuild: true });
      await waitListening(appServer);
      const appBase = serverBaseUrl(appServer);
      try {
        const cookie = await loginViaMockOidc(appBase, provider);
        const resp = await fetch(`${appBase}/bus_event`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie },
          body: JSON.stringify({ type: 'noop' }),
        });
        assert.notEqual(resp.status, 401);
        assert.notEqual(resp.status, 403);
      } finally {
        appServer.close();
      }
    });
  } finally {
    provider.server.close();
  }
  return { key: 'dongyu_admin_can_pass_write_gate', status: 'PASS' };
}

async function test_dongyu_admin_snapshot_keeps_matrix_chat_refresh_binding() {
  const provider = await createMockOidcProvider({ roles: ['dongyu.admin'] });
  try {
    await withServerEnv({
      DY_AUTH: '1',
      DY_OIDC_ISSUER: provider.issuer,
      DY_OIDC_CLIENT_ID: 'dongyu-app',
    }, async ({ startServer }) => {
      const appServer = startServer({ port: 0, dbPath: null, skipFrontendBuild: true });
      await waitListening(appServer);
      const appBase = serverBaseUrl(appServer);
      try {
        const cookie = await loginViaMockOidc(appBase, provider);
        const snapResp = await fetch(`${appBase}/snapshot`, { headers: { cookie } });
        const snapBody = await readJson(snapResp);
        assert.equal(snapResp.status, 200, 'admin_snapshot_must_be_readable');
        const refreshLabels = snapBody.snapshot?.models?.['1083']?.cells?.['2,0,2']?.labels || {};
        const writeBind = refreshLabels.ui_bind_json?.v?.write || null;
        assert.equal(writeBind?.bus_event_v2, true, 'admin_snapshot_must_keep_matrix_chat_refresh_bus_event_binding');
        assert.equal(writeBind?.bus_in_key, 'matrix_chat_1083_bus_event', 'admin_snapshot_must_keep_matrix_chat_bus_key');
        assert.match(JSON.stringify(writeBind?.value_ref || []), /refresh_rooms/u, 'admin_snapshot_must_keep_refresh_rooms_payload');
      } finally {
        appServer.close();
      }
    });
  } finally {
    provider.server.close();
  }
  return { key: 'dongyu_admin_snapshot_keeps_matrix_chat_refresh_binding', status: 'PASS' };
}

async function test_sse_rechecks_existing_session_after_logout_before_broadcast() {
  const provider = await createMockOidcProvider({ roles: ['dongyu.admin'] });
  try {
    await withServerEnv({
      DY_AUTH: '1',
      DY_OIDC_ISSUER: provider.issuer,
      DY_OIDC_CLIENT_ID: 'dongyu-app',
    }, async ({ startServer }) => {
      const appServer = startServer({ port: 0, dbPath: null, skipFrontendBuild: true });
      await waitListening(appServer);
      const appBase = serverBaseUrl(appServer);
      try {
        const cookie = await loginViaMockOidc(appBase, provider);
        const stream = await fetch(`${appBase}/stream`, { headers: { cookie } });
        const sse = createSseSnapshotReader(stream);
        try {
          const firstSnapshot = await sse.next();
          assert.ok(firstSnapshot.models['1083'], 'admin_sse_must_include_matrix_chat_before_logout');

          const logoutResp = await fetch(`${appBase}/auth/logout`, { method: 'POST', headers: { cookie } });
          assert.equal(logoutResp.status, 200, 'logout_must_succeed');

          const freshAdminCookie = await loginViaMockOidc(appBase, provider);
          const triggerResp = await fetch(`${appBase}/bus_event`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', cookie: freshAdminCookie },
            body: JSON.stringify({ type: 'noop' }),
          });
          assert.notEqual(triggerResp.status, 401, 'fresh_admin_broadcast_trigger_must_not_require_login');
          assert.notEqual(triggerResp.status, 403, 'fresh_admin_broadcast_trigger_must_not_be_permission_denied');

          const secondSnapshot = await sse.next();
          assertSnapshotDoesNotExposeRestrictedContent(secondSnapshot, 'logged_out_existing_sse');
        } finally {
          await sse.close();
        }
      } finally {
        appServer.close();
      }
    });
  } finally {
    provider.server.close();
  }
  return { key: 'sse_rechecks_existing_session_after_logout_before_broadcast', status: 'PASS' };
}

const tests = [
  test_guest_can_read_filtered_snapshot_but_cannot_write,
  test_authenticated_viewer_gets_permission_denied_for_restricted_actions,
  test_dongyu_admin_can_pass_write_gate,
  test_dongyu_admin_snapshot_keeps_matrix_chat_refresh_binding,
  test_sse_rechecks_existing_session_after_logout_before_broadcast,
];

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
