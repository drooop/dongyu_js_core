import { createRenderer } from '../packages/ui-renderer/src/index.js';
import crypto from 'node:crypto';
import {
  THREE_SCENE_CHILD_MODEL_ID,
  THREE_SCENE_COMPONENT_TYPE,
  THREE_SCENE_CREATE_ENTITY_ACTION,
  THREE_SCENE_DELETE_ENTITY_ACTION,
  THREE_SCENE_SELECT_ENTITY_ACTION,
  THREE_SCENE_UPDATE_ENTITY_ACTION,
} from '../packages/ui-model-demo-frontend/src/model_ids.js';

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
      '-1': {
        id: -1,
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

function buildThreeSceneSnapshot() {
  return {
    models: {
      [String(THREE_SCENE_CHILD_MODEL_ID)]: {
        id: THREE_SCENE_CHILD_MODEL_ID,
        cells: {
          '0,0,0': {
            p: 0,
            r: 0,
            c: 0,
            labels: {
              scene_graph_v0: {
                k: 'scene_graph_v0',
                t: 'json',
                v: {
                  entities: [
                    {
                      id: 'cube-1',
                      type: 'box',
                      color: '#22c55e',
                      position: [1, 2, 3],
                      rotation: [0, 0.5, 0],
                      scale: [1, 1, 1],
                      visible: true,
                    },
                  ],
                },
              },
              camera_state_v0: {
                k: 'camera_state_v0',
                t: 'json',
                v: {
                  position: [4, 5, 6],
                  target: [0, 0, 0],
                  fov: 55,
                },
              },
              selected_entity_id: {
                k: 'selected_entity_id',
                t: 'str',
                v: 'cube-1',
              },
              scene_status: {
                k: 'scene_status',
                t: 'str',
                v: 'seeded',
              },
              scene_audit_log: {
                k: 'scene_audit_log',
                t: 'str',
                v: 'seed ready',
              },
            },
          },
        },
      },
      '-1': {
        id: -1,
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

function buildThreeSceneAst() {
  return {
    id: 'three_scene_root',
    type: 'Root',
    children: [
      {
        id: 'three_scene_host',
        type: THREE_SCENE_COMPONENT_TYPE,
        props: {
          width: '480px',
          height: '320px',
          background: '#0f172a',
          sceneGraphRef: { model_id: THREE_SCENE_CHILD_MODEL_ID, p: 0, r: 0, c: 0, k: 'scene_graph_v0' },
          cameraStateRef: { model_id: THREE_SCENE_CHILD_MODEL_ID, p: 0, r: 0, c: 0, k: 'camera_state_v0' },
          selectedEntityIdRef: { model_id: THREE_SCENE_CHILD_MODEL_ID, p: 0, r: 0, c: 0, k: 'selected_entity_id' },
          sceneStatusRef: { model_id: THREE_SCENE_CHILD_MODEL_ID, p: 0, r: 0, c: 0, k: 'scene_status' },
          auditLogRef: { model_id: THREE_SCENE_CHILD_MODEL_ID, p: 0, r: 0, c: 0, k: 'scene_audit_log' },
          actions: {
            create: THREE_SCENE_CREATE_ENTITY_ACTION,
            select: THREE_SCENE_SELECT_ENTITY_ACTION,
            update: THREE_SCENE_UPDATE_ENTITY_ACTION,
            delete: THREE_SCENE_DELETE_ENTITY_ACTION,
          },
        },
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
                  read: { model_id: -1, p: 0, r: 2, c: 0, k: 'selected_model_id' },
                  write: { action: 'label_update', target_ref: { model_id: -1, p: 0, r: 2, c: 0, k: 'selected_model_id' } },
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
                  read: { model_id: -1, p: 0, r: 2, c: 0, k: 'draft_p' },
                  write: { action: 'label_update', target_ref: { model_id: -1, p: 0, r: 2, c: 0, k: 'draft_p' } },
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
                  read: { model_id: -1, p: 0, r: 2, c: 0, k: 'draft_enabled' },
                  write: { action: 'label_update', target_ref: { model_id: -1, p: 0, r: 2, c: 0, k: 'draft_enabled' } },
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

function createHostAdapterWithUpload(snapshot, calls, uploads) {
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
    async uploadMedia(input) {
      uploads.push(input);
      return {
        uri: 'mxc://example.org/uploaded',
        name: input && input.filename ? input.filename : 'file.bin',
        size: 1,
        mime: 'application/octet-stream',
      };
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

function validateThreeScene(renderer, ast) {
  const tree = renderer.renderTree(ast);
  assert(tree.type === 'Root', 'three_scene_root_missing');
  assert(tree.children.length === 1, 'three_scene_child_missing');
  const hostNode = tree.children[0];
  assert(hostNode.type === THREE_SCENE_COMPONENT_TYPE, 'three_scene_tree_node_type_mismatch');
  assert(hostNode.props.sceneGraphRef.model_id === THREE_SCENE_CHILD_MODEL_ID, 'three_scene_scene_graph_ref_missing');
  assert(hostNode.props.actions.create === THREE_SCENE_CREATE_ENTITY_ACTION, 'three_scene_create_action_missing');

  const vnode = renderer.renderVNode(ast);
  const sceneVNode = Array.isArray(vnode.children) ? vnode.children[0] : null;
  assert(sceneVNode && sceneVNode.type === 'ThreeSceneHost', 'three_scene_vnode_host_missing');
  assert(sceneVNode.props.sceneModelId === THREE_SCENE_CHILD_MODEL_ID, 'three_scene_scene_model_id_missing');
  assert(sceneVNode.props.sceneGraph.entities[0].id === 'cube-1', 'three_scene_scene_graph_payload_missing');
  assert(sceneVNode.props.cameraState.position[2] === 6, 'three_scene_camera_state_missing');
  assert(sceneVNode.props.selectedEntityId === 'cube-1', 'three_scene_selected_entity_missing');
  assert(sceneVNode.props.sceneStatus === 'seeded', 'three_scene_status_missing');
  assert(sceneVNode.props.auditLog === 'seed ready', 'three_scene_audit_log_missing');
  assert(sceneVNode.props.actions.delete === THREE_SCENE_DELETE_ENTITY_ACTION, 'three_scene_delete_action_missing');
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
  assert(
    label.v.payload.meta
      && typeof label.v.payload.meta.op_id === 'string'
      && /^op_\d+_\d+_[0-9a-f]+$/.test(label.v.payload.meta.op_id),
    'Editor payload.meta.op_id mismatch',
  );
  assert(label.v.payload.target && label.v.payload.target.model_id === 1, 'Editor payload.target missing');

  assert(calls.length === 1, 'Editor expected add only');
  assert(calls[0].type === 'add', 'Editor expected add call');
  return { label };
}

async function validateRegistryUpload() {
  const snapshot = buildSnapshot();
  snapshot.models[-2] = {
    id: -2,
    cells: {
      '0,0,0': {
        p: 0,
        r: 0,
        c: 0,
        labels: {
          static_media_uri: { k: 'static_media_uri', t: 'str', v: '' },
          static_status: { k: 'static_status', t: 'str', v: '' },
        },
      },
    },
  };

  const calls = [];
  const uploads = [];
  const host = createHostAdapterWithUpload(snapshot, calls, uploads);
  const registry = {
    version: 'ui.component_registry.v1',
    components: {
      Root: { tree_kind: 'Root', vnode_kind: 'Root' },
      FileInput: {
        tree_kind: 'FileInput',
        vnode_kind: 'FileInput',
        events: {
          change: [
            {
              action: 'upload_media',
              result_to: { model_id: -2, p: 0, r: 0, c: 0, k: 'static_media_uri' },
              status_to: { action: 'label_update', target_ref: { model_id: -2, p: 0, r: 0, c: 0, k: 'static_status' } },
            },
          ],
        },
      },
    },
  };
  const renderer = createRenderer({ host, registry, vue: { h: (type, props, children) => ({ type, props, children }), resolveComponent: (n) => n } });
  const ast = {
    id: 'root',
    type: 'Root',
    children: [
      {
        id: 'file1',
        type: 'FileInput',
        props: {
          accept: '.zip',
          valueRef: { model_id: -2, p: 0, r: 0, c: 0, k: 'static_media_uri' },
        },
      },
    ],
  };

  const vnode = renderer.renderVNode(ast);
  const stack = [vnode];
  let inputVNode = null;
  while (stack.length > 0) {
    const cur = stack.pop();
    if (!cur || typeof cur !== 'object') continue;
    if (cur.type === 'input' && cur.props && typeof cur.props.onChange === 'function') {
      inputVNode = cur;
      break;
    }
    const children = Array.isArray(cur.children) ? cur.children : (cur.children && typeof cur.children === 'object' ? Object.values(cur.children) : []);
    for (const child of children) stack.push(child);
  }
  assert(inputVNode && inputVNode.props && typeof inputVNode.props.onChange === 'function', 'registry_upload:file_onChange_missing');

  const fakeFile = { name: 'demo.zip', type: 'application/zip', size: 1 };
  await inputVNode.props.onChange({ target: { files: [fakeFile] } });

  assert(uploads.length === 1, 'registry_upload:upload_not_called');
  const mailboxWrites = calls.filter((x) => x.type === 'add' && x.label && x.label.k === 'ui_event');
  assert(mailboxWrites.length >= 1, 'registry_upload:no_mailbox_write');
  const uriWrite = mailboxWrites.find((x) => x.label && x.label.v && x.label.v.payload && x.label.v.payload.target && x.label.v.payload.target.k === 'static_media_uri');
  assert(Boolean(uriWrite), 'registry_upload:uri_target_missing');
  assert(uriWrite.label.v.payload.value && uriWrite.label.v.payload.value.v === 'mxc://example.org/uploaded', 'registry_upload:mxc_uri_mismatch');
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
  const cases = args.case === 'all'
    ? ['render_minimal', 'event_write', 'render_extension', 'editor', 'registry_upload', 'three_scene']
    : [args.case];

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
    } else if (name === 'registry_upload') {
      await validateRegistryUpload();
      results.push({ case: name, status: 'PASS' });
    } else if (name === 'three_scene') {
      const threeSnapshot = buildThreeSceneSnapshot();
      const threeHost = createHostAdapter(threeSnapshot, []);
      const threeRenderer = createRenderer({
        host: threeHost,
        vue: {
          h: (type, props, children) => ({ type, props, children }),
          resolveComponent: (name) => name,
        },
      });
      validateThreeScene(threeRenderer, buildThreeSceneAst());
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
