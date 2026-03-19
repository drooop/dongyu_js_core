import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { WorkerEngineV0, loadSystemPatch } from './worker_engine_v0.mjs';
import { readMatrixBootstrapConfig } from '../packages/worker-base/src/bootstrap_config.mjs';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../packages/worker-base/src/runtime.js');
const { createMatrixLiveAdapter } = require('../packages/worker-base/src/matrix_live.js');

function env(name, fallback = '') {
  return process.env[name] ? String(process.env[name]) : fallback;
}

function parseIntEnv(name, fallback) {
  const raw = env(name, '');
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isInteger(n) ? n : fallback;
}

function parseSafeInt(value) {
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

function readBootstrapPatchFromEnv() {
  const raw = process.env.MODELTABLE_PATCH_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`MODELTABLE_PATCH_JSON_PARSE_FAILED: ${err && err.message ? err.message : err}`);
  }
}

function getLabel(rt, modelId, p, r, c, k) {
  const model = rt.getModel(modelId);
  if (!model) return null;
  const cell = rt.getCell(model, p, r, c);
  const label = cell.labels.get(k);
  return label ? label.v : null;
}

function loadRolePatches(rt, patchDirAbs) {
  const patchFiles = fs.readdirSync(patchDirAbs).filter((file) => file.endsWith('.json')).sort();
  for (const file of patchFiles) {
    const fullPath = path.join(patchDirAbs, file);
    const patch = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    rt.applyPatch(patch, { allowCreateModel: true, trustedBootstrap: true });
    process.stdout.write(`[ui-worker] loaded patch: ${file}\n`);
  }
}

async function main() {
  const patchDir = process.argv[2] || env('DY_ROLE_PATCH_DIR', 'deploy/sys-v1ns/ui-side-worker/patches');
  const patchDirAbs = path.resolve(patchDir);
  if (!fs.existsSync(patchDirAbs)) {
    throw new Error(`missing_patch_dir:${patchDirAbs}`);
  }

  const httpPort = parseIntEnv('DY_UI_WORKER_HTTP_PORT', 9101);

  const rt = new ModelTableRuntime();
  loadSystemPatch(rt);
  loadRolePatches(rt, patchDirAbs);

  const bootstrapPatch = readBootstrapPatchFromEnv();
  if (bootstrapPatch) {
    rt.applyPatch(bootstrapPatch, { allowCreateModel: true, trustedBootstrap: true });
    process.stdout.write('[ui-worker] loaded MODELTABLE_PATCH_JSON bootstrap\n');
  }

  rt.setRuntimeMode('edit');

  const matrixConfig = readMatrixBootstrapConfig(rt);
  const roomId = matrixConfig.roomId || env('DY_MATRIX_ROOM_ID', '');
  if (!roomId) {
    throw new Error('missing_matrix_room_id');
  }

  const inboxLabel = String(getLabel(rt, -10, 0, 0, 0, 'ui_mgmt_inbox_label') || 'ui_mgmt_inbox').trim();
  const matrixFunc = String(getLabel(rt, -10, 0, 0, 0, 'ui_matrix_func') || 'ui_apply_snapshot_delta').trim();
  const matrixEventFilter = String(getLabel(rt, -10, 0, 0, 0, 'ui_matrix_event_filter') || 'snapshot_delta').trim();
  const debugValueModelId = Number.isInteger(getLabel(rt, -10, 0, 0, 0, 'ui_debug_value_model_id'))
    ? getLabel(rt, -10, 0, 0, 0, 'ui_debug_value_model_id')
    : 1;
  const debugValueKey = String(getLabel(rt, -10, 0, 0, 0, 'ui_debug_value_k') || 'slide_demo_text').trim();

  const adapter = await createMatrixLiveAdapter({
    roomId,
    syncTimeoutMs: 20000,
    homeserverUrl: matrixConfig.homeserverUrl || undefined,
    accessToken: matrixConfig.accessToken || undefined,
    userId: matrixConfig.userId || undefined,
    password: matrixConfig.password || undefined,
    peerUserId: matrixConfig.peerUserId || undefined,
  });
  const engine = new WorkerEngineV0({ runtime: rt, mgmtAdapter: adapter, mqttPublish: null });

  rt.setRuntimeMode('running');
  process.stdout.write(`[ui-worker] runtime_mode=${rt.getRuntimeMode()}\n`);

  adapter.subscribe((event) => {
    if (!event || event.version !== 'v0') return;
    if (event.type !== matrixEventFilter) return;
    if (!rt.isRuntimeRunning()) return;
    process.stdout.write(`[ui-worker] recv ${event.type} op_id=${event.op_id || ''}\n`);
    const sys = rt.getModel(-10);
    rt.addLabel(sys, 0, 0, 0, { k: inboxLabel, t: 'json', v: event });
    engine.executeFunction(matrixFunc);
    engine.tick();
  });

  const server = http.createServer((req, res) => {
    if (!req || !req.url) {
      res.statusCode = 400;
      res.end('bad request');
      return;
    }

    const url = new URL(req.url, `http://127.0.0.1:${httpPort}`);
    if (req.url.startsWith('/value')) {
      const model = rt.getModel(debugValueModelId);
      const cell = model ? rt.getCell(model, 0, 0, 0) : null;
      const value = cell ? cell.labels.get(debugValueKey)?.v ?? '' : '';
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ [debugValueKey]: value }));
      return;
    }

    if (url.pathname === '/model') {
      const modelId = parseSafeInt(url.searchParams.get('model_id'));
      if (modelId === null) {
        res.statusCode = 400;
        res.end('bad model_id');
        return;
      }
      const model = rt.getModel(modelId);
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ exists: Boolean(model), model: model ? { id: model.id, name: model.name, type: model.type } : null }));
      return;
    }

    if (url.pathname === '/label') {
      const modelId = parseSafeInt(url.searchParams.get('model_id'));
      const p = parseSafeInt(url.searchParams.get('p'));
      const r = parseSafeInt(url.searchParams.get('r'));
      const c = parseSafeInt(url.searchParams.get('c'));
      const k = url.searchParams.get('k') ? String(url.searchParams.get('k')) : '';
      if (modelId === null || p === null || r === null || c === null || !k) {
        res.statusCode = 400;
        res.end('bad query');
        return;
      }
      const model = rt.getModel(modelId);
      if (!model) {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ exists: false, t: null, v: null }));
        return;
      }
      const cell = rt.getCell(model, p, r, c);
      const label = cell.labels.get(k);
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ exists: Boolean(label), t: label ? label.t : null, v: label ? label.v : null }));
      return;
    }

    res.statusCode = 200;
    res.setHeader('content-type', 'text/plain');
    res.end('ok');
  });

  server.listen(httpPort, '127.0.0.1', () => {
    process.stdout.write(`[ui-worker] READY http://127.0.0.1:${httpPort}/value room_id=${adapter.room_id}\n`);
  });

  process.on('SIGINT', () => {
    try { adapter.close(); } catch (_) {}
    try { server.close(); } catch (_) {}
    process.exit(0);
  });
}

main().catch((err) => {
  process.stderr.write('[ui-worker] FAILED\n');
  process.stderr.write(String(err && err.stack ? err.stack : err));
  process.stderr.write('\n');
  process.exitCode = 1;
});
