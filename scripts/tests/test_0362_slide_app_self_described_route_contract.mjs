#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZipPkg from 'adm-zip';

const repoRoot = new URL('../..', import.meta.url);
const AdmZip = AdmZipPkg && AdmZipPkg.default ? AdmZipPkg.default : AdmZipPkg;

function readText(path) {
  return readFileSync(new URL(path, repoRoot), 'utf8');
}

function assertIncludes(text, needle, label) {
  assert.equal(text.includes(needle), true, `${label}_missing_${needle}`);
}

function buildZipBuffer(payload) {
  const zip = new AdmZip();
  zip.addFile('app_payload.json', Buffer.from(JSON.stringify(payload, null, 2), 'utf8'));
  return zip.toBuffer();
}

function mt(k, t, v) {
  return { id: 0, p: 0, r: 0, c: 0, k, t, v };
}

function payloadValue(packet, key) {
  return Array.isArray(packet?.payload) ? packet.payload.find((record) => record && record.k === key)?.v : undefined;
}

function buildNamedZipBuffer(entries) {
  const zip = new AdmZip();
  for (const entry of entries) {
    zip.addFile(entry.name, Buffer.from(entry.content, 'utf8'));
  }
  return zip.toBuffer();
}

async function withServerState(fn) {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0362-route-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.WORKER_BASE_WORKSPACE = `it0362_route_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  try {
    const { createServerState } = await import(new URL('../../packages/ui-model-demo-server/server.mjs', import.meta.url));
    const state = createServerState({ dbPath: null });
    await state.activateRuntimeMode('running');
    return await fn(state);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.WORKER_BASE_WORKSPACE;
    delete process.env.WORKER_BASE_DATA_ROOT;
    delete process.env.DOCS_ROOT;
    delete process.env.STATIC_PROJECTS_ROOT;
    delete process.env.DY_PERSISTED_ASSET_ROOT;
  }
}

function test_ssot_freezes_self_described_route_contract() {
  const runtime = readText('docs/ssot/runtime_semantics_modeltable_driven.md');
  const labels = readText('docs/ssot/label_type_registry.md');
  const payload = readText('docs/ssot/temporary_modeltable_payload_v1.md');
  const imported = readText('docs/ssot/imported_slide_app_host_ingress_semantics_v1.md');
  const conformance = readText('docs/ssot/tier_boundary_and_conformance_testing.md');

  for (const [name, text] of [
    ['runtime', runtime],
    ['labels', labels],
    ['payload', payload],
    ['imported', imported],
  ]) {
    assertIncludes(text, 'remote_bus_endpoint_v1', name);
    assertIncludes(text, 'endpoint_worker_id', name);
    assertIncludes(text, 'reply_target_worker_id', name);
  }

  assert.match(runtime, /reply_target.*server-owned|server-owned.*reply_target/u, 'runtime_must_make_reply_target_server_owned');
  assert.match(labels, /ZIP.*reply_to|reply_to.*ZIP/u, 'label_registry_must_forbid_zip_reply_to');
  assert.match(payload, /reply_target_worker_id/u, 'payload_doc_must_define_reply_target_records');
  assert.match(imported, /MBR.*per-app route registration|per-app route registration/u, 'imported_doc_must_forbid_mbr_per_app_registration');
  assert.match(conformance, /per-app static route|route\.reply_to/u, 'conformance_doc_must_review_new_route_risks');

  return { key: 'ssot_freezes_self_described_route_contract', status: 'PASS' };
}

function test_user_docs_explain_provider_local_identity_split_and_re_wiring() {
  const guide = readText('docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md');
  const visualized = readText('docs/user-guide/slide-app-runtime/minimal_submit_app_provider_visualized.md');
  const interactive = readText('docs/user-guide/slide-app-runtime/minimal_submit_app_provider_interactive.html');

  for (const [name, text] of [
    ['guide', guide],
    ['visualized', visualized],
    ['interactive', interactive],
  ]) {
    assertIncludes(text, 'remote_bus_endpoint_v1', name);
    assertIncludes(text, 'endpoint_worker_id', name);
    assertIncludes(text, 'reply_target_worker_id', name);
    assertIncludes(text, 'submit1', name);
    assertIncludes(text, '3000', name);
    assertIncludes(text, '2000', name);
    assert.equal(text.includes('UIPUT/ws/dam/pic/de/sw/1050/submit'), false, `${name}_must_not_teach_old_local_id_submit_topic`);
    assert.equal(text.includes('UIPUT/ws/dam/pic/de/sw/1050/result'), false, `${name}_must_not_teach_old_local_id_result_topic`);
    assert.equal(text.includes('bus_event_submit_1050_0_0_0'), false, `${name}_must_not_teach_old_fixed_bus_event_key`);
    assert.equal(text.includes('on_minimal_submit_matrix_remote_submit'), false, `${name}_must_not_teach_old_single_cell_remote_handler`);
  }

  assert.match(guide, /endpoint_pin.*submit1|submit1.*endpoint_pin/u, 'guide_must_define_public_pin_entry');
  assert.match(guide, /submit1_route/u, 'guide_must_show_root_pin_connect_cell_route');
  assert.match(guide, /submit1_wiring/u, 'guide_must_show_program_cell_pin_connect_label_wiring');
  assert.match(guide, /函数端点不能跨 Cell 直连/u, 'guide_must_forbid_cross_cell_function_endpoint');
  assert.equal(readText('docs/ssot/imported_slide_app_host_ingress_semantics_v1.md').includes('pin.out submit` 被写入'), false, 'ssot_must_not_preserve_forced_submit_egress_path');
  assert.match(interactive, /route\.reply_to in zip/u, 'interactive_must_flag_reply_to_in_zip_as_forbidden');
  assert.match(visualized, /root `submit1` -> `\(1,1,1\)\.submit1_in` -> `submit1:in`/u, 'visualized_must_show_re_internal_wiring');

  return { key: 'user_docs_explain_provider_local_identity_split_and_re_wiring', status: 'PASS' };
}

