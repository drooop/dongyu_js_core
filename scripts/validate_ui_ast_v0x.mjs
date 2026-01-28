import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = { case: 'all' };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--case') {
      args.case = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function listJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const names = fs.readdirSync(dir);
  return names
    .filter((n) => n.endsWith('.json'))
    .map((n) => path.join(dir, n))
    .sort();
}

function readJson(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(text);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

const BANNED_KEYS = new Set(['script', 'expr', 'handler', 'function']);

function scanBannedKeys(value, where) {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      scanBannedKeys(value[i], `${where}[${i}]`);
    }
    return;
  }
  if (!isPlainObject(value)) return;
  for (const [k, v] of Object.entries(value)) {
    if (BANNED_KEYS.has(k)) {
      throw new Error(`banned_key:${k} at ${where}`);
    }
    scanBannedKeys(v, `${where}.${k}`);
  }
}

const NODE_TYPES = new Set([
  'Root',
  'Container',
  'Card',
  'Text',
  'CodeBlock',
  'Input',
  'Button',
  'Table',
  'Tree',
  'Form',
  'FormItem',
]);

function validateLabelRef(ref, where, { allowMissingModelId, allowMissingK }) {
  assert(isPlainObject(ref), `${where}:ref_not_object`);
  const allowedKeys = new Set(['model_id', 'p', 'r', 'c', 'k']);
  for (const k of Object.keys(ref)) {
    assert(allowedKeys.has(k), `${where}:unknown_key:${k}`);
  }
  if (!allowMissingModelId || Object.prototype.hasOwnProperty.call(ref, 'model_id')) {
    assert(Number.isInteger(ref.model_id), `${where}:model_id_not_int`);
  }
  assert(Number.isInteger(ref.p), `${where}:p_not_int`);
  assert(Number.isInteger(ref.r), `${where}:r_not_int`);
  assert(Number.isInteger(ref.c), `${where}:c_not_int`);
  if (!allowMissingK || Object.prototype.hasOwnProperty.call(ref, 'k')) {
    assert(typeof ref.k === 'string' && ref.k.length > 0, `${where}:k_not_string`);
  }
}

function validateEditorWrite(write, where) {
  assert(typeof write.action === 'string' && write.action.length > 0, `${where}:action_missing`);
  const allowedActions = new Set(['label_add', 'label_update', 'label_remove', 'cell_clear', 'submodel_create']);
  assert(allowedActions.has(write.action), `${where}:action_invalid`);

  const allowedKeys = new Set(['action', 'target_ref', 'value_ref']);
  for (const k of Object.keys(write)) {
    assert(allowedKeys.has(k), `${where}:unknown_key:${k}`);
  }

  if (write.action !== 'submodel_create') {
    assert(isPlainObject(write.target_ref), `${where}:target_ref_missing`);
    validateLabelRef(write.target_ref, `${where}.target_ref`, {
      allowMissingModelId: false,
      allowMissingK: write.action === 'cell_clear',
    });
  }

  if (write.action === 'submodel_create') {
    assert(isPlainObject(write.value_ref), `${where}:value_ref_missing`);
    assert(write.value_ref.t === 'json', `${where}:submodel_create_value_t_must_be_json`);
  }

  if (Object.prototype.hasOwnProperty.call(write, 'value_ref')) {
    assert(isPlainObject(write.value_ref), `${where}:value_ref_not_object`);
    const valueKeys = new Set(['t', 'v']);
    for (const k of Object.keys(write.value_ref)) {
      assert(valueKeys.has(k), `${where}:value_ref_unknown_key:${k}`);
    }
    assert(typeof write.value_ref.t === 'string' && write.value_ref.t.length > 0, `${where}:value_ref_t_missing`);
  }
}

function validateLegacyWrite(write, where) {
  assert(isPlainObject(write.target), `${where}:legacy_target_missing`);
  validateLabelRef({ ...write.target, model_id: 0 }, `${where}.target`, { allowMissingModelId: false, allowMissingK: false });
  assert(typeof write.event_type === 'string' && write.event_type.length > 0, `${where}:legacy_event_type_missing`);
}

