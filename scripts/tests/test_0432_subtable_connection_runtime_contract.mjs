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

function payload(k, t, v) {
  return [{ id: 0, p: 0, r: 0, c: 0, k, t, v }];
}

function assertRejected(rt, result, reason, message) {
  assert.equal(result.applied, false, message);
  assert.equal(latestReason(rt), reason, `${message}: reason`);
}

function testChildSubtableDeclarationOnlyOnChildTableRoot(name, Runtime) {
  const rt = new Runtime();
  const host = rt.getModel(0);
  const badHostResult = rt.addLabel(host, 2, 0, 0, {
    k: 'model_type',
    t: 'model.subtable',
    v: 'Slide.App.Table',
  });
  assertRejected(rt, badHostResult, 'subtable_requires_child_table_root', `${name}: host-side model.subtable must be rejected`);

  const appRoot = rt.createModel({ table_id: 'app:todo:a', id: 0, name: 'app-root', type: 'app' });
  const goodResult = rt.addLabel(appRoot, 0, 0, 0, {
    k: 'model_type',
    t: 'model.subtable',
    v: 'Slide.App.Table',
  });
  assert.equal(goodResult.applied, true, `${name}: child table root model.subtable should apply`);
  assert.equal(rt.subtableMounts.has('app:todo:a'), false, `${name}: child declaration alone must not create parent-side subtable index`);
}

function testSubtableConnectionRegistersParentSideIndex(name, Runtime) {
  const rt = new Runtime();
  const host = rt.getModel(0);
  const result = rt.addLabel(host, 2, 0, 0, {
    k: 'model_type',
    t: 'model.subtableconnection',
    v: {
      table_id: 'app:todo:a',
      root_model_id: 0,
      mount_kind: 'slide_app',
      owner_principal_id: `${name}-user`,
    },
  });
  assert.equal(result.applied, true, `${name}: parent-side model.subtableconnection should apply`);
  assert.equal(rt.subtableMounts.has('app:todo:a'), true, `${name}: subtable index must be tracked by table_id`);
  assert.equal(rt.getModel({ table_id: 'app:todo:a', model_id: 0 }).id, 0, `${name}: indexed child table root model must exist`);
}

function testSubtableConnectionValueShapeIsStrict(name, Runtime) {
  const rt = new Runtime();
  const host = rt.getModel(0);
  const missingMountKind = rt.addLabel(host, 2, 0, 0, {
    k: 'model_type',
    t: 'model.subtableconnection',
    v: { table_id: 'app:todo:a', root_model_id: 0 },
  });
  assertRejected(rt, missingMountKind, 'subtableconnection_invalid_mount_kind', `${name}: model.subtableconnection must require mount_kind`);

  const extraAlias = rt.addLabel(host, 3, 0, 0, {
    k: 'model_type',
    t: 'model.subtableconnection',
    v: {
      table_id: 'app:todo:b',
      root_model_id: 0,
      mount_kind: 'slide_app',
      alias: 'not_allowed',
    },
  });
  assertRejected(rt, extraAlias, 'subtableconnection_unknown_field:alias', `${name}: model.subtableconnection must reject undeclared metadata fields`);
}

function testConnectionCellsOnlyAllowBoundaryPins(name, Runtime) {
  const rt = new Runtime();
  const host = rt.getModel(0);
  rt.addLabel(host, 2, 0, 0, { k: 'title', t: 'str', v: 'existing-data' });
  const withExistingData = rt.addLabel(host, 2, 0, 0, {
    k: 'model_type',
    t: 'model.subtableconnection',
    v: { table_id: 'app:todo:a', root_model_id: 0, mount_kind: 'slide_app' },
  });
  assertRejected(rt, withExistingData, 'connection_cell_forbidden_existing_label:title', `${name}: connection Cell must reject pre-existing non-boundary labels`);

  const good = rt.addLabel(host, 3, 0, 0, {
    k: 'model_type',
    t: 'model.submtconnection',
    v: 100,
  });
  assert.equal(good.applied, true, `${name}: model.submtconnection should apply on clean connection Cell`);
  const pinResult = rt.addLabel(host, 3, 0, 0, { k: 'submit', t: 'pin.in', v: null });
  assert.equal(pinResult.applied, true, `${name}: boundary pin must be allowed on connection Cell`);
  const dataResult = rt.addLabel(host, 3, 0, 0, { k: 'title', t: 'str', v: 'forbidden-data' });
  assertRejected(rt, dataResult, 'connection_cell_forbidden_label:title', `${name}: non-boundary label must be rejected on connection Cell`);
}

