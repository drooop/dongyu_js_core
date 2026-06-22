#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import http from 'node:http';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { createRemoteStore } from '../../packages/ui-model-demo-frontend/src/remote_store.js';

const execFileAsync = promisify(execFile);

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
    sub: 'it0421-user',
    exp: now + 300,
    iat: now,
    nonce,
    ...payload,
  };
  const encoded = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(body))}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(encoded), privateKey);
  return `${encoded}.${base64url(signature)}`;
}

function serverBaseUrl(server) {
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

async function waitListening(server) {
  if (server.listening) return;
  await once(server, 'listening');
}

async function readJson(resp) {
  const text = await resp.text();
  return text ? JSON.parse(text) : {};
}

async function createMockOidcProvider() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = `it0421-${Date.now()}`;
  const publicJwk = publicKey.export({ format: 'jwk' });
  publicJwk.kid = kid;
  publicJwk.alg = 'RS256';
  publicJwk.use = 'sig';
  let issuer = '';
  let issuedNonce = '';
  let currentUser = {
    sub: 'it0421-alice',
    email: 'alice@example.test',
    name: 'Alice',
    preferred_username: 'alice',
  };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', issuer || 'http://127.0.0.1');
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
      for await (const _chunk of req) {
        // Drain request body.
      }
      const idToken = signJwt({
        sub: currentUser.sub,
        email: currentUser.email,
        name: currentUser.name,
        preferred_username: currentUser.preferred_username,
        'urn:zitadel:iam:org:project:375910753992966374:roles': {
          'dongyu.admin': { 'org:primary': 'Dongyu' },
        },
      }, {
        privateKey,
        kid,
        issuer,
        audience: 'dongyu-app',
        nonce: issuedNonce,
      });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        access_token: `mock-access-token-${currentUser.sub}`,
        token_type: 'Bearer',
        expires_in: 300,
        id_token: idToken,
      }));
      return;
    }
    if (url.pathname === '/userinfo') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        ...currentUser,
        'urn:zitadel:iam:org:project:375910753992966374:roles': {
          'dongyu.admin': { 'org:primary': 'Dongyu' },
        },
      }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  server.listen(0, '127.0.0.1');
  await waitListening(server);
  issuer = serverBaseUrl(server);
  return {
    server,
    issuer,
    setNonce(value) {
      issuedNonce = value || '';
    },
    setUser(user) {
      currentUser = { ...user };
    },
  };
}

