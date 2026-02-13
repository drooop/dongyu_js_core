import assert from 'node:assert';
import { spawnSync } from 'node:child_process';

function run(cmd, args, options = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...options });
  return {
    code: r.status ?? 1,
    out: `${r.stdout || ''}${r.stderr || ''}`,
  };
}

function currentBranch() {
  const r = run('git', ['symbolic-ref', '--quiet', '--short', 'HEAD']);
  return r.code === 0 ? r.out.trim() : '';
}

function assertIncludes(text, needle) {
  assert(String(text).includes(needle), `expected output to include: ${needle}`);
}

function test_precommit_silent_on_non_ft_branch() {
  const b = currentBranch();
  assert(b && !/(^|-)ft(-|$)/.test(b), `test must run on non-ft branch, got: ${b}`);
  const r = run('bash', ['.githooks/pre-commit']);
  assert.strictEqual(r.code, 0, 'pre-commit should exit 0 on non-ft branch');
  assert.strictEqual(r.out.trim(), '', 'pre-commit should be silent on non-ft branch');
  return { key: 'precommit_silent_on_non_ft_branch', status: 'PASS' };
}

const tests = [test_precommit_silent_on_non_ft_branch];

let passed = 0;
let failed = 0;
for (const t of tests) {
  try {
    const r = t();
    console.log(`[${r.status}] ${r.key}`);
    passed += 1;
  } catch (err) {
    console.log(`[FAIL] ${t.name}: ${err.message}`);
    failed += 1;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
