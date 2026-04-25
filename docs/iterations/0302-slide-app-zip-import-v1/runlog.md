---
title: "0302 — slide-app-zip-import-v1 Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0302-slide-app-zip-import-v1
id: 0302-slide-app-zip-import-v1
phase: phase3
---

# 0302 — slide-app-zip-import-v1 Runlog

## Environment

- Date: `2026-04-08`
- Branch: `dev_0302-slide-app-zip-import-v1`
- Runtime: planning + execution

## Planning Record

### Record 1

- Inputs reviewed:
  - [[docs/iterations/0288-slide-ui-phaseA-topology-freeze/plan]]
  - [[docs/iterations/0289-slide-ui-phaseB-workspace-generalization/plan]]
  - [[docs/iterations/0290-slide-ui-phaseC-filltable-create-mount/plan]]
  - [[docs/roadmaps/sliding-ui-workspace-plan]]
  - existing Workspace / Static upload / ws registry implementation
- Locked conclusions:
  - `0302` 是新增能力线，不替代 `0288-0291`
  - zip 中只允许一个 JSON payload 文件
  - 该 payload 与 matrix `pin_payload` 使用同一临时模型表合同
  - `0302` 自己冻结导入最小 metadata 子集
  - `model_id` 顺序递增且不回收

## Review Gate Record

### Review 1 — User

- Iteration ID: `0302-slide-app-zip-import-v1`
- Review Date: `2026-04-08`
- Review Type: `User`
- Review Index: `1`
- Decision: **Approved**
- Notes:
  - 同意方案一
  - 同意新开 `0302`
  - 要求 zip 只含一个 patch 文件，metadata 用 labels 表达
  - 要求 plan 明确消息体与导入包共享同一个 payload 合同

## Execution Record

### 2026-04-08 — Step 1 Importer App And Sidebar Delete

**Implemented**
- 新增固定模型：
  - `1030` = `滑动 APP 导入` app host
  - `1031` = importer truth
- Workspace 侧边栏 actions 现在包含：
  - `Open`
  - `Delete`
- Delete 对不可卸载 app 默认为 disabled

**Deterministic tests**
- `node scripts/tests/test_0302_slide_app_zip_import_contract.mjs` → PASS

### 2026-04-08 — Step 2 Zip Payload Import

**Implemented**
- zip 中只允许一个 JSON payload 文件
- payload 使用临时模型表数组合同：
  - `id / p / r / c / k / t / v`
- `0302` 自己冻结导入准入最小字段集：
  - `app_name`
  - `source_worker`
  - `slide_capable`
  - `slide_surface_type`
  - `from_user`
  - `to_user`
  - `ui_authoring_version`
  - `ui_root_node_id`
  - `model_type`
- 导入时：
  - 顺序递增分配正数 `model_id`
  - 不回收旧 id
  - remap JSON 中的 `model_id` 引用
  - 自动在 Model 0 下新增挂载点

**Deterministic tests**
- `node scripts/tests/test_0302_slide_app_zip_import_server_flow.mjs` → PASS

### 2026-04-08 — Step 3 Uninstall Cleanup

**Implemented**
- `ws_app_delete` 现在接受侧边栏行值直接删除
- 卸载 imported app 时同时移除：
  - Workspace registry 项
  - Model 0 挂载点
  - imported bundle 的所有模型
  - sqlite 中这些模型的持久化记录

**Deterministic tests**
- `node scripts/tests/test_0302_slide_app_zip_import_server_flow.mjs` → PASS

### 2026-04-08 — Step 4 Regression Sweep

**Deterministic tests**
- `node scripts/tests/test_0302_slide_app_zip_import_contract.mjs` → PASS
- `node scripts/tests/test_0302_slide_app_zip_import_server_flow.mjs` → PASS
- `node scripts/tests/test_0284_matrix_userline_phase2_contract.mjs` → PASS
- `node scripts/tests/test_0284_matrix_userline_phase2_server_flow.mjs` → PASS
- `node scripts/tests/test_0272_static_workspace_contract.mjs` → PASS
- `node scripts/tests/test_0270_workspace_ui_filltable_remote_mode_contract.mjs` → PASS

### 2026-04-08 — Step 5 Local Deploy + Browser Verification

**Deploy**
- `bash scripts/ops/check_runtime_baseline.sh` → initial FAIL（deploy 前 `synapse` / `remote-worker` 未 ready）
- `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh` → PASS
- `bash scripts/ops/check_runtime_baseline.sh` → PASS

**Browser facts**
- Workspace 中存在 `滑动 APP 导入`
- 选择 `/tmp/slide-import-v1.zip` 后：
  - `1031.slide_import_media_uri` 写入 `mxc://...`
- 触发导入后：
  - `1031.slide_import_status = imported: Imported Zip App`
  - `ws_apps_registry` 新增 `Imported Zip App`
  - 新 row 的 `Delete` 可用
- 打开 `Imported Zip App` 后：
  - 页面显示导入标题
  - 输入框可编辑
  - 文本显示随输入更新为 `Browser imported change`
- 点击 `Delete` 后：
  - `Imported Zip App` 从 `ws_apps_registry` 消失
  - Workspace 当前选中回退到既有 app

### Review 2 — AI Self-Verification

- Iteration ID: `0302-slide-app-zip-import-v1`
- Review Date: `2026-04-08`
- Review Type: `AI-assisted`
- Review Index: `2`
- Decision: **Approved**
- Notes:
  - zip 导入 / 挂载 / 打开 / 删除最小闭环已成立
  - `0302` 未改写 `0288-0291`，而是作为独立能力线落地
  - live 环境中只有 favicon 404 控制台噪音，未见新的业务异常

## Docs Updated

- [x] `docs/iterations/0302-slide-app-zip-import-v1/resolution.md` updated
- [x] `docs/iterations/0302-slide-app-zip-import-v1/runlog.md` updated
- [x] `docs/user-guide/slide_app_zip_import_v1.md` created
- [x] `docs/user-guide/README.md` updated
