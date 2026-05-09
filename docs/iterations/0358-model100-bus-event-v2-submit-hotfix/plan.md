---
title: "0358 Model 100 Bus Event V2 Submit Hotfix Plan"
doc_type: iteration_plan
status: completed
updated: 2026-05-06
source: ai
iteration: 0358-model100-bus-event-v2-submit-hotfix
---

# Iteration 0358-model100-bus-event-v2-submit-hotfix Plan

## Goal

- Fix the local browser regression where Workspace `E2E 颜色生成器` accepts a `Generate Color` click but does not change the rendered color.
- Align the Model 100 submit UI with the current hard-cut route: UI event -> Model 0 `pin.bus.in` -> `pin.connect.cell` -> mounted Model 100 -> Model 0 egress -> Matrix/MBR/MQTT -> result materialization.

## Scope

- In scope:
- Model 100 cellwise submit button binding in the seeded positive-model patches.
- Server-side `bus_event_v2` ingress validation for Model 0 bus-in keys that are declared as Model 0 route sources.
- Deterministic contract tests and local browser verification.
- Out of scope:
- Redesigning the color generator UI.
- Changing worker color generation semantics.
- Reintroducing any legacy `pin.connect.model`, `pin.log.*`, or prefix endpoint compatibility.

## Invariants / Constraints

- Pin connection contract remains hard-cut: no `pin.connect.model`; cross-cell routing uses `pin.connect.cell`.
- Browser business submit must enter Model 0 `pin.bus.in`, not directly send Matrix and not directly mutate business truth.
- Pin payloads are temporary ModelTable record arrays; persistence happens only through explicit materialization.
- Existing direct slide importer legacy paths stay retired.

## Success Criteria

- Local snapshot has no `pin.connect.model` labels and Model 0 route sources are `pin.connect.cell`.
- `Generate Color` emits `bus_event_v2` to `bus_event_submit_100_0_0_0`.
- Local deployment is ready and the real browser shows a changed color after clicking `Generate Color`.
- Existing slide app workspace/static HTML demo still opens and its input + submit display behavior works in the browser.

## Inputs

- Created at: 2026-05-06
- Iteration ID: 0358-model100-bus-event-v2-submit-hotfix
