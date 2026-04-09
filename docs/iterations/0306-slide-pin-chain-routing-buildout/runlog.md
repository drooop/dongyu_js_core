---
title: "0306 — slide-pin-chain-routing-buildout Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-04-09
source: ai
iteration_id: 0306-slide-pin-chain-routing-buildout
id: 0306-slide-pin-chain-routing-buildout
phase: phase4
---

# 0306 — slide-pin-chain-routing-buildout Runlog

## Environment

- Date: `2026-04-09`
- Branch: `dev_0306-slide-pin-chain-routing-buildout`
- Runtime: planning

## Planning Record

### Record 1

- Inputs reviewed:
  - [[docs/iterations/0304-slide-runtime-scope-semantics-freeze/runlog]]
  - [[docs/iterations/0306-slide-pin-chain-routing-buildout/plan]]
  - [[docs/plans/2026-04-09-slide-runtime-followup-it-breakdown]]
  - [[docs/ssot/runtime_semantics_modeltable_driven]]
- Locked conclusions:
  - `0306` 需要覆盖：
    - `Model 100 submit`
    - `slide_app_import/create`
    - `ws_app_add/delete/select`
  - mailbox 之后的 ingress 解释需要进入 Tier 1 runtime
  - built-in 验收对象固定为 `Model 100`，但负数系统动作也要一并遵守 pin-chain
  - 已迁移动作缺 route 时不再允许 direct fallback

## Review Gate Record

### Review 1 — AI-assisted

- Iteration ID: `0306-slide-pin-chain-routing-buildout`
- Review Date: `2026-04-09`
- Review Type: `AI-assisted`
- Review Index: `1`
- Decision: **Approved**
- Notes:
  - `pin.connect.model` 现有 Tier 1 实现已具备 built-in 验收基础，0306 风险低于最初估计。

### Review 2 — AI-assisted

- Iteration ID: `0306-slide-pin-chain-routing-buildout`
- Review Date: `2026-04-09`
- Review Type: `AI-assisted`
- Review Index: `2`
- Decision: **Approved**
- Notes:
  - 当前最合适的 built-in 验收对象仍是 `Model 100`，不需要提前放开导入 app 的 `func.js`。

### Review 3 — AI-assisted

- Iteration ID: `0306-slide-pin-chain-routing-buildout`
- Review Date: `2026-04-09`
- Review Type: `AI-assisted`
- Review Index: `3`
- Decision: **Approved**
- Notes:
  - `0306` 的职责边界清楚：runtime ingress + built-in / 系统动作 route buildout + 已迁移动作 no-fallback。

## Execution Start Record

### 2026-04-09

- Execution start:
  - `0306` 从 AI gate 进入执行
  - 当前处理两条验收线：
    - `Model 100 submit`
    - slide/workspace 系统动作 pin-chain
- done-criteria:
  - `submit` 与 `slide_app_import/create + ws_app_*` 都经 `Model 0` ingress
  - `-10` handler 通过 pin.in 被触发
  - 已迁移动作缺 route 时报 `route_missing`
  - `0289/0290/0302/0303/0305` 不回归
  - docs audit PASS

## Execution Record

### 2026-04-09 — Step 1 先补失败测试

**TDD**
- 先改并确认失败：
  - `node scripts/tests/test_0306_runtime_mailbox_ingress_contract.mjs` → FAIL
  - `node scripts/tests/test_0306_workspace_system_pin_chain_contract.mjs` → FAIL
  - `node scripts/tests/test_0306_workspace_system_pin_chain_server_flow.mjs` → FAIL
  - `node scripts/tests/test_0306_submit_fallback_server_flow.mjs` → FAIL

**Locked**
- runtime 必须能把 mailbox 事件导出到 `Model 0 pin.bus.in`
- `Model 100 submit` 与 slide/workspace 系统动作都必须有明确 ingress key / route / target pin
- 已迁移动作缺 route 时不再允许 direct fallback

### 2026-04-09 — Step 2 runtime ingress 与系统 pin buildout

**Implemented**
- runtime 新增 UI event ingress 派生：
  - `submit -> ui_event_submit_<model>_<p>_<r>_<c>`
  - `slide_app_import/create + ws_app_* -> ui_event_<action>`
- server 启动时自动补齐：
  - `Model 0 pin.connect.model` 路由
  - `-10` root 的 `pin.in` 入口
  - `pin.connect.label -> handle_*:in` wiring
- `submitEnvelope` 对已迁移动作改成：
  - 有 route：`routed_by = runtime_pin`
  - 缺 route：`route_missing`

**Files**
- `packages/worker-base/src/runtime.mjs`
- `packages/ui-model-demo-server/server.mjs`
- `packages/worker-base/system-models/workspace_positive_models.json`
- `packages/worker-base/system-models/test_model_100_ui.json`

