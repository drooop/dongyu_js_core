---
title: "0216 — threejs-runtime-and-scene-crud Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0216-threejs-runtime-and-scene-crud
id: 0216-threejs-runtime-and-scene-crud
phase: phase1
---

# 0216 — threejs-runtime-and-scene-crud Resolution

## 0. Execution Rules

- Work branch: `dropx/dev_0216-threejs-runtime-and-scene-crud`
- Working directory for all commands: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Required local tools on PATH: `node`, `npm`, `bun`, `rg`
- Steps must be executed in order.
- Every Step must end with executable validation commands and explicit PASS/FAIL evidence in `runlog.md`.
- 0216 同时覆盖 Tier 1 与 Tier 2，但边界必须非常窄：
  - Tier 1 only:
    - `three` dependency wiring
    - `ThreeScene` primitive
    - frontend Three.js host lifecycle
  - Tier 2 only:
    - scene app assets
    - child scene truth labels
    - CRUD handler/config
    - local/server validators
- 默认禁止修改以下文件：
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/runtime.mjs`
  如果执行发现必须修改这些解释器文件，必须停止并升级为新的规划问题。
- 默认也不应修改以下文件：
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/ui-model-demo-frontend/src/route_ui_projection.js`
  - `packages/ui-model-demo-frontend/src/page_asset_resolver.js`
  如果执行发现 Three scene 必须依赖 route/server special-case 才能成立，说明 0216 偏离了 renderer/asset-first 目标，必须停止并重新审查合同。
- 0216 不规划新的负数系统模型。
  - 如果执行中确实需要新增负数 model id，必须先更新 `CLAUDE.md` `MODEL_ID_REGISTRY` 再继续。
- local path 允许：
  - renderer/scene render contract 验证
  - 对 0216 CRUD action 给出 deterministic `unsupported`
- local path 不允许：
  - 复制一份 authoritative scene CRUD 业务逻辑
  - 直写正数 scene truth labels
- Any real execution evidence belongs in `runlog.md`, not in this file.

## 1. Implementation Objective

0216 的实施顺序固定为：

1. 先冻结 `ThreeScene` primitive、dependency placement、model/action ID block 与 contract guard
2. 再把 renderer primitive 与 frontend host lifecycle 实装到 Tier 1
3. 然后在 `Workspace` authoritative patches 中 materialize scene app / child scene model / CRUD handler
4. 最后做回归、docs assessment、runlog/ledger 收口

禁止一上来先在页面里塞 raw canvas 或 server hardcode。0216 的目标不是先“看见 3D 效果”，而是先让 3D 能力进入可审计、可复用、可被 `0217` 接续的正式合同。

