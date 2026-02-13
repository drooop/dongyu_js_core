#!/usr/bin/env node
/**
 * 0145 Regression test:
 * - Workspace sidebar registry should include Model 100 when runtime has it.
 * - One submit should yield one color change (no duplicate forwarding).
 *
 * Usage:
 *   node scripts/tests/test_0145_workspace_single_submit.mjs
 *   UI_SERVER_URL=http://127.0.0.1:30900 node scripts/tests/test_0145_workspace_single_submit.mjs
 */

import http from 'node:http';

const UI_SERVER_URL = process.env.UI_SERVER_URL || 'http://127.0.0.1:30900';
const POLL_MS = Number.parseInt(process.env.POLL_MS || '100', 10);
const WINDOW_MS = Number.parseInt(process.env.WINDOW_MS || '5000', 10);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestJson(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, UI_SERVER_URL);
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method,
        headers: payload
          ? {
              'content-type': 'application/json',
              'content-length': Buffer.byteLength(payload),
            }
          : undefined,
      },
      (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          text += chunk;
        });
        res.on('end', () => {
          try {
            const json = text ? JSON.parse(text) : null;
            resolve({ status: res.statusCode || 0, json, raw: text });
          } catch (err) {
            resolve({ status: res.statusCode || 0, json: null, raw: text, parseError: String(err && err.message ? err.message : err) });
          }
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function colorFromSnapshot(snapshotJson) {
  return snapshotJson?.snapshot?.models?.['100']?.cells?.['0,0,0']?.labels?.bg_color?.v || null;
}

function workspaceRegistryFromSnapshot(snapshotJson) {
  const raw = snapshotJson?.snapshot?.models?.['-2']?.cells?.['0,0,0']?.labels?.ws_apps_registry?.v;
  return Array.isArray(raw) ? raw : [];
}

async function main() {
  const snap0 = await requestJson('GET', '/snapshot');
  if (snap0.status !== 200 || !snap0.json) {
    process.stdout.write(`[FAIL] snapshot_not_available status=${snap0.status}\n`);
    process.exit(1);
  }

  const wsRegistry = workspaceRegistryFromSnapshot(snap0.json);
  const hasModel100InRegistry = wsRegistry.some((item) => Number(item && item.model_id) === 100);
  const initialColor = colorFromSnapshot(snap0.json);

  const opId = `it0145_single_${Date.now()}`;
  const submitEnvelope = {
    source: 'ui_renderer',
    type: 'label_add',
    payload: {
      action: 'label_add',
      meta: { op_id: opId },
      target: { model_id: 100, p: 0, r: 0, c: 2, k: 'ui_event' },
      value: { t: 'json', v: { action: 'submit', meta: { op_id: opId } } },
    },
  };

  const post = await requestJson('POST', '/ui_event', submitEnvelope);
  if (post.status !== 200 || !(post.json && post.json.ok)) {
    process.stdout.write(`[FAIL] ui_event_submit_failed status=${post.status} body=${post.raw}\n`);
    process.exit(1);
  }

  const start = Date.now();
  const samples = [];
  while (Date.now() - start < WINDOW_MS) {
    const snap = await requestJson('GET', '/snapshot');
    if (snap.status === 200 && snap.json) {
      samples.push({
        t: Date.now() - start,
        color: colorFromSnapshot(snap.json),
      });
    }
    await sleep(POLL_MS);
  }

  let prev = initialColor;
  const changes = [];
  for (const sample of samples) {
    if (sample.color && sample.color !== prev) {
      changes.push(sample);
      prev = sample.color;
    }
  }

  const passRegistry = hasModel100InRegistry;
  const passSingleChange = changes.length === 1;

  if (!passRegistry || !passSingleChange) {
    process.stdout.write('[FAIL] 0145 workspace regression failed\n');
    process.stdout.write(`  ws_registry_has_model100=${passRegistry}\n`);
    process.stdout.write(`  initial_color=${initialColor}\n`);
    process.stdout.write(`  change_count=${changes.length}\n`);
    process.stdout.write(`  changes=${JSON.stringify(changes)}\n`);
    process.exit(1);
  }

  process.stdout.write('[PASS] 0145 workspace regression\n');
  process.stdout.write(`  ws_registry_has_model100=true\n`);
  process.stdout.write(`  initial_color=${initialColor}\n`);
  process.stdout.write(`  final_color=${changes[0].color}\n`);
  process.stdout.write(`  change_count=1 elapsed_ms=${changes[0].t}\n`);
}

main().catch((err) => {
  process.stdout.write(`[FAIL] unexpected_error ${String(err && err.message ? err.message : err)}\n`);
  process.exit(1);
});

