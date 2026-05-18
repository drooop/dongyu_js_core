---
title: "0382 - Workspace Entry Cleanup Plan"
doc_type: iteration-plan
status: approved
updated: 2026-05-19
source: ai
iteration_id: 0382-workspace-entry-cleanup
id: 0382-workspace-entry-cleanup
phase: approved
---

# Iteration 0382-workspace-entry-cleanup Plan

## Goal

- 将 Workspace 资产树收敛为用户指定的 8 个入口：Gallery、E2E 颜色生成器、Three Scene、Static、Docs、滑动 APP 导入、最小 Submit 双总线示例、工作区管理器。

## Scope

- In scope:
- 本地 UI Server 的 Workspace 入口来源清理。
- 源码预置 registry 与运行时派生 registry 的一致性收敛。
- 本地真实浏览器验证后，再部署并清理远端。
- Out of scope:
- 删除底层历史模型定义本体；本次目标是清理用户可见 Workspace 入口，底层模型可继续作为历史/实现数据存在。

## Invariants / Constraints

- ModelTable 仍为 UI/Workspace 入口真源。
- 旧持久化数据不得再次把非保留入口显示到 Workspace 资产树。
- 保留入口必须可打开；颜色生成器、最小 Submit 示例、工作区管理器不得被误隐藏。

## Success Criteria

- 本地 `/snapshot` 中 `ws_apps_registry` 只包含 8 个指定入口。
- 本地浏览器访问 `http://127.0.0.1:30900/#/workspace` 时，侧边栏只显示 8 个指定入口。
- 远端 `https://app.dongyudigital.com/#/workspace` 完成同样验证。
- 新增自动检查覆盖 allowlist、Docs 入口、Three Scene 显示名与 server/local registry 过滤逻辑。

## Inputs

- Created at: 2026-05-19
- Iteration ID: 0382-workspace-entry-cleanup