async function withFreshServerEnv(extraEnvOrFn, maybeFn) {
  const extraEnv = typeof extraEnvOrFn === 'function' ? {} : (extraEnvOrFn || {});
  const fn = typeof extraEnvOrFn === 'function' ? extraEnvOrFn : maybeFn;
  const previous = {
    dyAuth: process.env.DY_AUTH,
    dyOidcIssuer: process.env.DY_OIDC_ISSUER,
    dyOidcClientId: process.env.DY_OIDC_CLIENT_ID,
    dyOidcRedirectUri: process.env.DY_OIDC_REDIRECT_URI,
    dyPersistedAssetRoot: process.env.DY_PERSISTED_ASSET_ROOT,
    dyPrincipalRuntimeInitDelayMs: process.env.DY_PRINCIPAL_RUNTIME_INIT_DELAY_MS,
    dyTestPrincipalRuntimeInitBlockMs: process.env.DY_TEST_PRINCIPAL_RUNTIME_INIT_BLOCK_MS,
    dyTestPrincipalRuntimeInitFail: process.env.DY_TEST_PRINCIPAL_RUNTIME_INIT_FAIL,
    workspace: process.env.WORKER_BASE_WORKSPACE,
    dataRoot: process.env.WORKER_BASE_DATA_ROOT,
    docsRoot: process.env.DOCS_ROOT,
    staticRoot: process.env.STATIC_PROJECTS_ROOT,
  };
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0421-sso-latency-'));
  const provider = await createMockOidcProvider();
  Object.assign(process.env, {
    DY_AUTH: '1',
    DY_OIDC_ISSUER: provider.issuer,
    DY_OIDC_CLIENT_ID: 'dongyu-app',
    DY_OIDC_REDIRECT_URI: 'http://127.0.0.1:0/auth/sso/callback',
    DY_PERSISTED_ASSET_ROOT: '',
    WORKER_BASE_WORKSPACE: `it0421_${Date.now()}`,
    WORKER_BASE_DATA_ROOT: join(tempRoot, 'runtime'),
    DOCS_ROOT: join(tempRoot, 'docs'),
    STATIC_PROJECTS_ROOT: join(tempRoot, 'static'),
    ...extraEnv,
  });
  try {
    const mod = await import(`../../packages/ui-model-demo-server/server.mjs?it0421=${Date.now()}-${Math.random()}`);
    return await fn(mod, provider);
  } finally {
    provider.server.close();
    rmSync(tempRoot, { recursive: true, force: true });
    const restore = (key, value) => {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    };
    restore('DY_AUTH', previous.dyAuth);
    restore('DY_OIDC_ISSUER', previous.dyOidcIssuer);
    restore('DY_OIDC_CLIENT_ID', previous.dyOidcClientId);
    restore('DY_OIDC_REDIRECT_URI', previous.dyOidcRedirectUri);
    restore('DY_PERSISTED_ASSET_ROOT', previous.dyPersistedAssetRoot);
    restore('DY_PRINCIPAL_RUNTIME_INIT_DELAY_MS', previous.dyPrincipalRuntimeInitDelayMs);
    restore('DY_TEST_PRINCIPAL_RUNTIME_INIT_BLOCK_MS', previous.dyTestPrincipalRuntimeInitBlockMs);
    restore('DY_TEST_PRINCIPAL_RUNTIME_INIT_FAIL', previous.dyTestPrincipalRuntimeInitFail);
    restore('WORKER_BASE_WORKSPACE', previous.workspace);
    restore('WORKER_BASE_DATA_ROOT', previous.dataRoot);
    restore('DOCS_ROOT', previous.docsRoot);
    restore('STATIC_PROJECTS_ROOT', previous.staticRoot);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function delayedCurlAuthMe(appBase, cookie, delaySeconds = 0.1) {
  const script = [
    `sleep ${delaySeconds};`,
    'curl -sS',
    "-w '\\nstatus=%{http_code} total=%{time_total}\\n'",
    '-H',
    JSON.stringify(`Cookie: ${cookie}`),
    JSON.stringify(`${appBase}/auth/me`),
  ].join(' ');
  const startedAt = Date.now();
  const { stdout } = await execFileAsync('bash', ['-lc', script], { timeout: 5000 });
  const elapsedMs = Date.now() - startedAt;
  const match = stdout.match(/status=(\d+)\s+total=([0-9.]+)/u);
  return {
    stdout,
    elapsedMs,
    status: match ? Number.parseInt(match[1], 10) : 0,
    totalMs: match ? Math.round(Number.parseFloat(match[2]) * 1000) : elapsedMs,
  };
}

async function loginViaMockOidc(appBase, provider, user) {
  provider.setUser(user);
  const start = await fetch(`${appBase}/auth/sso/start?returnTo=%2F`, { redirect: 'manual' });
  assert.equal(start.status, 302, 'sso_start_must_redirect');
  const authorize = new URL(start.headers.get('location'));
  provider.setNonce(authorize.searchParams.get('nonce'));
  const state = authorize.searchParams.get('state');
  const oidcCookie = start.headers.get('set-cookie') || '';
  const callback = await fetch(`${appBase}/auth/sso/callback?code=valid-code&state=${encodeURIComponent(state)}`, {
    redirect: 'manual',
    headers: { cookie: oidcCookie },
  });
  assert.equal(callback.status, 302, 'sso_callback_must_succeed');
  const sessionCookie = callback.headers.get('set-cookie') || '';
  assert.match(sessionCookie, /dy_session=/, 'sso_callback_must_set_session');
  return sessionCookie;
}

async function waitForSnapshotReady(appBase, cookie, { timeoutMs = 5000 } = {}) {
  const start = Date.now();
  let last = null;
  while (Date.now() - start < timeoutMs) {
    const resp = await fetch(`${appBase}/snapshot?profile=bootstrap`, { headers: { cookie } });
    const body = await readJson(resp);
    last = { status: resp.status, body };
    if (resp.status === 200 && body && body.snapshot && body.snapshot.models) return last;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`snapshot_not_ready:${JSON.stringify(last)}`);
}

async function test_auth_me_does_not_force_principal_runtime_before_snapshot() {
  return withFreshServerEnv(async ({ startServer }, provider) => {
    const appServer = startServer({ port: 0, dbPath: null, skipFrontendBuild: true });
    await waitListening(appServer);
    const appBase = serverBaseUrl(appServer);
    try {
      const cookie = await loginViaMockOidc(appBase, provider, {
        sub: 'it0421-alice',
        email: 'alice@example.test',
        name: 'Alice',
        preferred_username: 'alice',
      });

      const authStarted = Date.now();
      const meResp = await fetch(`${appBase}/auth/me`, { headers: { cookie } });
      const me = await readJson(meResp);
      const authMs = Date.now() - authStarted;
      assert.equal(meResp.status, 200, 'auth_me_must_succeed_for_valid_sso_session');
      assert.equal(me.provider, 'zitadel');
      assert.ok(authMs < 500, `auth_me_must_stay_lightweight_before_runtime_init:${authMs}ms`);

      const firstSnapshotStarted = Date.now();
      const firstSnapshotResp = await fetch(`${appBase}/snapshot?profile=bootstrap&initial_projection=1`, { headers: { cookie } });
      const firstSnapshot = await readJson(firstSnapshotResp);
      const firstSnapshotMs = Date.now() - firstSnapshotStarted;
      assert.equal(firstSnapshotResp.status, 202, 'first_authenticated_snapshot_must_not_block_on_cold_runtime');
      assert.equal(firstSnapshot.code, 'workspace_initializing');
      assert.equal(firstSnapshot.status, 'workspace_initializing');
      assert.ok(firstSnapshot.snapshot && firstSnapshot.snapshot.models, 'initializing_response_may_include_read_only_initial_projection');
      assert.ok(firstSnapshot.snapshot.models['0'], 'initial_projection_must_contain_model_0_for_desktop_shell');
      assert.equal(firstSnapshot.snapshot_projection, 'read_only_initializing');
      assert.equal(firstSnapshot.truth_snapshot, false, 'initializing_projection_must_not_claim_to_be_snapshot_truth');
      assert.ok(firstSnapshotMs < 1000, `initializing_response_must_be_fast:${firstSnapshotMs}ms`);

      const ready = await waitForSnapshotReady(appBase, cookie);
      assert.equal(ready.status, 200, 'snapshot_must_eventually_be_ready');
      assert.ok(ready.body.snapshot.models['0'], 'ready_snapshot_must_contain_model_0');
    } finally {
      appServer.close();
    }
  }).then(() => ({ key: 'auth_me_does_not_force_principal_runtime_before_snapshot', status: 'PASS' }));
}

async function test_bad_session_never_enters_authenticated_workspace_initializing() {
  return withFreshServerEnv(async ({ startServer }) => {
    const appServer = startServer({ port: 0, dbPath: null, skipFrontendBuild: true });
    await waitListening(appServer);
    const appBase = serverBaseUrl(appServer);
    try {
      const badCookie = 'dy_session=definitely-invalid';
      const meResp = await fetch(`${appBase}/auth/me`, { headers: { cookie: badCookie } });
      const me = await readJson(meResp);
      assert.equal(meResp.status, 401, 'invalid_session_auth_me_must_fail');
      assert.equal(me.error, 'not_authenticated');

      const snapResp = await fetch(`${appBase}/snapshot?profile=bootstrap`, { headers: { cookie: badCookie } });
      const snap = await readJson(snapResp);
      assert.notEqual(snap.code, 'workspace_initializing', 'bad_session_must_not_enter_authenticated_initializing');
      assert.notEqual(snap.status, 'workspace_initializing', 'bad_session_must_not_enter_authenticated_initializing_status');
      assert.ok(
        (snapResp.status === 200 && snap.snapshot && snap.snapshot.models) || snapResp.status === 401,
        `bad_session_snapshot_must_be_guest_snapshot_or_auth_failure:${snapResp.status}`,
      );
    } finally {
      appServer.close();
    }
  }).then(() => ({ key: 'bad_session_never_enters_authenticated_workspace_initializing', status: 'PASS' }));
}

async function test_auth_me_stays_fast_while_runtime_initialization_is_scheduled() {
  return withFreshServerEnv({ DY_TEST_PRINCIPAL_RUNTIME_INIT_BLOCK_MS: '900' }, async ({ startServer }, provider) => {
    const appServer = startServer({
      port: 0,
      dbPath: null,
      skipFrontendBuild: true,
      enableTestPrincipalRuntimeInitHooks: true,
    });
    await waitListening(appServer);
    const appBase = serverBaseUrl(appServer);
    try {
      const cookie = await loginViaMockOidc(appBase, provider, {
        sub: 'it0421-concurrent-auth',
        email: 'concurrent@example.test',
        name: 'Concurrent',
        preferred_username: 'concurrent',
      });
      const firstSnapshotResp = await fetch(`${appBase}/snapshot?profile=bootstrap`, { headers: { cookie } });
      const firstSnapshot = await readJson(firstSnapshotResp);
      assert.equal(firstSnapshotResp.status, 202, 'cold_snapshot_must_schedule_runtime_initialization');
      assert.equal(firstSnapshot.code, 'workspace_initializing');

      const authProbe = await delayedCurlAuthMe(appBase, cookie, 0.1);
      assert.equal(authProbe.status, 200, `auth_probe_must_succeed:${authProbe.stdout}`);
      assert.ok(authProbe.totalMs < 500, `auth_me_must_not_wait_for_scheduled_runtime_init:${authProbe.totalMs}ms`);

      const ready = await waitForSnapshotReady(appBase, cookie, { timeoutMs: 8000 });
      assert.equal(ready.status, 200, 'runtime_must_eventually_be_ready_after_scheduled_init');
    } finally {
      appServer.close();
    }
  }).then(() => ({ key: 'auth_me_stays_fast_while_runtime_initialization_is_scheduled', status: 'PASS' }));
}

async function test_runtime_mode_does_not_force_cold_principal_runtime() {
  return withFreshServerEnv({ DY_TEST_PRINCIPAL_RUNTIME_INIT_BLOCK_MS: '900' }, async ({ startServer }, provider) => {
    const appServer = startServer({
      port: 0,
      dbPath: null,
      skipFrontendBuild: true,
      enableTestPrincipalRuntimeInitHooks: true,
    });
    await waitListening(appServer);
    const appBase = serverBaseUrl(appServer);
    try {
      const cookie = await loginViaMockOidc(appBase, provider, {
        sub: 'it0421-runtime-mode-cold',
        email: 'runtime-mode-cold@example.test',
        name: 'Runtime Mode Cold',
        preferred_username: 'runtime-mode-cold',
      });
      const startedAt = Date.now();
      const modeResp = await fetch(`${appBase}/api/runtime/mode`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ mode: 'running' }),
      });
      const mode = await readJson(modeResp);
      const elapsedMs = Date.now() - startedAt;
      assert.equal(modeResp.status, 202, 'runtime_mode_must_not_synchronously_create_cold_principal_runtime');
      assert.equal(mode.code, 'workspace_initializing');
      assert.ok(elapsedMs < 500, `runtime_mode_must_return_before_runtime_creation_finishes:${elapsedMs}ms`);

      const ready = await waitForSnapshotReady(appBase, cookie, { timeoutMs: 8000 });
      assert.equal(ready.status, 200, 'runtime_must_eventually_be_ready_after_runtime_mode_schedule');

      const readyModeResp = await fetch(`${appBase}/api/runtime/mode`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ mode: 'running' }),
      });
      const readyMode = await readJson(readyModeResp);
      assert.equal(readyModeResp.status, 200, 'runtime_mode_must_activate_after_principal_runtime_ready');
      assert.equal(readyMode.mode, 'running');
    } finally {
      appServer.close();
    }
  }).then(() => ({ key: 'runtime_mode_does_not_force_cold_principal_runtime', status: 'PASS' }));
}

