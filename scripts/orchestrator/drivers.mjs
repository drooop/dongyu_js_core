/**
 * drivers.mjs — CLI tool drivers (§13)
 *
 * Codex CLI (doit role): codex exec for planning and execution
 * Claude Code CLI (ultrawork role): claude -p for review
 *
 * Each call captures output to transcript files.
 * Claude Code session_id is extracted from JSON output.
 */

import { execSync } from 'child_process'
import { writeFileSync, readFileSync, existsSync, mkdirSync, renameSync } from 'fs'
import { dirname, join } from 'path'
import { transcriptsDir } from './state.mjs'
import { normalizeFailureSignal } from './escalation_engine.mjs'
import {
  BROWSER_TASK_REQUEST_SCHEMA_VERSION,
  BROWSER_TASK_KIND,
  BROWSER_TASK_BRIDGE_CHANNEL,
  BROWSER_TASK_EXECUTOR_CLASS,
  deriveBrowserTaskPaths,
  loadBrowserTaskRequest,
  validateBrowserTaskRequest,
} from './browser_bridge.mjs'

// Ensure transcript directory exists before writing (needed for decompose
// which runs before any state/batch is created).
function ensureTranscriptDir(batchId) {
  const dir = transcriptsDir(batchId)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function buildCliFailureResult(raw = {}) {
  const failureSignal = normalizeFailureSignal(raw)
  return {
    ok: false,
    error: raw.error || failureSignal.message,
    error_type: failureSignal.kind,
    failure_signal: failureSignal,
    stdout: raw.stdout || '',
    stderr: raw.stderr || '',
    transcript_file: raw.transcript_file || null,
    session_id: raw.session_id || null,
    raw: raw.raw || undefined,
  }
}

const EXEC_BROWSER_TASK_ID_RE = /^[a-z0-9][a-z0-9._-]*$/
const EXEC_BROWSER_ARTIFACT_FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const EXEC_BROWSER_ARTIFACT_KINDS = new Set(['screenshot', 'json', 'trace', 'console'])
const EXEC_BROWSER_EXECUTOR_MODES = new Set(['mock', 'mcp'])
const OPS_TASK_REQUEST_SCHEMA_VERSION = 'ops_task_request.v1'
const OPS_TASK_KIND = 'ops_task'
const OPS_TASK_BRIDGE_CHANNEL = 'ops_task_bridge'
const OPS_TASK_EXECUTOR_CLASS = 'ops_capable'
const EXEC_OPS_TASK_ID_RE = /^[a-z0-9][a-z0-9._-]*$/
const EXEC_OPS_ARTIFACT_FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const EXEC_OPS_ARTIFACT_KINDS = new Set(['file', 'json', 'log', 'archive'])
const EXEC_OPS_EXECUTOR_MODES = new Set(['mock', 'local_shell', 'ssh'])
const EXEC_OPS_TARGET_ENVS = new Set(['local', 'remote'])
const EXEC_OPS_HOST_SCOPES = new Set(['repo', 'local_host', 'local_cluster', 'remote_host', 'remote_cluster'])
const EXEC_OPS_DANGER_LEVELS = new Set(['low', 'medium', 'high', 'critical'])

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function isSafeRelativePath(value) {
  return isNonEmptyString(value) && !value.startsWith('/') && !value.includes('..')
}

function validateExecBrowserTask(task, index, seenTaskIds = new Set()) {
  const prefix = `browser_tasks[${index}]`

  if (!task || typeof task !== 'object' || Array.isArray(task)) {
    return { ok: false, error: `${prefix} must be an object` }
  }
  if (task.task_kind !== BROWSER_TASK_KIND) {
    return { ok: false, error: `${prefix}.task_kind must be "${BROWSER_TASK_KIND}"` }
  }
  if (!EXEC_BROWSER_TASK_ID_RE.test(task.task_id || '')) {
    return { ok: false, error: `${prefix}.task_id must be a stable kebab/id token` }
  }
  if (seenTaskIds.has(task.task_id)) {
    return { ok: false, error: `${prefix}.task_id duplicates a previous browser task` }
  }
  seenTaskIds.add(task.task_id)

  if (!isNonEmptyString(task.summary)) {
    return { ok: false, error: `${prefix}.summary is required` }
  }
  if (task.start_url !== undefined && !isNonEmptyString(task.start_url)) {
    return { ok: false, error: `${prefix}.start_url must be a non-empty string when present` }
  }
  if (!Array.isArray(task.instructions) || task.instructions.length === 0 || !task.instructions.every(isNonEmptyString)) {
    return { ok: false, error: `${prefix}.instructions must be a non-empty string array` }
  }
  if (
    !Array.isArray(task.success_assertions) ||
    task.success_assertions.length === 0 ||
    !task.success_assertions.every(isNonEmptyString)
  ) {
    return { ok: false, error: `${prefix}.success_assertions must be a non-empty string array` }
  }
  if (!Number.isInteger(task.timeout_ms) || task.timeout_ms < 1) {
    return { ok: false, error: `${prefix}.timeout_ms must be >= 1` }
  }
  if (
    !task.executor ||
    typeof task.executor !== 'object' ||
    !EXEC_BROWSER_EXECUTOR_MODES.has(task.executor.mode) ||
    !isNonEmptyString(task.executor.executor_id)
  ) {
    return { ok: false, error: `${prefix}.executor must define mode=mock|mcp and executor_id` }
  }
  if (!Array.isArray(task.required_artifacts) || task.required_artifacts.length === 0) {
    return { ok: false, error: `${prefix}.required_artifacts must be non-empty` }
  }

  const seenArtifactFiles = new Set()
  for (const [artifactIndex, artifact] of task.required_artifacts.entries()) {
    const artifactPrefix = `${prefix}.required_artifacts[${artifactIndex}]`
    if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
      return { ok: false, error: `${artifactPrefix} must be an object` }
    }
    if (!EXEC_BROWSER_ARTIFACT_KINDS.has(artifact.artifact_kind)) {
      return { ok: false, error: `${artifactPrefix}.artifact_kind is invalid` }
    }
    if (!EXEC_BROWSER_ARTIFACT_FILE_RE.test(artifact.file_name || '')) {
      return { ok: false, error: `${artifactPrefix}.file_name must be a simple filename` }
    }
    if (seenArtifactFiles.has(artifact.file_name)) {
      return { ok: false, error: `${artifactPrefix}.file_name duplicates a previous artifact` }
    }
    seenArtifactFiles.add(artifact.file_name)
    if (typeof artifact.required !== 'boolean') {
      return { ok: false, error: `${artifactPrefix}.required must be boolean` }
    }
    if (!isNonEmptyString(artifact.media_type)) {
      return { ok: false, error: `${artifactPrefix}.media_type is required` }
    }
  }

  return { ok: true }
}

