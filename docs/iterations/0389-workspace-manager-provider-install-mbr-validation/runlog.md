---
title: "0389 Workspace Manager Provider Install MBR Validation Runlog"
doc_type: iteration_runlog
status: completed
updated: 2026-05-20
source: codex
---

# 0389 Runlog

## Stage 0389.1 Planning And Root Cause

- Browser reproduction:
  - `工作区管理器` showed status `requesting 最小 Submit 双总线示例 from UIPUT/ws/dam/pic/de/sw/R1/3100/bundle_request`.
  - No newly installed slide app appeared.
- Runtime evidence:
  - RemoteWorker R1 subscribes to `UIPUT/ws/dam/pic/de/sw/R1/3100/bundle_request`.
  - RemoteWorker R1 publishes `slide_app_bundle_response.v1` for the requested asset.
  - MBR logs show `drop invalid mqtt topic=UIPUT/ws/dam/pic/de/sw/R1/3100/bundle_request reason=legacy_pin_payload_metadata_removed`.
- Root cause:
  - The legacy metadata guard recursively scans arbitrary business payloads and rejects valid UI model JSON fields such as `write.pin` inside provider bundle ModelTable records.
- 0389.1 review: `019e4588-9e15-7540-a632-3926d547e76e` returned `CHANGE_REQUESTED`.
- Fixes applied:
  - Switched to dedicated branch `dropx/dev_0389-workspace-manager-provider-install-mbr-validation`.
  - Made MBR filled-model code contract testing mandatory in Stage 0389.2.
  - Required the failing regression input to be based on the real R1 `slide_app_bundle_response.v1` shape with nested UI `write.pin`.
- 0389.1 re-review: pending.
- 0389.1 re-review: `019e458a-9b72-7560-950d-69b940cf370e` returned `APPROVED`.

## Stage 0389.2 Failing Tests

- CWD: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Added RED coverage to:
  - `scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
  - `scripts/tests/test_0376_control_first_mbr_routing_contract.mjs`
- Failing commands:
  - `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`: `73 passed, 1 failed out of 74`.
  - `node scripts/tests/test_0376_control_first_mbr_routing_contract.mjs`: `9 passed, 1 failed out of 10`.
- Expected failures:
  - Bootstrap validation rejects a valid `slide_app_bundle_response.v1` when the bundle payload contains UI JSON `write.pin`.
  - MBR filled model rejects the same valid provider bundle response instead of forwarding it to `mbr_cb_out`.
- 0389.2 review: `019e458d-ce25-7602-97ad-9f12621d267e` returned `APPROVED`.

## Stage 0389.3 Scoped Validation Fix

- CWD: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Changed validation scope in:
  - `scripts/run_worker_v0.mjs`
  - `deploy/sys-v1ns/mbr/patches/mbr_role_v0.json`
- Behavior preserved:
  - Outer `pin_payload.v1` still rejects removed legacy metadata.
  - Ordinary nested ModelTable payload still rejects removed legacy metadata.
  - `slide_app_bundle_response.v1` may carry `bundle_payload` only when it is a valid ModelTable record array.
  - Actual legacy label keys inside `bundle_payload` are still rejected.
- Green commands:
  - `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`: `74 passed, 0 failed out of 74`.
  - `node scripts/tests/test_0376_control_first_mbr_routing_contract.mjs`: `11 passed, 0 failed out of 11`.
  - `node scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs`: `4 passed, 0 failed out of 4`.
- 0389.3 review: `019e4595-f43c-7aa3-8c5e-287bed9c1f93` returned `CHANGE_REQUESTED`.
- Review fix:
  - Added coverage that `slide_app_bundle_response.v1` is still rejected when its `bundle_payload` contains an actual removed legacy ModelTable label key such as `source_model_id`.
  - Added the same boundary to the MBR filled-model dispatch contract.
- Re-run after review fix:
  - `node scripts/tests/test_0376_control_first_mbr_routing_contract.mjs`: `11 passed, 0 failed out of 11`.
  - `node scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs`: `4 passed, 0 failed out of 4`.
- 0389.3 re-review: `019e4598-e1c4-7ac3-aa8f-76b3ed19a79b` returned `APPROVED`.

## Stage 0389.4 Local Deployment And Browser Verification

- Local deployment:
  - Ran `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`.
  - Docker Hub metadata fetch timed out while rebuilding `dy-mbr-worker:v2`; used the existing local image and overlaid the changed local worker scripts, then reran deploy with `SKIP_IMAGE_BUILD=1 SKIP_MATRIX_BOOTSTRAP=1`.
  - Local rollout completed for `ui-server`, `mbr-worker`, `remote-worker`, and `workspace-manager`; all pods were `Running`.
- Browser verification:
  - Opened `http://127.0.0.1:30900/#/` with Playwright headed browser.
  - Opened `工作区管理器`.
  - Clicked provider-owned `E2E 颜色生成器` `安装`.
  - First browser attempt reached UI-server bundle validation but failed with `missing_slide_app_summary`, proving the return path was no longer blocked.
  - Added required `slide_app_summary` labels to RemoteWorker R1 provider bundles.
  - Re-synced persisted assets and restarted `remote-worker`.
  - Re-clicked `安装`; page showed `installed E2E 颜色生成器 as model 1081`, and the local asset list added a new deletable `E2E 颜色生成器` row.
  - Opened model `1081`, clicked `Generate Color`; color changed from `#FFFFFF` to `#6f935f`, and status changed to `processed`.
- Browser artifact:
  - `output/playwright/0389-workspace-manager-provider-install-mbr-validation/installed-color-generator-1081-processed.png`
- Additional fixes discovered by real browser:
  - `scripts/worker_engine_v0.mjs` split-bus dedupe now includes `message_role`, so request and response with the same `op_id` are not collapsed.
  - RemoteWorker R1 provider bundles now include `slide_app_summary` required by the OS shell catalog.
- Green commands after these fixes:
  - `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`: `74 passed, 0 failed out of 74`.
  - `node scripts/tests/test_0376_control_first_mbr_routing_contract.mjs`: `12 passed, 0 failed out of 12`.
  - `node scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs`: `4 passed, 0 failed out of 4`.
- Additional regression checks:
  - `node scripts/tests/test_0378_workspace_asset_manager_contract.mjs`: `4 passed, 0 failed out of 4`.
  - `node scripts/tests/test_0388_shell_route_state_stability.mjs`: `6 passed, 0 failed out of 6`.
  - `git diff --check`: passed.
- 0389.4 review: `019e45a5-9d12-7930-93b0-f42dd9b09d79` returned `APPROVED`.

## Stage 0389.5 Final Verification

- Final command set:
  - `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`: `74 passed, 0 failed out of 74`.
  - `node scripts/tests/test_0376_control_first_mbr_routing_contract.mjs`: `12 passed, 0 failed out of 12`.
  - `node scripts/tests/test_0378_workspace_asset_manager_contract.mjs`: `4 passed, 0 failed out of 4`.
  - `node scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs`: `4 passed, 0 failed out of 4`.
  - `node scripts/tests/test_0388_shell_route_state_stability.mjs`: `6 passed, 0 failed out of 6`.
- Final review: `019e45a8-1662-7a41-9514-dbaf434fe270` returned `APPROVED`.