### 2026-04-09 — Step 3 修 pin-chain 下的 host ctx 差异

**Observed in real execution**
- `ws_app_add` 首轮失败，错误为：
  - `direct_access_cross_model_forbidden`
- 原因：
  - pin-chain 触发到 `-10` handler 后，runtime ctx 仍按普通 scoped direct access 限制执行
  - `hostApi / getState / 跨负数模型写入` 没有和旧 server direct path 对齐

**Implemented**
- runtime pin-chain func ctx 补齐：
  - `ctx.hostApi`
  - `ctx.getState`
  - `ctx.getStateInt`
- 负数系统模型通过 pin-chain 执行时，恢复 host ctx 级别的 direct label access
- slide/workspace handler 改成：
  - 优先消费 `label.v`
  - mailbox 仅作兼容兜底
- 补齐标准化事件里的 `value` 保留，修复：
  - `ws_app_select`
  - `ws_app_delete`

**Files**
- `packages/worker-base/src/runtime.mjs`
- `packages/worker-base/system-models/intent_handlers_slide_import.json`
- `packages/worker-base/system-models/intent_handlers_slide_create.json`
- `packages/worker-base/system-models/intent_handlers_ws.json`
- `packages/ui-model-demo-server/server.mjs`

### 2026-04-09 — Step 4 Deterministic Verification

**Tests**
- `node scripts/tests/test_0306_runtime_mailbox_ingress_contract.mjs` → PASS
- `node scripts/tests/test_0306_model100_pin_chain_contract.mjs` → PASS
- `node scripts/tests/test_0306_workspace_system_pin_chain_contract.mjs` → PASS
- `node scripts/tests/test_0306_model100_pin_chain_server_flow.mjs` → PASS
- `node scripts/tests/test_0306_workspace_system_pin_chain_server_flow.mjs` → PASS
- `node scripts/tests/test_0306_submit_fallback_server_flow.mjs` → PASS
- `node scripts/tests/test_0305_submit_target_server_flow.mjs` → PASS
- `node scripts/tests/test_0290_slide_app_filltable_create_server_flow.mjs` → PASS
- `node scripts/tests/test_0302_slide_app_zip_import_server_flow.mjs` → PASS
- `node scripts/tests/test_0289_slide_workspace_generalization_server_flow.mjs` → PASS
- `node scripts/tests/test_0303_color_generator_proxy_import_server_flow.mjs` → PASS

### 2026-04-09 — Step 5 Local Deploy + Browser Facts

**Deploy**
- `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh` → PASS

**Browser facts**
- 本地 `/#/workspace` 里：
  - `E2E 颜色生成器` 仍可提交，结果状态会从 `loading` 进入 `processed`
  - `滑动 APP 创建` 可创建新 app，并能从侧边栏删除
  - `滑动 APP 导入` 可导入示例 zip，并能从侧边栏删除

### Review 4 — AI Self-Verification

- Iteration ID: `0306-slide-pin-chain-routing-buildout`
- Review Date: `2026-04-09`
- Review Type: `AI-assisted`
- Review Index: `4`
- Decision: **Approved**
- Notes:
  - `Model 100 submit` 与 slide/workspace 系统动作都已进入合法 pin-chain
  - 已迁移动作缺 route 时会直接报错
  - `0289/0290/0302/0303/0305` 回归通过

## Docs Updated

- [x] `docs/iterations/0306-slide-pin-chain-routing-buildout/resolution.md` updated
- [x] `docs/iterations/0306-slide-pin-chain-routing-buildout/runlog.md` updated
- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` updated
- [x] `docs/user-guide/modeltable_user_guide.md` updated
- [x] `docs/user-guide/slide_matrix_delivery_preview_v0.md` updated
- [x] `docs/plans/2026-04-09-slide-runtime-followup-it-breakdown.md` updated

## Deterministic Verification

- `node scripts/tests/test_0306_runtime_mailbox_ingress_contract.mjs`
- `node scripts/tests/test_0306_model100_pin_chain_contract.mjs`
- `node scripts/tests/test_0306_workspace_system_pin_chain_contract.mjs`
- `node scripts/tests/test_0306_model100_pin_chain_server_flow.mjs`
- `node scripts/tests/test_0306_workspace_system_pin_chain_server_flow.mjs`
- `node scripts/tests/test_0306_submit_fallback_server_flow.mjs`
- `node scripts/tests/test_0305_submit_target_server_flow.mjs`
- `node scripts/tests/test_0290_slide_app_filltable_create_server_flow.mjs`
- `node scripts/tests/test_0302_slide_app_zip_import_server_flow.mjs`
- `node scripts/tests/test_0289_slide_workspace_generalization_server_flow.mjs`
- `node scripts/tests/test_0303_color_generator_proxy_import_server_flow.mjs`
- `node scripts/ops/obsidian_docs_audit.mjs --root docs`
