---
title: "0231 — final-verification-manual-accept-consistency Plan"
doc_type: iteration-plan
status: planned
updated: 2026-03-25
source: ai
iteration_id: 0231-final-verification-manual-accept-consistency
id: 0231-final-verification-manual-accept-consistency
phase: phase1
---

# 0231 — final-verification-manual-accept-consistency Plan

## WHAT

本 iteration 要把 orchestrator 的“人工接受 Final Verification”从一次临时手工改文件，收口为一条正式、可审计、可恢复、可回归验证的 terminal-state contract。

目标包括：

- 为 batch-level `Final Verification` 增加正式 operator 入口，替代直接手改 `.orchestrator/runs/<batch_id>/state.json`。
- 让人工接受后的 terminal pipeline 一次性完成以下动作：
  - 追加结构化 override evidence 到 `events.jsonl`
  - 提交新的 `state.json`
  - 重新计算并持久化 `batch_summary`
  - 刷新 `status.txt`
- 明确 `state.json.batch_summary` 仍是 authoritative terminal summary，所有终态消费者都必须与该口径一致，不能继续各自读自己的字段并得出不同结论。
- 为真实 false-negative 样本和后续回归测试冻结一个 deterministic 合同，避免下次再次依赖“人工记得顺手改多个文件”。

这次收口面限定在 orchestrator tooling 与其文档，不涉及 runtime Tier 1、ModelTable Tier 2、frontend、server、deploy 或任何产品业务逻辑。

## WHY

基于 2026-03-25 仓库内的真实事实，当前问题已经不是抽象风险，而是已发生的状态漂移：

- `.orchestrator/runs/7ff3735e-abf6-4cab-b024-8d474e66673b/state.json`
  - 顶层 `final_verification = passed`
  - 但 `batch_summary.final_verification = failed`
  - 且 `batch_summary.terminal_outcome = failed`
- `.orchestrator/runs/7ff3735e-abf6-4cab-b024-8d474e66673b/status.txt`
  - 仍显示 `Batch Outcome: failed`
  - 同时显示 `Final Verification: failed`
- `.orchestrator/runs/7ff3735e-abf6-4cab-b024-8d474e66673b/events.jsonl`
  - 尾部仍以 parse failure 和 `Batch complete` failed event 作为最后的终态证据
  - 没有任何“人工接受后覆盖终态”的结构化说明

同类漂移还存在于 `.orchestrator/runs/6d22aa18-43a7-4cd6-8e9c-823e2e6b23bb/`，说明这不是单一 batch 的偶发问题，而是当前 manual-accept 缺乏正式入口时的系统性缺口。

代码层面还存在两个直接原因：

- `scripts/orchestrator/orchestrator.mjs` 当前 CLI 只有 `--prompt`、`--prompt-file`、`--iteration`、`--resume`、`--monitor`，没有专用的 final verification accept 命令。
- `runMainLoop()` 在“所有 iteration 都已完成”时会再次进入 `Final Verification`；因此 `--resume` 不是“人工接受当前终态”的安全入口。

此外，`docs/ssot/orchestrator_hard_rules.md` §2.2.1 已把 `batch_summary` 定义为 authoritative terminal summary，但 `scripts/orchestrator/wave_launcher_lib.mjs` 当前仍优先读取 `state.final_verification` 来决定继续/停止。这意味着实现和 SSOT 在 terminal consumer 上还没有完全对齐。

## 当前事实与影响范围

本 iteration 的直接影响面应限定在以下文件和职责：

- `scripts/orchestrator/orchestrator.mjs`
  - 暴露正式 manual-accept CLI 入口
  - 禁止用 `--resume` 充当 final verification accept 的替代路径
  - 串起 override event、state commit、status refresh 的 terminal pipeline
- `scripts/orchestrator/state.mjs`
  - 提供 batch-level manual accept 的 authoritative state helper
  - 确保 `final_verification` 与 `batch_summary` 一次性同步
- `scripts/orchestrator/events.mjs`
  - 追加结构化 override evidence
  - 保持 append-only 审计链，不改写历史 failed event
- `scripts/orchestrator/wave_launcher_lib.mjs`
  - 让 wave 级终态消费遵守 `batch_summary` authority
  - 遇到 top-level 与 summary 漂移时，必须停止或报不一致，而不是继续当作 passed
- `scripts/orchestrator/test_orchestrator.mjs`
  - 增补 false-negative + manual accept + terminal consumer alignment 的 deterministic regression
- `docs/ssot/orchestrator_hard_rules.md`
  - 明确 manual accept contract、事件保留规则、`--resume` 边界和 terminal consumer 口径
- `docs/user-guide/orchestrator_local_smoke.md`
  - 为无上下文 operator 写清“何时可 accept、如何 accept、accept 后如何验证、何时禁止手改 state”

本 iteration 会把以下现有 batch 作为本地验证样本：

- `7ff3735e-abf6-4cab-b024-8d474e66673b`
- `6d22aa18-43a7-4cd6-8e9c-823e2e6b23bb`

明确不在影响范围内的部分：

- `scripts/orchestrator/drivers.mjs` 的 prose parser 优化
- `REVIEW_PLAN` / `REVIEW_EXEC` 的人工接受机制
- orchestrator 之外的产品代码、runtime semantics、ModelTable patch、deploy 或 k8s 操作
- 对历史 failed event 的重写或删除

## 范围

### In Scope

