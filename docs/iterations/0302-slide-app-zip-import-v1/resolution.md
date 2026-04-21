---
title: "0302 — slide-app-zip-import-v1 Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0302-slide-app-zip-import-v1
id: 0302-slide-app-zip-import-v1
phase: phase1
---

# 0302 — slide-app-zip-import-v1 Resolution

## Execution Strategy

- 本 iteration 进入 Phase 3，按已批准的最小闭环做实现。
- 实施顺序固定为：
  1. 落 importer app 与导入 truth
  2. 实现 zip payload 校验与 materialize
  3. 实现 Workspace registry / mount / delete cleanup
  4. 补测试与用户文档
  5. 本地 deploy + 浏览器验收

## Step 1

- Scope:
  - 新增 importer host / truth
  - 让 Workspace 出现导入入口
- Files:
  - `packages/ui-model-demo-frontend/src/model_ids.js`
  - `packages/worker-base/system-models/workspace_positive_models.json`
- Verification:
  - importer app 出现在 Workspace
  - truth 拥有导入状态 labels
- Acceptance:
  - 导入入口可见
- Rollback:
  - 回退 host / truth patch

## Step 2

- Scope:
  - 解压 zip
  - 读取唯一 JSON payload
  - 校验 slide-capable 最小字段集
  - materialize 成新正数模型
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `scripts/tests/test_0302_slide_app_zip_import_server_flow.mjs`
- Verification:
  - 导入前测试 FAIL
  - 导入后新 app 出现在 Workspace registry
- Acceptance:
  - zip -> app 成立
- Rollback:
  - 回退 host import logic

## Step 3

- Scope:
  - 扩 Workspace 行级 delete
  - 真正卸载 imported app
- Files:
  - `packages/worker-base/system-models/workspace_catalog_ui.json`
  - `packages/worker-base/system-models/intent_handlers_ws.json`
  - `packages/ui-model-demo-server/server.mjs`
- Verification:
  - Delete 后 registry / mount / runtime / sqlite 一起移除
- Acceptance:
  - 卸载成立
- Rollback:
  - 回退 delete logic

## Step 4

- Scope:
  - 补 contract tests 和用户文档
- Files:
  - `scripts/tests/test_0302_slide_app_zip_import_contract.mjs`
  - `docs/user-guide/slide_app_zip_import_v1.md`
  - `docs/user-guide/README.md`
- Verification:
  - 新测试 PASS
  - 用户文档可独立说明导入流程
- Acceptance:
  - 行为、测试、文档一致
- Rollback:
  - 回退测试与文档

## Step 5

- Scope:
  - 本地 redeploy
  - 浏览器验证导入 / 打开 / 删除
  - 回归既有页面
- Files:
  - `docs/iterations/0302-slide-app-zip-import-v1/runlog.md`
  - `docs/ITERATIONS.md`
- Verification:
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - 真浏览器点击验证
- Acceptance:
  - 当前主线本地可运行且无回归
- Rollback:
  - 回退功能 patch / 测试 / 文档并重新 deploy
