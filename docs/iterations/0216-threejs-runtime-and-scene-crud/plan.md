---
title: "0216 — threejs-runtime-and-scene-crud Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0216-threejs-runtime-and-scene-crud
id: 0216-threejs-runtime-and-scene-crud
phase: phase1
---

# 0216 — threejs-runtime-and-scene-crud Plan

## Metadata

- ID: `0216-threejs-runtime-and-scene-crud`
- Date: `2026-03-23`
- Owner: AI-assisted planning
- Branch (registered in `docs/ITERATIONS.md`): `dropx/dev_0216-threejs-runtime-and-scene-crud`
- Planning mode: `refine`
- Depends on:
  - `0215-ui-model-tier2-examples-v1`
- Downstream:
  - `0217-gallery-extension-matrix-three`

## Goal

- 建立一个最小但正式的 Three.js integration contract，使仓库第一次具备以下闭环：
  - Tier 1:
    - 一个可审计的 `ThreeScene` renderer primitive
    - 一个浏览器侧 Three.js host component，负责 mount / update / dispose 生命周期
  - Tier 2:
    - 一个可在 `Workspace` 中被选中和渲染的 Three scene app
    - 一条通过 `ui_event -> intent_dispatch_table -> handler patch -> authoritative scene labels` 完成的 scene entity CRUD 正式链路
- 让 `0217` 能直接复用 0216 的 runtime/scene 合同做 Gallery 集成，而不是再发明一套 raw canvas / ad-hoc page hack。

## Terminology

- `ThreeScene`
  - 0216 中拟引入的单一 3D renderer primitive。
  - 它表示“一块由 renderer 调度、由 frontend host component 托管的 Three.js scene surface”。
- `scene app model`
  - `Workspace` 中可见的正数模型。
  - 持有 `page_asset_v0`，负责把 3D scene 与 CRUD controls 组合成一个正式页面。
- `scene child model`
  - `scene app model` 显式挂载的正数 child model。
  - 持有 authoritative scene truth，例如 `scene_graph_v0`、`selected_entity_id`、`scene_status`、`scene_audit_log`。
- `scene entity`
  - `scene_graph_v0` 里的单个 Three.js object description。
  - 不是 ModelTable model，不等于 `create_model` / `delete_model`。

## Background

- `0210-ui-cellwise-contract-freeze` 已冻结 UI 主合同：
  - UI 只能读取真实 materialized labels、显式页面目录、以及通过 `model.submt` 挂载进层级的 child model。
  - 不允许 shared AST / raw page blob / undocumented fallback 被重新升格为真值。
- `0215-ui-model-tier2-examples-v1` 已提供 0216 可以直接复用的 example topology：
  - `Workspace` authoritative positive seed 为 `packages/worker-base/system-models/workspace_positive_models.json`
  - `Workspace` mount inventory 为 `packages/worker-base/system-models/workspace_catalog_ui.json`
  - `1003/1004/1005/1006` 已证明：
    - schema-only
    - `page_asset_v0`
    - parent-mounted child model
    - formal handler-driven write path
    可以共存并被 local/server validators 审计
- 当前仓库还没有任何真正的 Three.js 产品能力：
  - `rg -n "threejs|three\\.js|mesh|webgl|orbit" packages scripts` 没有业务代码命中
  - `packages/ui-model-demo-frontend/package.json` 没有 `three` dependency
  - `packages/ui-renderer/src/component_registry_v1.json` 没有任何 3D component 类型
- 当前 renderer/host 结构已经足够清晰，适合最小增量接入：
  - `packages/ui-renderer/src/renderer.mjs` / `renderer.js`
    - registry-first
    - 但具体组件行为仍由 renderer 主干分支实现
  - `packages/ui-model-demo-frontend/src/main.js`
    - 负责本地/远端 app bootstrap
    - 可以注册一个新的 frontend host component，而不必改 route contract
  - `packages/ui-model-demo-server/server.mjs`
    - 已自动加载 `workspace_positive_models.json` 与 `intent_dispatch_config.json`
    - 理论上无需为了 0216 再引入 page-specific server hardcode

