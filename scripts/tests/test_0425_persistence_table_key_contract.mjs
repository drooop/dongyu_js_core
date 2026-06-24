import assert from 'node:assert';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function runBunProbe(script, label) {
  const result = spawnSync('bun', ['--eval', script], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 30000,
  });
  assert.equal(result.status, 0, `${label} failed:\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  const lines = result.stdout.trim().split('\n').filter(Boolean);
  return JSON.parse(lines[lines.length - 1] || '{}');
}

function withTempDb(testFn) {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'dy-0425-persist-'));
  try {
    return testFn(path.join(tempRoot, 'modeltable.sqlite'));
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function test_app_tables_do_not_collide_on_same_model_id() {
  return withTempDb((dbPath) => {
    const script = `
      import { createRequire } from 'node:module';
      const require = createRequire(import.meta.url);
      const { Database } = require('bun:sqlite');
      const { createSqlitePersister } = require(${JSON.stringify(new URL('../../packages/worker-base/src/modeltable_persistence_sqlite.js', import.meta.url).pathname)});
      const { ModelTableRuntime } = await import(${JSON.stringify(new URL('../../packages/worker-base/src/runtime.mjs', import.meta.url).href)});

      const rt = new ModelTableRuntime();
      const persister = createSqlitePersister({ dbPath: ${JSON.stringify(dbPath)} });
      rt.setPersistence(persister);
      const host = rt.createModel({ id: 1, name: 'host-one', type: 'host' });
      const appA = rt.createModel({ table_id: 'app:todo:a', id: 1, name: 'app-a-one', type: 'app' });
      const appB = rt.createModel({ table_id: 'app:todo:b', id: 1, name: 'app-b-one', type: 'app' });
      rt.addLabel(host, 0, 0, 0, { k: 'title', t: 'str', v: 'host-title' });
      rt.addLabel(appA, 0, 0, 0, { k: 'title', t: 'str', v: 'app-a-title' });
      rt.addLabel(appB, 0, 0, 0, { k: 'title', t: 'str', v: 'app-b-title' });
      persister.close();

      const db = new Database(${JSON.stringify(dbPath)}, { readonly: true });
      const rows = db.query("select table_id, mt_id, k, v from mt_data where mt_id = 1 and k = 'title' order by table_id").all();
      const schema = db.query("pragma table_info(mt_data)").all().map((row) => row.name);
      db.close();
      console.log(JSON.stringify({ schema, rows }));
    `;
    const parsed = runBunProbe(script, 'app-table persistence collision probe');
    assert(parsed.schema.includes('table_id'), 'mt_data schema must include table_id');
    assert.deepEqual(
      parsed.rows.map((row) => [row.table_id, row.mt_id, row.k, row.v]),
      [
        ['app:todo:a', 1, 'title', JSON.stringify('app-a-title')],
        ['app:todo:b', 1, 'title', JSON.stringify('app-b-title')],
        ['host', 1, 'title', JSON.stringify('host-title')],
      ],
      'same model_id labels must be keyed by table_id',
    );
  });
}

function test_remove_label_is_table_qualified() {
  return withTempDb((dbPath) => {
    const script = `
      import { createRequire } from 'node:module';
      const require = createRequire(import.meta.url);
      const { Database } = require('bun:sqlite');
      const { createSqlitePersister } = require(${JSON.stringify(new URL('../../packages/worker-base/src/modeltable_persistence_sqlite.js', import.meta.url).pathname)});
      const { ModelTableRuntime } = await import(${JSON.stringify(new URL('../../packages/worker-base/src/runtime.mjs', import.meta.url).href)});

      const rt = new ModelTableRuntime();
      const persister = createSqlitePersister({ dbPath: ${JSON.stringify(dbPath)} });
      rt.setPersistence(persister);
      const appA = rt.createModel({ table_id: 'app:todo:a', id: 1, name: 'app-a-one', type: 'app' });
      const appB = rt.createModel({ table_id: 'app:todo:b', id: 1, name: 'app-b-one', type: 'app' });
      rt.addLabel(appA, 0, 0, 0, { k: 'title', t: 'str', v: 'app-a-title' });
      rt.addLabel(appB, 0, 0, 0, { k: 'title', t: 'str', v: 'app-b-title' });
      rt.rmLabel(appA, 0, 0, 0, 'title');
      persister.close();

      const db = new Database(${JSON.stringify(dbPath)}, { readonly: true });
      const rows = db.query("select table_id, mt_id, k, v from mt_data where mt_id = 1 and k = 'title' order by table_id").all();
      db.close();
      console.log(JSON.stringify({ rows }));
    `;
    const parsed = runBunProbe(script, 'table-qualified remove probe');
    assert.deepEqual(
      parsed.rows.map((row) => [row.table_id, row.mt_id, row.k, row.v]),
      [['app:todo:b', 1, 'title', JSON.stringify('app-b-title')]],
      'removing one app table label must not delete another app table with same model_id',
    );
  });
}

function test_existing_schema_migrates_to_explicit_host_table() {
  return withTempDb((dbPath) => {
    const script = `
      import { createRequire } from 'node:module';
      const require = createRequire(import.meta.url);
      const { Database } = require('bun:sqlite');
      const { createSqlitePersister } = require(${JSON.stringify(new URL('../../packages/worker-base/src/modeltable_persistence_sqlite.js', import.meta.url).pathname)});

      const seeded = new Database(${JSON.stringify(dbPath)});
      seeded.query("create table mt_data (mt_id integer, p integer, r integer, c integer, k text, t text, v text, s text, i integer, m text, primary key (mt_id, p, r, c, k, t)) without rowid").run();
      seeded.query("insert into mt_data (mt_id, p, r, c, k, t, v, s, i, m) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(1, 0, 0, 0, 'legacy', 'str', JSON.stringify('host-legacy'), null, null, null);
      seeded.close();

      const persister = createSqlitePersister({ dbPath: ${JSON.stringify(dbPath)} });
      persister.close();
      const db = new Database(${JSON.stringify(dbPath)}, { readonly: true });
      const schema = db.query("pragma table_info(mt_data)").all().map((row) => row.name);
      const row = db.query("select table_id, mt_id, k, v from mt_data where mt_id = 1 and k = 'legacy'").get();
      db.close();
      console.log(JSON.stringify({ schema, row }));
    `;
    const parsed = runBunProbe(script, 'legacy schema migration probe');
    assert(parsed.schema.includes('table_id'), 'legacy mt_data schema must migrate to include table_id');
    assert.deepEqual(
      [parsed.row.table_id, parsed.row.mt_id, parsed.row.k, parsed.row.v],
      ['host', 1, 'legacy', JSON.stringify('host-legacy')],
      'legacy rows must become explicit host table rows',
    );
  });
}

function test_program_loader_replays_table_qualified_records() {
  return withTempDb((dbPath) => {
    const script = `
      import { createRequire } from 'node:module';
      const require = createRequire(import.meta.url);
      const { createSqlitePersister } = require(${JSON.stringify(new URL('../../packages/worker-base/src/modeltable_persistence_sqlite.js', import.meta.url).pathname)});
      const { loadProgramModelFromSqlite } = require(${JSON.stringify(new URL('../../packages/worker-base/src/program_model_loader.js', import.meta.url).pathname)});
      const { ModelTableRuntime } = await import(${JSON.stringify(new URL('../../packages/worker-base/src/runtime.mjs', import.meta.url).href)});

      const source = new ModelTableRuntime();
      const persister = createSqlitePersister({ dbPath: ${JSON.stringify(dbPath)} });
      source.setPersistence(persister);
      const host = source.createModel({ id: 1, name: 'host-one', type: 'host' });
      const app = source.createModel({ table_id: 'app:todo:a', id: 1, name: 'app-one', type: 'app' });
      source.addLabel(host, 0, 0, 0, { k: 'title', t: 'str', v: 'host-title' });
      source.addLabel(app, 0, 0, 0, { k: 'title', t: 'str', v: 'app-title' });
      persister.close();

      const target = new ModelTableRuntime();
      const result = loadProgramModelFromSqlite({ runtime: target, dbPath: ${JSON.stringify(dbPath)} });
      const hostTitle = target.getModel({ table_id: 'host', model_id: 1 }).getCell(0, 0, 0).labels.get('title').v;
      const appTitle = target.getModel({ table_id: 'app:todo:a', model_id: 1 }).getCell(0, 0, 0).labels.get('title').v;
      console.log(JSON.stringify({ result, hostTitle, appTitle }));
    `;
    const parsed = runBunProbe(script, 'program loader table-qualified replay probe');
    assert.equal(parsed.hostTitle, 'host-title', 'program loader must replay host model labels');
    assert.equal(parsed.appTitle, 'app-title', 'program loader must replay app-table labels with same model_id');
  });
}

function test_server_direct_persistence_delete_is_host_qualified() {
  const source = readFileSync('packages/ui-model-demo-server/server.mjs', 'utf8');
  assert.doesNotMatch(
    source,
    /delete\s+from\s+mt_data\s+where\s+mt_id\s*=\s*\?/iu,
    'server direct mt_data deletion must qualify host table_id',
  );
}

function test_server_replay_filters_bootstrap_keys_only_on_host_table() {
  return withTempDb((dbPath) => {
    const script = `
      import { createRequire } from 'node:module';
      const require = createRequire(import.meta.url);
      const { createSqlitePersister } = require(${JSON.stringify(new URL('../../packages/worker-base/src/modeltable_persistence_sqlite.js', import.meta.url).pathname)});
      const { ModelTableRuntime } = await import(${JSON.stringify(new URL('../../packages/worker-base/src/runtime.mjs', import.meta.url).href)});

      const source = new ModelTableRuntime();
      const persister = createSqlitePersister({ dbPath: ${JSON.stringify(dbPath)} });
      source.setPersistence(persister);
      const host = source.getModel(0);
      const appRoot = source.createModel({ table_id: 'app:review:a', id: 0, name: 'app-root', type: 'app' });
      source.addLabel(host, 0, 0, 0, { k: 'matrix_server', t: 'str', v: 'host-db-value-should-be-filtered' });
      source.addLabel(appRoot, 0, 0, 0, { k: 'matrix_server', t: 'str', v: 'app-db-value-must-survive' });
      persister.close();

      const server = await import(${JSON.stringify(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url).href)});
      const state = server.createServerState({ dbPath: ${JSON.stringify(dbPath)} });
      const snap = state.snapshot();
      const appValue = snap.tables?.['app:review:a']?.models?.['0']?.cells?.['0,0,0']?.labels?.matrix_server?.v || null;
      console.log(JSON.stringify({ appValue }));
    `;
    const parsed = runBunProbe(script, 'server replay host-only bootstrap filter probe');
    assert.equal(
      parsed.appValue,
      'app-db-value-must-survive',
      'server DB replay must not filter App table root bootstrap-like labels by bare model_id',
    );
  });
}

const tests = [
  test_app_tables_do_not_collide_on_same_model_id,
  test_remove_label_is_table_qualified,
  test_existing_schema_migrates_to_explicit_host_table,
  test_program_loader_replays_table_qualified_records,
  test_server_direct_persistence_delete_is_host_qualified,
  test_server_replay_filters_bootstrap_keys_only_on_host_table,
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
