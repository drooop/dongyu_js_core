#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs, { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadSystemPatch } from '../worker_engine_v0.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require(path.join(repoRoot, 'packages/worker-base/src/runtime.js'));
const { createRenderer: createCjsRenderer } = require(path.join(repoRoot, 'packages/ui-renderer/src/index.js'));

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
  if (node === null || node === undefined) return '';
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
    if ((node.type === 'button' || node.type === 'ElButton') && flattenText(node).includes(text)) found = node;
  });
  return found;
}

function recordsToObject(records) {
  const out = {};
  for (const record of Array.isArray(records) ? records : []) {
    if (record && record.id === 0 && record.p === 0 && record.r === 0 && record.c === 0) {
      out[record.k] = record.v;
    }
  }
  return out;
}

function collectModelIdZeroUiRefs(value, path = []) {
  const hits = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      hits.push(...collectModelIdZeroUiRefs(item, path.concat(index)));
    });
    return hits;
  }
  if (value && typeof value === 'object') {
    if (
      value.model_id === 0
      && Number.isInteger(value.p)
      && Number.isInteger(value.r)
      && Number.isInteger(value.c)
      && typeof value.k === 'string'
    ) {
      hits.push(path.join('.'));
    }
    for (const [key, child] of Object.entries(value)) {
      hits.push(...collectModelIdZeroUiRefs(child, path.concat(key)));
    }
  }
  return hits;
}

function test_developer_payload_omits_model_id_zero_placeholder() {
  const payloadPath = path.join(repoRoot, 'docs/user-guide/examples/ui_basic_filltable_validation_app_payload.json');
  const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
  const hits = [];
  for (const [index, record] of payload.entries()) {
    if (!['ui_bind_json', 'ui_bind_read_json', 'ui_props_json'].includes(record.k)) continue;
    for (const refPath of collectModelIdZeroUiRefs(record.v, [`record[${index}]`, record.k, 'v'])) {
      hits.push(refPath);
    }
  }
  assert.deepEqual(hits, [], `developer ZIP payload must omit model_id instead of using 0 as current-model placeholder: ${hits.join(', ')}`);
  return { key: 'developer_payload_omits_model_id_zero_placeholder', status: 'PASS' };
}

function test_provider_bundles_omit_model_id_zero_placeholder() {
  const bundlePath = path.join(repoRoot, 'deploy/sys-v1ns/remote-worker/patches/14_model3100_slide_app_bundle_provider.json');
  const patch = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
  const hits = [];
  for (const record of patch.records || []) {
    if (!String(record?.k || '').startsWith('bundle_payload_') || !Array.isArray(record.v)) continue;
    for (const [index, payloadRecord] of record.v.entries()) {
      if (!['ui_bind_json', 'ui_bind_read_json', 'ui_props_json'].includes(payloadRecord.k)) continue;
      for (const refPath of collectModelIdZeroUiRefs(payloadRecord.v, [record.k, `record[${index}]`, payloadRecord.k, 'v'])) {
        hits.push(refPath);
      }
    }
  }
  assert.deepEqual(hits, [], `provider bundle UI refs must omit model_id instead of using 0 as current-model placeholder: ${hits.join(', ')}`);
  return { key: 'provider_bundles_omit_model_id_zero_placeholder', status: 'PASS' };
}

