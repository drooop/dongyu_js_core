---
title: "0341 — Mgmt Bus Console Event Projection Implementation Plan"
doc_type: iteration-plan
status: approved
updated: 2026-04-26
source: ai
iteration_id: 0341-mgmt-bus-console-event-projection-impl
id: 0341-mgmt-bus-console-event-projection-impl
phase: phase3
---

# 0341 — Mgmt Bus Console Event Projection Implementation Plan

## Goal
Implement the approved `0340-mgmt-bus-console-event-projection-contract`: make `Mgmt Bus Console` render structured, redacted event rows and selected-event inspector detail from source-owned projection labels while keeping Model `1036` as UI projection plus local interaction state only.

## Scope
In scope:
- Add deterministic contract tests for source-owned event rows, event inspector rows, local event selection, redaction, and existing formal send / refresh paths.
- Extend the source-owned management console projection on Model `-2` with:
  - `mgmt_bus_console_event_rows_json`
  - `mgmt_bus_console_event_inspector_json`
  - `mgmt_bus_console_event_inspector_text`
  - `mgmt_bus_console_composer_actions_json`
- Bind Model `1036` timeline and inspector regions to those Model `-2` labels using existing `Table`, `Terminal`, `Input`, `Button`, `Tabs`, and `StatusBadge` components.
- Add local selection labels on Model `1036` for non-business UI state such as `selected_event_id`.
- Redeploy the local stack and verify in a real browser at `http://127.0.0.1:30900/#/workspace`.
- Use sub-agent `codex-code-review` after each implementation stage and before merge.

Out of scope:
- No new dedicated renderer components such as `RoomList`, `EventTimeline`, `EventInspector`, or `Composer`.
- No direct Matrix send from the browser.
- No Matrix live adapter rewrite.
- No MBR generic CRUD behavior change.
- No promotion to `main`.

## Invariants / Constraints
- `CLAUDE.md` is authoritative.
- UI remains a projection of ModelTable; it is not a source of business truth.
- Model `1036` must not own Matrix event truth, route truth, MBR truth, or secrets.
- Event rows and inspector detail are display-only, client-safe, and redacted.
- Changing selected subject / event is local UI state and must not call `/bus_event`.
- Formal send / refresh actions must still enter through `bus_event_v2 -> Model 0 (0,0,0) pin.bus.in`.
- Formal payloads must be temporary ModelTable record arrays.
- All side effects remain through `add_label` / `rm_label`.
- If the conformant path fails, do not hide failure behind a direct-cell or direct-Matrix fallback.

## Success Criteria
- `scripts/tests/test_0341_mgmt_bus_console_event_projection_contract.mjs` proves event rows and inspector rows render from Model `-2` projection labels.
- The same test proves Model `1036` only carries local selection / draft state and UI bindings, not copied event truth or secrets.
- Local event selection dispatches a local label update path, not a `bus_event_v2` formal business event.
- Projection derivation redacts secret-like keys/types and value patterns in event preview and inspector output.
- Existing 0336 and 0339 management console contract tests remain green.
- Runtime validators, frontend test/build, local deploy baseline, and browser verification pass.
- Stage and final sub-agent code reviews return `APPROVED`, or all findings are fixed and re-reviewed until approved.

## Inputs
- Approved planning iteration: `docs/iterations/0340-mgmt-bus-console-event-projection-contract/`
- Baseline live projection implementation: `docs/iterations/0339-mgmt-bus-console-live-projection-impl/`
- Current implementation branch: `dev_0341-mgmt-bus-console-event-projection-impl`
