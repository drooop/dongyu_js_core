#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import path from 'node:path';

const repoRoot = process.cwd();
const scriptPath = path.join(repoRoot, 'scripts/ops/feishu_source_watch.mjs');
const fixtureDir = path.join(repoRoot, 'scripts/fixtures/feishu_source_watch/basic');
const revision14272FixtureDir = path.join(
  repoRoot,
  'scripts/fixtures/feishu_source_watch/revision-14272-risk-matrix',
);
const manifestPath = path.join(repoRoot, 'docs/ssot/feishu_source_watch_manifest.json');

const FOCUSED_RISK_KEYWORDS = [
  'config.control',
  'config.manage',
  'sys_model_type',
  'sys_model_size',
  'key值以sys_作为开头',
  'key值以in_作为开头',
  'key值以out_作为开头',
  'key值以log_作为开头',
  'key值以user_作为开头',
  'key值以persis_作为开头',
  'key值以status_作为开头',
  'pin.manage',
  'user_set_status',
  'CLEAR_BUFFER',
  'sys_func_mode',
  'sys_func_order',
  'sys_match_func',
  'sys_max_loop_time',
  'func.code.python',
  'func.code.js',
  'func.mode',
  'func.timer.ms',
  'log_type',
  'log_info',
  'log_model_id',
  'log_p',
  'log_r',
  'log_c',
  'log_func',
  'log_time',
  '只有流程模型能够单独运行',
];

const FOCUSED_PROTECTED_HEADINGS = [
  'func: 函数方法标签',
  '6 按功能划分的模型类型',
  '6.1 程序模型',
  '程序模型各区标签',
  'SYS区',
  'IN区',
  'OUT区',
  'LOG区',
  'USER区',
  'PERSIS区',
  'STATUS区',
  '程序模型运行方式',
  'MNG程序管理',
  '启动',
  '停止',
  '清缓冲',
  '输入缓冲',
  '运行函数',
  '清理',
];

const BUILT_IN_RISK_TERMS = [
  '直接修改业务状态',
  'UI 可以',
  'UI 直接',
  '绕过',
  'pin.connect.model',
  '延后',
  '暂不实现',
  '废弃',
  '兼容',
];

function childEnv(overrides = {}) {
  const env = { ...process.env };
  delete env.NODE_TLS_REJECT_UNAUTHORIZED;
  return { ...env, ...overrides };
}

function assertNoWatcherStatePayload(stateDir) {
  assert.equal(
    existsSync(stateDir),
    false,
    'blocked TLS preflight must not create stateDir or write any state payload when report is outside it',
  );
}

function runWatch({ stateDir, reportPath, extraArgs = [] }) {
  return spawnSync(
    process.execPath,
    [
      scriptPath,
      '--manifest',
      manifestPath,
      '--fixture',
      fixtureDir,
      '--state-dir',
      stateDir,
      '--report',
      reportPath,
      ...extraArgs,
    ],
    { cwd: repoRoot, encoding: 'utf8', env: childEnv(), timeout: 15000 },
  );
}

function runWatchWithEnv({ stateDir, reportPath, env, extraArgs = [], sourceManifestPath = manifestPath }) {
  return spawnSync(
    process.execPath,
    [
      scriptPath,
      '--manifest',
      sourceManifestPath,
      '--state-dir',
      stateDir,
      '--report',
      reportPath,
      ...extraArgs,
    ],
    { cwd: repoRoot, encoding: 'utf8', env, timeout: 15000 },
  );
}

function runWatchWithEnvAsync({ stateDir, reportPath, env, extraArgs = [], sourceManifestPath = manifestPath }) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [
        scriptPath,
        '--manifest',
        sourceManifestPath,
        '--state-dir',
        stateDir,
        '--report',
        reportPath,
        ...extraArgs,
      ],
      { cwd: repoRoot, env },
    );
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
    }, 15000);
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('close', (status, signal) => {
      clearTimeout(timer);
      resolve({ status, signal, stdout, stderr });
    });
  });
}

