import { readFileSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);

function read(relPath) {
  return readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function mustContain(haystack, needle, message) {
  assert.ok(haystack.includes(needle), message + `\nmissing: ${needle}`);
}

const deployCommon = read('scripts/ops/_deploy_common.sh');
const cloudWorkers = read('k8s/cloud/workers.yaml');
const localWorkers = read('k8s/local/workers.yaml');

assert.ok(
  /MODELTABLE_PATCH_JSON/.test(deployCommon),
  'ui-server bootstrap must be delivered through MODELTABLE_PATCH_JSON secret material, not direct Matrix env vars',
);

for (const [name, content] of [
  ['k8s/cloud/workers.yaml', cloudWorkers],
  ['k8s/local/workers.yaml', localWorkers],
]) {
  mustContain(content, '- name: MODELTABLE_PATCH_JSON', `${name} must declare MODELTABLE_PATCH_JSON env for ui-server`);
  mustContain(content, 'key: MODELTABLE_PATCH_JSON', `${name} must source MODELTABLE_PATCH_JSON from ui-server-secret`);
}

console.log('test_0167_ui_server_matrix_token_auth: PASS');