function test_iteration_plan_requires_review_approval_and_server_owned_reply_to() {
  const plan = readText('docs/iterations/0362-slide-app-self-described-route/plan.md');
  const resolution = readText('docs/iterations/0362-slide-app-self-described-route/resolution.md');
  const runlog = readText('docs/iterations/0362-slide-app-self-described-route/runlog.md');

  assert.match(plan, /server-owned/u, 'plan_must_mark_reply_to_server_owned');
  assert.match(plan, /Decision: APPROVED/u, 'plan_must_require_approved_subagent_review');
  assert.match(resolution, /rejects? bundle-level runtime `route\.reply_to`|Importer rejects bundle-level runtime `route\.reply_to`/u, 'resolution_must_plan_reply_to_rejection');
  assert.match(runlog, /tier_boundary_and_conformance_testing\.md/u, 'runlog_must_include_tier_conformance_living_doc');

  return { key: 'iteration_plan_requires_review_approval_and_server_owned_reply_to', status: 'PASS' };
}

function test_saved_zip_is_single_modeltable_records_payload() {
  const zip = new AdmZip(new URL('test_files/minimal_submit_dual_bus.zip', repoRoot).pathname);
  const entries = zip.getEntries().filter((entry) => entry && !entry.isDirectory);
  assert.equal(entries.length, 1, 'slide_app_zip_must_have_exactly_one_file');
  assert.equal(entries[0].entryName, 'app_payload.json', 'slide_app_zip_file_must_be_app_payload_json');
  const payload = JSON.parse(entries[0].getData().toString('utf8'));
  assert.equal(Array.isArray(payload), true, 'app_payload_must_be_modeltable_records_array');
  assert.ok(payload.length > 0, 'app_payload_must_not_be_empty');
  for (const record of payload) {
    assert.equal(Number.isInteger(record.id), true, 'record_must_have_temp_id');
    assert.equal(Number.isInteger(record.p), true, 'record_must_have_p');
    assert.equal(Number.isInteger(record.r), true, 'record_must_have_r');
    assert.equal(Number.isInteger(record.c), true, 'record_must_have_c');
    assert.equal(typeof record.k, 'string', 'record_must_have_k');
    assert.equal(typeof record.t, 'string', 'record_must_have_t');
    assert.equal(Object.prototype.hasOwnProperty.call(record, 'op'), false, 'zip_must_not_contain_patch_ops');
    assert.equal(Object.prototype.hasOwnProperty.call(record, 'model_id'), false, 'zip_must_not_contain_formal_model_id');
  }
  assert.equal(payload.some((record) => (
    record.k === 'remote_bus_endpoint_v1'
    && record.t === 'json'
    && record.v?.transport === 'mqtt'
    && record.v?.to?.worker_id === 'RE'
    && record.v?.to?.model_id === 3000
    && !Object.prototype.hasOwnProperty.call(record.v.to, 'pin')
    && !Object.prototype.hasOwnProperty.call(record.v, 'reply_to')
  )), true, 'zip_must_declare_remote_endpoint_without_runtime_owned_fields');
  assert.equal(payload.some((record) => (
    record.k === 'dual_bus_model'
    && record.t === 'json'
    && Array.isArray(record.v?.egress_pins)
    && record.v.egress_pins.includes('submit1')
  )), true, 'zip_must_declare_submit1_as_public_egress_pin');
  assert.equal(payload.some((record) => record.k === 'submit' && record.t === 'pin.out'), false, 'zip_must_not_depend_on_legacy_submit_pin');
  return { key: 'saved_zip_is_single_modeltable_records_payload', status: 'PASS' };
}

