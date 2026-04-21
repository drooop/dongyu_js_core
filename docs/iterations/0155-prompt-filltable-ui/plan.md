---
title: "0155 — Prompt 填表固定界面（多格多 Label）"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0155-prompt-filltable-ui
id: 0155-prompt-filltable-ui
phase: phase1
---

# 0155 — Prompt 填表固定界面（多格多 Label）

## 0. Metadata

- ID: `0155-prompt-filltable-ui`
- Date: 2026-02-24
- Branch: `dev_0155-prompt-filltable-ui`
- Depends on:
  - `0152-server-intent-dispatch`（dispatch 基础）
  - `0154-llm-cognition-ollama`（LLM fallback 与 lifecycle）
- Related:
  - `CLAUDE.md`（CAPABILITY_TIERS / HARD_RULES）
  - `docs/WORKFLOW.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`

## 1. Goal

提供一个“常规固定入口”的 Prompt 填表界面，使用户可用自然语言一次触发多条 ModelTable 操作（跨 cell、跨 label），并可预览后执行。

核心目标：
1. 支持“多格多 Label”批量操作。
2. 默认允许修改正数 `model_id`（`>0`）。
3. 严格限制操作语义为 `add_label` / `rm_label`（不允许旁路副作用）。

## 2. Scope

### 2.1 In Scope

1. 新增固定页面入口（Prompt FillTable 页面）。
2. 新增 Prompt 输入、结构化预览、Apply 执行流程。
3. LLM 输出统一为结构化 `records`（`mt.v0` 子集）。
4. 默认权限策略：仅允许正数模型改写。
5. 错误与审计：`ui_event_error`、`action_lifecycle`、结果摘要可见。
6. 路由执行通过 `intent_dispatch_table` + function labels，不新增 action-specific server 分支。

### 2.2 Out of Scope

1. `runtime.js/runtime.mjs` 改动。
2. 对负数系统模型的默认可写支持（仅后续迭代评估）。
3. 复杂 RBAC/多用户权限系统。
4. 自动执行外部动作（网络/命令执行等）。

## 3. Invariants / Constraints

1. ModelTable 仍是 SSOT；UI 仅投影。
2. 所有状态副作用仅通过 `add_label` / `rm_label`。
3. 不允许绕过 mailbox 协议直接写业务状态。
4. LLM 仅生成“受限 patch 意图”，最终执行由服务端策略校验。
5. 未通过策略校验的记录必须拒绝并写入错误信息（不可静默失败）。

## 4. Functional Contract (Draft)

### 4.1 用户流程

1. 用户在 Prompt 页面输入自然语言。
2. 点击 `Preview`：
   - 调用 LLM 生成候选 records。
   - 服务端做策略校验并返回 `accepted/rejected` 明细（不落库）。
   - 返回 `preview_id`（一次性令牌）与 `preview_digest`。
3. 用户点击 `Apply`：
   - 必须携带 `preview_id`，且与服务端最新 preview 一致。
   - 只执行 `accepted` 记录。
   - 回写执行结果、失败原因、操作计数。
4. 事件默认 `meta.local_only=true`，不得被 `forward_ui_events` 转发到 Matrix。

### 4.2 LLM 输出口径（受限）

```json
{
  "records": [
    { "op": "add_label", "model_id": 100, "p": 0, "r": 0, "c": 0, "k": "title", "t": "str", "v": "..." },
    { "op": "rm_label",  "model_id": 100, "p": 0, "r": 0, "c": 0, "k": "obsolete_key" }
  ],
  "reasoning": "...",
  "confidence": 0.88
}
```

### 4.3 默认策略

1. `model_id > 0`：允许（默认）。
2. `model_id <= 0`：拒绝（默认）。
3. 非 `add_label/rm_label`：拒绝。
4. 非法坐标或字段类型：拒绝。
5. `allowed_label_types` 白名单校验（默认仅 `str/int/float/bool/json/event`）。
6. `protected_label_keys` 黑名单校验（默认保护系统关键键）。
7. `max_value_bytes` / `max_total_bytes` / `max_records_per_apply` 限制。
8. 执行时仅应用校验通过记录。
9. `preview_id` 失配直接拒绝（`stale_preview`）。

## 5. Success Criteria

1. 页面提供固定入口并可输入 Prompt。
2. 单次 Prompt 可生成并预览多条跨 cell / label 记录。
3. `Apply` 后目标模型标签按预期更新。
4. 负数模型默认不可写，返回明确拒绝原因。
5. LLM 不可用时，流程可失败但系统不崩溃，错误可观测。
6. 过期或重放 `preview_id` 被拒绝（不会误执行旧预览）。
7. filltable 事件不会被转发到 Matrix。
8. 验证脚本可一键复跑并给出 PASS/FAIL。

## 6. Risks

1. LLM 幻觉生成非法 records。
   - 缓解：服务端严格 schema + policy 校验；默认拒绝。
2. 批量写入误操作影响范围大。
   - 缓解：Preview/Apply 二阶段；显示影响条数与目标模型。
3. 前端交互复杂导致误解。
   - 缓解：固定模板 + 示例 Prompt + 明确错误回显。
4. 本地填表动作被误转发到 Matrix。
   - 缓解：`meta.local_only=true` + forward 层显式 skip。
