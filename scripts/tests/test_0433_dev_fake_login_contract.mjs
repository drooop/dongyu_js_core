#!/usr/bin/env node

import assert from 'node:assert/strict';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function serverBaseUrl(server) {
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

async function waitListening(server) {
  if (server.listening) return;
  await new Promise((resolve) => server.once('listening', resolve));
}

async function readJson(resp) {
  const text = await resp.text();
  return text ? JSON.parse(text) : {};
}

function cookieFrom(resp) {
  return resp.headers.get('set-cookie') || '';
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

async function withStartedServer(env, fn) {
  await withServerEnv(env, async ({ startServer }) => {
    const appServer = startServer({ port: 0, dbPath: null, skipFrontendBuild: true });
    await waitListening(appServer);
    try {
      await fn(serverBaseUrl(appServer));
    } finally {
      appServer.close();
    }
  });
}

async function test_fake_login_is_hidden_and_disabled_by_default() {
  await withStartedServer({
    DY_AUTH: '1',
    DY_DEV_FAKE_LOGIN: '',
  }, async (appBase) => {
    const optionsResp = await fetch(`${appBase}/auth/dev/fake-login/options`);
    const optionsBody = await readJson(optionsResp);
    assert.equal(optionsResp.status, 404, 'default_options_must_not_expose_dev_fake_login');
    assert.equal(optionsBody.error, 'dev_fake_login_disabled');

    const loginResp = await fetch(`${appBase}/auth/dev/fake-login?user=drop&returnTo=%2F`, { redirect: 'manual' });
    const loginBody = await readJson(loginResp);
    assert.equal(loginResp.status, 404, 'default_route_must_not_create_fake_session');
    assert.equal(loginBody.error, 'dev_fake_login_disabled');
    assert.equal(cookieFrom(loginResp).includes('dy_session='), false, 'disabled_fake_login_must_not_set_session_cookie');
  });
  return { key: 'fake_login_is_hidden_and_disabled_by_default', status: 'PASS' };
}

async function test_enabled_fake_login_lists_safe_users() {
  await withStartedServer({
    DY_AUTH: '1',
    DY_DEV_FAKE_LOGIN: '1',
  }, async (appBase) => {
    const optionsResp = await fetch(`${appBase}/auth/dev/fake-login/options`);
    const optionsBody = await readJson(optionsResp);
    assert.equal(optionsResp.status, 200);
    assert.equal(optionsBody.ok, true);
    assert.equal(optionsBody.enabled, true);
    assert.ok(Array.isArray(optionsBody.users), 'fake_login_options_must_list_users');
    assert.ok(optionsBody.users.length >= 2, 'fake_login_options_must_offer_two_users_for_isolation_testing');
    const keys = optionsBody.users.map((user) => user.key);
    assert.ok(keys.includes('drop'), 'fake_login_options_must_include_drop_user');
    assert.ok(keys.includes('swk'), 'fake_login_options_must_include_swk_user');
    for (const user of optionsBody.users) {
      assert.equal(typeof user.key, 'string');
      assert.equal(typeof user.displayName, 'string');
      assert.equal(Object.prototype.hasOwnProperty.call(user, 'capabilities'), false, 'options_must_not_expose_full_session_capabilities');
      assert.equal(Object.prototype.hasOwnProperty.call(user, 'accessToken'), false, 'options_must_not_expose_secrets');
    }
  });
  return { key: 'enabled_fake_login_lists_safe_users', status: 'PASS' };
}

async function test_enabled_fake_login_creates_distinct_normal_sessions() {
  await withStartedServer({
    DY_AUTH: '1',
    DY_DEV_FAKE_LOGIN: '1',
  }, async (appBase) => {
    const dropLogin = await fetch(`${appBase}/auth/dev/fake-login?user=drop&returnTo=%2Fworkspace`, { redirect: 'manual' });
    assert.equal(dropLogin.status, 302);
    assert.equal(dropLogin.headers.get('location'), '/workspace');
    const dropCookie = cookieFrom(dropLogin);
    assert.ok(dropCookie.includes('dy_session='), 'drop_fake_login_must_set_normal_session_cookie');

    const swkLogin = await fetch(`${appBase}/auth/dev/fake-login?user=swk&returnTo=%2F%23%2F`, { redirect: 'manual' });
    assert.equal(swkLogin.status, 302);
    assert.equal(swkLogin.headers.get('location'), '/#/');
    const swkCookie = cookieFrom(swkLogin);
    assert.ok(swkCookie.includes('dy_session='), 'swk_fake_login_must_set_normal_session_cookie');
    assert.notEqual(dropCookie, swkCookie, 'different_fake_users_must_get_different_session_cookies');

    const dropMeResp = await fetch(`${appBase}/auth/me`, { headers: { cookie: dropCookie } });
    const dropMe = await readJson(dropMeResp);
    assert.equal(dropMeResp.status, 200);
    assert.equal(dropMe.provider, 'dev-fake');
    assert.equal(dropMe.userId, 'dev-fake:drop');
    assert.equal(dropMe.username, 'drop');
    assert.ok(dropMe.capabilities.includes('workspace:write'), 'drop_fake_user_must_keep_workspace_capability');
    assert.equal(dropMe.matrixConnected, false, 'fake_login_must_not_claim_matrix_connection');

    const swkMeResp = await fetch(`${appBase}/auth/me`, { headers: { cookie: swkCookie } });
    const swkMe = await readJson(swkMeResp);
    assert.equal(swkMeResp.status, 200);
    assert.equal(swkMe.provider, 'dev-fake');
    assert.equal(swkMe.userId, 'dev-fake:swk');
    assert.equal(swkMe.username, 'swk');
    assert.notEqual(dropMe.userId, swkMe.userId, 'fake_login_must_preserve_per_user_identity');
  });
  return { key: 'enabled_fake_login_creates_distinct_normal_sessions', status: 'PASS' };
}

async function test_fake_login_sanitizes_return_to_and_rejects_unknown_user() {
  await withStartedServer({
    DY_AUTH: '1',
    DY_DEV_FAKE_LOGIN: '1',
  }, async (appBase) => {
    const unsafe = await fetch(`${appBase}/auth/dev/fake-login?user=drop&returnTo=${encodeURIComponent('https://evil.example/')}`, { redirect: 'manual' });
    assert.equal(unsafe.status, 302);
    assert.equal(unsafe.headers.get('location'), '/', 'fake_login_must_sanitize_external_return_to');

    const apiReturn = await fetch(`${appBase}/auth/dev/fake-login?user=drop&returnTo=${encodeURIComponent('/api/private')}`, { redirect: 'manual' });
    assert.equal(apiReturn.status, 302);
    assert.equal(apiReturn.headers.get('location'), '/', 'fake_login_must_sanitize_non_page_return_to');

    const unknown = await fetch(`${appBase}/auth/dev/fake-login?user=missing&returnTo=%2F`, { redirect: 'manual' });
    const body = await readJson(unknown);
    assert.equal(unknown.status, 400);
    assert.equal(body.error, 'unknown_dev_fake_user');
    assert.equal(cookieFrom(unknown).includes('dy_session='), false, 'unknown_fake_user_must_not_set_session_cookie');
  });
  return { key: 'fake_login_sanitizes_return_to_and_rejects_unknown_user', status: 'PASS' };
}

async function test_frontend_declares_dev_fake_login_affordance() {
  const authStoreSource = await import('node:fs/promises')
    .then((fs) => fs.readFile(path.join(repoRoot, 'packages/ui-model-demo-frontend/src/auth_store.js'), 'utf8'));
  const appShellSource = await import('node:fs/promises')
    .then((fs) => fs.readFile(path.join(repoRoot, 'packages/ui-model-demo-frontend/src/demo_app.js'), 'utf8'));
  assert.ok(authStoreSource.includes('/auth/dev/fake-login/options'), 'auth_store_must_load_dev_fake_login_options');
  assert.ok(authStoreSource.includes('loginWithDevFakeUser'), 'auth_store_must_expose_fake_login_action');
  assert.ok(appShellSource.includes('auth-dev-fake-login-section'), 'app_shell_must_render_fake_login_section');
  assert.ok(appShellSource.includes('auth-dev-fake-login-button'), 'app_shell_must_render_fake_login_buttons');
  assert.ok(appShellSource.includes('临时测试登录'), 'fake_login_ui_must_be_clearly_marked_temporary');
  return { key: 'frontend_declares_dev_fake_login_affordance', status: 'PASS' };
}

const tests = [
  test_fake_login_is_hidden_and_disabled_by_default,
  test_enabled_fake_login_lists_safe_users,
  test_enabled_fake_login_creates_distinct_normal_sessions,
  test_fake_login_sanitizes_return_to_and_rejects_unknown_user,
  test_frontend_declares_dev_fake_login_affordance,
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