async function test_business_event_is_blocked_while_principal_runtime_initializes() {
  return withFreshServerEnv({ DY_TEST_PRINCIPAL_RUNTIME_INIT_BLOCK_MS: '900' }, async ({ startServer }, provider) => {
    const appServer = startServer({
      port: 0,
      dbPath: null,
      skipFrontendBuild: true,
      enableTestPrincipalRuntimeInitHooks: true,
    });
    await waitListening(appServer);
    const appBase = serverBaseUrl(appServer);
    try {
      const cookie = await loginViaMockOidc(appBase, provider, {
        sub: 'it0421-business-event-cold',
        email: 'business-event-cold@example.test',
        name: 'Business Event Cold',
        preferred_username: 'business-event-cold',
      });
      const firstSnapshotResp = await fetch(`${appBase}/snapshot?profile=bootstrap&initial_projection=1`, { headers: { cookie } });
      const firstSnapshot = await readJson(firstSnapshotResp);
      assert.equal(firstSnapshotResp.status, 202, 'cold_snapshot_must_enter_initializing');
      assert.equal(firstSnapshot.code, 'workspace_initializing');

      const eventStartedAt = Date.now();
      const eventResp = await fetch(`${appBase}/bus_event`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ type: 'ui_event_v2', payload: { action: 'noop' } }),
      });
      const eventBody = await readJson(eventResp);
      const elapsedMs = Date.now() - eventStartedAt;
      assert.equal(eventResp.status, 202, 'business_event_must_not_create_writable_runtime_during_initialization');
      assert.equal(eventBody.code, 'workspace_initializing');
      assert.ok(elapsedMs < 500, `business_event_initializing_response_must_be_fast:${elapsedMs}ms`);

      const ready = await waitForSnapshotReady(appBase, cookie, { timeoutMs: 8000 });
      assert.equal(ready.status, 200, 'runtime_must_eventually_be_ready_after_business_event_block');
    } finally {
      appServer.close();
    }
  }).then(() => ({ key: 'business_event_is_blocked_while_principal_runtime_initializes', status: 'PASS' }));
}

