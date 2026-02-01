import { createGalleryStore } from '../src/gallery_store.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function walk(ast, fn) {
  if (!ast || typeof ast !== 'object') return;
  fn(ast);
  const children = Array.isArray(ast.children) ? ast.children : [];
  for (const child of children) {
    walk(child, fn);
  }
}

function findNodeById(ast, id) {
  let found = null;
  walk(ast, (n) => {
    if (found) return;
    if (n && n.id === id) found = n;
  });
  return found;
}

function collectTypes(ast) {
  const types = new Set();
  walk(ast, (n) => {
    if (n && typeof n.type === 'string') types.add(n.type);
  });
  return types;
}

try {
  const store = createGalleryStore();
  const ast = store.getUiAst();

  assert(ast && typeof ast === 'object', 'gallery_ast_missing');
  assert(ast.type === 'Root', 'gallery_ast_root_type');

  const title = findNodeById(ast, 'title');
  assert(title && title.type === 'Text', 'gallery_title_node_missing');
  assert(title.props && title.props.text === 'Gallery', 'gallery_title_text');

  // AppShell provides the global header navigation.

  // Wave A controls exist.
  assert(findNodeById(ast, 'wave_a_checkbox')?.type === 'Checkbox', 'wave_a_checkbox_missing');
  assert(findNodeById(ast, 'wave_a_radio')?.type === 'RadioGroup', 'wave_a_radio_group_missing');
  assert(findNodeById(ast, 'wave_a_slider')?.type === 'Slider', 'wave_a_slider_missing');

  // Wave B controls exist.
  assert(findNodeById(ast, 'wave_b_datepicker')?.type === 'DatePicker', 'wave_b_datepicker_missing');
  assert(findNodeById(ast, 'wave_b_timepicker')?.type === 'TimePicker', 'wave_b_timepicker_missing');
  assert(findNodeById(ast, 'wave_b_tabs')?.type === 'Tabs', 'wave_b_tabs_missing');
  assert(findNodeById(ast, 'wave_b_dialog')?.type === 'Dialog', 'wave_b_dialog_missing');
  assert(findNodeById(ast, 'wave_b_pagination')?.type === 'Pagination', 'wave_b_pagination_missing');

  // Wave C composition.
  assert(findNodeById(ast, 'wave_c_include_static_a')?.type === 'Include', 'wave_c_include_static_a_missing');
  assert(findNodeById(ast, 'wave_c_include_static_b')?.type === 'Include', 'wave_c_include_static_b_missing');
  assert(findNodeById(ast, 'wave_c_submodel_create')?.type === 'Button', 'wave_c_submodel_create_missing');
  assert(findNodeById(ast, 'wave_c_include_submodel')?.type === 'Include', 'wave_c_include_submodel_missing');

  const types = collectTypes(ast);
  for (const required of ['Container', 'Card', 'Text', 'Button', 'Checkbox', 'RadioGroup', 'Slider', 'DatePicker', 'TimePicker', 'Tabs', 'Dialog', 'Pagination', 'Include']) {
    assert(types.has(required), `gallery_missing_type:${required}`);
  }

  console.log('validate_gallery_ast: PASS');
  process.exit(0);
} catch (err) {
  console.error('validate_gallery_ast: FAIL');
  console.error(err && err.message ? err.message : String(err));
  process.exit(1);
}
