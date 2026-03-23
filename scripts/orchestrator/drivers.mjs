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

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
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

  return {
    ok: true,
    output: {
      ...parsed,
      steps_completed: Array.isArray(parsed.steps_completed) ? parsed.steps_completed : [],
      files_changed: Array.isArray(parsed.files_changed) ? parsed.files_changed : [],
      validation_results: Array.isArray(parsed.validation_results) ? parsed.validation_results : [],
      spawned_iterations: Array.isArray(parsed.spawned_iterations) ? parsed.spawned_iterations : [],
      browser_tasks: Array.isArray(parsed.browser_tasks) ? parsed.browser_tasks : [],
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
    },
  }
}
