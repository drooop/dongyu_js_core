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

function getFunctionCode(rt, name) {
  const sys = rt.getModel(-10);
  if (!sys) return null;
  const cell = rt.getCell(sys, 0, 0, 0);
  const label = cell.labels.get(name);
  if (!label || label.t !== 'function' || typeof label.v !== 'string') return null;
  return label.v;
}

function listSystemLabels(rt, predicate) {
  const out = [];
  for (const [id, model] of rt.models.entries()) {
    if (id >= 0) continue;
    for (const cell of model.cells.values()) {
      for (const label of cell.labels.values()) {
        if (!predicate || predicate(label, model, cell)) {
          out.push({ model, cell, label });
        }
      }
    }
  }
  return out;
}

function getMgmtOutPayload(rt, channel) {
  const items = listSystemLabels(rt, (label) => label.t === 'MGMT_OUT');
  for (const item of items) {
    if (channel && item.label.k !== channel) continue;
    return item.label.v || null;
  }
  return null;
}

function getMgmtInTarget(rt, channel) {
  const items = listSystemLabels(rt, (label) => label.t === 'MGMT_IN');
  for (const item of items) {
    if (channel && item.label.k !== channel) continue;
    return item.label.v || null;
  }
  return null;
}

function makeCtx(rt, sent) {
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
    parseJson: (value) => {
      if (typeof value !== 'string') return value;
      try {
        return JSON.parse(value);
      } catch (_) {
        return value;
      }
    },
    sendMatrix: (payload) => {
      sent.push(payload);
      return { ok: true };
    },
    getMgmtOutPayload: (channel) => getMgmtOutPayload(rt, channel),
    getMgmtInTarget: (channel) => getMgmtInTarget(rt, channel),
    getMgmtInbox: () => {
      const sys = rt.getModel(-10);
      if (!sys) return null;
      const cell = rt.getCell(sys, 0, 0, 0);
      return cell.labels.get('mgmt_inbox')?.v ?? null;
    },
    clearMgmtInbox: () => {
      const sys = rt.getModel(-10);
      if (!sys) return;
      rt.addLabel(sys, 0, 0, 0, { k: 'mgmt_inbox', t: 'json', v: null });
    },
  };
}

function runFunction(rt, name, ctx) {
  const code = getFunctionCode(rt, name);
  assert(code, `missing_function:${name}`);
  const fn = new Function('ctx', code);
  return fn(ctx);
}

function enqueueJob(rt, id, sourceModelId, intent) {
  const sys = rt.getModel(-10);
  assert(sys, 'system_model_-10_missing');
  rt.addLabel(sys, 0, 0, 0, {
    k: `intent_job_${id}`,
    t: 'json',
    v: {
      source: { model_id: sourceModelId, p: 0, r: 0, c: 0, k: 'intent.v0' },
      intent,
    },
  });
}

function caseMgmtPutMbrV0() {
  const rt = new ModelTableRuntime();
  rt.applyPatch(systemPatch, { allowCreateModel: true });
  rt.createModel({ id: 1, name: 'M1', type: 'data' });

  // Ensure base exists (system patch sets defaults, but enforce here).
  rt.addLabel(rt.getModel(0), 0, 0, 0, { k: 'mqtt_topic_base', t: 'str', v: 'UIPUT/ws/dam/pic/de/sw' });

  enqueueJob(rt, 1, 1, {
    op_id: 'op-mgmt-1',
    action: 'mgmt_put_mbr_v0',
    cell_k: 'pageA.submitA1',
    t: 'json',
    v: { hello: 1 },
  });

  const sent = [];
  const ctx = makeCtx(rt, sent);
  runFunction(rt, 'intent_dispatch', ctx);

  // Now run mgmt_send (it should pick MGMT_OUT and sendMatrix once).
  runFunction(rt, 'mgmt_send', ctx);
  assert(sent.length === 1, 'mgmt_send should send exactly once');
  const payload = sent[0];
  assert(payload && payload.op_id === 'op-mgmt-1', 'payload should include op_id');
  assert(payload.topic === 'UIPUT/ws/dam/pic/de/sw/1/pageA.submitA1', 'payload.topic should include model_id and cell_k');
  assert(payload.k === 'pageA.submitA1', 'payload.k should be cell_k');
  assert(payload.t === 'json', 'payload.t');
  assert(typeof payload.v === 'string' && payload.v.includes('hello'), 'payload.v should be json string');
  return { key: 'mgmt_put_mbr_v0', status: 'PASS' };
}

function caseMgmtReceiveWritesTarget() {
  const rt = new ModelTableRuntime();
  rt.applyPatch(systemPatch, { allowCreateModel: true });
  rt.createModel({ id: 1, name: 'M1', type: 'data' });
  const sys = rt.getModel(-10);

  // Bind channel -> TargetRef
  enqueueJob(rt, 1, 1, {
    op_id: 'op-bind-1',
    action: 'mgmt_bind_in',
    channel: 'pageA.textA1',
    target_ref: { model_id: 1, p: 0, r: 0, c: 0, k: 'pageA.textA1' },
  });
  const sent = [];
  const ctx = makeCtx(rt, sent);
  runFunction(rt, 'intent_dispatch', ctx);

  // Simulate inbound
  rt.addLabel(sys, 0, 0, 0, {
    k: 'mgmt_inbox',
    t: 'json',
    v: { k: 'pageA.textA1', t: 'json', v: '{"x":2}' },
  });
  runFunction(rt, 'mgmt_receive', ctx);

  const cell = rt.getCell(rt.getModel(1), 0, 0, 0);
  const label = cell.labels.get('pageA.textA1');
  assert(label && label.t === 'json', 'target label type');
  assert(label.v && label.v.x === 2, 'target label value should be parsed json');
  return { key: 'mgmt_receive_to_target', status: 'PASS' };
}

function runAll() {
  return [caseMgmtPutMbrV0(), caseMgmtReceiveWritesTarget()];
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
  if (which === 'mgmt_put_mbr_v0') results = [caseMgmtPutMbrV0()];
  else if (which === 'mgmt_receive_to_target') results = [caseMgmtReceiveWritesTarget()];
  else results = runAll();
  output(results);
  process.exit(0);
} catch (err) {
  console.error('VALIDATION FAILED');
  console.error(err && err.message ? err.message : String(err));
  process.exit(1);
}
