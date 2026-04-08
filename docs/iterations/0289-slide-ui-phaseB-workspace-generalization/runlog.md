---
title: "0289 — slide-ui-phaseB-workspace-generalization Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-04-08
source: ai
iteration_id: 0289-slide-ui-phaseB-workspace-generalization
id: 0289-slide-ui-phaseB-workspace-generalization
phase: phase4
---

# 0289 — slide-ui-phaseB-workspace-generalization Runlog

## Environment

- Date: `2026-04-06`
- Branch: `dev_0289-slide-ui-phaseB-workspace-generalization`
- Runtime: docs-only planning

## Planning Record

### Record 1

- Inputs reviewed:
  - [[docs/iterations/0287-slide-ui-mainline-split/plan]]
  - [[docs/iterations/0288-slide-ui-phaseA-topology-freeze/plan]]
  - [[docs/iterations/0214-sliding-flow-ui/plan]]
  - [[docs/roadmaps/sliding-ui-workspace-plan]]
- Locked conclusions:
  - `0289` 只处理 Workspace 主线通用化
  - 不提前开放用户创建
  - 不提前进入 Gallery / 文档收口

## Docs Updated

- [x] `docs/iterations/0287-slide-ui-mainline-split/plan.md` reviewed
- [x] `docs/iterations/0288-slide-ui-phaseA-topology-freeze/plan.md` reviewed
- [x] `docs/iterations/0214-sliding-flow-ui/plan.md` reviewed
- [x] `docs/roadmaps/sliding-ui-workspace-plan.md` reviewed
- [ ] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed

## Review Gate Record

### Review 1 — AI-assisted

- Iteration ID: `0289-slide-ui-phaseB-workspace-generalization`
- Review Date: `2026-04-06`
- Review Type: `AI-assisted`
- Review Index: `1`
- Decision: **Approved**
- Notes:
  - 未发现阻塞项。
  - Phase B 已把 slide-capable app 准入条件、Workspace metadata 最小集、registry / mount / selection / lifecycle 统一边界写清，同时没有越到用户创建阶段。

## Execution Start Record

### 2026-04-08

- Execution start:
  - `0289` 从 docs-only 计划进入 Phase 3
  - 当前目标不是再发明新的 slide app 入口，而是把：
    - 现有内置 app
    - `0302` zip 导入 app
    统一拉到一套 Workspace 主线合同上
- done-criteria:
  - slide-capable app 准入条件成为真实代码逻辑
  - registry 字段集统一
  - selection / delete lifecycle 对内置 app 与导入 app 一致
  - 至少两类 app 能被同一主线识别

## Execution Record

### 2026-04-08 — Step 1 Admission And Metadata

**Implemented**
- `Model 100` 明确补齐：
  - `slide_capable=true`
  - `slide_surface_type=flow.shell`
  - `deletable=false`
  - `installed_at=builtin`
- `1030 滑动 APP 导入` 明确补齐：
  - `slide_capable=true`
  - `slide_surface_type=workspace.importer`
  - `deletable=false`
  - `installed_at=builtin`
- `0302` 导入 app 已持续保留：
  - `slide_capable=true`
  - `slide_surface_type=workspace.page`
  - `deletable=true`

**Deterministic tests**
- `node scripts/tests/test_0289_slide_workspace_generalization_contract.mjs` → PASS

### 2026-04-08 — Step 2 Registry / Selection / Lifecycle Unification

**Implemented**
- Workspace registry 统一输出字段：
  - `deletable`
  - `delete_disabled`
  - `slide_capable`
  - `slide_surface_type`
  - `installed_at`
  - `from_user`
  - `to_user`
- `ws_app_select` 现优先读取当前事件 value，而不是只读旧 state
- 默认选择逻辑不再写死偏好 `Model 100`
- local / server 两侧统一为：
  - 优先显式选择
  - 目标不存在时才回退默认 app
- `isFlowCapableWorkspaceApp` 现改为读 slide metadata，而不是只认单个 `Model 100`

**Deterministic tests**
- `node scripts/tests/test_0289_slide_workspace_generalization_contract.mjs` → PASS
- `node scripts/tests/test_0289_slide_workspace_generalization_server_flow.mjs` → PASS

### 2026-04-08 — Step 3 Regression Sweep

**Deterministic tests**
- `node scripts/tests/test_0289_slide_workspace_generalization_contract.mjs` → PASS
- `node scripts/tests/test_0289_slide_workspace_generalization_server_flow.mjs` → PASS
- `node scripts/tests/test_0302_slide_app_zip_import_contract.mjs` → PASS
- `node scripts/tests/test_0302_slide_app_zip_import_server_flow.mjs` → PASS
- `node scripts/tests/test_0284_matrix_userline_phase2_contract.mjs` → PASS
- `node scripts/tests/test_0284_matrix_userline_phase2_server_flow.mjs` → PASS

### 2026-04-08 — Step 4 Local Deploy + Browser Verification

**Deploy**
- `bash scripts/ops/check_runtime_baseline.sh` → initial FAIL（deploy 前 `synapse` / `remote-worker` 未 ready）
- `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh` → PASS
- `bash scripts/ops/check_runtime_baseline.sh` → PASS

**Browser facts**
- Workspace 侧边栏中：
  - `E2E 颜色生成器`
  - `滑动 APP 导入`
  - `Imported Zip App`
  处于同一主线列表中
- delete 行为差异已验证：
  - 内置 app 的 `Delete` disabled
  - 导入 app 的 `Delete` enabled
- selection 行为已验证：
  - 可从 importer 导入 app
  - 可从 imported app 切回 `E2E 颜色生成器`
  - `ws_app_selected` 切回 `100`

### Review 2 — AI Self-Verification

- Iteration ID: `0289-slide-ui-phaseB-workspace-generalization`
- Review Date: `2026-04-08`
- Review Type: `AI-assisted`
- Review Index: `2`
- Decision: **Approved**
- Notes:
  - Phase B 已成为当前主线真实实现，而不再只是 docs-only planning
  - 内置 app、导入器 app、导入 app 现在共用同一套 registry / selection / lifecycle 合同
  - 当前仍未进入 `0290` 用户直接填表创建路径，范围守住

## Docs Updated

- [x] `docs/iterations/0289-slide-ui-phaseB-workspace-generalization/resolution.md` updated
- [x] `docs/iterations/0289-slide-ui-phaseB-workspace-generalization/runlog.md` updated
- [x] `docs/user-guide/slide_workspace_generalization.md` created
- [x] `docs/user-guide/README.md` updated
