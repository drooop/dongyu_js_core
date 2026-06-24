import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import {
  buildClientSnapshot,
  buildClientSnapshotForPrincipal,
  buildClientSnapshotPatchMessage,
  buildClientSnapshotProfileWithStats,
  deriveWorkspaceRegistryFromSnapshot,
} from '../../packages/ui-model-demo-server/server.mjs';
import { createRemoteStore } from '../../packages/ui-model-demo-frontend/src/remote_store.js';

function fixtureSnapshot(appTitle = 'App title') {
  return {
    models: {
      0: {
        table_id: 'host',
        id: 0,
        name: 'host-root',
        type: 'main',
        cells: {
          '0,0,0': { p: 0, r: 0, c: 0, labels: { model_type: { k: 'model_type', t: 'str', v: 'main' } } },
          '9,0,0': {
            p: 9,
            r: 0,
            c: 0,
            labels: {
              model_type: {
                k: 'model_type',
                t: 'model.subtable',
                v: { table_id: 'app:todo:a', root_model_id: 1, owner_principal_id: 'local-dev' },
              },
            },
          },
        },
      },
      1: { table_id: 'host', id: 1, name: 'host-one', type: 'host', cells: { '0,0,0': { p: 0, r: 0, c: 0, labels: { title: { k: 'title', t: 'str', v: 'Host title' } } } } },
    },
    tables: {
      'app:todo:a': {
        table_id: 'app:todo:a',
        models: {
          1: {
            table_id: 'app:todo:a',
            id: 1,
            name: 'app-one',
            type: 'app',
            cells: {
              '0,0,0': {
                p: 0,
                r: 0,
                c: 0,
                labels: {
                  title: { k: 'title', t: 'str', v: appTitle },
                },
              },
            },
          },
        },
      },
    },
    v1nConfig: { local_mqtt: null, global_mqtt: null },
  };
}

function fixtureSnapshotWithRestrictedHostIdCollision() {
  const snap = fixtureSnapshot();
  snap.models[1050] = {
    table_id: 'host',
    id: 1050,
    name: 'host-restricted',
    type: 'host',
    cells: { '0,0,0': { p: 0, r: 0, c: 0, labels: { title: { k: 'title', t: 'str', v: 'Host restricted' } } } },
  };
  snap.tables['app:todo:a'].models[1050] = {
    table_id: 'app:todo:a',
    id: 1050,
    name: 'app-local-1050',
    type: 'app',
    cells: { '0,0,0': { p: 0, r: 0, c: 0, labels: { title: { k: 'title', t: 'str', v: 'App local visible' } } } },
  };
  return snap;
}

function fixtureWorkspaceRegistryTableCollision() {
  const snap = fixtureSnapshot('App table workspace app');
  snap.models[1].cells['0,0,0'].labels.app_name = { k: 'app_name', t: 'str', v: 'Host App One' };
  snap.models[1].cells['0,0,0'].labels.deletable = { k: 'deletable', t: 'bool', v: true };
  snap.models[1].cells['0,0,0'].labels.slide_capable = { k: 'slide_capable', t: 'bool', v: true };
  snap.models[1].cells['0,0,0'].labels.slide_app_summary = { k: 'slide_app_summary', t: 'str', v: 'host app one' };
  const appLabels = snap.tables['app:todo:a'].models[1].cells['0,0,0'].labels;
  appLabels.app_name = { k: 'app_name', t: 'str', v: 'App Table One' };
  appLabels.deletable = { k: 'deletable', t: 'bool', v: true };
  appLabels.slide_capable = { k: 'slide_capable', t: 'bool', v: true };
  appLabels.slide_app_summary = { k: 'slide_app_summary', t: 'str', v: 'app table one' };
  return snap;
}

