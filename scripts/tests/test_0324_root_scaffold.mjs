#!/usr/bin/env node
// Contract tests for iteration 0324 — runtime (0,0,0) default three programs seed.
// Covers:
//   (1) model.table creation seeds mt_write / mt_bus_receive / mt_bus_send at (0,0,0)
//   (2) (0,1,0) helper scaffold is NOT seeded (helper completely abolished per user override)
//   (3) mt_write executes a write_label.v1 request submitted to mt_write_req
//   (4) default_table_programs.json is the Tier-2 source of truth for the three programs

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_TABLE_PROGRAMS_PATH = join(
  __dirname,
  '..',
  '..',
  'packages/worker-base/system-models/default_table_programs.json'
);

function wait(ms = 50) {
  return new Promise((r) => setTimeout(r, ms));
}

function mt(k, t, v) {
  return { id: 0, p: 0, r: 0, c: 0, k, t, v };
}

function writeLabelPayload({ target, label }) {
  return [
    mt('__mt_payload_kind', 'str', 'write_label.v1'),
    mt('__mt_request_id', 'str', 'req_0324'),
    mt('__mt_from_cell', 'json', { p: 0, r: 0, c: 0 }),
    mt('__mt_target_cell', 'json', target),
    mt(label.k, label.t, label.v),
  ];
}

async function test_mt_programs_seeded_on_model_table_create() {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  const model = rt.createModel({ id: 100, name: 'test', type: 'test' });
  rt.addLabel(model, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'TestApp' });

  const rootCell = rt.getCell(model, 0, 0, 0);
  const labels = rootCell.labels;

  for (const k of ['mt_write', 'mt_bus_receive', 'mt_bus_send']) {
    const lbl = labels.get(k);
    assert.ok(lbl, `expected (0,0,0) to have func label ${k}`);
    assert.equal(lbl.t, 'func.js', `${k} must be func.js`);
    assert.ok(lbl.v && typeof lbl.v === 'object' && typeof lbl.v.code === 'string' && lbl.v.code.trim().length > 0,
      `${k} must have non-empty code string`);
  }

  // mt_write uses the canonical 0332 endpoint names.
  assert.ok(labels.has('mt_write_req'), 'expected (0,0,0) to have pin.in mt_write_req');
  assert.ok(labels.has('mt_write_result'), 'expected (0,0,0) to have pin.out mt_write_result');
  assert.ok(labels.has('mt_write_req_route'), 'expected (0,0,0) to have pin.connect.label mt_write_req_route');
  assert.ok(!labels.has('mt_write_in'), 'mt_write_in old entry pin must not be seeded');
  assert.ok(!labels.has('mt_write_wiring'), 'mt_write_wiring old mt_write_in path must not be seeded');

  // Other default programs still have an :in pin (pin.in) and a wiring label.
  for (const k of ['mt_bus_receive', 'mt_bus_send']) {
    const inPinName = `${k}_in`;
    assert.ok(labels.has(inPinName), `expected (0,0,0) to have pin.in ${inPinName}`);
    const wiringKey = `${k}_wiring`;
    assert.ok(labels.has(wiringKey), `expected (0,0,0) to have pin.connect.label ${wiringKey}`);
  }

  return { key: 'mt_programs_seeded_on_model_table_create', status: 'PASS' };
}

async function test_helper_scaffold_not_seeded() {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  const model = rt.createModel({ id: 101, name: 'test', type: 'test' });

  const helperCell = rt.getCell(model, 0, 1, 0);
  const forbidden = ['helper_executor', 'scope_privileged', 'owner_apply', 'owner_apply_route', 'owner_materialize'];
  for (const k of forbidden) {
    assert.ok(!helperCell.labels.has(k), `(0,1,0) MUST NOT have ${k} (helper 0324 elimination)`);
  }

  return { key: 'helper_scaffold_not_seeded', status: 'PASS' };
}

async function test_mt_write_executes_cross_cell_write_request() {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  const model = rt.createModel({ id: 102, name: 'test', type: 'test' });
  rt.addLabel(model, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'TestApp' });
  await rt.setRuntimeMode('running');

  // Submit a write_label.v1 request to the canonical (0,0,0) mt_write_req.
  rt.addLabel(model, 0, 0, 0, {
    k: 'mt_write_req',
    t: 'pin.in',
    v: writeLabelPayload({
      target: { p: 1, r: 2, c: 0 },
      label: { k: 'status', t: 'str', v: 'ok' },
    }),
  });

  await wait(120);

  const targetCell = rt.getCell(model, 1, 2, 0);
  const lbl = targetCell.labels.get('status');
  assert.ok(lbl, 'mt_write must have written "status" label to (1,2,0)');
  assert.equal(lbl.t, 'str', 'label t must be str');
  assert.equal(lbl.v, 'ok', 'label v must be ok');

  return { key: 'mt_write_executes_cross_cell_write_request', status: 'PASS' };
}

async function test_default_table_programs_json_is_source_of_truth() {
  // Verify the Tier-2 source file exists and declares the three programs
  let payload;
  try {
    const raw = readFileSync(DEFAULT_TABLE_PROGRAMS_PATH, 'utf8');
    payload = JSON.parse(raw);
  } catch (err) {
    throw new Error(`default_table_programs.json not readable: ${err.message}`);
  }

  const records = Array.isArray(payload) ? payload
    : Array.isArray(payload.records) ? payload.records
    : Array.isArray(payload.patch) ? payload.patch : null;
  assert.ok(Array.isArray(records), 'default_table_programs.json must expose an array of label records');

  const funcKeys = records
    .filter((r) => r && r.p === 0 && r.r === 0 && r.c === 0 && r.t === 'func.js')
    .map((r) => r.k);
  for (const required of ['mt_write', 'mt_bus_receive', 'mt_bus_send']) {
    assert.ok(funcKeys.includes(required),
      `default_table_programs.json MUST declare func.js "${required}" at (0,0,0). Found func keys: ${funcKeys.join(',')}`);
  }

  return { key: 'default_table_programs_json_is_source_of_truth', status: 'PASS' };
}

const tests = [
  test_mt_programs_seeded_on_model_table_create,
  test_helper_scaffold_not_seeded,
  test_mt_write_executes_cross_cell_write_request,
  test_default_table_programs_json_is_source_of_truth,
];

(async () => {
  let passed = 0;
  let failed = 0;
  for (const t of tests) {
    try {
      const r = await t();
      console.log(`[${r.status}] ${r.key}`);
      passed += 1;
    } catch (err) {
      console.log(`[FAIL] ${t.name}: ${err.message}`);
      failed += 1;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
  process.exit(failed > 0 ? 1 : 0);
})();