function validateExecOpsTask(task, index, seenTaskIds = new Set()) {
  const prefix = `ops_tasks[${index}]`

  if (!task || typeof task !== 'object' || Array.isArray(task)) {
    return { ok: false, error: `${prefix} must be an object` }
  }
  if (task.task_kind !== OPS_TASK_KIND) {
    return { ok: false, error: `${prefix}.task_kind must be "${OPS_TASK_KIND}"` }
  }
  if (!EXEC_OPS_TASK_ID_RE.test(task.task_id || '')) {
    return { ok: false, error: `${prefix}.task_id must be a stable kebab/id token` }
  }
  if (seenTaskIds.has(task.task_id)) {
    return { ok: false, error: `${prefix}.task_id duplicates a previous ops task` }
  }
  seenTaskIds.add(task.task_id)

  if (!isNonEmptyString(task.summary)) {
    return { ok: false, error: `${prefix}.summary is required` }
  }
  if (!isNonEmptyString(task.command)) {
    return { ok: false, error: `${prefix}.command is required` }
  }
  if (!isNonEmptyString(task.shell)) {
    return { ok: false, error: `${prefix}.shell is required` }
  }
  if (!isSafeRelativePath(task.cwd)) {
    return { ok: false, error: `${prefix}.cwd must be a repo-relative path` }
  }
  if (!EXEC_OPS_TARGET_ENVS.has(task.target_env)) {
    return { ok: false, error: `${prefix}.target_env must be local|remote` }
  }
  if (!EXEC_OPS_HOST_SCOPES.has(task.host_scope)) {
    return { ok: false, error: `${prefix}.host_scope is invalid` }
  }
  if (typeof task.mutating !== 'boolean') {
    return { ok: false, error: `${prefix}.mutating must be boolean` }
  }
  if (!EXEC_OPS_DANGER_LEVELS.has(task.danger_level)) {
    return { ok: false, error: `${prefix}.danger_level is invalid` }
  }
  if (
    !Array.isArray(task.success_assertions) ||
    task.success_assertions.length === 0 ||
    !task.success_assertions.every(isNonEmptyString)
  ) {
    return { ok: false, error: `${prefix}.success_assertions must be a non-empty string array` }
  }
  if (!Number.isInteger(task.timeout_ms) || task.timeout_ms < 1) {
    return { ok: false, error: `${prefix}.timeout_ms must be >= 1` }
  }
  if (
    !task.executor ||
    typeof task.executor !== 'object' ||
    !EXEC_OPS_EXECUTOR_MODES.has(task.executor.mode) ||
    !isNonEmptyString(task.executor.executor_id)
  ) {
    return { ok: false, error: `${prefix}.executor must define mode=mock|local_shell|ssh and executor_id` }
  }
  if (!Array.isArray(task.required_artifacts) || task.required_artifacts.length === 0) {
    return { ok: false, error: `${prefix}.required_artifacts must be non-empty` }
  }

  const seenArtifactFiles = new Set()
  for (const [artifactIndex, artifact] of task.required_artifacts.entries()) {
    const artifactPrefix = `${prefix}.required_artifacts[${artifactIndex}]`
    if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
      return { ok: false, error: `${artifactPrefix} must be an object` }
    }
    if (!EXEC_OPS_ARTIFACT_KINDS.has(artifact.artifact_kind)) {
      return { ok: false, error: `${artifactPrefix}.artifact_kind is invalid` }
    }
    if (!EXEC_OPS_ARTIFACT_FILE_RE.test(artifact.file_name || '')) {
      return { ok: false, error: `${artifactPrefix}.file_name must be a simple filename` }
    }
    if (seenArtifactFiles.has(artifact.file_name)) {
      return { ok: false, error: `${artifactPrefix}.file_name duplicates a previous artifact` }
    }
    seenArtifactFiles.add(artifact.file_name)
    if (typeof artifact.required !== 'boolean') {
      return { ok: false, error: `${artifactPrefix}.required must be boolean` }
    }
    if (!isNonEmptyString(artifact.media_type)) {
      return { ok: false, error: `${artifactPrefix}.media_type is required` }
    }
  }

  return { ok: true }
}

