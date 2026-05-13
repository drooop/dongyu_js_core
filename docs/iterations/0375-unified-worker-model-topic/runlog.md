---
title: "0375 - Unified Worker Model Topic Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-05-13
source: ai
iteration_id: 0375-unified-worker-model-topic
id: 0375-unified-worker-model-topic
phase: execution
---

# Iteration 0375-unified-worker-model-topic Runlog

## Environment

- Date: 2026-05-12
- Branch: `dev_0375-unified-worker-model-topic`
- Runtime: local repository planning phase; no runtime process changed yet.

Review Gate Record
- Iteration ID: 0375-unified-worker-model-topic
- Review Date: 2026-05-12
- Review Type: AI-assisted plan review
- Review Index: 1
- Decision: Change Requested
- Notes: Plan draft missed explicit payload reply target records, return_topic prohibition, full topic assertions, and trace-based verification.

Review Gate Record
- Iteration ID: 0375-unified-worker-model-topic
- Review Date: 2026-05-12
- Review Type: AI-assisted plan review
- Review Index: 2
- Decision: Change Requested
- Notes: Revised plan still needed to specify Temporary ModelTable record-array metadata, exact topic segment assertions, and trace acceptance details.

Review Gate Record
- Iteration ID: 0375-unified-worker-model-topic
- Review Date: 2026-05-12
- Review Type: AI-assisted plan review
- Review Index: 3
- Decision: Approved
- Notes: Third plan revision approved by sub-agent review. Execution may proceed only after Step 1 docs are reviewed against the recorded contract.

## Execution Records

### Step 1 — Contract Docs And Iteration Gate

- Command: `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0375-unified-worker-model-topic --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Key output: scaffold created `plan.md`, `resolution.md`, and `runlog.md`.
- Result: PASS

### Step 1 Review Attempt 1

- Reviewer: sub-agent `019e1b78-d33f-7b31-91d4-780d8f3ed49f`
- Decision: Change Requested
- Key output: remove loose `source_model_id`, add endpoint records to result example, remove future Step 2 placeholder from runlog.
- Result: PASS for review capture; requested docs fixes applied before re-review.

### Step 1 Review Attempt 2

- Reviewer: sub-agent `019e1b7e-0f6e-79a0-815f-92fb2702bf10`
- Decision: Change Requested
- Key output: remove loose transport `op_id`, remove `UIPUT/out/...` wildcard examples, remove empty runlog placeholders.
- Result: PASS for review capture; requested docs fixes applied before re-review.

### Step 1 Review Attempt 3

- Reviewer: sub-agent `019e1b81-2aab-7a61-8606-1730f29943cb`
- Decision: Approved
- Key output: scoped docs/plan files passed; no runtime code changes found.
- Result: PASS

### Step 2 — Contract Tests First

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 0 passed, 5 failed out of 5; initial RED state found expected old topic shape and route-based split bus behavior, but review requested sharper payload coverage.
- Result: PASS for RED verification

### Step 2 Review Attempt 1

- Reviewer: sub-agent `019e1b88-dd66-77c3-bc10-95fc735afd39`
- Decision: Change Requested
- Key output: fix WorkerEngine runtime mode setup; add new-topic loose top-level field rejection; add missing endpoint/origin/reply metadata rejection.
- Result: PASS for review capture; requested test fixes applied before re-review.

### Step 2 Test Revision

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 0 passed, 9 failed out of 9; failures now cover old topic generation/acceptance, new topic rejection, loose field compatibility, missing metadata, legacy route payload externalization, endpoint-record externalization, and split bus publish.
- Result: PASS for RED verification

### Step 2 Review Attempt 2

- Reviewer: sub-agent `019e1b8d-b45f-7400-a120-a39205164fc0`
- Decision: Change Requested
- Key output: add reply-target materialization tests and missing/extra/old two-segment topic boundary tests.
- Result: PASS for review capture; requested test fixes applied before re-review.

### Step 2 Test Revision 2

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 1 passed, 11 failed out of 12; failures cover the expected old/missing behavior, while the existing no-reply-target non-materialization guard already passes.
- Result: PASS for RED verification

### Step 2 Review Attempt 3

- Reviewer: sub-agent `019e1b93-118d-7d93-88e0-1ed405b8ade6`
- Decision: Change Requested
- Key output: make endpoint model and reply target model distinct in the materialization test.
- Result: PASS for review capture; requested test fix applied before re-review.

### Step 2 Test Revision 3

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 1 passed, 11 failed out of 12; reply-target test now uses distinct endpoint and reply target model ids.
- Result: PASS for RED verification

### Step 2 Review Attempt 4

- Reviewer: sub-agent `019e1b95-e5fd-7a03-a50e-28851647cbcc`
- Decision: Change Requested
- Key output: assert exact transport packet top-level keys and test missing endpoint/origin/reply target metadata independently.
- Result: PASS for review capture; requested test fixes applied before re-review.

### Step 2 Test Revision 4

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 1 passed, 11 failed out of 12; missing endpoint/origin/reply target records are now checked independently, and transport packet keys are asserted exactly.
- Result: PASS for RED verification

### Step 2 Review Attempt 5

- Reviewer: sub-agent `019e1b9a-27cb-72e0-833a-5655188291bf`
- Decision: Change Requested
- Key output: split missing endpoint/origin/reply target metadata checks into independent test functions so later cases still execute during RED.
- Result: PASS for review capture; requested test fix applied before re-review.

### Step 2 Test Revision 5

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 1 passed, 13 failed out of 14; missing endpoint, origin, and reply target metadata each fail as independent RED tests.
- Result: PASS for RED verification

### Step 2 Review Attempt 6

- Reviewer: sub-agent `019e1b9d-2d06-7900-b3ca-17989f0c86dc`
- Decision: Approved
- Key output: Step 2 tests and runlog are adequate; no production/runtime code changes found.
- Result: PASS

### Step 3 — Runtime Hard Cut

- Command: `node --check packages/worker-base/src/runtime.mjs && node --check packages/ui-model-demo-server/server.mjs && node --check scripts/worker_engine_v0.mjs`
- Key output: syntax checks passed.
- Result: PASS

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 24 passed, 0 failed out of 24; includes direct runtime bus out publish to `UIPUT/ws/dam/pic/de/sw/R1/3000/submit`, exact top-level `version/type/payload`, removed `stage2`, removed `uiput_9layer_v2`, rejected `snapshot_delta/mt.v0`, rejected direct `mgmt_bus_console_ack`, rejected legacy metadata records inside `pin_payload`, rejected runtime `reply_to` / `route.reply_to`, and rejected mgmt ack with wrong reply target worker/pin.
- Result: PASS

- Command: `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

- Command: `node scripts/tests/test_0364_bus_pin_split_runtime_contract.mjs`
- Key output: 9 passed, 0 failed out of 9.
- Result: PASS

- Command: `node scripts/tests/test_0326_imported_host_egress_bridge.mjs`
- Key output: 1 passed, 0 failed out of 1; imported host egress publishes endpoint topic and Matrix packet with only `version/type/payload`.
- Result: PASS

- Command: `node scripts/tests/test_0322_imported_host_egress_server_flow.mjs`
- Key output: 1 passed, 0 failed out of 1; imported host ingress-to-egress flow now publishes `UIPUT/ws/dam/pic/de/sw/R1/3000/submit` with endpoint/origin/reply target records.
- Result: PASS

- Command: `node scripts/tests/test_0326_ui_event_busin_flow.mjs`
- Key output: 31 passed, 0 failed out of 31; server direct-pin rejects legacy external packet wrappers.
- Result: PASS

- Command: `node scripts/tests/test_bus_in_out.mjs`
- Key output: 7 passed, 0 failed out of 7.
- Result: PASS

- Command: `node scripts/tests/test_cell_connect_parse.mjs`
- Key output: 8 passed, 0 failed out of 8.
- Result: PASS

- Command: `git diff --check`
- Key output: no whitespace errors.
- Result: PASS

## Step 10-14 Final Closure Refresh — 2026-05-13

### Step 10 — Worker Fill-Table Recheck

- Decision: no additional refill is required for `ui-server`, `mbr-worker`, or `remote-worker` after the same-topic contract change.
- Evidence:
  - `deploy/sys-v1ns/mbr/patches/mbr_role_v0.json` remains DEM-scoped and derives forwarding from `pin_payload.v1` endpoint records.
  - `deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json` still subscribes `UIPUT/ws/dam/pic/de/sw/R1/3000/submit1`.
  - `deploy/sys-v1ns/remote-worker/patches/13_model3000_minimal_submit.json` keeps the remote provider public pin as `submit1`.
- Commands:
  - `node scripts/validate_mbr_patch_v0.mjs`
  - `node scripts/tests/test_0362_mbr_remote_worker_route_contract.mjs`
  - `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
  - `node scripts/tests/test_0359_minimal_submit_matrix_e2e_contract.mjs`
- Key output: all checks passed; no old `return_topic`, `result_topic`, `route.reply_to`, `ui-server-local`, or old topic form is needed.
- Result: PASS

### Step 11 — Existing UI Model And Surface Recheck

- Change: compacted the Workspace asset action column so existing names no longer collide with `Open` / `Del`.
- Files changed:
  - `packages/worker-base/system-models/workspace_catalog_ui.json`
  - `scripts/tests/test_0346_ui_model_compliance_contract.mjs`
- Commands:
  - `node scripts/tests/test_0346_ui_model_compliance_contract.mjs`
  - `node scripts/validate_ui_ast_v0x.mjs --case all`
  - `npm -C packages/ui-model-demo-frontend run test`
- Browser: Playwright opened `http://127.0.0.1:30900/#/workspace`; Workspace sidebar showed `name` / `Act`, compact `Open Zip Del`, and no `Codex` app name.
- Result: PASS

### Step 12 — Minimal Submit JSON Patch And ZIP Refresh

- Change: refreshed `test_files/minimal_submit_dual_bus_app_payload.json` and `test_files/minimal_submit_dual_bus.zip`.
- Current provider payload hash: `88a642103ab7b39a43ae19cc49c7111c6997ce2842271bfb4829b4532977db7a`.
- Current provider ZIP hash: `039075fdb1b5e9cef144a8017c75853ddd09b15f8b75f6ef3f0e92b5354e5522`.
- Important correction: the button path is now `ui_bind_json.write.pin=click_event`, `click_event pin.in`, `click_event_wiring pin.connect.label`, then `click_chain pin.out`. This avoids UI writing directly to an output pin while preserving the root `click_chain -> submit_request` route.
- Commands:
  - `node scripts/tests/test_0360_minimal_submit_dual_bus_docs_contract.mjs`
  - `node scripts/tests/test_0361_minimal_submit_import_export_contract.mjs`
  - `node scripts/tests/test_0362_slide_app_self_described_route_contract.mjs`
  - `node scripts/tests/test_0364_slide_import_bus_binding_contract.mjs`
- Browser: uploaded `test_files/minimal_submit_dual_bus.zip` through Workspace `滑动 APP 导入`; imported model `1063`; entered `0375 redeploy browser submit`; clicked `Submit`.
- Key output: visible result became `Submitted: 0375 redeploy browser submit`; visible status became `remote_processed`.
- Topic evidence: remote-worker logs showed request and response on `UIPUT/ws/dam/pic/de/sw/R1/3000/submit1` with `origin_worker_id=U1`, `reply_target_model_id=1063`, and `reply_target_pin=result`.
- Export evidence: exporting model `1063` returned 63 provider records with `click_event=pin.in`, `click_event_wiring=pin.connect.label`, `click_chain=pin.out`, `ui_bind_json.write.pin=click_event`, and without `bus_event*`, `owner_request`, `owner_route`, or `__owner_last_*`.
- Review improvement: sub-agent review requested wildcard `bus_event*` filtering instead of exact `bus_event` keys only; implementation now excludes any `bus_event` prefix and test coverage injects `bus_event_custom`.
- Screenshot: `output/playwright/0375-local-redeploy-minimal-submit-success.png`.
- Result: PASS

### Step 13 — Minimal Submit MD And HTML Refresh

- Files changed:
  - `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md`
  - `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_visualized.md`
  - `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_interactive.html`
- Content updated:
  - Documents the 63-record patch shape.
  - Explains every patch label group, including `click_event`, `click_event_wiring`, and `click_chain`.
  - Explains Submit button binding, backend `handle_submit`, `submit1 pin.out`, generated host egress adapter, Model 0 bus path, MBR, and remote-worker response materialization.
  - Explains UI Server installation labels and export filtering for installation/runtime-only labels.
- Command: `curl -fsS http://127.0.0.1:30900/p/slide-app-runtime-minimal-submit-provider/minimal_submit_app_provider_interactive.html | rg "63 条 record|click_event|owner_request|UIPUT/ws/dam/pic/de/sw/R1/3000/submit1"`
- Key output: local static HTML includes the refreshed 63-record count, click-event chain, same endpoint topic, and export filtering notes.
- Result: PASS

### Step 14 — Local Deployment And Browser Verification

