#!/usr/bin/env bun
/**
 * orchestrator.mjs — doit-auto orchestrator main loop (§1-§16)
 *
 * Usage:
 *   bun scripts/orchestrator/orchestrator.mjs --prompt "..."
 *   bun scripts/orchestrator/orchestrator.mjs --prompt-file requirements.md
 *   bun scripts/orchestrator/orchestrator.mjs --resume [--batch-id <id>]
 *   bun scripts/orchestrator/orchestrator.mjs --monitor [--batch-id <id>]
 */

import { randomUUID } from 'crypto'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import { createInterface } from 'readline'

import {
  createState, loadState, commitState, batchDir,
  addIteration, findIteration, updateIteration, transition,
  addReviewRecord, checkBranchGuard, findLatestBatch,
} from './state.mjs'
import {
  emitEvent, emitTransition, emitReview, emitCompleted, emitError,
  emitOnHold, detectOrphanedEvents, markOrphaned,
} from './events.mjs'
import { refreshStatus } from './monitor.mjs'
import { runMonitor } from './monitor.mjs'
import {
  notify, notifyIterationComplete, notifyOnHold,
  notifyBatchComplete, notifyFinalVerification,
} from './notify.mjs'
import { codexExec, claudeReview, parseVerdict, parseFinalVerdict, parseExecOutput } from './drivers.mjs'
import {
  buildDecomposePrompt, buildPlanningPrompt, buildPlanReviewPrompt,
  buildRevisionPrompt, buildExecutionPrompt, buildExecReviewPrompt,
  buildFixPrompt, buildFinalVerifyPrompt,
} from './prompts.mjs'
import { classifyEntryRoute, hasScaffoldPlaceholder } from './entry_route.mjs'
import { buildReviewPolicy, resolveReviewPolicy, resolveEscalationAction } from './review_policy.mjs'
import { pickNext, acceptSpawn, pauseForBlockingSpawn, canResume, setOnHold, syncOnHoldDocs, isBlocked } from './scheduler.mjs'
import {
  getNextId, formatId, registerIteration, updateIterationStatus,
  createIterationSkeleton, appendReviewGateRecord, isRegistered,
} from './iteration_register.mjs'

// ── CLI argument parsing ────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const opts = {
    prompt: null,
    promptFile: null,
    iteration: null,     // --iteration <id>: execute existing iteration directly
    resume: false,
    monitor: false,
    batchId: null,
    autoConfirm: false,
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--prompt': opts.prompt = args[++i]; break
      case '--prompt-file': opts.promptFile = args[++i]; break
      case '--iteration': opts.iteration = args[++i]; break
      case '--resume': opts.resume = true; break
      case '--monitor': opts.monitor = true; break
      case '--batch-id': opts.batchId = args[++i]; break
      case '--auto-confirm': opts.autoConfirm = true; break
    }
  }

  return opts
}

// ── Main entry ──────────────────────────────────────────

