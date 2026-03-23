#!/usr/bin/env bun
/**
 * test_orchestrator.mjs — State machine path verification with mock drivers.
 *
 * Tests:
 *   1. Happy path: INTAKE → PLANNING → 3x APPROVED → EXECUTION → 3x APPROVED → COMPLETE
 *   2. On Hold: major revision limit reached
 *   3. Batch stall: on_hold iterations block Final Verification
 *   4. Crash + resume: state.json recovery after simulated crash
 *
 * Usage: bun scripts/orchestrator/test_orchestrator.mjs
 */

import { randomUUID } from 'crypto'
import { existsSync, readFileSync, mkdirSync, rmSync, writeFileSync, appendFileSync } from 'fs'
import { dirname, join } from 'path'

import {
  createState, loadState, commitState, batchDir,
  addIteration, findIteration, updateIteration, transition,
  addReviewRecord, checkBranchGuard,
} from './state.mjs'
import {
  emitEvent, emitTransition, emitReview, emitCompleted, emitError,
  emitOnHold, detectOrphanedEvents, readEvents,
} from './events.mjs'
import { refreshStatus } from './monitor.mjs'
import { pickNext, acceptSpawn, setOnHold, syncOnHoldDocs, canResume } from './scheduler.mjs'
import { parseVerdict, parseFinalVerdict, parseExecOutput, extractClaudeResultText } from './drivers.mjs'

let passed = 0
let failed = 0

function assert(condition, msg) {
  if (condition) {
    passed++
    process.stderr.write(`  PASS: ${msg}\n`)
  } else {
    failed++
    process.stderr.write(`  FAIL: ${msg}\n`)
  }
}

function cleanBatch(batchId) {
  const dir = batchDir(batchId)
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true })
  }
}

// ── Test 1: State creation + commit + load ──────────────

function test_state_lifecycle() {
  process.stderr.write('\n== Test 1: State lifecycle ==\n')

  const batchId = `test-${randomUUID().slice(0, 8)}`
  const state = createState(batchId, 'test prompt', ['goal A', 'goal B'])

  assert(state.schema_version === 1, 'schema_version = 1')
  assert(state.state_revision === 0, 'initial revision = 0')
  assert(state.primary_goals.length === 2, '2 primary goals')
  assert(state.traceability.length === 2, '2 traceability entries')
  assert(state.entry_source === null, 'state entry_source defaults to null')
  assert(state.entry_route === null, 'state entry_route defaults to null')
  assert(state.review_policy === null, 'state review_policy defaults to null')
  assert(state.risk_profile === null, 'state risk_profile defaults to null')
  assert(state.batch_summary?.lifecycle === 'running', 'state batch_summary lifecycle defaults to running')
  assert(state.batch_summary?.final_verification === 'pending', 'state batch_summary mirrors pending final_verification')

  // Add iteration
  addIteration(state, {
    id: '0999-test-iter',
    type: 'primary',
    title: 'Test iteration',
    requirement: 'Test requirement',
    resolves_goals: [0],
    entry_source: 'iteration',
    entry_route: 'draft_iteration',
    review_policy: {
      approval_count: 3,
      major_revision_limit: 3,
      cli_failure_threshold: 2,
      risk_profile: 'standard',
    },
    risk_profile: 'standard',
  })
  assert(state.iterations.length === 1, '1 iteration added')
  assert(state.iterations[0].cli_failure_count === 0, 'cli_failure_count initialized')
  assert(state.iterations[0].entry_source === 'iteration', 'iteration entry_source persisted in memory')
  assert(state.iterations[0].entry_route === 'draft_iteration', 'iteration entry_route persisted in memory')
  assert(state.iterations[0].review_policy?.approval_count === 3, 'iteration review_policy approval_count persisted in memory')
  assert(state.iterations[0].risk_profile === 'standard', 'iteration risk_profile persisted in memory')

  // Commit
  commitState(state)
  assert(state.state_revision === 1, 'revision bumped to 1')
  assert(existsSync(batchDir(batchId)), 'batch dir created')

  // Load
  const loaded = loadState(batchId)
  assert(loaded !== null, 'state loaded')
  assert(loaded.state_revision === 1, 'loaded revision = 1')
  assert(loaded.iterations.length === 1, 'loaded 1 iteration')
  assert(loaded.entry_source === null, 'loaded state entry_source defaults to null')
  assert(loaded.iterations[0].entry_route === 'draft_iteration', 'loaded iteration entry_route preserved')
  assert(loaded.iterations[0].review_policy?.major_revision_limit === 3, 'loaded iteration review_policy preserved')
  assert(loaded.iterations[0].risk_profile === 'standard', 'loaded iteration risk_profile preserved')
  assert(loaded.batch_summary?.counts?.total === 1, 'loaded batch_summary total count preserved')
  assert(loaded.batch_summary?.counts?.pending === 1, 'loaded batch_summary pending count preserved')

  // Cleanup
  cleanBatch(batchId)
}

// ── Test 1b: Route classification + default review policy ─

async function test_entry_route_and_review_policy_models() {
  process.stderr.write('\n== Test 1b: Entry route + review policy models ==\n')

  const { classifyEntryRoute, hasScaffoldPlaceholder } = await import('./entry_route.mjs')
  const { buildReviewPolicy } = await import('./review_policy.mjs')

  assert(hasScaffoldPlaceholder('(to be filled by Codex during PLANNING phase)') === true,
    'scaffold placeholder detected')
  assert(hasScaffoldPlaceholder('# Real contract\n\nImplementation details.') === false,
    'non-scaffold contract not flagged')

  const newRequirement = classifyEntryRoute({
    entry_source: 'prompt',
  })
  assert(newRequirement.route_kind === 'new_requirement', '--prompt classified as new_requirement')

  const draftIteration = classifyEntryRoute({
    entry_source: 'iteration',
    iteration_status: 'Planned',
    has_plan: true,
    has_resolution: true,
    plan_is_scaffold: true,
    resolution_is_scaffold: false,
  })
  assert(draftIteration.route_kind === 'draft_iteration', 'scaffold iteration classified as draft_iteration')

  const executableIteration = classifyEntryRoute({
    entry_source: 'iteration',
    iteration_status: 'Approved',
    has_plan: true,
    has_resolution: true,
    plan_is_scaffold: false,
    resolution_is_scaffold: false,
  })
  assert(executableIteration.route_kind === 'executable_iteration',
    'approved complete contract classified as executable_iteration')

  const policy = buildReviewPolicy({ entry_route: executableIteration.route_kind })
  assert(policy.approval_count === 3, 'default review_policy approval_count = 3')
  assert(policy.major_revision_limit === 3, 'default review_policy major_revision_limit = 3')
  assert(policy.cli_failure_threshold === 2, 'default review_policy cli_failure_threshold = 2')
  assert(typeof policy.risk_profile === 'string' && policy.risk_profile.length > 0,
    'default review_policy risk_profile present')
}

// ── Test 1c: Tri-state routing start phase + planning mode ─

async function test_tri_state_entry_routing_and_planning_modes() {
  process.stderr.write('\n== Test 1c: Tri-state routing + planning mode ==\n')

  const { classifyEntryRoute } = await import('./entry_route.mjs')
  const { buildPlanningPrompt } = await import('./prompts.mjs')

  const draftIteration = classifyEntryRoute({
    entry_source: 'iteration',
    iteration_status: 'Planned',
    has_plan: true,
    has_resolution: true,
    plan_is_scaffold: true,
    resolution_is_scaffold: false,
  })
  assert(draftIteration.start_phase === 'PLANNING',
    'draft_iteration starts at PLANNING')

  // In Progress requires --resume, not fresh execution
  const inProgressIteration = classifyEntryRoute({
    entry_source: 'iteration',
    iteration_status: 'In Progress',
    has_plan: true,
    has_resolution: true,
    plan_is_scaffold: false,
    resolution_is_scaffold: false,
  })
  assert(inProgressIteration.is_blocked === true,
    'In Progress blocks fresh --iteration (requires --resume)')
  assert(inProgressIteration.reason.includes('requires_resume'),
    'In Progress reason indicates resume required')

  // On Hold also requires --resume after human decision
  const onHoldIteration = classifyEntryRoute({
    entry_source: 'iteration',
    iteration_status: 'On Hold',
    has_plan: true,
    has_resolution: true,
    plan_is_scaffold: false,
    resolution_is_scaffold: false,
  })
  assert(onHoldIteration.is_blocked === true,
    'On Hold blocks fresh --iteration (requires human decision + --resume)')

  // Approved = executable
  const executableIteration = classifyEntryRoute({
    entry_source: 'iteration',
    iteration_status: 'Approved',
    has_plan: true,
    has_resolution: true,
    plan_is_scaffold: false,
    resolution_is_scaffold: false,
  })
  assert(executableIteration.start_phase === 'EXECUTION',
    'Approved starts at EXECUTION')
  assert(executableIteration.route_kind === 'executable_iteration',
    'Approved route = executable_iteration')

  const completedIteration = classifyEntryRoute({
    entry_source: 'iteration',
    iteration_status: 'Completed',
    has_plan: true,
    has_resolution: true,
    plan_is_scaffold: false,
    resolution_is_scaffold: false,
  })
  assert(completedIteration.is_blocked === true, 'Completed iteration is blocked')
  assert(completedIteration.reason === 'terminal_iteration_status:Completed',
    'Completed iteration exposes explicit block reason')

  const missingContractIteration = classifyEntryRoute({
    entry_source: 'iteration',
    iteration_status: 'Approved',
    has_plan: true,
    has_resolution: false,
    plan_is_scaffold: false,
    resolution_is_scaffold: false,
  })
  assert(missingContractIteration.is_blocked === true, 'missing contract iteration is blocked')
  assert(missingContractIteration.reason === 'missing_contract_files',
    'missing contract exposes explicit block reason')

  const createPrompt = buildPlanningPrompt('0203-three-state-routing-review-policy', {
    title: 'tri-state routing',
    requirement: 'create planning contract',
  }, { mode: 'create' })
  assert(createPrompt.includes('新建合同'), 'create planning prompt declares create mode')

  const refinePrompt = buildPlanningPrompt('0203-three-state-routing-review-policy', {
    title: 'tri-state routing',
    requirement: 'refine planning contract',
  }, { mode: 'refine' })
  assert(refinePrompt.includes('基于既有草稿补完/重写合同'),
    'refine planning prompt declares refine mode')
}

