'use strict';

class EventLog {
  constructor() {
    this._events = [];
    this._nextId = 1;
  }

  record(event) {
    const entry = {
      event_id: this._nextId++,
      ts: Date.now(),
      op: event.op,
      cell: event.cell,
      label: event.label,
      prev_label: event.prev_label || null,
      result: event.result,
      reason: event.reason || null,
      trace_id: event.trace_id || null,
    };
    this._events.push(entry);
    return entry;
  }

  list() {
    return this._events.slice();
  }

  reset() {
    this._events = [];
    this._nextId = 1;
  }
}

class Intercepts {
  constructor() {
    this._items = [];
  }

  record(type, payload) {
    this._items.push({ type, payload });
  }

  list() {
    return this._items.slice();
  }

  reset() {
    this._items = [];
  }
}

class MqttTrace {
  constructor() {
    this._items = [];
  }

  record(type, payload) {
    this._items.push({ type, payload });
  }

  list() {
    return this._items.slice();
  }

  reset() {
    this._items = [];
  }
}

class MqttClientMock {
  constructor(trace) {
    this.trace = trace;
    this.connected = false;
    this.subscriptions = new Set();
  }

  connect(config) {
    this.connected = true;
    this.trace.record('connect', { target: config });
  }

  subscribe(topic) {
    this.subscriptions.add(topic);
    this.trace.record('subscribe', { topic });
  }

  unsubscribe(topic) {
    this.subscriptions.delete(topic);
    this.trace.record('unsubscribe', { topic });
  }

  publish(topic, payload) {
    this.trace.record('publish', { topic, payload });
  }
}

let _mqttPkg = null;
function lazyMqtt() {
  if (_mqttPkg) return _mqttPkg;
  // ESM-safe lazy import to avoid pulling mqtt in browser bundles.
  // This file is used in Node/Bun runtime contexts.
  // eslint-disable-next-line no-new-func
  const req = (new Function('return (typeof require!=="undefined")?require:null;'))();
  if (!req) {
    throw new Error('mqtt_package_unavailable');
  }
  _mqttPkg = req('mqtt');
  return _mqttPkg;
}

class MqttClientReal {
  constructor(trace, onMessage) {
    this.trace = trace;
    this.connected = false;
    this.subscriptions = new Set();
    this._client = null;
    this._onMessage = typeof onMessage === 'function' ? onMessage : null;
  }

  connect(config) {
    const mqtt = lazyMqtt();
    const host = config && typeof config.host === 'string' ? config.host : '';
    const port = Number.isInteger(config && config.port) ? config.port : 1883;
    const tls = Boolean(config && config.tls);
    const protocol = tls ? 'mqtts' : 'mqtt';
    const url = `${protocol}://${host}:${port}`;

    const options = {
      clientId: config && config.client_id ? String(config.client_id) : undefined,
      username: config && config.username ? String(config.username) : undefined,
      password: config && config.password ? String(config.password) : undefined,
      reconnectPeriod: 500,
      connectTimeout: 10000,
    };
    if (tls) {
      options.rejectUnauthorized = false;
    }

    this._client = mqtt.connect(url, options);
    this.trace.record('connect', { target: { ...config, password: config && config.password ? '<redacted>' : null } });

    this._client.on('connect', () => {
      this.connected = true;
      this.trace.record('connected', { url });
    });
    this._client.on('reconnect', () => {
      this.trace.record('reconnect', { url });
    });
    this._client.on('error', (err) => {
      this.trace.record('error', { message: String(err && err.message ? err.message : err) });
    });
    this._client.on('message', (topic, buf) => {
      if (!this._onMessage) return;
      let parsed = null;
      try {
        parsed = JSON.parse(buf.toString('utf8'));
      } catch (_) {
        this.trace.record('inbound_parse_error', { topic });
        return;
      }
      this.trace.record('inbound', { topic, payload: parsed });
      this._onMessage(topic, parsed);
    });
  }

  subscribe(topic) {
    if (!this._client) return;
    this.subscriptions.add(topic);
    this._client.subscribe(topic);
    this.trace.record('subscribe', { topic });
  }

  unsubscribe(topic) {
    if (!this._client) return;
    this.subscriptions.delete(topic);
    this._client.unsubscribe(topic);
    this.trace.record('unsubscribe', { topic });
  }

  publish(topic, payload) {
    if (!this._client) return;
    this.trace.record('publish', { topic, payload });
    try {
      this._client.publish(topic, JSON.stringify(payload));
    } catch (_) {
      // ignore
    }
  }

  close() {
    if (!this._client) return;
    try {
      this._client.end(true);
    } catch (_) {
      // ignore
    }
    this._client = null;
  }
}

class Model {
  constructor({ id, name, type }) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.cells = new Map();
    this.functions = new Map();
    this.mailboxTriggers = new Map();
  }

  registerFunction(name, handler) {
    this.functions.set(name, handler !== undefined ? handler : null);
  }

  hasFunction(name) {
    return this.functions.has(name);
  }

  getFunction(name) {
    return this.functions.get(name) || null;
  }

  addMailboxTrigger(p, r, c, funcName) {
    const key = `${p},${r},${c}`;
    if (!this.mailboxTriggers.has(key)) {
      this.mailboxTriggers.set(key, []);
    }
    const list = this.mailboxTriggers.get(key);
    if (!list.includes(funcName)) {
      list.push(funcName);
    }
  }

  getMailboxTriggers(p, r, c) {
    const key = `${p},${r},${c}`;
    return this.mailboxTriggers.get(key) || [];
  }

  cellKey(p, r, c) {
    return `${p},${r},${c}`;
  }

  getCell(p, r, c) {
    const key = this.cellKey(p, r, c);
    if (!this.cells.has(key)) {
      this.cells.set(key, { p, r, c, labels: new Map() });
    }
    return this.cells.get(key);
  }

  removeCell(p, r, c) {
    const key = this.cellKey(p, r, c);
    this.cells.delete(key);
  }
}

class ModelTableRuntime {
  constructor() {
    this.eventLog = new EventLog();
    this.intercepts = new Intercepts();
    this.mqttTrace = new MqttTrace();
    this.models = new Map();
    this.v1nConfig = { local_mqtt: null, global_mqtt: null };
    this.mqttClient = null;
    // Declared PINs.
    // Stored as "<model_id>:<pin_k>" to support multi-model topic routing.
    this.pinInSet = new Set();
    this.pinOutSet = new Set();
    this.pinInBindings = new Map();
    // 0141: CELL_CONNECT graph (two-level Map)
    // outer key: "${modelId}|${p}|${r}|${c}" (pipe-separated)
    // inner: Map<"${prefix}:${port}", [{prefix, port}]>
    this.cellConnectGraph = new Map();
    // 0141: cell_connection routing table
    // key: "${modelId}|${p}|${r}|${c}|${k}" (pipe-separated)
    // value: [{model_id, p, r, c, k}]
    this.cellConnectionRoutes = new Map();
    this.runLoopActive = true;
    this.persistence = null;

    const root = new Model({ id: 0, name: 'MT', type: 'main' });
    this.models.set(root.id, root);
  }