- Local deploy:
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh` rebuilt `dy-ui-server:v1` and `dy-remote-worker:v3`; it failed only while fetching unchanged Docker Hub metadata for `dy-mbr-worker:v2`.
  - `SKIP_MATRIX_BOOTSTRAP=1 SKIP_IMAGE_BUILD=1 bash scripts/ops/deploy_local.sh` completed rollout for all local pods.
  - After server export filtering changed, used a narrower path: `LOCAL_DY_PERSIST_ROOT=/Users/drop/dongyu/volume/persist/ui-server bash scripts/ops/sync_ui_public_docs.sh && docker build -t dy-ui-server:v1 -f k8s/Dockerfile.ui-server . && kubectl -n dongyu rollout restart deployment/ui-server && kubectl -n dongyu rollout status deployment/ui-server --timeout=180s`.
- Browser: Playwright opened `http://127.0.0.1:30900/#/workspace`.
- Color generator evidence: clicked `Generate Color`; visible color changed from `#FFFFFF` to `#31e3af`.
- Minimal Submit evidence: imported model `1063`, submitted `0375 redeploy browser submit`, and saw `Submitted: 0375 redeploy browser submit` plus `remote_processed`.
- Export evidence: `curl -fsS http://127.0.0.1:30900/api/slide-apps/1063/export.zip` produced a clean 63-record provider ZIP.
- Post-review redeploy evidence: rebuilt and rolled out `dy-ui-server:v1` after the `bus_event*` export-filter fix; re-exporting model `1063` still produced 63 records with no `bus_event*` or owner runtime labels.
- Review: sub-agent `019e1dab-ca27-7310-9c5c-b7c2b743a593`
- Review decision: Approved after one change request for wildcard `bus_event*` filtering.
- Result: PASS

### Step 9 — Cloud Deploy Drift Fix And Remote Browser Verification

- Command: `node scripts/tests/test_0349_remote_deploy_sync_contract.mjs && bash -n scripts/ops/deploy_cloud_app.sh`
- Key output: `PASS test_0349_remote_deploy_sync_contract`; shell syntax check passed.
- Result: PASS

- Review: sub-agent `019e1dab-ca27-7310-9c5c-b7c2b743a593`
- Decision: Approved
- Scope: `scripts/ops/deploy_cloud_app.sh`, `scripts/ops/README.md`, `scripts/tests/test_0349_remote_deploy_sync_contract.mjs`
- Key output: no findings, no open questions, no verification gaps.
- Result: PASS

- Command: `git push origin dev main`
- Key output: `dev -> dev` and `main -> main`; final pushed main revision `e0db410`.
- Result: PASS

- Command: `bash scripts/ops/sync_cloud_source.sh --ssh-user drop --ssh-host 124.71.43.80 --remote-repo /home/wwpic/dongyuapp --remote-repo-owner wwpic --revision e0db410`
- Key output: remote git checkout did not know `e0db410`, archive fallback synced deployment-required paths and wrote `.deploy-source-revision=e0db410`.
- Result: PASS

- Command: `ssh drop@124.71.43.80 'sudo -n bash /home/wwpic/dongyuapp/scripts/ops/deploy_cloud_app.sh --target ui-server --revision e0db410'`
- Key output: image built/imported with revision `e0db410`; `=== Apply target runtime manifest ===` ran; `deployment.apps/ui-server configured`; rollout completed; source hash gate passed.
- Result: PASS

- Command: `ssh drop@124.71.43.80 'sudo -n bash /home/wwpic/dongyuapp/scripts/ops/deploy_cloud_app.sh --target remote-worker --revision e0db410'`
- Key output: image built/imported with revision `e0db410`; `=== Apply target runtime manifest ===` ran; rollout completed; source hash gate passed.
- Result: PASS

- Command: `ssh drop@124.71.43.80 'sudo -n bash /home/wwpic/dongyuapp/scripts/ops/deploy_cloud_app.sh --target mbr-worker --revision e0db410'`
- Key output: image built/imported with revision `e0db410`; `=== Apply target runtime manifest ===` ran; rollout completed; source hash gate passed.
- Result: PASS

- Command: `ssh drop@124.71.43.80 'sudo -n kubectl --kubeconfig /etc/rancher/rke2/rke2.yaml -n dongyu exec deploy/ui-server -- env | grep DY_UI_SERVER_WORKER_ID'`
- Key output: `DY_UI_SERVER_WORKER_ID=U1`
- Result: PASS

- Command: `curl -fsS --max-time 20 https://app.dongyudigital.com/p/slide-app-runtime-minimal-submit-provider/minimal_submit_app_provider_interactive.html`
- Key output: public HTML returned `最小 Submit 双总线示例` and `topic: UIPUT/ws/dam/pic/de/sw/R1/3000/submit1`.
- Result: PASS

- Browser: Playwright headed session opened `https://app.dongyudigital.com/#/workspace`.
- Flow: clicked `E2E 颜色生成器` -> `Generate Color`.
- Key output: visible color changed from `#FFFFFF` to `#ec7a29`; visible status changed to `processed`.
- Result: PASS

- Browser: opened `滑动 APP 导入`, uploaded `/Users/drop/codebase/cowork/dongyuapp_elysia_based/test_files/minimal_submit_dual_bus.zip`, clicked `导入 Slide App`.
- Key output: a new `最小 Submit 双总线示例` app was created as model `1053` and opened from workspace.
- Result: PASS

- Browser: in imported model `1053`, entered `0375 remote same topic browser submit`, clicked `Submit`.
- Key output: visible text changed to `Submitted: 0375 remote same topic browser submit`; visible remote status changed to `remote_processed`.
- Screenshot: `output/playwright/0375-remote-minimal-submit-success.png`
- Result: PASS

- Command: remote worker log grep for `UIPUT/ws/dam/pic/de/sw/R1/3000/submit1`
- Key output: request and response both used `UIPUT/ws/dam/pic/de/sw/R1/3000/submit1`; request had `message_role=request`, `origin_worker_id=U1`, `reply_target_model_id=1053`; response had `message_role=response`, `origin_worker_id=R1`, `reply_target_worker_id=U1`, `reply_target_model_id=1053`, `reply_target_pin=result`; response packets were logged as `response_packet_not_delivered_to_endpoint_runtime` on the remote worker.
- Result: PASS

- Command: remote log grep for `ui-server-local|return_topic|result_topic|route.reply_to|reply_to|/worker/.*/model/.*/pin/|UIPUT/ws/dam/pic/de/sw/.*/result`
- Key output: no matches in `ui-server`, `remote-worker`, or `mbr-worker` logs for the current verification window.
- Result: PASS

- Review: sub-agent `019e1dab-ca27-7310-9c5c-b7c2b743a593`
- Decision: Approved
- Scope: final remote deployment and browser evidence for 0375 same-topic contract.
- Key output: no findings, no open questions, no verification gaps.
- Result: PASS

### Step 10-14 Planning Extension

- Date: 2026-05-13
- Change: Extended 0375 resolution from 9 to 14 steps for post-implementation closure requested by the user.
- Scope:
  - Step 10: re-audit/refill worker fill-table state for `ui-server`, `mbr-worker`, and `remote-worker`.
  - Step 11: re-audit existing UI models and visible surfaces.
  - Step 12: refresh the minimal Submit JSON patch/zip and prove it locally with a real browser.
  - Step 13: refresh the minimal Submit Markdown and interactive HTML docs.
  - Step 14: deploy locally, then publish remote docs/statics and verify the remote site with a real browser.
- Files changed: `docs/iterations/0375-unified-worker-model-topic/resolution.md`, `docs/ITERATIONS.md`, `docs/iterations/0375-unified-worker-model-topic/runlog.md`.
- Review: sub-agent `019e1dab-ca27-7310-9c5c-b7c2b743a593`
- Decision: Approved
- Key output: no findings, no open questions, no verification gaps.
- Result: PASS

### Step 10 Worker Fill-Table Recheck

- Date: 2026-05-13
- Scope: Re-audited whether `ui-server`, `mbr-worker`, and `remote-worker` need additional fill-table/config changes after the same-topic endpoint implementation.
- Fill-table/config decision:
  - `mbr-worker`: no additional refill required. Current `deploy/sys-v1ns/mbr/patches/mbr_role_v0.json` sets `sys_worker_role=DEM`, `sys_worker_id=5/10/28/35/14`, declares `mbr_cb_out` / `mbr_mb_out`, and validates/forwards only `pin_payload.v1` Temporary ModelTable records.
  - `remote-worker`: no additional refill required. Current `deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json` sets `sys_worker_role=V1N`, `sys_worker_id=5/10/28/35/15`, `mqtt_worker_id=R1`, and subscribes `UIPUT/ws/dam/pic/de/sw/R1/3000/submit1`. `13_model3000_minimal_submit.json` exposes root `submit1` -> `(1,1,1).submit1:in` and returns `message_role=response` on the same endpoint.
  - `ui-server`: no model-table refill required in `deploy/sys-v1ns`; current local/cloud deployment config sets `DY_UI_SERVER_WORKER_ID=U1`, and `packages/ui-model-demo-server/server.mjs` defaults the UI Server worker id to `U1`.
- Commands:
  - `find deploy/sys-v1ns -maxdepth 4 -type f | sort`
  - `rg -n "return_topic|returnTopic|result_topic|reply_to|route\\.reply_to|ui-server-local|/worker/|/model/|/pin/|UIPUT/ws/dam/pic/de/sw/.*/result|source_model_id|\\\"return|\\\"pin\\\"" deploy/sys-v1ns packages/worker-base/system-models packages/ui-model-demo-server/server.mjs k8s/local/workers.yaml k8s/cloud/workers.yaml scripts/run_worker_v0.mjs scripts/run_worker_remote_v1.mjs scripts/tests docs/ssot docs/user-guide -g '!docs/user-guide/slide-app-runtime/minimal_submit_app_provider_interactive.html'`
  - `rg -n "DY_UI_SERVER_WORKER_ID|name: ui-server|name: mbr-worker|name: remote-worker|R1|U1" k8s/local/workers.yaml`
  - `rg -n "DY_UI_SERVER_WORKER_ID|name: ui-server|name: mbr-worker|name: remote-worker|R1|U1" k8s/cloud/workers.yaml`
  - `rg -n "remote_subscriptions|R1/3000/submit1|R1/1010/submit|R1/1019/submit|R1/100/submit|worker/R1|model/3000|return_topic|result_topic|ui-server-local" deploy/sys-v1ns`
  - `node scripts/validate_mbr_patch_v0.mjs`
  - `node scripts/tests/test_0362_mbr_remote_worker_route_contract.mjs`
  - `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
  - `node scripts/tests/test_0359_minimal_submit_matrix_e2e_contract.mjs`
- Key output:
  - `validate_mbr_patch_v0`: 92 passed, 0 failed.
  - `test_0362_mbr_remote_worker_route_contract`: 10 passed, 0 failed.
  - `test_0375_unified_worker_model_topic_contract`: 74 passed, 0 failed.
  - `test_0359_minimal_submit_matrix_e2e_contract`: 5 passed, 0 failed.
  - Active deploy patches/configs use endpoint-only topics and reject old `return_topic` / `result_topic` / `reply_to` / `ui-server-local` metadata.
- Review: sub-agent `019e1dab-ca27-7310-9c5c-b7c2b743a593`
- Decision: Approved
- Key output: no findings, no open questions, no verification gaps.
- Result: PASS

### Step 11 Existing UI Model And Surface Recheck

- Date: 2026-05-13
- Scope: Re-audited existing UI model assets and visible workspace surfaces affected by the same-topic endpoint contract and recent browser feedback.
- Changes:
  - Adjusted `packages/worker-base/system-models/workspace_catalog_ui.json` so the Workspace asset tree leaves more room for app names: left panel width `300px`, name column min-width `190`, compact action column label `Act`, width `70`, compact `Open` / `Zip` / `Del` action styling.
  - Added assertions in `scripts/tests/test_0346_ui_model_compliance_contract.mjs` to prevent reintroducing Codex-specific app names or widening the action column.
- Static audit:
  - No current UI model/front-end surface contains `Codex` naming.
  - No current UI model/front-end surface contains active `pin.connect.model`, old `return_topic` / `result_topic`, old `route.reply_to`, `ui-server-local`, or old `worker/R1/model/...` endpoint shapes.
- Commands:
  - `rg -n "Codex|codex" packages/worker-base/system-models packages/ui-model-demo-frontend/src packages/ui-model-demo-server/server.mjs docs/user-guide/slide-app-runtime test_files`
  - `rg -n "pin\\.connect\\.model|ui-server-local|route\\.reply_to|return_topic|returnTopic|result_topic|source_model_id|worker/R1/model|worker/<worker_id>/model|UIPUT/ws/dam/pic/de/sw/[0-9]+/(submit|result)" packages/worker-base/system-models packages/ui-model-demo-frontend/src packages/ui-model-demo-server/server.mjs`
  - `node scripts/tests/test_0346_ui_model_compliance_contract.mjs`
  - `node scripts/validate_ui_ast_v0x.mjs --case all`
  - `node scripts/tests/test_0362_slide_app_self_described_route_contract.mjs`
  - `node scripts/tests/test_0364_slide_import_bus_binding_contract.mjs`
  - `npm -C packages/ui-model-demo-frontend run test`
  - `git diff --check`
- Key output:
  - `test_0346_ui_model_compliance_contract`: PASS, 30 visible surfaces, 0 violations, 6 low warnings for historical schema labels that are not primary projection.
  - `validate_ui_ast_v0x`: summary PASS.
  - `test_0362_slide_app_self_described_route_contract`: 11 passed, 0 failed.
  - `test_0364_slide_import_bus_binding_contract`: 2 passed, 0 failed.
  - frontend validation: PASS.
- Review Attempt 1: sub-agent `019e1dab-ca27-7310-9c5c-b7c2b743a593`
- Decision: Change Requested
- Key output: browser evidence for the visible Workspace asset tree layout change was missing.
- Follow-up deployment:
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh` rebuilt `dy-ui-server:v1` successfully, then failed while rebuilding unchanged `dy-mbr-worker:v2` because Docker Hub TLS handshake timed out.
  - `SKIP_MATRIX_BOOTSTRAP=1 SKIP_IMAGE_BUILD=1 bash scripts/ops/deploy_local.sh` applied manifests and restarted local deployments successfully; all pods Running.