async function test_expired_session_never_enters_authenticated_workspace_initializing() {
  return withFreshServerEnv(async ({ startServer }, provider) => {
    const appServer = startServer({ port: 0, dbPath: null, skipFrontendBuild: true });
    await waitListening(appServer);
    const appBase = serverBaseUrl(appServer);
    const realDateNow = Date.now;
    try {
      const cookie = await loginViaMockOidc(appBase, provider, {
        sub: 'it0421-expired',
        email: 'expired@example.test',
        name: 'Expired',
        preferred_username: 'expired',
      });
      Date.now = () => realDateNow() + 8 * 24 * 60 * 60 * 1000;
      const meResp = await fetch(`${appBase}/auth/me`, { headers: { cookie } });
      const me = await readJson(meResp);
      assert.equal(meResp.status, 401, 'expired_session_auth_me_must_fail');
      assert.equal(me.error, 'not_authenticated');

      const snapResp = await fetch(`${appBase}/snapshot?profile=bootstrap`, { headers: { cookie } });
      const snap = await readJson(snapResp);
      assert.notEqual(snap.code, 'workspace_initializing', 'expired_session_must_not_enter_authenticated_initializing');
      assert.notEqual(snap.status, 'workspace_initializing', 'expired_session_must_not_enter_authenticated_initializing_status');
      assert.ok(
        (snapResp.status === 200 && snap.snapshot && snap.snapshot.models) || snapResp.status === 401,
        `expired_session_snapshot_must_be_guest_snapshot_or_auth_failure:${snapResp.status}`,
      );
    } finally {
      Date.now = realDateNow;
      appServer.close();
    }
  }).then(() => ({ key: 'expired_session_never_enters_authenticated_workspace_initializing', status: 'PASS' }));
}

