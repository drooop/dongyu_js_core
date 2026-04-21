#!/usr/bin/env node
// 0325c Step 3.5 Stage 2 — Cross-Model hostApi contract tests (TDD red → green).
// Verifies the 4 new runtime.hostApi methods mandated by rubric R2/R3/R14/R17/R22:
//   writeCrossModel(modelId, p, r, c, k, t, v) -> {ok, code?, detail?}
//   readCrossModel(modelId, p, r, c, k)         -> {ok, code?, detail?, data?}
//   rmCrossModel(modelId, p, r, c, k)           -> {ok, code?, detail?}
//   setMqttTargetConfig(host, port, clientId)   -> {ok, code?, detail?}
// Error codes per R18: invalid_target / invalid_target_white_list / invalid_dynamic_target
//                      / model_not_found / invalid_label_key / invalid_label_type
// Style per R22: 签名错误统一 return {ok:false}, 不 throw.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');
const { buildCrossModelHostApiMethods } = await import('../../packages/ui-model-demo-server/server.mjs');

function makeRuntime() {
  const rt = new ModelTableRuntime();
  // Positive model (has mt_write via default scaffold)
  const m100 = rt.createModel({ id: 100, name: 'test_positive', type: 'test' });
  rt.addLabel(m100, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'TestApp' });
  rt.addLabel(m100, 1, 2, 0, { k: 'existing_label', t: 'str', v: 'existing_value' });
  // UI mailbox model (-1)
  const mMinus1 = rt.createModel({ id: -1, name: 'ui_mailbox', type: 'system' });
  rt.addLabel(mMinus1, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'UI.Mailbox' });
  // State projection model (-2)
  const mMinus2 = rt.createModel({ id: -2, name: 'state_projection', type: 'system' });
  rt.addLabel(mMinus2, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'UI.State' });
  // Host capability system model (-10)
  const mMinus10 = rt.createModel({ id: -10, name: 'system_capability', type: 'system' });
  rt.addLabel(mMinus10, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'System.Capability' });
  return rt;
}

function buildApi(rt) {
  return buildCrossModelHostApiMethods(rt);
}

// ─── writeCrossModel ─────────────────────────────────────────────

function test_writeCrossModel_positive_model_ok() {
  const rt = makeRuntime();
  const api = buildApi(rt);
  const r = api.writeCrossModel(100, 0, 0, 0, 'foo', 'str', 'bar');
  assert.ok(r && r.ok === true, `expected ok:true, got ${JSON.stringify(r)}`);
  const label = rt.getCell(rt.getModel(100), 0, 0, 0).labels.get('foo');
  assert.ok(label, 'label must be written');
  assert.equal(label.v, 'bar');
  return { key: 'writeCrossModel_positive_model_ok', status: 'PASS' };
}

function test_writeCrossModel_ui_mailbox_ok() {
  const rt = makeRuntime();
  const api = buildApi(rt);
  const r = api.writeCrossModel(-1, 0, 0, 1, 'ui_event_error', 'json', { code: 'x' });
  assert.ok(r.ok === true, `ui mailbox write should ok, got ${JSON.stringify(r)}`);
  return { key: 'writeCrossModel_ui_mailbox_ok', status: 'PASS' };
}

function test_writeCrossModel_state_projection_ok() {
  const rt = makeRuntime();
  const api = buildApi(rt);
  const r = api.writeCrossModel(-2, 0, 0, 0, 'ws_app_selected', 'int', 1036);
  assert.ok(r.ok === true, `state projection write should ok, got ${JSON.stringify(r)}`);
  return { key: 'writeCrossModel_state_projection_ok', status: 'PASS' };
}

function test_writeCrossModel_invalid_target_nonint_returns_false() {
  const rt = makeRuntime();
  const api = buildApi(rt);
  const r = api.writeCrossModel(null, 0, 0, 0, 'k', 'str', 'v');
  assert.ok(r && r.ok === false && r.code === 'invalid_target',
    `expected ok:false code:invalid_target, got ${JSON.stringify(r)}`);
  return { key: 'writeCrossModel_invalid_target_nonint', status: 'PASS' };
}

function test_writeCrossModel_model_not_found_returns_false() {
  const rt = makeRuntime();
  const api = buildApi(rt);
  const r = api.writeCrossModel(999999, 0, 0, 0, 'k', 'str', 'v');
  assert.ok(r.ok === false && r.code === 'model_not_found',
    `expected model_not_found, got ${JSON.stringify(r)}`);
  return { key: 'writeCrossModel_model_not_found', status: 'PASS' };
}

function test_writeCrossModel_whitelist_reject() {
  const rt = makeRuntime();
  const api = buildApi(rt);
  // Model -10 (1,0,0) is NOT in whitelist (negative model non-root cell)
  const r = api.writeCrossModel(-10, 1, 0, 0, 'k', 'str', 'v');
  assert.ok(r.ok === false && r.code === 'invalid_target_white_list',
    `expected whitelist reject, got ${JSON.stringify(r)}`);
  return { key: 'writeCrossModel_whitelist_reject', status: 'PASS' };
}

function test_writeCrossModel_invalid_label_key_returns_false() {
  const rt = makeRuntime();
  const api = buildApi(rt);
  const r = api.writeCrossModel(100, 0, 0, 0, '', 'str', 'v');
  assert.ok(r.ok === false && r.code === 'invalid_label_key',
    `expected invalid_label_key, got ${JSON.stringify(r)}`);
  return { key: 'writeCrossModel_invalid_label_key', status: 'PASS' };
}