## Problem Statement

- 0215 已经把 canonical examples、workspace mount、formal write path 的“2D contract”搭好了，但仓库仍缺少一个正式的 3D runtime surface。
- 当前真正缺的不是“随便画一个 canvas demo”，而是这四件事同时成立的合同：
  - renderer 能识别一种正式的 3D primitive，而不是把 raw `Html` / inline `<canvas>` 当逃逸口
  - frontend host 能持有 Three.js object graph 的生命周期，但不把浏览器对象误当成 authoritative truth
  - `Workspace` 能像 0215 example 一样加载一个 Three scene app，而不是 route special-case
  - scene entity 的 create / read / update / delete 通过正式 action/handler 路径回写同一组 authoritative labels
- 如果 0216 只做“本地能看到一个旋转 cube”，而不冻结上述边界，后续 `0217` 极容易再次出现这些问题：
  - canvas / renderer 特判藏在 route 或 page wrapper，而不是 renderer contract
  - 浏览器内 Three.js object 成为实际真值，ModelTable 只剩初始化快照
  - local / remote 各自复制一套 scene CRUD 逻辑
  - Gallery 集成时不得不重新设计 scene data shape、mount 方式和验证口径

## Assumptions

- 假设 A:
  - 0216 只引入一个单一的 `ThreeScene` primitive，而不是多个 `MeshBox` / `OrbitCamera` / `Light` primitive。
  - 验证方法：
    - `packages/ui-renderer/src/component_registry_v1.json` 中只新增一个 3D primitive 入口
    - `scripts/tests/test_0216_threejs_scene_contract.mjs` 固定该 primitive name 与 input shape
- 假设 B:
  - 0216 不新增 runtime interpreter semantics，也不新增 label.t；scene truth 仍由既有 `json` / `str` / `int` / `bool` labels 表达。
  - 验证方法：
    - `git diff --exit-code -- packages/worker-base/src/runtime.js packages/worker-base/src/runtime.mjs`
    - `rg -n "scene_graph_v0|camera_state_v0|selected_entity_id|scene_status" packages/worker-base/system-models`
- 假设 C:
  - `scene app model` + `scene child model` 两层结构足以形成 0216 的最小闭环。
  - 推荐 ID block：
    - `1007` = Workspace-visible Three scene app model
    - `1008` = authoritative scene child model
  - 验证方法：
    - `scripts/tests/test_0216_threejs_scene_contract.mjs` 断言 parent-mounted child pattern
    - `workspace_catalog_ui.json` 只挂载 parent，不直接暴露 child
- 假设 D:
  - local path 对 scene CRUD 继续保持 projection-only / explicit unsupported；authoritative CRUD 只在 server-backed path 成立。
  - 验证方法：
    - `packages/ui-model-demo-frontend/src/local_bus_adapter.js` 对 0216 action names 返回 deterministic `unsupported`
    - `packages/ui-model-demo-frontend/scripts/validate_three_scene_local.mjs` 验证“能渲染但不能偷偷改真值”
    - `packages/ui-model-demo-frontend/scripts/validate_three_scene_server_sse.mjs` 验证正式 CRUD 链路
- 假设 E:
  - `server.mjs` 不需要 page-specific hardcode；只要 patch/handler 就能让 server-backed path 成立。
  - 验证方法：
    - `rg -n "workspace_positive_models\\.json|intent_dispatch_config\\.json" packages/ui-model-demo-server/server.mjs`
    - `packages/ui-model-demo-frontend/scripts/validate_three_scene_server_sse.mjs`

## Scope

### In Scope