function test_local_persisted_asset_sync_uses_current_provider_patch() {
  const syncScript = readText('scripts/ops/sync_local_persisted_assets.sh');
  assertIncludes(syncScript, '13_model3000_minimal_submit.json', 'local_asset_sync');
  assert.equal(syncScript.includes('13_model1050_minimal_submit.json'), false, 'local_asset_sync_must_not_reference_removed_provider_patch');

  const matches = [...syncScript.matchAll(/'([^']+\.json)'/gu)]
    .map((match) => match[1])
    .filter((filePath) => filePath.startsWith('deploy/') || filePath.startsWith('packages/'));
  assert.ok(matches.length > 0, 'local_asset_sync_must_declare_json_sources');
  for (const filePath of matches) {
    assert.equal(existsSync(new URL(filePath, repoRoot)), true, `local_asset_sync_source_missing:${filePath}`);
  }
  return { key: 'local_persisted_asset_sync_uses_current_provider_patch', status: 'PASS' };
}

function test_seeded_minimal_submit_app_has_no_static_route_residue() {
  const patch = JSON.parse(readText('packages/worker-base/system-models/workspace_positive_models.json'));
  const records = Array.isArray(patch.records) ? patch.records : [];
  const text = JSON.stringify(records.filter((record) => (
    record?.model_id === 1050
    || record?.k === 'minimal_submit_matrix_submit_out'
    || record?.k === 'minimal_submit_matrix_submit_route'
    || record?.k === 'forward_minimal_submit_matrix_from_model0'
    || JSON.stringify(record || {}).includes('bus_event_submit_1050_0_0_0')
  )));
  assert.equal(text.includes('bus_event_submit_1050_0_0_0'), false, 'seeded_minimal_app_must_not_use_old_fixed_bus_event_key');
  assert.equal(text.includes('minimal_submit_matrix_submit_out'), false, 'seeded_minimal_app_must_not_use_old_model0_egress_label');
  assert.equal(text.includes('forward_minimal_submit_matrix_from_model0'), false, 'seeded_minimal_app_must_not_use_hardcoded_forward_function');
  assert.equal(text.includes('ui-server-local'), false, 'seeded_minimal_app_must_not_hardcode_reply_to_worker');

  const rootDualBus = records.find((record) => (
    record?.model_id === 1050
    && record?.p === 0
    && record?.r === 0
    && record?.c === 0
    && record?.k === 'dual_bus_model'
  ));
  assert.deepEqual(rootDualBus?.v, { mode: 'imported_host_egress', egress_pins: ['submit1'] }, 'seeded_minimal_app_must_use_current_dual_bus_shape');

  const remoteEndpoint = records.find((record) => (
    record?.model_id === 1050
    && record?.p === 0
    && record?.r === 0
    && record?.c === 0
    && record?.k === 'remote_bus_endpoint_v1'
  ));
  assert.deepEqual(remoteEndpoint?.v, {
    transport: 'mqtt',
    to: {
      worker_id: 'RE',
      model_id: 3000,
    },
  }, 'seeded_minimal_app_must_declare_remote_endpoint_without_runtime_owned_pin_or_reply_to');

  const submit1Pin = records.find((record) => (
    record?.model_id === 1050
    && record?.p === 0
    && record?.r === 0
    && record?.c === 0
    && record?.k === 'submit1'
  ));
  assert.equal(submit1Pin?.t, 'pin.out', 'seeded_minimal_app_must_declare_submit1_public_egress_pin');
  return { key: 'seeded_minimal_submit_app_has_no_static_route_residue', status: 'PASS' };
}

