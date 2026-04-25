#!/usr/bin/env node
// 0332 — executable contract for temporary ModelTable pin payloads.
// Covers:
//   (1) mt_write_req accepts write_label.v1 temporary ModelTable payloads
//   (2) mt_write rejects payloads with multiple user labels
//   (3) legacy { op, records } envelopes no longer pass on mt_write_req or old mt_write_in
//   (4) V1N.writeLabel emits through explicit write_label_req -> mt_write_req route only
//   (5) mt_bus_send_in / pin.bus.out use temporary ModelTable payloads internally
//   (6) positive-model pin.in/pin.out reject non-ModelTable values at runtime core

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');

function wait(ms = 160) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function seedTable(modelId) {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  const model = rt.createModel({ id: modelId, name: `it0332_${modelId}`, type: 'test' });
  rt.addLabel(model, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'TestApp' });
  return { rt, model };
}

function mt(k, t, v) {
  return { id: 0, p: 0, r: 0, c: 0, k, t, v };
}

function mtAt({ id = 0, p = 0, r = 0, c = 0 }, k, t, v) {
  return { id, p, r, c, k, t, v };
}

function writeLabelPayload({ target, label, from = { p: 1, r: 0, c: 0 }, requestId = 'req_0332' }) {
  return [
    mt('__mt_payload_kind', 'str', 'write_label.v1'),
    mt('__mt_request_id', 'str', requestId),
    mt('__mt_from_cell', 'json', from),
    mt('__mt_target_cell', 'json', target),
    mt(label.k, label.t, label.v),
  ];
}

function triggerPayload(value = 'go') {
  return [mt('trigger', 'str', value)];
}

function busSendPayload({
  sourceModelId = 100,
  pin = 'submit',
  busOutKey = 'model100_submit_bus',
  payload = [mt('message_text', 'str', 'hello_bus')],
  requestId = 'req_bus_send_0332',
} = {}) {
  return [
    mt('__mt_payload_kind', 'str', 'bus_send.v1'),
    mt('__mt_request_id', 'str', requestId),
    mt('source_model_id', 'int', sourceModelId),
    mt('pin', 'str', pin),
    mt('bus_out_key', 'str', busOutKey),
    mt('payload', 'json', payload),
  ];
}

function getPayloadLabel(payload, key) {
  assert.ok(Array.isArray(payload), `expected payload array, got: ${JSON.stringify(payload)}`);
  return payload.find((rec) => rec && rec.id === 0 && rec.p === 0 && rec.r === 0 && rec.c === 0 && rec.k === key) || null;
}

function assertResult(model, status, errorCode = null, { optional = false } = {}) {
  const result = model.getCell(0, 0, 0).labels.get('mt_write_result');
  if (!result && optional) return;
  assert.ok(result, 'mt_write_result pin.out must be written for auditability');
  assert.equal(result.t, 'pin.out', 'mt_write_result must be pin.out');
  const kindLabel = getPayloadLabel(result.v, '__mt_payload_kind');
  assert.ok(kindLabel, 'mt_write_result must include __mt_payload_kind metadata');
  assert.equal(kindLabel.v, 'write_label_result.v1');
  const requestIdLabel = getPayloadLabel(result.v, '__mt_request_id');
  assert.ok(requestIdLabel, 'mt_write_result must include __mt_request_id metadata');
  const statusLabel = getPayloadLabel(result.v, '__mt_status');
  assert.ok(statusLabel, 'mt_write_result must include __mt_status metadata');
  assert.equal(statusLabel.v, status);
  if (errorCode) {
    const errorLabel = getPayloadLabel(result.v, '__mt_error');
    assert.ok(errorLabel, 'rejected mt_write_result must include __mt_error metadata');
    assert.equal(errorLabel.v && errorLabel.v.code, errorCode);
  }
}

function assertNoPayloadMetadataWrittenToCell(model, p, r, c, userKey) {
  const labels = model.getCell(p, r, c).labels;
  assert.ok(labels.has(userKey), `target cell must contain only intended user label ${userKey}`);
  const forbidden = Array.from(labels.keys()).filter((key) => key.startsWith('__mt_'));
  assert.equal(forbidden.length, 0, `metadata labels must not be materialized to target cell: ${forbidden.join(',')}`);
  assert.deepEqual(Array.from(labels.keys()).sort(), [userKey].sort(), 'target cell must receive exactly one user label');
}

async function test_valid_write_label_payload_writes_one_target_label() {
  const { rt, model } = await seedTable(33201);
  await rt.setRuntimeMode('running');

  rt.addLabel(model, 0, 0, 0, {
    k: 'mt_write_req',
    t: 'pin.in',
    v: writeLabelPayload({
      target: { p: 1, r: 2, c: 0 },
      label: { k: 'status_text', t: 'str', v: 'ok_0332' },
    }),
  });
  await wait();

  const written = model.getCell(1, 2, 0).labels.get('status_text');
  assert.ok(written, 'mt_write_req must write the single user label to target cell');
  assert.equal(written.t, 'str');
  assert.equal(written.v, 'ok_0332');
  assertNoPayloadMetadataWrittenToCell(model, 1, 2, 0, 'status_text');
  assertResult(model, 'ok', null, { optional: true });

  return { key: 'valid_write_label_payload_writes_one_target_label', status: 'PASS' };
}