## 2. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1 | Freeze ThreeScene Contract, Dependency Placement, And ID Block | 固定 0216 的 primitive 名称、scene model block、action names、dependency 落点与 guard | `packages/ui-model-demo-frontend/package.json`, `packages/ui-model-demo-frontend/src/model_ids.js`, `scripts/tests/test_0216_threejs_scene_contract.mjs`, 可选 `bun.lock` | `rg -n "\"three\"|THREE_SCENE_|three_scene_" packages/ui-model-demo-frontend/package.json packages/ui-model-demo-frontend/src/model_ids.js scripts/tests/test_0216_threejs_scene_contract.mjs`; `node scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`; `node scripts/tests/test_0216_threejs_scene_contract.mjs` | ThreeScene / model ids / action names / dependency placement 有单一权威定义；0215 upstream guard 继续 PASS | 回退 manifest、model_ids、contract test 与 lockfile 变更 |
| 2 | Add ThreeScene Renderer Primitive And Frontend Host | 在 renderer 与 frontend 中落单一 3D primitive，明确 mount/update/dispose，不碰 runtime interpreter | `packages/ui-renderer/src/component_registry_v1.json`, `packages/ui-renderer/src/renderer.js`, `packages/ui-renderer/src/renderer.mjs`, `packages/ui-model-demo-frontend/src/components/ThreeSceneHost.js`, `packages/ui-model-demo-frontend/src/main.js`, `scripts/validate_ui_renderer_v0.mjs` | `node scripts/validate_ui_renderer_v0.mjs --case three_scene --env jsdom`; `node scripts/validate_ui_ast_v0x.mjs --case all`; `node scripts/tests/test_0216_threejs_scene_contract.mjs`; `npm -C packages/ui-model-demo-frontend run build`; `git diff --exit-code -- packages/worker-base/src/runtime.js packages/worker-base/src/runtime.mjs` | renderer 能识别 `ThreeScene`；frontend host lifecycle 明确；build PASS；runtime interpreter 保持未改动 | 回退 renderer、frontend host、registry 改动 |
| 3 | Materialize Workspace Three Scene App And Formal Scene CRUD | 在 authoritative patches 中加入 parent/child scene models、Workspace mount、scene CRUD handler，并加 local/server validators | `packages/worker-base/system-models/workspace_positive_models.json`, `packages/worker-base/system-models/workspace_catalog_ui.json`, `packages/worker-base/system-models/intent_dispatch_config.json`, `packages/worker-base/system-models/intent_handlers_three_scene.json`, `packages/ui-model-demo-frontend/src/local_bus_adapter.js`, `packages/ui-model-demo-frontend/scripts/validate_three_scene_local.mjs`, `packages/ui-model-demo-frontend/scripts/validate_three_scene_server_sse.mjs`, `scripts/tests/test_0216_threejs_scene_contract.mjs` | `node scripts/tests/test_0191d_test_workspace_asset_resolution.mjs`; `node scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`; `node scripts/tests/test_0216_threejs_scene_contract.mjs`; `node packages/ui-model-demo-frontend/scripts/validate_ui_model_examples_local.mjs`; `node packages/ui-model-demo-frontend/scripts/validate_three_scene_local.mjs`; `node packages/ui-model-demo-frontend/scripts/validate_three_scene_server_sse.mjs`; `npm -C packages/ui-model-demo-frontend run build`; `git diff --exit-code -- packages/worker-base/src/runtime.js packages/worker-base/src/runtime.mjs` | Workspace 可显示 Three scene app；child scene model 不直暴露；server-backed CRUD 改动 authoritative labels；local path 仍是 explicit unsupported | 回退 scene patches、dispatch/handler、local adapter、validators、contract test 改动 |
| 4 | Regression, Docs Assessment, And Ledger Closeout | 跑统一回归，确认 upstream examples/Workspace/render path 不回退，并收口 docs/runlog/index | `docs/iterations/0216-threejs-runtime-and-scene-crud/runlog.md`, `docs/ITERATIONS.md`, 必要时 `docs/user-guide/ui_components_v2.md`, `docs/user-guide/modeltable_user_guide.md` | `node scripts/validate_ui_renderer_v0.mjs --case all --env jsdom`; `node scripts/validate_ui_ast_v0x.mjs --case all`; `node scripts/tests/test_0191d_test_workspace_asset_resolution.mjs`; `node scripts/tests/test_0201_route_local_ast_contract.mjs`; `node scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`; `node scripts/tests/test_0216_threejs_scene_contract.mjs`; `node packages/ui-model-demo-frontend/scripts/validate_ui_model_examples_local.mjs`; `node packages/ui-model-demo-frontend/scripts/validate_ui_model_examples_server_sse.mjs`; `node packages/ui-model-demo-frontend/scripts/validate_three_scene_local.mjs`; `node packages/ui-model-demo-frontend/scripts/validate_three_scene_server_sse.mjs`; `npm -C packages/ui-model-demo-frontend run test`; `npm -C packages/ui-model-demo-frontend run build`; `rg -n "0216-threejs-runtime-and-scene-crud|ThreeScene|three_scene" docs/ITERATIONS.md docs/iterations/0216-threejs-runtime-and-scene-crud/runlog.md docs/user-guide/ui_components_v2.md docs/user-guide/modeltable_user_guide.md` | 全部 targeted validations PASS；docs assessment 有明确结论；runlog/index 与最终事实一致 | 回退 0216 代码与文档改动，恢复执行前状态 |

## 3. Step Details

### Step 1 — Freeze ThreeScene Contract, Dependency Placement, And ID Block

**Goal**

- 把 0216 的关键命名与边界先冻结成代码常量和 contract guard，避免后续在 renderer、scene assets、validators 之间各自发明不同术语。

**Scope**

- 在 frontend dependency manifest 中声明 `three`，并固定 dependency placement。
- 在 `model_ids.js` 中登记 0216 的正数模型与 action names。
  - 推荐：
    - `THREE_SCENE_APP_MODEL_ID = 1007`
    - `THREE_SCENE_CHILD_MODEL_ID = 1008`
    - `THREE_SCENE_CREATE_ACTION`
    - `THREE_SCENE_SELECT_ACTION`
    - `THREE_SCENE_UPDATE_ACTION`
    - `THREE_SCENE_DELETE_ACTION`
