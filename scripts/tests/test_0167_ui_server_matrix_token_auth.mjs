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
  /--from-literal="MATRIX_MBR_ACCESS_TOKEN=\$[A-Za-z_][A-Za-z0-9_]*"/.test(deployCommon)
    || /MATRIX_MBR_ACCESS_TOKEN:\s*"\$\{server_token\}"/.test(deployCommon),
  'ui-server-secret must include drop user access token so ui-server can avoid password login rate limits',
);

for (const [name, content] of [
  ['k8s/cloud/workers.yaml', cloudWorkers],
  ['k8s/local/workers.yaml', localWorkers],
]) {
  mustContain(content, '- name: MATRIX_MBR_ACCESS_TOKEN', `${name} must declare MATRIX_MBR_ACCESS_TOKEN env for ui-server`);
  mustContain(content, 'key: MATRIX_MBR_ACCESS_TOKEN', `${name} must source MATRIX_MBR_ACCESS_TOKEN from ui-server-secret`);
}

console.log('test_0167_ui_server_matrix_token_auth: PASS');
