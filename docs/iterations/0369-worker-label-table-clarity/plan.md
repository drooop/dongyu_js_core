---
id: 0369
title: worker-label-table-clarity
doc_type: iteration_plan
status: Completed
updated: 2026-05-11
source: ai
branch: dropx/0369-worker-label-table-clarity
created_at: 2026-05-11
iteration_id: 0369-worker-label-table-clarity
phase: phase1
---

# Iteration 0369 Worker Label Table Clarity Plan

## Goal

- After 0368 completion, align public Worker label documentation with the user-provided table:
  - `worker.role` uses `key=sys_worker_role`.
  - `worker.id` uses `key=sys_worker_id`.
  - Role values are `WSM` community management, `DEM` digital employee management, and `V1N` ordinary software worker.

## Scope

- In scope:
- Clarify the Worker label table in the active SSOT registry and developer-facing user guide.
- Add a deterministic docs check so future edits keep `type`, `key`, `value`, and examples aligned.
- Out of scope:
- Runtime behavior, deployed worker patches, MBR routing, browser re-test, and compatibility paths.

## Invariants / Constraints

- No compatibility aliases are added for old `v1n_id`, old `k=worker.role`, or old `is_DEM`.
- The active contract remains ModelTable-only and keeps worker identity labels on Model 0 `(0,0,0)`.
- Historical iteration evidence may still mention old names as historical facts; this iteration only changes active docs and tests.

## Success Criteria

- `docs/ssot/label_type_registry.md` contains the Worker label table in the requested shape.
- `docs/user-guide/modeltable_user_guide.md` contains the same developer-facing table and examples.
- `scripts/tests/test_0364_docs_split_bus_contract.mjs` checks the Worker table shape and passes.
- `git diff --check` passes.

## Inputs

- Created at: 2026-05-11
- Iteration ID: 0369-worker-label-table-clarity
