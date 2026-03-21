/**
 * events.mjs — Event log management (§9)
 *
 * events.jsonl is append-only. Each event carries state_revision.
 * Orphaned events (revision > state.state_revision) are detected on recovery.
 *
 * Write order (§2.4): event append → state commit → status refresh → notify
 */

import { appendFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { batchDir } from './state.mjs'

const SCHEMA_VERSION = 1

// ── Emit ────────────────────────────────────────────────

export function emitEvent(state, event) {
  const entry = {
    schema_version: SCHEMA_VERSION,
    batch_id: state.batch_id,
    event_id: randomUUID(),
    state_revision: typeof event.state_revision === 'number'
      ? event.state_revision
      : state.state_revision,
    timestamp: new Date().toISOString(),
    iteration_id: event.iteration_id || null,
    parent_iteration: event.parent_iteration || null,
    phase: event.phase || null,
    actor: event.actor || 'orchestrator',
    event_type: event.event_type,
    severity: event.severity || 'info',
    message: event.message,
    data: event.data || {},
  }

  // 1. Append to events.jsonl
  const eventsFile = eventsPath(state.batch_id)
  appendFileSync(eventsFile, JSON.stringify(entry) + '\n')

  // 2. stderr real-time output
  const icon = {
    transition: '→',
    review: '⟳',
    spawn: '+',
    blocked: '⊘',
    on_hold: '⊘',
    completed: '✓',
    error: '✗',
    notify: '◆',
  }[entry.event_type] || '·'

  const ts = entry.timestamp.slice(11, 19)
  const iterId = entry.iteration_id ? `[${entry.iteration_id}]` : '[batch]'
  process.stderr.write(`${ts} ${icon} ${iterId} ${entry.message}\n`)

  return entry
}

// ── Read ────────────────────────────────────────────────

export function readEvents(batchId, opts = {}) {
  const file = eventsPath(batchId)
  if (!existsSync(file)) return []

  const lines = readFileSync(file, 'utf-8').trim().split('\n').filter(Boolean)
  let events = lines.map(line => {
    try { return JSON.parse(line) }
    catch { return null }
  }).filter(Boolean)

  // Filter by iteration
  if (opts.iterationId) {
    events = events.filter(e => e.iteration_id === opts.iterationId)
  }

  // Tail N
  if (opts.tail && opts.tail > 0) {
    events = events.slice(-opts.tail)
  }

  return events
}

// ── Orphan detection (§2.4) ─────────────────────────────

export function detectOrphanedEvents(state) {
  const events = readEvents(state.batch_id)
  return events.filter(e => e.state_revision > state.state_revision)
}

export function markOrphaned(batchId, orphanedEvents) {
  // Rewrite events.jsonl marking orphans
  // In practice, we just log a warning — rewriting is expensive and risky
  for (const e of orphanedEvents) {
    emitEvent(
      { batch_id: batchId, state_revision: 0 },
      {
        event_type: 'error',
        severity: 'warn',
        message: `Orphaned event detected: ${e.event_id} (revision ${e.state_revision})`,
        data: { orphaned_event_id: e.event_id },
      }
    )
  }
}

// ── Convenience emitters ────────────────────────────────

export function emitTransition(state, iterationId, fromPhase, toPhase) {
  return emitEvent(state, {
    iteration_id: iterationId,
    phase: toPhase,
    event_type: 'transition',
    severity: 'info',
    message: `${fromPhase} → ${toPhase}`,
  })
}

export function emitReview(state, iterationId, phase, verdict, round) {
  return emitEvent(state, {
    iteration_id: iterationId,
    phase,
    event_type: 'review',
    severity: verdict === 'APPROVED' ? 'info' : 'warn',
    message: `Review round ${round}: ${verdict}`,
    data: { verdict, round },
  })
}

export function emitSpawn(state, parentId, spawnId, spawnType) {
  return emitEvent(state, {
    iteration_id: spawnId,
    parent_iteration: parentId,
    event_type: 'spawn',
    severity: 'warn',
    message: `Spawned ${spawnType} from ${parentId}: ${spawnId}`,
    data: { parent: parentId, spawn_type: spawnType },
  })
}

export function emitBlocked(state, iterationId, reason) {
  return emitEvent(state, {
    iteration_id: iterationId,
    event_type: 'blocked',
    severity: 'warn',
    message: `Blocked: ${reason}`,
  })
}

export function emitOnHold(state, iterationId, reason) {
  return emitEvent(state, {
    iteration_id: iterationId,
    event_type: 'on_hold',
    severity: 'error',
    message: `On Hold: ${reason}`,
  })
}

export function emitCompleted(state, iterationId, details = {}) {
  const scope = details.scope || (iterationId ? 'iteration' : 'batch')
  const message = details.message || (scope === 'batch' ? 'Batch complete' : 'Completed')
  return emitEvent(state, {
    iteration_id: iterationId,
    state_revision: details.state_revision,
    event_type: 'completed',
    severity: 'info',
    message,
    data: {
      scope,
      terminal_outcome: details.terminal_outcome || null,
      terminal_summary: details.terminal_summary || null,
      state_revision: details.state_revision ?? state.state_revision,
      ...(details.data || {}),
    },
  })
}

export function emitError(state, iterationId, error) {
  return emitEvent(state, {
    iteration_id: iterationId,
    event_type: 'error',
    severity: 'error',
    message: `Error: ${error}`,
  })
}

// ── Path ────────────────────────────────────────────────

function eventsPath(batchId) {
  return join(batchDir(batchId), 'events.jsonl')
}
