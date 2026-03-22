import { getSnapshotModel, getSnapshotLabelValue, parseSafeInt } from './snapshot_utils.js';

function stringifyOneLine(value) {
  if (value === undefined) return '';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch (_) {
    return String(value);
  }
}

function truncate(text, maxLen = 120) {
  const s = typeof text === 'string' ? text : String(text);
  if (s.length <= maxLen) return s;
  return `${s.slice(0, Math.max(0, maxLen - 1))}…`;
}

function isFilteredClientLabel(key, type) {
  const normalizedKey = typeof key === 'string' ? key.trim() : '';
  const normalizedType = typeof type === 'string' ? type.trim() : '';
  return normalizedKey === 'matrix_token'
    || normalizedKey === 'matrix_passwd'
    || normalizedType === 'matrix.token'
    || normalizedType === 'matrix.passwd';
}

function normalizeAssetJson(rawValue) {
  if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
    return rawValue;
  }
  if (typeof rawValue !== 'string') return null;
  try {
    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch (_) {
    return null;
  }
}

function readWorkspaceMountedModelIds(snapshot) {
  const workspaceModel = getSnapshotModel(snapshot, -25);
  if (!workspaceModel || !workspaceModel.cells) return new Set();
  const mounted = new Set();
  for (const cell of Object.values(workspaceModel.cells)) {
    const labels = cell && cell.labels ? cell.labels : {};
    const modelType = labels.model_type;
    if (!modelType || modelType.t !== 'model.submt' || !Number.isInteger(modelType.v)) continue;
    mounted.add(modelType.v);
  }
  return mounted;
}

export function deriveEditorModelOptions(snapshot, editorStateModelId) {
  const models = snapshot && snapshot.models ? snapshot.models : {};
  const query = String(getSnapshotLabelValue(snapshot, { model_id: editorStateModelId, p: 0, r: 0, c: 0, k: 'dt_filter_model_query' }) ?? '').trim().toLowerCase();
  const options = Object.values(models)
    .map((m) => ({ id: m && typeof m.id === 'number' ? m.id : parseSafeInt(m && m.id), name: m && m.name ? String(m.name) : '' }))
    .filter((m) => Number.isInteger(m.id) && m.id !== 0)
    .sort((a, b) => a.id - b.id)
    .map((m) => ({ label: `${m.id}${m.name ? ` (${m.name})` : ''}`, value: m.id }));
  return query
    ? options.filter((opt) => String(opt.label || '').toLowerCase().includes(query))
    : options;
}

export function deriveHomeTableRows(snapshot, editorStateModelId) {
  const selectedModelRaw = getSnapshotLabelValue(snapshot, { model_id: editorStateModelId, p: 0, r: 0, c: 0, k: 'selected_model_id' });
  const selectedModelId = parseSafeInt(selectedModelRaw);
  const targetModel = selectedModelId === null ? null : getSnapshotModel(snapshot, selectedModelId);
  const tableFilterP = parseSafeInt(getSnapshotLabelValue(snapshot, { model_id: editorStateModelId, p: 0, r: 0, c: 0, k: 'dt_filter_p' }));
  const tableFilterR = parseSafeInt(getSnapshotLabelValue(snapshot, { model_id: editorStateModelId, p: 0, r: 0, c: 0, k: 'dt_filter_r' }));
  const tableFilterC = parseSafeInt(getSnapshotLabelValue(snapshot, { model_id: editorStateModelId, p: 0, r: 0, c: 0, k: 'dt_filter_c' }));
  const tableFilterKtv = String(getSnapshotLabelValue(snapshot, { model_id: editorStateModelId, p: 0, r: 0, c: 0, k: 'dt_filter_ktv' }) ?? '').trim().toLowerCase();
  const rows = [];
  if (!targetModel || !targetModel.cells) return rows;

  for (const [cellKey, cell] of Object.entries(targetModel.cells)) {
    const parts = String(cellKey).split(',');
    if (parts.length !== 3) continue;
    const p = parseSafeInt(parts[0]);
    const r = parseSafeInt(parts[1]);
    const c = parseSafeInt(parts[2]);
    if (!Number.isInteger(p) || !Number.isInteger(r) || !Number.isInteger(c)) continue;
    if (tableFilterP !== null && p !== tableFilterP) continue;
    if (tableFilterR !== null && r !== tableFilterR) continue;
    if (tableFilterC !== null && c !== tableFilterC) continue;
    const labels = cell && cell.labels ? cell.labels : {};
    for (const [k, lv] of Object.entries(labels)) {
      const t = lv && lv.t ? String(lv.t) : '';
      if (isFilteredClientLabel(k, t)) continue;
      const vRaw = lv && Object.prototype.hasOwnProperty.call(lv, 'v') ? lv.v : undefined;
      const vText = stringifyOneLine(vRaw);
      if (tableFilterKtv) {
        const hay = `${String(k).toLowerCase()}|${t.toLowerCase()}|${String(vText).toLowerCase()}`;
        if (!hay.includes(tableFilterKtv)) continue;
      }
      rows.push({
        row_id: `${selectedModelId ?? ''}:${p},${r},${c}:${k}`,
        model_id: selectedModelId ?? 0,
        p,
        r,
        c,
        k: String(k),
        t,
        v_preview: truncate(vText, 120),
      });
    }
  }
  rows.sort((a, b) => {
    if (a.p !== b.p) return a.p - b.p;
    if (a.r !== b.r) return a.r - b.r;
    if (a.c !== b.c) return a.c - b.c;
    return a.k.localeCompare(b.k);
  });
  return rows;
}

