#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildBusEventV2 } from '../../packages/ui-model-demo-frontend/src/bus_event_v2.js';
import { createDemoStore } from '../../packages/ui-model-demo-frontend/src/demo_modeltable.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const EXPENSIVE_DERIVED_LABEL_KEYS = new Set([
  'home_table_rows_json',
  'editor_model_options_json',
  'ws_apps_registry',
]);

const POST_LOAD_PATCH_MAX_BYTES = 32 * 1024;
function writeLabelPayload({ target, label: targetLabel, requestId }) {
  return [
    mt('__mt_payload_kind', 'str', 'write_label.v1'),
    mt('__mt_request_id', 'str', requestId || `it0416_${Date.now()}`),
    mt('__mt_from_cell', 'json', { p: 0, r: 0, c: 0 }),
    mt('__mt_target_cell', 'json', target),
    mt(targetLabel.k, targetLabel.t, targetLabel.v),
  ];
}

function workspacePinPayload(kind, labels = []) {
  return [
    mt('__mt_payload_kind', 'str', kind),
    ...labels.map((entry) => mt(entry.k, entry.t, entry.v)),
  ];
}

function pinEnvelope(target, pin, value = undefined, opId = `${pin}_${Date.now()}`) {
  return {
    event_id: Date.now(),
    type: pin,
    payload: {
      meta: { op_id: opId },
      target,
      pin,
      ...(value !== undefined ? { value } : {}),
    },
    source: 'ui_renderer',
    ts: Date.now(),
  };
}

function mt(k, t, v) {
  return { id: 0, p: 0, r: 0, c: 0, k, t, v };
}

function label(k, t, v) {
  return { k, t, v };
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

function waitListening(server) {
  if (server.listening) return Promise.resolve();
  return new Promise((resolve) => server.once('listening', resolve));
}

async function importFreshServerModule() {
  const url = pathToFileURL(path.join(repoRoot, 'packages/ui-model-demo-server/server.mjs'));
  url.search = `t=${Date.now()}-${Math.random()}`;
  return import(url.href);
}

async function withServerEnv(extraEnv, fn) {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'dy-0416-post-load-'));
  const prior = {
    DY_AUTH: process.env.DY_AUTH,
    DY_PERSISTED_ASSET_ROOT: process.env.DY_PERSISTED_ASSET_ROOT,
    WORKER_BASE_WORKSPACE: process.env.WORKER_BASE_WORKSPACE,
    WORKER_BASE_DATA_ROOT: process.env.WORKER_BASE_DATA_ROOT,
    DOCS_ROOT: process.env.DOCS_ROOT,
    STATIC_PROJECTS_ROOT: process.env.STATIC_PROJECTS_ROOT,
    DY_UI_SERVER_WORKER_ID: process.env.DY_UI_SERVER_WORKER_ID,
    MODELTABLE_PATCH_JSON: process.env.MODELTABLE_PATCH_JSON,
  };
  process.env.DY_AUTH = extraEnv.DY_AUTH || '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0416_post_load_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  process.env.WORKER_BASE_DATA_ROOT = path.join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = path.join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = path.join(tempRoot, 'static');
  process.env.DY_UI_SERVER_WORKER_ID = 'U1';
  delete process.env.MODELTABLE_PATCH_JSON;
  for (const [key, value] of Object.entries(extraEnv || {})) {
    process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function withAuthenticatedAppServer(fn) {
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
  try {
    return await withServerEnv({
      DY_AUTH: '1',
      DY_OIDC_ISSUER: issuer,
      DY_OIDC_CLIENT_ID: 'dongyu-app',
      DY_OIDC_REDIRECT_URI: 'http://127.0.0.1:0/auth/sso/callback',
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
      return fn({ appServer, appBase, sessionCookie });
    });
  } finally {
    await closeServer(appServer);
    await closeServer(oidcServer);
  }
}

function createSseReader(resp) {
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  return {
    async nextEvent(timeoutMs = 5000) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const idx = buffer.indexOf('\n\n');
        if (idx >= 0) {
          const block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const lines = block.split(/\n/u);
          const eventLine = lines.find((line) => line.startsWith('event: '));
          const dataLines = lines.filter((line) => line.startsWith('data: ')).map((line) => line.slice(6));
          if (!eventLine && dataLines.length === 0) continue;
          return {
            event: eventLine ? eventLine.slice(7).trim() : 'message',
            dataText: dataLines.join('\n'),
            data: dataLines.length > 0 ? JSON.parse(dataLines.join('\n')) : null,
          };
        }
        const remaining = Math.max(1, deadline - Date.now());
        const read = await Promise.race([
          reader.read(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('sse_event_timeout')), remaining)),
        ]);
        if (read.done) throw new Error('sse_stream_closed');
        buffer += decoder.decode(read.value, { stream: true });
      }
      throw new Error('sse_event_timeout');
    },
    async close() {
      try { await reader.cancel(); } catch (_) {}
    },
  };
}