function test_cross_model_refs_remain_explicit_in_proxy_payload() {
  const payloadPath = path.join(repoRoot, 'test_files/color_generator_proxy_app_payload.json');
  const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
  const findRecord = (predicate) => payload.find((record) => predicate(record)) || null;

  const colorBind = findRecord((record) => record?.k === 'ui_bind_json' && record?.v?.read?.k === 'bg_color');
  assert.equal(colorBind?.v?.read?.model_id, 100, 'color proxy must keep explicit cross-model read to Model 100');

  const inputBind = findRecord((record) => record?.k === 'ui_bind_json' && record?.v?.write?.target_ref?.k === 'model100_input_draft');
  assert.equal(inputBind?.v?.read?.model_id, -2, 'color proxy must keep explicit overlay read model');
  assert.equal(inputBind?.v?.write?.target_ref?.model_id, -2, 'color proxy must keep explicit overlay write target model');

  const submitBind = findRecord((record) => record?.k === 'ui_bind_json' && record?.v?.write?.pin === 'click');
  assert.equal(
    submitBind?.v?.write?.value_ref?.v?.input_value?.$label?.model_id,
    -2,
    'color proxy submit payload must keep explicit overlay source model',
  );

  const buttonProps = findRecord((record) => record?.k === 'ui_props_json' && record?.v?.singleFlight?.key === 'model100_submit')?.v;
  assert.equal(buttonProps?.disabled?.$label?.model_id, 100, 'color proxy disabled state must keep explicit Model 100 ref');
  assert.equal(buttonProps?.loading?.$label?.model_id, 100, 'color proxy loading state must keep explicit Model 100 ref');
  assert.equal(buttonProps?.singleFlight?.releaseRef?.model_id, -1, 'color proxy singleFlight release must keep explicit runtime model ref');
  return { key: 'cross_model_refs_remain_explicit_in_proxy_payload', status: 'PASS' };
}

function test_developer_docs_teach_current_model_ref_rule() {
  const docs = [
    fs.readFileSync(path.join(repoRoot, 'docs/user-guide/ui_model_basic_filltable_guide.md'), 'utf8'),
    fs.readFileSync(path.join(repoRoot, 'docs/user-guide/ui_components_v2.md'), 'utf8'),
  ].join('\n');
  assert.equal(docs.includes('安装器会 remap 成正式模型 id'), false, 'docs must not teach model_id:0 installer remap for current-model refs');
  assert.match(docs, /同模型引用省略 `model_id`/u, 'basic guide must teach omitted model_id for same-model refs');
  assert.match(docs, /Only cross-model references should include `model_id`/u, 'component guide must teach explicit model_id only for cross-model refs');
  assert.match(docs, /不要把 `0` 当成当前模型占位符/u, 'basic guide must warn against model_id:0 placeholder');
  return { key: 'developer_docs_teach_current_model_ref_rule', status: 'PASS' };
}

function makeSnapshot(modelId = 4321) {
  return {
    models: {
      0: {
        cells: {
          '0,0,0': {
            labels: {
              include_fragment: {
                k: 'include_fragment',
                t: 'json',
                v: {
                  id: 'wrong_include_text',
                  type: 'Text',
                  props: { text: 'wrong Model 0 include' },
                  cell_ref: { model_id: 0, p: 9, r: 9, c: 9 },
                },
              },
              current_page: { k: 'current_page', t: 'int', v: 99 },
              page_size: { k: 'page_size', t: 'int', v: 999 },
            },
          },
        },
      },
      [String(modelId)]: {
        cells: {
          '0,0,0': {
            labels: {
              draft_text: { k: 'draft_text', t: 'str', v: 'current text' },
              result_text: { k: 'result_text', t: 'str', v: '' },
              include_fragment: {
                k: 'include_fragment',
                t: 'json',
                v: {
                  id: 'current_include_text',
                  type: 'Text',
                  props: { text: 'current include text' },
                  cell_ref: { model_id: modelId, p: 3, r: 3, c: 0 },
                },
              },
              current_page: { k: 'current_page', t: 'int', v: 3 },
              page_size: { k: 'page_size', t: 'int', v: 25 },
              disabled_flag: { k: 'disabled_flag', t: 'bool', v: true },
              release_token: { k: 'release_token', t: 'str', v: 'release_1' },
              tasks_json: {
                k: 'tasks_json',
                t: 'json',
                v: [
                  { id: 'task_a', title: 'Current model task', body: 'same model ref', status: 'todo' },
                  { id: 'task_b', title: 'Filtered task', body: 'focus result', status: 'doing' },
                ],
              },
              filter_text: { k: 'filter_text', t: 'str', v: 'filtered' },
            },
          },
        },
      },
      '-2': {
        cells: {
          '0,0,0': {
            labels: {
              draft_text: { k: 'draft_text', t: 'str', v: 'wrong system text' },
              tasks_json: { k: 'tasks_json', t: 'json', v: [] },
            },
          },
        },
      },
    },
  };
}