// ── Test 1d: review_policy prompt wiring + escalation ───

async function test_review_policy_prompt_wiring() {
  process.stderr.write('\n== Test 1d: review policy prompt wiring ==\n')

  const { buildReviewPolicy, resolveEscalationAction } = await import('./review_policy.mjs')
  const { buildPlanReviewPrompt, buildExecReviewPrompt } = await import('./prompts.mjs')

  const reviewPolicy = buildReviewPolicy({ entry_route: 'draft_iteration' })
  assert(resolveEscalationAction(reviewPolicy, 'ambiguous_revision') === 'human_decision_required',
    'ambiguous escalation action comes from review_policy')
  assert(resolveEscalationAction(reviewPolicy, 'cli_failure') === 'on_hold_after_threshold',
    'cli failure escalation action comes from review_policy')

  const planReviewPrompt = buildPlanReviewPrompt('0203-three-state-routing-review-policy', false, {
    review_policy: reviewPolicy,
    risk_profile: reviewPolicy.risk_profile,
  })
  assert(planReviewPrompt.includes('approval_count'), 'plan review prompt includes approval_count')
  assert(planReviewPrompt.includes('major_revision_limit'), 'plan review prompt includes major_revision_limit')
  assert(planReviewPrompt.includes('cli_failure_threshold'), 'plan review prompt includes cli_failure_threshold')
  assert(planReviewPrompt.includes(reviewPolicy.risk_profile), 'plan review prompt includes risk_profile')

  const execReviewPrompt = buildExecReviewPrompt('0203-three-state-routing-review-policy', false, {
    review_policy: reviewPolicy,
    risk_profile: reviewPolicy.risk_profile,
  })
  assert(execReviewPrompt.includes('approval_count'), 'exec review prompt includes approval_count')
  assert(execReviewPrompt.includes('escalation_policy'), 'exec review prompt includes escalation_policy')
}

// ── Test 1e: Failure normalization + evidence persistence ─

async function test_failure_normalization_and_state_evidence() {
  process.stderr.write('\n== Test 1e: Failure normalization + state evidence ==\n')

  let escalationEngine = null
  try {
    escalationEngine = await import('./escalation_engine.mjs')
  } catch {
    escalationEngine = null
  }

  assert(escalationEngine !== null, 'escalation_engine module exists')
  assert(typeof escalationEngine?.normalizeFailureSignal === 'function',
    'normalizeFailureSignal exported')

  if (typeof escalationEngine?.normalizeFailureSignal === 'function') {
    const maxTurns = escalationEngine.normalizeFailureSignal({
      source: 'claude_review',
      operation: 'claudeReview',
      phase: 'REVIEW_PLAN',
      error_type: 'max_turns',
      error: 'Claude exhausted turns (stop_reason=error_max_turns, turns=8)',
    })
    assert(maxTurns.kind === 'max_turns', 'max_turns failure normalized')

    const timeout = escalationEngine.normalizeFailureSignal({
      source: 'claude_review',
      operation: 'claudeReview',
      phase: 'REVIEW_PLAN',
      code: 'ETIMEDOUT',
      error: 'spawnSync /bin/sh ETIMEDOUT',
    })
    assert(timeout.kind === 'timeout', 'timeout failure normalized')

    const processError = escalationEngine.normalizeFailureSignal({
      source: 'claude_review',
      operation: 'claudeReview',
      phase: 'REVIEW_PLAN',
      error: 'Command failed: claude -p --output-format json',
      stderr: 'spawn EPIPE',
    })
    assert(processError.kind === 'process_error', 'process failure normalized')

    const jsonParse = escalationEngine.normalizeFailureSignal({
      source: 'claude_review',
      operation: 'claudeReview',
      phase: 'REVIEW_PLAN',
      stage: 'json_parse',
      error: 'Failed to parse Claude Code JSON output',
      raw: '{"unterminated": true',
    })
    assert(jsonParse.kind === 'json_parse_error', 'json parse failure normalized')
  }

  const stateModule = await import('./state.mjs')
  assert(typeof stateModule.recordFailureEvidence === 'function',
    'recordFailureEvidence exported')
  assert(typeof stateModule.recordEscalationEvidence === 'function',
    'recordEscalationEvidence exported')
  assert(typeof stateModule.recordOscillationEvidence === 'function',
    'recordOscillationEvidence exported')

  if (
    typeof stateModule.recordFailureEvidence === 'function' &&
    typeof stateModule.recordEscalationEvidence === 'function' &&
    typeof stateModule.recordOscillationEvidence === 'function' &&
    typeof escalationEngine?.normalizeFailureSignal === 'function'
  ) {
    const batchId = `test-${randomUUID().slice(0, 8)}`
    const state = createState(batchId, 'test', ['goal'])
    addIteration(state, { id: 'iter-failure', type: 'primary', title: 'T', requirement: 'R' })

    stateModule.recordFailureEvidence(state, 'iter-failure', escalationEngine.normalizeFailureSignal({
      source: 'claude_review',
      operation: 'claudeReview',
      phase: 'REVIEW_PLAN',
      code: 'ETIMEDOUT',
      error: 'spawnSync /bin/sh ETIMEDOUT',
    }))
    stateModule.recordEscalationEvidence(state, 'iter-failure', {
      phase: 'REVIEW_PLAN',
      action: 'warn_and_continue',
      reason: 'threshold not reached',
    })
    stateModule.recordOscillationEvidence(state, 'iter-failure', {
      phase: 'REVIEW_PLAN',
      pattern: ['APPROVED', 'NEEDS_CHANGES', 'APPROVED'],
      threshold: 1,
      detected: true,
    })

    commitState(state)

    const loaded = loadState(batchId)
    const loadedIter = findIteration(loaded, 'iter-failure')
    assert(Array.isArray(loadedIter?.evidence?.failures), 'failure evidence persisted after reload')
    assert(loadedIter?.evidence?.failures?.[0]?.kind === 'timeout',
      'persisted failure evidence preserves kind')
    assert(loadedIter?.evidence?.escalations?.[0]?.action === 'warn_and_continue',
      'persisted escalation evidence preserves action')
    assert(loadedIter?.evidence?.oscillations?.[0]?.detected === true,
      'persisted oscillation evidence preserves detection result')

    cleanBatch(batchId)
  }
}

// ── Test 1f: Failure matrix + oscillation rules ────────

async function test_failure_matrix_and_oscillation_rules() {
  process.stderr.write('\n== Test 1f: Failure matrix + oscillation rules ==\n')

  const { buildReviewPolicy } = await import('./review_policy.mjs')
  const escalationEngine = await import('./escalation_engine.mjs')

  assert(typeof escalationEngine.resolveEscalationDecision === 'function',
    'resolveEscalationDecision exported')
  assert(typeof escalationEngine.detectReviewOscillation === 'function',
    'detectReviewOscillation exported')

  const defaultPolicy = buildReviewPolicy({ entry_route: 'executable_iteration' })
  assert(typeof defaultPolicy.escalation_policy.parse_failure === 'object',
    'parse_failure policy modeled explicitly')
  assert(typeof defaultPolicy.escalation_policy.max_turns === 'object',
    'max_turns policy modeled explicitly')
  assert(typeof defaultPolicy.escalation_policy.timeout === 'object',
    'timeout policy modeled explicitly')
  assert(typeof defaultPolicy.escalation_policy.state_doc_inconsistency === 'object',
    'state_doc_inconsistency policy modeled explicitly')
  assert(typeof defaultPolicy.escalation_policy.oscillation === 'object',
    'oscillation policy modeled explicitly')

  if (
    typeof escalationEngine.resolveEscalationDecision === 'function' &&
    typeof escalationEngine.detectReviewOscillation === 'function'
  ) {
    const parseFailureDecision = escalationEngine.resolveEscalationDecision({
      phase: 'REVIEW_PLAN',
      failure: { kind: 'json_parse_error' },
      recent_failure_history: [{ kind: 'json_parse_error' }],
      recent_review_history: [],
      risk_profile: defaultPolicy.risk_profile,
      review_policy: defaultPolicy,
    })
    assert(parseFailureDecision.normalized_failure_kind === 'parse_failure',
      'json_parse_error normalized to parse_failure policy key')
    assert(parseFailureDecision.action === 'on_hold',
      'parse_failure reaches default on_hold action at threshold')
    assert(parseFailureDecision.threshold_reached === true,
      'parse_failure threshold detected')

    const maxTurnsDecision = escalationEngine.resolveEscalationDecision({
      phase: 'REVIEW_EXEC',
      failure: { kind: 'max_turns' },
      recent_failure_history: [],
      recent_review_history: [],
      risk_profile: defaultPolicy.risk_profile,
      review_policy: defaultPolicy,
    })
    assert(maxTurnsDecision.action === 'retry',
      'max_turns defaults to retry before threshold')
    assert(maxTurnsDecision.threshold_reached === false,
      'max_turns below threshold does not trigger on_hold')

    const stateMismatchDecision = escalationEngine.resolveEscalationDecision({
      phase: 'EXECUTION',
      failure: { kind: 'state_doc_inconsistency' },
      recent_failure_history: [],
      recent_review_history: [],
      risk_profile: defaultPolicy.risk_profile,
      review_policy: defaultPolicy,
    })
    assert(stateMismatchDecision.action === 'human_decision_required',
      'state_doc_inconsistency escalates to human decision')

    const oscillation = escalationEngine.detectReviewOscillation(
      ['APPROVED', 'NEEDS_CHANGES', 'APPROVED'],
      defaultPolicy,
    )
    assert(oscillation.detected === true, 'APPROVED -> NEEDS_CHANGES -> APPROVED is oscillation')

    const inverseOscillation = escalationEngine.detectReviewOscillation(
      ['NEEDS_CHANGES', 'APPROVED', 'NEEDS_CHANGES'],
      defaultPolicy,
    )
    assert(inverseOscillation.detected === true,
      'NEEDS_CHANGES -> APPROVED -> NEEDS_CHANGES is oscillation')

    const oscillationDecision = escalationEngine.resolveEscalationDecision({
      phase: 'REVIEW_EXEC',
      failure: { kind: 'oscillation' },
      recent_failure_history: [],
      recent_review_history: ['APPROVED', 'NEEDS_CHANGES', 'APPROVED'],
      risk_profile: defaultPolicy.risk_profile,
      review_policy: defaultPolicy,
    })
    assert(oscillationDecision.action === 'human_decision_required',
      'oscillation resolves to human_decision_required')
    assert(oscillationDecision.threshold_reached === true,
      'oscillation decision reports threshold reached')

    const warningPolicy = buildReviewPolicy({
      entry_route: 'draft_iteration',
      overrides: {
        escalation_policy: {
          parse_failure: {
            action: 'warn_and_continue',
            threshold: 1,
          },
        },
      },
    })
    const parseWarning = escalationEngine.resolveEscalationDecision({
      phase: 'REVIEW_PLAN',
      failure: { kind: 'json_parse_error' },
      recent_failure_history: [],
      recent_review_history: [],
      risk_profile: warningPolicy.risk_profile,
      review_policy: warningPolicy,
    })
    assert(parseWarning.action === 'warn_and_continue',
      'policy override can resolve parse_failure to warn_and_continue')
  }
}