async function test_multiple_user_labels_are_rejected() {
  const { rt, model } = await seedTable(33202);
  await rt.setRuntimeMode('running');
  const payload = writeLabelPayload({
    target: { p: 1, r: 0, c: 0 },
    label: { k: 'first_label', t: 'str', v: 'first' },
  }).concat([mt('second_label', 'str', 'second')]);

  rt.addLabel(model, 0, 0, 0, { k: 'mt_write_req', t: 'pin.in', v: payload });
  await wait();

  assert.ok(!model.getCell(1, 0, 0).labels.has('first_label'), 'first label must not be written');
  assert.ok(!model.getCell(1, 0, 0).labels.has('second_label'), 'second label must not be written');
  assertResult(model, 'rejected', 'multiple_user_labels');

  return { key: 'multiple_user_labels_are_rejected', status: 'PASS' };
}

async function test_legacy_object_envelope_is_rejected_on_mt_write_req() {
  const { rt, model } = await seedTable(33203);
  await rt.setRuntimeMode('running');

  const result = rt.addLabel(model, 0, 0, 0, {
    k: 'mt_write_req',
    t: 'pin.in',
    v: {
      op: 'write',
      records: [{ p: 1, r: 0, c: 0, k: 'legacy_status', t: 'str', v: 'should_not_write' }],
    },
  });
  await wait();

  assert.equal(result.applied, false, 'legacy object envelope must be rejected by runtime pin payload validation');
  assert.ok(!model.getCell(1, 0, 0).labels.has('legacy_status'), 'legacy object envelope must not write target label');
  assert.notDeepEqual(
    model.getCell(0, 0, 0).labels.get('mt_write_req')?.v,
    { op: 'write', records: [{ p: 1, r: 0, c: 0, k: 'legacy_status', t: 'str', v: 'should_not_write' }] },
    'legacy object envelope must not replace the mt_write_req declaration',
  );

  return { key: 'legacy_object_envelope_is_rejected_on_mt_write_req', status: 'PASS' };
}

async function test_legacy_object_envelope_does_not_pass_old_mt_write_in() {
  const { rt, model } = await seedTable(33204);
  await rt.setRuntimeMode('running');

  rt.addLabel(model, 0, 0, 0, {
    k: 'mt_write_in',
    t: 'pin.in',
    v: {
      op: 'write',
      records: [{ p: 1, r: 0, c: 0, k: 'old_entry_status', t: 'str', v: 'should_not_write' }],
    },
  });
  await wait();

  assert.ok(!model.getCell(1, 0, 0).labels.has('old_entry_status'), 'old mt_write_in object envelope must not write target label');

  return { key: 'legacy_object_envelope_does_not_pass_old_mt_write_in', status: 'PASS' };
}

async function test_write_label_payload_does_not_pass_old_mt_write_in() {
  const { rt, model } = await seedTable(33205);
  await rt.setRuntimeMode('running');

  rt.addLabel(model, 0, 0, 0, {
    k: 'mt_write_in',
    t: 'pin.in',
    v: writeLabelPayload({
      target: { p: 1, r: 0, c: 0 },
      label: { k: 'old_pin_array_status', t: 'str', v: 'should_not_write' },
    }),
  });
  await wait();

  assert.ok(!model.getCell(1, 0, 0).labels.has('old_pin_array_status'), 'old mt_write_in must not accept write_label.v1 arrays as alternate canonical entry');

  return { key: 'write_label_payload_does_not_pass_old_mt_write_in', status: 'PASS' };
}

async function test_write_label_payload_does_not_pass_old_mt_write_in_even_with_legacy_route() {
  const { rt, model } = await seedTable(33206);
  rt.addLabel(model, 0, 0, 0, {
    k: 'legacy_mt_write_route',
    t: 'pin.connect.label',
    v: [{ from: '(self, mt_write_in)', to: ['(func, mt_write:in)'] }],
  });
  await rt.setRuntimeMode('running');

  rt.addLabel(model, 0, 0, 0, {
    k: 'mt_write_in',
    t: 'pin.in',
    v: writeLabelPayload({
      target: { p: 1, r: 0, c: 0 },
      label: { k: 'legacy_route_array_status', t: 'str', v: 'should_not_write' },
    }),
  });
  await wait();

  assert.ok(!model.getCell(1, 0, 0).labels.has('legacy_route_array_status'), 'legacy mt_write_in route must not allow write_label.v1 arrays to write target label');
  assertResult(model, 'rejected', 'invalid_source_pin');

  return { key: 'write_label_payload_does_not_pass_old_mt_write_in_even_with_legacy_route', status: 'PASS' };
}