function validateBind(bind, where) {
  assert(isPlainObject(bind), `${where}:bind_not_object`);
  const allowedKeys = new Set(['read', 'write']);
  for (const k of Object.keys(bind)) {
    assert(allowedKeys.has(k), `${where}:unknown_key:${k}`);
  }
  if (bind.read !== undefined) {
    validateLabelRef(bind.read, `${where}.read`, { allowMissingModelId: true, allowMissingK: false });
  }
  if (bind.write !== undefined) {
    assert(isPlainObject(bind.write), `${where}.write:not_object`);
    if (Object.prototype.hasOwnProperty.call(bind.write, 'action')) {
      validateEditorWrite(bind.write, `${where}.write`);
    } else {
      validateLegacyWrite(bind.write, `${where}.write`);
    }
  }
}

function validateNode(node, where) {
  assert(isPlainObject(node), `${where}:node_not_object`);
  const allowedKeys = new Set(['id', 'type', 'props', 'children', 'bind']);
  for (const k of Object.keys(node)) {
    assert(allowedKeys.has(k), `${where}:unknown_key:${k}`);
  }
  assert(typeof node.id === 'string' && node.id.length > 0, `${where}:id_missing`);
  assert(typeof node.type === 'string' && NODE_TYPES.has(node.type), `${where}:type_invalid`);

  if (Object.prototype.hasOwnProperty.call(node, 'props')) {
    assert(node.props === undefined || isPlainObject(node.props), `${where}:props_not_object`);
  }
  if (Object.prototype.hasOwnProperty.call(node, 'children')) {
    assert(node.children === undefined || Array.isArray(node.children), `${where}:children_not_array`);
  }
  if (Object.prototype.hasOwnProperty.call(node, 'bind')) {
    assert(node.bind === undefined || isPlainObject(node.bind), `${where}:bind_not_object`);
    if (node.bind) validateBind(node.bind, `${where}.bind`);
  }

  const children = node.children || [];
  for (let i = 0; i < children.length; i += 1) {
    validateNode(children[i], `${where}.children[${i}]`);
  }
}

function validateAst(ast) {
  scanBannedKeys(ast, 'ast');
  validateNode(ast, 'ast');
  assert(ast.type === 'Root', 'ast:root_type_must_be_Root');
}

function runCase(filePath, shouldAccept) {
  const ast = readJson(filePath);
  let accepted = false;
  try {
    validateAst(ast);
    accepted = true;
  } catch (err) {
    accepted = false;
    if (shouldAccept) {
      throw err;
    }
  }
  if (shouldAccept) {
    assert(accepted === true, 'expected accepted');
  } else {
    assert(accepted === false, 'expected rejected');
  }
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const root = process.cwd();
  const posDir = path.join(root, 'scripts', 'fixtures', 'ui_ast_v0x', 'positive');
  const negDir = path.join(root, 'scripts', 'fixtures', 'ui_ast_v0x', 'negative');

  const positive = listJsonFiles(posDir);
  const negative = listJsonFiles(negDir);
  const all = [];

  for (const f of positive) all.push({ file: f, accept: true });
  for (const f of negative) all.push({ file: f, accept: false });

  const selected = args.case === 'all'
    ? all
    : all.filter((c) => path.basename(c.file, '.json') === args.case);

  assert(selected.length > 0, `no cases matched: ${args.case}`);

  const results = [];
  for (const c of selected) {
    const name = path.basename(c.file, '.json');
    runCase(c.file, c.accept);
    results.push({ name, status: 'PASS', note: c.accept ? 'accepted' : 'rejected' });
    console.log(`case:${name}: PASS (${c.accept ? 'accepted' : 'rejected'})`);
  }

  console.log('summary: PASS');
}

run().catch((err) => {
  console.error(String(err && err.message ? err.message : err));
  process.exit(1);
});