async function test_snapshot_surfaces_initialization_failure_end_to_end() {
  return withFreshServerEnv({ DY_TEST_PRINCIPAL_RUNTIME_INIT_FAIL: '1' }, async ({ startServer }, provider) => {
    const appServer = startServer({
      port: 0,
      dbPath: null,
      skipFrontendBuild: true,
      enableTestPrincipalRuntimeInitHooks: true,
    });
    await waitListening(appServer);
    const appBase = serverBaseUrl(appServer);
    try {
      const cookie = await loginViaMockOidc(appBase, provider, {
        sub: 'it0421-fail-e2e',
        email: 'fail-e2e@example.test',
        name: 'Fail E2E',
        preferred_username: 'fail-e2e',
      });
      const firstResp = await fetch(`${appBase}/snapshot?profile=bootstrap`, { headers: { cookie } });
      const first = await readJson(firstResp);
      assert.equal(firstResp.status, 202, 'first_snapshot_must_start_initialization');
      assert.equal(first.code, 'workspace_initializing');
      await sleep(650);
      const failedResp = await fetch(`${appBase}/snapshot?profile=bootstrap`, { headers: { cookie } });
      const failed = await readJson(failedResp);
      assert.equal(failedResp.status, 503, 'failed_initialization_must_surface_503');
      assert.equal(failed.code, 'workspace_initialization_failed');
      assert.match(failed.error, /dy_test_principal_runtime_init_failed/u);
    } finally {
      appServer.close();
    }
  }).then(() => ({ key: 'snapshot_surfaces_initialization_failure_end_to_end', status: 'PASS' }));
}

async function test_test_runtime_hooks_are_disabled_by_default() {
  return withFreshServerEnv({ DY_TEST_PRINCIPAL_RUNTIME_INIT_FAIL: '1' }, async ({ startServer }, provider) => {
    const appServer = startServer({ port: 0, dbPath: null, skipFrontendBuild: true });
    await waitListening(appServer);
    const appBase = serverBaseUrl(appServer);
    try {
      const cookie = await loginViaMockOidc(appBase, provider, {
        sub: 'it0421-test-hook-default-off',
        email: 'hook-default-off@example.test',
        name: 'Hook Default Off',
        preferred_username: 'hook-default-off',
      });
      const firstResp = await fetch(`${appBase}/snapshot?profile=bootstrap`, { headers: { cookie } });
      const first = await readJson(firstResp);
      assert.equal(firstResp.status, 202, 'cold_snapshot_may_initialize_without_test_hook_failure');
      assert.equal(first.code, 'workspace_initializing');

      const ready = await waitForSnapshotReady(appBase, cookie, { timeoutMs: 8000 });
      assert.equal(ready.status, 200, 'test_hook_env_var_must_not_fail_default_server');
      assert.ok(ready.body && ready.body.snapshot && ready.body.snapshot.models, 'default_server_must_return_snapshot');
    } finally {
      appServer.close();
    }
  }).then(() => ({ key: 'test_runtime_hooks_are_disabled_by_default', status: 'PASS' }));
}

