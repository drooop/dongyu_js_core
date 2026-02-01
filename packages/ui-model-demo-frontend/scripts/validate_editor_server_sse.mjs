import http from 'node:http';
import { spawn } from 'node:child_process';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function editorEnvelope({ event_id, action, op_id, target, value }) {
  const payload = { action, meta: { op_id } };
  if (target) payload.target = target;
  if (value !== undefined) payload.value = value;
  return {
    event_id,
    type: action,
    payload,
    source: 'ui_renderer',
    ts: 0,
  };
}

function httpJson({ method, host, port, path, body }) {
  const data = body === undefined ? '' : JSON.stringify(body);
  const headers = {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(data),
  };
  return new Promise((resolve, reject) => {
    const req = http.request({ method, host, port, path, headers }, (res) => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { buf += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 0, json: buf ? JSON.parse(buf) : null });
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.end(data);
  });
}

function connectSse({ host, port, path }) {
  const req = http.request({ method: 'GET', host, port, path, headers: { accept: 'text/event-stream' } });
  const listeners = new Set();
  let buffer = '';

  function onEvent(evt) {
    for (const fn of listeners) fn(evt);
  }

  req.on('response', (res) => {
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      buffer += chunk;
      while (true) {
        const idx = buffer.indexOf('\n\n');
        if (idx < 0) break;
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);

        const lines = raw.split(/\n/);
        let eventName = 'message';
        const dataLines = [];
        for (const line of lines) {
          if (line.startsWith('event:')) eventName = line.slice('event:'.length).trim();
          if (line.startsWith('data:')) dataLines.push(line.slice('data:'.length).trim());
        }
        const data = dataLines.join('\n');
        if (!data) continue;
        onEvent({ event: eventName, data });
      }
    });
  });

  req.end();

  return {
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    close() {
      try { req.destroy(); } catch (_) {}
    },
  };
}

async function waitForLine(proc, pattern, timeoutMs) {
  const started = Date.now();
  let buf = '';
  return new Promise((resolve, reject) => {
    function onData(chunk) {
      buf += String(chunk);
      if (buf.includes(pattern)) {
        cleanup();
        resolve();
      }
      if (Date.now() - started > timeoutMs) {
        cleanup();
        reject(new Error('server_start_timeout'));
      }
    }
    function cleanup() {
      proc.stdout.off('data', onData);
      proc.stderr.off('data', onData);
    }
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    setTimeout(() => {
      if (Date.now() - started > timeoutMs) {
        cleanup();
        reject(new Error('server_start_timeout'));
      }
    }, timeoutMs).unref();
  });
}

async function main() {
  const host = '127.0.0.1';
  const port = 8791;
  const serverPath = new URL('../../ui-model-demo-server/server.mjs', import.meta.url).pathname;

  const proc = spawn('bun', [serverPath], {
    env: {
      ...process.env,
      PORT: String(port),
      CORS_ORIGIN: 'http://127.0.0.1:5173',
      WORKER_BASE_WORKSPACE: 'editor_sse_demo',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForLine(proc, `http://${host}:${port}`, 5000);

    const first = await httpJson({ method: 'GET', host, port, path: '/snapshot' });
    assert(first.status === 200, 'snapshot_status_not_200');
    assert(first.json && first.json.snapshot && first.json.snapshot.models, 'snapshot_shape');

    let seenSnapshots = 0;
    const sse = connectSse({ host, port, path: '/stream' });
    const snapshots = [];
    const unsub = sse.on((evt) => {
      if (evt.event !== 'snapshot') return;
      try {
        const parsed = JSON.parse(evt.data);
        if (parsed && parsed.snapshot) {
          snapshots.push(parsed.snapshot);
          seenSnapshots += 1;
        }
      } catch (_) {
        // ignore
      }
    });

    // Wait for the initial snapshot frame.
    for (let i = 0; i < 50 && seenSnapshots < 1; i += 1) {
      await sleep(50);
    }
    assert(seenSnapshots >= 1, 'sse_initial_snapshot_missing');

    // 1) create model 1
    const create = editorEnvelope({
      event_id: 1,
      action: 'submodel_create',
      op_id: 'op_1',
      value: { t: 'json', v: { id: 1, name: 'M1', type: 'main' } },
    });
    const r1 = await httpJson({ method: 'POST', host, port, path: '/ui_event', body: create });
    assert(r1.status === 200, 'ui_event_create_status');
    assert(r1.json && r1.json.ok === true, 'ui_event_create_ok');
    assert(r1.json.snapshot && r1.json.snapshot.models && r1.json.snapshot.models['1'], 'model1_created');

    // 2) typed int ok
    const setIntOk = editorEnvelope({
      event_id: 2,
      action: 'label_update',
      op_id: 'op_2',
      target: { model_id: 1, p: 0, r: 0, c: 0, k: 'n' },
      value: { t: 'int', v: '123' },
    });
    const r2 = await httpJson({ method: 'POST', host, port, path: '/ui_event', body: setIntOk });
    assert(r2.json && r2.json.ok === true, 'ui_event_int_ok');
    const nLabel = r2.json.snapshot.models['1'].cells['0,0,0'].labels.n;
    assert(nLabel && nLabel.t === 'int' && nLabel.v === 123, 'typed_int_normalized');

    // 3) typed int invalid
    const setIntBad = editorEnvelope({
      event_id: 3,
      action: 'label_update',
      op_id: 'op_3',
      target: { model_id: 1, p: 0, r: 0, c: 0, k: 'n' },
      value: { t: 'int', v: 'nope' },
    });
    const r3 = await httpJson({ method: 'POST', host, port, path: '/ui_event', body: setIntBad });
    assert(r3.json && r3.json.ok === true, 'ui_event_int_bad_ok');
    assert(r3.json.ui_event_error && r3.json.ui_event_error.detail === 'invalid_int', 'typed_int_invalid_error_detail');

    // ui_ast_v0 exists in mailbox model
    const ast = r3.json.snapshot.models['-1']
      && r3.json.snapshot.models['-1'].cells
      && r3.json.snapshot.models['-1'].cells['0,0,0']
      && r3.json.snapshot.models['-1'].cells['0,0,0'].labels
      && r3.json.snapshot.models['-1'].cells['0,0,0'].labels.ui_ast_v0;
    assert(ast && ast.t === 'json' && ast.v && typeof ast.v === 'object', 'ui_ast_v0_present');

    // Wait until SSE saw at least one more snapshot after POSTs.
    for (let i = 0; i < 50 && seenSnapshots < 2; i += 1) {
      await sleep(50);
    }
    assert(seenSnapshots >= 2, 'sse_snapshot_not_advancing');

    unsub();
    sse.close();

    process.stdout.write('editor_server_sse: PASS\n');
  } finally {
    try { proc.kill('SIGTERM'); } catch (_) {}
  }
}

main().catch((err) => {
  process.stderr.write(`FAIL: ${err && err.message ? err.message : String(err)}\n`);
  process.exit(1);
});
