import { readFileSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const file = readFileSync(path.join(repoRoot, 'scripts/ops/_deploy_common.sh'), 'utf8');

assert.match(file, /stringData:/, 'update_k8s_secrets must apply explicit Secret YAML via stringData to avoid generator drift');
assert.match(file, /MATRIX_MBR_PASSWORD:\s*"\$\{SERVER_PASSWORD\}"/, 'ui-server-secret manifest must include MATRIX_MBR_PASSWORD');
assert.match(file, /MATRIX_MBR_ACCESS_TOKEN:\s*"\$\{server_token\}"/, 'ui-server-secret manifest must include MATRIX_MBR_ACCESS_TOKEN');
assert.match(file, /MATRIX_MBR_BOT_ACCESS_TOKEN:\s*"\$\{mbr_token\}"/, 'mbr-worker-secret manifest must include MATRIX_MBR_BOT_ACCESS_TOKEN');

console.log('test_0168_update_k8s_secrets_manifest: PASS');
