---
title: "0217 — gallery-extension-matrix-three Plan"
doc_type: iteration-plan
status: planned
updated: 2026-03-23
source: ai
iteration_id: 0217-gallery-extension-matrix-three
id: 0217-gallery-extension-matrix-three
phase: phase1
---

# 0217 — gallery-extension-matrix-three Plan

## Metadata

- ID: `0217-gallery-extension-matrix-three`
- Date: `2026-03-23`
- Owner: AI-assisted planning
- Branch (registered in `docs/ITERATIONS.md`): `dropx/dev_0217-gallery-extension-matrix-three`
- Planning mode: `refine`
- Depends on:
  - `0213-matrix-debug-ui-surface`
  - `0215-ui-model-tier2-examples-v1`
  - `0216-threejs-runtime-and-scene-crud`

## Goal

- 把当前 `/gallery` 从“孤立组件演示页”升级为一个可审计的 integration gallery：
  - 在同一页内展示 `0213` 的 Matrix debug surface、
  - 展示 `0215` 的 canonical UI model examples、
  - 展示 `0216` 的 ThreeScene/scene CRUD contract，
  - 并且明确这些展示仍然读取各自原有 truth source，而不是在 Gallery 里再复制一套业务状态。
- 让无上下文读者仅看 Gallery 也能理解：
  - Matrix debug 如何被投影与操作，
  - canonical examples 各自代表什么合同，
  - Three.js scene 的 read/write path 走向哪里，
  - local 与 server-backed 路径分别支持到什么程度。

## Background

- 当前 Gallery 已经具备正式入口，但能力仍停留在组件波次展示：
  - `packages/worker-base/system-models/gallery_catalog_ui.json` 定义了 `Model -103` 的 `page_asset_v0`。
  - `packages/ui-model-demo-frontend/src/gallery_store.js` 通过 `Model -102` 提供 Gallery 本地状态，现有验证聚焦 Wave A-E 的组件交互和 fragment materialization。
- `0213` 已把 Matrix debug 收敛为正式 surface：
  - `packages/worker-base/system-models/matrix_debug_surface.json` 在 `Model -100` 定义 `page_asset_v0`、trace metrics、subject state 和 `matrix_debug_refresh|clear_trace|summarize` actions。
- `0215` 已把 canonical UI examples 固定在 `Workspace` 正数模型中：
  - `packages/worker-base/system-models/workspace_positive_models.json` 已含 `1003-1006`。
  - `packages/worker-base/system-models/workspace_catalog_ui.json` 负责把这些模型挂进 `Workspace`。
- `0216` 已把 Three.js 合同固定下来：
  - `packages/ui-renderer/src/renderer.js` / `renderer.mjs` 已支持 `ThreeScene` primitive。
  - `packages/worker-base/system-models/workspace_positive_models.json` 已含 `1007` / `1008` scene app + child truth。
  - `packages/worker-base/system-models/intent_dispatch_config.json` 与 `intent_handlers_three_scene.json` 已定义 `three_scene_*` action contract。
- 当前最大的集成缺口不是“缺少一个 3D 卡片”，而是 Gallery 与主应用的数据源分叉：
  - local 启动时，`packages/ui-model-demo-frontend/src/main.js` 把 `createGalleryStore(...)` 绑定到 `createDemoStore(...)` 的 shared runtime/snapshot。
  - remote 启动时，同一文件却让 Gallery 走独立 `createGalleryStore()` 本地 runtime，而不是复用 `createRemoteStore(...)` 的 authoritative snapshot/dispatch。
  - 结果是 `/gallery` 在 local 与 remote 下并不共享同一套 truth path，无法构成真正的 Matrix/Three 展示闭环。

## Problem Statement

- 现在缺的不是新的 renderer 能力，而是一个正式的 Gallery integration contract，来回答这几个问题：
  - Gallery 哪些内容只是组件示例，哪些内容是 `0213/0215/0216` 正式合同的投影入口。
  - Gallery 是否允许拥有自己的业务真值，还是只能持有展示专用 UI state。
  - Matrix debug、UI examples、Three scene 在 Gallery 中应该直接读哪些模型/标签，哪些仍然必须留在 `Workspace` 或既有系统模型里。
  - 当 `/gallery` 运行在 remote/server-backed 模式时，按钮和状态到底走 shared snapshot + mailbox，还是继续跑一套本地伪状态。
