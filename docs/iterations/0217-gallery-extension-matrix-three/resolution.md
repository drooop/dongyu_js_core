---
title: "0217 — gallery-extension-matrix-three Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0217-gallery-extension-matrix-three
id: 0217-gallery-extension-matrix-three
phase: phase1
---

# 0217 — gallery-extension-matrix-three Resolution

## 0. Execution Rules

- Work branch: `dropx/dev_0217-gallery-extension-matrix-three`
- Working directory for all commands: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Required local tools on PATH: `node`, `npm`, `rg`
- Steps must be executed in order.
- Every Step must end with executable validation commands and explicit PASS/FAIL evidence in `runlog.md`.
- 0217 的核心边界：
  - Gallery 是 projection/integration layer
  - `Model -102` / `Model -103` 只承载 Gallery state + page asset
  - Matrix debug truth 仍在 `Model -100`
  - canonical examples truth 仍在 `Model 1003-1006`
  - Three scene truth 仍在 `Model 1007/1008`
- 默认禁止修改以下文件：
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/runtime.mjs`
  - `packages/ui-renderer/src/renderer.js`
  - `packages/ui-renderer/src/renderer.mjs`
  如果执行发现必须修改这些文件，说明 0217 已越界，必须停止并升级为新的规划问题。
- 默认也不应修改以下上游合同文件：
  - `packages/worker-base/system-models/matrix_debug_surface.json`
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `packages/worker-base/system-models/workspace_catalog_ui.json`
  - `packages/worker-base/system-models/intent_dispatch_config.json`
  - `packages/worker-base/system-models/intent_handlers_matrix_debug.json`
  - `packages/worker-base/system-models/intent_handlers_three_scene.json`
  仅当执行证明确有上游 bug 阻塞 Gallery 集成时，才允许做最小修复，并且必须复跑对应 upstream validators。
- `packages/ui-model-demo-server/server.mjs` 仅允许作为最后手段修改。
  - 0217 优先通过 frontend/store wiring 解决 `/gallery` 的 local/remote 数据源分叉；
  - 不允许为了图省事再引入 page-specific server hardcode。
- Any real execution evidence belongs in `runlog.md`, not in this file.

## 1. Implementation Objective

0217 的实施顺序固定为：

1. 先冻结 Gallery 与上游 `0213/0215/0216` 的投影边界，以及 local/remote 共用的数据源策略。
2. 再扩展 `gallery_catalog_ui.json`，把 Matrix debug / canonical examples / ThreeScene 做成同页展示面。
3. 然后收敛 Gallery route 的 read/write path，使 local 与 server-backed 两条路径共享同一套 truth contract。
4. 最后做回归、浏览器验收、runlog 与台账收口。

禁止一开始直接复制上游 AST 或 scene/trace truth 到 Gallery state。0217 的目标不是“在 Gallery 上多放几个卡片”，而是把已有正式合同收口成一个可演示、可验证、可复用的 integration gallery。

## 2. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1 | Freeze Gallery Integration Contract And Mode Alignment | 固定 Gallery 对 `0213/0215/0216` 的 ref/action/data-source 合同，尤其是 remote `/gallery` 不再跑 isolated local runtime | `packages/ui-model-demo-frontend/src/gallery_store.js`, `packages/ui-model-demo-frontend/src/main.js`, `packages/ui-model-demo-frontend/src/demo_app.js`, `scripts/tests/test_0217_gallery_extension_contract.mjs` | `rg -n "createGalleryStore\\(|createRemoteStore\\(|page === 'gallery'" packages/ui-model-demo-frontend/src/main.js packages/ui-model-demo-frontend/src/demo_app.js packages/ui-model-demo-frontend/src/gallery_store.js`; `node scripts/tests/test_0191b_gallery_asset_resolution.mjs`; `node scripts/tests/test_0217_gallery_extension_contract.mjs` | Gallery route 的 local/remote 数据源策略有单一权威定义；上游模型 refs/action names 被写死且不复制真值 | 回退 gallery store/app shell/bootstrap wiring 与 0217 contract test 改动 |
| 2 | Materialize Gallery Matrix / Examples / Three Showcase Surface | 在 `gallery_catalog_ui.json` 和 Gallery local state 中加入 integration showcase，但不复制 upstream truth | `packages/worker-base/system-models/gallery_catalog_ui.json`, `packages/ui-model-demo-frontend/src/gallery_store.js`, `packages/ui-model-demo-frontend/scripts/validate_gallery_ast.mjs`, `packages/ui-model-demo-frontend/scripts/validate_gallery_events.mjs`, `scripts/tests/test_0217_gallery_extension_contract.mjs` | `node packages/ui-model-demo-frontend/scripts/validate_gallery_ast.mjs`; `node packages/ui-model-demo-frontend/scripts/validate_gallery_events.mjs`; `node scripts/tests/test_0191b_gallery_asset_resolution.mjs`; `node scripts/tests/test_0217_gallery_extension_contract.mjs` | `/gallery` 出现 Matrix / examples / Three 展示分区；`-102` 只持有展示专用 state；没有 duplicated scene/trace truth | 回退 Gallery patch、gallery state seeding 与 gallery validators 改动 |
| 3 | Align Gallery Read/Write Paths With Existing Truth Contracts | 让 Gallery 在 local/server-backed 下都走正式 read/write path：local 共享 runtime 或 explicit unsupported，remote 共享 authoritative snapshot/dispatch | `packages/ui-model-demo-frontend/src/gallery_store.js`, `packages/ui-model-demo-frontend/src/main.js`, `packages/ui-model-demo-frontend/src/demo_app.js`, 可选 `packages/ui-model-demo-frontend/src/remote_store.js`, 可选 `packages/ui-model-demo-frontend/src/local_bus_adapter.js`, `packages/ui-model-demo-frontend/scripts/validate_gallery_matrix_three_local.mjs`, `packages/ui-model-demo-frontend/scripts/validate_gallery_matrix_three_server_sse.mjs` | `node packages/ui-model-demo-frontend/scripts/validate_gallery_matrix_three_local.mjs`; `node packages/ui-model-demo-frontend/scripts/validate_gallery_matrix_three_server_sse.mjs`; `node packages/ui-model-demo-frontend/scripts/validate_matrix_debug_local.mjs`; `node packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`; `node packages/ui-model-demo-frontend/scripts/validate_three_scene_local.mjs`; `node packages/ui-model-demo-frontend/scripts/validate_three_scene_server_sse.mjs`; `npm -C packages/ui-model-demo-frontend run build` | Gallery 能读取 `-100` / `1003-1008` 真值；remote 路径不再是 isolated local runtime；local/remote 行为与 upstream contract 一致 | 回退 Gallery wiring、模式对齐改动与新增 local/server validators |
| 4 | Regression, Browser Validation, And Ledger Closeout | 跑上游回归 + Gallery integration 验收 + 浏览器脚本，并收口 docs/runlog/index | `scripts/tests/test_0213_matrix_debug_surface_contract.mjs`, `scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`, `scripts/tests/test_0216_threejs_scene_contract.mjs`, `packages/ui-model-demo-frontend/scripts/validate_gallery_matrix_three_browser.mjs`, `docs/iterations/0217-gallery-extension-matrix-three/runlog.md`, 必要时 `docs/user-guide/modeltable_user_guide.md`, `docs/user-guide/ui_components_v2.md`, `docs/ITERATIONS.md` | `node scripts/tests/test_0213_matrix_debug_surface_contract.mjs`; `node scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`; `node scripts/tests/test_0216_threejs_scene_contract.mjs`; `node packages/ui-model-demo-frontend/scripts/validate_ui_model_examples_local.mjs`; `node packages/ui-model-demo-frontend/scripts/validate_ui_model_examples_server_sse.mjs`; `node packages/ui-model-demo-frontend/scripts/validate_gallery_matrix_three_local.mjs`; `node packages/ui-model-demo-frontend/scripts/validate_gallery_matrix_three_server_sse.mjs`; `node packages/ui-model-demo-frontend/scripts/validate_gallery_matrix_three_browser.mjs`; `npm -C packages/ui-model-demo-frontend run test`; `npm -C packages/ui-model-demo-frontend run build`; `rg -n "0217-gallery-extension-matrix-three|gallery|matrix_debug|ThreeScene" docs/iterations/0217-gallery-extension-matrix-three/runlog.md docs/ITERATIONS.md docs/user-guide/modeltable_user_guide.md docs/user-guide/ui_components_v2.md` | 所有 targeted regressions PASS；浏览器脚本 PASS；docs assessment 与台账完整 | 回退 0217 代码与文档改动，恢复到执行前状态 |

## 3. Step Details

### Step 1 — Freeze Gallery Integration Contract And Mode Alignment

**Goal**

- 把 0217 的核心约束先写死：
  - Gallery 只做 projection/integration；
  - Gallery 不复制 `0213/0215/0216` 真值；
  - remote `/gallery` 不能继续跑 isolated local runtime。

**Scope**

- 明确 `gallery_store` 对两类输入面的支持方式：
  - local shared runtime path
  - server-backed snapshot/dispatch path
- 冻结 0217 会直接引用的上游模型与 action names：
  - `-100`
  - `1003-1006`
  - `1007/1008`
  - `matrix_debug_*`
  - `three_scene_*`
- 新增 0217 contract test，阻止执行期偷偷复制 truth 或新增 Gallery 专属业务 action names。

**Files**

- Create/Update:
  - `packages/ui-model-demo-frontend/src/gallery_store.js`
  - `packages/ui-model-demo-frontend/src/main.js`
  - `packages/ui-model-demo-frontend/src/demo_app.js`
  - `scripts/tests/test_0217_gallery_extension_contract.mjs`
- Prefer no change:
  - `packages/ui-model-demo-frontend/src/remote_store.js`
  - `packages/ui-model-demo-server/server.mjs`

**Validation (Executable)**

- Commands:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "createGalleryStore\\(|createRemoteStore\\(|page === 'gallery'" packages/ui-model-demo-frontend/src/main.js packages/ui-model-demo-frontend/src/demo_app.js packages/ui-model-demo-frontend/src/gallery_store.js`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0191b_gallery_asset_resolution.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0217_gallery_extension_contract.mjs`
- Expected signals:
  - `/gallery` 的数据源与 route wiring 可被 `rg` 直接定位
  - 0191b 继续 PASS，说明 Gallery 入口资产仍从正式 `page_asset_v0` 读取
  - 0217 contract test 明确约束 ref/action/data-source 合同

**Acceptance Criteria**

- 0217 的 upstream refs、action names、mode alignment 策略都有单一权威定义。
- 执行团队不需要再讨论“remote Gallery 到底用谁的 snapshot/dispatch”。
- 若此步仍需要 server hardcode 才能让 remote `/gallery` 看见正式 truth surface，必须先停止并重审合同。

**Rollback Strategy**

- 回退 `gallery_store`、`main.js`、`demo_app.js` 与 `test_0217_gallery_extension_contract.mjs` 的改动。
- 若尝试过 `remote_store.js` 或 `server.mjs` 适配但最终不需要，一并回退。

---

### Step 2 — Materialize Gallery Matrix / Examples / Three Showcase Surface

**Goal**

- 在不复制上游真值的前提下，把 Gallery 扩展成一个正式的 integration showcase 页面。

**Scope**

- 在 `gallery_catalog_ui.json` 中新增一组展示分区，至少覆盖：
  - Matrix debug summary + action entry
  - canonical examples inventory / contract summary / navigation entry
  - ThreeScene summary + viewer / action entry / audit projection
- 只允许在 `Model -102` 中新增 showcase-local state，例如：
  - 当前 tab
  - 当前展开区块
  - 说明卡片状态
- 不允许把上游 `page_asset_v0` / `scene_graph_v0` / trace truth 整块复制到 `-102`。
- 更新现有 Gallery validators，使它们覆盖新分区和新 state label。

**Files**

- Create/Update:
  - `packages/worker-base/system-models/gallery_catalog_ui.json`
  - `packages/ui-model-demo-frontend/src/gallery_store.js`
  - `packages/ui-model-demo-frontend/scripts/validate_gallery_ast.mjs`
  - `packages/ui-model-demo-frontend/scripts/validate_gallery_events.mjs`
  - `scripts/tests/test_0217_gallery_extension_contract.mjs`

**Validation (Executable)**

- Commands:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_gallery_ast.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_gallery_events.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0191b_gallery_asset_resolution.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0217_gallery_extension_contract.mjs`
- Expected signals:
  - Gallery AST 中出现 Matrix / examples / Three showcase 节点
  - Gallery events validator 只写 `-102` 的展示 state 或既有正式 action envelope
  - 0191b 继续证明 Gallery 页面仍来自 `Model -103` 的 `page_asset_v0`