function test_visible_profile_includes_app_table_ref_without_host_collision() {
  const clientSnapshot = buildClientSnapshot({
    snapshot: () => fixtureSnapshot(),
    getModel: () => null,
  });
  assert.equal(
    clientSnapshot.tables?.['app:todo:a']?.models?.['1']?.cells?.['0,0,0']?.labels?.title?.v,
    'App title',
    'client snapshot sanitizer must retain non-host tables before profile filtering',
  );
  const principalSnapshot = buildClientSnapshotForPrincipal(clientSnapshot, {
    subject: 'local-dev',
    capabilities: ['workspace:read', 'app:read', 'slide_app:use'],
  });
  assert.equal(
    principalSnapshot.tables?.['app:todo:a']?.models?.['1']?.cells?.['0,0,0']?.labels?.title?.v,
    'App title',
    'principal snapshot filter must retain non-host tables before profile filtering',
  );
  const body = buildClientSnapshotProfileWithStats(fixtureSnapshot(), {
    profile: 'visible',
    visibleModelRefs: [{ table_id: 'app:todo:a', model_id: 1 }],
  });
  assert.equal(body.snapshot.models['1'], undefined, 'visible app ref must not include host model with same model_id');
  assert.equal(
    body.snapshot.tables?.['app:todo:a']?.models?.['1']?.cells?.['0,0,0']?.labels?.title?.v,
    'App title',
    'visible app ref must include requested app table model',
  );
  assert.deepEqual(
    body.snapshot_stats.visible_model_refs,
    [{ table_id: 'app:todo:a', model_id: 1 }],
    'stats metadata must expose visibleModelRefs',
  );
}

function test_principal_filter_uses_table_owner_not_host_model_id_rules() {
  const clientSnapshot = buildClientSnapshot({
    snapshot: () => fixtureSnapshotWithRestrictedHostIdCollision(),
    getModel: () => null,
  });
  const principal = {
    subject: 'local-dev',
    capabilities: ['workspace:read', 'app:read', 'slide_app:use'],
  };
  const principalSnapshot = buildClientSnapshotForPrincipal(clientSnapshot, principal);
  assert.equal(
    principalSnapshot.models['1050'],
    undefined,
    'restricted host model 1050 should still obey host capability rules',
  );
  assert.equal(
    principalSnapshot.tables?.['app:todo:a']?.models?.['1050']?.cells?.['0,0,0']?.labels?.title?.v,
    'App local visible',
    'App table-local model_id 1050 must not be filtered by host model_id 1050 capability rules',
  );
  const otherPrincipalSnapshot = buildClientSnapshotForPrincipal(clientSnapshot, {
    subject: 'other-user',
    capabilities: ['workspace:read', 'app:read', 'slide_app:use'],
  });
  assert.equal(
    otherPrincipalSnapshot.tables?.['app:todo:a'],
    undefined,
    'principal snapshot filtering must remove App tables owned by another principal before full/profile output',
  );
}

function test_workspace_registry_preserves_app_table_ref_with_host_collision() {
  const snap = fixtureWorkspaceRegistryTableCollision();
  const registry = deriveWorkspaceRegistryFromSnapshot({ snapshot: snap });
  const refs = registry.map((entry) => `${entry.table_id || 'host'}/${entry.model_id}:${entry.name}`).sort();
  assert.deepEqual(
    refs,
    ['app:todo:a/1:App Table One', 'host/1:Host App One'],
    'workspace registry must preserve app table refs instead of collapsing same model_id to host',
  );
}

