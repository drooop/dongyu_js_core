---
title: "0214 — sliding-flow-ui Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0214-sliding-flow-ui
id: 0214-sliding-flow-ui
phase: phase1
---

# 0214 — sliding-flow-ui Plan

## 0. Metadata

- ID: `0214-sliding-flow-ui`
- Date: `2026-03-23`
- Owner: AI-assisted planning
- Branch (registered in `docs/ITERATIONS.md`): `dropx/dev_0214-sliding-flow-ui`
- Planning mode: `refine`
- Depends on:
  - `0210-ui-cellwise-contract-freeze`
  - `0211-ui-bootstrap-and-submodel-migration`
  - `0213-matrix-debug-ui-surface`
- Context anchors:
  - `0153-cognition-feedback-loop`
  - `0201-route-sse-page-sync-fix`
- Downstream:
  - `0215-ui-model-tier2-examples-v1`
  - `0217-gallery-extension-matrix-three`

## 1. Goal

- 在 `Workspace` 路径下，为当前选中的 flow-capable app 增加一层可复用的 `sliding flow shell`，把：
  - 当前表单/应用内容；
  - `scene_context` 的过程态；
  - `action_lifecycle` 的动作反馈；
  - `0213` 已冻结的 Matrix debug safe ops / trace 摘要；
  聚合到同一块交互面里。
- 该 shell 必须做到：
  - 让无上下文读者能在一个页面中看清“当前在哪个流程阶段、最近发生了什么、下一步该看哪里”；
  - 不改变现有 authoritative data path，不把 UI shell 变成新的业务真值或新的系统 side-effect 入口。

## 2. Background

- `0210-ui-cellwise-contract-freeze` 已冻结 UI 主合同：
  - UI authoritative input 必须来自真实 cell / label / mounted model；
  - 不允许回到 shared AST / root `ui_ast_v0` / 大 JSON 初始化。
- `0211-ui-bootstrap-and-submodel-migration` 已把主线 UI 收敛为：
  - route -> page asset / schema projection -> mounted model；
  - `Workspace` 通过显式 `model.submt` 选择并渲染当前 app。
- `0213-matrix-debug-ui-surface` 已提供一套正式可挂载的 Matrix debug surface：
  - `Model -100` 承载 trace / Matrix / bridge 可观测状态；
  - `Model -2` 承载 `matrix_debug_*` 投影状态；
  - `matrix_debug_refresh` / `matrix_debug_clear_trace` / `matrix_debug_summarize` 已有 safe ops 和 local/server validator。
- 同时，仓库里已经有一套过程态基础设施，但还没有进入 Workspace 主线：
  - `Model -12` 的 `scene_context` 提供 `current_app` / `active_flow` / `flow_step` / `recent_intents` / `last_action_result`；
  - `Model -1` mailbox 上的 `action_lifecycle` 提供执行中/完成/失败等动作反馈。
- 当前 `Workspace` 的实际呈现仍是“选中哪个 app，就直接显示哪个 schema/page asset”：
  - [route_ui_projection.js](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-frontend/src/route_ui_projection.js) 只负责把 selected app AST 塞进 workspace 右侧槽位；
  - [editor_page_state_derivers.js](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-frontend/src/editor_page_state_derivers.js) 已能派生 `matrix_debug_*`，但没有派生 flow shell 所需视图；
  - [workspace_positive_models.json](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/worker-base/system-models/workspace_positive_models.json) 里的 `Model 100` 是当前唯一具备 deterministic submit / trace / status anchor 的真实闭环 app；
  - `Model 1001/1002` 仍是 schema-only `sliding_ui` demo form，没有完整 submit/trace 链路。

## 3. Problem Statement

- 过程态已经存在于系统模型中，但用户当前必须在多个地方拼接理解：
  - 表单/业务状态在当前 positive model；
  - 过程态在 `scene_context`；
  - 动作结果在 `action_lifecycle`；
  - 调试与 trace 在 `Model -100` / `matrix_debug_*`。
