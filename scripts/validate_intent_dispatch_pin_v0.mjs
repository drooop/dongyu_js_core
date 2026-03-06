import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../packages/worker-base/src/runtime.js');
const systemPatch = require('../packages/worker-base/system-models/system_models.json');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--case');
  return idx === -1 ? 'all' : args[idx + 1];
}

function writeBaseConfig(rt) {
  const m0 = rt.getModel(0);
  rt.addLabel(m0, 0, 0, 0, { k: 'mqtt_target_host', t: 'str', v: '127.0.0.1' });
  rt.addLabel(m0, 0, 0, 0, { k: 'mqtt_target_port', t: 'int', v: 1883 });
  rt.addLabel(m0, 0, 0, 0, { k: 'mqtt_target_client_id', t: 'str', v: 'intent-test' });
  rt.addLabel(m0, 0, 0, 0, { k: 'mqtt_topic_mode', t: 'str', v: 'uiput_mm_v1' });
  rt.addLabel(m0, 0, 0, 0, { k: 'mqtt_topic_base', t: 'str', v: 'UIPUT/ws/dam/pic/de/sw' });
}

function getFunctionCode(rt, name) {
  const sys = rt.getModel(-10);
  if (!sys) return null;
  const cell = rt.getCell(sys, 0, 0, 0);
  const label = cell.labels.get(name);
  if (!label) return null;
  const t = typeof label.t === 'string' ? label.t : '';
  if (t !== 'func.js' && t !== 'function') return null;
  if (typeof label.v === 'string') return label.v;
  if (label.v && typeof label.v === 'object' && typeof label.v.code === 'string') return label.v.code;
  return null;
}

function makeCtx(rt) {
  return {
    runtime: rt,
    getLabel: (ref) => {
      if (!ref || !Number.isInteger(ref.model_id)) return null;
      const model = rt.getModel(ref.model_id);
      if (!model) return null;
      const cell = rt.getCell(model, ref.p, ref.r, ref.c);
      return cell.labels.get(ref.k)?.v ?? null;
    },
    writeLabel: (ref, t, v) => {
      if (!ref || !Number.isInteger(ref.model_id)) return;
      const model = rt.getModel(ref.model_id);
      if (!model) return;
      rt.addLabel(model, ref.p, ref.r, ref.c, { k: ref.k, t, v });
    },
    rmLabel: (ref) => {
      if (!ref || !Number.isInteger(ref.model_id)) return;
      const model = rt.getModel(ref.model_id);
      if (!model) return;
      rt.rmLabel(model, ref.p, ref.r, ref.c, ref.k);
    },
    getState: () => null,
    getStateInt: () => null,
    parseJson: (v) => v,
    currentTopic: (pinName, modelId) => {
      const mid = Number.isInteger(modelId) ? modelId : 0;
      const topic = rt._topicFor(mid, pinName);
      return topic || '';
    },
    mqttIncoming: (topic, payload) => rt.mqttIncoming(topic, payload),
    startMqttLoop: () => rt.startMqttLoop(),
    sendMatrix: () => {
      throw new Error('sendMatrix_not_supported_in_unit_test');
    },
    getMgmtOutPayload: () => null,
    getMgmtInTarget: () => null,
    getMgmtInbox: () => null,
    clearMgmtInbox: () => {},
  };
}

function runIntentDispatchOnce(rt) {
  const code = getFunctionCode(rt, 'intent_dispatch');
  assert(code, 'missing_intent_dispatch_function');
  const fn = new Function('ctx', code);
  fn(makeCtx(rt));
}

function caseMgmtPublish() {
  const rt = new ModelTableRuntime();
  rt.applyPatch(systemPatch, { allowCreateModel: true });
  writeBaseConfig(rt);
  rt.createModel({ id: 1, name: 'M1', type: 'data' });

  const payload = { version: 'v0', type: 'snapshot_delta', payload: { version: 'mt.v0', records: [] } };
  const sys = rt.getModel(-10);
  assert(sys, 'system_model_-10_missing');
  rt.addLabel(sys, 0, 0, 0, {
    k: 'intent_job_1',
    t: 'json',
    v: {
      source: { model_id: 1, p: 0, r: 0, c: 0, k: 'intent.v0' },
      intent: { op_id: 'op-1', action: 'mgmt_publish', channel: 'change_out', payload },
    },
  });

  runIntentDispatchOnce(rt);

  const outLabel = rt.getCell(sys, 0, 0, 2).labels.get('change_out');
  assert(outLabel, 'mgmt_publish should write MGMT_OUT label');
  assert(outLabel.t === 'MGMT_OUT', 'mgmt_publish output type should be MGMT_OUT');
  assert(outLabel.v && outLabel.v.type === 'snapshot_delta', 'mgmt_publish output payload mismatch');

  const srcModel = rt.getModel(1);
  const resultLabel = rt.getCell(srcModel, 0, 0, 0).labels.get('intent_result');
  assert(resultLabel && resultLabel.t === 'json', 'intent_result should be written back');
  assert(
    resultLabel.v && (resultLabel.v.result === 'ok' || resultLabel.v.ok === true),
    'intent_result should mark success',
  );

  return { key: 'mgmt_publish_dispatch', status: 'PASS' };
}

function caseMgmtBindIn() {
  const rt = new ModelTableRuntime();
  rt.applyPatch(systemPatch, { allowCreateModel: true });
  writeBaseConfig(rt);
  rt.createModel({ id: 1, name: 'M1', type: 'data' });

  const sys = rt.getModel(-10);
  assert(sys, 'system_model_-10_missing');
  rt.addLabel(sys, 0, 0, 0, {
    k: 'intent_job_1',
    t: 'json',
    v: {
      source: { model_id: 1, p: 0, r: 0, c: 0, k: 'intent.v0' },
      intent: {
        op_id: 'op-2',
        action: 'mgmt_bind_in',
        channel: 'channel_alpha',
        target_ref: { model_id: 1, p: 0, r: 0, c: 0, k: 'inbox' },
      },
    },
  });

  runIntentDispatchOnce(rt);

  const inLabel = rt.getCell(sys, 0, 0, 1).labels.get('channel_alpha');
  assert(inLabel, 'mgmt_bind_in should write MGMT_IN label');
  assert(inLabel.t === 'MGMT_IN', 'mgmt_bind_in output type should be MGMT_IN');
  assert(inLabel.v && inLabel.v.k === 'inbox', 'mgmt_bind_in target_ref mismatch');

  return { key: 'mgmt_bind_in_dispatch', status: 'PASS' };
}

function runAll() {
  return [caseMgmtPublish(), caseMgmtBindIn()];
}

function output(results) {
  console.log('VALIDATION RESULTS');
  for (const row of results) {
    console.log(`${row.key}: ${row.status}`);
  }
}

try {
  const which = parseArgs();
  const results = which === 'mgmt_publish' ? [caseMgmtPublish()] : runAll();
  output(results);
  process.exit(0);
} catch (err) {
  console.error('VALIDATION FAILED');
  console.error(err && err.message ? err.message : String(err));
  process.exit(1);
}
