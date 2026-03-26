import { getSnapshotModel } from './snapshot_utils.js';

function getCellLabels(model, p, r, c) {
  const key = `${p},${r},${c}`;
  const cell = model && model.cells ? model.cells[key] : null;
  return cell && cell.labels ? cell.labels : {};
}

function getRootLabels(model) {
  return getCellLabels(model, 0, 0, 0);
}

function readLabel(labels, key) {
  const label = labels && Object.prototype.hasOwnProperty.call(labels, key) ? labels[key] : null;
  return label && Object.prototype.hasOwnProperty.call(label, 'v') ? label.v : undefined;
}

function readString(labels, key, fallback = '') {
  const value = readLabel(labels, key);
  return typeof value === 'string' ? value : fallback;
}

function readInt(labels, key, fallback = null) {
  const value = readLabel(labels, key);
  return Number.isInteger(value) ? value : fallback;
}

function readBool(labels, key, fallback = null) {
  const value = readLabel(labels, key);
  return typeof value === 'boolean' ? value : fallback;
}

function collectNodeDefs(model) {
  const defs = [];
  const cells = model && model.cells ? model.cells : {};
  for (const [coord, cell] of Object.entries(cells)) {
    const labels = cell && cell.labels ? cell.labels : {};
    const id = readString(labels, 'ui_node_id', '');
    const type = readString(labels, 'ui_component', '');
    if (!id || !type) continue;
    defs.push({
      coord,
      id,
      type,
      parent: readString(labels, 'ui_parent', ''),
      order: readInt(labels, 'ui_order', 0) ?? 0,
      slot: readString(labels, 'ui_slot', ''),
      labels,
    });
  }
  return defs;
}

function buildProps(def) {
  const labels = def.labels;
  const props = {};
  const layout = readString(labels, 'ui_layout', '');
  const gap = readInt(labels, 'ui_gap', null);
  const wrap = readBool(labels, 'ui_wrap', null);
  const text = readLabel(labels, 'ui_text');
  const title = readLabel(labels, 'ui_title');
  const label = readLabel(labels, 'ui_label');
  const variant = readLabel(labels, 'ui_variant');
  const placeholder = readLabel(labels, 'ui_placeholder');

  if (layout) props.layout = layout;
  if (gap !== null) props.gap = gap;
  if (wrap !== null) props.wrap = wrap;
  if (typeof text === 'string') props.text = text;
  if (typeof title === 'string') props.title = title;
  if (typeof label === 'string') props.label = label;
  if (typeof variant === 'string') props.type = variant;
  if (typeof placeholder === 'string') props.placeholder = placeholder;
  return props;
}

function buildReadBind(def) {
  const labels = def.labels;
  const model_id = readInt(labels, 'ui_read_model_id', null);
  const p = readInt(labels, 'ui_read_p', null);
  const r = readInt(labels, 'ui_read_r', null);
  const c = readInt(labels, 'ui_read_c', null);
  const k = readString(labels, 'ui_read_k', '');
  if (!Number.isInteger(model_id) || !Number.isInteger(p) || !Number.isInteger(r) || !Number.isInteger(c) || !k) {
    return null;
  }
  return { model_id, p, r, c, k };
}

function buildWriteBind(def) {
  const labels = def.labels;
  const action = readString(labels, 'ui_write_action', '');
  if (!action) return null;
  const mode = readString(labels, 'ui_write_mode', '');
  if (mode === 'intent') {
    return { action, mode: 'intent' };
  }
  const model_id = readInt(labels, 'ui_write_target_model_id', null);
  const p = readInt(labels, 'ui_write_target_p', null);
  const r = readInt(labels, 'ui_write_target_r', null);
  const c = readInt(labels, 'ui_write_target_c', null);
  const k = readString(labels, 'ui_write_target_k', '');
  if (!Number.isInteger(model_id) || !Number.isInteger(p) || !Number.isInteger(r) || !Number.isInteger(c) || !k) {
    return { action };
  }
  return {
    action,
    target_ref: { model_id, p, r, c, k },
  };
}

function buildNodeMap(defs) {
  const map = new Map();
  for (const def of defs) {
    map.set(def.id, {
      id: def.id,
      type: def.type,
      props: buildProps(def),
      bind: (() => {
        const read = buildReadBind(def);
        const write = buildWriteBind(def);
        if (!read && !write) return undefined;
        const bind = {};
        if (read) bind.read = read;
        if (write) bind.write = write;
        return bind;
      })(),
      __parent: def.parent,
      __slot: def.slot,
      __order: def.order,
      children: [],
    });
  }
  return map;
}

function stripMeta(node) {
  const out = {
    id: node.id,
    type: node.type,
  };
  if (node.props && Object.keys(node.props).length > 0) out.props = node.props;
  if (node.bind) out.bind = node.bind;
  if (Array.isArray(node.children) && node.children.length > 0) {
    out.children = node.children.map(stripMeta);
  }
  return out;
}

export function buildAstFromCellwiseModel(snapshot, modelId) {
  const model = getSnapshotModel(snapshot, modelId);
  if (!model || !model.cells) return null;
  const rootLabels = getRootLabels(model);
  if (readString(rootLabels, 'ui_authoring_version', '') !== 'cellwise.ui.v1') return null;
  const rootNodeId = readString(rootLabels, 'ui_root_node_id', '');
  if (!rootNodeId) return null;

  const defs = collectNodeDefs(model);
  if (defs.length === 0) return null;
  const nodes = buildNodeMap(defs);
  const root = nodes.get(rootNodeId);
  if (!root) return null;

  const childrenByParent = new Map();
  for (const node of nodes.values()) {
    if (node.id === rootNodeId) continue;
    const parent = node.__parent || rootNodeId;
    if (!childrenByParent.has(parent)) childrenByParent.set(parent, []);
    childrenByParent.get(parent).push(node);
  }

  for (const [parentId, children] of childrenByParent.entries()) {
    const parent = nodes.get(parentId);
    if (!parent) continue;
    children.sort((a, b) => a.__order - b.__order || a.id.localeCompare(b.id));
    parent.children = children;
  }

  return stripMeta(root);
}
