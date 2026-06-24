#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  HOST_TABLE_ID,
  modelRefKey,
  normalizeLabelRef,
  normalizeModelRef,
} from '../../packages/ui-model-demo-frontend/src/model_ref.js';
import { getSnapshotLabelValue } from '../../packages/ui-model-demo-frontend/src/snapshot_utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const require = createRequire(import.meta.url);
const { createRenderer: createCjsRenderer } = require(path.join(repoRoot, 'packages/ui-renderer/src/index.js'));

async function rendererVariants() {
  const esm = await import(new URL('../../packages/ui-renderer/src/index.mjs', import.meta.url));
  return [
    { name: 'cjs', createRenderer: createCjsRenderer },
    { name: 'esm', createRenderer: esm.createRenderer },
  ];
}

function fakeH(type, props, children) {
  let normalized = children;
  if (children && typeof children === 'object' && typeof children.default === 'function') {
    normalized = children.default();
  }
  return { type, props: props || {}, children: normalized };
}

function fakeResolve(name) {
  return name;
}

function flattenText(node) {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join('');
  if (typeof node === 'object') return flattenText(node.children);
  return '';
}

function walk(node, visitor) {
  if (!node) return;
  visitor(node);
  const children = Array.isArray(node.children) ? node.children : [node.children];
  for (const child of children) {
    if (child && typeof child === 'object') walk(child, visitor);
  }
}

function findButtonByText(root, text) {
  let found = null;
  walk(root, (node) => {
    if (found) return;
    if ((node.type === 'button' || node.type === 'ElButton') && flattenText(node).includes(text)) {
      found = node;
    }
  });
  return found;
}

function label(k, t, v) {
  return { k, t, v };
}

function tableModel(modelId, value) {
  return {
    id: modelId,
    cells: {
      '0,0,0': {
        p: 0,
        r: 0,
        c: 0,
        labels: {
          draft_title: label('draft_title', 'str', value),
        },
      },
    },
  };
}

function tableQualifiedSnapshot() {
  return {
    tables: {
      host: {
        table_id: 'host',
        models: {
          '1087': tableModel(1087, 'host title'),
        },
      },
      'app:todo-alpha': {
        table_id: 'app:todo-alpha',
        models: {
          '1087': tableModel(1087, 'app title'),
        },
      },
    },
    models: {
      '1087': tableModel(1087, 'legacy host title'),
    },
  };
}

function test_model_ref_normalization() {
  assert.deepEqual(
    normalizeModelRef(1087),
    { table_id: HOST_TABLE_ID, model_id: 1087 },
    'numeric host model refs must normalize to explicit host ModelRef',
  );
  assert.deepEqual(
    normalizeModelRef({ table_id: 'app:todo-alpha', model_id: 1087 }),
    { table_id: 'app:todo-alpha', model_id: 1087 },
    'explicit App ModelRef must be preserved',
  );
  assert.notEqual(
    modelRefKey({ table_id: 'app:todo-alpha', model_id: 1 }),
    modelRefKey({ table_id: 'app:todo-beta', model_id: 1 }),
    'same local model_id in different App tables must have different keys',
  );
  assert.deepEqual(
    normalizeLabelRef(
      { p: 0, r: 0, c: 0, k: 'draft_title' },
      { currentModelRef: { table_id: 'app:todo-alpha', model_id: 1087 } },
    ),
    { table_id: 'app:todo-alpha', model_id: 1087, p: 0, r: 0, c: 0, k: 'draft_title' },
    'local label refs may omit table_id/model_id only with current ModelRef context',
  );
  assert.throws(
    () => normalizeLabelRef({ p: 0, r: 0, c: 0, k: 'draft_title' }, { allowBareHost: false }),
    /current_model_ref_required|table_id_required|model_id_required/,
    'local label refs without current ModelRef must not silently fall back to host/global ids',
  );
  assert.throws(
    () => normalizeModelRef({ table_id: '   ', model_id: 1087 }),
    /table_id_required/,
    'explicit blank table_id must fail instead of falling back to host',
  );
  assert.throws(
    () => normalizeLabelRef(
      { table_id: 'host', p: 0, r: 0, c: 0, k: 'draft_title' },
      { currentModelRef: { table_id: 'app:todo-alpha', model_id: 1087 } },
    ),
    /model_id_required/,
    'explicit cross-table label refs must include table-local model_id',
  );
  assert.throws(
    () => normalizeLabelRef(
      { table_id: 'host', model_id: '   ', p: 0, r: 0, c: 0, k: 'draft_title' },
      { currentModelRef: { table_id: 'app:todo-alpha', model_id: 1087 } },
    ),
    /model_id_required/,
    'explicit cross-table label refs with invalid model_id must fail instead of borrowing current model_id',
  );
  assert.throws(
    () => normalizeLabelRef(
      { model_id: 'x', p: 0, r: 0, c: 0, k: 'draft_title' },
      { currentModelRef: { table_id: 'app:todo-alpha', model_id: 1087 } },
    ),
    /model_id_required/,
    'explicit invalid model_id must fail instead of being treated as an omitted local model_id',
  );
  return { key: 'model_ref_normalization', status: 'PASS' };
}

