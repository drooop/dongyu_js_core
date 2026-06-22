#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

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
      'matrix.user': { 'org:primary': 'Dongyu' },
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

function serverBaseUrl(server) {
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

function waitListening(server) {
  if (server.listening) return Promise.resolve();
  return new Promise((resolve) => server.once('listening', resolve));
}

async function readResponseJson(resp) {
  const text = await resp.text();
  return text ? JSON.parse(text) : {};
}

async function waitFor(predicate, { timeoutMs = 1000, intervalMs = 10 } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('wait_for_timeout');
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

async function test_sso_start_redirects_to_zitadel_authorize_with_pkce() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = 'test-key';
  let issuer = '';
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
    res.writeHead(404);
    res.end();
  });
  issuer = serverBaseUrl(oidcServer);

  try {
    await withServerEnv({
      DY_AUTH: '1',
      DY_OIDC_ISSUER: issuer,
      DY_OIDC_CLIENT_ID: 'dongyu-app',
      DY_OIDC_REDIRECT_URI: 'http://127.0.0.1:0/auth/sso/callback',
    }, async ({ startServer }) => {
      const appServer = startServer({ port: 0, dbPath: null, skipFrontendBuild: true });
      await waitListening(appServer);
      const appBase = serverBaseUrl(appServer);
      try {
        const resp = await fetch(`${appBase}/auth/sso/start?returnTo=%2Fworkspace`, { redirect: 'manual' });
        assert.equal(resp.status, 302, 'sso_start_must_redirect');
        const location = resp.headers.get('location') || '';
        const redirect = new URL(location);
        assert.equal(`${redirect.origin}${redirect.pathname}`, `${issuer}/authorize`);
        assert.equal(redirect.searchParams.get('response_type'), 'code');
        assert.equal(redirect.searchParams.get('client_id'), 'dongyu-app');
        assert.equal(redirect.searchParams.get('code_challenge_method'), 'S256');
        assert.ok(redirect.searchParams.get('code_challenge'), 'sso_start_must_use_pkce');
        assert.ok(redirect.searchParams.get('state'), 'sso_start_must_include_state');
        assert.ok(redirect.searchParams.get('nonce'), 'sso_start_must_include_nonce');
      } finally {
        appServer.close();
      }
    });
  } finally {
    oidcServer.close();
  }

  return { key: 'sso_start_redirects_to_zitadel_authorize_with_pkce', status: 'PASS' };
}

async function test_sso_callback_rejects_unknown_state() {
  await withServerEnv({
    DY_AUTH: '1',
    DY_OIDC_ISSUER: 'http://127.0.0.1:65530',
    DY_OIDC_CLIENT_ID: 'dongyu-app',
    DY_OIDC_REDIRECT_URI: 'http://127.0.0.1:0/auth/sso/callback',
  }, async ({ startServer }) => {
    const appServer = startServer({ port: 0, dbPath: null, skipFrontendBuild: true });
    await waitListening(appServer);
    const appBase = serverBaseUrl(appServer);
    try {
      const resp = await fetch(`${appBase}/auth/sso/callback?code=abc&state=missing-state`, { redirect: 'manual' });
      const body = await readResponseJson(resp);
      assert.equal(resp.status, 400);
      assert.equal(body.error, 'invalid_oidc_state');
    } finally {
      appServer.close();
    }
  });
  return { key: 'sso_callback_rejects_unknown_state', status: 'PASS' };
}

