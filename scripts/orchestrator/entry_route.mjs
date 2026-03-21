const ROUTE_KINDS = Object.freeze([
  'new_requirement',
  'draft_iteration',
  'executable_iteration',
])

const TERMINAL_ITERATION_STATUSES = new Set([
  'Completed',
  'On Hold',
  'Cancelled',
])

const SCAFFOLD_PATTERNS = [
  /\(to be filled by Codex during PLANNING phase\)/i,
  /\(to be filled during execution\)/i,
  /\(to be filled during planning\)/i,
]

export function hasScaffoldPlaceholder(content) {
  if (typeof content !== 'string' || content.trim() === '') {
    return false
  }
  return SCAFFOLD_PATTERNS.some(pattern => pattern.test(content))
}

export function classifyEntryRoute(input = {}) {
  const entrySource = input.entry_source || null
  if (entrySource === 'prompt' || entrySource === 'prompt_file') {
    return {
      entry_source: entrySource,
      route_kind: 'new_requirement',
      is_blocked: false,
      reason: 'cli_prompt_entry',
    }
  }

  const iterationStatus = input.iteration_status || 'Planned'
  const hasPlan = Boolean(input.has_plan)
  const hasResolution = Boolean(input.has_resolution)
  const planIsScaffold = Boolean(input.plan_is_scaffold)
  const resolutionIsScaffold = Boolean(input.resolution_is_scaffold)

  if (TERMINAL_ITERATION_STATUSES.has(iterationStatus)) {
    return {
      entry_source: entrySource,
      route_kind: null,
      is_blocked: true,
      reason: `terminal_iteration_status:${iterationStatus}`,
    }
  }

  if (!hasPlan || !hasResolution || planIsScaffold || resolutionIsScaffold) {
    return {
      entry_source: entrySource,
      route_kind: 'draft_iteration',
      is_blocked: false,
      reason: 'contract_missing_or_scaffold',
    }
  }

  return {
    entry_source: entrySource,
    route_kind: 'executable_iteration',
    is_blocked: false,
    reason: 'contracts_ready_for_execution',
  }
}

export {
  ROUTE_KINDS,
  TERMINAL_ITERATION_STATUSES,
}
