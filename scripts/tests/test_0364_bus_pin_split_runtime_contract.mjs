#!/usr/bin/env node
// 0364 — runtime contract for split control/management bus pins.

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

function mt(k, t, v) {
  return { id: 0, p: 0, r: 0, c: 0, k, t, v };
}

function payload(value = 'hello') {
  return [mt('message_text', 'str', value)];
}

function route({ workerId = 'RE', modelId = 3000, pin = 'submit' } = {}) {
  return {
    to: { worker_id: workerId, model_id: modelId, pin },
    reply_to: { worker_id: 'ui-server-test', model_id: 100, pin: 'result' },
  };
}

function pinPayload({ requestId = 'req_0364', sourceModelId = 100, pin = 'submit', nested = payload(), routeValue = undefined } = {}) {
  const records = [
    mt('__mt_payload_kind', 'str', 'pin_payload.v1'),
    mt('__mt_request_id', 'str', requestId),
    mt('op_id', 'str', requestId),
    mt('source_model_id', 'int', sourceModelId),
    mt('pin', 'str', pin),
    mt('payload', 'json', nested),
    mt('timestamp', 'int', 1),
  ];
  if (routeValue !== undefined) records.push(mt('route', 'json', routeValue));
  return records;
}

function busSendPayload({ bus = null, requestId = 'req_bus_send_0364', busOutKey = 'submit_bus', pin = 'submit', routeValue = route({ pin }) } = {}) {
  const records = [
    mt('__mt_payload_kind', 'str', 'bus_send.v1'),
    mt('__mt_request_id', 'str', requestId),
    mt('source_model_id', 'int', 100),
    mt('pin', 'str', pin),
    mt('bus_out_key', 'str', busOutKey),
    mt('payload', 'json', payload('from_bus_send')),
  ];
  if (routeValue !== undefined) records.push(mt('route', 'json', routeValue));
  if (bus) records.push(mt('bus', 'str', bus));
  return records;
}

function root(rt) {
  return rt.getModel(0);
}

function markRole(rt, value = 'DEM') {
  return rt.addLabel(root(rt), 0, 0, 0, { k: 'sys_worker_role', t: 'worker.role', v: value });
}

function eventReasons(rt) {
  return rt.eventLog.list().map((entry) => entry.reason).filter(Boolean);
}

function test_legacy_bus_pin_types_are_removed() {
  const rt = new ModelTableRuntime();
  markRole(rt, 'DEM');
  const model0 = root(rt);

  const busIn = rt.addLabel(model0, 0, 0, 0, { k: 'old_in', t: 'pin.bus.in', v: null });
  const busOut = rt.addLabel(model0, 0, 0, 0, { k: 'old_out', t: 'pin.bus.out', v: null });

  assert.equal(busIn.applied, false, 'legacy pin.bus.in must be rejected');
  assert.equal(busOut.applied, false, 'legacy pin.bus.out must be rejected');
  assert.equal(model0.getCell(0, 0, 0).labels.has('old_in'), false, 'legacy bus.in must not be stored');
  assert.equal(model0.getCell(0, 0, 0).labels.has('old_out'), false, 'legacy bus.out must not be stored');
  assert.equal(rt.busInPorts.has('old_in'), false, 'legacy bus.in must not register');
  assert.equal(rt.busOutPorts.has('old_out'), false, 'legacy bus.out must not register');
  assert.ok(eventReasons(rt).includes('label_type_removed'), 'legacy bus pin rejection must be explicit');
  return { key: 'legacy_bus_pin_types_are_removed', status: 'PASS' };
}

function test_control_bus_pins_are_root_only_and_route_payloads() {
  const rt = new ModelTableRuntime();
  const model0 = root(rt);
  rt.addLabel(model0, 0, 0, 0, {
    k: 'routing',
    t: 'pin.connect.cell',
    v: [{ from: [0, 0, 0, 'cb_event'], to: [[1, 0, 0, 'cmd']] }],
  });
  rt.addLabel(model0, 1, 0, 0, { k: 'cmd', t: 'pin.in', v: null });

  const declaration = rt.addLabel(model0, 0, 0, 0, { k: 'cb_event', t: 'pin.bus.cb.in', v: null });
  const wrongCell = rt.addLabel(model0, 1, 0, 0, { k: 'bad_cb', t: 'pin.bus.cb.in', v: null });
  const businessPayload = payload('control-message');
  const delivery = rt.addLabel(model0, 0, 0, 0, { k: 'cb_event', t: 'pin.bus.cb.in', v: businessPayload });

  assert.equal(declaration.applied, true, 'control bus in must declare on Model 0 root');
  assert.equal(wrongCell.applied, false, 'control bus pin outside Model 0 root must be rejected');
  assert.equal(delivery.applied, true, 'control bus in must accept temporary ModelTable payloads');
  assert.equal(rt.busInPorts.get('cb_event'), 'pin.bus.cb.in', 'busInPorts must remember the split bus type');
  assert.deepEqual(model0.getCell(1, 0, 0).labels.get('cmd')?.v, businessPayload, 'control bus in must route via pin.connect.cell');
  return { key: 'control_bus_pins_are_root_only_and_route_payloads', status: 'PASS' };
}

