import http from 'node:http';
import { createRequire } from 'node:module';
import { WorkerEngineV0, loadSystemPatch } from './worker_engine_v0.mjs';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../packages/worker-base/src/runtime.js');
const { createMatrixLiveAdapter } = require('../packages/bus-mgmt/src/matrix_live.js');

function env(name, fallback = '') {
  return process.env[name] ? String(process.env[name]) : fallback;
}

function parseIntEnv(name, fallback) {
  const raw = env(name, '');
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isInteger(n) ? n : fallback;
}

function systemCell(rt) {
  const sys = rt.getModel(-10);
  return rt.getCell(sys, 0, 0, 0);
}

function addFunction(rt, name, code) {
  const sys = rt.getModel(-10);
  rt.addLabel(sys, 0, 0, 0, { k: name, t: 'function', v: code });
}

function setLabel(rt, ref, t, v) {
  const model = rt.getModel(ref.model_id);
  rt.addLabel(model, ref.p, ref.r, ref.c, { k: ref.k, t, v });
}

function parseSafeInt(value) {
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

async function main() {
  const roomId = env('DY_MATRIX_ROOM_ID', '');
  if (!roomId) {
    throw new Error('missing_env:DY_MATRIX_ROOM_ID');
  }

  const httpPort = parseIntEnv('DY_UI_WORKER_HTTP_PORT', 9101);

  const rt = new ModelTableRuntime();
  loadSystemPatch(rt);
  if (!rt.getModel(-10)) rt.createModel({ id: -10, name: 'system', type: 'system' });
  if (!rt.getModel(1)) rt.createModel({ id: 1, name: 'UI', type: 'data' });

  // Function: apply snapshot_delta patch from mgmt inbox.
  addFunction(rt, 'ui_apply_snapshot_delta', [
    "const inbox = ctx.getLabel({ model_id: -10, p: 0, r: 0, c: 0, k: 'ui_mgmt_inbox' });",
    "if (!inbox || typeof inbox !== 'object') return;",
    "const patch = inbox.payload;",
    "if (!patch || patch.version !== 'mt.v0' || !Array.isArray(patch.records)) return;",
    "ctx.runtime.applyPatch(patch, { allowCreateModel: true });",
    "ctx.rmLabel({ model_id: -10, p: 0, r: 0, c: 0, k: 'ui_mgmt_inbox' });",
    "ctx.rmLabel({ model_id: -10, p: 0, r: 0, c: 0, k: 'run_ui_apply_snapshot_delta' });",
  ].join(' '));

  // Ensure target label exists for visibility.
  setLabel(rt, { model_id: 1, p: 0, r: 0, c: 0, k: 'slide_demo_text' }, 'str', '');

  const adapter = await createMatrixLiveAdapter({ roomId, syncTimeoutMs: 20000 });
  const engine = new WorkerEngineV0({ runtime: rt, mgmtAdapter: adapter, mqttPublish: null });

  adapter.subscribe((event) => {
    if (!event || event.version !== 'v0') return;
    if (event.type !== 'snapshot_delta') return;
    process.stdout.write(`[ui-worker] recv snapshot_delta op_id=${event.op_id}\n`);
    const sys = rt.getModel(-10);
    rt.addLabel(sys, 0, 0, 0, { k: 'ui_mgmt_inbox', t: 'json', v: event });
    rt.addLabel(sys, 0, 0, 0, { k: 'run_ui_apply_snapshot_delta', t: 'str', v: '1' });
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
      const m = rt.getModel(1);
      const cell = rt.getCell(m, 0, 0, 0);
      const v = cell.labels.get('slide_demo_text')?.v ?? '';
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ slide_demo_text: v }));
      return;
    }

    if (url.pathname === '/model') {
      const modelId = parseSafeInt(url.searchParams.get('model_id'));
      if (modelId === null) {
        res.statusCode = 400;
        res.end('bad model_id');
        return;
      }
      const m = rt.getModel(modelId);
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ exists: Boolean(m), model: m ? { id: m.id, name: m.name, type: m.type } : null }));
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
      const m = rt.getModel(modelId);
      if (!m) {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ exists: false, t: null, v: null }));
        return;
      }
      const cell = rt.getCell(m, p, r, c);
      const lv = cell.labels.get(k);
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ exists: Boolean(lv), t: lv ? lv.t : null, v: lv ? lv.v : null }));
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