function normalizeExecOutputObject(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'Execution output JSON must be an object' }
  }

  if (parsed.browser_tasks !== undefined) {
    if (!Array.isArray(parsed.browser_tasks)) {
      return { ok: false, error: 'browser_tasks must be an array when present' }
    }

    const seenTaskIds = new Set()
    for (const [index, task] of parsed.browser_tasks.entries()) {
      const validation = validateExecBrowserTask(task, index, seenTaskIds)
      if (!validation.ok) {
        return validation
      }
    }
  }

  if (parsed.ops_tasks !== undefined) {
    if (!Array.isArray(parsed.ops_tasks)) {
      return { ok: false, error: 'ops_tasks must be an array when present' }
    }

    const seenTaskIds = new Set()
    for (const [index, task] of parsed.ops_tasks.entries()) {
      const validation = validateExecOpsTask(task, index, seenTaskIds)
      if (!validation.ok) {
        return validation
      }
    }
  }

  return {
    ok: true,
    output: {
      ...parsed,
      steps_completed: Array.isArray(parsed.steps_completed) ? parsed.steps_completed : [],
      files_changed: Array.isArray(parsed.files_changed) ? parsed.files_changed : [],
      validation_results: Array.isArray(parsed.validation_results) ? parsed.validation_results : [],
      spawned_iterations: Array.isArray(parsed.spawned_iterations) ? parsed.spawned_iterations : [],
      browser_tasks: Array.isArray(parsed.browser_tasks) ? parsed.browser_tasks : [],
      ops_tasks: Array.isArray(parsed.ops_tasks) ? parsed.ops_tasks : [],
    },
  }
}

function normalizeRequestForComparison(request) {
  return JSON.stringify({
    ...request,
    created_at: '<created_at>',
  })
}

function writeJsonAtomic(filePath, payload) {
  mkdirSync(dirname(filePath), { recursive: true })
  const tmpPath = `${filePath}.tmp`
  writeFileSync(tmpPath, JSON.stringify(payload, null, 2))
  renameSync(tmpPath, filePath)
}

function deriveOpsTaskPaths(batchId, taskId, opts = {}) {
  const rootDir = opts.rootDir || process.cwd()
  const taskDirRelative = `.orchestrator/runs/${batchId}/ops_tasks/${taskId}`
  const requestFileRelative = `${taskDirRelative}/request.json`
  const resultFileRelative = `${taskDirRelative}/result.json`
  const stdoutFileRelative = `${taskDirRelative}/stdout.log`
  const stderrFileRelative = `${taskDirRelative}/stderr.log`
  const artifactsDirRelative = `${taskDirRelative}/artifacts`

  return {
    batchId,
    taskId,
    rootDir,
    taskDirRelative,
    requestFileRelative,
    resultFileRelative,
    stdoutFileRelative,
    stderrFileRelative,
    artifactsDirRelative,
    taskDir: join(rootDir, taskDirRelative),
    requestFile: join(rootDir, requestFileRelative),
    resultFile: join(rootDir, resultFileRelative),
    stdoutFile: join(rootDir, stdoutFileRelative),
    stderrFile: join(rootDir, stderrFileRelative),
    artifactsDir: join(rootDir, artifactsDirRelative),
  }
}

