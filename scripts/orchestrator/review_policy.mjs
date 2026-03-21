const DEFAULT_ESCALATION_POLICY = Object.freeze({
  ambiguous_revision: 'human_decision_required',
  cli_failure: 'on_hold_after_threshold',
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
  return {
    approval_count: overrides.approval_count ?? routeDefaults.approval_count,
    major_revision_limit: overrides.major_revision_limit ?? routeDefaults.major_revision_limit,
    cli_failure_threshold: overrides.cli_failure_threshold ?? routeDefaults.cli_failure_threshold,
    risk_profile: overrides.risk_profile ?? routeDefaults.risk_profile,
    escalation_policy: {
      ...routeDefaults.escalation_policy,
      ...(overrides.escalation_policy || {}),
    },
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
  return reviewPolicy?.escalation_policy?.[key]
    ?? DEFAULT_ESCALATION_POLICY[key]
    ?? null
}

export {
  DEFAULT_ESCALATION_POLICY,
  ROUTE_DEFAULTS,
}
