import { createRequire } from 'node:module';
import assert from 'node:assert';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

const wait = () => new Promise((resolve) => setTimeout(resolve, 30));

function mt(k, t, v) {
  return [{ id: 0, p: 0, r: 0, c: 0, k, t, v }];
}

function latestReason(rt, reason) {
  return rt.eventLog._events.filter((event) => event.reason === reason).pop() || null;
}

function assertRejected(result, message) {
  assert(result && result.applied === false, message);
}

function test_removed_pin_connect_model_is_rejected() {
  const rt = new ModelTableRuntime();
  const model0 = rt.getModel(0);
  const result = rt.addLabel(model0, 0, 0, 0, {
    k: 'deleted_route',
    t: 'pin.connect.model',
    v: [{ from: [0, 'input'], to: [[1, 'input']] }],
  });
  assertRejected(result, 'pin.connect.model must be rejected, not accepted as a legacy route');
  assert(!model0.getCell(0, 0, 0).labels.has('deleted_route'), 'removed route label must not be stored');
  assert(latestReason(rt, 'label_type_removed'), 'rejection must be visible in eventLog');
  assert(!Object.prototype.hasOwnProperty.call(rt, 'modelConnectionRoutes'), 'runtime must not expose modelConnectionRoutes compatibility state');
  return { key: 'removed_pin_connect_model_is_rejected', status: 'PASS' };
}

async function test_direct_cell_connect_endpoints_execute_function() {
  const rt = new ModelTableRuntime();
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  const model = rt.createModel({ id: 9357, name: 'direct', type: 'table' });

  rt.addLabel(model, 1, 0, 0, {
    k: 'process',
    t: 'func.js',
    v: { code: "return [{ id: 0, p: 0, r: 0, c: 0, k: 'result_text', t: 'str', v: 'ok' }];" },
  });
  rt.addLabel(model, 1, 0, 0, { k: 'cmd', t: 'pin.in', v: null });
  rt.addLabel(model, 1, 0, 0, { k: 'result', t: 'pin.out', v: null });
  const result = rt.addLabel(model, 1, 0, 0, {
    k: 'direct_wiring',
    t: 'pin.connect.label',
    v: [
      { from: 'cmd', to: ['process:in'] },
      { from: 'process:out', to: ['result'] },
    ],
  });
  assert(result.applied, 'direct endpoint wiring must be accepted');

  rt.addLabel(model, 1, 0, 0, { k: 'cmd', t: 'pin.in', v: mt('input_text', 'str', 'run') });
  await wait();
  assert.deepEqual(model.getCell(1, 0, 0).labels.get('result')?.v, mt('result_text', 'str', 'ok'));
  return { key: 'direct_cell_connect_endpoints_execute_function', status: 'PASS' };
}

function test_prefix_cell_connect_endpoints_are_rejected() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 9358, name: 'prefix', type: 'table' });
  const result = rt.addLabel(model, 1, 0, 0, {
    k: 'legacy_wiring',
    t: 'pin.connect.label',
    v: [{ from: '(self, cmd)', to: ['(func, process:in)'] }],
  });
  assertRejected(result, 'prefix endpoint syntax must be rejected');
  assert(!rt.cellConnectGraph.has('9358|1|0|0'), 'legacy wiring must not register graph entries');
  assert(latestReason(rt, 'cell_connect_removed_endpoint_syntax'), 'prefix rejection must be recorded');
  return { key: 'prefix_cell_connect_endpoints_are_rejected', status: 'PASS' };
}

function test_numeric_cell_connect_endpoint_is_rejected() {
  const rt = new ModelTableRuntime();
  const parent = rt.getModel(0);
  rt.addLabel(parent, 1, 0, 0, { k: 'model_type', t: 'model.submt', v: 9360 });
  rt.addLabel(parent, 1, 0, 0, { k: 'cmd', t: 'pin.in', v: null });
  const result = rt.addLabel(parent, 1, 0, 0, {
    k: 'numeric_bridge',
    t: 'pin.connect.label',
    v: [{ from: 'cmd', to: ['(9360, input)'] }],
  });
  assertRejected(result, 'numeric endpoint syntax must be rejected');
  assert(latestReason(rt, 'cell_connect_removed_endpoint_syntax'), 'numeric prefix rejection must be recorded');
  return { key: 'numeric_cell_connect_endpoint_is_rejected', status: 'PASS' };
}