function testSubmtDeclarationAndConnectionAreSeparate(name, Runtime) {
  const rt = new Runtime();
  const host = rt.getModel(0);
  const oldParentSideSubmt = rt.addLabel(host, 4, 0, 0, {
    k: 'model_type',
    t: 'model.submt',
    v: 100,
  });
  assertRejected(rt, oldParentSideSubmt, 'submt_requires_child_model_root', `${name}: parent-side model.submt must be rejected`);

  const child = rt.createModel({ id: 100, name: 'child', type: 'app' });
  const declaration = rt.addLabel(child, 0, 0, 0, {
    k: 'model_type',
    t: 'model.submt',
    v: 'Flow.Child',
  });
  assert.equal(declaration.applied, true, `${name}: child root model.submt declaration should apply`);
  assert.equal(rt.parentChildMap.has('host|100'), false, `${name}: child declaration alone must not create parent index`);

  const connection = rt.addLabel(host, 4, 0, 0, {
    k: 'model_type',
    t: 'model.submtconnection',
    v: { model_id: 100, mount_kind: 'workspace_child' },
  });
  assert.equal(connection.applied, true, `${name}: parent-side model.submtconnection should apply`);
  assert.equal(rt.parentChildMap.has('host|100'), true, `${name}: parent index must be table-qualified`);
}

function testSubmtConnectionSingleParent(name, Runtime) {
  const rt = new Runtime();
  const host = rt.getModel(0);
  const first = rt.addLabel(host, 1, 0, 0, { k: 'model_type', t: 'model.submtconnection', v: 200 });
  assert.equal(first.applied, true, `${name}: first parent index should apply`);
  const second = rt.addLabel(host, 2, 0, 0, { k: 'model_type', t: 'model.submtconnection', v: 200 });
  assertRejected(rt, second, 'submtconnection_child_already_indexed', `${name}: second parent index for same child must be rejected`);
}

function testSubmodelBoundaryPinRelayUsesConnectionLabel(name, Runtime) {
  const rt = new Runtime();
  const host = rt.getModel(0);
  rt.addLabel(host, 1, 0, 0, { k: 'model_type', t: 'model.submtconnection', v: 300 });
  rt.addLabel(host, 1, 0, 0, { k: 'input', t: 'pin.in', v: null });
  const child = rt.getModel(300);
  rt.addLabel(child, 0, 0, 0, { k: 'model_type', t: 'model.submt', v: 'Flow.Child' });
  rt.addLabel(child, 0, 0, 0, { k: 'input', t: 'pin.in', v: null });
  const value = payload('message', 'str', `${name}-payload`);

  rt.addLabel(host, 1, 0, 0, { k: 'input', t: 'pin.in', v: value });

  assert.deepEqual(labelValue(child, 0, 0, 0, 'input'), value, `${name}: parent connection Cell input should relay to child root`);
}

function testSubtableRootOutputReturnsToConnectionCell(name, Runtime) {
  const rt = new Runtime();
  const host = rt.getModel(0);
  rt.addLabel(host, 5, 0, 0, {
    k: 'model_type',
    t: 'model.subtableconnection',
    v: { table_id: 'app:todo:a', root_model_id: 7, mount_kind: 'slide_app' },
  });
  rt.addLabel(host, 5, 0, 0, { k: 'result', t: 'pin.out', v: null });
  const appRoot = rt.getModel({ table_id: 'app:todo:a', model_id: 7 });
  rt.addLabel(appRoot, 0, 0, 0, { k: 'model_type', t: 'model.subtable', v: 'Slide.App.Table' });
  const value = payload('result', 'str', `${name}-done`);

  rt.addLabel(appRoot, 0, 0, 0, { k: 'result', t: 'pin.out', v: value });

  assert.deepEqual(labelValue(host, 5, 0, 0, 'result'), value, `${name}: app table root output must return to parent connection Cell`);
}

