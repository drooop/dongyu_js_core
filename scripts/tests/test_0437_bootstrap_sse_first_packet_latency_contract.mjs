#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

function runServerProbe(name, probeBody) {
  const script = `
    import assert from 'node:assert/strict';
    import { once } from 'node:events';

    process.env.DY_AUTH = '0';
    const { ModelTableRuntime } = await import(${JSON.stringify(new URL('../../packages/worker-base/src/runtime.mjs', import.meta.url).href)});
    const { startServer } = await import(${JSON.stringify(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url).href)});

    function waitListening(server) {
      if (server.listening) return Promise.resolve();
      return once(server, 'listening');
    }
    function closeServer(server) {
      if (!server || !server.listening) return Promise.resolve();
      return new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
    }
    async function readJsonResponse(resp) {
      const text = await resp.text();
      try {
        return JSON.parse(text);
      } catch (error) {
        throw new Error('invalid_json_response:' + text.slice(0, 500));
      }
    }
    function appRefsFromSnapshot(snapshot) {
      const labels = snapshot?.models?.['-2']?.cells?.['0,0,0']?.labels || {};
      const registry = Array.isArray(labels.ws_apps_registry?.v) ? labels.ws_apps_registry.v : [];
      return registry
        .filter((entry) => entry && typeof entry.table_id === 'string' && entry.table_id !== 'host' && Number.isInteger(entry.model_id))
        .map((entry) => ({ table_id: entry.table_id, model_id: entry.model_id }));
    }
    async function readReadyBootstrap(baseUrl) {
      let last = null;
      for (let i = 0; i < 30; i += 1) {
        const resp = await fetch(baseUrl + '/snapshot?profile=bootstrap&initial_projection=1');
        last = { status: resp.status, body: await readJsonResponse(resp) };
        if (resp.status === 200) return last.body.snapshot;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error('bootstrap_not_ready:' + JSON.stringify(last));
    }
    function extractCompletedSseSnapshotBlock(text) {
      const parts = String(text || '').split('\\n\\n');
      parts.pop();
      return parts.find((block) => /(^|\\n)event:\\s*snapshot(\\n|$)/u.test(block)) || '';
    }
    async function readFirstSseSnapshot(baseUrl, query) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(new Error('sse_timeout')), 5000);
      try {
        const resp = await fetch(baseUrl + '/stream?' + query, { signal: controller.signal });
        assert.equal(resp.status, 200, 'SSE stream must connect');
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let text = '';
        let snapshotBlock = '';
        while (!snapshotBlock) {
          const { value, done } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
          snapshotBlock = extractCompletedSseSnapshotBlock(text);
        }
        try { await reader.cancel(); } catch (_) {}
        const match = snapshotBlock.match(/(?:^|\\n)data:\\s*([^\\n]+)/u);
        assert.ok(match, 'SSE first packet must contain a snapshot event; got ' + JSON.stringify(text.slice(0, 500)));
        return JSON.parse(match[1]);
      } finally {
        clearTimeout(timeout);
      }
    }
    assert.equal(
      extractCompletedSseSnapshotBlock('retry: 1000\\n\\nevent: snapshot\\ndata: {"partial":'),
      '',
      'unterminated SSE snapshot block must not be parsed',
    );
    assert.match(
      extractCompletedSseSnapshotBlock('retry: 1000\\n\\nevent: snapshot\\ndata: {"ok":true}\\n\\n'),
      /"ok":true/u,
      'terminated SSE snapshot block must be parsed',
    );

    const server = startServer({ port: 0, dbPath: null, skipFrontendBuild: true });
    await waitListening(server);
    const originalSnapshot = ModelTableRuntime.prototype.snapshot;
    try {
      const address = server.address();
      const baseUrl = 'http://127.0.0.1:' + address.port;
      const bootstrap = await readReadyBootstrap(baseUrl);
      const appRefs = appRefsFromSnapshot(bootstrap);
      assert.ok(appRefs.length > 0, 'test requires at least one seeded App table ref');
      ModelTableRuntime.prototype.snapshot = function forbiddenSnapshot() {
        throw new Error('runtime_snapshot_forbidden_for_ready_bootstrap_route');
      };
      ${probeBody}
    } finally {
      ModelTableRuntime.prototype.snapshot = originalSnapshot;
      await closeServer(server);
    }
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 60000,
  });
  assert.equal(
    result.status,
    0,
    `${name} failed:\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
  );
}