async function test_valid_sso_callback_creates_dongyu_session() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const { privateKey: wrongPrivateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = 'test-key';
  let issuer = '';
  let lastTokenRequest = null;
  let issuedNonce = null;
  let idTokenPayloadOverride = {};
  let activePrivateKey = privateKey;
  let userinfoSub = '268746183297-drop';
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
      let raw = '';
      for await (const chunk of req) raw += chunk;
      lastTokenRequest = new URLSearchParams(raw);
      const idToken = signJwt({}, {
        privateKey: activePrivateKey,
        kid,
        issuer,
        audience: 'dongyu-app',
        nonce: issuedNonce,
      });
      const finalIdToken = Object.keys(idTokenPayloadOverride).length === 0
        ? idToken
        : signJwt(idTokenPayloadOverride, {
          privateKey: activePrivateKey,
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
        id_token: finalIdToken,
      }));
      return;
    }
    if (url.pathname === '/userinfo') {
      assert.equal(req.headers.authorization, 'Bearer mock-access-token');
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        sub: userinfoSub,
        email: 'drop.yang@dongyudigital.com',
        name: 'drop',
        preferred_username: 'drop',
        'urn:zitadel:iam:org:project:375910753992966374:roles': {
          'dongyu.admin': { 'org:primary': 'Dongyu' },
          'matrix.user': { 'org:primary': 'Dongyu' },
        },
      }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  issuer = serverBaseUrl(oidcServer);

  try {
    await withServerEnv({
      DY_AUTH: '1',
      DY_OIDC_ISSUER: issuer,
      DY_OIDC_CLIENT_ID: 'dongyu-app',
      DY_OIDC_REDIRECT_URI: 'http://127.0.0.1:0/auth/sso/callback',
    }, async ({ startServer }) => {
      const appServer = startServer({ port: 0, dbPath: null, skipFrontendBuild: true });
      await waitListening(appServer);
      const appBase = serverBaseUrl(appServer);
      try {
        const startResp = await fetch(`${appBase}/auth/sso/start?returnTo=%2Fworkspace`, { redirect: 'manual' });
        const authorizeUrl = new URL(startResp.headers.get('location'));
        const state = authorizeUrl.searchParams.get('state');
        const nonce = authorizeUrl.searchParams.get('nonce');
        const oidcCookie = startResp.headers.get('set-cookie') || '';
        assert.match(oidcCookie, /dy_oidc_state=/, 'sso_start_must_set_correlation_cookie');
        assert.match(oidcCookie, /HttpOnly/i, 'correlation_cookie_must_be_httponly');
        assert.match(oidcCookie, /SameSite=Lax/i, 'correlation_cookie_must_be_lax');
        issuedNonce = nonce;

        const loopbackNoCookieResp = await fetch(`${appBase}/auth/sso/callback?code=valid-code&state=${encodeURIComponent(state)}`, { redirect: 'manual' });
        assert.equal(loopbackNoCookieResp.status, 302, 'loopback_callback_without_cookie_must_complete');
        assert.equal(loopbackNoCookieResp.headers.get('location'), '/workspace');
        const loopbackNoCookieSetCookie = loopbackNoCookieResp.headers.get('set-cookie') || '';
        assert.match(loopbackNoCookieSetCookie, /dy_session=/, 'loopback_no_cookie_callback_must_set_session');
        assert.equal(lastTokenRequest.get('code'), 'valid-code');
        assert.ok(lastTokenRequest.get('code_verifier'), 'loopback_no_cookie_callback_must_keep_pkce_verifier');

        const loopbackNoCookieReplayResp = await fetch(`${appBase}/auth/sso/callback?code=valid-code&state=${encodeURIComponent(state)}`, { redirect: 'manual' });
        const loopbackNoCookieReplayBody = await readResponseJson(loopbackNoCookieReplayResp);
        assert.equal(loopbackNoCookieReplayResp.status, 400, 'loopback_no_cookie_state_replay_must_fail');
        assert.equal(loopbackNoCookieReplayBody.error, 'invalid_oidc_state');

        const tamperedState = `${state.slice(0, -1)}${state.endsWith('a') ? 'b' : 'a'}`;
        const tamperedResp = await fetch(`${appBase}/auth/sso/callback?code=valid-code&state=${encodeURIComponent(tamperedState)}`, { redirect: 'manual' });
        const tamperedBody = await readResponseJson(tamperedResp);
        assert.equal(tamperedResp.status, 400, 'tampered_state_must_fail');
        assert.equal(tamperedBody.error, 'invalid_oidc_state');

        const expiredStart = await fetch(`${appBase}/auth/sso/start?returnTo=%2Fworkspace`, { redirect: 'manual' });
        const expiredAuthorize = new URL(expiredStart.headers.get('location'));
        const expiredState = expiredAuthorize.searchParams.get('state');
        const realDateNow = Date.now;
        try {
          Date.now = () => realDateNow() + 6 * 60 * 1000;
          const expiredResp = await fetch(`${appBase}/auth/sso/callback?code=valid-code&state=${encodeURIComponent(expiredState)}`, { redirect: 'manual' });
          const expiredBody = await readResponseJson(expiredResp);
          assert.equal(expiredResp.status, 400, 'expired_state_must_fail');
          assert.equal(expiredBody.error, 'invalid_oidc_state');
        } finally {
          Date.now = realDateNow;
        }

        async function callbackWithFreshStart({ code = 'valid-code', override = {}, signer = privateKey, sub = '268746183297-drop' } = {}) {
          idTokenPayloadOverride = override;
          activePrivateKey = signer;
          userinfoSub = sub;
          const nextStart = await fetch(`${appBase}/auth/sso/start?returnTo=%2Fworkspace`, { redirect: 'manual' });
          const nextAuthorize = new URL(nextStart.headers.get('location'));
          issuedNonce = nextAuthorize.searchParams.get('nonce');
          const nextState = nextAuthorize.searchParams.get('state');
          const nextCookie = nextStart.headers.get('set-cookie') || '';
          const response = await fetch(`${appBase}/auth/sso/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(nextState)}`, {
            redirect: 'manual',
            headers: { cookie: nextCookie },
          });
          return { response, state: nextState, cookie: nextCookie };
        }

        for (const [caseName, params] of [
          ['bad_nonce', { override: { nonce: 'wrong-nonce' } }],
          ['bad_audience', { override: { aud: 'other-client' } }],
          ['expired_token', { override: { exp: Math.floor(Date.now() / 1000) - 120 } }],
          ['bad_signature', { signer: wrongPrivateKey }],
          ['userinfo_sub_mismatch', { sub: 'different-subject' }],
        ]) {
          const { response, state: failedState, cookie: failedCookie } = await callbackWithFreshStart(params);
          assert.equal(response.status, 401, `${caseName}_must_fail`);
          assert.match(response.headers.get('set-cookie') || '', /dy_oidc_state=;/, `${caseName}_must_clear_oidc_state_cookie`);
          const replayAfterFinalFailure = await fetch(`${appBase}/auth/sso/callback?code=valid-code&state=${encodeURIComponent(failedState)}`, {
            redirect: 'manual',
            headers: { cookie: failedCookie },
          });
          const replayAfterFinalFailureBody = await readResponseJson(replayAfterFinalFailure);
          assert.equal(replayAfterFinalFailure.status, 400, `${caseName}_state_must_be_finalized`);
          assert.equal(replayAfterFinalFailureBody.error, 'invalid_oidc_state');
        }

        const { response: callbackResp, state: successState, cookie: successCookie } = await callbackWithFreshStart();
        assert.equal(callbackResp.status, 302, 'valid_callback_must_redirect_to_returnTo');
        assert.equal(callbackResp.headers.get('location'), '/workspace');
        const cookie = callbackResp.headers.get('set-cookie') || '';
        assert.match(cookie, /dy_session=/, 'valid_callback_must_set_dy_session_cookie');
        assert.match(cookie, /dy_oidc_state=;/, 'valid_callback_must_clear_correlation_cookie');
        assert.equal(lastTokenRequest.get('grant_type'), 'authorization_code');
        assert.equal(lastTokenRequest.get('code'), 'valid-code');
        assert.ok(lastTokenRequest.get('code_verifier'), 'token_exchange_must_send_pkce_verifier');

        const replayResp = await fetch(`${appBase}/auth/sso/callback?code=valid-code&state=${encodeURIComponent(successState)}`, {
          redirect: 'manual',
          headers: { cookie: successCookie },
        });
        const replayBody = await readResponseJson(replayResp);
        assert.equal(replayResp.status, 400, 'callback_state_replay_must_fail');
        assert.equal(replayBody.error, 'invalid_oidc_state');

        const meResp = await fetch(`${appBase}/auth/me`, { headers: { cookie } });
        const me = await readResponseJson(meResp);
        assert.equal(meResp.status, 200);
        assert.equal(me.provider, 'zitadel');
        assert.equal(me.email, 'drop.yang@dongyudigital.com');
        assert.equal(me.displayName, 'drop');
        assert.ok(me.roles.includes('dongyu.admin'));
        assert.ok(me.capabilities.includes('workspace:write'));
        assert.ok(me.capabilities.includes('matrix:connect'));
        assert.ok(me.capabilities.includes('management_bus:use'));
        assert.equal(Object.prototype.hasOwnProperty.call(me, 'accessToken'), false, 'me_must_not_expose_matrix_token');
        assert.equal(Object.prototype.hasOwnProperty.call(me, 'idToken'), false, 'me_must_not_expose_id_token');
        assert.equal(Object.prototype.hasOwnProperty.call(me, 'oidcAccessToken'), false, 'me_must_not_expose_oidc_token');
        assert.ok(nonce, 'test_must_capture_start_nonce');
      } finally {
        appServer.close();
      }
    });
  } finally {
    oidcServer.close();
  }
  return { key: 'valid_sso_callback_creates_dongyu_session', status: 'PASS' };
}

