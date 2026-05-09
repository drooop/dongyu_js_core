---
title: "0359 Matrix Submit Example E2E Plan"
doc_type: iteration_plan
status: in_progress
updated: 2026-05-06
source: ai
iteration: 0359-matrix-submit-example-e2e
---

# Iteration 0359-matrix-submit-example-e2e Plan

## Goal

- Replace the static-only minimal submit demo with a real Workspace slide app example that sends a submit event through Matrix/MBR/MQTT and receives a remote-worker result back into the UI label.
- Clean up the locally created test slide app name so no visible app name contains `Codex`.
- Re-check the locally deployed color generator in the real browser and fix any remaining no-change regression before reporting.

## Scope

- In scope:
- New or updated seeded ModelTable records for a minimal submit app with `Input + Submit + Display Label`.
- Model 0 `pin.bus.in` route, MBR route, and remote-worker program model needed for the new example.
- User-guide Markdown and interactive/visualized docs under `docs/user-guide/slide-app-runtime/`.
- Deterministic contract tests, local deployment, and Playwright browser verification at `http://127.0.0.1:30900/#/workspace`.
- Cleanup of local runtime state for the previously created `Codex Slide Verify 0506` test artifact.
- Out of scope:
- Remote cloud deployment to `app.dongyudigital.com`.
- Redesigning the color generator visual layout.
- Reintroducing legacy `pin.connect.model`, direct frontend Matrix send, direct business-state writes, or compatibility paths.

## Invariants / Constraints

- UI model remains cellwise ModelTable truth; frontend renders projection only.
- Official business submit must enter Model 0 through `bus_event_v2` and a declared `pin.connect.cell` route source.
- Pin payloads are temporary ModelTable record arrays; persistence is explicit materialization after the owning model accepts a result.
- The minimal submit example must prove actual roundtrip: UI click -> Model 0 -> Matrix -> MBR -> MQTT -> remote-worker -> MQTT -> MBR -> Matrix -> ui-server -> owning UI model label update.
- No `Codex` branding may remain in the visible local slide app name created during verification.

## Success Criteria

- Workspace `E2E 颜色生成器` is deployed locally and a fresh browser click changes the visible color value.
- Workspace includes a minimal submit Matrix example whose initial display is `Waiting for submit`.
- Typing a unique value and clicking `Submit` changes the display to `Submitted: <value>` through the actual Matrix/MBR/MQTT/remote-worker chain.
- MBR and remote-worker logs show the example submit/result topics for the same browser test.
- The slide-app-runtime guide documents the real route, topics, full ModelTable records, and remote submit program behavior.
- Deterministic tests and frontend build pass.

## Inputs

- Created at: 2026-05-06
- Iteration ID: 0359-matrix-submit-example-e2e
