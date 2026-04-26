import { createRequire } from 'node:module';
import { applyPersistedAssetEntries, resolvePersistedAssetRoot } from '../packages/worker-base/src/persisted_asset_loader.mjs';

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

function isExecutableJsFunctionLabel(label) {
  if (!label || typeof label !== 'object') return false;
  return label.t === 'func.js';
}

function extractFunctionCode(label) {
  if (!label || typeof label !== 'object') return '';
  if (label.v && typeof label.v === 'object' && typeof label.v.code === 'string') return label.v.code;
  return '';
}

export function buildWorkerHostApi(runtime) {
  const requireRuntime = () => {
    if (!runtime || typeof runtime.getModel !== 'function') {
      return { ok: false, code: 'runtime_unavailable', detail: 'runtime unavailable' };
    }
    return { ok: true };
  };
  const requireCell = (modelId, p, r, c) => {
    const base = requireRuntime();
    if (!base.ok) return base;
    if (!Number.isInteger(modelId)) return { ok: false, code: 'invalid_target', detail: 'modelId must be integer' };
    if (!Number.isInteger(p) || !Number.isInteger(r) || !Number.isInteger(c)) {
      return { ok: false, code: 'invalid_target', detail: 'p/r/c must be integer' };
    }
    const model = runtime.getModel(modelId);
    if (!model) return { ok: false, code: 'model_not_found', detail: `modelId=${modelId}` };
    return { ok: true, model, cell: runtime.getCell(model, p, r, c) };
  };
  return {
    readCrossModel(modelId, p, r, c, k) {
      if (typeof k !== 'string' || !k) return { ok: false, code: 'invalid_label_key', detail: 'k must be non-empty string' };
      const target = requireCell(modelId, p, r, c);
      if (!target.ok) return target;
      const label = target.cell.labels.get(k);
      return { ok: true, data: label ? { t: label.t, v: label.v } : null };
    },
    writeCrossModel(modelId, p, r, c, k, t, v) {
      if (typeof k !== 'string' || !k) return { ok: false, code: 'invalid_label_key', detail: 'k must be non-empty string' };
      if (typeof t !== 'string' || !t) return { ok: false, code: 'invalid_label_type', detail: 't must be non-empty string' };
      const target = requireCell(modelId, p, r, c);
      if (!target.ok) return target;
      runtime.addLabel(target.model, p, r, c, { k, t, v });
      return { ok: true };
    },
    rmCrossModel(modelId, p, r, c, k) {
      if (typeof k !== 'string' || !k) return { ok: false, code: 'invalid_label_key', detail: 'k must be non-empty string' };
      const target = requireCell(modelId, p, r, c);
      if (!target.ok) return target;
      runtime.rmLabel(target.model, p, r, c, k);
      return { ok: true };
    },
  };
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
    if (!isExecutableJsFunctionLabel(label)) return;
    const code = extractFunctionCode(label);
    if (!code || !code.trim()) return;

    const hostApi = buildWorkerHostApi(this.runtime);
    const V1N = {
      readLabel: (p, r, c, k) => {
        const result = hostApi.readCrossModel(-10, p, r, c, k);
        return result && result.ok ? result.data : null;
      },
      addLabel: (k, t, v) => {
        const result = hostApi.writeCrossModel(-10, 0, 0, 0, k, t, v);
        if (!result || result.ok !== true) throw new Error(result && result.code ? result.code : 'v1n_add_failed');
      },
      removeLabel: (k) => {
        const result = hostApi.rmCrossModel(-10, 0, 0, 0, k);
        if (!result || result.ok !== true) throw new Error(result && result.code ? result.code : 'v1n_remove_failed');
      },
    };
    V1N.table = {
      addLabel: (p, r, c, k, t, v) => {
        const result = hostApi.writeCrossModel(-10, p, r, c, k, t, v);
        if (!result || result.ok !== true) throw new Error(result && result.code ? result.code : 'v1n_table_add_failed');
      },
      removeLabel: (p, r, c, k) => {
        const result = hostApi.rmCrossModel(-10, p, r, c, k);
        if (!result || result.ok !== true) throw new Error(result && result.code ? result.code : 'v1n_table_remove_failed');
      },
    };

    const ctx = {
      runtime: this.runtime,
      hostApi,
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
    const fn = new Function('ctx', 'label', 'V1N', code);
    return fn(ctx, { k: name, t: 'func.js', v: null }, V1N);
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
      if (cell.labels.has(funcName) && isExecutableJsFunctionLabel(cell.labels.get(funcName))) {
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
    if (typeof this.runtime.isRunLoopActive === 'function' && !this.runtime.isRunLoopActive()) {
      return;
    }
    if (typeof this.runtime.isRuntimeRunning === 'function' && !this.runtime.isRuntimeRunning()) {
      return;
    }
    // Drain work until stable (MGMT_OUT may be produced by a function).
    let rounds = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      rounds += 1;
      if (rounds > 50) break;
      
      // Process generic run_* trigger labels first for roles that still use trigger-based dispatch.
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

export function loadSystemPatch(runtime, options = {}) {
  const assetRoot = resolvePersistedAssetRoot(options.assetRoot);
  if (assetRoot) {
    return applyPersistedAssetEntries(runtime, {
      assetRoot,
      scope: options.scope || 'ui-server',
      authority: 'authoritative',
      kind: 'patch',
      phases: ['00-system-base'],
      applyOptions: { allowCreateModel: true, trustedBootstrap: true },
    });
  }
  const patch = require('../packages/worker-base/system-models/system_models.json');
  runtime.applyPatch(patch, { allowCreateModel: true, trustedBootstrap: true });
  return {
    assetRoot: null,
    entriesApplied: 1,
    patchObjectsApplied: 1,
    recordCount: Array.isArray(patch.records) ? patch.records.length : 0,
  };
}
