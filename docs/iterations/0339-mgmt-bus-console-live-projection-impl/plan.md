---
title: "0339 — Mgmt Bus Console Live Projection Implementation Plan"
doc_type: iteration-plan
status: approved
updated: 2026-04-26
source: ai
iteration_id: 0339-mgmt-bus-console-live-projection-impl
id: 0339-mgmt-bus-console-live-projection-impl
phase: phase3
---

# 0339 — Mgmt Bus Console Live Projection Implementation Plan

## Goal
Implement the approved `0338-mgmt-bus-console-live-projection` contract: make `Mgmt Bus Console` show live read-only projection data from existing Matrix Debug / Model 0 / MBR sources while keeping Model `1036` as UI-state-only and preserving all formal actions through Model 0 `pin.bus.in`.

## Scope
In scope:
- Add deterministic tests for source-owned live projection into the Console.
- Populate subject / timeline / inspector / route status regions from existing projection labels or explicit read-only projection adapter output.
- Add a refresh action that emits `bus_event_v2` into Model 0 with a temporary ModelTable record-array payload.
- Preserve the existing 0336 Send path to `-10.mgmt_bus_console_intent`.
- Add negative guards for secrets, copied external truth, object-envelope payloads, browser direct Matrix send, and generic CRUD.
- Redeploy local stack and verify with Playwright against `http://127.0.0.1:30900/#/workspace`.

Out of scope:
- No new dedicated UI renderer components unless existing `Table` / `Terminal` / `Tabs` cannot express the required projection.
- No direct Matrix send from frontend.
- No Matrix live adapter behavior rewrite unless a narrow bug is exposed by tests.
- No MBR routing / CRUD policy rewrite except explicit rejection checks.
- No promotion to `main`.

## Invariants / Constraints
- `CLAUDE.md` is authoritative.
- UI is projection only; ModelTable remains source of truth.
- Formal UI business events must enter via `Model 0 (0,0,0) pin.bus.in`.
- Formal pin payloads must be temporary ModelTable record arrays.
- All side effects remain through `add_label` / `rm_label`.
- Model `1036` may own only Console-local UI state and display binding declarations.
- Model `1036` must not own Matrix event truth, route truth, MBR truth, or secrets.
- If the conformant Model 0 path fails, do not hide failure behind a direct-cell fallback.

## Success Criteria
- `scripts/tests/test_0339_mgmt_bus_console_live_projection_contract.mjs` proves seeded source projection labels render non-empty Console regions.
- The same test proves changing source projection labels changes the Console projection without writing Matrix / route truth into Model `1036`.
- Refresh button emits `bus_event_v2` to Model 0 with temporary ModelTable record-array payload.
- Invalid refresh payload is rejected and observable.
- Existing `scripts/tests/test_0336_mgmt_bus_console_contract.mjs` remains green.
- Frontend test/build, runtime validators, local deploy baseline, and Playwright browser flow pass.
- Each implementation stage gets sub-agent `codex-code-review`; findings are fixed before proceeding.

## Inputs
- Approved planning iteration: `docs/iterations/0338-mgmt-bus-console-live-projection/`
- Baseline implementation: `docs/iterations/0336-mgmt-bus-console-implementation/`
- Current implementation branch: `dev_0339-mgmt-bus-console-live-projection-impl`
