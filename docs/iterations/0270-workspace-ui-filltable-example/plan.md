---
title: "Iteration 0270-workspace-ui-filltable-example Plan"
doc_type: iteration-plan
status: active
updated: 2026-03-31
source: ai
iteration_id: 0270-workspace-ui-filltable-example
id: 0270-workspace-ui-filltable-example
phase: phase1
---

# Iteration 0270-workspace-ui-filltable-example Plan

## 0. Metadata
- ID: 0270-workspace-ui-filltable-example
- Date: 2026-03-31
- Owner: Codex + User
- Branch: dev_0270-workspace-ui-filltable-example

## 1. Goal
新增一个仓库内预置的 Workspace UI 模型示例：由 `Input + Button + Label` 组成，可通过改表切换远端双总线模式与本地程序模型模式，并最终形成用户可复现的填表教程。

## 2. Background
用户希望证明三件事：
- 通过填表能组成并挂载一个新的 UI 界面到 Workspace 侧边栏
- 通过改 label / pin.connect 能直接影响布局、样式和事件链路
- 同一示例可从远端双总线链路切换到本地程序模型链路

在开始实现新案例前，颜色生成器 baseline 已在 0269 中修回绿，因此当前具备可复用的双总线样板。

## 3. Invariants (Must Not Change)
- 案例界面必须由 ModelTable fill-table 生成，不得硬编码最终 UI。
- Workspace 侧边栏条目与业务 truth 分层明确。
- 远端/本地两种模式都必须遵守 owner materialization 与合法数据链路。
- 最终文档必须包含删除后重建流程。

## 4. Scope
### 4.1 In Scope
- 预置 Workspace 示例 app + child truth model
- 远端双总线模式
- 本地程序模型模式
- layout/style 参数化 label
- 自动化测试与本地 live 验证
- 用户教程文档

### 4.2 Out of Scope
- 额外的新 UI authoring 机制
- 宽松 JSON / 非规约型快捷入口

## 5. Success Criteria (Definition of Done)
1. Workspace 侧边栏出现新的独立条目，点击 `Open` 后显示方案 B 界面。
2. 远端双总线模式可以返回新颜色字符串并更新页面下方 Label。
3. 仅通过改表可以切换到本地程序模型模式，并仍更新同一结果 Label。
4. 改布局/样式 label 后页面外观直接变化。
5. 删除并重新按文档填表后，示例可重新挂载并运行。
