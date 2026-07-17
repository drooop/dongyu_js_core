#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEFAULT_REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_MANIFEST = 'docs/ssot/contract_surface_manifest.json';

const REQUIRED_ARRAY_FIELDS = [
  'source_refs',
  'ssot_files',
  'implementation_files',
  'test_files',
  'verification_commands',
  'owner_iterations',
];

const OPTIONAL_ARRAY_FIELDS = [
  'decision_files',
  'evidence_files',
  'open_findings',
];

const FILE_ANCHOR_FIELDS = [
  'ssot_files',
  'implementation_files',
  'test_files',
];

const FILE_REFERENCE_FIELDS = [
  ...FILE_ANCHOR_FIELDS,
  'decision_files',
  'evidence_files',
];

function repoPath(repoRoot, relativePath) {
  return path.resolve(repoRoot, relativePath);
}

function isContainedRelativePath(relative) {
  return relative !== ''
    && relative !== '..'
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative);
}

function isWithinRepo(repoRoot, relativePath) {
  const relative = path.relative(repoRoot, repoPath(repoRoot, relativePath));
  return isContainedRelativePath(relative);
}

function resolveRepoOutput(repoRoot, candidate, label) {
  if (typeof candidate !== 'string' || candidate.trim() === '') {
    throw new Error(`${label} output must be a non-empty path`);
  }
  if (path.isAbsolute(candidate)) {
    throw new Error(`${label} output must be repo-relative: ${candidate}`);
  }
  const absolute = repoPath(repoRoot, candidate);
  const relative = path.relative(repoRoot, absolute);
  if (!isContainedRelativePath(relative)) {
    throw new Error(`${label} output must stay within repository root: ${candidate}`);
  }
  return absolute;
}

function parseVerificationCommand(command) {
  const match = /^node (?:(--check) )?([A-Za-z0-9_./-]+\.mjs)$/u.exec(command);
  if (!match) return null;
  return {
    kind: match[1] ? 'syntax' : 'test',
    target: match[2],
  };
}

function normalizeHeading(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[`*_~]/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

function localSourceRef(value) {
  const separator = value.indexOf('#');
  const file = separator === -1 ? value : value.slice(0, separator);
  if (!file.startsWith('docs/') && !file.startsWith('scripts/')) return null;
  return { file, heading: separator === -1 ? '' : value.slice(separator + 1) };
}

function unique(values) {
  return [...new Set(values)];
}

function sortedObject(value) {
  if (Array.isArray(value)) return value.map(sortedObject);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortedObject(value[key])]));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatList(values) {
  return values.length ? values.map((value) => `\`${value}\``).join('<br>') : '-';
}

function formatCommandList(values) {
  return values.length ? values.map((value) => `\`${value}\``).join('<br>') : '-';
}

function formatFindings(findings) {
  return findings.length
    ? findings.map((finding) => `\`${finding.id}\` (${finding.class})`).join('<br>')
    : '-';
}

function readUtf8(filePath) {
  return readFileSync(filePath, 'utf8');
}

export function loadContractManifest(manifestPath = path.join(DEFAULT_REPO_ROOT, DEFAULT_MANIFEST)) {
  return JSON.parse(readUtf8(manifestPath));
}

