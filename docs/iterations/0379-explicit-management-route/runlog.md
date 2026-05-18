---
title: "0379 - Explicit Management Route Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-05-19
source: ai
iteration_id: 0379-explicit-management-route
id: 0379-explicit-management-route
phase: completed
---

# Iteration 0379-explicit-management-route Runlog

## Environment

- Date: 2026-05-18
- Branch: `dropx/dev_0379-explicit-management-route`
- Runtime: local Kubernetes cluster + ModelTable UI demo

Review Gate Record
- Iteration ID: 0379-explicit-management-route
- Review Date: 2026-05-18
- Review Type: User
- Review Index: 1/1
- Decision: Approved
- Notes: User approved the proposed explicit management route plan after reviewing the design summary.

## Execution Records

### Step 1 — Contract and Planning Gate

- Command: `git switch -c dropx/dev_0379-explicit-management-route`
- Key output: switched to new iteration branch while preserving current uncommitted 0376-0378 working state.
- Result: PASS
- Command: `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0379-explicit-management-route --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Key output: wrote `plan.md`, `resolution.md`, and `runlog.md`.
- Result: PASS
- Command: update 0379 plan, resolution, runlog, and iteration index.
- Key output: added `docs/iterations/0379-explicit-management-route/*` and registered 0379 in `docs/ITERATIONS.md`.
- Result: PASS

### Step 2 — Runtime and Import Implementation

- Command: update `packages/ui-model-demo-server/server.mjs`.
- Key output: `remote_bus_endpoint_v1` now accepts optional `route_kind`, rejects invalid values, preserves explicit `management`, and generates host-owned `pin.bus.mb.out` plus `bus=management` / `route_kind=management` records when requested. Omitted `route_kind` remains `control`.
- Result: PASS
- Command: update SSOT / user-guide / current todo docs.
- Key output: documented `route_kind` as optional endpoint route selector, clarified `UI Server pin.bus.mb.out -> MBR -> pin.bus.cb.out -> Remote Worker`, and marked current-stage todo item 2 as implemented except final browser evidence.
- Result: PASS

### Step 3 — Deterministic Tests

- Command: `node --check packages/ui-model-demo-server/server.mjs`
- Key output: syntax check passed.
- Result: PASS
- Command: `node scripts/tests/test_0379_explicit_management_route_contract.mjs`
- Key output: `3 passed, 0 failed out of 3`; covers management-routed ZIP import/export, invalid `route_kind` rejection, and MBR management-ingress to control-bus forwarding.
- Result: PASS
- Command: `node scripts/tests/test_0364_slide_import_bus_binding_contract.mjs`
- Key output: `3 passed, 0 failed out of 3`.
- Result: PASS
- Command: `node scripts/tests/test_0376_control_first_mbr_routing_contract.mjs`
- Key output: `9 passed, 0 failed out of 9`.
- Result: PASS
- Command: `node scripts/tests/test_0350_slide_app_runtime_user_guide_contract.mjs`
- Key output: all 5 guide/runtime contract checks passed.
- Result: PASS
- Command: `node scripts/tests/test_0337_slide_flow_docs_contract.mjs`
- Key output: all 3 slide-flow docs contract checks passed.
- Result: PASS
- Command: `node scripts/validate_ui_ast_v0x.mjs --case all`
- Key output: summary PASS.
- Result: PASS
- Command: `git diff --check -- packages/ui-model-demo-server/server.mjs scripts/tests/test_0379_explicit_management_route_contract.mjs scripts/tests/test_0364_slide_import_bus_binding_contract.mjs scripts/tests/test_0350_slide_app_runtime_user_guide_contract.mjs docs/ssot/runtime_semantics_modeltable_driven.md docs/ssot/imported_slide_app_host_ingress_semantics_v1.md docs/ssot/label_type_registry.md docs/user-guide/modeltable_user_guide.md docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md docs/user-guide/slide-app-runtime/minimal_submit_app_provider_interactive.html docs/plans/current-stage-todo.md`
- Key output: no whitespace errors.
- Result: PASS

### Step 4 — Local Deployment and Browser Verification

- Command: `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
- Key output: UI Server and Remote Worker images built; MBR image build retried after Docker Hub TLS timeout, then failed again on Docker Hub TLS timeout before manifest rollout.
- Result: FAIL-RECOVERED
- Command: `SKIP_IMAGE_BUILD=1 SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
- Key output: reused available local images, applied manifests, restarted `ui-server`, `mbr-worker`, `remote-worker`, `workspace-manager`, and `ui-side-worker`; all pods ready, no terminating pods.
- Result: PASS
- Command: `bash scripts/ops/check_runtime_baseline.sh`
- Key output: all deployments ready, no terminating pods, `mbr-worker-secret` and `ui-server-secret` ModelTable patches ready.
- Result: PASS
- Command: create `output/playwright/minimal_submit_management_0379.zip` from `test_files/minimal_submit_dual_bus_app_payload.json` with `remote_bus_endpoint_v1.route_kind="management"`.
- Key output: ZIP contains a single `app_payload.json` ModelTable record array and app name `最小 Submit 管理总线示例 0379`.
- Result: PASS
- Command: Playwright against `http://127.0.0.1:30900/#/workspace`.
- Key output: opened `滑动 APP 导入`, selected `minimal_submit_management_0379.zip`, clicked `导入 Slide App`, observed new model `1071` in asset tree, typed `0379 management route browser`, clicked `Submit`, and observed `Submitted: 0379 management route browser` plus `REMOTE=remote_processed`.
- Result: PASS
- Command: fetch `/snapshot` and inspect model `1071` plus Model 0 host egress pin.
- Key output: `remote_bus_endpoint_v1.route_kind=management`; `ui_egress_submit1_binding.bus=management`; `host_pin_type=pin.bus.mb.out`; Model 0 `imported_submit1_1071_bus` has `route_kind=management`, `bus=management`, `topic=UIPUT/ws/dam/pic/de/sw/R1/3000/submit1`, `reply_target_model_id=1071`, and payload text `0379 management route browser`.
- Result: PASS

### Step 5 — Review and Close

- Command: sub-agent review with `codex-code-review` after Steps 2-3.
- Key output: `Decision: APPROVED`; no blocking findings; only noted Step 4 browser evidence was pending at that time.
- Result: PASS
- Command: final sub-agent review with `codex-code-review` after deployment, browser verification, and docs cleanup.
- Key output: first final review requested two low-severity docs wording fixes; after fixing plan/resolution/current todo wording, re-review returned `Decision: APPROVED`, no findings, no verification gaps.
- Result: PASS
- Command: update `docs/ITERATIONS.md`.
- Key output: 0379 status changed from `Approved` to `Completed`.
- Result: PASS
- Command: final verification sweep.
- Key output: `node --check packages/ui-model-demo-server/server.mjs`; `test_0379`, `test_0376`, `test_0362`, `test_0364`, `test_0350`, `validate_ui_ast_v0x --case all`, `check_runtime_baseline.sh`, `/snapshot` management-route assertion, and `git diff --check` all passed.
- Result: PASS

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [x] `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md` reviewed
- [x] `docs/ssot/label_type_registry.md` reviewed
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed
- [x] `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md` reviewed
- [x] `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_interactive.html` reviewed
- [x] `docs/plans/current-stage-todo.md` reviewed
