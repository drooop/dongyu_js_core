---
title: "0357 PIN Connection Hard-Cut Implementation Plan"
doc_type: iteration_plan
status: completed
updated: 2026-05-06
source: ai
iteration: 0357-pin-connection-hard-cut-implementation
---

# Iteration 0357 PIN Connection Hard-Cut Implementation Plan

## Goal

Implement `docs/ssot/pin_connection_contract_v2.md` without compatibility code.

## Scope

In scope:

- Runtime rejects `pin.connect.model`, prefix endpoint syntax, numeric endpoint syntax, `pin.log.*`, and function endpoints in `pin.connect.cell`.
- Runtime supports direct `pin.connect.label` endpoints and `model.submt` hosting Cell boundary bridge.
- Server-generated routes and repair helpers stop emitting removed label types or old endpoint strings.
- System-model JSON, deploy patches, tests, and validators migrate to the 0356 target contract.
- A global grep gate proves no removed runtime surface remains under `packages/`, `deploy/`, or `scripts/`.

Out of scope:

- Historical docs under `docs/iterations/**` and `docs/plans/**` are not rewritten.
- No compatibility aliases, fallback parsers, or dual syntax acceptance.
- No browser/deploy validation unless local deterministic tests show runtime/server are ready.

## Invariants / Constraints

- No compatibility code: old input must fail visibly.
- TDD: write RED tests before implementation.
- ModelTable remains SSOT; UI/server do not direct-write business truth.
- Cross-model flow must use `model.submt` boundary pins plus `pin.connect.cell`.
- All pin payloads remain ModelTable-like record arrays for formal business data.

## Success Criteria

- `scripts/tests/test_0357_pin_connection_hard_cut.mjs` passes.
- Existing targeted runtime/server tests pass after migration.
- `rg` gate has no matches for removed syntax in `packages/`, `deploy/`, or `scripts/`.
- `git diff --check` passes.
- 0357 runlog records exact PASS/FAIL evidence.

## Inputs

- `docs/ssot/pin_connection_contract_v2.md`
- `docs/iterations/0356-pin-connection-contract-realignment/pin_connection_conflict_inventory.md`
- `docs/plans/2026-05-06-pin-connection-hard-cut-implementation.md`