async function test_sso_callback_token_failure_keeps_state_retryable() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = 'test-key';
  let issuer = '';
  let issuedNonce = null;
  let tokenRequestCount = 0;
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
      tokenRequestCount += 1;
      for await (const _chunk of req) {
        // Drain request body so the app sees a normal upstream response.
      }
      if (tokenRequestCount === 1) {
        res.writeHead(503, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'temporarily_unavailable' }));
        return;
      }
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

  try {
    await withServerEnv({
      DY_AUTH: '1',
      DY_OIDC_ISSUER: issuer,
      DY_OIDC_CLIENT_ID: 'dongyu-app',
      DY_OIDC_REDIRECT_URI: 'http://127.0.0.1:0/auth/sso/callback',
    }, async ({ startServer }) => {
      const appServer = startServer({ port: 0, dbPath: null, skipFrontendBuild: true });
      await waitListening(appServer);
      const appBase = serverBaseUrl(appServer);
      try {
        const startResp = await fetch(`${appBase}/auth/sso/start?returnTo=%2Fworkspace`, { redirect: 'manual' });
        const authorizeUrl = new URL(startResp.headers.get('location'));
        issuedNonce = authorizeUrl.searchParams.get('nonce');
        const state = authorizeUrl.searchParams.get('state');
        const oidcCookie = startResp.headers.get('set-cookie') || '';
        assert.match(oidcCookie, /dy_oidc_state=/, 'start_must_set_oidc_state_cookie');

        const firstResp = await fetch(`${appBase}/auth/sso/callback?code=valid-code&state=${encodeURIComponent(state)}`, {
          redirect: 'manual',
          headers: { cookie: oidcCookie },
        });
        const firstBody = await readResponseJson(firstResp);
        assert.equal(firstResp.status, 401, 'token_failure_must_not_be_reported_as_state_failure');
        assert.equal(firstBody.error, 'temporarily_unavailable');
        assert.doesNotMatch(String(firstResp.headers.get('set-cookie') || ''), /dy_oidc_state=;/, 'token_failure_must_keep_oidc_state_cookie_retryable');

        const retryResp = await fetch(`${appBase}/auth/sso/callback?code=valid-code&state=${encodeURIComponent(state)}`, {
          redirect: 'manual',
          headers: { cookie: oidcCookie },
        });
        assert.equal(retryResp.status, 302, 'retry_after_token_failure_must_succeed');
        assert.equal(retryResp.headers.get('location'), '/workspace');
        assert.match(retryResp.headers.get('set-cookie') || '', /dy_session=/, 'retry_success_must_set_session_cookie');

        const replayResp = await fetch(`${appBase}/auth/sso/callback?code=valid-code&state=${encodeURIComponent(state)}`, {
          redirect: 'manual',
          headers: { cookie: oidcCookie },
        });
        const replayBody = await readResponseJson(replayResp);
        assert.equal(replayResp.status, 400, 'successful_callback_state_must_still_be_one_time');
        assert.equal(replayBody.error, 'invalid_oidc_state');
      } finally {
        appServer.close();
      }
    });
  } finally {
    oidcServer.close();
  }

  return { key: 'sso_callback_token_failure_keeps_state_retryable', status: 'PASS' };
}