function validateMaterializedOpsTaskRequest(request, opts = {}) {
  const rootDir = opts.rootDir || process.cwd()

  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    return { ok: false, reason: 'ops request must be an object', failureKind: 'request_invalid' }
  }
  if (request.schema_version !== OPS_TASK_REQUEST_SCHEMA_VERSION) {
    return { ok: false, reason: 'ops request schema_version mismatch', failureKind: 'request_invalid' }
  }
  if (request.task_kind !== OPS_TASK_KIND) {
    return { ok: false, reason: 'ops request task_kind mismatch', failureKind: 'request_invalid' }
  }
  if (!isNonEmptyString(request.batch_id) || !isNonEmptyString(request.iteration_id) || !isNonEmptyString(request.task_id)) {
    return { ok: false, reason: 'ops request identity is incomplete', failureKind: 'request_invalid' }
  }
  if (!Number.isInteger(request.attempt) || request.attempt < 1) {
    return { ok: false, reason: 'ops request attempt must be >= 1', failureKind: 'request_invalid' }
  }
  if (!isNonEmptyString(request.created_at)) {
    return { ok: false, reason: 'ops request created_at is required', failureKind: 'request_invalid' }
  }
  if (
    !request.executor ||
    request.executor.executor_class !== OPS_TASK_EXECUTOR_CLASS ||
    request.executor.bridge_channel !== OPS_TASK_BRIDGE_CHANNEL ||
    !EXEC_OPS_EXECUTOR_MODES.has(request.executor.mode) ||
    !isNonEmptyString(request.executor.executor_id)
  ) {
    return { ok: false, reason: 'ops request executor must describe an ops_task bridge consumer', failureKind: 'request_invalid' }
  }
  if (!isNonEmptyString(request.command) || !isNonEmptyString(request.shell) || !isSafeRelativePath(request.cwd)) {
    return { ok: false, reason: 'ops request execution boundary is incomplete', failureKind: 'request_invalid' }
  }
  if (!EXEC_OPS_TARGET_ENVS.has(request.target_env) || !EXEC_OPS_HOST_SCOPES.has(request.host_scope)) {
    return { ok: false, reason: 'ops request target_env/host_scope is invalid', failureKind: 'request_invalid' }
  }
  if (typeof request.mutating !== 'boolean' || !EXEC_OPS_DANGER_LEVELS.has(request.danger_level)) {
    return { ok: false, reason: 'ops request mutating/danger_level is invalid', failureKind: 'request_invalid' }
  }
  if (!Number.isInteger(request.timeout_ms) || request.timeout_ms < 1) {
    return { ok: false, reason: 'ops request timeout_ms must be >= 1', failureKind: 'request_invalid' }
  }
  if (!Array.isArray(request.success_assertions) || request.success_assertions.length === 0 || !request.success_assertions.every(isNonEmptyString)) {
    return { ok: false, reason: 'ops request success_assertions must be non-empty', failureKind: 'request_invalid' }
  }
  if (!Array.isArray(request.required_artifacts) || request.required_artifacts.length === 0) {
    return { ok: false, reason: 'ops request required_artifacts must be non-empty', failureKind: 'request_invalid' }
  }

  const paths = deriveOpsTaskPaths(request.batch_id, request.task_id, { rootDir })
  if (
    request.exchange?.request_file !== paths.requestFileRelative ||
    request.exchange?.result_file !== paths.resultFileRelative ||
    request.exchange?.task_dir !== paths.taskDirRelative ||
    request.exchange?.stdout_file !== paths.stdoutFileRelative ||
    request.exchange?.stderr_file !== paths.stderrFileRelative ||
    request.exchange?.artifacts_dir !== paths.artifactsDirRelative
  ) {
    return {
      ok: false,
      reason: 'ops request exchange paths do not match the canonical ops_tasks layout',
      failureKind: 'request_invalid',
    }
  }

  const artifactPrefix = `${paths.artifactsDirRelative}/`
  for (const artifact of request.required_artifacts) {
    if (
      !artifact ||
      typeof artifact !== 'object' ||
      !EXEC_OPS_ARTIFACT_KINDS.has(artifact.artifact_kind) ||
      !isNonEmptyString(artifact.media_type) ||
      typeof artifact.required !== 'boolean' ||
      !isNonEmptyString(artifact.relative_path) ||
      !artifact.relative_path.startsWith(artifactPrefix)
    ) {
      return {
        ok: false,
        reason: 'ops request required_artifacts contain an invalid entry',
        failureKind: 'request_invalid',
      }
    }
  }

  return { ok: true, paths }
}

