---
title: "0315 — workspace-sidebar-name-width Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0315-workspace-sidebar-name-width
id: 0315-workspace-sidebar-name-width
phase: phase1
---

# 0315 — workspace-sidebar-name-width Plan

## Goal

- 在不加宽 Workspace 左侧侧边栏的前提下，压缩 `source / Actions` 区，让 app 名称获得更大的显示宽度。

## Scope

- In scope:
  - `workspace_catalog_ui.json` 的左侧栏宽度与 3 列配置
  - 1 条列宽 contract test
  - 本地页面真验
- Out of scope:
  - 不改侧边栏总宽
  - 不改 Workspace 右侧详情区
  - 不调整业务动作语义

## Invariants / Constraints

- 左侧栏容器宽度保持 `260px`。
- 优先压缩：
  - `source`
  - `Actions`
- `name` 列必须获得比当前更大的可用宽度。
- `Open / Delete` 行为和现有 pin 链不得变化。

## Success Criteria

1. 左侧栏总宽不变。
2. app 名称显示空间明显增加。
3. `Open / Delete` 仍可正常点击。
4. 有自动化测试固定新的列宽分配。

## Inputs

- Created at: 2026-04-13
- Iteration ID: `0315-workspace-sidebar-name-width`
- User decision:
  - “侧边栏宽度基本不变，但压缩 source / Actions 区，让名字更长”