**Acceptance Criteria**

- `/gallery` 新增的展示区块可以被无上下文读者识别为 `0213/0215/0216` 的整合入口。
- `Model -102` 不成为 scene graph / trace / example truth 的镜像缓存。
- Gallery 仍然遵守显式 page asset 和真实 label ref 的输入面。

**Rollback Strategy**

- 回退 `gallery_catalog_ui.json`、Gallery state seeding 与相关 validator/test 改动。
- 删除本步新增的 showcase-local labels 与节点。

---

### Step 3 — Align Gallery Read/Write Paths With Existing Truth Contracts

**Goal**

- 让 Gallery 的按钮、状态和投影在 local/server-backed 两条路径下都走正式合同，而不是各跑一套逻辑。

**Scope**

- local path：
  - 继续复用 shared runtime；
  - 对 `three_scene_*` 这类 upstream 已明确 remote-only 的动作，保持 explicit unsupported；
  - 复用 `0213` 已存在的 local Matrix debug contract。
- server-backed path：
  - `/gallery` 复用主应用 authoritative snapshot/dispatch；
  - Gallery action 通过既有 `matrix_debug_*` / `three_scene_*` 进入 mailbox/handler；
  - Gallery UI 随 snapshot 回流更新，而不是从私有本地 runtime 推断结果。
