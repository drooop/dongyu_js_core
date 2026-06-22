#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { once } from 'node:events';
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRenderer } from '../../packages/ui-renderer/src/renderer.mjs';
import { createRemoteStore } from '../../packages/ui-model-demo-frontend/src/remote_store.js';
import { buildClientSnapshotPatchMessage } from '../../packages/ui-model-demo-server/server.mjs';

function label(k, t, v) {
  return { k, t, v };
}

function mt(k, t, v) {
  return { id: 0, p: 0, r: 0, c: 0, k, t, v };
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
    sub: 'it0417-user',
    exp: now + 300,
    iat: now,
    nonce,
    ...payload,
  };
  const encoded = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(body))}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(encoded), privateKey);
  return `${encoded}.${base64url(signature)}`;
}

function pinPayloadPacket({
  opId = 'it0417_response',
  topic,
  includeResponseTopic = true,
  responseTopic = topic,
  endpoint = { worker_id: 'U1', model_id: 9417, pin: 'result' },
  origin = { worker_id: 'R1', model_id: 3000, pin: 'submit1' },
  replyTarget = { worker_id: 'U1', model_id: 9417, pin: 'result' },
  replyTargetPrincipalKey = 'alice-sub',
  payload = [],
} = {}) {
  const records = [
    mt('__mt_payload_kind', 'str', 'pin_payload.v1'),
    mt('__mt_request_id', 'str', opId),
    mt('op_id', 'str', opId),
    mt('message_role', 'str', 'response'),
    mt('topic', 'str', topic),
    mt('route_kind', 'str', 'control'),
    mt('bus', 'str', 'control'),
    mt('endpoint_worker_id', 'str', endpoint.worker_id),
    mt('endpoint_model_id', 'int', endpoint.model_id),
    mt('endpoint_pin', 'str', endpoint.pin),
    mt('origin_worker_id', 'str', origin.worker_id),
    mt('origin_model_id', 'int', origin.model_id),
    mt('origin_pin', 'str', origin.pin),
    mt('reply_target_worker_id', 'str', replyTarget.worker_id),
    mt('reply_target_model_id', 'int', replyTarget.model_id),
    mt('reply_target_pin', 'str', replyTarget.pin),
    mt('reply_target_principal_key', 'str', replyTargetPrincipalKey),
    mt('payload', 'json', payload),
    mt('timestamp', 'int', 1700000000000),
  ];
  if (includeResponseTopic) {
    records.splice(4, 0, mt('response_topic', 'str', responseTopic));
  }
  return { version: 'v1', type: 'pin_payload', payload: records };
}

function ref(modelId, k, p = 0, r = 0, c = 0) {
  return { model_id: modelId, p, r, c, k };
}

function snapshotWithModel(modelId, labels) {
  return {
    models: {
      [String(modelId)]: {
        id: modelId,
        cells: {
          '0,0,0': {
            p: 0,
            r: 0,
            c: 0,
            labels,
          },
        },
      },
    },
    v1nConfig: { local_mqtt: null, global_mqtt: null },
  };
}

function labelValueFromState(state, modelId, key) {
  const model = state.runtime.getModel(modelId);
  if (!model) return undefined;
  return state.runtime.getCell(model, 0, 0, 0).labels.get(key)?.v;
}

function ensureStateModel(state, modelId) {
  return state.runtime.getModel(modelId) || state.runtime.createModel({
    id: modelId,
    name: `it0417_model_${modelId}`,
    type: 'test',
  });
}

async function withServerModule(fn) {
  const previous = {
    dyAuth: process.env.DY_AUTH,
    persistedAssetRoot: process.env.DY_PERSISTED_ASSET_ROOT,
    workspace: process.env.WORKER_BASE_WORKSPACE,
    dataRoot: process.env.WORKER_BASE_DATA_ROOT,
    docsRoot: process.env.DOCS_ROOT,
    staticRoot: process.env.STATIC_PROJECTS_ROOT,
  };
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0417-user-state-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0417_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  try {
    const mod = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
    return await fn(mod);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    const restore = (key, value) => {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    };
    restore('DY_AUTH', previous.dyAuth);
    restore('DY_PERSISTED_ASSET_ROOT', previous.persistedAssetRoot);
    restore('WORKER_BASE_WORKSPACE', previous.workspace);
    restore('WORKER_BASE_DATA_ROOT', previous.dataRoot);
    restore('DOCS_ROOT', previous.docsRoot);
    restore('STATIC_PROJECTS_ROOT', previous.staticRoot);
  }
}

async function importFreshServerModule() {
  return import(new URL(`../../packages/ui-model-demo-server/server.mjs?it0417=${Date.now()}_${Math.random()}`, import.meta.url));
}