- Browser verification:
  - Playwright headed browser opened `http://127.0.0.1:30900/#/workspace`.
  - Snapshot shows Workspace table header `name Act`, rows such as `E2E 颜色生成器 Open Zip Del`, and no `Codex` app name.
  - Measured first Workspace table rows in the browser: `nameWidth=190`, `actionWidth=70`, `actionScrollWidth=69`, `actionClientWidth=69`; action content fits the compact column without overflow.
  - Screenshot: `.playwright-cli/page-2026-05-13T02-34-01-952Z.png`.
- Review Attempt 2: sub-agent `019e1dab-ca27-7310-9c5c-b7c2b743a593`
- Decision: Approved
- Key output: no findings, no open questions, no verification gaps.
- Result: PASS

### Step 12 Minimal Submit Patch And ZIP Refresh

- Date: 2026-05-13
- Scope: Rechecked the current `最小 Submit 双总线示例` JSON patch and ZIP, then installed and ran it through the local Workspace with a real browser.
- Artifact decision:
  - Canonical JSON patch: `test_files/minimal_submit_dual_bus_app_payload.json`.
  - ZIP delivery artifact: `test_files/minimal_submit_dual_bus.zip`.
  - ZIP contents: exactly one file, `app_payload.json`, whose content matches the canonical JSON patch.
- Structure checks:
  - JSON patch contains 61 ModelTable records.
  - ZIP hash: `15dce30605410aea4dd178747950fb89c74db745f611951fa2125320491d998e`.
  - JSON hash: `d1c812d09dc4492b1f0731f622feb7ddb6e08b9ae43563b527ee00f57aa6e970`.
  - Forbidden legacy fields were absent: `route.reply_to`, `return_topic`, `returnTopic`, `result_topic`, `source_model_id`, `pin.connect.model`, `ui-server-local`, and old `worker/R1/model/...` topic shapes.
- Commands:
  - `node scripts/tests/test_0360_minimal_submit_dual_bus_docs_contract.mjs`
  - `node scripts/tests/test_0361_minimal_submit_import_export_contract.mjs`
  - `unzip -l test_files/minimal_submit_dual_bus.zip`
  - JSON/ZIP equality and forbidden-field structure check with Node.
- Key output:
  - `test_0360_minimal_submit_dual_bus_docs_contract`: 7 passed, 0 failed.
  - `test_0361_minimal_submit_import_export_contract`: 3 passed, 0 failed.
  - ZIP contains only `app_payload.json`, and it is byte-equivalent at JSON level to `test_files/minimal_submit_dual_bus_app_payload.json`.
- Local deploy/runtime state:
  - Local `ui-server`, `mbr-worker`, `remote-worker`, `mosquitto`, `synapse`, and `ui-side-worker` pods were Running under the `dongyu` namespace.
  - UI was available at `http://127.0.0.1:30900/#/workspace`.
- Browser verification:
  - Playwright opened `http://127.0.0.1:30900/#/workspace` in a headed browser.
  - Opened `滑动 APP 导入`, uploaded `/Users/drop/codebase/cowork/dongyuapp_elysia_based/test_files/minimal_submit_dual_bus.zip`, and clicked `导入 Slide App`.
  - Import created a new `最小 Submit 双总线示例` app as local model `1060` and opened it in Workspace.
  - Entered `0375 local refreshed submit`, clicked `Submit`, and the visible result changed to `Submitted: 0375 local refreshed submit`.
  - Visible remote status changed to `remote_processed`.
  - Screenshot: `output/playwright/0375-local-minimal-submit-refresh-success.png`.
- Log verification:
  - Remote worker logs show request and response both using `UIPUT/ws/dam/pic/de/sw/R1/3000/submit1`.
  - Request records include `message_role=request`, `origin_worker_id=U1`, `origin_model_id=1060`, `reply_target_worker_id=U1`, `reply_target_model_id=1060`, and `reply_target_pin=result`.
  - Response records include `message_role=response`, `origin_worker_id=R1`, `origin_model_id=3000`, `reply_target_worker_id=U1`, `reply_target_model_id=1060`, `reply_target_pin=result`, and payload records that update `display_text`, `remote_status`, `last_submit_payload`, and `submit_inflight`.
  - Remote worker logs mark the echoed response packet as `response_packet_not_delivered_to_endpoint_runtime`, preventing the response from re-triggering the remote endpoint program.
- Review: sub-agent `019e1dab-ca27-7310-9c5c-b7c2b743a593`
- Decision: Approved
- Key output: no findings, no open questions, no verification gaps.
- Result: PASS

### Step 3 Review Attempt 8

- Reviewer: sub-agent `019e1d55-78d9-7243-9520-c386bcc6cb48`
- Decision: Timed out / superseded
- Key output: no completed review result was returned; superseded by Review Attempt 9 to avoid blocking execution.
- Result: PASS for review capture

### Step 3 Review Attempt 9

- Reviewer: sub-agent `019e1dab-ca27-7310-9c5c-b7c2b743a593`
- Decision: Change Requested
- Key output: `mbr_mgmt_dispatch` still produced a local management-bus ack for `mgmt_bus_console.send.v1`; `handleDyBusEvent` still accepted a response packet whose endpoint was the local UI/result endpoint.
- Result: PASS for review capture; requested MBR/server/test/doc fixes applied before re-review.

### Step 3 Review Attempt 9 Fixes

- Change: `mbr_mgmt_dispatch` no longer writes direct `mbr_mb_out` business acks. A valid management-bus request now leaves the inbox for the MBR routing function and sets `run_mbr_mgmt_to_mqtt=1`.
- Change: UI Server now ignores `message_role=response` packets whose endpoint is the local UI Server worker, preventing old `U1/<local_model>/result` style responses from materializing.
- Change: added negative coverage for local UI/result response packets and MBR direct-ack prevention.
- Change: updated the ModelTable user guide examples so request and response both use the remote endpoint topic while the local UI target is expressed only by `reply_target_*` payload records.
- Result: PASS

- Command: `node scripts/validate_mbr_patch_v0.mjs`
- Key output: 92 passed, 0 failed.
- Result: PASS

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 74 passed, 0 failed.
- Result: PASS

- Command: `node scripts/tests/test_0342_mgmt_bus_console_real_messaging_contract.mjs`
- Key output: all checks passed; MBR dispatch now routes valid requests without local ack.
- Result: PASS

- Command: combined regression suites for pin payload, MBR/remote-worker route, minimal submit docs, slide-app import/export, legacy worker flows, syntax checks, and `git diff --check`.
- Key output: all checks passed.
- Result: PASS

### Step 3 Review Attempt 10

- Reviewer: sub-agent `019e1dab-ca27-7310-9c5c-b7c2b743a593`
- Decision: Approved
- Key output: no findings; no open questions; no verification gaps.
- Result: PASS

### Step 3 U1 Worker Identity Hardening

- Change: removed the old `ui-server-local` positive/default worker identity from the UI Server current runtime path. `resolveUiServerWorkerId()` now defaults to `U1` and no longer reads the old `UI_SERVER_WORKER_ID` alias.
- Change: updated MBR validator and positive route-contract assertions so UI Server reply target evidence uses `U1`.
- Residual scan: remaining `ui-server-local` references are negative old-topic tests, "must not hardcode" checks, or test-local custom worker ids.
- Result: PASS

- Command: `node scripts/validate_mbr_patch_v0.mjs`
- Key output: 92 passed, 0 failed.
- Result: PASS

- Command: `node scripts/tests/test_0362_mbr_remote_worker_route_contract.mjs`
- Key output: 10 passed, 0 failed.
- Result: PASS

- Command: `node scripts/tests/test_0342_mgmt_bus_console_real_messaging_contract.mjs`
- Key output: all checks passed.
- Result: PASS

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 74 passed, 0 failed.
- Result: PASS

### Step 3 U1 Worker Identity Review

- Reviewer: sub-agent `019e1dab-ca27-7310-9c5c-b7c2b743a593`
- Decision: Approved
- Key output: no findings; no open questions; no verification gaps.
- Result: PASS

### Step 3 Full Regression Refresh

- Command: `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs && node scripts/tests/test_0359_minimal_submit_matrix_e2e_contract.mjs && node scripts/tests/test_0362_mbr_remote_worker_route_contract.mjs && node scripts/tests/test_0364_bus_pin_split_runtime_contract.mjs`
- Key output: all checks passed; 0332 reported 32/32, 0359 reported 5/5, 0362 route reported 10/10, 0364 split bus reported 9/9.
- Result: PASS

- Command: `node scripts/tests/test_0322_imported_host_egress_server_flow.mjs && node scripts/tests/test_0326_imported_host_egress_bridge.mjs && node scripts/tests/test_0364_slide_import_bus_binding_contract.mjs && node scripts/tests/test_0361_minimal_submit_import_export_contract.mjs`
- Key output: all checks passed; imported host, bridge, slide import binding, and minimal submit import/export contracts passed.
- Result: PASS

- Command: `node scripts/tests/test_0143_e2e.mjs && node scripts/tests/test_0144_mbr_compat.mjs && node scripts/tests/test_0144_remote_worker.mjs && node scripts/tests/test_0177_mbr_bridge_contract.mjs && node scripts/tests/test_0179_mbr_route_contract.mjs && node scripts/tests/test_0184_mbr_direct_event_bridge_contract.mjs && node scripts/tests/test_0184_remote_worker_wildcard_event_contract.mjs && node scripts/tests/test_0328_remote_worker_v1n_runtime_contract.mjs`
- Key output: all checks passed.
- Result: PASS

- Command: `node scripts/tests/test_0351_slide_app_minimal_provider_guide_contract.mjs && node scripts/tests/test_0352_slide_app_provider_visualized_docs_contract.mjs && node scripts/tests/test_0360_minimal_submit_dual_bus_docs_contract.mjs && node scripts/tests/test_0362_slide_app_self_described_route_contract.mjs`
- Key output: all docs and self-described route checks passed.
- Result: PASS

- Command: `node scripts/tests/test_0270_workspace_ui_filltable_remote_mode_contract.mjs && node scripts/tests/test_0283_matrix_userline_send_receive_contract.mjs && node scripts/tests/test_0303_model0_egress_recovery_server_flow.mjs && node scripts/tests/test_0330_model100_local_submit_contract.mjs`
- Key output: all checks passed.
- Result: PASS

- Command: `bun scripts/tests/test_0362_persistence_canonical_reload.mjs`
- Key output: 1 passed, 0 failed.
- Result: PASS

- Command: `npm -C packages/ui-model-demo-frontend run build`
- Key output: Vite build completed successfully.
- Result: PASS

- Command: `node --check packages/worker-base/src/runtime.mjs && node --check packages/ui-model-demo-server/server.mjs && node --check scripts/run_worker_v0.mjs && git diff --check`
- Key output: syntax checks and whitespace check passed.
- Result: PASS

### Step 4 — Local Deploy And Browser Verification

