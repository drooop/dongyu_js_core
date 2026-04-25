#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { buildAstFromCellwiseModel } from '../../packages/ui-model-demo-frontend/src/ui_cellwise_projection.js';

const require = createRequire(import.meta.url);
const { ModelTableRuntime } = require('../../packages/worker-base/src/runtime.js');
const { createRenderer: createRendererCjs } = require('../../packages/ui-renderer/src/index.js');

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const workspacePatchPath = 'packages/worker-base/system-models/workspace_positive_models.json';
const testPatchPath = 'packages/worker-base/system-models/test_model_100_ui.json';

function tempPayload(records = []) {
  return [
    { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'ui_event.v1' },
    ...records,
  ];
}

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relPath), 'utf8'));
}

function readText(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function recordsForModel(records, modelId) {
  return (Array.isArray(records) ? records : []).filter((record) => record && record.model_id === modelId);
}

function findRecord(records, predicate) {
  return (Array.isArray(records) ? records : []).find(predicate) || null;
}

function hasRecord(records, predicate) {
  return Boolean(findRecord(records, predicate));
}

function makeSnapshotFromRecords(records, modelId) {
  const cells = {};
  for (const record of recordsForModel(records, modelId)) {
    if (record.op !== 'add_label') continue;
    const key = `${record.p},${record.r},${record.c}`;
    if (!cells[key]) cells[key] = { labels: {} };
    cells[key].labels[record.k] = { k: record.k, t: record.t, v: record.v };
  }
  return {
    models: {
      [String(modelId)]: {
        id: modelId,
        name: `Model ${modelId}`,
        cells,
      },
    },
  };
}

function cloneRecordsWithChangedLabel(records, match, nextValue) {
  return records.map((record) => (
    record
    && record.op === 'add_label'
    && Object.entries(match).every(([key, value]) => record[key] === value)
      ? { ...record, v: nextValue }
      : record
  ));
}

function findNodeById(node, id) {
  if (!node || typeof node !== 'object') return null;
  if (node.id === id) return node;
  for (const child of Array.isArray(node.children) ? node.children : []) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

function renderColorBoxWith(createRenderer) {
  const snapshot = {
    models: {
      100: {
        id: 100,
        cells: {
          '0,0,0': {
            labels: {
              bg_color: { k: 'bg_color', t: 'str', v: '#54839c' },
            },
          },
        },
      },
    },
  };
  const host = {
    getSnapshot: () => snapshot,
    dispatchAddLabel: () => {},
    dispatchRmLabel: () => {},
  };
  const renderer = createRenderer({
    host,
    vue: {
      h: (type, props, children) => ({ type, props, children }),
      resolveComponent: (name) => name,
    },
  });
  return renderer.renderVNode({
    id: 'model100_color_box',
    type: 'ColorBox',
    props: {
      width: '120px',
      height: 80,
      borderRadius: '12px',
    },
    bind: {
      read: { model_id: 100, p: 0, r: 0, c: 0, k: 'bg_color' },
    },
  });
}

function test_workspace_model100_declares_cellwise_and_drops_legacy_schema_source() {
  const records = readJson(workspacePatchPath).records || [];
  assert.equal(
    findRecord(records, (record) => record?.model_id === 100 && record?.p === 0 && record?.r === 0 && record?.c === 0 && record?.k === 'ui_authoring_version')?.v,
    'cellwise.ui.v1',
    'workspace Model 100 must declare cellwise.ui.v1',
  );
  assert.equal(
    findRecord(records, (record) => record?.model_id === 100 && record?.p === 0 && record?.r === 0 && record?.c === 0 && record?.k === 'ui_root_node_id')?.v,
    'model100_cellwise_root',
    'workspace Model 100 must declare a stable cellwise root node id',
  );
  for (const legacyKey of ['_title', '_subtitle', '_field_order', 'submit__props', 'submit__bind', 'input_value__bind']) {
    assert.equal(
      hasRecord(records, (record) => record?.model_id === 100 && record?.p === 1 && record?.r === 0 && record?.c === 0 && record?.k === legacyKey),
      false,
      `workspace Model 100 must not keep legacy schema source label ${legacyKey}`,
    );
  }
  return { key: 'workspace_model100_declares_cellwise_and_drops_legacy_schema_source', status: 'PASS' };
}

function test_workspace_model100_projects_title_layout_and_added_cells_from_cellwise() {
  const records = readJson(workspacePatchPath).records || [];
  const ast = buildAstFromCellwiseModel(makeSnapshotFromRecords(records, 100), 100);
  assert.equal(ast?.id, 'model100_cellwise_root', 'Model 100 must project from cellwise root');
  assert.equal(ast?.type, 'Container', 'Model 100 root must be a Container');
  assert.equal(ast?.props?.layout, 'column', 'Model 100 root layout must come from ui_layout');
  assert.equal(findNodeById(ast, 'model100_title')?.props?.text, 'E2E 颜色生成器', 'visible title must come from a UI node label');
  assert.equal(findNodeById(ast, 'model100_color_row')?.props?.layout, 'row', 'color preview row must be an independent row cell');
  assert.equal(findNodeById(ast, 'model100_input_row')?.props?.layout, 'row', 'input row must be an independent row cell');
  assert.equal(findNodeById(ast, 'model100_status_row')?.props?.layout, 'row', 'status row must be an independent row cell');
  assert.equal(findNodeById(ast, 'model100_color_box')?.type, 'ColorBox', 'color box node must be cellwise');
  assert.equal(findNodeById(ast, 'model100_input')?.type, 'Input', 'input node must be cellwise');

  const changed = cloneRecordsWithChangedLabel(records, {
    model_id: 100,
    p: 2,
    r: 1,
    c: 0,
    k: 'ui_text',
  }, 'E2E 颜色生成器 - 改名验证');
  const changedAst = buildAstFromCellwiseModel(makeSnapshotFromRecords(changed, 100), 100);
  assert.equal(
    findNodeById(changedAst, 'model100_title')?.props?.text,
    'E2E 颜色生成器 - 改名验证',
    'changing title ui_text label must change projected title',
  );
  return { key: 'workspace_model100_projects_title_layout_and_added_cells_from_cellwise', status: 'PASS' };
}

function test_model100_colorbox_numeric_height_renders_as_css_length() {
  const vnode = renderColorBoxWith(createRendererCjs);
  assert.equal(vnode.props?.style?.backgroundColor, '#54839c', 'ColorBox must render bound color');
  assert.equal(vnode.props?.style?.width, '120px', 'ColorBox must preserve string width');
  assert.equal(vnode.props?.style?.height, '80px', 'ColorBox must convert numeric height to px');
  assert.equal(vnode.props?.style?.borderRadius, '12px', 'ColorBox must preserve configured radius');
  for (const relPath of ['packages/ui-renderer/src/renderer.mjs', 'packages/ui-renderer/src/renderer.js']) {
    const source = readText(relPath);
    assert.match(source, /function toCssLength/u, `${relPath} must define ColorBox CSS length normalization`);
    assert.match(source, /height: toCssLength\(node\.props && node\.props\.height, '60px'\)/u, `${relPath} must normalize ColorBox height`);
  }
  return { key: 'model100_colorbox_numeric_height_renders_as_css_length', status: 'PASS' };
}

function test_workspace_model100_submit_button_preserves_pin_metadata() {
  const records = readJson(workspacePatchPath).records || [];
  const ast = buildAstFromCellwiseModel(makeSnapshotFromRecords(records, 100), 100);
  const submit = findNodeById(ast, 'submit_button');
  assert.ok(submit, 'cellwise submit button missing');
  assert.equal(submit.props?.label, 'Generate Color', 'submit button label must come from cellwise label');
  assert.deepEqual(
    submit.cell_ref,
    { model_id: 100, p: 1, r: 0, c: 0 },
    'submit button must keep the executable click pin cell_ref',
  );
  assert.deepEqual(
    submit.writable_pins,
    [{
      name: 'click',
      direction: 'in',
      trigger: 'click',
      value_t: 'modeltable',
      commit_policy: 'immediate',
      primary: true,
    }],
    'submit button must expose frozen writable_pins',
  );
  assert.equal(submit.bind?.write?.pin, 'click', 'submit button write must target click pin');
  assert.deepEqual(
    submit.props?.loading,
    { $label: { model_id: 100, p: 0, r: 0, c: 0, k: 'submit_inflight' } },
    'submit button loading must still read submit_inflight',
  );
  assert.deepEqual(
    submit.props?.singleFlight?.releaseRef,
    { model_id: -1, p: 0, r: 0, c: 1, k: 'bus_event_last_op_id' },
    'submit button must still release singleFlight from bus_event_last_op_id',
  );
  return { key: 'workspace_model100_submit_button_preserves_pin_metadata', status: 'PASS' };
}

function test_test_model100_ui_patch_carries_same_cellwise_authoring_surface() {
  const records = readJson(testPatchPath).records || [];
  assert.equal(
    findRecord(records, (record) => record?.model_id === 100 && record?.p === 0 && record?.r === 0 && record?.c === 0 && record?.k === 'ui_authoring_version')?.v,
    'cellwise.ui.v1',
    'test_model_100_ui must declare cellwise.ui.v1',
  );
  const ast = buildAstFromCellwiseModel(makeSnapshotFromRecords(records, 100), 100);
  assert.equal(ast?.id, 'model100_cellwise_root', 'test_model_100_ui must project the same cellwise root');
  assert.equal(findNodeById(ast, 'submit_button')?.bind?.write?.pin, 'click', 'test_model_100_ui submit must keep click pin write');
  assert.ok(
    Array.isArray(findNodeById(ast, 'submit_button')?.bind?.write?.value_ref),
    'test_model_100_ui submit click value_ref must be a temporary ModelTable array',
  );
  return { key: 'test_model100_ui_patch_carries_same_cellwise_authoring_surface', status: 'PASS' };
}

async function test_test_model100_ui_standalone_click_pin_executes_submit_chain() {
  const patch = readJson(testPatchPath);
  const runtime = new ModelTableRuntime();
  runtime.applyPatch(patch, { allowCreateModel: true, trustedBootstrap: true });
  runtime.setRuntimeMode('edit');
  runtime.setRuntimeMode('running');

  const model100 = runtime.getModel(100);
  assert.ok(model100, 'test_model_100_ui must create model100');
  runtime.addLabel(model100, 1, 0, 0, {
    k: 'click',
    t: 'pin.in',
    v: tempPayload([{ id: 0, p: 0, r: 0, c: 0, k: 'input_value', t: 'str', v: 'fixture-standalone-check' }]),
  });
  await new Promise((resolve) => setTimeout(resolve, 300));

  const rootLabels = runtime.getCell(model100, 0, 0, 0).labels;
  const submit = rootLabels.get('submit')?.v ?? null;
  assert.ok(Array.isArray(submit), 'test_model_100_ui standalone click must produce submit temporary ModelTable payload');
  assert.ok(
    submit.some((record) => record && record.k === 'input_value' && record.v === 'fixture-standalone-check'),
    'test_model_100_ui standalone submit payload must preserve input_value',
  );
  assert.equal(rootLabels.get('status')?.v, 'loading', 'test_model_100_ui standalone click must reach submit preparation');
  assert.equal(rootLabels.get('__error_prepare_model100_submit_from_pin')?.v ?? null, null, 'standalone fixture must not leave prepare error');
  assert.equal(runtime.getCell(model100, 1, 0, 0).labels.get('__error_handle_submit_click')?.v ?? null, null, 'standalone fixture must not leave click handler error');
  return { key: 'test_model100_ui_standalone_click_pin_executes_submit_chain', status: 'PASS' };
}

const tests = [
  test_workspace_model100_declares_cellwise_and_drops_legacy_schema_source,
  test_workspace_model100_projects_title_layout_and_added_cells_from_cellwise,
  test_model100_colorbox_numeric_height_renders_as_css_length,
  test_workspace_model100_submit_button_preserves_pin_metadata,
  test_test_model100_ui_patch_carries_same_cellwise_authoring_surface,
  test_test_model100_ui_standalone_click_pin_executes_submit_chain,
];

async function main() {
  let passed = 0;
  let failed = 0;
  for (const test of tests) {
    try {
      const result = await test();
      console.log(`[${result.status}] ${result.key}`);
      passed += 1;
    } catch (error) {
      console.log(`[FAIL] ${test.name}: ${error.message}`);
      failed += 1;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