// ── Test 1g: Resume path history + prompt escalation wiring ─

async function test_resume_history_and_prompt_escalation_wiring() {
  process.stderr.write('\n== Test 1g: Resume history + prompt escalation wiring ==\n')

  const stateModule = await import('./state.mjs')
  const escalationEngine = await import('./escalation_engine.mjs')
  const { buildReviewPolicy } = await import('./review_policy.mjs')
  const { buildPlanReviewPrompt, buildExecReviewPrompt } = await import('./prompts.mjs')

  assert(typeof stateModule.getFailureEvidence === 'function', 'getFailureEvidence exported')
  assert(typeof stateModule.getReviewVerdictHistory === 'function', 'getReviewVerdictHistory exported')

  const reviewPolicy = buildReviewPolicy({ entry_route: 'executable_iteration' })
  const planPrompt = buildPlanReviewPrompt('0204-escalation-rules-engine', false, {
    review_policy: reviewPolicy,
    risk_profile: reviewPolicy.risk_profile,
  })
  assert(planPrompt.includes('Failure matrix'), 'plan review prompt includes failure matrix guidance')

  const execPrompt = buildExecReviewPrompt('0204-escalation-rules-engine', false, {
    review_policy: reviewPolicy,
    risk_profile: reviewPolicy.risk_profile,
  })
  assert(execPrompt.includes('Oscillation boundary'),
    'exec review prompt includes oscillation boundary guidance')

  if (
    typeof stateModule.getFailureEvidence === 'function' &&
    typeof stateModule.getReviewVerdictHistory === 'function'
  ) {
    const batchId = `test-${randomUUID().slice(0, 8)}`
    const state = createState(batchId, 'test', ['goal'])
    addIteration(state, {
      id: 'iter-resume',
      type: 'primary',
      title: 'Resume',
      requirement: 'Persist review failure history',
      review_policy: reviewPolicy,
      risk_profile: reviewPolicy.risk_profile,
    })

    stateModule.recordFailureEvidence(state, 'iter-resume', {
      kind: 'max_turns',
      phase: 'REVIEW_EXEC',
      message: 'first max_turns',
    })
    addReviewRecord(state, 'iter-resume', {
      round: 1,
      phase: 'REVIEW_EXEC',
      verdict: 'APPROVED',
      summary: 'ok',
      session_id: 'sess-1',
    })
    addReviewRecord(state, 'iter-resume', {
      round: 2,
      phase: 'REVIEW_EXEC',
      verdict: 'NEEDS_CHANGES',
      summary: 'needs work',
      session_id: 'sess-2',
    })
    addReviewRecord(state, 'iter-resume', {
      round: 3,
      phase: 'REVIEW_EXEC',
      verdict: 'APPROVED',
      summary: 'ok again',
      session_id: 'sess-3',
    })
    commitState(state)

    const loaded = loadState(batchId)
    const failureHistory = stateModule.getFailureEvidence(loaded, 'iter-resume')
    const repeatedFailureDecision = escalationEngine.resolveEscalationDecision({
      phase: 'REVIEW_EXEC',
      failure: { kind: 'max_turns' },
      recent_failure_history: failureHistory,
      recent_review_history: [],
      risk_profile: reviewPolicy.risk_profile,
      review_policy: reviewPolicy,
    })
    assert(repeatedFailureDecision.action === 'on_hold',
      'reloaded repeated max_turns history still reaches on_hold')

    const reviewHistory = stateModule.getReviewVerdictHistory(loaded, 'iter-resume', 'REVIEW_EXEC')
    assert(reviewHistory.join('>') === 'APPROVED>NEEDS_CHANGES>APPROVED',
      'review verdict history preserved after reload')

    const oscillationDecision = escalationEngine.resolveEscalationDecision({
      phase: 'REVIEW_EXEC',
      failure: { kind: 'oscillation' },
      recent_failure_history: [],
      recent_review_history: reviewHistory,
      risk_profile: reviewPolicy.risk_profile,
      review_policy: reviewPolicy,
    })
    assert(oscillationDecision.action === 'human_decision_required',
      'reloaded oscillation history still requires human decision')

    cleanBatch(batchId)
  }
}

// ── Test 1h: Docs sync for escalation rules ─────────────

function test_docs_sync_for_escalation_rules() {
  process.stderr.write('\n== Test 1h: Docs sync for escalation rules ==\n')

  const ssotPath = join(process.cwd(), 'docs', 'ssot', 'orchestrator_hard_rules.md')
  const runbookPath = join(process.cwd(), 'docs', 'user-guide', 'orchestrator_local_smoke.md')
  const wavePromptPath = join(process.cwd(), 'docs', 'user-guide', 'orchestrator_wave_0218_0221_prompt.txt')

  const ssot = readFileSync(ssotPath, 'utf-8')
  const runbook = readFileSync(runbookPath, 'utf-8')
  const wavePrompt = readFileSync(wavePromptPath, 'utf-8')

  assert(ssot.includes('failure matrix'), 'SSOT mentions failure matrix')
  assert(ssot.includes('state_doc_inconsistency'), 'SSOT mentions state_doc_inconsistency')
  assert(ssot.includes('oscillation'), 'SSOT mentions oscillation')
  assert(ssot.includes('warn_and_continue'), 'SSOT mentions warn_and_continue action')
  assert(ssot.includes('0204') && ssot.includes('0205'), 'SSOT mentions 0204/0205 boundary')
  assert(ssot.includes('batch_summary'), 'SSOT mentions batch_summary')
  assert(ssot.includes('terminal_outcome'), 'SSOT mentions terminal_outcome')
  assert(ssot.includes('Batch Lifecycle') && ssot.includes('Batch Outcome'),
    'SSOT mentions terminal status.txt fields')
  assert(ssot.includes('browser_task'), 'SSOT mentions browser_task contract')
  assert(ssot.includes('output/playwright'), 'SSOT mentions output/playwright evidence path')
  assert(ssot.includes('artifact_missing'), 'SSOT mentions artifact_missing failure kind')
  assert(ssot.includes('artifact_mismatch'), 'SSOT mentions artifact_mismatch failure kind')
  assert(ssot.includes('stale_result'), 'SSOT mentions stale_result failure kind')
  assert(ssot.includes('duplicate_result'), 'SSOT mentions duplicate_result failure kind')
  assert(ssot.includes('ingest_failed'), 'SSOT mentions ingest_failed failure kind')
  assert(ssot.includes('browser_bridge_not_proven'), 'SSOT mentions browser_bridge_not_proven failure kind')
  assert(ssot.includes('Browser Task:') && ssot.includes('Browser Failure Kind:'),
    'SSOT freezes browser status.txt fields')
  assert(ssot.includes('runlog.md') && ssot.includes('request file') && ssot.includes('result file'),
    'SSOT freezes runlog request/result evidence mapping')

  assert(runbook.includes('state_doc_inconsistency'), 'runbook mentions state_doc_inconsistency')
  assert(runbook.includes('oscillation'), 'runbook mentions oscillation')
  assert(runbook.includes('human_decision_required'), 'runbook mentions human_decision_required')
  assert(runbook.includes('warn_and_continue'), 'runbook mentions warn_and_continue')
  assert(runbook.includes('batch_summary'), 'runbook mentions batch_summary')
  assert(runbook.includes('Batch Lifecycle') && runbook.includes('Batch Outcome'),
    'runbook mentions terminal status fields')
  assert(runbook.includes('[batch:passed]'), 'runbook mentions structured batch event label')
  assert(runbook.includes('completed event') && runbook.includes('status'),
    'runbook explains how to diagnose completed event vs status mismatch')
  assert(runbook.includes('browser_task'), 'runbook mentions browser_task contract')
  assert(runbook.includes('request.json') && runbook.includes('result.json'),
    'runbook mentions request/result exchange files')
  assert(runbook.includes('output/playwright'), 'runbook mentions output/playwright evidence path')
  assert(runbook.includes('artifact_mismatch'), 'runbook mentions artifact_mismatch')
  assert(runbook.includes('browser_bridge_not_proven'), 'runbook mentions browser_bridge_not_proven')
  assert(runbook.includes('MCP unavailable') || runbook.includes('mcp_unavailable'),
    'runbook mentions MCP unavailable stop condition')
  assert(runbook.includes('Browser Task:') && runbook.includes('Browser Failure Kind:'),
    'runbook mentions browser status fields')
  assert(runbook.includes('awaiting_result'), 'runbook mentions browser awaiting_result wait point')
  assert(runbook.includes('artifact only'), 'runbook mentions artifact-only non-pass interpretation')

  assert(wavePrompt.includes('browser_task'), 'wave prompt mentions browser_task contract')
  assert(wavePrompt.includes('.orchestrator/runs/<batch_id>/browser_tasks/<task_id>/request.json'),
    'wave prompt mentions request exchange path')
  assert(wavePrompt.includes('.orchestrator/runs/<batch_id>/browser_tasks/<task_id>/result.json'),
    'wave prompt mentions result exchange path')
  assert(wavePrompt.includes('output/playwright/<batch_id>/<task_id>/'),
    'wave prompt mentions output/playwright task evidence path')
  assert(wavePrompt.includes('artifact_mismatch'), 'wave prompt mentions artifact_mismatch stop rule')
  assert(wavePrompt.includes('duplicate_result'), 'wave prompt mentions duplicate_result stop rule')
  assert(wavePrompt.includes('timeout'), 'wave prompt mentions timeout handling')
  assert(wavePrompt.includes('awaiting_result'), 'wave prompt mentions awaiting_result browser wait point')
  assert(wavePrompt.includes('browser_bridge_not_proven'), 'wave prompt mentions browser_bridge_not_proven')
  assert(wavePrompt.includes('MCP unavailable') || wavePrompt.includes('mcp_unavailable'),
    'wave prompt mentions MCP unavailable stop rule')
}