export function validateContractManifest(manifest, { repoRoot = DEFAULT_REPO_ROOT } = {}) {
  const errors = [];
  const warnings = [];

  if (!manifest || typeof manifest !== 'object') {
    return { errors: ['manifest must be an object'], warnings };
  }
  if (manifest.schema !== 'contract_surface_manifest.v2') {
    errors.push('manifest.schema must be contract_surface_manifest.v2');
  }
  for (const field of ['generated_summary', 'generated_index']) {
    if (
      typeof manifest[field] !== 'string'
      || path.isAbsolute(manifest[field])
      || !isWithinRepo(repoRoot, manifest[field])
    ) {
      errors.push(`manifest.${field} must be a repo-relative path`);
    }
  }
  if (!Array.isArray(manifest.contracts) || manifest.contracts.length === 0) {
    errors.push('manifest.contracts must be a non-empty array');
    return { errors, warnings };
  }

  const sourceIds = new Set();
  const sourceClasses = new Map();
  if (
    typeof manifest.source_manifest !== 'string'
    || path.isAbsolute(manifest.source_manifest)
    || !isWithinRepo(repoRoot, manifest.source_manifest)
  ) {
    errors.push('manifest.source_manifest must be a repo-relative path');
  } else if (!existsSync(repoPath(repoRoot, manifest.source_manifest))) {
    errors.push(`manifest.source_manifest does not exist: ${manifest.source_manifest}`);
  } else {
    const sourceManifest = JSON.parse(readUtf8(repoPath(repoRoot, manifest.source_manifest)));
    for (const source of asArray(sourceManifest.documents)) {
      sourceIds.add(source.id);
      sourceClasses.set(source.id, source.authority_class);
    }
  }

  const ids = new Set();
  const findingIds = new Set();
  for (const [index, contract] of manifest.contracts.entries()) {
    const label = contract && contract.contract_id ? contract.contract_id : `contracts[${index}]`;
    if (!contract || typeof contract !== 'object') {
      errors.push(`${label}: contract must be an object`);
      continue;
    }
    if (!contract.contract_id || typeof contract.contract_id !== 'string') {
      errors.push(`${label}: contract_id is required`);
    } else if (ids.has(contract.contract_id)) {
      errors.push(`${label}: duplicate contract_id`);
    } else {
      ids.add(contract.contract_id);
    }
    for (const field of ['status', 'risk_level', 'notes']) {
      if (!contract[field] || typeof contract[field] !== 'string') {
        errors.push(`${label}: ${field} must be a non-empty string`);
      }
    }
    for (const field of REQUIRED_ARRAY_FIELDS) {
      if (!Array.isArray(contract[field]) || contract[field].length === 0) {
        errors.push(`${label}: ${field} must be a non-empty array`);
      } else if (contract[field].some((item) => typeof item !== 'string' || item.trim() === '')) {
        errors.push(`${label}: ${field} must contain only non-empty strings`);
      }
    }
    for (const field of OPTIONAL_ARRAY_FIELDS) {
      if (!Array.isArray(contract[field])) {
        errors.push(`${label}: ${field} must be an array`);
      }
    }
    if (!contract.anchor_terms || typeof contract.anchor_terms !== 'object' || Array.isArray(contract.anchor_terms)) {
      errors.push(`${label}: anchor_terms must be an object`);
    } else {
      for (const field of FILE_ANCHOR_FIELDS) {
        if (!Array.isArray(contract.anchor_terms[field]) || contract.anchor_terms[field].length === 0) {
          errors.push(`${label}: anchor_terms.${field} must be a non-empty array`);
        } else if (contract.anchor_terms[field].some((item) => typeof item !== 'string' || item.trim() === '')) {
          errors.push(`${label}: anchor_terms.${field} must contain only non-empty strings`);
        }
      }
    }
    for (const finding of asArray(contract.open_findings)) {
      if (!finding || typeof finding !== 'object' || typeof finding.id !== 'string' || typeof finding.class !== 'string') {
        errors.push(`${label}: open_findings must contain {id, class} objects`);
      } else if (findingIds.has(finding.id)) {
        errors.push(`${label}: duplicate open finding id: ${finding.id}`);
      } else {
        findingIds.add(finding.id);
      }
    }
    for (const field of FILE_REFERENCE_FIELDS) {
      for (const file of asArray(contract[field])) {
        if (path.isAbsolute(file)) {
          errors.push(`${label}: ${field} must use repo-relative paths: ${file}`);
        } else if (!isWithinRepo(repoRoot, file)) {
          errors.push(`${label}: ${field} escapes repository root: ${file}`);
        } else if (!existsSync(repoPath(repoRoot, file))) {
          errors.push(`${label}: missing ${field} file: ${file}`);
        }
      }
    }
    for (const source of asArray(contract.source_refs)) {
      const local = localSourceRef(source);
      if (!local) {
        if (!sourceIds.has(source)) errors.push(`${label}: unknown source_refs id: ${source}`);
        else if (sourceClasses.get(source) !== 'UpstreamConsensus') {
          errors.push(`${label}: source_refs id is not UpstreamConsensus: ${source}`);
        }
        continue;
      }
      if (!isWithinRepo(repoRoot, local.file)) {
        errors.push(`${label}: source_refs escapes repository root: ${source}`);
        continue;
      }
      const absolute = repoPath(repoRoot, local.file);
      if (!existsSync(absolute)) {
        errors.push(`${label}: source_refs file does not exist: ${source}`);
        continue;
      }
      if (local.heading) {
        const requested = normalizeHeading(local.heading);
        const headings = readUtf8(absolute)
          .split(/\r?\n/u)
          .filter((line) => /^#{1,6}\s+/u.test(line))
          .map((line) => normalizeHeading(line.replace(/^#{1,6}\s+/u, '')));
        if (!headings.some((heading) => heading === requested || heading.startsWith(`${requested}-`))) {
          errors.push(`${label}: source_refs heading not found: ${source}`);
        }
      }
    }
    for (const command of asArray(contract.verification_commands)) {
      const parsed = parseVerificationCommand(command);
      if (!parsed) {
        errors.push(`${label}: unsupported verification command: ${command}`);
      } else if (!isWithinRepo(repoRoot, parsed.target) || !existsSync(repoPath(repoRoot, parsed.target))) {
        errors.push(`${label}: verification target does not exist in repository: ${parsed.target}`);
      } else if (parsed.kind === 'test' && !asArray(contract.test_files).includes(parsed.target)) {
        errors.push(`${label}: verification target is not declared in test_files: ${parsed.target}`);
      } else if (parsed.kind === 'syntax' && !asArray(contract.implementation_files).includes(parsed.target)) {
        errors.push(`${label}: syntax verification target is not declared in implementation_files: ${parsed.target}`);
      }
    }
  }

  return { errors, warnings };
}

export function buildContractIndex(manifest, { repoRoot = DEFAULT_REPO_ROOT } = {}) {
  const missingFiles = [];
  const missingAnchors = [];
  const contracts = [];

  for (const contract of manifest.contracts || []) {
    const files = unique(FILE_ANCHOR_FIELDS.flatMap((field) => asArray(contract[field])));
    const layerAnchorTerms = contract.anchor_terms;
    const contractTerms = unique(FILE_ANCHOR_FIELDS.flatMap((field) => asArray(layerAnchorTerms?.[field])));
    const fileEntries = [];
    for (const file of files) {
      if (path.isAbsolute(file) || !isWithinRepo(repoRoot, file)) {
        missingFiles.push({ contract_id: contract.contract_id, file });
        fileEntries.push({ file, exists: false, bytes: 0, matched_terms: [] });
        continue;
      }
      const absolute = repoPath(repoRoot, file);
      if (!existsSync(absolute)) {
        missingFiles.push({ contract_id: contract.contract_id, file });
        fileEntries.push({ file, exists: false, bytes: 0, matched_terms: [] });
        continue;
      }
      const text = readUtf8(absolute);
      const matchedTerms = contractTerms.filter((term) => text.includes(term));
      fileEntries.push({
        file,
        exists: true,
        bytes: Buffer.byteLength(text, 'utf8'),
        matched_terms: matchedTerms,
      });
    }

    const termMatches = {};
    const entriesByFile = new Map(fileEntries.map((entry) => [entry.file, entry]));
    for (const field of FILE_ANCHOR_FIELDS) {
      for (const term of asArray(layerAnchorTerms?.[field])) {
        const key = `${field}:${term}`;
        const matchedFiles = asArray(contract[field]).filter((file) => (
          entriesByFile.get(file)?.matched_terms.includes(term)
        ));
        termMatches[key] = matchedFiles;
        if (matchedFiles.length === 0) {
          missingAnchors.push({ contract_id: contract.contract_id, field, term });
        }
      }
    }

    contracts.push({
      contract_id: contract.contract_id,
      status: contract.status,
      risk_level: contract.risk_level,
      owner_iterations: asArray(contract.owner_iterations),
      verification_commands: asArray(contract.verification_commands),
      open_findings: asArray(contract.open_findings),
      source_refs: asArray(contract.source_refs),
      decision_files: asArray(contract.decision_files),
      evidence_files: asArray(contract.evidence_files),
      files: fileEntries,
      term_matches: termMatches,
    });
  }

  return {
    schema: 'contract_surface_index.v2',
    contract_count: contracts.length,
    missingFiles,
    missingAnchors,
    contracts,
  };
}

export function generateContractCoverageSummary(manifest, index, {
  manifestRef = DEFAULT_MANIFEST,
} = {}) {
  const lines = [
    '---',
    'title: "Contract Coverage Summary"',
    'doc_type: generated-summary',
    'status: active',
    `updated: ${manifest.updated || 'unknown'}`,
    'source: generated',
    `generated_from: "${manifestRef}"`,
    '---',
    '',
    '# Contract Coverage Summary',
    '',
    `Generated from \`${manifestRef}\`. This is a routing/coverage view, not product SSOT. Do not edit it directly.`,
    '',
    `Contract cards: ${index.contract_count}`,
    '',
    '## Coverage Table',
    '',
    '| Contract | Status | Risk | Open findings | SSOT | Implementation | Tests | Verification |',
    '|---|---|---|---|---|---|---|---|',
  ];

  for (const contract of manifest.contracts) {
    lines.push([
      `| \`${contract.contract_id}\``,
      contract.status,
      contract.risk_level,
      formatFindings(contract.open_findings),
      formatList(contract.ssot_files),
      formatList(contract.implementation_files),
      formatList(contract.test_files),
      formatCommandList(contract.verification_commands),
    ].join(' | ') + ' |');
  }

  lines.push('', '## Contract Cards', '');

  const indexedById = new Map(index.contracts.map((contract) => [contract.contract_id, contract]));
  for (const contract of manifest.contracts) {
    const indexed = indexedById.get(contract.contract_id);
    lines.push(`### ${contract.contract_id}`);
    lines.push('');
    lines.push(`- Status: \`${contract.status}\``);
    lines.push(`- Risk: \`${contract.risk_level}\``);
    lines.push(`- Source refs: ${formatList(contract.source_refs)}`);
    lines.push(`- SSOT files: ${formatList(contract.ssot_files)}`);
    lines.push(`- Decision files: ${formatList(contract.decision_files)}`);
    lines.push(`- Evidence files: ${formatList(contract.evidence_files)}`);
    lines.push(`- Implementation files: ${formatList(contract.implementation_files)}`);
    lines.push(`- Test files: ${formatList(contract.test_files)}`);
    lines.push(`- Open findings: ${formatFindings(contract.open_findings)}`);
    lines.push(`- Verification: ${formatCommandList(contract.verification_commands)}`);
    lines.push(`- Owner iterations: ${formatList(contract.owner_iterations)}`);
    lines.push(`- Notes: ${contract.notes}`);
    if (indexed) {
      const matched = Object.entries(indexed.term_matches)
        .map(([term, files]) => `\`${term}\` => ${formatList(files)}`)
        .join('; ');
      lines.push(`- Anchor matches: ${matched}`);
    }
    lines.push('');
  }

  while (lines.at(-1) === '') lines.pop();
  return `${lines.join('\n')}\n`;
}

export function resolveContractArtifactPaths(manifest, {
  repoRoot = DEFAULT_REPO_ROOT,
  summaryPath,
  indexPath,
} = {}) {
  return {
    summaryPath: resolveRepoOutput(
      repoRoot,
      summaryPath === undefined ? manifest.generated_summary : summaryPath,
      'summary',
    ),
    indexPath: resolveRepoOutput(
      repoRoot,
      indexPath === undefined ? manifest.generated_index : indexPath,
      'index',
    ),
  };
}

export function writeContractArtifacts({
  repoRoot = DEFAULT_REPO_ROOT,
  manifestPath = path.join(repoRoot, DEFAULT_MANIFEST),
  summaryPath,
  indexPath,
} = {}) {
  const absoluteManifestPath = path.resolve(manifestPath);
  const manifestRelativePath = path.relative(repoRoot, absoluteManifestPath);
  if (!isContainedRelativePath(manifestRelativePath)) {
    throw new Error(`manifest path must stay within repository root: ${manifestPath}`);
  }
  const manifestRef = manifestRelativePath.split(path.sep).join('/');
  const manifest = loadContractManifest(absoluteManifestPath);
  const validation = validateContractManifest(manifest, { repoRoot });
  if (validation.errors.length) {
    throw new Error(`contract manifest validation failed:\n${validation.errors.join('\n')}`);
  }
  const index = buildContractIndex(manifest, { repoRoot });
  if (index.missingFiles.length || index.missingAnchors.length) {
    throw new Error(`contract index has missing anchors:\n${JSON.stringify({
      missingFiles: index.missingFiles,
      missingAnchors: index.missingAnchors,
    }, null, 2)}`);
  }

  const artifactPaths = resolveContractArtifactPaths(manifest, {
    repoRoot,
    summaryPath,
    indexPath,
  });
  const summary = generateContractCoverageSummary(manifest, index, { manifestRef });
  mkdirSync(path.dirname(artifactPaths.summaryPath), { recursive: true });
  writeFileSync(artifactPaths.summaryPath, summary);
  mkdirSync(path.dirname(artifactPaths.indexPath), { recursive: true });
  writeFileSync(artifactPaths.indexPath, `${JSON.stringify(sortedObject(index), null, 2)}\n`);
  return { manifest, index, summary };
}

function argValue(args, name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  return args[index + 1] || fallback;
}

async function main() {
  const args = process.argv.slice(2);
  const repoRoot = path.resolve(argValue(args, '--repo-root', DEFAULT_REPO_ROOT));
  const manifestPath = path.resolve(repoRoot, argValue(args, '--manifest', DEFAULT_MANIFEST));
  const summaryPath = argValue(args, '--summary', undefined);
  const indexPath = argValue(args, '--index', undefined);
  const { index } = writeContractArtifacts({ repoRoot, manifestPath, summaryPath, indexPath });
  console.log(`PASS build_contract_index: ${index.contract_count} contracts`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
