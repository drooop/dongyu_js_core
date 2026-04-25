#!/usr/bin/env node
// 0325c Step 1 — Option B generator rewrite contract tests (TDD red).
// Locks 3 migration targets: owner_materialize generators, legacy forward funcs, Bucket C handlers.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SERVER_MJS = path.join(repoRoot, 'packages/ui-model-demo-server/server.mjs');
const WORKSPACE_JSON = path.join(repoRoot, 'packages/worker-base/system-models/workspace_positive_models.json');

function wait(ms = 100) { return new Promise((r) => setTimeout(r, ms)); }

function mtPayloadRecord(k, t, v) {
  return { id: 0, p: 0, r: 0, c: 0, k, t, v };
}

function ownerRequestPayload(request) {
  return [
    mtPayloadRecord('__mt_payload_kind', 'str', 'owner_request.v1'),
    mtPayloadRecord('__mt_request_id', 'str', request.request_id),
    mtPayloadRecord('target_model_id', 'int', request.target_model_id),
    mtPayloadRecord('op', 'str', request.op),
    mtPayloadRecord('request', 'json', request),
  ];
}

function extractFnSrc(src, fnName) {
  const re = new RegExp(`function ${fnName}\\([^)]*\\)\\s*\\{[\\s\\S]*?^\\}`, 'm');
  const m = src.match(re);
  if (!m) throw new Error(`cannot extract function ${fnName} from server.mjs`);
  return m[0];
}

// Sandboxed eval of a static function from server.mjs. Safe because:
// (1) targets are known pure string-builder functions (no side effects, no I/O)
// (2) vm context exposes only JSON (required by fn body) — no fs/net/process
// (3) only used by test harness, never production
function evalCodeGenerator(serverSrc, fnName, modelId) {
  const fnSrc = extractFnSrc(serverSrc, fnName);
  const ctx = { JSON };
  vm.createContext(ctx);
  const anonSrc = fnSrc.replace(`function ${fnName}`, 'function');
  vm.runInContext(`globalThis._fn = (${anonSrc});`, ctx);
  return vm.runInContext(`globalThis._fn(${JSON.stringify(modelId)});`, ctx);
}

async function pollUntil(predicate, { attempts = 20, intervalMs = 50 } = {}) {
  for (let i = 0; i < attempts; i += 1) {
    const v = predicate();
    if (v) return v;
    await wait(intervalMs);
  }
  return predicate();
}

function findAddLabel(records, { model_id, p = 0, r = 0, c = 0, k }) {
  return records.find((rec) =>
    rec && rec.op === 'add_label' && rec.model_id === model_id &&
    (rec.p || 0) === p && (rec.r || 0) === r && (rec.c || 0) === c && rec.k === k);
}

// ─── 静态契约（Static contracts）─────────────────────────────────────

function test_owner_materialize_generator_no_ctx_api() {
  const src = readFileSync(SERVER_MJS, 'utf8');
  for (const fnName of ['genericOwnerMaterializeCode', 'homeOwnerMaterializeCode']) {
    const code = evalCodeGenerator(src, fnName, 999);
    assert.ok(!/ctx\.writeLabel/.test(code),
      `${fnName}(999) generated code must not contain ctx.writeLabel`);
    assert.ok(!/ctx\.getLabel/.test(code),
      `${fnName}(999) generated code must not contain ctx.getLabel`);
    assert.ok(!/ctx\.rmLabel/.test(code),
      `${fnName}(999) generated code must not contain ctx.rmLabel`);
  }
  return { key: 'owner_materialize_generator_no_ctx_api', status: 'PASS' };
}

