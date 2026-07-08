import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cjsRuntime = require('../../packages/worker-base/src/runtime.js');
const esmRuntime = await import('../../packages/worker-base/src/runtime.mjs');

const runtimeVariants = [
  ['cjs', cjsRuntime.ModelTableRuntime],
  ['esm', esmRuntime.ModelTableRuntime],
];

const HOST_TABLE = 'host';
const APP_TABLE = 'app_table_0450';
const responseTopic = 'UIPUT/ws/dam/pic/de/U1/2000/result';

function mt(k, t, v, id = 0, p = 0, r = 0, c = 0) {
  return { id, p, r, c, k, t, v };
}

function rootLabel(rt, key) {
  return rt.getModel(0).getCell(0, 0, 0).labels.get(key) || null;
}

function setupRuntime(Runtime) {
  const rt = new Runtime();
  const model0 = rt.getModel(0);
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_topic_mode', t: 'str', v: 'uiput_mm_v1' });
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_topic_base', t: 'str', v: 'UIPUT/ws/dam/pic/de' });
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_worker_id', t: 'str', v: 'U1' });
  rt.addLabel(model0, 0, 0, 0, { k: 'mqtt_payload_mode', t: 'str', v: 'pin_payload_v1' });
  const endpoint = rt.createModel({ id: 2000, name: 'Response Endpoint', type: 'endpoint' });
  const app = rt.createModel({ table_id: APP_TABLE, id: 0, name: 'App Target', type: 'app' });
  rt.addLabel(app, 0, 0, 0, { k: 'model_type', t: 'model.subtable', v: 'UI.App' });
  rt.setRuntimeMode('edit');
  rt.setRuntimeMode('running');
  return { rt, endpoint, app };
}

function responsePacket(rt, overrides = {}) {
  const replyTarget = overrides.replyTarget || {
    worker_id: 'U1',
    table_id: APP_TABLE,
    model_id: 0,
    pin: 'result',
  };
  const records = rt._buildPinPayloadValue({
    opId: overrides.opId || 'it0450_response',
    payload: overrides.payload || [
      mt('materialized_result', 'str', 'remote ok', 1),
      mt('handler_result', 'json', { status: 'accepted', id: 7 }, 1),
      mt('cell_value', 'str', 'cell 0,0,1', 1, 0, 0, 1),
    ],
    payloadModelId: 1,
    endpoint: {
      worker_id: 'U1',
      table_id: HOST_TABLE,
      model_id: 2000,
      pin: 'result',
    },
    origin: {
      worker_id: 'R1',
      table_id: HOST_TABLE,
      model_id: 3000,
      pin: 'resource',
    },
    replyTarget,
    messageRole: 'response',
    topic: responseTopic,
    responseTopic,
    routeKind: 'control',
    bus: 'control',
  });
  return { version: 'v1', type: 'pin_payload', payload: records };
}

async function test_response_materializes_to_app_table_reply_target() {
  for (const [name, Runtime] of runtimeVariants) {
    const { rt, endpoint, app } = setupRuntime(Runtime);

    const accepted = rt.mqttIncoming(responseTopic, responsePacket(rt));

    assert.equal(accepted, true, `${name}: response packet must be accepted`);
    assert.equal(app.getCell(0, 0, 0).labels.get('materialized_result')?.v, 'remote ok', `${name}: root payload materialized`);
    assert.deepEqual(app.getCell(0, 0, 0).labels.get('handler_result')?.v, { status: 'accepted', id: 7 }, `${name}: json payload materialized`);
    assert.equal(app.getCell(0, 0, 1).labels.get('cell_value')?.v, 'cell 0,0,1', `${name}: payload cell coordinates preserved`);
    assert.equal(endpoint.getCell(0, 0, 0).labels.get('result'), undefined, `${name}: response endpoint must not receive pin.in`);
    assert.equal(rootLabel(rt, 'pin_payload_response_materialize_last_result')?.v?.status, 'applied', `${name}: visible materialization status`);
    assert.equal(rootLabel(rt, 'pin_payload_response_materialize_last_result')?.v?.reply_target_table_id, APP_TABLE, `${name}: visible reply target table`);
  }
}

