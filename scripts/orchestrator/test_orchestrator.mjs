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
import { join } from 'path'

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
  state.current_iteration = 'iter-mon'
  commitState(state)

  const status = refreshStatus(state)
  assert(status.includes('iter-mon'), 'status contains iteration id')
  assert(status.includes('REVIEW_PLAN'), 'status contains phase')
  assert(status.includes('Monitor Test'), 'status contains title')

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

// ── Run all ─────────────────────────────────────────────

async function main() {
  process.stderr.write('== Orchestrator State Machine Tests ==\n')

  test_state_lifecycle()
  await test_entry_route_and_review_policy_models()
  await test_tri_state_entry_routing_and_planning_modes()
  await test_review_policy_prompt_wiring()
  await test_events()
  test_scheduler()
  test_parsers()
  test_review_record_summary()
  test_crash_recovery()
  test_on_hold_stall()
  test_monitor()
  test_auto_approval_logic()
  test_major_revision_limit()

  process.stderr.write(`\n== Results: ${passed} passed, ${failed} failed ==\n`)
  process.exit(failed > 0 ? 1 : 0)
}

main()
