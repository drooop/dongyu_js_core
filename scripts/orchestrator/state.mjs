/**
 * state.mjs — Authoritative state management (§2)
 *
 * state.json is the SOLE recovery source.
 * All writes use write-to-temp + rename for atomicity.
 * state_revision is monotonically increasing.
 */

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync, unlinkSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { randomUUID, createHash } from 'crypto'
import { execSync } from 'child_process'
import { loadBrowserTaskRequest, loadBrowserTaskResult, verifyArtifactsOnDisk } from './browser_bridge.mjs'

const SCHEMA_VERSION = 1

function summarizeBatchState(state) {
  const counts = {
    total: Array.isArray(state?.iterations) ? state.iterations.length : 0,
    completed: 0,
    active: 0,
    pending: 0,
    on_hold: 0,
    blocked_by_spawn: 0,
    proposed: 0,
  }

  for (const iter of state?.iterations || []) {
    if (Object.prototype.hasOwnProperty.call(counts, iter.status)) {
      counts[iter.status]++
    }
  }

  let lifecycle = 'running'
  let terminalOutcome = null

  const allIterationsClosed =
    counts.total > 0 &&
    counts.pending === 0 &&
    counts.active === 0 &&
    counts.on_hold === 0 &&
    counts.blocked_by_spawn === 0 &&
    counts.completed + counts.proposed === counts.total

  if (allIterationsClosed) {
    lifecycle = state.final_verification === 'pending'
      ? 'awaiting_final_verification'
      : 'completed'
    terminalOutcome = state.final_verification === 'pending'
      ? null
      : state.final_verification
  } else if (
    counts.total > 0 &&
    counts.pending === 0 &&
    counts.active === 0 &&
    (counts.on_hold > 0 || counts.blocked_by_spawn > 0)
  ) {
    lifecycle = 'stalled'
    terminalOutcome = counts.on_hold > 0 ? 'on_hold' : 'blocked_by_spawn'
  }

  return {
    lifecycle,
    terminal_outcome: terminalOutcome,
    final_verification: state.final_verification || 'pending',
    current_iteration: state.current_iteration || null,
    counts,
  }
}

export function refreshBatchSummary(state) {
  state.batch_summary = summarizeBatchState(state)
  return state.batch_summary
}

function ensureIterationEvidence(iter) {
  if (!iter.evidence) {
    iter.evidence = {}
  }

  iter.evidence.review_records ||= []
  iter.evidence.validation_commands ||= []
  iter.evidence.failures ||= []
  iter.evidence.escalations ||= []
  iter.evidence.oscillations ||= []
  iter.evidence.browser_tasks ||= []
  iter.evidence.final_commit ||= null
  iter.evidence.branch ||= iter.expected_branch || `dropx/dev_${iter.id}`

  return iter
}

function normalizeStateShape(state) {
  if (!Array.isArray(state?.iterations)) {
    return state
  }

  for (const iter of state.iterations) {
    ensureIterationEvidence(iter)
  }

  refreshBatchSummary(state)

  return state
}

function recordEvidence(iter, bucket, entry) {
  ensureIterationEvidence(iter)
  const evidenceEntry = {
    timestamp: entry?.timestamp || new Date().toISOString(),
    ...entry,
  }
  iter.evidence[bucket].push(evidenceEntry)
  return evidenceEntry
}

// ── Create ──────────────────────────────────────────────

export function createState(batchId, userPrompt, primaryGoals) {
  const promptHash = createHash('sha256').update(userPrompt).digest('hex')

  return normalizeStateShape({
    schema_version: SCHEMA_VERSION,
    state_revision: 0,
    batch_id: batchId,
    prompt_hash: promptHash,
    original_prompt: userPrompt,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    entry_source: null,
    entry_route: null,
    review_policy: null,
    risk_profile: null,
    primary_goals: primaryGoals.map((g, i) => ({
      index: i,
      description: g,
      status: 'pending',
    })),
    iterations: [],
    current_iteration: null,
    final_verification: 'pending',
    batch_summary: null,
    traceability: primaryGoals.map((g, i) => ({
      goal_index: i,
      goal_description: g,
      decomposed_requirement: '',
      iteration_ids: [],
      validation_commands: [],
      validation_results: [],
      status: 'pending',
    })),
  })
}

// ── Paths ───────────────────────────────────────────────

export function batchDir(batchId) {
  return join(process.cwd(), '.orchestrator', 'runs', batchId)
}

