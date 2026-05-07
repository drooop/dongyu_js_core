---
title: "0360 Minimal Submit Docs And Remote Deploy Runlog"
doc_type: iteration_runlog
status: completed
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
- Commit: `12ae4fc`

### Step 19

- Command: `git commit -m "docs(slide): publish minimal submit dual bus guide [0360]"`
- Key output: committed the docs rewrite, R1 remote-worker `text`-only handler, docs UI entry, contract tests, and iteration scaffolding.
- Result: PASS.
- Commit: `12ae4fc`

### Step 20

- Command: remote SSH/rke2 preflight via `drop@124.71.43.80`.
- Key output: SSH login, remote repo path, passwordless sudo, and `remote_preflight_guard.sh` all passed.
- Result: PASS.
- Commit: `12ae4fc`

### Step 21

- Command: `bash scripts/ops/sync_cloud_source.sh --ssh-user drop --ssh-host 124.71.43.80 --remote-repo /home/wwpic/dongyuapp --remote-repo-owner wwpic --revision 12ae4fc`
- Key output: remote git checkout was unavailable for the local branch revision, so the script used its archive fallback and wrote `.deploy-source-revision=12ae4fc`.
- Result: PASS.
- Commit: `12ae4fc`

### Step 22

- Command: deploy cloud `ui-server`, `mbr-worker`, and `remote-worker` with `scripts/ops/deploy_cloud_app.sh --revision 12ae4fc`.
- Key output: all three deployments completed; source hash gates passed for each target.
- Result: PASS.
- Commit: `12ae4fc`

### Step 23

- Command: Playwright opened `https://app.dongyudigital.com/p/slide-app-runtime-minimal-submit-provider/`, filled the docs preview with `remote docs browser 0360`, and clicked `Submit`.
- Key output: browser displayed `Submitted: remote docs browser 0360`; static HTML title is `最小 Submit 双总线示例`.
- Result: PASS.
- Commit: `12ae4fc`

### Step 24

- Command: Playwright opened remote Workspace and selected `最小 Submit 双总线示例`.
- Key output: first remote Workspace run showed `Model 1050 is not mounted into Workspace`; snapshot inspection showed remote persisted Model 0 `(2,0,20)` already mounted a user/imported model `1041`, colliding with the 1050 canonical mount.
- Result: FAIL -> fixed in Step 25.
- Commit: `12ae4fc`

### Step 25

- Command: move Model 1050 canonical mount from Model 0 `(2,0,20)` to reserved mount `(9,0,1050)` and strengthen `test_0359_minimal_submit_matrix_e2e_contract.mjs`.
- Key output: `node scripts/tests/test_0359_minimal_submit_matrix_e2e_contract.mjs`, `node scripts/tests/test_0360_minimal_submit_dual_bus_docs_contract.mjs`, `node scripts/tests/test_0353_slide_app_runtime_docs_publish_contract.mjs`, `git diff --check`, local deploy, baseline check, and local Playwright Workspace submit all passed.
- Result: PASS. Local browser displayed `Submitted: local reserved mount 0360`.
- Commit: `157b922`

### Step 26

- Command: sync and deploy cloud `ui-server` with `--revision 157b922`.
- Key output: archive source sync wrote `.deploy-source-revision=157b922`; cloud `ui-server` deploy completed; source hash gate passed.
- Result: PASS.
- Commit: `157b922`

### Step 27

- Command: Playwright opened `https://app.dongyudigital.com/?v=0360mount2#/workspace`, opened `最小 Submit 双总线示例`, filled `remote reserved mount 0360`, and clicked `Submit`.
- Key output: browser displayed `Submitted: remote reserved mount 0360`; status displayed `remote_processed`.
- Result: PASS.
- Commit: `157b922`

### Step 28

- Command: inspect remote route evidence and conformance.
- Key output: MBR logs show Matrix payload -> `UIPUT/ws/dam/pic/de/sw/1050/submit` -> `UIPUT/ws/dam/pic/de/sw/1050/result`; remote-worker logs show inbound `text=remote reserved mount 0360` and result payload; ui-server logs show owner materialization to model `1050`; `/snapshot` shows Model 0 `(9,0,1050)` mounted to `1050`; targeted remote MBR/remote-worker assets have no `pin.connect.model`, no old `ctx.*Label`, and no `input_value` fallback.
- Result: PASS.
- Commit: `157b922`

## Docs Updated

- [x] `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md` updated
- [x] `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_visualized.md` updated
- [x] `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_interactive.html` updated

## Final Status

- [x] Local deployment verified.
- [x] Remote deployment verified.
- [x] Static HTML docs published at `https://app.dongyudigital.com/p/slide-app-runtime-minimal-submit-provider/`.
- [x] Workspace `最小 Submit 双总线示例` verified with real browser and remote logs.
- [x] Targeted MBR/remote-worker 1050 path verified with no compatibility route.
