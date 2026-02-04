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

const ALLOW_T = new Set(['str', 'int', 'bool', 'json', 'event']);
const RESERVED_LABELS = new Set(['ui_event', 'ui_event_error', 'ui_event_last_op_id']);

function toErrorValue(op_id, code, detail) {
  return { op_id, code, detail };
}

export function createLocalBusAdapter({ runtime, eventLog }) {
  const mode = arguments.length > 0 && arguments[0] && arguments[0].mode ? arguments[0].mode : 'v0';
  const mailboxModelId = arguments.length > 0 && arguments[0] && Number.isInteger(arguments[0].mailboxModelId) ? arguments[0].mailboxModelId : -1;
  const editorStateModelId = arguments.length > 0 && arguments[0] && Number.isInteger(arguments[0].editorStateModelId) ? arguments[0].editorStateModelId : -2;

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
    if (target.model_id === 0 || target.model_id === mailboxModelId) return true;
    return false;
  }

  function editorStateModel() {
    return runtime.getModel(editorStateModelId);
  }

  function parseSafeInt(value) {
    if (typeof value === 'number' && Number.isSafeInteger(value)) return value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;
      if (!/^-?\d+$/.test(trimmed)) return null;
      const parsed = Number(trimmed);
      if (!Number.isSafeInteger(parsed)) return null;
      return parsed;
    }
    return null;
  }

  function stringify(value) {
    if (value === undefined) return '';
    if (value === null) return 'null';
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch (_) {
      return String(value);
    }
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
    const allowedActions = new Set([
      'label_add',
      'label_update',
      'label_remove',
      'cell_clear',
      'submodel_create',
      // Editor UI convenience actions.
      'datatable_refresh',
      'datatable_select_row',
      'datatable_edit_row',
      'datatable_view_detail',
      'datatable_remove_label',
      // Test actions.
      'cellab_add_cellA',
      'cellab_add_cellB',
      // Docs actions (remote-only).
      'docs_refresh_tree',
      'docs_search',
      'docs_open_doc',
      // Static projects actions (remote-only).
      'static_project_list',
      'static_project_upload',
    ]);
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
    if (!Number.isInteger(id) || id === 0 || id === -1 || id === -2) {
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

    // Editor UI convenience actions (operate on editor_state model).
    if (action === 'cellab_add_cellA' || action === 'cellab_add_cellB') {
      const stateModel = editorStateModel();
      if (!stateModel) {
        return fail(op_id, 'invalid_target', 'missing_editor_state_model');
      }
      const stateCell = runtime.getCell(stateModel, 0, 0, 0);
      const payloadText = stateCell.labels.get('cellab_payload_json')?.v ?? '{"hello":1}';

      let payloadObj = payloadText;
      if (typeof payloadText === 'string') {
        try {
          payloadObj = JSON.parse(payloadText);
        } catch (_) {
          payloadObj = payloadText;
        }
      }

      const model1 = runtime.getModel(1);
      if (!model1) {
        return fail(op_id, 'invalid_target', 'missing_model');
      }

      if (action === 'cellab_add_cellA') {
        runtime.addLabel(model1, 1, 1, 1, {
          k: 'intent.v0',
          t: 'json',
          v: {
            op_id,
            action: 'mgmt_put_mbr_v0',
            cell_k: 'pageA.submitA1',
            t: 'json',
            v: payloadObj,
          },
        });
        return succeed(op_id, 'cellab_add_cellA');
      }

      runtime.addLabel(model1, 3, 3, 3, {
        k: 'intent.v0',
        t: 'json',
        v: {
          op_id,
          action: 'mgmt_bind_in',
          channel: 'pageA.textA1',
          target_ref: { model_id: 1, p: 3, r: 3, c: 3, k: 'pageA.textA1' },
        },
      });
      return succeed(op_id, 'cellab_add_cellB');
    }

    if (action === 'docs_refresh_tree' || action === 'docs_search' || action === 'docs_open_doc') {
      return fail(op_id, 'unsupported', 'docs_remote_only');
    }

    if (action === 'static_project_list' || action === 'static_project_upload') {
      return fail(op_id, 'unsupported', 'static_remote_only');
    }

    if (action.startsWith('datatable_')) {
      const stateModel = editorStateModel();
      if (!stateModel) {
        return fail(op_id, 'invalid_target', 'missing_editor_state_model');
      }

      if (action === 'datatable_refresh') {
        return succeed(op_id, 'datatable_refresh');
      }

      const target = payload.target;
      if (!isPlainObject(target)) {
        return fail(op_id, 'invalid_target', 'missing_target');
      }
      const targetModelId = target.model_id;
      const p = target.p;
      const r = target.r;
      const c = target.c;
      const k = target.k;
      if (!Number.isInteger(targetModelId) || !Number.isInteger(p) || !Number.isInteger(r) || !Number.isInteger(c) || typeof k !== 'string' || k.length === 0) {
        return fail(op_id, 'invalid_target', 'missing_target_coords');
      }

      const model = runtime.getModel(targetModelId);
      if (!model) {
        return fail(op_id, 'invalid_target', 'missing_model');
      }

      const cell = runtime.getCell(model, p, r, c);
      const label = cell.labels.get(k);
      const t = label ? String(label.t || '') : '';
      const vRaw = label && Object.prototype.hasOwnProperty.call(label, 'v') ? label.v : undefined;

      if (action === 'datatable_remove_label') {
        if (!Number.isInteger(targetModelId) || targetModelId === 0) {
          return fail(op_id, 'invalid_target', 'target.model_id must be non-zero int');
        }
        if (!label) {
          return succeed(op_id, 'datatable_remove_label');
        }
        const editable = editableLabel({ k, t, v: vRaw });
        if (!editable) {
          return fail(op_id, 'forbidden_k', 'forbidden_k');
        }
        runtime.rmLabel(model, p, r, c, k);
        return succeed(op_id, 'datatable_remove_label');
      }

      if (action === 'datatable_view_detail') {
        const title = `model ${targetModelId} (${p},${r},${c}) ${k}`;
        runtime.addLabel(stateModel, 0, 0, 0, { k: 'dt_detail_title', t: 'str', v: title });
        runtime.addLabel(stateModel, 0, 0, 0, { k: 'dt_detail_text', t: 'str', v: stringify(t === 'json' ? vRaw : vRaw) });
        runtime.addLabel(stateModel, 0, 0, 0, { k: 'dt_detail_open', t: 'bool', v: true });
        return succeed(op_id, 'datatable_view_detail');
      }

      // datatable_select_row
      runtime.addLabel(stateModel, 0, 0, 0, { k: 'selected_model_id', t: 'str', v: String(targetModelId) });
      runtime.addLabel(stateModel, 0, 0, 0, { k: 'draft_p', t: 'str', v: String(p) });
      runtime.addLabel(stateModel, 0, 0, 0, { k: 'draft_r', t: 'str', v: String(r) });
      runtime.addLabel(stateModel, 0, 0, 0, { k: 'draft_c', t: 'str', v: String(c) });
      runtime.addLabel(stateModel, 0, 0, 0, { k: 'draft_k', t: 'str', v: String(k) });
      runtime.addLabel(stateModel, 0, 0, 0, { k: 'draft_t', t: 'str', v: t || 'str' });

      if (action === 'datatable_edit_row') {
        if (!Number.isInteger(targetModelId) || targetModelId === 0) {
          return fail(op_id, 'invalid_target', 'target.model_id must be non-zero int');
        }
        runtime.addLabel(stateModel, 0, 0, 0, { k: 'dt_edit_open', t: 'bool', v: true });
        runtime.addLabel(stateModel, 0, 0, 0, { k: 'dt_edit_model_id', t: 'str', v: String(targetModelId) });
        runtime.addLabel(stateModel, 0, 0, 0, { k: 'dt_edit_p', t: 'str', v: String(p) });
        runtime.addLabel(stateModel, 0, 0, 0, { k: 'dt_edit_r', t: 'str', v: String(r) });
        runtime.addLabel(stateModel, 0, 0, 0, { k: 'dt_edit_c', t: 'str', v: String(c) });
        runtime.addLabel(stateModel, 0, 0, 0, { k: 'dt_edit_k', t: 'str', v: String(k) });
        runtime.addLabel(stateModel, 0, 0, 0, { k: 'dt_edit_t', t: 'str', v: t || 'str' });
        if (t === 'int') {
          const iv = typeof vRaw === 'number' ? vRaw : parseSafeInt(vRaw);
          runtime.addLabel(stateModel, 0, 0, 0, { k: 'dt_edit_v_int', t: 'int', v: iv ?? 0 });
        } else if (t === 'bool') {
          runtime.addLabel(stateModel, 0, 0, 0, { k: 'dt_edit_v_bool', t: 'bool', v: Boolean(vRaw) });
        } else {
          runtime.addLabel(stateModel, 0, 0, 0, { k: 'dt_edit_v_text', t: 'str', v: t === 'json' ? stringify(vRaw) : String(vRaw ?? '') });
        }
        return succeed(op_id, 'datatable_edit_row');
      }

      if (t === 'int') {
        const iv = typeof vRaw === 'number' ? vRaw : parseSafeInt(vRaw);
        runtime.addLabel(stateModel, 0, 0, 0, { k: 'draft_v_int', t: 'int', v: iv ?? 0 });
      } else if (t === 'bool') {
        runtime.addLabel(stateModel, 0, 0, 0, { k: 'draft_v_bool', t: 'bool', v: Boolean(vRaw) });
      } else {
        runtime.addLabel(stateModel, 0, 0, 0, { k: 'draft_v_text', t: 'str', v: t === 'json' ? stringify(vRaw) : String(vRaw ?? '') });
      }
      return succeed(op_id, 'datatable_select_row');
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

    const allowRunForSystem = target.model_id < 0 && typeof target.k === 'string' && target.k.startsWith('run_');
    if (matchForbiddenK(target.k) && !allowRunForSystem) {
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
