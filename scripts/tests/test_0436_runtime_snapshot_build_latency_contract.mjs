#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

function label(k, t, v) {
  return { k, t, v };
}

function principal(subject = 'local-dev') {
  return {
    subject,
    capabilities: ['workspace:read', 'workspace:write', 'app:read', 'app:write', 'slide_app:use'],
  };
}

function mountSubtable(runtime, tableId, ownerPrincipalId, rootModelId = 0) {
  const root = runtime.getModel(0);
  runtime.addLabel(root, 70, 0, 0, {
    k: 'it0436_subtable_mount',
    t: 'model.subtableconnection',
    v: { table_id: tableId, root_model_id: rootModelId, mount_kind: 'slide_app', owner_principal_id: ownerPrincipalId },
  });
}

function addSlideAppModel(runtime, tableId, modelId, title) {
  const model = runtime.getModel({ table_id: tableId, model_id: modelId })
    || runtime.createModel({ table_id: tableId, id: modelId, name: title, type: 'sliding_ui' });
  runtime.addLabel(model, 0, 0, 0, label('app_name', 'str', title));
  runtime.addLabel(model, 0, 0, 0, label('deletable', 'bool', true));
  runtime.addLabel(model, 0, 0, 0, label('slide_capable', 'bool', true));
  runtime.addLabel(model, 0, 0, 0, label('slide_app_summary', 'str', `${title} summary`));
  runtime.addLabel(model, 0, 0, 0, label('secret_access_token', 'str', 'must-not-leak'));
  return model;
}

async function test_scoped_visible_builder_does_not_call_full_runtime_snapshot_for_app_table() {
  const server = await import('../../packages/ui-model-demo-server/server.mjs');
  assert.equal(
    typeof server.buildScopedVisibleClientSnapshotForRuntime,
    'function',
    'server must expose buildScopedVisibleClientSnapshotForRuntime for direct visible snapshot construction',
  );

  const state = server.createServerState({ dbPath: null });
  const tableId = 'app:local-dev:it0436:1';
  mountSubtable(state.runtime, tableId, 'local-dev', 0);
  addSlideAppModel(state.runtime, tableId, 0, 'IT0436 Direct App');

  let runtimeSnapshotCalls = 0;
  let stateClientSnapCalls = 0;
  state.runtime.snapshot = () => {
    runtimeSnapshotCalls += 1;
    throw new Error('runtime_snapshot_forbidden_for_scoped_visible_builder');
  };
  state.clientSnap = () => {
    stateClientSnapCalls += 1;
    throw new Error('client_snap_forbidden_for_scoped_visible_builder');
  };

  const result = server.buildScopedVisibleClientSnapshotForRuntime(
    { state, principal: principal('local-dev') },
    { profile: 'visible', visibleModelRefs: [{ table_id: tableId, model_id: 0 }] },
  );

  assert.equal(result.ok, true, result.error || 'scoped visible builder must succeed');
  assert.equal(runtimeSnapshotCalls, 0, 'scoped visible builder must not call runtime.snapshot()');
  assert.equal(stateClientSnapCalls, 0, 'scoped visible builder must not call state.clientSnap()');
  assert.deepEqual(Object.keys(result.snapshot.models || {}), [], 'App-table visible snapshot must not include host models');
  assert.equal(
    result.snapshot.tables?.[tableId]?.models?.['0']?.cells?.['0,0,0']?.labels?.app_name?.v,
    'IT0436 Direct App',
    'scoped visible snapshot must include requested App table model',
  );
  assert.equal(
    result.snapshot.tables?.[tableId]?.models?.['0']?.cells?.['0,0,0']?.labels?.secret_access_token,
    undefined,
    'scoped visible snapshot must keep client label redaction',
  );
}

async function test_scoped_visible_builder_rejects_cross_principal_app_table() {
  const server = await import('../../packages/ui-model-demo-server/server.mjs');
  const state = server.createServerState({ dbPath: null });
  const tableId = 'app:alice:it0436:1';
  mountSubtable(state.runtime, tableId, 'alice-sub', 0);
  addSlideAppModel(state.runtime, tableId, 0, 'Alice Private App');

  const result = server.buildScopedVisibleClientSnapshotForRuntime(
    { state, principal: principal('bob-sub') },
    { profile: 'visible', visibleModelRefs: [{ table_id: tableId, model_id: 0 }] },
  );

  assert.equal(result.ok, false, 'cross-principal App table visible request must fail closed');
  assert.equal(result.status, 403, 'cross-principal App table visible request must be forbidden');
  assert.equal(result.error, 'model_not_visible', 'cross-principal App table must use the existing model_not_visible failure shape');
}