async function rendererVariants() {
  const esm = await import(new URL('../../packages/ui-renderer/src/index.mjs', import.meta.url));
  return [
    { name: 'cjs', createRenderer: createCjsRenderer },
    { name: 'esm', createRenderer: esm.createRenderer },
  ];
}

async function test_renderer_resolves_omitted_model_id_against_current_node() {
  const modelId = 4321;
  for (const variant of await rendererVariants()) {
    const calls = [];
    const overlayCalls = [];
    let snapshot = makeSnapshot(modelId);
    const host = {
      getSnapshot: () => snapshot,
      stageOverlayValue: (payload) => overlayCalls.push({ type: 'stage', payload }),
      commitOverlayValue: (payload) => overlayCalls.push({ type: 'commit', payload }),
      dispatchAddLabel: (label) => calls.push(label),
      dispatchRmLabel: () => {},
    };
    const renderer = variant.createRenderer({ host, vue: { h: fakeH, resolveComponent: fakeResolve } });

    const input = renderer.renderVNode({
      id: `${variant.name}_current_input`,
      type: 'Input',
      cell_ref: { model_id: modelId, p: 2, r: 1, c: 0 },
      bind: {
        read: { p: 0, r: 0, c: 0, k: 'draft_text' },
        write: {
          action: 'ui_owner_label_update',
          target_ref: { p: 0, r: 0, c: 0, k: 'draft_text' },
          commit_policy: 'immediate',
        },
      },
    });
    assert.equal(input.props.modelValue, 'current text', `${variant.name}: omitted read.model_id must resolve to current UI model`);
    input.props['onUpdate:modelValue']('typed value');
    assert.deepEqual(
      calls.at(-1).v.payload.target,
      { model_id: modelId, p: 0, r: 0, c: 0, k: 'draft_text' },
      `${variant.name}: omitted target_ref.model_id must resolve to current UI model`,
    );

    const overlayInput = renderer.renderVNode({
      id: `${variant.name}_overlay_input`,
      type: 'Input',
      cell_ref: { model_id: modelId, p: 2, r: 9, c: 0 },
      bind: {
        read: { p: 0, r: 0, c: 0, k: 'draft_text' },
        write: {
          action: 'ui_owner_label_update',
          target_ref: { p: 0, r: 0, c: 0, k: 'result_text' },
          commit_policy: 'on_blur',
        },
      },
    });
    overlayInput.props['onUpdate:modelValue']('overlay text');
    assert.deepEqual(
      overlayCalls.at(-1).payload.writeTarget.target_ref,
      { model_id: modelId, p: 0, r: 0, c: 0, k: 'result_text' },
      `${variant.name}: overlay writeTarget.target_ref must resolve current model even when it differs from bind.read`,
    );

    const button = renderer.renderVNode({
      id: `${variant.name}_current_button`,
      type: 'Button',
      cell_ref: { model_id: modelId, p: 2, r: 2, c: 0 },
      props: { label: 'Submit' },
      bind: {
        write: {
          bus_event_v2: true,
          bus_in_key: 'ui_submit',
          value_ref: [
            { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'ui_event.v1' },
            { id: 0, p: 0, r: 0, c: 0, k: 'input_text', t: 'str', v: { $label: { p: 0, r: 0, c: 0, k: 'draft_text' } } },
          ],
          meta_ref: { source_text: { $label: { p: 0, r: 0, c: 0, k: 'draft_text' } } },
        },
      },
    });
    const submit = findButtonByText(button, 'Submit');
    assert.ok(submit, `${variant.name}: button must render`);
    submit.props.onClick();
    const envelope = calls.at(-1).v;
    assert.equal(envelope.type, 'bus_event_v2', `${variant.name}: button must emit bus_event_v2`);
    assert.equal(recordsToObject(envelope.value).input_text, 'current text', `${variant.name}: bus_event_v2 value_ref $label must resolve current model`);
    assert.equal(envelope.meta.source_text, 'current text', `${variant.name}: bus_event_v2 meta_ref $label must resolve current model`);
    assert.equal(
      envelope.value.every((record) => !Object.prototype.hasOwnProperty.call(record, 'model_id')),
      true,
      `${variant.name}: Temporary ModelTable records must not be mutated with model_id`,
    );

    const board = renderer.renderVNode({
      id: `${variant.name}_todo_board`,
      type: 'TodoBoard',
      cell_ref: { model_id: modelId, p: 2, r: 3, c: 0 },
      props: {
        tasksRef: { p: 0, r: 0, c: 0, k: 'tasks_json' },
        columns: [{ value: 'todo', label: 'Todo' }, { value: 'doing', label: 'Doing' }],
      },
      bind: { write: { bus_event_v2: true, bus_in_key: 'ui_submit' } },
    });
    assert.equal(flattenText(board).includes('Current model task'), true, `${variant.name}: TodoBoard tasksRef must use current model when model_id is omitted`);

    const focus = renderer.renderVNode({
      id: `${variant.name}_todo_focus`,
      type: 'TodoFocusList',
      cell_ref: { model_id: modelId, p: 2, r: 4, c: 0 },
      props: {
        tasksRef: { p: 0, r: 0, c: 0, k: 'tasks_json' },
        filterRef: { p: 0, r: 0, c: 0, k: 'filter_text' },
      },
      bind: { write: { bus_event_v2: true, bus_in_key: 'ui_submit' } },
    });
    assert.equal(flattenText(focus).includes('Filtered task'), true, `${variant.name}: TodoFocusList filterRef must use current model when model_id is omitted`);
    assert.equal(flattenText(focus).includes('Current model task'), false, `${variant.name}: TodoFocusList must apply current-model filterRef value`);

    const include = renderer.renderVNode({
      id: `${variant.name}_include`,
      type: 'Include',
      cell_ref: { model_id: modelId, p: 2, r: 5, c: 0 },
      props: { ref: { p: 0, r: 0, c: 0, k: 'include_fragment' }, fallbackText: 'fallback include' },
    });
    assert.equal(flattenText(include), 'current include text', `${variant.name}: Include.props.ref must resolve current model`);

    const pagination = renderer.renderVNode({
      id: `${variant.name}_pagination`,
      type: 'Pagination',
      cell_ref: { model_id: modelId, p: 2, r: 6, c: 0 },
      bind: {
        models: {
          currentPage: { read: { p: 0, r: 0, c: 0, k: 'current_page' } },
          pageSize: { read: { p: 0, r: 0, c: 0, k: 'page_size' } },
        },
      },
    });
    assert.equal(pagination.props.currentPage, 3, `${variant.name}: Pagination currentPage must resolve current model`);
    assert.equal(pagination.props.pageSize, 25, `${variant.name}: Pagination pageSize must resolve current model`);

    const disabledButton = renderer.renderVNode({
      id: `${variant.name}_disabled_button`,
      type: 'Button',
      cell_ref: { model_id: modelId, p: 2, r: 7, c: 0 },
      props: { label: 'Disabled', disabledRef: { p: 0, r: 0, c: 0, k: 'disabled_flag' } },
      bind: { write: { action: 'ui_owner_label_update', target_ref: { p: 0, r: 0, c: 0, k: 'result_text' } } },
    });
    assert.equal(disabledButton.props.disabled, true, `${variant.name}: Button.disabledRef must resolve current model`);

    const singleFlightButton = {
      id: `${variant.name}_single_flight_button`,
      type: 'Button',
      cell_ref: { model_id: modelId, p: 2, r: 8, c: 0 },
      props: {
        label: 'SingleFlight',
        singleFlight: {
          key: `${variant.name}_single_flight`,
          releaseRef: { p: 0, r: 0, c: 0, k: 'release_token' },
        },
      },
      bind: { write: { action: 'ui_owner_label_update', target_ref: { p: 0, r: 0, c: 0, k: 'result_text' } } },
    };
    const firstFlight = renderer.renderVNode(singleFlightButton);
    findButtonByText(firstFlight, 'SingleFlight').props.onClick();
    snapshot = makeSnapshot(modelId);
    snapshot.models[String(modelId)].cells['0,0,0'].labels.release_token = { k: 'release_token', t: 'str', v: 'release_2' };
    const secondFlight = renderer.renderVNode(singleFlightButton);
    assert.equal(secondFlight.props.loading, false, `${variant.name}: singleFlight.releaseRef must release pending state using current model`);
    assert.equal(secondFlight.props.disabled, undefined, `${variant.name}: released singleFlight button must not remain disabled`);
  }

  return { key: 'renderer_resolves_omitted_model_id_against_current_node', status: 'PASS' };
}