function test_cell_connection_rejects_function_endpoint() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 9361, name: 'cell-route', type: 'table' });
  rt.addLabel(model, 1, 0, 0, { k: 'process', t: 'func.js', v: { code: 'return label.v;' } });
  const result = rt.addLabel(model, 0, 0, 0, {
    k: 'bad_cell_route',
    t: 'pin.connect.cell',
    v: [{ from: [0, 0, 0, 'cmd'], to: [[1, 0, 0, 'process:in']] }],
  });
  assertRejected(result, 'pin.connect.cell must reject direct function endpoints');
  assert(!rt.cellConnectionRoutes.has('9361|0|0|0|cmd'), 'bad route must not be registered');
  assert(latestReason(rt, 'cell_connection_function_endpoint_forbidden'), 'function endpoint rejection must be recorded');
  return { key: 'cell_connection_rejects_function_endpoint', status: 'PASS' };
}

function test_cell_connection_rejects_function_shaped_endpoint_without_function() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 9366, name: 'cell-route-shape', type: 'table' });
  const result = rt.addLabel(model, 0, 0, 0, {
    k: 'bad_cell_route',
    t: 'pin.connect.cell',
    v: [{ from: [0, 0, 0, 'cmd'], to: [[1, 0, 0, 'missing:in']] }],
  });
  assertRejected(result, 'pin.connect.cell must reject function-shaped endpoints even when no function exists');
  assert(latestReason(rt, 'cell_connection_function_endpoint_forbidden'), 'function-shaped endpoint rejection must be recorded');
  return { key: 'cell_connection_rejects_function_shaped_endpoint_without_function', status: 'PASS' };
}

async function test_cell_connect_missing_function_is_visible_error() {
  const rt = new ModelTableRuntime();
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  const model = rt.createModel({ id: 9365, name: 'missing-cell-func', type: 'table' });
  rt.addLabel(model, 1, 0, 0, { k: 'cmd', t: 'pin.in', v: null });
  const wiring = rt.addLabel(model, 1, 0, 0, {
    k: 'missing_func_wiring',
    t: 'pin.connect.label',
    v: [{ from: 'cmd', to: ['missing:in'] }],
  });
  assert(wiring.applied, 'direct function endpoint syntax remains order-independent');
  rt.addLabel(model, 1, 0, 0, { k: 'cmd', t: 'pin.in', v: mt('input', 'str', 'run') });
  await wait();
  assert(latestReason(rt, 'cell_connect_function_missing'), 'missing same-cell function must be visible when triggered');
  return { key: 'cell_connect_missing_function_is_visible_error', status: 'PASS' };
}

function test_cell_connection_requires_declared_target_pin() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 9364, name: 'declared-target', type: 'table' });
  rt.addLabel(model, 0, 0, 0, { k: 'cmd', t: 'pin.in', v: null });
  rt.addLabel(model, 0, 0, 0, {
    k: 'bad_target_route',
    t: 'pin.connect.cell',
    v: [{ from: [0, 0, 0, 'cmd'], to: [[1, 0, 0, 'missing']] }],
  });
  rt.addLabel(model, 0, 0, 0, { k: 'cmd', t: 'pin.in', v: mt('request', 'str', 'run') });
  assert(!model.getCell(1, 0, 0).labels.has('missing'), 'runtime must not synthesize undeclared target pins');
  assert(latestReason(rt, 'cell_connection_target_pin_missing'), 'undeclared target pin rejection must be visible');
  return { key: 'cell_connection_requires_declared_target_pin', status: 'PASS' };
}

function test_pin_login_logout_replace_pin_log_family() {
  const rt = new ModelTableRuntime();
  const model = rt.createModel({ id: 9362, name: 'log', type: 'table' });
  const bad = rt.addLabel(model, 0, 0, 0, { k: 'old_log', t: 'pin.log.in', v: mt('message', 'str', 'old') });
  assertRejected(bad, 'pin.log.* must be rejected');
  assert(latestReason(rt, 'label_type_removed'), 'pin.log.* rejection must be visible');

  rt.addLabel(model, 1, 0, 0, { k: 'activity_log', t: 'pin.login', v: null });
  rt.addLabel(model, 0, 0, 0, {
    k: 'log_routes',
    t: 'pin.connect.cell',
    v: [{ from: [0, 0, 0, 'activity_log'], to: [[1, 0, 0, 'activity_log']] }],
  });
  const good = rt.addLabel(model, 0, 0, 0, { k: 'activity_log', t: 'pin.login', v: mt('message', 'str', 'new') });
  assert(good.applied, 'pin.login must be accepted');
  assert.deepEqual(model.getCell(1, 0, 0).labels.get('activity_log')?.v, mt('message', 'str', 'new'));
  return { key: 'pin_login_logout_replace_pin_log_family', status: 'PASS' };
}

