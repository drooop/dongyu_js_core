---
title: "0188 — Qwen3.5 Local FillTable Upgrade Plan"
doc_type: iteration-plan
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0188-qwen35-local-filltable
id: 0188-qwen35-local-filltable
phase: phase1
---

# 0188 — Qwen3.5 Local FillTable Upgrade Plan

## Goal

- 让现有 `prompt filltable` 在新版 owner-chain 规约下优先接入本机已有的 `Qwen3.5 9B`，并补齐确定性测试与本地验证入口。

## Background

- 当前仓库的自然语言填表主链路已经在 `0171` 切到 `candidate_changes -> accepted_changes -> applied_changes` 的 owner-chain 公共合同。
- 当前代码路径仍是 Ollama provider + prompt-only 推理：`packages/ui-model-demo-server/server.mjs` 通过 `/api/generate` 向本地模型请求结果，默认模型配置仍偏向 `mt-table` / `mt-label`。
- `0170` 的实测 runbook 已证明本地 Ollama 链路可跑通，但也记录了 cold start / warm-up 超时现象；`0185`~`0187` 的最近迭代又进一步冻结了本地优先、submit authority、负数本地态与 legacy egress removal 边界。
- 现在需要在不破坏这些边界的前提下，把自然语言填表专门调优到新版规约，并把可替换的 Qwen3.5 本地模型选项整理出来。

## Invariants / Constraints

- 继续遵守 `CLAUDE.md`：先计划、后审核、再执行；未 `Approved` 不进入代码实现。
- `prompt filltable` 的正式外部合同仍然只能是 `candidate_changes` / `accepted_changes` / `applied_changes`；不得回退到 `records/op` 对外合同。
- ModelTable 仍是 committed truth；UI 只做 projection，UI 事件不得新增绕过 owner/materialization 的直写旁路。
- 只能通过 sanctioned owner-chain materialization 落表；不能让 LLM 直接拥有 `add_label` / `rm_label` authority。
- 默认优先沿用现有本地 Ollama provider，不无必要引入第二套 provider 协议面。
- 需要显式检查 conformance：tier placement、model placement、data ownership、data flow、data chain。

## Scope

### In Scope
- 审核并收敛 `server.mjs` 当前 filltable 推理路径，使其适配本机 `qwen3.5:9b` 的本地运行特性。
- 评估并实施最小必要改动：模型默认值、prompt/system prompt、结构化输出策略、availability probe、local run scripts、runbook。
- 增补或修订 deterministic tests，锁定新版规约与 Qwen3.5 本地流程的合同。
- 跑通至少一组本地 prompt filltable 验证，覆盖 preview/apply 主路径。
- 给出其他更强、但仍可本机运行的 Qwen3.5 备选模型清单与 tradeoff。

### Out of Scope
- 不改 runtime Tier 1 解释器语义，除非证明当前问题属于解释器 bug。
- 不引入 cloud-only provider 或托管 API 依赖。
- 不扩展跨 worker / 远端 owner routing。
- 不重做 Prompt FillTable UI 产品形态。

## Non-goals

- 不追求一次性支持所有 Qwen serving stack；本轮优先一个 canonical 本地路径。
- 不在本轮做通用多模型路由平台。
- 不把非 filltable 的 LLM intent/scene 路径一并重构。

## Success Criteria

- 本地 `Qwen3.5 9B` 能在现有 owner-chain 合同下完成 `prompt filltable` preview/apply 主链路。
- deterministic tests 能明确覆盖：结构化输出合同、Qwen 默认配置/脚本入口、owner-chain preview/apply 不变量。
- 本地验证命令有明确 PASS/FAIL 结果，并记录是否存在 warm-up 特性。
- 文档中明确写出 canonical 本地运行方式，以及优于 9B 的本机可跑 Qwen3.5 备选模型。

## Risks & Mitigations

- Risk:
  - `qwen3.5:9b` 对长 prompt 或自由 JSON 输出不稳定，导致 parse/timeout 波动。
  - Impact:
    - preview 失败率高，0155 验收不稳定。
  - Mitigation:
    - 优先采用结构化输出约束、低温度配置、缩短 prompt、保留 deterministic post-validation，并把 warm-up 行为纳入 runbook。
- Risk:
  - 当前代码对 provider 形状做了 Ollama-only 假设，若改动过大容易波及 `0154` intent 路径。
  - Impact:
    - 非 filltable LLM 功能回归。
  - Mitigation:
    - 优先保留 Ollama provider，仅调整 filltable 层与模型默认值；测试同时覆盖 0154/0155 关键合同。
- Risk:
  - 误把本地态、overlay 或 UI action 改回非法外发路径。
  - Impact:
    - 破坏 `0185`~`0187` 已冻结边界。
  - Mitigation:
    - 只修改 filltable 推理与配置面，不触碰 legacy egress 已删除路径；执行前后复核相关合同测试。

## Open Questions

- 是否仅通过 `Ollama + qwen3.5:9b` 完成第一阶段，还是同时为 `MLX` server 预留兼容入口。
- 是否将现有 `/api/generate` prompt-only 调用切到 Ollama structured output `format` 参数，还是先保留文本 prompt + 更强 post-validation。

## Compliance Checklists

### SSOT Alignment Checklist
- SSOT references:
  - `CLAUDE.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/tier_boundary_and_conformance_testing.md`
  - `docs/user-guide/prompt_filltable_owner_chain_and_deploy.md`
- Notes:
  - owner-chain 外部合同保持不变；任何真实落表仍需 owner-side materialization。

### Charter Compliance Checklist
- Charter references:
  - `docs/WORKFLOW.md`
  - `docs/ITERATIONS.md`
  - `docs/iterations/0170-local-mt-table-orbstack/runlog.md`
  - `docs/iterations/0171-prompt-filltable-owner-chain/plan.md`
  - `docs/iterations/0185-ui-local-first-negative-state/plan.md`
  - `docs/iterations/0186-ui-overlay-commit-policy/plan.md`
  - `docs/iterations/0187-remove-legacy-ui-egress-paths/plan.md`
- Notes:
  - 本轮执行必须保持本地优先、negative local state、Model 0 authority 与已删除 legacy egress 的现状不回退。
