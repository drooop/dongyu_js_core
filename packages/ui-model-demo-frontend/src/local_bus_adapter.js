function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function matchForbiddenK(k) {
  if (typeof k !== 'string') return false;
  if (k === 'pin_in' || k === 'pin_out') return true;
  if (k === 'v1n_id' || k === 'data_type') return true;
  if (k.startsWith('run_')) return true;
  if (k.startsWith('mqtt_')) return true;
  if (k.startsWith('matrix_')) return true;
  if (k.startsWith('CONNECT_')) return true;
  if (k.endsWith('_CONNECT')) return true;
  return false;
}

const ALLOW_T = new Set(['str', 'int', 'bool', 'json']);
const RESERVED_LABELS = new Set(['ui_event', 'ui_event_error', 'ui_event_last_op_id']);

function toErrorValue(op_id, code, detail) {
  return { op_id, code, detail };
}

export function createLocalBusAdapter({ runtime, eventLog }) {
  const mode = arguments.length > 0 && arguments[0] && arguments[0].mode ? arguments[0].mode : 'v0';
  const mailboxModelId = 99;

  function normalizeTypedValue(value) {
    if (!value || typeof value.t !== 'string') {
      return { ok: false, code: 'invalid_target', detail: 'invalid_value' };
    }
    const t = value.t;
    const v = value.v;
    if (t === 'str') {
      return { ok: true, value: String(v) };
    }
    if (t === 'int') {
      if (typeof v === 'number') {
        if (Number.isSafeInteger(v)) return { ok: true, value: v };
        return { ok: false, code: 'invalid_target', detail: 'invalid_int' };
      }
      if (typeof v === 'string') {
        const trimmed = v.trim();
        if (trimmed.length === 0) return { ok: false, code: 'invalid_target', detail: 'invalid_int' };
        if (!/^-?\d+$/.test(trimmed)) return { ok: false, code: 'invalid_target', detail: 'invalid_int' };
        const parsed = Number(trimmed);
        if (!Number.isSafeInteger(parsed)) return { ok: false, code: 'invalid_target', detail: 'invalid_int' };
        return { ok: true, value: parsed };
      }
      return { ok: false, code: 'invalid_target', detail: 'invalid_int' };
    }
    if (t === 'bool') {
      if (typeof v === 'boolean') return { ok: true, value: v };
      if (typeof v === 'string') {
        const trimmed = v.trim();
        if (trimmed === 'true') return { ok: true, value: true };
        if (trimmed === 'false') return { ok: true, value: false };
        return { ok: false, code: 'invalid_target', detail: 'invalid_bool' };
      }
      return { ok: false, code: 'invalid_target', detail: 'invalid_bool' };
    }
    if (t === 'json') {
      if (typeof v === 'string') {
        const trimmed = v.trim();
        if (trimmed.length === 0) return { ok: false, code: 'invalid_target', detail: 'invalid_json' };
        try {
          return { ok: true, value: JSON.parse(trimmed) };
        } catch (_) {
          return { ok: false, code: 'invalid_target', detail: 'invalid_json' };
        }
      }
      try {
        JSON.stringify(v);
        return { ok: true, value: v };
      } catch (_) {
        return { ok: false, code: 'invalid_target', detail: 'invalid_json' };
      }
    }
    return { ok: false, code: 'invalid_target', detail: 'invalid_value_t' };
  }

  function mailboxCell() {
    const model = runtime.getModel(mailboxModelId);
    return runtime.getCell(model, 0, 0, 1);
  }

  function getMailboxEnvelope() {
    const cell = mailboxCell();
    const label = cell.labels.get('ui_event');
    return label ? label.v : null;
  }

  function setMailboxEnvelope(v) {
    const model = runtime.getModel(mailboxModelId);
    runtime.addLabel(model, 0, 0, 1, { k: 'ui_event', t: 'event', v });
  }

  function setLastOpId(op_id) {
    const model = runtime.getModel(mailboxModelId);
    runtime.addLabel(model, 0, 0, 1, { k: 'ui_event_last_op_id', t: 'str', v: op_id });
  }

  function getLastOpId() {
    const cell = mailboxCell();
    const label = cell.labels.get('ui_event_last_op_id');
    return label ? String(label.v || '') : '';
  }

  function setError(op_id, code, detail) {
    const model = runtime.getModel(mailboxModelId);
    runtime.addLabel(model, 0, 0, 1, { k: 'ui_event_error', t: 'json', v: toErrorValue(op_id, code, detail) });
  }

  function fail(op_id, code, detail) {
    setError(op_id, code, detail);
    setMailboxEnvelope(null);
    if (eventLog) {
      eventLog.push({ op_id, result: 'error', code, detail });
    }
    return { consumed: true, result: 'error', code };
  }

  function succeed(op_id, note) {
    setLastOpId(op_id);
    setMailboxEnvelope(null);
    if (eventLog) {
      eventLog.push({ op_id, result: 'ok', note: note || '' });
    }
    return { consumed: true, result: 'ok' };
  }

  function isReservedTarget(target) {
    if (!target || typeof target.model_id !== 'number') return false;
    if (target.model_id === 0 || target.model_id === 99) return true;
    return false;
  }

  function editableLabel(label) {
    if (!label || typeof label.k !== 'string') return false;
    if (RESERVED_LABELS.has(label.k)) return false;
    if (matchForbiddenK(label.k)) return false;
    if (!ALLOW_T.has(label.t)) return false;
    return true;
  }

  function consumeOnce() {
    const envelope = getMailboxEnvelope();
    if (envelope === null || envelope === undefined) return { consumed: false };
    if (!isPlainObject(envelope) || !isPlainObject(envelope.payload)) {
      return fail('', 'invalid_target', 'envelope_shape');
    }

    const payload = envelope.payload;
    const meta = payload.meta;
    if (!isPlainObject(meta) || typeof meta.op_id !== 'string') {
      return fail('', 'invalid_target', 'missing_or_non_string_op_id');
    }

    const op_id = meta.op_id;
    const last = getLastOpId();
    if (op_id && last && op_id === last) {
      return fail(op_id, 'op_id_replay', 'op_id_replay');
    }

    const action = payload.action;
    const allowedActions = new Set(['label_add', 'label_update', 'label_remove', 'cell_clear', 'submodel_create']);
    if (typeof action !== 'string' || !allowedActions.has(action)) {
      return fail(op_id, 'unknown_action', 'unknown_action');
    }

    if (envelope.source !== 'ui_renderer') {
      return fail(op_id, 'invalid_target', 'source_mismatch');
    }
    if (typeof envelope.type !== 'string' || envelope.type !== action) {
      return fail(op_id, 'invalid_target', 'type_mismatch');
    }

    if (action === 'submodel_create') {
      if (!payload.value) {
        return fail(op_id, 'invalid_target', 'missing_value');
      }
      if (typeof payload.value.t !== 'string') {
        return fail(op_id, 'invalid_target', 'non_string_value_t');
      }
      if (payload.value.t !== 'json') {
        return fail(op_id, 'invalid_target', 'value_t_not_json');
      }
      if (!isPlainObject(payload.value.v)) {
        return fail(op_id, 'invalid_target', 'value_v_not_object');
      }
      const { id, name, type } = payload.value.v;
      if (!Number.isInteger(id) || id === 0 || id === 99) {
        return fail(op_id, 'invalid_target', 'invalid_id');
      }
      if (runtime.getModel(id)) {
        return fail(op_id, 'invalid_target', 'duplicate_id');
      }
      if (typeof name !== 'string' || name.length === 0) {
        return fail(op_id, 'invalid_target', 'invalid_name');
      }
      if (typeof type !== 'string' || type.length === 0) {
        return fail(op_id, 'invalid_target', 'invalid_type');
      }
      try {
        runtime.createModel({ id, name, type });
        return succeed(op_id, 'submodel_create');
      } catch (_) {
        return fail(op_id, 'invalid_target', 'runtime_error');
      }
    }

    const target = payload.target;
    if (!isPlainObject(target)) {
      return fail(op_id, 'invalid_target', 'missing_target');
    }
    if (!Number.isInteger(target.model_id) || !Number.isInteger(target.p) || !Number.isInteger(target.r) || !Number.isInteger(target.c)) {
      return fail(op_id, 'invalid_target', 'missing_target_coords');
    }
    if (isReservedTarget(target)) {
      return fail(op_id, 'reserved_cell', 'reserved_model_id');
    }

    const model = runtime.getModel(target.model_id);
    if (!model) {
      return fail(op_id, 'invalid_target', 'missing_model');
    }

    if (action === 'cell_clear') {
      const cell = runtime.getCell(model, target.p, target.r, target.c);
      for (const [k, lv] of cell.labels.entries()) {
        const label = { k: lv.k, t: lv.t, v: lv.v };
        if (!editableLabel(label)) continue;
        runtime.rmLabel(model, target.p, target.r, target.c, k);
      }
      return succeed(op_id, 'cell_clear');
    }

    if (typeof target.k !== 'string' || target.k.length === 0) {
      return fail(op_id, 'invalid_target', 'missing_target_k');
    }

    if (action === 'label_add' || action === 'label_update') {
      if (!isPlainObject(payload.value)) {
        return fail(op_id, 'invalid_target', 'missing_value');
      }
      if (typeof payload.value.t !== 'string') {
        return fail(op_id, 'invalid_target', 'non_string_value_t');
      }
      if (!Object.prototype.hasOwnProperty.call(payload.value, 'v')) {
        return fail(op_id, 'invalid_target', 'missing_value_v');
      }
    }

    if (matchForbiddenK(target.k)) {
      return fail(op_id, 'forbidden_k', 'forbidden_k');
    }

    if (action === 'label_remove') {
      runtime.rmLabel(model, target.p, target.r, target.c, target.k);
      return succeed(op_id, 'label_remove');
    }

    if (!ALLOW_T.has(payload.value.t)) {
      return fail(op_id, 'forbidden_t', 'forbidden_t');
    }

    try {
      if (mode === 'v1') {
        const normalized = normalizeTypedValue(payload.value);
        if (!normalized.ok) {
          return fail(op_id, normalized.code, normalized.detail);
        }
        runtime.addLabel(model, target.p, target.r, target.c, { k: target.k, t: payload.value.t, v: normalized.value });
      } else {
        runtime.addLabel(model, target.p, target.r, target.c, { k: target.k, t: payload.value.t, v: payload.value.v });
      }
      return succeed(op_id, action);
    } catch (_) {
      return fail(op_id, 'invalid_target', 'runtime_error');
    }
  }

  function updateUiDerived({ uiAst, snapshotJson, eventLogJson }) {
    const model = runtime.getModel(mailboxModelId);
    runtime.addLabel(model, 0, 0, 0, { k: 'ui_ast_v0', t: 'json', v: uiAst });
    runtime.addLabel(model, 0, 1, 0, { k: 'snapshot_json', t: 'str', v: snapshotJson });
    runtime.addLabel(model, 0, 1, 1, { k: 'event_log', t: 'str', v: eventLogJson });
  }

  return {
    consumeOnce,
    updateUiDerived,
  };
}
