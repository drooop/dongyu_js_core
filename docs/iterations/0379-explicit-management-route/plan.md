---
title: "0379 - Explicit Management Route Plan"
doc_type: iteration-plan
status: completed
updated: 2026-05-19
source: ai
iteration_id: 0379-explicit-management-route
id: 0379-explicit-management-route
phase: completed
---

# Iteration 0379-explicit-management-route Plan

## Goal

Allow imported slide apps to explicitly choose the management-bus route when UI Server cannot directly reach the target control-bus MQTT service.

The target behavior is:

```text
UI Server
  -> pin.bus.mb.out / management bus
  -> MBR
  -> pin.bus.cb.out / control bus
  -> Remote Worker
```

Default behavior must remain unchanged:

```text
UI Server
  -> pin.bus.cb.out / control bus
  -> MBR / MQTT
  -> Remote Worker
```

## Scope

In scope:

- Extend `remote_bus_endpoint_v1` so it may declare `route_kind = "control" | "management"`.
- Preserve `route_kind` through slide-app export and import.
- Generate imported host egress as `pin.bus.cb.out` for `control` and `pin.bus.mb.out` for `management`.
- Ensure generated `bus_send.v1` records carry matching `bus` and `route_kind`.
- Keep the endpoint topic as payload truth. MBR must still route by the `topic` record, not by reply target or legacy route fields.
- Add deterministic tests for both default control behavior and explicit management behavior.
- Run local browser verification with a management-routed imported slide app.

Out of scope:

- Remote Worker state partitioning (`remote_state_scope`); this remains in `docs/plans/current-stage-todo.md`.
- Cross-workspace MBR-to-MBR routing beyond the existing single-workspace test surface.
- Any compatibility path for removed keys such as `return_topic`, `result_topic`, `route.reply_to`, or `to.pin`.
- Opening Remote Worker MQTT directly from UI Server when `route_kind = "management"`.

## Invariants / Constraints

- Formal pin payloads must remain Temporary ModelTable record arrays.
- UI / imported slide apps must not declare `pin.bus.cb.*` or `pin.bus.mb.*` directly inside the ZIP payload. Host-owned adapters generate those labels during installation.
- Positive slide app models must not bypass Model 0 or directly send Matrix / MQTT traffic.
- `remote_bus_endpoint_v1.to.pin` remains forbidden. The endpoint pin is still derived from `dual_bus_model.egress_pins` and the current root `pin.out`.
- Missing `route_kind` defaults to `control`.
- Invalid `route_kind` must be rejected, not silently coerced.
- `management` must be explicit and visible in the generated ModelTable records.

## Success Criteria

- Existing control-route examples still install and run unchanged.
- A slide app with `remote_bus_endpoint_v1.route_kind = "management"` installs successfully and generates:
  - Model 0 host egress label with `t = pin.bus.mb.out`.
  - `bus_send.v1` records with `bus = "management"` and `route_kind = "management"`.
  - A valid endpoint `topic` such as `UIPUT/ws/dam/pic/de/sw/R1/100/submit`.
- MBR receives a management request and forwards it to the control bus by payload topic.
- MQTT response for a management-routed request returns through management bus and materializes into the correct local `reply_target_model_id`.
- Deterministic tests cover parser/import/export/egress/MBR routing.
- Local deployment baseline is ready.
- Playwright browser test verifies an installed management-routed slide app completes a Remote Worker round trip and updates its local label state.
- A sub-agent `codex-code-review` pass reports no blocking findings.

## Inputs

- Created at: 2026-05-18
- Iteration ID: 0379-explicit-management-route
- Branch: `dropx/dev_0379-explicit-management-route`
- Planning source: `docs/plans/current-stage-todo.md`, section "显式指定走管理总线"