async function test_principal_runtime_initialization_is_not_shared_between_users() {
  return withFreshServerEnv(async ({ startServer }, provider) => {
    const appServer = startServer({ port: 0, dbPath: null, skipFrontendBuild: true });
    await waitListening(appServer);
    const appBase = serverBaseUrl(appServer);
    try {
      const aliceCookie = await loginViaMockOidc(appBase, provider, {
        sub: 'it0421-alice-isolated',
        email: 'alice@example.test',
        name: 'Alice',
        preferred_username: 'alice',
      });
      const aliceMode = await fetch(`${appBase}/api/runtime/mode`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: aliceCookie },
        body: JSON.stringify({ mode: 'running' }),
      });
      assert.equal(aliceMode.status, 202, 'alice_runtime_mode_must_schedule_alice_runtime');
      const aliceReady = await waitForSnapshotReady(appBase, aliceCookie);
      assert.equal(aliceReady.status, 200);
      const aliceReadyMode = await fetch(`${appBase}/api/runtime/mode`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: aliceCookie },
        body: JSON.stringify({ mode: 'running' }),
      });
      assert.equal(aliceReadyMode.status, 200, 'alice_runtime_mode_must_activate_after_runtime_ready');

      const bobCookie = await loginViaMockOidc(appBase, provider, {
        sub: 'it0421-bob-isolated',
        email: 'bob@example.test',
        name: 'Bob',
        preferred_username: 'bob',
      });
      const bobFirstResp = await fetch(`${appBase}/snapshot?profile=bootstrap`, { headers: { cookie: bobCookie } });
      const bobFirst = await readJson(bobFirstResp);
      assert.equal(bobFirstResp.status, 202, 'bob_first_snapshot_must_not_reuse_alice_runtime');
      assert.equal(bobFirst.code, 'workspace_initializing');
      const bobReady = await waitForSnapshotReady(appBase, bobCookie);
      assert.equal(bobReady.status, 200, 'bob_snapshot_must_eventually_be_ready');
    } finally {
      appServer.close();
    }
  }).then(() => ({ key: 'principal_runtime_initialization_is_not_shared_between_users', status: 'PASS' }));
}

async function test_registry_surfaces_principal_runtime_initialization_failure() {
  const mod = await import(`../../packages/ui-model-demo-server/server.mjs?it0421_registry=${Date.now()}-${Math.random()}`);
  const registry = mod.createPrincipalRuntimeRegistry({
    createState() {
      throw new Error('it0421_create_state_failed');
    },
  });
  assert.equal(typeof registry.startRuntimeInitialization, 'function', 'registry_must_expose_async_initialization');
  assert.equal(typeof registry.getRuntimeInitializationStatus, 'function', 'registry_must_expose_initialization_status');
  const principal = { subject: 'it0421-failing-user', email: 'fail@example.test' };
  const started = registry.startRuntimeInitialization(principal);
  assert.equal(started.status, 'initializing');
  await assert.rejects(started.promise, /it0421_create_state_failed/u);
  const status = registry.getRuntimeInitializationStatus(principal);
  assert.equal(status.status, 'failed');
  assert.equal(status.code, 'workspace_initialization_failed');
  assert.match(status.error, /it0421_create_state_failed/u);
  return { key: 'registry_surfaces_principal_runtime_initialization_failure', status: 'PASS' };
}

