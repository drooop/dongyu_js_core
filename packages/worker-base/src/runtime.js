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
  // eslint-disable-next-line global-require
  _mqttPkg = require('mqtt');
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
      connectTimeout: 10_000,
    };

    // Allow local self-signed brokers when tls=true.
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
      const msg = typeof payload === 'string' ? payload : JSON.stringify(payload);
      this._client.publish(topic, msg);
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
    /**
     * Functions registered on this model.
     * Key = function name, Value = handler function or null (declaration only).
     * A handler receives (ctx) where ctx = { runtime, model, event, label }.
     */
    this.functions = new Map();
    /**
     * Mailbox triggers: map from cell key ("p,r,c") to array of function names.
     * When a label is written to a mailbox cell, all registered functions fire.
     */
    this.mailboxTriggers = new Map();
  }

  /**
   * Register a function on this model.
   * @param {string} name - function name
   * @param {Function|null} handler - JS handler or null (declaration-only, for legacy compat)
   */
  registerFunction(name, handler) {
    this.functions.set(name, handler !== undefined ? handler : null);
  }

  hasFunction(name) {
    return this.functions.has(name);
  }

  getFunction(name) {
    return this.functions.get(name) || null;
  }

  /**
   * Register a mailbox trigger: when a label is written to cell (p,r,c),
   * the named function will be triggered.
   */
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
    // 0141: CELL_CONNECT graph (two-level Map)
    // outer key: "${modelId}|${p}|${r}|${c}" (pipe-separated)
    // inner: Map<"${prefix}:${port}", [{prefix, port}]>
    this.cellConnectGraph = new Map();
    // 0141: cell_connection routing table
    // key: "${modelId}|${p}|${r}|${c}|${k}" (pipe-separated)
    // value: [{model_id, p, r, c, k}]
    this.cellConnectionRoutes = new Map();
    // 0142: BUS_IN/BUS_OUT port registries (Model 0 only)
    this.busInPorts = new Map();
    this.busOutPorts = new Map();
    // 0142: parent-child model map
    // key: childModelId → value: { parentModelId, hostingCell: {p, r, c} }
    this.parentChildMap = new Map();
    // 0142: MODEL_IN/MODEL_OUT port registries
    // key: "${modelId}:${label.k}" → value: true
    this.modelInPorts = new Map();
    this.modelOutPorts = new Map();
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
    // Only write the function label to Cell(0,0,0) for declaration-only functions
    // (code-string functions loaded from SQLite). Runtime handlers (with a handler
    // function) don't need a label — they're registered directly on the model.
    // Writing function labels for runtime handlers would pollute listSystemLabels.
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
          // Make record replay/idempotency safe at patch layer.
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
    this._applyLabelTypes(model, p, r, c, label);
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
    // 0142: Subscribe BUS_IN ports
    for (const [portName] of this.busInPorts) {
      const topic = this._topicFor(0, portName, 'in');
      if (topic) this.mqttClient.subscribe(topic);
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

  _applyLabelTypes(model, p, r, c, label) {
    if (label.t === 'function') {
      model.registerFunction(label.k);
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
      // 0142: BUS_IN short-circuit
      if (this.busInPorts.has(pinName) && modelId === 0) {
        this._handleBusInMessage(pinName, payload);
        return true;
      }
      const model = this.getModel(modelId);
      if (!model) return false;

      if (payloadMode === 'mt_v0' && payload && Array.isArray(payload.records) && payload.records.length > 0) {
        const result = this.applyPatch(payload, { allowCreateModel: false });
        this.mqttTrace.record('inbound', { topic, payload, mode: 'records', applied: result.applied, rejected: result.rejected });
        // Write IN label to trigger CELL_CONNECT / cell_connection routing
        this.addLabel(model, 0, 0, 0, {
          k: pinName,
          t: 'IN',
          v: { op_id: typeof payload.op_id === 'string' ? payload.op_id : '' },
        });
        return true;
      }

      this.addLabel(model, 0, 0, 0, { k: pinName, t: 'IN', v: payload });
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
      if (parts.length !== 2) return false;
      const modelId = Number(parts[0]);
      const pinName = parts[1] || '';
      if (!Number.isInteger(modelId) || !pinName || pinName.includes('/')) return false;

      const model = this.getModel(modelId);
      if (!model) return false;

      if (payloadMode === 'mt_v0' && payload && Array.isArray(payload.records) && payload.records.length > 0) {
        const result = this.applyPatch(payload, { allowCreateModel: false });
        this.mqttTrace.record('inbound', { topic, payload, mode: 'records', applied: result.applied, rejected: result.rejected });
        this.addLabel(model, 0, 0, 0, {
          k: pinName,
          t: 'IN',
          v: { op_id: typeof payload.op_id === 'string' ? payload.op_id : '' },
        });
        return true;
      }

      this.addLabel(model, 0, 0, 0, { k: pinName, t: 'IN', v: payload });
      this.mqttTrace.record('inbound', { topic, payload, mode: 'legacy_in' });
      return true;
    }

    // Stage2 / legacy mode
    const prefix = config.topic_prefix || '';
    let pinName = topic;
    if (prefix && topic.startsWith(`${prefix}/`)) {
      pinName = topic.slice(prefix.length + 1);
    }
    if (!pinName || pinName.includes('/')) return false;

    const model = this.getModel(0);
    if (!model) return false;

    if (payloadMode === 'mt_v0' && payload && Array.isArray(payload.records) && payload.records.length > 0) {
      const result = this.applyPatch(payload, { allowCreateModel: false });
      this.mqttTrace.record('inbound', { topic, payload, mode: 'records', applied: result.applied, rejected: result.rejected });
      this.addLabel(model, 0, 0, 0, {
        k: pinName,
        t: 'IN',
        v: { op_id: typeof payload.op_id === 'string' ? payload.op_id : '' },
      });
      return true;
    }

    this.addLabel(model, 0, 0, 0, { k: pinName, t: 'IN', v: payload });
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
          // Write to the model's root cell for CELL_CONNECT routing
          this.addLabel(model, 0, 0, 0, {
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
      // 0142: Numeric ID prefix → route to child model MODEL_IN
      if (!isNaN(Number(t.prefix))) {
        const childModelId = Number(t.prefix);
        if (!this.parentChildMap.has(childModelId)) {
          this.eventLog.record({
            op: 'cell_connect_error',
            cell: { model_id: modelId, p, r, c },
            label: { k: `${t.prefix}:${t.port}` },
            result: 'failed',
            reason: 'submodel_not_registered',
          });
          return Promise.resolve();
        }
        const childModel = this.getModel(childModelId);
        if (!childModel) return Promise.resolve();
        this.addLabel(childModel, 0, 0, 0, { k: t.port, t: 'MODEL_IN', v: value });
        return Promise.resolve();
      }
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
      publishMqtt(topic, payload) {
        if (!runtime.mqttClient) return;
        runtime.mqttClient.publish(topic, payload);
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

  // --- 0142: BUS_IN message handler ---

  _handleBusInMessage(portName, payload) {
    const model0 = this.getModel(0);
    if (!model0) return;
    this.addLabel(model0, 0, 0, 0, { k: portName, t: 'BUS_IN', v: payload });
    this.mqttTrace.record('bus_inbound', { port: portName, payload });
  }

  // --- end 0142 ---

  _applyBuiltins(model, p, r, c, label, prevLabel) {
    // 0143: MQTT_WILDCARD_SUB subscription management
    if (label.t === 'MQTT_WILDCARD_SUB') {
      if (prevLabel && prevLabel.t === 'MQTT_WILDCARD_SUB' && typeof prevLabel.v === 'string' && prevLabel.v && this.mqttClient) {
        this.mqttClient.unsubscribe(prevLabel.v);
      }
      if (typeof label.v === 'string' && label.v && this.mqttClient) {
        this.mqttClient.subscribe(label.v);
      }
      return;
    }
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
      // 0143: Route via cell_connection to propagate IN to target cells
      this._routeViaCellConnection(model.id, p, r, c, label.k, label.v);
      // Propagate via CELL_CONNECT if this cell has wiring
      const cellKey = `${model.id}|${p}|${r}|${c}`;
      if (this.cellConnectGraph.has(cellKey)) {
        this._propagateCellConnect(model.id, p, r, c, 'self', label.k, label.v)
          .catch((err) => {
            this._recordError(model, p, r, c, label, 'cell_connect_propagation_error');
          });
      }
    }
    // 0142: BUS_IN label dispatch
    if (label.t === 'BUS_IN') {
      if (model.id !== 0 || p !== 0 || r !== 0 || c !== 0) {
        this._recordError(model, p, r, c, label, 'bus_in_wrong_position');
        return;
      }
      this.busInPorts.set(label.k, true);
      if (label.v !== null && label.v !== undefined) {
        this._routeViaCellConnection(0, 0, 0, 0, label.k, label.v);
      }
      return;
    }
    // 0142: BUS_OUT label dispatch
    if (label.t === 'BUS_OUT') {
      if (model.id !== 0 || p !== 0 || r !== 0 || c !== 0) {
        this._recordError(model, p, r, c, label, 'bus_out_wrong_position');
        return;
      }
      this.busOutPorts.set(label.k, true);
      if (label.v !== null && label.v !== undefined && this.mqttClient) {
        const topic = this._topicFor(0, label.k, 'out');
        if (topic) this.mqttClient.publish(topic, label.v);
      }
      return;
    }
    // 0142: subModel declaration
    if (label.t === 'subModel') {
      const childModelId = parseInt(label.k, 10);
      if (!Number.isInteger(childModelId)) {
        this._recordError(model, p, r, c, label, 'submodel_invalid_id');
        return;
      }
      this.parentChildMap.set(childModelId, {
        parentModelId: model.id,
        hostingCell: { p, r, c },
      });
      if (!this.getModel(childModelId)) {
        this.createModel({
          id: childModelId,
          name: (label.v && label.v.alias) || String(childModelId),
          type: 'sub',
        });
      }
      return;
    }
    // 0142: MODEL_IN label dispatch
    if (label.t === 'MODEL_IN') {
      if (p !== 0 || r !== 0 || c !== 0) {
        this._recordError(model, p, r, c, label, 'model_in_wrong_position');
        return;
      }
      this.modelInPorts.set(`${model.id}:${label.k}`, true);
      if (label.v !== null && label.v !== undefined) {
        this._routeViaCellConnection(model.id, 0, 0, 0, label.k, label.v);
        const cellKey = `${model.id}|0|0|0`;
        if (this.cellConnectGraph.has(cellKey)) {
          this._propagateCellConnect(model.id, 0, 0, 0, 'self', label.k, label.v)
            .catch((err) => {
              this._recordError(model, p, r, c, label, 'model_in_propagation_error');
            });
        }
      }
      return;
    }
    // 0142: MODEL_OUT label dispatch
    if (label.t === 'MODEL_OUT') {
      if (p !== 0 || r !== 0 || c !== 0) {
        this._recordError(model, p, r, c, label, 'model_out_wrong_position');
        return;
      }
      this.modelOutPorts.set(`${model.id}:${label.k}`, true);
      if (label.v !== null && label.v !== undefined) {
        const childInfo = this.parentChildMap.get(model.id);
        if (childInfo) {
          const { parentModelId, hostingCell: { p: hp, r: hr, c: hc } } = childInfo;
          this._propagateCellConnect(parentModelId, hp, hr, hc, String(model.id), label.k, label.v)
            .catch((err) => {
              this._recordError(model, p, r, c, label, 'model_out_propagation_error');
            });
        }
      }
      return;
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

module.exports = {
  ModelTableRuntime,
};