- Command: `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
- Key output: rebuilt `dy-ui-server:v1` and `dy-remote-worker:v3`; Docker Hub metadata fetch for `node:22-slim` timed out while building `dy-mbr-worker:v2`.
- Result: FAIL, superseded by local-base overlay build below.

- Command: local-base overlay Docker builds for `dy-mbr-worker:v2` and `dy-ui-side-worker:v1`
- Key output: rebuilt current-source overlays from existing local base images `dy-mbr-worker:v2-local-base-0375` and `dy-ui-side-worker:v1-local-base-0375`.
- Result: PASS

- Command: `SKIP_MATRIX_BOOTSTRAP=1 SKIP_IMAGE_BUILD=1 bash scripts/ops/deploy_local.sh`
- Key output: applied manifests; restarted `ui-server`, `mbr-worker`, `remote-worker`, and `ui-side-worker`; all four app roles rolled out with no terminating old pods.
- Result: PASS

- Command: `bash scripts/ops/check_runtime_baseline.sh`
- Key output: all deployments ready; `mbr-worker-secret.MODELTABLE_PATCH_JSON` and `ui-server-secret.MODELTABLE_PATCH_JSON` ready; baseline ready.
- Result: PASS

- Browser verification: Playwright headed browser at `http://127.0.0.1:30900/#/workspace`.
- Flow: opened `E2E 颜色生成器`, clicked `Generate Color`.
- Key output: visible color changed from `#FFFFFF` to `#a98ed8`; visible status changed from `ready` to `processed`.
- Result: PASS

- Browser verification: Playwright headed browser at `http://127.0.0.1:30900/#/workspace`.
- Flow: opened `滑动 APP 导入`, uploaded `test_files/minimal_submit_dual_bus.zip`, clicked `导入 Slide App`.
- Key output: new app appeared as `最小 Submit 双总线示例`; export link `/api/slide-apps/1059/export.zip`; page opened with `Waiting for submit`.
- Result: PASS

- Browser verification: Playwright headed browser at `http://127.0.0.1:30900/#/workspace`.
- Flow: in imported model `1059`, entered `0375 same topic browser submit`, clicked `Submit`.
- Key output: visible text changed to `Submitted: 0375 same topic browser submit`; visible remote status changed to `remote_processed`.
- Screenshot: `output/playwright/0375-local-minimal-submit-success.png`
- Result: PASS

- Command: `kubectl -n dongyu logs deploy/remote-worker --since=20m | rg -n "UIPUT/ws/dam/pic/de/sw/(R1/3000/submit1|U1|ui-server-local|worker/|model/|pin/|result_topic|return_topic|reply_to)"`
- Key output: request and response both used `UIPUT/ws/dam/pic/de/sw/R1/3000/submit1`; payload records used `origin_worker_id=U1`, `reply_target_worker_id=U1`, `message_role=request|response`.
- Result: PASS

- Command: three log scans over `deploy/remote-worker`, `deploy/mbr-worker`, and `deploy/ui-server` for `ui-server-local|UIPUT/ws/dam/pic/de/sw/.*/result|/worker/.*/model/.*/pin/|return_topic|result_topic|route\\.reply_to`.
- Key output: no matches in current local deployed logs.
- Result: PASS

### Step 4 Review Attempt 1

- Reviewer: sub-agent `019e1dab-ca27-7310-9c5c-b7c2b743a593`
- Decision: Change Requested
- Key output: an older non-superseded local verification section still recorded `ui-server-local` and `UIPUT/ws/dam/pic/de/sw/ui-server-local/1058/result` as PASS evidence.
- Result: PASS for review capture; runlog evidence was corrected before re-review.

### Step 4 Review Fix

- Change: renamed the older local verification section as superseded historical evidence.
- Change: explicitly marked every result in that section and its old review as `SUPERSEDED, not final acceptance evidence`.
- Result: PASS

### Step 4 Review Attempt 2

- Reviewer: sub-agent `019e1dab-ca27-7310-9c5c-b7c2b743a593`
- Decision: Approved
- Key output: no findings; no open questions; no verification gaps.
- Result: PASS

### Step 6 R1 Cleanup And Validator Refresh

- Change: removed stale Step 7 / Step 8 runlog sections that recorded `RE` as passing evidence; new acceptance evidence must use current `R1` worker identity.
- Change: updated the management bus console live projection test from `message.route.to` / `message.route.reply_to` to current `message.endpoint` / `message.reply_target`.
- Change: rewrote `scripts/validate_mbr_patch_v0.mjs` so the validator uses only strict `pin_payload.v1` packets with endpoint/origin/reply_target ModelTable records and `UIPUT/ws/dam/pic/de/sw/R1/<model>/<pin>` topics.
- Red evidence: `node scripts/validate_mbr_patch_v0.mjs` failed before the validator refresh because it still sent legacy loose `source_model_id`, `pin`, and `route` fields and expected `UIPUT/ws/dam/pic/de/sw/worker/RE/model/.../pin/...`.
- Fix evidence: the validator helper was corrected so explicit `null` adapters remain `null`, making split-bus missing-adapter retry checks meaningful.

- Command: `node scripts/tests/test_0339_mgmt_bus_console_live_projection_contract.mjs`
- Key output: ok true; 5 PASS results.
- Result: PASS

- Command: `node scripts/validate_mbr_patch_v0.mjs`
- Key output: 81 PASS, 0 FAIL.
- Result: PASS

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs && node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs && node scripts/tests/test_0364_bus_pin_split_runtime_contract.mjs && node scripts/tests/test_0322_imported_host_egress_server_flow.mjs && node scripts/tests/test_0326_imported_host_egress_bridge.mjs && node scripts/tests/test_0326_ui_event_busin_flow.mjs && node scripts/tests/test_0144_mbr_compat.mjs && node scripts/tests/test_0177_mbr_bridge_contract.mjs && node scripts/tests/test_0179_mbr_route_contract.mjs && node scripts/tests/test_0182_server_model0_egress_contract.mjs && node scripts/tests/test_0336_mgmt_bus_console_contract.mjs && node scripts/tests/test_0339_mgmt_bus_console_live_projection_contract.mjs && node scripts/validate_mbr_patch_v0.mjs`
- Key output: all checks passed; 0375 main contract reported 70/70, pin-payload contract 32/32, split-bus contract 9/9, UI event bus-in 31/31, and MBR validator 81/81.
- Result: PASS

- Command: `node --check scripts/validate_mbr_patch_v0.mjs && node --check scripts/tests/test_0339_mgmt_bus_console_live_projection_contract.mjs && git diff --check`
- Key output: syntax checks and whitespace check passed.
- Result: PASS

- Command: forbidden-marker scan for old `RE`, old worker/model/pin topics, and old management-console route labels across current active docs/tests/runtime/fixtures.
- Key output: no matches.
- Result: PASS

### Step 6 Review Attempt 1

- Reviewer: sub-agent `019e1d55-78d9-7243-9520-c386bcc6cb48`
- Decision: Change Requested
- Key output: positive imported-host egress fixture still emitted `source_model_id`; MBR validator needed to restore management-bus adapter rejection / retry coverage.
- Result: PASS for review capture; requested fixes applied before re-review.

### Step 6 Review Fix Verification

- Change: `scripts/tests/test_0322_imported_host_egress_contract.mjs` no longer emits `source_model_id` from its valid imported app handler; it now asserts the imported handler does not contain that removed key.
- Change: `scripts/validate_mbr_patch_v0.mjs` now also verifies `split_bus_mgmt_publish_failed`, rejected management-bus retry retention, and same-key management retry safety.

- Command: `node scripts/tests/test_0322_imported_host_egress_contract.mjs && node scripts/validate_mbr_patch_v0.mjs && node --check scripts/validate_mbr_patch_v0.mjs && node --check scripts/tests/test_0322_imported_host_egress_contract.mjs && git diff --check`
- Key output: imported-host egress contract 2/2; MBR validator 86/86; syntax and whitespace checks passed.
- Result: PASS

### Step 6 Review Attempt 2

- Reviewer: sub-agent `019e1d55-78d9-7243-9520-c386bcc6cb48`
- Decision: Approved
- Key output: Findings none; open questions none; verification gaps none.
- Result: PASS

### Step 7 — Superseded Historical Local Deploy And Browser R1 Verification

- Superseded: this section is retained only as historical evidence from an earlier 0375 attempt. It is not acceptance evidence for the final contract because it used `ui-server-local` and a UI-local `/result` endpoint. Final valid local deployment and browser evidence is recorded in `Step 4 — Local Deploy And Browser Verification` above.

- Command: `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
- Key output: rebuilt `dy-ui-server:v1` and `dy-remote-worker:v3`, then Docker Hub metadata fetch for `node:22-slim` timed out while building `dy-mbr-worker:v2`.
- Result: SUPERSEDED, not final acceptance evidence.

- Command: local-base overlay Docker builds for `dy-mbr-worker:v2` and `dy-ui-side-worker:v1`
- Key output: rebuilt current-source overlays from `dy-mbr-worker:v2-local-base-0375` and `dy-ui-side-worker:v1-local-base-0375`.
- Result: SUPERSEDED, not final acceptance evidence.

- Command: `SKIP_IMAGE_BUILD=1 SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
- Key output: applied manifests and restarted `ui-server`, `mbr-worker`, `remote-worker`, and `ui-side-worker`; all rollouts completed and old app pods terminated.
- Result: SUPERSEDED, not final acceptance evidence.

- Command: `bash scripts/ops/check_runtime_baseline.sh`
- Key output: all local deployments ready; no terminating app pods; mbr-worker and ui-server secrets ready.
- Result: SUPERSEDED, not final acceptance evidence.

- Command: local image and running pod image ID comparison.
- Key output:
  - `dy-ui-server:v1` -> `sha256:a542ea02f5a577ca1489c4db0c557617cd0e6ec17dc0e33f0c32d2ee994a8f99`
  - `dy-remote-worker:v3` -> `sha256:0e6e84b7b5ad75bb077e4187f1c51c7aff9fd16fb1e57dbe321495cc07d2a204`
  - `dy-mbr-worker:v2` -> `sha256:eccd8f7f43fcd22db33692a5327446252009f96e4f70a94d4e2d258abb79567b`
  - `dy-ui-side-worker:v1` -> `sha256:7aeab9150e0df344e867a840042e0ea0ea84bce677cff1854d8d74f248fa8811`
- Result: SUPERSEDED, not final acceptance evidence.

- Command: `curl -fsS http://127.0.0.1:30900/ | head -c 240`
- Key output: UI Model Demo HTML served from local NodePort.
- Result: SUPERSEDED, not final acceptance evidence.

- Browser: Playwright headed session `0375local` opened `http://127.0.0.1:30900/#/workspace`.
- Browser: Opened `E2E 颜色生成器`, filled `0375 local R1 color`, clicked `Generate Color`; visible color changed from `#FFFFFF` to `#455aec`, and status became `processed`.
- Result: SUPERSEDED, not final acceptance evidence.

- Browser: Opened `滑动 APP 导入`, uploaded `test_files/minimal_submit_dual_bus.zip`, clicked `导入 Slide App`; Workspace added imported model `1058` named `最小 Submit 双总线示例`.
- Browser: Opened imported app `1058`, filled `0375 local R1 minimal submit 1778610678506`, clicked `Submit`; visible result became `Submitted: 0375 local R1 minimal submit 1778610678506`, and remote status became `remote_processed`.
- Artifact: `output/playwright/0375-local-r1-minimal-submit-success.png`.
- Result: SUPERSEDED, not final acceptance evidence.

- Command: `kubectl -n dongyu logs deploy/remote-worker --since=10m`
- Key output: remote-worker subscribed to `UIPUT/ws/dam/pic/de/sw/R1/3000/submit1`; inbound minimal Submit used strict `version/type/payload`, `endpoint_worker_id=R1`, `endpoint_model_id=3000`, `endpoint_pin=submit1`, but still used historical `origin_worker_id=ui-server-local`, `reply_target_worker_id=ui-server-local`, and published `UIPUT/ws/dam/pic/de/sw/ui-server-local/1058/result`.
- Result: SUPERSEDED, not final acceptance evidence.

- Command: `kubectl -n dongyu logs deploy/mbr-worker --since=10m`
- Key output: MBR published `UIPUT/ws/dam/pic/de/sw/R1/3000/submit1`, observed the same inbound topic, then observed the now-invalid `UIPUT/ws/dam/pic/de/sw/ui-server-local/1058/result` path.
- Result: SUPERSEDED, not final acceptance evidence.

- Command: forbidden-marker scan over local `remote-worker`, `mbr-worker`, and `ui-server` logs since deploy.
- Key output:
  - `PASS remote-worker forbidden markers clear`
  - `PASS mbr-worker forbidden markers clear`
  - `PASS ui-server forbidden markers clear`
- Result: SUPERSEDED, not final acceptance evidence.

- Command: `curl -fsS http://127.0.0.1:30900/p/slide-app-runtime-minimal-submit-provider/minimal_submit_app_provider_interactive.html`
- Key output: local static HTML is available and documents `UIPUT/ws/dam/pic/de/sw/R1/3000/submit1`.
- Result: SUPERSEDED, not final acceptance evidence.

### Step 7 Review Attempt 1

- Reviewer: sub-agent `019e1d55-78d9-7243-9520-c386bcc6cb48`
- Decision: Approved
- Key output: Findings none; open questions none; verification gaps none.
- Result: SUPERSEDED, not final acceptance evidence.

### Step 5 Review Attempt 2

- Reviewer: sub-agent `019e1d0b-bcda-7a52-9ff9-243c7d8b9b96`
- Decision: Approved
- Key output: Findings none; open questions none; verification gaps none.
- Result: PASS

