import { createRequire } from 'node:module';
import assert from 'node:assert';

const require = createRequire(import.meta.url);
const cjsRuntime = require('../../packages/worker-base/src/runtime.js');
const esmRuntime = await import('../../packages/worker-base/src/runtime.mjs');

const variants = [
  ['cjs', cjsRuntime.ModelTableRuntime],
  ['esm', esmRuntime.ModelTableRuntime],
];

function latestReason(rt) {
  const events = rt.eventLog.list();
  return events.length ? events[events.length - 1].reason : null;
}

function labelValue(model, p, r, c, k) {
  const cell = model.getCell(p, r, c);
  const label = cell.labels.get(k);
  return label ? label.v : undefined;
}

function testTableNamespacePreservesSameModelId(name, Runtime) {
  const rt = new Runtime();
  const hostModel = rt.createModel({ id: 1, name: `${name}-host`, type: 'host' });
  const appModel = rt.createModel({ table_id: 'app:todo:a', id: 1, name: `${name}-app`, type: 'app' });

  assert.notStrictEqual(appModel, hostModel, `${name}: app table model_id must not collide with host model_id`);
  assert.equal(rt.getModel(1), hostModel, `${name}: bare getModel remains explicit host boundary behavior`);
  assert.equal(rt.getModel({ table_id: 'host', model_id: 1 }), hostModel, `${name}: explicit host ModelRef must resolve`);
  assert.equal(rt.getModel({ table_id: 'app:todo:a', model_id: 1 }), appModel, `${name}: explicit app ModelRef must resolve`);
  assert.equal(rt.getModel({ table_id: 'app:todo:b', model_id: 1 }), undefined, `${name}: other app table must not resolve`);

  rt.addLabel(hostModel, 0, 0, 0, { k: 'title', t: 'str', v: `${name}-host-title` });
  rt.addLabel(appModel, 0, 0, 0, { k: 'title', t: 'str', v: `${name}-app-title` });

  const snapshot = rt.snapshot();
  assert.equal(snapshot.models['1'].cells['0,0,0'].labels.title.v, `${name}-host-title`);
  assert.equal(snapshot.tables['app:todo:a'].models['1'].cells['0,0,0'].labels.title.v, `${name}-app-title`);
}

function testAppTableRejectsNegativeModels(name, Runtime) {
  const rt = new Runtime();
  assert.throws(
    () => rt.createModel({ table_id: 'app:todo:a', id: -1, name: 'bad', type: 'system' }),
    /app_table_negative_model_forbidden/,
    `${name}: app instance tables must not own negative host/system models`,
  );
}

function testModelSubtableMountIsNotSubmtAlias(name, Runtime) {
  const rt = new Runtime();
  const host = rt.getModel(0);
  const result = rt.addLabel(host, 2, 0, 0, {
    k: 'todo_mount',
    t: 'model.subtable',
    v: { table_id: 'app:todo:a', root_model_id: 0, owner_principal_id: `${name}-user` },
  });

  assert(result.applied, `${name}: model.subtable mount label should apply`);
  assert(!rt.parentChildMap.has(0), `${name}: model.subtable must not be recorded as model.submt child model`);
  assert(rt.subtableMounts instanceof Map, `${name}: runtime must expose subtableMounts map`);
  assert(rt.subtableMounts.has('app:todo:a'), `${name}: subtable mount must be tracked by table_id`);
  assert.equal(rt.getModel({ table_id: 'app:todo:a', model_id: 0 }).id, 0, `${name}: mounted child table root model must exist`);
  assert.equal(rt.getModel(0), host, `${name}: host model 0 must remain host table model 0`);
}