async function main() {
  const opts = parseArgs()

  // --monitor mode
  if (opts.monitor) {
    const batchId = opts.batchId || findLatestBatch()
    if (!batchId) { console.error('No batch found'); process.exit(1) }
    await runMonitor(batchId)
    return
  }

  // --resume mode
  if (opts.resume) {
    const batchId = opts.batchId || findLatestBatch()
    if (!batchId) { console.error('No batch to resume'); process.exit(1) }
    const state = loadState(batchId)
    if (!state) { console.error(`Cannot load state for ${batchId}`); process.exit(1) }

    // Check for orphaned events (§2.4)
    const orphaned = detectOrphanedEvents(state)
    if (orphaned.length > 0) {
      markOrphaned(state.batch_id, orphaned)
      process.stderr.write(`[recovery] Found ${orphaned.length} orphaned events, marked and continuing\n`)
    }

    // Step 1: Reconcile derived docs FIRST (补齐 crash 后缺失的注册/skeleton/runlog)
    reconcileDerivedDocs(state)

    // Step 2: THEN verify consistency (reconcile may have fixed recoverable gaps)
    const inconsistencies = checkStateIterationsConsistency(state)
    if (inconsistencies.length > 0) {
      process.stderr.write(`\n[BLOCKED] state.json and docs/ITERATIONS.md are inconsistent after reconciliation:\n`)
      for (const inc of inconsistencies) {
        process.stderr.write(`  - ${inc}\n`)
      }
      process.stderr.write(`\nHuman decision required. Fix ITERATIONS.md or state.json, then --resume again.\n`)
      notify(state, 'cli_error', `Resume blocked: ${inconsistencies.length} state/ITERATIONS inconsistencies`)
      process.exit(1)
    }

    await runMainLoop(state)
    return
  }

  // --iteration mode: execute existing iteration directly (skip decompose)
  if (opts.iteration) {
    await runExistingIteration(opts.iteration, opts.prompt || '')
    return
  }

  // Normal mode: need prompt
  let userPrompt = opts.prompt
  if (opts.promptFile) {
    userPrompt = readFileSync(opts.promptFile, 'utf-8')
  }
  if (!userPrompt) {
    console.error('Usage: orchestrator.mjs --prompt "..." or --prompt-file <file> or --iteration <id>')
    process.exit(1)
  }

  // Phase -1: Decompose
  const decomposition = await decompose(userPrompt)
  if (!decomposition) { process.exit(1) }

  // Confirm gate
  if (!opts.autoConfirm) {
    const confirmed = await confirmDecomposition(decomposition)
    if (!confirmed) { process.exit(0) }
  }

  // Initialize state
  const batchId = randomUUID()
  const primaryGoals = decomposition.iterations.map(it => it.requirement)
  const state = createState(batchId, userPrompt, primaryGoals)
  state.entry_source = opts.promptFile ? 'prompt_file' : 'prompt'
  state.entry_route = 'new_requirement'
  state.review_policy = buildReviewPolicy({ entry_route: state.entry_route })
  state.risk_profile = state.review_policy.risk_profile

  // Register primary iterations in ITERATIONS.md (§3.1)
  let nextNum = getNextId()
  for (const [idx, iter] of decomposition.iterations.entries()) {
    const kebab = iter.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const id = formatId(nextNum, kebab)
    nextNum++

    addIteration(state, {
      id,
      type: 'primary',
      title: iter.title,
      requirement: iter.requirement,
      resolves_goals: iter.resolves_goals || [idx],
      expected_branch: `dropx/dev_${id}`,
      entry_source: state.entry_source,
      entry_route: state.entry_route,
      review_policy: state.review_policy,
      risk_profile: state.risk_profile,
    })
    // registered_in_iterations_md stays false until actual registration succeeds

    // Update traceability
    for (const gi of (iter.resolves_goals || [idx])) {
      if (state.traceability[gi]) {
        state.traceability[gi].decomposed_requirement = iter.requirement
        state.traceability[gi].iteration_ids.push(id)
      }
    }
  }

  // Step 1: commit state with registered=false (establishes batch as authoritative)
  commitState(state)
  emitEvent(state, {
    event_type: 'transition',
    message: `Batch ${batchId.slice(0, 8)} initialized with ${state.iterations.length} iterations`,
  })

  // Step 2: create skeleton + register each iteration.
  //   Order: skeleton first (local files, no ITERATIONS.md entry),
  //   then register (writes ITERATIONS.md).
  //   This avoids orphan ITERATIONS entries when skeleton fails.
  //   On ANY failure: mark registered=true + on_hold so that
  //   consistency checks won't skip it, and scheduler won't pick it up.
  for (const iter of state.iterations) {
    const date = new Date().toISOString().slice(0, 10)
    try {
      createIterationSkeleton(iter.id)
      registerIteration(iter.id, date, iter.spec.title, '', iter.expected_branch)
      updateIteration(state, iter.id, { registered_in_iterations_md: true })
    } catch (err) {
      // Mark as registered=true so consistency check covers it,
      // but set on_hold so scheduler won't pick it up.
      emitError(state, iter.id, `Registration failed: ${err.message}`)
      updateIteration(state, iter.id, {
        registered_in_iterations_md: true,
        status: 'on_hold',
        last_checkpoint: 'INTAKE:registration_failed',
      })
      // Emit on_hold event for audit consistency with all other On Hold paths
      emitOnHold(state, iter.id, `Registration failed: ${err.message}`)
      process.stderr.write(`[ERROR] Failed to register ${iter.id} — set to on_hold: ${err.message}\n`)
    }
  }

  // Step 3: commit state (authoritative) FIRST
  commitState(state)

  // Step 4: sync On Hold derived docs for any iterations that failed registration.
  //   §2.4 order: state committed above → derived docs + notify now.
  for (const iter of state.iterations) {
    if (iter.status === 'on_hold' && iter.last_checkpoint === 'INTAKE:registration_failed') {
      syncOnHoldDocs(state, iter.id, 'Registration failed during batch initialization')
    }
  }

  await runMainLoop(state)
}

// ── Phase -1: Decompose ─────────────────────────────────

// ── --iteration mode: execute existing iteration ────────
//
// Skips decompose entirely. Reads existing plan/resolution to determine
// the iteration's current phase and continues from there.
// Use for iterations that are already Planned/Approved and have
// plan.md + resolution.md ready.

