---
title: "Iteration 0412 app1 ToDo Latency Debug Resolution"
doc_type: iteration_resolution
status: in_progress
updated: 2026-06-10
source: ai
---

# Iteration 0412-app1-todo-latency-debug Resolution

## Execution Strategy

先隔离调试入口，再注册 ToDo provider 资产，最后用同一 `op_id` 串起真实浏览器和远端日志。实施顺序保持最小影响面：先只读盘点；再用本地 tests 固化 ToDo provider/index/`ui-server-1` manifest 合同；通过后部署 `ui-server-1` 与必要 worker 资产；最后执行真实浏览器验收与分段计时。若某一步需要影响现有生产入口，先停止并记录原因。

## Step 1 — Intake, Branch, And Remote Read-Only Baseline

- Scope:
  - 创建 iteration 记录与工作分支。
  - 远端只读检查 `app1`、现有 `ui-server`、R1、MBR、Workspace Manager、Ingress/TLS 状态。
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0412-app1-todo-latency-debug/*`
- Verification:
  - `git status --short --branch`
  - `ssh dy-cloud "kubectl --kubeconfig /home/wwpic/.kube/config -n dongyu get deploy,svc,ingress,pods"`
  - `curl -I https://app.dongyudigital.com/`
  - `curl -I https://app1.dongyudigital.com/ || true`
- Acceptance:
  - iteration 已登记为 Approved / In Progress。
  - 已确认 `app1` 当前是否存在，且没有对现有服务做写操作。
- Rollback:
  - 删除本轮 iteration 文档与索引行；删除本轮分支。

## Step 2 — Contract Tests For ToDo Provider Asset And ui-server-1

- Scope:
  - 先写失败测试，证明当前缺少 `To Do app 1` R1 provider 资产和 `ui-server-1` cloud manifest。
  - 明确 ToDo provider bundle 必须可导入，并且 runtime/event binding 不保留内置 `todo_1086_bus_event`。
- Files:
  - `scripts/tests/test_0412_todo_provider_app1_contract.mjs` (new)
  - 可能读取：`deploy/sys-v1ns/remote-worker/patches/14_model3100_slide_app_bundle_provider.json`
  - 可能读取：`packages/worker-base/system-models/workspace_manager_asset_manager_ui.json`
  - 可能读取：`k8s/cloud/workers.yaml`
- Verification:
  - `node scripts/tests/test_0412_todo_provider_app1_contract.mjs`
- Acceptance:
  - RED: 新测试先因缺少 ToDo provider asset / `ui-server-1` manifest 失败。
  - GREEN 前不得修改 production code。
- Rollback:
  - 删除新增测试文件。

## Step 3 — Add ToDo Provider Asset And Isolated ui-server-1 Manifest

- Scope:
  - 将 ToDo Board bundle 加到 R1 provider bundle service。
  - 将 Workspace Manager asset catalog 加入 `To Do app 1`。
  - 新增 `ui-server-1` cloud Deployment / Service / Ingress，独立 worker id 和 hostPath。
  - 如需要，为部署脚本补 `ui-server-1` target 或单独 manifest apply 路径。
- Files:
  - `deploy/sys-v1ns/remote-worker/patches/14_model3100_slide_app_bundle_provider.json`
  - `packages/worker-base/system-models/workspace_manager_asset_manager_ui.json`
  - `k8s/cloud/workers.yaml` or `k8s/cloud/ui-server-1.yaml`
  - `scripts/ops/deploy_cloud_app.sh` only if a new deploy target is needed.
- Verification:
  - `node scripts/tests/test_0412_todo_provider_app1_contract.mjs`
  - `node scripts/tests/test_0384_provider_owned_slide_app_install_flow.mjs`
  - `node scripts/tests/test_0408_todo_board_import_payload_contract.mjs`
  - `node scripts/tests/test_0405_todo_slide_app_contract.mjs`
  - `git diff --check`
- Acceptance:
  - ToDo provider/index/manifest tests pass.
  - Existing provider-owned install and ToDo import contracts still pass.
- Rollback:
  - Revert the touched provider/index/manifest files and remove the test.

## Step 4 — Add Lightweight Timing Evidence

- Scope:
  - Add low-risk server/client timing hooks only where needed to correlate `op_id`.
  - Prefer existing logs, runtime trace, browser Performance API, and Playwright-side timing before adding persistent UI.
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/ui-model-demo-frontend/src/remote_store.js`
  - Optional test file if behavior changes are required.
- Verification:
  - targeted server/frontend syntax/tests for touched files.
  - no user-facing behavior change except extra diagnostic log/trace.
- Acceptance:
  - One ToDo create flow can be traced by `op_id` across browser, `ui-server-1`, MBR, and R1 logs.
- Rollback:
  - Remove timing-only code; leave functional provider/manifest changes if still needed.

## Step 5 — Remote Deploy To app1

- Scope:
  - Sync source to dy-cloud.
  - Build/import necessary images or apply isolated manifest.
  - Roll out `ui-server-1`, and restart only R1 / Workspace Manager if their provider/index assets changed.
- Files:
  - No local source changes expected during deploy except runlog evidence.
- Verification:
  - `kubectl -n dongyu rollout status deployment/ui-server-1 --timeout=300s`
  - `kubectl -n dongyu get ingress ui-server-1 -o yaml`
  - `curl -fsS https://app1.dongyudigital.com/snapshot`
  - `curl -fsSI https://app.dongyudigital.com/`
- Acceptance:
  - `app1` is live and isolated.
  - existing `app` still responds.
- Rollback:
  - `kubectl -n dongyu delete ingress/ui-server-1 service/ui-server-1 deployment/ui-server-1 --ignore-not-found`
  - restore previous R1 / Workspace Manager manifests if provider/index rollout breaks.

## Step 6 — Browser Install And ToDo Create Latency Run

- Scope:
  - Use Browser/Playwright against `https://app1.dongyudigital.com/`.
  - Install `To Do app 1` from Workspace Manager.
  - Run at least three create-task attempts and collect timings.
- Files:
  - `docs/iterations/0412-app1-todo-latency-debug/assets/*` for screenshots/timing JSON.
- Verification:
  - Browser opens `app1`.
  - `To Do app 1` installs.
  - New tasks appear in the board.
  - Internal scroll and dialog behavior are checked.
- Acceptance:
  - runlog includes visible browser evidence and a timing table.
- Rollback:
  - Close browser session; delete only debug `ui-server-1` if requested or if it is unsafe to keep.

## Step 7 — Analyze, Report, And Close

- Scope:
  - Compare timings and identify dominant slow segment.
  - Update runlog and iteration status.
  - Keep or remove `ui-server-1` depending on final safety decision.
- Files:
  - `docs/iterations/0412-app1-todo-latency-debug/runlog.md`
  - `docs/ITERATIONS.md`
- Verification:
  - All success criteria checked.
  - `git status --short` reviewed for unrelated dirty files.
- Acceptance:
  - User receives conclusion first: installed/verified state, bottleneck, evidence, and next recommended action.
- Rollback:
  - Follow Step 5 rollback if debug service should not remain.

## Step 8 — Local Trace Contract And OIDC Config Guard

- Scope:
  - Add deterministic tests for local SSO configuration and timing trace metadata.
  - Keep tests focused on official paths: renderer `bus_event_v2`, remote store `/bus_event`, server Model 0 bus ingress, and response materialization.
- Files:
  - `scripts/tests/test_0412_local_latency_trace_contract.mjs` (new)
  - `deploy/env/local.env.example`
  - `packages/ui-model-demo-frontend/src/bus_event_v2.js`
  - `packages/ui-renderer/src/renderer.mjs`
  - `packages/ui-renderer/src/renderer.js`
  - `packages/ui-model-demo-frontend/src/remote_store.js`
  - `packages/ui-model-demo-server/server.mjs`
- Verification:
  - RED then GREEN: `node scripts/tests/test_0412_local_latency_trace_contract.mjs`
  - `git diff --check -- scripts/tests/test_0412_local_latency_trace_contract.mjs deploy/env/local.env.example packages/ui-model-demo-frontend/src/bus_event_v2.js packages/ui-model-demo-frontend/src/remote_store.js packages/ui-model-demo-server/server.mjs`
- Acceptance:
  - Test proves local env example uses remote SSO with `DY_OIDC_CLIENT_ID=375920990745592038`.
  - Test proves `bus_event_v2` meta carries client dispatch timing.
  - Test proves the authenticated `POST /bus_event` HTTP route returns a timing object for the same `op_id`, after route auth/capability checks and runtime-mode activation.
- Review:
  - Use a sub-agent with `codex-code-review` to review this stage before Step 9.
- Rollback:
  - Remove the new test and timing-only code/config edits.

## Step 9 — Local Runtime And Browser Trace Verification

- Scope:
  - Deploy or restart local stack before browser claims.
  - Use remote SSO configuration locally; do not mutate remote ZITADEL.
  - Exercise ToDo request/response locally or through representative local MQTT publishing when remote worker is not locally present.
- Files:
  - `docs/iterations/0412-app1-todo-latency-debug/runlog.md`
  - Optional assets under `docs/iterations/0412-app1-todo-latency-debug/assets/`
- Verification:
  - local deployment/status command for `ui-server`.
  - `curl -I http://localhost:30900/auth/sso/start?...` verifies redirect contains client id `375920990745592038`.
  - Browser opens `http://localhost:30900/#/` after local deploy/restart.
  - A ToDo or representative `bus_event_v2` action produces trace evidence with timing stages.
- Acceptance:
  - runlog contains exact commands, timing output, and PASS/FAIL.
- Review:
  - Use a sub-agent with `codex-code-review` to review verification evidence and trace conformance before Step 10.
- Rollback:
  - Stop/revert only local runtime changes made for this test; source code rollback follows Step 8.

## Step 10 — Optimize From Evidence And Final Review

- Scope:
  - Apply only low-risk optimizations proven by Step 9 evidence.
  - Candidate optimizations: remove unnecessary fallback snapshot fetch when SSE is expected, add explicit timing response instead of full snapshot, fix response payload/state mismatch if reproduced locally.
- Files:
  - To be limited to the exact evidence-backed files from Step 9.
- Verification:
  - Re-run Step 8 tests and targeted existing tests that cover touched paths.
  - Re-run local browser trace and compare before/after timing.
- Acceptance:
  - Any optimization has before/after evidence.
  - No UI business event bypasses Model 0 / pin bus / owner materialization.
- Review:
  - Final sub-agent `codex-code-review`; all findings fixed or explicitly recorded.
- Rollback:
  - Revert optimization patch while keeping trace diagnostics if they remain useful and reviewed.

## Notes

- Generated at: 2026-06-10