- `0213` 解决了“有正式 debug surface”，但没有解决“业务表单与过程态是两个割裂视角”的问题。
- 目前缺少一套正式、可验证的 UI 合同来表达：
  - 什么时候显示 flow shell；
  - flow shell 读哪些状态；
  - 什么交互只是 UI-level step/tab 切换；
  - 什么交互仍必须走原有 submit / mailbox / debug safe ops 路径。
- 如果 0214 直接在 server 或随机 page asset 里临时硬编码一个流程面，会立刻重演 0210/0211/0213 刚收掉的债务：
  - 共享 AST truth-source；
  - direct system model mutation；
  - local / server 两套不一致的 UI 行为。

## 4. Scope

### 4.1 In Scope

- 在 `Workspace` 右侧现有 selected-app 槽位之上，增加一层 `sliding flow shell`：
  - 仍显示当前选中的 app；
  - 但在同一视图中补充 flow stage / action feedback / debug summary。
- 复用现有系统状态作为唯一数据来源：
  - 业务字段：当前 selected positive model；
  - 过程态：`Model -12` `scene_context`；
  - 动作反馈：`Model -1` `action_lifecycle`；
  - 调试态：`Model -100` + `Model -2` `matrix_debug_*`。
- 以 `Model 100` 作为本 iteration 的 executable flow anchor：
  - 它已有 deterministic submit chain / trace / status；
  - 它可以证明 flow shell 在真正可执行场景下成立。
- 对其他 `sliding_ui` / schema-backed app，允许复用同一 shell 的“浏览/编辑/观察”部分，但不要求补齐新 submit 语义。
- 若 flow shell 需要最小 UI 记忆状态（例如当前查看的阶段页签 / focus step），只能放在 `Model -2` 投影标签。
- 增加 deterministic contract / validator，覆盖：
  - local demo path；
  - server/SSE path；
  - workspace route sync；
  - no direct-write to `-12` / `-100` / `0`；
  - no runtime / renderer regression。

### 4.2 Out of Scope

- 不新增 `runtime.js` / `runtime.mjs` 的解释器语义。
- 不新增 renderer primitive；若现有 `Card` / `StatusBadge` / `Tabs` / `Table` / `ProgressBar` 组合无法承载，必须停止并升格为新 iteration。
- 不新增 Matrix / MQTT / Model 0 egress 路径，不改 owner-chain，不改业务数据写入口。
- 不给 `Model 1001/1002` 临时补一套“假 submit 链路”来凑流程演示。
- 不改 Gallery / Three.js / Prompt / Docs / Static 路由。
- 不新增新的 Workspace page catalog / system-visible UI model，除非 execution 期证明 route projection 无法表达且经重新裁决。

## 5. Conformance Targets

### 5.1 Data Ownership

- 当前 selected positive model 继续拥有业务真值与业务输入。
- `Model -12` 继续拥有 `scene_context`，它是系统过程上下文，不是 UI shell 的缓存。
- `Model -1` mailbox 继续拥有 `action_lifecycle`，它是最新动作状态，不是 flow history store。
- `Model -100` / `matrix_debug_*` 继续拥有 debug / trace / readiness truth。
- 0214 若引入任何新增标签，只能是 `Model -2` 下的 UI-only selection/projection state；不得偷写 `-12` / `-100` / `0`。

### 5.2 Allowed Data Flow

- Allowed:
  1. `Workspace` 继续通过 route projection 渲染当前 selected app；
  2. flow shell 从 snapshot 读取 selected app / `scene_context` / `action_lifecycle` / `matrix_debug_*`；
  3. UI-level 阶段切换仅允许写 `Model -2` 的投影标签；
  4. debug 按钮继续复用 `0213` safe ops；
  5. 真正业务动作仍走既有 `mailbox -> dispatch/handler -> model chain -> Model 0` 路径。