function test_owner_materialize_generator_uses_v1n_table() {
  const src = readFileSync(SERVER_MJS, 'utf8');
  for (const fnName of ['genericOwnerMaterializeCode', 'homeOwnerMaterializeCode']) {
    const code = evalCodeGenerator(src, fnName, 999);
    assert.ok(/V1N\.table\.addLabel/.test(code),
      `${fnName}(999) generated code must use V1N.table.addLabel (root-privileged cross-cell write)`);
    assert.ok(/readPayload\(labelValue, 'request'/.test(code),
      `${fnName}(999) generated code must read owner request from ModelTable payload`);
  }
  return { key: 'owner_materialize_generator_uses_v1n_table', status: 'PASS' };
}

// Per Step 3 decision (runlog Step 3 补录 SC #7 豁免清单): 3 forward funcs 均降级为 programEngine-only;
// forward body 保留 ctx.*（programEngine ctx shape server.mjs:3040-3080；runtime 入口已断，等价 programEngine-only 代码，按 runlog Step 3 SC #7 豁免清单补录纳入豁免范围）;
// 契约转为「不存在 runtime pin.connect.label 入口指向 (func, forward_*:in)」
function test_legacy_forward_funcs_no_runtime_pin_wiring() {
  const doc = JSON.parse(readFileSync(WORKSPACE_JSON, 'utf8'));
  const recs = Array.isArray(doc.records) ? doc.records : [];
  const pinConnectLabels = recs.filter((r) => r && r.op === 'add_label' && r.t === 'pin.connect.label');
  const FORWARD_NAMES = [
    'forward_workspace_filltable_submit_from_model0',
    'forward_matrix_phase1_send_from_model0',
    'forward_model100_submit_from_model0',
  ];
  for (const fwdName of FORWARD_NAMES) {
    const funcTarget = `(func, ${fwdName}:in)`;
    const hits = pinConnectLabels.filter((lbl) => {
      const entries = Array.isArray(lbl.v) ? lbl.v : [];
      return entries.some((entry) => Array.isArray(entry && entry.to) && entry.to.includes(funcTarget));
    });
    assert.equal(hits.length, 0,
      `${fwdName} must have no runtime pin.connect.label entry (programEngine-only). Found ${hits.length} hit(s).`);
  }
  return { key: 'legacy_forward_funcs_no_runtime_pin_wiring', status: 'PASS' };
}

// Bucket B Model 100 owner_materialize 在 test_model_100_ui.json (0,0,0) root,
// 通过 pin.connect.label (owner_route) runtime 触发 → 必须迁 V1N.table（post-0325 runtime ctx 无 ctx.*）
function test_model100_owner_materialize_uses_v1n_table() {
  const testModel100Json = path.join(repoRoot, 'packages/worker-base/system-models/test_model_100_ui.json');
  const doc = JSON.parse(readFileSync(testModel100Json, 'utf8'));
  const recs = Array.isArray(doc.records) ? doc.records : [];
  const handler = recs.find((r) =>
    r && r.op === 'add_label' && r.model_id === 100 && r.k === 'owner_materialize' && r.t === 'func.js');
  assert.ok(handler, 'Model 100 owner_materialize must be declared in test_model_100_ui.json');
  const code = handler.v && handler.v.code;
  assert.ok(typeof code === 'string', 'owner_materialize code must be string');
  assert.ok(!/ctx\.writeLabel/.test(code),
    'Model 100 owner_materialize must not use ctx.writeLabel (runtime-triggered Bucket B, needs V1N.table)');
  assert.ok(!/ctx\.rmLabel/.test(code),
    'Model 100 owner_materialize must not use ctx.rmLabel');
  assert.ok(/V1N\.table\.addLabel/.test(code),
    'Model 100 owner_materialize must use V1N.table.addLabel (root-privileged cross-cell write)');
  return { key: 'model100_owner_materialize_uses_v1n_table', status: 'PASS' };
}

function test_bucket_c_handler_uses_write_label_req() {
  const doc = JSON.parse(readFileSync(WORKSPACE_JSON, 'utf8'));
  const recs = Array.isArray(doc.records) ? doc.records : [];
  const handler = recs.find((r) =>
    r && r.op === 'add_label' && r.model_id === 1030 && r.k === 'handle_slide_import_click' && r.t === 'func.js');
  assert.ok(handler, 'handle_slide_import_click must be declared at Model 1030');
  const code = handler.v && handler.v.code;
  assert.ok(typeof code === 'string', 'handler code must be string');
  assert.ok(!/ctx\.writeLabel/.test(code),
    'handle_slide_import_click must not use ctx.writeLabel for cross-cell write (Bucket C migration)');
  assert.ok(/V1N\.writeLabel\(/.test(code),
    'handle_slide_import_click must route cross-cell write via V1N.writeLabel(...)');
  return { key: 'bucket_c_handler_uses_write_label_req', status: 'PASS' };
}

function test_bucket_c_cell_routes_label_present() {
  const doc = JSON.parse(readFileSync(WORKSPACE_JSON, 'utf8'));
  const recs = Array.isArray(doc.records) ? doc.records : [];
  const label = findAddLabel(recs, { model_id: 1030, p: 0, r: 0, c: 0, k: 'bucket_c_cell_routes' });
  assert.ok(label, 'Model 1030 (0,0,0) must carry bucket_c_cell_routes label to aggregate Bucket C handler write_label_req sources');
  assert.equal(label.t, 'pin.connect.cell',
    'bucket_c_cell_routes label type must be pin.connect.cell (aggregate cross-cell routing)');
  assert.ok(Array.isArray(label.v) && label.v.length > 0,
    'bucket_c_cell_routes value must be a non-empty entries array');
  const hasImportClickEntry = label.v.some((entry) => {
    if (!entry || !Array.isArray(entry.from) || !Array.isArray(entry.to)) return false;
    const [p, r, c, pin] = entry.from;
    return p === 2 && r === 4 && c === 0 && pin === 'write_label_req' &&
      entry.to.some((target) => Array.isArray(target) &&
        target[0] === 0 && target[1] === 0 && target[2] === 0 && target[3] === 'mt_write_req');
  });
  assert.ok(hasImportClickEntry,
    'bucket_c_cell_routes must contain entry routing (2,4,0 write_label_req) -> (0,0,0 mt_write_req) for handle_slide_import_click');
  return { key: 'bucket_c_cell_routes_label_present', status: 'PASS' };
}

// ─── 动态契约（Dynamic: owner_materialize via server.mjs generator）──────────

async function test_owner_materialize_cross_cell_write_via_v1n_table() {
  const TEST_MODEL_ID = 9325;
  const src = readFileSync(SERVER_MJS, 'utf8');
  const code = evalCodeGenerator(src, 'genericOwnerMaterializeCode', TEST_MODEL_ID);

  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  const model = rt.createModel({ id: TEST_MODEL_ID, name: 'test_owner_materialize', type: 'test' });
  rt.addLabel(model, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'TestApp' });
  rt.addLabel(model, 0, 0, 0, { k: 'owner_materialize_req', t: 'pin.in', v: null });
  rt.addLabel(model, 0, 0, 0, {
    k: 'owner_materialize_wiring',
    t: 'pin.connect.label',
    v: [{ from: '(self, owner_materialize_req)', to: ['(func, owner_materialize:in)'] }],
  });
  rt.addLabel(model, 0, 0, 0, {
    k: 'owner_materialize',
    t: 'func.js',
    v: { code, modelName: 'owner_materialize' },
  });
  await rt.setRuntimeMode('running');

  const reqPayload = {
    request_id: 'req_0325c_test',
    target_model_id: TEST_MODEL_ID,
    op: 'apply_records',
    records: [{
      op: 'add_label',
      model_id: TEST_MODEL_ID,
      p: 2, r: 3, c: 0,
      k: 'target_k', t: 'str', v: 'from_owner_materialize',
    }],
  };
  rt.addLabel(model, 0, 0, 0, { k: 'owner_materialize_req', t: 'pin.in', v: ownerRequestPayload(reqPayload) });

  const targetLabel = await pollUntil(() => {
    const cell = rt.getCell(model, 2, 3, 0);
    return cell && cell.labels ? cell.labels.get('target_k') : null;
  });
  assert.ok(targetLabel,
    'target (2,3,0) target_k must be written by generated owner_materialize via V1N.table.addLabel');
  assert.equal(targetLabel.v, 'from_owner_materialize',
    'target_k.v must match the apply_records payload value');
  assert.equal(targetLabel.t, 'str',
    'target_k.t must match the apply_records payload type');
  return { key: 'owner_materialize_cross_cell_write_via_v1n_table', status: 'PASS' };
}

const tests = [
  test_owner_materialize_generator_no_ctx_api,
  test_owner_materialize_generator_uses_v1n_table,
  test_legacy_forward_funcs_no_runtime_pin_wiring,
  test_model100_owner_materialize_uses_v1n_table,
  test_bucket_c_handler_uses_write_label_req,
  test_bucket_c_cell_routes_label_present,
  test_owner_materialize_cross_cell_write_via_v1n_table,
];

(async () => {
  let passed = 0, failed = 0;
  for (const t of tests) {
    try {
      const r = await t();
      console.log(`[${r.status}] ${r.key}`);
      passed += 1;
    } catch (e) {
      console.log(`[FAIL] ${t.name}: ${e.message}`);
      failed += 1;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
  process.exit(failed > 0 ? 1 : 0);
})();
