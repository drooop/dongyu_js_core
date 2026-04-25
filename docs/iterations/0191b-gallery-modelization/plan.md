---
title: "Iteration 0191b-gallery-modelization Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0191b-gallery-modelization
id: 0191b-gallery-modelization
phase: phase1
---

# Iteration 0191b-gallery-modelization Plan

## Goal

- 将当前硬编码的 Gallery 页面迁移为 Tier 2 模型资产，并接入 Workspace，使其成为后续能力 Demo 的正式入口。
- 在不新增组件语义和宿主能力的前提下，证明 Gallery 页面的迁移只需修改模型资产和有限的装载逻辑。

## Background

- `0191a-ui-protocol-freeze` 已完成并冻结：
  - `schema projection` 协议
  - model asset 优先、legacy fallback 次之的装载入口
  - 最小 Tier 1 边界
- 当前 Gallery 的主要问题仍然存在：
  - `buildGalleryAst()` 在 `packages/ui-model-demo-frontend/src/gallery_model.js`
  - `GalleryRemoteRoot` 在 `packages/ui-model-demo-frontend/src/demo_app.js`
  - `gallery_store.js` 直接把 `buildGalleryAst()` 写入 `ui_ast_v0`
- Workspace 已具备 app 目录和右侧渲染机制：
  - 左侧通过 `ws_apps_registry` 发现应用
  - 右侧可优先渲染 schema/AST 资产
- 用户明确要求：
  - 示例能力应在 Workspace 下可进入
  - Gallery 未来应承接能力示例与组件积累
- `0191a` 审查时给出的 3 条不阻塞建议，可在本轮顺带吸收：
  - `getSnapshotModel` 重复定义收敛
  - `resolvePageAsset()` 增补 `source: "none"` 测试
  - `0191a` frontmatter / docs 收口

## Scope

- In scope:
  - 将 Gallery 页面从 JS AST 迁为模型资产
  - 移除 Gallery 运行时对 `buildGalleryAst()` / `GalleryRemoteRoot` 的依赖
  - 让 Gallery 能通过 Workspace 目录进入
  - 明确 Gallery 作为“能力示例入口”的模型放置与资产形态
  - 顺带吸收 `0191a` 的 2 个低成本代码建议：
    - snapshot helper 去重
    - `resolvePageAsset()` 的 `source: "none"` 测试
- Out of scope:
  - 不去硬编码 Header/nav
  - 不迁移 Login / Prompt / Static / Docs / Home
  - 不新增组件类型或 renderer 语义
  - 不做完整的“组件引用/片段组合”协议冻结

## Invariants / Constraints

- Gallery 页面内容必须成为 Tier 2 资产，不再由前端 JS 函数直接定义。
- 允许继续保留 `#/gallery` 路由，但其内容来源必须改为模型资产。
- Workspace 接入 Gallery 时，不得要求新增 Tier 1 组件语义。
- 若复用现有组件类型和现有装载入口即可完成，不得在本轮扩展 renderer 协议。
- 本轮只迁 Gallery 本体，不迁导航系统整体。

## Success Criteria

- `buildGalleryAst()` 不再是运行时真实来源。
- `GalleryRemoteRoot` 不再旁路模型系统。
- Gallery 可通过以下至少一条路径稳定打开：
  - `#/gallery`
  - Workspace 目录入口
- Gallery 页面资产的形态、模型放置、Workspace 目录入口均在文档中冻结。
- 补齐 `resolvePageAsset()` 的 `source: "none"` 合同测试。
- 若进行 snapshot helper 去重，行为不变且测试通过。

## Risks & Mitigations

- Risk:
  - 只迁 `#/gallery`，不接入 Workspace，导致它仍无法承担 Demo 入口角色。
  - Impact:
    - 后续能力 Demo 仍无法按目标流程沉淀。
  - Mitigation:
    - 本轮成功标准强制包含 Workspace 可进入。
- Risk:
  - 为了迁 Gallery 引入新组件语义。
  - Impact:
    - 违反“Phase 1 不扩 Tier 1”的目标。
  - Mitigation:
    - 限定 Gallery 只能复用现有 `component_registry_v1` 能力。
- Risk:
  - 迁移后仍偷偷保留 `buildGalleryAst()` 作为实际渲染来源。
  - Impact:
    - Gallery 只是“换壳不换源”。
  - Mitigation:
    - 验收显式要求切断运行时依赖链。

## Alternatives

### A. 推荐：Gallery 作为 `ui_ast` 模型资产先落地

- 形式：
  - 使用现有 `ui_ast_v0` 资产形态
  - 先把 Gallery 页面本体模型化
  - 暂不引入新的组件引用协议
- 优点：
  - 改动面最小
  - 不需要扩解释器
  - 最快验证“示例页可以模型化”
- 缺点：
  - 还不是最终的组件引用终态
- 成本：
  - 中
- 适用时机：
  - 先完成 `buildGalleryAst()` 的去硬编码
  - 先建立 Demo 入口基座

### B. 直接把 Gallery 做成“组件引用系统”的首个实现

- 形式：
  - 一边迁 Gallery，一边引入组件引用/片段组合协议
- 优点：
  - 更接近最终形态
- 缺点：
  - 会同时改变 Tier 1 协议与 Tier 2 资产
  - 风险明显更高
- 成本：
  - 高
- 适用时机：
  - 只有当现有 `ui_ast_v0` 明显不足以承载 Gallery 页面时

当前推荐：先做 A。

## Inputs

- Created at: 2026-03-19
- Iteration ID: 0191b-gallery-modelization
- Depends on:
  - `0191a-ui-protocol-freeze`
- User direction:
  - 用户已明确允许开启新分支并直接进入 `0191b`
  - 用户要求后续所有类似能力 Demo 最终都放在 Workspace 下并可从侧边栏进入
