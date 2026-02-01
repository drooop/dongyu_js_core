import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../packages/worker-base/src/runtime.js');
const { createMatrixLiveAdapter } = require('../packages/bus-mgmt/src/matrix_live.js');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const roomIdIdx = args.indexOf('--matrix_room_id');
  const roomAliasIdx = args.indexOf('--matrix_room_alias');
  const timeoutIdx = args.indexOf('--timeout_ms');
  return {
    roomId: roomIdIdx === -1 ? null : args[roomIdIdx + 1],
    roomAlias: roomAliasIdx === -1 ? null : args[roomAliasIdx + 1],
    timeoutMs: timeoutIdx === -1 ? 15000 : Number(args[timeoutIdx + 1]),
  };
}

function mailboxCell(rt) {
  const model = rt.getModel(-1);
  return rt.getCell(model, 0, 0, 1);
}

function setMailboxEnvelope(rt, envelope) {
  const model = rt.getModel(-1);
  rt.addLabel(model, 0, 0, 1, { k: 'ui_event', t: 'event', v: envelope });
}

function setLastOpId(rt, opId) {
  const model = rt.getModel(-1);
  rt.addLabel(model, 0, 0, 1, { k: 'ui_event_last_op_id', t: 'str', v: opId });
}

function setError(rt, opId, code, detail) {
  const model = rt.getModel(-1);
  rt.addLabel(model, 0, 0, 1, { k: 'ui_event_error', t: 'json', v: { op_id: opId, code, detail } });
}

function clearMailbox(rt) {
  const model = rt.getModel(-1);
  rt.addLabel(model, 0, 0, 1, { k: 'ui_event', t: 'event', v: null });
}

function consumeMailboxOnce(rt) {
  const cell = mailboxCell(rt);
  const label = cell.labels.get('ui_event');
  const envelope = label ? label.v : null;
  if (envelope === null || envelope === undefined) return { consumed: false };
  if (!envelope || typeof envelope !== 'object' || !envelope.payload || typeof envelope.payload !== 'object') {
    setError(rt, '', 'invalid_target', 'envelope_shape');
    clearMailbox(rt);
    return { consumed: true, result: 'error' };
  }

  const payload = envelope.payload;
  const meta = payload.meta || {};
  const opId = meta.op_id;
  if (typeof opId !== 'string' || opId.length === 0) {
    setError(rt, '', 'invalid_target', 'missing_op_id');
    clearMailbox(rt);
    return { consumed: true, result: 'error' };
  }

  const action = payload.action;
  if (action !== 'label_add') {
    setError(rt, opId, 'unknown_action', 'only_label_add_supported_in_demo');
    clearMailbox(rt);
    return { consumed: true, result: 'error' };
  }

  const target = payload.target;
  if (!target || typeof target !== 'object') {
    setError(rt, opId, 'invalid_target', 'missing_target');
    clearMailbox(rt);
    return { consumed: true, result: 'error' };
  }

  if (target.model_id === 0 || target.model_id === -1) {
    setError(rt, opId, 'reserved_cell', 'reserved_model_id');
    clearMailbox(rt);
    return { consumed: true, result: 'error' };
  }

  const model = rt.getModel(target.model_id);
  if (!model) {
    setError(rt, opId, 'invalid_target', 'missing_model');
    clearMailbox(rt);
    return { consumed: true, result: 'error' };
  }

  const value = payload.value;
  if (!value || typeof value !== 'object' || typeof value.t !== 'string') {
    setError(rt, opId, 'invalid_target', 'missing_value');
    clearMailbox(rt);
    return { consumed: true, result: 'error' };
  }

  rt.addLabel(model, target.p, target.r, target.c, { k: target.k, t: value.t, v: value.v });
  setLastOpId(rt, opId);
  clearMailbox(rt);
  return { consumed: true, result: 'ok', opId };
}

async function run() {
  const args = parseArgs();
  if (!args.roomId && !args.roomAlias) {
    throw new Error('missing_room_identifier');
  }

  const rt = new ModelTableRuntime();
  rt.createModel({ id: -1, name: 'Editor', type: 'Editor' });
  rt.createModel({ id: 1, name: 'Demo', type: 'Data' });

  const eventId = 1;
  const opId = `op_${eventId}`;
  const envelope = {
    event_id: eventId,
    type: 'label_add',
    payload: {
      action: 'label_add',
      target: { model_id: 1, p: 1, r: 1, c: 1, k: 'matrix_outbox' },
      value: { t: 'json', v: { text: 'hello-matrix', op_id: opId } },
      meta: { op_id: opId },
    },
    source: 'ui_renderer',
    ts: 0,
  };

  setMailboxEnvelope(rt, envelope);
  const result = consumeMailboxOnce(rt);
  assert(result.consumed && result.result === 'ok', 'mailbox_consume_failed');

  const model = rt.getModel(1);
  const cell = rt.getCell(model, 1, 1, 1);
  const label = cell.labels.get('matrix_outbox');
  assert(label && label.v && label.v.text, 'matrix_outbox_missing');

  const adapter = await createMatrixLiveAdapter({
    roomId: args.roomId,
    roomAlias: args.roomAlias,
    syncTimeoutMs: args.timeoutMs,
  });

  const mgmtEvent = {
    version: 'v0',
    type: 'ui_event',
    op_id: opId,
    payload: envelope.payload,
  };

  const res = await adapter.publish(mgmtEvent);
  adapter.close();

  console.log('VALIDATION RESULTS');
  console.log(`mailbox_to_matrix: PASS room_id=${adapter.room_id} event_id=${res.event_id} op_id=${opId}`);
}

run().catch((err) => {
  console.error('VALIDATION FAILED');
  console.error(err.message || String(err));
  process.exit(1);
});
