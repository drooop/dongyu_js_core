---
title: "0239 — local-home-selector-model0-fix Plan"
doc_type: iteration-plan
status: planned
updated: 2026-03-26
source: ai
iteration_id: 0239-local-home-selector-model0-fix
id: 0239-local-home-selector-model0-fix
phase: phase1
---

# 0239 — local-home-selector-model0-fix Plan

## Metadata

- ID: `0239-local-home-selector-model0-fix`
- Date: `2026-03-26`
- Owner: AI-assisted planning
- Branch (registered in `docs/ITERATIONS.md`): `dropx/dev_0239-local-home-selector-model0-fix`
- Planning mode: `refine`
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Depends on:
  - `0237-local-browser-surface-regressions-fix`
- Parallel context:
  - `0238-local-matrix-debug-materialization-regression-fix` 负责 Matrix Debug authoritative materialization，不覆盖本问题
- Downstream:
  - `0240-local-browser-evidence-rerun-after-0238-0239`

## WHAT

本 iteration 只修首页 `Model` 选择器在 local 环境中的 `model0` 呈现与选中链路，不扩成其他 surface、route 或 deploy 工作。

目标问题只有三类，而且必须一起关闭：

- `editor_model_options_json` 当前没有 `value == 0`，导致 Home `Select` 根本拿不到 `model0` 的正式 option。
- `selected_model_id` 在 `ui_page = home` 时没有 canonical home baseline，会继承此前 Workspace 或 DataTable 交互留下的 stray 值。
- browser 侧 `Select` 当前值无法稳定匹配 `model0`，表现为 raw stray value、错误选中态，或无法正式把 `model0` 呈现为当前值。

交付完成后，首页 `Model` selector 必须重新表达一条清晰合同：

- Home page 的 canonical baseline target 是 `model0`
- `model0` 在 option inventory 中可见、可选、可匹配
- 当页面回到 `home` 时，`selected_model_id` 必须回到与 Home baseline 一致的值，而不是漂移到 `-2`、`1007` 或其他历史值

## WHY

`0237` Step 1 已经把这个问题和 Matrix Debug regression 分开了，且当前证据足够说明它是一条单独的 home-selector state/projection 问题：

- `0237` runlog 已冻结 live local 红灯事实：
  - `ui_page = "home"`
  - `selected_model_id` 漂移到错误值
  - `editor_model_options_json` 不包含 `value == 0`
- 当前代码库已经能直接解释其中一部分根因：
  - `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js` 的 `deriveEditorModelOptions()` 仍然过滤 `m.id !== 0`
- 当前 server 端只对 `workspace` 路由做 `selected_model_id` 同步，没有对应的 `home` canonical reset/reconcile
- 当前 local demo store 仍以 `selected_model_id = '1'` 作为首页初始值，与 server 端 `0` 基线不一致，破坏 local/server parity
- `0240` 需要在 `0238 + 0239` 都完成后再做 browser evidence rerun，因此 0239 必须先把 Home selector 的 authoritative input surface 拉回 deterministic green

换句话说，0239 的价值不是“修一个下拉框样式”，而是重新建立 Home selector 的 source-of-truth 合同，确保 browser 看到的 current value 来自正确的状态链，而不是历史漂移或类型错配。

## Current Problem Statement

当前代码事实已经把问题收敛到三段链路：

- Home page asset contract：
  - `packages/worker-base/system-models/home_catalog_ui.json` 中的 `sel_home_target_model`
  - `options` 绑定 `editor_model_options_json`
  - `read/write` 绑定 `selected_model_id`
- Selector inventory derivation：
  - `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
  - 当前 `deriveEditorModelOptions()` 明确去掉 `model0`
- Home selection normalization：
  - `packages/ui-model-demo-server/server.mjs` 只有 `reconcileWorkspaceSelectionState()`
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js` 没有与 server 对齐的 home canonical reconciliation，且首页初始值仍是 `1`

此外还存在一个必须显式验证、但不应先入为主扩大范围的消费边界风险：

- `selected_model_id` 在不同路径下会以 `str` 和 `int` 两种形式出现
- `Select` option 的 `value` 来自 integer inventory
- `packages/ui-renderer/src/renderer.mjs` / `renderer.js` 当前直接把绑定值透传给 `ElSelect`

