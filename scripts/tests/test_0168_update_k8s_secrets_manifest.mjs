import { readFileSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const file = readFileSync(path.join(repoRoot, 'scripts/ops/_deploy_common.sh'), 'utf8');

assert.match(file, /replace_or_create_secret_from_literals\(\)/, 'update_k8s_secrets must use the create-or-replace Secret helper');
assert.match(file, /kubectl -n "\$ns" create secret generic "\$secret_name"/, 'generated secrets must be built through kubectl create secret generic');
assert.match(file, /kubectl -n "\$ns" replace -f -/, 'existing generated secrets must be replaced without kubectl apply last-applied annotations');
assert.doesNotMatch(file, /stringData:/, 'generated secrets must not use stringData because kubectl apply can persist plaintext last-applied annotations');
assert.doesNotMatch(file, /kubectl apply -f -/, 'generated secrets must not be piped through kubectl apply');
assert.match(file, /--from-literal="MODELTABLE_PATCH_JSON=/, 'generated secrets must expose MODELTABLE_PATCH_JSON as the bootstrap payload');
assert.match(file, /ui_server_matrix_bootstrap_v0/, 'ui-server secret must embed the ui-server bootstrap patch');
assert.match(file, /mbr_worker_bootstrap_v0/, 'mbr-worker secret must embed the mbr bootstrap patch');
assert.match(
  file,
  /--from-literal="DY_OIDC_CLIENT_ID=/,
  'ui-server secret must include OIDC deployment settings used by the Kubernetes manifest',
);

console.log('test_0168_update_k8s_secrets_manifest: PASS');
