import assert from 'node:assert';
import fs from 'node:fs';

function read(relPath) {
  return fs.readFileSync(new URL(`../../${relPath}`, import.meta.url), 'utf8');
}

function test_active_modeltables_do_not_use_legacy_pin_types() {
  const files = [
    'packages/worker-base/system-models/test_model_100_ui.json',
    'packages/worker-base/system-models/workspace_positive_models.json',
  ];

  for (const file of files) {
    const src = read(file);
    assert(!src.includes('"t": "PIN_IN"'), `${file} should not contain PIN_IN`);
    assert(!src.includes('"t": "PIN_OUT"'), `${file} should not contain PIN_OUT`);
  }

  return { key: 'active_modeltables_do_not_use_legacy_pin_types', status: 'PASS' };
}

function test_model100_patch_handler_uses_pin_in() {
  const src = read('packages/worker-base/system-models/test_model_100_ui.json');
  assert(!src.includes("inLabel.t !== 'IN'"), 'test_model_100_ui patch handler should not check legacy IN');
  assert(src.includes("inLabel.t !== 'pin.in'"), 'test_model_100_ui patch handler should check pin.in');
  return { key: 'model100_patch_handler_uses_pin_in', status: 'PASS' };
}

function test_server_dual_bus_route_uses_model_input_type() {
  const src = read('packages/ui-model-demo-server/server.mjs');
  assert(!src.includes("{ k: pinName, t: 'IN', v: patch }"), 'server should not write legacy IN during dual-bus patch routing');
  assert(src.includes('_modelInputLabelType(targetModel)'), 'server should resolve model input type from runtime');
  return { key: 'server_dual_bus_route_uses_model_input_type', status: 'PASS' };
}

function test_remote_worker_v0_declaration_uses_new_pin_types() {
  const src = read('scripts/run_worker_remote_v0.mjs');
  assert(!src.includes("t: 'PIN_IN'"), 'run_worker_remote_v0 should not declare PIN_IN');
  assert(!src.includes("t: 'PIN_OUT'"), 'run_worker_remote_v0 should not declare PIN_OUT');
  assert(src.includes("t: 'pin.in'"), 'run_worker_remote_v0 should use pin.in for mailbox input');
  assert(src.includes("t: 'pin.out'"), 'run_worker_remote_v0 should use pin.out for mailbox output');
  return { key: 'remote_worker_v0_declaration_uses_new_pin_types', status: 'PASS' };
}

const tests = [
  test_active_modeltables_do_not_use_legacy_pin_types,
  test_model100_patch_handler_uses_pin_in,
  test_server_dual_bus_route_uses_model_input_type,
  test_remote_worker_v0_declaration_uses_new_pin_types,
];

let passed = 0;
let failed = 0;

for (const testFn of tests) {
  try {
    const result = testFn();
    console.log(`[${result.status}] ${result.key}`);
    passed += 1;
  } catch (err) {
    console.log(`[FAIL] ${testFn.name}: ${err.message}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
