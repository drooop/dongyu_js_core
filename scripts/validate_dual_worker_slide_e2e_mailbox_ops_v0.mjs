import http from 'node:http';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createMatrixLiveAdapter } = require('../packages/bus-mgmt/src/matrix_live.js');
const sdk = require('matrix-js-sdk');

function requireEnv(keys) {
  const missing = [];
  for (const k of keys) {
    if (!process.env[k]) missing.push(k);
  }
  if (missing.length > 0) {
    throw new Error(`missing_env:${missing.join(',')}`);
  }
}

function isEnabled() {
  return String(process.env.DY_ENABLE_E2E || '') === '1';
}

async function ensureMatrixAuth(baseUrl) {
  const hasToken = Boolean(process.env.MATRIX_MBR_ACCESS_TOKEN);
  if (hasToken) {
    const accessToken = String(process.env.MATRIX_MBR_ACCESS_TOKEN || '');
    let userId = process.env.MATRIX_MBR_USER ? String(process.env.MATRIX_MBR_USER) : '';
    if (!userId) {
      const tmp = sdk.createClient({ baseUrl, accessToken });
      const who = await tmp.whoami();
      userId = who && who.user_id ? String(who.user_id) : '';
    }
    if (!accessToken || !userId) throw new Error('matrix_token_missing_user');
    return { accessToken, userId };
  }

  requireEnv(['MATRIX_MBR_USER', 'MATRIX_MBR_PASSWORD']);
  const userLocalpart = String(process.env.MATRIX_MBR_USER || '');
  const password = String(process.env.MATRIX_MBR_PASSWORD || '');
  const tmp = sdk.createClient({ baseUrl });
  const login = await tmp.login('m.login.password', {
    identifier: { type: 'm.id.user', user: userLocalpart },
    password,
  });
  const accessToken = login.access_token;
  const userId = login.user_id;
  if (!accessToken || !userId) throw new Error('matrix_login_failed');
  return { accessToken, userId };
}

function httpJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { buf += c; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 0, json: JSON.parse(buf) });
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
  });
}

