import { createRenderer } from '../packages/ui-renderer/src/index.js';

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
  const cases = args.case === 'all' ? ['render_minimal', 'event_write'] : [args.case];

  for (const name of cases) {
    if (name === 'render_minimal') {
      validateRenderMinimal(renderer, ast);
      results.push({ case: name, status: 'PASS' });
    } else if (name === 'event_write') {
      validateEventWrite(renderer, ast, calls);
      results.push({ case: name, status: 'PASS' });
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
