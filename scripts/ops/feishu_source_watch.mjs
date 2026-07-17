#!/usr/bin/env node

import crypto from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

const FEISHU_API_BASE = process.env.FEISHU_API_BASE || 'https://open.feishu.cn/open-apis';

class FeishuApiError extends Error {
  constructor(message, { code, data } = {}) {
    super(message);
    this.name = 'FeishuApiError';
    this.code = code;
    this.data = data;
  }
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      throw new Error(`unexpected argument: ${arg}`);
    }
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = value;
      i += 1;
    }
  }
  return args;
}

function usage() {
  return [
    'Usage:',
    '  node scripts/ops/feishu_source_watch.mjs --manifest <path> --state-dir <dir> --report <path> [--fixture <dir>] [--event-file <path>] [--doc-id <id[,id]>] [--allow-insecure-tls-local-debug]',
    '',
    'Real Feishu mode requires FEISHU_TENANT_ACCESS_TOKEN or FEISHU_ACCESS_TOKEN.',
    'Insecure TLS override is allowed only with --fixture or an exact loopback FEISHU_API_BASE.',
  ].join('\n');
}

function isExactLoopbackApiBase(apiBase) {
  try {
    const hostname = new URL(apiBase).hostname;
    return hostname === 'localhost'
      || hostname === '127.0.0.1'
      || hostname === '::1'
      || hostname === '[::1]';
  } catch {
    return false;
  }
}