### Step 5 Review Attempt 1

- Reviewer: sub-agent `019e1d0b-bcda-7a52-9ff9-243c7d8b9b96`
- Decision: Change Requested
- Key output: SSOT `runtime_semantics_modeltable_driven.md` still listed plain `pin` as a required payload record; minimal Submit guide embedded handler did not fail closed on missing/invalid endpoint/origin/reply_target records or invalid nested business records.
- Result: PASS for review capture; requested fixes applied before re-review.

### Step 5 Review Fix Verification

- Change: removed plain `pin` from the required payload record list in `runtime_semantics_modeltable_driven.md`; added a 0375 contract test to keep it removed while requiring `endpoint_pin` / `origin_pin` / `reply_target_pin`.
- Change: strengthened the minimal Submit guide embedded handler snippet to validate strict ModelTable record shape, endpoint/origin/reply_target records, and nested business records before processing.
- Command: `node scripts/tests/test_0351_slide_app_minimal_provider_guide_contract.mjs`
- Key output: 6 passed, 0 failed out of 6.
- Result: PASS

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 70 passed, 0 failed out of 70.
- Result: PASS

- Command: `node --check scripts/tests/test_0351_slide_app_minimal_provider_guide_contract.mjs`
- Key output: syntax check passed.
- Result: PASS

- Command: `node --check scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: syntax check passed.
- Result: PASS

- Command: `git diff --check`
- Key output: no whitespace errors.
- Result: PASS

### Step 4 Review Attempt 1

- Reviewer: sub-agent `019e1cf1-e258-7a30-ad92-70ffcf398d8d`
- Decision: Approved
- Key output: Findings none; open questions none; verification gaps none.
- Result: PASS

### Step 4 Red Test: Tier2 / Fixture Sources Still Had Legacy Transport Metadata

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 67 passed, 1 failed out of 68; current Tier2 / fixture source scan found old remote-worker subscriptions and legacy `source_model_id` / `reply_to` / `route` metadata in active model code and fixtures.
- Result: PASS for red-test capture.

### Step 4 Red Test: Mgmt Bus Console UI Bind Still Emitted Removed Metadata

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 67 passed, 1 failed out of 68 after source scan was expanded to ModelTable records; `workspace_positive_models.json` still had two active `source_model_id` records in Mgmt Bus Console button payloads.
- Result: PASS for red-test capture.

### Step 4 Red Test: Frontend Projection Still Parsed Removed Console Ack Shape

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 68 passed, 1 failed out of 69; frontend trace projection still recognized retired direct `mgmt_bus_console_ack` packets and loose `payload.source_model_id`.
- Result: PASS for red-test capture.

### Step 4 Fix Summary

- Refilling: remote-worker subscriptions now use `UIPUT/ws/dam/pic/de/sw/<worker_id>/<model_id>/<pin>` only.
- Refilling: remote-worker Model 100 / 1010 / 1019 / 3000 handlers now parse endpoint/origin/reply_target records and return strict `pin_payload.v1` record arrays.
- Refilling: MBR MQTT inbound path bridges remote replies back to management bus only when endpoint equals reply_target, preventing self-echo of UI-originated control-bus publishes.
- Cleanup: minimal Submit and imported host fixtures no longer emit `source_model_id` records in business payloads; regenerated `test_files/minimal_submit_dual_bus.zip`.
- Cleanup: Mgmt Bus Console UI button payloads no longer send `source_model_id`; frontend projection reads current `origin_model_id` records only.
- Result: PASS for implementation capture.

### Step 4 Verification Refresh

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 69 passed, 0 failed out of 69.
- Result: PASS

- Command: `node scripts/tests/test_0362_mbr_remote_worker_route_contract.mjs`
- Key output: 10 passed, 0 failed out of 10.
- Result: PASS

- Command: `node scripts/tests/test_0322_imported_host_egress_server_flow.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_0326_imported_host_egress_bridge.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
- Key output: 32 passed, 0 failed out of 32.
- Result: PASS

- Command: `node scripts/tests/test_0342_mgmt_bus_console_real_messaging_contract.mjs`
- Key output: 13 PASS results.
- Result: PASS

- Command: `node scripts/tests/test_0364_bus_pin_split_runtime_contract.mjs`
- Key output: 9 passed, 0 failed out of 9.
- Result: PASS

- Command: `node scripts/tests/test_0326_ui_event_busin_flow.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

### Step 5 — Provider Docs / Importer Contract Refresh

- Red evidence: current provider docs and related contract tests still expected the old bundle-level `route.reply_to`, old local result topic wording, and remote-worker `message_text` fallback wording.
- Red evidence: `scripts/tests/test_0359_minimal_submit_matrix_e2e_contract.mjs`, `scripts/tests/test_0360_minimal_submit_dual_bus_docs_contract.mjs`, `scripts/tests/test_0362_slide_app_self_described_route_contract.mjs`, and `scripts/tests/test_0364_docs_split_bus_contract.mjs` each failed before the docs/tests were updated for endpoint/origin/reply_target records.
- Change: rewrote `minimal_submit_app_provider_guide.md`, `minimal_submit_app_provider_visualized.md`, and `minimal_submit_app_provider_interactive.html` around the current contract: provider ZIP declares only UI model + `remote_bus_endpoint_v1`; UI Server owns local installed model id, origin records, and reply target records.
- Change: updated SSOT docs for imported slide app host ingress/egress and UI-to-Matrix flow so current public docs no longer teach per-app route registration or result topic inference.
- Change: updated provider/import/export/docs contract tests to assert `UIPUT/<ws>/<dam>/<pic>/<de>/<sw>/<worker_id>/<model_id>/<pin>`, strict `pin_payload.v1`, server-owned `reply_target_*`, and the absence of current-path compatibility fallbacks.
- Change: remote-worker Model 3000 handler now reads only business `text` for the minimal Submit example and no longer accepts `message_text` fallback.
- Result: PASS for implementation capture.

### Step 5 Verification Refresh

- Command: `node scripts/tests/test_0351_slide_app_minimal_provider_guide_contract.mjs`
- Key output: 5 passed, 0 failed out of 5.
- Result: PASS

- Command: `node scripts/tests/test_0352_slide_app_provider_visualized_docs_contract.mjs`
- Key output: 4 passed, 0 failed out of 4.
- Result: PASS

- Command: `node scripts/tests/test_0359_minimal_submit_matrix_e2e_contract.mjs`
- Key output: 5 passed, 0 failed out of 5.
- Result: PASS

- Command: `node scripts/tests/test_0360_minimal_submit_dual_bus_docs_contract.mjs`
- Key output: 7 passed, 0 failed out of 7.
- Result: PASS

- Command: `node scripts/tests/test_0361_minimal_submit_import_export_contract.mjs`
- Key output: 3 passed, 0 failed out of 3.
- Result: PASS

- Command: `node scripts/tests/test_0362_slide_app_self_described_route_contract.mjs`
- Key output: 11 passed, 0 failed out of 11.
- Result: PASS

- Command: `node scripts/tests/test_0364_docs_split_bus_contract.mjs`
- Key output: 6 passed, 0 failed out of 6.
- Result: PASS

- Command: `node scripts/tests/test_0350_slide_app_runtime_user_guide_contract.mjs`
- Key output: ok true; 5 PASS results.
- Result: PASS

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 69 passed, 0 failed out of 69.
- Result: PASS

- Command: `node scripts/tests/test_0362_mbr_remote_worker_route_contract.mjs`
- Key output: 10 passed, 0 failed out of 10.
- Result: PASS

- Command: `node scripts/tests/test_0322_imported_host_egress_server_flow.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_0326_imported_host_egress_bridge.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
- Key output: 32 passed, 0 failed out of 32.
- Result: PASS

- Command: `node scripts/tests/test_0342_mgmt_bus_console_real_messaging_contract.mjs`
- Key output: ok true; 13 PASS results.
- Result: PASS

- Command: `node scripts/tests/test_0364_bus_pin_split_runtime_contract.mjs`
- Key output: 9 passed, 0 failed out of 9.
- Result: PASS

- Command: `node scripts/tests/test_0326_ui_event_busin_flow.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

- Command: `node scripts/tests/test_bus_in_out.mjs`
- Key output: 7 passed, 0 failed out of 7.
- Result: PASS

- Command: `node scripts/tests/test_cell_connect_parse.mjs`
- Key output: 8 passed, 0 failed out of 8.
- Result: PASS

- Command: `node --check scripts/tests/test_0351_slide_app_minimal_provider_guide_contract.mjs`
- Key output: syntax check passed.
- Result: PASS

- Command: `node --check scripts/tests/test_0359_minimal_submit_matrix_e2e_contract.mjs`
- Key output: syntax check passed.
- Result: PASS

- Command: `node --check scripts/tests/test_0362_slide_app_self_described_route_contract.mjs`
- Key output: syntax check passed.
- Result: PASS

- Command: `node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('deploy/sys-v1ns/remote-worker/patches/13_model3000_minimal_submit.json','utf8'));"`.
- Key output: JSON parse passed.
- Result: PASS

- Command: `git diff --check`
- Key output: no whitespace errors.
- Result: PASS

- Command: `node scripts/tests/test_bus_in_out.mjs`
- Key output: 7 passed, 0 failed out of 7.
- Result: PASS

- Command: `node scripts/tests/test_cell_connect_parse.mjs`
- Key output: 8 passed, 0 failed out of 8.
- Result: PASS

- Command: `node --check scripts/tests/test_0362_mbr_remote_worker_route_contract.mjs && node --check scripts/tests/test_0375_unified_worker_model_topic_contract.mjs && node --check packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
- Key output: syntax checks passed.
- Result: PASS

- Command: `git diff --check`
- Key output: no whitespace errors.
- Result: PASS

### Step 3 Review Attempt 23

- Reviewer: sub-agent `019e1c90-92cd-7f72-95f4-e6863610f50e`
- Decision: Change Requested
- Key output: runtime, server, and generic worker strict packet validation still accepted removed return metadata keys `return_topic`, `returnTopic`, and `result_topic` as records, nested payload records, plain JSON keys, or extra record properties.
- Result: PASS for review capture; return metadata hard-rejection tests were added first, failed as expected, then the shared legacy metadata denylist was updated.

### Step 3 Red Test Before Attempt 23 Fix

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 58 passed, 6 failed out of 64. Failures showed `return_topic` was accepted by bus-out externalization, runtime MQTT ingress, generic worker endpoint validation, Matrix event validation, and server direct-pin validation.
- Result: PASS for red-test capture.

### Step 3 Verification Refresh After Attempt 23 Fixes

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 64 passed, 0 failed out of 64; includes hard rejection of `return_topic`, `returnTopic`, and `result_topic` in top-level records, nested payload records, plain JSON keys, extra record properties, Matrix ingress, and server direct-pin paths.
- Result: PASS

- Command: `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

- Command: `node scripts/tests/test_0364_bus_pin_split_runtime_contract.mjs`
- Key output: 9 passed, 0 failed out of 9.
- Result: PASS

- Command: `node scripts/tests/test_0326_ui_event_busin_flow.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

- Command: `node scripts/tests/test_0322_imported_host_egress_server_flow.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_0326_imported_host_egress_bridge.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_bus_in_out.mjs`
- Key output: 7 passed, 0 failed out of 7.
- Result: PASS

- Command: `node scripts/tests/test_cell_connect_parse.mjs`
- Key output: 8 passed, 0 failed out of 8.
- Result: PASS

- Command: `node --check packages/worker-base/src/runtime.mjs`
- Key output: syntax check passed.
- Result: PASS

- Command: `node --check packages/ui-model-demo-server/server.mjs`
- Key output: syntax check passed.
- Result: PASS

- Command: `node --check scripts/run_worker_v0.mjs`
- Key output: syntax check passed.
- Result: PASS

- Command: `node --check scripts/worker_engine_v0.mjs`
- Key output: syntax check passed.
- Result: PASS

- Command: `git diff --check`
- Key output: no whitespace errors.
- Result: PASS

### Step 3 Review Attempt 25

- Reviewer: sub-agent `019e1cac-ce9e-7c72-bbcb-26c6afdc04a7`
- Decision: Change Requested
- Key output: server direct-pin validation treated `__mt_payload_kind` with non-`str` type and value `pin_payload.v1` as ordinary ModelTable data; runtime trimmed padded `mqtt_worker_id` for outbound topic generation and inbound matching.
- Result: PASS for review capture; requested wrong-kind direct-pin rejection and no-trim worker id handling were implemented after red tests.

### Step 3 Red Test Before Attempt 25 Fix

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 65 passed, 2 failed out of 67. Failures proved `_topicFor()` emitted a topic from padded `mqtt_worker_id`, and negative direct-pin accepted `__mt_payload_kind` with `t=json`.
- Result: PASS for red-test capture.

### Step 3 Verification Refresh After Attempt 25 Fixes

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 67 passed, 0 failed out of 67; includes no-trim configured `mqtt_worker_id` rejection and direct-pin rejection of wrong-type `__mt_payload_kind`.
- Result: PASS

- Command: `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
- Key output: 32 passed, 0 failed out of 32.
- Result: PASS

