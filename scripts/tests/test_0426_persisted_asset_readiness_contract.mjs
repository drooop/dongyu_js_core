#!/usr/bin/env node

import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

async function importFreshServerModule(label) {
  return import(`../../packages/ui-model-demo-server/server.mjs?it0426_asset=${encodeURIComponent(label)}_${Date.now()}_${Math.random()}`);
}

function serverBaseUrl(server) {
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

async function waitListening(server) {
  if (server.listening) return;
  await once(server, 'listening');
}

async function closeServer(server) {
  if (!server || !server.listening) return;
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

async function withEnv(env, fn) {
  const previous = {};
  for (const [key, value] of Object.entries(env)) {
    previous[key] = process.env[key];
    if (value === undefined || value === null) delete process.env[key];
    else process.env[key] = String(value);
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function createAssetRoot({ withManifest }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dy-0426-assets-'));
  if (withManifest) {
    writeAssetManifest(dir);
  }
  return dir;
}

function writeAssetManifest(dir) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'manifest.v0.json'),
    JSON.stringify({ version: 'dy.asset_manifest.v0', entries: [] }, null, 2) + '\n',
    'utf8',
  );
}

async function startServerForAssetRoot(assetRoot, label) {
  return withEnv({
    DY_AUTH: '0',
    DY_PERSISTED_ASSET_ROOT: assetRoot,
    DY_PRINCIPAL_RUNTIME_INIT_DELAY_MS: '0',
  }, async () => {
    const { startServer } = await importFreshServerModule(label);
    const server = startServer({ port: 0, dbPath: null, skipFrontendBuild: true });
    await waitListening(server);
    return server;
  });
}

async function readJson(resp) {
  const text = await resp.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch (_) {
    return { raw: text };
  }
}

async function test_missing_manifest_returns_not_ready_for_runtime_entrypoints() {
  const assetRoot = createAssetRoot({ withManifest: false });
  let server = null;
  try {
    server = await startServerForAssetRoot(assetRoot, 'missing-manifest');
    const base = serverBaseUrl(server);

    const snapshotResp = await fetch(`${base}/snapshot?profile=bootstrap&initial_projection=1`);
    const snapshotBody = await readJson(snapshotResp);
    assert.equal(snapshotResp.status, 503, 'snapshot_must_return_not_ready_when_manifest_missing');
    assert.equal(snapshotBody.code, 'persisted_asset_not_ready');
    assert.match(String(snapshotBody.error || ''), /missing_persisted_asset_manifest|persisted_asset_manifest_missing/);

    const visibleResp = await fetch(`${base}/snapshot?profile=visible&model_id=1`);
    const visibleBody = await readJson(visibleResp);
    assert.equal(visibleResp.status, 503, 'visible_snapshot_must_return_not_ready_when_manifest_missing');
    assert.equal(visibleBody.code, 'persisted_asset_not_ready');

    const streamResp = await fetch(`${base}/stream?profile=bootstrap`);
    const streamText = await streamResp.text();
    assert.equal(streamResp.status, 200, 'sse_must_open_and_emit_bounded_not_ready_event');
    assert.match(streamResp.headers.get('content-type') || '', /text\/event-stream/);
    assert.match(streamText, /event:\s*persisted_asset_not_ready/);
    assert.match(streamText, /"code":"persisted_asset_not_ready"/);

    const runtimeModeResp = await fetch(`${base}/api/runtime/mode`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'running' }),
    });
    const runtimeModeBody = await readJson(runtimeModeResp);
    assert.equal(runtimeModeResp.status, 503, 'runtime_mode_must_return_not_ready_when_manifest_missing');
    assert.equal(runtimeModeBody.code, 'persisted_asset_not_ready');

    const busResp = await fetch(`${base}/bus_event`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'bus_event_v2', payload: { action: 'noop' } }),
    });
    const busBody = await readJson(busResp);
    assert.equal(busResp.status, 503, 'bus_event_must_return_not_ready_when_manifest_missing');
    assert.equal(busBody.code, 'persisted_asset_not_ready');
  } finally {
    await closeServer(server);
    fs.rmSync(assetRoot, { recursive: true, force: true });
  }
  return { key: 'missing_manifest_returns_not_ready_for_runtime_entrypoints', status: 'PASS' };
}

