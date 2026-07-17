#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZipPkg from 'adm-zip';

const AdmZip = AdmZipPkg && AdmZipPkg.default ? AdmZipPkg.default : AdmZipPkg;

function buildZipBuffer(payload) {
  const zip = new AdmZip();
  zip.addFile('app_payload.json', Buffer.from(JSON.stringify(payload, null, 2), 'utf8'));
  return zip.toBuffer();
}

function buildBasePayload(extraRoot = [], extraRecords = []) {
  return [
    { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.table', v: 'UI.ImportedHostEgressApp' },
    { id: 0, p: 0, r: 0, c: 0, k: 'app_name', t: 'str', v: 'Imported Host Egress App' },
    { id: 0, p: 0, r: 0, c: 0, k: 'slide_app_summary', t: 'str', v: 'Imported host egress contract fixture for dual-bus outbound behavior.' },
    { id: 0, p: 0, r: 0, c: 0, k: 'source_worker', t: 'str', v: 'imported-host-egress' },
    { id: 0, p: 0, r: 0, c: 0, k: 'slide_capable', t: 'bool', v: true },
    { id: 0, p: 0, r: 0, c: 0, k: 'slide_surface_type', t: 'str', v: 'workspace.page' },
    { id: 0, p: 0, r: 0, c: 0, k: 'from_user', t: 'str', v: '@host:test' },
    { id: 0, p: 0, r: 0, c: 0, k: 'to_user', t: 'str', v: '@drop:test' },
    { id: 0, p: 0, r: 0, c: 0, k: 'ui_authoring_version', t: 'str', v: 'cellwise.ui.v1' },
    { id: 0, p: 0, r: 0, c: 0, k: 'ui_root_node_id', t: 'str', v: 'imported_host_egress_root' },
    { id: 0, p: 0, r: 0, c: 0, k: 'status_text', t: 'str', v: 'idle' },
    ...extraRoot,
    ...extraRecords,
  ];
}

function hostIngressRootLabel() {
  return {
    id: 0,
    p: 0,
    r: 0,
    c: 0,
    k: 'host_ingress_v1',
    t: 'json',
    v: {
      version: 'v1',
      boundaries: [{
        semantic: 'submit',
        pin_name: 'submit_request',
        value_t: 'modeltable',
        locator_kind: 'root_relative_cell',
        locator_value: { p: 0, r: 0, c: 0 },
        primary: true,
      }],
    },
  };
}

function dualBusRootLabel(value = {}) {
  return {
    id: 0,
    p: 0,
    r: 0,
    c: 0,
    k: 'dual_bus_model',
    t: 'json',
    v: {
      mode: 'imported_host_egress',
      egress_pins: ['submit'],
      ...value,
    },
  };
}

function remoteBusEndpointRootLabel(value = {}) {
  return {
    id: 0,
    p: 0,
    r: 0,
    c: 0,
    k: 'remote_bus_endpoint_v1',
    t: 'json',
    v: {
      transport: 'mqtt',
      to: { worker_id: 'R1', model_id: 3000 },
      ...value,
    },
  };
}

function validPayload() {
  return buildBasePayload(
    [hostIngressRootLabel(), remoteBusEndpointRootLabel(), dualBusRootLabel()],
    [
      { id: 0, p: 0, r: 0, c: 0, k: 'input_text', t: 'str', v: '' },
      { id: 0, p: 0, r: 0, c: 0, k: 'last_submit_payload', t: 'json', v: null },
      { id: 0, p: 0, r: 0, c: 0, k: 'submit_request', t: 'pin.in', v: null },
      { id: 0, p: 0, r: 0, c: 0, k: 'submit_request_wiring', t: 'pin.connect.label', v: [{ from: 'submit_request', to: ['handle_submit:in'] }] },
      { id: 0, p: 0, r: 0, c: 0, k: 'root_routes', t: 'pin.connect.cell', v: [
        { from: [2, 3, 0, 'click_chain'], to: [[0, 0, 0, 'submit_request']] },
      ] },
      { id: 0, p: 0, r: 0, c: 0, k: 'submit', t: 'pin.out', v: null },
      { id: 0, p: 0, r: 0, c: 0, k: 'handle_submit', t: 'func.js', v: { code: [
        "const records = Array.isArray(label && label.v) ? label.v : [];",
        "const readPayload = function(key, fallback) { const rec = records.find(function(item) { return item && item.id === 0 && item.p === 0 && item.r === 0 && item.c === 0 && item.k === key; }); return rec && Object.prototype.hasOwnProperty.call(rec, 'v') ? rec.v : fallback; };",
        "const nestedValue = readPayload('value', {});",
        "const text = String(readPayload('text', nestedValue && nestedValue.text != null ? nestedValue.text : '')).trim();",
        "const payload = [",
        "  { id: 0, p: 0, r: 0, c: 0, k: 'model_type', t: 'model.single', v: 'Data.ImportedHostSubmit' },",
        "  { id: 0, p: 0, r: 0, c: 0, k: 'message_text', t: 'str', v: text },",
        "  { id: 0, p: 0, r: 0, c: 0, k: 'submit_source', t: 'str', v: String(readPayload('source', nestedValue && nestedValue.source ? nestedValue.source : 'host_ingress')) }",
        "];",
        "V1N.addLabel('input_text', 'str', text);",
        "V1N.addLabel('last_submit_payload', 'json', payload);",
        "V1N.addLabel('status_text', 'str', text ? 'payload_ready' : 'empty_input');",
        "if (text) V1N.addLabel('submit', 'pin.out', payload);",
        "return;",
      ].join('\n') } },
      { id: 0, p: 2, r: 3, c: 0, k: 'click_chain', t: 'pin.in', v: null },
    ],
  );
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0322-contract-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0322_contract_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
  const state = createServerState({ dbPath: null });
  try {
    await state.activateRuntimeMode('running');
    return await fn(state);
  } finally {
    await state.shutdown();
    rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.WORKER_BASE_WORKSPACE;
    delete process.env.WORKER_BASE_DATA_ROOT;
    delete process.env.DOCS_ROOT;
    delete process.env.STATIC_PROJECTS_ROOT;
    delete process.env.DY_PERSISTED_ASSET_ROOT;
  }
}

async function importPayload(state, payload, uri) {
  state.cacheUploadedMediaForTest(uri, {
    buffer: buildZipBuffer(payload),
    contentType: 'application/zip',
    filename: '0322-imported-host-egress.zip',
    userId: '@drop:localhost',
  });
  return state.runtime.hostApi.slideImportAppFromMxc(uri);
}

async function test_import_rejects_dual_bus_model_without_root_submit_pin_out() {
  return withServerState(async (state) => {
    const payload = buildBasePayload(
      [hostIngressRootLabel(), remoteBusEndpointRootLabel(), dualBusRootLabel()],
      [
        { id: 0, p: 0, r: 0, c: 0, k: 'submit_request', t: 'pin.in', v: null },
      ],
    );
    const result = await importPayload(state, payload, 'mxc://localhost/0322-contract-missing-egress');
    assert.equal(result.ok, false, 'dual_bus_import_without_root_submit_pin_out_must_be_rejected');
    assert.equal(result.detail, 'host_egress_target_pin_missing:submit', 'missing_root_submit_pin_out_reason_must_be_explicit');
    return { key: 'import_rejects_dual_bus_model_without_root_submit_pin_out', status: 'PASS' };
  });
}

async function test_import_generates_host_egress_adapter_for_valid_dual_bus_import() {
  return withServerState(async (state) => {
    const result = await importPayload(state, validPayload(), 'mxc://localhost/0322-contract-valid');
    assert.equal(result.ok, true, 'valid_dual_bus_import_must_succeed');
    const importedRef = result.data?.model_ref;
    assert.equal(typeof importedRef?.table_id, 'string', 'imported app must return a table-qualified model ref');
    assert.equal(Number.isInteger(importedRef?.model_id), true, 'imported app model ref must include an integer model id');
    const model0 = state.runtime.getModel(0);
    const rootLabels = state.runtime.getCell(model0, 0, 0, 0).labels;
    const importedRoot = state.runtime.getCell(state.runtime.getModel(importedRef), 0, 0, 0).labels;
    const generatedKeys = importedRoot.get('host_egress_generated_model0_labels')?.v || [];
    const busLabel = importedRoot.get('ui_egress_submit_binding')?.v?.host_pin_key;
    const bridgeFunc = generatedKeys.find((key) => rootLabels.get(key)?.t === 'func.js');
    const bridgeWiring = generatedKeys
      .map((key) => rootLabels.get(key))
      .find((label) => label?.t === 'pin.connect.label' && label.v?.some((entry) => entry?.to?.includes(`${bridgeFunc}:in`)));
    const bridgeIn = bridgeWiring?.v?.find((entry) => entry?.to?.includes(`${bridgeFunc}:in`))?.from;
    assert.equal(typeof busLabel, 'string', 'imported binding must expose its generated Model 0 bus key');
    assert.ok(rootLabels.has(busLabel), 'model0_bus_out_label_must_be_generated_from_remote_bus_endpoint');
    assert.ok(rootLabels.has(bridgeIn), 'model0_bridge_input_must_be_generated_from_public_pin');
    assert.ok(rootLabels.has(bridgeFunc), 'model0_bridge_function_must_be_generated_from_public_pin');
    const bridgeCode = rootLabels.get(bridgeFunc)?.v?.code || '';
    const importedHandlerCode = importedRoot.get('handle_submit')?.v?.code || '';
    assert.ok(bridgeCode.includes('bus_send.v1'), 'model0_bridge_function_must_write_bus_send_v1_temporary_payload');
    assert.ok(!bridgeCode.includes('source_model_id: '), 'model0_bridge_function_must_not_write_legacy_object_request');
    assert.ok(!importedHandlerCode.includes('source_model_id'), 'imported_handler_must_not_emit_legacy_source_model_id_record');
    assert.equal(Object.prototype.hasOwnProperty.call(importedRoot.get('dual_bus_model')?.v || {}, 'model0_egress_label'), false, 'dual_bus_model_must_not_keep_legacy_model0_egress_label');
    assert.equal(Object.prototype.hasOwnProperty.call(importedRoot.get('dual_bus_model')?.v || {}, 'model0_egress_func'), false, 'dual_bus_model_must_not_keep_legacy_model0_egress_func');
    const sys = state.runtime.getModel(-10);
    assert.equal(
      [...state.runtime.getCell(sys, 0, 0, 0).labels.keys()].some((key) => key.startsWith('forward_imported_submit_from_model0_')),
      false,
      'legacy_system_forward_function_must_not_be_generated',
    );
    return { key: 'import_generates_host_egress_adapter_for_valid_dual_bus_import', status: 'PASS' };
  });
}

async function materializeCollisionReferenceKeys() {
  return withServerState(async (state) => {
    const { materializeImportedHostEgressAdapter } = await import(
      new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url)
    );
    const fixtures = [
      {
        ref: 'app:a-b:c:2-0-0:1/0',
        tableId: 'app:a-b:c:2-0-0:1',
        mount: { p: 2, r: 0, c: 0 },
      },
      {
        ref: 'app:a:b-c:2-0-0:1/0',
        tableId: 'app:a:b-c:2-0-0:1',
        mount: { p: 2, r: 0, c: 1 },
      },
    ];
    const hostEgress = {
      semantic: 'submit',
      pinName: 'submit',
      routeKind: 'control',
      envelopeExtensionKeys: [],
      dualBusDeclaration: {
        mode: 'imported_host_egress',
        egress_pins: ['submit'],
      },
    };
    const remoteEndpoint = {
      transport: 'mqtt',
      routeKind: 'control',
      to: { worker_id: 'R1', model_id: 3000 },
    };

    return fixtures.map((fixture) => {
      const root = state.runtime.createModel({
        table_id: fixture.tableId,
        id: 0,
        name: fixture.tableId,
        type: 'subtable-root',
      });
      state.runtime.addLabel(root, 0, 0, 0, { k: 'submit', t: 'pin.out', v: null });
      const keys = materializeImportedHostEgressAdapter(
        state.runtime,
        fixture.ref,
        fixture.mount,
        hostEgress,
        remoteEndpoint,
      );
      assert.ok(keys, `${fixture.ref} must be parsed and materialized by the production adapter path`);
      const binding = state.runtime.getCell(root, 0, 0, 0).labels.get('ui_egress_submit_binding');
      assert.equal(binding?.v?.host_pin_key, keys.busOutKey, `${fixture.ref} binding must use the production-generated key`);
      return {
        ref: fixture.ref,
        busOutKey: keys.busOutKey,
        bridgeFunc: keys.bridgeFunc,
        model0BridgeIn: keys.model0BridgeIn,
      };
    });
  });
}

async function test_collision_prone_table_refs_generate_distinct_stable_adapter_keys() {
  const first = await materializeCollisionReferenceKeys();
  const second = await materializeCollisionReferenceKeys();
  assert.equal(first.length, 2);
  assert.notEqual(first[0].busOutKey, first[1].busOutKey, 'reviewer collision refs must generate different bus keys');
  assert.notEqual(first[0].bridgeFunc, first[1].bridgeFunc, 'reviewer collision refs must generate different bridge keys');
  assert.notEqual(first[0].model0BridgeIn, first[1].model0BridgeIn, 'reviewer collision refs must generate different bridge inputs');
  assert.deepEqual(second, first, 'production parsing and key generation must remain stable across fresh server states');
  return { key: 'collision_prone_table_refs_generate_distinct_stable_adapter_keys', status: 'PASS' };
}

const tests = [
  test_import_rejects_dual_bus_model_without_root_submit_pin_out,
  test_import_generates_host_egress_adapter_for_valid_dual_bus_import,
  test_collision_prone_table_refs_generate_distinct_stable_adapter_keys,
];

(async () => {
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
})();