function test_snapshot_label_reads_are_table_qualified() {
  const snapshot = tableQualifiedSnapshot();
  assert.equal(
    getSnapshotLabelValue(snapshot, {
      table_id: 'app:todo-alpha',
      model_id: 1087,
      p: 0,
      r: 0,
      c: 0,
      k: 'draft_title',
    }),
    'app title',
    'explicit App table ref must read from App table, not host/global model_id',
  );
  assert.equal(
    getSnapshotLabelValue(snapshot, {
      table_id: 'host',
      model_id: 1087,
      p: 0,
      r: 0,
      c: 0,
      k: 'draft_title',
    }),
    'host title',
    'explicit host ref must read from host table',
  );
  return { key: 'snapshot_label_reads_are_table_qualified', status: 'PASS' };
}

async function test_renderer_local_label_uses_current_table_context() {
  const snapshot = tableQualifiedSnapshot();
  for (const variant of await rendererVariants()) {
    const calls = [];
    const host = {
      getSnapshot: () => snapshot,
      dispatchAddLabel: (labelValue) => calls.push(labelValue),
      dispatchRmLabel: () => {},
    };
    const renderer = variant.createRenderer({ host, vue: { h: fakeH, resolveComponent: fakeResolve } });
    const button = renderer.renderVNode({
      id: `${variant.name}_save_task`,
      type: 'Button',
      cell_ref: { table_id: 'app:todo-alpha', model_id: 1087, p: 2, r: 1, c: 0 },
      props: { label: 'Save' },
      bind: {
        write: {
          bus_event_v2: true,
          bus_in_key: 'submit_request',
          value_ref: [
            { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'ui_event.v1' },
            { id: 0, p: 0, r: 0, c: 0, k: 'draft_title', t: 'str', v: { $label: { p: 0, r: 0, c: 0, k: 'draft_title' } } },
          ],
        },
      },
    });
    const vnode = findButtonByText(button, 'Save');
    assert.ok(vnode, `${variant.name}: test fixture must render a clickable button`);
    vnode.props.onClick();
    const record = calls.at(-1)?.v?.value?.find((item) => item && item.k === 'draft_title');
    assert.equal(
      record?.v,
      'app title',
      `${variant.name}: renderer must resolve local $label against current App table, not host/global model_id`,
    );
  }
  return { key: 'renderer_local_label_uses_current_table_context', status: 'PASS' };
}

async function test_renderer_rejects_invalid_current_table_context() {
  const snapshot = tableQualifiedSnapshot();
  for (const variant of await rendererVariants()) {
    const host = {
      getSnapshot: () => snapshot,
      dispatchAddLabel: () => {},
      dispatchRmLabel: () => {},
    };
    const renderer = variant.createRenderer({ host, vue: { h: fakeH, resolveComponent: fakeResolve } });
    const invalidCurrent = renderer.renderVNode({
      id: `${variant.name}_invalid_current_table`,
      type: 'Text',
      cell_ref: { table_id: '   ', model_id: 1087, p: 2, r: 2, c: 0 },
      bind: { read: { p: 0, r: 0, c: 0, k: 'draft_title' } },
    });
    assert.equal(
      flattenText(invalidCurrent),
      '',
      `${variant.name}: invalid current table context must not silently read from host/global model_id`,
    );

    const bareCurrent = renderer.renderVNode({
      id: `${variant.name}_bare_current_model`,
      type: 'Text',
      cell_ref: { model_id: 1087, p: 2, r: 4, c: 0 },
      bind: { read: { p: 0, r: 0, c: 0, k: 'draft_title' } },
    });
    assert.equal(
      flattenText(bareCurrent),
      '',
      `${variant.name}: local $label must require explicit current table context and must not read host/global from bare cell_ref`,
    );

    const invalidCrossModel = renderer.renderVNode({
      id: `${variant.name}_invalid_cross_model`,
      type: 'Text',
      cell_ref: { table_id: 'app:todo-alpha', model_id: 1087, p: 2, r: 3, c: 0 },
      bind: { read: { table_id: 'host', model_id: '   ', p: 0, r: 0, c: 0, k: 'draft_title' } },
    });
    assert.equal(
      flattenText(invalidCrossModel),
      '',
      `${variant.name}: invalid explicit cross-table model_id must not borrow current model_id or read host`,
    );
  }
  return { key: 'renderer_rejects_invalid_current_table_context', status: 'PASS' };
}

const results = [
  test_model_ref_normalization(),
  test_snapshot_label_reads_are_table_qualified(),
  await test_renderer_local_label_uses_current_table_context(),
  await test_renderer_rejects_invalid_current_table_context(),
];

console.log(JSON.stringify({ ok: true, results }, null, 2));