async function test_malformed_request_id_metadata_is_rejected() {
  const { rt, model } = await seedTable(33207);
  await rt.setRuntimeMode('running');
  const payload = writeLabelPayload({
    target: { p: 1, r: 0, c: 0 },
    label: { k: 'bad_request_id_status', t: 'str', v: 'should_not_write' },
  });
  const requestId = payload.find((rec) => rec.k === '__mt_request_id');
  requestId.t = 'json';
  requestId.v = { bad: true };

  rt.addLabel(model, 0, 0, 0, { k: 'mt_write_req', t: 'pin.in', v: payload });
  await wait();

  assert.ok(!model.getCell(1, 0, 0).labels.has('bad_request_id_status'), 'malformed __mt_request_id metadata must be rejected');
  assertResult(model, 'rejected', 'invalid_payload');

  return { key: 'malformed_request_id_metadata_is_rejected', status: 'PASS' };
}

async function test_malformed_target_cell_metadata_is_rejected() {
  const { rt, model } = await seedTable(33208);
  await rt.setRuntimeMode('running');
  const payload = writeLabelPayload({
    target: { p: 1, r: 0, c: 0 },
    label: { k: 'bad_target_cell_status', t: 'str', v: 'should_not_write' },
  });
  const target = payload.find((rec) => rec.k === '__mt_target_cell');
  target.t = 'str';
  target.v = JSON.stringify(target.v);

  rt.addLabel(model, 0, 0, 0, { k: 'mt_write_req', t: 'pin.in', v: payload });
  await wait();

  assert.ok(!model.getCell(1, 0, 0).labels.has('bad_target_cell_status'), 'malformed __mt_target_cell metadata must be rejected');
  assertResult(model, 'rejected', 'invalid_payload');

  return { key: 'malformed_target_cell_metadata_is_rejected', status: 'PASS' };
}

async function test_write_label_payload_rejects_non_root_temp_records() {
  const { rt, model } = await seedTable(332081);
  await rt.setRuntimeMode('running');
  const payload = writeLabelPayload({
    target: { p: 1, r: 0, c: 0 },
    label: { k: 'non_root_payload_status', t: 'str', v: 'should_not_write' },
  });
  payload[payload.length - 1] = mtAt({ id: 0, p: 1, r: 0, c: 0 }, 'non_root_payload_status', 'str', 'should_not_write');

  rt.addLabel(model, 0, 0, 0, { k: 'mt_write_req', t: 'pin.in', v: payload });
  await wait();

  assert.ok(!model.getCell(1, 0, 0).labels.has('non_root_payload_status'), 'write_label.v1 must reject non-root temporary records');
  assertResult(model, 'rejected', 'invalid_payload');

  return { key: 'write_label_payload_rejects_non_root_temp_records', status: 'PASS' };
}

async function test_write_label_payload_rejects_nonzero_temp_model_ids() {
  const { rt, model } = await seedTable(332082);
  await rt.setRuntimeMode('running');
  const payload = writeLabelPayload({
    target: { p: 1, r: 0, c: 0 },
    label: { k: 'nonzero_model_payload_status', t: 'str', v: 'should_not_write' },
  });
  payload[payload.length - 1] = mtAt({ id: 1, p: 0, r: 0, c: 0 }, 'nonzero_model_payload_status', 'str', 'should_not_write');

  rt.addLabel(model, 0, 0, 0, { k: 'mt_write_req', t: 'pin.in', v: payload });
  await wait();

  assert.ok(!model.getCell(1, 0, 0).labels.has('nonzero_model_payload_status'), 'write_label.v1 must reject records outside temporary model id 0');
  assertResult(model, 'rejected', 'invalid_payload');

  return { key: 'write_label_payload_rejects_nonzero_temp_model_ids', status: 'PASS' };
}

async function test_v1n_write_label_without_route_does_not_direct_write() {
  const { rt, model } = await seedTable(33209);

  rt.addLabel(model, 1, 0, 0, {
    k: 'writer',
    t: 'func.js',
    v: { code: "V1N.writeLabel(2, 0, 0, { k: 'no_route_label', t: 'str', v: 'must_not_direct_write' }); return;" },
  });
  rt.addLabel(model, 1, 0, 0, { k: 'writer_in', t: 'pin.in', v: null });
  rt.addLabel(model, 1, 0, 0, {
    k: 'writer_wiring',
    t: 'pin.connect.label',
    v: [{ from: '(self, writer_in)', to: ['(func, writer:in)'] }],
  });

  await rt.setRuntimeMode('running');
  rt.addLabel(model, 1, 0, 0, { k: 'writer_in', t: 'pin.in', v: triggerPayload() });
  await wait(220);

  const emitted = model.getCell(1, 0, 0).labels.get('write_label_req');
  assert.ok(emitted, 'V1N.writeLabel must still emit write_label_req on the running cell');
  const rootReq = model.getCell(0, 0, 0).labels.get('mt_write_req');
  assert.ok(rootReq, 'root mt_write_req declaration may exist before payload delivery');
  assert.equal(rootReq.v, null, 'without pin.connect.cell route, root mt_write_req declaration value must remain empty');
  assert.ok(!model.getCell(2, 0, 0).labels.has('no_route_label'), 'V1N.writeLabel must not directly write target cell without explicit route');
  const error = model.getCell(1, 0, 0).labels.get('__error_write_label');
  assert.ok(error, 'missing write_label_req route must write visible __error_write_label on the running cell');
  assert.equal(error.t, 'json');
  assert.equal(error.v && error.v.error, 'write_label_route_missing');

  return { key: 'v1n_write_label_without_route_does_not_direct_write', status: 'PASS' };
}