function flattenPatchLabelKeys(patch) {
  const out = [];
  for (const op of patch?.ops || []) {
    if (op?.label_key) out.push(String(op.label_key));
    const labels = op?.value?.labels;
    if (labels && typeof labels === 'object') {
      out.push(...Object.keys(labels));
    }
  }
  return out;
}

function patchHasModelLabel(patch, modelId, labelKey) {
  for (const op of patch?.ops || []) {
    if (op?.model_id !== modelId) continue;
    if (op?.label_key === labelKey) return true;
    const labels = op?.value?.labels;
    if (labels && Object.prototype.hasOwnProperty.call(labels, labelKey)) return true;
    const cells = op?.value?.cells;
    if (cells && typeof cells === 'object') {
      for (const cell of Object.values(cells)) {
        if (cell?.labels && Object.prototype.hasOwnProperty.call(cell.labels, labelKey)) return true;
      }
    }
  }
  return false;
}

function readSnapshotRegistry(snapshot) {
  return snapshot?.models?.['-2']?.cells?.['0,0,0']?.labels?.ws_apps_registry?.v || [];
}

function addSlideAppModel(runtime, modelId, appName) {
  const model = runtime.createModel({ id: modelId, name: appName, type: 'sliding_ui' });
  runtime.addLabel(model, 0, 0, 0, { k: 'app_name', t: 'str', v: appName });
  runtime.addLabel(model, 0, 0, 0, { k: 'slide_app_summary', t: 'str', v: `${appName} summary` });
  runtime.addLabel(model, 0, 0, 0, { k: 'slide_capable', t: 'bool', v: true });
  runtime.addLabel(model, 0, 0, 0, { k: 'slide_surface_type', t: 'str', v: 'workspace.page' });
  runtime.addLabel(model, 0, 0, 0, { k: 'ui_authoring_version', t: 'str', v: 'cellwise.ui.v1' });
  runtime.addLabel(model, 0, 0, 0, { k: 'ui_root_node_id', t: 'str', v: `${appName}_root` });
  runtime.addLabel(model, 0, 0, 0, { k: 'deletable', t: 'bool', v: true });
  runtime.addLabel(model, 0, 0, 0, { k: 'ws_deleted', t: 'bool', v: false });
  runtime.addLabel(model, 2, 0, 0, { k: 'ui_node_id', t: 'str', v: `${appName}_root` });
  runtime.addLabel(model, 2, 0, 0, { k: 'ui_component', t: 'str', v: 'Text' });
  runtime.addLabel(model, 2, 0, 0, { k: 'ui_text', t: 'str', v: appName });
}

function patchBytes(patch) {
  return Buffer.byteLength(JSON.stringify(patch), 'utf8');
}

function assertPatchStatsMatch(data, context) {
  const patch = data?.snapshot_patch;
  assert.equal(Boolean(patch), true, `${context} must include snapshot_patch`);
  assert.equal(
    Number.isInteger(data?.patch_stats?.bytes),
    true,
    `${context} must expose patch_stats.bytes`,
  );
  assert.equal(
    Number.isInteger(data?.patch_stats?.op_count),
    true,
    `${context} must expose patch_stats.op_count`,
  );
  assert.equal(
    data.patch_stats.bytes,
    patchBytes(patch),
    `${context} patch_stats.bytes must equal serialized snapshot_patch bytes`,
  );
  assert.equal(
    data.patch_stats.op_count,
    (patch.ops || []).length,
    `${context} patch_stats.op_count must equal ops length`,
  );
}

async function readResponseJson(resp) {
  const text = await resp.text();
  return text ? JSON.parse(text) : {};
}