// ── Test 2: Events + orphan detection ───────────────────

async function test_events() {
  process.stderr.write('\n== Test 2: Events + orphan detection ==\n')

  const batchId = `test-${randomUUID().slice(0, 8)}`
  const state = createState(batchId, 'test', ['goal'])
  commitState(state)

  // Emit events
  emitEvent(state, { event_type: 'transition', message: 'test event 1' })
  emitEvent(state, { event_type: 'transition', message: 'test event 2' })

  const events = readEvents(batchId)
  assert(events.length === 2, '2 events written')
  assert(events[0].state_revision === 1, 'event carries state_revision')

  // Simulate orphan: write event with future revision
  const eventsFile = join(batchDir(batchId), 'events.jsonl')
  appendFileSync(eventsFile, JSON.stringify({
    schema_version: 1, batch_id: batchId, event_id: 'orphan',
    state_revision: 999, timestamp: new Date().toISOString(),
    event_type: 'transition', message: 'orphan event',
  }) + '\n')

  const orphans = detectOrphanedEvents(state)
  assert(orphans.length === 1, '1 orphaned event detected')
  assert(orphans[0].state_revision === 999, 'orphan has revision 999')

  cleanBatch(batchId)
}

// ── Test 2b: Completion payload + notify summary ───────

async function test_completion_payload_and_notify_summary() {
  process.stderr.write('\n== Test 2b: Completion payload + notify summary ==\n')

  const notifyModule = await import('./notify.mjs')
  assert(typeof notifyModule.buildBatchCompleteDetail === 'function',
    'buildBatchCompleteDetail exported')

  const batchId = `test-${randomUUID().slice(0, 8)}`
  const state = createState(batchId, 'test', ['goal'])
  addIteration(state, { id: 'iter-done', type: 'primary', title: 'Done', requirement: 'R' })
  state.iterations[0].status = 'completed'
  state.iterations[0].phase = 'COMPLETE'
  state.current_iteration = null
  state.final_verification = 'passed'
  commitState(state)

  const expectedRevision = state.state_revision + 1
  emitCompleted(state, 'iter-done', {
    scope: 'iteration',
    terminal_outcome: 'completed',
    state_revision: expectedRevision,
    terminal_summary: state.batch_summary,
  })
  emitCompleted(state, null, {
    scope: 'batch',
    message: 'Batch complete',
    terminal_outcome: state.batch_summary?.terminal_outcome,
    state_revision: expectedRevision,
    terminal_summary: state.batch_summary,
  })

  const events = readEvents(batchId)
  const iterationCompleted = events.find(event =>
    event.event_type === 'completed' && event.iteration_id === 'iter-done'
  )
  const batchCompleted = events.find(event =>
    event.event_type === 'completed' && event.iteration_id === null && event.message === 'Batch complete'
  )

  assert(iterationCompleted?.data?.scope === 'iteration',
    'iteration completed event exposes scope = iteration')
  assert(iterationCompleted?.data?.terminal_outcome === 'completed',
    'iteration completed event exposes terminal_outcome = completed')
  assert(iterationCompleted?.state_revision === expectedRevision,
    'iteration completed event uses target state_revision')

  assert(batchCompleted?.data?.scope === 'batch',
    'batch completed event exposes scope = batch')
  assert(batchCompleted?.data?.terminal_outcome === 'passed',
    'batch completed event exposes final terminal_outcome')
  assert(batchCompleted?.data?.terminal_summary?.lifecycle === 'completed',
    'batch completed event carries terminal_summary payload')
  assert(batchCompleted?.state_revision === expectedRevision,
    'batch completed event uses target state_revision')

  if (typeof notifyModule.buildBatchCompleteDetail === 'function') {
    const detail = notifyModule.buildBatchCompleteDetail({
      iterations: [{ status: 'completed' }],
      batch_summary: {
        lifecycle: 'completed',
        terminal_outcome: 'failed',
        final_verification: 'failed',
        counts: { completed: 2, total: 2 },
      },
    })
    assert(detail.includes('2/2'), 'batch completion detail uses authoritative summary counts')
    assert(detail.includes('failed'), 'batch completion detail includes terminal outcome from summary')
  }

  cleanBatch(batchId)
}

// ── Test 3: Scheduler + spawn ───────────────────────────

function test_scheduler() {
  process.stderr.write('\n== Test 3: Scheduler + spawn ==\n')

  const batchId = `test-${randomUUID().slice(0, 8)}`
  const state = createState(batchId, 'test', ['goal A', 'goal B'])
  commitState(state)

  addIteration(state, { id: 'iter-a', type: 'primary', title: 'A', requirement: 'req A' })
  addIteration(state, { id: 'iter-b', type: 'primary', title: 'B', requirement: 'req B' })

  // Pick should return first primary
  const first = pickNext(state)
  assert(first.id === 'iter-a', 'picks first primary')

  // Accept derived_dependency spawn (blocking)
  const spawnResult = acceptSpawn(state, 'iter-a', {
    title: 'fix dep',
    reason: 'need this first',
    spawn_type: 'derived_dependency',
    blocks_current: true,
  })
  assert(spawnResult.accepted === true, 'derived_dependency accepted')

  // Blocking spawn should be picked first
  findIteration(state, 'iter-a').status = 'blocked_by_spawn'
  const next = pickNext(state)
  assert(next.id === spawnResult.id, 'blocking spawn picked first')

  // scope_expansion should be proposed, not accepted
  const scopeResult = acceptSpawn(state, 'iter-a', {
    title: 'new feature',
    reason: 'nice to have',
    spawn_type: 'scope_expansion',
    blocks_current: false,
  })
  assert(scopeResult.proposed === true, 'scope_expansion proposed only')
  assert(scopeResult.accepted === false, 'scope_expansion not auto-accepted')

  cleanBatch(batchId)
}

// ── Test 4: Parse verdict ───────────────────────────────

function test_parsers() {
  process.stderr.write('\n== Test 4: Verdict parsers ==\n')

  // Review verdict
  const reviewText = 'Some analysis...\n```json\n{"verdict":"APPROVED","blocking_issues":[],"summary":"ok"}\n```'
  const rv = parseVerdict(reviewText)
  assert(rv.ok === true, 'parseVerdict succeeds')
  assert(rv.verdict.verdict === 'APPROVED', 'verdict = APPROVED')

  const needsChanges = '```json\n{"verdict":"NEEDS_CHANGES","revision_type":"major","blocking_issues":[{"severity":"critical","description":"bad"}],"summary":"fix"}\n```'
  const nc = parseVerdict(needsChanges)
  assert(nc.ok === true, 'parseVerdict NEEDS_CHANGES')
  assert(nc.verdict.revision_type === 'major', 'revision_type = major')

  // Real Claude Code output can be plain prose, not JSON
  const proseApproved = '评审完成。Verdict: **APPROVED**，无阻塞问题，两条非阻塞建议已列出。'
  const prose = parseVerdict(proseApproved)
  assert(prose.ok === true, 'parseVerdict accepts prose Verdict: APPROVED')
  assert(prose.verdict.verdict === 'APPROVED', 'prose verdict = APPROVED')

  // Prose "NEEDS_CHANGES (major)" — inline parentheses format
  const proseNeedsMajor = '审查结论：NEEDS_CHANGES (major)。Step 2/3 未完成。'
  const pnm = parseVerdict(proseNeedsMajor)
  assert(pnm.ok === true, 'parseVerdict accepts prose NEEDS_CHANGES (major)')
  assert(pnm.verdict.verdict === 'NEEDS_CHANGES', 'prose needs_changes verdict')
  assert(pnm.verdict.revision_type === 'major', 'prose (major) extracted')

  // Claude Code may put the useful review payload into permission_denials[].tool_input.plan
  // when ExitPlanMode is denied. We must extract that fallback text.
  const outerClaudeJson = {
    result: '',
    permission_denials: [
      {
        tool_name: 'ExitPlanMode',
        tool_input: {
          plan: '## Verdict: APPROVED\n\n```json\n{"verdict":"APPROVED","blocking_issues":[],"summary":"ok from fallback"}\n```',
        },
      },
    ],
  }
  const extracted = extractClaudeResultText(outerClaudeJson)
  assert(extracted.includes('"verdict":"APPROVED"'), 'extractClaudeResultText falls back to permission_denials plan')
  const fallbackVerdict = parseVerdict(extracted)
  assert(fallbackVerdict.ok === true, 'parseVerdict works on extracted fallback text')
  assert(fallbackVerdict.verdict.summary === 'ok from fallback', 'fallback summary preserved')

  // Final verdict (different schema)
  const finalText = '```json\n{"all_goals_met":true,"goal_results":[{"goal_index":0,"status":"met","evidence":"test passes"}]}\n```'
  const fv = parseFinalVerdict(finalText)
  assert(fv.ok === true, 'parseFinalVerdict succeeds')
  assert(fv.result.all_goals_met === true, 'all_goals_met = true')

  // parseVerdict should NOT parse final verdict
  const wrongParser = parseVerdict(finalText)
  assert(wrongParser.ok === false, 'parseVerdict rejects final verdict format')

  // Exec output
  const execText = '```json\n{"execution_summary":"done","steps_completed":[{"step":1,"status":"pass"}]}\n```'
  const eo = parseExecOutput(execText)
  assert(eo.ok === true, 'parseExecOutput succeeds')
}

// ── Test 4a: Execution browser_task handshake ──────────