function test_management_bus_requires_dem_root() {
  const rt = new ModelTableRuntime();
  const model0 = root(rt);

  const withoutRole = rt.addLabel(model0, 0, 0, 0, { k: 'mb_out', t: 'pin.bus.mb.out', v: null });
  markRole(rt, 'V1N');
  const ordinaryWorker = rt.addLabel(model0, 0, 0, 0, { k: 'mb_in', t: 'pin.bus.mb.in', v: null });
  markRole(rt, 'DEM');
  const demWorker = rt.addLabel(model0, 0, 0, 0, { k: 'mb_out', t: 'pin.bus.mb.out', v: null });

  assert.equal(withoutRole.applied, false, 'management bus pin without DEM role must be rejected');
  assert.equal(ordinaryWorker.applied, false, 'management bus pin on non-DEM worker must be rejected');
  assert.equal(demWorker.applied, true, 'management bus pin on DEM root must be accepted');
  assert.equal(rt.busOutPorts.get('mb_out'), 'pin.bus.mb.out', 'busOutPorts must remember management bus type');
  assert.ok(eventReasons(rt).includes('management_bus_pin_requires_dem'), 'DEM rejection must be explicit');
  return { key: 'management_bus_requires_dem_root', status: 'PASS' };
}

function test_worker_role_replaces_removed_legacy_role_labels() {
  const rt = new ModelTableRuntime();
  const model0 = root(rt);
  const removedRole = rt.addLabel(model0, 0, 0, 0, { k: 'is_DEM', t: 'bool', v: true });
  const removedLegacyKey = rt.addLabel(model0, 0, 0, 0, { k: 'worker.role', t: 'str', v: 'dem' });
  const invalidValue = rt.addLabel(model0, 0, 0, 0, { k: 'sys_worker_role', t: 'worker.role', v: 'admin' });
  const invalidCase = rt.addLabel(model0, 0, 0, 0, { k: 'sys_worker_role', t: 'worker.role', v: 'dem' });
  const invalidType = rt.addLabel(model0, 0, 0, 0, { k: 'sys_worker_role', t: 'str', v: 'DEM' });
  const wrongCell = rt.addLabel(model0, 0, 0, 1, { k: 'sys_worker_role', t: 'worker.role', v: 'DEM' });
  const valid = rt.addLabel(model0, 0, 0, 0, { k: 'sys_worker_role', t: 'worker.role', v: 'DEM' });

  assert.equal(removedRole.applied, false, 'removed is_DEM label must be rejected');
  assert.equal(removedLegacyKey.applied, false, 'legacy worker.role key must be rejected');
  assert.equal(invalidValue.applied, false, 'sys_worker_role must reject unknown roles');
  assert.equal(invalidCase.applied, false, 'sys_worker_role must reject lowercase legacy values');
  assert.equal(invalidType.applied, false, 'sys_worker_role must use worker.role type');
  assert.equal(wrongCell.applied, false, 'sys_worker_role must be on Model 0 root');
  assert.equal(valid.applied, true, 'sys_worker_role=DEM must be accepted on Model 0 root');
  assert.equal(model0.getCell(0, 0, 0).labels.has('is_DEM'), false, 'removed is_DEM label must not be stored');
  assert.equal(model0.getCell(0, 0, 0).labels.has('worker.role'), false, 'legacy worker.role key must not be stored');
  assert.equal(model0.getCell(0, 0, 0).labels.get('sys_worker_role')?.v, 'DEM', 'sys_worker_role must be stored as role truth');
  assert.ok(eventReasons(rt).includes('worker_role_label_removed'), 'removed role rejection must be explicit');
  return { key: 'worker_role_replaces_removed_legacy_role_labels', status: 'PASS' };
}