- 如果 0217 不先冻结这些边界，执行阶段很容易出现以下零交付价值结果：
  - 把 `0213/0215/0216` 的 page asset 或 truth label 复制到 `Model -102`，形成第二份真值。
  - 为 Gallery 再发明一组 `gallery_*` action names，绕过现有 `matrix_debug_*` / `three_scene_*` 合同。
  - local 看起来能演示，但 remote 依旧是独立本地 runtime，数据链路是假的。
  - 用 shared AST / raw JSON blob 快速拼页，重新违反 `0210/0211` 已冻结的 UI input contract。

## Assumptions

- 假设 A:
  - 0217 属于 fill-table-first / UI integration iteration，不新增 `label.t`，不修改 runtime interpreter semantics。
  - 验证方法：
    - `git diff --exit-code -- packages/worker-base/src/runtime.js packages/worker-base/src/runtime.mjs`
    - `git diff --exit-code -- packages/ui-renderer/src/renderer.js packages/ui-renderer/src/renderer.mjs`
- 假设 B:
  - Matrix debug 仍以 `Model -100` 为唯一 debug truth，Three scene 仍以 `Model 1007/1008` 为唯一 scene truth，Gallery 不复制这些数据。
  - 验证方法：
    - `scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
    - `scripts/tests/test_0216_threejs_scene_contract.mjs`
    - 新增 `scripts/tests/test_0217_gallery_extension_contract.mjs`
- 假设 C:
  - `0215` 的 canonical examples 继续保留在 `Workspace` 正数模型 `1003-1006`，0217 只做 Gallery 投影和导航，不把这些 example 迁回 `gallery_catalog_ui.json`。
  - 验证方法：
    - `scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`
    - 新增 `packages/ui-model-demo-frontend/scripts/validate_gallery_matrix_three_local.mjs`
- 假设 D:
  - remote `/gallery` 应该改为复用主应用的 authoritative snapshot/dispatch，而不是继续维护一个独立本地 runtime。
  - 验证方法：
    - `rg -n "createGalleryStore\\(|createRemoteStore\\(" packages/ui-model-demo-frontend/src/main.js`
    - 新增 `packages/ui-model-demo-frontend/scripts/validate_gallery_matrix_three_server_sse.mjs`
- 假设 E:
  - Gallery 本轮允许新增少量展示专用 state label，但这些 label 只能放在 `Model -102`，且不能成为业务真值的镜像缓存。
  - 验证方法：
    - 新增 `scripts/tests/test_0217_gallery_extension_contract.mjs`
    - `rg -n "scene_graph_v0|trace_log_text|selected_entity_id" packages/worker-base/system-models/gallery_catalog_ui.json`

## Scope

### In Scope

- 把 `/gallery` 扩展为 integration gallery，而不仅是组件素材页。
- 在 `gallery_catalog_ui.json` 中新增 Matrix + canonical examples + ThreeScene 的展示分区。
- 明确 Gallery 对下列已有 truth surface 的读取方式：
  - `Model -100` Matrix debug surface
  - `Model 1003-1006` canonical UI model examples
  - `Model 1007/1008` Three scene app + child truth
- 收敛 `/gallery` 的 local/remote 数据源策略：
  - local 继续允许 shared runtime 注入；
  - remote 必须复用 authoritative snapshot/dispatch，不能继续是 isolated local runtime。
- 新增 deterministic contract tests、local/server validators、以及浏览器级验收脚本。

### Out of Scope

- 不新增 `ThreeScene` primitive、不扩 `renderer` 协议、不修改 `0216` 的 scene CRUD 语义。
- 不重写 `0213` Matrix debug page asset 或 `0215` canonical examples 的 truth placement。
- 不把 Gallery 升格成新的 truth owner；Gallery 只做 projection、summary、navigation、受限操作入口。
- 不恢复 `ui_ast_v0`、shared root AST、或“把整页 AST blob 塞进 state model”的历史路径。
- 不为了本轮展示去新增第二套 local-only business logic 来伪装 remote capability。

## Recommended Integration Contract

### Gallery Role

- Gallery 是 **integration showcase / projection layer**，不是业务真值容器。
- `Model -102` 只允许持有：
  - tab/section selection
  - 折叠展开
  - 导航意图
  - 说明文案或 showcase-local fragment state
- `Model -102` 不允许持有：
  - `scene_graph_v0`
  - `selected_entity_id`
  - Matrix trace truth
  - `1003-1006` example business state 副本

### Data Ownership

- `Model -100` 继续拥有 Matrix debug trace / metrics / status truth。
- `Model 1003-1006` 继续拥有 canonical examples 的业务真值和 page asset。
- `Model 1007/1008` 继续拥有 Three scene page-level summary 与 child scene truth。
- Gallery 只能通过已有 label ref、mounted model、或显式 summary card 来读取这些 truth。

### Allowed Data Flow

- Allowed:
  - Gallery 读取 `-100` / `1003-1008` 的真实 labels 或 page assets
  - Gallery 按既有 action names 触发 `matrix_debug_*` / `three_scene_*`
  - Gallery 在 local 模式下对 remote-only action 明确返回 `unsupported`
  - Gallery 在 server-backed 模式下通过 shared mailbox/dispatch 驱动既有 handler
- Forbidden:
  - 复制 `scene_graph_v0` 到 `-102`
  - 复制 Matrix trace 文本到 `-102` 作为新的 authoritative source
  - 为 Gallery 重新定义 `gallery_three_scene_*` 或 `gallery_matrix_debug_*` 行为合同
  - 绕过 mailbox 直接从 Gallery 写 `Model 1007/1008` 或 `Model -100`

### Local / Remote Contract

- local:
  - Gallery 可以与 `createDemoStore(...)` 共享 runtime；
  - 对 `0216` 已定义为 remote-only 的 CRUD action，继续保持 explicit unsupported；
  - 对 `0213` 已存在的 local Matrix debug surface，允许复用其既有 contract。
- remote:
  - Gallery 必须基于与主应用一致的 snapshot/dispatch 面；
  - 不能继续走 `createGalleryStore()` 私有 runtime；
  - 既有 server-backed `matrix_debug_*` / `three_scene_*` actions 必须能从 Gallery 路径触发并回写原 truth models。

## Conformance Targets

### Tier Boundary

- 0217 应限制在 Tier 2 / UI composition / frontend store wiring / validator 层。
- 若执行中发现必须改以下文件才能成立，说明 0217 越界，应暂停并升级为新的规划问题：
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/runtime.mjs`
  - `packages/ui-renderer/src/renderer.js`
  - `packages/ui-renderer/src/renderer.mjs`

