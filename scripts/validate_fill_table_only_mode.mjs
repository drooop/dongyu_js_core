#!/usr/bin/env node
/**
 * Fill-Table-Only guard.
 *
 * Purpose:
 * - Enforce "fill-table only" implementation mode when explicitly enabled.
 * - Reject non-table implementation changes and force capability-gap reporting.
 *
 * Default behavior:
 * - If mode is not enabled, print SKIP and exit 0.
 * - If enabled, inspect changed files and fail when paths violate policy.
 *
 * Usage:
 *   node scripts/validate_fill_table_only_mode.mjs --mode fill-table-only
 *   FILL_TABLE_ONLY=1 node scripts/validate_fill_table_only_mode.mjs
 *   node scripts/validate_fill_table_only_mode.mjs --mode fill-table-only --paths "a,b,c"
 *   node scripts/validate_fill_table_only_mode.mjs --staged
 */

import { execFileSync } from 'node:child_process';

function parseArgs(argv) {
  const out = {
    mode: '',
    paths: '',
    staged: false,
    quiet: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--mode' && i + 1 < argv.length) {
      out.mode = String(argv[i + 1] || '');
      i += 1;
      continue;
    }
    if (arg === '--paths' && i + 1 < argv.length) {
      out.paths = String(argv[i + 1] || '');
      i += 1;
      continue;
    }
    if (arg === '--staged') {
      out.staged = true;
      continue;
    }
    if (arg === '--quiet') {
      out.quiet = true;
      continue;
    }
  }
  return out;
}

function sh(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8' }).trim();
}

function shOptional(cmd, args) {
  try {
    return sh(cmd, args);
  } catch (_) {
    return '';
  }
}

function splitLines(text) {
  return String(text || '')
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
}

function getChangedFilesFromGit() {
  const unstaged = splitLines(sh('git', ['diff', '--name-only', '--relative']));
  const staged = splitLines(sh('git', ['diff', '--cached', '--name-only', '--relative']));
  const untracked = splitLines(sh('git', ['ls-files', '--others', '--exclude-standard']));
  const set = new Set([...unstaged, ...staged, ...untracked]);
  return [...set].sort();
}

function getStagedFilesFromGit() {
  return splitLines(shOptional('git', ['diff', '--cached', '--name-only', '--relative'])).sort();
}

function isEnabled(modeArg) {
  if (String(modeArg || '').toLowerCase() === 'fill-table-only') return true;
  const env = String(process.env.FILL_TABLE_ONLY || '').toLowerCase();
  if (env === '1' || env === 'true' || env === 'yes' || env === 'on') return true;
  const cfg = String(shOptional('git', ['config', '--bool', '--get', 'dongyu.fillTableOnly'])).toLowerCase();
  return cfg === 'true';
}

const ALLOW_PATTERNS = [
  /^\.githooks\//,
  /^deploy\/sys-v1ns\/.*\.json$/,
  /^packages\/worker-base\/system-models\/.*\.json$/,
  /^docs\//,
  /^scripts\/fill_table_only_mode_ctl\.mjs$/,
  /^scripts\/ops\/install_git_hooks\.sh$/,
  /^scripts\/tests\/.*\.mjs$/,
  /^scripts\/validate_.*\.mjs$/,
];

function isAllowedPath(filePath) {
  return ALLOW_PATTERNS.some((re) => re.test(filePath));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!isEnabled(args.mode)) {
    process.stdout.write('[SKIP] fill-table-only mode not enabled\n');
    process.exit(0);
  }

  const changedFiles = args.paths
    ? args.paths.split(',').map((x) => x.trim()).filter(Boolean).sort()
    : (args.staged ? getStagedFilesFromGit() : getChangedFilesFromGit());

  if (changedFiles.length === 0) {
    process.stdout.write('[PASS] fill-table-only guard (no file changes)\n');
    process.exit(0);
  }

  const violations = changedFiles.filter((fp) => !isAllowedPath(fp));

  if (violations.length > 0) {
    process.stdout.write('[FAIL] fill-table-only guard\n');
    process.stdout.write('reason=non_table_implementation_change_detected\n');
    process.stdout.write('violations:\n');
    for (const fp of violations) {
      process.stdout.write(`- ${fp}\n`);
    }
    process.stdout.write('required_action=write_runtime_capability_gap_report\n');
    process.exit(1);
  }

  if (!args.quiet) {
    process.stdout.write('[PASS] fill-table-only guard\n');
    process.stdout.write(`checked_files=${changedFiles.length}\n`);
  }
}

main();
