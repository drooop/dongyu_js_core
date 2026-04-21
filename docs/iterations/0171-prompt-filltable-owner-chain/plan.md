---
title: "Iteration 0171-prompt-filltable-owner-chain Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0171-prompt-filltable-owner-chain
id: 0171-prompt-filltable-owner-chain
phase: phase1
---

# Iteration 0171-prompt-filltable-owner-chain Plan

## Goal

- 将 `prompt filltable` 从 `records/op` compatibility bridge 正式切到 owner-chain：LLM 只产出 `proposal + candidate_changes`，preview/apply 的公共合同改为 `accepted_changes / rejected_changes / applied_changes`，最终写表由 owner 端 materialize 后执行。

## Scope

- In scope:
  - `llmFilltablePreview/Apply` 改为 change-based contract。
  - 新增本地 owner resolver / preview / materialization。
  - `filltable_policy` 改为校验 `candidate_changes`。
  - `intent_handlers_prompt_filltable.json`、`llm_cognition_config.json`、UI 文案、验收脚本与 runbook 同步更新。
  - 本地 Orbstack + Ollama `mt-table` 的真实 preview/apply 浏览器验证。
- Out of scope:
  - 其它非 filltable 的 AI 改表入口。
  - 跨 worker / 远端 owner routing。
  - 继续保留 `accepted_records/applied_records` 作为公共 payload。

## Invariants / Constraints

- 运行时内部最终执行原语仍然是 `add_label/rm_label`，但它们必须退回为 owner 内部 materialization 细节，不再是面向 LLM 的公共合同。
- 本期只支持本地 `modeltable_local_owner`，适用范围仅正数 `model_id`。
- 预览与应用继续保留 `preview_id / preview_digest / replay guard` 机制。
- 新版 contract 必须明确拒绝负数系统模型、`model_id=0`、protected key、未授权结构性类型和未知目标模型。
- 先写失败测试，再改实现，再做本地 Orbstack/browser 验证。

## Success Criteria

- preview payload 不再包含 `accepted_records/applied_records`，而是 `accepted_changes/rejected_changes`。
- apply 只消费 preview 中的 `accepted_changes`，并由 owner materialize 后执行。
- 旧的 records-only preview payload 在 apply 阶段被显式拒绝（`legacy_preview_contract`）。
- `verify_0155_prompt_filltable.sh` 与浏览器 `/#/prompt` 闭环按新字段口径通过。
- runbook / user guide / 共享知识库已更新为 owner-chain 正式口径。

## Inputs

- Created at: 2026-03-06
- Iteration ID: 0171-prompt-filltable-owner-chain