async function activateRuntimeModeRunning(appBase, sessionCookie, message) {
  const deadline = Date.now() + 5000;
  let lastStatus = 0;
  let lastBody = {};
  while (Date.now() < deadline) {
    const resp = await fetch(`${appBase}/api/runtime/mode`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: sessionCookie },
      body: JSON.stringify({ mode: 'running' }),
    });
    lastStatus = resp.status;
    lastBody = await readResponseJson(resp);
    if (resp.status === 200) return lastBody;
    if (resp.status !== 202) break;
    const retryAfter = Number.isFinite(lastBody?.retry_after_ms) ? Math.max(10, Number(lastBody.retry_after_ms)) : 100;
    await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfter, 250)));
  }
  assert.equal(lastStatus, 200, `${message}: ${JSON.stringify(lastBody)}`);
  return lastBody;
}

async function test_patch_messages_expose_stats_and_keep_ordinary_patch_under_32kb() {
  const { buildClientSnapshotPatchMessage } = await importFreshServerModule();
  const previous = {
    models: {
      '100': {
        id: 100,
        cells: {
          '0,0,0': {
            p: 0,
            r: 0,
            c: 0,
            labels: {
              title: label('title', 'str', 'Before'),
            },
          },
        },
      },
    },
    v1nConfig: {},
  };
  const next = {
    models: {
      '100': {
        id: 100,
        cells: {
          '0,0,0': {
            p: 0,
            r: 0,
            c: 0,
            labels: {
              title: label('title', 'str', 'After'),
            },
          },
        },
      },
    },
    v1nConfig: {},
  };
  const message = buildClientSnapshotPatchMessage({
    previousSnapshot: previous,
    nextSnapshot: next,
    baseSnapshotSeq: 4,
    snapshotSeq: 5,
    opId: 'it0416_helper_patch_stats',
    previousPrincipalKey: 'drop',
    currentPrincipalKey: 'drop',
    snapshotProfile: 'bootstrap',
    visibleModelIds: [100, -23],
  });
  assert.equal(message.event, 'snapshot_patch', 'ordinary small change must stay snapshot_patch');
  assert.equal(message.data.snapshot_profile, 'bootstrap', 'ordinary patch must preserve active snapshot profile');
  assert.deepEqual(message.data.visible_model_ids, [-23, 100], 'ordinary patch must preserve sorted active visible model ids');
  assertPatchStatsMatch(message.data, 'helper ordinary patch');
  assert.equal(
    message.data.patch_stats.bytes <= POST_LOAD_PATCH_MAX_BYTES,
    true,
    'ordinary patch stats must satisfy the 32KB post-load contract',
  );
}

async function test_oversize_patch_fallback_records_observable_reason() {
  const { buildClientSnapshotPatchMessage } = await importFreshServerModule();
  const previous = {
    models: {
      '100': {
        id: 100,
        cells: {
          '0,0,0': { p: 0, r: 0, c: 0, labels: { text: label('text', 'str', 'small') } },
        },
      },
    },
    v1nConfig: {},
  };
  const next = {
    models: {
      '100': {
        id: 100,
        cells: {
          '0,0,0': { p: 0, r: 0, c: 0, labels: { text: label('text', 'str', 'x'.repeat(4096)) } },
        },
      },
    },
    v1nConfig: {},
  };
  const message = buildClientSnapshotPatchMessage({
    previousSnapshot: previous,
    nextSnapshot: next,
    baseSnapshotSeq: 8,
    snapshotSeq: 9,
    opId: 'it0416_oversize_observable',
    previousPrincipalKey: 'drop',
    currentPrincipalKey: 'drop',
    maxPatchBytes: 128,
    snapshotProfile: 'bootstrap',
    visibleModelIds: [100, -23],
  });
  assert.equal(message.event, 'snapshot', 'oversize patch may fall back to full snapshot');
  assert.equal(message.data.patch_kind, 'oversize_reset', 'oversize fallback must have explicit patch_kind');
  assert.equal(message.data.snapshot_profile, 'bootstrap', 'oversize fallback reset must preserve the active snapshot profile');
  assert.deepEqual(message.data.visible_model_ids, [-23, 100], 'oversize fallback reset must preserve sorted active visible model ids');
  assert.equal(
    Number.isInteger(message.data?.patch_stats?.bytes),
    true,
    'oversize fallback must record attempted patch_stats.bytes',
  );
  assert.equal(
    message.data?.fallback_reason,
    'patch_oversize',
    'oversize fallback must record observable fallback_reason',
  );
}

