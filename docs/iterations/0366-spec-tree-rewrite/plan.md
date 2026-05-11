---
title: "0366 Spec Tree Rewrite Plan"
doc_type: iteration_plan
status: approved
updated: 2026-05-10
source: ai
iteration: 0366-spec-tree-rewrite
---

# Iteration 0366-spec-tree-rewrite Plan

## Goal

- Build a current rule/spec tree for the repository, including multiple entry points.
- Rewrite current normative documents using the 0365 rule-writing method:
  - hard constraints only for true invariants;
  - judgment calls as decision rules;
  - preferences as defaults with override conditions.
- Resolve contradictions and ambiguous authority statements found during the audit.
- Preserve runtime semantics and historical facts; this iteration changes wording and governance clarity, not product behavior.

## Scope

- In scope:
- Current normative entry points:
  - `CLAUDE.md`
  - root `AGENTS.md`
  - `README.md`
  - `docs/README.md`
  - `docs/WORKFLOW.md`
  - `docs/ssot/*.md`
  - `docs/charters/*.md`
  - package/local `AGENTS.md`
- Add a spec-tree map and audit evidence under this iteration.
- Fix contradictions in authority ordering and ambiguous "current vs target vs historical" language.
- Normalize SSOT openings so each document states authority, scope, rule type, and conflict behavior.
- Out of scope:
- Runtime code, tests, deploy scripts, system-model JSON, package logic, and cloud state.
- Rewriting historical iteration records except this iteration's own files.
- Rewriting user-guide tutorial content unless it directly contradicts current normative docs.
- Resolving implementation debt such as 0364 bus hard-cut; this iteration may clarify wording but does not implement it.

## Invariants / Constraints

- `CLAUDE.md` remains highest priority.
- Lower docs must not override higher docs.
- Existing semantics are preserved unless the change is purely clarification.
- Legacy/current/target wording must be explicit where the repo is in a migration window.
- Historical records remain factual archives, not policy sources.
- Every docs change must be verified with grep checks and recorded in runlog.

## Success Criteria

- The iteration registers a spec-tree map covering all current normative entry points.
- `docs/README.md` no longer contradicts `CLAUDE.md` about highest priority.
- SSOT documents with placeholder titles are renamed to meaningful document titles while preserving content.
- Core governance docs classify hard constraints, decision rules, and preferences.
- Ambiguity findings are either fixed or explicitly recorded as deferred follow-up.
- `git diff --check` passes.
- Obsidian frontmatter gate passes at commit time.

## Inputs

- Created at: 2026-05-10
- Iteration ID: 0366-spec-tree-rewrite
- Preceding commit: `cb291e0 docs(governance): add prompt guidance rules`
- User request: commit 0365 first, then audit the rule tree and rewrite all current rules according to the new writing method, fixing contradictions and ambiguity.
