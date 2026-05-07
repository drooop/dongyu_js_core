---
title: "0360 Minimal Submit Docs And Remote Deploy Runlog"
doc_type: iteration_runlog
status: in_progress
updated: 2026-05-07
source: ai
iteration: 0360-minimal-submit-docs-and-remote-deploy
---

# Iteration 0360-minimal-submit-docs-and-remote-deploy Runlog

## Environment

- Date: 2026-05-07
- Branch: `dev_0360-minimal-submit-docs-and-remote-deploy`
- Runtime targets: local `http://127.0.0.1:30900`, remote `https://app.dongyudigital.com`
- Review Gate Record
- Iteration ID: 0360-minimal-submit-docs-and-remote-deploy
- Review Date: 2026-05-07
- Review Type: User-directed execution
- Review Index: 1
- Decision: Approved
- Notes: User requested rewriting the HTML/Markdown docs around the real minimal Submit dual-bus example, validating local MBR/remote-worker new spec conformance, and publishing the updated docs to the remote server.

## Execution Records

### Step 1

- Command: create 0360 iteration plan/resolution/runlog and register in `docs/ITERATIONS.md`.
- Key output: `0360-minimal-submit-docs-and-remote-deploy` added to iteration index with branch `dev_0360-minimal-submit-docs-and-remote-deploy`.
- Result: PASS.
- Commit: pending

### Step 2

- Command: rewrite `minimal_submit_app_provider_guide.md`, `minimal_submit_app_provider_visualized.md`, and `minimal_submit_app_provider_interactive.html`.
- Key output: docs now center on `最小 Submit 双总线示例`, `R1`, Workspace `滑动 APP 导入`, `minimal-submit-dual-bus.zip`, `dy.bus.v0`, `@mbr:<host_url>`, `UIPUT/ws/dam/pic/de/sw/1050/submit`, and `UIPUT/ws/dam/pic/de/sw/1050/result`.
- Result: PASS.
- Commit: pending

### Step 3

- Command: remove old `input_value` fallback from `deploy/sys-v1ns/remote-worker/patches/13_model1050_minimal_submit.json`.
- Key output: `on_minimal_submit_matrix_remote_submit` now reads only the current `text` record.
- Result: PASS.
- Commit: pending

### Step 4

- Command: `node scripts/tests/test_0351_slide_app_minimal_provider_guide_contract.mjs`
- Key output: `4 passed, 0 failed out of 4`
- Result: PASS.
- Commit: pending

### Step 5

- Command: `node scripts/tests/test_0352_slide_app_provider_visualized_docs_contract.mjs`
- Key output: `5 passed, 0 failed out of 5`
- Result: PASS.
- Commit: pending

### Step 6

- Command: `node scripts/tests/test_0353_slide_app_runtime_docs_publish_contract.mjs`
- Key output: `5 passed, 0 failed out of 5`
- Result: PASS.
- Commit: pending

### Step 7

- Command: `node scripts/tests/test_0360_minimal_submit_dual_bus_docs_contract.mjs`
- Key output: `3 passed, 0 failed out of 3`
- Result: PASS.
- Commit: pending

### Step 8

- Command: `node scripts/tests/test_0359_minimal_submit_matrix_e2e_contract.mjs`
- Key output: `PASS test_0359_minimal_submit_matrix_e2e_contract passed=5`
- Result: PASS.
- Commit: pending

### Step 9

- Command: `node scripts/tests/test_0357_pin_connection_hard_cut.mjs`
- Key output: all hard-cut checks PASS, including `removed_pin_connect_model_is_rejected`.
- Result: PASS.
- Commit: pending

### Step 10

- Command: `node scripts/validate_mbr_patch_v0.mjs`
- Key output: `TOTAL: 49  PASS: 49  FAIL: 0`
- Result: PASS.
- Commit: pending

### Step 11

- Command: `rg -n "pin\\.connect\\.model|ctx\\.(writeLabel|getLabel|rmLabel)|input_value" deploy/sys-v1ns/mbr deploy/sys-v1ns/remote-worker/patches/13_model1050_minimal_submit.json deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json`
- Key output: no matches.
- Result: PASS. Target local MBR and local remote-worker 1050/config assets have no legacy model route, no legacy ctx label APIs, and no `input_value` fallback.
- Commit: pending

### Step 12

- Command: `npm -C packages/ui-model-demo-frontend run build`
- Key output: Vite build completed successfully.
- Result: PASS.
- Commit: pending

### Step 13

- Command: `git diff --check`
- Key output: no whitespace errors.
- Result: PASS.
- Commit: pending

### Step 14

- Command: `SKIP_IMAGE_BUILD=1 SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
- Key output: `=== Local deploy complete ===`, `UI Server: http://localhost:30900`.
- Result: PASS.
- Commit: pending

### Step 15

- Command: `bash scripts/ops/check_runtime_baseline.sh`
- Key output: all local deployments ready; mbr-worker/ui-server Matrix patch secrets ready; `baseline ready`.
- Result: PASS.
- Commit: pending

### Step 16

- Command: Playwright opened `http://127.0.0.1:30900/p/slide-app-runtime-minimal-submit-provider/`, filled the preview input with `browser local doc check`, and clicked `Submit`.
- Key output: browser displayed `Submitted: browser local doc check`; HTML page title is `最小 Submit 双总线示例`.
- Result: PASS.
- Commit: pending

### Step 17

- Command: Playwright opened `http://127.0.0.1:30900/#/workspace`, opened `最小 Submit 双总线示例`, filled `dual bus doc deploy local 0360`, and clicked `Submit`.
- Key output: browser displayed `Submitted: dual bus doc deploy local 0360`; status displayed `remote_processed`.
- Result: PASS.
- Commit: pending

### Step 18

- Command: publish a valid external MQTT result message to `UIPUT/ws/dam/pic/de/sw/1050/result`, then inspect browser and snapshot.
- Key output: browser displayed `Submitted: manual external topic 0360`; ui-server logged `manual_result_1050_0360_...` routed via owner materialization.
- Result: PASS.
- Commit: pending

## Docs Updated

- [x] `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md` updated
- [x] `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_visualized.md` updated
- [x] `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_interactive.html` updated