async function test_default_post_load_patch_limit_is_32kb() {
  const { buildClientSnapshotPatchMessage } = await importFreshServerModule();
  const previous = {
    models: {
      '100': {
        id: 100,
        cells: {
          '0,0,0': { p: 0, r: 0, c: 0, labels: { text: label('text', 'str', 'small') } },
        },
      },
    },
    v1nConfig: {},
  };
  const next = {
    models: {
      '100': {
        id: 100,
        cells: {
          '0,0,0': {
            p: 0,
            r: 0,
            c: 0,
            labels: { text: label('text', 'str', 'x'.repeat(40 * 1024)) },
          },
        },
      },
    },
    v1nConfig: {},
  };
  const message = buildClientSnapshotPatchMessage({
    previousSnapshot: previous,
    nextSnapshot: next,
    baseSnapshotSeq: 10,
    snapshotSeq: 11,
    opId: 'it0416_default_limit_oversize',
    previousPrincipalKey: 'drop',
    currentPrincipalKey: 'drop',
  });
  assert.equal(message.event, 'snapshot', 'default post-load patch limit must fall back above 32KB');
  assert.equal(message.data.patch_kind, 'oversize_reset', 'default oversize fallback must be explicit');
  assert.equal(message.data.fallback_reason, 'patch_oversize', 'default oversize fallback must expose reason');
  assert.equal(
    message.data.patch_stats.bytes > POST_LOAD_PATCH_MAX_BYTES,
    true,
    'attempted patch must prove it crossed the 32KB post-load limit',
  );
}

async function test_ordinary_stream_patch_has_stats_and_no_expensive_derived_labels() {
  await withAuthenticatedAppServer(async ({ appBase, sessionCookie }) => {
    let sse = null;
    try {
      await activateRuntimeModeRunning(appBase, sessionCookie, 'runtime mode activation must succeed');

      const streamResp = await fetch(`${appBase}/stream?profile=bootstrap&visible_model_id=100`, { headers: { cookie: sessionCookie } });
      assert.equal(streamResp.status, 200, 'stream must open');
      sse = createSseReader(streamResp);
      const initial = await sse.nextEvent();
      assert.equal(initial.event, 'snapshot', 'initial stream event must include subscribed visible app snapshot');

      const event = buildBusEventV2({
        busInKey: 'bus_event_submit_100_0_0_0',
        value: [
          mt('__mt_payload_kind', 'str', 'ui_event.v1'),
          mt('input_value', 'str', `ordinary_${Date.now()}`),
        ],
        opId: 'it0416_ordinary_post_load_patch',
        source: 'test',
      });
      const busResp = await fetch(`${appBase}/bus_event`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: sessionCookie },
        body: JSON.stringify(event),
      });
      assert.equal(busResp.status, 200, 'ordinary bus_event must succeed');
      const busJson = await readResponseJson(busResp);
      assert.equal(busJson.result, 'ok', 'ordinary bus_event must report successful result');
      assert.equal(busJson.routed_by, 'model0_busin', 'ordinary bus_event must enter through Model 0 bus ingress');
      assert.equal(busJson.bus_event_error, null, 'ordinary bus_event must not write bus_event_error');
      let sawBusinessLabel = false;
      for (let i = 0; i < 4 && !sawBusinessLabel; i += 1) {
        const next = await sse.nextEvent();
        assert.equal(next.event, 'snapshot_patch', 'ordinary post-load event must not silently fall back to full snapshot');
        assert.equal(next.data.snapshot_profile, 'bootstrap', `ordinary stream patch ${i + 1} must preserve active snapshot profile`);
        assert.deepEqual(next.data.visible_model_ids, [100], `ordinary stream patch ${i + 1} must preserve active visible model ids`);
        assertPatchStatsMatch(next.data, `ordinary stream patch ${i + 1}`);
        assert.equal(
          next.data.patch_stats.bytes <= POST_LOAD_PATCH_MAX_BYTES,
          true,
          `ordinary stream patch ${i + 1} must stay <= ${POST_LOAD_PATCH_MAX_BYTES} bytes`,
        );
        const patchedKeys = flattenPatchLabelKeys(next.data.snapshot_patch);
        for (const key of EXPENSIVE_DERIVED_LABEL_KEYS) {
          assert.equal(
            patchedKeys.includes(key),
            false,
            `ordinary stream patch ${i + 1} must not carry expensive derived label ${key}`,
          );
        }
        sawBusinessLabel = patchHasModelLabel(next.data.snapshot_patch, 100, 'status')
          || patchHasModelLabel(next.data.snapshot_patch, 100, 'submit_inflight');
      }
      assert.equal(
        sawBusinessLabel,
        true,
        'ordinary stream patches must eventually include the actual Model 100 business state written through Model 0',
      );
    } finally {
      if (sse) await sse.close();
    }
  });
}

