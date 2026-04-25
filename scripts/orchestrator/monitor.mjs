/**
 * monitor.mjs — Three-layer monitoring (§15)
 *
 * Layer 1: stderr real-time stream (handled by events.mjs emitEvent)
 * Layer 2: status.txt dashboard (refreshStatus)
 * Layer 3: events.jsonl audit log (handled by events.mjs)
 */

import { writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { batchDir } from './state.mjs'
import { readEvents, eventIcon, eventScopeLabel } from './events.mjs'

// ── Refresh status.txt ─────────────────────────────────

export function refreshStatus(state) {
  const batchSummary = state.batch_summary || {
    lifecycle: 'running',
    terminal_outcome: null,
    final_verification: state.final_verification,
    counts: {},
  }
  const completed = state.iterations.filter(i => i.status === 'completed').length
  const active = state.iterations.filter(i => i.status === 'active').length
  const pending = state.iterations.filter(i => i.status === 'pending').length
  const onHold = state.iterations.filter(i => i.status === 'on_hold').length
  const primary = state.iterations.filter(i => i.type === 'primary').length
  const spawned = state.iterations.filter(i => i.type === 'spawned').length
  const current = state.iterations.find(i => i.status === 'active')
  const browserTask = current?.evidence?.browser_tasks?.find(task => task.status === 'pending')
    || current?.evidence?.browser_tasks?.[current?.evidence?.browser_tasks?.length - 1]
    || null
  const opsTask = current?.evidence?.ops_tasks?.find(task => task.status === 'pending')
    || current?.evidence?.ops_tasks?.[current?.evidence?.ops_tasks?.length - 1]
    || null
  const majorRevisionLimit = current?.review_policy?.major_revision_limit
    || state.review_policy?.major_revision_limit
    || 3
  const phaseLine = current
    ? `${current.phase} (review round ${current.review_round}, major ${current.major_revision_count}/${majorRevisionLimit})`
    : batchSummary.lifecycle === 'completed'
      ? 'terminal'
      : batchSummary.lifecycle
  const batchOutcome = batchSummary.terminal_outcome || '-'

  const recentEvents = readEvents(state.batch_id, { tail: 8 })
  const recentLines = recentEvents
    .map(e => {
      const ts = e.timestamp.slice(11, 19)
      return `  ${ts} ${eventIcon(e.event_type)} ${eventScopeLabel(e)} ${e.message}`
    })
    .join('\n')

  const elapsed = formatDuration(state.created_at)

  const status = [
    `== Orchestrator Status ==`,
    `Batch: ${state.batch_id.slice(0, 8)}`,
    `Total: ${state.iterations.length} (${primary} primary + ${spawned} spawned)`,
    `Done: ${completed}  Active: ${active}  Pending: ${pending}  On Hold: ${onHold}`,
    `Batch Lifecycle: ${batchSummary.lifecycle}`,
    `Batch Outcome: ${batchOutcome}`,
    ``,
    `Current: ${current ? `[${current.id}] ${current.spec.title}` : 'none'}`,
    `Phase: ${phaseLine}`,
    `Browser Task: ${browserTask?.task_id || '-'}`,
    `Browser Attempt: ${browserTask ? browserTask.attempt : '-'}`,
    `Browser Status: ${browserTask?.status || '-'}`,
    `Browser Failure Kind: ${browserTask?.failure_kind || '-'}`,
    `Ops Task: ${opsTask?.task_id || '-'}`,
    `Ops Attempt: ${opsTask ? opsTask.attempt : '-'}`,
    `Ops Status: ${opsTask?.status || '-'}`,
    `Ops Failure Kind: ${opsTask?.failure_kind || '-'}`,
    `Ops Exit Code: ${opsTask && Number.isInteger(opsTask.exit_code) ? opsTask.exit_code : '-'}`,
    `Elapsed: ${elapsed}`,
    ``,
    `Recent:`,
    recentLines || '  (no events yet)',
    ``,
    `Final Verification: ${state.final_verification}`,
    `State Revision: ${state.state_revision}`,
  ].join('\n')

  const statusFile = join(batchDir(state.batch_id), 'status.txt')
  writeFileSync(statusFile, status)

  return status
}

// ── --monitor subcommand ────────────────────────────────

export async function runMonitor(batchId) {
  const dir = batchDir(batchId)
  const statusFile = join(dir, 'status.txt')

  process.stderr.write(`Monitoring batch ${batchId}... (Ctrl+C to stop)\n\n`)

  while (true) {
    // Clear screen without depending on `watch`
    process.stdout.write('\x1B[2J\x1B[0;0H')

    if (existsSync(statusFile)) {
      const content = readFileSync(statusFile, 'utf-8')
      process.stdout.write(content + '\n')
    } else {
      process.stdout.write(`Waiting for batch ${batchId} to start...\n`)
    }

    // Tail last 5 events
    const events = readEvents(batchId, { tail: 5 })
    if (events.length > 0) {
      process.stdout.write('\n-- Latest Events --\n')
      for (const e of events) {
        const ts = e.timestamp.slice(11, 19)
        process.stdout.write(`  ${ts} ${eventIcon(e.event_type)} ${eventScopeLabel(e)} ${e.message}\n`)
      }
    }

    await sleep(2000)
  }
}

// ── Helpers ─────────────────────────────────────────────

function formatDuration(startIso) {
  const start = new Date(startIso)
  const now = new Date()
  const diff = Math.floor((now - start) / 1000)
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  const s = diff % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
