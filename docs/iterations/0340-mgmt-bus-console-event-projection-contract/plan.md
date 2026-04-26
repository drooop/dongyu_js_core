---
title: "0340 — Mgmt Bus Console Event Projection Contract Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-26
source: ai
iteration_id: 0340-mgmt-bus-console-event-projection-contract
id: 0340-mgmt-bus-console-event-projection-contract
phase: phase1
---

# 0340 — Mgmt Bus Console Event Projection Contract Plan

## 0. Metadata
- ID: `0340-mgmt-bus-console-event-projection-contract`
- Date: `2026-04-26`
- Owner: Codex
- Branch: `dev_0340-mgmt-bus-console-event-projection-contract`
- Type: planning / contract freeze
- Implementation status: not started

## 1. Goal
Freeze the next `Mgmt Bus Console` contract after `0339`: move from live summary / route status into a usable event-console surface with event rows, subject selection, selected-event inspector, and explicit composer action schemas.

This iteration is planning-only. It must not implement renderer components, runtime handlers, Matrix adapter changes, or MBR behavior changes.

## 2. Current Baseline
- `0336` created Model `1036` as a positive-model `Mgmt Bus Console` with a four-region cellwise UI.
- `0339` made the Console read live projection labels from Model `-2` and verified:
  - Workspace opens `Mgmt Bus Console`.
  - `ROUTE live` renders from source-owned projection labels.
  - Route rows include Model 0 console routes and MBR routes.
  - `Refresh` and `Send` use `bus_event_v2 -> Model 0 pin.bus.in -> Model -10 pin.in`.
  - Formal payloads are temporary ModelTable record arrays.
  - Browser resource entries for `/_matrix/client` remain `0`.
  - Client snapshot redacts exact secret keys/types plus `syt_*` and `ChangeMeLocal2026` value patterns.
- Remaining gap: event timeline and inspector are still summary text, not a structured event console comparable to a room/event debug surface.

## 3. Scope
In scope:
- Define a client-safe event row schema for the Console timeline.
- Define subject / room selection as UI-local state, and define when selection becomes a formal action.
- Define selected-event inspector projection shape.
- Define composer action whitelist and payload schemas for the next implementation.
- Define redaction and no-secret rules for event preview and inspector fields.
- Define criteria for using existing `Table` / `Terminal` / `Tabs` first versus adding dedicated `RoomList`, `EventTimeline`, `EventInspector`, or `Composer` components.
- Define validation requirements for a later implementation iteration.

Out of scope:
- No implementation code.
- No new renderer component.
- No Matrix live adapter rewrite.
- No MBR route or generic CRUD policy change.
- No direct browser Matrix send.
- No promotion to `main`.

## 4. Data Ownership Contract

### 4.1 Source-Owned Truth
Event and route truth stays in existing owning sources:

| Truth | Owner | Console access |
|---|---|---|
| Matrix room / subject state | Matrix Debug / Matrix Chat source models, projected through existing safe paths | read-only projection only |
| Matrix event bodies / event ids | Matrix Debug source or future explicit event projection adapter | redacted projection only |
| Model 0 route labels | Model `0` | route projection only |
| MBR route state | MBR / Model `-10` labels | route projection only |
| Console draft and UI selection | Model `1036` local state | owned by Console only |

Model `1036` must not store authoritative Matrix event truth, route truth, MBR truth, or secrets.

### 4.2 Model 1036 May Own
Model `1036` may own only local UI state and binding declarations:
- `selected_subject_id`
- `selected_event_id`
- `subject_filter`
- `timeline_filter`
- `timeline_sort`
- `inspector_tab`
- `composer_draft`
- `composer_action`
- `last_refresh_requested_at`
- `last_ui_error`

These labels are not business truth. They are local user interaction state.

### 4.3 Projection Labels For Later Implementation
The later implementation should prefer source-owned projection labels on Model `-2`:

| Label | Type | Meaning |
|---|---|---|
| `mgmt_bus_console_subject_rows_json` | `json` | subject / room rows, already introduced by 0339 and may be extended |
| `mgmt_bus_console_event_rows_json` | `json` | ordered client-safe event timeline rows |
| `mgmt_bus_console_event_inspector_json` | `json` | selected event key/value detail rows, redacted |
| `mgmt_bus_console_event_inspector_text` | `str` | terminal fallback for the selected event |
| `mgmt_bus_console_route_rows_json` | `json` | route status rows, already introduced by 0339 |
| `mgmt_bus_console_route_status` | `str` | aggregate route state, already introduced by 0339 |
| `mgmt_bus_console_composer_actions_json` | `json` | allowed composer actions and labels |

If the projection adapter needs source cursors or raw ids, those must stay source-owned and must not be copied into `1036` as truth.

## 5. Event Row Contract

Each event row must be client-safe and display-only.

Required fields:

| Field | Type | Rule |
|---|---|---|
| `event_id` | `str` | stable projection id; may be a redacted source id or synthetic id |
| `ts_ms` | `int` | event timestamp, or projection timestamp if source timestamp is absent |
| `direction` | `str` | one of `inbound`, `outbound`, `internal`, `error` |
| `source` | `str` | one of `matrix`, `model0`, `mbr`, `remote-worker`, `ui`, `runtime` |
| `subject_id` | `str` | subject / room / route grouping id |
| `subject_label` | `str` | display name; must be redacted |
| `route_key` | `str` | route or bus key when applicable |
| `pin` | `str` | pin name when applicable |
| `kind` | `str` | payload kind, e.g. `mgmt_bus_console.send.v1` |
| `status` | `str` | one of `queued`, `sent`, `received`, `applied`, `rejected`, `error`, `unknown` |
| `preview` | `str` | short redacted human-readable summary |
| `op_id` | `str` | correlation id when available |

Optional fields:
- `model_id`
- `target_model_id`
- `error_code`
- `latency_ms`
- `payload_ref`

The row must not include raw token values, password values, unredacted Matrix event bodies, or generic object envelopes that a consumer could mistake for a write command.

## 6. Inspector Contract

The inspector shows details for `selected_event_id`.

Allowed detail rows:
- event metadata from the event row contract.
- redacted payload preview.
- route status and target pin.
- rejection reason / error code when present.
- correlation labels such as `op_id`.

Forbidden detail rows:
- raw Matrix access token / password / device credential.
- `syt_*` values or default password values.
- unredacted Matrix body if it may contain credentials.
- raw MBR generic CRUD object.
- any field that would let the browser construct a direct Matrix or direct write request.

If the selected event cannot be resolved, the inspector must render an explicit empty/error state instead of falling back to raw source truth.

## 7. Selection And Action Contract

### 7.1 Local UI Selection
Changing selected subject or selected event is local UI state. It may update Model `1036` local labels and re-render the Console.

Local selection must not:
- send Matrix traffic.
- write source truth models.
- mutate Model 0 route labels.
- call MBR generic CRUD.

### 7.2 Formal Actions
Any action that asks the system to refresh, inspect source detail, send, retry, or probe a route is formal business ingress and must use:

```text
UI event
  -> bus_event_v2
  -> Model 0 (0,0,0) pin.bus.in
  -> pin route
  -> explicit system target
  -> source-owned projection update or outbound adapter
```

Payload value must be a temporary ModelTable record array.

## 8. Composer Action Whitelist

The next implementation may support only explicit action kinds:

| Action | Payload kind | Required records | Notes |
|---|---|---|---|
| refresh | `mgmt_bus_console.refresh.v1` | `source_model_id` | already implemented by 0339 |
| send | `mgmt_bus_console.send.v1` | `source_model_id`, `draft` | already implemented by 0339; may add `selected_subject_id` |
| inspect | `mgmt_bus_console.inspect.v1` | `source_model_id`, `selected_event_id` | optional; only if local projection is insufficient |
| retry | `mgmt_bus_console.retry.v1` | `source_model_id`, `event_id`, `op_id` | future-only; must reject if target action is not retryable |
| route_probe | `mgmt_bus_console.route_probe.v1` | `source_model_id`, `route_key` | future-only; must not mutate route truth |

Forbidden:
- arbitrary `action` strings.
- object-envelope payloads.
- generic CRUD names such as `create`, `update`, `delete`, `patch`.

Future work that needs similar user-visible behavior must define a concrete, domain-specific whitelisted action with a specific payload kind. It must not reuse CRUD names as Console actions.

## 9. UI Component Policy

The next implementation should first use existing cellwise components:
- `Table` for subjects, timeline rows, route rows, and inspector key/value rows.
- `Terminal` for raw-looking redacted text fallback.
- `Tabs` for Event / Route / Payload inspector regions.
- `Input` and `Button` for composer.
- `StatusBadge` for route and event status.

Dedicated components are allowed only after the implementation proves existing components are insufficient.

If introduced, each dedicated component requires:
- a UI model label contract.
- renderer mapping tests.
- cellwise authoring docs update.
- browser verification on `http://127.0.0.1:30900/#/workspace`.

Candidate components remain:
- `RoomList`
- `EventTimeline`
- `EventInspector`
- `Composer`

## 10. Validation Contract For Later Implementation

A later implementation iteration should add tests that fail on the old / wrong path:
- event rows render from source-owned Model `-2` labels.
- changing source event rows updates Console without writing event truth into `1036`.
- local selection changes only local UI state and does not call `/bus_event`.
- formal inspect / refresh / send actions call `/bus_event` with ModelTable record arrays.
- invalid action kind and object-envelope payloads are rejected.
- event rows and inspector output redact exact secret keys/types and value patterns.
- browser resources include zero `/_matrix/client` requests.
- MBR generic CRUD rejection remains green.

## 11. Risks
- Event rows can accidentally become a second truth store if copied into `1036`.
- Inspector detail can leak secrets if it displays raw Matrix / MBR payloads.
- Local selection can be mistaken for business ingress and over-route through Model 0.
- Adding dedicated components too early can hide business rules inside frontend code.
- Retry / route-probe can become generic CRUD unless strictly whitelisted.

## 12. Done Criteria For This Planning Iteration
- `docs/ITERATIONS.md` registers `0340-mgmt-bus-console-event-projection-contract`.
- This plan defines event row schema, inspector shape, selection/action boundary, composer action whitelist, component policy, and validation contract.
- `resolution.md` defines executable later implementation steps.
- `runlog.md` records planning facts and sub-agent review result.
- No implementation code is changed.
