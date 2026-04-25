import { readFileSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const file = readFileSync(path.join(repoRoot, 'scripts/ops/_deploy_common.sh'), 'utf8');

assert.match(file, /stringData:/, 'update_k8s_secrets must apply explicit Secret YAML via stringData to avoid generator drift');
assert.match(file, /MODELTABLE_PATCH_JSON:\s*>-/, 'generated secrets must expose MODELTABLE_PATCH_JSON as the single bootstrap payload');
assert.match(file, /ui_server_matrix_bootstrap_v0/, 'ui-server secret must embed the ui-server bootstrap patch');
assert.match(file, /mbr_worker_bootstrap_v0/, 'mbr-worker secret must embed the mbr bootstrap patch');
assert.match(
  file,
  /kubectl delete secret "\$secret_name" -n "\$ns" --ignore-not-found/,
  'update_k8s_secrets must delete existing secrets before apply so legacy Matrix keys are purged instead of lingering as compatibility residue',
);

console.log('test_0168_update_k8s_secrets_manifest: PASS');