function test_real_snapshot_http_path_returns_app_table_ref() {
  const script = `
    import assert from 'node:assert/strict';
    import { mkdtempSync, rmSync } from 'node:fs';
    import { tmpdir } from 'node:os';
    import path from 'node:path';
    import crypto from 'node:crypto';
    import { createRequire } from 'node:module';
    import { once } from 'node:events';

    process.env.DY_AUTH = '0';
    const require = createRequire(import.meta.url);
    const { createSqlitePersister } = require(${JSON.stringify(new URL('../../packages/worker-base/src/modeltable_persistence_sqlite.js', import.meta.url).pathname)});
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

    const tempRoot = mkdtempSync(path.join(tmpdir(), 'dy-0425-visible-http-'));
    const rootDbPath = path.join(tempRoot, 'modeltable.sqlite');
    const digest = crypto.createHash('sha256').update('subject:local-dev').digest('hex').slice(0, 16);
    const dbPath = path.join(tempRoot, 'modeltable.principal-' + digest + '.sqlite');
    const source = new ModelTableRuntime();
    const persister = createSqlitePersister({ dbPath });
    source.setPersistence(persister);
    const hostRoot = source.getModel(0);
    source.addLabel(hostRoot, 9, 0, 0, {
      k: 'model_type',
      t: 'model.subtable',
      v: { table_id: 'app:todo:a', root_model_id: 1, owner_principal_id: 'local-dev' },
    });
    const app = source.getModel({ table_id: 'app:todo:a', model_id: 1 });
    source.addLabel(app, 0, 0, 0, { k: 'title', t: 'str', v: 'HTTP app title' });
    persister.close();

    const server = startServer({ port: 0, dbPath: rootDbPath, skipFrontendBuild: true });
    await waitListening(server);
    try {
      const address = server.address();
      const baseUrl = 'http://127.0.0.1:' + address.port;
      const ref = encodeURIComponent(JSON.stringify({ table_id: 'app:todo:a', model_id: 1 }));
      const resp = await fetch(baseUrl + '/snapshot?profile=visible&visible_model_ref=' + ref);
      assert.equal(resp.status, 200);
      const body = await resp.json();
      assert.equal(body.snapshot?.models?.['1'], undefined);
      assert.equal(body.snapshot?.tables?.['app:todo:a']?.models?.['1']?.cells?.['0,0,0']?.labels?.title?.v, 'HTTP app title');
      assert.deepEqual(body.visible_model_refs, [{ table_id: 'app:todo:a', model_id: 1 }]);
      console.log(JSON.stringify({ ok: true }));
    } finally {
      await closeServer(server);
      rmSync(tempRoot, { recursive: true, force: true });
    }
  `;
  const result = spawnSync('bun', ['--eval', script], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 30000,
  });
  assert.equal(result.status, 0, `real HTTP visible_model_ref probe failed:\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
}

function test_snapshot_patch_ops_are_table_qualified() {
  const previous = buildClientSnapshotProfileWithStats(fixtureSnapshot('before'), {
    profile: 'visible',
    visibleModelRefs: [{ table_id: 'app:todo:a', model_id: 1 }],
  }).snapshot;
  const next = buildClientSnapshotProfileWithStats(fixtureSnapshot('after'), {
    profile: 'visible',
    visibleModelRefs: [{ table_id: 'app:todo:a', model_id: 1 }],
  }).snapshot;
  const message = buildClientSnapshotPatchMessage({
    previousSnapshot: previous,
    nextSnapshot: next,
    baseSnapshotSeq: 1,
    snapshotSeq: 2,
    snapshotProfile: 'visible',
    visibleModelRefs: [{ table_id: 'app:todo:a', model_id: 1 }],
  });
  assert.equal(message.event, 'snapshot_patch');
  const op = message.data.snapshot_patch.ops.find((candidate) => candidate.op === 'replace_label');
  assert(op, 'expected a replace_label op');
  assert.equal(op.table_id, 'app:todo:a', 'snapshot patch op must carry table_id');
  assert.equal(op.model_id, 1);
  assert.equal(op.label_key, 'title');
  assert.equal(op.value.v, 'after');
  assert.deepEqual(
    message.data.visible_model_refs,
    [{ table_id: 'app:todo:a', model_id: 1 }],
    'patch metadata must carry visible_model_refs',
  );
}

function test_sse_baseline_uses_capability_aware_principal_key() {
  const source = readFileSync('packages/ui-model-demo-server/server.mjs', 'utf8');
  assert.match(
    source,
    /function snapshotBaselinePrincipalKey\(entry\)[\s\S]*clientSnapshotCacheKey\(entry\.principal\)/u,
    'SSE baseline key must include principal capabilities through clientSnapshotCacheKey(entry.principal)',
  );
  assert.match(
    source,
    /client\.principalKey = snapshotBaselinePrincipalKey\(entry\)/u,
    'SSE baseline update must store the capability-aware principal key',
  );
  assert.match(
    source,
    /const currentPrincipalKey = snapshotBaselinePrincipalKey\(entry\)/u,
    'SSE patch/reset comparison must use the capability-aware principal key',
  );
  const previous = {
    models: { 1: { id: 1, cells: { '0,0,0': { p: 0, r: 0, c: 0, labels: { title: { k: 'title', t: 'str', v: 'before' } } } } } },
    v1nConfig: {},
  };
  const next = {
    models: { 1: { id: 1, cells: { '0,0,0': { p: 0, r: 0, c: 0, labels: { title: { k: 'title', t: 'str', v: 'after' } } } } } },
    v1nConfig: {},
  };
  const message = buildClientSnapshotPatchMessage({
    previousSnapshot: previous,
    nextSnapshot: next,
    previousPrincipalKey: 'subject:user-a:app:read',
    currentPrincipalKey: 'subject:user-a:app:read|workspace:read',
    snapshotProfile: 'visible',
    visibleModelIds: [1],
  });
  assert.equal(message.event, 'snapshot');
  assert.equal(message.data.patch_kind, 'principal_reset');
}

async function test_remote_store_uses_visible_model_ref_for_app_tables() {
  const originalFetch = globalThis.fetch;
  const capturedUrls = [];
  globalThis.fetch = async (url) => {
    capturedUrls.push(String(url));
    return {
      ok: true,
      status: 200,
      json: async () => ({
        snapshot: fixtureSnapshot('from remote'),
        snapshot_seq: 1,
        patch_kind: 'snapshot',
        snapshot_profile: 'visible',
        visible_model_refs: [{ table_id: 'app:todo:a', model_id: 1 }],
      }),
    };
  };
  try {
    const store = createRemoteStore({ baseUrl: 'http://example.test', autoBootstrap: false });
    const ok = await store.ensureVisibleModelLoaded({ table_id: 'app:todo:a', model_id: 1 });
    assert.equal(ok, true, 'remote store should load app table model ref');
    const url = new URL(capturedUrls[0]);
    const refs = url.searchParams.getAll('visible_model_ref').map((value) => JSON.parse(value));
    assert.deepEqual(refs, [{ table_id: 'app:todo:a', model_id: 1 }]);
    assert.equal(url.searchParams.getAll('model_id').length, 0, 'app table refs must not be sent as bare model_id');
    assert.equal(
      store.snapshot.tables?.['app:todo:a']?.models?.['1']?.cells?.['0,0,0']?.labels?.title?.v,
      'from remote',
      'remote store must retain app table snapshot body',
    );
    assert.deepEqual(store.getVisibleSubscriptionState().visibleModelRefs, [{ table_id: 'app:todo:a', model_id: 1 }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const tests = [
  test_visible_profile_includes_app_table_ref_without_host_collision,
  test_principal_filter_uses_table_owner_not_host_model_id_rules,
  test_workspace_registry_preserves_app_table_ref_with_host_collision,
  test_real_snapshot_http_path_returns_app_table_ref,
  test_snapshot_patch_ops_are_table_qualified,
  test_sse_baseline_uses_capability_aware_principal_key,
  test_remote_store_uses_visible_model_ref_for_app_tables,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    await test();
    console.log(`[PASS] ${test.name}`);
    passed += 1;
  } catch (err) {
    console.log(`[FAIL] ${test.name}: ${err && err.message ? err.message : err}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
