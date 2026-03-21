/**
 * notify.mjs — Notification system (§10 + §2.5)
 *
 * Notifications are best-effort. Failures:
 * - Do NOT rollback state.json
 * - Do NOT retry
 * - Write an error event to events.jsonl
 * - Must be wrapped in try-catch (exceptions must not propagate to main loop)
 */

import { execSync } from 'child_process'
import { emitEvent } from './events.mjs'

// ── Main notify ─────────────────────────────────────────

export function notify(state, event, detail) {
  try {
    notifyMacOS(event, detail)
  } catch (err) {
    // §2.5: failure writes event, does not rollback state
    try {
      emitEvent(state, {
        event_type: 'error',
        severity: 'warn',
        message: `Notification failed: ${err.message}`,
        data: { original_event: event, error: err.message },
      })
    } catch {
      // Last resort: stderr
      process.stderr.write(`[notify] Failed to send notification: ${err.message}\n`)
    }
  }
}

// ── macOS notification ──────────────────────────────────

function notifyMacOS(event, detail) {
  const titles = {
    iteration_complete: 'Iteration Complete',
    iteration_on_hold: 'Iteration On Hold — Human Required',
    spawn_created: 'New Iteration Spawned',
    batch_complete: 'Batch Complete',
    final_verification: 'Final Verification Result',
    cli_error: 'CLI Error',
    scope_expansion_proposed: 'Scope Expansion Proposed — Confirm Required',
  }

  const title = titles[event] || 'Orchestrator'
  const message = typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 200)

  // Escape for AppleScript
  const safeTitle = title.replace(/"/g, '\\"')
  const safeMessage = message.replace(/"/g, '\\"')

  execSync(
    `osascript -e 'display notification "${safeMessage}" with title "${safeTitle}"'`,
    { timeout: 5000 }
  )
}

// ── Webhook (v1: interface only, not implemented) ───────

// eslint-disable-next-line no-unused-vars
function notifyWebhook(webhookUrl, event, detail) {
  // v1: reserved interface. Implementation deferred.
  // When implemented:
  // fetch(webhookUrl, { method: 'POST', headers: {'Content-Type': 'application/json'},
  //   body: JSON.stringify({ event, detail, timestamp: new Date().toISOString() })
  // }).catch(() => {})
}

// ── Convenience ─────────────────────────────────────────

export function notifyIterationComplete(state, iterationId) {
  const iter = state.iterations.find(i => i.id === iterationId)
  notify(state, 'iteration_complete', `${iterationId}: ${iter?.spec?.title || ''}`)
}

export function notifyOnHold(state, iterationId, reason) {
  notify(state, 'iteration_on_hold', `${iterationId} on hold: ${reason}`)
}

export function notifySpawn(state, spawnId, spawnType) {
  notify(state, 'spawn_created', `${spawnId} (${spawnType})`)
}

export function notifyBatchComplete(state) {
  const done = state.iterations.filter(i => i.status === 'completed').length
  notify(state, 'batch_complete', `${done}/${state.iterations.length} iterations completed`)
}

export function notifyFinalVerification(state, allMet) {
  notify(state, 'final_verification', allMet ? 'All goals met' : 'Some goals NOT met — check results')
}

export function notifyScopeExpansion(state, spawnTitle) {
  notify(state, 'scope_expansion_proposed', `Proposed: ${spawnTitle}. Confirm to proceed.`)
}
