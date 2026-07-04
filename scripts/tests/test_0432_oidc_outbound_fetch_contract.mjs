import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

function read(relPath) {
  return readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function assertContains(source, needle, message) {
  assert.ok(source.includes(needle), message);
}

async function test_oidc_fetch_builds_proxy_and_timeout_options() {
  const {
    buildOidcFetchInit,
    describeOidcNetworkError,
    resolveOidcFetchProxyUrl,
    resolveOidcFetchTimeoutMs,
  } = await import('../../packages/ui-model-demo-server/auth.mjs');

  const env = {
    DY_OIDC_PROXY_URL: 'http://host.docker.internal:7897',
    DY_OIDC_FETCH_TIMEOUT_MS: '4321',
  };
  const init = buildOidcFetchInit({ headers: { accept: 'application/json' } }, env);
  assert.equal(init.proxy, 'http://host.docker.internal:7897/', 'oidc_fetch_must_pass_bun_proxy_option');
  assert.ok(init.signal, 'oidc_fetch_must_add_abort_signal');
  assert.equal(init.headers.accept, 'application/json', 'oidc_fetch_must_preserve_existing_init');
  assert.equal(resolveOidcFetchProxyUrl(env), 'http://host.docker.internal:7897/');
  assert.equal(resolveOidcFetchTimeoutMs(env), 4321);

  assert.equal(resolveOidcFetchProxyUrl({
    HTTPS_PROXY: 'http://ambient-proxy.local:8080',
  }, 'https://sso.dongyudigital.com'), '', 'oidc_fetch_must_ignore_ambient_proxy_without_explicit_opt_in');
  const directInit = buildOidcFetchInit({}, {
    HTTPS_PROXY: 'http://ambient-proxy.local:8080',
    HTTP_PROXY: 'http://ambient-proxy.local:8080',
    ALL_PROXY: 'http://ambient-proxy.local:8080',
  }, 'https://sso.dongyudigital.com');
  assert.equal(directInit.proxy, '', 'oidc_fetch_must_explicitly_disable_bun_ambient_proxy');
  assert.equal(resolveOidcFetchProxyUrl({
    DY_OIDC_PROXY_URL: 'http://explicit-proxy.local:8080',
    NO_PROXY: '*',
  }, 'https://sso.dongyudigital.com'), 'http://explicit-proxy.local:8080/');

  const detail = describeOidcNetworkError(new Error('self signed certificate in certificate chain'));
  assert.equal(detail.kind, 'tls_certificate');
  assert.match(detail.message, /self signed certificate/u);

  const eofDetail = describeOidcNetworkError(new Error('SSL routines::unexpected eof while reading'));
  assert.equal(eofDetail.kind, 'socket_closed', 'oidc_fetch_must_classify_tls_eof_stably');
  const closedTlsDetail = describeOidcNetworkError(new Error('TLS connection closed before secure connection was established'));
  assert.equal(closedTlsDetail.kind, 'socket_closed', 'oidc_fetch_must_classify_tls_close_without_socket_word');
}

async function test_oidc_fetch_maps_timeout_to_stable_error() {
  const { oidcFetch } = await import('../../packages/ui-model-demo-server/auth.mjs');
  const env = {
    DY_OIDC_FETCH_TIMEOUT_MS: '25',
    HTTPS_PROXY: 'http://ambient-proxy.local:8080',
    HTTP_PROXY: 'http://ambient-proxy.local:8080',
    ALL_PROXY: 'http://ambient-proxy.local:8080',
  };
  let observedSignal = null;
  let observedProxy = null;
  const fetchFn = async (_url, init = {}) => {
    observedSignal = init.signal;
    observedProxy = init.proxy;
    const error = new Error('synthetic timeout');
    error.name = 'TimeoutError';
    throw error;
  };
  await assert.rejects(
    () => oidcFetch('https://sso.example.invalid/.well-known/openid-configuration', {}, { env, fetchFn }),
    /oidc_network_timeout/,
    'oidc_fetch_must_fail_fast_with_stable_timeout_error',
  );
  assert.ok(observedSignal, 'oidc_fetch_must_pass_timeout_signal_to_fetch');
  assert.equal(observedProxy, '', 'oidc_fetch_must_disable_ambient_proxy_in_real_fetch_init');

  const socketFetchFn = async () => {
    throw new Error('The socket connection was closed unexpectedly');
  };
  await assert.rejects(
    () => oidcFetch('https://sso.example.invalid/.well-known/openid-configuration', {}, { env, fetchFn: socketFetchFn }),
    (error) => error.message === 'oidc_network_error:socket_closed',
    'oidc_fetch_must_keep_stable_network_error_detail',
  );
}

function test_deploy_surfaces_oidc_outbound_knobs() {
  const authSource = read('packages/ui-model-demo-server/auth.mjs');
  assertContains(authSource, 'DY_OIDC_PROXY_URL', 'auth_must_support_oidc_specific_proxy_env');
  assertContains(authSource, 'DY_OUTBOUND_PROXY_URL', 'auth_must_support_shared_outbound_proxy_env');
  assertContains(authSource, 'DY_OIDC_FETCH_TIMEOUT_MS', 'auth_must_support_oidc_timeout_env');
  assertContains(authSource, 'out.proxy', 'auth_must_pass_bun_fetch_proxy_option');

  for (const relPath of [
    'deploy/env/local.env.example',
    'deploy/env/cloud.env.example',
    'scripts/ops/_deploy_common.sh',
    'k8s/local/workers.yaml',
    'k8s/cloud/workers.yaml',
  ]) {
    const source = read(relPath);
    assertContains(source, 'DY_OIDC_PROXY_URL', `${relPath}_must_document_or_propagate_oidc_proxy`);
    assertContains(source, 'DY_OIDC_FETCH_TIMEOUT_MS', `${relPath}_must_document_or_propagate_oidc_timeout`);
  }
}

async function main() {
  await test_oidc_fetch_builds_proxy_and_timeout_options();
  await test_oidc_fetch_maps_timeout_to_stable_error();
  test_deploy_surfaces_oidc_outbound_knobs();
  console.log('test_0432_oidc_outbound_fetch_contract: PASS');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
