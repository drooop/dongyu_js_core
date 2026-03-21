const DEFAULT_ESCALATION_POLICY = Object.freeze({
  ambiguous_revision: Object.freeze({
    action: 'human_decision_required',
  }),
  parse_failure: Object.freeze({
    action: 'on_hold_after_threshold',
    threshold_source: 'cli_failure_threshold',
    below_threshold_action: 'retry',
  }),
  max_turns: Object.freeze({
    action: 'on_hold_after_threshold',
    threshold_source: 'cli_failure_threshold',
    below_threshold_action: 'retry',
  }),
  timeout: Object.freeze({
    action: 'on_hold_after_threshold',
    threshold_source: 'cli_failure_threshold',
    below_threshold_action: 'retry',
  }),
  process_error: Object.freeze({
    action: 'on_hold_after_threshold',
    threshold_source: 'cli_failure_threshold',
    below_threshold_action: 'retry',
  }),
  state_doc_inconsistency: Object.freeze({
    action: 'human_decision_required',
  }),
  oscillation: Object.freeze({
    action: 'human_decision_required',
    threshold: 1,
    patterns: [
      'APPROVED>NEEDS_CHANGES>APPROVED',
      'NEEDS_CHANGES>APPROVED>NEEDS_CHANGES',
    ],
  }),
})

const ROUTE_DEFAULTS = Object.freeze({
  new_requirement: {
    approval_count: 3,
    major_revision_limit: 3,
    cli_failure_threshold: 2,
    risk_profile: 'standard',
    escalation_policy: DEFAULT_ESCALATION_POLICY,
  },
  draft_iteration: {
    approval_count: 3,
    major_revision_limit: 3,
    cli_failure_threshold: 2,
    risk_profile: 'contract_recovery',
    escalation_policy: DEFAULT_ESCALATION_POLICY,
  },
  executable_iteration: {
    approval_count: 3,
    major_revision_limit: 3,
    cli_failure_threshold: 2,
    risk_profile: 'delivery',
    escalation_policy: DEFAULT_ESCALATION_POLICY,
  },
})

export function buildReviewPolicy({ entry_route, overrides = {} } = {}) {
  const routeDefaults = ROUTE_DEFAULTS[entry_route] || ROUTE_DEFAULTS.new_requirement
  const escalationPolicy = {}

  for (const [key, value] of Object.entries(routeDefaults.escalation_policy || {})) {
    escalationPolicy[key] = { ...value }
  }

  for (const [key, value] of Object.entries(overrides.escalation_policy || {})) {
    escalationPolicy[key] = {
      ...(escalationPolicy[key] || {}),
      ...value,
    }
  }

  return {
    approval_count: overrides.approval_count ?? routeDefaults.approval_count,
    major_revision_limit: overrides.major_revision_limit ?? routeDefaults.major_revision_limit,
    cli_failure_threshold: overrides.cli_failure_threshold ?? routeDefaults.cli_failure_threshold,
    risk_profile: overrides.risk_profile ?? routeDefaults.risk_profile,
    escalation_policy: escalationPolicy,
  }
}

export function resolveReviewPolicy({ entry_route, review_policy, risk_profile } = {}) {
  const merged = buildReviewPolicy({
    entry_route,
    overrides: review_policy || {},
  })

  if (risk_profile && !review_policy?.risk_profile) {
    merged.risk_profile = risk_profile
  }

  return merged
}

export function resolveEscalationAction(reviewPolicy, key) {
  const aliasKey = key === 'cli_failure' ? 'parse_failure' : key
  const policyEntry = reviewPolicy?.escalation_policy?.[aliasKey]
    ?? DEFAULT_ESCALATION_POLICY[aliasKey]
    ?? null

  if (typeof policyEntry === 'string') {
    return policyEntry
  }

  return policyEntry?.action ?? null
}

export {
  DEFAULT_ESCALATION_POLICY,
  ROUTE_DEFAULTS,
}