function test_all_seeded_dual_bus_apps_use_current_route_contract() {
  const serverSource = readText('packages/ui-model-demo-server/server.mjs');
  const workspace = JSON.parse(readText('packages/worker-base/system-models/workspace_positive_models.json'));
  const model100Fixture = JSON.parse(readText('packages/worker-base/system-models/test_model_100_ui.json'));
  const allSeedText = JSON.stringify([workspace, model100Fixture]);

  assert.equal(serverSource.includes('model0_egress_label'), false, 'server_must_not_dispatch_old_model0_egress_label');
  assert.equal(serverSource.includes('model0_egress_func'), false, 'server_must_not_dispatch_old_model0_egress_func');
  assert.equal(allSeedText.includes('model0_egress_label'), false, 'seeded_models_must_not_declare_old_model0_egress_label');
  assert.equal(allSeedText.includes('model0_egress_func'), false, 'seeded_models_must_not_declare_old_model0_egress_func');
  assert.equal(allSeedText.includes('ui-server-local'), false, 'seeded_models_must_not_hardcode_reply_to_worker');
  assert.equal(allSeedText.includes('model100_submit_out'), false, 'seeded_models_must_not_use_old_model100_egress_label');
  assert.equal(allSeedText.includes('ws_filltable_submit_out'), false, 'seeded_models_must_not_use_old_filltable_egress_label');
  assert.equal(allSeedText.includes('matrix_phase1_submit_out'), false, 'seeded_models_must_not_use_old_matrix_egress_label');

  const records = Array.isArray(workspace.records) ? workspace.records : [];
  for (const [modelId, remoteModelId] of [[100, 100], [1010, 1010], [1019, 1019]]) {
    const rootDualBus = records.find((record) => (
      record?.model_id === modelId
      && record?.p === 0
      && record?.r === 0
      && record?.c === 0
      && record?.k === 'dual_bus_model'
    ));
    assert.equal(rootDualBus?.v?.mode, 'imported_host_egress', `model_${modelId}_must_use_current_dual_bus_mode`);
    assert.deepEqual(rootDualBus?.v?.egress_pins, ['submit'], `model_${modelId}_must_use_submit_public_egress_pin`);
    assert.equal(typeof rootDualBus?.v?.bus_event_func, 'string', `model_${modelId}_must_keep_positive_model_event_handler`);
    assert.equal(Object.prototype.hasOwnProperty.call(rootDualBus?.v || {}, 'model0_egress_label'), false, `model_${modelId}_must_not_keep_old_egress_label`);
    assert.equal(Object.prototype.hasOwnProperty.call(rootDualBus?.v || {}, 'model0_egress_func'), false, `model_${modelId}_must_not_keep_old_egress_func`);

    const remoteEndpoint = records.find((record) => (
      record?.model_id === modelId
      && record?.p === 0
      && record?.r === 0
      && record?.c === 0
      && record?.k === 'remote_bus_endpoint_v1'
    ));
    assert.deepEqual(remoteEndpoint?.v, {
      transport: 'mqtt',
      to: { worker_id: 'RE', model_id: remoteModelId },
    }, `model_${modelId}_must_declare_remote_endpoint_without_pin_or_reply_to`);
  }

  return { key: 'all_seeded_dual_bus_apps_use_current_route_contract', status: 'PASS' };
}

