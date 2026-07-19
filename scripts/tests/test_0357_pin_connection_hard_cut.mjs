import { createRequire } from 'node:module';
import assert from 'node:assert';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');
const { ModelTableRuntime: ModelTableRuntimeEsm } = await import('../../packages/worker-base/src/runtime.mjs');

const runtimeEntrypoints = [
  { name: 'cjs', Runtime: ModelTableRuntime },
  { name: 'esm', Runtime: ModelTableRuntimeEsm },
];

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

function stableRouteState(rt) {
  return {
    ...stableConnectionGraphState(rt),
    busInPorts: Array.from(rt.busInPorts.entries()),
    busOutPorts: Array.from(rt.busOutPorts.entries()),
  };
}

function stableConnectionGraphState(rt) {
  return {
    cellConnectGraph: Array.from(rt.cellConnectGraph.entries(), ([cellKey, routes]) => [
      cellKey,
      Array.from(routes.entries(), ([endpoint, targets]) => [endpoint, structuredClone(targets)]),
    ]),
    cellConnectionRoutes: Array.from(rt.cellConnectionRoutes.entries(), ([routeKey, targets]) => [
      routeKey,
      structuredClone(targets),
    ]),
  };
}

function stableLabelState(model, excludedKey = null) {
  return Array.from(model.cells.entries(), ([cellKey, cell]) => [
    cellKey,
    Array.from(cell.labels.entries())
      .filter(([key]) => key !== excludedKey)
      .map(([key, label]) => [key, structuredClone(label)]),
  ]);
}

function persistenceSpy() {
  const added = [];
  return {
    added,
    ensureModel() {},
    onLabelAdded({ model, p, r, c, label }) {
      added.push({ model_id: model.id, p, r, c, label: structuredClone(label) });
    },
  };
}

function createDemRuntime(Runtime) {
  const rt = new Runtime();
  const model0 = rt.getModel(0);
  const role = rt.addLabel(model0, 0, 0, 0, {
    k: 'sys_worker_role',
    t: 'worker.role',
    v: 'DEM',
  });
  assert(role.applied, 'direction fixture requires a valid DEM worker root');
  return { rt, model0 };
}

function directionFixture(connectionType, busRole, busType) {
  const busKey = `${busType.replaceAll('.', '_')}_${busRole}`;
  const routeKey = `${connectionType.replaceAll('.', '_')}_${busRole}`;
  const busIsSource = busRole === 'source';

  if (connectionType === 'pin.connect.label') {
    return {
      busKey,
      routeKey,
      busCell: { p: 0, r: 0, c: 0 },
      ordinaryCell: { p: 0, r: 0, c: 0 },
      ordinaryKey: busIsSource ? 'ordinary_target' : 'ordinary_source',
      ordinaryType: busIsSource ? 'pin.in' : 'pin.out',
      routeLabel: {
        k: routeKey,
        t: connectionType,
        v: [{
          from: busIsSource ? busKey : 'ordinary_source',
          to: [busIsSource ? 'ordinary_target' : busKey],
        }],
      },
    };
  }

  return {
    busKey,
    routeKey,
    busCell: { p: 0, r: 0, c: 0 },
    ordinaryCell: { p: 1, r: 0, c: 0 },
    ordinaryKey: busIsSource ? 'ordinary_target' : 'ordinary_source',
    ordinaryType: busIsSource ? 'pin.in' : 'pin.out',
    routeLabel: {
      k: routeKey,
      t: connectionType,
      v: [{
        from: busIsSource ? [0, 0, 0, busKey] : [1, 0, 0, 'ordinary_source'],
        to: [busIsSource ? [1, 0, 0, 'ordinary_target'] : [0, 0, 0, busKey]],
      }],
    },
  };
}

