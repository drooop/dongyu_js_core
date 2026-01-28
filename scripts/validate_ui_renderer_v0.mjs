import { createRenderer } from '../packages/ui-renderer/src/index.js';
import crypto from 'node:crypto';

function parseArgs(argv) {
  const args = { case: 'all', env: 'jsdom' };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--case') {
      args.case = argv[i + 1];
      i += 1;
    } else if (value === '--env') {
      args.env = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

async function setupJsdom() {
  try {
    const mod = await import('jsdom');
    const { JSDOM } = mod;
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    return { env: 'jsdom', note: 'jsdom' };
  } catch (err) {
    throw new Error('jsdom required');
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function buildSnapshot() {
  return {
    models: {
      0: {
        id: 0,
        cells: {
          '0,0,0': {
            p: 0,
            r: 0,
            c: 0,
            labels: {
              title: { k: 'title', t: 'str', v: 'Hello' },
              input_value: { k: 'input_value', t: 'str', v: 'World' },
            },
          },
        },
      },
      99: {
        id: 99,
        cells: {
          '0,0,1': {
            p: 0,
            r: 0,
            c: 1,
            labels: {
              ui_event: { k: 'ui_event', t: 'event', v: null },
            },
          },
        },
      },
    },
  };
}

function buildAst() {
  return {
    id: 'root',
    type: 'Root',
    children: [
      {
        id: 'container',
        type: 'Container',
        props: { layout: 'column', gap: 8 },
        children: [
          {
            id: 'text1',
            type: 'Text',
            bind: { read: { p: 0, r: 0, c: 0, k: 'title' } },
          },
          {
            id: 'input1',
            type: 'Input',
            bind: {
              read: { p: 0, r: 0, c: 0, k: 'input_value' },
              write: {
                target: { p: 0, r: 0, c: 0, k: 'input_event' },
                event_type: 'change',
                policy: 'clear_then_add',
              },
            },
          },
          {
            id: 'button1',
            type: 'Button',
            props: { label: 'Submit' },
            bind: {
              write: {
                target: { p: 0, r: 0, c: 0, k: 'button_event' },
                event_type: 'click',
              },
            },
          },
        ],
      },
    ],
  };
}

function buildAstExtension() {
  return {
    id: 'root',
    type: 'Root',
    children: [
      {
        id: 'card1',
        type: 'Card',
        props: { title: 'Demo' },
        children: [
          {
            id: 'code1',
            type: 'CodeBlock',
            props: { text: '{"ok":true}' },
          },
        ],
      },
    ],
  };
}

function buildEditorAst() {
  return {
    id: 'root_editor',
    type: 'Root',
    children: [
      {
        id: 'tbl',
        type: 'Table',
        props: { title: 'Cells' },
        children: [
          { id: 'col_k', type: 'TableColumn', props: { label: 'k', prop: 'k' } },
          { id: 'col_t', type: 'TableColumn', props: { label: 't', prop: 't' } },
        ],
      },
      { id: 'tree', type: 'Tree', props: { title: 'Models' } },
      {
        id: 'form',
        type: 'Form',
        children: [
          {
            id: 'fi',
            type: 'FormItem',
            props: { label: 'Add label' },
            children: [
              {
                id: 'btn_add',
                type: 'Button',
                props: { label: 'Add' },
                bind: {
                  write: {
                    action: 'label_add',
                    target_ref: { model_id: 1, p: 0, r: 0, c: 0, k: 'title' },
                    value_ref: { t: 'str', v: 'Hello' },
                  },
                },
              },
            ],
          },
          {
            id: 'fi_select',
            type: 'FormItem',
            props: { label: 'Model' },
            children: [
              {
                id: 'sel_model',
                type: 'Select',
                props: {
                  options: [
                    { label: '1', value: 1 },
                    { label: '2', value: 2 },
                  ],
                },
                bind: {
                  read: { model_id: 99, p: 0, r: 2, c: 0, k: 'selected_model_id' },
                  write: { action: 'label_update', target_ref: { model_id: 99, p: 0, r: 2, c: 0, k: 'selected_model_id' } },
                },
              },
            ],
          },
          {
            id: 'fi_num',
            type: 'FormItem',
            props: { label: 'p' },
            children: [
              {
                id: 'num_p',
                type: 'NumberInput',
                bind: {
                  read: { model_id: 99, p: 0, r: 2, c: 0, k: 'draft_p' },
                  write: { action: 'label_update', target_ref: { model_id: 99, p: 0, r: 2, c: 0, k: 'draft_p' } },
                },
              },
            ],
          },
          {
            id: 'fi_switch',
            type: 'FormItem',
            props: { label: 'Enabled' },
            children: [
              {
                id: 'sw_enabled',
                type: 'Switch',
                bind: {
                  read: { model_id: 99, p: 0, r: 2, c: 0, k: 'draft_enabled' },
                  write: { action: 'label_update', target_ref: { model_id: 99, p: 0, r: 2, c: 0, k: 'draft_enabled' } },
                },
              },
            ],
          },
        ],
      },
    ],
  };
}


function createHostAdapter(snapshot, calls) {
  return {
    getSnapshot() {
      return snapshot;
    },
    dispatchAddLabel(label) {
      calls.push({ type: 'add', label });
    },
    dispatchRmLabel(labelRef) {
      calls.push({ type: 'rm', labelRef });
    },
  };
}

function validateRenderMinimal(renderer, ast) {
  const tree = renderer.renderTree(ast);
  assert(tree.type === 'Root', 'Root node missing');
  assert(tree.children && tree.children.length === 1, 'Root children missing');
  const container = tree.children[0];
  assert(container.type === 'Container', 'Container node missing');
  assert(container.children.length === 3, 'Container children count mismatch');
  const text = container.children[0];
  assert(text.type === 'Text', 'Text node missing');
  assert(text.text === 'Hello', 'Text binding value mismatch');
  const input = container.children[1];
  assert(input.type === 'Input', 'Input node missing');
  assert(input.value === 'World', 'Input binding value mismatch');
  return { tree };
}

function validateEventWrite(renderer, ast, calls) {
  const input = ast.children[0].children[1];
  const result = renderer.dispatchEvent(input, { value: 'X' });
  assert(result && result.t === 'event', 'Event label t must be "event"');
  assert(result.k === 'input_event', 'Event label k mismatch');
  assert(result.v && result.v.type === 'change', 'Event type mismatch');
  assert(result.v.source.node_id === 'input1', 'Event source node id mismatch');
  assert(calls.length === 2, 'Expected rm + add calls');
  assert(calls[0].type === 'rm', 'First call must be rm');
  assert(calls[1].type === 'add', 'Second call must be add');
  assert(calls[1].label && calls[1].label.t === 'event', 'Dispatch add label t mismatch');
  return { calls };
}

function validateRenderExtension(renderer, ast) {
  const tree = renderer.renderTree(ast);
  assert(tree.type === 'Root', 'Extension root missing');
  const card = tree.children[0];
  assert(card.type === 'Card', 'Card node missing');
  assert(card.title === 'Demo', 'Card title mismatch');
  const code = card.children[0];
  assert(code.type === 'CodeBlock', 'CodeBlock node missing');
  assert(code.text === '{"ok":true}', 'CodeBlock text mismatch');
}

function stableHash(obj) {
  const text = JSON.stringify(obj);
  return crypto.createHash('sha256').update(text).digest('hex');
}

function validateEditorRender(renderer) {
  const ast = buildEditorAst();
  const tree = renderer.renderTree(ast);
  assert(tree.type === 'Root', 'Editor root missing');
  assert(tree.children.length === 3, 'Editor root children mismatch');
  assert(tree.children[0].type === 'Table', 'Editor Table missing');
  assert(tree.children[0].children.length === 2, 'Editor TableColumn children missing');
  assert(tree.children[1].type === 'Tree', 'Editor Tree missing');
  assert(tree.children[2].type === 'Form', 'Editor Form missing');
  return { tree };
}

function validateEditorEventMailboxOnly(renderer, calls) {
  const ast = buildEditorAst();
  const btn = ast.children[2].children[0].children[0];
  const label = renderer.dispatchEvent(btn, { value: 'ignored' });

  assert(label && label.t === 'event', 'Editor event label t must be event');
  assert(label.k === 'ui_event', 'Editor event label must write ui_event');
  assert(label.p === 0 && label.r === 0 && label.c === 1, 'Editor event label must write mailbox coords');
  assert(label.v && typeof label.v === 'object', 'Editor envelope missing');
  assert(label.v.source === 'ui_renderer', 'Editor source must be ui_renderer');
  assert(label.v.type === 'label_add', 'Editor type must equal payload.action');
  assert(Number.isInteger(label.v.event_id), 'Editor event_id must be integer');
  assert(label.v.event_id === 1, 'Editor event_id must start at 1 in test run');
  assert(label.v.payload && label.v.payload.action === 'label_add', 'Editor payload.action mismatch');
  assert(label.v.payload.meta && label.v.payload.meta.op_id === 'op_1', 'Editor payload.meta.op_id mismatch');
  assert(label.v.payload.target && label.v.payload.target.model_id === 1, 'Editor payload.target missing');

  assert(calls.length === 1, 'Editor expected add only');
  assert(calls[0].type === 'add', 'Editor expected add call');
  return { label };
}


async function run() {
  const args = parseArgs(process.argv.slice(2));
  let envNote = 'none';
  if (args.env === 'jsdom') {
    const envInfo = await setupJsdom();
    envNote = envInfo.note;
  }

  const snapshot = buildSnapshot();
  const ast = buildAst();
  const calls = [];
  const host = createHostAdapter(snapshot, calls);
  const renderer = createRenderer({ host });

  const results = [];
  const cases = args.case === 'all' ? ['render_minimal', 'event_write', 'render_extension', 'editor'] : [args.case];

  for (const name of cases) {
    if (name === 'render_minimal') {
      validateRenderMinimal(renderer, ast);
      results.push({ case: name, status: 'PASS' });
    } else if (name === 'event_write') {
      validateEventWrite(renderer, ast, calls);
      results.push({ case: name, status: 'PASS' });
    } else if (name === 'render_extension') {
      validateRenderExtension(renderer, buildAstExtension());
      results.push({ case: name, status: 'PASS' });
    } else if (name === 'editor') {
      const editorCalls = [];
      const editorHost = createHostAdapter(snapshot, editorCalls);
      const editorRenderer = createRenderer({ host: editorHost });
      const { tree } = validateEditorRender(editorRenderer);
      const hash = stableHash(tree);
      assert(typeof hash === 'string' && hash.length > 10, 'Editor snapshot hash missing');
      validateEditorEventMailboxOnly(editorRenderer, editorCalls);
      results.push({ case: 'editor_table_render', status: 'PASS' });
      results.push({ case: 'editor_tree_render', status: 'PASS' });
      results.push({ case: 'editor_form_render', status: 'PASS' });
      results.push({ case: 'editor_event_mailbox_only', status: 'PASS' });
      results.push({ case: 'editor_snapshot_hash', status: 'PASS' });
    } else {
      throw new Error(`Unknown case: ${name}`);
    }
  }

  process.stdout.write(`env: ${envNote}\n`);
  for (const row of results) {
    process.stdout.write(`${row.case}: ${row.status}\n`);
  }
}

run().catch((err) => {
  process.stderr.write(`FAIL: ${err.message}\n`);
  process.exit(1);
});