async function test_oversize_stream_reset_preserves_profile_metadata() {
  await withAuthenticatedAppServer(async ({ appBase, sessionCookie }) => {
    let sse = null;
    try {
      await activateRuntimeModeRunning(appBase, sessionCookie, 'runtime mode activation must succeed');

      const streamResp = await fetch(`${appBase}/stream?profile=bootstrap&visible_model_id=100`, { headers: { cookie: sessionCookie } });
      assert.equal(streamResp.status, 200, 'stream must open');
      sse = createSseReader(streamResp);
      const initial = await sse.nextEvent();
      assert.equal(initial.event, 'snapshot', 'initial stream event must include subscribed visible app snapshot');

      const largeLabelKey = `it0416_large_${Date.now()}`;
      const largeValue = `large_${'x'.repeat(40 * 1024)}`;
      const updateResp = await fetch(`${appBase}/bus_event`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: sessionCookie },
        body: JSON.stringify({
          event_id: Date.now(),
          type: 'ui_owner_label_update',
          payload: {
            action: 'ui_owner_label_update',
            meta: { op_id: 'it0416_oversize_stream_reset' },
            target: { model_id: 100, p: 0, r: 0, c: 0, k: largeLabelKey },
            value: { t: 'str', v: largeValue },
          },
          source: 'ui_renderer',
          ts: Date.now(),
        }),
      });
      assert.equal(updateResp.status, 200, 'oversize owner update must be accepted');
      const updateJson = await readResponseJson(updateResp);
      assert.equal(updateJson.result, 'ok', 'oversize owner update must report successful result');
      assert.equal(updateJson.routed_by, 'pin', 'oversize owner update must still use owner pin path');

      const next = await sse.nextEvent();
      assert.equal(next.event, 'snapshot', 'oversize stream patch must fall back to snapshot reset');
      assert.equal(next.data.patch_kind, 'oversize_reset', 'oversize stream reset must be explicit');
      assert.equal(next.data.fallback_reason, 'patch_oversize', 'oversize stream reset must expose fallback reason');
      assert.equal(next.data.snapshot_profile, 'bootstrap', 'oversize stream reset must preserve active snapshot profile');
      assert.deepEqual(next.data.visible_model_ids, [100], 'oversize stream reset must preserve active visible model ids');
      assert.equal(
        next.data.patch_stats.bytes > POST_LOAD_PATCH_MAX_BYTES,
        true,
        'oversize stream reset must report attempted patch bytes above the post-load limit',
      );
      assert.equal(
        next.data.snapshot?.models?.['100']?.cells?.['0,0,0']?.labels?.[largeLabelKey]?.v,
        largeValue,
        'oversize stream reset snapshot must include the new visible model label',
      );
    } finally {
      if (sse) await sse.close();
    }
  });
}

async function test_app_index_event_is_allowed_to_patch_ws_apps_registry() {
  await withAuthenticatedAppServer(async ({ appBase, sessionCookie }) => {
    let sse = null;
    try {
      await activateRuntimeModeRunning(appBase, sessionCookie, 'runtime mode activation must succeed');

      const streamResp = await fetch(`${appBase}/stream?profile=bootstrap`, { headers: { cookie: sessionCookie } });
      assert.equal(streamResp.status, 200, 'stream must open');
      sse = createSseReader(streamResp);
      const initial = await sse.nextEvent();
      assert.equal(initial.event, 'snapshot', 'initial stream event must use bootstrap snapshot');

      const nameEvent = pinEnvelope(
        { model_id: -25, p: 2, r: 10, c: 0 },
        'change',
        workspacePinPayload('ws_add_name.v1', [{ k: 'name', t: 'str', v: `0416 Indexed App ${Date.now()}` }]),
        'it0416_ws_add_name',
      );
      const nameResp = await fetch(`${appBase}/bus_event`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: sessionCookie },
        body: JSON.stringify(nameEvent),
      });
      assert.equal(nameResp.status, 200, 'workspace add name event must succeed');
      const nameJson = await readResponseJson(nameResp);
      assert.equal(nameJson.result, 'ok', 'workspace add name must be accepted before add click');

      const addEvent = pinEnvelope(
        { model_id: -25, p: 2, r: 11, c: 0 },
        'click',
        workspacePinPayload('ws_add_app.v1'),
        'it0416_ws_add_app',
      );
      const addResp = await fetch(`${appBase}/bus_event`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: sessionCookie },
        body: JSON.stringify(addEvent),
      });
      assert.equal(addResp.status, 200, 'workspace add app event must succeed');
      const addJson = await readResponseJson(addResp);
      assert.equal(addJson.result, 'ok', 'workspace add app must report successful result');
      let patchedKeys = [];
      const observedPatchKeys = [];
      for (let i = 0; i < 4; i += 1) {
        const next = await sse.nextEvent();
        assert.equal(next.event, 'snapshot_patch', 'app-index event should use patch when possible');
        assertPatchStatsMatch(next.data, 'app-index stream patch');
        patchedKeys = flattenPatchLabelKeys(next.data.snapshot_patch);
        observedPatchKeys.push(patchedKeys.join(','));
        if (patchedKeys.includes('ws_apps_registry')) break;
      }
      assert.equal(
        patchedKeys.includes('ws_apps_registry'),
        true,
        `app-index event must be allowed to patch ws_apps_registry; observed patch keys: ${observedPatchKeys.join(' | ')}`,
      );
    } finally {
      if (sse) await sse.close();
    }
  });
}

