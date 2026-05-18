import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { WORKSPACE_ENTRY_MODEL_IDS } from '../../packages/ui-model-demo-frontend/src/model_ids.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

function labelsAt(patch, modelId, p = 0, r = 0, c = 0) {
  const labels = new Map();
  for (const record of patch.records || []) {
    if (record.op === 'add_label'
      && record.model_id === modelId
      && record.p === p
      && record.r === r
      && record.c === c) {
      labels.set(record.k, record);
    }
  }
  return labels;
}

function main() {
  const expectedIds = [-103, -23, 100, 1007, 1011, 1030, 1050, 1051];
  assert.deepEqual(
    [...WORKSPACE_ENTRY_MODEL_IDS],
    expectedIds,
    'Workspace entry allowlist must exactly match the cleanup request',
  );

  const docsCatalog = readJson('packages/worker-base/system-models/docs_catalog_ui.json');
  const docsRoot = labelsAt(docsCatalog, -23);
  assert.equal(docsRoot.get('app_name')?.v, 'Docs', 'Docs must be a visible Workspace entry');
  assert.equal(docsRoot.get('source_worker')?.v, 'system', 'Docs must carry source metadata');

  const workspaceModels = readJson('packages/worker-base/system-models/workspace_positive_models.json');
  const threeRoot = labelsAt(workspaceModels, 1007);
  assert.equal(threeRoot.get('app_name')?.v, 'Three Scene', 'Three Scene must not keep the historical iteration prefix');

  const registryLabel = labelsAt(workspaceModels, -2).get('ws_apps_registry');
  assert.ok(Array.isArray(registryLabel?.v), 'seeded ws_apps_registry must be an array');
  assert.deepEqual(
    registryLabel.v.map((entry) => entry.model_id),
    expectedIds,
    'seeded Workspace registry must only list the retained entries',
  );

  const serverSource = fs.readFileSync(path.join(repoRoot, 'packages/ui-model-demo-server/server.mjs'), 'utf8');
  const localSource = fs.readFileSync(path.join(repoRoot, 'packages/ui-model-demo-frontend/src/demo_modeltable.js'), 'utf8');
  assert.match(serverSource, /WORKSPACE_ENTRY_MODEL_IDS/, 'remote server registry must use the shared allowlist');
  assert.match(serverSource, /allowedWorkspaceEntryIds\.has\(modelId\)/, 'remote server registry must filter by allowlist');
  assert.match(localSource, /WORKSPACE_ENTRY_MODEL_IDS/, 'local demo registry must use the shared allowlist');
  assert.match(localSource, /allowedWorkspaceEntryIds\.has\(modelId\)/, 'local demo registry must filter by allowlist');

  console.log('test_0382_workspace_entry_cleanup_contract: PASS');
}

main();