async function test_frontend_distinguishes_workspace_initializing_from_page_unavailable() {
  const originalFetch = globalThis.fetch;
  const originalEventSource = globalThis.EventSource;
  const calls = [];
  globalThis.EventSource = undefined;
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return {
      ok: false,
      status: 202,
      statusText: 'Accepted',
      async json() {
        return {
          ok: false,
          status: 'workspace_initializing',
          code: 'workspace_initializing',
          retry_after_ms: 1000,
          snapshot_projection: 'read_only_initializing',
          truth_snapshot: false,
          snapshot: { models: { 0: { id: 0, cells: {} } }, v1nConfig: {} },
        };
      },
      async text() {
        return JSON.stringify({
          ok: false,
          status: 'workspace_initializing',
          code: 'workspace_initializing',
          retry_after_ms: 1000,
          snapshot_projection: 'read_only_initializing',
          truth_snapshot: false,
          snapshot: { models: { 0: { id: 0, cells: {} } }, v1nConfig: {} },
        });
      },
    };
  };
  try {
    const store = createRemoteStore({ baseUrl: 'http://it0421.example', autoBootstrap: false });
    assert.ok(store.workspaceStatus, 'remote_store_must_expose_workspace_status');
    await store.refreshSnapshot('it0421 initializing contract');
    assert.equal(store.workspaceStatus.status, 'initializing');
    assert.equal(store.workspaceStatus.code, 'workspace_initializing');
    assert.ok(calls[0].includes('initial_projection=1'), `first_bootstrap_snapshot_must_request_initial_projection:${calls[0]}`);
    assert.ok(store.snapshot.models['0'], 'frontend_must_apply_initial_projection_for_fast_desktop_shell');
    assert.equal(calls.length, 1, 'bootstrap_must_not_spin_immediately_on_initializing');
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
  }
  return { key: 'frontend_distinguishes_workspace_initializing_from_page_unavailable', status: 'PASS' };
}

async function test_frontend_retries_then_stops_on_workspace_initialization_failure() {
  const originalFetch = globalThis.fetch;
  const originalEventSource = globalThis.EventSource;
  const originalWindow = globalThis.window;
  let eventSourceCreated = 0;
  let calls = 0;
  globalThis.window = {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    addEventListener() {},
  };
  globalThis.EventSource = function FakeEventSource() {
    eventSourceCreated += 1;
    return { readyState: 1, close() {} };
  };
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) {
      return {
        ok: false,
        status: 202,
        statusText: 'Accepted',
        async json() {
          return {
            ok: false,
            status: 'workspace_initializing',
            code: 'workspace_initializing',
            retry_after_ms: 20,
            snapshot_projection: 'read_only_initializing',
            truth_snapshot: false,
            snapshot: { models: { 0: { id: 0, cells: {} } }, v1nConfig: {} },
          };
        },
        async text() {
          return JSON.stringify({
            ok: false,
            status: 'workspace_initializing',
            code: 'workspace_initializing',
            retry_after_ms: 20,
            snapshot_projection: 'read_only_initializing',
            truth_snapshot: false,
            snapshot: { models: { 0: { id: 0, cells: {} } }, v1nConfig: {} },
          });
        },
      };
    }
    return {
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      async json() {
        return { ok: false, status: 'workspace_initialization_failed', code: 'workspace_initialization_failed', error: 'boom' };
      },
      async text() {
        return JSON.stringify({ ok: false, status: 'workspace_initialization_failed', code: 'workspace_initialization_failed', error: 'boom' });
      },
    };
  };
  try {
    const store = createRemoteStore({ baseUrl: 'http://it0421.example', autoBootstrap: false });
    await store.refreshSnapshot('it0421 initializing failure retry');
    assert.equal(store.workspaceStatus.status, 'initializing');
    await sleep(80);
    assert.equal(store.workspaceStatus.status, 'failed');
    assert.equal(store.workspaceStatus.code, 'workspace_initialization_failed');
    assert.equal(store.workspaceStatus.message, 'boom');
    assert.equal(calls, 2, 'frontend_must_retry_once_then_stop_on_failure');
    assert.equal(eventSourceCreated, 0, 'frontend_must_not_connect_sse_after_failed_initialization');
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
    globalThis.window = originalWindow;
  }
  return { key: 'frontend_retries_then_stops_on_workspace_initialization_failure', status: 'PASS' };
}

