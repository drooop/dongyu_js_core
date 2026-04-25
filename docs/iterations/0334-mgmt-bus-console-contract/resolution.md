---
title: "0334 — mgmt-bus-console-contract Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-26
source: ai
iteration_id: 0334-mgmt-bus-console-contract
id: 0334-mgmt-bus-console-contract
phase: phase1
---

# 0334 — mgmt-bus-console-contract Resolution

## Execution Strategy

This is a planning / contract-freeze iteration. Do not implement the console in this iteration.

1. Inventory existing truth sources.
2. Freeze positive-model UI contract.
3. Freeze send-path contract.
4. Freeze validation contract.
5. Hand off to a later implementation iteration.

## Step 1 — Inventory Existing Truth
- Files / surfaces:
  - `Model -100 Matrix Debug`
  - `Model 1016-1021 Matrix Chat`
  - `Model 0` bus config / route labels
  - MBR route status source
- Acceptance:
  - New console does not become a second truth store.

## Step 2 — Freeze UI Contract
- UI regions:
  - left subject / room list
  - center event timeline
  - bottom composer
  - right event inspector / route status
- First-choice components:
  - `Container`
  - `Card`
  - `Tabs`
  - `Table`
  - `Terminal`
  - `Input`
  - `Button`
  - `StatusBadge`
- Acceptance:
  - New components are explicitly deferred unless existing cellwise components cannot express the UI.

## Step 3 — Freeze Send Path
- Required path:
  - `UI event -> bus_event_v2 -> Model 0 pin.bus.in -> pin route -> target model / MBR`
- Required payload:
  - temporary ModelTable record array
- Acceptance:
  - No direct Matrix send from frontend.
  - No object envelope as formal business pin value.

## Step 4 — Freeze Validation
- Required checks:
  - no frontend direct Matrix send
  - no secret leak
  - invalid payload rejected
  - Matrix live adapter ignores initial sync / backfill
  - MBR rejects generic CRUD
- Acceptance:
  - A later implementation iteration can write deterministic tests from these checks.

## Step 5 — Handoff
- Follow-up implementation must start with failing tests.
- Follow-up implementation must not copy `Model -100`, `1016-1021`, `Model 0`, or MBR truth into the console model.