export function statePath(batchId) {
  return join(batchDir(batchId), 'state.json')
}

export function stateTmpPath(batchId) {
  return join(batchDir(batchId), 'state.json.tmp')
}

export function transcriptsDir(batchId) {
  return join(batchDir(batchId), 'transcripts')
}

// ── Load (with crash recovery §2.4) ────────────────────

export function loadState(batchId) {
  const dir = batchDir(batchId)
  const main = statePath(batchId)
  const tmp = stateTmpPath(batchId)

  // Case: tmp exists but main doesn't or is older → crash during rename
  if (existsSync(tmp)) {
    try {
      const tmpState = JSON.parse(readFileSync(tmp, 'utf-8'))
      if (tmpState.schema_version === SCHEMA_VERSION && typeof tmpState.state_revision === 'number') {
        // Valid tmp — complete the interrupted rename
        renameSync(tmp, main)
        return normalizeStateShape(tmpState)
      }
    } catch {
      // Corrupted tmp — discard
    }
    // Clean up invalid tmp
    try { unlinkSync(tmp) } catch { /* ignore */ }
  }

  if (!existsSync(main)) {
    return null
  }

  return normalizeStateShape(JSON.parse(readFileSync(main, 'utf-8')))
}

// ── Commit (atomic write §2.3, revision bump) ──────────

export function commitState(state) {
  normalizeStateShape(state)

  const dir = batchDir(state.batch_id)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const tDir = transcriptsDir(state.batch_id)
  if (!existsSync(tDir)) {
    mkdirSync(tDir, { recursive: true })
  }

  // Bump revision
  state.state_revision = (state.state_revision || 0) + 1
  state.updated_at = new Date().toISOString()

  const main = statePath(state.batch_id)
  const tmp = stateTmpPath(state.batch_id)

  // Write to temp, then atomic rename
  writeFileSync(tmp, JSON.stringify(state, null, 2))
  renameSync(tmp, main)

  return state
}

// ── Iteration helpers ───────────────────────────────────

export function addIteration(state, iter) {
  state.iterations.push(ensureIterationEvidence({
    id: iter.id,
    type: iter.type || 'primary',
    status: 'pending',
    phase: 'INTAKE',
    spec: { title: iter.title, requirement: iter.requirement },
    spawned_by: iter.spawned_by || null,
    blocks: iter.blocks || null,
    resolves_goals: iter.resolves_goals || [],
    review_round: 0,
    major_revision_count: 0,
    consecutive_approvals: 0,
    cli_failure_count: 0,
    entry_source: iter.entry_source || null,
    entry_route: iter.entry_route || null,
    review_policy: iter.review_policy || null,
    risk_profile: iter.risk_profile || null,
    registered_in_iterations_md: false,
    expected_branch: iter.expected_branch || `dropx/dev_${iter.id}`,
    last_checkpoint: 'INTAKE:created',
    evidence: {
      plan_md: null,
      resolution_md: null,
      runlog_md: null,
      review_records: [],
      validation_commands: [],
      failures: [],
      escalations: [],
      oscillations: [],
      browser_tasks: [],
      final_commit: null,
      branch: iter.expected_branch || `dropx/dev_${iter.id}`,
    },
  }))
  return state
}

export function findIteration(state, id) {
  return state.iterations.find(i => i.id === id)
}

export function updateIteration(state, id, updates) {
  const iter = findIteration(state, id)
  if (!iter) throw new Error(`Iteration ${id} not found in state`)
  Object.assign(iter, updates)
  return state
}

// ── Phase transition ────────────────────────────────────

export function transition(state, iterationId, newPhase, checkpoint) {
  const iter = findIteration(state, iterationId)
  if (!iter) throw new Error(`Iteration ${iterationId} not found`)
  iter.phase = newPhase
  iter.last_checkpoint = checkpoint || `${newPhase}:entered`
  return state
}

// ── Review record ───────────────────────────────────────

export function addReviewRecord(state, iterationId, record) {
  const iter = findIteration(state, iterationId)
  if (!iter) throw new Error(`Iteration ${iterationId} not found`)

  ensureIterationEvidence(iter)
  iter.evidence.review_records.push({
    round: record.round,
    phase: record.phase,
    revision_type: record.revision_type || 'n/a',
    verdict: record.verdict,
    summary: record.summary || '',
    session_id: record.session_id || 'missing',
    transcript_file: record.transcript_file || null,
    timestamp: new Date().toISOString(),
  })

  return state
}

