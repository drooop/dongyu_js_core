import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../packages/worker-base/src/runtime.js');
const { loadProgramModelFromSqlite } = require('../packages/worker-base/src/program_model_loader.js');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function summary(result) {
  return result.map((row) => `${row.key}: ${row.status}`).join('\n');
}

function parseArgs(argv) {
  const args = { case: 'all', db: 'test_files/test7/yhl.db' };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--case') {
      args.case = argv[i + 1];
      i += 1;
    }
    if (token === '--db') {
      args.db = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function countLabels(snapshot) {
  let count = 0;
  for (const model of Object.values(snapshot.models)) {
    for (const cell of Object.values(model.cells)) {
      count += Object.keys(cell.labels).length;
    }
  }
  return count;
}

function assertEventLogMonotonic(events) {
  for (let i = 1; i < events.length; i += 1) {
    if (events[i].event_id !== events[i - 1].event_id + 1) {
      throw new Error('event_id not monotonic');
    }
  }
}

function ensureDb(dbPath) {
  assert(fs.existsSync(dbPath), `db not found: ${dbPath}`);
}

function loadSnapshotCase(dbPath) {
  const runtime = new ModelTableRuntime();
  const meta = loadProgramModelFromSqlite({ runtime, dbPath });
  const snapshot = runtime.snapshot();
  const labelCount = countLabels(snapshot);
  assert(snapshot.models['0'], 'snapshot: missing model 0');
  assert(labelCount > 0, 'snapshot: label count <= 0');
  assertEventLogMonotonic(runtime.eventLog.list());
  return { key: 'load_snapshot', status: 'PASS', meta };
}

function invalidLabelCase() {
  const runtime = new ModelTableRuntime();
  const root = runtime.getModel(0);
  runtime.addLabel(root, 0, 0, 0, { k: '', t: 'str', v: 'x' });
  const errorEvent = runtime.eventLog.list().find((e) => e.op === 'error');
  assert(errorEvent, 'invalid_label: error event required');
  assert(errorEvent.reason === 'invalid_label_k', 'invalid_label: reason mismatch');
  return { key: 'invalid_label', status: 'PASS' };
}

function functionLabelCase() {
  const runtime = new ModelTableRuntime();
  const root = runtime.getModel(0);
  runtime.addLabel(root, 0, 0, 0, { k: 'func1', t: 'function', v: null });
  assert(root.hasFunction('func1'), 'function_label: func1 not registered');
  runtime.addLabel(root, 0, 0, 0, { k: 'run_func1', t: 'run', v: 'x' });
  const intercepts = runtime.intercepts.list();
  assert(intercepts.find((i) => i.type === 'run_func'), 'function_label: run intercept missing');
  return { key: 'function_label', status: 'PASS' };
}

function runMissingCase() {
  const runtime = new ModelTableRuntime();
  const root = runtime.getModel(0);
  runtime.addLabel(root, 0, 0, 0, { k: 'run_missing', t: 'run', v: 'x' });
  const errorEvent = runtime.eventLog.list().find((e) => e.op === 'error');
  assert(errorEvent, 'run_missing: error event required');
  assert(errorEvent.reason === 'func_not_found', 'run_missing: reason func_not_found');
  return { key: 'run_missing', status: 'PASS' };
}

function connectAllowlistCase() {
  const runtime = new ModelTableRuntime();
  const root = runtime.getModel(0);
  runtime.addLabel(root, 0, 0, 0, { k: 'CELL_CONNECT', t: 'connect', v: {} });
  runtime.addLabel(root, 0, 0, 0, { k: 'MODEL_CONNECT', t: 'connect', v: {} });
  runtime.addLabel(root, 0, 0, 0, { k: 'V1N_CONNECT', t: 'connect', v: {} });
  runtime.addLabel(root, 0, 0, 0, { k: 'DE_CONNECT', t: 'connect', v: {} });
  runtime.addLabel(root, 0, 0, 0, { k: 'DAM_CONNECT', t: 'connect', v: {} });
  runtime.addLabel(root, 0, 0, 0, { k: 'PIC_CONNECT', t: 'connect', v: {} });
  runtime.addLabel(root, 0, 0, 0, { k: 'WORKSPACE_CONNECT', t: 'connect', v: {} });
  const intercepts = runtime.intercepts.list();
  const scopes = intercepts.map((item) => item.payload.scope);
  assert(scopes.includes('cell'), 'connect: missing cell scope');
  assert(scopes.includes('model'), 'connect: missing model scope');
  assert(scopes.includes('v1n'), 'connect: missing v1n scope');
  assert(scopes.length === 3, 'connect: unexpected intercepts');
  return { key: 'connect_allowlist', status: 'PASS' };
}

function runValidation(dbPath, selectedCase) {
  const results = [];

  if (selectedCase === 'load_snapshot' || selectedCase === 'all') {
    ensureDb(dbPath);
    const result = loadSnapshotCase(dbPath);
    results.push({ key: result.key, status: result.status });
    console.log(`replay_order=${result.meta.replayOrder}`);
    console.log(`value_parse=${result.meta.valueParse}`);
  }

  if (selectedCase === 'invalid_label' || selectedCase === 'all') {
    results.push(invalidLabelCase());
  }

  if (selectedCase === 'function_label' || selectedCase === 'all') {
    results.push(functionLabelCase());
  }

  if (selectedCase === 'run_missing' || selectedCase === 'all') {
    results.push(runMissingCase());
  }

  if (selectedCase === 'connect_allowlist' || selectedCase === 'all') {
    results.push(connectAllowlistCase());
  }

  return results;
}

try {
  const args = parseArgs(process.argv);
  const results = runValidation(args.db, args.case);
  console.log('VALIDATION RESULTS');
  console.log(summary(results));
  process.exit(0);
} catch (err) {
  console.error('VALIDATION FAILED');
  console.error(err.message);
  process.exit(1);
}
