import { readFileSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const wrapper = readFileSync(path.join(repoRoot, 'scripts/ops/deploy_cloud.sh'), 'utf8');
const file = wrapper.includes('deploy_cloud_full.sh')
  ? readFileSync(path.join(repoRoot, 'scripts/ops/deploy_cloud_full.sh'), 'utf8')
  : wrapper;

assert.match(file, /exec_in_running_ui_server_pod\(\)/, 'deploy_cloud.sh must define exec_in_running_ui_server_pod() retry helper');
assert.match(file, /while \[ \$attempt -le \$max_attempts \]/, 'retry helper must retry across pod turnover');
assert.match(file, /container_file_sha256\(\)[\s\S]*exec_in_running_ui_server_pod/, 'container_file_sha256 must use retrying ui-server exec helper');
if (/verify_ui_prompt_guard_markers\(\)/.test(file)) {
  assert.match(file, /verify_ui_prompt_guard_markers\(\)[\s\S]*exec_in_running_ui_server_pod/, 'prompt guard verification must use retrying ui-server exec helper');
}
assert.match(file, /verify_ui_server_snapshot_runtime\(\)[\s\S]*exec_in_running_ui_server_pod/, 'snapshot verification must use retrying ui-server exec helper');

console.log('test_0169_ui_server_exec_retry: PASS');
