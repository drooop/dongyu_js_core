import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createLoopbackAdapter } = require('../packages/bus-mgmt/src/loopback.js');
const { createMatrixLiveAdapter } = require('../packages/bus-mgmt/src/matrix_live.js');
const { createMbrBridge } = require('../packages/mbr/src/mbr_v0.js');
const { ModelTableRuntime } = require('../packages/worker-base/src/runtime.js');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--case');
  const which = idx === -1 ? 'all' : args[idx + 1];
  const roomIdIdx = args.indexOf('--matrix_room_id');
  const roomAliasIdx = args.indexOf('--matrix_room_alias');
  const timeoutIdx = args.indexOf('--timeout_ms');
  return {
    which,
    roomId: roomIdIdx === -1 ? null : args[roomIdIdx + 1],
    roomAlias: roomAliasIdx === -1 ? null : args[roomAliasIdx + 1],
    timeoutMs: timeoutIdx === -1 ? 15000 : Number(args[timeoutIdx + 1]),
  };
}

function caseMgmtLoopback() {
  const adapter = createLoopbackAdapter();
  let received = null;
  adapter.subscribe((event) => {
    received = event;
  });

  const event = {
    version: 'v0',
    type: 'ui_event',
    op_id: 'op-1',
    payload: { action: 'noop' },
  };

  const res = adapter.publish(event);
  assert(res && res.ok, 'loopback_publish_failed');
  assert(received && received.op_id === 'op-1', 'loopback_receive_failed');

  return { key: 'mgmt_loopback', status: 'PASS' };
}

