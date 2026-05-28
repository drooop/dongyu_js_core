'use strict';

import defaultTableProgramsJson from '../system-models/default_table_programs.json' with { type: 'json' };

class EventLog {
  constructor() {
    this._events = [];
    this._nextId = 1;
    this._observer = null;
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
    if (typeof this._observer === 'function') {
      try { this._observer(entry); } catch (_) { /* observer errors must not break record */ }
    }
    return entry;
  }

  setObserver(callback) {
    this._observer = typeof callback === 'function' ? callback : null;
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
let _runtimeRequire = null;

function normalizeRequireCandidate(candidate) {
  if (typeof candidate === 'function') return candidate;
  if (candidate && typeof candidate.require === 'function') {
    return candidate.require.bind(candidate);
  }
  return null;
}

function lazyRuntimeRequire() {
  if (_runtimeRequire) return _runtimeRequire;

  const importMetaRequire = normalizeRequireCandidate(import.meta && import.meta.require);
  if (importMetaRequire) {
    _runtimeRequire = importMetaRequire;
    return _runtimeRequire;
  }

  let directRequire = null;
  try {
    // Keep Node-only resolution lazy so browser bundles never touch
    // `node:module` during static analysis.
    // eslint-disable-next-line no-new-func
    directRequire = (new Function('return (typeof require!=="undefined")?require:null;'))();
  } catch (_) {
    directRequire = null;
  }
  const normalizedDirect = normalizeRequireCandidate(directRequire);
  if (normalizedDirect) {
    _runtimeRequire = normalizedDirect;
    return _runtimeRequire;
  }

  try {
    const getBuiltinModule = typeof process !== 'undefined' && process && typeof process.getBuiltinModule === 'function'
      ? process.getBuiltinModule.bind(process)
      : null;
    if (getBuiltinModule) {
      const modulePkg = getBuiltinModule('module');
      const createRequire = modulePkg && typeof modulePkg.createRequire === 'function'
        ? modulePkg.createRequire
        : null;
      if (createRequire) {
        const created = normalizeRequireCandidate(createRequire(import.meta.url));
        if (created) {
          _runtimeRequire = created;
          return _runtimeRequire;
        }
      }
    }
  } catch (_) {
    // noop
  }

  const moduleRequire = typeof module !== 'undefined' ? normalizeRequireCandidate(module) : null;
  if (moduleRequire) {
    _runtimeRequire = moduleRequire;
    return _runtimeRequire;
  }

  return null;
}

function lazyMqtt() {
  if (_mqttPkg) return _mqttPkg;
  const req = lazyRuntimeRequire();
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
    // 0142+: table/single model-boundary pin registries
    // key: "${modelId}:${label.k}" → value: true
    this.modelInPorts = new Map();
    this.modelOutPorts = new Map();
    this.runtimeMode = 'boot';
    this.runLoopActive = false;
    this.persistence = null;

    const root = new Model({ id: 0, name: 'MT', type: 'main' });
    this.models.set(root.id, root);
    this.addLabel(root, 0, 0, 0, { k: 'runtime_mode', t: 'str', v: this.runtimeMode });
    this._seedDefaultRootScaffold(root);
  }

  _resolveLabelType(labelType) {
    if (labelType === 'model.submt') return 'submt';
    return labelType;
  }

  _isBusInResolvedType(typeName) {
    return typeName === 'pin.bus.cb.in' || typeName === 'pin.bus.mb.in';
  }

  _isBusOutResolvedType(typeName) {
    return typeName === 'pin.bus.cb.out' || typeName === 'pin.bus.mb.out';
  }

  _isBusResolvedType(typeName) {
    return this._isBusInResolvedType(typeName) || this._isBusOutResolvedType(typeName);
  }

  _isManagementBusResolvedType(typeName) {
    return typeName === 'pin.bus.mb.in' || typeName === 'pin.bus.mb.out';
  }

  _isDemWorker() {
    const model0 = this.getModel(0);
    if (!model0) return false;
    const cell = model0.cells.get(model0.cellKey(0, 0, 0));
    const role = cell && cell.labels ? cell.labels.get('sys_worker_role') : null;
    return Boolean(role && role.t === 'worker.role' && role.v === 'DEM');
  }

  _hasManagementBusPins(model0) {
    if (!model0) return false;
    const cell = model0.cells.get(model0.cellKey(0, 0, 0));
    if (!cell || !cell.labels) return false;
    for (const existingLabel of cell.labels.values()) {
      if (existingLabel && this._isManagementBusResolvedType(this._resolveLabelType(existingLabel.t))) {
        return true;
      }
    }
    return false;
  }

  _loadDefaultTableProgramsJson() {
    if (this._defaultTablePrograms !== undefined) return this._defaultTablePrograms;
    try {
      const parsed = defaultTableProgramsJson;
      this._defaultTablePrograms = parsed && Array.isArray(parsed.records) ? parsed : null;
    } catch (err) {
      this.eventLog.record({
        op: 'default_table_programs_load_failed',
        cell: { model_id: 0, p: 0, r: 0, c: 0 },
        label: { k: 'default_table_programs', t: 'json' },
        result: 'failed',
        reason: err && err.message ? String(err.message) : String(err),
      });
      this._defaultTablePrograms = null;
    }
    return this._defaultTablePrograms;
  }

  _seedDefaultRootScaffold(model) {
    if (!model || !Number.isInteger(model.id)) return;
    if (model.id < 0) return;
    const payload = this._loadDefaultTableProgramsJson();
    if (!payload || !Array.isArray(payload.records)) return;
    for (const rec of payload.records) {
      if (!rec || typeof rec !== 'object') continue;
      if (rec.op !== 'add_label') continue;
      if (typeof rec.k !== 'string' || !rec.k) continue;
      if (typeof rec.t !== 'string' || !rec.t) continue;
      const p = Number.isInteger(rec.p) ? rec.p : 0;
      const r = Number.isInteger(rec.r) ? rec.r : 0;
      const c = Number.isInteger(rec.c) ? rec.c : 0;
      const cell = this.getCell(model, p, r, c);
      if (cell.labels.has(rec.k)) continue;
      this.addLabel(model, p, r, c, { k: rec.k, t: rec.t, v: rec.v });
    }
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
    this._seedDefaultRootScaffold(model);
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

  getRuntimeMode() {
    return this.runtimeMode;
  }

  isRuntimeRunning() {
    return this.runtimeMode === 'running';
  }

  setRuntimeMode(nextMode) {
    const mode = typeof nextMode === 'string' ? nextMode.trim() : '';
    const current = this.runtimeMode;
    if (!mode || !new Set(['boot', 'edit', 'running']).has(mode)) {
      throw new Error('invalid_runtime_mode');
    }
    const allowed = (
      (current === 'boot' && (mode === 'boot' || mode === 'edit'))
      || (current === 'edit' && (mode === 'edit' || mode === 'running'))
      || (current === 'running' && mode === 'running')
    );
    if (!allowed) {
      throw new Error('invalid_mode_transition');
    }
    this.runtimeMode = mode;
    this.setRunLoopActive(mode === 'running');
    const model0 = this.getModel(0);
    if (model0) {
      const cell = this.getCell(model0, 0, 0, 0);
      cell.labels.set('runtime_mode', { k: 'runtime_mode', t: 'str', v: mode });
      if (this.persistence && typeof this.persistence.onLabelAdded === 'function') {
        this.persistence.onLabelAdded({
          model: model0,
          p: 0,
          r: 0,
          c: 0,
          label: { k: 'runtime_mode', t: 'str', v: mode },
        });
      }
    }
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

  _getModelForm(model) {
    if (!model || !Number.isInteger(model.id) || model.id === 0) return 'table';
    const origin = this.getCell(model, 0, 0, 0);
    for (const [, lbl] of origin.labels) {
      const t = this._resolveLabelType(lbl.t);
      if (t === 'model.single') return 'single';
      if (t === 'model.table' || t === 'model.matrix') return 'table';
    }
    return 'table';
  }

  _getDeclaredFormAtCell(model, p, r, c) {
    if (!model || !this._validateCell(p, r, c)) return null;
    const key = model.cellKey(p, r, c);
    const cell = model.cells.get(key);
    if (!cell || !cell.labels) return null;
    for (const [, lbl] of cell.labels) {
      const t = this._resolveLabelType(lbl.t);
      if (t === 'model.single' || t === 'model.table' || t === 'model.matrix' || t === 'submt') {
        return t;
      }
    }
    return null;
  }

  _readScopedIntLabel(model, p, r, c, key) {
    if (!model || !this._validateCell(p, r, c) || typeof key !== 'string') return null;
    const cellKey = model.cellKey(p, r, c);
    const cell = model.cells.get(cellKey);
    if (!cell || !cell.labels) return null;
    const label = cell.labels.get(key);
    if (!label) return null;
    const raw = label.v;
    if (Number.isInteger(raw)) return raw;
    if (typeof raw === 'string' && /^-?\d+$/.test(raw.trim())) {
      const parsed = Number(raw.trim());
      return Number.isInteger(parsed) ? parsed : null;
    }
    return null;
  }

  _getMatrixScopeBounds(model, p, r, c) {
    const min_p = this._readScopedIntLabel(model, p, r, c, 'scope_min_p');
    const max_p = this._readScopedIntLabel(model, p, r, c, 'scope_max_p');
    const min_r = this._readScopedIntLabel(model, p, r, c, 'scope_min_r');
    const max_r = this._readScopedIntLabel(model, p, r, c, 'scope_max_r');
    const min_c = this._readScopedIntLabel(model, p, r, c, 'scope_min_c');
    const max_c = this._readScopedIntLabel(model, p, r, c, 'scope_max_c');
    if (![min_p, max_p, min_r, max_r, min_c, max_c].every(Number.isInteger)) return null;
    return { min_p, max_p, min_r, max_r, min_c, max_c };
  }

  _cellHasExplicitScopedPrivilege(model, p, r, c) {
    if (!model || !this._validateCell(p, r, c)) return false;
    const key = model.cellKey(p, r, c);
    const cell = model.cells.get(key);
    if (!cell || !cell.labels) return false;
    const label = cell.labels.get('scope_privileged');
    return Boolean(label && label.v === true);
  }

  _getScopedPrivilegeMode(model, p, r, c) {
    if (!model || !this._validateCell(p, r, c)) return null;
    const declaredAtCell = this._getDeclaredFormAtCell(model, p, r, c);
    const rootDeclared = this._getDeclaredFormAtCell(model, 0, 0, 0);
    const isRoot = p === 0 && r === 0 && c === 0;

    if (isRoot) {
      if (rootDeclared === 'model.table') return 'table';
      if (rootDeclared === 'model.matrix') return 'matrix';
    }

    if (!this._cellHasExplicitScopedPrivilege(model, p, r, c)) return null;

    if (declaredAtCell === 'model.matrix') return 'matrix';
    if (rootDeclared === 'model.matrix') return 'matrix';
    if (rootDeclared === 'model.table') return 'table';
    return null;
  }

  _isWithinMatrixScope(bounds, p, r, c) {
    if (!bounds) return false;
    return p >= bounds.min_p && p <= bounds.max_p
      && r >= bounds.min_r && r <= bounds.max_r
      && c >= bounds.min_c && c <= bounds.max_c;
  }

  _assertScopedDirectAccess(sourceModel, p, r, c, ref) {
    if (!sourceModel || !ref || !Number.isInteger(ref.model_id)) {
      throw new Error('direct_access_invalid_target');
    }
    const tp = Number.isInteger(ref.p) ? ref.p : 0;
    const tr = Number.isInteger(ref.r) ? ref.r : 0;
    const tc = Number.isInteger(ref.c) ? ref.c : 0;

    if (ref.model_id !== sourceModel.id) {
      throw new Error('direct_access_cross_model_forbidden');
    }

    if (tp === p && tr === r && tc === c) {
      return;
    }

    const mode = this._getScopedPrivilegeMode(sourceModel, p, r, c);
    if (!mode) {
      throw new Error('direct_access_privilege_required');
    }

    if (mode === 'table') {
      return;
    }

    if (mode === 'matrix') {
      const bounds = this._getMatrixScopeBounds(sourceModel, p, r, c);
      if (!bounds) {
        throw new Error('direct_access_matrix_scope_missing');
      }
      if (!this._isWithinMatrixScope(bounds, tp, tr, tc)) {
        throw new Error('direct_access_out_of_matrix_scope');
      }
      return;
    }

    throw new Error('direct_access_privilege_required');
  }

  _modelInputLabelType(model) {
    return 'pin.in';
  }

  _isRootCell(p, r, c) {
    return p === 0 && r === 0 && c === 0;
  }

  _isNonSystemModelRoot(model, p, r, c) {
    return Boolean(model && Number.isInteger(model.id) && model.id !== 0 && this._isRootCell(p, r, c));
  }

  _registerRootBoundaryInput(model, p, r, c, label) {
    this.modelInPorts.set(`${model.id}:${label.k}`, true);
    if (label.v !== null && label.v !== undefined) {
      this._routeViaCellConnection(model.id, 0, 0, 0, label.k, label.v);
      const cellKey = `${model.id}|0|0|0`;
      if (this.cellConnectGraph.has(cellKey)) {
        this._propagateCellConnect(model.id, 0, 0, 0, 'self', label.k, label.v)
          .catch(() => {
            this._recordError(model, p, r, c, label, 'model_in_propagation_error');
          });
      }
    }
  }

  _registerRootBoundaryOutput(model, p, r, c, label) {
    this.modelOutPorts.set(`${model.id}:${label.k}`, true);
    if (label.v !== null && label.v !== undefined) {
      const childInfo = this.parentChildMap.get(model.id);
      if (childInfo) {
        const { parentModelId, hostingCell: { p: hp, r: hr, c: hc } } = childInfo;
        const parentModel = this.getModel(parentModelId);
        if (parentModel) {
          this.addLabel(parentModel, hp, hr, hc, { k: label.k, t: 'pin.out', v: label.v });
        }
      }
    }
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
      if (!cell.labels.has(name) || cell.labels.get(name).t !== 'func.js') {
        cell.labels.set(name, { k: name, t: 'func.js', v: { code: '', modelName: model.name || String(model.id) } });
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
    if (
      label.t === 'pin.connect.model'
      || label.t === 'pin.bus.in'
      || label.t === 'pin.bus.out'
      || (typeof label.t === 'string' && label.t.startsWith('pin.log.'))
    ) {
      return 'label_type_removed';
    }
    return null;
  }

  _validatePlacement(model, p, r, c, label) {
    const resolvedType = this._resolveLabelType(label && label.t);
    if (label && (label.k === 'is_DEM' || label.k === 'worker.role')) {
      return 'worker_role_label_removed';
    }
    if (label && label.k === 'v1n_id') {
      return 'worker_id_label_removed';
    }
    if (label && label.k === 'sys_worker_role') {
      if (!model || model.id !== 0 || p !== 0 || r !== 0 || c !== 0) {
        return 'worker_role_wrong_position';
      }
      if (label.t !== 'worker.role') {
        return 'worker_role_invalid_type';
      }
      if (label.v !== 'WSM' && label.v !== 'DEM' && label.v !== 'V1N') {
        return 'worker_role_invalid_value';
      }
      if (label.v !== 'DEM' && this._hasManagementBusPins(model)) {
        return 'worker_role_conflicts_with_management_bus_pins';
      }
    }
    if (label && label.k === 'sys_worker_id') {
      if (!model || model.id !== 0 || p !== 0 || r !== 0 || c !== 0) {
        return 'worker_id_wrong_position';
      }
      if (label.t !== 'worker.id') {
        return 'worker_id_invalid_type';
      }
      if (typeof label.v !== 'string' || !/^\d+\/\d+\/\d+\/\d+\/\d+$/u.test(label.v)) {
        return 'worker_id_invalid_value';
      }
    }
    if (this._isBusResolvedType(resolvedType)) {
      if (!model || model.id !== 0 || p !== 0 || r !== 0 || c !== 0) {
        return this._isBusInResolvedType(resolvedType) ? 'bus_in_wrong_position' : 'bus_out_wrong_position';
      }
      if (this._isManagementBusResolvedType(resolvedType) && !this._isDemWorker()) {
        return 'management_bus_pin_requires_dem';
      }
    }
    return null;
  }

  _validateStructuralLabelValue(model, p, r, c, label, resolvedType) {
    if (resolvedType === 'pin.connect.label') {
      const normalized = this._normalizeCellConnectLabel(model, p, r, c, label);
      return normalized.ok ? null : normalized.reason;
    }
    if (resolvedType === 'pin.connect.cell') {
      const normalized = this._normalizeCellConnectionLabel(model, p, r, c, label);
      return normalized.ok ? null : normalized.reason;
    }
    return null;
  }

  _mtPayloadRecord(k, t, v) {
    return { id: 0, p: 0, r: 0, c: 0, k, t, v };
  }

  _isExactTemporaryModelTableRecord(record) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return false;
    const keys = Object.keys(record).sort();
    if (keys.length !== 7 || keys.join('|') !== 'c|id|k|p|r|t|v') return false;
    return Number.isInteger(record.id) &&
      Number.isInteger(record.p) &&
      Number.isInteger(record.r) &&
      Number.isInteger(record.c) &&
      typeof record.k === 'string' &&
      record.k.length > 0 &&
      typeof record.t === 'string' &&
      record.t.length > 0;
  }

  _isTemporaryModelTablePayload(value) {
    return Array.isArray(value) && value.every((rec) => this._isExactTemporaryModelTableRecord(rec));
  }

  _buildWriteLabelPayload(fromCell, targetCell, label) {
    const requestId = `write_label_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    return [
      this._mtPayloadRecord('__mt_payload_kind', 'str', 'write_label.v1'),
      this._mtPayloadRecord('__mt_request_id', 'str', requestId),
      this._mtPayloadRecord('__mt_from_cell', 'json', { p: fromCell.p, r: fromCell.r, c: fromCell.c }),
      this._mtPayloadRecord('__mt_target_cell', 'json', { p: targetCell.p, r: targetCell.r, c: targetCell.c }),
      this._mtPayloadRecord(label.k, label.t, label.v),
    ];
  }

  _payloadLabel(payload, key) {
    return Array.isArray(payload)
      ? payload.find((rec) => rec && rec.id === 0 && rec.p === 0 && rec.r === 0 && rec.c === 0 && rec.k === key) || null
      : null;
  }

  _payloadString(payload, key) {
    const label = this._payloadLabel(payload, key);
    return label && label.t === 'str' && typeof label.v === 'string' && label.v.trim() === label.v
      ? label.v
      : '';
  }

  _payloadInt(payload, key) {
    const label = this._payloadLabel(payload, key);
    return label && label.t === 'int' && Number.isInteger(label.v)
      ? label.v
      : null;
  }

  _parseWriteLabelPayload(payload) {
    if (!this._isTemporaryModelTablePayload(payload)) {
      return { ok: false, code: 'invalid_payload', requestId: 'unknown' };
    }
    const kind = this._payloadLabel(payload, '__mt_payload_kind');
    const requestIdLabel = this._payloadLabel(payload, '__mt_request_id');
    const requestId = requestIdLabel && requestIdLabel.t === 'str' && typeof requestIdLabel.v === 'string'
      ? requestIdLabel.v
      : 'unknown';
    if (!payload.every((rec) => rec.id === 0 && rec.p === 0 && rec.r === 0 && rec.c === 0)) {
      return { ok: false, code: 'invalid_payload', requestId };
    }
    if (!kind || kind.t !== 'str' || kind.v !== 'write_label.v1') {
      return { ok: false, code: 'invalid_payload', requestId };
    }
    if (!requestIdLabel || requestIdLabel.t !== 'str' || typeof requestIdLabel.v !== 'string' || !requestIdLabel.v) {
      return { ok: false, code: 'invalid_payload', requestId };
    }
    const targetLabel = this._payloadLabel(payload, '__mt_target_cell');
    if (!targetLabel || targetLabel.t !== 'json') {
      return { ok: false, code: 'invalid_payload', requestId };
    }
    const target = targetLabel && targetLabel.v && typeof targetLabel.v === 'object' ? targetLabel.v : null;
    if (!target || !this._validateCell(target.p, target.r, target.c)) {
      return { ok: false, code: 'out_of_scope', requestId };
    }
    const userLabels = payload.filter((rec) => !String(rec.k).startsWith('__mt_'));
    if (userLabels.length === 0) {
      return { ok: false, code: 'missing_user_label', requestId };
    }
    if (userLabels.length > 1) {
      return { ok: false, code: 'multiple_user_labels', requestId };
    }
    const userLabel = userLabels[0];
    if (typeof userLabel.k !== 'string' || !userLabel.k || typeof userLabel.t !== 'string' || !userLabel.t) {
      return { ok: false, code: 'invalid_payload', requestId };
    }
    if (target.p === 0 && target.r === 0 && target.c === 0 && ['mt_write', 'mt_bus_receive', 'mt_bus_send'].includes(userLabel.k)) {
      return { ok: false, code: 'reserved_key', requestId };
    }
    return {
      ok: true,
      requestId,
      target: { p: target.p, r: target.r, c: target.c },
      label: { k: userLabel.k, t: userLabel.t, v: userLabel.v },
    };
  }

  _buildWriteLabelResultPayload({ status, requestId, error = null }) {
    const payload = [
      this._mtPayloadRecord('__mt_payload_kind', 'str', 'write_label_result.v1'),
      this._mtPayloadRecord('__mt_request_id', 'str', requestId || 'unknown'),
      this._mtPayloadRecord('__mt_status', 'str', status),
    ];
    if (error) {
      payload.push(this._mtPayloadRecord('__mt_error', 'json', error));
    }
    return payload;
  }

  _writeMtWriteResult(model, p, r, c, resultPayload) {
    this.addLabel(model, p, r, c, { k: 'mt_write_result', t: 'pin.out', v: resultPayload });
  }

  _applyWriteLabelPayload(model, p, r, c, payload, sourcePin = 'mt_write_req') {
    if (sourcePin !== 'mt_write_req') {
      const parsed = this._parseWriteLabelPayload(payload);
      const resultPayload = this._buildWriteLabelResultPayload({
        status: 'rejected',
        requestId: parsed.requestId,
        error: { code: 'invalid_source_pin' },
      });
      this._writeMtWriteResult(model, p, r, c, resultPayload);
      return { status: 'rejected', code: 'invalid_source_pin' };
    }
    const parsed = this._parseWriteLabelPayload(payload);
    if (!parsed.ok) {
      const resultPayload = this._buildWriteLabelResultPayload({
        status: 'rejected',
        requestId: parsed.requestId,
        error: { code: parsed.code },
      });
      this._writeMtWriteResult(model, p, r, c, resultPayload);
      return { status: 'rejected', code: parsed.code };
    }
    const res = this.addLabel(model, parsed.target.p, parsed.target.r, parsed.target.c, parsed.label);
    if (!res || !res.applied) {
      const resultPayload = this._buildWriteLabelResultPayload({
        status: 'rejected',
        requestId: parsed.requestId,
        error: { code: 'invalid_payload' },
      });
      this._writeMtWriteResult(model, p, r, c, resultPayload);
      return { status: 'rejected', code: 'invalid_payload' };
    }
    this._writeMtWriteResult(model, p, r, c, this._buildWriteLabelResultPayload({
      status: 'ok',
      requestId: parsed.requestId,
    }));
    return { status: 'ok', applied: 1 };
  }

  _parseBusSendPayload(payload) {
    if (!this._isTemporaryModelTablePayload(payload)) {
      return { ok: false, code: 'invalid_payload', requestId: 'unknown' };
    }
    const kind = this._payloadLabel(payload, '__mt_payload_kind');
    const requestIdLabel = this._payloadLabel(payload, '__mt_request_id');
    const requestId = requestIdLabel && requestIdLabel.t === 'str' && typeof requestIdLabel.v === 'string'
      ? requestIdLabel.v
      : 'unknown';
    if (!kind || kind.t !== 'str' || kind.v !== 'bus_send.v1') {
      return { ok: false, code: 'invalid_payload_kind', requestId };
    }
    if (!requestIdLabel || requestIdLabel.t !== 'str' || typeof requestIdLabel.v !== 'string' || !requestIdLabel.v) {
      return { ok: false, code: 'invalid_payload', requestId };
    }
    const busOutKeyLabel = this._payloadLabel(payload, 'bus_out_key');
    const nestedPayloadLabel = this._payloadLabel(payload, 'payload');
    const busLabel = this._payloadLabel(payload, 'bus');
    const routeKindLabel = this._payloadLabel(payload, 'route_kind');
    const topicLabel = this._payloadLabel(payload, 'topic');
    const responseTopicLabel = this._payloadLabel(payload, 'response_topic');
    const messageRoleLabel = this._payloadLabel(payload, 'message_role');
    for (const key of ['source_model_id', 'pin', 'route', 'reply_to', 'route.reply_to', 'return_topic', 'returnTopic', 'result_topic']) {
      if (this._payloadLabel(payload, key)) {
        return { ok: false, code: 'legacy_pin_payload_metadata_removed', requestId };
      }
    }
    if (this._hasLegacyPinPayloadMetadata(payload)) {
      return { ok: false, code: 'legacy_pin_payload_metadata_removed', requestId };
    }
    const endpoint = this._endpointFromPayloadRecords(payload, 'endpoint');
    const origin = this._endpointFromPayloadRecords(payload, 'origin');
    const replyTarget = this._endpointFromPayloadRecords(payload, 'reply_target');
    const busOutKey = busOutKeyLabel && busOutKeyLabel.t === 'str' && typeof busOutKeyLabel.v === 'string' && busOutKeyLabel.v.trim()
      ? busOutKeyLabel.v.trim()
      : (endpoint ? endpoint.pin : '');
    const nestedPayload = nestedPayloadLabel && nestedPayloadLabel.t === 'json' ? nestedPayloadLabel.v : null;
    const bus = busLabel && busLabel.t === 'str' && typeof busLabel.v === 'string'
      ? busLabel.v.trim()
      : null;
    const routeKind = routeKindLabel && routeKindLabel.t === 'str' && typeof routeKindLabel.v === 'string'
      ? routeKindLabel.v.trim()
      : null;
    const topic = topicLabel && topicLabel.t === 'str' && typeof topicLabel.v === 'string'
      ? topicLabel.v.trim()
      : '';
    const responseTopic = responseTopicLabel && responseTopicLabel.t === 'str' && typeof responseTopicLabel.v === 'string'
      ? responseTopicLabel.v.trim()
      : '';
    const messageRole = messageRoleLabel && messageRoleLabel.t === 'str' && typeof messageRoleLabel.v === 'string'
      ? messageRoleLabel.v
      : '';
    if (messageRole !== 'request' && messageRole !== 'response') {
      return { ok: false, code: 'invalid_message_role', requestId };
    }
    if (!endpoint || !origin || !replyTarget || !busOutKey) {
      return { ok: false, code: 'missing_source', requestId };
    }
    if (!this._isTemporaryModelTablePayload(nestedPayload)) {
      return { ok: false, code: 'invalid_nested_payload', requestId };
    }
    if (busLabel && (busLabel.t !== 'str' || (bus !== 'control' && bus !== 'management'))) {
      return { ok: false, code: 'invalid_bus', requestId };
    }
    if (routeKindLabel && (routeKindLabel.t !== 'str' || (routeKind !== 'control' && routeKind !== 'management'))) {
      return { ok: false, code: 'invalid_route_kind', requestId };
    }
    if (!this._isValidPayloadTopic(topic)) {
      return { ok: false, code: 'invalid_topic', requestId };
    }
    const topicContractError = this._validatePinPayloadTopicContract({
      messageRole,
      topic,
      responseTopic,
      endpoint,
      replyTarget,
    });
    if (topicContractError) {
      return { ok: false, code: topicContractError, requestId };
    }
    return {
      ok: true,
      requestId,
      endpoint,
      origin,
      replyTarget,
      busOutKey,
      payload: nestedPayload,
      bus,
      routeKind,
      topic,
      responseTopic,
      messageRole,
    };
  }

  _isSafePinRouteSegment(value) {
    return typeof value === 'string'
      && value.trim() === value
      && value.length > 0
      && !value.includes('/')
      && !value.includes('+')
      && !value.includes('#');
  }

  _isCanonicalPositiveIntSegment(value) {
    return typeof value === 'string' && /^[1-9][0-9]*$/.test(value);
  }

  _isValidUnifiedTopicBase(value) {
    if (typeof value !== 'string' || value.trim() !== value || value.length === 0) return false;
    const parts = value.split('/');
    return parts.length === 5
      && parts[0] === 'UIPUT'
      && parts.every((part) => this._isSafePinRouteSegment(part));
  }

  _isValidPayloadTopic(value) {
    if (typeof value !== 'string' || value.trim() !== value || value.length === 0) return false;
    const parts = value.split('/');
    return parts.length === 8
      && parts[0] === 'UIPUT'
      && parts.every((part) => this._isSafePinRouteSegment(part))
      && this._isCanonicalPositiveIntSegment(parts[6]);
  }

  _payloadTopicParts(value) {
    if (!this._isValidPayloadTopic(value)) return null;
    const parts = value.split('/');
    return {
      base: parts.slice(0, 5).join('/'),
      endpoint: {
        worker_id: parts[5],
        model_id: Number(parts[6]),
        pin: parts[7],
      },
    };
  }

  _topicForEndpointFromBase(base, endpoint) {
    if (!this._isValidUnifiedTopicBase(base) || !endpoint) return '';
    if (!this._isSafePinRouteSegment(endpoint.worker_id)) return '';
    if (!Number.isInteger(endpoint.model_id) || endpoint.model_id <= 0) return '';
    if (!this._isSafePinRouteSegment(endpoint.pin)) return '';
    return `${base}/${endpoint.worker_id}/${endpoint.model_id}/${endpoint.pin}`;
  }

  _endpointMatches(left, right) {
    return Boolean(left && right
      && left.worker_id === right.worker_id
      && left.model_id === right.model_id
      && left.pin === right.pin);
  }

  _validatePinPayloadTopicContract({ messageRole, topic, responseTopic, endpoint, replyTarget }) {
    const topicParts = this._payloadTopicParts(topic);
    if (!topicParts) return 'invalid_topic';
    const responseTopicParts = this._payloadTopicParts(responseTopic);
    if (!responseTopicParts) return 'invalid_response_topic';
    if (responseTopicParts.base !== topicParts.base) return 'response_topic_mismatch';
    const expectedResponseTopic = this._topicForEndpointFromBase(topicParts.base, replyTarget);
    if (!expectedResponseTopic || responseTopic !== expectedResponseTopic) {
      return 'response_topic_mismatch';
    }
    if (messageRole === 'request') {
      if (topic === responseTopic) return 'response_topic_mismatch';
      if (!this._endpointMatches(topicParts.endpoint, endpoint)) return 'endpoint_mismatch';
      return null;
    }
    if (messageRole === 'response') {
      if (topic !== responseTopic) return 'response_topic_mismatch';
      if (!this._endpointMatches(endpoint, replyTarget)) return 'endpoint_mismatch';
      if (!this._endpointMatches(topicParts.endpoint, replyTarget)) return 'endpoint_mismatch';
      return null;
    }
    return 'invalid_message_role';
  }

  _endpointFromPayloadRecords(payload, prefix) {
    const workerId = this._payloadString(payload, `${prefix}_worker_id`);
    const modelId = this._payloadInt(payload, `${prefix}_model_id`);
    const pin = this._payloadString(payload, `${prefix}_pin`);
    if (!this._isSafePinRouteSegment(workerId)) return null;
    if (!Number.isInteger(modelId) || modelId <= 0) return null;
    if (!this._isSafePinRouteSegment(pin)) return null;
    return { worker_id: workerId, model_id: modelId, pin };
  }

  _isLegacyPinPayloadKey(key) {
    return key === 'source_model_id'
      || key === 'pin'
      || key === 'route'
      || key === 'reply_to'
      || key === 'route.reply_to'
      || key === 'return_topic'
      || key === 'returnTopic'
      || key === 'result_topic';
  }

  _valueContainsLegacyPinPayloadMetadata(value, seen = new WeakSet()) {
    if (!value) return false;
    if (Array.isArray(value)) {
      if (seen.has(value)) return false;
      seen.add(value);
      return value.some((item) => this._valueContainsLegacyPinPayloadMetadata(item, seen));
    }
    if (typeof value !== 'object') return false;
    if (seen.has(value)) return false;
    seen.add(value);
    for (const [key, child] of Object.entries(value)) {
      if (this._isLegacyPinPayloadKey(key)) return true;
      if (key === 'k' && typeof child === 'string' && this._isLegacyPinPayloadKey(child)) return true;
      if (key === 'route' && child && typeof child === 'object' && !Array.isArray(child) && Object.prototype.hasOwnProperty.call(child, 'reply_to')) return true;
      if (this._valueContainsLegacyPinPayloadMetadata(child, seen)) return true;
    }
    return false;
  }

  _hasLegacyPinPayloadMetadata(value) {
    for (const record of Array.isArray(value) ? value : []) {
      if (!record || typeof record.k !== 'string') return true;
      if (this._isLegacyPinPayloadKey(record.k)) return true;
      if (this._valueContainsLegacyPinPayloadMetadata(record.v)) return true;
    }
    return false;
  }

  _hasLegacyPinPayloadMetadataForPinPayloadRecords(value) {
    const nestedPayload = this._payloadLabel(value, 'payload');
    if (nestedPayload && nestedPayload.t === 'json' && Array.isArray(nestedPayload.v)) {
      const nestedKind = this._payloadLabel(nestedPayload.v, '__mt_payload_kind');
      if (nestedKind && nestedKind.t === 'str' && nestedKind.v === 'slide_app_bundle_response.v1') {
        const outerRecords = value.map((record) => (record && record.k === 'payload'
          ? { ...record, v: [] }
          : record));
        if (this._hasLegacyPinPayloadMetadata(outerRecords)) return true;
        for (const nestedRecord of nestedPayload.v) {
          if (!nestedRecord || typeof nestedRecord.k !== 'string') return true;
          if (this._isLegacyPinPayloadKey(nestedRecord.k)) return true;
          if (nestedRecord.k === 'bundle_payload') continue;
          if (this._valueContainsLegacyPinPayloadMetadata(nestedRecord.v)) return true;
        }
        return false;
      }
    }
    return this._hasLegacyPinPayloadMetadata(value);
  }

  _hasInvalidPinPayloadStringMetadata(value, key) {
    const record = this._payloadLabel(value, key);
    return Boolean(record && (record.t !== 'str' || typeof record.v !== 'string' || record.v.trim() !== record.v));
  }

  _hasDuplicatePayloadRecordKeys(value, keys) {
    if (!Array.isArray(value)) return false;
    const watched = new Set(keys);
    const seen = new Set();
    for (const record of value) {
      if (!record || !watched.has(record.k)) continue;
      if (seen.has(record.k)) return true;
      seen.add(record.k);
    }
    return false;
  }

  _validatePinPayloadRecords(value, options = {}) {
    if (!this._isTemporaryModelTablePayload(value)) {
      return { ok: false, code: 'invalid_payload' };
    }
    const kind = this._payloadLabel(value, '__mt_payload_kind');
    if (!kind || kind.t !== 'str' || kind.v !== 'pin_payload.v1') {
      return { ok: false, code: 'invalid_payload_kind' };
    }
    const stringMetadataKeys = [
      '__mt_request_id',
      'op_id',
      'message_role',
      'topic',
      'response_topic',
      'endpoint_worker_id',
      'endpoint_pin',
      'origin_worker_id',
      'origin_pin',
      'reply_target_worker_id',
      'reply_target_pin',
    ];
    const metadataKeys = stringMetadataKeys.concat([
      '__mt_payload_kind',
      'endpoint_model_id',
      'origin_model_id',
      'reply_target_model_id',
      'payload',
      'timestamp',
      'bus_out_key',
      'bus',
      'route_kind',
      'topic',
      'response_topic',
    ]);
    if (this._hasDuplicatePayloadRecordKeys(value, metadataKeys)) {
      return { ok: false, code: 'invalid_pin_payload_records' };
    }
    for (const key of stringMetadataKeys) {
      if (this._hasInvalidPinPayloadStringMetadata(value, key)) {
        return { ok: false, code: 'invalid_pin_payload_records' };
      }
    }
    const requestIdLabel = this._payloadLabel(value, '__mt_request_id');
    const opIdLabel = this._payloadLabel(value, 'op_id');
    const hasRequestCorrelation = Boolean(
      (requestIdLabel && requestIdLabel.t === 'str' && typeof requestIdLabel.v === 'string' && requestIdLabel.v.trim() === requestIdLabel.v && requestIdLabel.v)
      || (opIdLabel && opIdLabel.t === 'str' && typeof opIdLabel.v === 'string' && opIdLabel.v.trim() === opIdLabel.v && opIdLabel.v)
    );
    if (!hasRequestCorrelation) {
      return { ok: false, code: 'missing_request_correlation' };
    }
    const messageRole = this._payloadString(value, 'message_role');
    if (messageRole !== 'request' && messageRole !== 'response') {
      return { ok: false, code: 'invalid_message_role' };
    }
    const topic = this._payloadString(value, 'topic');
    if (!this._isValidPayloadTopic(topic)) {
      return { ok: false, code: 'invalid_topic' };
    }
    const responseTopic = this._payloadString(value, 'response_topic');
    if (!this._isValidPayloadTopic(responseTopic)) {
      return { ok: false, code: 'invalid_response_topic' };
    }
    const routeKindLabel = this._payloadLabel(value, 'route_kind');
    const routeKind = this._payloadString(value, 'route_kind') || 'control';
    if (routeKindLabel && (routeKindLabel.t !== 'str' || (routeKind !== 'control' && routeKind !== 'management'))) {
      return { ok: false, code: 'invalid_route_kind' };
    }
    if (this._hasLegacyPinPayloadMetadataForPinPayloadRecords(value)) {
      return { ok: false, code: 'legacy_pin_payload_metadata_removed' };
    }
    const endpoint = this._endpointFromPayloadRecords(value, 'endpoint');
    const origin = this._endpointFromPayloadRecords(value, 'origin');
    const replyTarget = this._endpointFromPayloadRecords(value, 'reply_target');
    if (!endpoint || !origin || !replyTarget) {
      return { ok: false, code: 'invalid_pin_payload_records' };
    }
    const topicContractError = this._validatePinPayloadTopicContract({
      messageRole,
      topic,
      responseTopic,
      endpoint,
      replyTarget,
    });
    if (topicContractError) {
      return { ok: false, code: topicContractError };
    }
    const nestedPayloadLabel = this._payloadLabel(value, 'payload');
    const nestedPayload = nestedPayloadLabel && nestedPayloadLabel.t === 'json' ? nestedPayloadLabel.v : null;
    if (!this._isTemporaryModelTablePayload(nestedPayload)) {
      return { ok: false, code: 'invalid_nested_payload' };
    }
    if (options.expectedEndpoint) {
      const expected = options.expectedEndpoint;
      if (
        endpoint.worker_id !== expected.worker_id
        || endpoint.model_id !== expected.model_id
        || endpoint.pin !== expected.pin
      ) {
        return { ok: false, code: 'endpoint_mismatch' };
      }
    }
    return { ok: true, endpoint, origin, replyTarget, nestedPayload, messageRole, topic, responseTopic, routeKind };
  }

  _buildPinPayloadValue({ opId, payload, timestamp = Date.now(), endpoint = null, origin = null, replyTarget = null, messageRole = 'request', topic = '', responseTopic = '', routeKind = null, bus = null }) {
    const requestId = opId || `pin_payload_${Date.now()}`;
    const records = [
      this._mtPayloadRecord('__mt_payload_kind', 'str', 'pin_payload.v1'),
      this._mtPayloadRecord('__mt_request_id', 'str', requestId),
      this._mtPayloadRecord('op_id', 'str', requestId),
      this._mtPayloadRecord('message_role', 'str', messageRole),
      this._mtPayloadRecord('endpoint_worker_id', 'str', endpoint && endpoint.worker_id ? endpoint.worker_id : ''),
      this._mtPayloadRecord('endpoint_model_id', 'int', endpoint && Number.isInteger(endpoint.model_id) ? endpoint.model_id : 0),
      this._mtPayloadRecord('endpoint_pin', 'str', endpoint && endpoint.pin ? endpoint.pin : ''),
      this._mtPayloadRecord('origin_worker_id', 'str', origin && origin.worker_id ? origin.worker_id : ''),
      this._mtPayloadRecord('origin_model_id', 'int', origin && Number.isInteger(origin.model_id) ? origin.model_id : 0),
      this._mtPayloadRecord('origin_pin', 'str', origin && origin.pin ? origin.pin : ''),
      this._mtPayloadRecord('reply_target_worker_id', 'str', replyTarget && replyTarget.worker_id ? replyTarget.worker_id : ''),
      this._mtPayloadRecord('reply_target_model_id', 'int', replyTarget && Number.isInteger(replyTarget.model_id) ? replyTarget.model_id : 0),
      this._mtPayloadRecord('reply_target_pin', 'str', replyTarget && replyTarget.pin ? replyTarget.pin : ''),
      this._mtPayloadRecord('payload', 'json', payload),
      this._mtPayloadRecord('timestamp', 'int', timestamp),
    ];
    if (typeof topic === 'string' && topic) records.push(this._mtPayloadRecord('topic', 'str', topic));
    if (typeof responseTopic === 'string' && responseTopic) records.push(this._mtPayloadRecord('response_topic', 'str', responseTopic));
    if (typeof routeKind === 'string' && routeKind) records.push(this._mtPayloadRecord('route_kind', 'str', routeKind));
    if (typeof bus === 'string' && bus) records.push(this._mtPayloadRecord('bus', 'str', bus));
    return records;
  }

  _buildMqttIngressPayloadValue({ kind, topic, payload, opId = '', extra = [] }) {
    const requestId = typeof opId === 'string' && opId ? opId : `mqtt_ingress_${Date.now()}`;
    return [
      this._mtPayloadRecord('__mt_payload_kind', 'str', kind),
      this._mtPayloadRecord('__mt_request_id', 'str', requestId),
      this._mtPayloadRecord('op_id', 'str', requestId),
      this._mtPayloadRecord('topic', 'str', typeof topic === 'string' ? topic : ''),
      this._mtPayloadRecord('payload', 'json', payload),
      ...extra,
    ];
  }

  _parsePinPayloadValue(value, options = {}) {
    const opIdLabel = this._payloadLabel(value, 'op_id') || this._payloadLabel(value, '__mt_request_id');
    const timestampLabel = this._payloadLabel(value, 'timestamp');
    const opId = opIdLabel && opIdLabel.t === 'str' && typeof opIdLabel.v === 'string' && opIdLabel.v
      ? opIdLabel.v
      : `pin_payload_${Date.now()}`;
    const timestamp = timestampLabel && timestampLabel.t === 'int' && Number.isInteger(timestampLabel.v)
      ? timestampLabel.v
      : Date.now();
    const validated = this._validatePinPayloadRecords(value, options);
    if (!validated.ok) {
      return { ok: false, code: validated.code, opId };
    }
    const packet = {
      version: 'v1',
      type: 'pin_payload',
      payload: value,
    };
    return {
      ok: true,
      packet,
      opId,
      timestamp,
      ...validated,
    };
  }

  _pinBusOutValueToExternalPayload(value) {
    if (Array.isArray(value)) {
      const parsed = this._parsePinPayloadValue(value);
      return parsed.ok ? parsed.packet : null;
    }
    return null;
  }

  _pinPayloadDeliveryValue(packet) {
    return Array.isArray(packet && packet.payload) ? packet.payload : [];
  }

  _strictPinPayloadPacketCheck(packet) {
    if (!packet || typeof packet !== 'object' || Array.isArray(packet)) {
      return { ok: false, code: 'invalid_packet' };
    }
    const keys = Object.keys(packet).sort();
    if (keys.length !== 3 || keys[0] !== 'payload' || keys[1] !== 'type' || keys[2] !== 'version') {
      return { ok: false, code: 'loose_pin_payload_fields_removed' };
    }
    if (packet.version !== 'v1' || packet.type !== 'pin_payload' || !Array.isArray(packet.payload)) {
      return { ok: false, code: 'invalid_packet' };
    }
    return { ok: true };
  }

  _normalizeBusInValue(value, expectedPin = '') {
    if (this._isTemporaryModelTablePayload(value)) {
      return { ok: true, value };
    }
    if (value && typeof value === 'object' && value.version === 'v1' && value.type === 'pin_payload') {
      const packetCheck = this._strictPinPayloadPacketCheck(value);
      if (!packetCheck.ok) return { ok: false, code: packetCheck.code };
      const records = Array.isArray(value.payload) ? value.payload : null;
      const endpoint = this._endpointFromPayloadRecords(records, 'endpoint');
      if (expectedPin && (!endpoint || endpoint.pin !== expectedPin)) {
        return { ok: false, code: 'endpoint_pin_mismatch' };
      }
      const parsed = this._validatePinPayloadRecords(records || []);
      return parsed.ok ? { ok: true, value: records } : { ok: false, code: parsed.code };
    }
    return { ok: false, code: 'invalid_bus_in_payload' };
  }

  _validateBusPinPayload(model, p, r, c, label, resolvedType) {
    if (!this._isBusResolvedType(resolvedType)) {
      return null;
    }
    if (label.v === null || label.v === undefined) return null;
    if (!this._isTemporaryModelTablePayload(label.v)) {
      return 'pin_payload_not_modeltable';
    }
    const kind = this._payloadLabel(label.v, '__mt_payload_kind');
    if (kind && (kind.t !== 'str' || typeof kind.v !== 'string')) {
      return 'invalid_payload_kind';
    }
    if (this._isMalformedPinPayloadKind(kind)) {
      return 'invalid_payload_kind';
    }
    if (kind && kind.t === 'str' && kind.v === 'write_label.v1') {
      const parsed = this._parseWriteLabelPayload(label.v);
      if (!parsed.ok) {
        return `bus_in_invalid_write_label_${parsed.code || 'payload'}`;
      }
    }
    const hasLegacyMetadata = kind && kind.t === 'str' && kind.v === 'pin_payload.v1'
      ? this._hasLegacyPinPayloadMetadataForPinPayloadRecords(label.v)
      : this._hasLegacyPinPayloadMetadata(label.v);
    if (hasLegacyMetadata) {
      return 'legacy_pin_payload_metadata_removed';
    }
    if (kind && kind.t === 'str' && kind.v === 'pin_payload.v1') {
      const parsed = this._validatePinPayloadRecords(label.v);
      if (!parsed.ok) return `bus_in_${parsed.code || 'invalid_payload'}`;
    }
    if (this._isBusOutResolvedType(resolvedType)) {
      const parsed = this._parsePinPayloadValue(label.v);
      if (!parsed.ok) return `bus_out_${parsed.code || 'invalid_payload'}`;
    }
    return null;
  }

  _busOutTypeForBusSend(model, busOutKey, requestedBus) {
    const existing = model && this.getCell(model, 0, 0, 0).labels.get(busOutKey);
    const existingType = existing ? this._resolveLabelType(existing.t) : null;
    if (this._isBusOutResolvedType(existingType)) return existingType;
    if (requestedBus === 'management') return 'pin.bus.mb.out';
    if (requestedBus === 'control') return 'pin.bus.cb.out';
    return 'pin.bus.cb.out';
  }

  _validatePositiveModelPinPayload(model, label, resolvedType) {
    if (!model || !Number.isInteger(model.id) || model.id <= 0) return null;
    if (
      resolvedType !== 'pin.in'
      && resolvedType !== 'pin.out'
      && resolvedType !== 'pin.login'
      && resolvedType !== 'pin.logout'
    ) {
      return null;
    }
    if (label.v === null || label.v === undefined) return null;
    if (!this._isTemporaryModelTablePayload(label.v)) {
      return 'pin_payload_not_modeltable';
    }
    const kind = this._payloadLabel(label.v, '__mt_payload_kind');
    if (kind && (kind.t !== 'str' || typeof kind.v !== 'string')) {
      return 'invalid_payload_kind';
    }
    if (this._isMalformedPinPayloadKind(kind)) {
      return 'invalid_payload_kind';
    }
    const hasLegacyMetadata = kind && kind.t === 'str' && kind.v === 'pin_payload.v1'
      ? this._hasLegacyPinPayloadMetadataForPinPayloadRecords(label.v)
      : this._hasLegacyPinPayloadMetadata(label.v);
    if (hasLegacyMetadata) {
      return 'legacy_pin_payload_metadata_removed';
    }
    if (kind && kind.t === 'str' && kind.v === 'pin_payload.v1') {
      const parsed = this._validatePinPayloadRecords(label.v);
      if (!parsed.ok) return `pin_payload_${parsed.code || 'invalid_payload'}`;
    }
    return null;
  }

  _isMalformedPinPayloadKind(kind) {
    if (!kind) return false;
    if (kind.t !== 'str' || typeof kind.v !== 'string') return true;
    const normalized = kind.v.trim();
    return normalized.startsWith('pin_payload.') && (kind.v !== normalized || normalized !== 'pin_payload.v1');
  }

  _applyBusSendPayload(model, p, r, c, payload) {
    if (!model || model.id !== 0 || p !== 0 || r !== 0 || c !== 0) {
      return { status: 'rejected', code: 'invalid_bus_scope' };
    }
    const parsed = this._parseBusSendPayload(payload);
    if (!parsed.ok) {
      return { status: 'rejected', code: parsed.code };
    }
    const busOutPayload = this._buildPinPayloadValue({
      opId: parsed.requestId,
      payload: parsed.payload,
      endpoint: parsed.endpoint,
      origin: parsed.origin,
      replyTarget: parsed.replyTarget,
      messageRole: parsed.messageRole,
      topic: parsed.topic,
      responseTopic: parsed.responseTopic,
      routeKind: parsed.routeKind,
      bus: parsed.bus,
    });
    const res = this.addLabel(model, 0, 0, 0, {
      k: parsed.busOutKey,
      t: this._busOutTypeForBusSend(model, parsed.busOutKey, parsed.bus),
      v: busOutPayload,
    });
    if (!res || !res.applied) {
      return { status: 'rejected', code: 'bus_out_write_failed' };
    }
    return { status: 'ok', bus_out_key: parsed.busOutKey };
  }

  _isPinLikeResolvedType(typeName) {
    return typeName === 'pin.in'
      || typeName === 'pin.out'
      || typeName === 'pin.login'
      || typeName === 'pin.logout';
  }

  _findSubmodelLabel(cell, excludeKey = null) {
    if (!cell || !cell.labels) return null;
    for (const [key, label] of cell.labels.entries()) {
      if (!label || typeof label !== 'object') continue;
      if (excludeKey && key === excludeKey) continue;
      if (this._resolveLabelType(label.t) === 'submt') return label;
    }
    return null;
  }

  _getSubmodelChildId(label) {
    if (!label || typeof label !== 'object') return null;
    if (Number.isInteger(label.v)) return label.v;
    const parsed = Number.parseInt(String(label.k ?? ''), 10);
    return Number.isInteger(parsed) ? parsed : null;
  }

  _getHostedChildModelForCell(model, p, r, c) {
    const cell = this.getCell(model, p, r, c);
    const submodelLabel = this._findSubmodelLabel(cell);
    const childModelId = this._getSubmodelChildId(submodelLabel);
    return Number.isInteger(childModelId) ? this.getModel(childModelId) : null;
  }

  applyScopedPatch(currentModelId, patch) {
    if (!Number.isInteger(currentModelId)) {
      return { applied: 0, rejected: 0, reason: 'invalid_scope_model' };
    }
    const records = patch && Array.isArray(patch.records) ? patch.records : null;
    if (!records) {
      return { applied: 0, rejected: 0, reason: 'invalid_patch' };
    }
    const allowedRecords = [];
    let rejected = 0;
    for (const record of records) {
      if (!record || typeof record !== 'object') {
        rejected += 1;
        continue;
      }
      if (record.op === 'create_model') {
        rejected += 1;
        continue;
      }
      if (!Number.isInteger(record.model_id) || record.model_id !== currentModelId) {
        rejected += 1;
        continue;
      }
      allowedRecords.push(record);
    }
    if (allowedRecords.length === 0) {
      return { applied: 0, rejected, reason: rejected > 0 ? 'scoped_records_rejected' : 'empty_patch' };
    }
    const result = this.applyPatch({ ...patch, records: allowedRecords }, { allowCreateModel: false, trustedBootstrap: false });
    return {
      applied: result.applied,
      rejected: rejected + result.rejected,
      reason: result.reason,
    };
  }

  applyPatch(patch, options = {}) {
    const records = patch && Array.isArray(patch.records) ? patch.records : null;
    if (!records) {
      return { applied: 0, rejected: 0, reason: 'invalid_patch' };
    }
    const allowCreateModel = Boolean(options.allowCreateModel) && Boolean(options.trustedBootstrap);

    const RESERVED_CLEAR_LABELS = new Set(['ui_event', 'ui_event_error', 'ui_event_last_op_id']);
    const CLEAR_ALLOW_T = new Set(['str', 'int', 'bool', 'json']);
    const matchForbiddenK = (k) => {
      if (typeof k !== 'string') return false;
      if (k === 'pin_in' || k === 'pin_out') return true;
      if (k === 'v1n_id' || k === 'sys_worker_id' || k === 'sys_worker_role' || k === 'data_type') return true;
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


  _topicMode(config) {
    const mode = config && typeof config.topic_mode === 'string' ? config.topic_mode : null;
    if (mode === 'uiput_mm_v1') return 'uiput_mm_v1';
    return null;
  }

  _payloadMode(config) {
    const mode = config && typeof config.payload_mode === 'string' ? config.payload_mode : null;
    if (mode === 'pin_payload_v1') return 'pin_payload_v1';
    return null;
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
      topic_mode: get('mqtt_topic_mode')?.v ?? null,
      topic_base: get('mqtt_topic_base')?.v ?? null,
      worker_id: get('mqtt_worker_id')?.v ?? null,
      ingress_pin: get('mqtt_ingress_pin')?.v ?? null,
      payload_mode: get('mqtt_payload_mode')?.v ?? null,
    };
  }

  _validateConfig(config) {
    const missing = [];
    if (!config.host) missing.push('mqtt_target_host');
    if (!Number.isInteger(config.port)) missing.push('mqtt_target_port');
    if (!config.client_id) missing.push('mqtt_target_client_id');
    const mode = this._topicMode(config);
    const payloadMode = this._payloadMode(config);
    if (mode !== 'uiput_mm_v1') missing.push('mqtt_topic_mode:uiput_mm_v1');
    if (payloadMode !== 'pin_payload_v1') missing.push('mqtt_payload_mode:pin_payload_v1');
    if (!config.topic_base || typeof config.topic_base !== 'string') missing.push('mqtt_topic_base');
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
      ['mqtt_topic_mode', 'str', argsConfig.topic_mode],
      ['mqtt_topic_base', 'str', argsConfig.topic_base],
      ['mqtt_worker_id', 'str', argsConfig.worker_id],
      ['mqtt_payload_mode', 'str', argsConfig.payload_mode],
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
    const placementError = this._validatePlacement(model, p, r, c, label);
    if (placementError) {
      this._recordError(model, p, r, c, label, placementError);
      return { applied: false };
    }

    const cell = this.getCell(model, p, r, c);
    const prevLabel = cell.labels.get(label.k) || null;
    const resolvedType = this._resolveLabelType(label.t);
    const structuralLabelError = this._validateStructuralLabelValue(model, p, r, c, label, resolvedType);
    if (structuralLabelError) {
      this.eventLog.record({
        op: 'add_label',
        cell: { model_id: model.id, p, r, c },
        label,
        prev_label: prevLabel,
        result: 'rejected',
        reason: structuralLabelError,
      });
      return { applied: false };
    }
    const busPinPayloadError = this._validateBusPinPayload(model, p, r, c, label, resolvedType);
    if (busPinPayloadError) {
      this.eventLog.record({
        op: 'add_label',
        cell: { model_id: model.id, p, r, c },
        label,
        prev_label: prevLabel,
        result: 'rejected',
        reason: busPinPayloadError,
      });
      return { applied: false };
    }
    const positivePinPayloadError = this._validatePositiveModelPinPayload(model, label, resolvedType);
    if (positivePinPayloadError) {
      this.eventLog.record({
        op: 'add_label',
        cell: { model_id: model.id, p, r, c },
        label,
        prev_label: prevLabel,
        result: 'rejected',
        reason: positivePinPayloadError,
      });
      return { applied: false };
    }
    const existingSubmodel = this._findSubmodelLabel(cell, label.k);

    if (resolvedType === 'submt') {
      if (existingSubmodel) {
        this._recordError(model, p, r, c, label, 'submodel_host_cell_already_bound');
        return { applied: false };
      }
      const purgeKeys = [];
      for (const [key, existingLabel] of cell.labels.entries()) {
        if (key === label.k) continue;
        const existingResolvedType = this._resolveLabelType(existingLabel.t);
        if (this._isPinLikeResolvedType(existingResolvedType)) continue;
        purgeKeys.push(key);
      }
      for (const key of purgeKeys) {
        this.rmLabel(model, p, r, c, key);
      }
    } else if (this._findSubmodelLabel(cell) && !this._isPinLikeResolvedType(resolvedType)) {
      this._recordError(model, p, r, c, label, 'submodel_host_cell_forbidden_label');
      return { applied: false };
    }

    if (label.k === 'sys_worker_id' && model.id === 0 && p === 0 && r === 0 && c === 0 && prevLabel) {
      this.eventLog.record({
        op: 'add_label',
        cell: { model_id: model.id, p, r, c },
        label,
        prev_label: prevLabel,
        result: 'rejected',
        reason: 'worker_id_locked',
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
    if (this._resolveLabelType(prevLabel.t) === 'submt') {
      const childModelId = this._getSubmodelChildId(prevLabel);
      const current = Number.isInteger(childModelId) ? this.parentChildMap.get(childModelId) : null;
      if (current && current.parentModelId === model.id && current.hostingCell.p === p && current.hostingCell.r === r && current.hostingCell.c === c) {
        this.parentChildMap.delete(childModelId);
      }
    }
    const prevResolvedType = this._resolveLabelType(prevLabel.t);
    if (prevResolvedType === 'pin.connect.label') {
      this._rebuildCellConnectForCell(model, p, r, c);
    }
    if (prevResolvedType === 'pin.connect.cell') {
      this._rebuildCellConnectionForCell(model, p, r, c);
    }
    if (this._isBusInResolvedType(prevResolvedType) && model.id === 0 && p === 0 && r === 0 && c === 0) {
      this.busInPorts.delete(key);
      this._syncBusInSubscription(key, false);
    }
    if (this._isBusOutResolvedType(prevResolvedType) && model.id === 0 && p === 0 && r === 0 && c === 0) {
      this.busOutPorts.delete(key);
    }
    return { applied: true };
  }

  /**
   * Build MQTT topic for a given model/pin.
   * @param {number} modelId
   * @param {string} pinName
   */
  _topicFor(modelId, pinName) {
    const config = this._getConfigFromPage0();
    const mode = this._topicMode(config);
    if (mode === 'uiput_mm_v1') {
      const base = config.topic_base || '';
      if (!this._isValidUnifiedTopicBase(base)) return null;
      if (!Number.isInteger(modelId) || modelId <= 0) return null;
      if (!this._isSafePinRouteSegment(pinName)) return null;
      const workerId = typeof config.worker_id === 'string' && config.worker_id
        ? config.worker_id
        : 'local';
      if (!this._isSafePinRouteSegment(workerId)) return null;
      return `${base}/${workerId}/${modelId}/${pinName}`;
    }
    return null;
  }

  _topicForPinPayloadPacket(packet) {
    if (!packet || packet.version !== 'v1' || packet.type !== 'pin_payload') return null;
    const parsed = this._parsePinPayloadValue(packet.payload);
    if (!parsed.ok) return null;
    return parsed.topic || null;
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

  _syncBusInSubscription(portName, shouldSubscribe) {
    if (!this.mqttClient || typeof portName !== 'string' || !portName) return;
    const topic = this._topicFor(0, portName, 'in');
    if (!topic) return;
    if (shouldSubscribe) {
      this.mqttClient.subscribe(topic);
      return;
    }
    this.mqttClient.unsubscribe(topic);
  }

  _applyLabelTypes(model, p, r, c, label) {
    const resolvedType = this._resolveLabelType(label.t);
    if (resolvedType === 'func.js' || resolvedType === 'func.python') {
      model.registerFunction(label.k);
    }
  }

  mqttIncoming(topic, payload) {
    if (!this.isRuntimeRunning()) return false;
    const config = this._getConfigFromPage0();
    const mode = this._topicMode(config);
    const payloadMode = this._payloadMode(config);
    if (!payload) return false;
    if (mode !== 'uiput_mm_v1' || payloadMode !== 'pin_payload_v1') {
      this.mqttTrace.record('inbound_rejected', { topic, payload, mode: mode || 'disabled', reason: 'unified_topic_and_pin_payload_required' });
      return false;
    }
    const packetCheck = this._strictPinPayloadPacketCheck(payload);
    if (!packetCheck.ok) {
      this.mqttTrace.record('inbound_rejected', { topic, payload, mode: 'pin_payload_v1', reason: packetCheck.code });
      return false;
    }

    if (mode === 'uiput_mm_v1') {
      const base = config.topic_base || '';
      if (!this._isValidUnifiedTopicBase(base)) {
        this.mqttTrace.record('inbound_rejected', {
          topic,
          payload,
          mode: 'uiput_mm_v1',
          reason: 'invalid_unified_topic_base',
        });
        return false;
      }
      const prefix = `${base}/`;
      if (!topic || typeof topic !== 'string' || !topic.startsWith(prefix)) {
        return false;
      }
      const rest = topic.slice(prefix.length);
      const parts = rest.split('/');
      let modelId = null;
      let pinName = '';
      if (parts.length === 6 && parts[0] === 'worker' && parts[2] === 'model' && parts[4] === 'pin') {
        this.mqttTrace.record('inbound_rejected', {
          topic,
          payload,
          mode: 'uiput_mm_v1',
          reason: 'worker_model_pin_topic_removed',
        });
        return false;
      }
      if (parts.length === 3) {
        const workerId = parts[0] || '';
        const modelSegment = parts[1] || '';
        pinName = parts[2] || '';
        if (!this._isSafePinRouteSegment(workerId) || !this._isCanonicalPositiveIntSegment(modelSegment)) {
          this.mqttTrace.record('inbound_rejected', {
            topic,
            payload,
            mode: 'uiput_mm_v1',
            reason: 'invalid_unified_endpoint_topic',
          });
          return false;
        }
        modelId = Number(modelSegment);
        const configuredWorkerId = typeof config.worker_id === 'string' ? config.worker_id : '';
        if (configuredWorkerId && !this._isSafePinRouteSegment(configuredWorkerId)) {
          this.mqttTrace.record('inbound_rejected', {
            topic,
            payload,
            mode: 'uiput_mm_v1',
            reason: 'invalid_configured_worker_id',
          });
          return false;
        }
        if (configuredWorkerId && workerId !== configuredWorkerId) {
          this.mqttTrace.record('inbound_rejected', {
            topic,
            payload,
            mode: 'uiput_mm_v1',
            reason: 'worker_id_mismatch',
          });
          return false;
        }
      } else {
        this.mqttTrace.record('inbound_rejected', {
          topic,
          payload,
          mode: 'uiput_mm_v1',
          reason: 'invalid_unified_endpoint_topic',
        });
        return false;
      }
      if (!Number.isInteger(modelId) || modelId <= 0 || !this._isSafePinRouteSegment(pinName)) {
        this.mqttTrace.record('inbound_rejected', {
          topic,
          payload,
          mode: 'uiput_mm_v1',
          reason: 'invalid_unified_endpoint_topic',
        });
        return false;
      }
      const model = this.getModel(modelId);
      if (!model) return false;

      const parsed = this._parsePinPayloadValue(payload.payload, {
        expectedEndpoint: {
          worker_id: typeof config.worker_id === 'string' && config.worker_id ? config.worker_id : parts[0],
          model_id: modelId,
          pin: pinName,
        },
      });
      if (!parsed.ok) {
        this.mqttTrace.record('inbound_rejected', {
          topic,
          payload,
          mode: 'pin_payload_v1',
          reason: parsed.code === 'endpoint_mismatch' ? 'endpoint_mismatch' : 'invalid_pin_payload_records',
        });
        return false;
      }
      if (parsed.messageRole === 'response') {
        this.mqttTrace.record('inbound_ignored', {
          topic,
          payload,
          mode: 'pin_payload_v1',
          reason: 'response_packet_not_delivered_to_endpoint_runtime',
        });
        return false;
      }
      const ingressPin = typeof config.ingress_pin === 'string' ? config.ingress_pin.trim() : '';
      if (ingressPin) {
        const model0 = this.getModel(0);
        const model0Root = model0 ? this.getCell(model0, 0, 0, 0) : null;
        const ingressLabel = model0Root ? model0Root.labels.get(ingressPin) : null;
        const ingressType = ingressLabel ? this._resolveLabelType(ingressLabel.t) : null;
        if (!model0 || !this._isSafePinRouteSegment(ingressPin) || (ingressType !== 'pin.bus.cb.in' && ingressType !== 'pin.bus.mb.in')) {
          this.mqttTrace.record('inbound_rejected', {
            topic,
            payload,
            mode: 'pin_payload_v1',
            reason: 'invalid_mqtt_ingress_pin',
          });
          return false;
        }
        this.addLabel(model0, 0, 0, 0, { k: ingressPin, t: ingressLabel.t, v: this._pinPayloadDeliveryValue(payload) });
        this.mqttTrace.record('inbound', { topic, payload, mode: 'pin_payload_v1', ingress_pin: ingressPin });
        return true;
      }
      this.addLabel(model, 0, 0, 0, { k: pinName, t: 'pin.in', v: this._pinPayloadDeliveryValue(payload) });
      this.mqttTrace.record('inbound', { topic, payload, mode: 'pin_payload_v1' });
      return true;
    }
    return false;
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
            t: 'pin.in',
            v: this._buildMqttIngressPayloadValue({ kind: 'mqtt_wildcard_in.v1', topic, payload }),
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

  // --- 0141/0357: pin.connect.label / pin.connect.cell parsing and routing ---

  _isRemovedEndpointSyntax(value) {
    return typeof value === 'string' && value.trim().startsWith('(') && value.trim().endsWith(')');
  }

  _isCellPinResolvedType(typeName) {
    return typeName === 'pin.in'
      || typeName === 'pin.out'
      || typeName === 'pin.login'
      || typeName === 'pin.logout'
      || this._isBusResolvedType(typeName);
  }

  _cellEndpointLabel(model, p, r, c, endpoint) {
    if (!model || typeof endpoint !== 'string') return null;
    const cell = this.getCell(model, p, r, c);
    return cell.labels.get(endpoint) || null;
  }

  _hasSameCellFunction(model, p, r, c, funcName) {
    if (!model || typeof funcName !== 'string' || !funcName) return false;
    const cell = this.getCell(model, p, r, c);
    const label = cell.labels.get(funcName);
    if (!label) return false;
    const typeName = this._resolveLabelType(label.t);
    return typeName === 'func.js' || typeName === 'func.python';
  }

  _functionEndpointBase(endpoint) {
    if (typeof endpoint !== 'string') return null;
    for (const suffix of [':logout', ':out', ':in']) {
      if (endpoint.endsWith(suffix) && endpoint.length > suffix.length) {
        return endpoint.slice(0, -suffix.length);
      }
    }
    return null;
  }

  _classifyCellConnectEndpoint(model, p, r, c, endpoint) {
    if (typeof endpoint !== 'string') return { ok: false, reason: 'cell_connect_bad_endpoint' };
    const trimmed = endpoint.trim();
    if (!trimmed) return { ok: false, reason: 'cell_connect_bad_endpoint' };
    if (this._isRemovedEndpointSyntax(trimmed)) {
      return { ok: false, reason: 'cell_connect_removed_endpoint_syntax' };
    }
    const label = this._cellEndpointLabel(model, p, r, c, trimmed);
    if (label && this._isCellPinResolvedType(this._resolveLabelType(label.t))) {
      return { ok: true, endpoint: { prefix: 'self', port: trimmed } };
    }
    const funcName = this._functionEndpointBase(trimmed);
    if (funcName) {
      return { ok: true, endpoint: { prefix: 'func', port: trimmed } };
    }
    return { ok: true, endpoint: { prefix: 'self', port: trimmed } };
  }

  _normalizeCellConnectLabel(model, p, r, c, label) {
    const v = label.v;
    if (!Array.isArray(v)) return { ok: false, reason: 'cell_connect_invalid_value' };
    const routes = [];
    for (const entry of v) {
      if (!entry || typeof entry !== 'object') return { ok: false, reason: 'cell_connect_invalid_value' };
      const source = this._classifyCellConnectEndpoint(model, p, r, c, entry.from);
      if (!source.ok) return { ok: false, reason: source.reason || 'cell_connect_bad_source' };
      if (!Array.isArray(entry.to)) return { ok: false, reason: 'cell_connect_bad_targets' };
      const targets = [];
      for (const targetValue of entry.to) {
        const target = this._classifyCellConnectEndpoint(model, p, r, c, targetValue);
        if (!target.ok) return { ok: false, reason: target.reason || 'cell_connect_bad_target' };
        targets.push(target.endpoint);
      }
      routes.push({ source: source.endpoint, targets });
    }
    return { ok: true, routes };
  }

  _parseCellConnectLabel(model, p, r, c, label) {
    const normalized = this._normalizeCellConnectLabel(model, p, r, c, label);
    if (!normalized.ok) {
      this._recordError(model, p, r, c, label, normalized.reason);
      return;
    }
    const cellKey = `${model.id}|${p}|${r}|${c}`;
    if (!this.cellConnectGraph.has(cellKey)) {
      this.cellConnectGraph.set(cellKey, new Map());
    }
    const cellGraph = this.cellConnectGraph.get(cellKey);
    for (const route of normalized.routes) {
      const endpointKey = `${route.source.prefix}:${route.source.port}`;
      const existing = cellGraph.get(endpointKey) || [];
      cellGraph.set(endpointKey, existing.concat(route.targets));
    }
  }

  _rebuildCellConnectForCell(model, p, r, c) {
    const cellKey = `${model.id}|${p}|${r}|${c}`;
    this.cellConnectGraph.delete(cellKey);
    const cell = this.getCell(model, p, r, c);
    for (const [, existingLabel] of cell.labels.entries()) {
      if (this._resolveLabelType(existingLabel.t) === 'pin.connect.label') {
        this._parseCellConnectLabel(model, p, r, c, existingLabel);
      }
    }
  }

  _normalizeCellConnectionEndpoint(model, endpoint) {
    if (!Array.isArray(endpoint) || endpoint.length !== 4) {
      return { ok: false, reason: 'cell_connection_bad_endpoint' };
    }
    const [p, r, c, pinName] = endpoint;
    if (!Number.isInteger(p) || !Number.isInteger(r) || !Number.isInteger(c) || typeof pinName !== 'string' || !pinName.trim()) {
      return { ok: false, reason: 'cell_connection_bad_endpoint' };
    }
    if (this._isRemovedEndpointSyntax(pinName)) {
      return { ok: false, reason: 'cell_connection_removed_endpoint_syntax' };
    }
    if (this._functionEndpointBase(pinName.trim())) {
      return { ok: false, reason: 'cell_connection_function_endpoint_forbidden' };
    }
    return { ok: true, endpoint: { p, r, c, k: pinName.trim() } };
  }

  _normalizeCellConnectionLabel(model, p, r, c, label) {
    if (p !== 0 || r !== 0 || c !== 0) return { ok: false, reason: 'cell_connection_wrong_position' };
    const v = label.v;
    if (!Array.isArray(v)) return { ok: false, reason: 'cell_connection_invalid_value' };
    const routes = [];
    for (const entry of v) {
      if (!entry || typeof entry !== 'object') return { ok: false, reason: 'cell_connection_invalid_value' };
      const from = this._normalizeCellConnectionEndpoint(model, entry.from);
      if (!from.ok) return { ok: false, reason: from.reason === 'cell_connection_bad_endpoint' ? 'cell_connection_bad_from' : from.reason };
      if (!Array.isArray(entry.to)) return { ok: false, reason: 'cell_connection_bad_to' };
      const targets = [];
      for (const dest of entry.to) {
        const target = this._normalizeCellConnectionEndpoint(model, dest);
        if (!target.ok) return { ok: false, reason: target.reason === 'cell_connection_bad_endpoint' ? 'cell_connection_bad_dest' : target.reason };
        targets.push(target.endpoint);
      }
      routes.push({ from: from.endpoint, targets });
    }
    return { ok: true, routes };
  }

  _parseCellConnectionLabel(model, p, r, c, label) {
    const normalized = this._normalizeCellConnectionLabel(model, p, r, c, label);
    if (!normalized.ok) {
      this._recordError(model, p, r, c, label, normalized.reason);
      return;
    }
    for (const route of normalized.routes) {
      const from = route.from;
      const routeKey = `${model.id}|${from.p}|${from.r}|${from.c}|${from.k}`;
      const targets = route.targets.map((dest) => ({ model_id: model.id, p: dest.p, r: dest.r, c: dest.c, k: dest.k }));
      const existing = this.cellConnectionRoutes.get(routeKey) || [];
      this.cellConnectionRoutes.set(routeKey, existing.concat(targets));
    }
  }

  _rebuildCellConnectionForCell(model, p, r, c) {
    const prefix = `${model.id}|`;
    for (const key of Array.from(this.cellConnectionRoutes.keys())) {
      if (key.startsWith(prefix)) this.cellConnectionRoutes.delete(key);
    }
    const cell = this.getCell(model, p, r, c);
    for (const [, existingLabel] of cell.labels.entries()) {
      if (this._resolveLabelType(existingLabel.t) === 'pin.connect.cell') {
        this._parseCellConnectionLabel(model, p, r, c, existingLabel);
      }
    }
  }

  _routeViaCellConnection(modelId, p, r, c, k, value) {
    const key = `${modelId}|${p}|${r}|${c}|${k}`;
    const targets = this.cellConnectionRoutes.get(key);
    if (!targets) return;
    const sourceModel = this.getModel(modelId);
    for (const t of targets) {
      const targetModel = this.getModel(t.model_id);
      if (!targetModel) continue;
      const existingTarget = this._cellEndpointLabel(targetModel, t.p, t.r, t.c, t.k);
      if (!existingTarget) {
        if (sourceModel) {
          this._recordError(sourceModel, p, r, c, { k, t: 'pin.connect.cell', v: value }, 'cell_connection_target_pin_missing');
        }
        continue;
      }
      const targetType = this._resolveLabelType(existingTarget.t);
      if (!this._isCellPinResolvedType(targetType)) {
        if (sourceModel) {
          this._recordError(sourceModel, p, r, c, { k, t: 'pin.connect.cell', v: value }, 'cell_connection_target_pin_invalid_type');
        }
        continue;
      }
      this.addLabel(targetModel, t.p, t.r, t.c, { k: t.k, t: targetType, v: value });
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
        const existingTarget = this._cellEndpointLabel(targetModel, p, r, c, t.port);
        const targetType = existingTarget && this._isCellPinResolvedType(this._resolveLabelType(existingTarget.t))
          ? this._resolveLabelType(existingTarget.t)
          : 'pin.out';
        this.addLabel(targetModel, p, r, c, { k: t.port, t: targetType, v: value });
        this._routeViaCellConnection(modelId, p, r, c, t.port, value);
        return this._propagateCellConnect(modelId, p, r, c, 'self', t.port, value, visited);
      }
      if (t.prefix === 'func') {
        if (t.port.endsWith(':in')) {
          const funcName = t.port.slice(0, -3);
          return this._executeFuncViaCellConnect(modelId, p, r, c, funcName, value, visited, port);
        }
        if (t.port.endsWith(':out')) {
          return this._propagateCellConnect(modelId, p, r, c, 'func', t.port, value, visited);
        }
      }
      return Promise.resolve();
    });
    await Promise.all(tasks);
  }

  async _executeFuncViaCellConnect(modelId, p, r, c, funcName, inputValue, visited, inputSourcePin = null) {
    if (!this.isRuntimeRunning()) return;
    const model = this.getModel(modelId);
    if (!model) return;
    const cell = this.getCell(model, p, r, c);
    let funcLabel = null;
    for (const [, lbl] of cell.labels) {
      const resolvedType = this._resolveLabelType(lbl.t);
      if (lbl.k === funcName && (resolvedType === 'func.js' || resolvedType === 'func.python')) {
        funcLabel = lbl;
        break;
      }
    }
    if (!funcLabel) {
      this._recordError(model, p, r, c, { k: `${funcName}:in`, t: 'pin.connect.label', v: inputValue }, 'cell_connect_function_missing');
      return;
    }

    const funcType = this._resolveLabelType(funcLabel.t);
    if (funcType === 'func.python') {
      this.addLabel(model, p, r, c, {
        k: `__error_${funcName}`,
        t: 'json',
        v: { error: 'python_worker_unavailable', ts: Date.now() },
      });
      return;
    }

    if (!funcLabel.v || typeof funcLabel.v !== 'object' || typeof funcLabel.v.code !== 'string') return;
    const codeStr = funcLabel.v.code;
    if (!codeStr.trim()) return;

    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const fn = new AsyncFunction('ctx', 'label', 'V1N', codeStr);

    const runtime = this;
    const runtimeView = {
      getModel(modelId) {
        const m = runtime.getModel(modelId);
        if (!m) return null;
        return { id: m.id, name: m.name, type: m.type };
      },
      getCell(modelRefOrId, cp = 0, cr = 0, cc = 0) {
        const modelId = Number.isInteger(modelRefOrId)
          ? modelRefOrId
          : (modelRefOrId && Number.isInteger(modelRefOrId.id) ? modelRefOrId.id : null);
        if (!Number.isInteger(modelId)) return null;
        const m = runtime.getModel(modelId);
        if (!m) return null;
        const cell = runtime.getCell(m, cp, cr, cc);
        return {
          model_id: modelId,
          p: cp,
          r: cr,
          c: cc,
          labels: new Map(Array.from(cell.labels.entries()).map(([key, value]) => [key, { ...value }])),
        };
      },
      getLabelValue(modelRefOrId, cp = 0, cr = 0, cc = 0, key) {
        const modelId = Number.isInteger(modelRefOrId)
          ? modelRefOrId
          : (modelRefOrId && Number.isInteger(modelRefOrId.id) ? modelRefOrId.id : null);
        if (!Number.isInteger(modelId)) return undefined;
        const m = runtime.getModel(modelId);
        if (!m) return undefined;
        return runtime.getLabelValue(m, cp, cr, cc, key);
      },
    };
    const hasHostPrivileges = Number.isInteger(model.id) && model.id < 0;
    const ctx = {
      self: Object.freeze({ model_id: model.id, p, r, c }),
      runtime: runtimeView,
      hostApi: hasHostPrivileges && runtime.hostApi ? runtime.hostApi : null,
      getState(key) {
        const stateModel = runtime.getModel(-2);
        if (!stateModel) return null;
        const stateCell = runtime.getCell(stateModel, 0, 0, 0);
        return stateCell.labels.get(key)?.v ?? null;
      },
      getStateInt(key) {
        const value = ctx.getState(key);
        if (Number.isInteger(value)) return value;
        if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
          const parsed = Number(value.trim());
          return Number.isInteger(parsed) ? parsed : null;
        }
        return null;
      },
    };

    const V1N = {
      addLabel(k, t, v) {
        if (typeof k !== 'string' || !k) throw new Error('invalid_v1n_api_signature');
        if (typeof t !== 'string' || !t) throw new Error('invalid_v1n_api_signature');
        if (arguments.length !== 3) throw new Error('invalid_v1n_api_signature');
        runtime.addLabel(model, p, r, c, { k, t, v });
      },
      removeLabel(k) {
        if (typeof k !== 'string' || !k) throw new Error('invalid_v1n_api_signature');
        if (arguments.length !== 1) throw new Error('invalid_v1n_api_signature');
        runtime.rmLabel(model, p, r, c, k);
      },
      readLabel(tp, tr, tc, tk) {
        if (arguments.length !== 4) throw new Error('invalid_v1n_api_signature');
        if (!Number.isInteger(tp) || !Number.isInteger(tr) || !Number.isInteger(tc)) {
          throw new Error('cross_model_read_denied');
        }
        if (typeof tk !== 'string' || !tk) throw new Error('invalid_v1n_api_signature');
        const cl = runtime.getCell(model, tp, tr, tc);
        if (!cl) return null;
        const lbl = cl.labels.get(tk);
        return lbl ? { t: lbl.t, v: lbl.v } : null;
      },
      writeLabel(tp, tr, tc, labelObj) {
        if (arguments.length !== 4) throw new Error('invalid_v1n_api_signature');
        if (!Number.isInteger(tp) || !Number.isInteger(tr) || !Number.isInteger(tc)) {
          throw new Error('invalid_v1n_api_signature');
        }
        if (!labelObj || typeof labelObj !== 'object' || Array.isArray(labelObj)) {
          throw new Error('invalid_v1n_api_signature');
        }
        const { k, t, v } = labelObj;
        if (typeof k !== 'string' || !k || k.startsWith('__mt_')) throw new Error('invalid_v1n_api_signature');
        if (typeof t !== 'string' || !t) throw new Error('invalid_v1n_api_signature');
        const payload = runtime._buildWriteLabelPayload(
          { p, r, c },
          { p: tp, r: tr, c: tc },
          { k, t, v },
        );
        const routeKey = `${model.id}|${p}|${r}|${c}|write_label_req`;
        const hasRoute = runtime.cellConnectionRoutes.has(routeKey);
        runtime.addLabel(model, p, r, c, { k: 'write_label_req', t: 'pin.out', v: payload });
        if (!hasRoute) {
          runtime.addLabel(model, p, r, c, {
            k: '__error_write_label',
            t: 'json',
            v: { error: 'write_label_route_missing', target: { p: tp, r: tr, c: tc }, ts: Date.now() },
          });
        }
        return payload;
      },
    };
    if (p === 0 && r === 0 && c === 0) {
      V1N.table = {
        addLabel(tp, tr, tc, k, t, v) {
          if (arguments.length !== 6) throw new Error('invalid_v1n_table_api_signature');
          if (!Number.isInteger(tp) || !Number.isInteger(tr) || !Number.isInteger(tc)) {
            throw new Error('invalid_v1n_table_api_signature');
          }
          if (typeof k !== 'string' || !k) throw new Error('invalid_v1n_table_api_signature');
          if (typeof t !== 'string' || !t) throw new Error('invalid_v1n_table_api_signature');
          runtime.addLabel(model, tp, tr, tc, { k, t, v });
        },
        removeLabel(tp, tr, tc, k) {
          if (arguments.length !== 4) throw new Error('invalid_v1n_table_api_signature');
          if (!Number.isInteger(tp) || !Number.isInteger(tr) || !Number.isInteger(tc)) {
            throw new Error('invalid_v1n_table_api_signature');
          }
          if (typeof k !== 'string' || !k) throw new Error('invalid_v1n_table_api_signature');
          runtime.rmLabel(model, tp, tr, tc, k);
        },
        applyWriteLabelPayload(payload, sourcePin = 'mt_write_req') {
          if (arguments.length < 1 || arguments.length > 2) throw new Error('invalid_v1n_table_api_signature');
          return runtime._applyWriteLabelPayload(model, p, r, c, payload, sourcePin);
        },
        applyBusSendPayload(payload) {
          if (arguments.length !== 1) throw new Error('invalid_v1n_table_api_signature');
          return runtime._applyBusSendPayload(model, p, r, c, payload);
        },
      };
    }

    const FUNC_TIMEOUT_MS = 30000;
    let timeoutId = null;
    try {
      const result = await Promise.race([
        fn(ctx, { k: funcName, t: 'pin.in', v: inputValue, sourcePin: inputSourcePin || null }, V1N),
        new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error(`Function ${funcName} timeout after ${FUNC_TIMEOUT_MS}ms`)), FUNC_TIMEOUT_MS);
        }),
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
    } finally {
      if (timeoutId !== null) clearTimeout(timeoutId);
    }
  }

  // --- end 0141 ---

  // --- 0142: BUS_IN message handler ---

  _handleBusInMessage(portName, payload) {
    const model0 = this.getModel(0);
    if (!model0) return false;
    const normalized = this._normalizeBusInValue(payload, portName);
    if (!normalized.ok) {
      this.mqttTrace.record('bus_inbound_rejected', { port: portName, payload, reason: normalized.code });
      return false;
    }
    const pinType = this.busInPorts.get(portName);
    if (!this._isBusInResolvedType(pinType)) {
      this.mqttTrace.record('bus_inbound_rejected', { port: portName, payload, reason: 'bus_in_port_not_registered' });
      return false;
    }
    const result = this.addLabel(model0, 0, 0, 0, { k: portName, t: pinType, v: normalized.value });
    if (!result || !result.applied) {
      this.mqttTrace.record('bus_inbound_rejected', { port: portName, payload, reason: 'add_label_rejected' });
      return false;
    }
    this.mqttTrace.record('bus_inbound', { port: portName, payload: normalized.value });
    return true;
  }

  _buildUiEventIngressPort(envelope) {
    const payload = envelope && typeof envelope === 'object' && envelope.payload && typeof envelope.payload === 'object'
      ? envelope.payload
      : null;
    const action = typeof (payload && payload.action) === 'string' ? payload.action.trim() : '';
    const target = payload && typeof payload.target === 'object' ? payload.target : null;
    if (action === 'submit') {
      if (!target) return '';
      if (!Number.isInteger(target.model_id) || !Number.isInteger(target.p) || !Number.isInteger(target.r) || !Number.isInteger(target.c)) {
        return '';
      }
      return `ui_event_${action}_${target.model_id}_${target.p}_${target.r}_${target.c}`;
    }
    if (action === 'slide_app_import' || action === 'slide_app_create' || action === 'ws_app_add' || action === 'ws_app_delete' || action === 'ws_select_app' || action === 'ws_app_select') {
      return `ui_event_${action}`;
    }
    return '';
  }

  _normalizeUiEventIngressPayload(envelope) {
    const payload = envelope && typeof envelope === 'object' && envelope.payload && typeof envelope.payload === 'object'
      ? envelope.payload
      : null;
    if (!payload) return null;
    const rawValue = payload.value;
    if (this._isTemporaryModelTablePayload(rawValue)) return rawValue;
    const eventValue = rawValue && rawValue.t === 'event'
      ? rawValue.v
      : (rawValue && rawValue.t === 'json' ? rawValue.v : rawValue);
    const normalized = eventValue && typeof eventValue === 'object' && !Array.isArray(eventValue)
      ? { ...eventValue }
      : {};
    if (!normalized.action && typeof payload.action === 'string') normalized.action = payload.action;
    if (!normalized.meta && payload.meta && typeof payload.meta === 'object') normalized.meta = payload.meta;
    if (!normalized.target && payload.target && typeof payload.target === 'object') normalized.target = payload.target;
    if (!Object.prototype.hasOwnProperty.call(normalized, 'value') && rawValue !== undefined) normalized.value = rawValue;
    const records = [
      this._mtPayloadRecord('__mt_payload_kind', 'str', 'ui_event.v1'),
    ];
    if (typeof normalized.action === 'string' && normalized.action) {
      records.push(this._mtPayloadRecord('action', 'str', normalized.action));
    }
    if (normalized.meta && typeof normalized.meta === 'object') {
      records.push(this._mtPayloadRecord('meta', 'json', normalized.meta));
    }
    if (normalized.target && typeof normalized.target === 'object') {
      records.push(this._mtPayloadRecord('target', 'json', normalized.target));
    }
    for (const [key, value] of Object.entries(normalized)) {
      if (key === 'action' || key === 'meta' || key === 'target' || key.startsWith('__mt_')) continue;
      const typeName = typeof value === 'string'
        ? 'str'
        : (Number.isInteger(value) ? 'int' : (typeof value === 'boolean' ? 'bool' : 'json'));
      records.push(this._mtPayloadRecord(key, typeName, value));
    }
    return records;
  }

  // --- end 0142 ---

  _applyBuiltins(model, p, r, c, label, prevLabel) {
    const resolvedType = this._resolveLabelType(label.t);
    if (resolvedType === 'event' && model.id === -1 && p === 0 && r === 0 && c === 1 && label.k === 'ui_event' && label.v) {
      const ingressPort = this._buildUiEventIngressPort(label.v);
      const ingressPayload = ingressPort ? this._normalizeUiEventIngressPayload(label.v) : null;
      if (ingressPort && ingressPayload) {
        const model0 = this.getModel(0);
        if (model0) {
          this.addLabel(model0, 0, 0, 0, { k: ingressPort, t: 'pin.bus.cb.in', v: ingressPayload });
        }
      }
      return;
    }
    // 0143: MQTT_WILDCARD_SUB subscription management
    if (resolvedType === 'MQTT_WILDCARD_SUB') {
      if (!this.isRuntimeRunning()) return;
      const prevResolved = prevLabel ? this._resolveLabelType(prevLabel.t) : null;
      if (prevLabel && prevResolved === 'MQTT_WILDCARD_SUB' && typeof prevLabel.v === 'string' && prevLabel.v && this.mqttClient) {
        this.mqttClient.unsubscribe(prevLabel.v);
      }
      if (typeof label.v === 'string' && label.v && this.mqttClient) {
        this.mqttClient.subscribe(label.v);
      }
      return;
    }
    // 0141: label.t dispatch (independent from label.k connectKeys)
    if (resolvedType === 'pin.connect.label') {
      if (prevLabel && this._resolveLabelType(prevLabel.t) === 'pin.connect.label') {
        this._rebuildCellConnectForCell(model, p, r, c);
      } else {
        this._parseCellConnectLabel(model, p, r, c, label);
      }
      return;
    }
    if (resolvedType === 'pin.connect.cell') {
      if (prevLabel && this._resolveLabelType(prevLabel.t) === 'pin.connect.cell') {
        this._rebuildCellConnectionForCell(model, p, r, c);
      } else {
        this._parseCellConnectionLabel(model, p, r, c, label);
      }
      return;
    }
    if ((resolvedType === 'pin.in' || resolvedType === 'pin.login') && this._isNonSystemModelRoot(model, p, r, c)) {
      this._registerRootBoundaryInput(model, p, r, c, label);
      return;
    }
    if (resolvedType === 'pin.in' || resolvedType === 'pin.login') {
      const hostedChild = this._getHostedChildModelForCell(model, p, r, c);
      if (hostedChild && label.v !== null && label.v !== undefined) {
        this.addLabel(hostedChild, 0, 0, 0, { k: label.k, t: resolvedType, v: label.v });
        return;
      }
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
    if (this._isBusInResolvedType(resolvedType)) {
      if (model.id !== 0 || p !== 0 || r !== 0 || c !== 0) {
        this._recordError(model, p, r, c, label, 'bus_in_wrong_position');
        return;
      }
      this.busInPorts.set(label.k, resolvedType);
      this._syncBusInSubscription(label.k, true);
      if (label.v !== null && label.v !== undefined) {
        this._routeViaCellConnection(0, 0, 0, 0, label.k, label.v);
        const cellKey = '0|0|0|0';
        if (this.cellConnectGraph.has(cellKey)) {
          this._propagateCellConnect(0, 0, 0, 0, 'self', label.k, label.v)
            .catch(() => {
              this._recordError(model, p, r, c, label, 'cell_connect_propagation_error');
            });
        }
      }
      return;
    }
    if ((resolvedType === 'pin.out' || resolvedType === 'pin.logout') && this._isNonSystemModelRoot(model, p, r, c)) {
      this._registerRootBoundaryOutput(model, p, r, c, label);
      return;
    }
    if (resolvedType === 'pin.out' || resolvedType === 'pin.logout') {
      this._routeViaCellConnection(model.id, p, r, c, label.k, label.v);
      const cellKey = `${model.id}|${p}|${r}|${c}`;
      if (this.cellConnectGraph.has(cellKey)) {
        this._propagateCellConnect(model.id, p, r, c, 'self', label.k, label.v)
          .catch(() => {
            this._recordError(model, p, r, c, label, 'cell_connect_propagation_error');
          });
      }
      return;
    }
    // 0142: BUS_OUT label dispatch
    if (this._isBusOutResolvedType(resolvedType)) {
      if (model.id !== 0 || p !== 0 || r !== 0 || c !== 0) {
        this._recordError(model, p, r, c, label, 'bus_out_wrong_position');
        return;
      }
      this.busOutPorts.set(label.k, resolvedType);
      if (label.v !== null && label.v !== undefined && this.mqttClient && this.isRuntimeRunning()) {
        const externalPayload = this._pinBusOutValueToExternalPayload(label.v);
        const topic = externalPayload && externalPayload.type === 'pin_payload'
          ? this._topicForPinPayloadPacket(externalPayload)
          : null;
        if (topic && externalPayload !== null && externalPayload !== undefined) this.mqttClient.publish(topic, externalPayload);
      }
      return;
    }
    // 0142: subModel declaration
    if (resolvedType === 'submt') {
      const childModelId = this._getSubmodelChildId(label);
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
          name: (label.v && typeof label.v === 'object' && label.v.alias) || String(childModelId),
          type: 'sub',
        });
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
      if (!this.runLoopActive || !this.isRuntimeRunning()) {
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
