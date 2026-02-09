import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../packages/worker-base/src/runtime.js');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--case');
  if (idx === -1) {
    return 'all';
  }
  return args[idx + 1];
}

function argsConfig() {
  return {
    host: '127.0.0.1',
    port: 1883,
    client_id: 'client-A',
    username: 'u',
    password: 'p',
    tls: false,
    topic_prefix: '',
  };
}

function writeConfigToPage0(rt, config) {
  const model = rt.getModel(0);
  rt.addLabel(model, 0, 0, 0, { k: 'mqtt_target_host', t: 'str', v: config.host });
  rt.addLabel(model, 0, 0, 0, { k: 'mqtt_target_port', t: 'int', v: config.port });
  rt.addLabel(model, 0, 0, 0, { k: 'mqtt_target_client_id', t: 'str', v: config.client_id });
  rt.addLabel(model, 0, 0, 0, { k: 'mqtt_target_username', t: 'str', v: config.username });
  rt.addLabel(model, 0, 0, 0, { k: 'mqtt_target_password', t: 'str', v: config.password });
  rt.addLabel(model, 0, 0, 0, { k: 'mqtt_target_tls', t: 'bool', v: config.tls });
  rt.addLabel(model, 0, 0, 0, { k: 'mqtt_target_topic_prefix', t: 'str', v: config.topic_prefix });
}

function assertStatus(rt, expected) {
  const intercepts = rt.intercepts.list().filter((item) => item.type === 'mqtt_runtime_status');
  assert(intercepts.length > 0, 'status intercept missing');
  const last = intercepts[intercepts.length - 1];
  assert(last.payload.status === expected, `status should be ${expected}`);
}

function assertPinFlow(rt, prefix) {
  const model = rt.getModel(0);
  const topic = prefix ? `${prefix}/demo` : 'demo';
  // declare pins
  rt.addLabel(model, 0, 0, 1, { k: 'demo', t: 'PIN_IN', v: 'demo' });
  rt.addLabel(model, 0, 0, 1, { k: 'demo', t: 'PIN_OUT', v: 'demo' });

  const trace = rt.mqttTrace.list();
  const subscribed = trace.find((t) => t.type === 'subscribe' && t.payload.topic === topic);
  assert(subscribed, 'PIN_IN should subscribe');

  // inbound message -> mailbox add_label
  const inbound = rt.mqttIncoming(topic, { t: 'IN', payload: 1 });
  assert(inbound, 'mqttIncoming should be handled');
  const events = rt.eventLog.list();
  const mailboxEvent = events.find((e) => e.label.k === 'demo' && e.label.t === 'IN');
  assert(mailboxEvent, 'PIN_IN should write to mailbox');

  // outbound publish
  rt.addLabel(model, 0, 1, 1, { k: 'demo', t: 'OUT', v: { payload: 2 } });
  const published = rt.mqttTrace.list().find((t) => t.type === 'publish' && t.payload.topic === topic);
  assert(published, 'PIN_OUT should publish');
}

function writeMmTopicConfig(rt, base) {
  const model = rt.getModel(0);
  rt.addLabel(model, 0, 0, 0, { k: 'mqtt_topic_mode', t: 'str', v: 'uiput_mm_v1' });
  rt.addLabel(model, 0, 0, 0, { k: 'mqtt_topic_base', t: 'str', v: base });
}

function assertMmTopicFlow(rt, base) {
  const m1 = rt.getModel(1);
  const m2 = rt.getModel(2);
  assert(m1 && m2, 'mm models missing');

  // Declare pins per model (registry cell is per-model in uiput_mm_v1)
  rt.addLabel(m1, 0, 0, 1, { k: 'demo', t: 'PIN_IN', v: 'demo' });
  rt.addLabel(m1, 0, 0, 1, { k: 'demo', t: 'PIN_OUT', v: 'demo' });
  rt.addLabel(m2, 0, 0, 1, { k: 'demo', t: 'PIN_IN', v: 'demo' });
  rt.addLabel(m2, 0, 0, 1, { k: 'demo', t: 'PIN_OUT', v: 'demo' });

  const t1 = `${base}/1/demo`;
  const t2 = `${base}/2/demo`;
  const trace = rt.mqttTrace.list();
  assert(trace.some((t) => t.type === 'subscribe' && t.payload.topic === t1), 'mm model1 should subscribe');
  assert(trace.some((t) => t.type === 'subscribe' && t.payload.topic === t2), 'mm model2 should subscribe');

  // inbound -> mailbox add_label in model2
  const inbound = rt.mqttIncoming(t2, { t: 'IN', payload: 1 });
  assert(inbound, 'mm mqttIncoming should be handled');
  const events = rt.eventLog.list();
  const mailboxEvent = events.find((e) => e.cell.model_id === 2 && e.label.k === 'demo' && e.label.t === 'IN');
  assert(mailboxEvent, 'mm inbound should write to model2 mailbox');

  // outbound publish from model1 mailbox
  rt.addLabel(m1, 0, 1, 1, { k: 'demo', t: 'OUT', v: { payload: 2 } });
  const published = rt.mqttTrace.list().find((t) => t.type === 'publish' && t.payload.topic === t1);
  assert(published, 'mm outbound should publish to model1 topic');
}