因此执行期必须先判断：只要 source state 回到 canonical `0`，browser current value 是否已经恢复；如果没有，再允许最小化触达 renderer 做 string/int 等价匹配。

## Scope

### In Scope

- 修复 Home selector option inventory，让 `editor_model_options_json` 可正式表达 `model0`
- 为 `ui_page = home` 定义并恢复 `selected_model_id = 0` 的 canonical baseline
- 对齐 local demo store 与 server store 的首页 baseline，避免同一 selector 在 local/server 两套实现里口径不同
- 增加 focused regression guard，覆盖：
  - `model0` option inventory
  - home current-value canonicalization
  - current value 与 option inventory 的可匹配性
- 在不做完整 browser rerun 的前提下，用 deterministic local/live spot-check 为 `0240` 放行

### Out Of Scope

- Matrix Debug materialization 或 renderer fallback
- `0240` 的完整 browser evidence rerun
- remote rollout、remote browser、remote verification
- `packages/worker-base/src/runtime.js` 与 `packages/worker-base/src/runtime.mjs` 的 Tier 1 解释器语义改动
- 通过手工篡改 live snapshot、手工写数据库、手工改 persisted asset root 来伪造 `model0` 通过
- 把 Home selector 简化成“只显示 `model0`、隐藏其他模型”来规避当前漂移问题

## Impact Surface

### Read-only Investigation Surface

- `docs/iterations/0237-local-browser-surface-regressions-fix/runlog.md`
- `packages/worker-base/system-models/home_catalog_ui.json`
- `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
- `packages/ui-model-demo-server/server.mjs`
- `packages/ui-model-demo-frontend/src/demo_modeltable.js`
- `packages/ui-renderer/src/renderer.mjs`
- `packages/ui-renderer/src/renderer.js`
- `scripts/tests/test_0212_home_crud_contract.mjs`
- `scripts/tests/test_0182_workspace_route_init_contract.mjs`
- `packages/ui-model-demo-frontend/scripts/validate_editor.mjs`

### Expected Minimal Write Surface

- `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
- `packages/ui-model-demo-server/server.mjs`
- `packages/ui-model-demo-frontend/src/demo_modeltable.js`
- `scripts/tests/test_0239_home_selector_model0_contract.mjs`
- `packages/ui-model-demo-frontend/scripts/validate_home_selector_server_sse.mjs`

### Conditional Write Surface

只有当执行期证明“source state 已恢复 canonical green，但 browser current value 仍因消费层 string/int 错配而失败”时，才允许扩到：

- `packages/ui-renderer/src/renderer.mjs`
- `packages/ui-renderer/src/renderer.js`

只有当执行期证明 Home selector 修复后，remote client 的 generic fallback 仍会把 home baseline 拉回 `1` 时，才允许进一步评估：

- `packages/ui-model-demo-frontend/src/remote_store.js`

若执行期需要写入上述 conditional surface，必须先在 `runlog.md` 明确写出为什么最小写入面已不足以解释 failure。

## Success Criteria

- `editor_model_options_json` 包含一个正式的 `model0` option：
  - `label` 可读
  - `value == 0`
- `ui_page = home` 时，`selected_model_id` 回到 canonical home baseline：
  - `0` 或 `"0"` 仅允许作为同值表示
  - 不允许继续漂移为 `-2`、`1007` 或其他历史值
- local demo store 与 server state 的首页初始 baseline 对齐为 `0`
- focused guards 能稳定覆盖：
  - option inventory 有 `model0`
  - home current value 归一到 `0`
  - current value 可以被 selector option 正式匹配，而不是呈现 raw stray value
- 现有回归保护仍保持绿色：
  - `test_0212_home_crud_contract`
  - `test_0182_workspace_route_init_contract`
  - `validate_editor`
- 如果 renderer 被触达，`.mjs` 与 `.js` 必须保持行为对齐

## Constraints And Invariants