function testSubmtConnectionReplacementCleansOldIndex(name, Runtime) {
  const rt = new Runtime();
  const host = rt.getModel(0);
  rt.addLabel(host, 6, 0, 0, { k: 'model_type', t: 'model.submtconnection', v: 400 });
  assert.equal(rt.parentChildMap.has('host|400'), true, `${name}: initial child index must exist`);

  const replacement = rt.addLabel(host, 6, 0, 0, { k: 'model_type', t: 'model.submtconnection', v: 401 });

  assert.equal(replacement.applied, true, `${name}: same Cell should allow replacing child index`);
  assert.equal(rt.parentChildMap.has('host|400'), false, `${name}: old child index must be removed`);
  assert.equal(rt.parentChildMap.has('host|401'), true, `${name}: new child index must be registered`);
}

function testSubtableConnectionReplacementCleansOldIndex(name, Runtime) {
  const rt = new Runtime();
  const host = rt.getModel(0);
  rt.addLabel(host, 7, 0, 0, {
    k: 'model_type',
    t: 'model.subtableconnection',
    v: { table_id: 'app:todo:a', root_model_id: 0, mount_kind: 'slide_app' },
  });
  assert.equal(rt.subtableMounts.has('app:todo:a'), true, `${name}: initial subtable index must exist`);

  const replacement = rt.addLabel(host, 7, 0, 0, {
    k: 'model_type',
    t: 'model.subtableconnection',
    v: { table_id: 'app:todo:b', root_model_id: 0, mount_kind: 'slide_app', owner_principal_id: `${name}-user` },
  });

  assert.equal(replacement.applied, true, `${name}: same Cell should allow replacing subtable index`);
  assert.equal(rt.subtableMounts.has('app:todo:a'), false, `${name}: old subtable index must be removed`);
  assert.equal(rt.subtableMounts.has('app:todo:b'), true, `${name}: new subtable index must be registered`);
  assert.equal(rt.subtableMounts.get('app:todo:b').owner_principal_id, `${name}-user`, `${name}: owner metadata must update`);
}

function testSubtableConnectionMetadataUpdateIsSynchronized(name, Runtime) {
  const rt = new Runtime();
  const host = rt.getModel(0);
  rt.addLabel(host, 8, 0, 0, {
    k: 'model_type',
    t: 'model.subtableconnection',
    v: { table_id: 'app:todo:a', root_model_id: 0, mount_kind: 'slide_app' },
  });

  const beforeEvents = rt.eventLog.list().length;
  const update = rt.addLabel(host, 8, 0, 0, {
    k: 'model_type',
    t: 'model.subtableconnection',
    v: { table_id: 'app:todo:a', root_model_id: 0, mount_kind: 'workspace_app', owner_principal_id: `${name}-user` },
  });

  assert.equal(update.applied, true, `${name}: metadata update should apply`);
  assert.equal(rt.subtableMounts.get('app:todo:a').mount_kind, 'workspace_app', `${name}: mount_kind must update`);
  assert.equal(rt.subtableMounts.get('app:todo:a').owner_principal_id, `${name}-user`, `${name}: owner_principal_id must update`);
  assert.equal(rt.eventLog.list().slice(beforeEvents).some((event) => event.result === 'rejected'), false, `${name}: metadata update must not create rejection events`);
}

function testConnectionIndexCannotChangeTypeInPlace(name, Runtime) {
  const rt = new Runtime();
  const host = rt.getModel(0);
  rt.addLabel(host, 9, 0, 0, { k: 'model_type', t: 'model.submtconnection', v: 500 });

  const subtableReplacement = rt.addLabel(host, 9, 0, 0, {
    k: 'model_type',
    t: 'model.subtableconnection',
    v: { table_id: 'app:todo:cross', root_model_id: 0, mount_kind: 'slide_app' },
  });

  assertRejected(rt, subtableReplacement, 'connection_cell_index_type_change_forbidden', `${name}: connection index type change must be rejected`);
  assert.equal(rt.parentChildMap.has('host|500'), true, `${name}: original child index must remain after rejected type change`);
  assert.equal(rt.subtableMounts.has('app:todo:cross'), false, `${name}: rejected type change must not create subtable index`);

  const secondHost = rt.getModel(0);
  rt.addLabel(secondHost, 10, 0, 0, {
    k: 'model_type',
    t: 'model.subtableconnection',
    v: { table_id: 'app:todo:back', root_model_id: 0, mount_kind: 'slide_app' },
  });
  const submtReplacement = rt.addLabel(secondHost, 10, 0, 0, { k: 'model_type', t: 'model.submtconnection', v: 501 });

  assertRejected(rt, submtReplacement, 'connection_cell_index_type_change_forbidden', `${name}: reverse connection index type change must be rejected`);
  assert.equal(rt.subtableMounts.has('app:todo:back'), true, `${name}: original subtable index must remain after rejected type change`);
  assert.equal(rt.parentChildMap.has('host|501'), false, `${name}: rejected reverse type change must not create child index`);
}

