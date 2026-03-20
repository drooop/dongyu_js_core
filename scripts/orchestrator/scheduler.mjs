/**
 * scheduler.mjs — Task scheduling and spawn management (§6)
 *
 * Single active iteration, serial execution.
 * Spawn types: derived_dependency (auto) vs scope_expansion (propose only).
 * Priority: blocking spawn > primary (FIFO) > queued spawn.
 */

import { addIteration, findIteration, updateIteration } from './state.mjs'
import { emitSpawn, emitBlocked, emitOnHold } from './events.mjs'
import { notifySpawn, notifyOnHold, notifyScopeExpansion } from './notify.mjs'
import {
  updateIterationStatus, appendReviewGateRecord,
  isRegistered, registerIteration, createIterationSkeleton,
} from './iteration_register.mjs'

// ── Pick next iteration ─────────────────────────────────

export function pickNext(state) {
  // 1. Highest priority: blocking spawn (unblocks a paused iteration)
  const blocking = state.iterations.find(
    i => i.status === 'pending' && i.blocks != null
  )
  if (blocking) return blocking

  // 2. Primary tasks in original order
  const primary = state.iterations.find(
    i => i.type === 'primary' && i.status === 'pending'
  )
  if (primary) return primary

  // 3. Non-blocking spawned tasks
  const spawned = state.iterations.find(
    i => i.type === 'spawned' && i.status === 'pending' && i.blocks == null
  )
  if (spawned) return spawned

  return null // All done → proceed to Final Verification
}

// ── Check if iteration is blocked ───────────────────────

export function isBlocked(state, iterationId) {
  return state.iterations.some(
    i => i.blocks === iterationId && i.status !== 'completed'
  )
}

// ── Accept spawn (§3.1 + §6.3) ─────────────────────────

export function acceptSpawn(state, parentId, spawnSpec) {
  const spawnType = spawnSpec.spawn_type || 'scope_expansion'

  if (spawnType === 'scope_expansion') {
    // §6.3: scope_expansion = propose only, need human confirmation
    // Add as "proposed" — orchestrator cannot auto-execute
    const proposedId = generateSpawnId(state, parentId)
    state.iterations.push({
      id: proposedId,
      type: 'spawned',
      status: 'proposed', // Not pending — awaiting human approval
      phase: 'INTAKE',
      spec: { title: spawnSpec.title, requirement: spawnSpec.reason },
      spawned_by: parentId,
      blocks: spawnSpec.blocks_current ? parentId : null,
      resolves_goals: [],
      review_round: 0,
      major_revision_count: 0,
      consecutive_approvals: 0,
      registered_in_iterations_md: false,
      expected_branch: `dropx/dev_${proposedId}`,
      last_checkpoint: 'INTAKE:proposed',
      evidence: {
        plan_md: null, resolution_md: null, runlog_md: null,
        review_records: [], validation_commands: [],
        final_commit: null, branch: `dropx/dev_${proposedId}`,
      },
    })

    emitSpawn(state, parentId, proposedId, 'scope_expansion (proposed)')
    notifyScopeExpansion(state, spawnSpec.title)

    return { accepted: false, proposed: true, id: proposedId }
  }

  // derived_dependency: auto-register and queue
  const spawnId = generateSpawnId(state, parentId)

  addIteration(state, {
    id: spawnId,
    type: 'spawned',
    title: spawnSpec.title,
    requirement: spawnSpec.reason,
    spawned_by: parentId,
    blocks: spawnSpec.blocks_current ? parentId : null,
    resolves_goals: [],
    expected_branch: `dropx/dev_${spawnId}`,
  })

  emitSpawn(state, parentId, spawnId, 'derived_dependency')
  notifySpawn(state, spawnId, 'derived_dependency')

  return { accepted: true, proposed: false, id: spawnId }
}

// ── Pause current iteration for blocking spawn ──────────

export function pauseForBlockingSpawn(state, iterationId, savedProgress) {
  updateIteration(state, iterationId, {
    status: 'blocked_by_spawn',
    last_checkpoint: `EXECUTION:blocked_by_spawn`,
  })
  // Store saved progress in state for resume
  const iter = findIteration(state, iterationId)
  iter._saved_progress = savedProgress
  state.current_iteration = null

  emitBlocked(state, iterationId, 'Waiting for blocking spawn to complete')
}

// ── Resume after spawn completes ────────────────────────

export function canResume(state, iterationId) {
  return !state.iterations.some(
    i => i.blocks === iterationId && i.status !== 'completed'
  )
}

// ── Handle On Hold ──────────────────────────────────────

export function setOnHold(state, iterationId, reason) {
  // Step 1: Update authoritative in-memory state
  updateIteration(state, iterationId, {
    status: 'on_hold',
    last_checkpoint: `ON_HOLD:${reason.slice(0, 50)}`,
  })
  state.current_iteration = null

  // Step 2: Emit event (appended before state commit by caller pattern)
  emitOnHold(state, iterationId, reason)

  // Steps 3-4 (derived docs + notify) are handled AFTER the caller
  // does commitState(), via syncOnHoldDocs(). This enforces §2.4 order:
  // event → state.json commit → derived docs → notify.
}

// Called by orchestrator AFTER commitState() for On Hold transitions.
export function syncOnHoldDocs(state, iterationId, reason) {
  // Derived doc: ITERATIONS.md (§4.3 rule 1)
  // Ensure the entry exists before trying to update its status.
  // If registerIteration failed earlier, the entry won't exist yet.
  try {
    if (!isRegistered(iterationId)) {
      const iter = findIteration(state, iterationId)
      const date = new Date().toISOString().slice(0, 10)
      const branch = iter?.expected_branch || `dropx/dev_${iterationId}`
      const title = iter?.spec?.title || iterationId
      createIterationSkeleton(iterationId)
      registerIteration(iterationId, date, title, '', branch)
    }
    updateIterationStatus(iterationId, 'On Hold')
  } catch (err) { process.stderr.write(`[warn] On Hold: failed to update ITERATIONS.md: ${err.message}\n`) }

  // Derived doc: runlog.md (§4.3 rule 2)
  try {
    const iter = findIteration(state, iterationId)
    if (iter) {
      const reviewHistory = (iter.evidence?.review_records || [])
        .map(r => `  - Round ${r.round} (${r.phase}): ${r.verdict} [${r.revision_type}]`)
        .join('\n')

      appendReviewGateRecord(iterationId, {
        round: iter.review_round || 0,
        phase: iter.phase || 'ON_HOLD',
        verdict: 'On Hold',
        revision_type: 'N/A',
        summary: `${reason}\n\nReview history:\n${reviewHistory}`,
      })
    }
  } catch (err) { process.stderr.write(`[warn] On Hold: failed to write runlog: ${err.message}\n`) }

  // Notify (best-effort, §2.5)
  notifyOnHold(state, iterationId, reason)
}

// ── ID generation ───────────────────────────────────────

function generateSpawnId(state, parentId) {
  // Count existing spawns from same parent
  const existing = state.iterations.filter(
    i => i.spawned_by === parentId
  ).length
  const suffix = String.fromCharCode(97 + existing) // a, b, c, ...
  return `${parentId}s${suffix}`
}

// ── Approve proposed scope_expansion ────────────────────

export function approveProposed(state, proposedId) {
  const iter = findIteration(state, proposedId)
  if (!iter || iter.status !== 'proposed') {
    return { ok: false, reason: `${proposedId} is not in proposed state` }
  }
  iter.status = 'pending'
  return { ok: true }
}