async function test_sso_callback_malformed_token_response_finalizes_state() {
  const oidcServer = await createJsonServer(async (req, res) => {
    const issuer = serverBaseUrl(oidcServer);
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
      res.end(JSON.stringify({ keys: [] }));
      return;
    }
    if (url.pathname === '/token') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        access_token: 'mock-access-token',
        token_type: 'Bearer',
        expires_in: 300,
      }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  try {
    await withServerEnv({
      DY_AUTH: '1',
      DY_OIDC_ISSUER: serverBaseUrl(oidcServer),
      DY_OIDC_CLIENT_ID: 'dongyu-app',
      DY_OIDC_REDIRECT_URI: 'http://127.0.0.1:0/auth/sso/callback',
    }, async ({ startServer }) => {
      const appServer = startServer({ port: 0, dbPath: null, skipFrontendBuild: true });
      await waitListening(appServer);
      const appBase = serverBaseUrl(appServer);
      try {
        const startResp = await fetch(`${appBase}/auth/sso/start?returnTo=%2Fworkspace`, { redirect: 'manual' });
        const authorizeUrl = new URL(startResp.headers.get('location'));
        const state = authorizeUrl.searchParams.get('state');
        const oidcCookie = startResp.headers.get('set-cookie') || '';
        const callbackResp = await fetch(`${appBase}/auth/sso/callback?code=valid-code&state=${encodeURIComponent(state)}`, {
          redirect: 'manual',
          headers: { cookie: oidcCookie },
        });
        const callbackBody = await readResponseJson(callbackResp);
        assert.equal(callbackResp.status, 401, 'malformed_token_response_must_fail');
        assert.equal(callbackBody.error, 'oidc_token_exchange_failed');
        assert.match(callbackResp.headers.get('set-cookie') || '', /dy_oidc_state=;/, 'malformed_token_response_must_clear_oidc_state_cookie');

        const replayResp = await fetch(`${appBase}/auth/sso/callback?code=valid-code&state=${encodeURIComponent(state)}`, {
          redirect: 'manual',
          headers: { cookie: oidcCookie },
        });
        const replayBody = await readResponseJson(replayResp);
        assert.equal(replayResp.status, 400, 'malformed_token_response_must_finalize_state');
        assert.equal(replayBody.error, 'invalid_oidc_state');
      } finally {
        appServer.close();
      }
    });
  } finally {
    oidcServer.close();
  }

  return { key: 'sso_callback_malformed_token_response_finalizes_state', status: 'PASS' };
}

async function test_sso_callback_concurrent_replay_is_blocked() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = 'test-key';
  let issuer = '';
  let issuedNonce = null;
  let tokenRequestCount = 0;
  let releaseTokenRequest = null;
  const tokenGate = new Promise((resolve) => {
    releaseTokenRequest = resolve;
  });
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
      tokenRequestCount += 1;
      for await (const _chunk of req) {
        // Drain request body.
      }
      if (tokenRequestCount === 1) await tokenGate;
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
      }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  issuer = serverBaseUrl(oidcServer);

  try {
    await withServerEnv({
      DY_AUTH: '1',
      DY_OIDC_ISSUER: issuer,
      DY_OIDC_CLIENT_ID: 'dongyu-app',
      DY_OIDC_REDIRECT_URI: 'http://127.0.0.1:0/auth/sso/callback',
    }, async ({ startServer }) => {
      const appServer = startServer({ port: 0, dbPath: null, skipFrontendBuild: true });
      await waitListening(appServer);
      const appBase = serverBaseUrl(appServer);
      try {
        const startResp = await fetch(`${appBase}/auth/sso/start?returnTo=%2Fworkspace`, { redirect: 'manual' });
        const authorizeUrl = new URL(startResp.headers.get('location'));
        issuedNonce = authorizeUrl.searchParams.get('nonce');
        const state = authorizeUrl.searchParams.get('state');
        const oidcCookie = startResp.headers.get('set-cookie') || '';
        const callbackUrl = `${appBase}/auth/sso/callback?code=valid-code&state=${encodeURIComponent(state)}`;

        const firstCallback = fetch(callbackUrl, {
          redirect: 'manual',
          headers: { cookie: oidcCookie },
        });
        await waitFor(() => tokenRequestCount === 1, { timeoutMs: 1000 });

        const concurrentResp = await fetch(callbackUrl, {
          redirect: 'manual',
          headers: { cookie: oidcCookie },
        });
        const concurrentBody = await readResponseJson(concurrentResp);
        assert.equal(concurrentResp.status, 400, 'concurrent_replay_must_be_rejected_before_second_token_exchange');
        assert.equal(concurrentBody.error, 'invalid_oidc_state');
        assert.equal(tokenRequestCount, 1, 'concurrent_replay_must_not_reach_token_endpoint');

        releaseTokenRequest();
        const firstResp = await firstCallback;
        assert.equal(firstResp.status, 302, 'first_inflight_callback_must_complete');
        assert.equal(firstResp.headers.get('location'), '/workspace');
        assert.match(firstResp.headers.get('set-cookie') || '', /dy_session=/, 'first_inflight_callback_must_set_session');
      } finally {
        appServer.close();
      }
    });
  } finally {
    if (releaseTokenRequest) releaseTokenRequest();
    oidcServer.close();
  }

  return { key: 'sso_callback_concurrent_replay_is_blocked', status: 'PASS' };
}

