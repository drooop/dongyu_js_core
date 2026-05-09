---
title: "0358 Model 100 Bus Event V2 Submit Hotfix Resolution"
doc_type: iteration_resolution
status: completed
updated: 2026-05-06
source: ai
iteration: 0358-model100-bus-event-v2-submit-hotfix
---

# Iteration 0358-model100-bus-event-v2-submit-hotfix Resolution

## Execution Strategy

- Make the smallest contract-aligned change: migrate the Model 100 submit button from a direct positive-model pin write to `bus_event_v2` targeting the existing Model 0 bus-in route key.
- Avoid broad compatibility changes. The server should allow dynamic `bus_event_v2` keys only when Model 0 already declares a `pin.connect.cell` route source for that key.
- Rebuild, redeploy locally, then verify with Playwright on the real Workspace page.

## Step 1

- Scope: Contract and model-table patch update.
- Files: `packages/ui-model-demo-server/server.mjs`, `packages/worker-base/system-models/test_model_100_ui.json`, `packages/worker-base/system-models/workspace_positive_models.json`, focused contract tests.
- Verification: targeted Node contract tests for Model 100 bus event binding and pin hard-cut.
- Acceptance: Model 100 submit binding uses `bus_event_v2` and the server admits only declared Model 0 route-source bus-in keys.
- Rollback: revert this iteration branch.

## Step 2

- Scope: Local deployment and browser evidence.
- Files: runtime build artifacts only.
- Verification: `check_runtime_baseline.sh`, snapshot conformance check, Playwright click-through for Workspace color generator and slide app/static HTML demo.
- Acceptance: Browser-visible color changes after `Generate Color`; slide app flow opens and submit demo updates display.
- Rollback: redeploy previous `dev` image/assets.

## Notes

- Browser verification:
  - Workspace color generator changed `#ed37c9` to `#e07d8b` after clicking `Generate Color`.
  - Minimal submit interactive guide changed `Waiting for submit` to `Submitted: codex static html submit`.
  - Workspace slide-app creation produced `Codex Slide Verify 0506` and the created app opened from the asset tree.
- Deployed snapshot verification: no `pin.connect.model`, no legacy prefix endpoints, no `pin.log.*`, and Model 100 submit enters Model 0 through `bus_event_submit_100_0_0_0`.
