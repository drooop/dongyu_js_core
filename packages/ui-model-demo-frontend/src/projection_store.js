import { reactive } from 'vue';

const HOST_TABLE_ID = 'host';

function normalizeTableId(tableId) {
  return typeof tableId === 'string' && tableId.trim() ? tableId.trim() : HOST_TABLE_ID;
}

function normalizeModelKey(modelId) {
  return String(modelId);
}

function normalizeCellKey(p, r, c) {
  return `${p},${r},${c}`;
}

function parseCellKey(cellKey) {
  const parts = String(cellKey || '').split(',').map((part) => Number.parseInt(part, 10));
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) return { p: 0, r: 0, c: 0 };
  return { p: parts[0], r: parts[1], c: parts[2] };
}

function labelRefKey(ref) {
  if (!ref || !Number.isInteger(ref.model_id) || !Number.isInteger(ref.p) || !Number.isInteger(ref.r) || !Number.isInteger(ref.c) || typeof ref.k !== 'string') {
    return '';
  }
  return `${normalizeTableId(ref.table_id)}:${ref.model_id}:${ref.p}:${ref.r}:${ref.c}:${ref.k}`;
}

function cloneJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function sameJson(a, b) {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch (_) {
    return false;
  }
}

export function createProjectionStore() {
  const labelAtoms = new Map();
  const v1nConfig = reactive({ value: {} });
  const meta = reactive({
    snapshotSeq: 0,
    structuralVersion: 0,
    labelVersion: 0,
  });

  function getLabelAtom(ref) {
    const key = labelRefKey(ref);
    if (!key) {
      return reactive({
        ref: ref || null,
        exists: false,
        label: null,
        value: undefined,
        version: 0,
      });
    }
    const existing = labelAtoms.get(key);
    if (existing) return existing;
    const atom = reactive({
      ref: { table_id: normalizeTableId(ref.table_id), model_id: ref.model_id, p: ref.p, r: ref.r, c: ref.c, k: ref.k },
      exists: false,
      label: null,
      value: undefined,
      version: 0,
    });
    labelAtoms.set(key, atom);
    return atom;
  }

  function setAtomLabel(ref, label) {
    const atom = getLabelAtom(ref);
    const nextLabel = label ? cloneJson(label) : null;
    const nextValue = nextLabel ? nextLabel.v : undefined;
    const nextExists = !!nextLabel;
    if (atom.exists === nextExists && sameJson(atom.label, nextLabel) && Object.is(atom.value, nextValue)) {
      return atom;
    }
    atom.exists = nextExists;
    atom.label = nextLabel;
    atom.value = nextValue;
    atom.version += 1;
    meta.labelVersion += 1;
    return atom;
  }

  function clearAtom(ref) {
    return setAtomLabel(ref, null);
  }

  function atomMatchesModel(atom, modelId, tableId = HOST_TABLE_ID) {
    return atom && atom.ref && atom.ref.model_id === modelId && normalizeTableId(atom.ref.table_id) === normalizeTableId(tableId);
  }

  function atomMatchesCell(atom, modelId, cellKey, tableId = HOST_TABLE_ID) {
    if (!atomMatchesModel(atom, modelId, tableId)) return false;
    const parsed = parseCellKey(cellKey);
    return atom.ref.p === parsed.p && atom.ref.r === parsed.r && atom.ref.c === parsed.c;
  }

  function clearKnownModel(modelId, tableId = HOST_TABLE_ID) {
    for (const atom of labelAtoms.values()) {
      if (atomMatchesModel(atom, modelId, tableId)) clearAtom(atom.ref);
    }
    meta.structuralVersion += 1;
  }

  function clearKnownCell(modelId, cellKey, tableId = HOST_TABLE_ID) {
    for (const atom of labelAtoms.values()) {
      if (atomMatchesCell(atom, modelId, cellKey, tableId)) clearAtom(atom.ref);
    }
    meta.structuralVersion += 1;
  }

  function hydrateCell(modelId, cellKey, cell, tableId = HOST_TABLE_ID) {
    if (!cell || !cell.labels) {
      clearKnownCell(modelId, cellKey, tableId);
      return;
    }
    const parsed = parseCellKey(cellKey);
    const seen = new Set();
    for (const [labelKey, label] of Object.entries(cell.labels || {})) {
      seen.add(labelKey);
      setAtomLabel({
        table_id: normalizeTableId(tableId),
        model_id: modelId,
        p: Number.isInteger(cell.p) ? cell.p : parsed.p,
        r: Number.isInteger(cell.r) ? cell.r : parsed.r,
        c: Number.isInteger(cell.c) ? cell.c : parsed.c,
        k: labelKey,
      }, label);
    }
    for (const atom of labelAtoms.values()) {
      if (atomMatchesCell(atom, modelId, cellKey, tableId) && !seen.has(atom.ref.k)) {
        clearAtom(atom.ref);
      }
    }
  }

  function hydrateModel(modelId, model, tableId = HOST_TABLE_ID) {
    if (!model || !model.cells) {
      clearKnownModel(modelId, tableId);
      return;
    }
    const seenCells = new Set(Object.keys(model.cells || {}));
    for (const [cellKey, cell] of Object.entries(model.cells || {})) {
      hydrateCell(modelId, cellKey, cell, tableId);
    }
    for (const atom of labelAtoms.values()) {
      if (!atomMatchesModel(atom, modelId, tableId)) continue;
      const cellKey = normalizeCellKey(atom.ref.p, atom.ref.r, atom.ref.c);
      if (!seenCells.has(cellKey)) clearAtom(atom.ref);
    }
    meta.structuralVersion += 1;
  }

  function hydrateSnapshot(snapshot, metadata = {}) {
    const models = snapshot && snapshot.models ? snapshot.models : {};
    const seenModels = new Set();
    for (const [modelKey, model] of Object.entries(models)) {
      const modelId = /^-?\d+$/u.test(modelKey) ? Number(modelKey) : modelKey;
      seenModels.add(`${HOST_TABLE_ID}:${normalizeModelKey(modelId)}`);
      hydrateModel(modelId, model, HOST_TABLE_ID);
    }
    for (const [tableId, table] of Object.entries(snapshot?.tables || {})) {
      for (const [modelKey, model] of Object.entries(table?.models || {})) {
        const modelId = /^-?\d+$/u.test(modelKey) ? Number(modelKey) : modelKey;
        const normalizedTableId = normalizeTableId(tableId);
        seenModels.add(`${normalizedTableId}:${normalizeModelKey(modelId)}`);
        hydrateModel(modelId, model, normalizedTableId);
      }
    }
    for (const atom of labelAtoms.values()) {
      const key = `${normalizeTableId(atom.ref.table_id)}:${normalizeModelKey(atom.ref.model_id)}`;
      if (!seenModels.has(key)) clearAtom(atom.ref);
    }
    v1nConfig.value = cloneJson(snapshot && Object.prototype.hasOwnProperty.call(snapshot, 'v1nConfig') ? snapshot.v1nConfig : {});
    if (Number.isInteger(metadata.snapshot_seq)) meta.snapshotSeq = metadata.snapshot_seq;
    else if (Number.isInteger(metadata.snapshotSeq)) meta.snapshotSeq = metadata.snapshotSeq;
  }

  function applySnapshotPatch(patch) {
    if (!patch || patch.patch_kind !== 'json_replace_v1' || !Array.isArray(patch.ops)) {
      throw new Error('invalid_projection_patch');
    }
    for (const op of patch.ops) {
      if (!op || typeof op.op !== 'string') throw new Error('invalid_projection_patch_op');
      const modelId = /^-?\d+$/u.test(String(op.model_id)) ? Number(op.model_id) : op.model_id;
      if (op.op === 'replace_v1n_config') {
        v1nConfig.value = cloneJson(op.value);
        continue;
      }
      const tableId = normalizeTableId(op.table_id);
      if (op.op === 'delete_model') {
        clearKnownModel(modelId, tableId);
        continue;
      }
      if (op.op === 'replace_model') {
        hydrateModel(modelId, op.value, tableId);
        continue;
      }
      const cellKey = String(op.cell_key || '');
      if (!cellKey) throw new Error('invalid_projection_patch_cell');
      if (op.op === 'delete_cell') {
        clearKnownCell(modelId, cellKey, tableId);
        continue;
      }
      if (op.op === 'replace_cell') {
        hydrateCell(modelId, cellKey, op.value, tableId);
        meta.structuralVersion += 1;
        continue;
      }
      const labelKey = String(op.label_key || '');
      if (!labelKey) throw new Error('invalid_projection_patch_label');
      const parsed = parseCellKey(cellKey);
      const ref = { table_id: tableId, model_id: modelId, p: parsed.p, r: parsed.r, c: parsed.c, k: labelKey };
      if (op.op === 'delete_label') {
        clearAtom(ref);
        continue;
      }
      if (op.op === 'replace_label') {
        setAtomLabel(ref, op.value);
        continue;
      }
      throw new Error(`unsupported_projection_patch_op:${op.op}`);
    }
    if (Number.isInteger(patch.snapshot_seq)) meta.snapshotSeq = patch.snapshot_seq;
  }

  function getLabelValue(ref) {
    return getLabelAtom(ref).value;
  }

  return {
    meta,
    v1nConfig,
    getLabelAtom,
    getLabelValue,
    hydrateSnapshot,
    applySnapshotPatch,
  };
}