- 新增 batch-level `Final Verification` manual accept 的正式入口
- 将人工接受收口为单一 terminal pipeline
- 修复 `state.json`、`batch_summary`、`status.txt`、`events.jsonl` 在 manual accept 后的同步一致性
- 让 wave launcher 等终态消费者遵守 `batch_summary` authority
- 为真实样本与回归测试冻结 deterministic 验证口径
- 同步 SSOT 与 operator runbook

### Out Of Scope

- 不修改 planning / review / execution 主流程语义
- 不改 `Final Verification` prompt 或 parser 设计
- 不新增 auto-remediation iteration
- 不把这条人工接受能力扩展到 review gate
- 不推进 `0229` / `0230` 的真实 ops smoke

## 成功标准

- orchestrator 存在一个正式、显式、可审计的 batch-level manual accept 入口，不再要求人直接改 `state.json`。
- 对 `7ff3735e-abf6-4cab-b024-8d474e66673b` 与 `6d22aa18-43a7-4cd6-8e9c-823e2e6b23bb` 这两个真实样本，人工接受后都满足：
  - `state.final_verification = passed`
  - `state.batch_summary.final_verification = passed`
  - `state.batch_summary.terminal_outcome = passed`
  - `state.batch_summary.lifecycle = completed`
  - `status.txt` 同时显示 `Batch Outcome: passed` 与 `Final Verification: passed`
- `events.jsonl` 保留原始 parse-failed terminal event，同时追加一条新的结构化 override evidence，用来解释“为何最终 authoritative 结果为 passed”。
- `wave_launcher_lib.mjs` 在 terminal decision 上不再只盯 `state.final_verification`；当 summary 与 top-level 漂移时，必须停下并暴露不一致，而不是继续推进。
- `bun scripts/orchestrator/test_orchestrator.mjs` 对以下场景有明确 coverage：
  - parse false negative
  - manual accept
  - status refresh
  - wave terminal consumer alignment

## 约束与不变量

- `state.json` 仍是唯一恢复真源；`status.txt` 与 `events.jsonl` 仍是衍生面。
- 人工接受后的写入顺序必须继续遵守 `0205` 冻结的 terminal pipeline：event append → state commit → status refresh → notify。
- 旧的 parse failure event 必须保留；只允许追加 override evidence，不允许 rewrite history。
- 这次改动只处理 batch-level final verification human accept，不得顺手扩张到其他 human decision surface。
- Tier conformance 结论必须明确写成“不涉及 Tier 1 runtime / Tier 2 model semantics 变更”，避免把 orchestrator tooling 误写成 runtime 能力修改。

## 风险与缓解

- 风险：只补 CLI 命令，但仍让 consumer 继续直接读 `state.final_verification`。
  - 缓解：把 `wave_launcher_lib.mjs` 一并纳入范围，用 regression 锁住 authority 口径。
- 风险：只修 `state.json`，继续遗留 `status.txt` 或 `events.jsonl` 漂移。
  - 缓解：manual accept 必须走完整 terminal pipeline，而不是只调一个 field setter。
- 风险：为了“看起来通过”去删除旧 failed event。
  - 缓解：在 SSOT 和测试里明确“保留失败事件 + 追加 override event”的 append-only 规则。
- 风险：把 `--resume` 与 manual accept 混成一条路径，重新触发 final verification。
  - 缓解：文档和 CLI 合同都明确 `--resume` 不是 final verification manual accept 入口。

## 方案比较

### A. 推荐：增加正式 manual-accept CLI + authoritative helper + consumer 对齐

- 优点：
  - 最小且闭环，能同时解决 operator 入口、state 同步、audit evidence 和 consumer 一致性。
  - 与 `0205` 的 terminal authority 方向一致。
- 缺点：
  - 需要同时触达 CLI、state、events、consumer、docs、tests 多个面。

### B. 继续允许人工手改 `state.json`，再靠 `--resume` 或其他脚本补投影

- 优点：
  - 实现表面上更快。
- 缺点：
  - `--resume` 会重新进入 final verification，不是安全 accept 路径。
  - 极易再次留下 `batch_summary` / `status.txt` / `events.jsonl` 漂移。
  - 审计链不清晰。

### C. 优先增强 final verification parser，尽量减少 manual accept

- 优点：
  - 长期可减少 false negative。
- 缺点：
  - 不能解决“已经发生的人类裁决如何落成 authoritative state”的核心问题。
  - 会扩大到 parser 设计而非 terminal-state contract。

当前推荐：A。

## 假设与验证方法

- 假设 1：本地样本 batch `7ff3735e-abf6-4cab-b024-8d474e66673b` 与 `6d22aa18-43a7-4cd6-8e9c-823e2e6b23bb` 在执行阶段仍可用于验证。
  - 验证方法：执行前先检查两个目录存在，并在 `/tmp/0231-final-verification-manual-accept-consistency/` 下做备份。
- 假设 2：manual accept 的最小可信边界是“batch 已完成 iteration、只剩 final verification 人工裁决”。
  - 验证方法：helper/CLI 必须拒绝 active / pending / on_hold batch。
- 假设 3：consumer 对齐应以 `batch_summary` 为主，而不是继续容忍 top-level / summary 双真源。
  - 验证方法：新增 wave launcher regression，故意喂入 summary/top-level 漂移状态时应停止而不是 continue。

> 本文件只定义 WHAT / WHY / 范围 / 成功标准 / 不变量，不记录 Step 编号、执行结果、命令输出或 commit。
