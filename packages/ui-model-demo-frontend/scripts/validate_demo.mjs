import { createRenderer } from '../../ui-renderer/src/index.js';
import { createDemoStore, buildDemoAstSample } from '../src/demo_modeltable.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function findFirstNode(tree, type) {
  if (!tree) return null;
  if (tree.type === type) return tree;
  const children = tree.children || [];
  for (const child of children) {
    const found = findFirstNode(child, type);
    if (found) return found;
  }
  return null;
}

function getFirstTextValue(tree) {
  const textNode = findFirstNode(tree, 'Text') || findFirstNode(tree, 'CodeBlock');
  return textNode ? textNode.text : null;
}

function createHost(store, calls) {
  return {
    getSnapshot: () => store.snapshot,
    dispatchAddLabel: (label) => {
      calls.push({ type: 'add', label });
      store.dispatchAddLabel(label);
    },
    dispatchRmLabel: (labelRef) => {
      calls.push({ type: 'rm', labelRef });
      store.dispatchRmLabel(labelRef);
    },
  };
}

function run() {
  const store = createDemoStore();
  const calls = [];
  const host = createHost(store, calls);
  const renderer = createRenderer({ host });

  const ast = store.getUiAst();
  assert(ast && ast.type === 'Root', 'demo_ast_entry: missing root');
  const astLabel = store.snapshot.models[0].cells['0,0,0'].labels.ui_ast_v0;
  assert(astLabel && astLabel.t === 'json', 'demo_ast_entry: ui_ast_v0 t must be json');
  assert(astLabel && astLabel.v && typeof astLabel.v === 'object' && !Array.isArray(astLabel.v), 'demo_ast_entry: ui_ast_v0 v must be object');

  const tree = renderer.renderTree(ast);
  const textNode = findFirstNode(tree, 'Text');
  assert(textNode && textNode.text === 'ModelTable', 'demo_bind_read_text: Text bind.read mismatch');
  const inputNodeTree = findFirstNode(tree, 'Input');
  assert(inputNodeTree && inputNodeTree.value === 'Hello', 'demo_bind_read_input: Input bind.read mismatch');
  assert(findFirstNode(tree, 'Input'), 'demo_render_smoke: missing Input');
  assert(findFirstNode(tree, 'Button'), 'demo_render_smoke: missing Button');
  assert(findFirstNode(tree, 'Card'), 'demo_render_smoke: missing Card');

  const beforeText = getFirstTextValue(tree);
  const altAst = buildDemoAstSample();
  altAst.children[0].children[0].children[0] = {
    id: 'alt_text',
    type: 'Text',
    props: { text: 'Alt' },
  };
  store.setUiAst(altAst);
  const tree2 = renderer.renderTree(store.getUiAst());
  const afterText = getFirstTextValue(tree2);
  assert(beforeText !== afterText, 'demo_ast_diff: AST replacement did not change render');
  assert(afterText === 'Alt', 'demo_ast_diff: expected Alt text');

  const inputNode = findFirstNode(ast, 'Input');
  const label = renderer.dispatchEvent(inputNode, { value: 'Z' });
  assert(label && label.t === 'event', 'demo_event_mailbox: label.t must be event');
  assert(label.p === 0 && label.r === 0 && label.c === 1, 'demo_event_mailbox: mailbox coords mismatch');
  assert(label.k === 'ui_event', 'demo_event_mailbox: mailbox key mismatch');

  const envelope = label.v;
  assert(envelope && envelope.event_id, 'demo_event_envelope: event_id missing');
  assert(envelope.type === inputNode.bind.write.event_type, 'demo_event_envelope: type mismatch');
  assert(envelope.source && envelope.source.node_id === inputNode.id, 'demo_event_envelope: source.node_id mismatch');
  assert(envelope.source && envelope.source.node_type === inputNode.type, 'demo_event_envelope: source.node_type mismatch');

  const nonEventWrite = calls.find((call) => call.type === 'add' && call.label && call.label.t !== 'event');
  assert(!nonEventWrite, 'demo_no_non_event_write: non-event write detected');

  const results = [
    'demo_ast_label_shape: PASS',
    'demo_ast_entry: PASS',
    'demo_render_smoke: PASS',
    'demo_event_mailbox: PASS',
    'demo_event_envelope: PASS',
    'demo_no_non_event_write: PASS',
    'demo_ast_diff: PASS',
  ];
  process.stdout.write(results.join('\n'));
  process.stdout.write('\n');
}

try {
  run();
  process.exit(0);
} catch (err) {
  process.stderr.write(`FAIL: ${err.message}\n`);
  process.exit(1);
}
