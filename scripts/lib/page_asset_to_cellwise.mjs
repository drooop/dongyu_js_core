function addLabel(records, modelId, p, r, c, k, t, v) {
  records.push({ op: 'add_label', model_id: modelId, p, r, c, k, t, v });
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function visitAst(node, parentId, order, out) {
  if (!node || typeof node !== 'object') return;
  out.push({
    id: String(node.id),
    type: String(node.type),
    parent: parentId ? String(parentId) : '',
    order,
    slot: typeof node.slot === 'string' ? node.slot : '',
    props: isPlainObject(node.props) ? node.props : null,
    bind: isPlainObject(node.bind) ? node.bind : null,
  });
  const children = Array.isArray(node.children) ? node.children : [];
  children.forEach((child, index) => visitAst(child, node.id, index * 10 + 10, out));
}

export function convertPageAssetAstToCellwiseRecords({ modelId, ast, plane = 2 }) {
  if (!Number.isInteger(modelId)) throw new Error('modelId_required');
  if (!ast || typeof ast !== 'object' || Array.isArray(ast)) throw new Error('ast_required');
  if (typeof ast.id !== 'string' || typeof ast.type !== 'string') throw new Error('ast_identity_required');

  const defs = [];
  visitAst(ast, '', 0, defs);

  const records = [];
  addLabel(records, modelId, 0, 0, 0, 'ui_authoring_version', 'str', 'cellwise.ui.v1');
  addLabel(records, modelId, 0, 0, 0, 'ui_root_node_id', 'str', ast.id);

  defs.forEach((def, index) => {
    const row = index;
    addLabel(records, modelId, plane, row, 0, 'ui_node_id', 'str', def.id);
    addLabel(records, modelId, plane, row, 0, 'ui_component', 'str', def.type);
    if (def.parent) addLabel(records, modelId, plane, row, 0, 'ui_parent', 'str', def.parent);
    if (def.order) addLabel(records, modelId, plane, row, 0, 'ui_order', 'int', def.order);
    if (def.slot) addLabel(records, modelId, plane, row, 0, 'ui_slot', 'str', def.slot);
    if (def.props && Object.keys(def.props).length > 0) {
      addLabel(records, modelId, plane, row, 0, 'ui_props_json', 'json', def.props);
    }
    if (def.bind && Object.keys(def.bind).length > 0) {
      addLabel(records, modelId, plane, row, 0, 'ui_bind_json', 'json', def.bind);
    }
  });

  return records;
}