async function test_server_explicit_app_index_scope_refreshes_ws_apps_registry() {
  await withServerEnv({ DY_AUTH: '0' }, async () => {
    const { createServerState } = await importFreshServerModule();
    const state = createServerState({ dbPath: null });
    const modelId = 4107;
    const appName = `0416 Explicit App Index ${Date.now()}`;
    assert.equal(
      readSnapshotRegistry(state.clientSnap()).some((entry) => entry && entry.model_id === modelId),
      false,
      'test app must not be present before app-index refresh',
    );
    addSlideAppModel(state.runtime, modelId, appName);
    state.updateDerived({ scope: 'business' });
    assert.equal(
      readSnapshotRegistry(state.clientSnap()).some((entry) => entry && entry.model_id === modelId),
      false,
      'business scope must not refresh ws_apps_registry',
    );
    state.updateDerived({ scope: 'app_index' });
    assert.equal(
      readSnapshotRegistry(state.clientSnap()).some((entry) => entry && entry.model_id === modelId && entry.name === appName),
      true,
      'explicit app_index scope must refresh ws_apps_registry',
    );
  });
}

async function test_local_demo_business_scope_does_not_refresh_ws_apps_registry() {
  const store = createDemoStore({ uiMode: 'v1', adapterMode: 'v1' });
  const modelId = 4108;
  const appName = `0416 Local Business Scope ${Date.now()}`;
  assert.equal(
    readSnapshotRegistry(store.snapshot).some((entry) => entry && entry.model_id === modelId),
    false,
    'local test app must not be present before business update',
  );
  addSlideAppModel(store.runtime, modelId, appName);
  store.dispatchAddLabel({
    p: 0,
    r: 0,
    c: 0,
    k: 'bus_in_event',
    t: 'event',
    v: buildBusEventV2({
      busInKey: 'ui_submit',
      value: [mt('__mt_payload_kind', 'str', 'ui_event.v1')],
      opId: 'it0416_local_business_scope',
      source: 'test',
    }),
  });
  assert.equal(
    readSnapshotRegistry(store.snapshot).some((entry) => entry && entry.model_id === modelId),
    false,
    'local demo business update must not refresh ws_apps_registry',
  );
}

const tests = [
  test_patch_messages_expose_stats_and_keep_ordinary_patch_under_32kb,
  test_oversize_patch_fallback_records_observable_reason,
  test_default_post_load_patch_limit_is_32kb,
  test_ordinary_stream_patch_has_stats_and_no_expensive_derived_labels,
  test_oversize_stream_reset_preserves_profile_metadata,
  test_app_index_event_is_allowed_to_patch_ws_apps_registry,
  test_server_explicit_app_index_scope_refreshes_ws_apps_registry,
  test_local_demo_business_scope_does_not_refresh_ws_apps_registry,
];

let failed = 0;
for (const test of tests) {
  try {
    await test();
    console.log(`PASS ${test.name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${test.name}`);
    console.error(err && err.stack ? err.stack : err);
  }
}

if (failed > 0) {
  console.error(`\nFAIL test_0416_post_load_projection_latency_contract: ${failed} failed`);
  process.exit(1);
}

console.log(`\nPASS test_0416_post_load_projection_latency_contract: ${tests.length} passed`);
