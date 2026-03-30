---
title: "Iteration 0191a-ui-protocol-freeze Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0191a-ui-protocol-freeze
id: 0191a-ui-protocol-freeze
phase: phase1
---

# Iteration 0191a-ui-protocol-freeze Resolution

## Execution Strategy

- 先冻结协议和切换规则，再做最小代码抽离；不在本轮迁移任何具体页面内容。
- 保留 legacy 页面生成链，仅将其明确降格为 fallback。
- 以“新增页面不改 JS（在不新增组件语义和宿主能力的前提下）”作为本轮协议设计的验收基线。

## Step 1

- Scope:
  - 审计当前最小 Tier 1 边界
  - 冻结 `schema projection` 协议
  - 冻结 `route catalog` 协议
  - 冻结 model asset 页面与 legacy page 的装载优先级
- Files:
  - `docs/iterations/0191a-ui-protocol-freeze/plan.md`
  - `docs/iterations/0191a-ui-protocol-freeze/resolution.md`
  - `docs/ssot/tier_boundary_and_conformance_testing.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/host_ctx_api.md`
  - `packages/ui-model-demo-frontend/src/demo_app.js`
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/ui-renderer/src/component_registry_v1.json`
- Verification:
  - `rg -n "buildEditorAstV1|buildAstFromSchema|buildGalleryAst|GalleryRemoteRoot|readAppShellRouteSyncState|ui_page|ws_apps_registry" packages/ui-model-demo-frontend packages/ui-model-demo-server`
  - `rg -n "Tier 1|Tier 2|host|ctx|projection|UI is projection" CLAUDE.md docs/ssot/tier_boundary_and_conformance_testing.md docs/ssot/host_ctx_api.md docs/ssot/runtime_semantics_modeltable_driven.md`
- Acceptance:
  - 已明确最小 Tier 1 资产集合
  - 已明确 Tier 2 泄漏列表
  - 已明确 `schema projection` 正式字段集合
  - 已明确 `route catalog` 中 Tier 1 与 Tier 2 的分界
  - 已明确迁移期间“模型资产优先、legacy AST fallback 次之”的切换规则
- Rollback:
  - 回退本轮文档改动

### Step 1 Design Output

#### A. 最小 Tier 1 保留面

本轮确认保留在 Tier 1 的只有：

- `renderer`
- `component registry`
- transport / host adapter
- route/hash 监听与同步桥接
- 通用 `schema projection` 解释器

以下内容明确不属于 Tier 1：

- 页面内容
- 页面文案
- 页面目录/导航清单
- 侧边栏分组
- Gallery 示例列表
- 页面专属状态结构

#### B. `schema projection` 协议

冻结以下字段为正式协议：

- `_title`
- `_subtitle`
- `_field_order`
- `<field>`
- `<field>__label`
- `<field>__props`
- `<field>__opts`
- `<field>__bind`
- `<field>__no_wrap`

约束：

- `buildAstFromSchema()` 只能解释上述协议
- 不允许为特定页面新增 `if/else` 特例
- 新增 schema 字段视为 Tier 1 协议变更，必须单独评审

#### C. `route catalog` 协议

冻结以下分工：

- Tier 1 负责：
  - 监听 route/hash
  - 将 route 同步到模型状态
  - 依据已存在 catalog 判定当前页面是否 pending
- Tier 2 负责：
  - 页面入口列表
  - 页面名称/文案
  - 默认入口策略
  - Workspace 目录分组

#### D. 页面资产装载优先级

迁移期间必须按以下优先级加载页面：

1. 若目标页面已有模型资产：
   - 优先从 snapshot 中读取页面模型
   - 走 `schema projection` 或 `ui_ast` 读取
2. 若目标页面尚未迁移：
   - 回退到 legacy `buildEditorAstV1`

补充约束：

- server 侧 legacy AST 生成逻辑只允许作为 fallback
- 新页面不得走 legacy AST 生成路径
- Phase 4 删除 legacy 前，必须保证所有既有页面都已迁移完毕

## Step 2

- Scope:
  - 为 `0191a` 设计最小代码实施面
  - 抽离 `buildAstFromSchema()` 所需的稳定模块位置
  - 设计 route catalog resolver 与 fallback 决策入口
  - 设计 deterministic tests
  - 对 `demo_app.js` / `demo_modeltable.js` / `server.mjs` 的改动仅限于：
    - 抽离 `buildAstFromSchema()` 到独立稳定模块
    - 接入 page asset resolver 入口
    - 不修改页面内容、导航文案或 Workspace 侧边栏逻辑
- Files:
  - `packages/ui-model-demo-frontend/src/ui_schema_projection.js`
  - `packages/ui-model-demo-frontend/src/page_asset_resolver.js`
  - `packages/ui-model-demo-frontend/src/app_shell_route_sync.js`
  - `packages/ui-model-demo-frontend/src/demo_app.js`
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
  - `packages/ui-model-demo-server/server.mjs`
  - `scripts/tests/test_0191a_ui_schema_projection.mjs`
  - `scripts/tests/test_0191a_page_asset_resolver.mjs`
- Verification:
  - `node scripts/tests/test_0191a_ui_schema_projection.mjs`
  - `node scripts/tests/test_0191a_page_asset_resolver.mjs`
  - `rg -n "buildAstFromSchema|buildEditorAstV1|GalleryRemoteRoot|buildGalleryAst" packages/ui-model-demo-frontend packages/ui-model-demo-server`
- Acceptance:
  - `buildAstFromSchema()` 已抽离到稳定模块或等价位置
  - route sync 只保留“监听/同步”职责，不再内嵌页面按钮/文案
  - 已存在明确的 page asset resolver，可表达“模型资产优先，legacy fallback 次之”
  - 本轮不迁具体页面，但为 `0191b/0191c/0191d` 提供固定入口
- Rollback:
  - 删除本轮新增协议模块
  - 恢复 `demo_app.js` / `demo_modeltable.js` / `server.mjs` 到实施前版本
  - 删除本轮新增测试文件

## Step 3

- Scope:
  - 设计 `0191a` 的收口、验证和后续承接关系
  - 明确 `0191b/0191c/0191d` 的输入依赖
- Files:
  - `docs/iterations/0191a-ui-protocol-freeze/runlog.md`
  - `docs/ITERATIONS.md`
  - 必要时 `docs/plans/2026-03-19-ui-tier-migration-implementation.md`
- Verification:
  - `rg -n "0191a-ui-protocol-freeze|UI Tier Migration Implementation Plan" docs/ITERATIONS.md docs/plans`
  - 人工核对：
    - `0191b` 是否可以只基于协议迁 Gallery
    - `0191c` 是否可以在不重定协议的前提下迁导航/Login/Prompt
    - `0191d` 是否可以在不扩 Tier 1 的前提下完成 Static/Docs/Home 与 legacy 删除
- Acceptance:
  - `0191a` 的成功标准、回滚和验证已闭合
  - 未来 3 个实施单元都能直接引用本轮协议，不需要再次争论 Tier 边界
- Rollback:
  - 回退本轮文档登记与计划更新

## Notes

- Generated at: 2026-03-19
- `buildEditorAstV0()` 视为 legacy AST 生成链的一部分，最终也纳入删除清单。
