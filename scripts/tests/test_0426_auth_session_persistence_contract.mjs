#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
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
    sub: '0426-drop-user',
    exp: now + 300,
    iat: now,
    nonce,
    email: 'drop.0426@example.test',
    email_verified: true,
    name: 'drop 0426',
    preferred_username: 'drop-0426',
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
      res.end(JSON.stringify({ error: String(error?.message || error) }));
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function serverBaseUrl(server) {
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

async function withEnv(env, fn) {
  const prior = {};
  for (const [key, value] of Object.entries(env)) {
    prior[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
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

async function importAuth(label) {
  return import(`../../packages/ui-model-demo-server/auth.mjs?0426=${encodeURIComponent(label)}-${Date.now()}-${Math.random()}`);
}

async function createOidcFixture() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = 'test-0426-key';
  let issuer = '';
  let issuedNonce = '';
  let tokenCounter = 0;
  let lastIdToken = '';
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
      tokenCounter += 1;
      const idToken = signJwt({}, {
        privateKey,
        kid,
        issuer,
        audience: 'dongyu-app',
        nonce: issuedNonce,
      });
      lastIdToken = idToken;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        access_token: `oidc-access-token-secret-${tokenCounter}`,
        id_token: idToken,
        token_type: 'Bearer',
        expires_in: 300,
      }));
      return;
    }
    if (url.pathname === '/userinfo') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        sub: '0426-drop-user',
        email: 'drop.0426@example.test',
        name: 'drop 0426',
        preferred_username: 'drop-0426',
      }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  issuer = serverBaseUrl(oidcServer);

  return {
    issuer,
    close: () => oidcServer.close(),
    setNonce(value) {
      issuedNonce = value;
    },
    lastIdToken() {
      return lastIdToken;
    },
  };
}

async function createMatrixFixture() {
  let tokenCounter = 0;
  const matrixServer = await createJsonServer(async (req, res) => {
    const base = serverBaseUrl(matrixServer);
    const url = new URL(req.url || '/', base);
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
    if (req.method === 'POST' && url.pathname === '/_matrix/client/v3/login') {
      tokenCounter += 1;
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const payload = raw ? JSON.parse(raw) : {};
      assert.equal(payload.type, 'm.login.token', 'matrix_sso_must_exchange_login_token');
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        access_token: `matrix-access-token-secret-${tokenCounter}`,
        user_id: tokenCounter === 1
          ? '@drop-0426:matrix.example.test'
          : '@drop-0426-updated:matrix.example.test',
        device_id: `DEVICE0426-${tokenCounter}`,
      }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  return {
    baseUrl: serverBaseUrl(matrixServer),
    close: () => matrixServer.close(),
  };
}

function requestFor(cookie = '') {
  return {
    headers: {
      cookie,
      host: '127.0.0.1:30900',
      'x-forwarded-proto': 'http',
    },
  };
}

async function createOidcSession(auth, fixture) {
  const started = await auth.startOidcLogin({
    req: requestFor(),
    returnTo: '/',
    fetchFn: fetch,
  });
  const authUrl = new URL(started.authorizationUrl);
  fixture.setNonce(authUrl.searchParams.get('nonce'));
  const state = authUrl.searchParams.get('state');
  const result = await auth.completeOidcLogin({
    req: requestFor(started.stateCookie),
    code: 'code-0426',
    state,
    fetchFn: fetch,
  });
  const cookie = `dy_session=${result.token}`;
  return { ...result, cookie };
}

function listStoreFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else out.push(full);
    }
  }
  return out.sort();
}

function assertStoreHasFiles(dir) {
  const files = listStoreFiles(dir);
  assert.ok(files.length > 0, 'session_store_must_write_at_least_one_sealed_record');
  return files;
}

function assertStoreDoesNotExposeTokenMaterial(dir, { oidcIdToken = '' } = {}) {
  const joined = listStoreFiles(dir)
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join('\n');
  assert.doesNotMatch(joined, /oidc-access-token-secret/, 'persisted_oidc_access_token_must_not_be_plaintext');
  assert.doesNotMatch(joined, /matrix-access-token-secret/, 'persisted_matrix_access_token_must_not_be_plaintext');
  assert.doesNotMatch(joined, /drop\.0426@example\.test/, 'persisted_user_claims_must_not_be_plaintext');
  if (oidcIdToken) {
    const escaped = oidcIdToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.doesNotMatch(joined, new RegExp(escaped), 'persisted_oidc_id_token_must_not_be_plaintext');
  }
}

