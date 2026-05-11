import { createRequire } from 'node:module';
import { buildWorkerHostApi, loadSystemPatch } from './worker_engine_v0.mjs';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../packages/worker-base/src/runtime.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--case');
  return idx === -1 ? 'all' : args[idx + 1];
}

function createRuntimeWithSystem() {
  const rt = new ModelTableRuntime();
  loadSystemPatch(rt);
  return rt;
}

function getFunctionCode(rt, name) {
  const sys = rt.getModel(-10);
  if (!sys) return null;
  const label = rt.getCell(sys, 0, 0, 0).labels.get(name);
  if (!label) return null;
  if (typeof label.v === 'string') return label.v;
  if (label.v && typeof label.v === 'object' && typeof label.v.code === 'string') return label.v.code;
  return null;
}

function runIntentDispatchOnce(rt) {
  const code = getFunctionCode(rt, 'intent_dispatch');
  assert(code, 'missing_intent_dispatch_function');
  const fn = new Function('ctx', code);
  fn({ runtime: rt, hostApi: buildWorkerHostApi(rt) });
}

function enqueueJob(rt, id, action, extra = {}) {
  const sys = rt.getModel(-10);
  assert(sys, 'system_model_missing');
  rt.createModel({ id, name: 'source', type: 'data' });
  rt.addLabel(sys, 0, 0, 0, {
    k: 'intent_job_' + id,
    t: 'json',
    v: {
      source: { model_id: id, p: 0, r: 0, c: 0, k: 'intent.v0' },
      intent: Object.assign({ op_id: 'op-' + id, action }, extra),
    },
  });
}

function assertRemovedAction(rt, sourceModelId, action) {
  const source = rt.getModel(sourceModelId);
  const result = rt.getCell(source, 0, 0, 0).labels.get('intent_result');
  assert(result && result.t === 'json', action + ' should write intent_result');
  assert(result.v && result.v.result === 'error', action + ' should fail closed');
  assert(result.v.code === 'removed_action', action + ' should be removed');
  const sys = rt.getModel(-10);
  for (const cell of sys.cells.values()) {
    for (const label of cell.labels.values()) {
      assert(label.t !== 'pin.bus.mb.out' || label.v == null, action + ' must not emit bus output');
    }
  }
}

function output(results) {
  console.log('VALIDATION RESULTS');
  for (const row of results) console.log(row.key + ': ' + row.status);
}

function casePutActionRemoved() {
  const rt = createRuntimeWithSystem();
  enqueueJob(rt, 1, 'mgmt_put_mbr_v0', { cell_k: 'pageA.submitA1', t: 'json', v: { hello: 1 } });
  runIntentDispatchOnce(rt);
  assertRemovedAction(rt, 1, 'mgmt_put_mbr_v0');
  return { key: 'mgmt_put_mbr_v0_removed', status: 'PASS' };
}

function caseBindActionRemoved() {
  const rt = createRuntimeWithSystem();
  enqueueJob(rt, 2, 'mgmt_bind_in', { channel: 'pageA.textA1', target_ref: { model_id: 2, p: 0, r: 0, c: 0, k: 'pageA.textA1' } });
  runIntentDispatchOnce(rt);
  assertRemovedAction(rt, 2, 'mgmt_bind_in');
  return { key: 'mgmt_bind_in_removed', status: 'PASS' };
}

try {
  const which = parseArgs();
  let results;
  if (which === 'mgmt_put_mbr_v0') results = [casePutActionRemoved()];
  else if (which === 'mgmt_bind_in') results = [caseBindActionRemoved()];
  else results = [casePutActionRemoved(), caseBindActionRemoved()];
  output(results);
} catch (err) {
  console.error('VALIDATION FAILED');
  console.error(err && err.message ? err.message : String(err));
  process.exit(1);
}