### Model Placement

- `Model -102`：Gallery local UI state only
- `Model -103`：Gallery page asset only
- `Model -100`：Matrix debug truth
- `Model 1003-1006`：canonical example truth
- `Model 1007/1008`：Three scene parent/child truth
- 0217 默认不新增新的系统模型或正数业务模型；如果执行中必须新增 model id，需单独审查其必要性。

### UI Contract

- Gallery authoritative input 只能来自：
  - `Model -103` 的 `page_asset_v0`
  - `Model -102` 的展示专用 state
  - `-100` / `1003-1008` 的真实 labels/page assets
- Gallery 不得重新引入：
  - root `ui_ast_v0`
  - shared selected AST cache
  - 隐式 mount
  - 复制 child model AST 到 Gallery state 再渲染

## Impact Surface

### Primary Targets

- `packages/worker-base/system-models/gallery_catalog_ui.json`
- `packages/ui-model-demo-frontend/src/gallery_store.js`
- `packages/ui-model-demo-frontend/src/main.js`
- `packages/ui-model-demo-frontend/src/demo_app.js`

### Likely Validation Additions

- `scripts/tests/test_0217_gallery_extension_contract.mjs`
- `packages/ui-model-demo-frontend/scripts/validate_gallery_matrix_three_local.mjs`
- `packages/ui-model-demo-frontend/scripts/validate_gallery_matrix_three_server_sse.mjs`
- `packages/ui-model-demo-frontend/scripts/validate_gallery_matrix_three_browser.mjs`
- 更新：
  - `packages/ui-model-demo-frontend/scripts/validate_gallery_ast.mjs`
  - `packages/ui-model-demo-frontend/scripts/validate_gallery_events.mjs`