async function test_missing_configured_asset_root_returns_not_ready() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'dy-0426-assets-parent-'));
  const missingRoot = path.join(parent, 'missing-mounted-root');
  let server = null;
  try {
    server = await startServerForAssetRoot(missingRoot, 'missing-root');
    const resp = await fetch(`${serverBaseUrl(server)}/snapshot?profile=bootstrap&initial_projection=1`);
    const body = await readJson(resp);
    assert.equal(resp.status, 503, 'configured_missing_asset_root_must_return_not_ready');
    assert.equal(body.code, 'persisted_asset_not_ready');
    assert.match(String(body.error || ''), /missing_persisted_asset_manifest|persisted_asset_manifest_missing/);
  } finally {
    await closeServer(server);
    fs.rmSync(parent, { recursive: true, force: true });
  }
  return { key: 'missing_configured_asset_root_returns_not_ready', status: 'PASS' };
}

async function test_valid_manifest_does_not_trigger_asset_not_ready() {
  const assetRoot = createAssetRoot({ withManifest: true });
  let server = null;
  try {
    server = await startServerForAssetRoot(assetRoot, 'valid-manifest');
    const resp = await fetch(`${serverBaseUrl(server)}/snapshot?profile=bootstrap&initial_projection=1`);
    const body = await readJson(resp);
    assert.notEqual(resp.status, 503, 'valid_manifest_must_not_report_asset_not_ready');
    assert.notEqual(body.code, 'persisted_asset_not_ready');
  } finally {
    await closeServer(server);
    fs.rmSync(assetRoot, { recursive: true, force: true });
  }
  return { key: 'valid_manifest_does_not_trigger_asset_not_ready', status: 'PASS' };
}

async function test_manifest_becoming_ready_recovers_without_restart() {
  const assetRoot = createAssetRoot({ withManifest: false });
  let server = null;
  try {
    server = await startServerForAssetRoot(assetRoot, 'manifest-late-ready');
    const base = serverBaseUrl(server);
    const firstResp = await fetch(`${base}/snapshot?profile=bootstrap&initial_projection=1`);
    const firstBody = await readJson(firstResp);
    assert.equal(firstResp.status, 503, 'first_snapshot_must_report_manifest_not_ready');
    assert.equal(firstBody.code, 'persisted_asset_not_ready');

    writeAssetManifest(assetRoot);
    const secondResp = await fetch(`${base}/snapshot?profile=bootstrap&initial_projection=1`);
    const secondBody = await readJson(secondResp);
    assert.notEqual(secondResp.status, 503, 'snapshot_must_recover_after_manifest_appears_without_restart');
    assert.notEqual(secondBody.code, 'persisted_asset_not_ready');
    assert.ok(secondBody.snapshot, 'recovered_snapshot_must_include_snapshot');
  } finally {
    await closeServer(server);
    fs.rmSync(assetRoot, { recursive: true, force: true });
  }
  return { key: 'manifest_becoming_ready_recovers_without_restart', status: 'PASS' };
}

async function test_cloud_deploy_scripts_verify_persisted_asset_manifest_in_pod() {
  const appScript = fs.readFileSync(path.join(process.cwd(), 'scripts/ops/deploy_cloud_app.sh'), 'utf8');
  const fullScript = fs.readFileSync(path.join(process.cwd(), 'scripts/ops/deploy_cloud_full.sh'), 'utf8');
  for (const [name, source] of [
    ['deploy_cloud_app.sh', appScript],
    ['deploy_cloud_full.sh', fullScript],
  ]) {
    assert.match(source, /manifest\.v0\.json/, `${name}_must_check_manifest_v0`);
    assert.match(source, /persisted[-_ ]asset/i, `${name}_must_name_persisted_asset_check`);
    assert.match(source, /kubectl[\s\S]+exec|exec_in_running/i, `${name}_must_check_from_running_pod_context`);
  }
  assert.match(
    appScript,
    /if \[ "\$TARGET" = "ui-server" \]; then[\s\S]*verify_persisted_asset_manifest_in_pod "\$APP_LABEL"[\s\S]*skipped for target/,
    'deploy_cloud_app_persisted_asset_gate_must_only_run_for_ui_server_target',
  );
  return { key: 'cloud_deploy_scripts_verify_persisted_asset_manifest_in_pod', status: 'PASS' };
}

const tests = [
  test_missing_manifest_returns_not_ready_for_runtime_entrypoints,
  test_missing_configured_asset_root_returns_not_ready,
  test_valid_manifest_does_not_trigger_asset_not_ready,
  test_manifest_becoming_ready_recovers_without_restart,
  test_cloud_deploy_scripts_verify_persisted_asset_manifest_in_pod,
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
