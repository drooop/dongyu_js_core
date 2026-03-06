import { spawnSync } from 'node:child_process';
import path from 'node:path';

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const result = spawnSync('npm', ['-C', 'packages/ui-model-demo-frontend', 'run', 'build'], {
  cwd: repoRoot,
  encoding: 'utf8',
});

if (result.status !== 0) {
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  throw new Error('frontend_build_must_pass');
}

console.log('test_0166_frontend_build_runtime_guard: PASS');