async function test_sso_callback_concurrent_replay_is_blocked_during_metadata_cache_miss() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = 'test-key';
  let issuer = '';
  let issuedNonce = null;
  let gateMetadata = false;
  let metadataRequestCount = 0;
  let tokenRequestCount = 0;
  let releaseMetadata = null;
  const metadataGate = new Promise((resolve) => {
    releaseMetadata = resolve;
  });
  const publicJwk = publicKey.export({ format: 'jwk' });
  publicJwk.kid = kid;
  publicJwk.alg = 'RS256';
  publicJwk.use = 'sig';

  const oidcServer = await createJsonServer(async (req, res) => {
    const url = new URL(req.url || '/', issuer);
    if (url.pathname === '/.well-known/openid-configuration') {
      if (gateMetadata) {
        metadataRequestCount += 1;
        await metadataGate;
      }
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
      tokenRequestCount += 1;
      for await (const _chunk of req) {
        // Drain request body.
      }
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
      }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  issuer = serverBaseUrl(oidcServer);

  try {
    await withServerEnv({
      DY_AUTH: '1',
      DY_OIDC_ISSUER: issuer,
      DY_OIDC_CLIENT_ID: 'dongyu-app',
      DY_OIDC_REDIRECT_URI: 'http://127.0.0.1:9018/auth/sso/callback',
    }, async () => {
      const authA = await import(`../../packages/ui-model-demo-server/auth.mjs?metadata-race-a=${Date.now()}-${Math.random()}`);
      const started = await authA.startOidcLogin({
        req: { headers: { host: '127.0.0.1:9018' } },
        returnTo: '/workspace',
      });
      const authorizeUrl = new URL(started.authorizationUrl);
      const state = authorizeUrl.searchParams.get('state');
      issuedNonce = authorizeUrl.searchParams.get('nonce');
      const oidcCookie = started.stateCookie;
      assert.ok(state, 'start_must_issue_state_for_metadata_race');
      assert.match(oidcCookie, /dy_oidc_state=/, 'start_must_issue_cookie_for_metadata_race');

      const authB = await import(`../../packages/ui-model-demo-server/auth.mjs?metadata-race-b=${Date.now()}-${Math.random()}`);
      const req = { headers: { host: '127.0.0.1:9018', cookie: oidcCookie } };
      gateMetadata = true;
      const firstCallback = authB.completeOidcLogin({ req, code: 'valid-code', state });
      await waitFor(() => metadataRequestCount === 1, { timeoutMs: 1000 });

      const secondCallback = authB.completeOidcLogin({ req, code: 'valid-code', state })
        .then(() => ({ ok: true, error: '' }))
        .catch((error) => ({ ok: false, error: error && error.message ? error.message : String(error) }));
      await new Promise((resolve) => setTimeout(resolve, 50));
      try {
        assert.equal(metadataRequestCount, 1, 'concurrent_replay_must_not_start_second_metadata_fetch');
      } finally {
        releaseMetadata();
      }

      const secondResult = await secondCallback;
      assert.deepEqual(secondResult, { ok: false, error: 'invalid_oidc_state' });
      const firstResult = await firstCallback;
      assert.equal(firstResult.returnTo, '/workspace');
      assert.equal(firstResult.session.provider, 'zitadel');
      assert.equal(tokenRequestCount, 1, 'metadata_race_must_only_exchange_token_once');
    });
  } finally {
    if (releaseMetadata) releaseMetadata();
    oidcServer.close();
  }

  return { key: 'sso_callback_concurrent_replay_is_blocked_during_metadata_cache_miss', status: 'PASS' };
}

async function test_oidc_logout_returns_zitadel_end_session_url_and_clears_local_session() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = 'test-key';
  let issuer = '';
  let issuedNonce = null;
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
        end_session_endpoint: `${issuer}/oauth/v2/end_session`,
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

  try {
    await withServerEnv({
      DY_AUTH: '1',
      DY_OIDC_ISSUER: issuer,
      DY_OIDC_CLIENT_ID: 'dongyu-app',
      DY_OIDC_REDIRECT_URI: 'http://127.0.0.1:0/auth/sso/callback',
    }, async ({ startServer }) => {
      const appServer = startServer({ port: 0, dbPath: null, skipFrontendBuild: true });
      await waitListening(appServer);
      const appBase = serverBaseUrl(appServer);
      try {
        const startResp = await fetch(`${appBase}/auth/sso/start?returnTo=%2Fworkspace`, { redirect: 'manual' });
        const authorizeUrl = new URL(startResp.headers.get('location'));
        issuedNonce = authorizeUrl.searchParams.get('nonce');
        const state = authorizeUrl.searchParams.get('state');
        const oidcCookie = startResp.headers.get('set-cookie') || '';
        const callbackResp = await fetch(`${appBase}/auth/sso/callback?code=valid-code&state=${encodeURIComponent(state)}`, {
          redirect: 'manual',
          headers: { cookie: oidcCookie },
        });
        assert.equal(callbackResp.status, 302, 'valid_callback_must_succeed_before_logout');
        const sessionCookie = callbackResp.headers.get('set-cookie') || '';
        assert.match(sessionCookie, /dy_session=/, 'callback_must_set_session_cookie_before_logout');

        const logoutResp = await fetch(`${appBase}/auth/logout`, {
          redirect: 'manual',
          headers: { cookie: sessionCookie },
        });
        assert.equal(logoutResp.status, 302, 'oidc_logout_must_redirect_browser_to_upstream_logout');
        const logoutUrl = new URL(logoutResp.headers.get('location') || '');
        assert.equal(`${logoutUrl.origin}${logoutUrl.pathname}`, `${issuer}/oauth/v2/end_session`);
        assert.equal(logoutUrl.searchParams.get('client_id'), 'dongyu-app');
        assert.ok(logoutUrl.searchParams.get('id_token_hint'), 'oidc_logout_must_send_id_token_hint');
        assert.equal(logoutUrl.searchParams.get('post_logout_redirect_uri'), `${appBase}/`);
        assert.match(logoutResp.headers.get('set-cookie') || '', /dy_session=;/, 'logout_must_clear_session_cookie');

        const meResp = await fetch(`${appBase}/auth/me`, { headers: { cookie: sessionCookie } });
        assert.equal(meResp.status, 401, 'logout_must_remove_local_session_record');
      } finally {
        appServer.close();
      }
    });
  } finally {
    oidcServer.close();
  }
  return { key: 'oidc_logout_returns_zitadel_end_session_url_and_clears_local_session', status: 'PASS' };
}