function buildBrowserTaskRequest({ batchId, iterationId, task, rootDir = process.cwd() }) {
  const paths = deriveBrowserTaskPaths(batchId, task.task_id, { rootDir })
  const request = {
    schema_version: BROWSER_TASK_REQUEST_SCHEMA_VERSION,
    task_kind: BROWSER_TASK_KIND,
    batch_id: batchId,
    iteration_id: iterationId,
    task_id: task.task_id,
    attempt: 1,
    created_at: new Date().toISOString(),
    executor: {
      executor_class: BROWSER_TASK_EXECUTOR_CLASS,
      bridge_channel: BROWSER_TASK_BRIDGE_CHANNEL,
      executor_id: task.executor.executor_id,
      mode: task.executor.mode,
    },
    exchange: {
      request_file: paths.requestFileRelative,
      result_file: paths.resultFileRelative,
      task_dir: paths.taskDirRelative,
    },
    objective: {
      summary: task.summary,
      ...(task.start_url ? { start_url: task.start_url } : {}),
      instructions: [...task.instructions],
      success_assertions: [...task.success_assertions],
    },
    timeout_ms: task.timeout_ms,
    required_artifacts: task.required_artifacts.map(artifact => ({
      artifact_kind: artifact.artifact_kind,
      relative_path: `${paths.artifactsDirRelative}/${artifact.file_name}`,
      required: artifact.required,
      media_type: artifact.media_type,
    })),
  }

  const validation = validateBrowserTaskRequest(request, { rootDir })
  if (!validation.ok) {
    return {
      ok: false,
      error: validation.reason,
      failure_kind: validation.failureKind || 'request_invalid',
    }
  }

  return { ok: true, request, paths }
}

function buildOpsTaskRequest({ batchId, iterationId, task, rootDir = process.cwd() }) {
  const paths = deriveOpsTaskPaths(batchId, task.task_id, { rootDir })
  const request = {
    schema_version: OPS_TASK_REQUEST_SCHEMA_VERSION,
    task_kind: OPS_TASK_KIND,
    batch_id: batchId,
    iteration_id: iterationId,
    task_id: task.task_id,
    attempt: 1,
    created_at: new Date().toISOString(),
    executor: {
      executor_class: OPS_TASK_EXECUTOR_CLASS,
      bridge_channel: OPS_TASK_BRIDGE_CHANNEL,
      executor_id: task.executor.executor_id,
      mode: task.executor.mode,
    },
    exchange: {
      request_file: paths.requestFileRelative,
      result_file: paths.resultFileRelative,
      task_dir: paths.taskDirRelative,
      stdout_file: paths.stdoutFileRelative,
      stderr_file: paths.stderrFileRelative,
      artifacts_dir: paths.artifactsDirRelative,
    },
    command: task.command,
    shell: task.shell,
    cwd: task.cwd,
    target_env: task.target_env,
    host_scope: task.host_scope,
    mutating: task.mutating,
    danger_level: task.danger_level,
    timeout_ms: task.timeout_ms,
    success_assertions: [...task.success_assertions],
    required_artifacts: task.required_artifacts.map(artifact => ({
      artifact_kind: artifact.artifact_kind,
      relative_path: `${paths.artifactsDirRelative}/${artifact.file_name}`,
      required: artifact.required,
      media_type: artifact.media_type,
    })),
  }

  const validation = validateMaterializedOpsTaskRequest(request, { rootDir })
  if (!validation.ok) {
    return {
      ok: false,
      error: validation.reason,
      failure_kind: validation.failureKind || 'request_invalid',
    }
  }

  return { ok: true, request, paths }
}