async function test_submodel_boundary_bridge_replaces_numeric_prefix() {
  const rt = new ModelTableRuntime();
  const parent = rt.getModel(0);
  rt.addLabel(parent, 2, 0, 0, { k: 'model_type', t: 'model.submt', v: 9363 });
  rt.addLabel(parent, 2, 0, 0, { k: 'submit', t: 'pin.in', v: null });
  rt.addLabel(parent, 2, 0, 0, { k: 'result', t: 'pin.out', v: null });
  rt.addLabel(parent, 0, 0, 0, {
    k: 'host_routes',
    t: 'pin.connect.cell',
    v: [
      { from: [0, 0, 0, 'ui_submit'], to: [[2, 0, 0, 'submit']] },
      { from: [2, 0, 0, 'result'], to: [[0, 0, 0, 'ui_result']] },
    ],
  });
  rt.addLabel(parent, 0, 0, 0, { k: 'ui_submit', t: 'pin.bus.cb.in', v: null });
  rt.addLabel(parent, 0, 0, 0, { k: 'ui_result', t: 'pin.out', v: null });

  const child = rt.getModel(9363);
  rt.addLabel(child, 0, 0, 0, { k: 'submit', t: 'pin.in', v: null });
  rt.addLabel(child, 0, 0, 0, { k: 'result', t: 'pin.out', v: null });
  rt.addLabel(child, 0, 0, 0, {
    k: 'child_routes',
    t: 'pin.connect.cell',
    v: [
      { from: [0, 0, 0, 'submit'], to: [[1, 0, 0, 'cmd']] },
      { from: [1, 0, 0, 'done'], to: [[0, 0, 0, 'result']] },
    ],
  });
  rt.addLabel(child, 1, 0, 0, {
    k: 'worker',
    t: 'func.js',
    v: { code: "return [{ id: 0, p: 0, r: 0, c: 0, k: 'reply', t: 'str', v: 'pong' }];" },
  });
  rt.addLabel(child, 1, 0, 0, { k: 'cmd', t: 'pin.in', v: null });
  rt.addLabel(child, 1, 0, 0, { k: 'done', t: 'pin.out', v: null });
  rt.addLabel(child, 1, 0, 0, {
    k: 'worker_wiring',
    t: 'pin.connect.label',
    v: [{ from: 'cmd', to: ['worker:in'] }, { from: 'worker:out', to: ['done'] }],
  });

  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  const payload = mt('request', 'str', 'ping');
  rt.addLabel(parent, 0, 0, 0, { k: 'ui_submit', t: 'pin.bus.cb.in', v: payload });
  await wait();
  assert.deepEqual(child.getCell(0, 0, 0).labels.get('submit')?.v, payload, 'host pin.in must forward to child root');
  assert.deepEqual(parent.getCell(0, 0, 0).labels.get('ui_result')?.v, mt('reply', 'str', 'pong'), 'child root pin.out must return through host pin.out and parent cell route');
  return { key: 'submodel_boundary_bridge_replaces_numeric_prefix', status: 'PASS' };
}

const tests = [
  test_removed_pin_connect_model_is_rejected,
  test_direct_cell_connect_endpoints_execute_function,
  test_prefix_cell_connect_endpoints_are_rejected,
  test_numeric_cell_connect_endpoint_is_rejected,
  test_cell_connection_rejects_function_endpoint,
  test_cell_connection_rejects_function_shaped_endpoint_without_function,
  test_cell_connect_missing_function_is_visible_error,
  test_cell_connection_requires_declared_target_pin,
  test_pin_login_logout_replace_pin_log_family,
  test_submodel_boundary_bridge_replaces_numeric_prefix,
];

for (const test of tests) {
  const result = await test();
  console.log(`${result.key}: ${result.status}`);
}
