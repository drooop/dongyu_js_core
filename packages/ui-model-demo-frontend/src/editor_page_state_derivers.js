export function getSnapshotModel(snapshot, modelId) {
  if (!snapshot || !snapshot.models) return null;
  return snapshot.models[modelId] || snapshot.models[String(modelId)] || null;
}

export function getSnapshotLabelValue(snapshot, ref) {
  const modelId = ref && typeof ref.model_id === 'number' ? ref.model_id : 0;
  const model = getSnapshotModel(snapshot, modelId);
  if (!model || !model.cells) return undefined;
  const key = `${ref.p},${ref.r},${ref.c}`;
  const cell = model.cells[key];
  if (!cell || !cell.labels) return undefined;
  const label = cell.labels[ref.k];
  if (!label) return undefined;
  return label.v;
}

export function parseSafeInt(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    if (!/^-?\d+$/.test(trimmed)) return null;
    const parsed = Number(trimmed);
    if (!Number.isSafeInteger(parsed)) return null;
    return parsed;
  }
  return null;
}

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
      const vRaw = lv && Object.prototype.hasOwnProperty.call(lv, 'v') ? lv.v : undefined;
      const vText = stringifyOneLine(vRaw);
      if (tableFilterKtv) {
        const hay = `${String(k).toLowerCase()}|${t.toLowerCase()}|${String(vText).toLowerCase()}`;
        if (!hay.includes(tableFilterKtv)) continue;
      }
      rows.push({
        row_id: `${selectedModelId ?? ''}:${p},${r},${c}:${k}`,
        model_id: selectedModelId ?? 0,
        model_id_is_editable: !(Number.isInteger(selectedModelId) && selectedModelId !== 0),
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
  const schemaAst = typeof projectSchemaModel === 'function' ? projectSchemaModel(snapshot, selectedId) : null;
  if (schemaAst) {
    return { title: selectedApp.name || `App ${selectedId}`, ast: schemaAst };
  }
  const selectedModel = getSnapshotModel(snapshot, selectedId);
  const root = selectedModel && selectedModel.cells ? selectedModel.cells['0,0,0'] : null;
  const uiAst = root && root.labels && root.labels.ui_ast_v0 ? root.labels.ui_ast_v0.v : null;
  if (uiAst && typeof uiAst === 'object') {
    return { title: selectedApp.name || `App ${selectedId}`, ast: uiAst };
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