async function withLoggedInOidcSessionForLogout({ endSessionEndpoint }, fn) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = 'test-key';
  let issuer = '';
  let issuedNonce = null;
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
        end_session_endpoint: endSessionEndpoint,
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
      }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  issuer = serverBaseUrl(oidcServer);

  try {
    await withServerEnv({
      DY_AUTH: '1',
      DY_OIDC_ISSUER: issuer,
      DY_OIDC_CLIENT_ID: 'dongyu-app',
      DY_OIDC_REDIRECT_URI: 'http://127.0.0.1:0/auth/sso/callback',
    }, async ({ startServer }) => {
      const appServer = startServer({ port: 0, dbPath: null, skipFrontendBuild: true });
      await waitListening(appServer);
      const appBase = serverBaseUrl(appServer);
      try {
        const startResp = await fetch(`${appBase}/auth/sso/start?returnTo=%2Fworkspace`, { redirect: 'manual' });
        const authorizeUrl = new URL(startResp.headers.get('location'));
        issuedNonce = authorizeUrl.searchParams.get('nonce');
        const state = authorizeUrl.searchParams.get('state');
        const oidcCookie = startResp.headers.get('set-cookie') || '';
        const callbackResp = await fetch(`${appBase}/auth/sso/callback?code=valid-code&state=${encodeURIComponent(state)}`, {
          redirect: 'manual',
          headers: { cookie: oidcCookie },
        });
        assert.equal(callbackResp.status, 302, 'valid_callback_must_succeed_before_logout');
        const sessionCookie = callbackResp.headers.get('set-cookie') || '';
        assert.match(sessionCookie, /dy_session=/, 'callback_must_set_session_cookie_before_logout');
        await fn({ appBase, issuer, sessionCookie });
      } finally {
        appServer.close();
      }
    });
  } finally {
    oidcServer.close();
  }
}

async function test_oidc_logout_rejects_unsafe_end_session_endpoint() {
  await withLoggedInOidcSessionForLogout({
    endSessionEndpoint: 'https://evil.example.test/logout',
  }, async ({ appBase, sessionCookie }) => {
    const logoutResp = await fetch(`${appBase}/auth/logout`, {
      redirect: 'manual',
      headers: { cookie: sessionCookie },
    });
    assert.equal(logoutResp.status, 302, 'unsafe_oidc_logout_must_still_redirect_after_clearing_local_session');
    assert.equal(logoutResp.headers.get('location'), '/', 'unsafe_oidc_logout_must_not_redirect_to_external_endpoint');
    assert.match(logoutResp.headers.get('set-cookie') || '', /dy_session=;/, 'unsafe_oidc_logout_must_clear_session_cookie');
    const meResp = await fetch(`${appBase}/auth/me`, { headers: { cookie: sessionCookie } });
    assert.equal(meResp.status, 401, 'unsafe_oidc_logout_must_remove_local_session_record');
  });
  return { key: 'oidc_logout_rejects_unsafe_end_session_endpoint', status: 'PASS' };
}

