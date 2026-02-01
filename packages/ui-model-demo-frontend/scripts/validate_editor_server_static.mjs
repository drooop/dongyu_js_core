import http from 'node:http';
import { spawn } from 'node:child_process';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function httpText({ method, host, port, path }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ method, host, port, path }, (res) => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { buf += chunk; });
      res.on('end', () => resolve({ status: res.statusCode || 0, headers: res.headers, text: buf }));
    });
    req.on('error', reject);
    req.end();
  });
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
  const port = 8792;
  const serverPath = new URL('../../ui-model-demo-server/server.mjs', import.meta.url).pathname;

  const proc = spawn('bun', [serverPath], {
    env: { ...process.env, PORT: String(port), WORKER_BASE_WORKSPACE: 'editor_static_demo' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForLine(proc, `http://${host}:${port}`, 20000);

    const r = await httpText({ method: 'GET', host, port, path: '/' });
    assert(r.status === 200, 'root_status_not_200');
    assert(String(r.headers['content-type'] || '').includes('text/html'), 'root_content_type_not_html');
    assert(r.text.includes('<!doctype html') || r.text.includes('<html'), 'root_body_not_html');

    process.stdout.write('editor_server_static: PASS\n');
  } finally {
    try { proc.kill('SIGTERM'); } catch (_) {}
  }
}

main().catch((err) => {
  process.stderr.write(`FAIL: ${err && err.message ? err.message : String(err)}\n`);
  process.exit(1);
});
