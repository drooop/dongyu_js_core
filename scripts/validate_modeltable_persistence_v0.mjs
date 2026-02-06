import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../packages/worker-base/src/runtime.js');
const { createSqlitePersister } = require('../packages/worker-base/src/modeltable_persistence_sqlite.js');
const { loadProgramModelFromSqlite } = require('../packages/worker-base/src/program_model_loader.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function dbPath() {
  const configuredRoot = process.env.WORKER_BASE_DATA_ROOT;
  const dataRoot = configuredRoot && configuredRoot.trim()
    ? (path.isAbsolute(configuredRoot) ? configuredRoot : path.resolve(process.cwd(), configuredRoot))
    : path.resolve(process.cwd(), 'packages', 'ui-model-demo-server', 'data');
  return path.resolve(dataRoot, 'persist_demo', 'yhl.db');
}

function resetDb(fp) {
  if (fs.existsSync(fp)) fs.rmSync(fp);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
}

function runRoundtrip() {
  const fp = dbPath();
  resetDb(fp);

  const rt = new ModelTableRuntime();
  const persister = createSqlitePersister({ dbPath: fp });
  rt.setPersistence(persister);

  const m1 = rt.createModel({ id: 1, name: 'M1', type: 'main' });
  rt.addLabel(m1, 0, 0, 0, { k: 'keep', t: 'str', v: 'hello' });
  rt.addLabel(m1, 0, 0, 0, { k: 'remove', t: 'str', v: 'bye' });
  rt.rmLabel(m1, 0, 0, 0, 'remove');

  assert(fs.existsSync(fp), 'db_file_missing');

  const rt2 = new ModelTableRuntime();
  loadProgramModelFromSqlite({ runtime: rt2, dbPath: fp });
  const snap = rt2.snapshot();
  assert(snap.models['1'], 'model1_missing_after_load');
  const cell = snap.models['1'].cells['0,0,0'];
  assert(cell && cell.labels.keep, 'label_keep_missing_after_load');
  assert(!cell.labels.remove, 'label_remove_should_not_exist');

  return { key: 'roundtrip', status: 'PASS' };
}

try {
  const results = [runRoundtrip()];
  console.log('VALIDATION RESULTS');
  for (const row of results) {
    console.log(`${row.key}: ${row.status}`);
  }
  process.exit(0);
} catch (err) {
  console.error('VALIDATION FAILED');
  console.error(err.message || String(err));
  process.exit(1);
}
