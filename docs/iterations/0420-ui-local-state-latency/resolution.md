---
title: "Iteration 0420 UI Local State Latency Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-06-22
source: ai
iteration_id: 0420-ui-local-state-latency
id: 0420-ui-local-state-latency
phase: completed
---

# Iteration 0420-ui-local-state-latency Resolution

## Execution Strategy

Use TDD and small reviewable stages. First add deterministic tests that reproduce the queueing contract and metrics requirements. Then separate local-only UI state synchronization from the formal business event queue. Finally verify in a real authenticated browser and record before/after latency.

Key design:
- Formal business events (`/bus_event`) keep their existing `sendQueue` ordering.
- Local-only UI state synchronization (`/ui_event`) uses a separate low-priority background queue.
- Submit overlays remain correctness-critical and must still be resolved before formal submit dispatch.
- Startup should avoid showing a misleading guest/read-only state while auth session discovery is still in progress.

## Step 1 — RED Contract Tests And Baseline Evidence

- Scope:
  - Add failing tests for local-only `/ui_event` not blocking `/bus_event`.
  - Add tests that preserve submit overlay correctness and local-only Dialog/Tabs behavior.
  - Record the current browser baseline in `runlog.md`.
- Files:
  - Create or modify: `scripts/tests/test_0420_ui_local_state_latency_contract.mjs`
  - Modify: `docs/iterations/0420-ui-local-state-latency/runlog.md`
- Verification:
  - `node scripts/tests/test_0420_ui_local_state_latency_contract.mjs`
  - Expected before implementation: fails because local-only background sync still shares or blocks the formal send path.
- Acceptance:
  - The RED failure proves the existing bottleneck or missing contract.
  - Runlog contains baseline metrics and browser/network evidence.
- Rollback:
  - Delete the new test file and revert runlog edits.

## Step 2 — Separate Local UI Sync From Formal Business Queue

- Scope:
  - Change frontend remote store queueing so local-only `/ui_event` background sync does not block `/bus_event`.
  - Preserve explicit overlay submit behavior.
  - Preserve server-side `/ui_event` behavior; only scheduling and priority should change.
- Files:
  - Modify: `packages/ui-model-demo-frontend/src/remote_store.js`
  - Modify: `scripts/tests/test_0420_ui_local_state_latency_contract.mjs`
  - Modify: `docs/iterations/0420-ui-local-state-latency/runlog.md`
- Verification:
  - `node scripts/tests/test_0420_ui_local_state_latency_contract.mjs`
  - `node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs`
  - `node scripts/tests/test_0412_local_latency_trace_contract.mjs`
- Acceptance:
  - Formal `/bus_event` can dispatch without waiting for already queued local-only `/ui_event`.
  - Input default local overlay and submit-current-visible-value contracts still pass.
  - Local-only state still patches the browser immediately.
- Rollback:
  - Revert `remote_store.js` and the 0420 test changes.

## Step 3 — Auth Startup And First Usable App Display

- Scope:
  - Remove or reduce the misleading guest/read-only startup flash after a valid SSO session exists.
  - Ensure authenticated runtime startup does not leave the selected app indefinitely on "正在加载滑动 APP...".
  - Keep guest/read-only behavior for genuinely unauthenticated visitors.
- Files:
  - Modify: `packages/ui-model-demo-frontend/src/auth_store.js`
  - Modify: `packages/ui-model-demo-frontend/src/main.js` or `packages/ui-model-demo-frontend/src/demo_app.js`
  - Modify: `scripts/tests/test_0420_ui_local_state_latency_contract.mjs`
  - Modify: `docs/iterations/0420-ui-local-state-latency/runlog.md`
- Verification:
  - `node scripts/tests/test_0420_ui_local_state_latency_contract.mjs`
  - `node scripts/tests/test_0403_oidc_session_gateway.mjs`
- Acceptance:
  - Authenticated startup does not present a stable guest/read-only unavailable state while auth check is in progress.
  - Guest users still see the intended read-only/login UI.
  - First app content timing is measured again in browser and recorded.
- Rollback:
  - Revert startup/auth frontend changes and the related test expectations.

## Step 4 — Local Deploy And Real Browser Latency Verification

- Scope:
  - Build and redeploy the affected local frontend/server image or local stack path.
  - Use the existing Chrome authenticated session or a real browser SSO session.
  - Measure the same latency metrics as the baseline.
- Files:
  - Modify: `docs/iterations/0420-ui-local-state-latency/runlog.md`
  - Optional assets: `docs/iterations/0420-ui-local-state-latency/assets/`
- Verification:
  - `npm -C packages/ui-model-demo-frontend run build`
  - Local deploy command used by the current stack.
  - Real browser measurements for first app content, Dialog open/close, Tab switch, Input fill, and network timing.
- Acceptance:
  - Browser metrics show the improved or remaining latency clearly.
  - No outer/inner scroll regression is introduced on tested screens.
  - Any remaining bottleneck is explicitly named.
- Rollback:
  - Roll back the local deployment to the previous image/build if needed.

## Step 5 — Final Review, Docs Assessment, And Completion

- Scope:
  - Run regression tests.
  - Perform sub-agent code review on the full 0420 diff.
  - Assess whether SSOT/user-guide docs need updates.
  - Update `docs/ITERATIONS.md` status when complete.
- Files:
  - Modify: `docs/iterations/0420-ui-local-state-latency/runlog.md`
  - Modify: `docs/ITERATIONS.md`
- Verification:
  - `node scripts/tests/test_0420_ui_local_state_latency_contract.mjs`
  - `node scripts/tests/test_0417_user_isolated_ui_state_projection_contract.mjs`
  - `node scripts/tests/test_0418_visible_snapshot_projection_latency_contract.mjs`
  - `node scripts/tests/test_0376_control_first_mbr_routing_contract.mjs`
  - Browser smoke for To Do Board and E2E Color Generator readiness state.
- Acceptance:
  - Sub-agent review returns Approved or all findings are fixed and re-reviewed.
  - Runlog includes final latency comparison table.
  - Iteration status is updated with factual completion evidence.
- Rollback:
  - Revert 0420 implementation commits and restore previous docs status.

## Notes

- Generated at: 2026-06-22
- Each step must be reviewed by a sub-agent using `codex-code-review` before the next step begins.
- Review findings must be addressed until the review decision is Approved or findings are explicitly proven not applicable.
