---
title: "0360 Minimal Submit Docs And Remote Deploy Plan"
doc_type: iteration_plan
status: in_progress
updated: 2026-05-07
source: ai
iteration: 0360-minimal-submit-docs-and-remote-deploy
---

# Iteration 0360-minimal-submit-docs-and-remote-deploy Plan

## Goal

- Rewrite the slide-app-runtime provider docs so the HTML and Markdown examples are centered on the real `最小 Submit 双总线示例`, not the earlier local-only static preview.
- Explain how a newly created remote-worker `R1` should fill the example model table, including the fill process, label meanings, and final content.
- Explain how Workspace `滑动 APP 导入` triggers the slide process, what the zip contains, and how to prepare it.
- Explain how another Matrix/MQTT client can observe and simulate the dual-bus submit/result messages, including exact topics and payloads.
- Confirm local MBR and local remote-worker are on the current pin/data contract with no historical compatibility route for this example, then publish the updated docs to `app.dongyudigital.com`.

## Scope

- In scope:
- `minimal_submit_app_provider_guide.md`, `minimal_submit_app_provider_visualized.md`, and `minimal_submit_app_provider_interactive.html`.
- Deterministic contract checks for the updated docs and the local MBR/remote-worker 1050 contracts.
- Local deployment/sync verification and real-browser Workspace verification.
- Remote deployment/sync verification and real-browser public docs verification.
- Out of scope:
- Redesigning the runtime semantics of model 1050.
- Adding compatibility aliases or fallbacks for old `pin.connect.model` / `ctx.*` routes.
- Changing remote cluster runtime services or network infrastructure.

## Invariants / Constraints

- Pin payloads remain temporary ModelTable record arrays; persistence only happens through explicit materialization by the owning model/runtime.
- UI remains cellwise ModelTable projection; the docs must not teach whole-page HTML as the app source of truth.
- Official submit path remains `UI -> Model 0 -> Matrix -> MBR -> MQTT -> remote-worker -> MQTT -> MBR -> Matrix -> ui-server -> UI model`.
- No new example may use `pin.connect.model`, `ctx.writeLabel`, `ctx.getLabel`, or direct UI business-state writes.
- Remote operations must stay within the allowed deployment surface in `CLAUDE.md`.

## Success Criteria

- The HTML guide clearly documents the `最小 Submit 双总线示例`, `R1` remote-worker fill-table content, Workspace `滑动 APP 导入`, and external submit/result topic testing.
- The Markdown guide and visualized guide contain the same operational facts and exact topic/payload examples.
- Contract tests pass and enforce the new docs content plus no legacy route surface in MBR/remote-worker 1050 assets.
- Local deployment is refreshed, local Workspace still runs the slide app example successfully in a real browser, and the docs are reachable locally.
- `https://app.dongyudigital.com` serves the updated HTML docs, verified with a real browser.

## Inputs

- Created at: 2026-05-07
- Iteration ID: 0360-minimal-submit-docs-and-remote-deploy
