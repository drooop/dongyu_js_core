---
title: "Iteration 0276-doc-workspace-example-and-static-fileinput Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0276-doc-workspace-example-and-static-fileinput
id: 0276-doc-workspace-example-and-static-fileinput
phase: phase1
---

# Iteration 0276-doc-workspace-example-and-static-fileinput Resolution

## Step 1: 锁定 FileInput 红灯

- 为 `FileInput` 新增 contract test，要求：
  - 使用显式按钮触发原生 file input
  - 选中文件名有可见反馈
- 验证当前失败

## Step 2: 修复 Static 文件选择器

- 修改 `renderer.mjs` / `renderer.js` 的 `FileInput`
- 将原生 input 改为隐藏 input + 显式按钮触发
- 增加已选文件名显示
- 让 `Static` 页面绑定到可见文件名状态

## Step 3: 新增正式 Workspace 文档页面示例

- 在 `workspace_positive_models.json` 新增：
  - `Model 1013` = app host
  - `Model 1014` = truth model
- 在 `runtime_hierarchy_mounts.json` 将 `1013` 挂到 `Model 0`
- `1013` 负责：
  - cellwise 结构
  - 布局与顺序 label
  - 绑定 truth 内容
- `1014` 负责：
  - 页面文字内容
  - 提示框文案
  - 列表条目

## Step 4: 证明“布局由 label 决定”

- 在文档页面中至少准备一个可切换布局的容器
- 浏览器验收时在 Home 修改 `ui_layout` / `ui_order`
- 证明页面布局即时变化

## Step 5: 文档更新

- 更新用户指南索引
- 新增正式示例说明文档
- 在 runlog 中记录改表验证步骤

## Step 6: 本地部署与浏览器验收

- `bash scripts/ops/ensure_runtime_baseline.sh`
- `K8S_CONTEXT=orbstack SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
- `bash scripts/ops/check_runtime_baseline.sh`
- 浏览器验收：
  - Static 选择文件
  - Static 上传
  - 新侧边栏文档页面出现并可打开
  - 改 `1013/1014` label 后页面变化
  - `0270` 无回归