function sameKeyDirectionFixture(connectionType, busRole, busType) {
  const sharedKey = `${busType.replaceAll('.', '_')}_${busRole}_same_key`;
  const busIsSource = busRole === 'source';
  if (connectionType === 'pin.connect.label') {
    return {
      busKey: sharedKey,
      routeKey: sharedKey,
      busCell: { p: 0, r: 0, c: 0 },
      ordinaryCell: { p: 0, r: 0, c: 0 },
      ordinaryKey: busIsSource ? 'ordinary_target' : 'ordinary_source',
      ordinaryType: busIsSource ? 'pin.in' : 'pin.out',
      routeLabel: {
        k: sharedKey,
        t: connectionType,
        v: [{
          from: busIsSource ? sharedKey : 'ordinary_source',
          to: [busIsSource ? 'ordinary_target' : sharedKey],
        }],
      },
    };
  }
  return {
    busKey: sharedKey,
    routeKey: sharedKey,
    busCell: { p: 0, r: 0, c: 0 },
    ordinaryCell: { p: 1, r: 0, c: 0 },
    ordinaryKey: busIsSource ? 'ordinary_target' : 'ordinary_source',
    ordinaryType: busIsSource ? 'pin.in' : 'pin.out',
    routeLabel: {
      k: sharedKey,
      t: connectionType,
      v: [{
        from: busIsSource ? [0, 0, 0, sharedKey] : [1, 0, 0, 'ordinary_source'],
        to: [busIsSource ? [1, 0, 0, 'ordinary_target'] : [0, 0, 0, sharedKey]],
      }],
    },
  };
}

function addFixtureOrdinaryPin(rt, model0, fixture) {
  const result = rt.addLabel(
    model0,
    fixture.ordinaryCell.p,
    fixture.ordinaryCell.r,
    fixture.ordinaryCell.c,
    { k: fixture.ordinaryKey, t: fixture.ordinaryType, v: null },
  );
  assert(result.applied, 'ordinary endpoint fixture must be accepted');
}

function addFixtureBusPin(rt, model0, fixture, busType) {
  return rt.addLabel(
    model0,
    fixture.busCell.p,
    fixture.busCell.r,
    fixture.busCell.c,
    { k: fixture.busKey, t: busType, v: null },
  );
}

function addFixtureRoute(rt, model0, fixture) {
  return rt.addLabel(model0, 0, 0, 0, fixture.routeLabel);
}