export function recordFailureEvidence(state, iterationId, failure) {
  const iter = findIteration(state, iterationId)
  if (!iter) throw new Error(`Iteration ${iterationId} not found`)
  return recordEvidence(iter, 'failures', failure)
}

export function recordEscalationEvidence(state, iterationId, escalation) {
  const iter = findIteration(state, iterationId)
  if (!iter) throw new Error(`Iteration ${iterationId} not found`)
  return recordEvidence(iter, 'escalations', escalation)
}

export function recordOscillationEvidence(state, iterationId, oscillation) {
  const iter = findIteration(state, iterationId)
  if (!iter) throw new Error(`Iteration ${iterationId} not found`)
  return recordEvidence(iter, 'oscillations', oscillation)
}

export function getFailureEvidence(state, iterationId, options = {}) {
  const iter = findIteration(state, iterationId)
  if (!iter) throw new Error(`Iteration ${iterationId} not found`)
  ensureIterationEvidence(iter)

  return iter.evidence.failures.filter(entry => {
    if (!options.phase) return true
    return entry.phase === options.phase
  })
}

export function getReviewVerdictHistory(state, iterationId, phase = null) {
  const iter = findIteration(state, iterationId)
  if (!iter) throw new Error(`Iteration ${iterationId} not found`)
  ensureIterationEvidence(iter)

  return iter.evidence.review_records
    .filter(entry => !phase || entry.phase === phase)
    .map(entry => entry.verdict)
}

function upsertBrowserTaskRecord(iter, browserTask) {
  ensureIterationEvidence(iter)

  const nextRecord = {
    task_id: browserTask.task_id,
    attempt: browserTask.attempt || 1,
    status: browserTask.status || 'pending',
    failure_kind: browserTask.failure_kind || 'none',
    request_file: browserTask.request_file || null,
    result_file: browserTask.result_file || null,
    artifact_paths: Array.isArray(browserTask.artifact_paths) ? browserTask.artifact_paths : [],
    requested_at: browserTask.requested_at || null,
    ingested_at: browserTask.ingested_at || null,
  }

  const index = iter.evidence.browser_tasks.findIndex(entry => entry.task_id === nextRecord.task_id)
  if (index === -1) {
    iter.evidence.browser_tasks.push(nextRecord)
    return nextRecord
  }

  const merged = {
    ...iter.evidence.browser_tasks[index],
    ...nextRecord,
    requested_at: iter.evidence.browser_tasks[index].requested_at || nextRecord.requested_at,
  }
  iter.evidence.browser_tasks[index] = merged
  return merged
}

export function recordBrowserTaskRequest(state, iterationId, browserTask) {
  const iter = findIteration(state, iterationId)
  if (!iter) throw new Error(`Iteration ${iterationId} not found`)

  return upsertBrowserTaskRecord(iter, {
    ...browserTask,
    status: 'pending',
    failure_kind: browserTask.failure_kind || 'none',
    requested_at: browserTask.requested_at || new Date().toISOString(),
  })
}

export function getBrowserTaskRecord(state, iterationId, taskId = null) {
  const iter = findIteration(state, iterationId)
  if (!iter) throw new Error(`Iteration ${iterationId} not found`)
  ensureIterationEvidence(iter)

  if (taskId) {
    return iter.evidence.browser_tasks.find(entry => entry.task_id === taskId) || null
  }

  return iter.evidence.browser_tasks.length > 0
    ? iter.evidence.browser_tasks[iter.evidence.browser_tasks.length - 1]
    : null
}

export function getPendingBrowserTaskRecord(state, iterationId) {
  const iter = findIteration(state, iterationId)
  if (!iter) throw new Error(`Iteration ${iterationId} not found`)
  ensureIterationEvidence(iter)

  return iter.evidence.browser_tasks.find(entry => entry.status === 'pending') || null
}

