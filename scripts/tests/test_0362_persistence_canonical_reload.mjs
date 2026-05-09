#!/usr/bin/env bun

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const repoRoot = new URL('../../', import.meta.url);

function wait(ms = 180) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withServerState(dbPath, fn, options = {}) {
  const previous = {
    dyAuth: process.env.DY_AUTH,
    persistedAssetRoot: process.env.DY_PERSISTED_ASSET_ROOT,
    workerId: process.env.DY_UI_SERVER_WORKER_ID,
    workspace: process.env.WORKER_BASE_WORKSPACE,
    dataRoot: process.env.WORKER_BASE_DATA_ROOT,
    docsRoot: process.env.DOCS_ROOT,
    staticRoot: process.env.STATIC_PROJECTS_ROOT,
  };
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0362-persist-state-'));
  process.env.DY_AUTH = '0';
  process.env.DY_PERSISTED_ASSET_ROOT = '';
  process.env.DY_UI_SERVER_WORKER_ID = options.workerId || 'ui-server-0362-persist';
  process.env.WORKER_BASE_WORKSPACE = `it0362_persist_${Date.now()}`;
  process.env.WORKER_BASE_DATA_ROOT = join(tempRoot, 'runtime');
  process.env.DOCS_ROOT = join(tempRoot, 'docs');
  process.env.STATIC_PROJECTS_ROOT = join(tempRoot, 'static');
  const { createServerState } = await import(new URL('packages/ui-model-demo-server/server.mjs', repoRoot));
  const state = createServerState({ dbPath });
  try {
    if (options.activate !== false) {
      await state.activateRuntimeMode('running');
    }
    return await fn(state);
  } finally {
    if (state.runtime && state.runtime.persistence && typeof state.runtime.persistence.close === 'function') {
      state.runtime.persistence.close();
    }
    rmSync(tempRoot, { recursive: true, force: true });
    const restore = (key, value) => {
      if (value == null) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    };
    restore('DY_AUTH', previous.dyAuth);
    restore('DY_PERSISTED_ASSET_ROOT', previous.persistedAssetRoot);
    restore('DY_UI_SERVER_WORKER_ID', previous.workerId);
    restore('WORKER_BASE_WORKSPACE', previous.workspace);
    restore('WORKER_BASE_DATA_ROOT', previous.dataRoot);
    restore('DOCS_ROOT', previous.docsRoot);
    restore('STATIC_PROJECTS_ROOT', previous.staticRoot);
  }
}

function payloadFor(modelId) {
  return [
    { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'seeded.submit.v1' },
    { id: 0, p: 0, r: 0, c: 0, k: 'message_text', t: 'str', v: `persisted canonical ${modelId}` },
  ];
}

async function test_seeded_dual_bus_contract_overrides_persisted_removed_pin_type() {
  const tempRoot = mkdtempSync(join(tmpdir(), 'dy-0362-persist-db-'));
  const dbPath = join(tempRoot, 'modeltable.sqlite');
  try {
    await withServerState(dbPath, async (state) => {
      for (const modelId of [100, 1010, 1019]) {
        const model = state.runtime.getModel(modelId);
        assert.ok(model, `model_${modelId}_missing_before_stale_seed`);
        state.runtime.addLabel(model, 0, 0, 0, { k: 'submit', t: 'pin.table.out', v: null });
      }
    }, { activate: false });

    await withServerState(dbPath, async (state) => {
      const published = [];
      state.programEngine.matrixAdapter = { publish: async (packet) => published.push(packet) };
      state.programEngine.matrixRoomId = '!persisted-canonical:localhost';
      state.programEngine.matrixDmPeerUserId = '@mbr:localhost';

      for (const modelId of [100, 1010, 1019]) {
        const model = state.runtime.getModel(modelId);
        assert.ok(model, `model_${modelId}_missing_after_reload`);
        const root = state.runtime.getCell(model, 0, 0, 0);
        assert.equal(root.labels.get('submit')?.t, 'pin.out', `model_${modelId}_must_reload_current_submit_pin_type`);
        assert.ok(
          Array.isArray(root.labels.get('host_egress_generated_model0_labels')?.v),
          `model_${modelId}_must_materialize_host_egress_after_canonical_reload`,
        );
        state.runtime.addLabel(model, 0, 0, 0, { k: 'submit', t: 'pin.out', v: payloadFor(modelId) });
        await state.programEngine.tick();
        await wait();
      }

      const byModel = new Map(published.map((packet) => [packet.source_model_id, packet]));
      for (const modelId of [100, 1010, 1019]) {
        const packet = byModel.get(modelId);
        assert.ok(packet, `model_${modelId}_must_publish_after_persisted_reload`);
        assert.equal(packet.pin, 'submit', `model_${modelId}_must_publish_public_submit_pin`);
        assert.deepEqual(packet.route?.to, { worker_id: 'RE', model_id: modelId, pin: 'submit' });
        assert.deepEqual(packet.route?.reply_to, { worker_id: 'ui-server-0362-persist', model_id: modelId, pin: 'result' });
      }
    });
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
  return { key: 'seeded_dual_bus_contract_overrides_persisted_removed_pin_type', status: 'PASS' };
}

const tests = [
  test_seeded_dual_bus_contract_overrides_persisted_removed_pin_type,
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
      console.log(`[FAIL] ${test.name}: ${error.stack || error.message}`);
      failed += 1;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
  process.exit(failed > 0 ? 1 : 0);
})();
