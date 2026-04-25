---
title: "Iteration 0191d-static-docs-home-legacy-removal Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0191d-static-docs-home-legacy-removal
id: 0191d-static-docs-home-legacy-removal
phase: phase1
---

# Iteration 0191d-static-docs-home-legacy-removal Plan

## Goal

- 将 `Static`、`Docs`、`Home` 三个剩余系统页面迁移到模型资产来源。
- 删除 legacy AST 生成链，包括：
  - `buildEditorAstV0`
  - `buildEditorAstV1`
  - `buildGalleryAst`
  - server 侧整页 AST 生成
- 顺带补齐 `Model -21` 的显式 model form label。

## Background

- `0191a-ui-protocol-freeze` 已冻结：
  - 最小 Tier 1 边界
  - page asset resolver
  - model asset 优先、legacy fallback 次之的切换规则
- `0191b-gallery-modelization` 已完成：
  - Gallery 页面模型资产化
  - Workspace 示例入口接通
- `0191c-nav-login-prompt-dehardcode` 已完成：
  - 顶部导航改为 catalog 驱动
  - `Login` seed patch 化
  - `Prompt` 页面模型资产化
- 当前主线遗留只剩：
  - `Static`
  - `Docs`
  - `Home`
  - 以及 `buildEditorAstV0/V1`、`buildGalleryAst`、server 侧 legacy AST 生成的彻底删除

## Scope

- In scope:
  - 将 `Static` 页面迁为模型资产来源
  - 将 `Docs` 页面迁为模型资产来源
  - 将 `Home` 页面迁为模型资产来源
  - 删除 `buildEditorAstV0/V1`
  - 删除 `buildGalleryAst`
  - 删除 server 侧整页 legacy AST 生成
  - 补 `Model -21` 的显式 model form label
- Out of scope:
  - 不新增组件类型
  - 不新增宿主能力
  - 不改 `Gallery` / `Login` / `Prompt` 已收口的主路线

## Invariants / Constraints

- 不扩 Tier 1 组件语义。
- 不扩宿主能力。
- 迁移完成后，legacy fallback 不再保留。
- `Static / Docs / Home` 的页面内容必须来自模型资产，而不是 JS AST 分支。
- `buildEditorAstV0/V1`、`buildGalleryAst`、server 侧整页 AST 生成必须彻底退出运行时链路。

## Success Criteria

- `Static` 页面已由模型资产提供内容。
- `Docs` 页面已由模型资产提供内容。
- `Home` 页面已由模型资产提供内容。
- `buildEditorAstV0/V1` 已删除。
- `buildGalleryAst` 的运行时依赖已切断。
- server 不再生成整页 AST。
- `Model -21` 已有显式 model form label。

## Risks & Mitigations

- Risk:
  - `Home` 页面与 editor 逻辑耦合最深，迁移时容易留下隐式 legacy 依赖。
  - Mitigation:
    - 将 `Home` 放在 `Static / Docs` 之后迁移，并单独做回归验证。
- Risk:
  - `Docs` 页面依赖 hostApi，迁移时容易把宿主能力和页面内容重新缠在一起。
  - Mitigation:
    - 保持 hostApi 只做能力桥接，页面本体只迁资产来源。
- Risk:
  - 旧 AST 代码删得过早，导致未迁完页面失去来源。
  - Mitigation:
    - 先迁 `Static / Docs / Home`，最后单独做 legacy 删除。

## Alternatives

### A. 推荐：按 `Static → Docs → Home → 删旧` 顺序收尾

- 形式：
  - 先迁 `Static`
  - 再迁 `Docs`
  - 再迁 `Home`
  - 最后删 `buildEditorAstV0/V1`、`buildGalleryAst`、server 侧整页 AST
- 优点：
  - 复杂度递增
  - 删除旧链路时风险最小
- 缺点：
  - 本轮仍是整条迁移链中改动面最大的一个包
- 成本：
  - 高
- 适用时机：
  - 当前已完成 0191a/b/c，仅剩最后一批页面和 legacy 删除

### B. 先删旧 AST，再补页面来源

- 优点：
  - 旧债表面上更快消失
- 缺点：
  - 容易出现新旧页面断裂的中间态
  - 违背绞杀式迁移原则
- 成本：
  - 高
- 适用时机：
  - 不适用本仓库当前路线

当前推荐：A。

## Inputs

- Created at: 2026-03-19
- Iteration ID: 0191d-static-docs-home-legacy-removal
- Depends on:
  - `0191a-ui-protocol-freeze`
  - `0191b-gallery-modelization`
  - `0191b-gallery-compliance-fix`
  - `0191c-nav-login-prompt-dehardcode`
  - `0191c-login-loading-bool-fix`