async function test_v1n_write_label_does_not_write_when_root_mt_write_function_is_absent() {
  const { rt, model } = await seedTable(33210);

  rt.addLabel(model, 0, 0, 0, {
    k: 'write_label_route',
    t: 'pin.connect.cell',
    v: [{ from: [1, 0, 0, 'write_label_req'], to: [[0, 0, 0, 'mt_write_req']] }],
  });
  rt.rmLabel(model, 0, 0, 0, 'mt_write');
  assert.ok(!model.getCell(0, 0, 0).labels.has('mt_write'), 'test setup must remove D0 mt_write function');
  rt.addLabel(model, 1, 0, 0, {
    k: 'writer',
    t: 'func.js',
    v: { code: "V1N.writeLabel(2, 0, 0, { k: 'disabled_root_label', t: 'str', v: 'must_not_direct_write' }); return;" },
  });
  rt.addLabel(model, 1, 0, 0, { k: 'writer_in', t: 'pin.in', v: null });
  rt.addLabel(model, 1, 0, 0, {
    k: 'writer_wiring',
    t: 'pin.connect.label',
    v: [{ from: '(self, writer_in)', to: ['(func, writer:in)'] }],
  });

  await rt.setRuntimeMode('running');
  rt.addLabel(model, 1, 0, 0, { k: 'writer_in', t: 'pin.in', v: triggerPayload() });
  await wait(220);

  const emitted = model.getCell(1, 0, 0).labels.get('write_label_req');
  assert.ok(emitted, 'V1N.writeLabel must emit write_label_req on the running cell');
  assert.equal(emitted.t, 'pin.out');
  assert.equal(getPayloadLabel(emitted.v, '__mt_payload_kind').v, 'write_label.v1');

  const routed = model.getCell(0, 0, 0).labels.get('mt_write_req');
  assert.ok(routed, 'pin.connect.cell route must materialize payload on root mt_write_req');
  assert.equal(routed.t, 'pin.in');
  assert.deepEqual(routed.v, emitted.v, 'root mt_write_req payload must match emitted write_label_req payload');
  assert.ok(!model.getCell(2, 0, 0).labels.has('disabled_root_label'), 'target must remain unchanged when root mt_write function is absent');

  return { key: 'v1n_write_label_does_not_write_when_root_mt_write_function_is_absent', status: 'PASS' };
}

async function test_v1n_write_label_routes_through_explicit_pin_connection() {
  const { rt, model } = await seedTable(33211);

  rt.addLabel(model, 0, 0, 0, {
    k: 'write_label_route',
    t: 'pin.connect.cell',
    v: [{ from: [1, 0, 0, 'write_label_req'], to: [[0, 0, 0, 'mt_write_req']] }],
  });
  rt.addLabel(model, 1, 0, 0, {
    k: 'writer',
    t: 'func.js',
    v: { code: "V1N.writeLabel(2, 0, 0, { k: 'via_v1n', t: 'str', v: 'routed' }); return;" },
  });
  rt.addLabel(model, 1, 0, 0, { k: 'writer_in', t: 'pin.in', v: null });
  rt.addLabel(model, 1, 0, 0, {
    k: 'writer_wiring',
    t: 'pin.connect.label',
    v: [{ from: '(self, writer_in)', to: ['(func, writer:in)'] }],
  });

  await rt.setRuntimeMode('running');
  rt.addLabel(model, 1, 0, 0, { k: 'writer_in', t: 'pin.in', v: triggerPayload() });
  await wait(220);

  const emitted = model.getCell(1, 0, 0).labels.get('write_label_req');
  assert.ok(emitted, 'V1N.writeLabel must emit write_label_req on the running cell');
  assert.equal(emitted.t, 'pin.out');
  assert.equal(getPayloadLabel(emitted.v, '__mt_payload_kind').v, 'write_label.v1');

  const routed = model.getCell(0, 0, 0).labels.get('mt_write_req');
  assert.ok(routed, 'pin.connect.cell route must materialize payload on root mt_write_req');
  assert.equal(routed.t, 'pin.in');
  assert.deepEqual(routed.v, emitted.v, 'root mt_write_req payload must match emitted write_label_req payload');
  assert.ok(rt.eventLog.list().some((entry) =>
    entry.op === 'add_label' &&
    entry.cell &&
    entry.cell.model_id === model.id &&
    entry.cell.p === 0 &&
    entry.cell.r === 0 &&
    entry.cell.c === 0 &&
    entry.label &&
    entry.label.k === 'mt_write_req' &&
    entry.label.t === 'pin.in'
  ), 'event log must show pin.connect.cell wrote root mt_write_req');

  const written = model.getCell(2, 0, 0).labels.get('via_v1n');
  assert.ok(written, 'explicit write_label_req route must reach mt_write_req and write target label');
  assert.equal(written.v, 'routed');
  assertNoPayloadMetadataWrittenToCell(model, 2, 0, 0, 'via_v1n');
  assertResult(model, 'ok', null, { optional: true });

  return { key: 'v1n_write_label_routes_through_explicit_pin_connection', status: 'PASS' };
}