function test_worker_role_downgrade_is_rejected_when_management_bus_pins_exist() {
  const rt = new ModelTableRuntime();
  const model0 = root(rt);
  const demRole = rt.addLabel(model0, 0, 0, 0, { k: 'sys_worker_role', t: 'worker.role', v: 'DEM' });
  const managementOut = rt.addLabel(model0, 0, 0, 0, { k: 'mb_out', t: 'pin.bus.mb.out', v: null });
  const downgrade = rt.addLabel(model0, 0, 0, 0, { k: 'sys_worker_role', t: 'worker.role', v: 'V1N' });

  assert.equal(demRole.applied, true, 'sys_worker_role=DEM must be accepted');
  assert.equal(managementOut.applied, true, 'DEM must be able to declare management bus output');
  assert.equal(downgrade.applied, false, 'sys_worker_role downgrade must be rejected when management bus pins exist');
  assert.equal(model0.getCell(0, 0, 0).labels.get('sys_worker_role')?.v, 'DEM', 'rejected downgrade must leave DEM role intact');
  assert.ok(
    eventReasons(rt).includes('worker_role_conflicts_with_management_bus_pins'),
    'role downgrade rejection must be explicit',
  );
  return { key: 'worker_role_downgrade_is_rejected_when_management_bus_pins_exist', status: 'PASS' };
}

function test_worker_id_replaces_removed_v1n_id_label() {
  const rt = new ModelTableRuntime();
  const model0 = root(rt);
  const removedLegacyId = rt.addLabel(model0, 0, 0, 0, { k: 'v1n_id', t: 'str', v: '5/10/28/35/13' });
  const invalidType = rt.addLabel(model0, 0, 0, 0, { k: 'sys_worker_id', t: 'str', v: '5/10/28/35/13' });
  const invalidValue = rt.addLabel(model0, 0, 0, 0, { k: 'sys_worker_id', t: 'worker.id', v: 'ui-server' });
  const wrongCell = rt.addLabel(model0, 0, 0, 1, { k: 'sys_worker_id', t: 'worker.id', v: '5/10/28/35/13' });
  const valid = rt.addLabel(model0, 0, 0, 0, { k: 'sys_worker_id', t: 'worker.id', v: '5/10/28/35/13' });
  const locked = rt.addLabel(model0, 0, 0, 0, { k: 'sys_worker_id', t: 'worker.id', v: '5/10/28/35/99' });

  assert.equal(removedLegacyId.applied, false, 'legacy v1n_id must be rejected');
  assert.equal(invalidType.applied, false, 'sys_worker_id must use worker.id type');
  assert.equal(invalidValue.applied, false, 'sys_worker_id must use five numeric segments');
  assert.equal(wrongCell.applied, false, 'sys_worker_id must be on Model 0 root');
  assert.equal(valid.applied, true, 'sys_worker_id must accept five numeric segments on Model 0 root');
  assert.equal(locked.applied, false, 'sys_worker_id must be locked after the first trusted bootstrap value');
  assert.equal(model0.getCell(0, 0, 0).labels.has('v1n_id'), false, 'legacy v1n_id key must not be stored');
  assert.equal(model0.getCell(0, 0, 0).labels.get('sys_worker_id')?.v, '5/10/28/35/13', 'locked worker id must keep original value');
  assert.ok(eventReasons(rt).includes('worker_id_label_removed'), 'removed id rejection must be explicit');
  assert.ok(eventReasons(rt).includes('worker_id_locked'), 'worker id lock rejection must be explicit');
  return { key: 'worker_id_replaces_removed_v1n_id_label', status: 'PASS' };
}

function test_mqtt_bus_in_preserves_declared_split_type() {
  const rt = new ModelTableRuntime();
  markRole(rt, 'DEM');
  const model0 = root(rt);
  rt.addLabel(model0, 0, 0, 0, { k: 'mb_event', t: 'pin.bus.mb.in', v: null });

  const businessPayload = payload('management-message');
  const handled = rt._handleBusInMessage('mb_event', businessPayload);
  const stored = model0.getCell(0, 0, 0).labels.get('mb_event');

  assert.equal(handled, true, 'registered management bus port must accept inbound MQTT payload');
  assert.equal(stored?.t, 'pin.bus.mb.in', 'inbound MQTT must preserve declared split bus type');
  assert.deepEqual(stored?.v, businessPayload, 'inbound MQTT must store the normalized temporary ModelTable payload');
  return { key: 'mqtt_bus_in_preserves_declared_split_type', status: 'PASS' };
}

