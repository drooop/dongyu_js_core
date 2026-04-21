---
title: "0289 — slide-ui-phaseB-workspace-generalization Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0289-slide-ui-phaseB-workspace-generalization
id: 0289-slide-ui-phaseB-workspace-generalization
phase: phase1
---

# 0289 — slide-ui-phaseB-workspace-generalization Resolution

## Execution Strategy

- 本 iteration 进入 Phase 3，按已批准的 Phase B 合同做最小实现。
- 实现目标只覆盖：
  - slide-capable app 准入条件落地
  - Workspace metadata 最小集统一
  - registry / mount / selection / lifecycle 主线统一
  - 将内置 app 与 `0302` 导入 app 拉到同一合同上
- 不进入用户自己填表创建 app，不进入 Gallery 收口。
- 实施顺序固定为：
  1. 固定 slide-capable app 准入判定与 metadata 最小集
  2. 统一 Workspace registry 生成规则
  3. 统一 mount / selection / delete lifecycle 规则
  4. 去掉围绕单点 app 的主线判断
  5. 补测试、文档和浏览器验收

## Step 1

- Scope:
  - 把 slide-capable app 准入条件落成真实判定逻辑
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
  - `scripts/tests/test_0289_slide_workspace_generalization_contract.mjs`
- Verification:
  - `slide_capable=true`
  - `slide_surface_type` 非空
  - `app_name`
  - `ui_authoring_version`
  - `ui_root_node_id`
  - 缺字段 app 不得被归入 slide-capable 主线
- Acceptance:
  - slide-capable app 与普通 Workspace app 可判定区分
- Rollback:
  - 回退判定逻辑与测试

## Step 2

- Scope:
  - 把 Workspace slide app metadata 最小集统一写入 registry 输出
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
  - `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
- Verification:
  - registry 至少统一输出：
    - `app_name`
    - `source_worker`
    - `deletable`
    - `slide_capable`
    - `slide_surface_type`
    - `installed_at`
    - `from_user`
    - `to_user`
- Acceptance:
  - 内置 app 与 zip 导入 app 的 registry 字段一致
- Rollback:
  - 回退 registry 字段统一逻辑

## Step 3

- Scope:
  - 统一 registry / mount / selection / lifecycle 规则
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/ui-model-demo-frontend/src/demo_app.js`
  - `packages/worker-base/system-models/workspace_catalog_ui.json`
  - `scripts/tests/test_0289_slide_workspace_generalization_server_flow.mjs`
- Verification:
  - 新导入 app 与内置 app 都能：
    - 出现在 registry
    - Open
    - selection 正常切换
    - deletable 状态正确呈现
- Acceptance:
  - 主线行为不再依赖单点例外
- Rollback:
  - 回退 UI / server / tests

## Step 4

- Scope:
  - 去掉当前主线里对单点锚点的特殊假设
- Files:
  - `packages/ui-model-demo-frontend/src/route_ui_projection.js`
  - `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
  - `scripts/tests/test_0289_slide_workspace_generalization_contract.mjs`
- Verification:
  - Slide 主线判断不得只认 `Model 100`
  - 至少两个 slide-capable app 能进入同一主线集合
- Acceptance:
  - 从单点锚点过渡到多 app 主线成立
- Rollback:
  - 回退 slide 主线判定逻辑

## Step 5

- Scope:
  - 补测试、文档、本地 deploy 与浏览器验收
- Files:
  - `docs/iterations/0289-slide-ui-phaseB-workspace-generalization/runlog.md`
  - `docs/user-guide/README.md`
  - `docs/user-guide/slide_workspace_generalization.md`
- Verification:
  - `node scripts/tests/test_0289_slide_workspace_generalization_contract.mjs`
  - `node scripts/tests/test_0289_slide_workspace_generalization_server_flow.mjs`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - 浏览器验证内置 app 与导入 app 的统一行为
- Acceptance:
  - Phase B 已成为当前主线真实实现
- Rollback:
  - 回退功能、测试、文档并重新 deploy
