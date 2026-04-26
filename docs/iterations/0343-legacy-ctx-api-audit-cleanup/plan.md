---
title: "0343 — Legacy Ctx API Audit Cleanup Plan"
doc_type: iteration-plan
status: completed
updated: 2026-04-27
source: ai
iteration_id: 0343-legacy-ctx-api-audit-cleanup
id: 0343-legacy-ctx-api-audit-cleanup
phase: planning
---

# Iteration 0343-legacy-ctx-api-audit-cleanup Plan

## Goal

- Audit the repository for legacy executable `ctx.writeLabel`, `ctx.getLabel`, and `ctx.rmLabel` usage, correct non-conforming runtime/model/deploy paths, and add an automated regression check so current ModelTable side-effect rules do not silently drift back to compatibility APIs.

## Scope

- In scope:
- Active runtime source under `packages/**`.
- Active system model tables under `packages/worker-base/system-models/**`, excluding explicitly named legacy snapshots.
- Active deploy/fill-table patches under `deploy/sys-v1ns/**`.
- Deterministic tests/scripts needed to prove the cleanup.
- Existing uncommitted 0342 follow-up fixes are preserved and not reverted.
- Out of scope:
- Rewriting historical iteration archives, runlogs, or docs that only describe past behavior.
- Removing explicitly named `.legacy` fixtures that are kept as migration evidence.
- Redesigning the event ingress contract beyond fixing incompatible legacy API usage.

## Invariants / Constraints

- `CLAUDE.md` remains the highest-priority execution constraint.
- New implementation work must be registered before runtime edits.
- Runtime side effects must flow through current `add_label` / `rm_label` and ModelTable payload paths, not compatibility helpers.
- UI must not directly write business state or bypass Model 0 pin ingress.
- No compatibility alias/fallback may remain in active paths unless it is explicitly approved and documented.

## Success Criteria

- Repository scan identifies all `ctx.writeLabel/getLabel/rmLabel` occurrences and classifies them as active, legacy fixture, historical docs, or test-only guard.
- Active runtime/model/deploy paths contain no unapproved legacy `ctx.*Label` calls.
- A deterministic test fails if active production surfaces reintroduce legacy `ctx.*Label` usage.
- Existing key tests for generator rewrite, slide creation/import, and runtime baseline still pass.
- Any local runtime/server changes are deployed or restarted before browser/runtime behavior is claimed.

## Inputs

- Created at: 2026-04-26
- Iteration ID: 0343-legacy-ctx-api-audit-cleanup
- Gate: Approved for execution by direct user request on 2026-04-26.
