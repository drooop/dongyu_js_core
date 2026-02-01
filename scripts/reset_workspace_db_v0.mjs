import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../packages/worker-base/src/runtime.js');
const { createSqlitePersister } = require('../packages/worker-base/src/modeltable_persistence_sqlite.js');
const { createLocalBusAdapter } = require('../packages/ui-model-demo-frontend/src/local_bus_adapter.js');
const { buildEditorAstV1 } = require('../packages/ui-model-demo-frontend/src/demo_modeltable.js');

function resolveWorkspace() {
  return process.env.WORKER_BASE_WORKSPACE || 'default';
}

function resolveDbPath(workspace) {
  return path.resolve(process.cwd(), 'data', workspace, 'yhl.db');
}

function resetDbFile(dbPath) {
  if (fs.existsSync(dbPath)) {
    fs.rmSync(dbPath);
  }
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

function seedModelType(runtime, modelId, value) {
  const model = runtime.getModel(modelId);
  runtime.addLabel(model, 0, 0, 0, { k: 'model_type', t: 'str', v: value });
}

function ensureStateLabel(runtime, key, t, v) {
  const state = runtime.getModel(-2);
  const cell = runtime.getCell(state, 0, 0, 0);
  if (!cell.labels.has(key)) {
    runtime.addLabel(state, 0, 0, 0, { k: key, t, v });
  }
}

function buildSnapshotJson(runtime) {
  const snap = runtime.snapshot();
  const safeModels = {};
  for (const id of Object.keys(snap.models || {})) {
    const model = snap.models[id];
    const safeCells = {};
    for (const key of Object.keys(model.cells || {})) {
      const cell = model.cells[key];
      const safeLabels = {};
      for (const lk of Object.keys(cell.labels || {})) {
        const label = cell.labels[lk];
        safeLabels[lk] = { k: label.k, t: label.t, v: label.v };
      }
      safeCells[key] = { p: cell.p, r: cell.r, c: cell.c, labels: safeLabels };
    }
    safeModels[id] = { id: model.id, name: model.name, type: model.type, cells: safeCells };
  }
  return JSON.stringify({ models: safeModels, v1nConfig: { ...snap.v1nConfig } }, null, 2);
}

function seedEditorState(runtime) {
  ensureStateLabel(runtime, 'selected_model_id', 'str', '1');
  ensureStateLabel(runtime, 'draft_p', 'str', '0');
  ensureStateLabel(runtime, 'draft_r', 'str', '0');
  ensureStateLabel(runtime, 'draft_c', 'str', '0');
  ensureStateLabel(runtime, 'draft_k', 'str', 'title');
  ensureStateLabel(runtime, 'draft_t', 'str', 'str');
  ensureStateLabel(runtime, 'draft_v_text', 'str', 'Hello');
  ensureStateLabel(runtime, 'draft_v_int', 'int', 0);
  ensureStateLabel(runtime, 'draft_v_bool', 'bool', false);

  ensureStateLabel(runtime, 'pin_demo_host', 'str', '127.0.0.1');
  ensureStateLabel(runtime, 'pin_demo_port', 'int', 1883);
  ensureStateLabel(runtime, 'pin_demo_client_id', 'str', 'pin-demo');
  ensureStateLabel(runtime, 'pin_demo_pin', 'str', 'demo');
  ensureStateLabel(runtime, 'pin_demo_in_json', 'str', '{"value":1}');
  ensureStateLabel(runtime, 'pin_demo_out_json', 'str', '{"value":2}');
}

function seedMailbox(runtime) {
  const mailbox = runtime.getModel(-1);
  runtime.addLabel(mailbox, 0, 0, 1, { k: 'ui_event', t: 'event', v: null });
}

function main() {
  const workspace = resolveWorkspace();
  const dbPath = resolveDbPath(workspace);
  resetDbFile(dbPath);

  const runtime = new ModelTableRuntime();
  const persister = createSqlitePersister({ dbPath });
  runtime.setPersistence(persister);

  runtime.createModel({ id: 0, name: 'MT', type: 'main' });
  runtime.createModel({ id: -1, name: 'editor_mailbox', type: 'ui' });
  runtime.createModel({ id: -2, name: 'editor_state', type: 'ui' });

  seedModelType(runtime, 0, 'main');
  seedModelType(runtime, -1, 'ui');
  seedModelType(runtime, -2, 'ui');

  seedEditorState(runtime);
  seedMailbox(runtime);

  const eventLog = [];
  const adapter = createLocalBusAdapter({ runtime, eventLog, mode: 'v1' });
  const snapshot = runtime.snapshot();
  const uiAst = buildEditorAstV1(snapshot);
  const snapshotJson = buildSnapshotJson(runtime);
  const eventLogJson = JSON.stringify(eventLog, null, 2);
  adapter.updateUiDerived({ uiAst, snapshotJson, eventLogJson });

  process.stdout.write(`reset_db: PASS ${dbPath}\n`);
}

try {
  main();
  process.exit(0);
} catch (err) {
  process.stderr.write(`reset_db: FAIL ${err && err.message ? err.message : String(err)}\n`);
  process.exit(1);
}