function test_split_bus_out_requires_route_to_metadata() {
  const rt = new ModelTableRuntime();
  markRole(rt, 'DEM');
  const model0 = root(rt);

  const missingRoute = rt.addLabel(model0, 0, 0, 0, {
    k: 'missing_route_mb_out',
    t: 'pin.bus.mb.out',
    v: pinPayload({ requestId: 'req_missing_route_0364' }),
  });
  const missingTo = rt.addLabel(model0, 0, 0, 0, {
    k: 'missing_to_cb_out',
    t: 'pin.bus.cb.out',
    v: pinPayload({ requestId: 'req_missing_to_0364', routeValue: { reply_to: route().reply_to } }),
  });
  const invalidTo = rt.addLabel(model0, 0, 0, 0, {
    k: 'invalid_to_cb_out',
    t: 'pin.bus.cb.out',
    v: pinPayload({ requestId: 'req_invalid_to_0364', routeValue: { to: { worker_id: '', model_id: -1, pin: 'bad/pin' } } }),
  });
  const valid = rt.addLabel(model0, 0, 0, 0, {
    k: 'valid_mb_out',
    t: 'pin.bus.mb.out',
    v: pinPayload({ requestId: 'req_valid_route_0364', routeValue: route() }),
  });

  assert.equal(missingRoute.applied, false, 'split bus out must reject pin_payload.v1 without route.to');
  assert.equal(missingTo.applied, false, 'split bus out must reject route metadata without route.to');
  assert.equal(invalidTo.applied, false, 'split bus out must reject invalid route.to');
  assert.equal(valid.applied, true, 'split bus out must accept pin_payload.v1 with valid route.to');
  assert.equal(model0.getCell(0, 0, 0).labels.has('missing_route_mb_out'), false, 'route-less management bus out must not be stored');
  assert.equal(model0.getCell(0, 0, 0).labels.has('missing_to_cb_out'), false, 'route metadata without to must not be stored');
  assert.equal(model0.getCell(0, 0, 0).labels.get('valid_mb_out')?.t, 'pin.bus.mb.out', 'valid route bus out remains stored');
  return { key: 'split_bus_out_requires_route_to_metadata', status: 'PASS' };
}

function test_mt_bus_send_selects_declared_bus_family() {
  const rt = new ModelTableRuntime();
  markRole(rt, 'DEM');
  const model0 = root(rt);
  const management = rt._applyBusSendPayload(model0, 0, 0, 0, busSendPayload({ bus: 'management', busOutKey: 'mb_submit_bus' }));
  const managementLabel = model0.getCell(0, 0, 0).labels.get('mb_submit_bus');

  const ordinary = new ModelTableRuntime();
  const ordinaryModel0 = root(ordinary);
  const control = ordinary._applyBusSendPayload(ordinaryModel0, 0, 0, 0, busSendPayload({ bus: 'control', busOutKey: 'cb_submit_bus' }));
  const controlLabel = ordinaryModel0.getCell(0, 0, 0).labels.get('cb_submit_bus');
  const rejectedManagement = ordinary._applyBusSendPayload(ordinaryModel0, 0, 0, 0, busSendPayload({ bus: 'management', busOutKey: 'bad_mb_submit_bus' }));

  assert.equal(management.status, 'ok', 'DEM mt_bus_send must accept management bus request');
  assert.equal(managementLabel?.t, 'pin.bus.mb.out', 'management bus_send must write pin.bus.mb.out');
  assert.equal(control.status, 'ok', 'ordinary worker mt_bus_send must accept control bus request');
  assert.equal(controlLabel?.t, 'pin.bus.cb.out', 'control bus_send must write pin.bus.cb.out');
  assert.equal(rejectedManagement.status, 'rejected', 'ordinary worker must reject management bus request');
  assert.equal(ordinaryModel0.getCell(0, 0, 0).labels.has('bad_mb_submit_bus'), false, 'rejected management bus_send must not store bus out label');
  return { key: 'mt_bus_send_selects_declared_bus_family', status: 'PASS' };
}

const tests = [
  test_legacy_bus_pin_types_are_removed,
  test_control_bus_pins_are_root_only_and_route_payloads,
  test_management_bus_requires_dem_root,
  test_worker_role_replaces_removed_legacy_role_labels,
  test_worker_role_downgrade_is_rejected_when_management_bus_pins_exist,
  test_worker_id_replaces_removed_v1n_id_label,
  test_mqtt_bus_in_preserves_declared_split_type,
  test_split_bus_out_requires_route_to_metadata,
  test_mt_bus_send_selects_declared_bus_family,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    const result = test();
    console.log(`[${result.status}] ${result.key}`);
    passed += 1;
  } catch (error) {
    console.log(`[FAIL] ${test.name}: ${error.stack || error.message}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
