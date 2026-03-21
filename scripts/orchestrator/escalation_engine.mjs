const FAILURE_KINDS = Object.freeze([
  'max_turns',
  'timeout',
  'process_error',
  'json_parse_error',
])

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

export {
  FAILURE_KINDS,
}