export function materializeBrowserTaskRequests({
  batchId,
  iterationId,
  browserTasks,
  rootDir = process.cwd(),
}) {
  if (!Array.isArray(browserTasks)) {
    return { ok: false, error: 'browserTasks must be an array', failure_kind: 'request_invalid' }
  }

  const seenTaskIds = new Set()
  const materializedTasks = []

  for (const [index, task] of browserTasks.entries()) {
    const validation = validateExecBrowserTask(task, index, seenTaskIds)
    if (!validation.ok) {
      return { ok: false, error: validation.error, failure_kind: 'request_invalid' }
    }

    const built = buildBrowserTaskRequest({ batchId, iterationId, task, rootDir })
    if (!built.ok) {
      return built
    }

    const { paths, request } = built

    if (existsSync(paths.requestFile)) {
      try {
        const existing = loadBrowserTaskRequest({ batchId, taskId: task.task_id, rootDir })
        if (normalizeRequestForComparison(existing.request) !== normalizeRequestForComparison(request)) {
          return {
            ok: false,
            error: `Existing canonical request.json conflicts with browser_tasks[${index}]`,
            failure_kind: 'request_invalid',
          }
        }

        materializedTasks.push({
          status: 'existing_request',
          request: existing.request,
          paths: existing.paths,
        })
        continue
      } catch (error) {
        return {
          ok: false,
          error: error.message || `Cannot load existing browser request for ${task.task_id}`,
          failure_kind: error.failureKind || 'request_invalid',
        }
      }
    }

    writeJsonAtomic(paths.requestFile, request)
    materializedTasks.push({
      status: 'written',
      request,
      paths,
    })
  }

  return { ok: true, tasks: materializedTasks }
}

export function materializeOpsTaskRequests({
  batchId,
  iterationId,
  opsTasks,
  rootDir = process.cwd(),
}) {
  if (!Array.isArray(opsTasks)) {
    return { ok: false, error: 'opsTasks must be an array', failure_kind: 'request_invalid' }
  }

  const seenTaskIds = new Set()
  const materializedTasks = []

  for (const [index, task] of opsTasks.entries()) {
    const validation = validateExecOpsTask(task, index, seenTaskIds)
    if (!validation.ok) {
      return { ok: false, error: validation.error, failure_kind: 'request_invalid' }
    }

    const built = buildOpsTaskRequest({ batchId, iterationId, task, rootDir })
    if (!built.ok) {
      return built
    }

    const { paths, request } = built
    mkdirSync(paths.taskDir, { recursive: true })
    mkdirSync(paths.artifactsDir, { recursive: true })

    if (existsSync(paths.requestFile)) {
      try {
        const existing = JSON.parse(readFileSync(paths.requestFile, 'utf8'))
        if (normalizeRequestForComparison(existing) !== normalizeRequestForComparison(request)) {
          return {
            ok: false,
            error: `Existing canonical request.json conflicts with ops_tasks[${index}]`,
            failure_kind: 'request_invalid',
          }
        }

        materializedTasks.push({
          status: 'existing_request',
          request: existing,
          paths,
        })
        continue
      } catch (error) {
        return {
          ok: false,
          error: error.message || `Cannot load existing ops request for ${task.task_id}`,
          failure_kind: 'request_invalid',
        }
      }
    }

    writeJsonAtomic(paths.requestFile, request)
    materializedTasks.push({
      status: 'written',
      request,
      paths,
    })
  }

  return { ok: true, tasks: materializedTasks }
}

// ── Codex exec (doit) ──────────────────────────────────

export function codexExec(batchId, iterationId, prompt, opts = {}) {
  ensureTranscriptDir(batchId)
  const sandbox = opts.sandbox || 'workspace-write'
  const model = opts.model || 'gpt-5.4'
  const transcriptFile = join(transcriptsDir(batchId), `${iterationId}_${opts.phase || 'exec'}.json`)

  const promptFile = join(transcriptsDir(batchId), `${iterationId}_${opts.phase || 'exec'}_prompt.txt`)
  writeFileSync(promptFile, prompt)

  try {
    const result = execSync(
      `codex exec --full-auto -s ${sandbox} -m ${model} ` +
      `--ephemeral ` +
      `-o ${transcriptFile} ` +
      `- < ${promptFile}`,
      {
        cwd: process.cwd(),
        encoding: 'utf-8',
        maxBuffer: 50 * 1024 * 1024,
        timeout: opts.timeout || 600_000,
        stdio: ['pipe', 'pipe', 'inherit'], // stderr passes through for real-time progress
      }
    )

    // Read the output file
    let output = ''
    try {
      output = readFileSync(transcriptFile, 'utf-8')
    } catch {
      output = result // fallback to stdout
    }

    return {
      ok: true,
      output,
      stdout: result,
      transcript_file: transcriptFile,
    }
  } catch (err) {
    return buildCliFailureResult({
      source: 'codex_exec',
      operation: 'codexExec',
      phase: opts.phase || 'exec',
      error: err.message,
      stdout: err.stdout || '',
      stderr: err.stderr || '',
      code: err.code || null,
      transcript_file: transcriptFile,
    })
  }
}