function assertDirectionRejection(
  rt,
  model0,
  result,
  reason,
  beforeState,
  beforeLabels,
  spy,
  context,
) {
  assertRejected(result, `${context}: later invalid declaration must be rejected`);
  assert(latestReason(rt, reason), `${context}: stable rejection reason must be visible in eventLog`);
  assert.deepEqual(stableRouteState(rt), beforeState, `${context}: route and bus registry state must remain unchanged`);

  const root = model0.getCell(0, 0, 0);
  const visible = root.labels.get('pin_connection_error');
  assert(visible, `${context}: rejection must write pin_connection_error`);
  assert.equal(visible.t, 'json', `${context}: pin_connection_error must be json`);
  assert.equal(visible.v?.code, reason, `${context}: visible error must carry the stable code`);
  assert.deepEqual(
    stableLabelState(model0, 'pin_connection_error'),
    beforeLabels,
    `${context}: every prior label must be preserved and only the visible error may be added`,
  );

  assert.deepEqual(
    spy.added.map((entry) => entry.label.k),
    ['pin_connection_error'],
    `${context}: persistence must receive only the visible error, never the rejected declaration`,
  );
  assert.equal(spy.added[0].label.v?.code, reason, `${context}: persisted visible error must carry the stable code`);
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
  rt.addLabel(parent, 1, 0, 0, { k: 'model_type', t: 'model.submtconnection', v: 9360 });
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
  for (const entrypoint of runtimeEntrypoints) {
    const rt = new entrypoint.Runtime();
    const model = rt.createModel({ id: 9366, name: 'cell-route-shape', type: 'table' });
    const result = rt.addLabel(model, 0, 0, 0, {
      k: 'bad_cell_route',
      t: 'pin.connect.cell',
      v: [{ from: [0, 0, 0, 'cmd'], to: [[1, 0, 0, 'missing:in']] }],
    });
    assertRejected(result, `${entrypoint.name}: pin.connect.cell must reject function-shaped endpoints even when no function exists`);
    assert(
      latestReason(rt, 'cell_connection_function_endpoint_forbidden'),
      `${entrypoint.name}: function-shaped endpoint rejection must be recorded`,
    );
  }
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
  rt.addLabel(parent, 2, 0, 0, { k: 'model_type', t: 'model.submtconnection', v: 9363 });
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
  rt.addLabel(child, 0, 0, 0, { k: 'model_type', t: 'model.submt', v: 'Flow.Child' });
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

function test_bus_direction_rejection_matrix() {
  const busFamilies = ['cb', 'mb'];
  const connectionTypes = ['pin.connect.label', 'pin.connect.cell'];
  const invalidDirections = [
    {
      busRole: 'target',
      typeSuffix: 'in',
      reason: 'bus_in_connection_destination_forbidden',
    },
    {
      busRole: 'source',
      typeSuffix: 'out',
      reason: 'bus_out_connection_source_forbidden',
    },
  ];
  const declarationOrders = ['pin-first', 'route-first', 'type-replacement'];
  let cases = 0;

  for (const entrypoint of runtimeEntrypoints) {
    for (const family of busFamilies) {
      for (const connectionType of connectionTypes) {
        for (const invalid of invalidDirections) {
          const busType = `pin.bus.${family}.${invalid.typeSuffix}`;
          for (const order of declarationOrders) {
            const context = `${entrypoint.name}/${family}/${connectionType}/${invalid.busRole}/${order}`;
            const { rt, model0 } = createDemRuntime(entrypoint.Runtime);
            const fixture = directionFixture(connectionType, invalid.busRole, busType);
            addFixtureOrdinaryPin(rt, model0, fixture);

            let beforeLabel = null;
            let result;
            if (order === 'pin-first') {
              const bus = addFixtureBusPin(rt, model0, fixture, busType);
              assert(bus.applied, `${context}: bus endpoint fixture must be accepted before the route exists`);
            } else {
              if (order === 'type-replacement') {
                const previousType = invalid.typeSuffix === 'in' ? 'pin.in' : 'pin.out';
                const previous = rt.addLabel(model0, 0, 0, 0, {
                  k: fixture.busKey,
                  t: previousType,
                  v: null,
                });
                assert(previous.applied, `${context}: replaceable ordinary endpoint fixture must be accepted`);
                beforeLabel = structuredClone(model0.getCell(0, 0, 0).labels.get(fixture.busKey));
              }
              const route = addFixtureRoute(rt, model0, fixture);
              assert(route.applied, `${context}: unresolved or ordinary route fixture must remain order-independent`);
            }

            const beforeState = stableRouteState(rt);
            const beforeLabels = stableLabelState(model0);
            const spy = persistenceSpy();
            rt.setPersistence(spy);
            if (order === 'pin-first') {
              result = addFixtureRoute(rt, model0, fixture);
              assert(!model0.getCell(0, 0, 0).labels.has(fixture.routeKey), `${context}: rejected route label must not be stored`);
            } else {
              result = addFixtureBusPin(rt, model0, fixture, busType);
              if (!beforeLabel) {
                assert(!model0.getCell(0, 0, 0).labels.has(fixture.busKey), `${context}: rejected bus endpoint must not be stored`);
              }
            }

            assertDirectionRejection(
              rt,
              model0,
              result,
              invalid.reason,
              beforeState,
              beforeLabels,
              spy,
              context,
            );
            cases += 1;
          }
        }
      }
    }
  }

  assert.equal(cases, 48, 'invalid direction matrix must cover 48 entrypoint/family/form/order cases');
  return { key: 'bus_direction_rejection_matrix_48_cases', status: 'PASS' };
}

function test_bus_direction_legal_matrix() {
  const busFamilies = ['cb', 'mb'];
  const connectionTypes = ['pin.connect.label', 'pin.connect.cell'];
  const legalDirections = [
    { busRole: 'source', typeSuffix: 'in' },
    { busRole: 'target', typeSuffix: 'out' },
  ];
  const declarationOrders = ['pin-first', 'route-first'];
  let cases = 0;

  for (const entrypoint of runtimeEntrypoints) {
    for (const family of busFamilies) {
      for (const connectionType of connectionTypes) {
        for (const legal of legalDirections) {
          const busType = `pin.bus.${family}.${legal.typeSuffix}`;
          for (const order of declarationOrders) {
            const context = `${entrypoint.name}/${family}/${connectionType}/${legal.busRole}/${order}`;
            const { rt, model0 } = createDemRuntime(entrypoint.Runtime);
            const fixture = directionFixture(connectionType, legal.busRole, busType);
            addFixtureOrdinaryPin(rt, model0, fixture);

            if (order === 'pin-first') {
              const bus = addFixtureBusPin(rt, model0, fixture, busType);
              assert(bus.applied, `${context}: legal bus endpoint must be accepted`);
              const route = addFixtureRoute(rt, model0, fixture);
              assert(route.applied, `${context}: legal route must be accepted`);
            } else {
              const route = addFixtureRoute(rt, model0, fixture);
              assert(route.applied, `${context}: legal unresolved route must be accepted`);
              const bus = addFixtureBusPin(rt, model0, fixture, busType);
              assert(bus.applied, `${context}: legal late bus endpoint must be accepted`);
            }

            assert.deepEqual(
              model0.getCell(0, 0, 0).labels.get(fixture.busKey),
              { k: fixture.busKey, t: busType, v: null },
              `${context}: legal bus declaration must remain stored`,
            );
            assert.deepEqual(
              model0.getCell(0, 0, 0).labels.get(fixture.routeKey),
              fixture.routeLabel,
              `${context}: legal route declaration must remain stored`,
            );
            assert(!model0.getCell(0, 0, 0).labels.has('pin_connection_error'), `${context}: legal direction must not write an error`);
            if (connectionType === 'pin.connect.label') {
              assert(rt.cellConnectGraph.size > 0, `${context}: legal same-cell route must be registered`);
            } else {
              assert(rt.cellConnectionRoutes.size > 0, `${context}: legal cross-cell route must be registered`);
            }
            cases += 1;
          }
        }
      }
    }
  }

  assert.equal(cases, 32, 'legal direction matrix must cover 32 entrypoint/family/form/order cases');
  return { key: 'bus_direction_legal_matrix_32_cases', status: 'PASS' };
}

function test_same_key_route_to_bus_replacement_rejection_matrix() {
  const busFamilies = ['cb', 'mb'];
  const connectionTypes = ['pin.connect.label', 'pin.connect.cell'];
  const invalidDirections = [
    { busRole: 'target', typeSuffix: 'in', reason: 'bus_in_connection_destination_forbidden' },
    { busRole: 'source', typeSuffix: 'out', reason: 'bus_out_connection_source_forbidden' },
  ];
  let cases = 0;

  for (const entrypoint of runtimeEntrypoints) {
    for (const family of busFamilies) {
      for (const connectionType of connectionTypes) {
        for (const invalid of invalidDirections) {
          const busType = `pin.bus.${family}.${invalid.typeSuffix}`;
          const context = `${entrypoint.name}/${family}/${connectionType}/${invalid.busRole}/same-key-replacement`;
          const { rt, model0 } = createDemRuntime(entrypoint.Runtime);
          const fixture = sameKeyDirectionFixture(connectionType, invalid.busRole, busType);
          addFixtureOrdinaryPin(rt, model0, fixture);
          const route = addFixtureRoute(rt, model0, fixture);
          assert(route.applied, `${context}: same-key route fixture must be accepted before the bus endpoint exists`);

          const beforeState = stableRouteState(rt);
          const beforeLabels = stableLabelState(model0);
          const spy = persistenceSpy();
          rt.setPersistence(spy);
          const result = addFixtureBusPin(rt, model0, fixture, busType);
          assertDirectionRejection(
            rt,
            model0,
            result,
            invalid.reason,
            beforeState,
            beforeLabels,
            spy,
            context,
          );
          cases += 1;
        }
      }
    }
  }

  assert.equal(cases, 16, 'same-key invalid replacement matrix must cover 16 entrypoint/family/form/direction cases');
  return { key: 'same_key_route_to_bus_replacement_rejection_matrix_16_cases', status: 'PASS' };
}

function test_same_key_legal_route_to_bus_replacement_clears_graph_matrix() {
  const busFamilies = ['cb', 'mb'];
  const connectionTypes = ['pin.connect.label', 'pin.connect.cell'];
  const legalDirections = [
    { busRole: 'source', typeSuffix: 'in' },
    { busRole: 'target', typeSuffix: 'out' },
  ];
  let cases = 0;

  for (const entrypoint of runtimeEntrypoints) {
    for (const family of busFamilies) {
      for (const connectionType of connectionTypes) {
        for (const legal of legalDirections) {
          const busType = `pin.bus.${family}.${legal.typeSuffix}`;
          const context = `${entrypoint.name}/${family}/${connectionType}/${legal.busRole}/same-key-legal-replacement`;
          const { rt, model0 } = createDemRuntime(entrypoint.Runtime);
          const fixture = sameKeyDirectionFixture(connectionType, legal.busRole, busType);
          addFixtureOrdinaryPin(rt, model0, fixture);
          const baselineGraphs = stableConnectionGraphState(rt);
          const route = addFixtureRoute(rt, model0, fixture);
          assert(route.applied, `${context}: same-key legal route fixture must be accepted`);
          assert.notDeepEqual(
            stableConnectionGraphState(rt),
            baselineGraphs,
            `${context}: route fixture must add graph state before replacement`,
          );

          const spy = persistenceSpy();
          rt.setPersistence(spy);
          const result = addFixtureBusPin(rt, model0, fixture, busType);
          assert(result.applied, `${context}: legal same-key bus replacement must be accepted`);
          assert.deepEqual(
            model0.getCell(0, 0, 0).labels.get(fixture.busKey),
            { k: fixture.busKey, t: busType, v: null },
            `${context}: route label must be replaced by the legal bus endpoint`,
          );
          assert.deepEqual(
            stableConnectionGraphState(rt),
            baselineGraphs,
            `${context}: accepted replacement must remove only the replaced route graph and restore baseline graphs`,
          );
          assert(!model0.getCell(0, 0, 0).labels.has('pin_connection_error'), `${context}: legal replacement must not write an error`);
          assert.deepEqual(
            spy.added.map((entry) => entry.label.k),
            [fixture.busKey],
            `${context}: persistence must receive only the accepted bus replacement`,
          );
          cases += 1;
        }
      }
    }
  }

  assert.equal(cases, 16, 'same-key legal cleanup matrix must cover 16 entrypoint/family/form/direction cases');
  return { key: 'same_key_legal_route_to_bus_replacement_clears_graph_matrix_16_cases', status: 'PASS' };
}

function test_function_shaped_unresolved_endpoint_direction_rejection_matrix() {
  const busFamilies = ['cb', 'mb'];
  const invalidDirections = [
    {
      busRole: 'target',
      typeSuffix: 'in',
      busKey: 'danger:in',
      reason: 'bus_in_connection_destination_forbidden',
    },
    {
      busRole: 'source',
      typeSuffix: 'out',
      busKey: 'danger:out',
      reason: 'bus_out_connection_source_forbidden',
    },
  ];
  let cases = 0;

  for (const entrypoint of runtimeEntrypoints) {
    for (const family of busFamilies) {
      for (const invalid of invalidDirections) {
        const busType = `pin.bus.${family}.${invalid.typeSuffix}`;
        const context = `${entrypoint.name}/${family}/pin.connect.label/${invalid.busRole}/function-shaped-route-first`;
        const { rt, model0 } = createDemRuntime(entrypoint.Runtime);
        const busIsSource = invalid.busRole === 'source';
        const fixture = {
          busKey: invalid.busKey,
          routeKey: `function_shaped_${invalid.busRole}_route`,
          busCell: { p: 0, r: 0, c: 0 },
          ordinaryCell: { p: 0, r: 0, c: 0 },
          ordinaryKey: busIsSource ? 'ordinary_target' : 'ordinary_source',
          ordinaryType: busIsSource ? 'pin.in' : 'pin.out',
          routeLabel: {
            k: `function_shaped_${invalid.busRole}_route`,
            t: 'pin.connect.label',
            v: [{
              from: busIsSource ? invalid.busKey : 'ordinary_source',
              to: [busIsSource ? 'ordinary_target' : invalid.busKey],
            }],
          },
        };
        addFixtureOrdinaryPin(rt, model0, fixture);
        const route = addFixtureRoute(rt, model0, fixture);
        assert(route.applied, `${context}: unresolved function-shaped endpoint remains valid before its declaration`);

        const beforeState = stableRouteState(rt);
        const beforeLabels = stableLabelState(model0);
        const spy = persistenceSpy();
        rt.setPersistence(spy);
        const result = addFixtureBusPin(rt, model0, fixture, busType);
        assertDirectionRejection(
          rt,
          model0,
          result,
          invalid.reason,
          beforeState,
          beforeLabels,
          spy,
          context,
        );
        cases += 1;
      }
    }
  }

  assert.equal(cases, 8, 'function-shaped route-first matrix must cover 8 entrypoint/family/direction cases');
  return { key: 'function_shaped_unresolved_endpoint_direction_rejection_matrix_8_cases', status: 'PASS' };
}

function test_real_function_endpoint_precedence_over_same_named_bus_matrix() {
  const busFamilies = ['cb', 'mb'];
  const endpointCases = [
    { endpointSuffix: 'in', busTypeSuffix: 'in', busRole: 'target' },
    { endpointSuffix: 'out', busTypeSuffix: 'out', busRole: 'source' },
  ];
  const declarationOrders = ['function-first', 'route-first'];
  let cases = 0;

  for (const entrypoint of runtimeEntrypoints) {
    for (const family of busFamilies) {
      for (const endpointCase of endpointCases) {
        for (const order of declarationOrders) {
          const context = `${entrypoint.name}/${family}/${endpointCase.busRole}/${order}/real-function-precedence`;
          const { rt, model0 } = createDemRuntime(entrypoint.Runtime);
          const funcKey = `real_function_${family}_${endpointCase.endpointSuffix}`;
          const busKey = `${funcKey}:${endpointCase.endpointSuffix}`;
          const busIsSource = endpointCase.busRole === 'source';
          const ordinaryKey = busIsSource ? 'ordinary_target' : 'ordinary_source';
          const ordinaryType = busIsSource ? 'pin.in' : 'pin.out';
          assert(rt.addLabel(model0, 0, 0, 0, { k: ordinaryKey, t: ordinaryType, v: null }).applied);
          const funcLabel = { k: funcKey, t: 'func.js', v: { code: 'return [];' } };
          const routeLabel = {
            k: `real_function_route_${endpointCase.busRole}`,
            t: 'pin.connect.label',
            v: [{
              from: busIsSource ? busKey : 'ordinary_source',
              to: [busIsSource ? 'ordinary_target' : busKey],
            }],
          };
          if (order === 'function-first') {
            assert(rt.addLabel(model0, 0, 0, 0, funcLabel).applied, `${context}: function must be declared`);
            assert(rt.addLabel(model0, 0, 0, 0, routeLabel).applied, `${context}: function route must be accepted`);
          } else {
            assert(rt.addLabel(model0, 0, 0, 0, routeLabel).applied, `${context}: unresolved function route must be accepted`);
            assert(rt.addLabel(model0, 0, 0, 0, funcLabel).applied, `${context}: late function must rebuild the route as a function endpoint`);
          }
          const beforeGraphs = stableConnectionGraphState(rt);
          const busType = `pin.bus.${family}.${endpointCase.busTypeSuffix}`;
          const bus = rt.addLabel(model0, 0, 0, 0, { k: busKey, t: busType, v: null });
          assert(bus.applied, `${context}: same-named bus label must not capture an endpoint owned by a real function`);
          assert.deepEqual(stableConnectionGraphState(rt), beforeGraphs, `${context}: function route graph must remain unchanged`);
          assert(!model0.getCell(0, 0, 0).labels.has('pin_connection_error'), `${context}: function endpoint must not write direction error`);
          cases += 1;
        }
      }
    }
  }

  assert.equal(cases, 16, 'real-function precedence matrix must cover 16 entrypoint/family/direction/order cases');
  return { key: 'real_function_endpoint_precedence_over_same_named_bus_matrix_16_cases', status: 'PASS' };
}

function test_pin_connection_error_reserved_and_internal_write() {
  for (const entrypoint of runtimeEntrypoints) {
    const context = `${entrypoint.name}/pin_connection_error_reserved`;
    const { rt, model0 } = createDemRuntime(entrypoint.Runtime);
    const spy = persistenceSpy();
    rt.setPersistence(spy);
    const initialLabels = stableLabelState(model0);
    const initialRoutes = stableRouteState(rt);
    const reserved = rt.addLabel(model0, 0, 0, 0, {
      k: 'pin_connection_error',
      t: 'pin.connect.label',
      v: [{ from: 'source', to: ['target'] }],
    });
    assertRejected(reserved, `${context}: public writes to the runtime error key must be rejected`);
    assert(latestReason(rt, 'runtime_error_label_reserved'), `${context}: reserved rejection must have a stable reason`);
    assert.deepEqual(stableLabelState(model0), initialLabels, `${context}: reserved rejection must not change labels`);
    assert.deepEqual(stableRouteState(rt), initialRoutes, `${context}: reserved rejection must not change routes`);
    assert.deepEqual(spy.added, [], `${context}: reserved rejection must not reach persistence`);

    assert(rt.addLabel(model0, 0, 0, 0, { k: 'ordinary_source', t: 'pin.out', v: null }).applied);
    assert(rt.addLabel(model0, 0, 0, 0, {
      k: 'safe_collision_route',
      t: 'pin.connect.label',
      v: [{ from: 'ordinary_source', to: ['collision_bus'] }],
    }).applied);
    spy.added.length = 0;
    const beforeDirectionLabels = stableLabelState(model0);
    const beforeDirectionRoutes = stableRouteState(rt);
    const invalidBus = rt.addLabel(model0, 0, 0, 0, { k: 'collision_bus', t: 'pin.bus.cb.in', v: null });
    assertRejected(invalidBus, `${context}: invalid direction must still reject`);
    assert.equal(model0.getCell(0, 0, 0).labels.get('pin_connection_error')?.v?.code, 'bus_in_connection_destination_forbidden');
    assert.deepEqual(stableLabelState(model0, 'pin_connection_error'), beforeDirectionLabels, `${context}: internal error write must preserve prior labels`);
    assert.deepEqual(stableRouteState(rt), beforeDirectionRoutes, `${context}: internal error write must preserve route state`);
    assert.deepEqual(spy.added.map((entry) => entry.label.k), ['pin_connection_error'], `${context}: internal error must use addLabel persistence`);

    const internalError = structuredClone(model0.getCell(0, 0, 0).labels.get('pin_connection_error'));
    const overwrite = rt.addLabel(model0, 0, 0, 0, { k: 'pin_connection_error', t: 'json', v: { code: 'forged' } });
    assertRejected(overwrite, `${context}: public overwrite of an internal error must be rejected`);
    assert(latestReason(rt, 'runtime_error_label_reserved'), `${context}: overwrite rejection must retain the stable reason`);
    assert.deepEqual(model0.getCell(0, 0, 0).labels.get('pin_connection_error'), internalError, `${context}: internal error must survive public overwrite`);
  }
  return { key: 'pin_connection_error_reserved_and_internal_write', status: 'PASS' };
}

function test_trusted_hydrate_bypasses_only_reserved_authorship() {
  for (const entrypoint of runtimeEntrypoints) {
    const context = `${entrypoint.name}/trusted_hydrate`;
    const { rt, model0 } = createDemRuntime(entrypoint.Runtime);
    const spy = persistenceSpy();
    rt.setPersistence(spy);
    spy.added.length = 0;

    const restoredError = {
      k: 'pin_connection_error',
      t: 'json',
      v: { code: 'bus_in_connection_destination_forbidden', restored: true },
    };
    const hydrated = rt.hydrateLabel(model0, 0, 0, 0, restoredError);
    assert(hydrated.applied, `${context}: trusted hydration must restore the reserved runtime error`);
    assert.deepEqual(
      model0.getCell(0, 0, 0).labels.get('pin_connection_error'),
      restoredError,
      `${context}: restored runtime error must retain its persisted value`,
    );
    assert(!latestReason(rt, 'runtime_error_label_reserved'), `${context}: trusted hydration must not report reserved authorship`);
    assert.deepEqual(spy.added.map((entry) => entry.label.k), ['pin_connection_error'], `${context}: hydration must still use addLabel persistence`);

    const invalidReserved = rt.hydrateLabel(model0, 0, 0, 0, {
      k: 'pin_connection_error',
      t: 'pin.connect.model',
      v: [{ from: 'source', to: ['target'] }],
    });
    assertRejected(invalidReserved, `${context}: reserved hydration must still execute label validation`);
    assert(latestReason(rt, 'label_type_removed'), `${context}: reserved hydration must retain ordinary validation reasons`);
    assert.deepEqual(
      model0.getCell(0, 0, 0).labels.get('pin_connection_error'),
      restoredError,
      `${context}: invalid reserved hydration must preserve the previously restored error`,
    );
    assert.deepEqual(spy.added.map((entry) => entry.label.k), ['pin_connection_error'], `${context}: invalid reserved hydration must not reach persistence`);

    const illegal = rt.hydrateLabel(model0, 0, 0, 0, {
      k: 'legacy_model_route',
      t: 'pin.connect.model',
      v: [{ from: 'source', to: ['target'] }],
    });
    assertRejected(illegal, `${context}: trusted hydration must not bypass ordinary label validation`);
    assert(latestReason(rt, 'label_type_removed'), `${context}: removed label type must retain its stable rejection reason`);
    assert(!model0.getCell(0, 0, 0).labels.has('legacy_model_route'), `${context}: rejected persisted label must not enter ModelTable`);
    assert.deepEqual(spy.added.map((entry) => entry.label.k), ['pin_connection_error'], `${context}: rejected hydration must not reach persistence`);
  }
  return { key: 'trusted_hydrate_bypasses_only_reserved_authorship', status: 'PASS' };
}

function test_bus_to_route_type_change_clears_registry_matrix() {
  const busFamilies = ['cb', 'mb'];
  const busDirections = ['in', 'out'];
  const connectionTypes = ['pin.connect.label', 'pin.connect.cell'];
  let cases = 0;

  for (const entrypoint of runtimeEntrypoints) {
    for (const family of busFamilies) {
      for (const direction of busDirections) {
        for (const connectionType of connectionTypes) {
          const context = `${entrypoint.name}/${family}/${direction}/${connectionType}/bus-to-route`;
          const { rt, model0 } = createDemRuntime(entrypoint.Runtime);
          const busKey = `replace_${family}_${direction}_${connectionType.replaceAll('.', '_')}`;
          assert(rt.addLabel(model0, 0, 0, 0, { k: busKey, t: `pin.bus.${family}.${direction}`, v: null }).applied);
          let routeLabel;
          if (connectionType === 'pin.connect.label') {
            assert(rt.addLabel(model0, 0, 0, 0, { k: 'ordinary_source', t: 'pin.out', v: null }).applied);
            assert(rt.addLabel(model0, 0, 0, 0, { k: 'ordinary_target', t: 'pin.in', v: null }).applied);
            routeLabel = { k: busKey, t: connectionType, v: [{ from: 'ordinary_source', to: ['ordinary_target'] }] };
          } else {
            assert(rt.addLabel(model0, 1, 0, 0, { k: 'ordinary_source', t: 'pin.out', v: null }).applied);
            assert(rt.addLabel(model0, 2, 0, 0, { k: 'ordinary_target', t: 'pin.in', v: null }).applied);
            routeLabel = {
              k: busKey,
              t: connectionType,
              v: [{ from: [1, 0, 0, 'ordinary_source'], to: [[2, 0, 0, 'ordinary_target']] }],
            };
          }
          const replacement = rt.addLabel(model0, 0, 0, 0, routeLabel);
          assert(replacement.applied, `${context}: legal route replacement must be accepted`);
          assert(!rt.busInPorts.has(busKey), `${context}: prior bus-in registry must be cleared`);
          assert(!rt.busOutPorts.has(busKey), `${context}: prior bus-out registry must be cleared`);
          if (connectionType === 'pin.connect.label') {
            assert(rt.cellConnectGraph.size > 0, `${context}: replacement route graph must be registered`);
          } else {
            assert(rt.cellConnectionRoutes.size > 0, `${context}: replacement route graph must be registered`);
          }
          cases += 1;
        }
      }
    }
  }

  assert.equal(cases, 16, 'bus-to-route cleanup matrix must cover 16 entrypoint/family/direction/form cases');
  return { key: 'bus_to_route_type_change_clears_registry_matrix_16_cases', status: 'PASS' };
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
  test_bus_direction_rejection_matrix,
  test_bus_direction_legal_matrix,
  test_same_key_route_to_bus_replacement_rejection_matrix,
  test_same_key_legal_route_to_bus_replacement_clears_graph_matrix,
  test_function_shaped_unresolved_endpoint_direction_rejection_matrix,
  test_real_function_endpoint_precedence_over_same_named_bus_matrix,
  test_pin_connection_error_reserved_and_internal_write,
  test_trusted_hydrate_bypasses_only_reserved_authorship,
  test_bus_to_route_type_change_clears_registry_matrix,
];

for (const test of tests) {
  const result = await test();
  console.log(`${result.key}: ${result.status}`);
}
