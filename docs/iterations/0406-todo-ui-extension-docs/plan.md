---
title: "0406 To Do UI Extension Docs Plan"
doc_type: iteration-plan
status: completed
updated: 2026-06-03
iteration_id: 0406-todo-ui-extension-docs
id: 0406-todo-ui-extension-docs
source: ai
---

# 0406 To Do UI Extension Docs Plan

## Goal

审查 `To Do Board` 当前 UI 模型是否只使用基础 `cellwise.ui.v1` 组件，还是包含 renderer 组件扩展；把结论落到开发者文档，避免后续开发者误以为仅凭基础组件文档即可完整复刻当前看板。

## Scope

- 审查 `Model 1086 / To Do Board` 的 UI 节点、绑定、事件入口和 renderer 组件注册。
- 在开发者文档中明确：
  - 哪些部分是基础组件组合。
  - 哪些部分是 To Do 专用扩展组件。
  - 扩展组件需要填写哪些 labels。
  - 扩展组件会自动发出哪些 ModelTable-like 事件。
- 运行 To Do 相关契约测试与文档基本检查。

## Non-Goals

- 不改 To Do Board 运行时逻辑。
- 不新增新的 UI 组件。
- 不重新部署本地或远端服务。

## Acceptance

- 文档明确指出 `TodoBoard` / `TodoFocusList` 是 To Do 专用扩展组件。
- 文档说明 `tasks_json`、`columns`、`tasksRef`、`filterRef`、`bus_event_v2`、`todo_action` 的作用。
- To Do 相关契约测试通过。
