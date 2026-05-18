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

function isSplitBusOutLabel(label) {
  return label && (label.t === 'pin.bus.cb.out' || label.t === 'pin.bus.mb.out');
}

function isSafeTopicSegment(value) {
  return typeof value === 'string'
    && value.trim() === value
    && value.length > 0
    && !value.includes('/')
    && !value.includes('+')
    && !value.includes('#');
}

function isValidUnifiedTopicBase(value) {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) return false;
  const parts = value.split('/');
  return parts.length === 6
    && parts[0] === 'UIPUT'
    && parts.every((part) => isSafeTopicSegment(part));
}

function isValidPayloadTopic(value) {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) return false;
  const parts = value.split('/');
  return parts.length === 9
    && parts[0] === 'UIPUT'
    && parts.every((part) => isSafeTopicSegment(part))
    && /^[1-9][0-9]*$/.test(parts[7]);
}

function payloadRecord(payload, key) {
  return Array.isArray(payload)
    ? payload.find((record) => record && record.id === 0 && record.p === 0 && record.r === 0 && record.c === 0 && record.k === key) || null
    : null;
}

function payloadString(payload, key) {
  const record = payloadRecord(payload, key);
  return record && record.t === 'str' && typeof record.v === 'string' && record.v.trim() === record.v
    ? record.v
    : '';
}