function testSubtableConnectionRejectsDuplicateTableId(name, Runtime) {
  const rt = new Runtime();
  const host = rt.getModel(0);
  rt.addLabel(host, 11, 0, 0, {
    k: 'model_type',
    t: 'model.subtableconnection',
    v: { table_id: 'app:todo:dup', root_model_id: 0, mount_kind: 'slide_app' },
  });

  const duplicate = rt.addLabel(host, 12, 0, 0, {
    k: 'model_type',
    t: 'model.subtableconnection',
    v: { table_id: 'app:todo:dup', root_model_id: 0, mount_kind: 'slide_app' },
  });

  assertRejected(rt, duplicate, 'subtableconnection_table_already_indexed', `${name}: duplicate table_id must be rejected`);
  assert.equal(rt.subtableMounts.get('app:todo:dup').hostingCell.p, 11, `${name}: original table index must remain authoritative`);
}

function testConnectionIndexCannotBeOverwrittenByNonConnectionLabel(name, Runtime) {
  const rt = new Runtime();
  const host = rt.getModel(0);
  rt.addLabel(host, 13, 0, 0, { k: 'model_type', t: 'model.submtconnection', v: 600 });

  const textReplacement = rt.addLabel(host, 13, 0, 0, { k: 'model_type', t: 'str', v: 'not-a-connection' });

  assertRejected(rt, textReplacement, 'connection_cell_index_type_change_forbidden', `${name}: connection index must not be overwritten by data label`);
  assert.equal(rt.parentChildMap.has('host|600'), true, `${name}: original submodel index must remain after rejected data overwrite`);
  assert.equal(host.getCell(13, 0, 0).labels.get('model_type')?.t, 'model.submtconnection', `${name}: relationship label must remain authoritative`);
}

function testConnectionIndexCannotBeOverwrittenByBoundaryPin(name, Runtime) {
  const rt = new Runtime();
  const host = rt.getModel(0);
  rt.addLabel(host, 14, 0, 0, {
    k: 'model_type',
    t: 'model.subtableconnection',
    v: { table_id: 'app:todo:pin-overwrite', root_model_id: 0, mount_kind: 'slide_app' },
  });

  const pinReplacement = rt.addLabel(host, 14, 0, 0, { k: 'model_type', t: 'pin.in', v: null });

  assertRejected(rt, pinReplacement, 'connection_cell_index_type_change_forbidden', `${name}: connection index must not be overwritten by boundary pin`);
  assert.equal(rt.subtableMounts.has('app:todo:pin-overwrite'), true, `${name}: original subtable index must remain after rejected pin overwrite`);
  assert.equal(host.getCell(14, 0, 0).labels.get('model_type')?.t, 'model.subtableconnection', `${name}: relationship label must remain authoritative`);
}

const tests = [
  testChildSubtableDeclarationOnlyOnChildTableRoot,
  testSubtableConnectionRegistersParentSideIndex,
  testSubtableConnectionValueShapeIsStrict,
  testConnectionCellsOnlyAllowBoundaryPins,
  testSubmtDeclarationAndConnectionAreSeparate,
  testSubmtConnectionSingleParent,
  testSubmodelBoundaryPinRelayUsesConnectionLabel,
  testSubtableRootOutputReturnsToConnectionCell,
  testSubmtConnectionReplacementCleansOldIndex,
  testSubtableConnectionReplacementCleansOldIndex,
  testSubtableConnectionMetadataUpdateIsSynchronized,
  testConnectionIndexCannotChangeTypeInPlace,
  testSubtableConnectionRejectsDuplicateTableId,
  testConnectionIndexCannotBeOverwrittenByNonConnectionLabel,
  testConnectionIndexCannotBeOverwrittenByBoundaryPin,
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