async function test_frontend_retries_runtime_activation_after_snapshot_ready() {
  const originalFetch = globalThis.fetch;
  const originalEventSource = globalThis.EventSource;
  const originalWindow = globalThis.window;
  const calls = [];
  let eventSourceCreated = 0;
  globalThis.window = {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    addEventListener() {},
  };
  globalThis.EventSource = function FakeEventSource() {
    eventSourceCreated += 1;
    return { readyState: 1, close() {} };
  };
  globalThis.fetch = async (url) => {
    const path = String(url);
    calls.push(path);
    const modeCallCount = calls.filter((item) => item.endsWith('/api/runtime/mode')).length;
    const snapshotCallCount = calls.filter((item) => item.includes('/snapshot?profile=bootstrap')).length;
    if (path.endsWith('/api/runtime/mode') && modeCallCount === 1) {
      return {
        ok: false,
        status: 202,
        statusText: 'Accepted',
        async json() {
          return { ok: false, status: 'workspace_initializing', code: 'workspace_initializing', retry_after_ms: 20 };
        },
        async text() {
          return JSON.stringify({ ok: false, status: 'workspace_initializing', code: 'workspace_initializing', retry_after_ms: 20 });
        },
      };
    }
    if (path.includes('/snapshot?profile=bootstrap') && snapshotCallCount === 1) {
      return {
        ok: false,
        status: 202,
        statusText: 'Accepted',
        async json() {
          return { ok: false, status: 'workspace_initializing', code: 'workspace_initializing', retry_after_ms: 20 };
        },
        async text() {
          return JSON.stringify({ ok: false, status: 'workspace_initializing', code: 'workspace_initializing', retry_after_ms: 20 });
        },
      };
    }
    if (path.includes('/snapshot?profile=bootstrap')) {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        async json() {
          return {
            snapshot: { models: { 0: { id: 0, cells: {} } }, v1nConfig: {} },
            snapshot_seq: 1,
          };
        },
        async text() {
          return JSON.stringify({ snapshot: { models: { 0: { id: 0, cells: {} } }, v1nConfig: {} }, snapshot_seq: 1 });
        },
      };
    }
    if (path.endsWith('/api/runtime/mode')) {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        async json() {
          return { ok: true, mode: 'running' };
        },
        async text() {
          return JSON.stringify({ ok: true, mode: 'running' });
        },
      };
    }
    throw new Error(`unexpected_fetch:${path}`);
  };
  try {
    const store = createRemoteStore({ baseUrl: 'http://it0421.example', autoBootstrap: false });
    await store.ensureRuntimeRunning();
    await sleep(120);
    const modeCallIndexes = calls.map((item, index) => (item.endsWith('/api/runtime/mode') ? index : -1)).filter((index) => index >= 0);
    const snapshotCallIndexes = calls.map((item, index) => (item.includes('/snapshot?profile=bootstrap') ? index : -1)).filter((index) => index >= 0);
    const modeCalls = modeCallIndexes.map((index) => calls[index]);
    const snapshotCalls = snapshotCallIndexes.map((index) => calls[index]);
    assert.equal(modeCalls.length, 2, `frontend_must_retry_runtime_mode_after_snapshot_ready:${JSON.stringify(calls)}`);
    assert.ok(snapshotCalls.length >= 2, `frontend_must_wait_for_workspace_ready_before_runtime_retry:${JSON.stringify(calls)}`);
    assert.ok(
      snapshotCalls[0].includes('initial_projection=1'),
      `first_bootstrap_snapshot_must_request_initial_projection:${JSON.stringify(calls)}`,
    );
    assert.equal(
      snapshotCalls.slice(1).some((url) => url.includes('initial_projection=1')),
      false,
      `bootstrap_retries_after_initial_projection_must_not_request_projection_again:${JSON.stringify(calls)}`,
    );
    assert.ok(
      modeCallIndexes[1] > snapshotCallIndexes[1],
      `runtime_mode_retry_must_happen_after_ready_snapshot:${JSON.stringify(calls)}`,
    );
    assert.equal(store.workspaceStatus.status, 'ready');
    assert.equal(eventSourceCreated, 1, 'frontend_must_connect_sse_after_snapshot_ready');
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
    globalThis.window = originalWindow;
  }
  return { key: 'frontend_retries_runtime_activation_after_snapshot_ready', status: 'PASS' };
}

const tests = [
  test_auth_me_does_not_force_principal_runtime_before_snapshot,
  test_bad_session_never_enters_authenticated_workspace_initializing,
  test_auth_me_stays_fast_while_runtime_initialization_is_scheduled,
  test_runtime_mode_does_not_force_cold_principal_runtime,
  test_business_event_is_blocked_while_principal_runtime_initializes,
  test_expired_session_never_enters_authenticated_workspace_initializing,
  test_snapshot_surfaces_initialization_failure_end_to_end,
  test_test_runtime_hooks_are_disabled_by_default,
  test_principal_runtime_initialization_is_not_shared_between_users,
  test_registry_surfaces_principal_runtime_initialization_failure,
  test_frontend_distinguishes_workspace_initializing_from_page_unavailable,
  test_frontend_retries_then_stops_on_workspace_initialization_failure,
  test_frontend_retries_runtime_activation_after_snapshot_ready,
];

let failed = 0;
for (const test of tests) {
  try {
    const result = await test();
    console.log(`PASS ${result.key}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${test.name}: ${err && err.stack ? err.stack : err}`);
  }
}

if (failed > 0) {
  console.error(`FAIL test_0421_sso_post_login_latency_contract: ${failed} failed, ${tests.length - failed} passed`);
  process.exit(1);
}

console.log(`PASS test_0421_sso_post_login_latency_contract: ${tests.length} passed`);
