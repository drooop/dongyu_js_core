---
title: "0396 Dual Topic Submit Response Resolution"
doc_type: iteration-resolution
status: approved
updated: 2026-05-28
source: codex
---

# Resolution

## Stage 1 - Contract Tests And Docs

Files:

- `docs/ssot/runtime_semantics_modeltable_driven.md`
- `docs/ssot/label_type_registry.md`
- `docs/ssot/temporary_modeltable_payload_v1.md`
- `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md`
- `docs/ssot/ui_to_matrix_event_flow.md`
- `docs/user-guide/modeltable_user_guide.md`
- `docs/user-guide/slide-app-runtime/workspace_manager_interaction_guide.md`
- `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_interactive.html`
- `scripts/tests/test_0396_dual_topic_submit_response_contract.mjs`

Verification:

- `node scripts/tests/test_0396_dual_topic_submit_response_contract.mjs`

Acceptance:

- New tests describe the 8-segment topic and split request/response topic contract.
- Old `/sw/` topic and same-topic response assumptions fail.
- `response_topic` negative cases are captured: missing, malformed, and equal to `topic`.
- Request submit topic and response topic generation rules are documented with concrete examples.
- Docs stop presenting same-topic response as current truth.
- Sub-agent code review is run before Stage 2.

## Stage 2 - Runtime And Server Topic Semantics

Files:

- `packages/worker-base/src/runtime.mjs`
- `packages/worker-base/src/runtime.js`
- `packages/ui-model-demo-server/server.mjs`
- `scripts/worker_engine_v0.mjs`
- `scripts/run_worker_v0.mjs`

Verification:

- `DY_SKIP_0396_SURFACE_SCAN=1 node scripts/tests/test_0396_dual_topic_submit_response_contract.mjs`

Acceptance:

- Validators accept only `UIPUT/<ws>/<dam>/<pic>/<de>/<worker>/<model>/<pin>`.
- Request generation includes `response_topic`.
- Request validation rejects missing, malformed, or same-as-`topic` `response_topic` for response-required packet flows.
- Response validation requires `topic === response_topic`.
- Response validation requires `endpoint_*` to match `reply_target_*`.
- Response ingestion accepts packets delivered on `response_topic` while preserving owner materialization through `reply_target_*`.
- No compatibility parser remains for old `/sw/` topics.
- Sub-agent code review is run before Stage 3.

## Stage 3 - Fill-Table Patches And Example Assets

Files:

- `packages/worker-base/system-models/system_models.json`
- `packages/worker-base/system-models/workspace_positive_models.json`
- `packages/worker-base/system-models/test_model_100_ui.json`
- `packages/worker-base/system-models/workspace_manager_asset_manager_ui.json`
- `deploy/sys-v1ns/mbr/patches/mbr_role_v0.json`
- `deploy/sys-v1ns/remote-worker/patches/*.json`
- `deploy/sys-v1ns/workspace-manager/patches/*.json`
- `scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- `scripts/tests/test_0376_control_first_mbr_routing_contract.mjs`
- `scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs`
- Other current tests that directly assert the old `/sw/` topic or same-topic response contract
- `test_files/minimal_submit_dual_bus_app_payload.json`
- `docs/plans/current-stage-todo.md`
- `docs/user-guide/slide-app-runtime/*.md`
- `docs/user-guide/slide-app-runtime/*.html`

Verification:

- `node scripts/tests/test_0396_dual_topic_submit_response_contract.mjs`
- `node scripts/tests/test_0375_unified_worker_model_topic_contract.mjs`
- `node scripts/tests/test_0359_minimal_submit_matrix_e2e_contract.mjs`
- `node scripts/tests/test_0376_control_first_mbr_routing_contract.mjs`
- `node scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs`
- `node scripts/tests/test_0391_workspace_manager_interaction_guide.mjs`
- `rg -n --glob '!scripts/tests/test_0396_dual_topic_submit_response_contract.mjs' "UIPUT/ws/dam/pic/de/sw|UIPUT/<ws[^>]*>/<dam[^>]*>/<pic[^>]*>/<de[^>]*>/<sw[^>]*>|<sw_id>.*<worker_id>.*<model_id>.*<pin>|response on same endpoint topic|same endpoint topic|same topic response|请求和回包都用这个 topic|请求.*回包.*同.*topic|回包.*同.*endpoint topic|回包.*继续使用同一个|同一个.*topic" packages deploy scripts docs/ssot docs/user-guide docs/plans test_files`

Acceptance:

- MBR, RemoteWorker, Workspace Manager and UI Server seed data all use the 8-segment topic base.
- RemoteWorker provider programs return to `response_topic`, not the submit topic.
- Minimal Submit JSON/docs explain request topic, response topic and `reply_target_*` separately.
- Active current surfaces, including `docs/plans/current-stage-todo.md`, have no `/de/sw/` current-topic leftovers and no same-topic response wording.
- Historical iteration evidence may retain old wording only under `docs/iterations/**`.
- Sub-agent code review is run before Stage 4.

## Stage 4 - Local Deployment And Real Browser Verification

Files:

- `docs/iterations/0396-dual-topic-submit-response/runlog.md`

Verification:

- `bash scripts/ops/deploy_local.sh`
- Real browser test against the local UI Server.

Acceptance:

- Local stack is redeployed after the fill-table changes.
- Browser flow proves the installed/minimal Submit app sends on submit topic and updates from response topic.
- Browser flow proves the affected slide-app runtime remains usable after the topic hard-cut.
- Final sub-agent code review is clean before completion.