async function test_mt_bus_send_uses_temporary_payload_and_externalizes_bus_out() {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  const model0 = rt.getModel(0);
  rt.startMqttLoop({
    host: 'localhost',
    port: 1883,
    client_id: '0332-bus-send',
    topic_prefix: 'it0332',
    transport: 'mock',
  });
  await rt.setRuntimeMode('running');

  const nestedPayload = [mt('message_text', 'str', 'hello_bus')];
  rt.addLabel(model0, 0, 0, 0, {
    k: 'mt_bus_send_in',
    t: 'pin.in',
    v: busSendPayload({
      sourceModelId: 100,
      pin: 'submit',
      busOutKey: 'model100_submit_bus',
      payload: nestedPayload,
      requestId: 'req_bus_send_success_0332',
    }),
  });
  await wait();

  const busLabel = model0.getCell(0, 0, 0).labels.get('model100_submit_bus');
  assert.ok(busLabel, 'mt_bus_send must materialize requested Model 0 bus out label');
  assert.equal(busLabel.t, 'pin.bus.out', 'mt_bus_send output must be pin.bus.out');
  assert.ok(Array.isArray(busLabel.v), 'pin.bus.out business value must be temporary ModelTable payload array');
  assert.equal(getPayloadLabel(busLabel.v, '__mt_payload_kind')?.v, 'pin_payload.v1');
  assert.equal(getPayloadLabel(busLabel.v, 'source_model_id')?.v, 100);
  assert.equal(getPayloadLabel(busLabel.v, 'pin')?.v, 'submit');
  assert.deepEqual(getPayloadLabel(busLabel.v, 'payload')?.v, nestedPayload);

  const publish = rt.mqttTrace.list().find((entry) =>
    entry.type === 'publish' &&
    entry.payload?.topic === 'it0332/model100_submit_bus'
  );
  assert.ok(publish, 'pin.bus.out must still publish an external transport packet');
  assert.equal(publish.payload?.payload?.type, 'pin_payload', 'external transport packet must stay pin_payload');
  assert.equal(publish.payload?.payload?.source_model_id, 100);
  assert.deepEqual(publish.payload?.payload?.payload, nestedPayload);
  return { key: 'mt_bus_send_uses_temporary_payload_and_externalizes_bus_out', status: 'PASS' };
}

async function test_mt_bus_send_rejects_legacy_object_request() {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  const model0 = rt.getModel(0);
  await rt.setRuntimeMode('running');
  rt.addLabel(model0, 0, 0, 0, {
    k: 'mt_bus_send_in',
    t: 'pin.in',
    v: {
      source_model_id: 100,
      pin: 'submit',
      bus_out_key: 'legacy_submit_bus',
      payload: [mt('message_text', 'str', 'legacy_bus')],
    },
  });
  await wait();
  assert.ok(!model0.getCell(0, 0, 0).labels.has('legacy_submit_bus'), 'legacy mt_bus_send object request must not create bus out label');
  return { key: 'mt_bus_send_rejects_legacy_object_request', status: 'PASS' };
}

async function test_pin_bus_out_rejects_legacy_object_internal_value() {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  const model0 = rt.getModel(0);
  rt.startMqttLoop({
    host: 'localhost',
    port: 1883,
    client_id: '0332-bus-out-reject',
    topic_prefix: 'it0332',
    transport: 'mock',
  });
  await rt.setRuntimeMode('running');
  const result = rt.addLabel(model0, 0, 0, 0, {
    k: 'legacy_object_bus_out',
    t: 'pin.bus.out',
    v: {
      version: 'v1',
      type: 'pin_payload',
      op_id: 'legacy_object_bus_out_0332',
      source_model_id: 100,
      pin: 'submit',
      payload: [mt('message_text', 'str', 'must_not_publish')],
    },
  });
  await wait();
  assert.equal(result.applied, false, 'legacy object pin.bus.out value must be rejected');
  assert.ok(!model0.getCell(0, 0, 0).labels.has('legacy_object_bus_out'), 'legacy object pin.bus.out value must not be stored');
  assert.ok(!rt.mqttTrace.list().some((entry) =>
    entry.type === 'publish' &&
    entry.payload?.topic === 'it0332/legacy_object_bus_out'
  ), 'legacy object pin.bus.out value must not publish to MQTT');
  return { key: 'pin_bus_out_rejects_legacy_object_internal_value', status: 'PASS' };
}