async function waitForCondition(check, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (check()) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

async function caseMgmtMatrixLive(args) {
  const adapter = await createMatrixLiveAdapter({
    roomId: args.roomId,
    roomAlias: args.roomAlias,
    syncTimeoutMs: args.timeoutMs,
  });

  const opId = `op-${Date.now()}`;
  let received = null;

  adapter.subscribe((event) => {
    if (event && event.op_id === opId) {
      received = event;
    }
  });

  const event = {
    version: 'v0',
    type: 'ui_event',
    op_id: opId,
    payload: { action: 'noop' },
  };

  const res = await adapter.publish(event);
  assert(res && res.event_id, 'matrix_live_publish_failed');

  const ok = await waitForCondition(() => Boolean(received), args.timeoutMs);
  assert(ok, 'matrix_live_receive_timeout');

  adapter.close();
  return {
    key: 'mgmt_matrix_live',
    status: 'PASS',
    room_id: adapter.room_id,
    event_id: res.event_id,
    op_id: opId,
  };
}

function createMockMqttAdapter() {
  const trace = [];
  const listeners = new Set();

  function publish(topic, payload) {
    trace.push({ type: 'publish', topic, payload });
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function emitIncoming(topic, payload) {
    for (const fn of listeners) {
      fn({ topic, payload });
    }
  }

  function list() {
    return trace.slice();
  }

  return {
    publish,
    subscribe,
    emitIncoming,
    trace: { list },
  };
}

function createRuntimeMqttAdapter(rt, prefix) {
  const listeners = new Set();
  const trace = [];
  let outboundCursor = 0;

  function publish(topic, payload) {
    trace.push({ type: 'publish', topic, payload });
    if (payload && payload.t === 'IN') {
      rt.mqttIncoming(topic, payload);
    }
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function emitOutboundFromRuntime() {
    const items = rt.mqttTrace.list();
    for (; outboundCursor < items.length; outboundCursor += 1) {
      const item = items[outboundCursor];
      if (item.type !== 'publish') continue;
      for (const fn of listeners) {
        fn({ topic: item.payload.topic, payload: item.payload.payload });
      }
    }
  }

  function list() {
    return trace.slice();
  }

  return {
    publish,
    subscribe,
    emitOutboundFromRuntime,
    trace: { list },
    prefix,
  };
}

function setupRuntime(prefix) {
  const rt = new ModelTableRuntime();
  rt.startMqttLoop({
    host: '127.0.0.1',
    port: 1883,
    client_id: 'client-A',
    username: 'u',
    password: 'p',
    tls: false,
    topic_prefix: prefix,
  });
  const model = rt.getModel(0);
  rt.addLabel(model, 0, 0, 1, { k: 'demo', t: 'PIN_IN', v: 'demo' });
  rt.addLabel(model, 0, 0, 1, { k: 'demo', t: 'PIN_OUT', v: 'demo' });
  return rt;
}

function caseMbrBridge() {
  const mgmt = createLoopbackAdapter();
  const mqtt = createMockMqttAdapter();
  const bridge = createMbrBridge({ mgmtAdapter: mgmt, mqttAdapter: mqtt, topicPrefix: 'demo' });

  const uiEvent = {
    version: 'v0',
    type: 'ui_event',
    op_id: 'op-1',
    payload: { meta: { op_id: 'op-1', pin: 'demo' } },
  };

  mgmt.publish(uiEvent);

  const published = mqtt.trace.list().find((t) => t.topic === 'demo/demo');
  assert(published, 'mbr_should_publish_pin_in');
  assert(published.payload.op_id === 'op-1', 'pin_in_should_keep_op_id');

  mgmt.publish(uiEvent);
  const publishCount = mqtt.trace.list().filter((t) => t.topic === 'demo/demo').length;
  assert(publishCount === 1, 'op_id_should_dedupe');

  mqtt.emitIncoming('demo/demo', { pin: 'demo', t: 'OUT', value: { payload: 2 }, op_id: 'op-2' });
  const mgmtTrace = mgmt.trace.list();
  const pinOut = mgmtTrace.find((t) => t.event && t.event.type === 'pin_out' && t.event.op_id === 'op-2');
  assert(pinOut, 'mbr_should_publish_pin_out');

  bridge.close();
  return { key: 'mbr_bridge', status: 'PASS' };
}

async function runE2EWithMgmtAdapter(mgmtAdapter, label, args) {
  const prefix = `demo-${label}`;
  const rt = setupRuntime(prefix);
  const mqtt = createRuntimeMqttAdapter(rt, prefix);
  const bridge = createMbrBridge({ mgmtAdapter, mqttAdapter: mqtt, topicPrefix: prefix });

  const opId = `op-${Date.now()}-${label}`;
  const uiEvent = {
    version: 'v0',
    type: 'ui_event',
    op_id: opId,
    payload: { meta: { op_id: opId, pin: 'demo' } },
  };

  await mgmtAdapter.publish(uiEvent);
  const okIn = await waitForCondition(() => {
    return mqtt.trace.list().some((t) => t.topic === `${prefix}/demo`);
  }, args.timeoutMs);
  assert(okIn, 'e2e_pin_in_missing');

  const events = rt.eventLog.list();
  const mailboxEvent = events.find((e) => e.label && e.label.t === 'IN' && e.label.k === 'demo');
  assert(mailboxEvent, 'e2e_mailbox_in_missing');

  rt.addLabel(rt.getModel(0), 0, 1, 1, { k: 'demo', t: 'OUT', v: { payload: 2, op_id: opId } });
  mqtt.emitOutboundFromRuntime();

  const mgmtTrace = mgmtAdapter.trace?.list ? mgmtAdapter.trace.list() : [];
  const pinOut = mgmtTrace.find((t) => {
    const evt = t.event || t.content || null;
    return evt && evt.type === 'pin_out' && evt.op_id === opId;
  });
  assert(pinOut, 'e2e_pin_out_missing');

  if (mgmtAdapter.close) mgmtAdapter.close();
  bridge.close();
  return { key: `e2e_${label}`, status: 'PASS' };
}

async function caseE2E(args) {
  const results = [];
  const loopback = createLoopbackAdapter();
  results.push(await runE2EWithMgmtAdapter(loopback, 'loopback', args));

  if (!args.roomId && !args.roomAlias) {
    throw new Error('missing_room_identifier');
  }
  const matrix = await createMatrixLiveAdapter({
    roomId: args.roomId,
    roomAlias: args.roomAlias,
    syncTimeoutMs: args.timeoutMs,
  });
  results.push(await runE2EWithMgmtAdapter(matrix, 'matrix_live', args));
  return results;
}

async function runAll(args) {
  const results = [];
  results.push(caseMgmtLoopback());
  results.push(caseMbrBridge());
  results.push(await caseMgmtMatrixLive(args));
  results.push(...await caseE2E(args));
  return results;
}

function output(results) {
  console.log('VALIDATION RESULTS');
  for (const row of results) {
    const meta = [];
    if (row.room_id) meta.push(`room_id=${row.room_id}`);
    if (row.event_id) meta.push(`event_id=${row.event_id}`);
    if (row.op_id) meta.push(`op_id=${row.op_id}`);
    const suffix = meta.length > 0 ? ` ${meta.join(' ')}` : '';
    console.log(`${row.key}: ${row.status}${suffix}`);
  }
}

try {
  const args = parseArgs();
  let results = [];
  if (args.which === 'all') {
    results = await runAll(args);
  } else if (args.which === 'mgmt_loopback') {
    results = [caseMgmtLoopback()];
  } else if (args.which === 'mbr_bridge') {
    results = [caseMbrBridge()];
  } else if (args.which === 'mgmt_matrix_live') {
    results = [await caseMgmtMatrixLive(args)];
  } else if (args.which === 'e2e') {
    results = await caseE2E(args);
  } else {
    throw new Error(`unknown_case:${args.which}`);
  }
  output(results);
  process.exit(0);
} catch (err) {
  console.error('VALIDATION FAILED');
  console.error(err.message);
  process.exit(1);
}
