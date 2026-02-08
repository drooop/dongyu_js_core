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
      const rootEnv = path.resolve(process.cwd(), '.env');
      dotenv.config({ path: rootEnv });
    }
  } catch (_) {
    // optional dependency
  }
}

async function postJson(url, body, cookie) {
  const headers = { 'content-type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
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

function fail(msg) {
  console.error(`FAIL ${msg}`);
  process.exit(1);
}

async function main() {
  loadEnvOnce();

  const baseUrl = String(process.env.UI_SERVER_URL || 'http://127.0.0.1:9000').replace(/\/+$/, '');
  const patchPath = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : path.resolve(process.cwd(), 'packages/worker-base/system-models/workspace_positive_models.json');

  if (!fs.existsSync(patchPath)) fail(`patch_not_found path=${patchPath}`);
  const patch = JSON.parse(fs.readFileSync(patchPath, 'utf8'));

  const homeserverUrl = process.env.MATRIX_HOMESERVER_URL;
  const username = process.env.MATRIX_MBR_USER;
  const password = process.env.MATRIX_MBR_PASSWORD;
  if (!homeserverUrl || !username || !password) {
    fail('missing_login_env MATRIX_HOMESERVER_URL/MATRIX_MBR_USER/MATRIX_MBR_PASSWORD');
  }

  const login = await postJson(`${baseUrl}/auth/login`, {
    homeserverUrl,
    username,
    password,
  });
  if (login.status !== 200) {
    fail(`login_failed status=${login.status} body=${login.text.slice(0, 200)}`);
  }
  const cookie = String(login.headers.get('set-cookie') || '').split(';')[0];
  if (!cookie) fail('login_cookie_missing');

  const applyResp = await postJson(`${baseUrl}/api/modeltable/patch`, {
    patch,
    allowCreateModel: true,
  }, cookie);
  if (applyResp.status !== 200 || !applyResp.json || applyResp.json.ok !== true) {
    fail(`apply_patch_failed status=${applyResp.status} body=${applyResp.text.slice(0, 200)}`);
  }

  const snapResp = await getJson(`${baseUrl}/snapshot`, cookie);
  if (snapResp.status !== 200 || !snapResp.json || !snapResp.json.snapshot) {
    fail(`snapshot_failed status=${snapResp.status}`);
  }

  const models = snapResp.json.snapshot.models || {};
  const ids = Object.keys(models).map((v) => Number(v)).filter(Number.isInteger).sort((a, b) => a - b);
  const required = [1, 2, 100, 1001, 1002];
  const missing = required.filter((id) => !ids.includes(id));
  if (missing.length > 0) fail(`missing_models=${missing.join(',')}`);

  const wsState = models['-2'] || models[-2];
  const wsRegistry = wsState?.cells?.['0,0,0']?.labels?.ws_apps_registry?.v;
  if (!Array.isArray(wsRegistry) || wsRegistry.length === 0) {
    fail('workspace_registry_empty_after_import');
  }

  console.log(`PASS imported_models=${required.join(',')} registry_count=${wsRegistry.length} applied=${applyResp.json.apply_result?.applied ?? 'n/a'} rejected=${applyResp.json.apply_result?.rejected ?? 'n/a'} patch=${patchPath}`);
}

main().catch((err) => {
  fail(`exception=${String(err && err.message ? err.message : err)}`);
});