// ── Claude Code review (ultrawork) ─────────────────────

export function claudeReview(batchId, iterationId, prompt, opts = {}) {
  ensureTranscriptDir(batchId)
  const model = opts.model || 'opus'
  const maxTurns = opts.maxTurns || 6   // Lower default: read files + produce verdict
  const phase = opts.phase || 'review'
  const round = opts.round || 0
  const continueSession = opts.continueSession || false

  const transcriptFile = join(
    transcriptsDir(batchId),
    `${iterationId}_${phase}_r${round}.json`
  )

  const promptFile = join(
    transcriptsDir(batchId),
    `${iterationId}_${phase}_r${round}_prompt.txt`
  )
  writeFileSync(promptFile, prompt)

  // §13.1: review = read-only + can run tests, no edits.
  // Agent/Skill removed — they trigger plan-heavy behavior and ExitPlanMode loops
  // that exhaust max-turns without producing parseable output.
  const defaultTools = [
    'Read', 'Grep', 'Glob', 'Bash',
  ]
  const allowedTools = (opts.allowedTools || defaultTools).join(',')

  const continueFlag = continueSession ? '-c' : ''

  try {
    const result = execSync(
      `cat ${promptFile} | claude -p ${continueFlag} ` +
      `--model ${model} ` +
      `--output-format json ` +
      `--max-turns ${maxTurns} ` +
      `--allowedTools "${allowedTools}"`,
      {
        cwd: process.cwd(),
        encoding: 'utf-8',
        maxBuffer: 50 * 1024 * 1024,
        timeout: opts.timeout || 600_000,
        stdio: ['pipe', 'pipe', 'inherit'],
      }
    )

    // Save raw transcript
    writeFileSync(transcriptFile, result)

    // Parse JSON output
    let parsed
    try {
      parsed = JSON.parse(result)
    } catch {
      return buildCliFailureResult({
        source: 'claude_review',
        operation: 'claudeReview',
        phase,
        stage: 'json_parse',
        error: 'Failed to parse Claude Code JSON output',
        raw: result,
        transcript_file: transcriptFile,
      })
    }

    // Extract session_id for Auto-Approval audit (§5.3)
    const sessionId = parsed.session_id || null

    // Detect error_max_turns — Claude ran out of turns without finishing.
    // This is a distinct failure mode from parse errors.
    const stopReason = parsed.stop_reason || ''
    if (stopReason === 'tool_use' || stopReason === 'error_max_turns') {
      // Claude exhausted turns doing tool calls without producing a final text response
      return buildCliFailureResult({
        source: 'claude_review',
        operation: 'claudeReview',
        phase,
        error_type: 'max_turns',
        stop_reason: stopReason,
        num_turns: parsed.num_turns || null,
        error: `Claude exhausted turns (stop_reason=${stopReason}, turns=${parsed.num_turns || '?'})`,
        transcript_file: transcriptFile,
        session_id: sessionId,
      })
    }

    // Extract the result text. Claude Code sometimes returns the useful
    // review payload in permission_denials[*].tool_input.plan (for example
    // when ExitPlanMode is denied), or as plain prose in result.
    const resultText = extractClaudeResultText(parsed)

    return {
      ok: true,
      result_text: resultText,
      session_id: sessionId,
      num_turns: parsed.num_turns || 0,
      transcript_file: transcriptFile,
      raw_parsed: parsed,
    }
  } catch (err) {
    return buildCliFailureResult({
      source: 'claude_review',
      operation: 'claudeReview',
      phase,
      error: err.message,
      stdout: err.stdout || '',
      stderr: err.stderr || '',
      code: err.code || null,
      transcript_file: transcriptFile,
    })
  }
}

// ── Extract review text from Claude Code outer JSON ─────

export function extractClaudeResultText(parsed) {
  const parts = []

  if (typeof parsed?.result === 'string' && parsed.result.trim()) {
    parts.push(parsed.result.trim())
  }

  if (Array.isArray(parsed?.permission_denials)) {
    for (const denial of parsed.permission_denials) {
      const plan = denial?.tool_input?.plan
      if (typeof plan === 'string' && plan.trim()) {
        parts.push(plan.trim())
      }
    }
  }

  // Deduplicate identical segments while preserving order.
  return [...new Set(parts)].join('\n\n')
}

// ── Parse verdict from Claude Code result text ─────────

