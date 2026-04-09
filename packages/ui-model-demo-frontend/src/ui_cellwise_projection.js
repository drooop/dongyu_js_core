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

function readRefSpec(labels, prefix) {
  const model_id = readInt(labels, `${prefix}_model_id`, null);
  const p = readInt(labels, `${prefix}_p`, null);
  const r = readInt(labels, `${prefix}_r`, null);
  const c = readInt(labels, `${prefix}_c`, null);
  const k = readString(labels, `${prefix}_k`, '');
  if (!Number.isInteger(model_id) || !Number.isInteger(p) || !Number.isInteger(r) || !Number.isInteger(c) || !k) {
    return null;
  }
  return { $label: { model_id, p, r, c, k } };
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

function parseCellCoord(coord) {
  const parts = String(coord || '').split(',');
  if (parts.length !== 3) return null;
  const [p, r, c] = parts.map((part) => Number.parseInt(part, 10));
  if (!Number.isInteger(p) || !Number.isInteger(r) || !Number.isInteger(c)) return null;
  return { p, r, c };
}

function inferWriteTrigger(componentType, commitPolicy = 'immediate') {
  if (componentType === 'Button') return 'click';
  if (commitPolicy === 'on_blur') return 'blur';
  if (commitPolicy === 'on_submit') return 'submit';
  return 'change';
}

function buildWritablePins(componentType, writeBind) {
  if (!writeBind || typeof writeBind !== 'object' || typeof writeBind.pin !== 'string' || !writeBind.pin.trim()) {
    return undefined;
  }
  const rawValueRef = writeBind.value_ref;
  const value_t = rawValueRef && typeof rawValueRef === 'object' && typeof rawValueRef.t === 'string'
    ? rawValueRef.t
    : (typeof writeBind.value_t === 'string' ? writeBind.value_t : undefined);
  return [{
    name: writeBind.pin.trim(),
    direction: 'in',
    trigger: inferWriteTrigger(componentType, typeof writeBind.commit_policy === 'string' ? writeBind.commit_policy : 'immediate'),
    ...(value_t ? { value_t } : {}),
    ...(typeof writeBind.commit_policy === 'string' ? { commit_policy: writeBind.commit_policy } : {}),
    primary: true,
  }];
}

function buildProps(def) {
  const labels = def.labels;
  const props = {};
  const style = {};

  const assignStringOrRef = (propName, directKey, refPrefix = `${directKey}_ref`) => {
    const direct = readLabel(labels, directKey);
    if (typeof direct === 'string' && direct.length > 0) {
      props[propName] = direct;
    }
    const ref = readRefSpec(labels, refPrefix);
    if (ref) props[propName] = ref;
  };

  const assignIntOrRef = (propName, directKey, refPrefix = `${directKey}_ref`) => {
    const direct = readInt(labels, directKey, null);
    if (direct !== null) props[propName] = direct;
    const ref = readRefSpec(labels, refPrefix);
    if (ref) props[propName] = ref;
  };

  const assignBool = (propName, directKey) => {
    const direct = readBool(labels, directKey, null);
    if (direct !== null) props[propName] = direct;
  };

  const assignStyleStringOrRef = (styleKey, directKey, refPrefix = `${directKey}_ref`) => {
    const direct = readLabel(labels, directKey);
    if ((typeof direct === 'string' && direct.length > 0) || typeof direct === 'number') {
      style[styleKey] = direct;
    }
    const ref = readRefSpec(labels, refPrefix);
    if (ref) style[styleKey] = ref;
  };

  const layout = readString(labels, 'ui_layout', '');
  const gap = readInt(labels, 'ui_gap', null);
  const wrap = readBool(labels, 'ui_wrap', null);
  if (layout) props.layout = layout;
  if (gap !== null) props.gap = gap;
  if (wrap !== null) props.wrap = wrap;

  assignStringOrRef('text', 'ui_text');
  assignStringOrRef('title', 'ui_title');
  assignStringOrRef('label', 'ui_label');
  assignStringOrRef('type', 'ui_variant');
  assignStringOrRef('placeholder', 'ui_placeholder');
  assignStringOrRef('accept', 'ui_accept');
  assignStringOrRef('buttonLabel', 'ui_button_label');
  assignStringOrRef('emptyText', 'ui_empty_text');
  assignStringOrRef('size', 'ui_size');
  assignStringOrRef('rowKey', 'ui_row_key');
  assignStringOrRef('prop', 'ui_prop');
  assignStringOrRef('align', 'ui_align');
  assignStringOrRef('layout', 'ui_layout');

  assignIntOrRef('height', 'ui_height');
  assignStringOrRef('width', 'ui_width');
  assignStringOrRef('minWidth', 'ui_min_width');
  assignStringOrRef('maxWidth', 'ui_max_width');
  assignIntOrRef('level', 'ui_heading_level');
  assignIntOrRef('sectionNumber', 'ui_section_number');
  assignBool('border', 'ui_border');
  assignBool('stripe', 'ui_stripe');

  const optionsJson = readLabel(labels, 'ui_options_json');
  if (Array.isArray(optionsJson)) props.options = optionsJson;
  const dataRef = readRefSpec(labels, 'ui_data_ref');
  if (dataRef) props.data = dataRef;
  const nameTargetRef = readRefSpec(labels, 'ui_name_target');
  if (nameTargetRef && nameTargetRef.$label) {
    props.nameTargetRef = nameTargetRef.$label;
  }

  const propsJson = readLabel(labels, 'ui_props_json');
  if (propsJson && typeof propsJson === 'object' && !Array.isArray(propsJson)) {
    Object.assign(props, propsJson);
  }

  assignStringOrRef('listType', 'ui_list_type');
  assignStringOrRef('calloutType', 'ui_callout_type');
  assignStringOrRef('src', 'ui_image_src');
  assignStringOrRef('alt', 'ui_image_alt');
  assignStringOrRef('code', 'ui_mermaid_code');
  assignStringOrRef('language', 'ui_code_language');
  assignStringOrRef('selectedText', 'ui_selected_text');

  assignStyleStringOrRef('width', 'ui_style_width');
  assignStyleStringOrRef('minWidth', 'ui_style_min_width');
  assignStyleStringOrRef('maxWidth', 'ui_style_max_width');
  assignStyleStringOrRef('padding', 'ui_style_padding');
  assignStyleStringOrRef('margin', 'ui_style_margin');
  assignStyleStringOrRef('alignItems', 'ui_style_align_items');
  assignStyleStringOrRef('justifyContent', 'ui_style_justify_content');
  assignStyleStringOrRef('backgroundColor', 'ui_style_background_color');
  assignStyleStringOrRef('color', 'ui_style_color');
  assignStyleStringOrRef('fontSize', 'ui_style_font_size');
  assignStyleStringOrRef('fontFamily', 'ui_style_font_family');
  assignStyleStringOrRef('fontWeight', 'ui_style_font_weight');
  assignStyleStringOrRef('flex', 'ui_style_flex');
  assignStyleStringOrRef('flexDirection', 'ui_style_flex_direction');
  assignStyleStringOrRef('textAlign', 'ui_style_text_align');

  if (Object.keys(style).length > 0) {
    props.style = { ...(props.style && typeof props.style === 'object' && !Array.isArray(props.style) ? props.style : {}), ...style };
  }
  return props;
}

function buildReadBind(def) {
  const labels = def.labels;
  const bindJson = readLabel(labels, 'ui_bind_json');
  if (bindJson && typeof bindJson === 'object' && !Array.isArray(bindJson) && bindJson.read) {
    return bindJson.read;
  }
  const readJson = readLabel(labels, 'ui_bind_read_json');
  if (readJson && typeof readJson === 'object' && !Array.isArray(readJson)) {
    return readJson;
  }
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
  const bindJson = readLabel(labels, 'ui_bind_json');
  if (bindJson && typeof bindJson === 'object' && !Array.isArray(bindJson) && bindJson.write) {
    return bindJson.write;
  }
  const writeJson = readLabel(labels, 'ui_bind_write_json');
  if (writeJson && typeof writeJson === 'object' && !Array.isArray(writeJson)) {
    return writeJson;
  }
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
  const bind = {
    action,
    target_ref: { model_id, p, r, c, k },
  };
  const valueRef = readString(labels, 'ui_write_value_ref', '');
  const valueT = readString(labels, 'ui_write_value_t', '');
  if (valueRef && valueT) {
    bind.value_ref = { t: valueT, v: { $ref: valueRef } };
  }
  return bind;
}

function buildNodeMap(defs, modelId) {
  const map = new Map();
  for (const def of defs) {
    const bindJson = readLabel(def.labels, 'ui_bind_json');
    const cellCoord = parseCellCoord(def.coord);
    const bind = (() => {
      if (bindJson && typeof bindJson === 'object' && !Array.isArray(bindJson)) {
        return bindJson;
      }
      const read = buildReadBind(def);
      const write = buildWriteBind(def);
      if (!read && !write) return undefined;
      const nextBind = {};
      if (read) nextBind.read = read;
      if (write) nextBind.write = write;
      return nextBind;
    })();
    map.set(def.id, {
      id: def.id,
      type: def.type,
      props: buildProps(def),
      bind,
      __parent: def.parent,
      __slot: def.slot,
      __order: def.order,
      ...(cellCoord ? {
        cell_ref: {
          model_id: modelId,
          p: cellCoord.p,
          r: cellCoord.r,
          c: cellCoord.c,
        },
      } : {}),
      ...(bind && bind.write ? { writable_pins: buildWritablePins(def.type, bind.write) } : {}),
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
  if (node.cell_ref) out.cell_ref = node.cell_ref;
  if (Array.isArray(node.writable_pins) && node.writable_pins.length > 0) out.writable_pins = node.writable_pins;
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
  const nodes = buildNodeMap(defs, modelId);
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