- 在 frontend package 内引入 `three` dependency，并把依赖落点冻结为单一权威位置。
- 在 `ui-renderer` 中引入一个新的 `ThreeScene` primitive：
  - 允许 renderer 识别 `ThreeScene`
  - 明确 renderer 与 frontend host component 的边界
  - 保持 CJS / ESM renderer 行为一致
- 在 frontend 中新增一个专用 Three.js host component：
  - 负责 mount / update / dispose
  - 只消费 snapshot/props 传入的 scene labels
  - 不自行持久化业务真值
- 在 authoritative positive seed 中加入一个 Three scene app：
  - `page_asset_v0` 承载 scene viewer + CRUD controls
  - 使用 0215 已证明的 parent-mounted child pattern
- 为 scene entity CRUD 增加正式 action contract 与 handler patch。
- 增加 deterministic validations：
  - renderer contract
  - local render contract
  - server-backed CRUD contract
  - upstream 0215 guard 不回退

### Out of Scope

- 不做 `0217` 的 Gallery 集成。
- 不做 glTF/import/export、材质编辑器、动画时间线、physics、OrbitControls 全量可配化。
- 不做多 scene、多 viewport、多 camera orchestrator。
- 不把每个 Three.js object 升格成一个独立 ModelTable model。
- 不恢复 raw `Html` / inline `<canvas>` bypass renderer contract。
- 不修改 `packages/worker-base/src/runtime.js` / `runtime.mjs` 解释器语义。
- 不把 scene CRUD 误解为 `create_model` / `delete_model` 之类的 ModelTable model mutation。

## Contract Proposal

### Recommended Tier Split

- Tier 1:
  - `packages/ui-renderer/src/component_registry_v1.json`
  - `packages/ui-renderer/src/renderer.js`
  - `packages/ui-renderer/src/renderer.mjs`
  - frontend Three.js host component 与其 global registration
- Tier 2:
  - `workspace_positive_models.json`
  - `workspace_catalog_ui.json`
  - `intent_dispatch_config.json`
  - `intent_handlers_three_scene.json`
  - `local_bus_adapter.js`
  - local/server validators

### Recommended Scene Data Contract

- `scene child model` 持有 authoritative labels，至少包括：
  - `scene_graph_v0`
    - `json`
    - normalized scene graph
    - 至少能表示一组 primitive objects、position/rotation/scale、color、visibility
  - `camera_state_v0`
    - `json`
    - 最小 camera pose / target
  - `selected_entity_id`
    - `str`
  - `scene_status`
    - `str`
  - `scene_audit_log`
    - `str`
- `scene app model` 持有：
  - `page_asset_v0`
  - UI-facing status text
  - 对 child model 的显式 `model.submt`

### Recommended CRUD Contract

- formal action set 至少覆盖：
  - `three_scene_create_entity`
  - `three_scene_select_entity`
  - `three_scene_update_entity`
  - `three_scene_delete_entity`
- scene CRUD 必须满足：
  - UI 只发 action envelope
  - handler patch 决定怎么改 `scene_graph_v0`
  - renderer 只读 snapshot，不直写业务真值
- local path 只允许两种结果：
  - 渲染 seeded scene
  - 对 CRUD action 返回 deterministic `unsupported`
  不允许复制第二份 Three scene business logic

### Recommended UI Surface

- `page_asset_v0` 至少组合：
  - `ThreeScene`
  - `Table`
  - `Button`
  - `StatusBadge`
  - `Terminal`
- 0216 的 UI surface 不应要求：
  - route-level special case
  - page_asset_resolver fallback
  - shared AST cache

## Conformance Targets

### Tier Placement

- Tier 1 只允许承担：
  - renderer primitive
  - browser host lifecycle
  - dependency wiring
- Tier 2 只允许承担：
  - scene truth labels
  - workspace mount
  - CRUD action/handler
  - validator / docs
- 若执行中发现必须改 runtime interpreter 或新增 label.t，说明 0216 已越界，必须停止并升级为新的规划问题。

### Model Placement

