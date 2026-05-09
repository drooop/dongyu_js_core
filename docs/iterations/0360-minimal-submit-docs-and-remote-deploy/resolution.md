---
title: "0360 Minimal Submit Docs And Remote Deploy Resolution"
doc_type: iteration_resolution
status: completed
updated: 2026-05-07
source: ai
iteration: 0360-minimal-submit-docs-and-remote-deploy
---

# Iteration 0360-minimal-submit-docs-and-remote-deploy Resolution

## Execution Strategy

- First freeze the iteration record and acceptance criteria so the docs/deploy work is auditable.
- Rewrite the provider-facing docs around the already tested real dual-bus example, keeping the static preview clearly marked as documentation aid only.
- Add a focused contract test that fails if the docs omit `R1`, the Workspace import process, exact submit/result topics, Matrix/MQTT test payloads, or if the 1050 MBR/remote-worker path regresses to a legacy route.
- Redeploy/sync locally and remotely, then verify with real browser pages instead of only file checks.

## Step 1

- Scope: Iteration registration and plan/resolution/runlog setup.
- Files: `docs/ITERATIONS.md`, `docs/iterations/0360-minimal-submit-docs-and-remote-deploy/`.
- Verification: iteration index contains 0360 and the runlog records the user-directed approval.
- Acceptance: subsequent docs and deployment work has a registered iteration.
- Rollback: remove the 0360 index row and iteration directory before execution if cancelled.

## Step 2

- Scope: Provider docs rewrite.
- Files: `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md`, `minimal_submit_app_provider_visualized.md`, `minimal_submit_app_provider_interactive.html`.
- Verification: new docs contract test and browser load of the HTML guide.
- Acceptance: docs explain `R1` fill table, zip/import flow, submit/result topics, and external Matrix/MQTT test payloads.
- Rollback: revert the three docs files.

## Step 3

- Scope: Contract and conformance guard.
- Files: `scripts/tests/`.
- Verification: targeted test suite for docs content and no legacy 1050 MBR/remote-worker path.
- Acceptance: checks fail on `pin.connect.model`, `ctx.writeLabel/getLabel/rmLabel`, or missing operational topics/payloads.
- Rollback: remove the new test file.

## Step 4

- Scope: Local deployment and browser verification.
- Files: deployment/runtime state only.
- Verification: local deploy script, baseline check, Playwright opens local docs and runs Workspace minimal submit example.
- Acceptance: local docs are visible and local example still changes to `Submitted: <value>` through the live chain.
- Rollback: redeploy previous local commit/assets.

## Step 5

- Scope: Remote publish and public browser verification.
- Files: remote deployment/runtime state only, plus the reserved Model 1050 hierarchy mount fix.
- Verification: allowed cloud deploy/sync commands; Playwright opens `https://app.dongyudigital.com` docs page and remote Workspace; remote MBR/remote-worker/ui-server logs confirm the 1050 submit/result roundtrip.
- Acceptance: remote HTML guide shows the updated minimal dual-bus example content, and remote Workspace displays `Submitted: remote reserved mount 0360` after Submit.
- Rollback: redeploy previous committed assets.

## Final Outcome

- The provider docs now describe the real `最小 Submit 双总线示例`, including `R1` fill-table content, Workspace `滑动 APP 导入`, zip contents, exact Matrix/MQTT topics, and test payloads.
- The interactive HTML docs are published at `https://app.dongyudigital.com/p/slide-app-runtime-minimal-submit-provider/`.
- The local and remote targeted MBR/remote-worker 1050 assets have no `pin.connect.model`, no legacy `ctx.writeLabel/getLabel/rmLabel`, and no `input_value` fallback.
- Remote Workspace was browser-tested end to end: UI submit entered Model 0, MBR published `UIPUT/ws/dam/pic/de/sw/1050/submit`, remote-worker R1 returned `UIPUT/ws/dam/pic/de/sw/1050/result`, and the UI model rendered `Submitted: remote reserved mount 0360`.
- During remote verification, Model 1050 initially collided with an imported app mount at Model 0 `(2,0,20)`; the canonical mount is now reserved at `(9,0,1050)` and covered by contract test.

## Notes

- Remote cluster runtime/network mutation is not needed and remains forbidden.
