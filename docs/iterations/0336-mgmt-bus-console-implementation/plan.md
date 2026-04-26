---
title: "0336 — mgmt-bus-console-implementation Plan"
doc_type: iteration-plan
status: approved
updated: 2026-04-26
source: ai
iteration_id: 0336-mgmt-bus-console-implementation
id: 0336-mgmt-bus-console-implementation
phase: phase3
---

# 0336 — mgmt-bus-console-implementation Plan

## Goal
Implement the approved `0334-mgmt-bus-console-contract` as a positive `model.table` Workspace app named `Mgmt Bus Console`.

## Scope
- In scope:
  - Allocate positive model id `1036` after confirming current max positive model id is `1035`.
  - Add a `cellwise.ui.v1` model-table surface with four regions: subject / room list, event timeline, composer, event inspector / route status.
  - Use existing UI components first: `Container`, `Card`, `Tabs`, `Table`, `Terminal`, `Input`, `Button`, `StatusBadge`.
  - Ensure formal send actions produce `bus_event_v2` and enter `Model 0 (0,0,0) pin.bus.in`.
  - Ensure formal payload value is a temporary ModelTable record array.
  - Add deterministic tests for UI contract, data-flow contract, secret redaction guard, invalid payload rejection, Matrix live-only guard, and MBR generic CRUD rejection.
- Out of scope:
  - New renderer components such as `RoomList`, `EventTimeline`, `EventInspector`, or `Composer`.
  - New Matrix client sending path.
  - Copying Matrix room, MBR route, or Model 0 route truth into model `1036`.
  - Broad Matrix / MBR behavior changes unrelated to the contract checks.

## Invariants / Constraints
- `CLAUDE.md` remains authoritative.
- UI is projection only; it must not become truth source for Matrix, MBR, or Model 0 routes.
- UI business events must enter through `Model 0 pin.bus.in`; no frontend direct Matrix send.
- Side effects remain through `add_label` / `rm_label`.
- Pin payloads must be temporary ModelTable record arrays, not arbitrary object envelopes.
- New positive model stores only console-local UI state such as selection, draft, filter, and inspector state.

## Success Criteria
- A deterministic test proves model `1036` declares Workspace metadata and builds a cellwise AST with the required four regions.
- A deterministic test proves label-driven UI text changes are reflected by projection.
- A deterministic test proves the send button contract emits `bus_event_v2` to Model 0 with a ModelTable record array payload.
- Deterministic negative checks cover invalid payload rejection, no secret leakage in the console model, Matrix initial-sync ignore, and MBR generic CRUD rejection.
- Frontend package tests/build and targeted runtime tests pass.
- After local redeploy/restart, Workspace can load the new app at `http://127.0.0.1:30900/#/workspace`; browser automation can open the app and exercise the send path without direct Matrix sending.

## Inputs
- Approved contract iteration: `docs/iterations/0334-mgmt-bus-console-contract/`
- Current implementation branch: `dev_0336-0337-mgmt-bus-slide-impl`
- Verified positive model ids: max existing id is `1035`; `1036` is available.