- 推荐正数模型：
  - `1007` = scene app model
  - `1008` = scene child model
- `Model -2`
  - 只允许放 UI-only selection / tab / dialog state
- `Model -10`
  - 只允许放 dispatch/handler logic
- 0216 默认不规划新的负数系统模型。
  - 如果执行中确实需要新增负数模型，必须先更新 `CLAUDE.md` `MODEL_ID_REGISTRY` 再继续。

### Data Ownership

- authoritative scene truth 只能在正数 `scene child model` labels 中。
- frontend Three.js objects、camera instances、renderer caches 只是 host runtime cache，不是业务真值。
- `Model -2` 不能持有 scene graph 真值。
- `Model -10` 不能演变成 scene data store。

### Data Flow

- Allowed:
  - `Workspace` 选择 `scene app model`
  - parent `page_asset_v0` 读取 child model 的真实 labels
  - UI 发送 `ui_event`
  - `intent_dispatch_table` 把 action 路由到 `handle_three_scene_*`
  - handler patch 回写 child model labels
  - `ThreeScene` 从 snapshot 读取更新后的 labels 并重绘
- Forbidden:
  - `ThreeScene` 直接写业务 labels
  - local adapter 私自实现另一份 authoritative CRUD
  - route/page wrapper 对 Three scene 做 hardcoded AST 注入
  - server 把 Three page surface 写成专用 `ui_ast_v0` 原型

### Data Chain

- 0216 的完整链路必须是：
  - `Workspace mount`
  - `page_asset_v0`
  - `ThreeScene`
  - `ui_event`
  - `intent_dispatch_table`
  - `handle_three_scene_*`
  - `scene child model labels`
  - renderer refresh
- 任意跳过其中关键节点但“看起来能跑”的方案，都属于 non-conformant。

## Impact Surface

### Dependency And Tier 1 Renderer Surface

- `packages/ui-model-demo-frontend/package.json`
  - frontend dependency placement
- `bun.lock`
  - 若 package manager 刷新 lockfile
- `packages/ui-renderer/src/component_registry_v1.json`
  - 新增 `ThreeScene`
- `packages/ui-renderer/src/renderer.js`
- `packages/ui-renderer/src/renderer.mjs`
- `scripts/validate_ui_renderer_v0.mjs`
  - 新增 renderer contract case

### Frontend Host Surface

- `packages/ui-model-demo-frontend/src/main.js`
  - 注册 Three.js host component
- 新增 `packages/ui-model-demo-frontend/src/components/ThreeSceneHost.js`
  - 浏览器侧 Three.js lifecycle host
- `packages/ui-model-demo-frontend/src/model_ids.js`
  - 0216 model ids / action names 常量

### Authoritative Scene Assets And CRUD Surface

- `packages/worker-base/system-models/workspace_positive_models.json`
  - scene app model / child model / page asset / scene truth seed
- `packages/worker-base/system-models/workspace_catalog_ui.json`
  - Workspace mount
- `packages/worker-base/system-models/intent_dispatch_config.json`
  - action -> handler map
- 新增 `packages/worker-base/system-models/intent_handlers_three_scene.json`
  - authoritative CRUD handler
- `packages/ui-model-demo-frontend/src/local_bus_adapter.js`
  - explicit unsupported for local CRUD path

### Validation Surface

- 新增 `scripts/tests/test_0216_threejs_scene_contract.mjs`
- 新增 `packages/ui-model-demo-frontend/scripts/validate_three_scene_local.mjs`
- 新增 `packages/ui-model-demo-frontend/scripts/validate_three_scene_server_sse.mjs`
- Existing upstream guards to preserve:
  - `scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`
  - `scripts/tests/test_0191d_test_workspace_asset_resolution.mjs`
  - `scripts/validate_ui_ast_v0x.mjs`
  - `npm -C packages/ui-model-demo-frontend run build`

### Explicitly Prefer No Impact