export function parseVerdict(resultText) {
  // Try to find JSON block in result text
  // Claude Code outputs the verdict as JSON within its response text
  const jsonPatterns = [
    // Fenced code block with json
    /```json\s*\n?([\s\S]*?)\n?\s*```/,
    // Raw JSON object with verdict field
    /(\{[\s\S]*?"verdict"[\s\S]*?\})\s*$/,
    // JSON anywhere in text
    /(\{[\s\S]*?"verdict"\s*:\s*"(?:APPROVED|NEEDS_CHANGES)"[\s\S]*?\})/,
  ]

  for (const pattern of jsonPatterns) {
    const match = resultText.match(pattern)
    if (match) {
      try {
        const parsed = JSON.parse(match[1] || match[0])
        if (parsed.verdict) return { ok: true, verdict: parsed }
      } catch {
        continue
      }
    }
  }

  // Fallback: Claude Code often returns a prose summary such as:
  // "Verdict: **APPROVED**" or "NEEDS_CHANGES (major)"
  const verdictMatch = resultText.match(
    /\bverdict\b\s*[:=]\s*(?:\*{1,2}\s*)?(APPROVED|NEEDS_CHANGES)(?:\s*\*{1,2})?/i
  ) || resultText.match(
    /\b(APPROVED|NEEDS_CHANGES)\b/
  )
  if (verdictMatch) {
    const verdict = verdictMatch[1].toUpperCase()
    // Try multiple patterns for revision_type:
    // 1. "revision_type: major"
    // 2. "NEEDS_CHANGES (major)" — inline parentheses
    // 3. "(major)" anywhere near the verdict
    const revisionTypeMatch = resultText.match(
      /\brevision_type\b\s*[:=]\s*(?:\*{1,2}\s*)?(major|minor|ambiguous)(?:\s*\*{1,2})?/i
    ) || resultText.match(
      /\bNEEDS_CHANGES\s*\(\s*(major|minor|ambiguous)\s*\)/i
    ) || resultText.match(
      /\(\s*(major|minor)\s*\)/i
    )
    const summary =
      resultText
        .split('\n')
        .map(line => line.trim())
        .find(Boolean) ||
      resultText.slice(0, 200)

    return {
      ok: true,
      verdict: {
        verdict,
        revision_type: revisionTypeMatch
          ? revisionTypeMatch[1].toLowerCase()
          : verdict === 'NEEDS_CHANGES'
            ? 'ambiguous'
            : undefined,
        blocking_issues: [],
        suggestions: [],
        summary,
      },
    }
  }

  return {
    ok: false,
    error: 'Could not parse verdict from review output',
    raw: resultText.slice(-500),
  }
}

// ── Parse final verification result ─────────────────────

export function parseFinalVerdict(resultText) {
  const jsonPatterns = [
    /```json\s*\n?([\s\S]*?)\n?\s*```/,
    /(\{[\s\S]*?"all_goals_met"[\s\S]*?\})\s*$/,
    /(\{[\s\S]*?"goal_results"[\s\S]*?\})/,
  ]

  for (const pattern of jsonPatterns) {
    const match = resultText.match(pattern)
    if (match) {
      try {
        const parsed = JSON.parse(match[1] || match[0])
        if ('all_goals_met' in parsed) return { ok: true, result: parsed }
      } catch {
        continue
      }
    }
  }

  return {
    ok: false,
    error: 'Could not parse final verification from review output',
    raw: resultText.slice(-500),
  }
}

// ── Parse exec output from Codex result ────────────────

export function parseExecOutput(outputText) {
  const jsonPatterns = [
    /```json\s*\n?([\s\S]*?)\n?\s*```/,
    /(\{[\s\S]*?"execution_summary"[\s\S]*?\})\s*$/,
  ]
  let matchedStructuredJson = false
  let lastError = null

  for (const pattern of jsonPatterns) {
    const match = outputText.match(pattern)
    if (match) {
      matchedStructuredJson = true
      try {
        const normalized = normalizeExecOutputObject(JSON.parse(match[1] || match[0]))
        if (normalized.ok) {
          return normalized
        }
        lastError = normalized.error
      } catch (error) {
        lastError = error.message || 'Could not parse exec output JSON'
      }
    }
  }

  if (matchedStructuredJson) {
    return {
      ok: false,
      error: lastError || 'Could not parse structured execution output',
    }
  }

  // If no structured output, return raw as summary
  return {
    ok: true,
    output: {
      execution_summary: outputText.slice(-2000),
      steps_completed: [],
      files_changed: [],
      validation_results: [],
      spawned_iterations: [],
      browser_tasks: [],
      ops_tasks: [],
    },
  }
}