async function test_bus_event_v2_reaches_model0_pin_with_resolved_payload() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'dy-0407-current-model-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0407_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = path.join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = path.join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = path.join(tempRoot, 'static');
  process.env.DY_UI_SERVER_WORKER_ID = 'U1';
  try {
    const runtime = new ModelTableRuntime();
    loadSystemPatch(runtime);
    const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
    const state = createServerState({ dbPath: null });
    await state.activateRuntimeMode('running');

    const modelId = 4321;
    const model = state.runtime.createModel({ id: modelId, name: 'Current Ref Test', type: 'app' });
    state.runtime.addLabel(model, 0, 0, 0, { k: 'model_type', t: 'model.table', v: 'UI.CurrentRefTest' });
    state.runtime.addLabel(model, 0, 0, 0, { k: 'ui_authoring_version', t: 'str', v: 'cellwise.ui.v1' });
    state.runtime.addLabel(model, 0, 0, 0, { k: 'ui_root_node_id', t: 'str', v: 'root' });
    state.runtime.addLabel(model, 0, 0, 0, { k: 'draft_text', t: 'str', v: 'server text' });

    const calls = [];
    const host = {
      getSnapshot: () => state.runtime.snapshot(),
      dispatchAddLabel: (label) => calls.push(label),
      dispatchRmLabel: () => {},
    };
    const renderer = createCjsRenderer({ host, vue: { h: fakeH, resolveComponent: fakeResolve } });
    const button = renderer.renderVNode({
      id: 'server_button',
      type: 'Button',
      cell_ref: { model_id: modelId, p: 2, r: 1, c: 0 },
      props: { label: 'Send' },
      bind: {
        write: {
          bus_event_v2: true,
          bus_in_key: 'ui_submit',
          value_ref: [
            { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'ui_event.v1' },
            { id: 0, p: 0, r: 0, c: 0, k: 'input_text', t: 'str', v: { $label: { p: 0, r: 0, c: 0, k: 'draft_text' } } },
          ],
          meta_ref: { source_text: { $label: { p: 0, r: 0, c: 0, k: 'draft_text' } } },
        },
      },
    });
    findButtonByText(button, 'Send').props.onClick();
    const envelope = calls.at(-1).v;
    const result = await state.submitEnvelope(envelope);
    assert.equal(result.result, 'ok', 'bus_event_v2 must be accepted by server');
    assert.equal(result.routed_by, 'model0_busin', 'bus_event_v2 must enter through Model 0 bus boundary');
    const model0 = state.runtime.getModel(0);
    const busLabel = state.runtime.getCell(model0, 0, 0, 0).labels.get('ui_submit');
    assert.equal(busLabel?.t, 'pin.bus.cb.in', 'formal bus event must write Model 0 pin.bus.cb.in');
    assert.equal(recordsToObject(busLabel?.v).input_text, 'server text', 'Model 0 bus payload must contain current-model resolved label value');
    return { key: 'bus_event_v2_reaches_model0_pin_with_resolved_payload', status: 'PASS' };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

const tests = [
  test_renderer_resolves_omitted_model_id_against_current_node,
  test_bus_event_v2_reaches_model0_pin_with_resolved_payload,
  test_developer_payload_omits_model_id_zero_placeholder,
  test_provider_bundles_omit_model_id_zero_placeholder,
  test_cross_model_refs_remain_explicit_in_proxy_payload,
  test_developer_docs_teach_current_model_ref_rule,
];

let failed = 0;
for (const test of tests) {
  try {
    const result = await test();
    console.log(`[PASS] ${result.key}`);
  } catch (err) {
    failed += 1;
    console.error(`[FAIL] ${test.name}: ${err && err.message ? err.message : String(err)}`);
  }
}

if (failed > 0) {
  console.error(`\\n${tests.length - failed} passed, ${failed} failed out of ${tests.length}`);
  process.exitCode = 1;
} else {
  console.log(`\\n${tests.length} passed, 0 failed out of ${tests.length}`);
}