  createModel({ id, name, type }) {
    if (this.models.has(id)) {
      return this.models.get(id);
    }
    const model = new Model({ id, name, type });
    this.models.set(id, model);
    if (this.persistence && typeof this.persistence.ensureModel === 'function') {
      this.persistence.ensureModel(model);
    }
    return model;
  }

  setPersistence(persister) {
    this.persistence = persister || null;
    if (this.persistence && typeof this.persistence.ensureModel === 'function') {
      for (const model of this.models.values()) {
        this.persistence.ensureModel(model);
      }
    }
  }

  getModel(id) {
    return this.models.get(id);
  }

  setRunLoopActive(active) {
    this.runLoopActive = Boolean(active);
  }

  isRunLoopActive() {
    return this.runLoopActive;
  }

  createCell(model, p, r, c) {
    return model.getCell(p, r, c);
  }

  getCell(model, p, r, c) {
    return model.getCell(p, r, c);
  }

  removeCell(model, p, r, c) {
    model.removeCell(p, r, c);
    if (this.persistence && typeof this.persistence.onCellRemoved === 'function') {
      this.persistence.onCellRemoved({ model, p, r, c });
    }
  }

  registerFunction(model, name, handler) {
    model.registerFunction(name, handler);
    if (!handler) {
      const cell = this.getCell(model, 0, 0, 0);
      if (!cell.labels.has(name) || cell.labels.get(name).t !== 'function') {
        cell.labels.set(name, { k: name, t: 'function', v: null });
      }
    }
  }

  addMailboxTrigger(model, p, r, c, funcName) {
    model.addMailboxTrigger(p, r, c, funcName);
  }

  getLabelValue(model, p, r, c, k) {
    const cell = model.getCell(p, r, c);
    const label = cell.labels.get(k);
    return label ? label.v : undefined;
  }

  _isInteger(value) {
    return Number.isInteger(value);
  }

  _validateCell(p, r, c) {
    return this._isInteger(p) && this._isInteger(r) && this._isInteger(c);
  }

  _validateLabel(label) {
    if (!label || typeof label.k !== 'string' || label.k.length === 0) {
      return 'invalid_label_k';
    }
    if (typeof label.t !== 'string' || label.t.length === 0) {
      return 'invalid_label_t';
    }
    try {
      JSON.stringify(label.v);
    } catch (_) {
      return 'invalid_label_v';
    }
    return null;
  }

  applyPatch(patch, options = {}) {
    const records = patch && Array.isArray(patch.records) ? patch.records : null;
    if (!records) {
      return { applied: 0, rejected: 0, reason: 'invalid_patch' };
    }
    const allowCreateModel = Boolean(options.allowCreateModel);

    const RESERVED_CLEAR_LABELS = new Set(['ui_event', 'ui_event_error', 'ui_event_last_op_id']);
    const CLEAR_ALLOW_T = new Set(['str', 'int', 'bool', 'json']);
    const matchForbiddenK = (k) => {
      if (typeof k !== 'string') return false;
      if (k === 'pin_in' || k === 'pin_out') return true;
      if (k === 'v1n_id' || k === 'data_type') return true;
      if (k.startsWith('run_')) return true;
      if (k.startsWith('mqtt_')) return true;
      if (k.startsWith('matrix_')) return true;
      if (k.startsWith('CONNECT_')) return true;
      if (k.endsWith('_CONNECT')) return true;
      return false;
    };
    const clearableLabel = (label) => {
      if (!label || typeof label.k !== 'string') return false;
      if (RESERVED_CLEAR_LABELS.has(label.k)) return false;
      if (matchForbiddenK(label.k)) return false;
      if (!CLEAR_ALLOW_T.has(label.t)) return false;
      return true;
    };
    let applied = 0;
    let rejected = 0;
    for (const record of records) {
      if (!record || typeof record !== 'object') {
        rejected += 1;
        continue;
      }
      const op = record.op;
      const modelId = record.model_id;
      if (!Number.isInteger(modelId)) {
        rejected += 1;
        continue;
      }

      if (op === 'create_model') {
        if (!allowCreateModel) {
          rejected += 1;
          continue;
        }
        if (modelId === 0) {
          rejected += 1;
          continue;
        }
        const name = record.name;
        const type = record.type;
        if (typeof name !== 'string' || name.length === 0 || typeof type !== 'string' || type.length === 0) {
          rejected += 1;
          continue;
        }
        if (this.getModel(modelId)) {
          applied += 1;
          continue;
        }
        try {
          this.createModel({ id: modelId, name, type });
          applied += 1;
        } catch (_) {
          rejected += 1;
        }
        continue;
      }
      let model = this.getModel(modelId);
      if (!model && op === 'cell_clear') {
        rejected += 1;
        continue;
      }
      if (!model && allowCreateModel) {
        const name = modelId < 0 ? `system_model_${modelId}` : `model_${modelId}`;
        const type = modelId < 0 ? 'system' : 'data';
        model = this.createModel({ id: modelId, name, type });
      }
      if (!model) {
        rejected += 1;
        continue;
      }
      const p = record.p;
      const r = record.r;
      const c = record.c;
      const k = record.k;

      if (op === 'cell_clear') {
        if (!this._validateCell(p, r, c)) {
          rejected += 1;
          continue;
        }
        const cell = this.getCell(model, p, r, c);
        const toRemove = [];
        for (const [lk, lv] of cell.labels.entries()) {
          const label = { k: lv.k, t: lv.t, v: lv.v };
          if (!clearableLabel(label)) continue;
          toRemove.push(lk);
        }
        for (const lk of toRemove) {
          this.rmLabel(model, p, r, c, lk);
        }
        applied += 1;
        continue;
      }
      if (!this._validateCell(p, r, c) || typeof k !== 'string' || k.length === 0) {
        rejected += 1;
        continue;
      }
      if (op === 'add_label') {
        const label = { k, t: record.t, v: record.v };
        const res = this.addLabel(model, p, r, c, label);
        if (res && res.applied) applied += 1;
        else rejected += 1;
        continue;
      }
      if (op === 'rm_label') {
        const res = this.rmLabel(model, p, r, c, k);
        if (res && res.applied) applied += 1;
        else rejected += 1;
        continue;
      }
      rejected += 1;
    }
    return { applied, rejected };
  }

  _recordError(model, p, r, c, label, reason) {
    this.eventLog.record({
      op: 'error',
      cell: { model_id: model.id, p, r, c },
      label,
      result: 'rejected',
      reason,
    });
  }

  _configCell() {
    return { model_id: 0, p: 0, r: 0, c: 0 };
  }