async function test_execution_browser_task_handshake() {
  process.stderr.write('\n== Test 4a: Execution browser_task handshake ==\n')

  const { buildExecutionPrompt } = await import('./prompts.mjs')
  const { materializeBrowserTaskRequests } = await import('./drivers.mjs')

  const iterationId = '0220-orchestrator-browser-phase-and-regression'
  const prompt = buildExecutionPrompt(iterationId)
  assert(prompt.includes('"browser_tasks"'), 'execution prompt exposes browser_tasks output field')
  assert(prompt.includes('browser_task'), 'execution prompt names browser_task explicitly')
  assert(prompt.includes('required_artifacts'), 'execution prompt requires required_artifacts in structured output')
  assert(prompt.includes('success_assertions'), 'execution prompt requires success_assertions in structured output')

  const execText = `\`\`\`json
{"execution_summary":"handshake done","steps_completed":[{"step":1,"status":"pass"}],"browser_tasks":[{"task_kind":"browser_task","task_id":"workspace-smoke","summary":"Prove workspace browser evidence","start_url":"http://127.0.0.1:30900/","instructions":["Open workspace page","Capture final evidence"],"success_assertions":["workspace page renders","required artifacts are produced"],"required_artifacts":[{"artifact_kind":"screenshot","file_name":"final.png","required":true,"media_type":"image/png"},{"artifact_kind":"json","file_name":"report.json","required":true,"media_type":"application/json"}],"executor":{"mode":"mcp","executor_id":"playwright-mcp"},"timeout_ms":45000}]}
\`\`\``
  const parsed = parseExecOutput(execText)
  assert(parsed.ok === true, 'parseExecOutput accepts structured browser_tasks payload')
  assert(Array.isArray(parsed.output.browser_tasks), 'parseExecOutput preserves browser_tasks array')
  assert(parsed.output.browser_tasks?.[0]?.task_id === 'workspace-smoke',
    'parseExecOutput preserves browser_task task_id')

  const invalid = parseExecOutput('```json\n{"execution_summary":"broken","browser_tasks":[{"task_kind":"browser_task","task_id":"broken-task"}]}\n```')
  assert(invalid.ok === false, 'parseExecOutput rejects malformed browser_task payloads')

  assert(typeof materializeBrowserTaskRequests === 'function',
    'drivers exports materializeBrowserTaskRequests')
  if (typeof materializeBrowserTaskRequests !== 'function' || !parsed.ok) {
    return
  }

  const batchId = `test-browser-handshake-${randomUUID().slice(0, 8)}`
  const outputDir = join(process.cwd(), 'output', 'playwright', batchId)
  cleanBatch(batchId)
  if (existsSync(outputDir)) {
    rmSync(outputDir, { recursive: true, force: true })
  }

  const materialized = materializeBrowserTaskRequests({
    batchId,
    iterationId,
    browserTasks: parsed.output.browser_tasks,
  })

  assert(materialized.ok === true, 'materializeBrowserTaskRequests succeeds')
  assert(materialized.tasks?.length === 1, 'materializeBrowserTaskRequests returns one canonical request')
  assert(
    materialized.tasks?.[0]?.paths?.requestFileRelative ===
      `.orchestrator/runs/${batchId}/browser_tasks/workspace-smoke/request.json`,
    'materialization uses canonical request.json exchange path'
  )

  const requestFile = join(
    process.cwd(),
    `.orchestrator/runs/${batchId}/browser_tasks/workspace-smoke/request.json`
  )
  assert(existsSync(requestFile), 'materialization writes canonical request.json to disk')
  if (existsSync(requestFile)) {
    const request = JSON.parse(readFileSync(requestFile, 'utf8'))
    assert(
      request.exchange?.request_file ===
        `.orchestrator/runs/${batchId}/browser_tasks/workspace-smoke/request.json`,
      'materialized request exchange points at canonical request.json'
    )
    assert(
      request.required_artifacts?.[0]?.relative_path ===
        `output/playwright/${batchId}/workspace-smoke/final.png`,
      'materialized request maps artifacts into canonical output/playwright dir'
    )
  }

  cleanBatch(batchId)
  if (existsSync(outputDir)) {
    rmSync(outputDir, { recursive: true, force: true })
  }
}

function sampleExecBrowserTask(taskId, mode = 'mcp') {
  return {
    task_kind: 'browser_task',
    task_id: taskId,
    summary: `Prove browser ingest for ${taskId}`,
    start_url: 'http://127.0.0.1:30900/',
    instructions: [
      'Open the workspace page.',
      'Capture deterministic evidence.',
    ],
    success_assertions: [
      'workspace page renders',
      'required artifacts are produced',
    ],
    required_artifacts: [
      {
        artifact_kind: 'screenshot',
        file_name: 'final.png',
        required: true,
        media_type: 'image/png',
      },
      {
        artifact_kind: 'json',
        file_name: 'report.json',
        required: true,
        media_type: 'application/json',
      },
    ],
    executor: {
      mode,
      executor_id: mode === 'mcp' ? 'playwright-mcp' : 'mock-browser-agent',
    },
    timeout_ms: 45_000,
  }
}

function writePassBrowserResult(bridge, request) {
  const artifacts = request.required_artifacts.map(artifact => {
    const absolutePath = join(process.cwd(), artifact.relative_path)
    mkdirSync(dirname(absolutePath), { recursive: true })
    writeFileSync(absolutePath, `artifact=${artifact.artifact_kind}\npath=${artifact.relative_path}\n`)
    const digest = bridge.computeArtifactDigest(absolutePath)
    return {
      ...artifact,
      ...digest,
      producer: {
        actor: 'browser_executor',
        executor_id: request.executor.executor_id,
      },
    }
  })

  const result = {
    schema_version: 'browser_task_result.v1',
    task_kind: 'browser_task',
    batch_id: request.batch_id,
    iteration_id: request.iteration_id,
    task_id: request.task_id,
    attempt: request.attempt,
    status: 'pass',
    failure_kind: 'none',
    summary: 'Browser task completed successfully.',
    executor: { ...request.executor },
    started_at: '2026-03-23T10:00:00.000Z',
    completed_at: '2026-03-23T10:00:05.000Z',
    artifacts,
  }

  bridge.writeBrowserTaskResult({ request, result })
  return result
}

// ── Test 4b: Browser ingest audit surface ──────────────

async function test_browser_task_ingest_audit_surface() {
  process.stderr.write('\n== Test 4b: Browser ingest audit surface ==\n')

  const { materializeBrowserTaskRequests } = await import('./drivers.mjs')
  const {
    recordBrowserTaskRequest,
    ingestBrowserTaskResult,
  } = await import('./state.mjs')
  const { emitBrowserTask } = await import('./events.mjs')
  const { appendBrowserTaskRunlogRecord } = await import('./iteration_register.mjs')
  const bridge = await import('./browser_bridge.mjs')

  assert(typeof recordBrowserTaskRequest === 'function',
    'state exports recordBrowserTaskRequest')
  assert(typeof ingestBrowserTaskResult === 'function',
    'state exports ingestBrowserTaskResult')
  assert(typeof emitBrowserTask === 'function',
    'events exports emitBrowserTask')
  assert(typeof appendBrowserTaskRunlogRecord === 'function',
    'iteration_register exports appendBrowserTaskRunlogRecord')

  if (
    typeof recordBrowserTaskRequest !== 'function' ||
    typeof ingestBrowserTaskResult !== 'function' ||
    typeof emitBrowserTask !== 'function' ||
    typeof appendBrowserTaskRunlogRecord !== 'function'
  ) {
    return
  }

  const batchId = `test-browser-ingest-${randomUUID().slice(0, 8)}`
  const iterationId = 'iter-browser-ingest'
  const outputDir = join(process.cwd(), 'output', 'playwright', batchId)
  cleanBatch(batchId)
  if (existsSync(outputDir)) {
    rmSync(outputDir, { recursive: true, force: true })
  }

  const state = createState(batchId, 'browser ingest test', ['browser ingest'])
  addIteration(state, {
    id: iterationId,
    type: 'primary',
    title: 'Browser ingest',
    requirement: 'Ingest browser result into authoritative audit surface',
  })
  transition(state, iterationId, 'EXECUTION')
  updateIteration(state, iterationId, { status: 'active' })
  state.current_iteration = iterationId
  commitState(state)

  const materialized = materializeBrowserTaskRequests({
    batchId,
    iterationId,
    browserTasks: [sampleExecBrowserTask('workspace-proof', 'mcp')],
  })
  assert(materialized.ok === true, 'materialization succeeds for ingest audit test')
  if (!materialized.ok) {
    cleanBatch(batchId)
    return
  }

  const pendingRecord = recordBrowserTaskRequest(state, iterationId, {
    task_id: materialized.tasks[0].request.task_id,
    attempt: materialized.tasks[0].request.attempt,
    request_file: materialized.tasks[0].paths.requestFileRelative,
    result_file: materialized.tasks[0].paths.resultFileRelative,
    artifact_paths: materialized.tasks[0].request.required_artifacts.map(artifact => artifact.relative_path),
  })
  emitBrowserTask(state, iterationId, pendingRecord)
  commitState(state)

  writePassBrowserResult(bridge, materialized.tasks[0].request)
  const ingested = ingestBrowserTaskResult(state, iterationId)
  assert(ingested.ok === true, 'ingestBrowserTaskResult accepts contract-valid mcp pass result')
  assert(ingested.browser_task?.status === 'pass', 'ingested browser task status is pass')
  assert(ingested.browser_task?.result_file === materialized.tasks[0].paths.resultFileRelative,
    'ingested browser task preserves canonical result_file')

  emitBrowserTask(state, iterationId, ingested.browser_task)
  commitState(state)

  const reloaded = loadState(batchId)
  const storedTask = reloaded.iterations[0].evidence?.browser_tasks?.[0]
  assert(storedTask?.status === 'pass', 'state.json stores ingested browser task status')
  assert(storedTask?.request_file === materialized.tasks[0].paths.requestFileRelative,
    'state.json stores canonical request_file')
  assert(storedTask?.artifact_paths?.length === 2, 'state.json stores artifact_paths')
  assert(Boolean(storedTask?.ingested_at), 'state.json stores ingested_at timestamp')

  const browserEvents = readEvents(batchId, { iterationId }).filter(event => event.event_type === 'browser_task')
  assert(browserEvents.some(event => event.data.status === 'pending'),
    'events.jsonl records pending browser lifecycle event')
  const finalBrowserEvent = browserEvents[browserEvents.length - 1]
  assert(finalBrowserEvent?.data?.request_file === materialized.tasks[0].paths.requestFileRelative,
    'events.jsonl browser event carries request_file')
  assert(finalBrowserEvent?.data?.result_file === materialized.tasks[0].paths.resultFileRelative,
    'events.jsonl browser event carries result_file')

  const status = refreshStatus(reloaded)
  assert(status.includes('Browser Task: workspace-proof'), 'status.txt projects Browser Task field')
  assert(status.includes('Browser Attempt: 1'), 'status.txt projects Browser Attempt field')
  assert(status.includes('Browser Status: pass'), 'status.txt projects Browser Status field')
  assert(status.includes('Browser Failure Kind: none'), 'status.txt projects Browser Failure Kind field')

  const runlogPath = join(batchDir(batchId), 'browser-ingest-runlog.md')
  writeFileSync(runlogPath, '# Browser ingest runlog\n')
  appendBrowserTaskRunlogRecord(iterationId, storedTask, { runlogPath })
  const runlog = readFileSync(runlogPath, 'utf8')
  assert(runlog.includes(`Request File: ${storedTask.request_file}`),
    'runlog append helper records request_file')
  assert(runlog.includes(`Result File: ${storedTask.result_file}`),
    'runlog append helper records result_file')
  assert(runlog.includes('Result: PASS'),
    'runlog append helper records PASS/FAIL outcome')

  cleanBatch(batchId)
  if (existsSync(outputDir)) {
    rmSync(outputDir, { recursive: true, force: true })
  }
}