function caseArgsOverride() {
  const rt = new ModelTableRuntime();
  const cfg = argsConfig();
  rt.startMqttLoop(cfg);

  const events = rt.eventLog.list();
  const keys = events.map((e) => e.label.k);
  assert(keys.includes('mqtt_target_host'), 'args_override should write host');
  assert(keys.includes('mqtt_target_port'), 'args_override should write port');
  assert(keys.includes('mqtt_target_client_id'), 'args_override should write client_id');

  const snap = rt.snapshot();
  assert(snap.models[0].cells['0,0,0'].labels.mqtt_target_host.v === cfg.host, 'args_override snapshot host');

  const trace = rt.mqttTrace.list();
  const connect = trace.find((t) => t.type === 'connect');
  assert(connect, 'args_override should connect');
  assert(connect.payload.target.host === cfg.host, 'args_override connect target');

  assertStatus(rt, 'running');
  assertPinFlow(rt, cfg.topic_prefix);
  return { key: 'args_override', status: 'PASS' };
}

function caseReadPage0() {
  const rt = new ModelTableRuntime();
  const cfg = argsConfig();
  writeConfigToPage0(rt, cfg);
  rt.eventLog.reset();
  rt.intercepts.reset();
  rt.mqttTrace.reset();

  rt.startMqttLoop();

  const events = rt.eventLog.list();
  const wroteConfig = events.some((e) => e.label.k.startsWith('mqtt_target_'));
  assert(!wroteConfig, 'read_page0 should not override config');

  const trace = rt.mqttTrace.list();
  const connect = trace.find((t) => t.type === 'connect');
  assert(connect, 'read_page0 should connect');
  assert(connect.payload.target.client_id === cfg.client_id, 'read_page0 target client_id');

  assertStatus(rt, 'running');
  assertPinFlow(rt, cfg.topic_prefix);
  return { key: 'read_page0', status: 'PASS' };
}

function caseMissingConfig() {
  const rt = new ModelTableRuntime();
  rt.startMqttLoop();

  const events = rt.eventLog.list();
  const errorCode = events.find((e) => e.label.k === 'mqtt_runtime_error_code');
  const statusLabel = events.find((e) => e.label.k === 'mqtt_runtime_status');
  assert(errorCode, 'missing_config should write error_code');
  assert(statusLabel && statusLabel.label.v === 'failed', 'missing_config status failed');

  const trace = rt.mqttTrace.list();
  assert(trace.length === 0, 'missing_config should not connect');
  assertStatus(rt, 'failed');
  return { key: 'missing_config', status: 'PASS' };
}

function caseMmUiputInOut() {
  const rt = new ModelTableRuntime();
  const cfg = argsConfig();
  writeConfigToPage0(rt, cfg);
  writeMmTopicConfig(rt, 'UIPUT/ws/dam/pic/de/sw');

  rt.createModel({ id: 1, name: 'M1', type: 'data' });
  rt.createModel({ id: 2, name: 'M2', type: 'data' });

  rt.startMqttLoop();
  assertStatus(rt, 'running');
  assertMmTopicFlow(rt, 'UIPUT/ws/dam/pic/de/sw');
  return { key: 'mm_uiput_in_out', status: 'PASS' };
}