- Forbidden:
  - flow shell direct-write `Model -12` `scene_context`
  - flow shell direct-write `Model -100` trace/debug truth
  - flow shell 以“步骤切换”为名 direct-write `Model 0` 或 positive business truth
  - 因为想做流程 UI 而恢复 shared AST / server-owned AST / fallback page

### 5.3 Applicability Rule

- 0214 默认只在 `Workspace` route 生效。
- flow shell 必须显式判定“当前 app 是否 flow-capable”：
  - 最低保证：`Model 100` 必须进入 shell；
  - 其他 schema-backed `sliding_ui` app 可进入只读/轻交互 shell，但不得因为没有 submit chain 而伪造 process truth。
- 非 `Workspace` route 与 standalone Matrix debug app 维持当前行为，不做隐式增强。

### 5.4 Tier Boundary

- 0214 的推荐落点是 frontend projection / validator 层：
  - [route_ui_projection.js](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-frontend/src/route_ui_projection.js)
  - [editor_page_state_derivers.js](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-frontend/src/editor_page_state_derivers.js)
  - [demo_modeltable.js](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-frontend/src/demo_modeltable.js)
  - [server.mjs](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-server/server.mjs) 仅用于 local/remote state parity
- 默认禁止改动以下 Tier 1 文件：
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/runtime.mjs`
  - `packages/ui-renderer/src/renderer.js`
  - `packages/ui-renderer/src/renderer.mjs`
- 如 execution 中发现必须修改上述文件，当前 iteration 必须停止并重新规划；不能在 0214 内顺手越 Tier。

## 6. Impact Surface

### 6.1 Frontend Projection

- [packages/ui-model-demo-frontend/src/route_ui_projection.js](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-frontend/src/route_ui_projection.js)
  - 负责把 selected app AST 包进 flow shell，而不是裸插到 workspace 右侧
- [packages/ui-model-demo-frontend/src/editor_page_state_derivers.js](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-frontend/src/editor_page_state_derivers.js)
  - 新增 flow-capable app 判定与 flow summary / stage projection
- [packages/ui-model-demo-frontend/src/model_ids.js](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-frontend/src/model_ids.js)
  - 补齐 `scene_context` / lifecycle / debug 常量，避免魔法数字散落

### 6.2 Local / Server State Parity

- [packages/ui-model-demo-frontend/src/demo_modeltable.js](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-frontend/src/demo_modeltable.js)
  - 若 shell 需要最小 UI state，local mode 必须显式初始化
- [packages/ui-model-demo-server/server.mjs](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-server/server.mjs)
  - server path 必须与 local path 使用同一套 flow projection 前提；只允许补投影态初始化，不允许新增业务/Matrix side effect

### 6.3 Validation

- Existing anchors to preserve:
  - [scripts/tests/test_0182_app_shell_route_sync_contract.mjs](/Users/drop/codebase/cowork/dongyuapp_elysia_based/scripts/tests/test_0182_app_shell_route_sync_contract.mjs)
  - [scripts/tests/test_0182_workspace_route_init_contract.mjs](/Users/drop/codebase/cowork/dongyuapp_elysia_based/scripts/tests/test_0182_workspace_route_init_contract.mjs)
  - [scripts/tests/test_0201_route_local_ast_contract.mjs](/Users/drop/codebase/cowork/dongyuapp_elysia_based/scripts/tests/test_0201_route_local_ast_contract.mjs)
  - [scripts/tests/test_0213_matrix_debug_surface_contract.mjs](/Users/drop/codebase/cowork/dongyuapp_elysia_based/scripts/tests/test_0213_matrix_debug_surface_contract.mjs)
  - [scripts/tests/test_0182_model100_submit_chain_contract.mjs](/Users/drop/codebase/cowork/dongyuapp_elysia_based/scripts/tests/test_0182_model100_submit_chain_contract.mjs)
- New validation targets:
  - `scripts/tests/test_0214_sliding_flow_ui_contract.mjs`
  - `packages/ui-model-demo-frontend/scripts/validate_sliding_flow_local.mjs`
  - `packages/ui-model-demo-frontend/scripts/validate_sliding_flow_server_sse.mjs`

### 6.4 Expected Non-Impact

- No expected change to:
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/runtime.mjs`
  - `packages/ui-renderer/src/renderer.js`
  - `packages/ui-renderer/src/renderer.mjs`
  - `packages/worker-base/system-models/matrix_debug_surface.json`
  - `packages/worker-base/system-models/workspace_catalog_ui.json`