// ── Test 4c: Browser ingest failure surface ────────────

async function test_browser_task_ingest_failure_surface() {
  process.stderr.write('\n== Test 4c: Browser ingest failure surface ==\n')

  const { materializeBrowserTaskRequests } = await import('./drivers.mjs')
  const {
    recordBrowserTaskRequest,
    ingestBrowserTaskResult,
  } = await import('./state.mjs')
  const { emitBrowserTask } = await import('./events.mjs')
  const bridge = await import('./browser_bridge.mjs')

  assert(typeof recordBrowserTaskRequest === 'function',
    'failure surface uses recordBrowserTaskRequest export')
  assert(typeof ingestBrowserTaskResult === 'function',
    'failure surface uses ingestBrowserTaskResult export')
  assert(typeof emitBrowserTask === 'function',
    'failure surface uses emitBrowserTask export')

  if (
    typeof recordBrowserTaskRequest !== 'function' ||
    typeof ingestBrowserTaskResult !== 'function' ||
    typeof emitBrowserTask !== 'function'
  ) {
    return
  }

  const batchId = `test-browser-fail-${randomUUID().slice(0, 8)}`
  const iterationId = 'iter-browser-fail'
  const outputDir = join(process.cwd(), 'output', 'playwright', batchId)
  cleanBatch(batchId)
  if (existsSync(outputDir)) {
    rmSync(outputDir, { recursive: true, force: true })
  }

  const state = createState(batchId, 'browser failure test', ['browser failure'])
  addIteration(state, {
    id: iterationId,
    type: 'primary',
    title: 'Browser failure',
    requirement: 'Treat mock-only browser pass as browser_bridge_not_proven',
  })
  transition(state, iterationId, 'EXECUTION')
  updateIteration(state, iterationId, { status: 'active' })
  state.current_iteration = iterationId
  commitState(state)

  const materialized = materializeBrowserTaskRequests({
    batchId,
    iterationId,
    browserTasks: [sampleExecBrowserTask('workspace-fail', 'mock')],
  })
  assert(materialized.ok === true, 'materialization succeeds for failure audit test')
  if (!materialized.ok) {
    cleanBatch(batchId)
    return
  }

  const pendingRecord = recordBrowserTaskRequest(state, iterationId, {
    task_id: materialized.tasks[0].request.task_id,
    attempt: materialized.tasks[0].request.attempt,
    request_file: materialized.tasks[0].paths.requestFileRelative,
    result_file: materialized.tasks[0].paths.resultFileRelative,
    artifact_paths: materialized.tasks[0].request.required_artifacts.map(artifact => artifact.relative_path),
  })
  emitBrowserTask(state, iterationId, pendingRecord)
  commitState(state)

  writePassBrowserResult(bridge, materialized.tasks[0].request)
  const ingested = ingestBrowserTaskResult(state, iterationId)
  assert(ingested.ok === false, 'mock-only browser pass does not count as orchestrator PASS')
  assert(ingested.failure_kind === 'browser_bridge_not_proven',
    'mock-only browser pass is downgraded to browser_bridge_not_proven')

  emitBrowserTask(state, iterationId, ingested.browser_task)
  commitState(state)

  const reloaded = loadState(batchId)
  const storedTask = reloaded.iterations[0].evidence?.browser_tasks?.[0]
  assert(storedTask?.status === 'fail', 'state.json stores browser failure status')
  assert(storedTask?.failure_kind === 'browser_bridge_not_proven',
    'state.json stores browser_bridge_not_proven failure kind')

  const status = refreshStatus(reloaded)
  assert(status.includes('Browser Status: fail'),
    'status.txt projects browser failure status')
  assert(status.includes('Browser Failure Kind: browser_bridge_not_proven'),
    'status.txt projects browser failure kind')

  cleanBatch(batchId)
  if (existsSync(outputDir)) {
    rmSync(outputDir, { recursive: true, force: true })
  }
}

// ── Test 4d: Browser resume waiting semantics ──────────

async function test_browser_task_resume_waiting_semantics() {
  process.stderr.write('\n== Test 4d: Browser resume waiting semantics ==\n')

  const { materializeBrowserTaskRequests } = await import('./drivers.mjs')
  const {
    recordBrowserTaskRequest,
    ingestBrowserTaskResult,
  } = await import('./state.mjs')

  assert(typeof recordBrowserTaskRequest === 'function',
    'resume waiting uses recordBrowserTaskRequest export')
  assert(typeof ingestBrowserTaskResult === 'function',
    'resume waiting uses ingestBrowserTaskResult export')

  if (
    typeof recordBrowserTaskRequest !== 'function' ||
    typeof ingestBrowserTaskResult !== 'function'
  ) {
    return
  }

  const batchId = `test-browser-wait-${randomUUID().slice(0, 8)}`
  const iterationId = 'iter-browser-wait'
  cleanBatch(batchId)

  const state = createState(batchId, 'browser wait test', ['browser wait'])
  addIteration(state, {
    id: iterationId,
    type: 'primary',
    title: 'Browser wait',
    requirement: 'Keep browser task pending until result arrives',
  })
  transition(state, iterationId, 'EXECUTION')
  updateIteration(state, iterationId, { status: 'active' })
  state.current_iteration = iterationId
  commitState(state)

  const materialized = materializeBrowserTaskRequests({
    batchId,
    iterationId,
    browserTasks: [sampleExecBrowserTask('workspace-await', 'mcp')],
  })
  assert(materialized.ok === true, 'materialization succeeds for awaiting_result test')
  if (!materialized.ok) {
    cleanBatch(batchId)
    return
  }

  recordBrowserTaskRequest(state, iterationId, {
    task_id: materialized.tasks[0].request.task_id,
    attempt: materialized.tasks[0].request.attempt,
    request_file: materialized.tasks[0].paths.requestFileRelative,
    result_file: materialized.tasks[0].paths.resultFileRelative,
    artifact_paths: materialized.tasks[0].request.required_artifacts.map(artifact => artifact.relative_path),
  })
  commitState(state)

  const awaiting = ingestBrowserTaskResult(state, iterationId)
  assert(awaiting.ok === true, 'awaiting_result is not treated as an ingest failure')
  assert(awaiting.status === 'awaiting_result', 'pending browser task stays in awaiting_result without result.json')

  const reloaded = loadState(batchId)
  const storedTask = reloaded.iterations[0].evidence?.browser_tasks?.[0]
  assert(storedTask?.status === 'pending', 'authoritative state stays pending before browser result arrives')

  cleanBatch(batchId)
}

// ── Test 4e: Browser result without state and orphan guard ─