- Command: `node scripts/tests/test_0364_bus_pin_split_runtime_contract.mjs`
- Key output: 9 passed, 0 failed out of 9.
- Result: PASS

- Command: `node scripts/tests/test_0326_ui_event_busin_flow.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

- Command: `node scripts/tests/test_0322_imported_host_egress_server_flow.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_0326_imported_host_egress_bridge.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_bus_in_out.mjs && node scripts/tests/test_cell_connect_parse.mjs`
- Key output: 7 passed / 0 failed and 8 passed / 0 failed.
- Result: PASS

- Command: `node --check packages/worker-base/src/runtime.mjs && node --check packages/ui-model-demo-server/server.mjs && node --check scripts/run_worker_v0.mjs && node --check scripts/worker_engine_v0.mjs`
- Key output: syntax checks passed.
- Result: PASS

- Command: `git diff --check`
- Key output: no whitespace errors.
- Result: PASS

### Step 3 Review Attempt 26

- Reviewer: sub-agent `019e1cb6-da59-7bc3-8acb-01ec4f6600f5`
- Decision: Change Requested
- Key output: runtime bus pins, positive-model pins, and server direct-pin ingress accepted malformed string `__mt_payload_kind` values such as padded `pin_payload.v1` / unknown `pin_payload.v2`; Mgmt Bus Console projection read `message_text` and target from outer pin_payload metadata instead of nested business records.
- Result: PASS for review capture; requested malformed-kind rejection, console projection fix, and tests applied before re-review.

### Step 3 Red Tests Before Attempt 26 Fix

- Command: `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
- Key output: 31 passed, 1 failed out of 32. Failure proved positive model pins accepted padded `__mt_payload_kind=pin_payload.v1`.
- Result: PASS for red-test capture.

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 65 passed, 2 failed out of 67. Failures proved runtime/server accepted malformed pin_payload kind values.
- Result: PASS for red-test capture.

- Command: `node scripts/tests/test_0342_mgmt_bus_console_real_messaging_contract.mjs`
- Key output: failed first on legacy `source_model_id/pin/route` test payloads; after converting the test payloads to strict endpoint/origin/reply_target records, failure moved to MBR Tier 2 output still emitting old route/source/pin metadata.
- Result: PASS for red-test capture.

### Step 3 Verification Refresh After Attempt 26 Fixes

- Command: `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
- Key output: 32 passed, 0 failed out of 32.
- Result: PASS

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 67 passed, 0 failed out of 67.
- Result: PASS

- Command: `node scripts/tests/test_0342_mgmt_bus_console_real_messaging_contract.mjs`
- Key output: 13 passed, 0 failed out of 13; MBR console dispatch now emits exact `version/type/payload` pin_payload records with endpoint/origin/reply_target metadata and no loose route/source/pin fields.
- Result: PASS

- Command: `node scripts/tests/test_0364_bus_pin_split_runtime_contract.mjs`
- Key output: 9 passed, 0 failed out of 9.
- Result: PASS

- Command: `node scripts/tests/test_0326_ui_event_busin_flow.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

- Command: `node scripts/tests/test_0322_imported_host_egress_server_flow.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_0326_imported_host_egress_bridge.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_bus_in_out.mjs`
- Key output: 7 passed, 0 failed out of 7.
- Result: PASS

- Command: `node scripts/tests/test_cell_connect_parse.mjs`
- Key output: 8 passed, 0 failed out of 8.
- Result: PASS

- Command: `node --check packages/worker-base/src/runtime.mjs && node --check packages/worker-base/src/runtime.js && node --check packages/ui-model-demo-server/server.mjs && node --check scripts/run_worker_v0.mjs && node --check scripts/worker_engine_v0.mjs && node --check packages/ui-model-demo-frontend/src/editor_page_state_derivers.js && node --check packages/ui-model-demo-server/mgmt_bus_console_projection.mjs && node --check scripts/tests/test_0342_mgmt_bus_console_real_messaging_contract.mjs`
- Key output: syntax checks passed.
- Result: PASS

- Command: `git diff --check`
- Key output: no whitespace errors.
- Result: PASS

### Step 3 Review Attempt 24

- Reviewer: sub-agent `019e1c9e-b81d-7351-ba94-1aa6c0f19d24`
- Decision: Change Requested
- Key output: positive-model `pin.in` / `pin.out` still accepted incomplete arrays marked `__mt_payload_kind=pin_payload.v1`; server return parsing used identifier-shaped UI names instead of 0375 safe route segments, so numeric worker/pin origin segments were rejected.
- Result: PASS for review capture; requested strict positive-pin `pin_payload.v1` validation and server safe-segment parsing were implemented after red tests.

### Step 3 Red Tests Before Attempt 24 Fix

- Command: `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
- Key output: 31 passed, 1 failed out of 32. Failure proved positive model `pin.in` accepted incomplete `pin_payload.v1` arrays.
- Result: PASS for red-test capture.

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 64 passed, 2 failed out of 66. Failures proved server owner materialization stored a malformed nested `pin_payload.v1` pin label and server return parsing rejected safe numeric origin segments.
- Result: PASS for red-test capture.

### Step 3 Verification Refresh After Attempt 24 Fixes

- Command: `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
- Key output: 32 passed, 0 failed out of 32; includes positive-model `pin.in` / `pin.out` rejection of incomplete `pin_payload.v1` arrays while preserving ordinary multi-cell ModelTable payload support.
- Result: PASS

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 66 passed, 0 failed out of 66; includes owner-materialization rejection of malformed nested `pin_payload.v1` pin labels and acceptance of 0375-safe numeric origin worker/pin segments.
- Result: PASS

- Command: `node scripts/tests/test_0364_bus_pin_split_runtime_contract.mjs`
- Key output: 9 passed, 0 failed out of 9.
- Result: PASS

- Command: `node scripts/tests/test_0326_ui_event_busin_flow.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

- Command: `node scripts/tests/test_0322_imported_host_egress_server_flow.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_0326_imported_host_egress_bridge.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_bus_in_out.mjs`
- Key output: 7 passed, 0 failed out of 7.
- Result: PASS

- Command: `node scripts/tests/test_cell_connect_parse.mjs`
- Key output: 8 passed, 0 failed out of 8.
- Result: PASS

- Command: `node --check packages/worker-base/src/runtime.mjs && node --check packages/ui-model-demo-server/server.mjs && node --check scripts/run_worker_v0.mjs && node --check scripts/worker_engine_v0.mjs`
- Key output: syntax checks passed.
- Result: PASS

- Command: `git diff --check`
- Key output: no whitespace errors.
- Result: PASS

### Step 3 Review Attempt 15

- Reviewer: sub-agent `019e1c52-9547-7473-a863-a4a7952ec2d3`
- Decision: Change Requested
- Key output: `op_id` and `__mt_request_id` were optional in runtime, generic worker validators, and server return parsing; if both were absent, payloads could still be accepted and materialized.
- Result: PASS for review capture; requested request-correlation requirement and tests applied before re-review.

### Step 3 Verification Refresh After Attempt 15 Fixes

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 54 passed, 0 failed out of 54; includes runtime MQTT ingress, runtime bus-in/out, bus-out externalization, generic worker MQTT/Matrix validation, and server return/direct-pin rejection when both `op_id` and `__mt_request_id` are missing.
- Result: PASS

- Command: `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

- Command: `node scripts/tests/test_0364_bus_pin_split_runtime_contract.mjs`
- Key output: 9 passed, 0 failed out of 9.
- Result: PASS

- Command: `node scripts/tests/test_0326_ui_event_busin_flow.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

- Command: `node scripts/tests/test_0322_imported_host_egress_server_flow.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_0326_imported_host_egress_bridge.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_bus_in_out.mjs`
- Key output: 7 passed, 0 failed out of 7.
- Result: PASS

- Command: `node scripts/tests/test_cell_connect_parse.mjs`
- Key output: 8 passed, 0 failed out of 8.
- Result: PASS

- Command: `node --check packages/worker-base/src/runtime.mjs && node --check packages/ui-model-demo-server/server.mjs && node --check scripts/run_worker_v0.mjs && node --check scripts/worker_engine_v0.mjs`
- Key output: syntax checks passed.
- Result: PASS

- Command: `git diff --check`
- Key output: no whitespace errors.
- Result: PASS

### Step 3 Review Attempt 22

- Reviewer: sub-agent `019e1c89-fad4-7f71-9994-7205c88e5275`
- Decision: Change Requested
- Key output: server direct-pin ingress accepted malformed non-legacy arrays marked `__mt_payload_kind=pin_payload.v1` because `isValidBusPayloadArray()` only checked record shape and legacy metadata absence.
- Result: PASS for review capture; requested malformed pin_payload direct-pin rejection and tests applied before re-review.

### Step 3 Attempt 22 Red Test

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 63 passed, 1 failed out of 64; failure proved positive model direct-pin accepted malformed `pin_payload.v1` arrays missing required envelope metadata.
- Result: PASS for red-test capture.

### Step 3 Verification Refresh After Attempt 22 Fixes

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 64 passed, 0 failed out of 64; includes positive/negative direct-pin rejection of malformed `pin_payload.v1` arrays.
- Result: PASS

- Command: `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

- Command: `node scripts/tests/test_0364_bus_pin_split_runtime_contract.mjs`
- Key output: 9 passed, 0 failed out of 9.
- Result: PASS

- Command: `node scripts/tests/test_0326_ui_event_busin_flow.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

- Command: `node scripts/tests/test_0322_imported_host_egress_server_flow.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_0326_imported_host_egress_bridge.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_bus_in_out.mjs`
- Key output: 7 passed, 0 failed out of 7.
- Result: PASS

- Command: `node scripts/tests/test_cell_connect_parse.mjs`
- Key output: 8 passed, 0 failed out of 8.
- Result: PASS

- Command: `node --check packages/worker-base/src/runtime.mjs && node --check packages/ui-model-demo-server/server.mjs && node --check scripts/run_worker_v0.mjs && node --check scripts/worker_engine_v0.mjs`
- Key output: syntax checks passed.
- Result: PASS

- Command: `git diff --check`
- Key output: no whitespace errors.
- Result: PASS

### Step 3 Review Attempt 21

- Reviewer: sub-agent `019e1c82-ea57-7041-81f1-7e627661b00c`
- Decision: Change Requested
- Key output: runtime, generic worker bootstrap, and server Matrix return parsing validated only the first matching metadata record, so duplicate required metadata could bypass strict checks.
- Result: PASS for review capture; requested duplicate metadata rejection and tests applied before re-review.

### Step 3 Attempt 21 Red Test

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 60 passed, 3 failed out of 63; failures proved runtime MQTT ingress, generic worker bootstrap validation, and server Matrix return path accepted duplicate required metadata records.
- Result: PASS for red-test capture.

### Step 3 Verification Refresh After Attempt 21 Fixes

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 63 passed, 0 failed out of 63; includes duplicate required metadata rejection in runtime MQTT ingress, generic worker bootstrap validation, and server Matrix return parsing.
- Result: PASS

- Command: `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

- Command: `node scripts/tests/test_0364_bus_pin_split_runtime_contract.mjs`
- Key output: 9 passed, 0 failed out of 9.
- Result: PASS

- Command: `node scripts/tests/test_0326_ui_event_busin_flow.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

- Command: `node scripts/tests/test_0322_imported_host_egress_server_flow.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_0326_imported_host_egress_bridge.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_bus_in_out.mjs`
- Key output: 7 passed, 0 failed out of 7.
- Result: PASS

- Command: `node scripts/tests/test_cell_connect_parse.mjs`
- Key output: 8 passed, 0 failed out of 8.
- Result: PASS

- Command: `node --check packages/worker-base/src/runtime.mjs && node --check packages/ui-model-demo-server/server.mjs && node --check scripts/run_worker_v0.mjs && node --check scripts/worker_engine_v0.mjs`
- Key output: syntax checks passed.
- Result: PASS

- Command: `git diff --check`
- Key output: no whitespace errors.
- Result: PASS

### Step 3 Review Attempt 20

- Reviewer: sub-agent `019e1c7c-a8cc-7740-bd38-3a106f4350eb`
- Decision: Change Requested
- Key output: server `isValidPublicPinName()` validated `value.trim()` and could accept padded `origin_worker_id` / `origin_pin` while endpoint/reply target were exact.
- Result: PASS for review capture; requested strict public pin-name validation and origin-only padded metadata test applied before re-review.

### Step 3 Attempt 20 Red Test

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 60 passed, 1 failed out of 61; failure proved server return path accepted padded origin metadata and materialized nested payload.
- Result: PASS for red-test capture.

### Step 3 Verification Refresh After Attempt 20 Fixes

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 61 passed, 0 failed out of 61; includes server rejection of origin-only padded pin payload metadata.
- Result: PASS

- Command: `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

