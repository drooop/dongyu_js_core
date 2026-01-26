import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../packages/worker-base/src/runtime.js');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function summary(result) {
  return result.map((row) => `${row.key}: ${row.status}`).join('\n');
}

function runValidation() {
  const results = [];

  // local_mqtt
  {
    const rt = new ModelTableRuntime();
    const root = rt.getModel(0);
    rt.addLabel(root, 0, 0, 0, { k: 'local_mqtt', t: 'str', v: '127.0.0.1' });
    const events = rt.eventLog.list();
    assert(events.length === 1, 'local_mqtt: expected 1 event');
    assert(events[0].op === 'add_label', 'local_mqtt: event op');
    assert(rt.v1nConfig.local_mqtt === '127.0.0.1', 'local_mqtt: config updated');
    results.push({ key: 'local_mqtt', status: 'PASS' });
  }

  // global_mqtt
  {
    const rt = new ModelTableRuntime();
    const root = rt.getModel(0);
    rt.addLabel(root, 0, 0, 0, { k: 'global_mqtt', t: 'str', v: '10.0.0.1' });
    const events = rt.eventLog.list();
    assert(events.length === 1, 'global_mqtt: expected 1 event');
    assert(events[0].op === 'add_label', 'global_mqtt: event op');
    assert(rt.v1nConfig.global_mqtt === '10.0.0.1', 'global_mqtt: config updated');
    results.push({ key: 'global_mqtt', status: 'PASS' });
  }

  // model_type
  {
    const rt = new ModelTableRuntime();
    const root = rt.getModel(0);
    rt.addLabel(root, 0, 0, 0, { k: 'model_type', t: 'str', v: 'main' });
    const events = rt.eventLog.list();
    assert(events.length === 1, 'model_type: expected 1 event');
    assert(events[0].label.k === 'model_type', 'model_type: label key');
    const intercepts = rt.intercepts.list();
    assert(intercepts.length === 0, 'model_type: no extra intercepts');
    results.push({ key: 'model_type', status: 'PASS' });
  }

  // data_type (first definition order)
  {
    const rt = new ModelTableRuntime();
    const dataModel = rt.createModel({ id: 1, name: 'Data', type: 'Data' });
    rt.addLabel(dataModel, 0, 0, 0, { k: 'CELL_CONNECT', t: 'connect', v: {} });
    rt.eventLog.reset();
    rt.intercepts.reset();
    rt.addLabel(dataModel, 0, 0, 0, { k: 'data_type', t: 'str', v: 'Record' });
    const events = rt.eventLog.list();
    assert(events.length === 2, 'data_type: expected add_label + rm_label');
    assert(events[0].op === 'add_label', 'data_type: first add_label');
    assert(events[1].op === 'rm_label', 'data_type: second rm_label');
    assert(events[1].label.k === 'CELL_CONNECT', 'data_type: rm_label CELL_CONNECT');
    const intercepts = rt.intercepts.list();
    assert(intercepts.length === 1 && intercepts[0].type === 'init_type', 'data_type: init_type intercept');
    results.push({ key: 'data_type', status: 'PASS' });
  }

  // v1n_id lock
  {
    const rt = new ModelTableRuntime();
    const root = rt.getModel(0);
    rt.addLabel(root, 0, 0, 0, { k: 'v1n_id', t: 'str', v: 'A' });
    rt.addLabel(root, 0, 0, 0, { k: 'v1n_id', t: 'str', v: 'B' });
    const events = rt.eventLog.list();
    const second = events[1];
    assert(second.result === 'rejected', 'v1n_id: second rejected');
    assert(second.reason === 'v1n_id_locked', 'v1n_id: reason locked');
    results.push({ key: 'v1n_id', status: 'PASS' });
  }

  // CELL_CONNECT
  {
    const rt = new ModelTableRuntime();
    const root = rt.getModel(0);
    rt.addLabel(root, 0, 0, 0, { k: 'CELL_CONNECT', t: 'connect', v: {} });
    const intercepts = rt.intercepts.list();
    assert(intercepts.length === 1 && intercepts[0].payload.scope === 'cell', 'CELL_CONNECT: intercept');
    results.push({ key: 'CELL_CONNECT', status: 'PASS' });
  }

  // MODEL_CONNECT
  {
    const rt = new ModelTableRuntime();
    const root = rt.getModel(0);
    rt.addLabel(root, 0, 0, 0, { k: 'MODEL_CONNECT', t: 'connect', v: {} });
    const intercepts = rt.intercepts.list();
    assert(intercepts.length === 1 && intercepts[0].payload.scope === 'model', 'MODEL_CONNECT: intercept');
    results.push({ key: 'MODEL_CONNECT', status: 'PASS' });
  }

  // V1N_CONNECT
  {
    const rt = new ModelTableRuntime();
    const root = rt.getModel(0);
    rt.addLabel(root, 0, 0, 0, { k: 'V1N_CONNECT', t: 'connect', v: {} });
    const intercepts = rt.intercepts.list();
    assert(intercepts.length === 1 && intercepts[0].payload.scope === 'v1n', 'V1N_CONNECT: intercept');
    results.push({ key: 'V1N_CONNECT', status: 'PASS' });
  }

  // run_<func> registered
  {
    const rt = new ModelTableRuntime();
    const root = rt.getModel(0);
    root.registerFunction('func1');
    rt.addLabel(root, 0, 0, 0, { k: 'run_func1', t: 'run', v: 'x' });
    const intercepts = rt.intercepts.list();
    assert(intercepts.length === 1 && intercepts[0].type === 'run_func', 'run_func1: intercept');
    results.push({ key: 'run_<func> (registered)', status: 'PASS' });
  }

  // run_<func> missing
  {
    const rt = new ModelTableRuntime();
    const root = rt.getModel(0);
    rt.addLabel(root, 0, 0, 0, { k: 'run_missing', t: 'run', v: 'x' });
    const events = rt.eventLog.list();
    const errorEvent = events.find((e) => e.op === 'error');
    assert(errorEvent, 'run_missing: error event required');
    assert(errorEvent.reason === 'func_not_found', 'run_missing: reason func_not_found');
    results.push({ key: 'run_<func> (missing)', status: 'PASS' });
  }

  return results;
}

try {
  const results = runValidation();
  console.log('VALIDATION RESULTS');
  console.log(summary(results));
  process.exit(0);
} catch (err) {
  console.error('VALIDATION FAILED');
  console.error(err.message);
  process.exit(1);
}