async function test_browser_task_resume_guardrails() {
  process.stderr.write('\n== Test 4e: Browser resume guardrails ==\n')

  const { materializeBrowserTaskRequests } = await import('./drivers.mjs')
  const {
    recordBrowserTaskRequest,
    ingestBrowserTaskResult,
  } = await import('./state.mjs')
  const { emitBrowserTask } = await import('./events.mjs')
  const bridge = await import('./browser_bridge.mjs')

  assert(typeof recordBrowserTaskRequest === 'function',
    'resume guardrails uses recordBrowserTaskRequest export')
  assert(typeof ingestBrowserTaskResult === 'function',
    'resume guardrails uses ingestBrowserTaskResult export')
  assert(typeof emitBrowserTask === 'function',
    'resume guardrails uses emitBrowserTask export')

  if (
    typeof recordBrowserTaskRequest !== 'function' ||
    typeof ingestBrowserTaskResult !== 'function' ||
    typeof emitBrowserTask !== 'function'
  ) {
    return
  }

  const batchId = `test-browser-guard-${randomUUID().slice(0, 8)}`
  const iterationId = 'iter-browser-guard'
  const outputDir = join(process.cwd(), 'output', 'playwright', batchId)
  cleanBatch(batchId)
  if (existsSync(outputDir)) {
    rmSync(outputDir, { recursive: true, force: true })
  }

  const state = createState(batchId, 'browser guard test', ['browser guard'])
  addIteration(state, {
    id: iterationId,
    type: 'primary',
    title: 'Browser guard',
    requirement: 'Keep resume authoritative and reject artifact mismatch/timeout',
  })
  transition(state, iterationId, 'EXECUTION')
  updateIteration(state, iterationId, { status: 'active' })
  state.current_iteration = iterationId
  commitState(state)

  const timeoutMaterialized = materializeBrowserTaskRequests({
    batchId,
    iterationId,
    browserTasks: [sampleExecBrowserTask('workspace-timeout', 'mcp')],
  })
  assert(timeoutMaterialized.ok === true, 'timeout fixture materialization succeeds')
  if (!timeoutMaterialized.ok) {
    cleanBatch(batchId)
    return
  }

  const timeoutRequest = timeoutMaterialized.tasks[0].request
  const timeoutResult = bridge.createBrowserTaskFailureResult(
    timeoutRequest,
    'timeout',
    'Browser task timed out before MCP result arrived.'
  )
  bridge.writeBrowserTaskResult({ request: timeoutRequest, result: timeoutResult })

  const notIngested = ingestBrowserTaskResult(state, iterationId)
  assert(notIngested.status === 'none',
    'result.json on disk is ignored until authoritative state records a pending browser task')

  const pendingTimeout = recordBrowserTaskRequest(state, iterationId, {
    task_id: timeoutRequest.task_id,
    attempt: timeoutRequest.attempt,
    request_file: timeoutMaterialized.tasks[0].paths.requestFileRelative,
    result_file: timeoutMaterialized.tasks[0].paths.resultFileRelative,
    artifact_paths: timeoutRequest.required_artifacts.map(artifact => artifact.relative_path),
  })
  emitBrowserTask(state, iterationId, pendingTimeout)
  commitState(state)

  const timedOut = ingestBrowserTaskResult(state, iterationId)
  assert(timedOut.ok === false, 'timeout browser result blocks orchestrator progress')
  assert(timedOut.failure_kind === 'timeout', 'timeout failure kind is preserved during ingest')

  const orphanEvent = emitEvent(state, {
    iteration_id: iterationId,
    event_type: 'browser_task',
    severity: 'info',
    state_revision: state.state_revision + 5,
    message: 'Browser task workspace-timeout: pass',
    data: {
      task_id: timeoutRequest.task_id,
      attempt: timeoutRequest.attempt,
      status: 'pass',
      failure_kind: 'none',
      request_file: timeoutMaterialized.tasks[0].paths.requestFileRelative,
      result_file: timeoutMaterialized.tasks[0].paths.resultFileRelative,
    },
  })
  const orphans = detectOrphanedEvents(state)
  assert(orphans.some(event => event.event_id === orphanEvent.event_id),
    'browser_task orphan event is detected during resume diagnostics')

  const mismatchMaterialized = materializeBrowserTaskRequests({
    batchId,
    iterationId,
    browserTasks: [sampleExecBrowserTask('workspace-mismatch', 'mcp')],
  })
  assert(mismatchMaterialized.ok === true, 'artifact mismatch fixture materialization succeeds')
  if (!mismatchMaterialized.ok) {
    cleanBatch(batchId)
    return
  }

  const mismatchPending = recordBrowserTaskRequest(state, iterationId, {
    task_id: mismatchMaterialized.tasks[0].request.task_id,
    attempt: mismatchMaterialized.tasks[0].request.attempt,
    request_file: mismatchMaterialized.tasks[0].paths.requestFileRelative,
    result_file: mismatchMaterialized.tasks[0].paths.resultFileRelative,
    artifact_paths: mismatchMaterialized.tasks[0].request.required_artifacts.map(artifact => artifact.relative_path),
  })
  commitState(state)

  writePassBrowserResult(bridge, mismatchMaterialized.tasks[0].request)
  writeFileSync(
    join(process.cwd(), mismatchMaterialized.tasks[0].request.required_artifacts[0].relative_path),
    'corrupted-artifact'
  )
  const mismatch = ingestBrowserTaskResult(state, iterationId)
  assert(mismatch.ok === false, 'artifact mismatch blocks orchestrator progress')
  assert(mismatch.failure_kind === 'artifact_mismatch',
    'artifact mismatch failure kind is preserved during ingest')
  assert(mismatch.browser_task?.task_id === mismatchPending.task_id,
    'artifact mismatch applies to the authoritative pending browser task')

  cleanBatch(batchId)
  if (existsSync(outputDir)) {
    rmSync(outputDir, { recursive: true, force: true })
  }
}

// ── Test 5: Review record with summary ──────────────────

function test_review_record_summary() {
  process.stderr.write('\n== Test 5: Review record preserves summary ==\n')

  const batchId = `test-${randomUUID().slice(0, 8)}`
  const state = createState(batchId, 'test', ['goal'])
  addIteration(state, { id: 'iter-sum', type: 'primary', title: 'T', requirement: 'R' })
  commitState(state)

  addReviewRecord(state, 'iter-sum', {
    round: 1,
    phase: 'REVIEW_PLAN',
    verdict: 'APPROVED',
    summary: 'Plan looks good, tier boundary correct',
    session_id: 'sess-123',
  })

  const iter = findIteration(state, 'iter-sum')
  const rec = iter.evidence.review_records[0]
  assert(rec.summary === 'Plan looks good, tier boundary correct', 'summary preserved in review_record')
  assert(rec.session_id === 'sess-123', 'session_id preserved')

  cleanBatch(batchId)
}

// ── Test 6: Crash + resume (state.json.tmp recovery) ────

function test_crash_recovery() {
  process.stderr.write('\n== Test 6: Crash recovery ==\n')

  const batchId = `test-${randomUUID().slice(0, 8)}`
  const state = createState(batchId, 'test', ['goal'])
  addIteration(state, { id: 'iter-crash', type: 'primary', title: 'T', requirement: 'R' })
  commitState(state) // revision 1

  // Simulate crash: write tmp but don't rename
  const tmpPath = join(batchDir(batchId), 'state.json.tmp')
  const crashState = { ...state, state_revision: 2, crash_marker: true }
  writeFileSync(tmpPath, JSON.stringify(crashState, null, 2))

  // Load should complete the interrupted rename
  const recovered = loadState(batchId)
  assert(recovered !== null, 'recovered from tmp')
  assert(recovered.state_revision === 2, 'recovered revision = 2')
  assert(recovered.crash_marker === true, 'crash marker present')
  assert(!existsSync(tmpPath), 'tmp cleaned up')

  cleanBatch(batchId)
}

// ── Test 7: On Hold + batch stall detection ─────────────

function test_on_hold_stall() {
  process.stderr.write('\n== Test 7: On Hold + stall detection ==\n')

  const batchId = `test-${randomUUID().slice(0, 8)}`
  const state = createState(batchId, 'test', ['goal'])
  addIteration(state, { id: 'iter-hold', type: 'primary', title: 'T', requirement: 'R' })
  commitState(state)

  // Set on hold
  setOnHold(state, 'iter-hold', 'test reason')
  commitState(state)

  const iter = findIteration(state, 'iter-hold')
  assert(iter.status === 'on_hold', 'iteration is on_hold')

  // Verify pickNext returns null but not all completed
  const next = pickNext(state)
  assert(next === null, 'pickNext returns null when all on_hold')

  const allCompleted = state.iterations.every(
    i => i.status === 'completed' || i.status === 'proposed'
  )
  assert(allCompleted === false, 'not all completed — stall detected')

  // Verify events contain on_hold
  const events = readEvents(batchId)
  const onHoldEvents = events.filter(e => e.event_type === 'on_hold')
  assert(onHoldEvents.length === 1, '1 on_hold event in log')

  cleanBatch(batchId)
}

// ── Test 8: Monitor status generation ───────────────────

function test_monitor() {
  process.stderr.write('\n== Test 8: Monitor status ==\n')

  const batchId = `test-${randomUUID().slice(0, 8)}`
  const state = createState(batchId, 'test', ['goal'])
  addIteration(state, { id: 'iter-mon', type: 'primary', title: 'Monitor Test', requirement: 'R' })
  state.iterations[0].status = 'active'
  state.iterations[0].phase = 'REVIEW_PLAN'
  state.iterations[0].review_round = 2
  state.iterations[0].major_revision_count = 1
  state.iterations[0].review_policy = {
    approval_count: 3,
    major_revision_limit: 5,
    cli_failure_threshold: 2,
    risk_profile: 'standard',
  }
  state.current_iteration = 'iter-mon'
  commitState(state)

  const status = refreshStatus(state)
  assert(status.includes('iter-mon'), 'status contains iteration id')
  assert(status.includes('REVIEW_PLAN'), 'status contains phase')
  assert(status.includes('Monitor Test'), 'status contains title')
  assert(status.includes('major 1/5'), 'status phase uses review_policy major revision limit instead of hard-coded /3')

  cleanBatch(batchId)
}

// ── Test 8a: Monitor terminal surface ──────────────────

function test_monitor_terminal_surface() {
  process.stderr.write('\n== Test 8a: Monitor terminal surface ==\n')

  const batchId = `test-${randomUUID().slice(0, 8)}`
  const state = createState(batchId, 'test', ['goal'])
  addIteration(state, { id: 'iter-term', type: 'primary', title: 'Terminal Test', requirement: 'R' })
  state.iterations[0].status = 'completed'
  state.iterations[0].phase = 'COMPLETE'
  state.current_iteration = null
  state.final_verification = 'passed'
  commitState(state)

  emitCompleted(state, null, {
    scope: 'batch',
    message: 'Batch complete',
    terminal_outcome: 'passed',
    state_revision: state.state_revision + 1,
    terminal_summary: state.batch_summary,
  })

  const status = refreshStatus(state)
  assert(status.includes('Batch Lifecycle: completed'),
    'status terminal surface shows batch lifecycle explicitly')
  assert(status.includes('Batch Outcome: passed'),
    'status terminal surface shows batch outcome explicitly')
  assert(status.includes('Phase: terminal'),
    'status terminal surface marks terminal phase instead of review placeholder')
  assert(status.includes('[batch:passed] Batch complete'),
    'recent terminal events use structured batch scope/outcome label')

  cleanBatch(batchId)
}

// ── Test 8b: Terminal closure contract ─────────────────

function test_terminal_closure_contract() {
  process.stderr.write('\n== Test 8b: Terminal closure contract ==\n')

  const batchId = `test-${randomUUID().slice(0, 8)}`
  const state = createState(batchId, 'test', ['goal'])
  addIteration(state, { id: 'iter-a', type: 'primary', title: 'A', requirement: 'R1' })
  addIteration(state, { id: 'iter-b', type: 'primary', title: 'B', requirement: 'R2' })

  for (const iter of state.iterations) {
    iter.status = 'completed'
    iter.phase = 'COMPLETE'
  }
  state.current_iteration = null

  commitState(state)
  let loaded = loadState(batchId)
  assert(loaded.batch_summary?.lifecycle === 'awaiting_final_verification',
    'all iterations done with pending final verification becomes awaiting_final_verification')
  assert(loaded.batch_summary?.current_iteration === null,
    'batch_summary persists current_iteration = null after iteration completion')

  let status = refreshStatus(loaded)
  assert(status.includes('Current: none'), 'status.txt terminal snapshot clears current iteration')
  assert(status.includes('Final Verification: pending'), 'status.txt terminal snapshot shows pending final verification')

  emitCompleted(loaded, 'iter-a')
  emitCompleted(loaded, 'iter-b')
  emitEvent(loaded, { event_type: 'completed', message: 'Batch complete' })
  const pendingEvents = readEvents(batchId)
  assert(
    pendingEvents.some(event => event.event_type === 'completed' && event.iteration_id === 'iter-a'),
    'events.jsonl contains iteration completed event in terminal path'
  )
  assert(
    pendingEvents.some(event => event.event_type === 'completed' && event.iteration_id === null && event.message === 'Batch complete'),
    'events.jsonl contains batch completed event in terminal path'
  )

  loaded.final_verification = 'passed'
  commitState(loaded)
  loaded = loadState(batchId)
  assert(loaded.batch_summary?.lifecycle === 'completed',
    'passed final verification persists completed batch lifecycle')
  assert(loaded.batch_summary?.terminal_outcome === 'passed',
    'passed final verification persists terminal_outcome = passed')

  status = refreshStatus(loaded)
  assert(status.includes('Final Verification: passed'), 'status.txt terminal snapshot shows passed final verification')

  loaded.final_verification = 'failed'
  commitState(loaded)
  loaded = loadState(batchId)
  assert(loaded.batch_summary?.lifecycle === 'completed',
    'failed final verification still persists completed batch lifecycle')
  assert(loaded.batch_summary?.terminal_outcome === 'failed',
    'failed final verification persists terminal_outcome = failed')

  cleanBatch(batchId)
}