- 新增 `scripts/tests/test_0216_threejs_scene_contract.mjs`，至少断言：
  - `three` dependency 出现在权威 manifest 中
  - 0216 的 model ids / action names 只有一份来源
  - 0215 upstream examples 仍是 0216 的前置锚点，而不是被重定义
- 本 Step 只冻结 contract names / ids / dependency placement，不引入 ThreeScene 渲染实现。
- 如执行决定必须新增负数系统模型，本 Step 必须先更新 `CLAUDE.md` `MODEL_ID_REGISTRY`；否则默认不改 `CLAUDE.md`。

**Files**

- Create/Update:
  - `packages/ui-model-demo-frontend/package.json`
  - `packages/ui-model-demo-frontend/src/model_ids.js`
  - `scripts/tests/test_0216_threejs_scene_contract.mjs`
- Optional only if dependency installation rewrites lockfile:
  - `bun.lock`
- Conditional only if execution proves a new negative model is unavoidable:
  - `CLAUDE.md`

**Validation (Executable)**

- Commands:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "\"three\"|THREE_SCENE_|three_scene_" packages/ui-model-demo-frontend/package.json packages/ui-model-demo-frontend/src/model_ids.js scripts/tests/test_0216_threejs_scene_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0216_threejs_scene_contract.mjs`
- Expected signals:
  - `three` dependency 与 0216 names/id block 可被 `rg` 直接定位
  - 0215 upstream guard 继续 PASS
  - 0216 contract test 对 primitive、model ids、action names 有明确断言

**Acceptance Criteria**

- 0216 的 primitive 名称、scene model block、action names、dependency placement 已被写死到单一权威文件中。
- 后续 Step 不需要再讨论“primitive 叫什么”“scene model 用哪个 id block”“依赖装在哪里”。
- 若新增负数 model id，已在 `CLAUDE.md` 完成登记；若无新增，则 `CLAUDE.md` 保持不变。

**Rollback Strategy**

- 回退 manifest、`model_ids.js`、`test_0216_threejs_scene_contract.mjs` 与 lockfile 改动。
- 若本步曾临时登记新负数 model id，但 0216 最终不需要，则一并回退 `CLAUDE.md` 的对应条目。

---

### Step 2 — Add ThreeScene Renderer Primitive And Frontend Host

**Goal**

- 在不触碰 runtime interpreter 的前提下，把 `ThreeScene` 做成一个正式 renderer primitive，并给它配套 frontend host lifecycle。

**Scope**

- 在 `component_registry_v1.json` 中新增 `ThreeScene` 组件类型。
- 在 `renderer.js` / `renderer.mjs` 中为 `ThreeScene` 加入显式分发逻辑：
  - 支持从 snapshot / props 读取 scene refs
  - 将节点映射到注册过的 frontend host component
  - 保持 CJS / ESM 行为一致
- 新增 frontend host component，例如：
  - `packages/ui-model-demo-frontend/src/components/ThreeSceneHost.js`
  负责：
  - 初始化 Three.js scene / camera / renderer
  - 根据 props/snapshot 更新 scene objects
  - 在 unmount/dispose 时释放浏览器资源
- 在 `main.js` 中做 global registration，使 `resolveComponent(...)` 可找到该 host component。
- 扩充 `scripts/validate_ui_renderer_v0.mjs`：
  - 新增 `three_scene` case
  - 验证 `ThreeScene` primitive 的 renderer contract 与 host props shape
- 本 Step 不 materialize authoritative scene assets，也不做 CRUD handler。

**Files**

- Create/Update:
  - `packages/ui-renderer/src/component_registry_v1.json`
  - `packages/ui-renderer/src/renderer.js`
  - `packages/ui-renderer/src/renderer.mjs`
  - `packages/ui-model-demo-frontend/src/components/ThreeSceneHost.js`
  - `packages/ui-model-demo-frontend/src/main.js`
  - `scripts/validate_ui_renderer_v0.mjs`
- Must NOT touch:
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/runtime.mjs`

**Validation (Executable)**

- Commands:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/validate_ui_renderer_v0.mjs --case three_scene --env jsdom`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/validate_ui_ast_v0x.mjs --case all`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0216_threejs_scene_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && npm -C packages/ui-model-demo-frontend run build`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && git diff --exit-code -- packages/worker-base/src/runtime.js packages/worker-base/src/runtime.mjs`
- Expected signals:
  - `three_scene` renderer case PASS
  - UI AST validator 继续 PASS，说明新增 primitive 没破坏 AST loading 面
  - build PASS，说明 dependency 与 host registration 可用
  - runtime interpreter 文件保持未改动