function test_writeCrossModel_invalid_label_type_returns_false() {
  const rt = makeRuntime();
  const api = buildApi(rt);
  const r = api.writeCrossModel(100, 0, 0, 0, 'k', '', 'v');
  assert.ok(r.ok === false && r.code === 'invalid_label_type',
    `expected invalid_label_type, got ${JSON.stringify(r)}`);
  return { key: 'writeCrossModel_invalid_label_type', status: 'PASS' };
}

// ─── readCrossModel ──────────────────────────────────────────────

function test_readCrossModel_existing_returns_data() {
  const rt = makeRuntime();
  const api = buildApi(rt);
  const r = api.readCrossModel(100, 1, 2, 0, 'existing_label');
  assert.ok(r.ok === true, `expected ok:true, got ${JSON.stringify(r)}`);
  assert.ok(r.data && r.data.t === 'str' && r.data.v === 'existing_value',
    `expected data:{t,v}, got ${JSON.stringify(r.data)}`);
  return { key: 'readCrossModel_existing_returns_data', status: 'PASS' };
}

function test_readCrossModel_missing_returns_null_data() {
  const rt = makeRuntime();
  const api = buildApi(rt);
  const r = api.readCrossModel(100, 5, 5, 5, 'does_not_exist');
  assert.ok(r.ok === true && r.data === null,
    `expected ok:true data:null, got ${JSON.stringify(r)}`);
  return { key: 'readCrossModel_missing_returns_null_data', status: 'PASS' };
}

function test_readCrossModel_invalid_target() {
  const rt = makeRuntime();
  const api = buildApi(rt);
  const r = api.readCrossModel('bogus', 0, 0, 0, 'k');
  assert.ok(r.ok === false && r.code === 'invalid_target',
    `expected invalid_target, got ${JSON.stringify(r)}`);
  return { key: 'readCrossModel_invalid_target', status: 'PASS' };
}

// ─── rmCrossModel ────────────────────────────────────────────────

function test_rmCrossModel_existing_ok() {
  const rt = makeRuntime();
  const api = buildApi(rt);
  const r = api.rmCrossModel(100, 1, 2, 0, 'existing_label');
  assert.ok(r.ok === true, `expected ok:true, got ${JSON.stringify(r)}`);
  const label = rt.getCell(rt.getModel(100), 1, 2, 0).labels.get('existing_label');
  assert.ok(!label, 'label must be removed');
  return { key: 'rmCrossModel_existing_ok', status: 'PASS' };
}

function test_rmCrossModel_invalid_target() {
  const rt = makeRuntime();
  const api = buildApi(rt);
  const r = api.rmCrossModel(null, 0, 0, 0, 'k');
  assert.ok(r.ok === false && r.code === 'invalid_target',
    `expected invalid_target, got ${JSON.stringify(r)}`);
  return { key: 'rmCrossModel_invalid_target', status: 'PASS' };
}

// ─── setMqttTargetConfig ─────────────────────────────────────────

function test_setMqttTargetConfig_ok() {
  const rt = makeRuntime();
  // Model 0 needed for mqtt config target
  const m0 = rt.createModel({ id: 0, name: 'root', type: 'root' });
  rt.addLabel(m0, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'Root' });
  const api = buildApi(rt);
  const r = api.setMqttTargetConfig('mqtt.example.com', 1883, 'client_abc');
  assert.ok(r.ok === true, `expected ok:true, got ${JSON.stringify(r)}`);
  const host = rt.getCell(rt.getModel(0), 0, 0, 0).labels.get('mqtt_target_host');
  const port = rt.getCell(rt.getModel(0), 0, 0, 0).labels.get('mqtt_target_port');
  const cid = rt.getCell(rt.getModel(0), 0, 0, 0).labels.get('mqtt_target_client_id');
  assert.equal(host?.v, 'mqtt.example.com');
  assert.equal(port?.v, 1883);
  assert.equal(cid?.v, 'client_abc');
  return { key: 'setMqttTargetConfig_ok', status: 'PASS' };
}

function test_setMqttTargetConfig_invalid_port() {
  const rt = makeRuntime();
  const m0 = rt.createModel({ id: 0, name: 'root', type: 'root' });
  rt.addLabel(m0, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'Root' });
  const api = buildApi(rt);
  const r = api.setMqttTargetConfig('mqtt.example.com', 'not_a_number', 'client_abc');
  assert.ok(r.ok === false && /invalid/.test(r.code || ''),
    `expected ok:false invalid code, got ${JSON.stringify(r)}`);
  return { key: 'setMqttTargetConfig_invalid_port', status: 'PASS' };
}

const tests = [
  test_writeCrossModel_positive_model_ok,
  test_writeCrossModel_ui_mailbox_ok,
  test_writeCrossModel_state_projection_ok,
  test_writeCrossModel_invalid_target_nonint_returns_false,
  test_writeCrossModel_model_not_found_returns_false,
  test_writeCrossModel_whitelist_reject,
  test_writeCrossModel_invalid_label_key_returns_false,
  test_writeCrossModel_invalid_label_type_returns_false,
  test_readCrossModel_existing_returns_data,
  test_readCrossModel_missing_returns_null_data,
  test_readCrossModel_invalid_target,
  test_rmCrossModel_existing_ok,
  test_rmCrossModel_invalid_target,
  test_setMqttTargetConfig_ok,
  test_setMqttTargetConfig_invalid_port,
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
