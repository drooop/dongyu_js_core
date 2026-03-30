---
title: "Iteration 0191c-nav-login-prompt-dehardcode Plan"
doc_type: iteration-plan
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0191c-nav-login-prompt-dehardcode
id: 0191c-nav-login-prompt-dehardcode
phase: phase1
---

# Iteration 0191c-nav-login-prompt-dehardcode Plan

## Goal

- 去除当前顶部导航的硬编码页面入口定义，并迁移 `Login` 与 `Prompt` 页面，使它们从模型资产而不是 JS AST 生成链提供内容。
- 在不新增组件语义和宿主桥接能力的前提下，证明新增页面入口和页面内容可以继续只修改 Tier 2 资产。

## Background

- `0191a-ui-protocol-freeze` 已冻结：
  - `schema projection` 协议
  - model asset 优先、legacy fallback 次之的装载入口
  - 最小 Tier 1 边界
- `0191b-gallery-modelization` 已验证：
  - 页面 AST 可从模型资产替代 JS 生成
  - Workspace 可接入模型化后的可见系统 UI
- 当前剩余的主要 Tier 2 泄漏里，最直接的一组是：
  - `demo_app.js` 中的 Header/nav 按钮与页面清单
  - `server.mjs` 中 `Login` 的 schema/data seed
  - `buildEditorAstV1` 中的 `Prompt` 页面 AST
- 总体迁移合同已明确：
  - `0191c` 负责导航去硬编码 + `Login / Prompt`
  - `0191d` 再处理 `Static / Docs / Home`

## Scope

- In scope:
  - 将顶部导航入口列表从前端硬编码迁为模型资产驱动
  - 将 `Login` seed 从 server 代码迁为 patch / 模型资产
  - 将 `Prompt` 页面从 `buildEditorAstV1` 迁为模型资产
  - 保持 `route/hash` 监听与同步仍在 Tier 1
  - 保持 legacy fallback 仅用于本轮未迁移页面
- Out of scope:
  - 不迁移 `Static / Docs / Home`
  - 不引入新的组件类型
  - 不引入新的宿主能力
  - 不做完整的导航系统/Workspace 左侧整体模型化

## Invariants / Constraints

- 新增页面入口在复用既有组件语义与既有 route catalog 协议的前提下，不得要求修改前端 JS。
- `Login` 与 `Prompt` 页面迁移后，其运行时来源必须改为模型资产。
- `route/hash` 同步只保留“监听/同步”职责，不得再次夹带页面文案和入口按钮定义。
- 未迁移页面仍允许走已声明的 legacy fallback，但不得把新的 `Login / Prompt` 页面继续挂在 fallback 上。

## Success Criteria

- Header/nav 不再由固定按钮列表决定页面入口，而是从模型资产或 catalog 读取。
- `Login` 页面不再由 `server.mjs` 逐个 `addLabel` seed。
- `Prompt` 页面不再由 `buildEditorAstV1` 生成。
- `#/prompt` 与登录入口仍可稳定打开。
- 在不新增组件语义的前提下，新增一个同协议页面入口无需修改前端 JS。

## Risks & Mitigations

- Risk:
  - 只迁页面 AST，不迁导航入口来源。
  - Impact:
    - 页面已模型化，但新增页面入口仍需改 JS。
  - Mitigation:
    - 本轮成功标准强制包含导航去硬编码。
- Risk:
  - `Login` 只迁 schema，不迁 seed 位置。
  - Impact:
    - `server.mjs` 仍保留页面级内容定义。
  - Mitigation:
    - 本轮明确要求把 seed 迁为 patch 资产。
- Risk:
  - 迁移 `Prompt` 时误扩 Tier 1。
  - Impact:
    - 打破 `0191a` 的最小 Tier 1 边界。
  - Mitigation:
    - 仅复用现有 `ui_ast_v0` / `schema projection` / resolver 入口。

## Alternatives

### A. 推荐：导航入口最小模型化 + Login/Prompt 页面资产化

- 形式：
  - 用最小 route/page catalog 驱动导航入口
  - `Login` 走 schema/data patch
  - `Prompt` 走 `ui_ast_v0` 或可复用 schema 资产
- 优点：
  - 覆盖本轮目标的最小闭环
  - 不需要等到 `0191d`
- 缺点：
  - 导航系统仍不是最终完整形态
- 成本：
  - 中

### B. 把导航系统完整模型化后再迁 Login/Prompt

- 优点：
  - 形态更完整
- 缺点：
  - 范围会快速膨胀
  - 会把 `0191c` 拉得过大

当前推荐：A。

## Inputs

- Created at: 2026-03-19
- Iteration ID: 0191c-nav-login-prompt-dehardcode
- Depends on:
  - `0191a-ui-protocol-freeze`
  - `0191b-gallery-modelization`
  - `0191b-gallery-compliance-fix`