function test_ready_bootstrap_route_uses_scoped_builder_not_full_snapshot() {
  runServerProbe('ready bootstrap scoped-builder probe', `
    const resp = await fetch(baseUrl + '/snapshot?profile=bootstrap&initial_projection=1');
    const body = await readJsonResponse(resp);
    assert.equal(resp.status, 200, JSON.stringify(body));
    for (const id of ['0', '-1', '-2', '-28', '-29', '-102']) {
      assert.ok(body.snapshot?.models?.[id], 'bootstrap snapshot must include host model ' + id);
    }
    assert.deepEqual(body.visible_model_refs, [], 'plain bootstrap must not invent visible refs');
    console.log(JSON.stringify({ ok: true, kind: 'bootstrap' }));
  `);
}

function test_ready_bootstrap_with_app_ref_route_uses_scoped_builder_not_full_snapshot() {
  runServerProbe('ready bootstrap app-ref scoped-builder probe', `
    const ref = appRefs[0];
    const resp = await fetch(baseUrl + '/snapshot?profile=bootstrap&visible_model_ref=' + encodeURIComponent(JSON.stringify(ref)));
    const body = await readJsonResponse(resp);
    assert.equal(resp.status, 200, JSON.stringify(body));
    assert.ok(body.snapshot?.models?.['0'], 'bootstrap app-ref snapshot must keep host bootstrap model 0');
    assert.ok(body.snapshot?.tables?.[ref.table_id]?.models?.[String(ref.model_id)], 'bootstrap app-ref snapshot must include requested App table model');
    assert.deepEqual(body.visible_model_refs, [ref], 'bootstrap app-ref snapshot must preserve table-qualified ref metadata');
    console.log(JSON.stringify({ ok: true, kind: 'bootstrap-app-ref', ref }));
  `);
}

function test_ready_bootstrap_with_host_ref_route_uses_scoped_builder_not_full_snapshot() {
  runServerProbe('ready bootstrap host-ref scoped-builder probe', `
    const ref = { table_id: 'host', model_id: -103 };
    const resp = await fetch(baseUrl + '/snapshot?profile=bootstrap&visible_model_ref=' + encodeURIComponent(JSON.stringify(ref)));
    const body = await readJsonResponse(resp);
    assert.equal(resp.status, 200, JSON.stringify(body));
    assert.ok(body.snapshot?.models?.['0'], 'bootstrap host-ref snapshot must keep host bootstrap model 0');
    assert.ok(body.snapshot?.models?.['-103'], 'bootstrap host-ref snapshot must include requested host model');
    assert.deepEqual(body.visible_model_refs, [ref], 'bootstrap host-ref snapshot must preserve table-qualified ref metadata');
    console.log(JSON.stringify({ ok: true, kind: 'bootstrap-host-ref', ref }));
  `);
}

function test_ready_stream_first_snapshot_uses_scoped_builder_not_full_snapshot() {
  runServerProbe('ready stream first snapshot scoped-builder probe', `
    const ref = appRefs[0];
    const query = 'profile=bootstrap&visible_model_ref=' + encodeURIComponent(JSON.stringify(ref));
    const body = await readFirstSseSnapshot(baseUrl, query);
    assert.ok(body.snapshot?.models?.['0'], 'SSE bootstrap snapshot must keep host bootstrap model 0');
    assert.ok(body.snapshot?.tables?.[ref.table_id]?.models?.[String(ref.model_id)], 'SSE bootstrap snapshot must include requested App table model');
    assert.deepEqual(body.visible_model_refs, [ref], 'SSE bootstrap snapshot must preserve table-qualified ref metadata');
    console.log(JSON.stringify({ ok: true, kind: 'stream-bootstrap-app-ref', ref }));
  `);
}

const tests = [
  test_ready_bootstrap_route_uses_scoped_builder_not_full_snapshot,
  test_ready_bootstrap_with_app_ref_route_uses_scoped_builder_not_full_snapshot,
  test_ready_bootstrap_with_host_ref_route_uses_scoped_builder_not_full_snapshot,
  test_ready_stream_first_snapshot_uses_scoped_builder_not_full_snapshot,
];

let failed = 0;
for (const test of tests) {
  try {
    test();
    console.log(`PASS ${test.name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${test.name}`);
    console.error(error && error.stack ? error.stack : error);
  }
}

if (failed > 0) {
  console.error(`${failed} failed, ${tests.length - failed} passed`);
  process.exit(1);
}

console.log(`${tests.length} passed, 0 failed`);
