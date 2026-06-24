import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';

import {
  DESKTOP_FOREGROUND_APP_LABEL,
  DESKTOP_TASK_STACK_LABEL,
} from '../../packages/ui-model-demo-frontend/src/desktop_app_state.js';

function label(k, t, v) {
  return { k, t, v };
}

function mailboxEnvelope(action, options = {}) {
  const payload = {
    action,
    meta: { op_id: options.opId || `${action}_${Date.now()}` },
  };
  if (options.target) payload.target = options.target;
  if (options.value !== undefined) payload.value = options.value;
  return {
    event_id: Date.now(),
    type: action,
    payload,
    source: 'ui_renderer',
    ts: Date.now(),
  };
}

function snapshotBytes(value) {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

function fixtureSnapshot() {
  return {
    models: {
      '0': {
        id: 0,
        cells: {
          '0,0,0': {
            p: 0,
            r: 0,
            c: 0,
            labels: {
              sys_worker_id: label('sys_worker_id', 'worker.id', '5/10/28/35/13'),
              sys_worker_role: label('sys_worker_role', 'worker.role', 'DEM'),
              runtime_mode: label('runtime_mode', 'str', 'ready'),
              hidden_runtime_noise: label('hidden_runtime_noise', 'str', 'x'.repeat(4096)),
            },
          },
        },
      },
      '-2': {
        id: -2,
        cells: {
          '0,0,0': {
            p: 0,
            r: 0,
            c: 0,
            labels: {
              ws_apps_registry: label('ws_apps_registry', 'json', [
                { model_id: 4100, name: 'Lazy App', summary: 'Visible only on open.' },
              ]),
              home_table_rows_json: label('home_table_rows_json', 'json', Array.from({ length: 64 }, (_, i) => ({ i, text: 'heavy row' }))),
            },
          },
        },
      },
      '4100': {
        id: 4100,
        cells: {
          '0,0,0': {
            p: 0,
            r: 0,
            c: 0,
            labels: {
              app_name: label('app_name', 'str', 'Lazy App'),
              app_body: label('app_body', 'str', 'hidden app body '.repeat(1024)),
            },
          },
        },
      },
    },
    v1nConfig: {
      mqtt: { host: 'secret-host.local', password: 'secret' },
    },
  };
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

async function withFreshServerEnv(env, fn) {
  const previous = {};
  for (const key of Object.keys(env)) {
    previous[key] = process.env[key];
    process.env[key] = env[key];
  }
  try {
    const mod = await import(`../../packages/ui-model-demo-server/server.mjs?it0423=${Date.now()}_${Math.random()}`);
    return await fn(mod);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function test_profile_stats_are_computed_after_profile_filtering() {
  const server = await import('../../packages/ui-model-demo-server/server.mjs');
  assert.equal(
    typeof server.buildClientSnapshotProfileWithStats,
    'function',
    'server must expose buildClientSnapshotProfileWithStats(snapshot, options)',
  );

  const body = server.buildClientSnapshotProfileWithStats(fixtureSnapshot(), { profile: 'bootstrap' });
  assert.equal(Boolean(body && body.snapshot && body.snapshot_stats), true, 'helper must return snapshot and snapshot_stats');
  assert.equal(body.snapshot.models['4100'], undefined, 'bootstrap snapshot must not include positive app body');
  assert.equal(body.snapshot_stats.profile, 'bootstrap');
  assert.equal(body.snapshot_stats.total_bytes, snapshotBytes(body.snapshot), 'total_bytes must match serialized client-visible snapshot');
  assert.equal(
    body.snapshot_stats.models.some((entry) => entry.model_id === 4100),
    false,
    'stats must not count model filtered out of the client-visible profile',
  );
  assert.equal(
    body.snapshot_stats.top_labels.some((entry) => entry.model_id === 4100 || entry.k === 'app_body'),
    false,
    'top label stats must not include filtered positive app body labels',
  );
  assert.equal(
    body.snapshot_stats.dropped_model_count >= 1,
    true,
    'stats must expose dropped_model_count for contributor analysis',
  );
  assert.equal(
    body.snapshot_stats.dropped_label_count >= 1,
    true,
    'stats must expose dropped_label_count for contributor analysis',
  );

  const visibleBody = server.buildClientSnapshotProfileWithStats(fixtureSnapshot(), {
    profile: 'visible',
    visibleModelIds: [4100],
  });
  assert.equal(Boolean(visibleBody.snapshot.models['4100']), true, 'visible profile must include requested app model body');
  assert.equal(
    visibleBody.snapshot_stats.models.some((entry) => entry.model_id === 4100),
    true,
    'visible stats must count requested app model body',
  );
  assert.equal(
    visibleBody.snapshot_stats.top_labels.some((entry) => entry.model_id === 4100 && entry.k === 'app_body'),
    true,
    'visible top labels may include requested app body labels because they are client-visible',
  );
  assert.equal(
    visibleBody.snapshot_stats.total_bytes,
    snapshotBytes(visibleBody.snapshot),
    'visible total_bytes must match serialized client-visible snapshot',
  );

  const fullBody = server.buildClientSnapshotProfileWithStats(fixtureSnapshot(), { profile: 'full' });
  assert.equal(Boolean(fullBody.snapshot.models['4100']), true, 'full diagnostic profile must include app model body');
  assert.equal(fullBody.snapshot_stats.dropped_model_count, 0, 'full diagnostic profile should not report dropped models');
  assert.equal(fullBody.snapshot_stats.dropped_label_count, 0, 'full diagnostic profile should not report dropped labels');
  assert.equal(
    fullBody.snapshot_stats.total_bytes,
    snapshotBytes(fullBody.snapshot),
    'full total_bytes must match serialized diagnostic client snapshot',
  );
}

async function test_profile_size_report_prints_cell_contributors() {
  const output = execFileSync(process.execPath, [
    'scripts/ops/report_snapshot_profile_sizes.mjs',
    '--top-models',
    '2',
    '--top-labels',
    '2',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.match(output, /\[bootstrap\][\s\S]*top_cells=/u, 'bootstrap report must print top_cells');
  assert.match(output, /\[visible:\d+\][\s\S]*top_cells=/u, 'visible report must print top_cells');
  assert.match(output, /\[full\][\s\S]*top_cells=/u, 'full report must print top_cells');
}

async function test_bootstrap_excludes_heavy_builtin_catalog_bodies() {
  const {
    buildClientSnapshotProfileWithStats,
    createServerState,
  } = await import('../../packages/ui-model-demo-server/server.mjs');
  const state = createServerState({ dbPath: null });
  const source = state.clientSnap();
  const bootstrap = buildClientSnapshotProfileWithStats(source, { profile: 'bootstrap' });
  const visibleGallery = buildClientSnapshotProfileWithStats(source, {
    profile: 'visible',
    visibleModelIds: [-103],
  });
  const visibleDocs = buildClientSnapshotProfileWithStats(source, {
    profile: 'visible',
    visibleModelIds: [-23],
  });

  assert.equal(
    bootstrap.snapshot.models['-103'],
    undefined,
    'bootstrap must not include full Gallery catalog body; desktop should use compact app index',
  );
  assert.equal(
    bootstrap.snapshot.models['-23'],
    undefined,
    'bootstrap must not include full Docs catalog body; Docs should lazy load when opened',
  );
  assert.equal(
    Boolean(visibleGallery.snapshot.models['-103']),
    true,
    'visible profile must still be able to load Gallery catalog on demand',
  );
  assert.equal(
    Boolean(visibleDocs.snapshot.models['-23']),
    true,
    'visible profile must still be able to load Docs catalog on demand',
  );
  assert.equal(
    bootstrap.snapshot_stats.total_bytes <= 90 * 1024,
    true,
    `bootstrap must be <= 90KB after heavy catalog bodies move to visible; actual=${bootstrap.snapshot_stats.total_bytes}`,
  );
}

async function test_bootstrap_keeps_tiny_mailbox_release_labels_for_singleflight() {
  const {
    buildClientSnapshotProfileWithStats,
    createServerState,
  } = await import('../../packages/ui-model-demo-server/server.mjs');
  const state = createServerState({ dbPath: null });
  const editorMailbox = state.runtime.getModel(-1);
  state.runtime.addLabel(editorMailbox, 0, 0, 1, { k: 'bus_event_last_op_id', t: 'str', v: 'it0423_release_probe' });
  state.runtime.addLabel(editorMailbox, 0, 0, 1, { k: 'bus_event_error', t: 'json', v: null });
  state.runtime.addLabel(editorMailbox, 0, 0, 1, { k: 'snapshot_json', t: 'json', v: { heavy: true } });
  const profiled = buildClientSnapshotProfileWithStats(state.clientSnap(), { profile: 'bootstrap' });
  const cell = profiled.snapshot.models['-1']?.cells?.['0,0,1'] || null;

  assert.equal(Boolean(cell && cell.labels && cell.labels.bus_event_last_op_id), true, 'bootstrap must keep tiny mailbox release label for singleFlight buttons');
  assert.equal(Boolean(cell && cell.labels && cell.labels.bus_event_error), true, 'bootstrap must keep mailbox error label for button recovery');
  assert.equal(
    Boolean(cell && cell.labels && cell.labels.snapshot_json),
    false,
    'bootstrap must not reintroduce heavy editor mailbox snapshot_json',
  );
  assert.equal(
    profiled.snapshot_stats.total_bytes <= 95 * 1024,
    true,
    `bootstrap must stay small after mailbox release labels; actual=${profiled.snapshot_stats.total_bytes}`,
  );
}

async function test_auth_disabled_auth_me_exposes_local_dev_capabilities() {
  await withFreshServerEnv({ DY_AUTH: '0' }, async ({ startServer }) => {
    const appServer = startServer({ port: 0, dbPath: null, skipFrontendBuild: true });
    await waitListening(appServer);
    try {
      const resp = await fetch(`${serverBaseUrl(appServer)}/auth/me`);
      const body = await resp.json();
      assert.equal(resp.status, 200, 'DY_AUTH=0 /auth/me must expose local dev session');
      assert.equal(body.userId, 'local-dev', 'local dev auth surface must use local-dev principal');
      assert.equal(
        Array.isArray(body.capabilities) && body.capabilities.includes('app:write'),
        true,
        'local dev auth surface must include app:write so the frontend can run write-event browser tests',
      );
    } finally {
      await closeServer(appServer);
    }
  });
}

async function test_visible_initial_projection_does_not_block_on_runtime_initialization() {
  await withFreshServerEnv({
    DY_AUTH: '0',
    DY_TEST_PRINCIPAL_RUNTIME_INIT_BLOCK_MS: '900',
  }, async ({ startServer }) => {
    const appServer = startServer({
      port: 0,
      dbPath: null,
      skipFrontendBuild: true,
      enableTestPrincipalRuntimeInitHooks: true,
    });
    await waitListening(appServer);
    try {
      const startedAt = Date.now();
      const resp = await fetch(`${serverBaseUrl(appServer)}/snapshot?profile=visible&model_id=100&initial_projection=1`);
      const elapsedMs = Date.now() - startedAt;
      const body = await resp.json();
      assert.equal(resp.status, 202, 'cold visible initial projection must return initializing status');
      assert.equal(body.code || body.status, 'workspace_initializing', 'cold visible initial projection must report workspace_initializing');
      assert.equal(Boolean(body.snapshot && body.snapshot.models && body.snapshot.models['100']), true, 'cold visible initial projection must include requested visible model body');
      assert.ok(
        elapsedMs < 500,
        `cold visible initial projection must not block on principal runtime initialization; elapsed=${elapsedMs}ms`,
      );
    } finally {
      await closeServer(appServer);
    }
  });
}

async function test_persistent_startup_does_not_store_derived_projection_labels() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'dy-0423-persist-startup-'));
  try {
    const dbPath = path.join(tempRoot, 'ui-model-demo.sqlite');
    const script = `
      import { createRequire } from 'node:module';
      const require = createRequire(import.meta.url);
      const { Database } = require('bun:sqlite');
      const mod = await import(${JSON.stringify(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url).href)});
      const state = mod.createServerState({ dbPath: ${JSON.stringify(dbPath)} });
      state.clientSnap();
      const db = new Database(${JSON.stringify(dbPath)}, { readonly: true });
      const rows = db.query("select k from mt_data where mt_id = -2 and k in ('home_table_rows_json', 'editor_model_options_json', 'docs_tree_json', 'static_projects_json') order by k").all();
      console.log(JSON.stringify(rows.map((row) => row.k)));
      db.close();
    `;
    const result = spawnSync('bun', ['--eval', script], {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 30000,
    });
    assert.equal(result.status, 0, `bun startup persistence probe failed: ${result.stderr || result.stdout}`);
    const lines = result.stdout.trim().split('\n').filter(Boolean);
    const persistedKeys = JSON.parse(lines[lines.length - 1] || '[]');
    assert.deepEqual(
      persistedKeys,
      [],
      'startup-only derived projection labels must stay in memory and must not be synced into persistent SQLite',
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function test_persistent_runtime_still_stores_post_start_business_labels() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'dy-0423-persist-business-'));
  try {
    const dbPath = path.join(tempRoot, 'ui-model-demo.sqlite');
    const script = `
      import { createRequire } from 'node:module';
      const require = createRequire(import.meta.url);
      const { Database } = require('bun:sqlite');
      const mod = await import(${JSON.stringify(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url).href)});
      const state = mod.createServerState({ dbPath: ${JSON.stringify(dbPath)} });
      const model = state.runtime.getModel(100);
      state.runtime.addLabel(model, 0, 0, 0, { k: 'it0423_business_write_probe', t: 'str', v: 'persisted' });
      const db = new Database(${JSON.stringify(dbPath)}, { readonly: true });
      const row = db.query("select v from mt_data where mt_id = 100 and p = 0 and r = 0 and c = 0 and k = 'it0423_business_write_probe' and t = 'str'").get();
      console.log(JSON.stringify(row || null));
      db.close();
    `;
    const result = spawnSync('bun', ['--eval', script], {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 30000,
    });
    assert.equal(result.status, 0, `bun business persistence probe failed: ${result.stderr || result.stdout}`);
    const lines = result.stdout.trim().split('\n').filter(Boolean);
    const row = JSON.parse(lines[lines.length - 1] || 'null');
    assert.equal(row && row.v, JSON.stringify('persisted'), 'post-start business label writes must still be persisted');
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function test_workspace_catalog_refresh_clears_stale_desktop_foreground_app() {
  const {
    createServerState,
  } = await import('../../packages/ui-model-demo-server/server.mjs');
  const state = createServerState({ dbPath: null });
  const stateModel = state.runtime.getModel(-2);
  const staleApp = {
    id: 'workspace:1087',
    kind: 'workspace',
    page: 'workspace',
    path: '/workspace',
    title: 'Deleted To Do Board',
    model_id: 1087,
  };
  const validApp = {
    id: 'workspace:100',
    kind: 'workspace',
    page: 'workspace',
    path: '/workspace',
    title: 'E2E 颜色生成器',
    model_id: 100,
  };

  assert.equal(Boolean(state.runtime.getModel(1087)), false, 'test setup must use a missing workspace model');
  state.runtime.addLabel(stateModel, 0, 0, 0, { k: DESKTOP_FOREGROUND_APP_LABEL, t: 'json', v: staleApp });
  state.runtime.addLabel(stateModel, 0, 0, 0, { k: DESKTOP_TASK_STACK_LABEL, t: 'json', v: [staleApp, validApp] });

  state.programEngine._wsRefreshCatalog();

  const snap = state.clientSnap();
  const labels = snap.models['-2'].cells['0,0,0'].labels;
  assert.equal(
    labels[DESKTOP_FOREGROUND_APP_LABEL]?.v,
    null,
    'workspace catalog refresh must clear stale foreground workspace app before bootstrap publishes it',
  );
  assert.deepEqual(
    labels[DESKTOP_TASK_STACK_LABEL]?.v.map((task) => task.model_id),
    [100],
    'workspace catalog refresh must remove stale workspace tasks while preserving valid tasks',
  );
}

async function test_client_snap_clears_stale_desktop_foreground_without_catalog_refresh() {
  const {
    createServerState,
  } = await import('../../packages/ui-model-demo-server/server.mjs');
  const state = createServerState({ dbPath: null });
  const stateModel = state.runtime.getModel(-2);
  const staleApp = {
    id: 'workspace:1087',
    kind: 'workspace',
    page: 'workspace',
    path: '/workspace',
    title: 'Deleted To Do Board',
    model_id: 1087,
  };
  const validApp = {
    id: 'workspace:100',
    kind: 'workspace',
    page: 'workspace',
    path: '/workspace',
    title: 'E2E 颜色生成器',
    model_id: 100,
  };

  assert.equal(Boolean(state.runtime.getModel(1087)), false, 'test setup must use a missing workspace model');
  state.runtime.addLabel(stateModel, 0, 0, 0, { k: DESKTOP_FOREGROUND_APP_LABEL, t: 'json', v: staleApp });
  state.runtime.addLabel(stateModel, 0, 0, 0, { k: DESKTOP_TASK_STACK_LABEL, t: 'json', v: [staleApp, validApp] });

  const snap = state.clientSnap();
  const labels = snap.models['-2'].cells['0,0,0'].labels;

  assert.equal(
    labels[DESKTOP_FOREGROUND_APP_LABEL]?.v,
    null,
    'clientSnap must clear stale desktop foreground app even when app-index refresh did not run first',
  );
  assert.deepEqual(
    labels[DESKTOP_TASK_STACK_LABEL]?.v.map((task) => task.model_id),
    [100],
    'clientSnap must remove stale desktop tasks before bootstrap/visible snapshot publication',
  );
}

async function test_submit_rejects_stale_desktop_foreground_app_event() {
  const {
    createServerState,
  } = await import('../../packages/ui-model-demo-server/server.mjs');
  const state = createServerState({ dbPath: null });
  const stateModel = state.runtime.getModel(-2);
  const staleApp = {
    id: 'workspace:1087',
    kind: 'workspace',
    page: 'workspace',
    path: '/workspace',
    title: 'Deleted To Do Board',
    model_id: 1087,
  };
  const validApp = {
    id: 'workspace:100',
    kind: 'workspace',
    page: 'workspace',
    path: '/workspace',
    title: 'E2E 颜色生成器',
    model_id: 100,
  };

  state.runtime.addLabel(stateModel, 0, 0, 0, { k: DESKTOP_FOREGROUND_APP_LABEL, t: 'json', v: validApp });
  state.runtime.addLabel(stateModel, 0, 0, 0, { k: DESKTOP_TASK_STACK_LABEL, t: 'json', v: [validApp, staleApp] });
  const result = await state.submitEnvelope(mailboxEnvelope('label_update', {
    opId: 'it0423_stale_desktop_foreground',
    target: { model_id: -2, p: 0, r: 0, c: 0, k: DESKTOP_FOREGROUND_APP_LABEL },
    value: { t: 'json', v: staleApp },
  }));

  const labels = state.clientSnap().models['-2'].cells['0,0,0'].labels;
  assert.equal(result.result, 'error', 'server must reject a desktop foreground app update for a missing workspace model');
  assert.equal(result.code, 'invalid_desktop_app', 'server must return a specific desktop app validation error');
  assert.equal(
    labels[DESKTOP_FOREGROUND_APP_LABEL]?.v?.model_id,
    100,
    'rejecting a stale foreground update must preserve the last valid foreground app',
  );
  assert.deepEqual(
    labels[DESKTOP_TASK_STACK_LABEL]?.v.map((task) => task.model_id),
    [100],
    'rejecting a stale foreground update must also remove stale task-stack entries',
  );
}

async function test_persistence_disabled_blocks_must_not_wrap_async_work() {
  const source = readFileSync('packages/ui-model-demo-server/server.mjs', 'utf8');
  assert.doesNotMatch(
    source,
    /withRuntimePersistenceDisabled\s*\(\s*runtime\s*,\s*async\s*\(/u,
    'persistence-disabled blocks must stay synchronous so external waits cannot suppress business persistence',
  );
  assert.match(
    source,
    /persistence_disabled_async_callback_forbidden/u,
    'withRuntimePersistenceDisabled must reject async callbacks to prevent future long disabled windows',
  );
}

async function test_existing_persistent_db_startup_does_not_rewrite_projection_labels() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'dy-0423-persist-existing-'));
  try {
    const dbPath = path.join(tempRoot, 'ui-model-demo.sqlite');
    const script = `
      import { createRequire } from 'node:module';
      const require = createRequire(import.meta.url);
      const { Database } = require('bun:sqlite');
      const { createSqlitePersister } = require(${JSON.stringify(new URL('../../packages/worker-base/src/modeltable_persistence_sqlite.js', import.meta.url).pathname)});
      const seeded = createSqlitePersister({ dbPath: ${JSON.stringify(dbPath)} });
      seeded.db.prepare('insert or replace into mt_data (mt_id, p, r, c, k, t, v, s, i, m) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(100, 0, 0, 0, 'it0423_existing_probe', 'str', JSON.stringify('loaded'), null, null, null);
      seeded.close();
      const mod = await import(${JSON.stringify(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url).href)});
      const state = mod.createServerState({ dbPath: ${JSON.stringify(dbPath)} });
      state.clientSnap();
      const db = new Database(${JSON.stringify(dbPath)}, { readonly: true });
      const rows = db.query("select k from mt_data where mt_id = -2 and k in ('home_table_rows_json', 'editor_model_options_json', 'docs_tree_json', 'static_projects_json') order by k").all();
      const probe = db.query("select v from mt_data where mt_id = 100 and k = 'it0423_existing_probe'").get();
      const rowCount = db.query('select count(*) as n from mt_data').get().n;
      console.log(JSON.stringify({ projectionKeys: rows.map((row) => row.k), probe: probe && probe.v, rowCount }));
      db.close();
    `;
    const result = spawnSync('bun', ['--eval', script], {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 30000,
    });
    assert.equal(result.status, 0, `bun existing-db persistence probe failed: ${result.stderr || result.stdout}`);
    const lines = result.stdout.trim().split('\n').filter(Boolean);
    const parsed = JSON.parse(lines[lines.length - 1] || '{}');
    assert.deepEqual(
      parsed.projectionKeys,
      [],
      'existing DB startup must not rewrite startup-only projection labels into persistent SQLite',
    );
    assert.equal(parsed.probe, JSON.stringify('loaded'), 'existing business record must survive startup');
    assert.equal(
      parsed.rowCount,
      1,
      'existing DB startup must not bulk-rewrite system positive surface records into persistent SQLite',
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

const tests = [
  test_profile_stats_are_computed_after_profile_filtering,
  test_profile_size_report_prints_cell_contributors,
  test_bootstrap_excludes_heavy_builtin_catalog_bodies,
  test_bootstrap_keeps_tiny_mailbox_release_labels_for_singleflight,
  test_auth_disabled_auth_me_exposes_local_dev_capabilities,
  test_visible_initial_projection_does_not_block_on_runtime_initialization,
  test_persistent_startup_does_not_store_derived_projection_labels,
  test_persistent_runtime_still_stores_post_start_business_labels,
  test_workspace_catalog_refresh_clears_stale_desktop_foreground_app,
  test_client_snap_clears_stale_desktop_foreground_without_catalog_refresh,
  test_submit_rejects_stale_desktop_foreground_app_event,
  test_persistence_disabled_blocks_must_not_wrap_async_work,
  test_existing_persistent_db_startup_does_not_rewrite_projection_labels,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    await test();
    passed += 1;
    console.log(`PASS ${test.name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${test.name}: ${err && err.stack ? err.stack : err}`);
  }
}

if (failed > 0) {
  console.error(`FAIL test_0423_snapshot_granularity_contract: ${failed} failed, ${passed} passed`);
  process.exit(1);
}

console.log(`PASS test_0423_snapshot_granularity_contract: ${passed} passed`);
