---
id: 0368
title: worker-role-mbr-refill-submit-docs
doc_type: iteration_runlog
status: Completed
updated: 2026-05-11
source: ai
branch: dev_0368-worker-role-mbr-refill-submit-docs
iteration_id: 0368-worker-role-mbr-refill-submit-docs
phase: phase4
---

# Iteration 0368 Worker Role, MBR Refill, And Minimal Submit Docs Runlog

## Environment

- Date: 2026-05-11
- Branch: `dev_0368-worker-role-mbr-refill-submit-docs`
- Runtime: local macOS development workspace
- Starting point: `692f8da fix(frontend): seed model100 input draft`

## Review Gate Record

- Iteration ID: 0368-worker-role-mbr-refill-submit-docs
- Review Date: 2026-05-11
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes: User approved starting this iteration after the readonly audit found active `is_DEM`, `MGMT_OUT`, and direct provider `ctx.publishMqtt` gaps.

## Execution Records

### Step 1 - Planning And Gate

- Command: `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0368-worker-role-mbr-refill-submit-docs --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Key output: scaffold wrote `plan.md`, `resolution.md`, and `runlog.md`.
- Command: `git diff --check`
- Key output: no whitespace errors.
- Review: `codex-code-review` requested unconditional local redeploy wording, `git diff --check` evidence, and execution-governance assessment. All fixes were made; final re-review returned `Decision: APPROVED`.
- Result: PASS
- Commit: `4019771 docs(iteration): plan 0368 worker role refill`

### Step 2/3 - Worker Role Contract And Runtime Enforcement

- Change: Replaced active worker identity and role truth with `k=sys_worker_id, t=worker.id` and `k=sys_worker_role, t=worker.role, v="DEM"|"V1N"|"WSM"` in runtime, UI server bootstrap, local demo/gallery stores, and worker role patches.
- Change: Runtime now rejects removed `is_DEM`, old `k=worker.role`, and old `v1n_id` labels visibly.
- Change: SSOT/user-guide wording now states `sys_worker_id` is first trusted-bootstrap write plus explicit maintenance only, and uses project terms for startup order.
- Command: `node scripts/tests/test_0364_bus_pin_split_runtime_contract.mjs`
- Key output: initially `6 passed, 0 failed out of 6`; after review fix `7 passed, 0 failed out of 7`.
- Command: `node scripts/tests/test_0364_system_refill_contract.mjs`
- Key output: `6 passed, 0 failed out of 6`.
- Command: `node scripts/tests/test_0326_ui_event_busin_flow.mjs`
- Key output: `31 passed, 0 failed out of 31`.
- Command: `node scripts/tests/test_0364_slide_import_bus_binding_contract.mjs`
- Key output: `2 passed, 0 failed out of 2`.
- Command: `node scripts/tests/test_0364_docs_split_bus_contract.mjs`
- Key output: `4 passed, 0 failed out of 4`.
- Command: `node scripts/validate_builtins_v0.mjs`
- Key output: all builtins PASS, including `sys_worker_id` lock and removed `pin.connect.model`.
- Command: `rg -n "k\"\\s*:\\s*\"v1n_id\"|k\"\\s*:\\s*\"worker.role\"|k\"\\s*:\\s*\"is_DEM\"" packages scripts deploy docs/ssot docs/user-guide test_files -S`
- Key output: only removed-label negative tests remain.
- Command: `git diff --check`
- Key output: no whitespace errors.
- Review: `codex-code-review` requested a guard against downgrading DEM role after `pin.bus.mb.*` was installed, plus removal of stale 0364 future-tense wording from the user guide. Runtime guard and deterministic test were added; user guide wording was updated.
- Review fix 2: Re-review found `docs/handover/dam-worker-guide.md` still taught removed `pin.bus.in/out` and old connection terms. Updated it to split bus, `pin.connect.cell`, `pin.connect.label`, and `model.submt`; added it to `test_0364_docs_split_bus_contract.mjs`.
- Review: final Step 2/3 re-review returned `Decision: APPROVED`, no findings, no open questions, no verification gaps.
- Result: PASS
- Commit: pending

### Step 4 - MBR And Remote-Worker Refill

- Change: Refilled MBR so management-bus inbound packets write Model 0 `mbr_cb_out` (`pin.bus.cb.out`) for control-bus forwarding and `mbr_mb_out` (`pin.bus.mb.out`) for management-bus forwarding.
- Change: Refilled remote-worker so provider models return ModelTable-shaped `pin_payload.v1` records through hosted model `result` pins; Model 0 routes those hosted result pins to `remote_result_bus` (`pin.bus.cb.out`).
- Change: Removed direct transport capabilities from runtime/worker function contexts (`ctx.publishMqtt` / `ctx.sendMatrix`) and removed server/system legacy `MGMT_OUT` / `MGMT_IN` execution paths.
- Change: Mgmt Bus Console send now writes Model 0 `mgmt_bus_console_mb_out` (`pin.bus.mb.out`) and MBR ack returns as a management-bus `pin_payload` carrying `mgmt_bus_console.ack.v1`.
- Command: `node scripts/validate_mbr_patch_v0.mjs`
- Key output: initially `TOTAL: 54  PASS: 54  FAIL: 0`; after review fixes `TOTAL: 68  PASS: 68  FAIL: 0`, including invalid raw bus payload, missing/rejecting adapter failure checks, same-engine retry, and same-key async overwrite protection.
- Command: `node scripts/tests/test_0342_mgmt_bus_console_real_messaging_contract.mjs`
- Key output: all 13 management bus console contract checks PASS, including Matrix unavailable/reject failure observability and retry.
- Command: `node scripts/tests/test_0362_mbr_remote_worker_route_contract.mjs`
- Key output: `6 passed, 0 failed out of 6`.
- Command: `node scripts/tests/test_0359_minimal_submit_matrix_e2e_contract.mjs`
- Key output: `5 passed, 0 failed out of 5`.
- Command: `node scripts/tests/test_0144_mbr_compat.mjs && node scripts/tests/test_0177_mbr_bridge_contract.mjs && node scripts/tests/test_0179_mbr_route_contract.mjs && node scripts/tests/test_0184_mbr_direct_event_bridge_contract.mjs`
- Key output: all MBR bridge route checks PASS.
- Command: `node scripts/validate_intent_dispatch_pin_v0.mjs && node scripts/validate_intent_dispatch_mgmt_v0.mjs`
- Key output: removed legacy intent actions fail closed with PASS checks.
- Command: `node scripts/tests/test_0364_system_refill_contract.mjs && node scripts/tests/test_0364_bus_pin_split_runtime_contract.mjs && node scripts/tests/test_0351_slide_app_minimal_provider_guide_contract.mjs`
- Key output: role refill, split bus, and provider guide contract checks PASS.
- Command: `rg -n "MGMT_OUT|MGMT_IN|ctx\\.publishMqtt|publishMqtt\\(|sendMatrix:|ctx\\.sendMatrix" deploy/sys-v1ns scripts packages test_files -S`
- Key output: no active runtime/deploy references; remaining hits are negative assertions only.
- Command: `node --check scripts/worker_engine_v0.mjs && node --check packages/ui-model-demo-server/server.mjs && git diff --check`
- Key output: syntax and whitespace checks PASS.
- Review: first `codex-code-review` returned `CHANGE_REQUESTED` for Mgmt Bus Console ack drop and direct `sendMatrix(packet)` from UI Server console intent. Both were fixed.
- Review: second `codex-code-review` returned `CHANGE_REQUESTED` for raw label.v fallback in split-bus bridges and silent deletion on missing adapters. WorkerEngine and UI Server now require `_pinBusOutValueToExternalPayload`; WorkerEngine writes `split_bus_out_error` and retains valid unsent bus output when adapters/topics are missing.
- Review: third `codex-code-review` returned `CHANGE_REQUESTED` for management-bus publish rejection deleting pins and UI Server marking Matrix bridge success before send confirmation. WorkerEngine/UI Server now mark success only after send success, retain failed pins, and write observable errors.
- Review: fourth `codex-code-review` returned `CHANGE_REQUESTED` for WorkerEngine not retrying retained pins on the same engine and async success being able to delete a later same-key op. WorkerEngine now scans retained root bus out pins, records short retry guards, and deletes only when the current label still has the same `op_id`.
- Review: final Step 4 re-review returned `Decision: APPROVED`, no findings, no open questions, no verification gaps.
- Result: PASS

### Step 5 - Minimal Submit JSON Patch And HTML Explanation

- Change: Updated `test_files/minimal_submit_dual_bus_app_payload.json` so the UI-side `handle_submit` reads only the `text` record and no longer accepts nested `value.text` fallback.
- Change: Regenerated `test_files/minimal_submit_dual_bus.zip` as a single-file `app_payload.json` archive matching the JSON fixture.
- Change: Updated remote-worker Model 3000 submit handler so it reads only `text` and no longer accepts `message_text`.
- Change: Expanded `minimal_submit_app_provider_guide.md`, `minimal_submit_app_provider_visualized.md`, and `minimal_submit_app_provider_interactive.html` to explain the actual label groups: `host_ingress_v1`, `remote_bus_endpoint_v1`, `dual_bus_model`, `click_chain`, `root_routes`, `submit_request`, `submit_request_wiring`, `handle_submit`, and `submit1`.
- Command: `node scripts/tests/test_0360_minimal_submit_dual_bus_docs_contract.mjs`
- Key output: `3 passed, 0 failed out of 3`.
- Command: `node scripts/tests/test_0361_minimal_submit_import_export_contract.mjs`
- Key output: `3 passed, 0 failed out of 3`.
- Command: `node scripts/tests/test_0351_slide_app_minimal_provider_guide_contract.mjs`
- Key output: `4 passed, 0 failed out of 4`.
- Command: `node scripts/tests/test_0359_minimal_submit_matrix_e2e_contract.mjs`
- Key output: `5 passed, 0 failed out of 5`.
- Command: `node scripts/tests/test_0362_mbr_remote_worker_route_contract.mjs`
- Key output: `8 passed, 0 failed out of 8`; includes missing and invalid `route.reply_to` negative cases that must not write a public result pin or publish a bus result.
- Command: `unzip -p test_files/minimal_submit_dual_bus.zip app_payload.json | rg -n "message_text|readPayload\\('value'|nestedValue|input_value|pin\\.connect\\.model|ctx\\.(writeLabel|getLabel|rmLabel)|ctx\\.publishMqtt|mbr_route_" -S || true`
- Key output: no matches.
- Command: `node --check scripts/tests/test_0360_minimal_submit_dual_bus_docs_contract.mjs && node --check scripts/tests/test_0361_minimal_submit_import_export_contract.mjs && node --check scripts/tests/test_0351_slide_app_minimal_provider_guide_contract.mjs && node --check scripts/tests/test_0362_mbr_remote_worker_route_contract.mjs && git diff --check`
- Key output: syntax and whitespace checks PASS.
- Review: first `codex-code-review` returned `CHANGE_REQUESTED` because remote-worker returned ordinary result payload when `route.reply_to` was missing. The handler now returns `null` after writing local error state; `test_0362_mbr_remote_worker_route_contract.mjs` covers the no-public-result/no-publish case.
- Review: second `codex-code-review` returned `CHANGE_REQUESTED` because the developer guide still contained `return payload` / raw `return resultPayload` examples. The guide now teaches only `pin_payload.v1` return or `return null` on invalid `reply_to`; `test_0360_minimal_submit_dual_bus_docs_contract.mjs` now guards this.
- Review: third `codex-code-review` returned `CHANGE_REQUESTED` because one copy-paste snippet only checked truthy `reply_to` fields and the visual diagram still showed raw `resultPayload`. Both snippets now use strict segment validation and the visual diagram shows `pin_payload.v1`; `test_0360_minimal_submit_dual_bus_docs_contract.mjs` guards both regressions.
- Review: final Step 5 re-review returned `Decision: APPROVED`, no findings, no open questions, no verification gaps.
- Result: PASS

### Step 6 - Local Refill Deploy And Real Browser Verification

- Change: Synced local persisted MBR and remote-worker role assets from `deploy/sys-v1ns/**` into `/Users/drop/dongyu/volume/persist/assets/roles/**`.
- Change: Synced user-guide public docs into `/Users/drop/dongyu/volume/persist/ui-server/public/docs`.
- Change: Refreshed local runtime images for UI Server, MBR worker, remote-worker, and UI-side worker; then restarted `ui-server`, `mbr-worker`, `remote-worker`, and `ui-side-worker` in the local `dongyu` namespace.
- Note: `bash scripts/ops/deploy_local.sh` reached the asset sync/UI/remote-worker image stages but failed while pulling Docker Hub base image `node:22-slim` for MBR because the registry TLS certificate resolved to an unrelated certificate. To keep the deploy deterministic without pulling from the network, MBR/UI-side images were rebuilt from already-present local base images and then restarted.
- Command: `bash scripts/ops/check_runtime_baseline.sh`
- Key output: `All required deployments are ready`, `No terminating pods`, required Matrix secrets ready, and `Local runtime baseline is ready`.
- Command: `curl -fsS http://127.0.0.1:30900/ | head -c 200`
- Key output: returned the local UI HTML shell.
- Command: `rg -n "is_DEM|MGMT_OUT|MGMT_IN|ctx\\.publishMqtt|pin\\.connect\\.model|mbr_route_|return buildReplyBusPayload\\(resultPayload\\) \\|\\| resultPayload|return resultPayload;|return payload;" /Users/drop/dongyu/volume/persist/assets/roles/mbr /Users/drop/dongyu/volume/persist/assets/roles/remote-worker -S || true`
- Key output: no matches in deployed local MBR/remote-worker role assets.
- Browser: Playwright headed browser opened `http://127.0.0.1:30900/#/workspace`.
- Browser: Opened `E2E 颜色生成器`, entered `color check 0368`, clicked `Generate Color`; color changed from `#FFFFFF` to `#cf7b31` and status became `processed`.
- Browser: Opened `滑动 APP 导入`, uploaded `test_files/minimal_submit_dual_bus.zip`; network request `POST /api/media/upload?filename=minimal_submit_dual_bus.zip` returned `200`.
- Browser: Clicked `导入 Slide App`; workspace created and opened imported app model `1055` named `最小 Submit 双总线示例`.
- Browser: Entered `0368 browser dual bus ok`, clicked `Submit`; UI updated to `Submitted: 0368 browser dual bus ok` and status badge became `remote_processed`.
- Runtime log: `remote-worker` subscribed to `UIPUT/ws/dam/pic/de/sw/worker/RE/model/3000/pin/submit1`, received the browser submit packet, and published the result via `UIPUT/ws/dam/pic/de/sw/worker/RE/model/0/pin/remote_result_bus`.
- Runtime log: `mbr-worker` received the management-bus `pin_payload`, published it to the remote-worker MQTT topic, then received the remote result packet from `remote_result_bus`.
- Artifact: browser screenshot saved at `output/playwright/0368-local-workspace-minimal-submit-success.png`.
- Result: PASS

### Step 7 - Closure Review Fixes

- Review: final `codex-code-review` returned `CHANGE_REQUESTED` because `docs/user-guide/modeltable_user_guide.md` still taught removed `MGMT_OUT` / `MGMT_IN` instructions, and 0368 was still marked `Approved`.
- Change: Rewrote `modeltable_user_guide.md` Management Bus section to use only split bus pins, `pin_payload.v1`, `route.to`, `route.reply_to`, and the current Submit / Result path.
- Change: Marked 0368 as `Completed` in `docs/ITERATIONS.md`; updated plan/resolution/runlog frontmatter status, and moved runlog to `phase4`.
- Change: Extended `test_0364_docs_split_bus_contract.mjs` so current user guides cannot keep active `MGMT_OUT` / `MGMT_IN` instructions.
- Command: `node scripts/tests/test_0364_docs_split_bus_contract.mjs`
- Key output: `4 passed, 0 failed out of 4`.
- Command: `rg -n "MGMT_OUT|MGMT_IN" docs/user-guide/modeltable_user_guide.md docs/user-guide/slide_delivery_and_runtime_overview_v1.md docs/user-guide/workspace_ui_filltable_example.md docs/user-guide/ui_components_v2.md docs/user-guide/slide_matrix_delivery_v1.md docs/architecture_mantanet_and_workers.md docs/handover/dam-worker-guide.md -S`
- Key output: no matches.
- Command: `git diff --check`
- Key output: no whitespace errors.
- Review: re-review returned `CHANGE_REQUESTED` because two provider-guide copy-paste JSON snippets still used an older `submit1` handler that only returned `display_text`.
- Change: Updated both embedded `submit1` JSON snippets so their returned `resultPayload` includes `display_text`, `remote_status=remote_processed`, `last_submit_payload`, and `submit_inflight=false`, matching the deployed Model 3000 patch.
- Change: Extended `test_0351_slide_app_minimal_provider_guide_contract.mjs` to reject the stale display-only handler and require the current result fields in embedded snippets.
- Command: `node scripts/tests/test_0351_slide_app_minimal_provider_guide_contract.mjs`
- Key output: `5 passed, 0 failed out of 5`.
- Command: `node scripts/tests/test_0360_minimal_submit_dual_bus_docs_contract.mjs`
- Key output: `3 passed, 0 failed out of 3`.
- Command: `git diff --check`
- Key output: no whitespace errors.
- Review: re-review returned `CHANGE_REQUESTED` because Workspace seed Model 1050 still accepted nested `value.text` / `value.source` fallback, and the manual result example omitted `last_submit_payload`.
- Change: Removed nested value fallback from `packages/worker-base/system-models/workspace_positive_models.json` Model 1050 `handle_submit`; it now reads only `text` and `source` records.
- Change: Added `last_submit_payload` to the manual result payload example in the minimal Submit provider guide.
- Change: Extended `test_0360_minimal_submit_dual_bus_docs_contract.mjs` so Model 1050 seed and docs examples cannot drift back to these old shapes.
- Command: `node scripts/tests/test_0360_minimal_submit_dual_bus_docs_contract.mjs`
- Key output: `4 passed, 0 failed out of 4`.
- Command: `node scripts/tests/test_0351_slide_app_minimal_provider_guide_contract.mjs`
- Key output: `5 passed, 0 failed out of 5`.
- Command: `node scripts/tests/test_0361_minimal_submit_import_export_contract.mjs`
- Key output: `3 passed, 0 failed out of 3`.
- Command: `node --check scripts/tests/test_0360_minimal_submit_dual_bus_docs_contract.mjs && git diff --check`
- Key output: no syntax or whitespace errors.
- Review: re-review returned `CHANGE_REQUESTED` because visualized and interactive docs still had manual result examples without `last_submit_payload`.
- Change: Added `last_submit_payload` to visualized and interactive manual result examples; added `op_id` to the visualized example so all three docs expose the same manual result shape.
- Change: Extended `test_0360_minimal_submit_dual_bus_docs_contract.mjs` so all public docs must include `display_text`, `remote_status`, `last_submit_payload`, and `submit_inflight` in manual result examples.
- Command: `node scripts/tests/test_0360_minimal_submit_dual_bus_docs_contract.mjs`
- Key output: `4 passed, 0 failed out of 4`.
- Command: `node scripts/tests/test_0351_slide_app_minimal_provider_guide_contract.mjs`
- Key output: `5 passed, 0 failed out of 5`.
- Command: `node --check scripts/tests/test_0360_minimal_submit_dual_bus_docs_contract.mjs && git diff --check`
- Key output: no syntax or whitespace errors.
- Browser: after restarting UI Server and testing Model 1050, the root model correctly received `remote_status=remote_processed`, but the visible StatusBadge still showed `idle` because the seed StatusBadge referenced Model 0.
- Change: Fixed `packages/worker-base/system-models/workspace_positive_models.json` so Model 1050 StatusBadge reads Model 1050 `remote_status` instead of Model 0.
- Change: Extended `test_0360_minimal_submit_dual_bus_docs_contract.mjs` to guard this seed binding.
- Command: `node scripts/tests/test_0360_minimal_submit_dual_bus_docs_contract.mjs`
- Key output: `4 passed, 0 failed out of 4`.
- Command: `node scripts/tests/test_0361_minimal_submit_import_export_contract.mjs`
- Key output: `3 passed, 0 failed out of 3`; ZIP temp model id remains `0` because import remaps it to the installed model id.
- Command: `LOCAL_PERSISTED_ASSET_ROOT=/Users/drop/dongyu/volume/persist/assets bash scripts/ops/sync_local_persisted_assets.sh`
- Key output: local persisted assets synced.
- Command: `kubectl -n dongyu rollout restart deployment/ui-server && kubectl -n dongyu rollout status deployment/ui-server --timeout=180s`
- Key output: UI Server successfully rolled out.
- Command: `bash scripts/ops/check_runtime_baseline.sh`
- Key output: baseline ready.
- Browser: Playwright reopened Workspace, opened seed model `1050`, submitted `0368 final retest remote`; visible page contained `Submitted: 0368 final retest remote` and `remote_processed`.
- Runtime log: `remote-worker` received topic `UIPUT/ws/dam/pic/de/sw/worker/RE/model/3000/pin/submit1` and published `remote_result_bus` with `display_text`, `remote_status`, `last_submit_payload`, and `submit_inflight`.
- Runtime log: `mbr-worker` published the submit packet to remote-worker and received the return packet from `remote_result_bus`.
- Artifact: browser screenshot saved at `output/playwright/0368-final-minimal-submit-retest.png`.
- Review: final re-review returned `CHANGE_REQUESTED` because active SSOT still mentioned direct transport helpers and old management bus labels as current/temporary paths.
- Change: Updated `docs/ssot/runtime_semantics_modeltable_driven.md`, `docs/ssot/ui_to_matrix_event_flow.md`, `docs/ssot/host_ctx_api.md`, and `docs/ssot/tier_boundary_and_conformance_testing.md` so current SSOT only authorizes split bus pins and `pin_payload.v1`.
- Change: Extended `test_0364_docs_split_bus_contract.mjs` to reject old management bus labels and direct transport helper names in active SSOT docs.
- Command: `node scripts/tests/test_0364_docs_split_bus_contract.mjs`
- Key output: `4 passed, 0 failed out of 4`.
- Command: `rg -n "MGMT_OUT|MGMT_IN|ctx\\.publishMqtt|ctx\\.sendMatrix|publishMqtt" docs/ssot docs/user-guide/modeltable_user_guide.md docs/user-guide/slide-app-runtime -S`
- Key output: no matches.
- Command: `git diff --check`
- Key output: no whitespace errors.
- Result: PASS

### Step 8 - Final Worker Identity Label Revision And Browser Verification

- Change: Updated the final worker identity contract to `k=sys_worker_id, t=worker.id` and `k=sys_worker_role, t=worker.role, v="DEM"|"V1N"|"WSM"` per user-provided table.
- Change: Runtime now rejects old `v1n_id`, old `k=worker.role`, and old `is_DEM`; `pin.bus.mb.*` remains accepted only when `sys_worker_role="DEM"`.
- Change: Refilled `mbr`, `remote-worker`, and `ui-side-worker` patches with `sys_worker_id` / `sys_worker_role`; UI Server bootstrap now seeds `sys_worker_role="DEM"`.
- Change: Updated SSOT/user-guide/architecture docs and added canonical topic test for `UIPUT/<workspace>/<dam>/<pic>/<de>/<sw>/worker/<worker_id>/model/<model_id>/pin/<pin>`.
- Command: `node scripts/tests/test_0364_bus_pin_split_runtime_contract.mjs`
- Key output: `9 passed, 0 failed out of 9`.
- Command: `node scripts/tests/test_0364_system_refill_contract.mjs`
- Key output: `6 passed, 0 failed out of 6`.
- Command: `node scripts/tests/test_0326_ui_event_busin_flow.mjs`
- Key output: `31 passed, 0 failed out of 31`.
- Command: `node scripts/tests/test_0306_runtime_mailbox_ingress_contract.mjs`
- Key output: `2 passed, 0 failed out of 2`.
- Command: `node scripts/tests/test_0336_mgmt_bus_console_contract.mjs`
- Key output: `7 PASS results`.
- Command: `node scripts/tests/test_0339_mgmt_bus_console_live_projection_contract.mjs`
- Key output: `5 PASS results`.
- Command: `node scripts/validate_builtins_v0.mjs`
- Key output: builtins PASS, including `sys_worker_id` lock and removed `pin.connect.model`.
- Command: `node scripts/validate_mbr_patch_v0.mjs`
- Key output: `TOTAL: 69  PASS: 69  FAIL: 0`.
- Command: `node scripts/tests/test_0342_mgmt_bus_console_real_messaging_contract.mjs`
- Key output: `13 PASS results`.
- Command: `node scripts/tests/test_0362_mbr_remote_worker_route_contract.mjs`
- Key output: `9 passed, 0 failed out of 9`.
- Command: `node scripts/tests/test_0364_docs_split_bus_contract.mjs`
- Key output: `5 passed, 0 failed out of 5`.
- Command: `npm -C packages/ui-model-demo-frontend run build`
- Key output: production build succeeded.
- Command: `npm -C packages/ui-model-demo-frontend run test`
- Key output: all editor validations PASS.
- Command: `LOCAL_PERSISTED_ASSET_ROOT=/Users/drop/dongyu/volume/persist/assets bash scripts/ops/sync_local_persisted_assets.sh && LOCAL_DY_PERSIST_ROOT=/Users/drop/dongyu/volume/persist/ui-server bash scripts/ops/sync_ui_public_docs.sh`
- Key output: persisted assets and public docs synced.
- Command: overlay `docker build` for `dy-ui-server:v1`, `dy-remote-worker:v3`, `dy-mbr-worker:v2`, and `dy-ui-side-worker:v1`.
- Key output: all four local images rebuilt from current runtime/server/worker sources and role patches.
- Command: `kubectl -n dongyu rollout restart deploy/ui-server deploy/remote-worker deploy/mbr-worker deploy/ui-side-worker` plus rollout status checks.
- Key output: all four deployments successfully rolled out.
- Command: `bash scripts/ops/check_runtime_baseline.sh`
- Key output: baseline ready after old terminating pods exited.
- Command: in-pod source scans for `sys_worker_role` and removed `getMgmtInbox` / `clearMgmtInbox`.
- Key output: running pods contain new role labels and no direct management inbox helpers.
- Command: persisted asset scan for old worker labels under `/Users/drop/dongyu/volume/persist/assets/roles/{mbr,remote-worker,ui-side-worker}`.
- Key output: only `sys_worker_id` and `sys_worker_role`; no old role/identity label records.
- Browser: Playwright opened `http://127.0.0.1:30900/#/workspace`, filled the color generator input, clicked `Generate Color`, and the visible color changed from `#FFFFFF` to `#eb2393`; status changed to `processed`.
- Browser: Playwright opened `Mgmt Bus Console`, sent `0368 browser mgmt 1778494677` to `@mbr:localhost`; timeline and transcript showed both outbound `sent` and inbound Matrix `received`; status stayed `ack_received`.
- Browser: Playwright opened `滑动 APP 导入`, uploaded `test_files/minimal_submit_dual_bus.zip`, clicked import, and the new app `1056` appeared in the Workspace asset tree.
- Browser: Playwright opened imported app `1056`, submitted `0368 imported submit 1778494726`, and the visible app showed `Submitted: 0368 imported submit 1778494726` plus `remote_processed`.
- Runtime snapshot: model `1056` root has `display_text="Submitted: 0368 imported submit 1778494726"` and `remote_status="remote_processed"`.
- Artifact: browser screenshot saved at `output/playwright/0368-final-worker-role-submit-browser.png`.
- Review: `codex-code-review` first requested fixing the public topic string in `modeltable_user_guide.md`; fix added a docs test, and re-review returned `Decision: APPROVED`.
- Result: PASS

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` assessed; update required in Step 2.
- [x] `docs/user-guide/modeltable_user_guide.md` assessed; update required in Step 2.
- [x] `docs/ssot/label_type_registry.md` assessed; updated for `sys_worker_id / worker.id` and `sys_worker_role / worker.role`.
- [x] `docs/architecture_mantanet_and_workers.md` assessed; update likely required for role terminology.
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed; no update required because this iteration changes runtime/dataflow contracts, not AI execution governance.