### Upstream Anchors To Preserve

- `packages/worker-base/system-models/matrix_debug_surface.json`
- `packages/worker-base/system-models/workspace_positive_models.json`
- `packages/worker-base/system-models/workspace_catalog_ui.json`
- `packages/worker-base/system-models/intent_dispatch_config.json`
- `packages/worker-base/system-models/intent_handlers_three_scene.json`
- `packages/worker-base/system-models/intent_handlers_matrix_debug.json`

这些文件在 0217 中应作为上游合同锚点，而不是首选重写目标；只有在执行证明确有上游 bug 阻塞 Gallery 集成时，才允许做最小修复，并必须复跑对应 upstream validators。

## Success Criteria

- `/gallery` 能在单页内清晰展示：
  - Matrix debug surface 的核心状态与操作入口
  - `0215` canonical examples 的合同定位与入口
  - `0216` ThreeScene 的真实 scene/status/audit 展示
- Gallery 对上游 truth 的依赖是可追踪的：
  - 哪个区块读 `-100`
  - 哪个区块读 `1003-1006`
  - 哪个区块读 `1007/1008`
  - 哪些按钮触发既有 `matrix_debug_*` / `three_scene_*`
- local 与 remote 的 Gallery 路径不再分叉成两套 truth source：
  - local 共享 runtime 或 explicit unsupported
  - remote 共享 authoritative snapshot/dispatch
- 0213 / 0215 / 0216 的既有 contract tests 与 validators 继续 PASS。
- 浏览器级验证能够证明 Gallery 不是“静态拼图”，而是可操作、可观察、可复现的展示闭环。

## Risks & Mitigations

- Risk:
  - 为了快速做展示，把上游 page asset 或 truth label 复制进 `gallery_catalog_ui.json` / `Model -102`。
  - Mitigation:
    - 通过 `test_0217_gallery_extension_contract.mjs` 显式禁止 duplicated truth refs。

- Risk:
  - remote `/gallery` 继续使用 isolated local runtime，导致展示链路是假的。
  - Mitigation:
    - 把 remote shared snapshot/dispatch 写入 0217 主合同，并以 server-backed validator 强制验证。

- Risk:
  - 0217 scope 膨胀成重写 `0213/0215/0216` 本身。
  - Mitigation:
    - 把这些 iteration 视为上游锚点；0217 只做投影、导航、集成和必要的窄修复。

- Risk:
  - Gallery action 直接写业务真值，绕过 mailbox/handler。
  - Mitigation:
    - 复用既有 action names，禁止新建 Gallery 专属业务 action contract。

## Alternatives

### A. 推荐：Gallery 作为 projection-only integration layer，复用既有模型与 action contract

- 优点：
  - 最符合 `0210-0216` 已冻结的 truth ownership 与 mounted model 规则。
  - local/remote 可以共用同一套 contract 和 validators。
- 缺点：
  - 需要处理 `main.js` / `gallery_store.js` 的 mode wiring，不能只改一个 JSON patch。

### B. 把 `0213/0215/0216` 的 page assets 复制到 `gallery_catalog_ui.json`

- 优点：
  - 短期上看起来实现更快。
- 缺点：
  - 直接复制上游合同，形成双份 AST / 双份 truth 维护面，违反本仓库 UI contract。

### C. 维持 current Gallery 只做本地组件演示，不处理 remote/shared data source

- 优点：
  - 代码改动最小。
- 缺点：
  - 无法满足“Matrix + Three.js 示例与数据链路闭环”，交付价值不足。

当前推荐：A。

## Inputs

- Created at: `2026-03-23`
- Iteration ID: `0217-gallery-extension-matrix-three`
- Planning mode: `refine`
- Upstream anchors:
  - `0213` 已提供 Matrix debug formal surface
  - `0215` 已提供 canonical UI examples
  - `0216` 已提供 ThreeScene + scene CRUD contract