function payloadInt(payload, key) {
  const record = payloadRecord(payload, key);
  return record && record.t === 'int' && Number.isInteger(record.v) ? record.v : null;
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
    this.processedBusOpIds = new Set();
    this.pendingBusOpIds = new Set();
    this.failedBusOpIds = new Map();
    this.splitBusRetryDelayMs = 1000;
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
    };

    // eslint-disable-next-line no-new-func
    const fn = new Function('ctx', 'label', 'V1N', code);
    return fn(ctx, { k: name, t: 'func.js', v: null }, V1N);
  }

  _packetFromSplitBusOut(label) {
    if (!label || !isSplitBusOutLabel(label)) return null;
    if (typeof this.runtime._pinBusOutValueToExternalPayload !== 'function') return null;
    return this.runtime._pinBusOutValueToExternalPayload(label.v);
  }

  _writeSplitBusOutError(code, detail, event) {
    const model0 = this.runtime.getModel(0);
    if (!model0) return;
    this.runtime.addLabel(model0, 0, 0, 0, {
      k: 'split_bus_out_error',
      t: 'json',
      v: {
        code,
        detail,
        pin: event && event.label ? event.label.k : '',
        pin_type: event && event.label ? event.label.t : '',
        ts: Date.now(),
      },
    });
  }

  _mqttTopicForRoute(packet) {
    const payload = packet && Array.isArray(packet.payload) ? packet.payload : [];
    const topic = payloadString(payload, 'topic');
    return isValidPayloadTopic(topic) ? topic : null;
  }

  _processSplitBusOutTriggers(eventEndExclusive) {
    const events = this.runtime.eventLog.list();
    const end = Math.min(Number.isInteger(eventEndExclusive) ? eventEndExclusive : events.length, events.length);
    for (; this.eventCursor < end; this.eventCursor += 1) {
      const event = events[this.eventCursor];
      if (!event || event.op !== 'add_label') continue;
      if (!event.label || !isSplitBusOutLabel(event.label)) continue;
      if (!event.cell || event.cell.model_id !== 0 || event.cell.p !== 0 || event.cell.r !== 0 || event.cell.c !== 0) continue;
      this._processSplitBusOutEvent(event);
    }
    this._scanRootSplitBusOutLabels();
  }

  _scanRootSplitBusOutLabels() {
    const model = this.runtime.getModel(0);
    if (!model) return;
    const cell = this.runtime.getCell(model, 0, 0, 0);
    const entries = Array.from(cell.labels.entries());
    for (const [key, label] of entries) {
      if (!isSplitBusOutLabel(label)) continue;
      this._processSplitBusOutEvent({
        op: 'add_label',
        cell: { model_id: 0, p: 0, r: 0, c: 0 },
        label: { ...label, k: key },
      });
    }
  }

  _splitBusOpKey(event, packet) {
    const opId = payloadString(packet && packet.payload, 'op_id') || payloadString(packet && packet.payload, '__mt_request_id');
    if (opId && event && event.label && event.label.t) return `${event.label.t}:${opId}`;
    if (!event || !event.cell || !event.label) return '';
    return `${event.label.t}:${event.cell.model_id}:${event.cell.p}:${event.cell.r}:${event.cell.c}:${event.label.k}`;
  }

  _clearSplitBusFailure(busOpKey) {
    if (busOpKey) this.failedBusOpIds.delete(busOpKey);
  }

  _recordSplitBusFailure(busOpKey, code, detail, event, extra = {}) {
    if (busOpKey) {
      this.failedBusOpIds.set(busOpKey, {
        code,
        adapter: this.mgmtAdapter,
        mqttPublish: this.mqttPublish,
        topic: extra.topic || null,
        retryAt: Date.now() + this.splitBusRetryDelayMs,
      });
    }
    this._writeSplitBusOutError(code, detail, event);
  }

  _shouldSkipFailedSplitBusOp(busOpKey, event, packet) {
    if (!busOpKey) return false;
    const failed = this.failedBusOpIds.get(busOpKey);
    if (!failed) return false;
    const labelType = event && event.label ? event.label.t : '';
    let changed = false;
    if (labelType === 'pin.bus.mb.out') {
      changed = failed.adapter !== this.mgmtAdapter;
    } else if (labelType === 'pin.bus.cb.out') {
      const topic = this._mqttTopicForRoute(packet);
      changed = failed.mqttPublish !== this.mqttPublish || failed.topic !== topic;
    }
    if (changed || Date.now() >= failed.retryAt) {
      this.failedBusOpIds.delete(busOpKey);
      return false;
    }
    return true;
  }

  _currentSplitBusOpKey(model, event) {
    const current = this.runtime.getCell(model, event.cell.p, event.cell.r, event.cell.c).labels.get(event.label.k);
    if (!current || current.t !== event.label.t) return '';
    const packet = this._packetFromSplitBusOut(current);
    return this._splitBusOpKey({ ...event, label: { ...current, k: event.label.k } }, packet);
  }

  _removeSplitBusOutIfCurrent(model, event, expectedBusOpKey) {
    if (this._currentSplitBusOpKey(model, event) !== expectedBusOpKey) return;
    this.runtime.rmLabel(model, event.cell.p, event.cell.r, event.cell.c, event.label.k);
  }

  _processSplitBusOutEvent(event) {
    const model = this.runtime.getModel(0);
    if (!model) return;
    const packet = this._packetFromSplitBusOut(event.label);
    const busOpKey = this._splitBusOpKey(event, packet);
    if (busOpKey && this.processedBusOpIds.has(busOpKey)) {
      this._removeSplitBusOutIfCurrent(model, event, busOpKey);
      return;
    }
    if (busOpKey && this.pendingBusOpIds.has(busOpKey)) {
      return;
    }
    if (this._shouldSkipFailedSplitBusOp(busOpKey, event, packet)) {
      return;
    }

    if (!packet || typeof packet !== 'object' || packet.type !== 'pin_payload') {
      this._recordSplitBusFailure(
        busOpKey,
        'invalid_split_bus_payload',
        'ModelTable-shaped pin_payload.v1 required',
        event,
      );
      return;
    }

    if (event.label.t === 'pin.bus.cb.out') {
      const topic = this._mqttTopicForRoute(packet);
      if (topic && this.mqttPublish) {
        try {
          this.mqttPublish(topic, packet);
          this._clearSplitBusFailure(busOpKey);
          if (busOpKey) this.processedBusOpIds.add(busOpKey);
          this._removeSplitBusOutIfCurrent(model, event, busOpKey);
        } catch (err) {
          this._recordSplitBusFailure(
            busOpKey,
            'split_bus_mqtt_publish_failed',
            err && err.message ? err.message : String(err),
            event,
            { topic },
          );
        }
      } else {
        this._recordSplitBusFailure(
          busOpKey,
          !topic ? 'missing_split_bus_mqtt_topic' : 'missing_split_bus_mqtt_adapter',
          !topic ? 'endpoint records and mqtt_topic_base are required' : 'mqttPublish adapter is required',
          event,
          { topic },
        );
      }
      return;
    }

    if (event.label.t === 'pin.bus.mb.out' && this.mgmtAdapter) {
      if (busOpKey) this.pendingBusOpIds.add(busOpKey);
      try {
        Promise.resolve(this.mgmtAdapter.publish(packet))
          .then(() => {
            if (busOpKey) {
              this.pendingBusOpIds.delete(busOpKey);
              this.failedBusOpIds.delete(busOpKey);
              this.processedBusOpIds.add(busOpKey);
            }
            this._removeSplitBusOutIfCurrent(model, event, busOpKey);
          })
          .catch((err) => {
            if (busOpKey) this.pendingBusOpIds.delete(busOpKey);
            this._recordSplitBusFailure(
              busOpKey,
              'split_bus_mgmt_publish_failed',
              err && err.message ? err.message : String(err),
              event,
            );
          });
      } catch (err) {
        if (busOpKey) this.pendingBusOpIds.delete(busOpKey);
        this._recordSplitBusFailure(
          busOpKey,
          'split_bus_mgmt_publish_failed',
          err && err.message ? err.message : String(err),
          event,
        );
      }
      return;
    }

    if (event.label.t === 'pin.bus.mb.out') {
      this._recordSplitBusFailure(busOpKey, 'missing_split_bus_mgmt_adapter', 'mgmtAdapter is required', event);
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
    // Drain work until stable (split bus out labels may be produced by a function).
    let rounds = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      rounds += 1;
      if (rounds > 50) break;
      
      // Process generic run_* trigger labels first for roles that still use trigger-based dispatch.
      const ranTriggers = this._processRunTriggers();
      
      const eventEnd = this.runtime.eventLog.list().length;
      const interceptEnd = this.runtime.intercepts.list().length;
      this._processSplitBusOutTriggers(eventEnd);
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
