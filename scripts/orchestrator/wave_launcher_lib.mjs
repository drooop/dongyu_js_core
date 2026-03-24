/**
 * wave_launcher_lib.mjs — Helpers for serialized multi-iteration wave execution.
 */

export function parseIterationList(input = '') {
  return String(input)
    .split(/[\s,]+/)
    .map(s => s.trim())
    .filter(Boolean)
}

export function listLedgerIterationIds(iterationsContent) {
  return String(iterationsContent)
    .split('\n')
    .map(line => line.match(/^\|\s*([0-9]{4}[a-z]?-[^|]+?)\s*\|/i)?.[1]?.trim())
    .filter(Boolean)
}

export function getIterationLedgerEntry(iterationsContent, iterationId) {
  const lines = String(iterationsContent).split('\n')
  const escaped = iterationId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`^\\|\\s*${escaped}\\s*\\|`)

  for (const line of lines) {
    if (!pattern.test(line)) continue
    const parts = line.split('|')
    if (parts.length < 8) continue
    return {
      id: parts[1].trim(),
      date: parts[2].trim(),
      theme: parts[3].trim(),
      steps: parts[4].trim(),
      branch: parts[5].trim(),
      status: parts[6].trim(),
      path: parts[7].trim(),
    }
  }

  return null
}

function getNumericStem(iterationId) {
  return String(iterationId).match(/^(\d{4})/)?.[1] || null
}

export function isWaveFollowUpIteration(anchorIterationId, candidateIterationId) {
  const stem = getNumericStem(anchorIterationId)
  if (!stem || !candidateIterationId || candidateIterationId === anchorIterationId) {
    return false
  }
  return new RegExp(`^${stem}[a-z]-`, 'i').test(candidateIterationId)
}

export function discoverLedgerFollowUps(beforeContent, afterContent, anchorIterationId, knownIds = []) {
  const before = new Set(listLedgerIterationIds(beforeContent))
  const known = new Set(knownIds)

  return listLedgerIterationIds(afterContent).filter(iterationId => {
    if (before.has(iterationId)) return false
    if (known.has(iterationId)) return false
    return isWaveFollowUpIteration(anchorIterationId, iterationId)
  })
}

export function insertIterationsAfterCurrent(queue, currentIndex, additions = []) {
  if (!Array.isArray(additions) || additions.length === 0) {
    return [...queue]
  }

  const nextQueue = [...queue]
  nextQueue.splice(currentIndex + 1, 0, ...additions)
  return nextQueue
}

export function classifyWaveIterationAction(entry) {
  if (!entry) {
    return { action: 'stop', reason: 'missing_iteration_in_ledger' }
  }

  switch (entry.status) {
    case 'Planned':
    case 'Approved':
      return { action: 'run', reason: 'runnable' }
    case 'Completed':
      return { action: 'skip', reason: 'already_completed' }
    case 'In Progress':
      return { action: 'stop', reason: 'requires_resume' }
    case 'On Hold':
      return { action: 'stop', reason: 'requires_human_decision' }
    case 'Cancelled':
      return { action: 'stop', reason: 'cancelled_iteration' }
    default:
      return { action: 'stop', reason: `unsupported_status:${entry.status}` }
  }
}

export function classifyWaveBatchOutcome(state, iterationId) {
  if (!state || !Array.isArray(state.iterations)) {
    return { action: 'stop', reason: 'missing_batch_state' }
  }

  const iter = state.iterations.find(item => item.id === iterationId)
  if (!iter) {
    return { action: 'stop', reason: 'missing_iteration_in_batch' }
  }

  const batchSummary = state.batch_summary
  if (!batchSummary || typeof batchSummary !== 'object') {
    return { action: 'stop', reason: 'missing_batch_summary' }
  }

  const authoritativeFinalVerification = batchSummary.final_verification || null
  if (
    authoritativeFinalVerification &&
    state.final_verification &&
    authoritativeFinalVerification !== state.final_verification
  ) {
    return {
      action: 'stop',
      reason: `final_verification_summary_drift:${state.final_verification}:${authoritativeFinalVerification}`,
    }
  }

  if (
    iter.status === 'completed' &&
    batchSummary.lifecycle === 'completed' &&
    batchSummary.terminal_outcome === 'passed'
  ) {
    return { action: 'continue', reason: 'completed_and_verified' }
  }

  if (
    iter.status === 'completed' &&
    batchSummary.lifecycle === 'completed' &&
    batchSummary.terminal_outcome === 'failed'
  ) {
    return { action: 'stop', reason: 'final_verification_failed' }
  }

  if (iter.status === 'on_hold') {
    return { action: 'stop', reason: 'iteration_on_hold' }
  }

  if (batchSummary.lifecycle === 'stalled') {
    return { action: 'stop', reason: `batch_stalled:${batchSummary.terminal_outcome || 'unknown'}` }
  }

  return {
    action: 'stop',
    reason: `unexpected_terminal_state:${iter.status}:${batchSummary.lifecycle}:${batchSummary.terminal_outcome || authoritativeFinalVerification || 'pending'}`,
  }
}

export function inspectWaveBatchExtras(state, currentIterationId, knownIds = []) {
  if (!state || !Array.isArray(state.iterations)) {
    return { action: 'none', extras: [] }
  }

  const known = new Set(knownIds)
  const extras = state.iterations.filter(iter => (
    iter.id !== currentIterationId &&
    !known.has(iter.id)
  ))

  if (extras.length === 0) {
    return { action: 'none', extras: [] }
  }

  const unresolved = extras.find(iter => iter.status !== 'completed')
  if (unresolved) {
    return {
      action: 'stop',
      reason: `unresolved_extra_iteration:${unresolved.id}:${unresolved.status}`,
      extras,
    }
  }

  return { action: 'note', reason: 'completed_extra_iterations', extras }
}

export function buildWaveIterationPrompt(wavePrompt, iterationId, index, total) {
  return [
    String(wavePrompt || '').trim(),
    '',
    'Wave execution context:',
    `- Current iteration: ${iterationId}`,
    `- Sequence: ${index}/${total}`,
    '- This run is launched by the serialized wave launcher.',
    '- Only complete the current iteration; do not proactively open the next one.',
    '- If this iteration finishes Completed with deterministic evidence, control returns to the launcher.',
  ].join('\n')
}
