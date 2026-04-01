---
title: "Iteration 0275-doc-page-filltable-extension Plan"
doc_type: iteration-plan
status: active
updated: 2026-04-02
source: ai
iteration_id: 0275-doc-page-filltable-extension
id: 0275-doc-page-filltable-extension
phase: phase1
---

# Iteration 0275-doc-page-filltable-extension Plan

## 0. Metadata
- ID: 0275-doc-page-filltable-extension
- Date: 2026-04-01
- Owner: User + AI-assisted
- Branch: dev_0275-doc-page-filltable-extension

## 1. Goal

文档型页面填表能力 MVP 基础扩展 + Static Workspace 已知阻塞修复。

具体：
- 在现有 cellwise.ui.v1 authoring 体系内新增 8 个文档语义组件和对应的 UI authoring 字段约定
- 修复 0272 Static Workspace 的 FileInput 点击无反应和缺少删除按钮两个现实阻塞
- 本轮定位是 Phase A 基础能力打底，Mermaid 渲染、inline markup、完整正式示例留后续 iteration

## 2. Background

### 2.1 触发原因

0270 Fill-Table Workspace UI 示例和 0272 Static Workspace 重建证明当前填表体系可以搭建交互型页面。但当用户需要构建「文档型」页面（如 `workspace_ui_filltable_example_visualized.html` 那样含大量文本、图表、提示框的页面）时，现有组件集不足以表达文档语义。

### 2.2 Static Workspace 已知阻塞

0272 Static Workspace 在实际使用中暴露两个问题：
- FileInput"上传文件"按钮点击后没有反应
- 已挂载项目缺少"删除"按钮，且删除时需一并清理 `/p/<projectName>/...` 的实际文件/目录

这两个问题不是"后续修"的小问题，而是会阻塞文档型页面能力验证（Image 组件的 MXC 来源、删除后重建流程），必须本轮一并修复。

### 2.3 当前能力基线

经 0253-0257 hard-cut 系列 + 0266 scoped patch authority，当前具备：
- cellwise.ui.v1 authoring（唯一 UI source）
- 38 个注册组件（交互/容器/数据展示为主，component_registry_v1.json 的 components 对象）
- read binding + write routing（pin/owner-materialization）
- Workspace host + truth model 双模型架构
- renderer.mjs 单文件分发（无 components/ 子目录）

不具备：
- 文档语义组件（Heading, Paragraph, List, Callout, Image, MermaidDiagram, Section）
- 有限 inline rich text（Phase B）

### 2.4 概念区分

本 iteration 新增的 `ui_heading_level`、`ui_callout_type` 等字段是 **label.k**（字段名/key），使用现有 **label.t**（`str`、`int`）。`label_type_registry.md` 是 label.t 的权威注册表，不是 label.k 字段字典，因此本轮不需要修改 label_type_registry.md。需要更新的是 cellwise authoring contract 文档。

## 3. Invariants (Must Not Change)

- cellwise.ui.v1 remains the only UI authoring source
- 不退回到 page_asset_v0 手写 AST 路线
- 不允许整页 markdown/HTML 字符串作为单个 label value
- business write 一律 pin/owner-materialization
- Workspace app 遵循 host + truth model 架构
- 新组件与现有组件平行注册，不修改现有组件行为
- Tier 1 / Tier 2 边界不变
- 负数模型 / 正数模型放置规则不变
- label_type_registry.md 不变（无新 label.t）

## 4. Scope

### 4.1 In Scope

- **Static 阻塞修复**：FileInput 点击无反应 + 已挂载项目删除按钮及文件清理
- **组件注册**：在 component_registry_v1.json 的 `components` 对象中新增 8 个文档语义组件
- **Renderer 实现**：在 renderer.mjs 单文件中新增 vnode dispatch 分支（7 个组件 + MermaidDiagram 占位）
- **Compiler 扩展**：ui_cellwise_projection.js 识别新 label.k → props 映射
- **UI authoring 字段约定**：8 个新 label.k 记入 cellwise authoring contract 文档
- **最小示例**：验证 cellwise 链路可工作的最小 patch
- **Living docs**：authoring contract 文档更新 + 用户指南草稿

### 4.2 Out of Scope

- MermaidDiagram 真实渲染实现（Phase B）
- Inline markup 解析（Phase B）
- 完整正式 Workspace 文档示例 Model 1013/1014（Phase C）
- 云端部署（Phase C）
- TOC / anchor 自动生成
- label_type_registry.md 变更（无新 label.t）

## 5. Success Criteria (Definition of Done)

### 5.1 Static 阻塞修复

1. Static 页面 FileInput 点击可弹出文件选择器，上传后 MXC URL 正确写入 truth model
2. 已挂载项目列表出现删除按钮，点击后项目从列表消失且 `/p/<projectName>/` 返回 404

### 5.2 文档组件 MVP

3. 8 个新组件出现在 component_registry_v1.json 的 `components` 对象中
4. Heading 组件可渲染 h1-h4，Paragraph 渲染多行文本，List/ListItem 渲染有序/无序列表
5. Callout 按 type（tip/info/warning/danger）渲染不同样式
6. Image 渲染 src → img 标签
7. Section 渲染带标题和可选编号的容器
8. MermaidDiagram 有占位渲染（Phase A 不要求 mermaid.js 渲染）
9. 最小示例通过 cellwise compiler → renderer 正确渲染

### 5.3 回归与文档

10. 现有页面（Home, Workspace, 0270 示例, Static）无回归
11. cellwise authoring contract 文档已追加新 label.k 字段约定
12. 用户指南草稿包含组件清单和最小示例填表步骤

## 6. Design Reference

详见：`docs/plans/2026-04-01-doc-page-filltable-design.md`

方案选择：方案 C（混合模式 — 结构层细粒度 + 内容层有限聚合）

## 7. Phased Delivery

| Phase | Iteration | 内容 | 依赖 |
|-------|-----------|------|------|
| A (MVP) | 0275 | 组件注册 + renderer + compiler + 最小示例 + Static 修复 | 无 |
| B (Rich) | TBD | MermaidDiagram 实现 + inline markup + CodeBlock 验证 | 0275 |
| C (Example) | TBD | 完整 Workspace 文档示例 Model 1013/1014 + 教程 + 云端验证 | Phase B |

## 8. Risk

| 风险 | 影响 | 缓解 |
|------|------|------|
| Static FileInput/删除修复范围不确定 | 中 | 先诊断根因再估算 |
| 新组件与现有 renderer 冲突 | 中 | 新分支在 renderer.mjs 中独立，不修改现有组件 |
| Cell 数过多导致性能问题 | 低 | MVP 示例仅 ~15 Cell |
