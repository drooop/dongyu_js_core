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

function createIsolatedRuntime() {
  const rt = new ModelTableRuntime();
  rt.eventLog.reset();
  rt.intercepts.reset();
  return rt;
}

function activateRuntime(rt) {
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
}

function runValidation() {
  const results = [];

  // local_mqtt
  {
    const rt = createIsolatedRuntime();
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
    const rt = createIsolatedRuntime();
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
    const rt = createIsolatedRuntime();
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
    const rt = createIsolatedRuntime();
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
    const rt = createIsolatedRuntime();
    const root = rt.getModel(0);
    rt.addLabel(root, 0, 0, 0, { k: 'v1n_id', t: 'str', v: 'A' });
    rt.addLabel(root, 0, 0, 0, { k: 'v1n_id', t: 'str', v: 'B' });
    const events = rt.eventLog.list();
    const second = events[1];
    assert(second.result === 'rejected', 'v1n_id: second rejected');
    assert(second.reason === 'v1n_id_locked', 'v1n_id: reason locked');
    results.push({ key: 'v1n_id', status: 'PASS' });
  }

  // pin.connect.label
  {
    const rt = createIsolatedRuntime();
    const model = rt.createModel({ id: 100, name: 'ConnectLabel', type: 'ui' });
    rt.addLabel(model, 1, 0, 0, {
      k: 'wiring',
      t: 'pin.connect.label',
      v: [{ from: '(self, cmd)', to: ['(func, demo:in)'] }],
    });
    const cellKey = '100|1|0|0';
    assert(rt.cellConnectGraph.has(cellKey), 'pin.connect.label: graph should be registered');
    const graph = rt.cellConnectGraph.get(cellKey);
    assert(graph.has('self:cmd'), 'pin.connect.label: self:cmd route missing');
    results.push({ key: 'pin.connect.label', status: 'PASS' });
  }

  // pin.connect.cell
  {
    const rt = createIsolatedRuntime();
    const model = rt.createModel({ id: 101, name: 'ConnectCell', type: 'ui' });
    rt.addLabel(model, 0, 0, 0, {
      k: 'routing',
      t: 'pin.connect.cell',
      v: [{ from: [0, 0, 0, 'event'], to: [[1, 0, 0, 'event']] }],
    });
    const routeKey = '101|0|0|0|event';
    assert(rt.cellConnectionRoutes.has(routeKey), 'pin.connect.cell: route should be registered');
    results.push({ key: 'pin.connect.cell', status: 'PASS' });
  }

  // pin.connect.model
  {
    const rt = createIsolatedRuntime();
    const root = rt.getModel(0);
    rt.addLabel(root, 0, 0, 0, {
      k: 'bus_to_model',
      t: 'pin.connect.model',
      v: [{ from: [0, 'event'], to: [[200, 'input']] }],
    });
    const routeKey = '0|event';
    assert(rt.modelConnectionRoutes.has(routeKey), 'pin.connect.model: route should be registered');
    results.push({ key: 'pin.connect.model', status: 'PASS' });
  }

  // run_<func> registered
  {
    const rt = createIsolatedRuntime();
    activateRuntime(rt);
    const root = rt.getModel(0);
    root.registerFunction('func1');
    rt.addLabel(root, 0, 0, 0, { k: 'run_func1', t: 'run', v: 'x' });
    const intercepts = rt.intercepts.list();
    assert(intercepts.length === 1 && intercepts[0].type === 'run_func', 'run_func1: intercept');
    results.push({ key: 'run_<func> (registered)', status: 'PASS' });
  }

  // run_<func> missing
  {
    const rt = createIsolatedRuntime();
    activateRuntime(rt);
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
