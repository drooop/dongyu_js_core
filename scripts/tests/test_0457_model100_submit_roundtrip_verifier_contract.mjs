#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { once } from 'node:events';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFile = promisify(execFileCallback);
const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const verifierPath = resolve(repoRoot, 'scripts/ops/verify_model100_submit_roundtrip.sh');

function snapshot({ bg = '#FFFFFF', status = 'ready', inflight = false, systemReady = false, last = null, error = null } = {}) {
  return {
    snapshot: {
      models: {
        100: {
          cells: {
            '0,0,0': {
              labels: {
                bg_color: { v: bg },
                status: { v: status },
                submit_inflight: { v: inflight },
                system_ready: { v: systemReady },
              },
            },
          },
        },
        '-1': {
          cells: {
            '0,0,1': {
              labels: {
                bus_event_error: { v: error },
                bus_event_last_op_id: { v: last },
              },
            },
          },
        },
      },
    },
  };
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

async function withFakeModel100Server({ afterSubmit, submitResponse = null, hangSnapshotsAfterActivation = false }, run) {
  const calls = [];
  const sockets = new Set();
  let submitted = null;
  let postSubmitReads = 0;
  let runtimeActivated = false;
  const server = createServer(async (request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    calls.push({ method: request.method, pathname: url.pathname, search: url.search });
    response.setHeader('content-type', 'application/json; charset=utf-8');
    try {
      if (request.method === 'GET' && url.pathname === '/snapshot' && url.search === '?profile=full') {
        if (hangSnapshotsAfterActivation && runtimeActivated) return;
        const body = submitted
          ? afterSubmit({ submitted, readIndex: postSubmitReads++ })
          : snapshot({ systemReady: false });
        response.end(JSON.stringify(body));
        return;
      }
      if (request.method === 'GET' && url.pathname === '/snapshot') {
        response.end(JSON.stringify({ snapshot: { models: {} } }));
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/runtime/mode') {
        const body = await readJsonBody(request);
        assert.deepEqual(body, { mode: 'running' });
        runtimeActivated = true;
        response.end(JSON.stringify({ ok: true, mode: 'running' }));
        return;
      }
      if (request.method === 'POST' && url.pathname === '/bus_event') {
        submitted = await readJsonBody(request);
        const accepted = {
          ok: true,
          result: 'ok',
          routed_by: 'model0_busin',
          bus_event_last_op_id: submitted?.meta?.op_id || '',
          bus_event_error: null,
        };
        response.end(JSON.stringify(typeof submitResponse === 'function'
          ? submitResponse({ accepted, submitted })
          : accepted));
        return;
      }
      response.statusCode = 404;
      response.end(JSON.stringify({ error: 'not_found' }));
    } catch (error) {
      response.statusCode = 500;
      response.end(JSON.stringify({ error: error?.message || String(error) }));
    }
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  try {
    return await run({
      baseUrl: `http://127.0.0.1:${address.port}`,
      calls,
      getSubmitted: () => submitted,
    });
  } finally {
    const closed = once(server, 'close');
    server.close();
    for (const socket of sockets) socket.destroy();
    await closed;
  }
}

function verifierArgs(baseUrl, timeoutSec = 2) {
  return [
    verifierPath,
    '--base-url', baseUrl,
    '--timeout-sec', String(timeoutSec),
    '--model-timeout-sec', '2',
    '--poll-interval-sec', '0.01',
  ];
}

function test_source_contract_uses_full_snapshot_and_current_v2_readiness() {
  const source = readFileSync(verifierPath, 'utf8');
  assert.match(source, /\/snapshot\?profile=full/u, 'verifier must read the full snapshot profile');
  assert.doesNotMatch(source, /system_ready|mbr_ready/u, 'removed readiness compatibility must not gate Model100');
  assert.match(source, /--model-timeout-sec/u, 'model presence must have an explicit bounded wait');
  assert.doesNotMatch(source, /--ready-timeout-sec/u, 'obsolete system-ready option must be removed');
  assert.match(source, /\[ "\$STATUS" = "processed" \]/u, 'success must require the remote processed status');
  assert.match(source, /\[ "\$BG" != "\$INITIAL_BG" \]/u, 'success must require a materialized color change');
  assert.match(source, /"\$BASE_URL\/bus_event"/u, 'verifier must use the current bus event endpoint');
  assert.doesNotMatch(source, /"\$BASE_URL\/ui_event"/u, 'legacy UI event endpoint must not be used');
  assert.match(source, /"type":"bus_event_v2"/u);
  assert.match(source, /"bus_in_key":"bus_event_submit_100_0_0_0"/u);
  assert.match(source, /"__mt_payload_kind","t":"str","v":"ui_event\.v1"/u);
  assert.match(source, /SUBMIT_ROUTE[\s\S]*?model0_busin/u, 'accepted request must prove the declared Model 0 route');
  assert.match(source, /bus_event_last_op_id/u);
  assert.match(source, /bus_event_error/u);
  assert.doesNotMatch(source, /ui_event_last_op_id|ui_event_error/u, 'retired mailbox keys must not be read');
  assert.match(source, /--connect-timeout/u, 'every HTTP operation must have a connection timeout');
  assert.match(source, /--max-time/u, 'every HTTP operation must have a request timeout');
  assert.match(source, /TIMEOUT_DEADLINE/u, 'roundtrip timeout must be a wall-clock deadline');
  assert.match(source, /OP_ID=.*\$\$.*RANDOM/u, 'op id must include per-process entropy beyond epoch seconds');
  return { key: 'source_contract_uses_full_snapshot_and_current_v2_readiness', status: 'PASS' };
}

async function test_real_script_accepts_materialized_v2_roundtrip_without_system_ready() {
  await withFakeModel100Server({
    afterSubmit: ({ submitted, readIndex }) => {
      const opId = submitted?.meta?.op_id || null;
      if (readIndex === 0) {
        return snapshot({ status: 'loading', inflight: true, systemReady: false, last: opId });
      }
      return snapshot({ bg: '#123456', status: 'processed', inflight: false, systemReady: false, last: opId });
    },
  }, async ({ baseUrl, calls, getSubmitted }) => {
    const result = await execFile('bash', verifierArgs(baseUrl), { cwd: repoRoot, timeout: 5000 });
    assert.match(result.stdout, /\[verify\] PASS final_state=/u);
    assert.equal(calls.some((call) => call.pathname === '/snapshot' && call.search !== '?profile=full'), false);
    assert.equal(calls.some((call) => call.pathname === '/ui_event'), false);
    assert.equal(calls.some((call) => call.pathname === '/bus_event' && call.method === 'POST'), true);
    const submitted = getSubmitted();
    assert.equal(submitted?.type, 'bus_event_v2');
    assert.equal(submitted?.bus_in_key, 'bus_event_submit_100_0_0_0');
    assert.deepEqual(submitted?.value, [
      { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'ui_event.v1' },
      { id: 0, p: 0, r: 0, c: 0, k: 'input_value', t: 'str', v: '' },
    ]);
    assert.equal(submitted?.meta?.source, 'ui_renderer');
    assert.match(submitted?.meta?.op_id || '', /^verify_model100_[0-9]+_[0-9]+_[0-9]+$/u);
    assert.equal(Number.isInteger(submitted?.meta?.client_dispatch_ts), true);
    assert.equal(typeof submitted?.meta?.client_dispatch_perf_ms, 'number');
  });
  return { key: 'real_script_accepts_materialized_v2_roundtrip_without_system_ready', status: 'PASS' };
}

async function test_last_op_without_remote_materialization_fails_closed() {
  await withFakeModel100Server({
    afterSubmit: ({ submitted }) => snapshot({
      bg: '#FFFFFF',
      status: 'ready',
      inflight: false,
      systemReady: false,
      last: submitted?.meta?.op_id || null,
    }),
  }, async ({ baseUrl }) => {
    await assert.rejects(
      execFile('bash', verifierArgs(baseUrl, 1), { cwd: repoRoot, timeout: 5000 }),
      (error) => error?.code === 2 && /submit roundtrip did not converge/u.test(`${error.stdout || ''}\n${error.stderr || ''}`),
      'a locally accepted op id without remote color/status materialization must not pass',
    );
  });
  return { key: 'last_op_without_remote_materialization_fails_closed', status: 'PASS' };
}

async function test_submit_response_route_and_mailbox_are_fail_closed() {
  const cases = [
    {
      name: 'wrong_route',
      mutate: ({ accepted }) => ({ ...accepted, routed_by: 'owner_materialization' }),
    },
    {
      name: 'missing_last_op',
      mutate: ({ accepted }) => {
        const response = { ...accepted };
        delete response.bus_event_last_op_id;
        return response;
      },
    },
    {
      name: 'non_null_error',
      mutate: ({ accepted, submitted }) => ({
        ...accepted,
        bus_event_error: { op_id: submitted?.meta?.op_id || '', code: 'rejected' },
      }),
    },
    {
      name: 'missing_error_field',
      mutate: ({ accepted }) => {
        const response = { ...accepted };
        delete response.bus_event_error;
        return response;
      },
    },
  ];

  for (const testCase of cases) {
    await withFakeModel100Server({
      submitResponse: testCase.mutate,
      afterSubmit: ({ submitted }) => snapshot({
        bg: '#123456',
        status: 'processed',
        inflight: false,
        last: submitted?.meta?.op_id || null,
      }),
    }, async ({ baseUrl }) => {
      await assert.rejects(
        execFile('bash', verifierArgs(baseUrl), { cwd: repoRoot, timeout: 5000 }),
        (error) => error?.code === 2
          && /submit did not enter the declared Model 0 bus route/u.test(`${error.stdout || ''}\n${error.stderr || ''}`),
        `${testCase.name} must fail before accepting later snapshot state`,
      );
    });
  }

  return { key: 'submit_response_route_and_mailbox_are_fail_closed', status: 'PASS' };
}

async function test_missing_snapshot_error_label_fails_closed() {
  await withFakeModel100Server({
    afterSubmit: ({ submitted }) => {
      const body = snapshot({
        bg: '#123456',
        status: 'processed',
        inflight: false,
        last: submitted?.meta?.op_id || null,
      });
      delete body.snapshot.models['-1'].cells['0,0,1'].labels.bus_event_error;
      return body;
    },
  }, async ({ baseUrl }) => {
    await assert.rejects(
      execFile('bash', verifierArgs(baseUrl, 1), { cwd: repoRoot, timeout: 5000 }),
      (error) => error?.code === 2
        && /submit roundtrip did not converge/u.test(`${error.stdout || ''}\n${error.stderr || ''}`),
      'missing final bus_event_error evidence must not be treated as explicit null',
    );
  });
  return { key: 'missing_snapshot_error_label_fails_closed', status: 'PASS' };
}

async function test_timeout_is_wall_clock_deadline_not_poll_count() {
  await withFakeModel100Server({
    afterSubmit: ({ submitted, readIndex }) => {
      const opId = submitted?.meta?.op_id || null;
      if (readIndex < 2) return snapshot({ status: 'loading', inflight: true, last: opId });
      return snapshot({ bg: '#123456', status: 'processed', inflight: false, last: opId });
    },
  }, async ({ baseUrl }) => {
    const args = verifierArgs(baseUrl, 1);
    const pollIndex = args.indexOf('--poll-interval-sec');
    args[pollIndex + 1] = '0.05';
    const result = await execFile('bash', args, { cwd: repoRoot, timeout: 5000 });
    assert.match(result.stdout, /\[verify\] PASS final_state=/u);
  });
  return { key: 'timeout_is_wall_clock_deadline_not_poll_count', status: 'PASS' };
}

async function test_final_snapshot_wrong_op_fails_closed() {
  await withFakeModel100Server({
    afterSubmit: () => snapshot({
      bg: '#123456', status: 'processed', inflight: false, last: 'stale_other_op',
    }),
  }, async ({ baseUrl }) => {
    await assert.rejects(
      execFile('bash', verifierArgs(baseUrl, 1), { cwd: repoRoot, timeout: 5000 }),
      (error) => error?.code === 2
        && /submit roundtrip did not converge/u.test(`${error.stdout || ''}\n${error.stderr || ''}`),
    );
  });
  return { key: 'final_snapshot_wrong_op_fails_closed', status: 'PASS' };
}

async function test_hanging_snapshot_stays_inside_model_deadline() {
  await withFakeModel100Server({
    hangSnapshotsAfterActivation: true,
    afterSubmit: () => snapshot(),
  }, async ({ baseUrl }) => {
    const started = Date.now();
    await assert.rejects(
      execFile('bash', verifierArgs(baseUrl, 1), { cwd: repoRoot, timeout: 3500 }),
      (error) => error?.code === 2
        && /Model 100 state did not become available/u.test(`${error.stdout || ''}\n${error.stderr || ''}`),
    );
    assert.ok(Date.now() - started < 3000, 'hung HTTP must remain bounded by the declared model deadline');
  });
  return { key: 'hanging_snapshot_stays_inside_model_deadline', status: 'PASS' };
}

async function test_invalid_time_arguments_fail_before_network() {
  const cases = [
    ['--timeout-sec', '0'],
    ['--timeout-sec', '1.5'],
    ['--model-timeout-sec', '-1'],
    ['--poll-interval-sec', '0'],
    ['--poll-interval-sec', 'invalid'],
  ];
  for (const [flag, value] of cases) {
    await assert.rejects(
      execFile('bash', [verifierPath, flag, value], { cwd: repoRoot, timeout: 2000 }),
      (error) => error?.code === 2 && /invalid positive/u.test(`${error.stdout || ''}\n${error.stderr || ''}`),
      `${flag}=${value} must fail before any network operation`,
    );
  }
  return { key: 'invalid_time_arguments_fail_before_network', status: 'PASS' };
}

const tests = [
  test_source_contract_uses_full_snapshot_and_current_v2_readiness,
  test_real_script_accepts_materialized_v2_roundtrip_without_system_ready,
  test_last_op_without_remote_materialization_fails_closed,
  test_submit_response_route_and_mailbox_are_fail_closed,
  test_missing_snapshot_error_label_fails_closed,
  test_timeout_is_wall_clock_deadline_not_poll_count,
  test_final_snapshot_wrong_op_fails_closed,
  test_hanging_snapshot_stays_inside_model_deadline,
  test_invalid_time_arguments_fail_before_network,
];

let failed = 0;
for (const test of tests) {
  try {
    const result = await test();
    process.stdout.write(`[PASS] ${result.key}\n`);
  } catch (error) {
    failed += 1;
    process.stderr.write(`[FAIL] ${test.name}\n${error?.stack || error}\n`);
  }
}
process.stdout.write(`${tests.length - failed} passed, ${failed} failed out of ${tests.length}\n`);
if (failed > 0) process.exit(1);
