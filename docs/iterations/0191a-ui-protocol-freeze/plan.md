---
title: "Iteration 0191a-ui-protocol-freeze Plan"
doc_type: iteration-plan
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0191a-ui-protocol-freeze
id: 0191a-ui-protocol-freeze
phase: phase1
---

# Iteration 0191a-ui-protocol-freeze Plan

## Goal

- 冻结 UI 迁移所需的最小 Tier 1 协议边界，使后续页面/示例/导航迁移尽量只修改 Tier 2 模型资产。
- 明确新旧 UI 页面在迁移期间的共存规则，特别是 model asset 页面与 legacy `buildEditorAstV1` 页面之间的切换优先级。

## Background

- `CLAUDE.md` 已明确：
  - UI 是 ModelTable 的 projection，不是真值源
  - Tier 1 只允许解释器语义、模型约束、runtime/host 边界与 bugfix
  - 只要一个能力可以通过模型定义表达，就不应升级成 Tier 1
- `docs/ssot/tier_boundary_and_conformance_testing.md` 已明确：
  - 页面内容、信息架构、示例列表、页面状态若可静态表达，应进入 Tier 2
  - 传输与宿主桥接能力才属于 Tier 1
- 当前 UI 代码处于混合态：
  - 合法 Tier 1：
    - `packages/ui-renderer/src/renderer.mjs`
    - `packages/ui-renderer/src/component_registry_v1.json`
    - `packages/ui-model-demo-frontend/src/remote_store.js`
    - `packages/ui-model-demo-frontend/src/demo_app.js` 中的 host adapter
    - `packages/ui-model-demo-frontend/src/demo_modeltable.js` 中的 `buildAstFromSchema()`
  - Tier 2 泄漏：
    - `buildEditorAstV1`
    - `buildGalleryAst`
    - `GalleryRemoteRoot`
    - Header/nav
    - Workspace 侧边栏分组与 icon 逻辑
    - server 侧整页 AST 生成
    - 大量页面状态 seed
- 当前已确认的迁移路线为：
  - `0191a` 协议冻结
  - `0191b` Gallery 模型化
  - `0191c` 导航 + Login + Prompt 去硬编码
  - `0191d` Static + Docs + Home + legacy 删除

## Scope

- In scope:
  - 冻结 `schema projection` 协议
  - 冻结 `route catalog` 协议
  - 冻结页面资产装载优先级与 legacy fallback 退出路径
  - 将 `buildAstFromSchema()` 从页面组装上下文中抽离为稳定 projection 模块的实施方案
  - 明确 `demo_app.js` 中 route/hash 同步逻辑应保留和应迁出的部分
  - 设计对应的 deterministic tests 与 conformance checks
- Out of scope:
  - 不迁移任何具体页面内容到模型资产
  - 不迁移 Gallery 本体
  - 不迁移 Header/nav、Workspace 侧栏、Login、Prompt、Static、Docs、Home
  - 不删除 `buildEditorAstV0/V1` 或 `buildGalleryAst`

## Invariants / Constraints

- 只允许两类内容保留在 Tier 1：
  - 通用解释器语义
  - 宿主桥接能力
- 页面内容、文案、目录、路由表、示例列表、页面专属状态若可由静态资产表达，则不得留在 Tier 1。
- Phase 0/0191a 必须为后续阶段提供“新旧并存但各自完整”的切换规则。
- 协议冻结后：
  - 新增页面不得要求修改前端 JS
  - 只有新增组件语义或新增宿主桥接能力才允许修改 Tier 1
- `buildAstFromSchema()` 只有在协议稳定且不继续承载页面特例的前提下，才允许留在 Tier 1。

## Success Criteria

- 文档明确回答以下问题：
  - `schema projection` 协议的唯一正式字段集合是什么
  - `route catalog` 中哪些是 Tier 1、哪些是 Tier 2
  - 迁移期间 model asset 页面与 legacy page 的优先级如何判定
  - `server.mjs` 中 legacy `buildEditorAstV1` 的退出路径是什么
  - 后续 `0191b/0191c/0191d` 各自依赖本轮哪些冻结结果
- resolution 中给出可复制的文件清单、验证命令、回滚方案。
- 本轮完成后，可以进入 `0191a` 的正式 Review Gate，而不需要再次重新设计整体迁移路线。

## Risks & Mitigations

- Risk:
  - 只冻结口号，不冻结切换点。
  - Impact:
    - 后续页面迁移时，新旧页面无法稳定共存。
  - Mitigation:
    - 将“页面资产优先，legacy AST fallback 次之”的判定逻辑写入本轮协议。
- Risk:
  - `buildAstFromSchema()` 被错误保留为“可任意继续扩展的临时壳”。
  - Impact:
    - Tier 2 页面特例继续渗入 Tier 1。
  - Mitigation:
    - 将其定义为稳定 projection 协议模块，并把新增字段视为 Tier 1 变更。
- Risk:
  - Route/hash 同步逻辑继续夹带页面清单与默认入口策略。
  - Impact:
    - 新增页面仍需改 JS。
  - Mitigation:
    - 将页面入口清单迁为 Tier 2 route catalog；Tier 1 只保留监听与同步。

## Alternatives

### A. 推荐：先冻结协议，再逐批迁移页面

- 形式：
  - 先冻结协议和切换点
  - 再让 Gallery / 导航 / 系统页面分批迁移
- 优点：
  - 风险最可控
  - 新旧并存规则最清晰
  - 后续每批迁移都能复用已冻结协议
- 缺点：
  - Phase 0 不直接减少太多旧代码
- 成本：
  - 中
  - 主要消耗在文档冻结、代码抽离设计和协议测试
- 适用时机：
  - 当前这种 UI 层大面积 Tier 2 泄漏，但线上仍需可用的场景

### B. 直接迁 Gallery + 导航，再在过程中补协议

- 形式：
  - 边迁页面边补协议
- 优点：
  - 更快看到“页面资产化”的成果
- 缺点：
  - 协议容易被页面个例反向塑形
  - 更容易在中途产生新旧页面不一致
- 成本：
  - 中到高
- 适用时机：
  - 仅当现有协议已经非常稳定、几乎不需要再冻结时

当前推荐：先做 A。

## Inputs

- Created at: 2026-03-19
- Iteration ID: 0191a-ui-protocol-freeze
- User approval:
  - 用户已明确通过整体迁移路线：
    - 路线 B（渐进绞杀）
    - Phase 0..4
    - `0191a / 0191b / 0191c / 0191d`
  - 用户已确认 4 条修正建议全部接受。
