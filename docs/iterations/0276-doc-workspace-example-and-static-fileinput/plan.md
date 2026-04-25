---
title: "Iteration 0276-doc-workspace-example-and-static-fileinput Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0276-doc-workspace-example-and-static-fileinput
id: 0276-doc-workspace-example-and-static-fileinput
phase: phase1
---

# Iteration 0276-doc-workspace-example-and-static-fileinput Plan

## 0. Metadata
- ID: 0276-doc-workspace-example-and-static-fileinput
- Date: 2026-04-02
- Owner: User + AI-assisted
- Branch: dev_0276-doc-workspace-example-and-static-fileinput

## 1. Goal

完成两件事：

- 修复 Workspace 下 `Static` 页的文件选择器交互，让真实用户点击按钮时能稳定弹出选择器
- 新增一个正式的 Workspace 文档页面示例，证明可以只通过填表做出接近 `workspace_ui_filltable_example_visualized.html` 的界面，而且布局位置由 label 决定

## 2. Scope

### 2.1 In Scope

- `FileInput` 组件交互修复与可视反馈增强
- `Static` 页面适配新的 `FileInput` 行为
- 新增正式 Workspace app host `1013` 与 truth model `1014`
- 新文档页面使用 cellwise labels 定义结构、布局、顺序与主要文本
- 至少证明这些能力：
  - 标题 / 段落 / 提示框 / 列表 / 分区
  - 行列布局切换
  - 侧边栏挂载与打开
  - 在 Home 改表后页面立刻变化
- 用户指南补充

### 2.2 Out of Scope

- Mermaid 真渲染
- 云端部署
- 自定义任意路由

## 3. Invariants

- `cellwise.ui.v1` 仍是唯一 UI authoring source
- 不回退到整页硬编码 HTML / page_asset 手写 AST
- 正式示例继续遵守 Workspace host + truth model 双模型结构
- `1011/1012` 继续保留给 Static，新的正式文档示例使用 `1013/1014`

## 4. Success Criteria

1. `Static` 页面点击文件按钮时，真实浏览器可稳定弹出选择器
2. `Static` 页面可见当前已选文件名
3. 新文档页面作为 Workspace 侧边栏正式条目出现
4. 打开后界面效果接近 visualized HTML 的文档页面风格
5. 页面中的布局位置由 label 决定，并能通过改表看到变化
6. Home 改 `1014` 的文本或 `1013` 的布局 label 后，页面立即更新
7. `0270` 与 `0272` 无回归
