#!/usr/bin/env bun

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function loadEnvOnce() {
  try {
    const dotenv = require('dotenv');
    const result = dotenv.config();
    if (result.error) {
      dotenv.config({ path: path.resolve(process.cwd(), '.env') });
    }
  } catch (_) {
    // optional
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function nowTs() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function quantile(values, p) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

async function postJson(url, body, cookie) {
  const headers = { 'content-type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await resp.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (_) {
    // keep raw text
  }
  return { status: resp.status, headers: resp.headers, json, text };
}

async function getJson(url, cookie) {
  const headers = cookie ? { Cookie: cookie } : {};
  const resp = await fetch(url, { method: 'GET', headers });
  const text = await resp.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (_) {
    // keep raw text
  }
  return { status: resp.status, json, text };
}

function modelIds(snapshot) {
  const models = snapshot && snapshot.models ? snapshot.models : {};
  return Object.keys(models).map((id) => Number(id)).filter(Number.isInteger).sort((a, b) => a - b);
}

function positiveModelIds(snapshot) {
  return modelIds(snapshot).filter((id) => id > 0);
}

function wsRegistry(snapshot) {
  const models = snapshot && snapshot.models ? snapshot.models : {};
  const m = models['-2'] || models[-2];
  return m?.cells?.['0,0,0']?.labels?.ws_apps_registry?.v;
}

function model100State(snapshot) {
  const models = snapshot && snapshot.models ? snapshot.models : {};
  const m = models['100'] || models[100];
  return {
    color: m?.cells?.['0,0,0']?.labels?.bg_color?.v ?? null,
    status: m?.cells?.['0,0,0']?.labels?.status?.v ?? null,
  };
}

async function waitForModel100Change({ baseUrl, cookie, initialColor, initialStatus, timeoutMs }) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const resp = await getJson(`${baseUrl}/snapshot`, cookie);
    if (resp.status === 200 && resp.json && resp.json.snapshot) {
      const cur = model100State(resp.json.snapshot);
      const changed = (cur.color && cur.color !== initialColor) || (cur.status && cur.status !== initialStatus);
      if (changed) {
        return { ok: true, elapsedMs: Date.now() - start, color: cur.color, status: cur.status };
      }
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  const tail = await getJson(`${baseUrl}/snapshot`, cookie);
  const tailState = tail.status === 200 && tail.json && tail.json.snapshot ? model100State(tail.json.snapshot) : { color: null, status: null };
  return { ok: false, elapsedMs: Date.now() - start, color: tailState.color, status: tailState.status };
}

function fail(msg, summary, outPath) {
  summary.pass = false;
  summary.error = msg;
  fs.writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.error(`FAIL ${msg}`);
  console.error(`summary=${outPath}`);
  process.exit(1);
}

async function main() {
  loadEnvOnce();

  const baseUrl = String(process.env.UI_SERVER_URL || 'http://127.0.0.1:19000').replace(/\/+$/, '');
  const outDir = path.resolve(process.cwd(), process.env.PLANA_OUT_DIR || 'docs/iterations/0137-planA-layered-pressure-test/assets');
  const patchPath = path.resolve(process.cwd(), process.env.PLANA_PATCH_PATH || 'packages/worker-base/system-models/workspace_positive_models.json');
  const importRounds = Number.parseInt(process.env.PLANA_IMPORT_ROUNDS || '5', 10);
  const uiRounds = Number.parseInt(process.env.PLANA_UI_EVENT_ROUNDS || '30', 10);
  const uiTimeoutMs = Number.parseInt(process.env.PLANA_UI_EVENT_TIMEOUT_MS || '15000', 10);
  const requiredModels = [1, 2, 100, 1001, 1002];

  ensureDir(outDir);
  const ts = nowTs();
  const summaryPath = path.join(outDir, `stepA_D_summary_${ts}.json`);
  const step2Path = path.join(outDir, `step2_before_${ts}.json`);
  const step3Path = path.join(outDir, `step3_import_${ts}.json`);
  const step4Path = path.join(outDir, `step4_pressure_summary.json`);

  const summary = {
    pass: true,
    baseUrl,
    patchPath,
    importRounds,
    uiRounds,
    uiTimeoutMs,
    requiredModels,
    startedAt: new Date().toISOString(),
  };

  if (!fs.existsSync(patchPath)) {
    fail(`patch_not_found path=${patchPath}`, summary, summaryPath);
  }
  const patch = JSON.parse(fs.readFileSync(patchPath, 'utf8'));

  const homeserverUrl = process.env.MATRIX_HOMESERVER_URL;
  const username = process.env.MATRIX_MBR_USER;
  const password = process.env.MATRIX_MBR_PASSWORD;
  if (!homeserverUrl || !username || !password) {
    fail('missing env MATRIX_HOMESERVER_URL/MATRIX_MBR_USER/MATRIX_MBR_PASSWORD', summary, summaryPath);
  }

  const login = await postJson(`${baseUrl}/auth/login`, { homeserverUrl, username, password });
  if (login.status !== 200) {
    fail(`login_failed status=${login.status} body=${login.text.slice(0, 200)}`, summary, summaryPath);
  }
  const cookie = String(login.headers.get('set-cookie') || '').split(';')[0];
  if (!cookie) {
    fail('login_cookie_missing', summary, summaryPath);
  }

  const before = await getJson(`${baseUrl}/snapshot`, cookie);
  if (before.status !== 200 || !before.json || !before.json.snapshot) {
    fail(`snapshot_before_failed status=${before.status}`, summary, summaryPath);
  }
  const beforeSnapshot = before.json.snapshot;
  const beforePositive = positiveModelIds(beforeSnapshot);
  const beforeWs = wsRegistry(beforeSnapshot);
  const step2 = {
    before_all_model_ids: modelIds(beforeSnapshot),
    before_positive_model_ids: beforePositive,
    before_positive_count: beforePositive.length,
    before_ws_registry_len: Array.isArray(beforeWs) ? beforeWs.length : 0,
  };
  fs.writeFileSync(step2Path, `${JSON.stringify(step2, null, 2)}\n`, 'utf8');
  summary.step2 = step2;
  if (beforePositive.length !== 0) {
    fail(`expected_before_positive_count=0 actual=${beforePositive.length}`, summary, summaryPath);
  }

  const firstImport = await postJson(`${baseUrl}/api/modeltable/patch`, { patch, allowCreateModel: true }, cookie);
  if (firstImport.status !== 200 || !firstImport.json || firstImport.json.ok !== true) {
    fail(`first_import_failed status=${firstImport.status} body=${firstImport.text.slice(0, 200)}`, summary, summaryPath);
  }

  const after = await getJson(`${baseUrl}/snapshot`, cookie);
  if (after.status !== 200 || !after.json || !after.json.snapshot) {
    fail(`snapshot_after_failed status=${after.status}`, summary, summaryPath);
  }
  const afterSnapshot = after.json.snapshot;
  const afterPositive = positiveModelIds(afterSnapshot);
  const afterWs = wsRegistry(afterSnapshot);
  const missingAfter = requiredModels.filter((id) => !afterPositive.includes(id));
  const step3 = {
    first_import_result: firstImport.json.apply_result,
    after_positive_model_ids: afterPositive,
    after_ws_registry_len: Array.isArray(afterWs) ? afterWs.length : 0,
    missing_required_after_first_import: missingAfter,
    idempotency_rounds: importRounds,
    idempotency_failures: [],
  };

  for (let i = 0; i < importRounds; i += 1) {
    const resp = await postJson(`${baseUrl}/api/modeltable/patch`, { patch, allowCreateModel: true }, cookie);
    if (resp.status !== 200 || !resp.json || resp.json.ok !== true) {
      step3.idempotency_failures.push({ round: i + 1, type: 'http', status: resp.status });
      continue;
    }
    const snap = await getJson(`${baseUrl}/snapshot`, cookie);
    if (snap.status !== 200 || !snap.json || !snap.json.snapshot) {
      step3.idempotency_failures.push({ round: i + 1, type: 'snapshot', status: snap.status });
      continue;
    }
    const ids = positiveModelIds(snap.json.snapshot);
    const missing = requiredModels.filter((id) => !ids.includes(id));
    const ws = wsRegistry(snap.json.snapshot);
    const wsLen = Array.isArray(ws) ? ws.length : 0;
    if (missing.length > 0 || wsLen !== 5) {
      step3.idempotency_failures.push({ round: i + 1, type: 'state', missing, wsLen });
    }
  }

  fs.writeFileSync(step3Path, `${JSON.stringify(step3, null, 2)}\n`, 'utf8');
  summary.step3 = step3;
  if (missingAfter.length > 0) {
    fail(`missing_required_models_after_first_import=${missingAfter.join(',')}`, summary, summaryPath);
  }
  if (step3.idempotency_failures.length > 0) {
    fail(`idempotency_failures=${step3.idempotency_failures.length}`, summary, summaryPath);
  }

  const pressure = {
    rounds: uiRounds,
    success_count: 0,
    error_count: 0,
    latencies_ms: [],
    errors: [],
    round_details: [],
  };

  for (let i = 0; i < uiRounds; i += 1) {
    const snap = await getJson(`${baseUrl}/snapshot`, cookie);
    if (snap.status !== 200 || !snap.json || !snap.json.snapshot) {
      pressure.error_count += 1;
      pressure.errors.push({ round: i + 1, type: 'snapshot_before_event', status: snap.status });
      continue;
    }
    const cur = model100State(snap.json.snapshot);
    const opId = `planA_${Date.now()}_${i + 1}`;
    const uiEvent = {
      source: 'ui_renderer',
      type: 'label_add',
      payload: {
        action: 'label_add',
        meta: { op_id: opId },
        target: { model_id: 100, p: 0, r: 0, c: 2, k: 'ui_event' },
        value: { t: 'json', v: { action: 'submit', input_value: `round_${i + 1}`, meta: { op_id: opId } } },
      },
    };
    const post = await postJson(`${baseUrl}/ui_event`, uiEvent, cookie);
    const roundInfo = {
      round: i + 1,
      op_id: opId,
      initial_color: cur.color,
      initial_status: cur.status,
      ui_event_status: post.status,
      ui_event_last_op_id: post.json?.ui_event_last_op_id ?? null,
      ui_event_error: post.json?.ui_event_error ?? null,
    };
    if (post.status !== 200 || !post.json || post.json.ok !== true) {
      pressure.error_count += 1;
      pressure.errors.push({ round: i + 1, type: 'ui_event_http', status: post.status });
      pressure.round_details.push({
        ...roundInfo,
        result: 'ui_event_http_error',
      });
      continue;
    }
    const waited = await waitForModel100Change({
      baseUrl,
      cookie,
      initialColor: cur.color,
      initialStatus: cur.status,
      timeoutMs: uiTimeoutMs,
    });
    if (!waited.ok) {
      pressure.error_count += 1;
      pressure.errors.push({
        round: i + 1,
        type: 'wait_timeout',
        timeoutMs: uiTimeoutMs,
        final_color: waited.color,
        final_status: waited.status,
      });
      pressure.round_details.push({
        ...roundInfo,
        result: 'wait_timeout',
        elapsed_ms: waited.elapsedMs,
        final_color: waited.color,
        final_status: waited.status,
      });
      continue;
    }
    pressure.success_count += 1;
    pressure.latencies_ms.push(waited.elapsedMs);
    pressure.round_details.push({
      ...roundInfo,
      result: 'ok',
      elapsed_ms: waited.elapsedMs,
      final_color: waited.color,
      final_status: waited.status,
    });
  }

  pressure.p50_ms = quantile(pressure.latencies_ms, 50);
  pressure.p95_ms = quantile(pressure.latencies_ms, 95);
  pressure.max_ms = pressure.latencies_ms.length > 0 ? Math.max(...pressure.latencies_ms) : null;
  summary.step4 = pressure;
  fs.writeFileSync(step4Path, `${JSON.stringify(pressure, null, 2)}\n`, 'utf8');

  if (pressure.error_count > 0) {
    fail(`ui_event_pressure_errors=${pressure.error_count}`, summary, summaryPath);
  }
  if (pressure.p95_ms != null && pressure.p95_ms >= 3000) {
    fail(`ui_event_pressure_p95_too_high=${pressure.p95_ms}`, summary, summaryPath);
  }

  summary.completedAt = new Date().toISOString();
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(`PASS summary=${summaryPath} step2=${step2Path} step3=${step3Path} step4=${step4Path}`);
}

main().catch((err) => {
  console.error(`FAIL exception=${String(err && err.message ? err.message : err)}`);
  process.exit(1);
});