async function test_seeded_minimal_submit_app_materializes_server_owned_route() {
  const previousWorkerId = process.env.DY_UI_SERVER_WORKER_ID;
  process.env.DY_UI_SERVER_WORKER_ID = 'ui-server-0362-seed';
  try {
    await withServerState(async (state) => {
      const model = state.runtime.getModel(1050);
      assert.ok(model, 'seeded_minimal_model_1050_must_exist');
      const published = [];
      state.programEngine.matrixAdapter = {
        publish: async (packet) => {
          published.push(packet);
        },
      };
      state.programEngine.matrixRoomId = '!seeded-minimal:localhost';
      state.programEngine.matrixDmPeerUserId = '@mbr:localhost';
      state.runtime.addLabel(model, 0, 0, 0, {
        k: 'submit1',
        t: 'pin.out',
        v: [
          { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'minimal_submit.request.v1' },
          { id: 0, p: 0, r: 0, c: 0, k: 'text', t: 'str', v: 'seed route check' },
        ],
      });
      await state.programEngine.tick();
      await new Promise((resolve) => setTimeout(resolve, 450));
      assert.equal(published.length, 1, 'seeded_minimal_app_must_publish_once_through_generated_adapter');
      assert.deepEqual(Object.keys(published[0]).sort(), ['payload', 'type', 'version'], 'seeded_minimal_app_packet_must_not_keep_loose_fields');
      assert.equal(payloadValue(published[0], 'origin_pin'), 'submit1', 'seeded_minimal_app_must_publish_public_pin');
      assert.equal(payloadValue(published[0], 'endpoint_worker_id'), 'RE', 'seeded_minimal_app_endpoint_worker_must_come_from_remote_endpoint');
      assert.equal(payloadValue(published[0], 'endpoint_model_id'), 3000, 'seeded_minimal_app_endpoint_model_must_come_from_remote_endpoint');
      assert.equal(payloadValue(published[0], 'endpoint_pin'), 'submit1', 'seeded_minimal_app_endpoint_pin_must_come_from_public_pin');
      assert.equal(payloadValue(published[0], 'reply_target_worker_id'), 'ui-server-0362-seed', 'seeded_minimal_app_reply_target_worker_must_be_server_owned');
      assert.equal(payloadValue(published[0], 'reply_target_model_id'), 1050, 'seeded_minimal_app_reply_target_model_must_be_server_owned');
      assert.equal(payloadValue(published[0], 'reply_target_pin'), 'result', 'seeded_minimal_app_reply_target_pin_must_be_server_owned');
    });
  } finally {
    if (previousWorkerId == null) {
      delete process.env.DY_UI_SERVER_WORKER_ID;
    } else {
      process.env.DY_UI_SERVER_WORKER_ID = previousWorkerId;
    }
  }
  return { key: 'seeded_minimal_submit_app_materializes_server_owned_route', status: 'PASS' };
}

async function test_all_seeded_dual_bus_apps_materialize_server_owned_routes() {
  const previousWorkerId = process.env.DY_UI_SERVER_WORKER_ID;
  process.env.DY_UI_SERVER_WORKER_ID = 'ui-server-0362-all-seed';
  try {
    await withServerState(async (state) => {
      const published = [];
      state.programEngine.matrixAdapter = {
        publish: async (packet) => {
          published.push(packet);
        },
      };
      state.programEngine.matrixRoomId = '!seeded-dual-bus:localhost';
      state.programEngine.matrixDmPeerUserId = '@mbr:localhost';
      for (const modelId of [100, 1010, 1019]) {
        const model = state.runtime.getModel(modelId);
        assert.ok(model, `seeded_model_${modelId}_must_exist`);
        state.runtime.addLabel(model, 0, 0, 0, {
          k: 'submit',
          t: 'pin.out',
          v: [
            mt('__mt_payload_kind', 'str', 'seeded.submit.v1'),
            mt('message_text', 'str', `seeded ${modelId}`),
          ],
        });
        await state.programEngine.tick();
        await new Promise((resolve) => setTimeout(resolve, 120));
      }

      const byModel = new Map(published.map((packet) => [payloadValue(packet, 'origin_model_id'), packet]));
      for (const modelId of [100, 1010, 1019]) {
        const packet = byModel.get(modelId);
        assert.ok(packet, `model_${modelId}_must_publish_through_generated_adapter`);
        assert.deepEqual(Object.keys(packet).sort(), ['payload', 'type', 'version'], `model_${modelId}_packet_must_not_keep_loose_fields`);
        assert.equal(payloadValue(packet, 'origin_pin'), 'submit', `model_${modelId}_must_publish_submit_pin`);
        assert.equal(payloadValue(packet, 'endpoint_worker_id'), 'RE', `model_${modelId}_endpoint_worker_must_come_from_remote_endpoint`);
        assert.equal(payloadValue(packet, 'endpoint_model_id'), modelId, `model_${modelId}_endpoint_model_must_come_from_remote_endpoint`);
        assert.equal(payloadValue(packet, 'endpoint_pin'), 'submit', `model_${modelId}_endpoint_pin_must_come_from_public_pin`);
        assert.equal(payloadValue(packet, 'reply_target_worker_id'), 'ui-server-0362-all-seed', `model_${modelId}_reply_target_worker_must_be_server_owned`);
        assert.equal(payloadValue(packet, 'reply_target_model_id'), modelId, `model_${modelId}_reply_target_model_must_be_server_owned`);
        assert.equal(payloadValue(packet, 'reply_target_pin'), 'result', `model_${modelId}_reply_target_pin_must_be_server_owned`);
      }
    });
  } finally {
    if (previousWorkerId == null) {
      delete process.env.DY_UI_SERVER_WORKER_ID;
    } else {
      process.env.DY_UI_SERVER_WORKER_ID = previousWorkerId;
    }
  }
  return { key: 'all_seeded_dual_bus_apps_materialize_server_owned_routes', status: 'PASS' };
}