- Command: `node scripts/tests/test_0364_bus_pin_split_runtime_contract.mjs`
- Key output: 9 passed, 0 failed out of 9.
- Result: PASS

- Command: `node scripts/tests/test_0326_ui_event_busin_flow.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

- Command: `node scripts/tests/test_0322_imported_host_egress_server_flow.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_0326_imported_host_egress_bridge.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_bus_in_out.mjs`
- Key output: 7 passed, 0 failed out of 7.
- Result: PASS

- Command: `node scripts/tests/test_cell_connect_parse.mjs`
- Key output: 8 passed, 0 failed out of 8.
- Result: PASS

- Command: `node --check packages/worker-base/src/runtime.mjs && node --check packages/ui-model-demo-server/server.mjs && node --check scripts/run_worker_v0.mjs && node --check scripts/worker_engine_v0.mjs`
- Key output: syntax checks passed.
- Result: PASS

- Command: `git diff --check`
- Key output: no whitespace errors.
- Result: PASS

### Step 3 Review Attempt 19

- Reviewer: sub-agent `019e1c75-72f5-7123-a3d1-4a81f3d70138`
- Decision: Change Requested
- Key output: WorkerEngine and generic worker bootstrap still trimmed padded `mqtt_topic_base`, allowing ` UIPUT/ws/dam/pic/de/sw ` to publish/validate as if it were valid.
- Result: PASS for review capture; requested no-trim topic-base validation and tests applied before re-review.

### Step 3 Attempt 19 Red Test

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 58 passed, 2 failed out of 60; failures proved WorkerEngine outbound and generic worker bootstrap accepted padded topic bases.
- Result: PASS for red-test capture.

### Step 3 Verification Refresh After Attempt 19 Fixes

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 60 passed, 0 failed out of 60; includes WorkerEngine outbound and generic worker bootstrap rejection of padded `mqtt_topic_base`.
- Result: PASS

- Command: `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

- Command: `node scripts/tests/test_0364_bus_pin_split_runtime_contract.mjs`
- Key output: 9 passed, 0 failed out of 9.
- Result: PASS

- Command: `node scripts/tests/test_0326_ui_event_busin_flow.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

- Command: `node scripts/tests/test_0322_imported_host_egress_server_flow.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_0326_imported_host_egress_bridge.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_bus_in_out.mjs`
- Key output: 7 passed, 0 failed out of 7.
- Result: PASS

- Command: `node scripts/tests/test_cell_connect_parse.mjs`
- Key output: 8 passed, 0 failed out of 8.
- Result: PASS

- Command: `node --check packages/worker-base/src/runtime.mjs && node --check packages/ui-model-demo-server/server.mjs && node --check scripts/run_worker_v0.mjs && node --check scripts/worker_engine_v0.mjs`
- Key output: syntax checks passed.
- Result: PASS

- Command: `git diff --check`
- Key output: no whitespace errors.
- Result: PASS

### Step 3 Review Attempt 18

- Reviewer: sub-agent `019e1c6d-3f96-7a10-90a6-4c59b4e6b7b6`
- Decision: Change Requested
- Key output: runtime direct bus-out and generic WorkerEngine outbound publish paths still accepted shortened `mqtt_topic_base=UIPUT` and could emit `UIPUT/R1/3000/submit`.
- Result: PASS for review capture; requested outbound fail-closed validation and tests applied before re-review.

### Step 3 Attempt 18 Red Test

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 57 passed, 2 failed out of 59; failures proved runtime direct bus out and WorkerEngine outbound publish could emit short-base topics.
- Result: PASS for red-test capture.

### Step 3 Verification Refresh After Attempt 18 Fixes

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 59 passed, 0 failed out of 59; includes runtime direct bus-out and WorkerEngine outbound rejection of shortened topic base.
- Result: PASS

- Command: `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

- Command: `node scripts/tests/test_0364_bus_pin_split_runtime_contract.mjs`
- Key output: 9 passed, 0 failed out of 9.
- Result: PASS

- Command: `node scripts/tests/test_0326_ui_event_busin_flow.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

- Command: `node scripts/tests/test_0322_imported_host_egress_server_flow.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_0326_imported_host_egress_bridge.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_bus_in_out.mjs`
- Key output: 7 passed, 0 failed out of 7.
- Result: PASS

- Command: `node scripts/tests/test_cell_connect_parse.mjs`
- Key output: 8 passed, 0 failed out of 8.
- Result: PASS

- Command: `node --check packages/worker-base/src/runtime.mjs && node --check packages/ui-model-demo-server/server.mjs && node --check scripts/run_worker_v0.mjs && node --check scripts/worker_engine_v0.mjs`
- Key output: syntax checks passed.
- Result: PASS

- Command: `git diff --check`
- Key output: no whitespace errors.
- Result: PASS

### Step 3 Review Attempt 17

- Reviewer: sub-agent `019e1c65-767d-7a81-a0f0-0111f9355f23`
- Decision: Change Requested
- Key output: runtime/bootstrap accepted shortened topic shape when `mqtt_topic_base` was set to `UIPUT`; server Matrix ingress still accepted top-level `mbr_ready` and mutated `system_ready` outside strict `pin_payload` records.
- Result: PASS for review capture; requested strict topic-base validation and Matrix compatibility removal applied before re-review.

### Step 3 Attempt 17 Red Test

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 54 passed, 3 failed out of 57; failures proved runtime/bootstrap accepted short `UIPUT/R1/3000/submit` shape and server Matrix `mbr_ready` mutated `system_ready`.
- Result: PASS for red-test capture.

### Step 3 Verification Refresh After Attempt 17 Fixes

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 57 passed, 0 failed out of 57; includes runtime/bootstrap rejection of shortened topic base and server rejection of Matrix `mbr_ready` compatibility events.
- Result: PASS

- Command: `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

- Command: `node scripts/tests/test_0364_bus_pin_split_runtime_contract.mjs`
- Key output: 9 passed, 0 failed out of 9.
- Result: PASS

- Command: `node scripts/tests/test_0326_ui_event_busin_flow.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

- Command: `node scripts/tests/test_0322_imported_host_egress_server_flow.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_0326_imported_host_egress_bridge.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_bus_in_out.mjs`
- Key output: 7 passed, 0 failed out of 7.
- Result: PASS

- Command: `node scripts/tests/test_cell_connect_parse.mjs`
- Key output: 8 passed, 0 failed out of 8.
- Result: PASS

- Command: `node --check packages/worker-base/src/runtime.mjs && node --check packages/ui-model-demo-server/server.mjs && node --check scripts/run_worker_v0.mjs && node --check scripts/worker_engine_v0.mjs`
- Key output: syntax checks passed.
- Result: PASS

- Command: `git diff --check`
- Key output: no whitespace errors.
- Result: PASS

### Step 3 Review Attempt 16

- Reviewer: sub-agent `019e1c5a-67bf-7012-8120-c6f1ee6e27ca`
- Decision: Change Requested
- Key output: server return parsing trimmed strict pin payload metadata before validation; generic worker validators accepted whitespace-only `op_id` / `__mt_request_id`.
- Result: PASS for review capture; requested strict string validation and tests applied before re-review.

### Step 3 Attempt 16 Red Test

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 52 passed, 3 failed out of 55; failures proved bootstrap/Matrix accepted whitespace-only request correlation and server return path accepted padded strict metadata.
- Result: PASS for red-test capture.

### Step 3 Verification Refresh After Attempt 16 Fixes

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 55 passed, 0 failed out of 55; includes rejection of whitespace-only request correlation in generic worker MQTT/Matrix validators and rejection of padded strict metadata in server return parsing.
- Result: PASS

- Command: `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

- Command: `node scripts/tests/test_0364_bus_pin_split_runtime_contract.mjs`
- Key output: 9 passed, 0 failed out of 9.
- Result: PASS

- Command: `node scripts/tests/test_0326_ui_event_busin_flow.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

- Command: `node scripts/tests/test_0322_imported_host_egress_server_flow.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_0326_imported_host_egress_bridge.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_bus_in_out.mjs`
- Key output: 7 passed, 0 failed out of 7.
- Result: PASS

- Command: `node scripts/tests/test_cell_connect_parse.mjs`
- Key output: 8 passed, 0 failed out of 8.
- Result: PASS

- Command: `node --check packages/worker-base/src/runtime.mjs && node --check packages/ui-model-demo-server/server.mjs && node --check scripts/run_worker_v0.mjs && node --check scripts/worker_engine_v0.mjs`
- Key output: syntax checks passed.
- Result: PASS

- Command: `git diff --check`
- Key output: no whitespace errors.
- Result: PASS

### Step 3 Review Attempt 14

- Reviewer: sub-agent `019e1c4b-5d14-7ed1-b080-f9de353e86b4`
- Decision: Change Requested
- Key output: runtime bus-in/bus-out still accepted malformed `__mt_payload_kind`, `__mt_request_id`, and `op_id` records in `pin_payload.v1` payloads.
- Result: PASS for review capture; requested runtime metadata type validation and tests applied before re-review.

### Step 3 Verification Refresh After Attempt 14 Fixes

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 51 passed, 0 failed out of 51; includes runtime bus-in, MQTT ingress, and bus-out externalization rejection of malformed `__mt_payload_kind`, `__mt_request_id`, and `op_id` metadata types.
- Result: PASS

- Command: `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

- Command: `node scripts/tests/test_0364_bus_pin_split_runtime_contract.mjs`
- Key output: 9 passed, 0 failed out of 9.
- Result: PASS

- Command: `node scripts/tests/test_0326_ui_event_busin_flow.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

- Command: `node scripts/tests/test_0322_imported_host_egress_server_flow.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_0326_imported_host_egress_bridge.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_bus_in_out.mjs`
- Key output: 7 passed, 0 failed out of 7.
- Result: PASS

- Command: `node scripts/tests/test_cell_connect_parse.mjs`
- Key output: 8 passed, 0 failed out of 8.
- Result: PASS

- Command: `node --check packages/worker-base/src/runtime.mjs && node --check packages/ui-model-demo-server/server.mjs && node --check scripts/run_worker_v0.mjs && node --check scripts/worker_engine_v0.mjs`
- Key output: syntax checks passed.
- Result: PASS

- Command: `git diff --check`
- Key output: no whitespace errors.
- Result: PASS

### Step 3 Review Attempt 13

- Reviewer: sub-agent `019e1c3f-4923-74e2-9e8b-dd4bf3fc9ea6`
- Decision: Change Requested
- Key output: runtime bus-in accepted malformed `pin_payload.v1` metadata types, and Matrix ingress wrote loose/old packets directly to `mbr_matrix_inbox` without the strict unified validator.
- Result: PASS for review capture; requested bus-in pin_payload validation and Matrix ingress validator fixes applied before re-review.

### Step 3 Verification Refresh After Attempt 13 Fixes

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 50 passed, 0 failed out of 50; includes runtime `pin.bus.cb.in` / `pin.bus.mb.in` rejection of malformed `pin_payload.v1` metadata types and Matrix ingress rejection of `v0`, extra top-level fields, legacy metadata, malformed records, and malformed metadata label types.
- Result: PASS

- Command: `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

- Command: `node scripts/tests/test_0364_bus_pin_split_runtime_contract.mjs`
- Key output: 9 passed, 0 failed out of 9.
- Result: PASS

- Command: `node scripts/tests/test_0326_ui_event_busin_flow.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

- Command: `node scripts/tests/test_0322_imported_host_egress_server_flow.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_0326_imported_host_egress_bridge.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_bus_in_out.mjs`
- Key output: 7 passed, 0 failed out of 7.
- Result: PASS

- Command: `node scripts/tests/test_cell_connect_parse.mjs`
- Key output: 8 passed, 0 failed out of 8.
- Result: PASS

- Command: `node --check packages/worker-base/src/runtime.mjs && node --check packages/ui-model-demo-server/server.mjs && node --check scripts/run_worker_v0.mjs && node --check scripts/worker_engine_v0.mjs`
- Key output: syntax checks passed.
- Result: PASS

- Command: `git diff --check`
- Key output: no whitespace errors.
- Result: PASS

### Step 3 Review Attempt 12

- Reviewer: sub-agent `019e1c36-2132-7fc3-b84f-f38249174dd6`
- Decision: Change Requested
- Key output: server return-path string metadata used coercion instead of requiring `t: str`, allowing malformed endpoint/reply target/op id records to materialize UI labels.
- Result: PASS for review capture; requested strict server metadata type validation and tests applied before re-review.

### Step 3 Verification Refresh After Attempt 12 Fixes

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 48 passed, 0 failed out of 48; includes server return-path rejection of non-`str` `__mt_payload_kind`, `__mt_request_id`, `op_id`, endpoint/origin worker and pin, and reply target worker and pin records.
- Result: PASS

- Command: `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

- Command: `node scripts/tests/test_0364_bus_pin_split_runtime_contract.mjs`
- Key output: 9 passed, 0 failed out of 9.
- Result: PASS