function markdownEscapePunctuation(value) {
  return String(value).replace(/([!-/:-@[-`{-~])/gu, '\\$1');
}

function changedHeadingBlock(report, heading) {
  const marker = `### Changed Heading: ${heading}`;
  const start = report.indexOf(marker);
  assert.notEqual(start, -1, `report must include changed heading ${heading}`);
  const next = report.indexOf('\n### Changed Heading:', start + marker.length);
  return report.slice(start, next === -1 ? report.length : next);
}

function assertHeadingReviewClass(report, heading, reviewClass) {
  assert.match(
    changedHeadingBlock(report, heading),
    new RegExp(`Review Class: ${reviewClass}`, 'u'),
    `${heading} must classify as ${reviewClass}`,
  );
}

function renderSections(sections) {
  return `# Focused watcher contract\n\n${sections.map(({ heading, lines }) => [
    `## ${heading}`,
    '',
    ...lines,
  ].join('\n')).join('\n\n')}\n`;
}

function runFocusedContractFixture({ tempRoot, previousSections, currentSections }) {
  const focusedFixtureDir = path.join(tempRoot, 'fixture');
  const previousDir = path.join(focusedFixtureDir, 'previous');
  const currentDir = path.join(focusedFixtureDir, 'current');
  const stateDir = path.join(tempRoot, 'state');
  const reportPath = path.join(tempRoot, 'report.md');
  mkdirSync(previousDir, { recursive: true });
  mkdirSync(currentDir, { recursive: true });
  writeFileSync(path.join(previousDir, 'feishu-model2.md'), renderSections(previousSections));
  writeFileSync(path.join(currentDir, 'feishu-model2.md'), renderSections(currentSections));
  const result = runWatchWithEnv({
    stateDir,
    reportPath,
    env: childEnv(),
    extraArgs: ['--fixture', focusedFixtureDir, '--doc-id', 'feishu-model2'],
  });
  assert.equal(
    result.status,
    0,
    `focused watcher contract must run\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  return readFileSync(reportPath, 'utf8');
}

function test_manifest_records_no_secret_feishu_sources_and_confirmation_policy() {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.schema, 'feishu_source_watch_manifest.v2');
  assert.match(
    manifest.confirmation_policy.reject_defer_rule,
    /Do not make final reject\/defer decisions automatically/u,
    'manifest must encode user confirmation rule for reject/defer cases',
  );
  assert.equal(manifest.documents.length, 6, 'manifest must track the four maintained Feishu documents plus two focused source docs');
  assert.equal(
    manifest.documents.filter((doc) => doc.authority_class === 'UpstreamConsensus').length,
    2,
    'manifest must identify exactly two upstream consensus documents',
  );
  assert.equal(
    manifest.documents.filter((doc) => doc.authority_class === 'DerivedView').length,
    4,
    'manifest must identify exactly four derived views',
  );
  assert.equal(
    manifest.supporting_source_slots.length,
    2,
    'manifest must retain two non-fetchable supporting-source slots until identity is confirmed',
  );
  assert.equal(
    manifest.documents.every((doc) => doc.source_type === 'wiki' && doc.wiki_node_token && !doc.app_secret),
    true,
    'manifest must record wiki source tokens without storing secrets',
  );
  const focusedSource = manifest.documents.find((doc) => doc.id === 'feishu-model2');
  assert.ok(focusedSource, 'manifest must retain the feishu-model2 focused source');
  for (const keyword of FOCUSED_RISK_KEYWORDS) {
    assert.ok(
      focusedSource.confirmation_keywords.includes(keyword),
      `feishu-model2 must protect ${keyword}`,
    );
    assert.equal(
      manifest.documents
        .filter((doc) => doc.id !== 'feishu-model2')
        .some((doc) => (doc.confirmation_keywords || []).includes(keyword)),
      false,
      `${keyword} must not be added to non-feishu-model2 documents`,
    );
  }
  assert.deepEqual(
    focusedSource.confirmation_headings,
    FOCUSED_PROTECTED_HEADINGS,
    'feishu-model2 must freeze the exact normalized protected heading list',
  );
  assert.equal(
    manifest.documents
      .filter((doc) => doc.id !== 'feishu-model2')
      .some((doc) => Object.hasOwn(doc, 'confirmation_headings')),
    false,
    'protected lifecycle headings must be scoped only to feishu-model2',
  );
}

