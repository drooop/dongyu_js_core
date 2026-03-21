const FAILURE_KINDS = Object.freeze([
  'max_turns',
  'timeout',
  'process_error',
  'json_parse_error',
])

const POLICY_KIND_ALIASES = Object.freeze({
  json_parse_error: 'parse_failure',
  cli_failure: 'parse_failure',
})

const TRANSPORT_ERROR_PATTERN = /\b(EPIPE|ECONNRESET|ECONNREFUSED|ENOTFOUND|ENOTCONN|EAI_AGAIN)\b/i

function coerceMessage(raw = {}) {
  return [
    raw.error,
    raw.stderr,
    raw.stdout,
    raw.raw,
  ]
    .filter(value => typeof value === 'string' && value.trim())
    .join('\n')
}

function inferFailureKind(raw = {}) {
  if (FAILURE_KINDS.includes(raw.kind)) {
    return raw.kind
  }

  if (
    raw.error_type === 'max_turns' ||
    raw.stop_reason === 'tool_use' ||
    raw.stop_reason === 'error_max_turns'
  ) {
    return 'max_turns'
  }

  if (
    raw.stage === 'json_parse' ||
    /parse\s+claude\s+code\s+json\s+output/i.test(raw.error || '')
  ) {
    return 'json_parse_error'
  }

  if (
    raw.code === 'ETIMEDOUT' ||
    raw.timed_out === true ||
    /ETIMEDOUT|timed?\s*out/i.test(coerceMessage(raw))
  ) {
    return 'timeout'
  }

  return 'process_error'
}

function inferReason(raw = {}) {
  const message = coerceMessage(raw)
  if (TRANSPORT_ERROR_PATTERN.test(message)) {
    return 'transport_process_error'
  }
  if (raw.stage === 'json_parse') {
    return 'invalid_json_payload'
  }
  if (raw.error_type === 'max_turns' || raw.stop_reason === 'error_max_turns') {
    return 'turn_budget_exhausted'
  }
  if (raw.stop_reason === 'tool_use') {
    return 'tool_loop_exhausted'
  }
  if (raw.code === 'ETIMEDOUT' || /ETIMEDOUT|timed?\s*out/i.test(message)) {
    return 'command_timeout'
  }
  return raw.reason || 'generic_process_error'
}

export function normalizeFailureSignal(raw = {}) {
  const message = coerceMessage(raw) || 'Unknown CLI failure'
  const kind = inferFailureKind(raw)

  return {
    kind,
    source: raw.source || 'unknown',
    operation: raw.operation || null,
    phase: raw.phase || null,
    reason: inferReason(raw),
    message,
    retryable: kind !== 'json_parse_error',
    timestamp: raw.timestamp || new Date().toISOString(),
    details: {
      code: raw.code || null,
      error_type: raw.error_type || null,
      stop_reason: raw.stop_reason || null,
      num_turns: raw.num_turns ?? null,
      transport_related: TRANSPORT_ERROR_PATTERN.test(message),
    },
  }
}

function toPolicyFailureKind(input) {
  const kind = typeof input === 'string' ? input : input?.kind
  if (!kind) {
    return 'process_error'
  }
  return POLICY_KIND_ALIASES[kind] || kind
}

function toHistoryKind(entry) {
  return toPolicyFailureKind(
    typeof entry === 'string'
      ? entry
      : entry?.normalized_failure_kind || entry?.kind || entry?.failure_kind
  )
}

function resolvePolicyEntry(reviewPolicy = {}, failureKind) {
  return reviewPolicy?.escalation_policy?.[failureKind] || null
}

function resolveThreshold(policyEntry = {}, reviewPolicy = {}) {
  if (typeof policyEntry.threshold === 'number') {
    return policyEntry.threshold
  }

  if (
    policyEntry.threshold_source &&
    typeof reviewPolicy?.[policyEntry.threshold_source] === 'number'
  ) {
    return reviewPolicy[policyEntry.threshold_source]
  }

  return 1
}

export function detectReviewOscillation(recentReviewHistory = [], reviewPolicy = {}) {
  const policyEntry = resolvePolicyEntry(reviewPolicy, 'oscillation') || {}
  const threshold = resolveThreshold(policyEntry, reviewPolicy)
  const patterns = policyEntry.patterns || []
  const verdicts = recentReviewHistory
    .map(entry => typeof entry === 'string' ? entry : entry?.verdict)
    .filter(Boolean)

  let matchedPattern = null
  let hitCount = 0

  for (let index = 0; index <= verdicts.length - 3; index++) {
    const window = verdicts.slice(index, index + 3).join('>')
    if (patterns.includes(window)) {
      matchedPattern = window
      hitCount++
    }
  }

  return {
    detected: hitCount >= threshold,
    pattern: matchedPattern,
    threshold,
    hit_count: hitCount,
  }
}

export function resolveEscalationDecision({
  phase = null,
  failure = null,
  recent_failure_history = [],
  recent_review_history = [],
  risk_profile = null,
  review_policy = {},
} = {}) {
  const normalizedFailureKind = toPolicyFailureKind(failure)
  const policyEntry = resolvePolicyEntry(review_policy, normalizedFailureKind) || {}
  const threshold = resolveThreshold(policyEntry, review_policy)

  let triggerReason = `policy:${normalizedFailureKind}`
  let thresholdReached = true
  let failureCount = 1

  if (normalizedFailureKind === 'oscillation') {
    const oscillation = detectReviewOscillation(recent_review_history, review_policy)
    thresholdReached = oscillation.detected
    failureCount = oscillation.hit_count
    triggerReason = oscillation.pattern
      ? `oscillation:${oscillation.pattern}`
      : 'oscillation:not_detected'

    return {
      phase,
      risk_profile,
      normalized_failure_kind: normalizedFailureKind,
      action: policyEntry.action || 'human_decision_required',
      trigger_reason: triggerReason,
      threshold_reached: thresholdReached,
      threshold,
      failure_count: failureCount,
    }
  }

  const historyCount = recent_failure_history
    .map(entry => toHistoryKind(entry))
    .filter(kind => kind === normalizedFailureKind)
    .length
  failureCount = historyCount + 1

  if (policyEntry.action === 'on_hold_after_threshold') {
    thresholdReached = failureCount >= threshold
  } else if (typeof policyEntry.threshold === 'number') {
    thresholdReached = failureCount >= threshold
  }

  if (policyEntry.action === 'on_hold_after_threshold') {
    triggerReason = `${normalizedFailureKind}:${failureCount}/${threshold}`
  }

  let action
  switch (policyEntry.action) {
    case 'on_hold_after_threshold':
      action = thresholdReached
        ? 'on_hold'
        : (policyEntry.below_threshold_action || 'retry')
      break
    case 'warn_and_continue':
    case 'human_decision_required':
    case 'on_hold':
    case 'retry':
    case 'continue':
      action = policyEntry.action
      break
    default:
      action = thresholdReached ? 'on_hold' : 'retry'
      break
  }

  return {
    phase,
    risk_profile,
    normalized_failure_kind: normalizedFailureKind,
    action,
    trigger_reason: triggerReason,
    threshold_reached: thresholdReached,
    threshold,
    failure_count: failureCount,
  }
}

export {
  FAILURE_KINDS,
}