async function waitFor(fn, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await fn();
    if (ok) return true;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

function spawnWorker(label, cmd, args, env) {
  const p = spawn(cmd, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
  p.stdout.setEncoding('utf8');
  p.stderr.setEncoding('utf8');
  p.stdout.on('data', (d) => process.stdout.write(`[${label}] ${d}`));
  p.stderr.on('data', (d) => process.stderr.write(`[${label}][err] ${d}`));
  return p;
}

async function main() {
  if (!isEnabled()) {
    console.log('VALIDATION RESULTS');
    console.log('dual_worker_slide_e2e_mailbox_ops_v0: SKIP (disabled by default)');
    console.log('Set DY_ENABLE_E2E=1 to run. Optional: DY_MATRIX_ROOM_ID to reuse an existing room.');
    return;
  }

  requireEnv(['MATRIX_HOMESERVER_URL']);

  const children = [];
  const cleanup = () => {
    for (const p of children) {
      try { p.kill('SIGINT'); } catch (_) {}
    }
  };

  try {
    const baseUrl = String(process.env.MATRIX_HOMESERVER_URL || '');
    const { accessToken, userId } = await ensureMatrixAuth(baseUrl);
    process.env.MATRIX_MBR_ACCESS_TOKEN = accessToken;
    process.env.MATRIX_MBR_USER = userId;

    let roomId = process.env.DY_MATRIX_ROOM_ID ? String(process.env.DY_MATRIX_ROOM_ID) : '';
    if (!roomId) {
      const client = sdk.createClient({ baseUrl, accessToken, userId });
      const created = await client.createRoom({
        visibility: 'private',
        preset: 'private_chat',
        name: `dy-bus-e2e-${Date.now()}`,
      });
      roomId = created && created.room_id ? String(created.room_id) : '';
      if (!roomId.startsWith('!')) throw new Error('matrix_create_room_failed');
    }

    const uiPort = 9300 + Math.floor(Math.random() * 500);
    const remotePort = 9800 + Math.floor(Math.random() * 500);
    const remoteModelId = 2;

    const baseEnv = {
      ...process.env,
      DY_MATRIX_ROOM_ID: roomId,
      DY_REMOTE_MODEL_ID: String(remoteModelId),
      DY_UI_WORKER_HTTP_PORT: String(uiPort),
      DY_REMOTE_WORKER_HTTP_PORT: String(remotePort),
      NODE_TLS_REJECT_UNAUTHORIZED: process.env.NODE_TLS_REJECT_UNAUTHORIZED || '0',
      MATRIX_MBR_ACCESS_TOKEN: accessToken,
      MATRIX_MBR_USER: userId,
    };

    const ui = spawnWorker('ui-worker', process.execPath, ['scripts/run_worker_ui_side_v0.mjs'], baseEnv);
    const mbr = spawnWorker('mbr-worker', process.execPath, ['scripts/run_worker_mbr_v0.mjs'], baseEnv);
    const remote = spawnWorker('remote-worker', process.execPath, ['scripts/run_worker_remote_v0.mjs'], baseEnv);
    children.push(ui, mbr, remote);

    const okUi = await waitFor(async () => {
      try {
        const r = await httpJson(`http://127.0.0.1:${uiPort}/value`);
        return r.status === 200;
      } catch (_) {
        return false;
      }
    }, 20000);
    if (!okUi) throw new Error('ui_worker_not_ready');

    const adapter = await createMatrixLiveAdapter({ roomId, syncTimeoutMs: 20000 });
    const now = Date.now();

    const newModelId = 3;
    const opCreate = `op_${now}_create`; // must be unique
    const envelopeCreate = {
      event_id: now,
      type: 'submodel_create',
      payload: {
        action: 'submodel_create',
        value: { t: 'json', v: { id: newModelId, name: 'M3', type: 'data' } },
        meta: { op_id: opCreate },
      },
      source: 'ui_renderer',
      ts: 0,
    };
    await adapter.publish({ version: 'v0', type: 'ui_event', op_id: opCreate, payload: envelopeCreate });

    const okModelCreated = await waitFor(async () => {
      try {
        const r = await httpJson(`http://127.0.0.1:${uiPort}/model?model_id=${newModelId}`);
        return r.json && r.json.exists === true;
      } catch (_) {
        return false;
      }
    }, 20000);
    if (!okModelCreated) throw new Error('model_not_created');

    const opA = `op_${now}_a`;
    const envelopeA = {
      event_id: now + 1,
      type: 'label_update',
      payload: {
        action: 'label_update',
        target: { model_id: newModelId, p: 0, r: 0, c: 0, k: 'a' },
        value: { t: 'str', v: '1' },
        meta: { op_id: opA },
      },
      source: 'ui_renderer',
      ts: 0,
    };
    await adapter.publish({ version: 'v0', type: 'ui_event', op_id: opA, payload: envelopeA });

    const okA = await waitFor(async () => {
      try {
        const r = await httpJson(`http://127.0.0.1:${uiPort}/label?model_id=${newModelId}&p=0&r=0&c=0&k=a`);
        return r.json && r.json.exists === true && r.json.v === '1';
      } catch (_) {
        return false;
      }
    }, 20000);
    if (!okA) throw new Error('label_a_not_set');

    const opB = `op_${now}_b`;
    const envelopeB = {
      event_id: now + 2,
      type: 'label_update',
      payload: {
        action: 'label_update',
        target: { model_id: newModelId, p: 0, r: 0, c: 0, k: 'b' },
        value: { t: 'str', v: '2' },
        meta: { op_id: opB },
      },
      source: 'ui_renderer',
      ts: 0,
    };
    await adapter.publish({ version: 'v0', type: 'ui_event', op_id: opB, payload: envelopeB });

    const okB = await waitFor(async () => {
      try {
        const r = await httpJson(`http://127.0.0.1:${uiPort}/label?model_id=${newModelId}&p=0&r=0&c=0&k=b`);
        return r.json && r.json.exists === true && r.json.v === '2';
      } catch (_) {
        return false;
      }
    }, 20000);
    if (!okB) throw new Error('label_b_not_set');

    const opClear = `op_${now}_clear`;
    const envelopeClear = {
      event_id: now + 3,
      type: 'cell_clear',
      payload: {
        action: 'cell_clear',
        target: { model_id: newModelId, p: 0, r: 0, c: 0 },
        meta: { op_id: opClear },
      },
      source: 'ui_renderer',
      ts: 0,
    };
    await adapter.publish({ version: 'v0', type: 'ui_event', op_id: opClear, payload: envelopeClear });

    const okCleared = await waitFor(async () => {
      try {
        const ra = await httpJson(`http://127.0.0.1:${uiPort}/label?model_id=${newModelId}&p=0&r=0&c=0&k=a`);
        const rb = await httpJson(`http://127.0.0.1:${uiPort}/label?model_id=${newModelId}&p=0&r=0&c=0&k=b`);
        return ra.json && rb.json && ra.json.exists === false && rb.json.exists === false;
      } catch (_) {
        return false;
      }
    }, 20000);
    if (!okCleared) throw new Error('cell_not_cleared');

    adapter.close();

    console.log('VALIDATION RESULTS');
    console.log(`dual_worker_slide_e2e_mailbox_ops_v0: PASS room_id=${roomId} model_id=${newModelId}`);
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  console.error('VALIDATION FAILED');
  console.error(err && err.message ? err.message : String(err));
  process.exit(1);
});