async function test_role_mapping_requires_dongyu_scoped_roles() {
  const { deriveCapabilitiesFromRoles } = await import(`../../packages/ui-model-demo-server/auth.mjs?t=${Date.now()}-${Math.random()}`);
  const unrelatedAdmin = deriveCapabilitiesFromRoles(['billing.admin']);
  assert.ok(unrelatedAdmin.includes('app:read'));
  assert.ok(unrelatedAdmin.includes('workspace:read'));
  assert.equal(unrelatedAdmin.includes('workspace:write'), false, 'unrelated_admin_must_not_write_workspace');
  assert.equal(unrelatedAdmin.includes('matrix:connect'), false, 'unrelated_admin_must_not_connect_matrix');
  assert.equal(unrelatedAdmin.includes('management_bus:use'), false, 'unrelated_admin_must_not_use_management_bus');

  const dongyuAdmin = deriveCapabilitiesFromRoles(['dongyu.admin']);
  assert.ok(dongyuAdmin.includes('workspace:write'));
  assert.ok(dongyuAdmin.includes('matrix:connect'));
  assert.ok(dongyuAdmin.includes('management_bus:use'));
  return { key: 'role_mapping_requires_dongyu_scoped_roles', status: 'PASS' };
}

async function test_sso_callback_survives_server_restart_with_correlation_cookie() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = 'test-key';
  let issuer = '';
  let issuedNonce = null;
  let lastTokenRequest = null;
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
      let raw = '';
      for await (const chunk of req) raw += chunk;
      lastTokenRequest = new URLSearchParams(raw);
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

  try {
    const env = {
      DY_AUTH: '1',
      DY_OIDC_ISSUER: issuer,
      DY_OIDC_CLIENT_ID: 'dongyu-app',
      DY_OIDC_REDIRECT_URI: 'http://127.0.0.1:0/auth/sso/callback',
    };
    let state = '';
    let oidcCookie = '';

    await withServerEnv(env, async () => {
      const authA = await import(`../../packages/ui-model-demo-server/auth.mjs?restart-a=${Date.now()}-${Math.random()}`);
      const started = await authA.startOidcLogin({
        req: { headers: { host: '127.0.0.1:9018' } },
        returnTo: '/workspace',
      });
      const authorizeUrl = new URL(started.authorizationUrl);
      state = authorizeUrl.searchParams.get('state');
      issuedNonce = authorizeUrl.searchParams.get('nonce');
      oidcCookie = started.stateCookie;
      assert.ok(state, 'start_must_issue_state');
      assert.ok(issuedNonce, 'start_must_issue_nonce');
      assert.match(oidcCookie, /dy_oidc_state=/, 'start_must_set_oidc_cookie');

      const authB = await import(`../../packages/ui-model-demo-server/auth.mjs?restart-b=${Date.now()}-${Math.random()}`);
      const completed = await authB.completeOidcLogin({
        req: { headers: { host: '127.0.0.1:9018', cookie: oidcCookie } },
        code: 'valid-code',
        state,
      });
      assert.equal(completed.returnTo, '/workspace');
      assert.equal(completed.session.provider, 'zitadel');
      assert.equal(lastTokenRequest.get('code_verifier')?.length > 30, true, 'restored_state_must_keep_pkce_verifier');
    });
  } finally {
    oidcServer.close();
  }
  return { key: 'sso_callback_survives_server_restart_with_correlation_cookie', status: 'PASS' };
}

