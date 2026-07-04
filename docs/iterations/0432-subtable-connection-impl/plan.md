---
title: "Iteration 0432 Subtable Connection Implementation Plan"
doc_type: iteration-plan
status: planned
updated: 2026-07-02
source: ai
iteration_id: 0432-subtable-connection-impl
id: 0432-subtable-connection-impl
phase: planning
---

# Iteration 0432-subtable-connection-impl Plan

## Goal

Implement the 0431 SSOT correction so the runtime, installer, system fill-table
patches, tests, and developer examples all use four distinct model relationship
labels:

- `model.subtable`: child ModelTable root declaration, written on child table
  Model 0 `(0,0,0)`.
- `model.subtableconnection`: parent/main table index to a child ModelTable,
  written on the parent side.
- `model.submt`: child model root declaration, written in the child model.
- `model.submtconnection`: parent/main or secondary model index to a child
  model, written on the parent side.

## Scope

- In scope:
- Runtime validation and registration in `packages/worker-base/src/runtime.mjs`
  and the aligned CommonJS runtime if present.
- Slide App import/materialization and delete/export behavior in
  `packages/ui-model-demo-server/server.mjs`.
- System fill-table patches under `deploy/sys-v1ns/**` and
  `packages/worker-base/system-models/**` where they still use parent-side
  `model.submt` or host-side `model.subtable`.
- Tests that currently encode the superseded 0425/0430 interpretation.
- User/developer docs that must reflect exact installed-label behavior after
  implementation.
- Local deployed/browser verification for at least Workspace opening and one
  installed Slide App path after tests pass.

- Out of scope:
- Reintroducing `pin.connect.model`.
- Adding compatibility aliases for old parent-side `model.submt` or host-side
  `model.subtable`.
- Changing topic naming, Matrix/MBR transport policy, or SSO behavior except
  where tests need updated model refs.
- Remote deployment or merging to `dev/main`; this iteration first proves local
  implementation.

## Invariants / Constraints

- `CLAUDE.md` is highest priority.
- No implementation before this iteration is registered and plan/resolution are
  reviewed as Approved.
- No compatibility code: invalid old placements must fail visibly instead of
  silently working.
- `pin.connect.cell` remains same-table/same-model routing only.
- Cross-table and parent-child relationships are indexes/boundaries, not direct
  pin wiring and not `pin.connect.model`.
- All side effects remain through `add_label` / `rm_label`.
- Tests must prove the conformant path, not merely that the UI still works.
- Every implementation sub-stage requires sub-agent `codex-code-review` before
  continuing.

## Success Criteria

- Runtime accepts and records `model.subtableconnection` as the only parent-side
  child-table index, and rejects old host-side `model.subtable` connection use.
- Runtime accepts and records `model.submtconnection` as the only parent-side
  child-model index, and rejects old parent-side `model.submt` connection use.
- Runtime accepts `model.subtable` only as child ModelTable root declaration,
  and accepts `model.submt` only as child model declaration.
- Slide App import creates a parent `model.subtableconnection` record and a
  child table root `model.subtable` declaration; duplicate installs still keep
  independent app tables.
- Submodel examples/system patches create parent `model.submtconnection` records
  plus child-root `model.submt` declarations.
- Removed-label tests still reject `pin.connect.model` and `model.v1n`, but no
  longer reject the two connection labels.
- Targeted runtime/server tests pass, including updated 0425/0430 contracts.
- Local UI Server is restarted/deployed before browser verification, and the
  browser can open Workspace and a Slide App without hanging on the old mount
  path.
- Final sub-agent review returns Approved.

## Inputs

- Created at: 2026-07-02
- Iteration ID: 0432-subtable-connection-impl
- SSOT basis: `0431-subtable-connection-ssot`, commit `4f1a0c7`.