**Acceptance Criteria**

- renderer 能正式识别 `ThreeScene`，不依赖 `Html`/raw canvas bypass。
- frontend host component 的 mount / update / dispose 责任明确且可复用。
- `ThreeScene` 不引入任何 runtime interpreter 语义扩张。

**Rollback Strategy**

- 回退 registry、renderer、frontend host component 与 `main.js` 改动。
- 删除 `validate_ui_renderer_v0.mjs` 中新增的 0216 case。

---

### Step 3 — Materialize Workspace Three Scene App And Formal Scene CRUD

**Goal**

- 把 0216 从“renderer 具备 3D primitive”推进到“Workspace 内可选、可渲染、可走正式 CRUD 链路的 Three scene app”。

**Scope**

- 在 `workspace_positive_models.json` 中加入 0216 scene models：
  - `scene app model`
    - `page_asset_v0`
    - page-level status text / summary labels
  - `scene child model`
    - `scene_graph_v0`
    - `camera_state_v0`
    - `selected_entity_id`
    - `scene_status`
    - `scene_audit_log`
- 在 `workspace_catalog_ui.json` 中只挂载 `scene app model`，不直接暴露 `scene child model`。
- 在 `scene app model` 中通过显式 `model.submt` 挂 child model。
- 在 `intent_dispatch_config.json` 中登记 0216 action -> handler mapping。
- 新增 `intent_handlers_three_scene.json`，至少覆盖：
  - create entity
  - select entity
  - update entity
  - delete entity
- 更新 `local_bus_adapter.js`：
  - 显式识别 0216 action names
  - local path 返回 deterministic `unsupported` / `three_scene_remote_only`
  - 不复制 scene CRUD 业务逻辑
- 新增 local/server validators：
  - `validate_three_scene_local.mjs`
    - 验证 Workspace 可见
    - `ThreeScene` 可渲染 seeded scene
    - local CRUD 不偷偷改真值
  - `validate_three_scene_server_sse.mjs`
    - 验证 server-backed CRUD action 真正修改 authoritative child labels
    - 验证 parent page asset/ThreeScene 继续可渲染
- 更新 `test_0216_threejs_scene_contract.mjs`，把 Step 3 的 mount/page_asset/dispatch assertions 写进去。

**Files**

- Create/Update:
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `packages/worker-base/system-models/workspace_catalog_ui.json`
  - `packages/worker-base/system-models/intent_dispatch_config.json`
  - `packages/worker-base/system-models/intent_handlers_three_scene.json`
  - `packages/ui-model-demo-frontend/src/local_bus_adapter.js`
  - `packages/ui-model-demo-frontend/scripts/validate_three_scene_local.mjs`
  - `packages/ui-model-demo-frontend/scripts/validate_three_scene_server_sse.mjs`
  - `scripts/tests/test_0216_threejs_scene_contract.mjs`
- Must NOT touch:
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/runtime.mjs`
- Prefer no changes:
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/ui-model-demo-frontend/src/route_ui_projection.js`
  - `packages/ui-model-demo-frontend/src/page_asset_resolver.js`

**Validation (Executable)**

- Commands:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0191d_test_workspace_asset_resolution.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0216_threejs_scene_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_ui_model_examples_local.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_three_scene_local.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_three_scene_server_sse.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && npm -C packages/ui-model-demo-frontend run build`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && git diff --exit-code -- packages/worker-base/src/runtime.js packages/worker-base/src/runtime.mjs`
- Expected signals:
  - Workspace asset resolution 继续 PASS
  - 0215 canonical examples 不回退
  - 0216 contract test 能断言 parent-mounted child、page asset、dispatch mapping、local unsupported detail
  - local validator 能渲染 scene 且不改真值
  - server-backed validator 能完成 authoritative CRUD 变更
  - runtime interpreter 文件继续未改动

**Acceptance Criteria**

- `Workspace` 中能选择一个正式的 Three scene app。
- child scene model 不被直接暴露在 `Workspace` registry 中。
- authoritative scene truth 只存在于正数 child model labels 中。
- server-backed CRUD action 真正回写 `scene_graph_v0` / `selected_entity_id` / `scene_status` 等 labels。
- local path 仍然是 explicit unsupported，而不是 duplicated business logic。