- 若 execution 期间这些文件被证明必须改动，说明推荐路线失效，应先停下重做设计判断。

## 7. Success Criteria

- `Workspace` 中选中 `Model 100` 时，UI 能在一个视图内同时看到：
  - 当前 app 本体；
  - flow stage / current action / recent intent 摘要；
  - 0213 debug summary 或 safe ops 入口。
- 同一套 flow shell 能在 local demo 与 server/SSE path 下稳定渲染，且 route sync 不倒退。
- flow shell 不引入新的 authoritative state：
  - 不 direct-write `scene_context`
  - 不 direct-write Matrix debug truth
  - 不改变 `Model 100` submit chain
- 0214 有独立 contract test 与 local/server validator，而不是只靠人工看页面。
- 非 `Workspace` 页面与 standalone Matrix debug surface 保持既有行为。

## 8. Risks & Mitigations

- Risk:
  - flow shell 变成一个新的“业务真值拼装层”，把 `-2` 当成 process truth。
  - Mitigation:
    - 明确 `-2` 仅可承载 UI-only focus/selection；所有 process truth 仍读取 `-12` / `-1` / `-100`。

- Risk:
  - 为了让非 `Model 100` 的 schema app 也“看起来像流程”，临时给它们伪造 submit/result 语义。
  - Mitigation:
    - 把 `Model 100` 固定为 executable anchor；其他 app 只允许复用可证明成立的浏览/编辑/观察部分。

- Risk:
  - scope 膨胀成 schema projection 新协议或 renderer 扩展。
  - Mitigation:
    - 不扩 `_field_order` 协议，不发明新的 `Steps/Timeline` primitive；现有组件不够用则停止并拆分 iteration。

- Risk:
  - local 与 server path 各自长出一套 flow shell 逻辑。
  - Mitigation:
    - 强制共用 `route_ui_projection.js` / `editor_page_state_derivers.js`，并配对 local/server validator。

## 9. Alternatives

### A. 推荐：在 `Workspace` route projection 上叠加 flow shell，复用现有 selected app + process/debug state

- 优点：
  - 最贴合 `0211` 当前主线；
  - 不新增 system-visible model / catalog；
  - local / server 可以自然共用同一条 projection 逻辑。
- 缺点：
  - 需要仔细控制 shell 与 selected app 的组合边界，防止 route projection 变复杂。

### B. 新建一个独立 negative-model flow surface，然后把 selected app 内容嵌进去

- 优点：
  - 页面结构看起来更独立。
- 缺点：
  - 需要新增 model id、挂载点、catalog 语义；
  - 更容易和 `0213` debug surface 重复建设。

### C. 扩展 schema projection 协议，引入 step/group 元数据，让每个 `sliding_ui` app 自己声明流程结构

- 优点：
  - 长期看可做得更“纯模型化”。
- 缺点：
  - 当前仓库没有任何 step metadata；
  - 会触发 `0191a` 冻结协议的重新裁决，超出 0214 合理范围。

当前推荐：A。

## 10. Inputs

- Created at: `2026-03-23`
- Iteration ID: `0214-sliding-flow-ui`
- Planning mode: `refine`
- Draft review result:
  - 既有 `plan.md` / `resolution.md` 只有 scaffold；
  - 缺少自包含背景、当前代码事实、影响范围、contract 边界、具体验证命令与回滚策略；
  - 本次重写以仓库现状为依据，补齐上述缺口。
