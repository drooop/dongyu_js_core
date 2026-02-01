---
name: patch-driven-model-extension
description: Add new application-level capabilities by extending the worker-base initialization ModelTable patch (system negative models) and keeping runtime changes minimal, flagged, and script-verified.
---

# Patch-Driven Model Extension

本 skill 用于固化一种“填表即功能”的工程模式：
- 基座（runtime）只提供最小解释器能力与稳定不变量。
- 新能力尽可能通过“启动时导入的基座基础模型 patch（system negative models）”实现。
- 用户模型（model_id > 0）只写意图（intent），不得直接写特权 label。
- 任何副作用都必须可脚本化验证（不要依赖 UI 点击）。

## When To Use
- 你要新增/扩展 MGMT 或 PIN 的“应用层功能”，并希望后续可以通过 ModelTable 编辑/patch 直接复用。
- 你要新增一个“intent → system function → bus side effects”的能力闭环。

## Scope
- Repository: `dongyuapp_elysia_based`
- Base patch: `packages/worker-base/system-models/system_models.json`
- Runtime invariants: `AGENTS.md` + `docs/architecture_mantanet_and_workers.md` + `docs/ssot/runtime_semantics_modeltable_driven.md`

## Hard Rules (Non-negotiable)
- UI/用户模型只写格子；不得直连总线。
- Side effects 只能经 `add_label/rm_label` 间接触发。
- `MGMT_OUT/MGMT_IN` 只能出现在 system negative models（model_id < 0）。
- PIN 的 topic/payload 规则必须版本化，并有脚本验收。
- 任何新能力必须先加 `scripts/validate_*.mjs` 再宣称完成。

## Recommended Pattern

### 1) Prefer Patch Over Runtime Changes
优先做：
- 在 `packages/worker-base/system-models/system_models.json` 中添加/修改 system function（`t="function"`）。
- 让 system function 通过 ctx API 写入 ModelTable（`ctx.writeLabel/rmLabel/getLabel`），驱动副作用。

只有当“解释器缺能力”才改 runtime：
- 例如：multi-model topic 解析/路由属于解释器能力。
- 必须：保持默认行为不变 + 用 flag 打开 + 添加回归脚本。

### 2) Intent → Job Queue → System Dispatch
推荐入口：用户模型写 `intent.v0`（`t=json`），宿主识别后 enqueue 为 system job（如 `intent_job_<id>`），触发 `run_intent_dispatch`。

约束：
- 用户模型不得直接写 `run_*`、`PIN_*`、`MGMT_*`。
- system function 必须做 allowlist 校验与幂等（以 `op_id` 去重）。

### 3) Observability-First
必须能从以下证据判定 PASS/FAIL：
- `eventLog`（add_label/rm_label 记录）
- `intercepts`（run_func 等）
- `mqttTrace`（connect/subscribe/publish/inbound）

## File Anchors (Where Things Live)
- Base patch entry: `packages/worker-base/system-models/system_models.json`
- Demo host wiring (intent enqueue + run_* execution): `packages/ui-model-demo-server/server.mjs`
- PIN runtime semantics: `packages/worker-base/src/runtime.js`
- PIN validation protocol: `docs/iterations/0123-pin-mqtt-loop/validation_protocol.md`

## Verification Checklist (Commands)
- PIN regressions:
  - `node scripts/validate_pin_mqtt_loop.mjs --case all`
- Multi-model topic mode (if used):
  - `node scripts/validate_pin_mqtt_loop.mjs --case mm_uiput_in_out`
- Intent → PIN:
  - `node scripts/validate_intent_dispatch_pin_v0.mjs --case pin_register_send`
- Intent → MGMT:
  - `node scripts/validate_intent_dispatch_mgmt_v0.mjs`

## Deliverables (What to Produce)
- Patch change(s): `packages/worker-base/system-models/system_models.json`
- One new validation script per new capability: `scripts/validate_*.mjs`
- One manual doc explaining “填表步骤 + 每个 label 的意义”: prefer iteration-local docs under `docs/iterations/<id>/`