async function test_pin_bus_in_rejects_non_modeltable_internal_values() {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  const model0 = rt.getModel(0);
  await rt.setRuntimeMode('running');
  const objectResult = rt.addLabel(model0, 0, 0, 0, {
    k: 'legacy_object_bus_in',
    t: 'pin.bus.in',
    v: { action: 'submit', value: 'must_not_route' },
  });
  const stringResult = rt.addLabel(model0, 0, 0, 0, {
    k: 'legacy_string_bus_in',
    t: 'pin.bus.in',
    v: 'must_not_route',
  });
  assert.equal(objectResult.applied, false, 'legacy object pin.bus.in value must be rejected');
  assert.equal(stringResult.applied, false, 'legacy string pin.bus.in value must be rejected');
  assert.ok(!model0.getCell(0, 0, 0).labels.has('legacy_object_bus_in'), 'legacy object pin.bus.in value must not be stored');
  assert.ok(!model0.getCell(0, 0, 0).labels.has('legacy_string_bus_in'), 'legacy string pin.bus.in value must not be stored');
  return { key: 'pin_bus_in_rejects_non_modeltable_internal_values', status: 'PASS' };
}

async function test_positive_model_pins_reject_non_modeltable_internal_values() {
  const { rt, model } = await seedTable(3372);
  await rt.setRuntimeMode('running');
  const invalidIn = rt.addLabel(model, 0, 0, 0, {
    k: 'legacy_object_pin_in',
    t: 'pin.in',
    v: { action: 'submit', value: 'must_not_route' },
  });
  const invalidOut = rt.addLabel(model, 1, 0, 0, {
    k: 'legacy_string_pin_out',
    t: 'pin.out',
    v: 'must_not_route',
  });
  const validIn = rt.addLabel(model, 0, 0, 0, {
    k: 'modeltable_pin_in',
    t: 'pin.in',
    v: [mt('input_value', 'str', 'ok')],
  });
  const declaration = rt.addLabel(model, 1, 0, 0, {
    k: 'declared_pin_out',
    t: 'pin.out',
    v: null,
  });

  assert.equal(invalidIn.applied, false, 'positive model pin.in object value must be rejected');
  assert.equal(invalidOut.applied, false, 'positive model pin.out string value must be rejected');
  assert.equal(validIn.applied, true, 'positive model pin.in temporary ModelTable value must be accepted');
  assert.equal(declaration.applied, true, 'positive model pin.out null declaration must stay valid');
  assert.ok(!model.getCell(0, 0, 0).labels.has('legacy_object_pin_in'), 'invalid positive pin.in value must not be stored');
  assert.ok(!model.getCell(1, 0, 0).labels.has('legacy_string_pin_out'), 'invalid positive pin.out value must not be stored');
  assert.deepEqual(model.getCell(0, 0, 0).labels.get('modeltable_pin_in')?.v, [mt('input_value', 'str', 'ok')]);
  return { key: 'positive_model_pins_reject_non_modeltable_internal_values', status: 'PASS' };
}

async function test_positive_model_pins_accept_multicell_modeltable_payloads() {
  const { rt, model } = await seedTable(3373);
  await rt.setRuntimeMode('running');
  const payload = [
    mt('root_value', 'str', 'root_ok'),
    mtAt({ id: 0, p: 0, r: 0, c: 1 }, 'column_value', 'str', 'c1_ok'),
    mtAt({ id: 1, p: 0, r: 1, c: 0 }, 'second_model_value', 'json', { ok: true }),
  ];
  const result = rt.addLabel(model, 0, 0, 0, {
    k: 'multicell_modeltable_pin_in',
    t: 'pin.in',
    v: payload,
  });

  assert.equal(result.applied, true, 'positive model pin.in must accept documented multi-cell temporary ModelTable payloads');
  assert.deepEqual(model.getCell(0, 0, 0).labels.get('multicell_modeltable_pin_in')?.v, payload);
  return { key: 'positive_model_pins_accept_multicell_modeltable_payloads', status: 'PASS' };
}