async function test_foreign_reply_target_is_rejected_without_fallback() {
  for (const [name, Runtime] of runtimeVariants) {
    const { rt, app } = setupRuntime(Runtime);

    const accepted = rt.mqttIncoming(responseTopic, responsePacket(rt, {
      replyTarget: {
        worker_id: 'OTHER',
        table_id: APP_TABLE,
        model_id: 0,
        pin: 'result',
      },
      payload: [mt('materialized_result', 'str', 'must not apply', 1)],
    }));

    assert.equal(accepted, false, `${name}: foreign reply target must be rejected`);
    assert.equal(app.getCell(0, 0, 0).labels.get('materialized_result'), undefined, `${name}: foreign response must not materialize`);
    assert.equal(rootLabel(rt, 'pin_payload_response_materialize_last_result')?.v?.status, 'rejected', `${name}: rejection status`);
    assert.equal(rootLabel(rt, 'pin_payload_response_materialize_last_result')?.v?.reason, 'reply_target_worker_mismatch', `${name}: rejection reason`);
  }
}

async function test_missing_reply_target_model_is_rejected_without_host_fallback() {
  for (const [name, Runtime] of runtimeVariants) {
    const { rt } = setupRuntime(Runtime);

    const accepted = rt.mqttIncoming(responseTopic, responsePacket(rt, {
      replyTarget: {
        worker_id: 'U1',
        table_id: 'missing_app_table_0450',
        model_id: 0,
        pin: 'result',
      },
      payload: [mt('materialized_result', 'str', 'must not apply', 1)],
    }));

    assert.equal(accepted, false, `${name}: missing reply target must be rejected`);
    assert.equal(rootLabel(rt, 'pin_payload_response_materialize_last_result')?.v?.status, 'rejected', `${name}: rejection status`);
    assert.equal(rootLabel(rt, 'pin_payload_response_materialize_last_result')?.v?.reason, 'reply_target_model_not_found', `${name}: rejection reason`);
    assert.equal(rt.getModel(0).getCell(0, 0, 0).labels.get('materialized_result'), undefined, `${name}: missing target must not fallback to host root`);
  }
}

async function test_invalid_payload_record_rejects_without_partial_materialization() {
  for (const [name, Runtime] of runtimeVariants) {
    const { rt, app } = setupRuntime(Runtime);

    const accepted = rt.mqttIncoming(responseTopic, responsePacket(rt, {
      payload: [
        mt('materialized_result', 'str', 'must not partially apply', 1),
        mt('model_type', 'model.v1n', '', 1),
      ],
    }));

    assert.equal(accepted, false, `${name}: invalid payload record must reject response`);
    assert.equal(app.getCell(0, 0, 0).labels.get('materialized_result'), undefined, `${name}: rejection must not partially materialize earlier records`);
    assert.equal(rootLabel(rt, 'pin_payload_response_materialize_last_result')?.v?.status, 'rejected', `${name}: rejection status`);
    assert.equal(rootLabel(rt, 'pin_payload_response_materialize_last_result')?.v?.reason, 'reply_target_write_failed', `${name}: rejection reason`);
  }
}

const tests = [
  test_response_materializes_to_app_table_reply_target,
  test_foreign_reply_target_is_rejected_without_fallback,
  test_missing_reply_target_model_is_rejected_without_host_fallback,
  test_invalid_payload_record_rejects_without_partial_materialization,
];

let failed = 0;
for (const test of tests) {
  try {
    await test();
    console.log(`[PASS] ${test.name}`);
  } catch (error) {
    failed += 1;
    console.error(`[FAIL] ${test.name}`);
    console.error(error && error.stack ? error.stack : error);
  }
}

if (failed > 0) {
  console.error(`${failed} failed, ${tests.length - failed} passed out of ${tests.length}`);
  process.exit(1);
}

console.log(`${tests.length} passed, 0 failed out of ${tests.length}`);