async function test_importer_rejects_bundle_route_reply_to_and_missing_endpoint() {
  const zip = new AdmZip(new URL('test_files/minimal_submit_dual_bus.zip', repoRoot).pathname);
  const payload = JSON.parse(zip.getEntry('app_payload.json').getData().toString('utf8'));
  await withServerState(async (state) => {
    const withReplyTo = [
      ...payload,
      { id: 0, p: 0, r: 0, c: 0, k: 'route', t: 'json', v: { reply_to: { worker_id: 'attacker', model_id: 1, pin: 'result' } } },
    ];
    state.cacheUploadedMediaForTest('mxc://localhost/0362-reply-to', {
      buffer: buildZipBuffer(withReplyTo),
      contentType: 'application/zip',
      filename: 'reply-to.zip',
      userId: '@manual:localhost',
    });
    const replyResult = state.runtime.hostApi.slideImportAppFromMxc('mxc://localhost/0362-reply-to');
    assert.equal(replyResult.ok, false, 'importer_must_reject_bundle_reply_to');
    assert.equal(replyResult.detail, 'bundle_must_not_declare_route_reply_to', 'reply_to_rejection_must_be_explicit');

    const missingEndpoint = payload.filter((record) => record.k !== 'remote_bus_endpoint_v1');
    state.cacheUploadedMediaForTest('mxc://localhost/0362-missing-endpoint', {
      buffer: buildZipBuffer(missingEndpoint),
      contentType: 'application/zip',
      filename: 'missing-endpoint.zip',
      userId: '@manual:localhost',
    });
    const endpointResult = state.runtime.hostApi.slideImportAppFromMxc('mxc://localhost/0362-missing-endpoint');
    assert.equal(endpointResult.ok, false, 'host_egress_must_require_remote_endpoint');
    assert.equal(endpointResult.detail, 'remote_bus_endpoint_required_for_host_egress', 'missing_endpoint_rejection_must_be_explicit');

    const missingPins = payload.map((record) => (
      record.k === 'dual_bus_model'
        ? { ...record, v: { mode: 'imported_host_egress' } }
        : record
    ));
    state.cacheUploadedMediaForTest('mxc://localhost/0362-missing-pins', {
      buffer: buildZipBuffer(missingPins),
      contentType: 'application/zip',
      filename: 'missing-pins.zip',
      userId: '@manual:localhost',
    });
    const pinsResult = state.runtime.hostApi.slideImportAppFromMxc('mxc://localhost/0362-missing-pins');
    assert.equal(pinsResult.ok, false, 'host_egress_must_require_explicit_public_pins');
    assert.equal(pinsResult.detail, 'dual_bus_model_egress_pins_required', 'missing_pins_rejection_must_be_explicit');
  });
  return { key: 'importer_rejects_bundle_route_reply_to_and_missing_endpoint', status: 'PASS' };
}