  _pinKey(modelId, pinK) {
    return `${modelId}:${pinK}`;
  }

  _parsePinKey(key) {
    if (typeof key !== 'string') return null;
    const idx = key.indexOf(':');
    if (idx <= 0) return null;
    const modelId = Number(key.slice(0, idx));
    const pinK = key.slice(idx + 1);
    if (!Number.isInteger(modelId) || !pinK) return null;
    return { modelId, pinK };
  }

  _normalizeTargetRef(defaultModelId, raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    if (!Number.isInteger(raw.p) || !Number.isInteger(raw.r) || !Number.isInteger(raw.c)) return null;
    const modelId = Number.isInteger(raw.model_id) ? raw.model_id : defaultModelId;
    if (!Number.isInteger(modelId)) return null;
    const ref = { model_id: modelId, p: raw.p, r: raw.r, c: raw.c };
    if (typeof raw.k === 'string' && raw.k) {
      ref.k = raw.k;
    }
    return ref;
  }

  _parsePinInBinding(modelId, label) {
    const raw = label ? label.v : null;
    let target = this._normalizeTargetRef(modelId, raw);
    if (!target && raw && typeof raw === 'object' && !Array.isArray(raw)) {
      target = this._normalizeTargetRef(
        modelId,
        raw.target_ref || raw.target || raw.owner_ref || raw.owner || raw.cell_ref,
      );
    }
    if (!target) return null;
    const binding = { target };
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const funcs = [];
      if (typeof raw.trigger_func === 'string' && raw.trigger_func) funcs.push(raw.trigger_func);
      if (Array.isArray(raw.trigger_funcs)) {
        for (const name of raw.trigger_funcs) {
          if (typeof name === 'string' && name) funcs.push(name);
        }
      }
      if (funcs.length > 0) binding.trigger_funcs = [...new Set(funcs)];
      if (Number.isInteger(raw.trigger_model_id)) binding.trigger_model_id = raw.trigger_model_id;
    }
    return binding;
  }

  _resolvePinInRouteForMode(modelId, pinK, topicMode) {
    const pinKey = this._pinKey(modelId, pinK);
    const binding = this.pinInBindings.get(pinKey) || null;
    if (binding && binding.target) {
      const target = {
        model_id: binding.target.model_id,
        p: binding.target.p,
        r: binding.target.r,
        c: binding.target.c,
        k: binding.target.k || pinK,
      };
      return { pin_model_id: modelId, pin_k: pinK, target, binding, route_mode: 'binding' };
    }
    const mailbox = this._pinMailboxCellFor(modelId, topicMode);
    const target = { model_id: mailbox.model_id, p: mailbox.p, r: mailbox.r, c: mailbox.c, k: pinK };
    return { pin_model_id: modelId, pin_k: pinK, target, binding: null, route_mode: 'legacy_mailbox' };
  }

  resolvePinInRoute(modelId, pinK) {
    const config = this._getConfigFromPage0();
    const topicMode = this._topicMode(config);
    return this._resolvePinInRouteForMode(modelId, pinK, topicMode);
  }

  findPinInBindingsForDelivery(cellRef, labelKey) {
    if (!cellRef || !Number.isInteger(cellRef.model_id)) return [];
    if (!Number.isInteger(cellRef.p) || !Number.isInteger(cellRef.r) || !Number.isInteger(cellRef.c)) return [];
    if (typeof labelKey !== 'string' || !labelKey) return [];
    const config = this._getConfigFromPage0();
    const topicMode = this._topicMode(config);
    const matches = [];
    for (const key of this.pinInSet) {
      const parsed = this._parsePinKey(key);
      if (!parsed) continue;
      const route = this._resolvePinInRouteForMode(parsed.modelId, parsed.pinK, topicMode);
      const target = route.target;
      if (
        target.model_id === cellRef.model_id &&
        target.p === cellRef.p &&
        target.r === cellRef.r &&
        target.c === cellRef.c &&
        target.k === labelKey
      ) {
        matches.push(route);
      }
    }
    return matches;
  }

  _topicMode(config) {
    const mode = config && typeof config.topic_mode === 'string' ? config.topic_mode : null;
    if (mode === 'uiput_9layer_v2') return 'uiput_9layer_v2';
    if (mode === 'uiput_mm_v1') return 'uiput_mm_v1';
    return 'stage2';
  }

  _payloadMode(config) {
    const mode = config && typeof config.payload_mode === 'string' ? config.payload_mode : null;
    if (mode === 'mt_v0') return 'mt_v0';
    return 'legacy';
  }

  _pinRegistryCellFor(modelId, topicMode) {
    if (topicMode === 'uiput_9layer_v2' || topicMode === 'uiput_mm_v1') {
      return { model_id: modelId, p: 0, r: 0, c: 1 };
    }
    return { model_id: 0, p: 0, r: 0, c: 1 };
  }

  _pinMailboxCellFor(modelId, topicMode) {
    if (topicMode === 'uiput_9layer_v2' || topicMode === 'uiput_mm_v1') {
      return { model_id: modelId, p: 0, r: 1, c: 1 };
    }
    return { model_id: 0, p: 0, r: 1, c: 1 };
  }

  _writeRuntimeStatus(status) {
    const cfg = this._configCell();
    const model = this.getModel(cfg.model_id);
    this.addLabel(model, cfg.p, cfg.r, cfg.c, { k: 'mqtt_runtime_status', t: 'str', v: status });
    this.intercepts.record('mqtt_runtime_status', { status });
  }

  _writeRuntimeError(code, reason, detail) {
    const cfg = this._configCell();
    const model = this.getModel(cfg.model_id);
    this.addLabel(model, cfg.p, cfg.r, cfg.c, { k: 'mqtt_runtime_error_code', t: 'str', v: code });
    this.addLabel(model, cfg.p, cfg.r, cfg.c, { k: 'mqtt_runtime_error_reason', t: 'str', v: reason });
    this.addLabel(model, cfg.p, cfg.r, cfg.c, { k: 'mqtt_runtime_error_detail', t: 'json', v: detail });
  }

  _getConfigFromPage0() {
    const cfg = this._configCell();
    const model = this.getModel(cfg.model_id);
    const cell = this.getCell(model, cfg.p, cfg.r, cfg.c);
    const get = (key) => cell.labels.get(key);
    return {
      host: get('mqtt_target_host')?.v ?? null,
      port: get('mqtt_target_port')?.v ?? null,
      client_id: get('mqtt_target_client_id')?.v ?? null,
      username: get('mqtt_target_username')?.v ?? null,
      password: get('mqtt_target_password')?.v ?? null,
      tls: get('mqtt_target_tls')?.v ?? null,
      topic_prefix: get('mqtt_target_topic_prefix')?.v ?? null,
      topic_mode: get('mqtt_topic_mode')?.v ?? null,
      topic_base: get('mqtt_topic_base')?.v ?? null,
      payload_mode: get('mqtt_payload_mode')?.v ?? null,
      // 9-layer segment labels
      topic_ns: get('mqtt_topic_ns')?.v ?? null,
      topic_ws: get('mqtt_topic_ws')?.v ?? null,
      topic_dam: get('mqtt_topic_dam')?.v ?? null,
      topic_pic: get('mqtt_topic_pic')?.v ?? null,
      topic_de: get('mqtt_topic_de')?.v ?? null,
      topic_sw: get('mqtt_topic_sw')?.v ?? null,
    };
  }

  _validateConfig(config) {
    const missing = [];
    if (!config.host) missing.push('mqtt_target_host');
    if (!Number.isInteger(config.port)) missing.push('mqtt_target_port');
    if (!config.client_id) missing.push('mqtt_target_client_id');
    const mode = this._topicMode(config);
    if (mode === 'uiput_9layer_v2') {
      if (!config.topic_ns || typeof config.topic_ns !== 'string') missing.push('mqtt_topic_ns');
    } else if (mode === 'uiput_mm_v1') {
      if (!config.topic_base || typeof config.topic_base !== 'string') missing.push('mqtt_topic_base');
    }
    return missing;
  }

  _applyArgsConfig(argsConfig) {
    if (!argsConfig) return;
    const cfg = this._configCell();
    const model = this.getModel(cfg.model_id);
    const mapping = [
      ['mqtt_target_host', 'str', argsConfig.host],
      ['mqtt_target_port', 'int', argsConfig.port],
      ['mqtt_target_client_id', 'str', argsConfig.client_id],
      ['mqtt_target_username', 'str', argsConfig.username],
      ['mqtt_target_password', 'str', argsConfig.password],
      ['mqtt_target_tls', 'bool', argsConfig.tls],
      ['mqtt_target_topic_prefix', 'str', argsConfig.topic_prefix],
    ];
    for (const [k, t, v] of mapping) {
      if (v !== undefined && v !== null) {
        this.addLabel(model, cfg.p, cfg.r, cfg.c, { k, t, v });
      }
    }
  }

  startMqttLoop(argsConfig) {
    if (argsConfig) {
      this._applyArgsConfig(argsConfig);
    }
    const config = this._getConfigFromPage0();
    const missing = this._validateConfig(config);
    if (missing.length > 0) {
      this._writeRuntimeError('missing_config', 'missing required mqtt config', { missing_fields: missing });
      this._writeRuntimeStatus('failed');
      return { status: 'failed', missing };
    }
    const transport = argsConfig && typeof argsConfig.transport === 'string' ? argsConfig.transport : 'mock';
    this.mqttClient = transport === 'real'
      ? new MqttClientReal(this.mqttTrace, (topic, payload) => this.mqttIncoming(topic, payload))
      : new MqttClientMock(this.mqttTrace);
    this.mqttClient.connect(config);
    this._subscribeDeclaredPinsOnStart();
    this._writeRuntimeStatus('running');
    return { status: 'running' };
  }

  addLabel(model, p, r, c, label) {
    if (!this._validateCell(p, r, c)) {
      this._recordError(model, p, r, c, label, 'invalid_cell');
      return { applied: false };
    }

    const validationError = this._validateLabel(label);
    if (validationError) {
      this._recordError(model, p, r, c, label, validationError);
      return { applied: false };
    }

    const cell = this.getCell(model, p, r, c);
    const prevLabel = cell.labels.get(label.k) || null;

    if (label.k === 'v1n_id' && model.id === 0 && p === 0 && r === 0 && c === 0 && prevLabel) {
      this.eventLog.record({
        op: 'add_label',
        cell: { model_id: model.id, p, r, c },
        label,
        prev_label: prevLabel,
        result: 'rejected',
        reason: 'v1n_id_locked',
      });
      return { applied: false };
    }

    cell.labels.set(label.k, label);
    this.eventLog.record({
      op: 'add_label',
      cell: { model_id: model.id, p, r, c },
      label,
      prev_label: prevLabel,
      result: 'applied',
    });

    if (this.persistence && typeof this.persistence.onLabelAdded === 'function') {
      this.persistence.onLabelAdded({ model, p, r, c, label });
    }

    this._applyBuiltins(model, p, r, c, label, prevLabel);
    this._applyPinDeclarations(model, p, r, c, label, prevLabel);
    this._applyLabelTypes(model, p, r, c, label);
    this._applyMailboxTriggers(model, p, r, c, label);
    return { applied: true };
  }

  rmLabel(model, p, r, c, key) {
    const cell = this.getCell(model, p, r, c);
    const prevLabel = cell.labels.get(key) || null;
    if (!prevLabel) {
      return { applied: false };
    }
    cell.labels.delete(key);
    this.eventLog.record({
      op: 'rm_label',
      cell: { model_id: model.id, p, r, c },
      label: { k: key, t: prevLabel.t, v: prevLabel.v },
      prev_label: prevLabel,
      result: 'applied',
    });
    if (this.persistence && typeof this.persistence.onLabelRemoved === 'function') {
      this.persistence.onLabelRemoved({ model, p, r, c, label: prevLabel });
    }
    this._applyPinRemoval(model, p, r, c, prevLabel);
    return { applied: true };
  }

  /**
   * Build MQTT topic for a given model/pin.
   * @param {number} modelId
   * @param {string} pinName
   * @param {string} [direction] - 'in' or 'out'. Required for uiput_9layer_v2, ignored for older modes.
   */
  _topicFor(modelId, pinName, direction) {
    const config = this._getConfigFromPage0();
    const mode = this._topicMode(config);
    if (mode === 'uiput_9layer_v2') {
      const ns = config.topic_ns || '';
      if (!ns) return null;
      const dir = direction || 'in';
      const ws = config.topic_ws || 'ws';
      const dam = config.topic_dam || 'dam';
      const pic = config.topic_pic || 'pic';
      const de = config.topic_de || 'de';
      const sw = config.topic_sw || 'sw';
      return `${ns}/${dir}/${ws}/${dam}/${pic}/${de}/${sw}/${modelId}/${pinName}`;
    }
    if (mode === 'uiput_mm_v1') {
      const base = config.topic_base || '';
      if (!base) return null;
      return `${base}/${modelId}/${pinName}`;
    }
    const prefix = config.topic_prefix || '';
    if (prefix) return `${prefix}/${pinName}`;
    return `${pinName}`;
  }

  _subscribeDeclaredPinsOnStart() {
    if (!this.mqttClient) return;
    for (const key of this.pinInSet) {
      const parsed = this._parsePinKey(key);
      if (!parsed) continue;
      const topic = this._topicFor(parsed.modelId, parsed.pinK, 'in');
      if (!topic) continue;
      this.mqttClient.subscribe(topic);
    }
    // Subscribe wildcard topics declared via MQTT_WILDCARD_SUB labels
    for (const [, model] of this.models) {
      for (const [, cell] of model.cells) {
        for (const [, label] of cell.labels) {
          if (label.t === 'MQTT_WILDCARD_SUB' && typeof label.v === 'string' && label.v) {
            this.mqttClient.subscribe(label.v);
          }
        }
      }
    }
  }

  _applyPinDeclarations(model, p, r, c, label, prevLabel = null) {
    const config = this._getConfigFromPage0();
    const mode = this._topicMode(config);
    const payloadMode = this._payloadMode(config);
    const reg = this._pinRegistryCellFor(model.id, mode);
    const mailbox = this._pinMailboxCellFor(model.id, mode);
    if (model.id === reg.model_id && p === reg.p && r === reg.r && c === reg.c) {
      const pinKey = this._pinKey(model.id, label.k);
      if (prevLabel && prevLabel.k === label.k) {
        if (prevLabel.t === 'PIN_IN' && label.t !== 'PIN_IN' && label.t !== 'PIN_OUT') {
          this.pinInSet.delete(pinKey);
          this.pinInBindings.delete(pinKey);
          if (this.mqttClient) {
            const oldTopic = this._topicFor(model.id, prevLabel.k, 'in');
            if (oldTopic) this.mqttClient.unsubscribe(oldTopic);
          }
        }
        if (prevLabel.t === 'PIN_OUT' && label.t !== 'PIN_OUT' && label.t !== 'PIN_IN') {
          this.pinOutSet.delete(pinKey);
        }
        if (prevLabel.t === 'MQTT_WILDCARD_SUB' && label.t !== 'MQTT_WILDCARD_SUB' && typeof prevLabel.v === 'string' && prevLabel.v && this.mqttClient) {
          this.mqttClient.unsubscribe(prevLabel.v);
        }
      }
      if (label.t === 'PIN_IN') {
        this.pinInSet.add(pinKey);
        const binding = this._parsePinInBinding(model.id, label);
        if (binding) this.pinInBindings.set(pinKey, binding);
        else this.pinInBindings.delete(pinKey);
        if (this.mqttClient) {
          const topic = this._topicFor(model.id, label.k, 'in');
          if (topic) this.mqttClient.subscribe(topic);
        }
      }
      if (label.t === 'PIN_OUT') {
        this.pinOutSet.add(pinKey);
      }
      // Handle MQTT_WILDCARD_SUB labels (subscribe to wildcard topics)
      if (label.t === 'MQTT_WILDCARD_SUB' && typeof label.v === 'string' && label.v && this.mqttClient) {
        this.mqttClient.subscribe(label.v);
      }
      return;
    }

    if (model.id === mailbox.model_id && p === mailbox.p && r === mailbox.r && c === mailbox.c) {
      if (label.t === 'OUT' && this.pinOutSet.has(this._pinKey(model.id, label.k)) && this.mqttClient) {
        const valueIsPatch = label.v && typeof label.v === 'object' && label.v.version === 'mt.v0' && Array.isArray(label.v.records);
        const payload = (payloadMode === 'mt_v0' && valueIsPatch)
          ? label.v
          : { pin: label.k, value: label.v, t: 'OUT' };
        const topic = this._topicFor(model.id, label.k, 'out');
        if (topic) this.mqttClient.publish(topic, payload);
      }
    }
  }

  _applyPinRemoval(model, p, r, c, prevLabel) {
    const config = this._getConfigFromPage0();
    const mode = this._topicMode(config);
    const reg = this._pinRegistryCellFor(model.id, mode);
    if (model.id === reg.model_id && p === reg.p && r === reg.r && c === reg.c) {
      if (prevLabel.t === 'PIN_IN') {
        const pinKey = this._pinKey(model.id, prevLabel.k);
        this.pinInSet.delete(pinKey);
        this.pinInBindings.delete(pinKey);
        if (this.mqttClient) {
          const topic = this._topicFor(model.id, prevLabel.k, 'in');
          if (topic) this.mqttClient.unsubscribe(topic);
        }
      }
      if (prevLabel.t === 'PIN_OUT') {
        this.pinOutSet.delete(this._pinKey(model.id, prevLabel.k));
      }
      if (prevLabel.t === 'MQTT_WILDCARD_SUB' && typeof prevLabel.v === 'string' && prevLabel.v && this.mqttClient) {
        this.mqttClient.unsubscribe(prevLabel.v);
      }
    }
  }

  _applyLabelTypes(model, p, r, c, label) {
    if (label.t === 'function') {
      model.registerFunction(label.k);
    }
  }

  _resolveTriggerModelId(funcName, preferredIds = []) {
    if (typeof funcName !== 'string' || !funcName) return null;
    const seen = new Set();
    const preferred = Array.isArray(preferredIds) ? preferredIds : [];
    for (const modelId of preferred) {
      if (!Number.isInteger(modelId) || seen.has(modelId)) continue;
      seen.add(modelId);
      const model = this.getModel(modelId);
      if (model && model.hasFunction(funcName)) {
        return modelId;
      }
    }
    const allIds = [...this.models.keys()].sort((a, b) => a - b);
    for (const modelId of allIds) {
      if (seen.has(modelId)) continue;
      const model = this.getModel(modelId);
      if (model && model.hasFunction(funcName)) {
        return modelId;
      }
    }
    return null;
  }

  _applyMailboxTriggers(model, p, r, c, label) {
    if (!this.runLoopActive) return;
    const queued = new Set();
    const enqueueRunFunc = (funcName, modelId, extraPayload = null) => {
      if (typeof funcName !== 'string' || !funcName) return;
      const queueKey = `${Number.isInteger(modelId) ? modelId : 'na'}:${funcName}`;
      if (queued.has(queueKey)) return;
      queued.add(queueKey);
      const payload = {
        func: funcName,
        trigger_label: { k: label.k, t: label.t },
      };
      if (Number.isInteger(modelId)) {
        payload.model_id = modelId;
      }
      if (extraPayload && typeof extraPayload === 'object') {
        Object.assign(payload, extraPayload);
      }
      this.intercepts.record('run_func', payload);
    };

    const triggers = model.getMailboxTriggers(p, r, c);
    for (const funcName of triggers) {
      if (model.hasFunction(funcName)) {
        enqueueRunFunc(funcName, model.id);
      }
    }

    if (label.t !== 'IN') return;
    const matches = this.findPinInBindingsForDelivery({ model_id: model.id, p, r, c }, label.k);
    for (const match of matches) {
      const binding = match.binding && typeof match.binding === 'object' ? match.binding : null;
      const bindingFuncs = binding && Array.isArray(binding.trigger_funcs) ? binding.trigger_funcs : [];
      if (bindingFuncs.length === 0) continue;
      const preferredIds = [];
      if (binding && Number.isInteger(binding.trigger_model_id)) preferredIds.push(binding.trigger_model_id);
      if (Number.isInteger(match.pin_model_id)) preferredIds.push(match.pin_model_id);
      preferredIds.push(model.id);
      for (const funcName of bindingFuncs) {
        if (typeof funcName !== 'string' || !funcName) continue;
        const resolvedModelId = this._resolveTriggerModelId(funcName, preferredIds);
        enqueueRunFunc(funcName, resolvedModelId, {
          pin_binding: {
            pin_model_id: match.pin_model_id,
            pin_k: match.pin_k,
            route_mode: match.route_mode,
          },
        });
      }
    }
  }

  mqttIncoming(topic, payload) {
    const config = this._getConfigFromPage0();
    const mode = this._topicMode(config);
    const payloadMode = this._payloadMode(config);
    if (!payload) return false;
    if (payloadMode === 'mt_v0') {
      if (!(typeof payload === 'object' && payload.version === 'mt.v0' && Array.isArray(payload.records))) {
        return false;
      }
    } else {
      if (payload.t !== 'IN') return false;
    }

    if (mode === 'uiput_9layer_v2') {
      // 9-layer: UIPUT/{dir}/{ws}/{dam}/{pic}/{de}/{sw}/{model}/{pin}
      const ns = config.topic_ns || '';
      if (!ns) return false;
      if (!topic || typeof topic !== 'string' || !topic.startsWith(`${ns}/`)) {
        return false;
      }
      const rest = topic.slice(ns.length + 1);
      const parts = rest.split('/');
      // parts: [dir, ws, dam, pic, de, sw, model, pin]
      if (parts.length !== 8) {
        return false;
      }
      const direction = parts[0];
      // Only accept 'in' direction for incoming messages to this worker
      if (direction !== 'in') {
        // Could be a wildcard subscription match (e.g. UIPUT/out/#)
        // Route to wildcard inbox if any MQTT_WILDCARD_SUB label matches
        return this._handleWildcardIncoming(topic, payload, config, mode);
      }
      const modelId = Number(parts[6]);
      const pinName = parts[7] || '';
      if (!Number.isInteger(modelId) || !pinName) {
        return false;
      }
      if (!this.pinInSet.has(this._pinKey(modelId, pinName))) {
        return false;
      }
      const model = this.getModel(modelId);
      if (!model) {
        return false;
      }
      const route = this._resolvePinInRouteForMode(modelId, pinName, mode);
      const targetModel = this.getModel(route.target.model_id);
      if (!targetModel) return false;

      if (payloadMode === 'mt_v0' && payload && Array.isArray(payload.records) && payload.records.length > 0) {
        const result = this.applyPatch(payload, { allowCreateModel: false });
        this.mqttTrace.record('inbound', { topic, payload, mode: 'records', applied: result.applied, rejected: result.rejected });

        const binding = this.pinInBindings.get(this._pinKey(modelId, pinName));
        const triggerFuncs = binding && Array.isArray(binding.trigger_funcs) ? binding.trigger_funcs : [];
        if (triggerFuncs.length > 0) {
          // Emit an explicit IN trigger label to drive PIN_IN binding triggers.
          // Note: PIN_IN binding triggers are gated by label.t === 'IN'.
          this.addLabel(targetModel, route.target.p, route.target.r, route.target.c, {
            k: route.target.k,
            t: 'IN',
            v: { op_id: typeof payload.op_id === 'string' ? payload.op_id : '' },
          });
        }
        return true;
      }

      // fallback: legacy behavior (records empty or non-mt.v0 mode)
      this.addLabel(targetModel, route.target.p, route.target.r, route.target.c, { k: route.target.k, t: 'IN', v: payload });
      this.mqttTrace.record('inbound', { topic, payload, mode: 'legacy_in' });
      return true;
    }

    if (mode === 'uiput_mm_v1') {
      const base = config.topic_base || '';
      if (!base) return false;
      const prefix = `${base}/`;
      if (!topic || typeof topic !== 'string' || !topic.startsWith(prefix)) {
        return false;
      }
      const rest = topic.slice(prefix.length);
      const parts = rest.split('/');
      if (parts.length !== 2) {
        return false;
      }
      const modelId = Number(parts[0]);
      const pinName = parts[1] || '';
      if (!Number.isInteger(modelId) || !pinName || pinName.includes('/')) {
        return false;
      }
      if (!this.pinInSet.has(this._pinKey(modelId, pinName))) {
        return false;
      }
      const model = this.getModel(modelId);
      if (!model) {
        return false;
      }
      const route = this._resolvePinInRouteForMode(modelId, pinName, mode);
      const targetModel = this.getModel(route.target.model_id);
      if (!targetModel) return false;

      if (payloadMode === 'mt_v0' && payload && Array.isArray(payload.records) && payload.records.length > 0) {
        const result = this.applyPatch(payload, { allowCreateModel: false });
        this.mqttTrace.record('inbound', { topic, payload, mode: 'records', applied: result.applied, rejected: result.rejected });

        const binding = this.pinInBindings.get(this._pinKey(modelId, pinName));
        const triggerFuncs = binding && Array.isArray(binding.trigger_funcs) ? binding.trigger_funcs : [];
        if (triggerFuncs.length > 0) {
          this.addLabel(targetModel, route.target.p, route.target.r, route.target.c, {
            k: route.target.k,
            t: 'IN',
            v: { op_id: typeof payload.op_id === 'string' ? payload.op_id : '' },
          });
        }
        return true;
      }

      this.addLabel(targetModel, route.target.p, route.target.r, route.target.c, { k: route.target.k, t: 'IN', v: payload });
      this.mqttTrace.record('inbound', { topic, payload, mode: 'legacy_in' });
      return true;
    }

    const prefix = config.topic_prefix || '';
    let pinName = topic;
    if (prefix && topic.startsWith(`${prefix}/`)) {
      pinName = topic.slice(prefix.length + 1);
    }
    if (!pinName || pinName.includes('/')) {
      return false;
    }
    if (!this.pinInSet.has(this._pinKey(0, pinName))) {
      return false;
    }
    const mailbox = this._pinMailboxCellFor(0, mode);
    const model = this.getModel(mailbox.model_id);

    if (payloadMode === 'mt_v0' && payload && Array.isArray(payload.records) && payload.records.length > 0) {
      const result = this.applyPatch(payload, { allowCreateModel: false });
      this.mqttTrace.record('inbound', { topic, payload, mode: 'records', applied: result.applied, rejected: result.rejected });

      const binding = this.pinInBindings.get(this._pinKey(0, pinName));
      const triggerFuncs = binding && Array.isArray(binding.trigger_funcs) ? binding.trigger_funcs : [];
      if (triggerFuncs.length > 0) {
        this.addLabel(model, mailbox.p, mailbox.r, mailbox.c, {
          k: pinName,
          t: 'IN',
          v: { op_id: typeof payload.op_id === 'string' ? payload.op_id : '' },
        });
      }
      return true;
    }

    this.addLabel(model, mailbox.p, mailbox.r, mailbox.c, { k: pinName, t: 'IN', v: payload });
    this.mqttTrace.record('inbound', { topic, payload, mode: 'legacy_in' });
    return true;
  }

  /**
   * Handle messages arriving via wildcard subscriptions (MQTT_WILDCARD_SUB).
   * Writes to the declaring model's mailbox cell with topic+payload.
   */
  _handleWildcardIncoming(topic, payload, config, mode) {
    let matched = false;
    for (const [, model] of this.models) {
      for (const [, cell] of model.cells) {
        for (const [, label] of cell.labels) {
          if (label.t !== 'MQTT_WILDCARD_SUB' || typeof label.v !== 'string') continue;
          if (!this._topicMatchesWildcard(topic, label.v)) continue;
          // Write to the model's mailbox
          const mailbox = this._pinMailboxCellFor(model.id, mode);
          this.addLabel(model, mailbox.p, mailbox.r, mailbox.c, {
            k: label.k,
            t: 'IN',
            v: { topic, payload },
          });
          this.mqttTrace.record('wildcard_inbound', { topic, wildcard: label.v, model_id: model.id });
          matched = true;
        }
      }
    }
    return matched;
  }

  /**
   * Check if an MQTT topic matches a wildcard subscription pattern.
   * Supports '+' (single-level) and '#' (multi-level, must be last).
   */
  _topicMatchesWildcard(topic, pattern) {
    if (!topic || !pattern) return false;
    if (pattern === '#') return true;
    const topicParts = topic.split('/');
    const patternParts = pattern.split('/');
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] === '#') return true;
      if (i >= topicParts.length) return false;
      if (patternParts[i] === '+') continue;
      if (patternParts[i] !== topicParts[i]) return false;
    }
    return topicParts.length === patternParts.length;
  }

  // --- 0141: CELL_CONNECT / cell_connection parsing and routing ---

  _parseCellConnectEndpoint(str) {
    if (typeof str !== 'string') return null;
    const trimmed = str.trim();
    if (!trimmed.startsWith('(') || !trimmed.endsWith(')')) return null;
    const inner = trimmed.slice(1, -1);
    const parts = inner.includes(', ') ? inner.split(', ') : inner.split(',');
    if (parts.length !== 2) return null;
    const prefix = parts[0].trim();
    const port = parts[1].trim();
    if (!prefix || !port) return null;
    if (prefix !== 'self' && prefix !== 'func') {
      const num = parseInt(prefix, 10);
      if (!Number.isInteger(num)) return null;
    }
    return { prefix, port };
  }

  _parseCellConnectLabel(model, p, r, c, label) {
    const v = label.v;
    if (!v || typeof v !== 'object' || Array.isArray(v)) {
      this._recordError(model, p, r, c, label, 'cell_connect_invalid_value');
      return;
    }
    const cellKey = `${model.id}|${p}|${r}|${c}`;
    if (!this.cellConnectGraph.has(cellKey)) {
      this.cellConnectGraph.set(cellKey, new Map());
    }
    const cellGraph = this.cellConnectGraph.get(cellKey);
    for (const [sourceStr, targetArr] of Object.entries(v)) {
      const source = this._parseCellConnectEndpoint(sourceStr);
      if (!source) {
        this._recordError(model, p, r, c, label, 'cell_connect_bad_source');
        continue;
      }
      if (!Array.isArray(targetArr)) {
        this._recordError(model, p, r, c, label, 'cell_connect_bad_targets');
        continue;
      }
      const targets = [];
      for (const tStr of targetArr) {
        const t = this._parseCellConnectEndpoint(tStr);
        if (!t) {
          this._recordError(model, p, r, c, label, 'cell_connect_bad_target');
          continue;
        }
        targets.push(t);
      }
      if (targets.length > 0) {
        const endpointKey = `${source.prefix}:${source.port}`;
        cellGraph.set(endpointKey, targets);
      }
    }
  }

  _parseCellConnectionLabel(model, p, r, c, label) {
    if (p !== 0 || r !== 0 || c !== 0) {
      this._recordError(model, p, r, c, label, 'cell_connection_wrong_position');
      return;
    }
    const v = label.v;
    if (!Array.isArray(v)) {
      this._recordError(model, p, r, c, label, 'cell_connection_invalid_value');
      return;
    }
    for (const entry of v) {
      if (!entry || typeof entry !== 'object') continue;
      const from = entry.from;
      const to = entry.to;
      if (!Array.isArray(from) || from.length !== 4) {
        this._recordError(model, p, r, c, label, 'cell_connection_bad_from');
        continue;
      }
      if (!Array.isArray(to)) {
        this._recordError(model, p, r, c, label, 'cell_connection_bad_to');
        continue;
      }
      const routeKey = `${model.id}|${from[0]}|${from[1]}|${from[2]}|${from[3]}`;
      const targets = [];
      for (const dest of to) {
        if (!Array.isArray(dest) || dest.length !== 4) {
          this._recordError(model, p, r, c, label, 'cell_connection_bad_dest');
          continue;
        }
        targets.push({ model_id: model.id, p: dest[0], r: dest[1], c: dest[2], k: dest[3] });
      }
      if (targets.length > 0) {
        const existing = this.cellConnectionRoutes.get(routeKey) || [];
        this.cellConnectionRoutes.set(routeKey, existing.concat(targets));
      }
    }
  }

  _routeViaCellConnection(modelId, p, r, c, k, value) {
    const key = `${modelId}|${p}|${r}|${c}|${k}`;
    const targets = this.cellConnectionRoutes.get(key);
    if (!targets) return;
    for (const t of targets) {
      const targetModel = this.getModel(t.model_id);
      if (!targetModel) continue;
      this.addLabel(targetModel, t.p, t.r, t.c, { k: t.k, t: 'IN', v: value });
    }
  }

  async _propagateCellConnect(modelId, p, r, c, prefix, port, value, visited = new Set()) {
    const cellKey = `${modelId}|${p}|${r}|${c}`;
    const endpointKey = `${prefix}:${port}`;
    const visitKey = `${cellKey}|${endpointKey}`;

    if (visited.has(visitKey)) {
      this.eventLog.record({
        op: 'cell_connect_cycle',
        cell: { model_id: modelId, p, r, c },
        label: { k: endpointKey },
        result: 'skipped',
        reason: 'cycle_detected',
      });
      return;
    }
    visited.add(visitKey);

    const cellGraph = this.cellConnectGraph.get(cellKey);
    if (!cellGraph) return;
    const targets = cellGraph.get(endpointKey);
    if (!targets) return;

    const tasks = targets.map((t) => {
      if (t.prefix === 'self') {
        const targetModel = this.getModel(modelId);
        if (!targetModel) return Promise.resolve();
        this.addLabel(targetModel, p, r, c, { k: t.port, t: 'OUT', v: value });
        this._routeViaCellConnection(modelId, p, r, c, t.port, value);
        return this._propagateCellConnect(modelId, p, r, c, 'self', t.port, value, visited);
      }
      if (t.prefix === 'func') {
        if (t.port.endsWith(':in')) {
          const funcName = t.port.slice(0, -3);
          return this._executeFuncViaCellConnect(modelId, p, r, c, funcName, value, visited);
        }
        if (t.port.endsWith(':out')) {
          return this._propagateCellConnect(modelId, p, r, c, 'func', t.port, value, visited);
        }
      }
      // Numeric ID prefix: placeholder for 0142
      return Promise.resolve();
    });
    await Promise.all(tasks);
  }

  async _executeFuncViaCellConnect(modelId, p, r, c, funcName, inputValue, visited) {
    const model = this.getModel(modelId);
    if (!model) return;
    const cell = this.getCell(model, p, r, c);
    let funcLabel = null;
    for (const [, lbl] of cell.labels) {
      if (lbl.k === funcName && lbl.t === 'function') {
        funcLabel = lbl;
        break;
      }
    }
    if (!funcLabel) {
      const sysModel = this.getModel(-10);
      if (sysModel) {
        const sysCell = this.getCell(sysModel, 0, 0, 0);
        const sysLabel = sysCell.labels.get(funcName);
        if (sysLabel && sysLabel.t === 'function') funcLabel = sysLabel;
      }
    }
    if (!funcLabel || typeof funcLabel.v !== 'string') return;

    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const fn = new AsyncFunction('ctx', 'label', funcLabel.v);

    const runtime = this;
    const ctx = {
      runtime,
      getLabel(ref) {
        if (!ref || !Number.isInteger(ref.model_id)) return undefined;
        const m = runtime.getModel(ref.model_id);
        if (!m) return undefined;
        const cl = runtime.getCell(m, ref.p || 0, ref.r || 0, ref.c || 0);
        if (!cl) return undefined;
        const l = cl.labels.get(ref.k);
        return l ? l.v : undefined;
      },
      writeLabel(ref, t, v) {
        if (!ref || !Number.isInteger(ref.model_id)) return;
        const m = runtime.getModel(ref.model_id);
        if (!m) return;
        runtime.addLabel(m, ref.p || 0, ref.r || 0, ref.c || 0, { k: ref.k, t, v });
      },
      rmLabel(ref) {
        if (!ref || !Number.isInteger(ref.model_id)) return;
        const m = runtime.getModel(ref.model_id);
        if (!m) return;
        runtime.rmLabel(m, ref.p || 0, ref.r || 0, ref.c || 0, ref.k);
      },
    };

    const FUNC_TIMEOUT_MS = 30000;
    try {
      const result = await Promise.race([
        fn(ctx, { k: funcName, t: 'IN', v: inputValue }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Function ${funcName} timeout after ${FUNC_TIMEOUT_MS}ms`)), FUNC_TIMEOUT_MS),
        ),
      ]);
      if (result !== undefined) {
        await this._propagateCellConnect(modelId, p, r, c, 'func', `${funcName}:out`, result, visited);
      }
    } catch (err) {
      this.addLabel(model, p, r, c, {
        k: `__error_${funcName}`,
        t: 'json',
        v: { error: err.message, ts: Date.now() },
      });
    }
  }

  // --- end 0141 ---

  _applyBuiltins(model, p, r, c, label, prevLabel) {
    // 0141: label.t dispatch (independent from label.k connectKeys)
    if (label.t === 'CELL_CONNECT') {
      this._parseCellConnectLabel(model, p, r, c, label);
      return;
    }
    if (label.t === 'cell_connection') {
      this._parseCellConnectionLabel(model, p, r, c, label);
      return;
    }
    if (label.t === 'IN') {
      const cellKey = `${model.id}|${p}|${r}|${c}`;
      if (this.cellConnectGraph.has(cellKey)) {
        this._propagateCellConnect(model.id, p, r, c, 'self', label.k, label.v)
          .catch((err) => {
            this._recordError(model, p, r, c, label, 'cell_connect_propagation_error');
          });
      }
    }

    const key = label.k;

    if (key === 'local_mqtt' && model.id === 0 && p === 0 && r === 0 && c === 0) {
      this.v1nConfig.local_mqtt = label.v;
      return;
    }
    if (key === 'global_mqtt' && model.id === 0 && p === 0 && r === 0 && c === 0) {
      this.v1nConfig.global_mqtt = label.v;
      return;
    }

    if (key === 'model_type') {
      // Explicitly no reset/init side effects in v0
      return;
    }

    if (key === 'data_type' && model.type === 'Data' && p === 0 && r === 0 && c === 0) {
      if (!prevLabel) {
        // order: add_label -> rm_label(CELL_CONNECT) -> init_type intercept
        this.rmLabel(model, 0, 0, 0, 'CELL_CONNECT');
        this.intercepts.record('init_type', { model_id: model.id });
      }
      return;
    }

    const connectKeys = new Set([
      'CELL_CONNECT',
      'MODEL_CONNECT',
      'V1N_CONNECT',
      'DE_CONNECT',
      'DAM_CONNECT',
      'PIC_CONNECT',
      'WORKSPACE_CONNECT',
    ]);

    if (connectKeys.has(key)) {
      if (key === 'CELL_CONNECT') {
        this.intercepts.record('init_inner_connection', { scope: 'cell', model_id: model.id });
      }
      if (key === 'MODEL_CONNECT' && p === 0 && r === 0 && c === 0) {
        this.intercepts.record('init_inner_connection', { scope: 'model', model_id: model.id });
      }
      if (key === 'V1N_CONNECT' && model.id === 0 && p === 0 && r === 0 && c === 0) {
        this.intercepts.record('init_inner_connection', { scope: 'v1n', model_id: model.id });
      }
      return;
    }

    if (key.startsWith('run_')) {
      if (!this.runLoopActive) {
        return;
      }
      const funcName = key.slice('run_'.length);
      if (model.hasFunction(funcName)) {
        this.intercepts.record('run_func', { model_id: model.id, func: funcName });
      } else {
        this._recordError(model, p, r, c, label, 'func_not_found');
      }
    }
  }

  snapshot() {
    const models = {};
    for (const [id, model] of this.models.entries()) {
      const cells = {};
      for (const [key, cell] of model.cells.entries()) {
        const labels = {};
        for (const [lk, lv] of cell.labels.entries()) {
          labels[lk] = { k: lv.k, t: lv.t, v: lv.v };
        }
        cells[key] = { p: cell.p, r: cell.r, c: cell.c, labels };
      }
      models[id] = { id: model.id, name: model.name, type: model.type, cells };
    }
    return { models, v1nConfig: { ...this.v1nConfig } };
  }
}

export { ModelTableRuntime };