- `packages/worker-base/src/runtime.js`
- `packages/worker-base/src/runtime.mjs`
- `packages/ui-model-demo-server/server.mjs`
- `packages/ui-model-demo-frontend/src/route_ui_projection.js`
- `packages/ui-model-demo-frontend/src/page_asset_resolver.js`

如果执行中发现 0216 必须依赖这些文件里的 page-specific hardcode 或 interpreter change，说明本计划的“renderer/asset-first”边界被打破，应停止并回到规划阶段。

## Success Criteria

- `three` dependency 与 `ThreeScene` primitive 被正式引入，frontend build 通过。
- `Workspace` 能显示一个 Three scene app；child scene model 不直接暴露在 `Workspace` registry。
- local validator 能证明：
  - `ThreeScene` renderer/host 可以渲染 seeded scene
  - local path 不会偷偷改 scene truth
- server-backed validator 能证明：
  - `three_scene_*` action 通过正式 handler 链路修改 authoritative child labels
  - 变更后的 scene state 会反映到渲染结果或状态标签
- `0215` 例子与 upstream workspace guards 不回退。
- 0217 可以把 0216 的 scene app / primitive / validators 当现成输入，而不必再改 runtime contract。

## Risks & Mitigations

- Risk:
  - Three.js browser object graph 被误用为业务真值。
  - Mitigation:
    - scene truth 固定在 child model labels；host component 只消费 snapshot。
- Risk:
  - 0216 scope 膨胀成完整 3D editor / Gallery feature。
  - Mitigation:
    - 只允许一个 primitive、一个 app、一个 child model、一个 CRUD surface。
- Risk:
  - local mode 为了演示复制第二份 scene CRUD 逻辑。
  - Mitigation:
    - local path 明确 `unsupported`；正式 CRUD 只在 server-backed validator 验收。
- Risk:
  - 为了接入 Three.js 而引入 route/server special-case。
  - Mitigation:
    - 0216 明确要求 renderer/asset-first；`route_ui_projection.js` 与 `server.mjs` 默认不作为交付面。
- Risk:
  - 依赖落点不清，导致 lockfile、package manifest、build 环境分叉。
  - Mitigation:
    - Step 1 先冻结 dependency placement，并把验证脚本写死到 manifest/lockfile 层。

## Alternatives

### A. 推荐：单一 `ThreeScene` primitive + normalized scene labels + formal handler CRUD

- 优点：
  - 与 0215 的 parent-mounted / formal data path 直接衔接
  - 0217 可直接复用
  - renderer、scene truth、CRUD 验证面清晰
- 缺点：
  - 需要同时跨 Tier 1 和 Tier 2 做最小实现

### B. 仅在 `page_asset_v0` 里塞 raw `Html` / canvas，自行跑 Three.js

- 优点：
  - 最快看到画面
- 缺点：
  - 绕开 renderer contract
  - host lifecycle 与 business truth 边界不可审计
  - 0217 很可能需要重做

### C. 把每个 mesh / object 做成独立 ModelTable model

- 优点：
  - 表面上“模型化”程度更高
- 缺点：
  - 对 0216 来说过度设计
  - 极易混淆 scene entity 与 ModelTable model 的语义
  - CRUD、mount、selection、validation 成本都显著放大

当前推荐：A。

## Inputs

- Created at: `2026-03-23`
- Iteration ID: `0216-threejs-runtime-and-scene-crud`
- Planning mode: `refine`
- Upstream facts used:
  - `0215-ui-model-tier2-examples-v1` 已完成 canonical examples / workspace mount / handler validator 设计
  - `packages/ui-model-demo-frontend/package.json` 当前无 `three`
  - `packages/ui-renderer/src/component_registry_v1.json` 当前无 3D component
  - `packages/ui-model-demo-server/server.mjs` 已加载 `workspace_positive_models.json` 与 `intent_dispatch_config.json`