async function test_importer_rejects_wrong_zip_shape_and_removed_pin_connect_model() {
  const zip = new AdmZip(new URL('test_files/minimal_submit_dual_bus.zip', repoRoot).pathname);
  const payload = JSON.parse(zip.getEntry('app_payload.json').getData().toString('utf8'));
  await withServerState(async (state) => {
    state.cacheUploadedMediaForTest('mxc://localhost/0362-wrong-name', {
      buffer: buildNamedZipBuffer([{ name: 'wrong.json', content: JSON.stringify(payload) }]),
      contentType: 'application/zip',
      filename: 'wrong-name.zip',
      userId: '@manual:localhost',
    });
    const wrongName = state.runtime.hostApi.slideImportAppFromMxc('mxc://localhost/0362-wrong-name');
    assert.equal(wrongName.ok, false, 'importer_must_reject_json_with_wrong_name');
    assert.equal(wrongName.detail, 'zip_must_contain_exactly_one_app_payload_json', 'wrong_name_rejection_must_be_explicit');

    state.cacheUploadedMediaForTest('mxc://localhost/0362-sidecar', {
      buffer: buildNamedZipBuffer([
        { name: 'app_payload.json', content: JSON.stringify(payload) },
        { name: 'manifest.json', content: JSON.stringify({ sidecar: true }) },
      ]),
      contentType: 'application/zip',
      filename: 'sidecar.zip',
      userId: '@manual:localhost',
    });
    const sidecar = state.runtime.hostApi.slideImportAppFromMxc('mxc://localhost/0362-sidecar');
    assert.equal(sidecar.ok, false, 'importer_must_reject_sidecar_files');
    assert.equal(sidecar.detail, 'zip_must_contain_exactly_one_app_payload_json', 'sidecar_rejection_must_be_explicit');

    state.cacheUploadedMediaForTest('mxc://localhost/0362-unsafe-sidecar', {
      buffer: buildNamedZipBuffer([
        { name: 'app_payload.json', content: JSON.stringify(payload) },
        { name: '../manifest.json', content: JSON.stringify({ sidecar: true }) },
      ]),
      contentType: 'application/zip',
      filename: 'unsafe-sidecar.zip',
      userId: '@manual:localhost',
    });
    const unsafeSidecar = state.runtime.hostApi.slideImportAppFromMxc('mxc://localhost/0362-unsafe-sidecar');
    assert.equal(unsafeSidecar.ok, false, 'importer_must_reject_unsafe_sidecar_files');
    assert.equal(unsafeSidecar.detail, 'zip_must_contain_exactly_one_app_payload_json', 'unsafe_sidecar_rejection_must_be_explicit');

    const removedConnectModel = [
      ...payload,
      { id: 0, p: 0, r: 0, c: 0, k: 'removed_route', t: 'pin.connect.model', v: [] },
    ];
    state.cacheUploadedMediaForTest('mxc://localhost/0362-connect-model', {
      buffer: buildZipBuffer(removedConnectModel),
      contentType: 'application/zip',
      filename: 'connect-model.zip',
      userId: '@manual:localhost',
    });
    const connectModel = state.runtime.hostApi.slideImportAppFromMxc('mxc://localhost/0362-connect-model');
    assert.equal(connectModel.ok, false, 'importer_must_fail_fast_on_removed_pin_connect_model');
    assert.equal(connectModel.detail, 'forbidden_label_type:pin.connect.model', 'connect_model_rejection_must_be_explicit');
  });
  return { key: 'importer_rejects_wrong_zip_shape_and_removed_pin_connect_model', status: 'PASS' };
}

const tests = [
  test_ssot_freezes_self_described_route_contract,
  test_user_docs_explain_provider_local_identity_split_and_re_wiring,
  test_iteration_plan_requires_review_approval_and_server_owned_reply_to,
  test_saved_zip_is_single_modeltable_records_payload,
  test_local_persisted_asset_sync_uses_current_provider_patch,
  test_seeded_minimal_submit_app_has_no_static_route_residue,
  test_all_seeded_dual_bus_apps_use_current_route_contract,
  test_seeded_minimal_submit_app_materializes_server_owned_route,
  test_all_seeded_dual_bus_apps_materialize_server_owned_routes,
  test_importer_rejects_bundle_route_reply_to_and_missing_endpoint,
  test_importer_rejects_wrong_zip_shape_and_removed_pin_connect_model,
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  try {
    const result = await test();
    console.log(`[${result.status}] ${result.key}`);
    passed += 1;
  } catch (error) {
    console.log(`[FAIL] ${test.name}: ${error.stack || error.message}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