- 如确实需要轻量调整 `remote_store.js` 或 `local_bus_adapter.js`，只能做 contract-alignment，不得引入第二份业务逻辑。

**Files**

- Create/Update:
  - `packages/ui-model-demo-frontend/src/gallery_store.js`
  - `packages/ui-model-demo-frontend/src/main.js`
  - `packages/ui-model-demo-frontend/src/demo_app.js`
  - `packages/ui-model-demo-frontend/scripts/validate_gallery_matrix_three_local.mjs`
  - `packages/ui-model-demo-frontend/scripts/validate_gallery_matrix_three_server_sse.mjs`
- Optional only if execution proves it is required:
  - `packages/ui-model-demo-frontend/src/remote_store.js`
  - `packages/ui-model-demo-frontend/src/local_bus_adapter.js`

**Validation (Executable)**

- Commands:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_gallery_matrix_three_local.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_gallery_matrix_three_server_sse.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_matrix_debug_local.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_matrix_debug_server_sse.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_three_scene_local.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_three_scene_server_sse.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && npm -C packages/ui-model-demo-frontend run build`
- Expected signals:
  - Gallery local validator 证明共享 runtime / explicit unsupported 行为稳定
  - Gallery server validator 证明 remote `/gallery` 使用真实 snapshot/dispatch
  - 0213 / 0216 既有 validators 继续 PASS，说明 0217 没有破坏上游 data path

**Acceptance Criteria**

- Gallery 能直接读取 `-100` / `1003-1008` 的真实 labels 或 page assets。
- remote `/gallery` 不再依赖 isolated local runtime。
- local 与 server-backed 路径的差异只体现在 upstream 已定义的 capability boundary 上，而不是因为 Gallery 私自复制逻辑。

**Rollback Strategy**

- 回退 Gallery wiring、mode alignment、以及新增 local/server validators。
- 若本步尝试过 `remote_store.js` / `local_bus_adapter.js` 改动但最终不需要，一并回退。

---

### Step 4 — Regression, Browser Validation, And Ledger Closeout

**Goal**

- 用 deterministic regression + browser smoke 证明 0217 是真正的展示闭环，而不是只在 AST 层“看起来有节点”。

**Scope**

- 复跑 `0213` / `0215` / `0216` 关键合同测试。
- 增加 Gallery browser-level validator，验证至少以下行为：
  - `/gallery` 可进入新展示区块
  - Matrix debug 展示可读取状态并触发正式动作
  - canonical examples 入口可被识别
  - ThreeScene 展示在 local/server-backed 模式下呈现正确 contract 行为
- 收口 `runlog.md`、必要的 user guide 评估、以及 `docs/ITERATIONS.md` 状态变更。

**Files**

- Create/Update:
  - `packages/ui-model-demo-frontend/scripts/validate_gallery_matrix_three_browser.mjs`
  - `docs/iterations/0217-gallery-extension-matrix-three/runlog.md`
  - 必要时 `docs/user-guide/modeltable_user_guide.md`
  - 必要时 `docs/user-guide/ui_components_v2.md`
  - `docs/ITERATIONS.md`

**Validation (Executable)**

- Commands:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0216_threejs_scene_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_ui_model_examples_local.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_ui_model_examples_server_sse.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_gallery_matrix_three_local.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_gallery_matrix_three_server_sse.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_gallery_matrix_three_browser.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && npm -C packages/ui-model-demo-frontend run test`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && npm -C packages/ui-model-demo-frontend run build`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "0217-gallery-extension-matrix-three|gallery|matrix_debug|ThreeScene" docs/iterations/0217-gallery-extension-matrix-three/runlog.md docs/ITERATIONS.md docs/user-guide/modeltable_user_guide.md docs/user-guide/ui_components_v2.md`
- Expected signals:
  - 上游 `0213/0215/0216` regression 全部 PASS
  - Gallery integration local/server/browser 三层验收全部 PASS
  - docs/runlog/index 对 0217 的状态与证据描述一致

**Acceptance Criteria**

- 0217 的展示闭环得到脚本和浏览器双重证据支持。
- 没有因为 0217 集成而破坏上游 Matrix/UI examples/ThreeScene 合同。
- 任何需要更新的用户文档都已明确评估并记录。

**Rollback Strategy**

- 回退 0217 新增或修改的 Gallery 实现、验证脚本与文档台账。
- 若 docs 评估证明无需用户文档改动，则仅保留 runlog 与迭代状态的实际执行证据。