function caseMmDeclaredBeforeStart() {
  const rt = new ModelTableRuntime();
  const cfg = argsConfig();
  writeConfigToPage0(rt, cfg);
  writeMmTopicConfig(rt, 'UIPUT/ws/dam/pic/de/sw');

  rt.createModel({ id: 1, name: 'M1', type: 'data' });
  rt.createModel({ id: 2, name: 'M2', type: 'data' });

  // Declare before start; subscriptions should happen on start.
  rt.addLabel(rt.getModel(1), 0, 0, 1, { k: 'demo', t: 'PIN_IN', v: 'demo' });
  rt.addLabel(rt.getModel(2), 0, 0, 1, { k: 'demo', t: 'PIN_IN', v: 'demo' });

  rt.startMqttLoop();
  assertStatus(rt, 'running');
  const base = 'UIPUT/ws/dam/pic/de/sw';
  const t1 = `${base}/1/demo`;
  const t2 = `${base}/2/demo`;
  const trace = rt.mqttTrace.list();
  assert(trace.some((t) => t.type === 'subscribe' && t.payload.topic === t1), 'mm start should subscribe model1');
  assert(trace.some((t) => t.type === 'subscribe' && t.payload.topic === t2), 'mm start should subscribe model2');
  return { key: 'mm_declared_before_start', status: 'PASS' };
}

function caseCellOwnedPinIn() {
  const rt = new ModelTableRuntime();
  const cfg = argsConfig();
  writeConfigToPage0(rt, cfg);
  writeMmTopicConfig(rt, 'UIPUT/ws/dam/pic/de/sw');
  rt.createModel({ id: 2, name: 'M2', type: 'data' });
  const m2 = rt.getModel(2);

  // Cell-owned: PIN_IN declaration routes inbound payload to a declared target cell.
  rt.addLabel(m2, 0, 0, 1, {
    k: 'patch',
    t: 'PIN_IN',
    v: { model_id: 2, p: 2, r: 0, c: 0, k: 'patch_in' },
  });

  rt.startMqttLoop();
  assertStatus(rt, 'running');
  const route = rt.resolvePinInRoute(2, 'patch');
  assert(route.route_mode === 'binding', 'cell-owned route should be binding');
  assert(route.target.model_id === 2 && route.target.p === 2 && route.target.r === 0 && route.target.c === 0, 'cell-owned target mismatch');
  assert(route.target.k === 'patch_in', 'cell-owned target key mismatch');

  const topic = 'UIPUT/ws/dam/pic/de/sw/2/patch';
  const inbound = rt.mqttIncoming(topic, { t: 'IN', payload: { value: 42 } });
  assert(inbound, 'cell-owned mqttIncoming should be handled');

  const events = rt.eventLog.list();
  const targetEvent = events.find((e) => (
    e.cell.model_id === 2 &&
    e.cell.p === 2 &&
    e.cell.r === 0 &&
    e.cell.c === 0 &&
    e.label.k === 'patch_in' &&
    e.label.t === 'IN'
  ));
  assert(targetEvent, 'cell-owned inbound should write to declared target cell');

  const legacyEvent = events.find((e) => (
    e.cell.model_id === 2 &&
    e.cell.p === 0 &&
    e.cell.r === 1 &&
    e.cell.c === 1 &&
    e.label.k === 'patch' &&
    e.label.t === 'IN'
  ));
  assert(!legacyEvent, 'cell-owned route should not write to legacy mailbox');

  const matches = rt.findPinInBindingsForDelivery({ model_id: 2, p: 2, r: 0, c: 0 }, 'patch_in');
  assert(matches.length === 1, 'findPinInBindingsForDelivery should match declared route');
  return { key: 'cell_owned_pin_in', status: 'PASS' };
}

function runAll() {
  const results = [];
  results.push(caseArgsOverride());
  results.push(caseReadPage0());
  results.push(caseMissingConfig());
  results.push(caseCellOwnedPinIn());
  return results;
}

function output(results) {
  console.log('VALIDATION RESULTS');
  for (const row of results) {
    console.log(`${row.key}: ${row.status}`);
  }
}

try {
  const which = parseArgs();
  let results = [];
  if (which === 'args_override') {
    results = [caseArgsOverride()];
  } else if (which === 'read_page0') {
    results = [caseReadPage0()];
  } else if (which === 'missing_config') {
    results = [caseMissingConfig()];
  } else if (which === 'mm_uiput_in_out') {
    results = [caseMmUiputInOut()];
  } else if (which === 'mm_declared_before_start') {
    results = [caseMmDeclaredBeforeStart()];
  } else if (which === 'cell_owned_pin_in') {
    results = [caseCellOwnedPinIn()];
  } else {
    results = runAll();
  }
  output(results);
  process.exit(0);
} catch (err) {
  console.error('VALIDATION FAILED');
  console.error(err.message);
  process.exit(1);
}