async function test_log_pins_keep_log_data_values() {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  const model0 = rt.getModel(0);
  const model = rt.createModel({ id: 3374, name: 'it0332_3374', type: 'test' });
  rt.addLabel(model, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'TestApp' });
  await rt.setRuntimeMode('running');

  const modelLogIn = rt.addLabel(model, 0, 0, 0, {
    k: 'activity_log_in',
    t: 'pin.log.in',
    v: { level: 'info', message: 'model log in' },
  });
  const modelLogOut = rt.addLabel(model, 1, 0, 0, {
    k: 'activity_log_out',
    t: 'pin.log.out',
    v: 'model log out',
  });
  const busLogIn = rt.addLabel(model0, 0, 0, 0, {
    k: 'system_log_in',
    t: 'pin.log.bus.in',
    v: { level: 'info', message: 'bus log in' },
  });
  const busLogOut = rt.addLabel(model0, 0, 0, 0, {
    k: 'system_log_out',
    t: 'pin.log.bus.out',
    v: 'bus log out',
  });

  assert.equal(modelLogIn.applied, true, 'positive model pin.log.in must accept log data');
  assert.equal(modelLogOut.applied, true, 'positive model pin.log.out must accept log data');
  assert.equal(busLogIn.applied, true, 'Model 0 pin.log.bus.in must accept log data');
  assert.equal(busLogOut.applied, true, 'Model 0 pin.log.bus.out must accept log data');
  assert.deepEqual(model.getCell(0, 0, 0).labels.get('activity_log_in')?.v, { level: 'info', message: 'model log in' });
  assert.equal(model.getCell(1, 0, 0).labels.get('activity_log_out')?.v, 'model log out');
  assert.deepEqual(model0.getCell(0, 0, 0).labels.get('system_log_in')?.v, { level: 'info', message: 'bus log in' });
  assert.equal(model0.getCell(0, 0, 0).labels.get('system_log_out')?.v, 'bus log out');

  return { key: 'log_pins_keep_log_data_values', status: 'PASS' };
}

async function test_negative_system_pins_allow_internal_control_values() {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  const sys = rt.getModel(-10) || rt.createModel({ id: -10, name: 'system_helper_0332', type: 'system' });
  const objectIn = rt.addLabel(sys, 0, 0, 0, {
    k: 'helper_object_pin',
    t: 'pin.in',
    v: { click: true },
  });
  const stringOut = rt.addLabel(sys, 0, 0, 0, {
    k: 'helper_string_pin',
    t: 'pin.out',
    v: 'internal-control',
  });

  assert.equal(objectIn.applied, true, 'negative/system pin.in object control value must remain compatible');
  assert.equal(stringOut.applied, true, 'negative/system pin.out string control value must remain compatible');
  assert.deepEqual(sys.getCell(0, 0, 0).labels.get('helper_object_pin')?.v, { click: true });
  assert.equal(sys.getCell(0, 0, 0).labels.get('helper_string_pin')?.v, 'internal-control');
  return { key: 'negative_system_pins_allow_internal_control_values', status: 'PASS' };
}

async function test_mqtt_bus_in_pin_payload_v1_converts_to_temporary_payload() {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  const model0 = rt.getModel(0);
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_payload_mode', t: 'str', v: 'pin_payload_v1' });
  rt.addLabel(model0, 0, 0, 0, { k: 'ui_submit', t: 'pin.bus.in', v: null });
  rt.startMqttLoop({
    host: 'localhost',
    port: 1883,
    client_id: '0332-bus-in-mqtt',
    topic_prefix: 'it0332',
    transport: 'mock',
  });
  await rt.setRuntimeMode('running');

  const nestedPayload = writeLabelPayload({
    target: { p: 1, r: 0, c: 0 },
    label: { k: 'submit_request', t: 'pin.in', v: [mt('event_text', 'str', 'from_mqtt')] },
    requestId: 'req_bus_in_mqtt_0332',
  });
  const accepted = rt.mqttIncoming('it0332/ui_submit', {
    version: 'v1',
    type: 'pin_payload',
    op_id: 'req_bus_in_mqtt_transport_0332',
    source_model_id: 100,
    pin: 'ui_submit',
    payload: nestedPayload,
    timestamp: Date.now(),
  });
  assert.equal(accepted, true, 'MQTT pin_payload_v1 bus.in packet must be accepted');
  const storedLabel = model0.getCell(0, 0, 0).labels.get('ui_submit');
  assert.equal(storedLabel?.t, 'pin.bus.in', 'MQTT bus.in short-circuit must preserve pin.bus.in type');
  assert.deepEqual(storedLabel?.v, nestedPayload, 'Model 0 bus.in must store only the nested temporary ModelTable payload');
  return { key: 'mqtt_bus_in_pin_payload_v1_converts_to_temporary_payload', status: 'PASS' };
}