export function deriveHomeMissingModelText(snapshot, editorStateModelId) {
  const selectedModelRaw = getSnapshotLabelValue(snapshot, { model_id: editorStateModelId, p: 0, r: 0, c: 0, k: 'selected_model_id' });
  const selectedModelId = parseSafeInt(selectedModelRaw);
  if (selectedModelId === null) return '';
  const targetModel = getSnapshotModel(snapshot, selectedModelId);
  return targetModel ? '' : `Selected model ${selectedModelId} missing. Create it first.`;
}

export function deriveHomeSelectedLabelText(snapshot, editorStateModelId) {
  const selectedModelId = parseSafeInt(getSnapshotLabelValue(snapshot, { model_id: editorStateModelId, p: 0, r: 0, c: 0, k: 'selected_model_id' }));
  if (selectedModelId === null) return 'Current target: no model selected.';

  const p = parseSafeInt(getSnapshotLabelValue(snapshot, { model_id: editorStateModelId, p: 0, r: 0, c: 0, k: 'draft_p' })) ?? 0;
  const r = parseSafeInt(getSnapshotLabelValue(snapshot, { model_id: editorStateModelId, p: 0, r: 0, c: 0, k: 'draft_r' })) ?? 0;
  const c = parseSafeInt(getSnapshotLabelValue(snapshot, { model_id: editorStateModelId, p: 0, r: 0, c: 0, k: 'draft_c' })) ?? 0;
  const k = String(getSnapshotLabelValue(snapshot, { model_id: editorStateModelId, p: 0, r: 0, c: 0, k: 'draft_k' }) ?? '').trim() || 'title';
  const t = String(getSnapshotLabelValue(snapshot, { model_id: editorStateModelId, p: 0, r: 0, c: 0, k: 'draft_t' }) ?? 'str').trim() || 'str';

  return `Current target: model ${selectedModelId} (${p},${r},${c}) ${k} [${t}]`;
}

export function deriveHomeEditDialogTitle(snapshot, editorStateModelId) {
  const mode = String(getSnapshotLabelValue(snapshot, { model_id: editorStateModelId, p: 0, r: 0, c: 0, k: 'home_form_mode' }) ?? 'edit').trim().toLowerCase();
  return mode === 'create' ? 'Create Label' : 'Edit Label';
}

export function deriveStaticUploadReady(snapshot, editorStateModelId) {
  const name = String(getSnapshotLabelValue(snapshot, { model_id: editorStateModelId, p: 0, r: 0, c: 0, k: 'static_project_name' }) ?? '').trim();
  const uri = String(getSnapshotLabelValue(snapshot, { model_id: editorStateModelId, p: 0, r: 0, c: 0, k: 'static_media_uri' }) ?? '').trim();
  return name.length > 0 && uri.length > 0;
}

