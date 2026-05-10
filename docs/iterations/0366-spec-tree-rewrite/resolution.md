---
title: "0366 Spec Tree Rewrite Resolution"
doc_type: iteration_resolution
status: approved
updated: 2026-05-10
source: ai
iteration: 0366-spec-tree-rewrite
---

# Iteration 0366-spec-tree-rewrite Resolution

## Execution Strategy

- Treat this as a docs-only governance rewrite.
- Work from high-priority entry points downward.
- Do not edit runtime implementation or historical iteration archives.
- For each document, preserve semantics and change only authority, clarity, classification, and conflict handling.
- Record unresolved or intentionally deferred issues in the audit map rather than silently papering them over.

## Step 1 — Register and map the spec tree

- Scope: Register 0366, create a spec-tree audit file, and list current normative entry points.
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0366-spec-tree-rewrite/plan.md`
  - `docs/iterations/0366-spec-tree-rewrite/resolution.md`
  - `docs/iterations/0366-spec-tree-rewrite/runlog.md`
  - `docs/iterations/0366-spec-tree-rewrite/assets/spec_tree_audit.md`
- Verification: `rg -n "0366-spec-tree-rewrite|Spec Tree|Authority Tree|Finding" docs/ITERATIONS.md docs/iterations/0366-spec-tree-rewrite`
- Acceptance: The iteration is registered, and the audit file identifies the rule tree and initial contradictions.
- Rollback: Remove the 0366 row and iteration directory.

## Step 2 — Rewrite core entry points

- Scope: Fix authority contradictions and normalize collaboration/governance entry points.
- Files:
  - `CLAUDE.md`
  - `AGENTS.md`
  - `README.md`
  - `docs/README.md`
  - `docs/WORKFLOW.md`
  - `docs/ssot/execution_governance_ultrawork_doit.md`
- Verification: `rg -n "CLAUDE.md.*highest|highest priority|硬约束|判断规则|偏好建议|HTML 不作为默认|history archive|not policy" CLAUDE.md AGENTS.md README.md docs/README.md docs/WORKFLOW.md docs/ssot/execution_governance_ultrawork_doit.md`
- Acceptance: Entry points agree on authority order and describe rule classification.
- Rollback: Revert the changed entry-point docs.

## Step 3 — Normalize SSOT openings

- Scope: Rewrite top sections of active SSOT/charter docs so each says authority, scope, current/target status, and conflict behavior.
- Files:
  - `docs/architecture_mantanet_and_workers.md`
  - `docs/charters/dongyu_app_next_runtime.md`
  - selected `docs/ssot/*.md`
- Verification: `rg -n "Authority|上位约束|Conflict|冲突|Scope|作用对象|Current status|Target status" docs/architecture_mantanet_and_workers.md docs/charters/dongyu_app_next_runtime.md docs/ssot/*.md`
- Acceptance: Placeholder openings are removed or clarified; migration-window docs state current vs target.
- Rollback: Revert SSOT opening changes.

## Step 4 — Audit contradictions and ambiguity

- Scope: Search for high-risk absolute wording, current/target migration ambiguity, and authority conflicts; fix bounded issues and record deferred ones.
- Files:
  - `docs/iterations/0366-spec-tree-rewrite/assets/spec_tree_audit.md`
  - relevant current docs found in the audit
- Verification: targeted `rg` checks for fixed phrases and deferred issue list.
- Acceptance: No known unresolved contradiction remains unrecorded.
- Rollback: Revert the audit file and related bounded fixes.

## Step 5 — Final verification

- Scope: Run docs checks and record evidence.
- Files:
  - `docs/iterations/0366-spec-tree-rewrite/runlog.md`
  - `docs/ITERATIONS.md`
- Verification:
  - `git diff --check`
  - `git status --short --branch`
  - commit hook frontmatter gate on final commit
- Acceptance: Checks pass, runlog has PASS evidence, iteration index reaches Completed.
- Rollback: Revert 0366 changes.

## Notes

- Generated at: 2026-05-10
