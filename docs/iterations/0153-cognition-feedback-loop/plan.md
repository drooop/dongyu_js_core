---
id: 0153-cognition-feedback-loop
doc_type: iteration-plan
status: planned
source: ai
updated: 2026-04-21
title: "0153 — 认知环节显式化 + 动作状态反馈回路（Plan v2）"
iteration_id: 0153-cognition-feedback-loop
phase: phase1
---

# 0153 — 认知环节显式化 + 动作状态反馈回路（Plan v2）

## 0. Metadata
- ID: `0153-cognition-feedback-loop`
- Date: `2026-02-23`
- Owner: `AI (User Approved)`
- Branch: `dev_0153-cognition-feedback-loop`
- Depends on: `0152-server-intent-dispatch`（must be completed first）
- Related:
  - `__DY_PROTECTED_WL_0__` (`CLAUDE.md`)
  - `__DY_PROTECTED_WL_1__` (`docs/architecture_mantanet_and_workers.md`)
  - `__DY_PROTECTED_WL_2__` (`docs/ssot/runtime_semantics_modeltable_driven.md`)
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/worker-base/system-models/`

## 1. Goal
在 0152 的通用 intent dispatch 基础上，引入显式认知层与动作生命周期反馈层，实现可观测、可回放的“感知→认知→决策→行动→反馈”闭环，并保持现有 docs/static/ws/Model 100 行为等价。

## 2. Background
当前系统已具备 mailbox 感知与 intent dispatch 决策能力，但仍存在两个结构化缺口：

1. 认知状态缺口：
- handler 在执行时缺少统一场景上下文，只能临时读取多个 state label。
- 缺少历史意图与最近结果，无法形成连续决策语境。

2. 反馈状态缺口：
- action 执行状态分散在 ad-hoc label 中，缺少统一 lifecycle。
- 前端与调试工具无法稳定观察 `executing -> completed/failed` 状态机。

已确认约束事实：
- `Model -3` 已在 `server.mjs` 中用于 `login_form`（`LOGIN_MODEL_ID=-3`）。
- 因此 0153 认知模型必须使用新的负号模型号（本迭代固定为 `Model -12`）。

## 3. Invariants (Must Not Change)
- 不修改 `packages/worker-base/src/runtime.js` / `runtime.mjs`（Tier 1 不变）。
- 0152 的 `intent_dispatch_table` / `event_trigger_map` schema 保持兼容。
- 对外 HTTP/MQTT/Matrix 消息格式不变。
- 现有 docs/static/ws/Model 100 功能行为等价。
- 所有业务副作用继续通过 ModelTable `add_label` / `rm_label` 表达。

## 4. Scope
### 4.1 In Scope
1. 新增认知模型（`Model -12`）与 `scene_context` 契约。
2. 新增 `update_scene_context` function label，并接入 `event_trigger_map`。
3. 引入统一 `action_lifecycle`（`Model -1`, cell `0,0,1`）。
4. `submitEnvelope` 增强：dispatch 前写 `executing`，完成后写 `completed/failed`。
5. 反馈回路：将上一次 `action_lifecycle` 结果回灌到 `scene_context.last_action_result`。
6. 更新 SSOT/架构文档，补齐模型号与语义。

### 4.2 Out of Scope
- LLM 推理与 confidence 动态计算（0154 负责）。
- 前端新增 UI 组件（0153 仅提供 snapshot 可读能力）。
- K8s 部署拓扑、remote worker 逻辑改造。
- 新 label type 定义。

## 5. Non-goals
- 不追求 action 历史全量审计（`action_lifecycle` 仅保留最新态）。
- 不在本迭代引入并发队列语义（保持单槽、单飞风格）。
- 不在本迭代清理 0152 的 trigger fallback 机制。

## 6. Success Criteria (Definition of Done)
1. 启动后可在 snapshot 读取 `Model -12` 的 `scene_context`，且字段结构满足契约。
2. 每次 `POST /ui_event` 后，`scene_context.recent_intents` 正确追加并保持上限 20。
3. 每次 dispatch 均出现 `action_lifecycle.status: executing -> completed/failed` 跃迁。
4. 当 action 失败时，`action_lifecycle.status=failed` 且 `result.code/detail` 可读。
5. 下一次事件处理时，`scene_context.last_action_result` 可反映上一次 action 结果。
6. docs/static/ws/Model 100 回归通过，行为不退化。
7. 新增 `test_echo_0153` action 仅改 patch（dispatch entry + function）即可生效，不改 server 代码。
8. `__DY_PROTECTED_WL_3__`、`__DY_PROTECTED_WL_4__`、`CLAUDE.md` 完成同步更新并在 runlog 有证据。

## 7. Risks & Mitigations
- Risk: `action_lifecycle` 单槽可能覆盖上一条状态。
  - Impact: 无法在模型内回看完整历史。
  - Mitigation: 明确“最新态”语义；历史追溯依赖 runlog/eventLog。

- Risk: `scene_context.session_vars` 膨胀。
  - Impact: snapshot 体积增长。
  - Mitigation: 0153 仅允许白名单键，禁止自动扩展任意 key。

- Risk: `update_scene_context` 运行异常阻塞主流程。
  - Impact: ui_event 不可达 dispatch。
  - Mitigation: 函数内部 try/catch + 非阻断降级（失败时继续 forward）。

- Risk: 认知模型号与既有模型冲突。
  - Impact: 启动覆盖或行为异常。
  - Mitigation: 本迭代固定 `Model -12`，并在 `CLAUDE.md` MODEL_ID_REGISTRY 登记。

## 8. Open Questions
None.

## 9. Compliance Checklists
### 9.1 SSOT Alignment Checklist
- SSOT references:
  - `CLAUDE.md`
  - `docs/architecture_mantanet_and_workers.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/WORKFLOW.md`
- Notes:
  - 0153 只做 Tier 2（patch + server orchestration）增强，不改 runtime interpreter。
  - 模型号分配遵循 MODEL_ID_REGISTRY；新增模型号必须显式登记。

### 9.2 Charter Compliance Checklist
- Charter references:
  - `CLAUDE.md` HARD_RULES / FORBIDDEN / CAPABILITY_TIERS
- Notes:
  - Phase 3 执行前必须有 Review Gate Approved 记录。
  - 所有失败必须写入 ModelTable 可观测 label（`ui_event_error` + `action_lifecycle`）。
  - 本迭代不引入 side-effect bypass。
