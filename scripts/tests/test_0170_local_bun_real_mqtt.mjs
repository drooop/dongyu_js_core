import assert from 'node:assert';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const result = spawnSync('bun', ['scripts/run_worker_remote_v1.mjs', 'deploy/sys-v1ns/remote-worker/patches'], {
  cwd: repoRoot,
  encoding: 'utf8',
  timeout: 5000,
  env: {
    ...process.env,
    DY_MQTT_HOST: '127.0.0.1',
    DY_MQTT_PORT: '1883',
    DY_MQTT_USER: 'u',
    DY_MQTT_PASS: 'p',
    WORKER_ID: '0170test',
  },
});

assert.notStrictEqual(result.error && result.error.code, 'ENOENT', 'bun must be installed for this test');
assert.doesNotMatch(`${result.stdout || ''}\n${result.stderr || ''}`, /mqtt_package_unavailable/, 'run_worker_remote_v1 must not throw mqtt_package_unavailable');
assert.match(result.stdout || '', /MQTT startMqttLoop: \{"status":"running"\}/, 'run_worker_remote_v1 should reach running status before timeout');
assert(
  result.signal === 'SIGTERM' || result.signal === 'SIGKILL' || result.status === 0,
  `worker probe should either keep running until timeout or exit 0\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
);

console.log('test_0170_local_bun_real_mqtt: PASS');
