---
title: "Iteration 0199-ui-entry-card-cleanup Plan"
doc_type: iteration-plan
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0199-ui-entry-card-cleanup
id: 0199-ui-entry-card-cleanup
phase: phase1
---

# Iteration 0199-ui-entry-card-cleanup Plan

## Goal

- 在 `0200` 之前完成一个最小 UI cleanup：
  - 修复 Workspace 右侧 `Card.title` 使用 `$label` 时显示 `[object Object]` 的 renderer 解释器 bug
  - 将 Header 中的 `Gallery / Docs / Static` 入口收口到 Workspace，保留 `首页 / Workspace / Prompt`

## Background

- `0199-local-integrated-browser-validation` 已完成本地部署、Playwright 与人工浏览器验收，但在后续审看中暴露出两个 UI 层问题：
  - Header 仍保留 `Gallery / Docs / Static` 直达入口，而这 3 个页面已可从 Workspace 进入
  - Workspace 右侧面板顶部在部分路径下显示 `[object Object]`
- 进一步定位表明，第二个问题不是 state seed 或 `$label` getter 返回错误：
  - [workspace_catalog_ui.json](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/worker-base/system-models/workspace_catalog_ui.json#L83) 的 `Card.props.title` 使用了 `$label`
  - [server.mjs](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-server/server.mjs#L2899) 以 `t: "str"` 写入 `ws_selected_title`
  - [renderer.mjs](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-renderer/src/renderer.mjs#L376) 已先用 `resolveRefsDeep(...)` 解析 `props`
  - 但 [renderer.mjs](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-renderer/src/renderer.mjs#L904) 到 [renderer.mjs](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-renderer/src/renderer.mjs#L910) 渲染 `Card` 时又直接读取原始 `node.props.title`，绕过了解析后的 `props.title`
- 这意味着本轮同时包含：
  - 一个 Tier 1 解释器行为修正
  - 一个 Tier 2 导航资产收口

## Scope

- In scope:
  - 修复 `Card.title` 渲染路径，确保使用解析后的 `props.title`
  - 检查并修正必要的同类 tree/render 路径，避免同一问题只修一半
  - 将 [nav_catalog_ui.json](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/worker-base/system-models/nav_catalog_ui.json) 中 `gallery / docs / static` 的 `nav_visible` 设为 `false`
  - 增加最小合同测试：
    - `Card.title` 对 `$label` 的解析
    - Header nav visibility 过滤结果
- Out of scope:
  - 不新增组件类型
  - 不调整 Workspace 左侧资产树逻辑
  - 不修改 `0200` 的远端部署/验收范围
  - 不顺手做更多 renderer prop cleanup

## Invariants / Constraints

- 这轮必须保持最小范围，不得演变为新的导航重构。
- `Card.title` 问题属于解释器 bug，修复时只能改 renderer 行为，不得改 server seed 语义来绕过。
- Header 入口收口必须通过模型资产完成，不得回退到硬编码 JS 过滤。
- 必须遵守 `0192` 已冻结的 fail-fast 规则：
  - 不允许用 fallback 或容错掩盖解释器 bug
  - 不允许为了 UI 看起来“能用”而绕过规约路径

## Success Criteria

- Workspace 右侧 `Card.title` 在 `$label` 路径下显示实际字符串，不再显示 `[object Object]`。
- `renderer` 的 `Card` 渲染明确使用解析后的 `props.title`，而非原始 `node.props.title`。
- Header 中默认不再展示 `Gallery / Docs / Static`，仅保留产品确认后的核心入口。
- Workspace 中这 3 个页面仍可通过资产树进入。
- 新增合同测试通过，且相关既有 UI 验证不回归。
- 本轮变更不触及 runtime / server / worker / deploy。

## Risks & Mitigations

- Risk:
  - `Card` 修复过窄，只修 `buildVueNode`，遗漏 `renderTreeNode` 或相邻路径，导致不同渲染模式行为不一致。
  - Mitigation:
    - Step 1 明确审计 `Card` 两条渲染路径；Step 2 同步修正并加最小测试。
- Risk:
  - Header 入口收口后，若 Workspace 入口链有遗漏，会造成页面不可达。
  - Mitigation:
    - 保留 Workspace 资产树入口并在浏览器 smoke 中验证 `gallery/docs/static` 仍可进入。

## Alternatives

### A. 推荐：本轮同时修 `Card.title` bug 与 Header 收口

- 优点：
  - 两个问题都在 `0200` 前收干净
  - `0200` 远端浏览器验收时不会继续带着历史 UI 噪声
- 缺点：
  - 同时覆盖 Tier 1 和 Tier 2 两类文件

### B. 只修 `Card.title` bug，把 Header 收口留到以后

- 优点：
  - 代码变更更少
- 缺点：
  - 产品入口仍不一致
  - `0200` 浏览器证据中仍会出现已确认要移除的 Header 按钮

当前推荐：A。

## Inputs

- Created at: 2026-03-20
- Iteration ID: 0199-ui-entry-card-cleanup
- Trigger:
  - 用户明确确认：
    - `Card.title` 问题属于 Tier 1 renderer bug，应在 `0200` 前修掉
    - `Gallery / Docs / Static` Header 入口属于历史惯性，应一并收口到 Workspace