- 严格遵循 `CLAUDE.md` 的 `HARD_RULES`、`WORKFLOW`、`CHANGE_OUTPUT`
- 当前阶段是 Phase 1，只生成 `plan.md` 与 `resolution.md`
- 0239 只修 Home selector 的 state/projection/consumption 链路，不扩成 broader editor rewrite
- 不允许通过隐藏错误、fallback 文案、或静态硬编码 current value 来伪造通过
- 不允许为了呈现 `model0` 而破坏 Home 既有的 inspect/select 能力
- `selected_model_id` 的修复必须与 `ui_page` 绑定，而不是把所有页面都强制重置为 `0`
- 验证必须是 deterministic PASS/FAIL；“浏览器看起来差不多”不算完成

## Risks And Mitigations

- Risk:
  - `model0` option 修好后，browser current value 仍可能因 string/int mismatch 继续不显示正式选中态。
  - Mitigation:
    - 先修 source state，再用 focused guard 判断是否必须最小化触达 renderer；若触达 renderer，强制 `.mjs` / `.js` 成对修改与验证。

- Risk:
  - 只修 server，不修 local demo store，会让 local validators 与 server/live 行为继续分叉。
  - Mitigation:
    - 把 `demo_modeltable.js` 明确纳入最小写入面，要求 local/server baseline 同步到 `0`。

- Risk:
  - 错误地把 `selected_model_id` 全局都重置为 `0`，破坏 Workspace 既有同步合同。
  - Mitigation:
    - 保留 `workspace` 现有合同，用 `test_0182_workspace_route_init_contract.mjs` 做非回归守卫，并把 home normalization 明确限定在 `ui_page = home`。

- Risk:
  - 0239 只在 isolated state 上变绿，但 live local endpoint 仍保留旧状态，导致 `0240` 复测不稳定。
  - Mitigation:
    - resolution 中要求使用 deterministic live `ui_event + /snapshot` spot-check，而不是把 live 验证完全留给后续人工操作。

## Alternatives

### A. 推荐：先修 source state / home reconciliation，renderer 只做条件扩展

- 优点：
  - 直接命中当前已知根因
  - 更符合 `UI is projection of ModelTable`
  - 能同时修复 server、local demo、live snapshot 三处口径
- 缺点：
  - 如果 Element Plus 当前值匹配存在严格类型问题，仍可能需要第二步 renderer 补齐

### B. 只在 renderer 对 `Select` 做 string/int 容错

- 优点：
  - 表面上最快让 browser current value 看起来正常
- 缺点：
  - 不能解释 `editor_model_options_json` 为何缺少 `model0`
  - 也不能解释 `ui_page = home` 时为什么仍漂移到 workspace/datatable 历史值
  - 会把 state contract 问题伪装成纯消费层问题

### C. 只在 server 启动时硬编码 `selected_model_id = 0`

- 优点：
  - 改动表面最小
- 缺点：
  - 不能覆盖 route change 之后的再次漂移
  - local demo store 仍会保留 `1`
  - focused browser/live 验证仍可能不稳定

当前推荐：A。

## Assumptions And Validation Methods

- Assumption A:
  - `0237` runlog 中记录的 Home selector 问题仍然是本 iteration 的权威输入事实。
  - Validation:
    - 以 `docs/iterations/0237-local-browser-surface-regressions-fix/runlog.md` 为准。

- Assumption B:
  - Home selector 的 authoritative binding 仍是 `home_catalog_ui.json -> editor_model_options_json / selected_model_id`。
  - Validation:
    - 以 `packages/worker-base/system-models/home_catalog_ui.json` 为准。

- Assumption C:
  - 当前 home normalization 缺口主要在 server/local state chain，而不是 runtime semantics。
  - Validation:
    - 以 `packages/ui-model-demo-server/server.mjs`、`packages/ui-model-demo-frontend/src/demo_modeltable.js`、`packages/ui-model-demo-frontend/src/editor_page_state_derivers.js` 的当前实现为准。

- Assumption D:
  - live local authoritative endpoint 仍是 `http://127.0.0.1:30900`，并支持 `/ui_event` 与 `/snapshot`。
  - Validation:
    - 以 `packages/ui-model-demo-server/server.mjs` 的 HTTP route 定义为准。

> 本文件只定义 WHAT / WHY / 范围 / 风险 / 成功标准 / 影响面，不记录 Step 编号、执行结果、命令输出或 commit。
