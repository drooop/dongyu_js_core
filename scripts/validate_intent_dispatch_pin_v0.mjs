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

  // Enable multi-model topic routing.
  rt.addLabel(m0, 0, 0, 0, { k: 'mqtt_topic_mode', t: 'str', v: 'uiput_mm_v1' });
  rt.addLabel(m0, 0, 0, 0, { k: 'mqtt_topic_base', t: 'str', v: 'UIPUT/ws/dam/pic/de/sw' });
}

function getFunctionCode(rt, name) {
  const sys = rt.getModel(-10);
  if (!sys) return null;
  const cell = rt.getCell(sys, 0, 0, 0);
  const label = cell.labels.get(name);
  if (!label || label.t !== 'function' || typeof label.v !== 'string') return null;
  return label.v;
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

function casePinRegisterAndSend() {
  const rt = new ModelTableRuntime();
  rt.applyPatch(systemPatch, { allowCreateModel: true });
  writeBaseConfig(rt);
  rt.createModel({ id: 1, name: 'M1', type: 'data' });

  // Start loop before declarations: should subscribe immediately on declare.
  rt.startMqttLoop();

  const sys = rt.getModel(-10);
  assert(sys, 'system_model_-10_missing');
  rt.addLabel(sys, 0, 0, 0, {
    k: 'intent_job_1',
    t: 'json',
    v: {
      source: { model_id: 1, p: 0, r: 0, c: 0, k: 'intent.v0' },
      intent: { op_id: 'op-1', action: 'pin_register', pin_k: 'demo' },
    },
  });
  runIntentDispatchOnce(rt);

  const t1 = 'UIPUT/ws/dam/pic/de/sw/1/demo';
  const sub = rt.mqttTrace.list().find((t) => t.type === 'subscribe' && t.payload.topic === t1);
  assert(sub, 'pin_register should subscribe model topic');

  rt.addLabel(sys, 0, 0, 0, {
    k: 'intent_job_2',
    t: 'json',
    v: {
      source: { model_id: 1, p: 0, r: 0, c: 0, k: 'intent.v0' },
      intent: { op_id: 'op-2', action: 'pin_send_out', pin_k: 'demo', value: { payload: 7 } },
    },
  });
  runIntentDispatchOnce(rt);

  const pub = rt.mqttTrace.list().find((t) => t.type === 'publish' && t.payload.topic === t1);
  assert(pub, 'pin_send_out should publish model topic');

  const inboundOk = rt.mqttIncoming(t1, { t: 'IN', payload: 1 });
  assert(inboundOk, 'mqttIncoming should route to model mailbox');
  const wrote = rt.eventLog.list().some((e) => e.cell.model_id === 1 && e.label.k === 'demo' && e.label.t === 'IN');
  assert(wrote, 'inbound should write IN label into model mailbox');

  return { key: 'pin_register_send', status: 'PASS' };
}

function runAll() {
  return [casePinRegisterAndSend()];
}

function output(results) {
  console.log('VALIDATION RESULTS');
  for (const row of results) {
    console.log(`${row.key}: ${row.status}`);
  }
}

try {
  const which = parseArgs();
  const results = which === 'pin_register_send' ? [casePinRegisterAndSend()] : runAll();
  output(results);
  process.exit(0);
} catch (err) {
  console.error('VALIDATION FAILED');
  console.error(err && err.message ? err.message : String(err));
  process.exit(1);
}