async function test_non_loopback_callback_without_cookie_is_rejected() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = 'test-key';
  let issuer = '';
  let issuedNonce = null;
  let tokenRequestCount = 0;
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
      tokenRequestCount += 1;
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
      res.end(JSON.stringify({ sub: '268746183297-drop' }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  issuer = serverBaseUrl(oidcServer);

  try {
    await withServerEnv({
      DY_AUTH: '1',
      DY_OIDC_ISSUER: issuer,
      DY_OIDC_CLIENT_ID: 'dongyu-app',
      DY_OIDC_REDIRECT_URI: 'https://app.example.test/auth/sso/callback',
      DY_OIDC_STATE_SECRET: 'non-loopback-state-secret',
    }, async () => {
      const auth = await import(`../../packages/ui-model-demo-server/auth.mjs?non-loopback=${Date.now()}-${Math.random()}`);
      const started = await auth.startOidcLogin({
        req: { headers: { host: 'app.example.test', 'x-forwarded-proto': 'https' } },
        returnTo: '/workspace',
      });
      const authorizeUrl = new URL(started.authorizationUrl);
      const state = authorizeUrl.searchParams.get('state');
      issuedNonce = authorizeUrl.searchParams.get('nonce');
      await assert.rejects(
        () => auth.completeOidcLogin({
          req: { headers: { host: 'app.example.test', 'x-forwarded-proto': 'https' } },
          code: 'valid-code',
          state,
        }),
        /invalid_oidc_state/,
      );
      assert.equal(tokenRequestCount, 0, 'non_loopback_no_cookie_must_not_exchange_token');
    });
  } finally {
    oidcServer.close();
  }
  return { key: 'non_loopback_callback_without_cookie_is_rejected', status: 'PASS' };
}

async function test_loopback_http_auth_cookies_do_not_require_secure_flag() {
  const oidcServer = await createJsonServer(async (req, res) => {
    const issuer = serverBaseUrl(oidcServer);
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
    res.writeHead(404);
    res.end();
  });

  const priorNodeEnv = process.env.NODE_ENV;
  delete process.env.NODE_ENV;
  try {
    await withServerEnv({
      DY_AUTH: '1',
      DY_OIDC_ISSUER: serverBaseUrl(oidcServer),
      DY_OIDC_CLIENT_ID: 'dongyu-app',
      DY_OIDC_REDIRECT_URI: 'http://127.0.0.1:9018/auth/sso/callback',
    }, async () => {
      const auth = await import(`../../packages/ui-model-demo-server/auth.mjs?cookies=${Date.now()}-${Math.random()}`);
      const started = await auth.startOidcLogin({
        req: { headers: { host: '127.0.0.1:9018' } },
        returnTo: '/',
      });
      assert.doesNotMatch(started.stateCookie, /;\s*Secure/i, 'loopback_oidc_cookie_must_work_over_http');
      const sessionCookie = auth.makeSetCookieHeader('session-token', undefined, {
        headers: { host: '127.0.0.1:9018' },
      });
      assert.doesNotMatch(sessionCookie, /;\s*Secure/i, 'loopback_session_cookie_must_work_over_http');
      assert.match(sessionCookie, /SameSite=Lax/i, 'oidc_callback_session_cookie_must_work_on_top_level_redirect');
    });
  } finally {
    if (priorNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = priorNodeEnv;
    oidcServer.close();
  }
  return { key: 'loopback_http_auth_cookies_do_not_require_secure_flag', status: 'PASS' };
}

async function test_production_requires_oidc_state_cookie_secret() {
  const prior = {
    NODE_ENV: process.env.NODE_ENV,
    DY_OIDC_STATE_SECRET: process.env.DY_OIDC_STATE_SECRET,
    DY_SESSION_SECRET: process.env.DY_SESSION_SECRET,
    DY_AUTH_SECRET: process.env.DY_AUTH_SECRET,
    DY_COOKIE_SECRET: process.env.DY_COOKIE_SECRET,
  };
  process.env.NODE_ENV = 'production';
  delete process.env.DY_OIDC_STATE_SECRET;
  delete process.env.DY_SESSION_SECRET;
  delete process.env.DY_AUTH_SECRET;
  delete process.env.DY_COOKIE_SECRET;
  try {
    const auth = await import(`../../packages/ui-model-demo-server/auth.mjs?prod-secret=${Date.now()}-${Math.random()}`);
    assert.throws(
      () => auth.makeOidcStateCookieHeader('state', {
        state: 'state',
        codeVerifier: 'verifier',
        nonce: 'nonce',
        returnTo: '/',
        redirectUri: 'https://app.example.test/auth/sso/callback',
        issuer: 'https://sso.example.test',
        clientId: 'dongyu-app',
        createdAt: Date.now(),
      }),
      /oidc_state_secret_required/,
    );
  } finally {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
  return { key: 'production_requires_oidc_state_cookie_secret', status: 'PASS' };
}

async function test_non_loopback_oidc_requires_explicit_state_secret() {
  const oidcServer = await createJsonServer(async (req, res) => {
    const issuer = serverBaseUrl(oidcServer);
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
    res.writeHead(404);
    res.end();
  });

  const prior = {
    NODE_ENV: process.env.NODE_ENV,
    DY_OIDC_STATE_SECRET: process.env.DY_OIDC_STATE_SECRET,
    DY_SESSION_SECRET: process.env.DY_SESSION_SECRET,
    DY_AUTH_SECRET: process.env.DY_AUTH_SECRET,
    DY_COOKIE_SECRET: process.env.DY_COOKIE_SECRET,
  };
  delete process.env.NODE_ENV;
  delete process.env.DY_OIDC_STATE_SECRET;
  delete process.env.DY_SESSION_SECRET;
  delete process.env.DY_AUTH_SECRET;
  delete process.env.DY_COOKIE_SECRET;
  try {
    await withServerEnv({
      DY_AUTH: '1',
      DY_OIDC_ISSUER: serverBaseUrl(oidcServer),
      DY_OIDC_CLIENT_ID: 'dongyu-app',
      DY_OIDC_REDIRECT_URI: 'https://app.example.test/auth/sso/callback',
    }, async () => {
      const auth = await import(`../../packages/ui-model-demo-server/auth.mjs?non-loopback-secret=${Date.now()}-${Math.random()}`);
      await assert.rejects(
        () => auth.startOidcLogin({
          req: { headers: { host: 'app.example.test', 'x-forwarded-proto': 'https' } },
          returnTo: '/',
        }),
        /oidc_state_secret_required/,
      );
    });
  } finally {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    oidcServer.close();
  }
  return { key: 'non_loopback_oidc_requires_explicit_state_secret', status: 'PASS' };
}

const tests = [
  test_sso_start_redirects_to_zitadel_authorize_with_pkce,
  test_sso_callback_rejects_unknown_state,
  test_valid_sso_callback_creates_dongyu_session,
  test_sso_callback_token_failure_keeps_state_retryable,
  test_sso_callback_malformed_token_response_finalizes_state,
  test_sso_callback_concurrent_replay_is_blocked,
  test_sso_callback_concurrent_replay_is_blocked_during_metadata_cache_miss,
  test_oidc_logout_returns_zitadel_end_session_url_and_clears_local_session,
  test_oidc_logout_rejects_unsafe_end_session_endpoint,
  test_role_mapping_requires_dongyu_scoped_roles,
  test_sso_callback_survives_server_restart_with_correlation_cookie,
  test_non_loopback_callback_without_cookie_is_rejected,
  test_loopback_http_auth_cookies_do_not_require_secure_flag,
  test_production_requires_oidc_state_cookie_secret,
  test_non_loopback_oidc_requires_explicit_state_secret,
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