async function test_uiput_mm_v1_bus_in_pin_payload_v1_converts_to_temporary_payload() {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  const model0 = rt.getModel(0);
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_topic_mode', t: 'str', v: 'uiput_mm_v1' });
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_topic_base', t: 'str', v: 'UIPUT/ws/dam/pic/de/sw' });
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_payload_mode', t: 'str', v: 'pin_payload_v1' });
  rt.addLabel(model0, 0, 0, 0, { k: 'ui_submit', t: 'pin.bus.in', v: null });
  rt.startMqttLoop({
    host: 'localhost',
    port: 1883,
    client_id: '0332-bus-in-mqtt-mm',
    topic_base: 'UIPUT/ws/dam/pic/de/sw',
    topic_mode: 'uiput_mm_v1',
    payload_mode: 'pin_payload_v1',
    transport: 'mock',
  });
  await rt.setRuntimeMode('running');

  const nestedPayload = writeLabelPayload({
    target: { p: 1, r: 0, c: 0 },
    label: { k: 'submit_request', t: 'pin.in', v: [mt('event_text', 'str', 'from_mqtt_mm')] },
    requestId: 'req_bus_in_mqtt_mm_0332',
  });
  const accepted = rt.mqttIncoming('UIPUT/ws/dam/pic/de/sw/0/ui_submit', {
    version: 'v1',
    type: 'pin_payload',
    op_id: 'req_bus_in_mqtt_mm_transport_0332',
    source_model_id: 100,
    pin: 'ui_submit',
    payload: nestedPayload,
    timestamp: Date.now(),
  });
  assert.equal(accepted, true, 'uiput_mm_v1 Model 0 bus.in pin_payload_v1 packet must be accepted');
  const storedLabel = model0.getCell(0, 0, 0).labels.get('ui_submit');
  assert.equal(storedLabel?.t, 'pin.bus.in', 'uiput_mm_v1 bus.in must preserve pin.bus.in type');
  assert.deepEqual(storedLabel?.v, nestedPayload, 'uiput_mm_v1 Model 0 bus.in must store only the nested temporary ModelTable payload');
  return { key: 'uiput_mm_v1_bus_in_pin_payload_v1_converts_to_temporary_payload', status: 'PASS' };
}

async function test_mqtt_bus_in_pin_payload_v1_rejects_mismatched_pin() {
  const rt = new ModelTableRuntime();
  await rt.setRuntimeMode('edit');
  const model0 = rt.getModel(0);
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_payload_mode', t: 'str', v: 'pin_payload_v1' });
  rt.addLabel(model0, 0, 0, 0, { k: 'ui_submit', t: 'pin.bus.in', v: null });
  rt.startMqttLoop({
    host: 'localhost',
    port: 1883,
    client_id: '0332-bus-in-mqtt-mismatch',
    topic_prefix: 'it0332',
    transport: 'mock',
  });
  await rt.setRuntimeMode('running');

  const nestedPayload = writeLabelPayload({
    target: { p: 1, r: 0, c: 0 },
    label: { k: 'submit_request', t: 'pin.in', v: [mt('event_text', 'str', 'wrong_pin')] },
    requestId: 'req_bus_in_mqtt_mismatch_0332',
  });
  const accepted = rt.mqttIncoming('it0332/ui_submit', {
    version: 'v1',
    type: 'pin_payload',
    op_id: 'req_bus_in_mqtt_mismatch_transport_0332',
    source_model_id: 100,
    pin: 'other_pin',
    payload: nestedPayload,
    timestamp: Date.now(),
  });
  assert.equal(accepted, false, 'MQTT pin_payload_v1 packet pin must match the target bus port');
  const storedLabel = model0.getCell(0, 0, 0).labels.get('ui_submit');
  assert.equal(storedLabel?.v ?? null, null, 'mismatched pin_payload_v1 packet must not overwrite Model 0 bus.in value');
  return { key: 'mqtt_bus_in_pin_payload_v1_rejects_mismatched_pin', status: 'PASS' };
}

const tests = [
  test_valid_write_label_payload_writes_one_target_label,
  test_multiple_user_labels_are_rejected,
  test_legacy_object_envelope_is_rejected_on_mt_write_req,
  test_legacy_object_envelope_does_not_pass_old_mt_write_in,
  test_write_label_payload_does_not_pass_old_mt_write_in,
  test_write_label_payload_does_not_pass_old_mt_write_in_even_with_legacy_route,
  test_malformed_request_id_metadata_is_rejected,
  test_malformed_target_cell_metadata_is_rejected,
  test_write_label_payload_rejects_non_root_temp_records,
  test_write_label_payload_rejects_nonzero_temp_model_ids,
  test_v1n_write_label_without_route_does_not_direct_write,
  test_v1n_write_label_does_not_write_when_root_mt_write_function_is_absent,
  test_v1n_write_label_routes_through_explicit_pin_connection,
  test_mt_bus_send_uses_temporary_payload_and_externalizes_bus_out,
  test_mt_bus_send_rejects_legacy_object_request,
  test_pin_bus_out_rejects_legacy_object_internal_value,
  test_pin_bus_in_rejects_non_modeltable_internal_values,
  test_positive_model_pins_reject_non_modeltable_internal_values,
  test_positive_model_pins_accept_multicell_modeltable_payloads,
  test_log_pins_keep_log_data_values,
  test_negative_system_pins_allow_internal_control_values,
  test_mqtt_bus_in_pin_payload_v1_converts_to_temporary_payload,
  test_uiput_mm_v1_bus_in_pin_payload_v1_converts_to_temporary_payload,
  test_mqtt_bus_in_pin_payload_v1_rejects_mismatched_pin,
];

(async () => {
  let passed = 0;
  let failed = 0;
  for (const t of tests) {
    try {
      const result = await t();
      console.log(`[${result.status}] ${result.key}`);
      passed += 1;
    } catch (err) {
      console.log(`[FAIL] ${t.name}: ${err.message}`);
      failed += 1;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
  process.exit(failed > 0 ? 1 : 0);
})();
