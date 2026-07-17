---
title: "Iteration 0459 Feishu Pending Contract Decisions Plan"
doc_type: iteration-plan
status: approved
updated: 2026-07-17
source: ai
iteration_id: 0459-feishu-pending-contract-decisions
id: 0459-feishu-pending-contract-decisions
phase: phase2
---

# Iteration 0459-feishu-pending-contract-decisions Plan

## Goal

Turn the seven remaining high-risk Feishu contract findings—F-06, F-07, and F-10 through F-14—into explicit user-approved repository decisions. Each decision must freeze the canonical shape, compatibility or migration boundary, Tier and owner, fail-closed/default behavior, and follow-on implementation dependency. This iteration is decision-only: it does not change executable behavior or write Feishu.

## Scope

In scope:

- Reconfirm read-only both relevant UpstreamConsensus sources before building the decision packets. Step 1 refreshed `feishu-model2` from revision `14272` to revision `14288` after a focused diff; `feishu-message-api` remained byte-identical to the 0454 local-evidence hash. If either source changes again, stop and produce a new focused diff before using prior evidence.
- Produce one Change Proposal per pending finding, with options, a recommended safety-preserving choice, impact, migration consequences, rejected alternatives, and exact verification.
- Present decisions in two dependency-aware waves:
  - Model/program wave: F-14 -> F-10 -> F-11 -> F-12 -> F-13.
  - Config/routing wave: F-07 -> F-06.
- After explicit user decisions, update only the approved decision surfaces: `feishu_alignment_decisions_v0.md`, `feishu_contract_backlog.md`, `contract_surface_manifest.json`, regenerated coverage, and their deterministic contract tests.
- Record a follow-on implementation split rather than implementing all decisions in one large change.

Out of scope:

- F-04 Feishu source correction or any `DerivedView` write; those require separate explicit Feishu-write authorization.
- F-05 `ui.refresh_data` and F-08 `add_task_return` implementation; both are already decided and belong in a separate implementation iteration.
- Runtime, worker patch, UI, deployment, migration, or compatibility implementation for F-06/F-07/F-10-F-14.
- SupportingSource identity verification, 0458 watcher duplicate-heading/snapshot-persistence debt, and broader Data/Flow/Matrix roadmap questions.
- Remote deployment, local deployment, E2E, merge to `dev`, PR, or Feishu mutation during the decision phase.

## Decision Inputs

| Order | Finding | Decision that must be explicit |
|---:|---|---|
| 1 | F-14 | Functional model categories and which categories may run independently. |
| 2 | F-10 | Whether key prefixes are normative, descriptive only, or require a migration/compatibility plan. |
| 3 | F-11 | Program areas, `pin.manage`, MNG lifecycle states/commands, ownership, failures, and API boundary. |
| 4 | F-12 | `func.code.python/js`, `func.mode`, and `func.timer.ms` naming, replacement/supplement policy, and scheduling semantics. |
| 5 | F-13 | Log record required fields/types, owner, retention, and transport. |
| 6 | F-07 | Canonical relationship between aggregate `config.control/config.manage` and current split labels, plus `mqtt.global_port` spelling and precedence. |
| 7 | F-06 | Route-directory truth, permission checks, local/global defaults, and whether omitted fields may be materialized. |

## Invariants / Constraints

- Until a user decision is recorded, current repo SSOT and fail-closed behavior remain authoritative.
- AI review may validate plan quality but may not substitute for the seven product decisions.
- No Feishu write is implied by approving this iteration or any repository decision.
- The Feishu authority model remains exactly 2 UpstreamConsensus + 4 DerivedView + 2 identity-pending SupportingSource slots.
- A decision is incomplete unless it states canonical name/shape, hard cut versus migration, Tier/owner, fail-closed/default behavior, and downstream implementation dependencies.
- F-14 precedes program lifecycle decisions; F-07 precedes route auto-fill because capability/config truth constrains later defaults and permissions.
- If either upstream source changes, classification stops before decision adoption and the evidence baseline is refreshed read-only.

## Success Criteria

- F-06, F-07, and F-10 through F-14 each have exactly one explicit user-approved decision or an explicit deferral with preserved fail-closed behavior.
- No decision is inferred from revision order, wording recency, or AI preference.
- Approved decisions are reflected consistently in alignment decisions, backlog, contract routing, coverage summary, and deterministic tests.
- Unapproved or deferred findings remain `requires_user_confirmation` and continue to stop the watcher.
- The iteration produces a dependency-ordered implementation roadmap with small follow-on iterations; it does not create a mega-implementation change.
- Docs gate, contract-index generation/test, syntax checks, and `git diff --check` pass.
- No executable product behavior, Feishu document, deployment, Secret, or local/remote service changes.

## Recommended Safety Stance Until Decision

- Preserve current repo names and behavior; treat newly observed Feishu surfaces as proposals, not aliases or automatic migrations.
- Prefer explicit fields and fail-closed routing over omitted-field inference until F-06 is decided.
- Keep current split configuration labels authoritative until F-07 defines whether aggregate labels are explanatory or compiled input.
- Do not enforce independent-run restrictions, new program areas, new function labels, or a new log schema before their owner and migration contracts are approved.

## Inputs

- Created at: 2026-07-17
- Branch: `dropx/dev_0459-feishu-pending-contract-decisions`
- Baseline `dev` merge: `188af0d`
- Current decision baselines after the Phase 3 Step 1 focused recheck: `feishu-model2` revision `14288`, SHA-256 `218e77f7a62961b940ad6c983cc43056eeeacc1fa2cabd7cb5d0d87464d0d252`; `feishu-message-api` revision `5951`, unchanged 0454 SHA-256 `7b3576ab5ce70956859957b1271a0e7116e06f94b6664053fc2518788c39b52c`
- Baseline refresh evidence: `docs/iterations/0459-feishu-pending-contract-decisions/source-recheck-report.md`
- Current pending sources: `docs/ssot/feishu_contract_backlog.md`, `docs/ssot/contract_coverage_summary.md`, and 0458 revision evidence

## Alternatives Considered

- Recommended: one decision-only iteration in two waves, then small implementation iterations. This keeps semantic choices separate from code and deployment risk.
- Implement current Feishu text directly: rejected because seven high-risk findings remain contradictory or underspecified.
- Combine F-05/F-08 implementation and all pending decisions: rejected because it mixes already-decided behavior with unresolved product contracts and recreates the oversized-review problem seen in Revision 4.