export function deriveWorkspaceSelected(snapshot, editorStateModelId, projectSchemaModel) {
  const registry = getSnapshotLabelValue(snapshot, { model_id: editorStateModelId, p: 0, r: 0, c: 0, k: 'ws_apps_registry' });
  const selectedRaw = getSnapshotLabelValue(snapshot, { model_id: editorStateModelId, p: 0, r: 0, c: 0, k: 'ws_app_selected' });
  const selectedId = typeof selectedRaw === 'number' ? selectedRaw : parseSafeInt(selectedRaw);
  const apps = Array.isArray(registry) ? registry : [];
  const selectedApp = apps.find((entry) => entry && entry.model_id === selectedId) || null;
  if (!selectedApp || !Number.isInteger(selectedId) || selectedId === 0) {
    return {
      title: '应用详情',
      ast: {
        id: 'ws_placeholder',
        type: 'Text',
        props: { type: 'info', text: '请从左侧选择一个应用', style: { fontSize: '16px', color: '#909399', padding: '40px 0', textAlign: 'center' } },
      },
    };
  }
  const mountedIds = readWorkspaceMountedModelIds(snapshot);
  if (!mountedIds.has(selectedId)) {
    return {
      title: selectedApp.name || `App ${selectedId}`,
      ast: {
        id: 'ws_not_mounted',
        type: 'Text',
        props: { type: 'warning', text: `Model ${selectedId} is not mounted into Workspace.` },
      },
    };
  }
  const modelLabelAst = normalizeAssetJson(
    getSnapshotLabelValue(snapshot, { model_id: selectedId, p: 0, r: 1, c: 0, k: 'page_asset_v0' }),
  );
  if (modelLabelAst) {
    return { title: selectedApp.name || `App ${selectedId}`, ast: modelLabelAst };
  }
  const schemaAst = typeof projectSchemaModel === 'function' ? projectSchemaModel(snapshot, selectedId) : null;
  if (schemaAst) {
    return { title: selectedApp.name || `App ${selectedId}`, ast: schemaAst };
  }
  return {
    title: selectedApp.name || `App ${selectedId}`,
    ast: {
      id: 'ws_no_ast',
      type: 'Text',
      props: { type: 'warning', text: `Model ${selectedId} has no UI schema or AST.` },
    },
  };
}

function readSnapshotString(snapshot, ref, fallback = '') {
  const value = getSnapshotLabelValue(snapshot, ref);
  if (value === undefined || value === null) return fallback;
  return String(value);
}

export function deriveMatrixDebugView(snapshot, editorStateModelId) {
  const traceModelId = -100;
  const selectedRaw = getSnapshotLabelValue(snapshot, {
    model_id: editorStateModelId, p: 0, r: 0, c: 0, k: 'matrix_debug_subject_selected',
  });
  const subjects = [
    { label: 'Trace Buffer', value: 'trace' },
    { label: 'Runtime', value: 'runtime' },
    { label: 'Matrix Adapter', value: 'matrix' },
    { label: 'Bridge', value: 'bridge' },
  ];
  const selected = subjects.some((entry) => entry.value === selectedRaw) ? selectedRaw : 'trace';

  const runtimeMode = readSnapshotString(snapshot, { model_id: 0, p: 0, r: 0, c: 0, k: 'runtime_mode' }, 'edit');
  const traceStatus = readSnapshotString(snapshot, { model_id: traceModelId, p: 0, r: 0, c: 0, k: 'trace_status' }, 'monitoring');
  const traceLastUpdate = readSnapshotString(snapshot, { model_id: traceModelId, p: 0, r: 0, c: 0, k: 'trace_last_update' }, '--:--:--');
  const traceThroughput = readSnapshotString(snapshot, { model_id: traceModelId, p: 0, r: 0, c: 0, k: 'trace_throughput' }, '0/s');
  const traceErrorRate = readSnapshotString(snapshot, { model_id: traceModelId, p: 0, r: 0, c: 0, k: 'trace_error_rate' }, '0%');
  const traceCount = parseSafeInt(getSnapshotLabelValue(snapshot, {
    model_id: traceModelId, p: 0, r: 0, c: 0, k: 'trace_count',
  })) ?? 0;
  const matrixStatus = readSnapshotString(snapshot, { model_id: traceModelId, p: 0, r: 0, c: 0, k: 'matrix_status' }, 'not_ready');
  const bridgeStatus = readSnapshotString(snapshot, { model_id: traceModelId, p: 0, r: 0, c: 0, k: 'bridge_status' }, 'idle');

  const readinessText = `runtime=${runtimeMode} | matrix=${matrixStatus} | bridge=${bridgeStatus}`;
  const traceSummaryText = `events=${traceCount} | throughput=${traceThroughput} | error=${traceErrorRate} | updated=${traceLastUpdate}`;

  let subjectSummaryText = '';
  if (selected === 'runtime') {
    subjectSummaryText = `Runtime mode is ${runtimeMode}. Trace surface status=${traceStatus}.`;
  } else if (selected === 'matrix') {
    subjectSummaryText = `Matrix adapter status=${matrixStatus}. Bridge status=${bridgeStatus}.`;
  } else if (selected === 'bridge') {
    subjectSummaryText = `Bridge status=${bridgeStatus}. Throughput=${traceThroughput}. Error rate=${traceErrorRate}.`;
  } else {
    subjectSummaryText = `Trace buffer status=${traceStatus}. ${traceSummaryText}.`;
  }

  return {
    subjects,
    selected,
    readinessText,
    subjectSummaryText,
    traceSummaryText,
  };
}