async function runExistingIteration(iterationId, extraContext) {
  process.stderr.write(`\nExecuting existing iteration: ${iterationId}\n`)

  // Verify iteration directory exists
  const iterDir = join(process.cwd(), 'docs', 'iterations', iterationId)
  if (!existsSync(iterDir)) {
    console.error(`Iteration directory not found: ${iterDir}`)
    process.exit(1)
  }

  // Read plan to get title/requirement
  let title = iterationId
  let requirement = ''
  const planPath = join(iterDir, 'plan.md')
  const resolutionPath = join(iterDir, 'resolution.md')
  const hasPlan = existsSync(planPath)
  const hasResolution = existsSync(resolutionPath)
  const planContent = hasPlan ? readFileSync(planPath, 'utf-8') : ''
  const resolutionContent = hasResolution ? readFileSync(resolutionPath, 'utf-8') : ''

  if (hasPlan) {
    // Extract title from first heading
    const titleMatch = planContent.match(/^#\s+(.+)$/m)
    if (titleMatch) title = titleMatch[1]
    // Use WHAT section as requirement
    const whatMatch = planContent.match(/##\s+WHAT\s*\n([\s\S]*?)(?=\n##|$)/)
    if (whatMatch) requirement = whatMatch[1].trim()
  }

  // Determine starting phase and branch from ITERATIONS.md
  const { iterStatus, iterBranch } = (() => {
    try {
      const content = readFileSync(join(process.cwd(), 'docs', 'ITERATIONS.md'), 'utf-8')
      const escaped = iterationId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      // Capture branch (field 5) and status (field 6)
      const match = content.match(new RegExp(
        `\\|\\s*${escaped}\\s*\\|[^|]*\\|[^|]*\\|[^|]*\\|\\s*([^|]+?)\\s*\\|\\s*([^|]+?)\\s*\\|`
      ))
      return {
        iterStatus: match ? match[2].trim() : 'Planned',
        iterBranch: match ? match[1].trim() : `dropx/dev_${iterationId}`,
      }
    } catch {
      return { iterStatus: 'Planned', iterBranch: `dropx/dev_${iterationId}` }
    }
  })()

  const route = classifyEntryRoute({
    entry_source: 'iteration',
    iteration_status: iterStatus,
    has_plan: hasPlan,
    has_resolution: hasResolution,
    plan_is_scaffold: hasScaffoldPlaceholder(planContent),
    resolution_is_scaffold: hasScaffoldPlaceholder(resolutionContent),
  })

  if (route.is_blocked) {
    let blockMessage
    if (route.reason === 'missing_contract_files') {
      blockMessage = 'plan.md / resolution.md 缺失，禁止隐式 fallback'
    } else if (route.reason?.startsWith('requires_resume:')) {
      blockMessage = `${route.hint || `Status ${iterStatus} requires --resume`}`
    } else if (route.reason?.startsWith('terminal_iteration_status:')) {
      blockMessage = `Iteration is ${iterStatus} — cannot re-execute`
    } else {
      blockMessage = `Blocked: ${route.reason}`
    }
    process.stderr.write(`[BLOCKED] ${iterationId}: ${blockMessage}\n`)
    process.exit(1)
  }

  const startPhase = route.start_phase

  process.stderr.write(
    `  ITERATIONS.md status: ${iterStatus}, branch: ${iterBranch} → route ${route.route_kind} → starting at ${startPhase}\n`
  )

  // Create batch with single iteration
  const batchId = randomUUID()
  const state = createState(batchId, `Execute existing iteration ${iterationId}. ${extraContext}`, [requirement || title])
  state.entry_source = 'iteration'
  state.entry_route = route.route_kind
  state.review_policy = buildReviewPolicy({ entry_route: route.route_kind })
  state.risk_profile = state.review_policy.risk_profile

  addIteration(state, {
    id: iterationId,
    type: 'primary',
    title,
    requirement: requirement || title,
    resolves_goals: [0],
    expected_branch: iterBranch,
    entry_source: 'iteration',
    entry_route: route.route_kind,
    review_policy: state.review_policy,
    risk_profile: state.risk_profile,
  })

  // Mark as already registered (it's an existing iteration)
  updateIteration(state, iterationId, {
    registered_in_iterations_md: true,
    phase: startPhase,
  })

  // Set iteration docs references
  const iter = findIteration(state, iterationId)
  iter.evidence.plan_md = `docs/iterations/${iterationId}/plan.md`
  iter.evidence.resolution_md = `docs/iterations/${iterationId}/resolution.md`
  iter.evidence.runlog_md = `docs/iterations/${iterationId}/runlog.md`

  // Update traceability
  if (state.traceability[0]) {
    state.traceability[0].decomposed_requirement = requirement || title
    state.traceability[0].iteration_ids.push(iterationId)
  }

  commitState(state)
  emitEvent(state, {
    event_type: 'transition',
    message: `Batch ${batchId.slice(0, 8)} initialized for existing iteration ${iterationId} (starting at ${startPhase})`,
  })

  await runMainLoop(state)
}

// ── Phase -1: Decompose ─────────────────────────────────

async function decompose(userPrompt) {
  process.stderr.write('Phase -1: Decomposing requirements...\n')

  // Decompose needs broader Bash access than review (ls, find, cat for codebase analysis)
  const result = claudeReview('_decompose', '_decompose', buildDecomposePrompt(userPrompt), {
    phase: 'decompose',
    model: 'opus',
    maxTurns: 12,
    allowedTools: [
      'Read', 'Grep', 'Glob', 'Bash',  // Full Bash for codebase analysis
      'Agent', 'Skill',
    ],
  })

  if (!result.ok) {
    console.error('Decompose failed:', result.error)
    return null
  }

  // Parse decomposition result — look for JSON with "iterations" field
  const text = result.result_text || ''

  // Try fenced json block first
  const fencedMatch = text.match(/```json\s*\n?([\s\S]*?)\n?\s*```/)
  if (fencedMatch) {
    try {
      const obj = JSON.parse(fencedMatch[1])
      if (obj.iterations) return obj
    } catch { /* fall through */ }
  }

  // Try raw JSON object with iterations
  const rawMatch = text.match(/(\{[\s\S]*?"iterations"\s*:\s*\[[\s\S]*?\][\s\S]*?\})/)
  if (rawMatch) {
    try {
      const obj = JSON.parse(rawMatch[1])
      if (obj.iterations) return obj
    } catch { /* fall through */ }
  }

  console.error('Could not parse decomposition result')
  console.error('Result text (last 500 chars):', text.slice(-500))
  return null
}

// ── Confirm gate ────────────────────────────────────────

async function confirmDecomposition(plan) {
  console.log('\n== Task Decomposition ==\n')
  console.log(`Analysis: ${plan.analysis}\n`)

  if (plan.iterations) {
    plan.iterations.forEach((iter, i) => {
      const order = (plan.execution_order || []).indexOf(i) + 1
      console.log(`  ${order || i + 1}. [${iter.scope}] ${iter.title}`)
      console.log(`     ${iter.requirement}`)
      if (iter.depends_on?.length) {
        console.log(`     depends: ${iter.depends_on.join(', ')}`)
      }
    })
  }

  console.log(`\nTotal: ${plan.iterations?.length || 0} iterations`)
  if (plan.risks?.length) {
    console.log(`Risks: ${plan.risks.join('; ')}`)
  }

  const answer = await askUser('\nConfirm? [Y]es / [Q]uit: ')
  return answer.toUpperCase() === 'Y' || answer === ''
}

// ── Main execution loop ─────────────────────────────────

async function runMainLoop(state) {
  process.stderr.write(`\nStarting main loop (batch ${state.batch_id.slice(0, 8)})\n`)

  while (true) {
    refreshStatus(state)

    // Check if any blocked_by_spawn iterations can resume
    for (const iter of state.iterations) {
      if (iter.status === 'blocked_by_spawn' && canResume(state, iter.id)) {
        iter.status = 'pending'
        iter.phase = 'EXECUTION' // Resume execution
        emitEvent(state, {
          iteration_id: iter.id,
          event_type: 'transition',
          message: `Unblocked — blocking spawn completed`,
        })
        commitState(state)
      }
    }

    // Pick next iteration
    const next = pickNext(state)
    if (!next) {
      // No pending tasks — but are we truly done, or just blocked?
      const allCompleted = state.iterations.every(
        i => i.status === 'completed' || i.status === 'proposed'
      )
      const hasOnHold = state.iterations.some(i => i.status === 'on_hold')
      const hasBlockedBySpawn = state.iterations.some(i => i.status === 'blocked_by_spawn')

      if (allCompleted) {
        // Genuinely done — proceed to Final Verification
        break
      }

      if (hasOnHold || hasBlockedBySpawn) {
        // Not done — iterations are stuck. Cannot proceed to Final Verification.
        process.stderr.write('\n[BLOCKED] No pending iterations, but batch is not complete:\n')
        for (const iter of state.iterations) {
          if (iter.status === 'on_hold') {
            process.stderr.write(`  - ${iter.id}: On Hold (${iter.last_checkpoint})\n`)
          }
          if (iter.status === 'blocked_by_spawn') {
            process.stderr.write(`  - ${iter.id}: Blocked by spawn\n`)
          }
        }
        process.stderr.write('\nHuman decision required. Resolve On Hold iterations, then --resume.\n')
        notify(state, 'cli_error', 'Batch stalled: iterations on hold or blocked')
        state.current_iteration = null
        commitState(state)
        refreshStatus(state)
        return // Exit without Final Verification
      }

      // Fallback: unexpected state combination
      break
    }

    state.current_iteration = next.id
    next.status = 'active'
    next.cli_failure_count = 0  // Reset on (re)activation — prevents stale count from prior On Hold
    commitState(state)

    await runIteration(state, next.id)
  }

  // Final Verification Gate (§7.3) — only reached if all iterations completed
  await runFinalVerification(state)

  state.current_iteration = null
  commitState(state)
  refreshStatus(state)

  notifyBatchComplete(state)
  emitEvent(state, { event_type: 'completed', message: 'Batch complete' })

  process.stderr.write(`\nBatch ${state.batch_id.slice(0, 8)} complete.\n`)
  process.stderr.write(`Status: ${batchDir(state.batch_id)}/status.txt\n`)
}

// ── Derived doc sync (best-effort, after state commit) ──
//
// §2.4 write order: event → state.json commit → derived docs → notify
// Derived doc writes are idempotent and best-effort.
// If they fail, state.json remains authoritative; next recovery or
// review round will produce the missing records.

function syncDerivedDocs(iterationId, iter, verdict, reviewRound, reviewPhase) {
  const round = reviewRound !== undefined ? reviewRound : iter.review_round
  // Use explicit reviewPhase (captured before transition), NOT iter.phase
  // (which may already be EXECUTION/COMPLETE after gate pass).
  const phase = reviewPhase || iter.phase
  try {
    // Write review gate record to runlog.md
    appendReviewGateRecord(iterationId, {
      round,
      phase,
      verdict: verdict.verdict,
      revision_type: verdict.revision_type,
      summary: verdict.summary,
    })
  } catch (err) {
    process.stderr.write(`[warn] Failed to write runlog review record for ${iterationId}: ${err.message}\n`)
  }

  try {
    // Sync ITERATIONS.md status if phase changed to EXECUTION
    if (iter.phase === 'EXECUTION') {
      updateIterationStatus(iterationId, 'Approved')
      updateIterationStatus(iterationId, 'In Progress')
    }
  } catch (err) {
    process.stderr.write(`[warn] Failed to update ITERATIONS.md for ${iterationId}: ${err.message}\n`)
  }
}

// ── On Hold: commit + sync (§2.4 compliant wrapper) ─────
//
// Ensures: setOnHold (memory+event) → commitState → syncOnHoldDocs → return

function commitOnHold(state, iterationId, reason) {
  setOnHold(state, iterationId, reason)   // memory + event
  commitState(state)                       // authoritative state
  syncOnHoldDocs(state, iterationId, reason)  // derived docs + notify
}

function ensureIterationReviewPolicy(state, iter) {
  const reviewPolicy = resolveReviewPolicy({
    entry_route: iter.entry_route || state.entry_route,
    review_policy: iter.review_policy || state.review_policy,
    risk_profile: iter.risk_profile || state.risk_profile,
  })

  iter.review_policy = reviewPolicy
  iter.risk_profile = reviewPolicy.risk_profile

  if (!state.review_policy) {
    state.review_policy = reviewPolicy
  }
  if (!state.risk_profile) {
    state.risk_profile = reviewPolicy.risk_profile
  }

  return reviewPolicy
}

// ── Run single iteration ────────────────────────────────

async function runIteration(state, iterationId) {
  const iter = findIteration(state, iterationId)

  while (iter.status === 'active') {

    switch (iter.phase) {

      case 'INTAKE': {
        // Phase 0: two-step commit for registration gate.
        //
        // Step 1: commit intent (registered=true) to state.json FIRST.
        //   If crash after step 1 but before step 2, --resume → reconcileDerivedDocs
        //   will detect the missing skeleton/ITERATIONS entry and re-create them.
        if (!iter.registered_in_iterations_md) {
          iter.registered_in_iterations_md = true
          commitState(state)

          // Step 2: write derived docs (skeleton + ITERATIONS.md entry).
          //   Failure here → On Hold (§3.1: unregistered = must not proceed).
          try {
            createIterationSkeleton(iter.id)
            const date = new Date().toISOString().slice(0, 10)
            registerIteration(iter.id, date, iter.spec.title, '', iter.expected_branch)
          } catch (err) {
            // Keep registered=true so reconcile/consistency check still covers
            // this iteration. On Hold blocks scheduler from picking it up.
            emitError(state, iterationId, `Registration failed: ${err.message}`)
            commitOnHold(state, iterationId, `Registration failed: ${err.message}`)
            return
          }
        }

        // Step 3: transition to PLANNING + commit
        const prevPhase = iter.phase
        transition(state, iterationId, 'PLANNING')
        emitTransition(state, iterationId, prevPhase, 'PLANNING')
        commitState(state)
        break
      }

      case 'PLANNING': {
        // Create branch
        try {
          execSync(`git checkout -b ${iter.expected_branch} 2>/dev/null || git checkout ${iter.expected_branch}`, {
            encoding: 'utf-8', stdio: 'pipe',
          })
        } catch {
          emitError(state, iterationId, 'Failed to create/checkout branch')
        }

        const result = codexExec(state.batch_id, iterationId,
          buildPlanningPrompt(iterationId, iter.spec, {
            mode: iter.entry_route === 'draft_iteration' ? 'refine' : 'create',
          }),
          { phase: 'planning', sandbox: 'workspace-write' }
        )

        if (!result.ok) {
          emitError(state, iterationId, `Planning failed: ${result.error}`)
          commitOnHold(state, iterationId, 'Planning CLI failure')
          return
        }

        iter.evidence.plan_md = `docs/iterations/${iterationId}/plan.md`
        iter.evidence.resolution_md = `docs/iterations/${iterationId}/resolution.md`

        transition(state, iterationId, 'REVIEW_PLAN')
        emitTransition(state, iterationId, 'PLANNING', 'REVIEW_PLAN')
        // Do NOT mark as Approved yet — review hasn't passed.
        // ITERATIONS.md stays at Planned until Auto-Approval gate clears.
        iter.review_round = 0
        iter.consecutive_approvals = 0
        commitState(state)
        break
      }

      case 'REVIEW_PLAN': {
        const reviewPolicy = ensureIterationReviewPolicy(state, iter)
        const isFollowUp = iter.review_round > 0
        iter.review_round++

        const result = claudeReview(state.batch_id, iterationId,
          buildPlanReviewPrompt(iterationId, isFollowUp, {
            review_policy: reviewPolicy,
            risk_profile: iter.risk_profile,
          }),
          { phase: 'review_plan', round: iter.review_round, model: 'opus', maxTurns: 8 }
        )

        if (!result.ok) {
          iter.cli_failure_count = (iter.cli_failure_count || 0) + 1
          emitError(state, iterationId, `Review failed: ${result.error}`)
          if (
            iter.cli_failure_count >= reviewPolicy.cli_failure_threshold &&
            resolveEscalationAction(reviewPolicy, 'cli_failure') === 'on_hold_after_threshold'
          ) {
            commitOnHold(state, iterationId, `Review CLI failure (${reviewPolicy.cli_failure_threshold} consecutive)`)
            return
          }
          commitState(state)
          break // Retry
        }

        iter.cli_failure_count = 0 // Reset on success

        const parsed = parseVerdict(result.result_text)
        if (!parsed.ok) {
          iter.cli_failure_count = (iter.cli_failure_count || 0) + 1
          emitError(state, iterationId, 'Cannot parse review verdict')
          if (
            iter.cli_failure_count >= reviewPolicy.cli_failure_threshold &&
            resolveEscalationAction(reviewPolicy, 'cli_failure') === 'on_hold_after_threshold'
          ) {
            commitOnHold(state, iterationId, `Review parse failure (${reviewPolicy.cli_failure_threshold} consecutive)`)
            return
          }
          commitState(state)
          break // Retry
        }

        iter.cli_failure_count = 0 // Reset on successful parse

        const verdict = parsed.verdict

        // Record review in state (authoritative — committed below)
        addReviewRecord(state, iterationId, {
          round: iter.review_round,
          phase: 'REVIEW_PLAN',
          revision_type: verdict.revision_type || 'n/a',
          verdict: verdict.verdict,
          summary: verdict.summary || '',
          session_id: result.session_id,
          transcript_file: result.transcript_file,
        })

        emitReview(state, iterationId, 'REVIEW_PLAN', verdict.verdict, iter.review_round)

        // Handle spawned iterations
        if (verdict.spawned_iterations?.length) {
          for (const spawn of verdict.spawned_iterations) {
            acceptSpawn(state, iterationId, spawn)
          }
        }

        // Preserve review_round for syncDerivedDocs BEFORE any reset
        const reviewRoundForDocs = iter.review_round

        if (verdict.verdict === 'APPROVED') {
          // §5.3: session_id missing → doesn't count for Auto-Approval
          if (result.session_id && result.session_id !== 'missing') {
            iter.consecutive_approvals++
          }

          if (iter.consecutive_approvals >= reviewPolicy.approval_count) {
            transition(state, iterationId, 'EXECUTION')
            emitTransition(state, iterationId, 'REVIEW_PLAN', 'EXECUTION')
            iter.review_round = 0
            iter.consecutive_approvals = 0
          }
          // else: continue review (need more independent APPROVEDs)

        } else {
          // NEEDS_CHANGES
          iter.consecutive_approvals = 0

          // §4.2: major revision counting
          if (
            verdict.revision_type === 'ambiguous' &&
            resolveEscalationAction(reviewPolicy, 'ambiguous_revision') === 'human_decision_required'
          ) {
            commitOnHold(state, iterationId, 'Ambiguous revision type — human decision required')
            return
          }
          if (verdict.revision_type === 'major') {
            iter.major_revision_count++
          }

          // §4.1: check limit
          if (iter.major_revision_count >= reviewPolicy.major_revision_limit) {
            commitOnHold(state, iterationId, `Major revision limit reached (${reviewPolicy.major_revision_limit})`)
            return
          }

          // Send back to Codex for revision
          const revResult = codexExec(state.batch_id, iterationId,
            buildRevisionPrompt(iterationId, verdict),
            { phase: `revision_${iter.review_round}`, sandbox: 'workspace-write' }
          )

          if (!revResult.ok) {
            emitError(state, iterationId, `Revision failed: ${revResult.error}`)
          }
        }

        // §2.4 write order: event (done above) → state commit → derived docs
        commitState(state)

        // Derived doc writes (best-effort, idempotent — §2.4/§2.5 pattern)
        // Use preserved reviewRoundForDocs (not iter.review_round which may be reset)
        syncDerivedDocs(iterationId, iter, verdict, reviewRoundForDocs, 'REVIEW_PLAN')

        break
      }

      case 'EXECUTION': {
        // §6.5: Branch guard
        const guard = checkBranchGuard(state, iterationId)
        if (!guard.ok) {
          commitOnHold(state, iterationId, `Branch guard failed: ${guard.reason}`)
          return
        }

        const result = codexExec(state.batch_id, iterationId,
          buildExecutionPrompt(iterationId),
          { phase: 'execution', sandbox: 'danger-full-access' }
        )

        if (!result.ok) {
          emitError(state, iterationId, `Execution failed: ${result.error}`)
          commitOnHold(state, iterationId, 'Execution CLI failure')
          return
        }

        const execOutput = parseExecOutput(result.output || result.stdout)

        // Handle spawned iterations
        if (execOutput.ok && execOutput.output.spawned_iterations?.length) {
          let hasBlocking = false
          for (const spawn of execOutput.output.spawned_iterations) {
            const spawnResult = acceptSpawn(state, iterationId, spawn)
            if (spawn.blocks_current && spawnResult.accepted) {
              hasBlocking = true
            }
          }

          if (hasBlocking) {
            pauseForBlockingSpawn(state, iterationId,
              execOutput.output.steps_completed || [])
            commitState(state)
            return // Will be resumed by scheduler
          }
        }

        transition(state, iterationId, 'REVIEW_EXEC')
        emitTransition(state, iterationId, 'EXECUTION', 'REVIEW_EXEC')
        iter.review_round = 0
        iter.consecutive_approvals = 0
        commitState(state)
        break
      }

      case 'REVIEW_EXEC': {
        const reviewPolicy = ensureIterationReviewPolicy(state, iter)
        const isFollowUp = iter.review_round > 0
        iter.review_round++

        const result = claudeReview(state.batch_id, iterationId,
          buildExecReviewPrompt(iterationId, isFollowUp, {
            review_policy: reviewPolicy,
            risk_profile: iter.risk_profile,
          }),
          { phase: 'review_exec', round: iter.review_round, model: 'opus', maxTurns: 12 }
        )

        if (!result.ok) {
          iter.cli_failure_count = (iter.cli_failure_count || 0) + 1
          emitError(state, iterationId, `Exec review failed: ${result.error}`)
          if (
            iter.cli_failure_count >= reviewPolicy.cli_failure_threshold &&
            resolveEscalationAction(reviewPolicy, 'cli_failure') === 'on_hold_after_threshold'
          ) {
            commitOnHold(state, iterationId, `Exec review CLI failure (${reviewPolicy.cli_failure_threshold} consecutive)`)
            return
          }
          commitState(state)
          break
        }

        iter.cli_failure_count = 0

        const parsed = parseVerdict(result.result_text)
        if (!parsed.ok) {
          iter.cli_failure_count = (iter.cli_failure_count || 0) + 1
          emitError(state, iterationId, 'Cannot parse exec review verdict')
          if (
            iter.cli_failure_count >= reviewPolicy.cli_failure_threshold &&
            resolveEscalationAction(reviewPolicy, 'cli_failure') === 'on_hold_after_threshold'
          ) {
            commitOnHold(state, iterationId, `Exec review parse failure (${reviewPolicy.cli_failure_threshold} consecutive)`)
            return
          }
          commitState(state)
          break
        }

        iter.cli_failure_count = 0

        const verdict = parsed.verdict

        // Record in authoritative state (committed below)
        addReviewRecord(state, iterationId, {
          round: iter.review_round,
          phase: 'REVIEW_EXEC',
          revision_type: verdict.revision_type || 'n/a',
          verdict: verdict.verdict,
          summary: verdict.summary || '',
          session_id: result.session_id,
          transcript_file: result.transcript_file,
        })

        emitReview(state, iterationId, 'REVIEW_EXEC', verdict.verdict, iter.review_round)

        if (verdict.spawned_iterations?.length) {
          for (const spawn of verdict.spawned_iterations) {
            acceptSpawn(state, iterationId, spawn)
          }
        }

        // Preserve review_round before any reset
        const execReviewRoundForDocs = iter.review_round

        if (verdict.verdict === 'APPROVED') {
          if (result.session_id && result.session_id !== 'missing') {
            iter.consecutive_approvals++
          }

          if (iter.consecutive_approvals >= reviewPolicy.approval_count) {
            transition(state, iterationId, 'COMPLETE')
            emitTransition(state, iterationId, 'REVIEW_EXEC', 'COMPLETE')
          }
        } else {
          iter.consecutive_approvals = 0

          if (
            verdict.revision_type === 'ambiguous' &&
            resolveEscalationAction(reviewPolicy, 'ambiguous_revision') === 'human_decision_required'
          ) {
            commitOnHold(state, iterationId, 'Ambiguous revision type — human decision required')
            return
          }
          if (verdict.revision_type === 'major') {
            iter.major_revision_count++
          }
          if (iter.major_revision_count >= reviewPolicy.major_revision_limit) {
            commitOnHold(state, iterationId, `Major revision limit reached (${reviewPolicy.major_revision_limit})`)
            return
          }

          const fixResult = codexExec(state.batch_id, iterationId,
            buildFixPrompt(iterationId, verdict),
            { phase: `fix_${iter.review_round}`, sandbox: 'danger-full-access' }
          )

          if (!fixResult.ok) {
            emitError(state, iterationId, `Fix failed: ${fixResult.error}`)
          }
        }

        // §2.4 write order: event (done) → state commit → derived docs
        commitState(state)

        // Derived doc writes (best-effort, idempotent)
        syncDerivedDocs(iterationId, iter, verdict, execReviewRoundForDocs, 'REVIEW_EXEC')

        break
      }

      case 'COMPLETE': {
        // Phase 4: Completion
        iter.status = 'completed'
        state.current_iteration = null

        // Try to capture final commit
        try {
          const hash = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim()
          iter.evidence.final_commit = hash
        } catch { /* non-critical */ }

        // Merge to dev
        try {
          execSync(`git checkout dev && git merge --no-ff ${iter.expected_branch} -m "merge: ${iterationId}" && git checkout ${iter.expected_branch}`, {
            encoding: 'utf-8', stdio: 'pipe',
          })
        } catch (err) {
          emitError(state, iterationId, `Merge to dev failed: ${err.message}`)
          // Non-fatal — user can merge manually
        }

        emitCompleted(state, iterationId)

        // §2.4: state commit first, then derived docs + notify
        commitState(state)

        try { updateIterationStatus(iterationId, 'Completed') }
        catch (err) { process.stderr.write(`[warn] Failed to update ITERATIONS.md: ${err.message}\n`) }

        notifyIterationComplete(state, iterationId)
        break
      }

      default:
        emitError(state, iterationId, `Unknown phase: ${iter.phase}`)
        commitOnHold(state, iterationId, `Unknown phase: ${iter.phase}`)
        return
    }

    refreshStatus(state)
  }
}

// ── Final Verification Gate (§7.3) ──────────────────────

async function runFinalVerification(state) {
  process.stderr.write('\nRunning Final Verification Gate...\n')

  // Schema only allows pending|passed|failed.
  // Stay at 'pending' during execution — it transitions to passed/failed at the end.
  emitEvent(state, {
    event_type: 'transition',
    message: 'Final Verification Gate started',
  })

  const completedIters = state.iterations.filter(i => i.status === 'completed')

  const result = claudeReview(state.batch_id, '_final',
    buildFinalVerifyPrompt(state.primary_goals, completedIters),
    { phase: 'final_verify', model: 'opus', maxTurns: 15 }
  )

  if (!result.ok) {
    state.final_verification = 'failed'
    emitError(state, null, `Final verification failed: ${result.error}`)
    commitState(state)
    return
  }

  const parsed = parseFinalVerdict(result.result_text)
  if (!parsed.ok) {
    state.final_verification = 'failed'
    emitError(state, null, `Cannot parse final verification result: ${parsed.error}`)
    commitState(state)
    return
  }

  const finalResult = parsed.result

  // Update traceability
  if (finalResult.goal_results) {
    for (const gr of finalResult.goal_results) {
      const idx = gr.goal_index
      if (state.primary_goals[idx]) {
        state.primary_goals[idx].status = gr.status
      }
      if (state.traceability[idx]) {
        state.traceability[idx].status = gr.status
        state.traceability[idx].validation_results = gr.validation_commands_run || []
      }
    }
  }

  state.final_verification = finalResult.all_goals_met ? 'passed' : 'failed'

  emitEvent(state, {
    event_type: 'review',
    severity: finalResult.all_goals_met ? 'info' : 'error',
    message: `Final Verification: ${finalResult.all_goals_met ? 'ALL GOALS MET' : 'SOME GOALS NOT MET'}`,
    data: finalResult,
  })

  // §2.4: event (done above) → state commit → notify (best-effort)
  commitState(state)
  notifyFinalVerification(state, finalResult.all_goals_met)

  if (!finalResult.all_goals_met) {
    process.stderr.write('\n[!] Some goals not met. Check .orchestrator/runs/<batch>/status.txt for details.\n')
    process.stderr.write('[!] Human decision required: manual fix / authorize remediation / accept.\n')
  }
}

// ── Recovery: state ↔ ITERATIONS.md consistency (§14 rule 1) ──

function checkStateIterationsConsistency(state) {
  const issues = []

  // Map state status → acceptable ITERATIONS.md statuses.
  // If doc status is NOT in the accepted list, it is an inconsistency.
  const acceptableDocStatus = {
    pending:          ['Planned'],
    active:           ['Planned', 'Approved', 'In Progress'],
    completed:        ['Completed'],
    on_hold:          ['On Hold'],
    blocked_by_spawn: ['Planned', 'Approved', 'In Progress'],
  }

  // Read ITERATIONS.md once (not per-iteration)
  const iterContent = readFileSync(
    join(process.cwd(), 'docs', 'ITERATIONS.md'), 'utf-8'
  )

  for (const iter of state.iterations) {
    // proposed / not-yet-registered iterations are not expected in ITERATIONS.md
    if (iter.status === 'proposed') continue
    if (!iter.registered_in_iterations_md) continue

    // Check existence
    if (!isRegistered(iter.id)) {
      issues.push(`${iter.id}: state.json (${iter.status}) but missing from ITERATIONS.md`)
      continue
    }

    // Extract doc status
    const escapedId = iter.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const lineMatch = iterContent.match(
      new RegExp(`\\|\\s*${escapedId}\\s*\\|[^|]*\\|[^|]*\\|[^|]*\\|[^|]*\\|\\s*([^|]+?)\\s*\\|`)
    )
    if (!lineMatch) continue

    const docStatus = lineMatch[1].trim()
    const accepted = acceptableDocStatus[iter.status]

    if (!accepted) continue // unknown state status — skip (don't block)

    if (!accepted.includes(docStatus)) {
      issues.push(
        `${iter.id}: state.json="${iter.status}" but ITERATIONS.md="${docStatus}" ` +
        `(expected one of: ${accepted.join(', ')})`
      )
    }
  }

  return issues
}

// ── Recovery: reconcile derived docs from authoritative state ──

function reconcileDerivedDocs(state) {
  // After crash, state.json is ground truth. Re-sync derived docs.
  let reconciledCount = 0

  for (const iter of state.iterations) {
    if (iter.status === 'proposed' || !iter.registered_in_iterations_md) continue

    // 0. Ensure iteration exists in ITERATIONS.md (may be missing after
    //    crash between INTAKE step 1 commit and step 2 register).
    if (!isRegistered(iter.id)) {
      try {
        const date = new Date().toISOString().slice(0, 10)
        registerIteration(iter.id, date, iter.spec.title, '', iter.expected_branch)
        process.stderr.write(`[recovery] Registered missing ITERATIONS.md entry for ${iter.id}\n`)
        reconciledCount++
      } catch (err) {
        process.stderr.write(`[recovery] FAILED to register ${iter.id}: ${err.message}\n`)
      }
    }

    // 1. Ensure ITERATIONS.md status matches state
    const targetStatus = {
      pending: 'Planned',
      active: 'In Progress',
      completed: 'Completed',
      on_hold: 'On Hold',
      blocked_by_spawn: 'In Progress',
    }[iter.status]

    if (targetStatus) {
      try { updateIterationStatus(iter.id, targetStatus) }
      catch { /* best-effort */ }
    }

    // 2. Ensure iteration skeleton exists
    try { createIterationSkeleton(iter.id) }
    catch { /* best-effort, idempotent */ }

    // 3. §5.2: Reconcile review records — replay any in state.json
    //    that are missing from runlog.md
    const reviewRecords = iter.evidence?.review_records || []
    if (reviewRecords.length > 0) {
      try {
        const runlogPath = join(process.cwd(), 'docs', 'iterations', iter.id, 'runlog.md')
        if (existsSync(runlogPath)) {
          const runlogContent = readFileSync(runlogPath, 'utf-8')

          for (const rec of reviewRecords) {
            // Dedup by (phase, round) — both REVIEW_PLAN round 1 and
            // REVIEW_EXEC round 1 must be independently tracked.
            const phase = rec.phase || 'REVIEW'
            const phaseMarker = `Phase: ${phase}`
            const indexMarker = `Review Index: ${rec.round}`
            // Check if BOTH phase and round exist in the same record block
            const hasRecord = runlogContent.includes(phaseMarker) &&
              runlogContent.includes(indexMarker) &&
              // Verify they're in the same block by checking proximity
              runlogContent.includes(`${phaseMarker}\n- Review Index: ${rec.round}`)
            if (!hasRecord) {
              appendReviewGateRecord(iter.id, {
                round: rec.round,
                phase,
                verdict: rec.verdict,
                revision_type: rec.revision_type,
                summary: rec.summary || '(no summary in state.json)',
              })
              reconciledCount++
            }
          }
        }
      } catch (err) {
        process.stderr.write(`[recovery] Failed to reconcile runlog for ${iter.id}: ${err.message}\n`)
      }
    }
  }

  process.stderr.write(`[recovery] Reconciled derived docs for ${state.iterations.length} iterations`)
  if (reconciledCount > 0) {
    process.stderr.write(` (${reconciledCount} review records replayed)`)
  }
  process.stderr.write('\n')
}

// ── Interactive helpers ─────────────────────────────────

function askUser(question) {
  return new Promise(resolve => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, answer => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

// ── Run ─────────────────────────────────────────────────

main().catch(err => {
  console.error('Orchestrator fatal error:', err)
  process.exit(1)
})
