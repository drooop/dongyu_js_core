---
title: "0340 — Mgmt Bus Console Event Projection Contract Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-26
source: ai
iteration_id: 0340-mgmt-bus-console-event-projection-contract
id: 0340-mgmt-bus-console-event-projection-contract
phase: phase1
---

# 0340 — Mgmt Bus Console Event Projection Contract Resolution

## Execution Strategy
This is a planning-only iteration. Do not implement event projection, renderer components, runtime handlers, Matrix adapter behavior, or MBR behavior in this iteration.

The next implementation should be TDD-first and should keep the same invariant proven by `0339`: Model `1036` is UI projection and local UI state only; formal actions enter through Model 0 `pin.bus.in` with temporary ModelTable record arrays.

## Step 1 — Register Planning Iteration
- Scope:
  - Create branch `dev_0340-mgmt-bus-console-event-projection-contract`.
  - Generate planning scaffold.
  - Register `0340` in `docs/ITERATIONS.md`.
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0340-mgmt-bus-console-event-projection-contract/plan.md`
  - `docs/iterations/0340-mgmt-bus-console-event-projection-contract/resolution.md`
  - `docs/iterations/0340-mgmt-bus-console-event-projection-contract/runlog.md`
- Verification:
  - `git status --short`
- Acceptance:
  - Iteration exists and is clearly planning-only.
- Rollback:
  - Delete the 0340 docs directory and remove the index row.

## Step 2 — Freeze Event Projection Contract
- Scope:
  - Define event row schema.
  - Define event inspector projection shape.
  - Define source ownership and forbidden truth copies.
  - Define redaction rules.
- Files:
  - `docs/iterations/0340-mgmt-bus-console-event-projection-contract/plan.md`
- Verification:
  - Manual review against `0338` / `0339` invariants.
- Acceptance:
  - The contract names source-owned projection labels and states that event truth must not be copied into `1036`.
  - Event rows and inspector detail are display-only and redacted.
- Rollback:
  - Revert the planning doc edits.

## Step 3 — Freeze Selection And Composer Action Contract
- Scope:
  - Define local UI selection boundary.
  - Define when selection becomes formal business ingress.
  - Define composer action whitelist and payload kinds.
  - Reject object-envelope payloads and generic CRUD.
- Files:
  - `docs/iterations/0340-mgmt-bus-console-event-projection-contract/plan.md`
- Verification:
  - Manual review against `docs/ssot/runtime_semantics_modeltable_driven.md` and `docs/ssot/temporary_modeltable_payload_v1.md`.
- Acceptance:
  - Local selection does not call `/bus_event`.
  - Refresh / send / inspect / retry / route_probe are explicitly whitelisted and must use temporary ModelTable record arrays.
- Rollback:
  - Revert the planning doc edits.

## Step 4 — Define Later Implementation Tasks
- Scope:
  - Define the later TDD implementation sequence.
  - Keep existing `Table` / `Terminal` / `Tabs` first.
  - Define criteria for adding dedicated components.
- Files:
  - `docs/iterations/0340-mgmt-bus-console-event-projection-contract/resolution.md`
- Verification:
  - Manual review against `docs/user-guide/ui_components_v2.md`.
- Acceptance:
  - Later implementation can start with red tests and small stages.
  - Dedicated components require renderer tests, docs, and browser verification.
- Rollback:
  - Revert the planning doc edits.

## Step 5 — Sub-Agent Review
- Scope:
  - Spawn a sub-agent using `codex-code-review`.
  - Review the planning diff against 0338/0339 contracts and repo rules.
  - Fix findings and re-review until approved.
- Files:
  - 0340 planning docs and `docs/ITERATIONS.md`.
- Verification:
  - Sub-agent review output.
- Acceptance:
  - Review decision is `APPROVED`.
- Rollback:
  - Keep the iteration as `Change Requested` or revert the planning branch.

## Step 6 — Close Planning Iteration
- Scope:
  - Update runlog with factual commands and review result.
  - Mark the iteration index as `Completed`.
  - Commit, merge to `dev`, and push `dev`.
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0340-mgmt-bus-console-event-projection-contract/runlog.md`
- Verification:
  - `git diff --check`
  - `git status --short`
- Acceptance:
  - Planning is merged to `dev`.
  - No implementation code changed.
- Rollback:
  - Revert the merge commit on `dev`.

## Later Implementation Outline
The likely follow-up implementation iteration should be `0341-mgmt-bus-console-event-projection-impl`.

Recommended stages:
1. Add red contract tests for source-owned event rows and selected-event inspector.
2. Add projection deriver output for `mgmt_bus_console_event_rows_json` and inspector labels.
3. Bind Model `1036` timeline / inspector regions to those source-owned labels.
4. Add local selection behavior without formal ingress.
5. Add optional formal `inspect.v1` only if local projection is insufficient.
6. Run local deploy and Playwright browser verification.
7. Use sub-agent `codex-code-review` after each stage and before merge.

## Notes
- `main` is not part of this planning iteration unless the user explicitly declares a release / milestone.
- If implementation discovers that existing components are insufficient, stop and open a component-contract planning sub-iteration before adding renderer components.