function tlsPreflight({ fixtureDir, allowInsecureTlsLocalDebug }) {
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0') {
    return 'ENABLED';
  }
  const localDebugContext = Boolean(fixtureDir) || isExactLoopbackApiBase(FEISHU_API_BASE);
  if (allowInsecureTlsLocalDebug === true && localDebugContext) {
    return 'DISABLED_FOR_LOCAL_DEBUG';
  }
  throw new Error(
    'TLS verification is disabled by NODE_TLS_REJECT_UNAUTHORIZED=0. '
      + 'Remove that environment setting, or use --allow-insecure-tls-local-debug only with --fixture or an exact loopback FEISHU_API_BASE.',
  );
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function ensureDir(dirPath) {
  mkdirSync(dirPath, { recursive: true });
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function shortHash(text) {
  return sha256(text).slice(0, 12);
}

function normalizeLineEndings(text) {
  return String(text || '').replace(/\r\n?/gu, '\n');
}

function extractUrlToken(url) {
  const match = String(url || '').match(/\/(?:wiki|docx)\/([^/?#]+)/u);
  return match?.[1] || '';
}

function eventEnvelope(eventPayload) {
  const header = eventPayload?.header || {};
  const event = eventPayload?.event || {};
  return {
    type: header.event_type || eventPayload?.event_type || '',
    id: header.event_id || eventPayload?.event_id || '',
    fileToken: event.file_token || eventPayload?.file_token || '',
  };
}

function matchesEvent(doc, fileToken) {
  if (!fileToken) return true;
  const candidates = [
    doc.wiki_node_token,
    doc.obj_token,
    doc.doc_token,
    doc.file_token,
    extractUrlToken(doc.url),
  ].filter(Boolean);
  return candidates.includes(fileToken);
}

function parseDocIdFilter(docIdArg) {
  if (!docIdArg) return null;
  return new Set(String(docIdArg).split(',').map((item) => item.trim()).filter(Boolean));
}

function selectDocuments(manifest, eventPayload, docIdFilter = null) {
  let docs = manifest.documents || [];
  if (docIdFilter) {
    docs = docs.filter((doc) => docIdFilter.has(doc.id));
  }
  if (!eventPayload) return { docs, eventInfo: null };
  const eventInfo = eventEnvelope(eventPayload);
  return {
    docs: docs.filter((doc) => matchesEvent(doc, eventInfo.fileToken)),
    eventInfo,
  };
}

function sectionKeyFromLine(line) {
  const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/u);
  if (!match) return null;
  return match[2].trim();
}

function splitSections(markdown) {
  const sections = new Map();
  const lines = normalizeLineEndings(markdown).split('\n');
  let currentHeading = 'Document Root';
  let currentLines = [];

  function flush() {
    const content = currentLines.join('\n').trim();
    if (content || currentHeading !== 'Document Root') {
      sections.set(currentHeading, content);
    }
  }

  for (const line of lines) {
    const nextHeading = sectionKeyFromLine(line);
    if (nextHeading) {
      flush();
      currentHeading = nextHeading;
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }
  flush();
  return sections;
}

function changedLineSummary(before, after) {
  const beforeSet = new Set(normalizeLineEndings(before).split('\n').map((line) => line.trim()).filter(Boolean));
  const afterLines = normalizeLineEndings(after).split('\n').map((line) => line.trim()).filter(Boolean);
  const added = afterLines.filter((line) => !beforeSet.has(line) && !line.startsWith('#'));
  return added.slice(0, 4);
}

function countLines(lines) {
  const counts = new Map();
  for (const line of lines) {
    counts.set(line, (counts.get(line) || 0) + 1);
  }
  return counts;
}

function changedLineDiff(before, after, maxLines = 40) {
  const beforeLines = normalizeLineEndings(before).split('\n').map((line) => line.trim()).filter(Boolean);
  const afterLines = normalizeLineEndings(after).split('\n').map((line) => line.trim()).filter(Boolean);
  const afterCounts = countLines(afterLines);
  const deletions = [];
  for (const line of beforeLines) {
    const remaining = afterCounts.get(line) || 0;
    if (remaining > 0) {
      afterCounts.set(line, remaining - 1);
    } else if (!line.startsWith('#')) {
      deletions.push(`- ${line}`);
    }
  }

  const beforeCounts = countLines(beforeLines);
  const additions = [];
  for (const line of afterLines) {
    const remaining = beforeCounts.get(line) || 0;
    if (remaining > 0) {
      beforeCounts.set(line, remaining - 1);
    } else if (!line.startsWith('#')) {
      additions.push(`+ ${line}`);
    }
  }

  const diffLines = [...deletions, ...additions];
  if (diffLines.length <= maxLines) return diffLines;
  return [
    ...diffLines.slice(0, maxLines),
    `# diff truncated: ${diffLines.length - maxLines} more changed lines`,
  ];
}

function classifyChange(doc, heading, before, after) {
  const combined = `${heading}\n${after}`;
  const keywordHit = (doc.confirmation_keywords || []).find((keyword) => combined.includes(keyword));

  if (/直接修改业务状态|UI\s*可以|UI\s*直接|绕过/u.test(combined)) {
    return {
      reviewClass: 'requires_user_confirmation',
      reason: 'current SSOT conflict: UI is projection only and business-state side effects must stay on the ModelTable path.',
      stop: true,
    };
  }
  if (/pin\.connect\.model/u.test(combined)) {
    return {
      reviewClass: 'requires_user_confirmation',
      reason: 'current SSOT conflict: pin.connect.model is not a current project wiring surface.',
      stop: true,
    };
  }
  if (/延后|暂不实现|废弃/u.test(combined)) {
    return {
      reviewClass: 'requires_user_confirmation',
      reason: 'meeting-consensus scheduling or deprecation decision requires user/team confirmation before defer/reject wording.',
      stop: true,
    };
  }
  if (/兼容/u.test(combined)) {
    return {
      reviewClass: 'requires_user_confirmation',
      reason: 'compatibility behavior requires explicit project approval before SSOT update.',
      stop: true,
    };
  }
  if (keywordHit) {
    return {
      reviewClass: 'requires_user_confirmation',
      reason: `manifest keyword "${keywordHit}" requires user/team confirmation before SSOT update.`,
      stop: true,
    };
  }
  return {
    reviewClass: 'adopt_plan_update',
    reason: 'compatible source update; prepare a repo SSOT plan update and normal verification.',
    stop: false,
  };
}

function diffMarkdown(doc, before, after) {
  const beforeSections = splitSections(before);
  const afterSections = splitSections(after);
  const headings = new Set([...beforeSections.keys(), ...afterSections.keys()]);
  const changes = [];
  for (const heading of [...headings].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))) {
    const oldContent = beforeSections.get(heading) || '';
    const newContent = afterSections.get(heading) || '';
    if (sha256(oldContent) === sha256(newContent)) continue;
    const classification = classifyChange(doc, heading, oldContent, newContent);
    changes.push({
      heading,
      oldHash: shortHash(oldContent),
      newHash: shortHash(newContent),
      summary: changedLineSummary(oldContent, newContent),
      diffLines: changedLineDiff(oldContent, newContent),
      ...classification,
    });
  }
  return changes;
}

function snapshotPath(stateDir, docId) {
  return path.join(stateDir, 'snapshots', `${docId}.md`);
}

function readStateBaseline({ stateDir, fixtureDir, doc }) {
  const storedSnapshot = snapshotPath(stateDir, doc.id);
  if (existsSync(storedSnapshot)) {
    return { content: readFileSync(storedSnapshot, 'utf8'), exists: true };
  }
  if (fixtureDir) {
    const previousPath = path.join(fixtureDir, 'previous', `${doc.id}.md`);
    if (existsSync(previousPath)) return { content: readFileSync(previousPath, 'utf8'), exists: true };
  }
  return { content: '', exists: false };
}

function readFixtureCurrent(fixtureDir, doc) {
  const currentPath = path.join(fixtureDir, 'current', `${doc.id}.md`);
  if (!existsSync(currentPath)) return null;
  return readFileSync(currentPath, 'utf8');
}

async function feishuGetJson(pathname, token) {
  const response = await fetch(`${FEISHU_API_BASE}${pathname}`, {
    headers: { authorization: `Bearer ${token}`, connection: 'close' },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.code !== 0) {
    const code = body?.code ?? response.status;
    const msg = body?.msg ?? response.statusText;
    throw new FeishuApiError(`Feishu API failed (${code}): ${msg}`, { code, data: body?.data });
  }
  return body.data;
}

async function resolveFeishuDoc(doc, token) {
  if (doc.source_type !== 'wiki') {
    return {
      docToken: doc.doc_token || doc.obj_token || doc.file_token || extractUrlToken(doc.url),
      docType: doc.obj_type || 'docx',
    };
  }
  const nodeToken = doc.wiki_node_token || extractUrlToken(doc.url);
  const data = await feishuGetJson(`/wiki/v2/spaces/get_node?token=${encodeURIComponent(nodeToken)}`, token);
  const node = data?.node || {};
  return {
    docToken: node.obj_token,
    docType: node.obj_type || doc.obj_type || 'docx',
  };
}

async function fetchFeishuMarkdown(doc) {
  const token = process.env.FEISHU_TENANT_ACCESS_TOKEN || process.env.FEISHU_ACCESS_TOKEN;
  if (!token) {
    throw new Error('missing FEISHU_TENANT_ACCESS_TOKEN or FEISHU_ACCESS_TOKEN for real Feishu mode');
  }
  let resolved = null;
  try {
    resolved = await resolveFeishuDoc(doc, token);
  } catch (error) {
    if (!(error instanceof FeishuApiError)) throw error;
    return fetchFeishuRawContent(doc, token, {
      reason: error.message,
      docToken: doc.wiki_node_token || doc.doc_token || doc.obj_token || doc.file_token || extractUrlToken(doc.url),
    });
  }
  if (!resolved.docToken || resolved.docType !== 'docx') {
    return fetchFeishuRawContent(doc, token, {
      reason: `document ${doc.id} did not resolve to a docx token`,
      docToken: doc.wiki_node_token || doc.doc_token || doc.obj_token || doc.file_token || extractUrlToken(doc.url),
    });
  }
  const params = new URLSearchParams({
    doc_token: resolved.docToken,
    doc_type: 'docx',
    content_type: 'markdown',
    lang: 'zh',
  });
  try {
    const data = await feishuGetJson(`/docs/v1/content?${params.toString()}`, token);
    return { content: data?.content || '', sourceFormat: 'markdown' };
  } catch (error) {
    if (!(error instanceof FeishuApiError)) throw error;
    return fetchFeishuRawContent(doc, token, {
      reason: error.message,
      docToken: resolved.docToken,
    });
  }
}

async function fetchFeishuRawContent(doc, token, { reason, docToken } = {}) {
  const fallbackToken = docToken || doc.wiki_node_token || doc.doc_token || doc.obj_token || doc.file_token || extractUrlToken(doc.url);
  if (!fallbackToken) {
    throw new Error(`document ${doc.id} cannot use raw_content fallback without a token`);
  }
  const data = await feishuGetJson(`/docx/v1/documents/${encodeURIComponent(fallbackToken)}/raw_content`, token);
  return {
    content: data?.content || '',
    sourceFormat: 'raw_content',
    sourceNote: reason || 'Markdown content API unavailable; used raw_content fallback.',
  };
}

async function loadCurrentContent({ fixtureDir, doc }) {
  if (fixtureDir) {
    const fixture = readFixtureCurrent(fixtureDir, doc);
    if (fixture === null) return null;
    return { content: fixture, sourceFormat: 'fixture' };
  }
  return fetchFeishuMarkdown(doc);
}

function writeSnapshot({ stateDir, doc, content }) {
  const snapshotsDir = path.join(stateDir, 'snapshots');
  ensureDir(snapshotsDir);
  writeFileSync(snapshotPath(stateDir, doc.id), normalizeLineEndings(content));
}

function renderReport({ manifestPath, stateDir, docs, results, eventInfo, tlsVerification }) {
  const changedResults = results.filter((result) => result.changes.length > 0);
  const baselineResults = results.filter((result) => result.baselineCreated);
  let status = 'NO_CHANGE';
  if (changedResults.length > 0) {
    status = 'CHANGED';
  } else if (baselineResults.length > 0) {
    status = 'BASELINE_CREATED';
  }
  const lines = [
    '# Feishu Source Watch Report',
    '',
    `Status: ${status}`,
    `Generated At: ${new Date().toISOString()}`,
    `Manifest: ${manifestPath}`,
    `State Dir: ${stateDir}`,
    `TLS Verification: ${tlsVerification}`,
  ];

  if (eventInfo) {
    lines.push(`Event Filter: ${eventInfo.type || 'unknown'} ${eventInfo.id || 'unknown'}`);
  }

  lines.push('', '## Summary', '');
  lines.push(`- Documents Checked: ${docs.length}`);
  lines.push(`- Documents Changed: ${changedResults.length}`);
  lines.push(`- Baselines Created: ${baselineResults.length}`);
  lines.push(`- Confirmation Stops: ${changedResults.flatMap((result) => result.changes).filter((change) => change.stop).length}`);

  if (status === 'NO_CHANGE') {
    lines.push('', 'No tracked Feishu source sections changed since the last snapshot.');
    return `${lines.join('\n')}\n`;
  }

  if (status === 'BASELINE_CREATED') {
    lines.push('', 'Initial local baseline created. No prior snapshot existed, so no SSOT change recommendation was generated.');
    for (const result of baselineResults) {
      const doc = result.doc;
      lines.push('', `## Document: ${doc.role} - ${doc.title}`, '');
      lines.push(`- Source: ${doc.url}`);
      lines.push(`- Source Format: ${result.sourceFormat || 'unknown'}`);
      if (result.sourceNote) {
        lines.push(`- Source Note: ${result.sourceNote}`);
      }
      if (result.summary.length > 0) {
        lines.push('- Baseline Sample Lines:');
        for (const line of result.summary) {
          lines.push(`  - ${line}`);
        }
      }
    }
    return `${lines.join('\n')}\n`;
  }

  for (const result of changedResults) {
    const doc = result.doc;
    lines.push('', `## Document: ${doc.role} - ${doc.title}`, '');
    lines.push(`- Source: ${doc.url}`);
    lines.push(`- Source Format: ${result.sourceFormat || 'unknown'}`);
    if (result.sourceNote) {
      lines.push(`- Source Note: ${result.sourceNote}`);
    }
    lines.push('- Likely SSOT:');
    for (const target of doc.likely_ssot_targets || []) {
      lines.push(`  - ${target}`);
    }
    for (const change of result.changes) {
      lines.push('', `### Changed Heading: ${change.heading}`, '');
      lines.push(`- Review Class: ${change.reviewClass}`);
      lines.push(`- Reason: ${change.reason}`);
      if (change.stop) {
        lines.push('- Stop: user/team confirmation required before SSOT update.');
      }
      lines.push(`- Old Hash: ${change.oldHash}`);
      lines.push(`- New Hash: ${change.newHash}`);
      if (change.summary.length > 0) {
        lines.push('- Added/Changed Lines:');
        for (const line of change.summary) {
          lines.push(`  - ${line}`);
        }
      }
      if (change.diffLines.length > 0) {
        lines.push('- Section Diff:');
        lines.push('```diff');
        lines.push(...change.diffLines);
        lines.push('```');
      }
    }
  }
  return `${lines.join('\n')}\n`;
}

function renderBlockedReport({ manifestPath, stateDir, error }) {
  const rawMessage = error?.message || String(error || 'unknown error');
  const safeMessage = rawMessage
    .replace(/tenant_access_token[=:]\s*[A-Za-z0-9._-]+/giu, 'tenant_access_token=<masked>')
    .replace(/app_secret[=:]\s*[^,\s]+/giu, 'app_secret=<masked>');
  const lines = [
    '# Feishu Source Watch Report',
    '',
    'Status: BLOCKED',
    `Generated At: ${new Date().toISOString()}`,
    `Manifest: ${manifestPath || '-'}`,
    `State Dir: ${stateDir || '-'}`,
    '',
    '## Blocker',
    '',
    `- Blocker: ${safeMessage}`,
    '- No Feishu source content was changed or committed.',
    '',
    '## Next Action',
    '',
  ];
  if (safeMessage.includes('NODE_TLS_REJECT_UNAUTHORIZED=0')) {
    lines.push('- Restore TLS verification. Local debugging requires the explicit override plus fixture or exact loopback mode.');
  } else {
    lines.push('- If the blocker is missing credentials, provide FEISHU_TENANT_ACCESS_TOKEN or FEISHU_ACCESS_TOKEN.');
    lines.push('- If the blocker is missing Wiki permissions, enable one of wiki:node:read, wiki:wiki:readonly, or wiki:wiki for the Feishu app and rerun.');
  }
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  const manifestPath = args.manifest;
  const stateDir = args['state-dir'];
  const reportPath = args.report;
  const fixtureDir = args.fixture || null;
  if (!manifestPath || !stateDir || !reportPath) {
    throw new Error(`missing required arguments\n${usage()}`);
  }

  const tlsVerification = tlsPreflight({
    fixtureDir,
    allowInsecureTlsLocalDebug: args['allow-insecure-tls-local-debug'] === true,
  });

  const manifest = readJson(manifestPath);
  const eventPayload = args['event-file'] ? readJson(args['event-file']) : null;
  const { docs, eventInfo } = selectDocuments(manifest, eventPayload, parseDocIdFilter(args['doc-id']));
  ensureDir(stateDir);
  ensureDir(path.dirname(reportPath));

  const results = [];
  for (const doc of docs) {
    const loaded = await loadCurrentContent({ fixtureDir, doc });
    if (loaded === null) continue;
    const current = loaded.content;
    if (current === null) continue;
    const previous = readStateBaseline({ stateDir, fixtureDir, doc });
    const changes = previous.exists ? diffMarkdown(doc, previous.content, current) : [];
    writeSnapshot({ stateDir, doc, content: current });
    results.push({
      doc,
      changes,
      baselineCreated: !previous.exists,
      summary: !previous.exists ? changedLineSummary('', current) : [],
      sourceFormat: loaded.sourceFormat,
      sourceNote: loaded.sourceNote,
    });
  }

  const report = renderReport({
    manifestPath,
    stateDir,
    docs: results.map((result) => result.doc),
    results,
    eventInfo,
    tlsVerification,
  });
  writeFileSync(reportPath, report);
  console.log(`wrote ${reportPath}`);
}

main().catch((error) => {
  const args = parseArgs(process.argv.slice(2));
  if (args.report) {
    try {
      ensureDir(path.dirname(args.report));
      writeFileSync(args.report, renderBlockedReport({
        manifestPath: args.manifest,
        stateDir: args['state-dir'],
        error,
      }));
    } catch (reportError) {
      console.error(`failed to write blocked report: ${reportError.message}`);
    }
  }
  console.error(error.message);
  process.exitCode = 1;
});
