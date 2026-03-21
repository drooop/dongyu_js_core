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

const SCHEMA_VERSION = 1

// ── Create ──────────────────────────────────────────────

export function createState(batchId, userPrompt, primaryGoals) {
  const promptHash = createHash('sha256').update(userPrompt).digest('hex')

  return {
    schema_version: SCHEMA_VERSION,
    state_revision: 0,
    batch_id: batchId,
    prompt_hash: promptHash,
    original_prompt: userPrompt,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    primary_goals: primaryGoals.map((g, i) => ({
      index: i,
      description: g,
      status: 'pending',
    })),
    iterations: [],
    current_iteration: null,
    final_verification: 'pending',
    traceability: primaryGoals.map((g, i) => ({
      goal_index: i,
      goal_description: g,
      decomposed_requirement: '',
      iteration_ids: [],
      validation_commands: [],
      validation_results: [],
      status: 'pending',
    })),
  }
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
        return tmpState
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

  return JSON.parse(readFileSync(main, 'utf-8'))
}

// ── Commit (atomic write §2.3, revision bump) ──────────

export function commitState(state) {
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
  state.iterations.push({
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
    registered_in_iterations_md: false,
    expected_branch: iter.expected_branch || `dropx/dev_${iter.id}`,
    last_checkpoint: 'INTAKE:created',
    evidence: {
      plan_md: null,
      resolution_md: null,
      runlog_md: null,
      review_records: [],
      validation_commands: [],
      final_commit: null,
      branch: iter.expected_branch || `dropx/dev_${iter.id}`,
    },
  })
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