function test_changed_line_classifier_uses_full_normalized_duplicate_aware_diff() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'dy-0458-feishu-watch-classifier-'));
  const previousSections = [];
  const currentSections = [];
  const expectedStops = [];
  const expectedCompatible = [];

  function addCase(heading, beforeLines, afterLines, expectedClass) {
    previousSections.push({ heading, lines: beforeLines });
    currentSections.push({ heading, lines: afterLines });
    if (expectedClass === 'requires_user_confirmation') expectedStops.push(heading);
    else expectedCompatible.push(heading);
  }

  for (const [index, keyword] of FOCUSED_RISK_KEYWORDS.entries()) {
    addCase(`keyword-add-${index}`, ['safe before'], [`risk ${keyword}`], 'requires_user_confirmation');
    addCase(
      `keyword-remove-${index}`,
      [`risk ${markdownEscapePunctuation(keyword)}`],
      ['safe after'],
      'requires_user_confirmation',
    );
  }

  for (const [index, term] of BUILT_IN_RISK_TERMS.entries()) {
    addCase(`builtin-add-${index}`, ['safe before'], [`risk ${term}`], 'requires_user_confirmation');
    addCase(
      `builtin-remove-${index}`,
      [`risk ${markdownEscapePunctuation(term)}`],
      ['safe after'],
      'requires_user_confirmation',
    );
  }

  for (const [index, heading] of FOCUSED_PROTECTED_HEADINGS.entries()) {
    const sourceHeading = heading === '6.1 程序模型' ? '6\\.1 程序模型' : heading;
    addCase(sourceHeading, [`old lifecycle body ${index}`], [`new lifecycle body ${index}`], 'requires_user_confirmation');
  }

  const stableTerms = [
    'sys_model_type',
    'func.code.python',
    'model_id',
    'pin.connect.model',
    '延后',
    '兼容',
    'UI 可以',
  ];
  for (const [index, term] of stableTerms.entries()) {
    addCase(
      `stable-adjacent-${index}`,
      [`stable ${markdownEscapePunctuation(term)}`, 'ordinary before'],
      [`stable ${term}`, 'ordinary after'],
      'adopt_plan_update',
    );
  }

  addCase(
    'duplicate-risk-increase',
    ['config.control'],
    ['config.control', 'config.control'],
    'requires_user_confirmation',
  );
  addCase(
    'duplicate-risk-decrease',
    ['config.manage', 'config.manage'],
    ['config.manage'],
    'requires_user_confirmation',
  );
  addCase(
    'risk-after-display-limit',
    Array.from({ length: 45 }, (_, index) => `old line ${index}`),
    [
      ...Array.from({ length: 45 }, (_, index) => `new line ${index}`),
      'config.manage',
    ],
    'requires_user_confirmation',
  );
  addCase('SYS区域', ['ordinary before'], ['ordinary after'], 'adopt_plan_update');
  addCase('unrelated-compatible-section', ['ordinary before'], ['ordinary after'], 'adopt_plan_update');

  try {
    const report = runFocusedContractFixture({ tempRoot, previousSections, currentSections });
    for (const heading of expectedStops) {
      assertHeadingReviewClass(report, heading, 'requires_user_confirmation');
    }
    for (const heading of expectedCompatible) {
      assertHeadingReviewClass(report, heading, 'adopt_plan_update');
    }
    const truncatedBlock = changedHeadingBlock(report, 'risk-after-display-limit');
    assert.match(truncatedBlock, /# diff truncated: /u, 'display diff must remain capped at 40 lines');
    assert.doesNotMatch(
      truncatedBlock,
      /^\+ config\.manage$/mu,
      'risk term after the display limit must not rely on rendered diff visibility',
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function test_revision_14272_focused_fixture_routes_all_new_risk_families() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'dy-0458-feishu-watch-revision-14272-'));
  const reportPath = path.join(tempRoot, 'report.md');
  try {
    const result = runWatchWithEnv({
      stateDir: path.join(tempRoot, 'state'),
      reportPath,
      env: childEnv(),
      extraArgs: ['--fixture', revision14272FixtureDir, '--doc-id', 'feishu-model2'],
    });
    assert.equal(
      result.status,
      0,
      `revision-14272 fixture must run\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
    const report = readFileSync(reportPath, 'utf8');
    for (const findingId of ['F-07', 'F-10', 'F-11', 'F-12', 'F-13', 'F-14']) {
      assertHeadingReviewClass(report, `${findingId} representative change`, 'requires_user_confirmation');
    }
    assertHeadingReviewClass(report, 'Stable adjacent model term', 'adopt_plan_update');
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function test_tls_disabled_blocks_before_manifest_event_or_state_processing() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'dy-0456-tls-preflight-order-'));
  const malformedEventPath = path.join(tempRoot, 'malformed-event.json');
  writeFileSync(malformedEventPath, '{');
  const cases = [
    {
      name: 'missing-manifest',
      sourceManifestPath: path.join(tempRoot, 'missing-manifest.json'),
      extraArgs: ['--event-file', path.join(tempRoot, 'missing-event.json')],
    },
    {
      name: 'malformed-event',
      sourceManifestPath: manifestPath,
      extraArgs: ['--event-file', malformedEventPath],
    },
  ];
  try {
    for (const testCase of cases) {
      const stateDir = path.join(tempRoot, `${testCase.name}-state`);
      const reportPath = path.join(tempRoot, `${testCase.name}-report.md`);
      const result = runWatchWithEnv({
        stateDir,
        reportPath,
        sourceManifestPath: testCase.sourceManifestPath,
        extraArgs: testCase.extraArgs,
        env: childEnv({
          NODE_TLS_REJECT_UNAUTHORIZED: '0',
          FEISHU_TENANT_ACCESS_TOKEN: 'tls-preflight-secret-token',
        }),
      });
      assert.notEqual(result.status, 0, `${testCase.name} must be blocked`);
      const report = readFileSync(reportPath, 'utf8');
      assert.match(report, /Status: BLOCKED/u);
      assert.match(report, /TLS verification is disabled by NODE_TLS_REJECT_UNAUTHORIZED=0/u);
      assert.doesNotMatch(report, /tls-preflight-secret-token/u, 'blocked report must not leak tokens');
      assertNoWatcherStatePayload(stateDir);
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function test_tls_disabled_override_allows_fixture_and_discloses_mode() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'dy-0456-tls-fixture-override-'));
  const reportPath = path.join(tempRoot, 'report.md');
  try {
    const result = runWatchWithEnv({
      stateDir: path.join(tempRoot, 'state'),
      reportPath,
      env: childEnv({
        NODE_TLS_REJECT_UNAUTHORIZED: '0',
        FEISHU_API_BASE: 'https://external.example.invalid/open-apis',
        FEISHU_TENANT_ACCESS_TOKEN: '',
        FEISHU_ACCESS_TOKEN: '',
      }),
      extraArgs: [
        '--fixture',
        fixtureDir,
        '--allow-insecure-tls-local-debug',
        '--doc-id',
        'rules',
      ],
    });
    assert.equal(result.status, 0, `fixture override should pass\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
    const report = readFileSync(reportPath, 'utf8');
    assert.match(report, /TLS Verification: DISABLED_FOR_LOCAL_DEBUG/u);
    assert.match(report, /Document: Rules/u);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function test_tls_disabled_fixture_without_override_is_blocked() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'dy-0456-tls-fixture-no-override-'));
  const stateDir = path.join(tempRoot, 'state');
  const reportPath = path.join(tempRoot, 'report.md');
  try {
    const result = runWatchWithEnv({
      stateDir,
      reportPath,
      env: childEnv({ NODE_TLS_REJECT_UNAUTHORIZED: '0' }),
      extraArgs: ['--fixture', fixtureDir, '--doc-id', 'rules'],
    });
    assert.notEqual(result.status, 0, 'fixture mode must not bypass the explicit override flag');
    const report = readFileSync(reportPath, 'utf8');
    assert.match(report, /TLS verification is disabled by NODE_TLS_REJECT_UNAUTHORIZED=0/u);
    assertNoWatcherStatePayload(stateDir);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function test_tls_disabled_override_rejects_external_deceptive_and_invalid_bases() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'dy-0456-tls-base-matrix-'));
  const cases = [
    ['default', undefined],
    ['external', 'https://open.feishu.cn/open-apis'],
    ['fake-localhost', 'https://localhost.evil.example/open-apis'],
    ['fake-loopback', 'https://127.0.0.1.evil.example/open-apis'],
    ['invalid', 'not-a-url'],
  ];
  try {
    for (const [name, apiBase] of cases) {
      const env = childEnv({
        NODE_TLS_REJECT_UNAUTHORIZED: '0',
        FEISHU_TENANT_ACCESS_TOKEN: 'fake-token',
      });
      if (apiBase === undefined) delete env.FEISHU_API_BASE;
      else env.FEISHU_API_BASE = apiBase;
      const stateDir = path.join(tempRoot, `${name}-state`);
      const reportPath = path.join(tempRoot, `${name}-report.md`);
      const result = runWatchWithEnv({
        stateDir,
        reportPath,
        env,
        sourceManifestPath: path.join(tempRoot, 'network-sentinel-missing-manifest.json'),
        extraArgs: ['--allow-insecure-tls-local-debug'],
      });
      assert.notEqual(result.status, 0, `${name} API base must remain blocked`);
      const report = readFileSync(reportPath, 'utf8');
      assert.match(report, /TLS verification is disabled by NODE_TLS_REJECT_UNAUTHORIZED=0/u);
      assertNoWatcherStatePayload(stateDir);
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function test_tls_disabled_override_allows_exact_loopback_and_discloses_mode() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'dy-0456-tls-loopback-override-'));
  const reportPath = path.join(tempRoot, 'report.md');
  const eventPath = path.join(tempRoot, 'event.json');
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    response.setHeader('content-type', 'application/json');
    response.setHeader('connection', 'close');
    if (url.pathname === '/open-apis/wiki/v2/spaces/get_node') {
      response.end(JSON.stringify({ code: 99991672, msg: 'wiki scope intentionally unavailable' }));
      return;
    }
    if (url.pathname === '/open-apis/docx/v1/documents/Wurow8wi2iFyJqkDu81cyySQnlf/raw_content') {
      response.end(JSON.stringify({ code: 0, msg: 'success', data: { content: '# Loopback\n\nlocal data' } }));
      return;
    }
    response.end(JSON.stringify({ code: 404, msg: `unexpected path ${url.pathname}` }));
  });
  try {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const { port } = server.address();
    writeFileSync(eventPath, JSON.stringify({
      header: { event_type: 'drive.file.edit_v1', event_id: 'evt_tls_loopback' },
      event: { file_token: 'Wurow8wi2iFyJqkDu81cyySQnlf', file_type: 'docx' },
    }, null, 2));
    const result = await runWatchWithEnvAsync({
      stateDir: path.join(tempRoot, 'state'),
      reportPath,
      env: childEnv({
        NODE_TLS_REJECT_UNAUTHORIZED: '0',
        FEISHU_API_BASE: `http://127.0.0.1:${port}/open-apis`,
        FEISHU_TENANT_ACCESS_TOKEN: 'fake-token',
      }),
      extraArgs: ['--event-file', eventPath, '--allow-insecure-tls-local-debug'],
    });
    assert.equal(result.status, 0, `loopback override should pass\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
    const report = readFileSync(reportPath, 'utf8');
    assert.match(report, /TLS Verification: DISABLED_FOR_LOCAL_DEBUG/u);
    assert.match(report, /Source Format: raw_content/u);
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function test_fixture_run_reports_adopt_candidates_and_confirmation_stops() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'dy-0441-feishu-watch-'));
  const reportPath = path.join(tempRoot, 'report.md');
  try {
    const first = runWatch({ stateDir: path.join(tempRoot, 'state'), reportPath });
    assert.equal(first.status, 0, `watch command should pass\nstdout:\n${first.stdout}\nstderr:\n${first.stderr}`);

    const report = readFileSync(reportPath, 'utf8');
    assert.match(report, /Status: CHANGED/u, 'first fixture run must detect changed sections');
    assert.match(report, /Document: Rules/u, 'report must identify the changed Feishu document role');
    assert.match(report, /Changed Heading: PIN 连接规则/u, 'report must group compatible changes by heading');
    assert.match(report, /Review Class: adopt_plan_update/u, 'compatible changes can be plan-update candidates');
    assert.match(report, /Section Diff:/u, 'changed sections must include git-like diff lines');
    assert.match(
      report,
      /\+ 连接 payload 必须保留 response_topic，方便提交动作找到返回通道。/u,
      'compatible additions must be visible as + diff lines',
    );
    assert.match(report, /Changed Heading: 权限边界/u, 'report must group conflict-like changes by heading');
    assert.match(
      report,
      /Review Class: requires_user_confirmation/u,
      'conflict-like changes must wait for user/team confirmation',
    );
    assert.match(
      report,
      /Reason: current SSOT conflict/u,
      'confirmation stops must include an explicit reason',
    );
    assert.match(
      report,
      /Stop: user\/team confirmation required/u,
      'confirmation stops must be obvious to the next agent',
    );
    assert.match(
      report,
      /\+ 为了调试效率，UI 可以在特殊调试时直接修改业务状态。/u,
      'confirmation-stop additions must still show the concrete changed line',
    );
    assert.doesNotMatch(report, /Final Reject|Rejected|final rejection/iu, 'report must not make final reject decisions');

    const second = runWatch({ stateDir: path.join(tempRoot, 'state'), reportPath });
    assert.equal(second.status, 0, `second watch command should pass\nstdout:\n${second.stdout}\nstderr:\n${second.stderr}`);
    const secondReport = readFileSync(reportPath, 'utf8');
    assert.match(secondReport, /Status: NO_CHANGE/u, 'second identical fixture run must be idempotent');
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function test_mock_file_edit_event_limits_run_to_changed_document() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'dy-0441-feishu-watch-event-'));
  const eventPath = path.join(tempRoot, 'event.json');
  const reportPath = path.join(tempRoot, 'report.md');
  try {
    const event = {
      header: { event_type: 'drive.file.edit_v1', event_id: 'evt_rules_fixture' },
      event: { file_token: 'QnzqwrqRgiUOjUkzTA3chrVfnBd', file_type: 'docx' },
    };
    writeFileSync(eventPath, JSON.stringify(event, null, 2));
    const result = runWatch({
      stateDir: path.join(tempRoot, 'state'),
      reportPath,
      extraArgs: ['--event-file', eventPath],
    });
    assert.equal(result.status, 0, `event-filtered watch should pass\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
    const report = readFileSync(reportPath, 'utf8');
    assert.match(report, /Event Filter: drive.file.edit_v1 evt_rules_fixture/u);
    assert.match(report, /Document: Rules/u);
    assert.doesNotMatch(report, /Document: Main/u, 'event-filtered run must not diff unrelated docs');
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function test_doc_id_filter_limits_run_to_selected_documents() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'dy-0441-feishu-watch-doc-filter-'));
  const reportPath = path.join(tempRoot, 'report.md');
  try {
    const result = runWatch({
      stateDir: path.join(tempRoot, 'state'),
      reportPath,
      extraArgs: ['--doc-id', 'rules'],
    });
    assert.equal(result.status, 0, `doc-id filtered watch should pass\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
    const report = readFileSync(reportPath, 'utf8');
    assert.match(report, /Documents Checked: 1/u, 'doc-id filtered run must check only selected docs');
    assert.match(report, /Document: Rules/u);
    assert.doesNotMatch(report, /Document: Main/u, 'doc-id filtered run must not diff unrelated docs');
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function test_real_mode_blocker_writes_report_without_token() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'dy-0441-feishu-watch-blocked-'));
  const reportPath = path.join(tempRoot, 'blocked-report.md');
  try {
    const env = childEnv({
      FEISHU_TENANT_ACCESS_TOKEN: '',
      FEISHU_ACCESS_TOKEN: '',
      FEISHU_APP_ID: '',
      FEISHU_APP_SECRET: '',
    });
    const result = runWatchWithEnv({
      stateDir: path.join(tempRoot, 'state'),
      reportPath,
      env,
    });
    assert.notEqual(result.status, 0, 'real mode without credentials must exit non-zero');
    const report = readFileSync(reportPath, 'utf8');
    assert.match(report, /Status: BLOCKED/u, 'real-mode blocker must still write a report');
    assert.match(report, /Blocker: missing FEISHU_TENANT_ACCESS_TOKEN/u);
    assert.match(report, /No Feishu source content was changed or committed/u);
    assert.doesNotMatch(report, /app_secret|tenant_access_token: [A-Za-z0-9_-]+/iu, 'blocker report must not leak secrets');
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function test_real_mode_falls_back_to_raw_content_when_wiki_scope_is_missing() {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'dy-0441-feishu-watch-raw-fallback-'));
  const reportPath = path.join(tempRoot, 'raw-fallback-report.md');
  const eventPath = path.join(tempRoot, 'event.json');
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    response.setHeader('content-type', 'application/json');
    response.setHeader('connection', 'close');
    if (url.pathname === '/open-apis/wiki/v2/spaces/get_node') {
      response.end(JSON.stringify({
        code: 99991672,
        msg: 'Access denied. One of the following scopes is required: [wiki:node:read].',
      }));
      return;
    }
    if (url.pathname === '/open-apis/docx/v1/documents/Wurow8wi2iFyJqkDu81cyySQnlf/raw_content') {
      response.end(JSON.stringify({
        code: 0,
        msg: 'success',
        data: { content: '# Raw Fallback\n\nraw fallback line' },
      }));
      return;
    }
    response.end(JSON.stringify({ code: 404, msg: `unexpected path ${url.pathname}` }));
  });
  try {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const { port } = server.address();
    writeFileSync(eventPath, JSON.stringify({
      header: { event_type: 'drive.file.edit_v1', event_id: 'evt_main_raw_fallback' },
      event: { file_token: 'Wurow8wi2iFyJqkDu81cyySQnlf', file_type: 'docx' },
    }, null, 2));
    const result = await runWatchWithEnvAsync({
      stateDir: path.join(tempRoot, 'state'),
      reportPath,
      env: childEnv({
        FEISHU_API_BASE: `http://127.0.0.1:${port}/open-apis`,
        FEISHU_TENANT_ACCESS_TOKEN: 'fake-token',
        FEISHU_ACCESS_TOKEN: '',
        FEISHU_APP_ID: '',
        FEISHU_APP_SECRET: '',
      }),
      extraArgs: ['--event-file', eventPath],
    });
    assert.equal(result.status, 0, `raw fallback watch should pass\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
    const report = readFileSync(reportPath, 'utf8');
    assert.match(report, /Status: BASELINE_CREATED/u);
    assert.match(report, /Document: Main/u);
    assert.match(report, /Source Format: raw_content/u, 'report must disclose low-fidelity raw_content fallback');
    assert.match(report, /raw fallback line/u);
    assert.match(report, /Confirmation Stops: 0/u, 'initial baseline creation must not create confirmation stops');
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

const tests = [
  test_manifest_records_no_secret_feishu_sources_and_confirmation_policy,
  test_changed_line_classifier_uses_full_normalized_duplicate_aware_diff,
  test_revision_14272_focused_fixture_routes_all_new_risk_families,
  test_tls_disabled_blocks_before_manifest_event_or_state_processing,
  test_tls_disabled_override_allows_fixture_and_discloses_mode,
  test_tls_disabled_fixture_without_override_is_blocked,
  test_tls_disabled_override_rejects_external_deceptive_and_invalid_bases,
  test_tls_disabled_override_allows_exact_loopback_and_discloses_mode,
  test_fixture_run_reports_adopt_candidates_and_confirmation_stops,
  test_mock_file_edit_event_limits_run_to_changed_document,
  test_doc_id_filter_limits_run_to_selected_documents,
  test_real_mode_blocker_writes_report_without_token,
  test_real_mode_falls_back_to_raw_content_when_wiki_scope_is_missing,
];

let passed = 0;
for (const test of tests) {
  try {
    await test();
    console.log(`[PASS] ${test.name}`);
    passed += 1;
  } catch (error) {
    console.error(`[FAIL] ${test.name}: ${error.message}`);
    process.exitCode = 1;
  }
}

console.log(`${passed} passed, ${tests.length - passed} failed out of ${tests.length}`);