- Command: `node scripts/tests/test_0326_ui_event_busin_flow.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

- Command: `node scripts/tests/test_0322_imported_host_egress_server_flow.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_0326_imported_host_egress_bridge.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_bus_in_out.mjs`
- Key output: 7 passed, 0 failed out of 7.
- Result: PASS

- Command: `node scripts/tests/test_cell_connect_parse.mjs`
- Key output: 8 passed, 0 failed out of 8.
- Result: PASS

- Command: `node --check packages/worker-base/src/runtime.mjs && node --check packages/ui-model-demo-server/server.mjs && node --check scripts/run_worker_v0.mjs`
- Key output: syntax checks passed.
- Result: PASS

- Command: `git diff --check`
- Key output: no whitespace errors.
- Result: PASS

### Step 3 Review Attempt 11

- Reviewer: sub-agent `019e1c2d-6573-78d3-b9a2-6d6c93085ce9`
- Decision: Change Requested
- Key output: Temporary ModelTable record objects still allowed extra own properties, so removed metadata could be carried as `source_model_id` / `pin` / `route` properties beside the standard `id/p/r/c/k/t/v` fields.
- Result: PASS for review capture; requested exact record field-set validation and tests applied before re-review.

### Step 3 Verification Refresh After Attempt 11 Fixes

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 47 passed, 0 failed out of 47; includes legacy extra record property rejection across runtime ingress, runtime bus-in, bus-out externalization, `mt_bus_send`, generic worker bootstrap, and server direct/return paths.
- Result: PASS

- Command: `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

- Command: `node scripts/tests/test_0364_bus_pin_split_runtime_contract.mjs`
- Key output: 9 passed, 0 failed out of 9.
- Result: PASS

- Command: `node scripts/tests/test_0326_ui_event_busin_flow.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

- Command: `node scripts/tests/test_0322_imported_host_egress_server_flow.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_0326_imported_host_egress_bridge.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_bus_in_out.mjs`
- Key output: 7 passed, 0 failed out of 7.
- Result: PASS

- Command: `node scripts/tests/test_cell_connect_parse.mjs`
- Key output: 8 passed, 0 failed out of 8.
- Result: PASS

- Command: `node --check packages/worker-base/src/runtime.mjs && node --check packages/ui-model-demo-server/server.mjs && node --check scripts/run_worker_v0.mjs`
- Key output: syntax checks passed.
- Result: PASS

- Command: `git diff --check`
- Key output: no whitespace errors.
- Result: PASS

### Step 3 Review Attempt 10

- Reviewer: sub-agent `019e1c25-93f4-7ef2-9257-394023424619`
- Decision: Change Requested
- Key output: plain JSON object keys named `source_model_id`, `pin`, or `route` inside nested payload records were still accepted by runtime, server, and generic worker bootstrap.
- Result: PASS for review capture; requested plain JSON legacy-key rejection and tests applied before re-review.

### Step 3 Verification Refresh After Attempt 10 Fixes

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 43 passed, 0 failed out of 43; includes plain JSON `source_model_id`, `pin`, and `route` key rejection across runtime ingress, runtime bus-in, bus-out externalization, `mt_bus_send`, generic worker bootstrap, and server direct/return paths.
- Result: PASS

- Command: `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

- Command: `node scripts/tests/test_0364_bus_pin_split_runtime_contract.mjs`
- Key output: 9 passed, 0 failed out of 9.
- Result: PASS

- Command: `node scripts/tests/test_0326_ui_event_busin_flow.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

- Command: `node scripts/tests/test_0322_imported_host_egress_server_flow.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_0326_imported_host_egress_bridge.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_bus_in_out.mjs`
- Key output: 7 passed, 0 failed out of 7.
- Result: PASS

- Command: `node scripts/tests/test_cell_connect_parse.mjs`
- Key output: 8 passed, 0 failed out of 8.
- Result: PASS

- Command: `node --check packages/worker-base/src/runtime.mjs && node --check packages/ui-model-demo-server/server.mjs && node --check scripts/run_worker_v0.mjs`
- Key output: syntax checks passed.
- Result: PASS

- Command: `git diff --check`
- Key output: no whitespace errors.
- Result: PASS

### Step 3 Review Attempt 9

- Reviewer: sub-agent `019e1c1d-c6c5-7153-8c06-baeb42469826`
- Decision: Change Requested
- Key output: recursive legacy metadata scan had a fixed depth cap and runtime bus-in labels still accepted Temporary ModelTable arrays containing removed metadata records.
- Result: PASS for review capture; requested no-depth-cap scan and bus-in validation fixes applied before re-review.

### Step 3 Verification Refresh After Attempt 9 Fixes

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 39 passed, 0 failed out of 39; includes deeply nested legacy `source_model_id` rejection and runtime bus-in rejection of legacy metadata records.
- Result: PASS

- Command: `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

- Command: `node scripts/tests/test_0364_bus_pin_split_runtime_contract.mjs`
- Key output: 9 passed, 0 failed out of 9.
- Result: PASS

- Command: `node scripts/tests/test_0326_ui_event_busin_flow.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

- Command: `node scripts/tests/test_0322_imported_host_egress_server_flow.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_0326_imported_host_egress_bridge.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_bus_in_out.mjs`
- Key output: 7 passed, 0 failed out of 7.
- Result: PASS

- Command: `node scripts/tests/test_cell_connect_parse.mjs`
- Key output: 8 passed, 0 failed out of 8.
- Result: PASS

- Command: `node --check packages/worker-base/src/runtime.mjs && node --check packages/ui-model-demo-server/server.mjs && node --check scripts/run_worker_v0.mjs`
- Key output: syntax checks passed.
- Result: PASS

- Command: `git diff --check`
- Key output: no whitespace errors.
- Result: PASS

### Step 3 Review Attempt 8

- Reviewer: sub-agent `019e1c10-ccb5-7723-9b74-fcca65c321fe`
- Decision: Change Requested
- Key output: runtime, generic worker bootstrap, and server direct-pin validation still accepted nested Temporary ModelTable records whose `k` was removed legacy metadata such as `source_model_id`, `pin`, `route`, `reply_to`, or `route.reply_to`.
- Result: PASS for review capture; requested recursive nested-record validation and tests applied before re-review.

### Step 3 Verification Refresh After Attempt 8 Fixes

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 36 passed, 0 failed out of 36; includes nested legacy Temporary ModelTable record rejection across runtime ingress, runtime bus-out externalization, `mt_bus_send`, generic worker bootstrap validation, and server direct-pin paths for Model 0, positive models, and negative models.
- Result: PASS

- Command: `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

- Command: `node scripts/tests/test_0364_bus_pin_split_runtime_contract.mjs`
- Key output: 9 passed, 0 failed out of 9.
- Result: PASS

- Command: `node scripts/tests/test_0326_ui_event_busin_flow.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

- Command: `node scripts/tests/test_0322_imported_host_egress_server_flow.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_0326_imported_host_egress_bridge.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_bus_in_out.mjs`
- Key output: 7 passed, 0 failed out of 7.
- Result: PASS

- Command: `node scripts/tests/test_cell_connect_parse.mjs`
- Key output: 8 passed, 0 failed out of 8.
- Result: PASS

- Command: `node --check packages/worker-base/src/runtime.mjs && node --check packages/ui-model-demo-server/server.mjs && node --check scripts/run_worker_v0.mjs`
- Key output: syntax checks passed.
- Result: PASS

- Command: `git diff --check`
- Key output: no whitespace errors.
- Result: PASS

### Step 3 Review Attempt 1

- Reviewer: sub-agent `019e1bb6-2810-7662-afa5-e852bae243fb`
- Decision: Change Requested
- Key output: remove `stage2`/`uiput_9layer_v2`/legacy payload mode compatibility; enforce exact `version/type/payload` top-level packet keys in runtime and server direct/return paths.
- Result: PASS for review capture; requested runtime/server/test fixes applied before re-review.

### Step 3 Review Attempt 2

- Reviewer: sub-agent `019e1bc9-fdec-7541-8f48-eabf3cf163dd`
- Decision: Change Requested
- Key output: remove server `snapshot_delta/mt.v0` return materialization, remove direct `mgmt_bus_console_ack`, and reject legacy metadata records (`source_model_id`, `pin`, `route`, `reply_to`) inside `pin_payload` arrays.
- Result: PASS for review capture; requested server/test fixes applied before re-review.

### Step 3 Review Attempt 3

- Reviewer: sub-agent `019e1bd1-d88d-7141-b51f-cec8a03d356b`
- Decision: Change Requested
- Key output: runtime still accepted `reply_to` / `route.reply_to` records and nested `route.reply_to`; mgmt console ack did not check endpoint/reply target worker and pin; direct ack rejection test used stale model 1019 instead of 1036.
- Result: PASS for review capture; requested runtime/server/test fixes applied before re-review.

### Step 3 Review Attempt 4

- Reviewer: sub-agent `019e1bdb-5599-7e82-8357-b15562c1bc03`
- Decision: Change Requested
- Key output: runtime/server still needed recursive deep `route.reply_to` rejection in `bus_send.v1`, server return parsing needed to require outer `__mt_payload_kind=pin_payload.v1`, and current worker bootstrap still had old `/worker/.../model/.../pin/...` subscription and `mt.v0` acceptance.
- Result: PASS for review capture; requested runtime/server/bootstrap/test fixes applied before re-review.

### Step 3 Review Attempt 5

- Reviewer: sub-agent `019e1bed-1ee3-78b2-adf2-a750130c8e0d`
- Decision: Change Requested
- Key output: runtime still accepted unified MQTT topics targeting Model 0 bus inputs; generic worker bootstrap accepted strict packets on wildcard topics without validating positive endpoint model id or topic/payload endpoint match.
- Result: PASS for review capture; requested runtime/bootstrap/test fixes applied before re-review.

### Step 3 Review Attempt 6

- Reviewer: sub-agent `019e1bf7-516b-72b3-8a84-51a79176fe99`
- Decision: Change Requested
- Key output: server direct-pin path still accepted Temporary ModelTable arrays containing top-level or nested `reply_to` / `route.reply_to`; runtime startup still subscribed disallowed Model 0 BUS_IN endpoint topics.
- Result: PASS for review capture; requested server/runtime/test fixes applied before re-review.

### Step 3 Review Attempt 7

- Reviewer: sub-agent `019e1c03-6cac-7bd3-91de-a2cf9e8a81ef`
- Decision: Change Requested
- Key output: generic worker bootstrap validated endpoint match but not full Temporary ModelTable record schema; positive/negative direct-pin paths still accepted arrays with legacy metadata; runtime/bootstrap accepted non-canonical model id topic segments such as `1e3`, `01000`, `1000.0`, and `0x3e8`.
- Result: PASS for review capture; requested bootstrap/runtime/server/test fixes applied before re-review.

### Step 3 Verification Refresh After Attempt 4 Fixes

- Command: `node --check packages/worker-base/src/runtime.mjs && node --check packages/ui-model-demo-server/server.mjs && node --check scripts/worker_engine_v0.mjs && node --check scripts/run_worker_v0.mjs`
- Key output: syntax checks passed.
- Result: PASS

- Command: `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- Key output: 33 passed, 0 failed out of 33; includes recursive old `route.reply_to` rejection, strict outer `pin_payload.v1` record-kind requirement, unified-only generic worker subscription, `model_id=0` / non-integer / non-canonical topic rejection, full generic worker topic/payload endpoint validation, no Model 0 bus-in startup subscription, and server direct-pin rejection of legacy `reply_to` records inside arrays for Model 0, positive models, and negative models.
- Result: PASS

- Command: `node scripts/tests/test_0332_modeltable_pin_payload_contract.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

- Command: `node scripts/tests/test_0364_bus_pin_split_runtime_contract.mjs`
- Key output: 9 passed, 0 failed out of 9.
- Result: PASS

- Command: `node scripts/tests/test_0326_ui_event_busin_flow.mjs`
- Key output: 31 passed, 0 failed out of 31.
- Result: PASS

- Command: `node scripts/tests/test_0322_imported_host_egress_server_flow.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_0326_imported_host_egress_bridge.mjs`
- Key output: 1 passed, 0 failed out of 1.
- Result: PASS

- Command: `node scripts/tests/test_bus_in_out.mjs && node scripts/tests/test_cell_connect_parse.mjs`
- Key output: 7 passed / 0 failed and 8 passed / 0 failed.
- Result: PASS

- Command: `rg -n "uiput_9layer_v2|stage2|return_topic|returnTopic|result_topic|route\\.reply_to|source_model_id|/worker/|/model/|/pin/|mt\\.v0|snapshot_delta" packages/worker-base/src packages/ui-model-demo-server scripts/worker_engine_v0.mjs scripts/run_worker_v0.mjs scripts/run_worker_remote_v1.mjs`
- Key output: only explicit hard-rejection checks for old `source_model_id` / `route.reply_to` remain in runtime/server; no active old topic, return topic, `mt.v0`, or `snapshot_delta` path remains in Step 3 active surfaces.
- Result: PASS

- Command: `git diff --check`
- Key output: no whitespace errors.
- Result: PASS