**Rollback Strategy**

- 回退 scene app / child model patches、Workspace mount、dispatch config、handler patch、local adapter、validators 与 0216 contract test 改动。
- 删除所有中途产生但未完整接通的 scene model / action definitions。

---

### Step 4 — Regression, Docs Assessment, And Ledger Closeout

**Goal**

- 在 0216 功能完成后，确认 renderer、Workspace、upstream examples、docs/ledger 四个面同时收口，不留“3D demo 能跑但合同未落盘”的尾巴。

**Scope**

- 运行 renderer、workspace、0215 upstream examples、0216 local/server validators 的组合回归。
- 评估是否需要更新 public docs：
  - `docs/user-guide/ui_components_v2.md`
    - 如果 `ThreeScene` 成为正式组件，应更新
  - `docs/user-guide/modeltable_user_guide.md`
    - 如果 0216 改变了 Workspace / parent-mounted scene 使用口径，应更新
- 在 `runlog.md` 记录：
  - 命令
  - 关键输出
  - commit hash
  - PASS/FAIL
- 在 `docs/ITERATIONS.md` 更新状态与 branch/commit facts。

**Files**

- Create/Update:
  - `docs/iterations/0216-threejs-runtime-and-scene-crud/runlog.md`
  - `docs/ITERATIONS.md`
  - As needed:
    - `docs/user-guide/ui_components_v2.md`
    - `docs/user-guide/modeltable_user_guide.md`
- Must NOT touch:
  - `docs/iterations/0216-threejs-runtime-and-scene-crud/plan.md`
  - `docs/iterations/0216-threejs-runtime-and-scene-crud/resolution.md`
    除非 review gate 明确要求修订

**Validation (Executable)**

- Commands:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/validate_ui_renderer_v0.mjs --case all --env jsdom`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/validate_ui_ast_v0x.mjs --case all`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0191d_test_workspace_asset_resolution.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0201_route_local_ast_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0216_threejs_scene_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_ui_model_examples_local.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_ui_model_examples_server_sse.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_three_scene_local.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_three_scene_server_sse.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && npm -C packages/ui-model-demo-frontend run test`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && npm -C packages/ui-model-demo-frontend run build`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "0216-threejs-runtime-and-scene-crud|ThreeScene|three_scene" docs/ITERATIONS.md docs/iterations/0216-threejs-runtime-and-scene-crud/runlog.md docs/user-guide/ui_components_v2.md docs/user-guide/modeltable_user_guide.md`
- Expected signals:
  - renderer/AST validations 全部 PASS
  - Workspace 与 route local contract 继续 PASS
  - 0215/0216 validators 全部 PASS
  - docs assessment 有明确结论
  - runlog 与 index 的状态/branch/commit facts 一致

**Acceptance Criteria**

- 0216 的 renderer primitive、scene app、server-backed CRUD、upstream examples guards 全部有 PASS 证据。
- `ThreeScene` 是否进入 public docs 有明确裁决，而不是停留在聊天上下文。
- 0217 可以把 0216 当成稳定前提继续做 Gallery 集成。

**Rollback Strategy**

- 回退 0216 代码、tests、validators、docs 与 ledger 改动。
- 在 `runlog.md` 明确记录 rollback 原因、范围与保留资产。

## 4. Conformance Checklist

- Tier placement:
  - Tier 1 仅限 renderer primitive + frontend host lifecycle + dependency wiring。
  - Tier 2 仅限 scene truth labels + Workspace mount + CRUD handler + validators。
- Model placement:
  - 正数 `scene app model` / `scene child model` 持有业务真值与页面资产。
  - `Model -2` 只持有 UI-only selection/state。
  - `Model -10` 只持有 dispatch/handler。
- Data ownership:
  - `scene_graph_v0` / `camera_state_v0` / `selected_entity_id` / `scene_status` 归正数 child model。
  - 浏览器中的 Three.js scene/camera/mesh instances 只是 host cache。
- Data flow:
  - `ThreeScene` 只读 snapshot；CRUD 必须经过 `ui_event -> intent_dispatch_table -> handler patch`。
  - local path 不能直接改正数 business labels。
- Data chain:
  - `Workspace mount -> page_asset_v0 -> ThreeScene -> ui_event -> handler -> child labels -> renderer refresh`
  - 任一环节若被 route/server special-case 替代，即判定为 non-conformant。