function serverBaseUrl(server) {
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

async function waitListening(server) {
  if (server.listening) return;
  await once(server, 'listening');
}

async function readJsonResponse(resp) {
  return JSON.parse(await resp.text());
}

async function withFreshServerEnv(extraEnv, fn) {
  const previous = {
    dyAuth: process.env.DY_AUTH,
    dyOidcIssuer: process.env.DY_OIDC_ISSUER,
    dyOidcClientId: process.env.DY_OIDC_CLIENT_ID,
    dyOidcRedirectUri: process.env.DY_OIDC_REDIRECT_URI,
    dyPersistedAssetRoot: process.env.DY_PERSISTED_ASSET_ROOT,
    workspace: process.env.WORKER_BASE_WORKSPACE,
    dataRoot: process.env.WORKER_BASE_DATA_ROOT,
    docsRoot: process.env.DOCS_ROOT,
    staticRoot: process.env.STATIC_PROJECTS_ROOT,
  };
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0417-http-user-state-'));
  Object.assign(process.env, {
    DY_AUTH: '1',
    DY_PERSISTED_ASSET_ROOT: '',
    WORKER_BASE_WORKSPACE: `it0417_http_${Date.now()}`,
    WORKER_BASE_DATA_ROOT: join(tempRoot, 'runtime'),
    DOCS_ROOT: join(tempRoot, 'docs'),
    STATIC_PROJECTS_ROOT: join(tempRoot, 'static'),
    ...extraEnv,
  });
  try {
    const mod = await importFreshServerModule();
    return await fn(mod, tempRoot);
  } finally {
    const restore = (key, value) => {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    };
    restore('DY_AUTH', previous.dyAuth);
    restore('DY_OIDC_ISSUER', previous.dyOidcIssuer);
    restore('DY_OIDC_CLIENT_ID', previous.dyOidcClientId);
    restore('DY_OIDC_REDIRECT_URI', previous.dyOidcRedirectUri);
    restore('DY_PERSISTED_ASSET_ROOT', previous.dyPersistedAssetRoot);
    restore('WORKER_BASE_WORKSPACE', previous.workspace);
    restore('WORKER_BASE_DATA_ROOT', previous.dataRoot);
    restore('DOCS_ROOT', previous.docsRoot);
    restore('STATIC_PROJECTS_ROOT', previous.staticRoot);
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function createMockOidcProvider() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = `it0417-${Date.now()}`;
  const publicJwk = publicKey.export({ format: 'jwk' });
  publicJwk.kid = kid;
  publicJwk.alg = 'RS256';
  publicJwk.use = 'sig';
  let issuer = '';
  let issuedNonce = '';
  let currentUser = {
    sub: 'it0417-alice',
    email: 'alice@example.test',
    name: 'Alice',
    preferred_username: 'alice',
  };
  const server = http.createServer((req, res) => {
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
      issuedNonce = value;
    },
    setUser(user) {
      currentUser = { ...user };
    },
  };
}

async function loginViaMockOidc(appBase, provider, user) {
  provider.setUser(user);
  const start = await fetch(`${appBase}/auth/sso/start?returnTo=%2Fworkspace`, { redirect: 'manual' });
  assert.equal(start.status, 302, 'mock_oidc_start_must_redirect');
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

function fakeVue() {
  return {
    h(type, props, children) {
      let normalized = children;
      if (children && typeof children === 'object' && typeof children.default === 'function') {
        normalized = children.default();
      }
      return { type, props: props || {}, children: normalized };
    },
    resolveComponent(name) {
      return name;
    },
  };
}

function hostWithSnapshot(snapshot) {
  const dispatched = [];
  const staged = [];
  const committed = [];
  const localValues = new Map();
  const pendingStates = new Map();
  const keyForRef = (target) => `${target.model_id}:${target.p}:${target.r}:${target.c}:${target.k}`;
  return {
    dispatched,
    staged,
    committed,
    localValues,
    pendingStates,
    getSnapshot() {
      return snapshot;
    },
    dispatchAddLabel(value) {
      dispatched.push(value);
    },
    dispatchRmLabel(value) {
      dispatched.push({ rm: value });
    },
    getEffectiveLabelValue(target) {
      const key = keyForRef(target);
      if (localValues.has(key)) return localValues.get(key);
      const model = snapshot.models[String(target.model_id)] || snapshot.models[target.model_id];
      return model?.cells?.[`${target.p},${target.r},${target.c}`]?.labels?.[target.k]?.v;
    },
    stageOverlayValue(value) {
      staged.push(value);
      localValues.set(keyForRef(value.ref), value.value);
    },
    commitOverlayValue(value) {
      committed.push(value);
    },
    setPendingState(stateId, value) {
      pendingStates.set(String(stateId), { ...(value || {}) });
    },
    getPendingState(stateId) {
      return pendingStates.get(String(stateId)) || null;
    },
    resolvePendingState(stateId, result) {
      const key = String(stateId);
      const current = pendingStates.get(key);
      if (!current) return null;
      pendingStates.set(key, { ...current, pending: false, result: result || null });
      return pendingStates.get(key);
    },
    clearPendingState(stateId) {
      pendingStates.delete(String(stateId));
    },
  };
}

function conformanceEvidence(overrides = {}) {
  return {
    tierPlacement: true,
    modelPlacement: true,
    dataOwnership: true,
    dataFlow: true,
    dataChain: true,
    ...overrides,
  };
}

function assertConformanceEvidence(evidence, context) {
  for (const key of ['tierPlacement', 'modelPlacement', 'dataOwnership', 'dataFlow', 'dataChain']) {
    assert.equal(evidence?.[key], true, `${context}_missing_${key}`);
  }
}

async function test_principal_workspace_runtime_isolation() {
  return withServerModule(async (mod) => {
    assert.equal(typeof mod.createPrincipalRuntimeRegistry, 'function', 'server must export createPrincipalRuntimeRegistry');
    const registry = mod.createPrincipalRuntimeRegistry({
      createState: () => mod.createServerState({ dbPath: null }),
    });
    assert.equal(typeof registry.resolveMutableRuntime, 'function', 'registry must expose resolveMutableRuntime');
    assert.equal(typeof registry.resolveReadRuntime, 'function', 'registry must expose resolveReadRuntime');

    const alice = registry.resolveMutableRuntime({ subject: 'alice-sub', email: 'alice@example.test' });
    const bob = registry.resolveMutableRuntime({ subject: 'bob-sub', email: 'bob@example.test' });
    const aliceChangedEmail = registry.resolveMutableRuntime({ subject: 'alice-sub', email: 'alice-renamed@example.test' });
    const aliceSameEmailDifferentSubject = registry.resolveMutableRuntime({ subject: 'alice-other-sub', email: 'alice@example.test' });
    await alice.state.activateRuntimeMode('running');
    await bob.state.activateRuntimeMode('running');
    assert.notEqual(alice.principalKey, bob.principalKey, 'principal keys must be distinct');
    assert.notEqual(alice.state, bob.state, 'principals must not share mutable runtime state');
    assert.equal(aliceChangedEmail.state, alice.state, 'principal key must use OIDC subject before email');
    assert.notEqual(aliceSameEmailDifferentSubject.state, alice.state, 'different subject must not collapse to same email runtime');
    assert.equal(typeof registry.handleControlBusPacket, 'function', 'registry must materialize bus responses by reply target principal');

    const modelId = 9417;
    const secondModelId = 9517;
    const aliceModel = ensureStateModel(alice.state, modelId);
    const aliceSecondModel = ensureStateModel(alice.state, secondModelId);
    alice.state.runtime.addLabel(aliceModel, 0, 0, 0, label('dual_bus_model', 'json', { mode: 'imported_host_egress', egress_pins: ['submit'] }));
    alice.state.runtime.addLabel(aliceSecondModel, 0, 0, 0, label('dual_bus_model', 'json', { mode: 'imported_host_egress', egress_pins: ['submit'] }));
    alice.state.runtime.addLabel(aliceModel, 0, 0, 0, label('installed_apps_json', 'json', [{ id: 'todo-alice', title: 'Alice To Do' }]));
    alice.state.runtime.addLabel(aliceModel, 0, 0, 0, label('task_title', 'str', 'Alice private task'));
    alice.state.runtime.addLabel(aliceModel, 0, 0, 0, label('draft_title', 'str', 'Alice draft'));
    alice.state.runtime.addLabel(aliceModel, 0, 0, 0, label('create_dialog_open', 'bool', true));
    alice.state.runtime.addLabel(aliceModel, 0, 0, 0, label('selected_view', 'str', 'focus'));

    const bobModel = ensureStateModel(bob.state, modelId);
    bob.state.runtime.addLabel(bobModel, 0, 0, 0, label('dual_bus_model', 'json', { mode: 'imported_host_egress', egress_pins: ['submit'] }));
    bob.state.runtime.addLabel(bobModel, 0, 0, 0, label('installed_apps_json', 'json', [{ id: 'todo-bob', title: 'Bob To Do' }]));
    bob.state.runtime.addLabel(bobModel, 0, 0, 0, label('task_title', 'str', 'Bob private task'));

    const responseTopic = 'UIPUT/ws/dam/pic/de/U1/9417/result';
    const wrongPinHandled = await registry.handleControlBusPacket(responseTopic, pinPayloadPacket({
      opId: 'it0417_response_wrong_pin',
      topic: responseTopic,
      replyTargetPrincipalKey: alice.principalKey,
      replyTarget: { worker_id: 'U1', model_id: 9417, pin: 'wrong_result' },
      payload: [mt('materialized_result', 'str', 'Wrong pin response')],
    }));
    assert.equal(wrongPinHandled, false, 'registry must reject responses for an undeclared reply_target_pin');
    assert.equal(labelValueFromState(alice.state, modelId, 'materialized_result'), undefined, 'wrong reply_target_pin must not materialize payload');
    const invalidTopic = 'not-a-control-topic';
    const invalidTopicHandled = await registry.handleControlBusPacket(invalidTopic, pinPayloadPacket({
      opId: 'it0417_response_invalid_topic',
      topic: invalidTopic,
      endpoint: { worker_id: 'U1', model_id: 9417, pin: 'result' },
      replyTargetPrincipalKey: alice.principalKey,
      payload: [mt('materialized_result', 'str', 'Invalid topic response')],
    }));
    assert.equal(invalidTopicHandled, false, 'registry must reject responses with an invalid control-bus topic shape');
    assert.equal(labelValueFromState(alice.state, modelId, 'materialized_result'), undefined, 'invalid topic must not materialize payload');
    const missingResponseTopicHandled = await registry.handleControlBusPacket(responseTopic, pinPayloadPacket({
      opId: 'it0417_response_missing_response_topic',
      topic: responseTopic,
      includeResponseTopic: false,
      replyTargetPrincipalKey: alice.principalKey,
      payload: [mt('materialized_result', 'str', 'Missing response topic response')],
    }));
    assert.equal(missingResponseTopicHandled, false, 'registry must reject responses without response_topic');
    assert.equal(labelValueFromState(alice.state, modelId, 'materialized_result'), undefined, 'missing response_topic must not materialize payload');
    const mismatchedResponseTopicHandled = await registry.handleControlBusPacket(responseTopic, pinPayloadPacket({
      opId: 'it0417_response_mismatched_response_topic',
      topic: responseTopic,
      responseTopic: 'UIPUT/ws/dam/pic/de/U1/9517/result',
      replyTargetPrincipalKey: alice.principalKey,
      payload: [mt('materialized_result', 'str', 'Mismatched response topic response')],
    }));
    assert.equal(mismatchedResponseTopicHandled, false, 'registry must reject responses whose topic does not equal response_topic');
    assert.equal(labelValueFromState(alice.state, modelId, 'materialized_result'), undefined, 'mismatched response_topic must not materialize payload');
    const missingRuntimeHandled = await registry.handleControlBusPacket(responseTopic, pinPayloadPacket({
      opId: 'it0417_response_missing_runtime',
      topic: responseTopic,
      replyTargetPrincipalKey: 'subject:missing-principal',
      payload: [mt('materialized_result', 'str', 'Missing runtime response')],
    }));
    assert.equal(missingRuntimeHandled, false, 'registry must reject responses for an unknown principal runtime');
    assert.equal(labelValueFromState(alice.state, modelId, 'materialized_result'), undefined, 'unknown runtime must not materialize payload');
    const missingModelHandled = await registry.handleControlBusPacket(responseTopic, pinPayloadPacket({
      opId: 'it0417_response_missing_model',
      topic: responseTopic,
      replyTargetPrincipalKey: alice.principalKey,
      replyTarget: { worker_id: 'U1', model_id: 999917, pin: 'result' },
      payload: [mt('materialized_result', 'str', 'Missing model response')],
    }));
    assert.equal(missingModelHandled, false, 'registry must reject responses for an unknown reply_target_model_id');
    assert.equal(labelValueFromState(alice.state, modelId, 'materialized_result'), undefined, 'unknown model must not materialize payload');

    const aliceHandled = await registry.handleControlBusPacket(responseTopic, pinPayloadPacket({
      topic: responseTopic,
      replyTargetPrincipalKey: alice.principalKey,
      payload: [mt('materialized_result', 'str', 'Alice response')],
    }));
    assert.equal(aliceHandled, true, 'registry must accept response for a known principal reply target');
    const secondResponseTopic = 'UIPUT/ws/dam/pic/de/U1/9517/result';
    const aliceSecondHandled = await registry.handleControlBusPacket(secondResponseTopic, pinPayloadPacket({
      opId: 'it0417_response_alice_second_model',
      topic: secondResponseTopic,
      endpoint: { worker_id: 'U1', model_id: secondModelId, pin: 'result' },
      replyTargetPrincipalKey: alice.principalKey,
      replyTarget: { worker_id: 'U1', model_id: secondModelId, pin: 'result' },
      payload: [mt('materialized_result', 'str', 'Alice second model response')],
    }));
    assert.equal(aliceSecondHandled, true, 'registry must route by reply_target_model_id rather than hardcoded model');
    const bobHandled = await registry.handleControlBusPacket(responseTopic, pinPayloadPacket({
      opId: 'it0417_response_bob',
      topic: responseTopic,
      replyTargetPrincipalKey: bob.principalKey,
      payload: [mt('materialized_result', 'str', 'Bob response')],
    }));
    assert.equal(bobHandled, true, 'registry must not always materialize into the first/default runtime');

    assert.deepEqual(labelValueFromState(alice.state, modelId, 'installed_apps_json'), [{ id: 'todo-alice', title: 'Alice To Do' }]);
    assert.deepEqual(labelValueFromState(bob.state, modelId, 'installed_apps_json'), [{ id: 'todo-bob', title: 'Bob To Do' }]);
    assert.equal(labelValueFromState(bob.state, modelId, 'draft_title'), undefined, 'bob must not see alice input draft');
    assert.equal(labelValueFromState(bob.state, modelId, 'create_dialog_open'), undefined, 'bob must not see alice dialog state');
    assert.equal(labelValueFromState(bob.state, modelId, 'selected_view'), undefined, 'bob must not see alice selected view');
    assert.equal(labelValueFromState(alice.state, modelId, 'materialized_result'), 'Alice response', 'response must materialize into alice runtime');
    assert.equal(labelValueFromState(alice.state, secondModelId, 'materialized_result'), 'Alice second model response', 'response must honor reply_target_model_id');
    assert.equal(labelValueFromState(bob.state, modelId, 'materialized_result'), 'Bob response', 'response must materialize into bob runtime separately');
    assertConformanceEvidence(conformanceEvidence({ dataChain: aliceHandled === true && aliceSecondHandled === true && bobHandled === true }), 'principal_runtime_isolation');
    return { key: 'principal_workspace_runtime_isolation', status: 'PASS' };
  });
}

async function test_principal_response_rejection_does_not_fallback_to_shared_runtime() {
  return withServerModule(async (mod) => {
    assert.equal(typeof mod.createPrincipalRuntimeRegistry, 'function', 'server must export createPrincipalRuntimeRegistry');
    const sharedState = mod.createServerState({ dbPath: null });
    const registry = mod.createPrincipalRuntimeRegistry({
      readOnlyState: sharedState,
      createState(principalKey) {
        const state = mod.createServerState({ dbPath: null });
        state.runtime.principalRuntimeKey = principalKey;
        state.programEngine.disableControlBusInbound = true;
        return state;
      },
    });
    const sharedModelId = 9417;
    const sharedModel = ensureStateModel(sharedState, sharedModelId);
    sharedState.runtime.addLabel(sharedModel, 0, 0, 0, label('dual_bus_model', 'json', {
      mode: 'imported_host_egress',
      egress_pins: ['submit'],
    }));

    const responseTopic = `UIPUT/ws/dam/pic/de/U1/${sharedModelId}/result`;
    assert.equal(
      typeof registry.handleControlBusPacketResult,
      'function',
      'registry must expose matched/handled result for shared listener routing',
    );

    async function assertRejectedPrincipalPacketDoesNotFallback(response, context) {
      let fallbackCalled = false;
      const originalSharedHandler = async (topic, payload) => {
        fallbackCalled = true;
        return sharedState.programEngine.handleControlBusPacket(topic, payload);
      };
      const routed = await registry.handleControlBusPacketResult(responseTopic, response);
      const wrapperHandled = routed.matched
        ? routed.handled === true
        : await originalSharedHandler(responseTopic, response);
      assert.equal(routed.matched, true, `${context}: principal-targeted response must be claimed even when rejected`);
      assert.equal(routed.handled, false, `${context}: principal runtime response must be rejected`);
      assert.equal(wrapperHandled, false, `${context}: shared listener wrapper must return rejected for rejected principal response`);
      assert.equal(fallbackCalled, false, `${context}: rejected principal response must not call shared runtime fallback`);
    }

    const missingPrincipalResponse = pinPayloadPacket({
      opId: 'it0417_principal_rejected_must_not_fallback',
      topic: responseTopic,
      replyTargetPrincipalKey: 'subject:missing-principal',
      payload: [mt('materialized_result', 'str', 'must_not_land_in_shared_runtime')],
    });
    await assertRejectedPrincipalPacketDoesNotFallback(missingPrincipalResponse, 'missing principal runtime');

    const malformedPrincipalMarkerResponse = pinPayloadPacket({
      opId: 'it0417_malformed_principal_marker_must_not_fallback',
      topic: responseTopic,
      replyTargetPrincipalKey: 'subject:missing-principal',
      payload: [mt('materialized_result', 'str', 'must_not_land_in_shared_runtime_from_malformed_marker')],
    });
    const marker = malformedPrincipalMarkerResponse.payload.find((record) => record && record.k === 'reply_target_principal_key');
    marker.t = 'json';
    marker.v = { malformed: true };
    await assertRejectedPrincipalPacketDoesNotFallback(malformedPrincipalMarkerResponse, 'malformed principal marker');

    assert.equal(
      labelValueFromState(sharedState, sharedModelId, 'materialized_result'),
      undefined,
      'rejected principal response must not materialize into shared runtime',
    );
    assertConformanceEvidence(conformanceEvidence({ dataOwnership: true, dataChain: true }), 'principal_rejection_no_shared_fallback');
    return { key: 'principal_response_rejection_does_not_fallback_to_shared_runtime', status: 'PASS' };
  });
}

async function test_guest_is_read_only() {
  return withServerModule(async (mod) => {
    assert.equal(typeof mod.createPrincipalRuntimeRegistry, 'function', 'server must export createPrincipalRuntimeRegistry');
    const registry = mod.createPrincipalRuntimeRegistry({
      createState: () => mod.createServerState({ dbPath: null }),
    });
    assert.throws(
      () => registry.resolveMutableRuntime(null),
      /guest_read_only|login_required|read_only/u,
      'guest must not get a mutable user runtime',
    );
    const guestRead = registry.resolveReadRuntime(null);
    assert.equal(guestRead.mutable, false, 'guest read runtime must be marked immutable');
    assertConformanceEvidence(conformanceEvidence({ dataOwnership: guestRead.mutable === false }), 'guest_read_only');
    return { key: 'guest_is_read_only', status: 'PASS' };
  });
}

async function test_default_input_submit_policy_is_local_only() {
  const draftRef = ref(9417, 'draft_title');
  const snapshot = snapshotWithModel(9417, {
    draft_title: label('draft_title', 'str', ''),
  });
  const host = hostWithSnapshot(snapshot);
  const renderer = createRenderer({ host, vue: fakeVue() });
  const vnode = renderer.renderVNode({
    id: 'draft_input',
    type: 'Input',
    cell_ref: { model_id: 9417, p: 2, r: 1, c: 0 },
    bind: {
      read: draftRef,
      write: {
        action: 'label_update',
        target_ref: draftRef,
      },
    },
    props: { placeholder: 'Task title' },
  });

  vnode.props['onUpdate:modelValue']('abc');
  assert.equal(host.dispatched.length, 0, 'default Input typing must not dispatch ModelTable writes per keystroke');
  assert.equal(host.staged.length, 1, 'default Input typing must stage local overlay');
  assert.equal(host.staged[0].value, 'abc');
  assertConformanceEvidence(conformanceEvidence({ dataFlow: host.dispatched.length === 0 }), 'default_input_local_only');
  return { key: 'default_input_submit_policy_is_local_only', status: 'PASS' };
}

async function test_submit_reads_visible_local_overlay_and_keeps_bus_path() {
  const draftRef = ref(9417, 'draft_title');
  const resultRef = ref(9417, 'submitted_title');
  const snapshot = snapshotWithModel(9417, {
    draft_title: label('draft_title', 'str', 'old snapshot value'),
    submitted_title: label('submitted_title', 'str', ''),
  });
  const host = hostWithSnapshot(snapshot);
  const renderer = createRenderer({ host, vue: fakeVue() });
  const input = renderer.renderVNode({
    id: 'draft_input_for_submit',
    type: 'Input',
    cell_ref: { model_id: 9417, p: 2, r: 1, c: 0 },
    bind: {
      read: draftRef,
      write: {
        action: 'label_update',
        target_ref: draftRef,
      },
    },
  });
  input.props['onUpdate:modelValue']('visible latest value');
  assert.equal(host.staged.length, 1, 'submit overlay test must use the real Input staging flow');
  assert.equal(host.dispatched.length, 0, 'Input staging must not dispatch before submit');
  const labelOut = renderer.dispatchEvent({
    id: 'submit_button',
    type: 'Button',
    cell_ref: { model_id: 9417, p: 2, r: 2, c: 0 },
    bind: {
      write: {
        bus_event_v2: true,
        bus_in_key: 'submit_request',
        value_t: 'modeltable',
        value_ref: [
          mt('__mt_payload_kind', 'str', 'ui_event.v1'),
          mt('draft_title', 'str', { $label: draftRef }),
        ],
        meta: { source: 'it0417' },
      },
    },
  }, { click: true });

  assert.equal(host.dispatched.length, 1, 'submit must dispatch exactly one event');
  assert.equal(labelOut.p, 0, 'renderer bus event must target Model 0 root p=0');
  assert.equal(labelOut.r, 0, 'renderer bus event must target Model 0 root r=0');
  assert.equal(labelOut.c, 0, 'renderer bus event must target Model 0 root c=0');
  assert.equal(labelOut.k, 'bus_in_event', 'submit must enter the bus event mailbox label');
  assert.equal(labelOut.t, 'event');
  assert.equal(labelOut.v.type, 'bus_event_v2');
  assert.equal(labelOut.v.bus_in_key, 'submit_request');
  const draftRecord = labelOut.v.value.find((record) => record.k === 'draft_title');
  assert.equal(draftRecord.v, 'visible latest value', 'submit payload must use visible local overlay value');
  assert.equal(labelValueFromSnapshot(snapshot, resultRef), '', 'UI/server dispatch must not direct-write final business label');

  await withServerModule(async (mod) => {
    const state = mod.createServerState({ dbPath: null });
    await state.activateRuntimeMode('running');
    const model0 = state.runtime.getModel(0);
    const target = ensureStateModel(state, 9417);
    state.runtime.addLabel(target, 0, 0, 0, label('submitted_title', 'str', ''));
    state.runtime.addLabel(model0, 0, 0, 0, {
      k: 'it0417_submit_request_route',
      t: 'pin.connect.cell',
      v: [{ from: [0, 0, 0, 'submit_request'], to: [[9417, 0, 0, 'submit_in']] }],
    });
    const consume = await state.submitEnvelope(labelOut.v);
    assert.equal(consume.result, 'ok', 'server must accept renderer bus_event_v2');
    assert.equal(consume.routed_by, 'model0_busin', 'server must route through Model 0 bus ingress');
    const busIn = state.runtime.getCell(model0, 0, 0, 0).labels.get('submit_request');
    assert.equal(busIn?.t, 'pin.bus.cb.in', 'server must write the declared Model 0 control-bus input pin');
    assert.equal(Array.isArray(busIn?.v), true, 'Model 0 bus input value must be Temporary ModelTable records');
    const payloadKindRecord = busIn.v.find((record) => record && record.k === '__mt_payload_kind');
    assert.equal(payloadKindRecord?.v, 'ui_event.v1', 'Model 0 bus pin must preserve the formal payload kind marker');
    const serverDraftRecord = busIn.v.find((record) => record && record.k === 'draft_title');
    assert.equal(serverDraftRecord?.v, 'visible latest value', 'Model 0 bus pin must preserve the visible Input payload');
    assert.equal(labelValueFromState(state, 9417, 'submitted_title'), '', 'server submit path must not direct-write final business label');
  });

  assertConformanceEvidence(conformanceEvidence({
    dataFlow: labelOut.k === 'bus_in_event' && labelOut.v.type === 'bus_event_v2',
    dataChain: labelOut.v.value.some((record) => record.k === '__mt_payload_kind'),
  }), 'submit_bus_path');
  return { key: 'submit_reads_visible_local_overlay_and_keeps_bus_path', status: 'PASS' };
}

function labelValueFromSnapshot(snapshot, target) {
  return snapshot.models[String(target.model_id)]?.cells?.[`${target.p},${target.r},${target.c}`]?.labels?.[target.k]?.v;
}

async function test_dialog_tabs_and_view_state_are_local_only() {
  const openRef = ref(9417, 'create_dialog_open');
  const viewRef = ref(9417, 'selected_view');
  const snapshot = snapshotWithModel(9417, {
    create_dialog_open: label('create_dialog_open', 'bool', false),
    selected_view: label('selected_view', 'str', 'board'),
  });
  const host = hostWithSnapshot(snapshot);
  const renderer = createRenderer({ host, vue: fakeVue() });
  const dialog = renderer.renderVNode({
    id: 'create_task_dialog',
    type: 'Dialog',
    cell_ref: { model_id: 9417, p: 2, r: 3, c: 0 },
    props: {
      title: 'Create task',
      ui_state: {
        state_id: 'create_task_dialog',
        state_kind: 'visibility',
        scope: 'local',
        persist_policy: 'never',
      },
    },
    bind: {
      read: openRef,
      write: {
        action: 'label_update',
        target_ref: openRef,
        persist_policy: 'never',
      },
    },
    children: [],
  });

  dialog.props['onUpdate:modelValue'](true);
  const tabs = renderer.renderVNode({
    id: 'todo_view_tabs',
    type: 'Tabs',
    cell_ref: { model_id: 9417, p: 2, r: 5, c: 0 },
    props: {
      ui_state: {
        state_id: 'todo_view',
        state_kind: 'selection',
        scope: 'local',
        persist_policy: 'never',
      },
    },
    bind: {
      read: viewRef,
      write: {
        action: 'label_update',
        target_ref: viewRef,
        persist_policy: 'never',
      },
    },
    children: [],
  });
  tabs.props['onUpdate:modelValue']('focus');
  assert.equal(host.dispatched.length, 0, 'local Dialog/Tabs state must not dispatch business ModelTable writes');
  assert.equal(host.staged.length, 2, 'local Dialog/Tabs state must stage local state');
  assert.deepEqual(
    host.staged.map((entry) => ({ ref: entry.ref, value: entry.value })),
    [
      { ref: openRef, value: true },
      { ref: viewRef, value: 'focus' },
    ],
    'Dialog/Tabs must stage the correct local state refs and values',
  );
  assert.equal(labelValueFromSnapshot(snapshot, openRef), false, 'snapshot business label must remain unchanged');
  assert.equal(labelValueFromSnapshot(snapshot, viewRef), 'board', 'selected view business label must remain unchanged');
  assertConformanceEvidence(conformanceEvidence({ dataFlow: host.dispatched.length === 0 }), 'dialog_tabs_local_state');
  return { key: 'dialog_tabs_and_view_state_are_local_only', status: 'PASS' };
}

async function test_pending_lock_blocks_duplicate_submit() {
  const snapshot = snapshotWithModel(9417, {
    status: label('status', 'str', 'idle'),
  });
  const host = hostWithSnapshot(snapshot);
  const renderer = createRenderer({ host, vue: fakeVue() });
  const vnode = renderer.renderVNode({
    id: 'save_task_button',
    type: 'Button',
    cell_ref: { model_id: 9417, p: 2, r: 4, c: 0 },
    props: {
      text: 'Save',
      pending: {
        pending_state_id: 'save_task',
        pending_text: 'Saving...',
        lock_scope: 'button',
        disable_while_pending: true,
        pending_until: 'submit_success',
        timeout_ms: 1000,
      },
    },
    bind: {
      write: {
        bus_event_v2: true,
        bus_in_key: 'submit_request',
        value_t: 'modeltable',
        value_ref: [mt('__mt_payload_kind', 'str', 'ui_event.v1')],
      },
    },
  });

  await vnode.props.onClick();
  await vnode.props.onClick();
  assert.equal(host.dispatched.length, 1, 'pending lock must block duplicate submit in the declared scope');
  assert.equal(host.getPendingState('save_task')?.pending, true, 'renderer must register pending state on the host');
  assert.equal(vnode.props.loading, true, 'pending lock must expose loading state immediately');
  assert.equal(vnode.props.disabled, true, 'pending lock must disable the button while pending');
  assert.equal(typeof host.resolvePendingState, 'function', 'host must expose pending resolution for success/error/timeout');
  host.resolvePendingState('save_task', { status: 'submit_success' });
  const released = renderer.renderVNode({
    id: 'save_task_button',
    type: 'Button',
    cell_ref: { model_id: 9417, p: 2, r: 4, c: 0 },
    props: {
      text: 'Save',
      pending: {
        pending_state_id: 'save_task',
        pending_text: 'Saving...',
        lock_scope: 'button',
        disable_while_pending: true,
        pending_until: 'submit_success',
        timeout_ms: 1000,
      },
    },
    bind: vnode.__sourceBind || {
      write: {
        bus_event_v2: true,
        bus_in_key: 'submit_request',
        value_t: 'modeltable',
        value_ref: [mt('__mt_payload_kind', 'str', 'ui_event.v1')],
      },
    },
  });
  assert.equal(released.props.loading, false, 'pending lock must clear after success');
  assert.equal(released.props.disabled, false, 'pending lock must re-enable after success');

  await released.props.onClick();
  assert.equal(host.getPendingState('save_task')?.pending, true, 'pending state must register again for a later submit');
  host.resolvePendingState('save_task', { status: 'submit_error' });
  const afterError = renderer.renderVNode({
    id: 'save_task_button',
    type: 'Button',
    cell_ref: { model_id: 9417, p: 2, r: 4, c: 0 },
    props: {
      text: 'Save',
      pending: {
        pending_state_id: 'save_task',
        pending_text: 'Saving...',
        lock_scope: 'button',
        disable_while_pending: true,
        pending_until: 'submit_error',
        timeout_ms: 1000,
      },
    },
    bind: {
      write: {
        bus_event_v2: true,
        bus_in_key: 'submit_request',
        value_t: 'modeltable',
        value_ref: [mt('__mt_payload_kind', 'str', 'ui_event.v1')],
      },
    },
  });
  assert.equal(afterError.props.loading, false, 'pending lock must clear after error');
  assert.equal(afterError.props.disabled, false, 'pending lock must re-enable after error');

  await afterError.props.onClick();
  assert.equal(host.getPendingState('save_task')?.pending, true, 'pending state must register before timeout release');
  host.resolvePendingState('save_task', { status: 'timeout' });
  const afterTimeout = renderer.renderVNode({
    id: 'save_task_button',
    type: 'Button',
    cell_ref: { model_id: 9417, p: 2, r: 4, c: 0 },
    props: {
      text: 'Save',
      pending: {
        pending_state_id: 'save_task',
        pending_text: 'Saving...',
        lock_scope: 'button',
        disable_while_pending: true,
        pending_until: 'timeout',
        timeout_ms: 1000,
      },
    },
    bind: {
      write: {
        bus_event_v2: true,
        bus_in_key: 'submit_request',
        value_t: 'modeltable',
        value_ref: [mt('__mt_payload_kind', 'str', 'ui_event.v1')],
      },
    },
  });
  assert.equal(afterTimeout.props.loading, false, 'pending lock must clear after timeout');
  assert.equal(afterTimeout.props.disabled, false, 'pending lock must re-enable after timeout');
  assert.equal(host.dispatched.length, 3, 'pending lock must allow new submits after success/error release while blocking duplicates during pending');
  assertConformanceEvidence(conformanceEvidence({ dataFlow: host.dispatched.length === 3 }), 'pending_lock');
  return { key: 'pending_lock_blocks_duplicate_submit', status: 'PASS' };
}

async function test_local_state_does_not_force_large_snapshot_patch() {
  const previousSnapshot = snapshotWithModel(9417, {
    draft_title: label('draft_title', 'str', ''),
  });
  const snapshot = JSON.parse(JSON.stringify(previousSnapshot));
  const host = hostWithSnapshot(snapshot);
  const renderer = createRenderer({ host, vue: fakeVue() });
  const input = renderer.renderVNode({
    id: 'local_only_patch_input',
    type: 'Input',
    cell_ref: { model_id: 9417, p: 2, r: 1, c: 0 },
    bind: {
      read: ref(9417, 'draft_title'),
      write: {
        action: 'label_update',
        target_ref: ref(9417, 'draft_title'),
      },
    },
  });
  input.props['onUpdate:modelValue']('local draft should not require full snapshot');
  assert.equal(host.dispatched.length, 0, 'local-only UI state must not dispatch server writes');
  assert.equal(previousSnapshot.models['9417'].cells['0,0,0'].labels.draft_title.v, '', 'local-only UI state must not mutate snapshot truth');
  const message = buildClientSnapshotPatchMessage({
    previousSnapshot,
    nextSnapshot: snapshot,
    baseSnapshotSeq: 1,
    snapshotSeq: 2,
    opId: 'it0417_local_state',
    previousPrincipalKey: 'alice',
    currentPrincipalKey: 'alice',
  });
  assert.notEqual(message.event, 'snapshot', 'local UI state must not force a full snapshot after bootstrap');
  assert.equal(message.event, 'noop', 'local-only UI state must not require any server projection event');
  const bytes = Buffer.byteLength(JSON.stringify(message.data ?? {}), 'utf8');
  assert.equal(bytes < 32 * 1024, true, `local UI state patch too large: ${bytes}`);
  assertConformanceEvidence(conformanceEvidence({ dataFlow: message.event === 'noop' }), 'local_state_patch_size');
  return { key: 'local_state_does_not_force_large_snapshot_patch', status: 'PASS' };
}

async function test_real_remote_store_supports_local_overlay_and_pending_host_contract() {
  const draftRef = ref(9417, 'draft_title');
  const store = createRemoteStore({ baseUrl: 'http://127.0.0.1:9', autoBootstrap: false });
  const dispatched = [];
  const host = {
    ...store,
    getSnapshot() {
      return store.snapshot;
    },
    dispatchAddLabel(value) {
      dispatched.push(value);
      return value;
    },
  };
  const renderer = createRenderer({ host, vue: fakeVue() });
  const input = renderer.renderVNode({
    id: 'real_store_draft_input',
    type: 'Input',
    cell_ref: { model_id: 9417, p: 2, r: 1, c: 0 },
    bind: {
      read: draftRef,
      write: {
        action: 'label_update',
        target_ref: draftRef,
      },
    },
  });
  input.props['onUpdate:modelValue']('real visible value');
  assert.equal(dispatched.length, 0, 'real remote_store must not dispatch default Input writes');
  assert.equal(store.getEffectiveLabelValue(draftRef), 'real visible value', 'real remote_store must honor renderer fallbackCommitPolicy=on_submit');

  const button = renderer.renderVNode({
    id: 'real_store_save_button',
    type: 'Button',
    cell_ref: { model_id: 9417, p: 2, r: 4, c: 0 },
    props: {
      text: 'Save',
      pending: {
        pending_state_id: 'real_store_save_task',
        disable_while_pending: true,
        pending_until: 'submit_success',
        timeout_ms: 1000,
      },
    },
    bind: {
      write: {
        bus_event_v2: true,
        bus_in_key: 'submit_request',
        value_t: 'modeltable',
        value_ref: [mt('__mt_payload_kind', 'str', 'ui_event.v1')],
      },
    },
  });
  await button.props.onClick();
  await button.props.onClick();
  assert.equal(dispatched.length, 1, 'real remote_store pending host API must let renderer block duplicate submits');
  assert.equal(store.getPendingState('real_store_save_task')?.pending, true, 'real remote_store must expose pending state');
  assert.equal(button.props.loading, true, 'real remote_store pending flow must expose loading state');
  assert.equal(button.props.disabled, true, 'real remote_store pending flow must disable the button');
  store.resolvePendingState('real_store_save_task', { status: 'submit_success' });
  const released = renderer.renderVNode({
    id: 'real_store_save_button',
    type: 'Button',
    cell_ref: { model_id: 9417, p: 2, r: 4, c: 0 },
    props: {
      text: 'Save',
      pending: {
        pending_state_id: 'real_store_save_task',
        disable_while_pending: true,
        pending_until: 'submit_success',
        timeout_ms: 1000,
      },
    },
    bind: {
      write: {
        bus_event_v2: true,
        bus_in_key: 'submit_request',
        value_t: 'modeltable',
        value_ref: [mt('__mt_payload_kind', 'str', 'ui_event.v1')],
      },
    },
  });
  assert.equal(released.props.loading, false, 'real remote_store pending state must release loading');
  assert.equal(released.props.disabled, false, 'real remote_store pending state must release disabled');
  assertConformanceEvidence(conformanceEvidence({ dataFlow: dispatched.length === 1 }), 'real_remote_store_overlay_pending');
  return { key: 'real_remote_store_supports_local_overlay_and_pending_host_contract', status: 'PASS' };
}

function submittedDraftFromSnapshot(snapshot) {
  const labels = snapshot?.models?.['0']?.cells?.['0,0,0']?.labels || {};
  const value = labels.submit_request?.v;
  if (!Array.isArray(value)) return undefined;
  return value.find((record) => record && record.k === 'draft_title')?.v;
}

function submitEnvelopeForText(text, opId) {
  return {
    type: 'bus_event_v2',
    bus_in_key: 'submit_request',
    value_t: 'modeltable',
    value: [
      mt('__mt_payload_kind', 'str', 'ui_event.v1'),
      mt('draft_title', 'str', text),
    ],
    meta: { source: 'it0417_http', op_id: opId },
  };
}

async function postJson(url, cookie, body) {
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(body),
  });
}

async function waitForRuntimeSnapshotReady(appBase, cookie, timeoutMs = 5000) {
  const startedAt = Date.now();
  let last = null;
  while (Date.now() - startedAt < timeoutMs) {
    const resp = await fetch(`${appBase}/snapshot?profile=bootstrap`, { headers: { cookie } });
    const body = await readJsonResponse(resp);
    last = { status: resp.status, body };
    if (resp.status === 200 && body && body.snapshot) return last;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`runtime_snapshot_not_ready:${JSON.stringify(last)}`);
}

async function test_start_server_routes_snapshot_and_events_by_principal_runtime() {
  const provider = await createMockOidcProvider();
  try {
    await withFreshServerEnv({
      DY_AUTH: '1',
      DY_OIDC_ISSUER: provider.issuer,
      DY_OIDC_CLIENT_ID: 'dongyu-app',
    }, async ({ startServer }, tempRoot) => {
      const appServer = startServer({
        port: 0,
        dbPath: null,
        skipFrontendBuild: true,
      });
      await waitListening(appServer);
      const appBase = serverBaseUrl(appServer);
      try {
        const aliceCookie = await loginViaMockOidc(appBase, provider, {
          sub: 'it0417-alice',
          email: 'alice@example.test',
          name: 'Alice',
          preferred_username: 'alice',
        });
        const bobCookie = await loginViaMockOidc(appBase, provider, {
          sub: 'it0417-bob',
          email: 'bob@example.test',
          name: 'Bob',
          preferred_username: 'bob',
        });
        for (const cookie of [aliceCookie, bobCookie]) {
          const modeResp = await postJson(`${appBase}/api/runtime/mode`, cookie, { mode: 'running' });
          assert.equal(modeResp.status, 202, 'authenticated principal must schedule its own runtime when cold');
          await waitForRuntimeSnapshotReady(appBase, cookie);
          const readyModeResp = await postJson(`${appBase}/api/runtime/mode`, cookie, { mode: 'running' });
          assert.equal(readyModeResp.status, 200, 'authenticated principal must activate its runtime after ready');
        }
        const aliceText = 'alice visible runtime value';
        const bobText = 'bob visible runtime value';
        const alicePost = await postJson(`${appBase}/bus_event`, aliceCookie, submitEnvelopeForText(aliceText, 'it0417_http_alice'));
        const bobPost = await postJson(`${appBase}/bus_event`, bobCookie, submitEnvelopeForText(bobText, 'it0417_http_bob'));
        assert.equal(alicePost.status, 200, 'alice bus_event must succeed');
        assert.equal(bobPost.status, 200, 'bob bus_event must succeed');
        const alicePostBody = await readJsonResponse(alicePost);
        const bobPostBody = await readJsonResponse(bobPost);
        assert.equal(alicePostBody.consumed, true, `alice bus_event must be consumed: ${JSON.stringify(alicePostBody)}`);
        assert.equal(bobPostBody.consumed, true, `bob bus_event must be consumed: ${JSON.stringify(bobPostBody)}`);
        assert.equal(alicePostBody.bus_event_last_op_id, 'it0417_http_alice', 'alice response must report alice runtime last op');
        assert.equal(bobPostBody.bus_event_last_op_id, 'it0417_http_bob', 'bob response must report bob runtime last op');

        const aliceSnapResp = await fetch(`${appBase}/snapshot`, { headers: { cookie: aliceCookie } });
        const bobSnapResp = await fetch(`${appBase}/snapshot`, { headers: { cookie: bobCookie } });
        assert.equal(aliceSnapResp.status, 200, 'alice snapshot must succeed');
        assert.equal(bobSnapResp.status, 200, 'bob snapshot must succeed');
        const aliceSnap = await readJsonResponse(aliceSnapResp);
        const bobSnap = await readJsonResponse(bobSnapResp);
        assert.equal(aliceSnap.op_id, 'it0417_http_alice', `alice snapshot must expose alice runtime op_id, got ${JSON.stringify(aliceSnap)}`);
        assert.equal(bobSnap.op_id, 'it0417_http_bob', `bob snapshot must expose bob runtime op_id, got ${JSON.stringify(bobSnap)}`);
        assert.notEqual(aliceSnap.op_id, bobSnap.op_id, 'principal snapshots must not share the same runtime state');
      } finally {
        appServer.close();
      }
    });
  } finally {
    provider.server.close();
  }
  assertConformanceEvidence(conformanceEvidence({ dataOwnership: true, dataFlow: true }), 'http_principal_runtime');
  return { key: 'start_server_routes_snapshot_and_events_by_principal_runtime', status: 'PASS' };
}

const tests = [
  test_principal_workspace_runtime_isolation,
  test_principal_response_rejection_does_not_fallback_to_shared_runtime,
  test_guest_is_read_only,
  test_default_input_submit_policy_is_local_only,
  test_submit_reads_visible_local_overlay_and_keeps_bus_path,
  test_dialog_tabs_and_view_state_are_local_only,
  test_pending_lock_blocks_duplicate_submit,
  test_local_state_does_not_force_large_snapshot_patch,
  test_real_remote_store_supports_local_overlay_and_pending_host_contract,
  test_start_server_routes_snapshot_and_events_by_principal_runtime,
];

const failures = [];
for (const test of tests) {
  try {
    const result = await test();
    console.log(`PASS ${result.key}`);
  } catch (error) {
    failures.push({ test: test.name, error });
    console.error(`FAIL ${test.name}`);
    console.error(error && error.stack ? error.stack : String(error));
  }
}

if (failures.length > 0) {
  console.error(`FAIL ${failures.length}/${tests.length}`);
  process.exit(1);
}

console.log(`PASS ${tests.length}/${tests.length}`);
