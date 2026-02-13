#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const guardScript = path.resolve(__dirname, 'validate_fill_table_only_mode.mjs');

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: process.env,
    ...options,
  });
  return {
    code: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function print(out) {
  if (out) process.stdout.write(out);
}

function printErr(out) {
  if (out) process.stderr.write(out);
}

function getModeEnabled() {
  const res = run('git', ['config', '--bool', '--get', 'dongyu.fillTableOnly']);
  return String(res.stdout).trim().toLowerCase() === 'true';
}

function setModeEnabled(enabled) {
  if (enabled) {
    const res = run('git', ['config', '--local', 'dongyu.fillTableOnly', 'true']);
    if (res.code !== 0) {
      printErr(res.stderr);
      process.exit(res.code);
    }
    process.stdout.write('fill_table_only=enabled\n');
    process.exit(0);
  }
  const unsetRes = run('git', ['config', '--local', '--unset', 'dongyu.fillTableOnly']);
  // --unset returns code 5 when key doesn't exist; treat as success.
  if (unsetRes.code !== 0 && unsetRes.code !== 5 && !/No such section or key/i.test(unsetRes.stderr)) {
    printErr(unsetRes.stderr);
    process.exit(unsetRes.code);
  }
  process.stdout.write('fill_table_only=disabled\n');
  process.exit(0);
}

function status() {
  process.stdout.write(`fill_table_only=${getModeEnabled() ? 'enabled' : 'disabled'}\n`);
  process.exit(0);
}

function check(extraArgs) {
  const args = [guardScript];
  const hasScope = extraArgs.includes('--paths') || extraArgs.includes('--staged');
  if (!hasScope) args.push('--staged');
  args.push(...extraArgs);
  const res = run(process.execPath, args);
  print(res.stdout);
  printErr(res.stderr);
  process.exit(res.code);
}

function usage() {
  process.stdout.write(
    [
      'Usage:',
      '  node scripts/fill_table_only_mode_ctl.mjs on',
      '  node scripts/fill_table_only_mode_ctl.mjs off',
      '  node scripts/fill_table_only_mode_ctl.mjs status',
      '  node scripts/fill_table_only_mode_ctl.mjs check [--staged|--paths "a,b"] [--quiet]',
      '',
      'Control key: git config --local dongyu.fillTableOnly true|<unset>',
    ].join('\n') + '\n',
  );
  process.exit(1);
}

const argv = process.argv.slice(2);
const cmd = argv[0] || 'status';
const rest = argv.slice(1);

if (cmd === 'on') setModeEnabled(true);
if (cmd === 'off') setModeEnabled(false);
if (cmd === 'status') status();
if (cmd === 'check') check(rest);
usage();