async function test_scoped_visible_builder_keeps_host_and_app_model_id_collision_separate() {
  const server = await import('../../packages/ui-model-demo-server/server.mjs');
  const state = server.createServerState({ dbPath: null });
  const tableId = 'app:local-dev:it0436:collision';
  mountSubtable(state.runtime, tableId, 'local-dev', 1);
  addSlideAppModel(state.runtime, tableId, 1, 'App Local One');
  const hostModel = state.runtime.getModel(1) || state.runtime.createModel({ id: 1, name: 'Host One', type: 'host' });
  state.runtime.addLabel(hostModel, 0, 0, 0, label('app_name', 'str', 'Host One'));
  state.runtime.addLabel(hostModel, 0, 0, 0, label('deletable', 'bool', true));
  state.runtime.addLabel(hostModel, 0, 0, 0, label('slide_capable', 'bool', true));
  state.runtime.addLabel(hostModel, 0, 0, 0, label('slide_app_summary', 'str', 'Host one summary'));

  const result = server.buildScopedVisibleClientSnapshotForRuntime(
    { state, principal: principal('local-dev') },
    { profile: 'visible', visibleModelRefs: [{ table_id: tableId, model_id: 1 }] },
  );

  assert.equal(result.ok, true, result.error || 'App table collision request must succeed');
  assert.equal(result.snapshot.models?.['1'], undefined, 'App-table visible request must not leak host model with same model_id');
  assert.equal(
    result.snapshot.tables?.[tableId]?.models?.['1']?.cells?.['0,0,0']?.labels?.app_name?.v,
    'App Local One',
    'App table model must win inside its own table namespace',
  );
}

async function test_scoped_visible_builder_allows_app_local_restricted_host_model_id() {
  const server = await import('../../packages/ui-model-demo-server/server.mjs');
  const state = server.createServerState({ dbPath: null });
  const tableId = 'app:local-dev:it0436:restricted-collision';
  mountSubtable(state.runtime, tableId, 'local-dev', 1050);
  addSlideAppModel(state.runtime, tableId, 1050, 'App Local Restricted Id');
  const hostModel = state.runtime.getModel(1050) || state.runtime.createModel({ id: 1050, name: 'Host Restricted', type: 'host' });
  state.runtime.addLabel(hostModel, 0, 0, 0, label('app_name', 'str', 'Host Restricted'));

  const result = server.buildScopedVisibleClientSnapshotForRuntime(
    { state, principal: { subject: 'local-dev', capabilities: ['workspace:read', 'app:read', 'slide_app:use'] } },
    { profile: 'visible', visibleModelRefs: [{ table_id: tableId, model_id: 1050 }] },
  );

  assert.equal(result.ok, true, result.error || 'App table-local 1050 must not inherit host model 1050 restrictions');
  assert.equal(result.snapshot.models?.['1050'], undefined, 'App table-local 1050 request must not leak host 1050');
  assert.equal(
    result.snapshot.tables?.[tableId]?.models?.['1050']?.cells?.['0,0,0']?.labels?.app_name?.v,
    'App Local Restricted Id',
    'App table-local restricted host id must remain visible inside its own table namespace',
  );
}

function test_ready_http_visible_route_uses_scoped_builder_not_full_snapshot() {
  const script = `
    import assert from 'node:assert/strict';
    import { once } from 'node:events';

    process.env.DY_AUTH = '0';
    const { ModelTableRuntime } = await import(${JSON.stringify(new URL('../../packages/worker-base/src/runtime.mjs', import.meta.url).href)});
    const { startServer } = await import(${JSON.stringify(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url).href)});

    function waitListening(server) {
      if (server.listening) return Promise.resolve();
      return once(server, 'listening');
    }
    function closeServer(server) {
      if (!server || !server.listening) return Promise.resolve();
      return new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
    }
    function appRefsFromSnapshot(snapshot) {
      const labels = snapshot?.models?.['-2']?.cells?.['0,0,0']?.labels || {};
      const registry = Array.isArray(labels.ws_apps_registry?.v) ? labels.ws_apps_registry.v : [];
      return registry
        .filter((entry) => entry && typeof entry.table_id === 'string' && entry.table_id !== 'host' && Number.isInteger(entry.model_id))
        .map((entry) => ({ table_id: entry.table_id, model_id: entry.model_id }));
    }
    async function readReadyBootstrap(baseUrl) {
      let last = null;
      for (let i = 0; i < 30; i += 1) {
        const resp = await fetch(baseUrl + '/snapshot?profile=bootstrap&initial_projection=1');
        last = { status: resp.status, body: await resp.json() };
        if (resp.status === 200) return last.body.snapshot;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error('bootstrap_not_ready:' + JSON.stringify(last));
    }

    const server = startServer({ port: 0, dbPath: null, skipFrontendBuild: true });
    await waitListening(server);
    const originalSnapshot = ModelTableRuntime.prototype.snapshot;
    try {
      const address = server.address();
      const baseUrl = 'http://127.0.0.1:' + address.port;
      const bootstrap = await readReadyBootstrap(baseUrl);
      const refs = appRefsFromSnapshot(bootstrap);
      assert.equal(refs.length > 0, true, 'test requires at least one seeded App table ref');
      const ref = refs[0];
      ModelTableRuntime.prototype.snapshot = function forbiddenSnapshot() {
        throw new Error('runtime_snapshot_forbidden_for_ready_visible_http_route');
      };
      const resp = await fetch(baseUrl + '/snapshot?profile=visible&visible_model_ref=' + encodeURIComponent(JSON.stringify(ref)));
      const body = await resp.json();
      assert.equal(resp.status, 200, JSON.stringify(body));
      assert.equal(body.snapshot?.models && Object.keys(body.snapshot.models).length, 0, 'App table visible route must not include host models');
      assert.equal(Boolean(body.snapshot?.tables?.[ref.table_id]?.models?.[String(ref.model_id)]), true, 'visible HTTP route must include requested App table model');
      assert.deepEqual(body.visible_model_refs, [ref], 'visible HTTP route must preserve table-qualified ref metadata');
      console.log(JSON.stringify({ ok: true, ref }));
    } finally {
      ModelTableRuntime.prototype.snapshot = originalSnapshot;
      await closeServer(server);
    }
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 60000,
  });
  assert.equal(
    result.status,
    0,
    `ready HTTP visible route scoped-builder probe failed:\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
  );
}

