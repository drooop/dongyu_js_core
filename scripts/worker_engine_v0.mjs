import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function firstSystemModel(runtime) {
  return runtime.getModel(-10) || null;
}

function getSystemCell(runtime) {
  const sys = firstSystemModel(runtime);
  if (!sys) return null;
  return runtime.getCell(sys, 0, 0, 0);
}

function listSystemLabels(runtime, predicate) {
  const sys = firstSystemModel(runtime);
  if (!sys) return [];
  const cell = runtime.getCell(sys, 0, 0, 0);
  const out = [];
  for (const [k, label] of cell.labels.entries()) {
    if (predicate && !predicate(label, k)) continue;
    out.push({ model: sys, cell: { model_id: sys.id, p: 0, r: 0, c: 0 }, label });
  }
  return out;
}

export class WorkerEngineV0 {
  constructor({ runtime, mgmtAdapter, mqttPublish }) {
    this.runtime = runtime;
    this.mgmtAdapter = mgmtAdapter || null;
    this.mqttPublish = typeof mqttPublish === 'function' ? mqttPublish : null;
    this.interceptCursor = 0;
    this.eventCursor = 0;
  }

  executeFunction(name) {
    const sysCell = getSystemCell(this.runtime);
    if (!sysCell) return;
    const label = sysCell.labels.get(name);
    if (!label || label.t !== 'function' || typeof label.v !== 'string') return;
    const code = label.v;

    const ctx = {
      runtime: this.runtime,
      getLabel: (ref) => {
        if (!ref || !Number.isInteger(ref.model_id)) return null;
        const model = this.runtime.getModel(ref.model_id);
        if (!model) return null;
        const cell = this.runtime.getCell(model, ref.p, ref.r, ref.c);
        return cell.labels.get(ref.k)?.v ?? null;
      },
      writeLabel: (ref, t, v) => {
        if (!ref || !Number.isInteger(ref.model_id)) return;
        const model = this.runtime.getModel(ref.model_id);
        if (!model) return;
        this.runtime.addLabel(model, ref.p, ref.r, ref.c, { k: ref.k, t, v });
      },
      rmLabel: (ref) => {
        if (!ref || !Number.isInteger(ref.model_id)) return;
        const model = this.runtime.getModel(ref.model_id);
        if (!model) return;
        this.runtime.rmLabel(model, ref.p, ref.r, ref.c, ref.k);
      },
      sendMatrix: async (event) => {
        if (!this.mgmtAdapter) throw new Error('mgmt_adapter_missing');
        return this.mgmtAdapter.publish(event);
      },
      publishMqtt: (topic, payload) => {
        if (!this.mqttPublish) throw new Error('mqtt_publish_missing');
        return this.mqttPublish(topic, payload);
      },
      getMgmtOutPayload: (channel) => {
        const items = listSystemLabels(this.runtime, (l) => l.t === 'MGMT_OUT');
        for (const item of items) {
          if (channel && item.label.k !== channel) continue;
          return item.label.v ?? null;
        }
        return null;
      },
    };

    // eslint-disable-next-line no-new-func
    const fn = new Function('ctx', code);
    return fn(ctx);
  }

  _processMgmtOutTriggers(eventEndExclusive) {
    const events = this.runtime.eventLog.list();
    const end = Math.min(Number.isInteger(eventEndExclusive) ? eventEndExclusive : events.length, events.length);
    for (; this.eventCursor < end; this.eventCursor += 1) {
      const event = events[this.eventCursor];
      if (!event || event.op !== 'add_label') continue;
      if (!event.label || event.label.t !== 'MGMT_OUT') continue;
      if (!event.cell || !Number.isInteger(event.cell.model_id) || event.cell.model_id >= 0) continue;
      const model = this.runtime.getModel(event.cell.model_id);
      if (!model) continue;
      
      // For MBR worker: directly send to Matrix instead of using mgmt_send function
      // (mgmt_send function would need the MGMT_OUT label which we want to remove)
      if (this.mgmtAdapter && event.label.v) {
        this.mgmtAdapter.publish(event.label.v).catch((err) => {
          process.stderr.write(`[WorkerEngineV0] mgmt publish failed: ${err.message}\n`);
        });
      }
      
      // Remove the MGMT_OUT label to prevent re-processing
      this.runtime.rmLabel(model, event.cell.p, event.cell.r, event.cell.c, event.label.k);
    }
  }

  _processIntercepts(interceptEndExclusive) {
    const items = this.runtime.intercepts.list();
    const end = Math.min(Number.isInteger(interceptEndExclusive) ? interceptEndExclusive : items.length, items.length);
    for (; this.interceptCursor < end; this.interceptCursor += 1) {
      const item = items[this.interceptCursor];
      if (!item || item.type !== 'run_func') continue;
      const name = item.payload && item.payload.func ? item.payload.func : '';
      if (!name) continue;
      this.executeFunction(name);
    }
  }

  /**
   * Process run_* trigger labels in system model.
   * When a label like `run_foo` is found, execute function `foo`.
   * After execution, the trigger label is removed (unless the function already removed it).
   * Returns true if any function was executed.
   */
  _processRunTriggers() {
    const sys = firstSystemModel(this.runtime);
    if (!sys) return false;
    const cell = this.runtime.getCell(sys, 0, 0, 0);
    let executed = false;
    
    // Collect run_* labels (we can't modify during iteration)
    const triggers = [];
    for (const [k, label] of cell.labels.entries()) {
      if (k.startsWith('run_') && label.t === 'str' && label.v === '1') {
        triggers.push(k);
      }
    }
    
    // Execute each trigger
    for (const triggerKey of triggers) {
      const funcName = triggerKey.slice(4); // Remove 'run_' prefix
      // Check if function exists
      if (cell.labels.has(funcName) && cell.labels.get(funcName).t === 'function') {
        this.executeFunction(funcName);
        executed = true;
        // Remove the trigger label after execution (if not already removed by the function)
        if (cell.labels.has(triggerKey)) {
          this.runtime.rmLabel(sys, 0, 0, 0, triggerKey);
        }
      }
    }
    
    return executed;
  }

  tick() {
    // Drain work until stable (MGMT_OUT may be produced by a function).
    let rounds = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      rounds += 1;
      if (rounds > 50) break;
      
      // Process run_* trigger labels first (e.g., run_mbr_mgmt_to_mqtt, run_mbr_mqtt_to_mgmt)
      const ranTriggers = this._processRunTriggers();
      
      const eventEnd = this.runtime.eventLog.list().length;
      const interceptEnd = this.runtime.intercepts.list().length;
      this._processMgmtOutTriggers(eventEnd);
      this._processIntercepts(interceptEnd);
      const eventsLen = this.runtime.eventLog.list().length;
      const interceptsLen = this.runtime.intercepts.list().length;
      
      // Continue if we ran triggers or have pending events/intercepts
      if (!ranTriggers && this.eventCursor >= eventsLen && this.interceptCursor >= interceptsLen) {
        break;
      }
    }
  }
}

export function loadSystemPatch(runtime) {
  const patch = require('../packages/worker-base/system-models/system_models.json');
  runtime.applyPatch(patch, { allowCreateModel: true });
}