function testSubtableRootOutputIgnoresHostSubmtIdCollision(name, Runtime) {
  const rt = new Runtime();
  const host = rt.getModel(0);
  rt.addLabel(host, 4, 0, 0, { k: 'legacy_child', t: 'model.submt', v: 7 });
  rt.addLabel(host, 5, 0, 0, {
    k: 'todo_mount',
    t: 'model.subtable',
    v: { table_id: 'app:todo:a', root_model_id: 7, owner_principal_id: `${name}-user` },
  });
  const appRoot = rt.getModel({ table_id: 'app:todo:a', model_id: 7 });
  const payload = [{ id: 0, p: 0, r: 0, c: 0, k: 'value', t: 'str', v: `${name}-done` }];

  rt.addLabel(appRoot, 0, 0, 0, { k: 'result', t: 'pin.out', v: payload });

  assert.deepEqual(labelValue(host, 5, 0, 0, 'result'), payload, `${name}: app root output must return to subtable hosting Cell`);
  assert.equal(labelValue(host, 4, 0, 0, 'result'), undefined, `${name}: app root output must not use host parentChildMap collision`);
}

function testCellConnectRoutesAreTableQualified(name, Runtime) {
  const rt = new Runtime();
  const appModel = rt.createModel({ table_id: 'app:todo:a', id: 5, name: 'app-root', type: 'app' });
  rt.addLabel(appModel, 1, 0, 0, { k: 'cmd', t: 'pin.in', v: null });
  const routeResult = rt.addLabel(appModel, 0, 0, 0, {
    k: 'routing',
    t: 'pin.connect.cell',
    v: [{ from: [0, 0, 0, 'input'], to: [[1, 0, 0, 'cmd']] }],
  });
  assert(routeResult.applied, `${name}: app table pin.connect.cell should apply inside one table`);
  assert(rt.cellConnectionRoutes.has('app:todo:a|5|0|0|0|input'), `${name}: route key must include table_id`);
  assert(!rt.cellConnectionRoutes.has('5|0|0|0|input'), `${name}: route key must not use old bare model_id key`);

  const payload = [{ id: 0, p: 0, r: 0, c: 0, k: 'value', t: 'str', v: `${name}-payload` }];
  rt.addLabel(appModel, 0, 0, 0, { k: 'input', t: 'pin.in', v: payload });
  assert.deepEqual(labelValue(appModel, 1, 0, 0, 'cmd'), payload, `${name}: intra-table route should deliver payload`);
}

function testCellConnectRejectsCrossTableEndpoints(name, Runtime) {
  const rt = new Runtime();
  const appModel = rt.createModel({ table_id: 'app:todo:a', id: 5, name: 'app-root', type: 'app' });
  const result = rt.addLabel(appModel, 0, 0, 0, {
    k: 'bad_route',
    t: 'pin.connect.cell',
    v: [{ from: ['host', 0, 0, 0, 'input'], to: [[1, 0, 0, 'cmd']] }],
  });
  assert.equal(result.applied, false, `${name}: pin.connect.cell endpoint carrying table_id must be rejected`);
  assert.equal(latestReason(rt), 'cell_connection_cross_table_endpoint_forbidden');
}

function testModelSubtableRequiresHostTable(name, Runtime) {
  const rt = new Runtime();
  const appModel = rt.createModel({ table_id: 'app:todo:a', id: 1, name: 'app', type: 'app' });
  const result = rt.addLabel(appModel, 2, 0, 0, {
    k: 'nested_mount',
    t: 'model.subtable',
    v: { table_id: 'app:nested:a', root_model_id: 0 },
  });
  assert.equal(result.applied, false, `${name}: non-host table must not declare model.subtable`);
  assert.equal(latestReason(rt), 'subtable_requires_host_table');
}

const tests = [
  testTableNamespacePreservesSameModelId,
  testAppTableRejectsNegativeModels,
  testModelSubtableMountIsNotSubmtAlias,
  testSubtableRootOutputIgnoresHostSubmtIdCollision,
  testCellConnectRoutesAreTableQualified,
  testCellConnectRejectsCrossTableEndpoints,
  testModelSubtableRequiresHostTable,
];

let passed = 0;
let failed = 0;

for (const [name, Runtime] of variants) {
  for (const test of tests) {
    try {
      test(name, Runtime);
      console.log(`[PASS] ${name}:${test.name}`);
      passed += 1;
    } catch (err) {
      console.log(`[FAIL] ${name}:${test.name}: ${err && err.message ? err.message : err}`);
      failed += 1;
    }
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${passed + failed}`);
process.exit(failed > 0 ? 1 : 0);