function test_ready_http_host_visible_ref_uses_scoped_builder_not_full_snapshot() {
  const script = `
    import assert from 'node:assert/strict';
    import { once } from 'node:events';

    process.env.DY_AUTH = '0';
    const { ModelTableRuntime } = await import(${JSON.stringify(new URL('../../packages/worker-base/src/runtime.mjs', import.meta.url).href)});
    const { startServer } = await import(${JSON.stringify(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url).href)});

    function waitListening(server) {
      if (server.listening) return Promise.resolve();
      return once(server, 'listening');
    }
    function closeServer(server) {
      if (!server || !server.listening) return Promise.resolve();
      return new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
    }
    async function readReadyBootstrap(baseUrl) {
      let last = null;
      for (let i = 0; i < 30; i += 1) {
        const resp = await fetch(baseUrl + '/snapshot?profile=bootstrap&initial_projection=1');
        last = { status: resp.status, body: await resp.json() };
        if (resp.status === 200) return last.body.snapshot;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error('bootstrap_not_ready:' + JSON.stringify(last));
    }

    const server = startServer({ port: 0, dbPath: null, skipFrontendBuild: true });
    await waitListening(server);
    const originalSnapshot = ModelTableRuntime.prototype.snapshot;
    try {
      const address = server.address();
      const baseUrl = 'http://127.0.0.1:' + address.port;
      await readReadyBootstrap(baseUrl);
      const ref = { table_id: 'host', model_id: -103 };
      ModelTableRuntime.prototype.snapshot = function forbiddenSnapshot() {
        throw new Error('runtime_snapshot_forbidden_for_ready_host_visible_http_route');
      };
      const resp = await fetch(baseUrl + '/snapshot?profile=visible&visible_model_ref=' + encodeURIComponent(JSON.stringify(ref)));
      const body = await resp.json();
      assert.equal(resp.status, 200, JSON.stringify(body));
      assert.equal(Boolean(body.snapshot?.models?.['-103']), true, 'host visible route must include requested host model');
      assert.deepEqual(body.visible_model_refs, [ref], 'host visible HTTP route must preserve table-qualified ref metadata');
      console.log(JSON.stringify({ ok: true, ref }));
    } finally {
      ModelTableRuntime.prototype.snapshot = originalSnapshot;
      await closeServer(server);
    }
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 60000,
  });
  assert.equal(
    result.status,
    0,
    `ready HTTP host visible route scoped-builder probe failed:\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
  );
}

const tests = [
  test_scoped_visible_builder_does_not_call_full_runtime_snapshot_for_app_table,
  test_scoped_visible_builder_rejects_cross_principal_app_table,
  test_scoped_visible_builder_keeps_host_and_app_model_id_collision_separate,
  test_scoped_visible_builder_allows_app_local_restricted_host_model_id,
  test_ready_http_visible_route_uses_scoped_builder_not_full_snapshot,
  test_ready_http_host_visible_ref_uses_scoped_builder_not_full_snapshot,
];

let failed = 0;
for (const test of tests) {
  try {
    await test();
    console.log(`PASS ${test.name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${test.name}`);
    console.error(error && error.stack ? error.stack : error);
  }
}

if (failed > 0) {
  console.error(`${failed} failed, ${tests.length - failed} passed`);
  process.exit(1);
}

console.log(`${tests.length} passed, 0 failed`);
