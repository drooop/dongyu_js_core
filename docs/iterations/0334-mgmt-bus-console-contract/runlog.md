---
title: "0334 — mgmt-bus-console-contract Run Log"
doc_type: iteration-runlog
status: planned
updated: 2026-04-26
source: ai
iteration_id: 0334-mgmt-bus-console-contract
id: 0334-mgmt-bus-console-contract
phase: phase1
---

# 0334 — mgmt-bus-console-contract Run Log

规则：只记事实（FACTS）。不要写愿景。此 iteration 当前只落 planning / contract 文档，不做实现。

## Environment
- Date: `2026-04-26`
- Branch: `dev_0331-0333-pin-payload-ui`
- Runtime: local macOS, repo `/Users/drop/codebase/cowork/dongyuapp_elysia_based`

## Planning Record
- User requested a planning iteration named `0334-mgmt-bus-console-contract`.
- User specified that the first step only freezes the contract and does not implement.
- Contract requirements recorded:
  - Positive model `Mgmt Bus Console`.
  - Four-region UI: subject/room list, event timeline, composer, event inspector / route status.
  - Reuse existing `Model -100`, `1016-1021`, `Model 0`, and MBR route truth.
  - Use current cellwise components first.
  - Required send path starts at `bus_event_v2` and enters `Model 0 pin.bus.in`.
  - Formal payload is temporary ModelTable record array.
  - Validation includes no direct Matrix send, no secret leak, invalid payload rejection, Matrix initial-sync ignore, and MBR generic CRUD rejection.

## Verification
- Documentation only; no runtime command required beyond final repository checks.