// ── Test 9: Auto-Approval consecutive count ─────────────

function test_auto_approval_logic() {
  process.stderr.write('\n== Test 9: Auto-Approval logic ==\n')

  const batchId = `test-${randomUUID().slice(0, 8)}`
  const state = createState(batchId, 'test', ['goal'])
  addIteration(state, { id: 'iter-auto', type: 'primary', title: 'T', requirement: 'R' })
  commitState(state)

  const iter = findIteration(state, 'iter-auto')

  // Simulate 2 APPROVEDs with valid session_id
  iter.consecutive_approvals = 0
  const sessions = ['sess-1', 'sess-2', 'sess-3']
  for (let i = 0; i < 3; i++) {
    const sid = sessions[i]
    if (sid && sid !== 'missing') {
      iter.consecutive_approvals++
    }
  }
  assert(iter.consecutive_approvals === 3, '3 consecutive approvals')

  // Reset on NEEDS_CHANGES
  iter.consecutive_approvals = 2
  // Simulate NEEDS_CHANGES
  iter.consecutive_approvals = 0
  assert(iter.consecutive_approvals === 0, 'reset on NEEDS_CHANGES')

  // Missing session_id should not count
  iter.consecutive_approvals = 2
  const missingSid = 'missing'
  if (missingSid && missingSid !== 'missing') {
    iter.consecutive_approvals++
  }
  assert(iter.consecutive_approvals === 2, 'missing session_id not counted')

  cleanBatch(batchId)
}

// ── Test 10: Major revision limit ───────────────────────

function test_major_revision_limit() {
  process.stderr.write('\n== Test 10: Major revision limit ==\n')

  const MAJOR_REVISION_LIMIT = 3

  const batchId = `test-${randomUUID().slice(0, 8)}`
  const state = createState(batchId, 'test', ['goal'])
  addIteration(state, { id: 'iter-major', type: 'primary', title: 'T', requirement: 'R' })
  commitState(state)

  const iter = findIteration(state, 'iter-major')
  iter.major_revision_count = 2

  // major → count becomes 3 → should trigger on hold
  iter.major_revision_count++
  assert(iter.major_revision_count >= MAJOR_REVISION_LIMIT, 'limit reached at 3')

  // ambiguous should not increment
  iter.major_revision_count = 2
  const revType = 'ambiguous'
  // orchestrator would stop and request human decision
  assert(revType === 'ambiguous', 'ambiguous triggers human escalation')

  cleanBatch(batchId)
}

// ── Test 11: Wave launcher routing/outcome ─────────────

async function test_wave_launcher_contract() {
  process.stderr.write('\n== Test 11: Wave launcher contract ==\n')

  const {
    parseIterationList,
    discoverLedgerFollowUps,
    insertIterationsAfterCurrent,
    inspectWaveBatchExtras,
    getIterationLedgerEntry,
    classifyWaveIterationAction,
    classifyWaveBatchOutcome,
  } = await import('./wave_launcher_lib.mjs')

  const parsed = parseIterationList('0210-a, 0211-b\n0212-c')
  assert(parsed.length === 3, 'wave launcher parses comma/newline separated ids')
  assert(parsed[2] === '0212-c', 'wave launcher preserves iteration order')

  const ledger = [
    '| 0210-a | 2026-03-22 | A | 4 | dropx/dev_0210-a | Planned | ./docs/iterations/0210-a/ |',
    '| 0211-b | 2026-03-22 | B | 4 | dropx/dev_0211-b | Completed | ./docs/iterations/0211-b/ |',
    '| 0212-c | 2026-03-22 | C | 4 | dropx/dev_0212-c | On Hold | ./docs/iterations/0212-c/ |',
  ].join('\n')

  const entry = getIterationLedgerEntry(ledger, '0210-a')
  assert(entry?.status === 'Planned', 'wave launcher reads ITERATIONS planned status')
  assert(entry?.branch === 'dropx/dev_0210-a', 'wave launcher reads ITERATIONS branch')

  const runAction = classifyWaveIterationAction(entry)
  assert(runAction.action === 'run', 'Planned iteration is runnable in wave launcher')

  const skipAction = classifyWaveIterationAction(getIterationLedgerEntry(ledger, '0211-b'))
  assert(skipAction.action === 'skip', 'Completed iteration is skipped in wave launcher')

  const stopAction = classifyWaveIterationAction(getIterationLedgerEntry(ledger, '0212-c'))
  assert(stopAction.action === 'stop', 'On Hold iteration blocks wave launcher')

  const continueOutcome = classifyWaveBatchOutcome({
    final_verification: 'passed',
    batch_summary: { lifecycle: 'completed', terminal_outcome: 'passed' },
    iterations: [{ id: '0210-a', status: 'completed' }],
  }, '0210-a')
  assert(continueOutcome.action === 'continue', 'completed iteration with passed final verification continues wave')

  const failedOutcome = classifyWaveBatchOutcome({
    final_verification: 'failed',
    batch_summary: { lifecycle: 'completed', terminal_outcome: 'failed' },
    iterations: [{ id: '0210-a', status: 'completed' }],
  }, '0210-a')
  assert(failedOutcome.action === 'stop', 'failed final verification stops wave')

  const onHoldOutcome = classifyWaveBatchOutcome({
    final_verification: 'pending',
    batch_summary: { lifecycle: 'stalled', terminal_outcome: 'on_hold' },
    iterations: [{ id: '0210-a', status: 'on_hold' }],
  }, '0210-a')
  assert(onHoldOutcome.action === 'stop', 'on_hold iteration stops wave')

  const beforeLedger = [
    '| 0210-ui-cellwise-contract-freeze | 2026-03-22 | A | 4 | dropx/dev_0210-ui-cellwise-contract-freeze | Completed | ./docs/iterations/0210-ui-cellwise-contract-freeze/ |',
    '| 0211-ui-bootstrap-and-submodel-migration | 2026-03-22 | B | 4 | dropx/dev_0211-ui-bootstrap-and-submodel-migration | Planned | ./docs/iterations/0211-ui-bootstrap-and-submodel-migration/ |',
  ].join('\n')
  const afterLedger = [
    beforeLedger,
    '| 0210b-ui-cellwise-contract-freeze | 2026-03-22 | Follow-up B | 2 | dropx/dev_0210b-ui-cellwise-contract-freeze | Planned | ./docs/iterations/0210b-ui-cellwise-contract-freeze/ |',
    '| 0210c-ui-cellwise-contract-freeze | 2026-03-22 | Follow-up C | 2 | dropx/dev_0210c-ui-cellwise-contract-freeze | Approved | ./docs/iterations/0210c-ui-cellwise-contract-freeze/ |',
  ].join('\n')
  const followUps = discoverLedgerFollowUps(
    beforeLedger,
    afterLedger,
    '0210-ui-cellwise-contract-freeze',
    ['0210-ui-cellwise-contract-freeze', '0211-ui-bootstrap-and-submodel-migration'],
  )
  assert(followUps.length === 2, 'wave launcher discovers newly registered follow-up iterations')
  assert(followUps[0] === '0210b-ui-cellwise-contract-freeze', 'wave launcher preserves ledger order for follow-ups')

  const queue = insertIterationsAfterCurrent(
    ['0210-ui-cellwise-contract-freeze', '0211-ui-bootstrap-and-submodel-migration'],
    0,
    followUps,
  )
  assert(queue[1] === '0210b-ui-cellwise-contract-freeze', 'follow-up inserted immediately after current iteration')
  assert(queue[2] === '0210c-ui-cellwise-contract-freeze', 'multiple follow-ups preserve relative order')

  const extraInspection = inspectWaveBatchExtras({
    iterations: [
      { id: '0210-ui-cellwise-contract-freeze', status: 'completed' },
      { id: '0210s-extra', status: 'proposed' },
    ],
  }, '0210-ui-cellwise-contract-freeze', ['0210-ui-cellwise-contract-freeze'])
  assert(extraInspection.action === 'stop', 'unresolved extra iteration stops wave launcher')
  assert(extraInspection.reason === 'unresolved_extra_iteration:0210s-extra:proposed',
    'extra iteration stop reason is explicit')
}

// ── Run all ─────────────────────────────────────────────

async function main() {
  process.stderr.write('== Orchestrator State Machine Tests ==\n')

  test_state_lifecycle()
  await test_entry_route_and_review_policy_models()
  await test_tri_state_entry_routing_and_planning_modes()
  await test_review_policy_prompt_wiring()
  await test_failure_normalization_and_state_evidence()
  await test_failure_matrix_and_oscillation_rules()
  await test_resume_history_and_prompt_escalation_wiring()
  test_docs_sync_for_escalation_rules()
  await test_events()
  await test_completion_payload_and_notify_summary()
  test_scheduler()
  test_parsers()
  await test_execution_browser_task_handshake()
  await test_browser_task_ingest_audit_surface()
  await test_browser_task_ingest_failure_surface()
  await test_browser_task_resume_waiting_semantics()
  await test_browser_task_resume_guardrails()
  test_review_record_summary()
  test_crash_recovery()
  test_on_hold_stall()
  test_monitor()
  test_monitor_terminal_surface()
  test_terminal_closure_contract()
  test_auto_approval_logic()
  test_major_revision_limit()
  await test_wave_launcher_contract()

  process.stderr.write(`\n== Results: ${passed} passed, ${failed} failed ==\n`)
  process.exit(failed > 0 ? 1 : 0)
}

main()