function sessionStoreFile(dir) {
  return path.join(dir, 'auth', 'sessions.v1.json');
}

function authSessionKey(secret) {
  return crypto.createHash('sha256').update(String(secret)).digest();
}

function openSessionRecordForTest(value, secret) {
  const parts = String(value || '').split('.');
  assert.equal(parts.length, 4, 'sealed_session_record_must_have_v1_shape');
  assert.equal(parts[0], 'v1', 'sealed_session_record_must_use_v1_prefix');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    authSessionKey(secret),
    Buffer.from(parts[1], 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(parts[3], 'base64url'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(parts[2], 'base64url')),
    decipher.final(),
  ]).toString('utf8');
  const parsed = JSON.parse(plaintext);
  assert.ok(parsed && typeof parsed === 'object', 'sealed_session_record_must_open_to_object');
  return parsed;
}

function sealSessionRecordForTest(session, secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', authSessionKey(secret), iv);
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(session), 'utf8')),
    cipher.final(),
  ]);
  return [
    'v1',
    iv.toString('base64url'),
    ciphertext.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
  ].join('.');
}

function rewriteFirstPersistedSession(dir, secret, transform) {
  const file = sessionStoreFile(dir);
  const body = JSON.parse(fs.readFileSync(file, 'utf8'));
  const [[tokenId, sealed]] = Object.entries(body.sessions || {});
  assert.ok(tokenId && sealed, 'session_store_must_contain_one_record_to_rewrite');
  const opened = openSessionRecordForTest(sealed, secret);
  body.sessions[tokenId] = sealSessionRecordForTest(transform(opened), secret);
  fs.writeFileSync(file, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
}

function authEnv({ fixture, storeDir, secret = 'session-secret-0426', nodeEnv = 'test', matrixBaseUrl = '' }) {
  return {
    NODE_ENV: nodeEnv,
    DY_AUTH: '1',
    DY_OIDC_ISSUER: fixture.issuer,
    DY_OIDC_CLIENT_ID: 'dongyu-app',
    DY_OIDC_REDIRECT_URI: 'http://127.0.0.1:30900/auth/sso/callback',
    DY_OIDC_STATE_SECRET: 'oidc-state-secret-0426',
    DY_AUTH_SESSION_STORE_DIR: storeDir,
    DY_SESSION_SECRET: secret,
    DY_AUTH_SECRET: undefined,
    DY_COOKIE_SECRET: undefined,
    MATRIX_HOMESERVER_URL: matrixBaseUrl,
    DY_MATRIX_SSO_ALLOWED_HOMESERVERS: matrixBaseUrl,
  };
}

async function withAuthFixture(fn) {
  const fixture = await createOidcFixture();
  const storeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dy-0426-auth-sessions-'));
  try {
    return await fn({ fixture, storeDir });
  } finally {
    fixture.close();
    fs.rmSync(storeDir, { recursive: true, force: true });
  }
}

async function test_oidc_session_survives_auth_module_reload() {
  await withAuthFixture(async ({ fixture, storeDir }) => {
    await withEnv(authEnv({ fixture, storeDir }), async () => {
      const authA = await importAuth('oidc-a');
      const session = await createOidcSession(authA, fixture);
      assertStoreHasFiles(storeDir);
      const authB = await importAuth('oidc-b');
      const restored = authB.getSessionWithToken(requestFor(session.cookie));
      assert.equal(restored?.userId, 'zitadel:0426-drop-user', 'oidc_session_must_survive_process_restart');
      assert.equal(restored?.email, 'drop.0426@example.test');
      assert.equal(restored?.matrixConnected, undefined, 'token_session_payload_must_not_include_public_matrix_connected_flag');
      assertStoreDoesNotExposeTokenMaterial(storeDir, { oidcIdToken: fixture.lastIdToken() });
    });
  });
  return { key: 'oidc_session_survives_auth_module_reload', status: 'PASS' };
}

async function test_matrix_sso_attach_and_disconnect_are_durable() {
  const matrix = await createMatrixFixture();
  try {
    await withAuthFixture(async ({ fixture, storeDir }) => {
      await withEnv(authEnv({ fixture, storeDir, matrixBaseUrl: matrix.baseUrl }), async () => {
        const authA = await importAuth('matrix-a');
        const session = await createOidcSession(authA, fixture);
        const started = await authA.startMatrixSso({
          req: requestFor(session.cookie),
          homeserverUrl: matrix.baseUrl,
          returnTo: '/',
          fetchFn: fetch,
        });
        await authA.completeMatrixSso({
          state: started.state,
          loginToken: 'matrix-login-token-0426',
          fetchFn: fetch,
        });
        const authB = await importAuth('matrix-b');
        const connected = authB.getSessionWithToken(requestFor(session.cookie));
        assert.equal(connected?.accessToken, 'matrix-access-token-secret-1', 'matrix_sso_token_must_survive_restart');
        assert.equal(connected?.matrixUserId, '@drop-0426:matrix.example.test');
        assertStoreDoesNotExposeTokenMaterial(storeDir, { oidcIdToken: fixture.lastIdToken() });

        const updateStarted = await authB.startMatrixSso({
          req: requestFor(session.cookie),
          homeserverUrl: matrix.baseUrl,
          returnTo: '/',
          fetchFn: fetch,
        });
        await authB.completeMatrixSso({
          state: updateStarted.state,
          loginToken: 'matrix-login-token-0426-update',
          fetchFn: fetch,
        });
        const authUpdate = await importAuth('matrix-update');
        const updated = authUpdate.getSessionWithToken(requestFor(session.cookie));
        assert.equal(updated?.accessToken, 'matrix-access-token-secret-2', 'matrix_sso_update_token_must_survive_restart');
        assert.equal(updated?.matrixUserId, '@drop-0426-updated:matrix.example.test');
        assert.equal(updated?.matrixDeviceId, 'DEVICE0426-2');

        authUpdate.disconnectMatrix(requestFor(session.cookie));
        const authC = await importAuth('matrix-c');
        const disconnected = authC.getSessionWithToken(requestFor(session.cookie));
        assert.equal(disconnected?.userId, 'zitadel:0426-drop-user', 'matrix_disconnect_must_keep_oidc_session');
        assert.equal(disconnected?.accessToken || '', '', 'matrix_disconnect_must_persist_cleared_access_token');
        assert.equal(disconnected?.matrixUserId || '', '', 'matrix_disconnect_must_persist_cleared_matrix_user');
      });
    });
  } finally {
    matrix.close();
  }
  return { key: 'matrix_sso_attach_and_disconnect_are_durable', status: 'PASS' };
}

async function test_logout_deletes_persisted_session_record() {
  await withAuthFixture(async ({ fixture, storeDir }) => {
    await withEnv(authEnv({ fixture, storeDir }), async () => {
      const authA = await importAuth('logout-a');
      const session = await createOidcSession(authA, fixture);
      assertStoreHasFiles(storeDir);
      await authA.logout(requestFor(session.cookie), { includeOidcLogoutUrl: false });
      const authB = await importAuth('logout-b');
      assert.equal(authB.getSessionWithToken(requestFor(session.cookie)), null, 'logout_must_delete_persisted_session');
    });
  });
  return { key: 'logout_deletes_persisted_session_record', status: 'PASS' };
}

async function test_secret_rotation_and_corrupt_records_reject_session() {
  await withAuthFixture(async ({ fixture, storeDir }) => {
    let cookie = '';
    await withEnv(authEnv({ fixture, storeDir, secret: 'secret-a-0426' }), async () => {
      const authA = await importAuth('secret-a');
      const session = await createOidcSession(authA, fixture);
      cookie = session.cookie;
      assertStoreHasFiles(storeDir);
    });
    await withEnv(authEnv({ fixture, storeDir, secret: 'secret-b-0426' }), async () => {
      const authB = await importAuth('secret-b');
      assert.equal(authB.getSessionWithToken(requestFor(cookie)), null, 'rotated_secret_must_reject_old_sealed_session');
    });
    const [firstFile] = assertStoreHasFiles(storeDir);
    fs.writeFileSync(firstFile, 'corrupt-session-record', 'utf8');
    await withEnv(authEnv({ fixture, storeDir, secret: 'secret-a-0426' }), async () => {
      const authC = await importAuth('corrupt');
      assert.doesNotThrow(() => authC.getSessionWithToken(requestFor(cookie)), 'corrupt_record_must_not_crash_auth_lookup');
      assert.equal(authC.getSessionWithToken(requestFor(cookie)), null, 'corrupt_record_must_reject_session');
    });
  });
  return { key: 'secret_rotation_and_corrupt_records_reject_session', status: 'PASS' };
}

async function test_expired_persisted_session_is_rejected_and_deleted() {
  await withAuthFixture(async ({ fixture, storeDir }) => {
    const secret = 'expiry-secret-0426';
    let cookie = '';
    await withEnv(authEnv({ fixture, storeDir, secret }), async () => {
      const authA = await importAuth('expiry-a');
      const session = await createOidcSession(authA, fixture);
      cookie = session.cookie;
      rewriteFirstPersistedSession(storeDir, secret, (record) => ({
        ...record,
        createdAt: Date.now() - (8 * 24 * 60 * 60 * 1000),
      }));
    });
    await withEnv(authEnv({ fixture, storeDir, secret }), async () => {
      const authB = await importAuth('expiry-b');
      assert.equal(authB.getSessionWithToken(requestFor(cookie)), null, 'expired_persisted_session_must_be_rejected');
      const body = JSON.parse(fs.readFileSync(sessionStoreFile(storeDir), 'utf8'));
      assert.deepEqual(Object.keys(body.sessions || {}), [], 'expired_persisted_session_must_be_deleted_from_store');
    });
  });
  return { key: 'expired_persisted_session_is_rejected_and_deleted', status: 'PASS' };
}

async function test_missing_persisted_store_fails_closed_without_crash() {
  await withAuthFixture(async ({ fixture, storeDir }) => {
    let cookie = '';
    await withEnv(authEnv({ fixture, storeDir }), async () => {
      const authA = await importAuth('missing-store-a');
      const session = await createOidcSession(authA, fixture);
      cookie = session.cookie;
      assertStoreHasFiles(storeDir);
      fs.rmSync(sessionStoreFile(storeDir), { force: true });
    });
    await withEnv(authEnv({ fixture, storeDir }), async () => {
      const authB = await importAuth('missing-store-b');
      assert.doesNotThrow(() => authB.getSessionWithToken(requestFor(cookie)), 'missing_session_store_must_not_crash_lookup');
      assert.equal(authB.getSessionWithToken(requestFor(cookie)), null, 'missing_session_store_must_fail_closed');
    });
  });
  return { key: 'missing_persisted_store_fails_closed_without_crash', status: 'PASS' };
}

async function test_production_persistence_requires_session_secret() {
  await withAuthFixture(async ({ fixture, storeDir }) => {
    await withEnv({
      ...authEnv({ fixture, storeDir, secret: '', nodeEnv: 'production' }),
      DY_OIDC_STATE_SECRET: 'oidc-state-secret-0426',
    }, async () => {
      const auth = await importAuth('missing-secret');
      const started = await auth.startOidcLogin({
        req: requestFor(),
        returnTo: '/',
        fetchFn: fetch,
      });
      const authUrl = new URL(started.authorizationUrl);
      fixture.setNonce(authUrl.searchParams.get('nonce'));
      await assert.rejects(
        () => auth.completeOidcLogin({
          req: requestFor(started.stateCookie),
          code: 'code-0426',
          state: authUrl.searchParams.get('state'),
          fetchFn: fetch,
        }),
        /session_secret_required/,
        'production_session_persistence_must_fail_closed_without_sealing_secret',
      );
    });
  });
  return { key: 'production_persistence_requires_session_secret', status: 'PASS' };
}

const tests = [
  test_oidc_session_survives_auth_module_reload,
  test_matrix_sso_attach_and_disconnect_are_durable,
  test_logout_deletes_persisted_session_record,
  test_secret_rotation_and_corrupt_records_reject_session,
  test_expired_persisted_session_is_rejected_and_deleted,
  test_missing_persisted_store_fails_closed_without_crash,
  test_production_persistence_requires_session_secret,
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
