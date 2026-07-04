import { createRequire } from 'node:module';
import assert from 'node:assert';
const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

function test_submodel_register() {
  const rt = new ModelTableRuntime();
  const model0 = rt.getModel(0);
  rt.addLabel(model0, 1, 0, 0, { k: 'model_type', t: 'model.submtconnection', v: { model_id: 100, mount_kind: 'test_sub' } });
  const info = rt.parentChildMap.get('host|100');
  assert(info, 'should register in parentChildMap');
  assert.strictEqual(info.parent.model_id, 0);
  assert.deepStrictEqual(info.hostingCell, { p: 1, r: 0, c: 0 });
  const childModel = rt.getModel(100);
  assert(childModel, 'should auto-create child model');
  assert.strictEqual(childModel.name, '100');
  assert.strictEqual(childModel.type, 'sub');
  return { key: 'submodel_register', status: 'PASS' };
}

function test_submodel_no_duplicate_create() {
  const rt = new ModelTableRuntime();
  const model0 = rt.getModel(0);
  // Pre-create child
  rt.createModel({ id: 200, name: 'existing', type: 'app' });
  rt.addLabel(model0, 2, 0, 0, { k: 'model_type', t: 'model.submtconnection', v: { model_id: 200, mount_kind: 'sub200' } });
  const childModel = rt.getModel(200);
  assert(childModel, 'should exist');
  // Should keep original model, not overwrite
  assert.strictEqual(childModel.name, 'existing');
  assert.strictEqual(childModel.type, 'app');
  return { key: 'submodel_no_duplicate_create', status: 'PASS' };
}

function test_submodel_invalid_id() {
  const rt = new ModelTableRuntime();
  const model0 = rt.getModel(0);
  rt.addLabel(model0, 0, 0, 0, { k: 'model_type', t: 'model.submtconnection', v: {} });
  const errors = rt.eventLog._events.filter((e) => e.reason === 'submtconnection_invalid_model_id');
  assert(errors.length >= 1, 'should record error for invalid id');
  return { key: 'submodel_invalid_id', status: 'PASS' };
}

function test_parent_child_map_query() {
  const rt = new ModelTableRuntime();
  const parent = rt.createModel({ id: 50, name: 'parent', type: 'app' });
  rt.addLabel(parent, 3, 1, 0, { k: 'model_type', t: 'model.submtconnection', v: { model_id: 51, mount_kind: 'child' } });
  rt.addLabel(parent, 3, 2, 0, { k: 'model_type', t: 'model.submtconnection', v: { model_id: 52, mount_kind: 'child2' } });
  const info51 = rt.parentChildMap.get('host|51');
  const info52 = rt.parentChildMap.get('host|52');
  assert(info51, 'should have child 51');
  assert.strictEqual(info51.parent.model_id, 50);
  assert.deepStrictEqual(info51.hostingCell, { p: 3, r: 1, c: 0 });
  assert(info52, 'should have child 52');
  assert.deepStrictEqual(info52.hostingCell, { p: 3, r: 2, c: 0 });
  return { key: 'parent_child_map_query', status: 'PASS' };
}

// --- Run all tests ---
const tests = [
  test_submodel_register,
  test_submodel_no_duplicate_create,
  test_submodel_invalid_id,
  test_parent_child_map_query,
];

let passed = 0;
let failed = 0;
for (const t of tests) {
  try {
    const r = t();
    console.log(`[${r.status}] ${r.key}`);
    passed += 1;
  } catch (err) {
    console.log(`[FAIL] ${t.name}: ${err.message}`);
    failed += 1;
  }
}
console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