export function ingestBrowserTaskResult(state, iterationId, opts = {}) {
  const iter = findIteration(state, iterationId)
  if (!iter) throw new Error(`Iteration ${iterationId} not found`)
  ensureIterationEvidence(iter)

  const pending = getPendingBrowserTaskRecord(state, iterationId)
  if (!pending) {
    return { ok: true, status: 'none', browser_task: null }
  }

  const rootDir = opts.rootDir || process.cwd()
  let request

  try {
    request = loadBrowserTaskRequest({
      batchId: state.batch_id,
      taskId: pending.task_id,
      rootDir,
    }).request
  } catch (error) {
    const browserTask = upsertBrowserTaskRecord(iter, {
      ...pending,
      status: 'fail',
      failure_kind: error.failureKind || 'request_invalid',
      ingested_at: new Date().toISOString(),
    })
    return {
      ok: false,
      status: 'fail',
      failure_kind: browserTask.failure_kind,
      browser_task: browserTask,
      error: error.message,
      request: null,
      result: null,
    }
  }

  let loadedResult
  try {
    loadedResult = loadBrowserTaskResult({ request, rootDir })
  } catch (error) {
    const browserTask = upsertBrowserTaskRecord(iter, {
      ...pending,
      status: 'fail',
      failure_kind: error.failureKind || 'result_invalid',
      ingested_at: new Date().toISOString(),
    })
    return {
      ok: false,
      status: 'fail',
      failure_kind: browserTask.failure_kind,
      browser_task: browserTask,
      error: error.message,
      request,
      result: null,
    }
  }

  if (!loadedResult) {
    return { ok: true, status: 'awaiting_result', browser_task: pending, request, result: null }
  }

  let status = loadedResult.result.status
  let failureKind = loadedResult.result.failure_kind

  if (status === 'pass' && request.executor?.mode !== 'mcp') {
    status = 'fail'
    failureKind = 'browser_bridge_not_proven'
  } else if (status === 'pass') {
    const artifactValidation = verifyArtifactsOnDisk(loadedResult.result, request, { rootDir })
    if (!artifactValidation.ok) {
      status = 'fail'
      failureKind = artifactValidation.failureKind
    }
  }

  const browserTask = upsertBrowserTaskRecord(iter, {
    ...pending,
    attempt: request.attempt,
    status,
    failure_kind: status === 'pass' ? 'none' : (failureKind || 'ingest_failed'),
    request_file: request.exchange.request_file,
    result_file: request.exchange.result_file,
    artifact_paths: (loadedResult.result.artifacts || []).map(artifact => artifact.relative_path),
    ingested_at: new Date().toISOString(),
  })

  return {
    ok: status === 'pass',
    status,
    failure_kind: browserTask.failure_kind,
    browser_task: browserTask,
    request,
    result: loadedResult.result,
  }
}

// ── Branch guard (§6.5) ────────────────────────────────

export function checkBranchGuard(state, iterationId) {
  const iter = findIteration(state, iterationId)
  if (!iter) return { ok: false, reason: `Iteration ${iterationId} not found` }

  // 1. Branch match
  let currentBranch
  try {
    currentBranch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim()
  } catch {
    return { ok: false, reason: 'Cannot determine current branch' }
  }

  if (currentBranch !== iter.expected_branch) {
    return {
      ok: false,
      reason: `Branch mismatch: expected "${iter.expected_branch}", got "${currentBranch}"`,
    }
  }

  // 2. Worktree clean (with exclusions per §6.5)
  let porcelain
  try {
    porcelain = execSync('git status --porcelain', { encoding: 'utf-8' }).trim()
  } catch {
    return { ok: false, reason: 'Cannot run git status' }
  }

  if (porcelain) {
    const lines = porcelain.split('\n').filter(Boolean)
    const iterDocPrefix = `docs/iterations/${iter.id}/`
    const unexplained = lines.filter(line => {
      const file = line.slice(3).trim()
      // Exclusions per §6.5:
      // - .orchestrator/** (orchestrator runtime artifacts)
      // - docs/ITERATIONS.md (orchestrator updates this)
      // - docs/iterations/<current_id>/** (plan/resolution/runlog produced by planning/revision)
      if (file.startsWith('.orchestrator/')) return false
      if (file === 'docs/ITERATIONS.md') return false
      if (file.startsWith(iterDocPrefix)) return false
      return true
    })
    if (unexplained.length > 0) {
      return {
        ok: false,
        reason: `Unattributed changes in worktree:\n${unexplained.join('\n')}`,
      }
    }
  }

  return { ok: true }
}

// ── Latest batch discovery ──────────────────────────────

export function findLatestBatch() {
  const runsDir = join(process.cwd(), '.orchestrator', 'runs')
  if (!existsSync(runsDir)) return null

  const entries = readdirSync(runsDir)
    .map(name => {
      const stFile = join(runsDir, name, 'state.json')
      if (!existsSync(stFile)) return null
      const st = statSync(stFile)
      return { name, mtime: st.mtimeMs }
    })
    .filter(Boolean)
    .sort((a, b) => b.mtime - a.mtime)

  return entries.length > 0 ? entries[0].name : null
}
