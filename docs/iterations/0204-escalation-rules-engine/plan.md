---
title: "0204 — orchestrator v1.1 Phase 2：escalation 规则引擎 + oscillation 检测"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0204-escalation-rules-engine
id: 0204-escalation-rules-engine
phase: phase1
---

# 0204 — orchestrator v1.1 Phase 2：escalation 规则引擎 + oscillation 检测

## WHAT

本 iteration 要在 `0203-three-state-routing-review-policy` 已落地的 tri-state route 和 `review_policy` 数据模型之上，把当前 orchestrator 对 review/CLI 异常的粗粒度处理，升级为显式、可持久化、可测试、可审计的 escalation rules engine。

目标交付不是“再补几条 if-else”，而是建立一套统一 contract，使 orchestrator 能把原始异常信号稳定映射为 failure kind，再由 `review_policy.escalation_policy` 和 `risk_profile` 决定动作。至少要覆盖以下能力：

- 定义 failure matrix。
  - 把当前散落在 review loop、resume/preflight 和 CLI driver 中的异常信号，统一归一化为明确 failure kind，而不是只靠 `cli_failure_count` 和少量 hardcoded branch。
  - 最低覆盖：
    - `ambiguous_revision`
    - `review_parse_failure`
    - `review_cli_max_turns`
    - `review_cli_timeout` / `review_cli_process_error`
    - `state_doc_inconsistency`
    - `branch_guard_failure`
    - repeated failure / repeated timeout

- 定义 oscillation detection。
  - 把 `REVIEW_PLAN` / `REVIEW_EXEC` 中“看似有进展、实际在 Approved 与 Needs Changes 之间来回摆动”的模式显式化。
  - 最低覆盖：
    - `APPROVED -> NEEDS_CHANGES -> APPROVED`
    - `NEEDS_CHANGES -> APPROVED -> NEEDS_CHANGES`
  - 触发条件必须由 policy 或阈值驱动，而不是写死在主循环里。

- 定义 escalation action resolver。
  - 对同一种 failure kind，允许依据 `risk_profile` 与 `review_policy.escalation_policy` 选择不同动作。
  - 动作边界至少明确到：
    - `retry`
    - `warn_and_continue`
    - `human_decision_required`
    - `on_hold`

- 把 failure / escalation / oscillation 轨迹写入 authoritative state。
  - `state.json` 必须能在 `--resume` 后解释：
    - 最近发生了什么 failure
    - 触发了哪条规则
    - 采取了什么 action
    - oscillation 是否已越过阈值
  - 不能依赖终端输出或聊天上下文补足这些信息。

- 为规则引擎增加 deterministic regression coverage，并同步 orchestrator SSOT 与本地 runbook。

## WHY

当前 codebase 已经证明 orchestrator 主链路可跑通，但也清楚暴露出 Phase 2 的缺口：

- `scripts/orchestrator/orchestrator.mjs` 目前只做两类粗处理：
  - 用单一的 `cli_failure_count` 统计 review CLI failure / parse failure；
  - 遇到 `ambiguous_revision` 直接 `On Hold`。
- `scripts/orchestrator/drivers.mjs` 已经能识别 `error_max_turns`，但主循环没有把它与 parse failure、timeout、process error 区分处理。
- `scripts/orchestrator/state.mjs` 当前只持久化 `review_records`、`major_revision_count`、`consecutive_approvals`、`cli_failure_count` 等基础计数，没有 failure 分类、escalation 轨迹或 oscillation 状态。
- `docs/ssot/orchestrator_hard_rules.md` 已在 `0203` 中明确：
  - `0204` 负责 failure matrix / oscillation detection / escalation rules engine；
  - `0205` 才负责 completion cleanup / observability 收口。

`scripts/orchestrator/RETROSPECTIVE_2026-03-21.md` 也给出了直接动因：真实 batch 曾出现 `error_max_turns`、`ambiguous`、parse miss 和多轮 review 摆动，但当前实现无法把这些波动解释成统一规则，只能靠人工读 transcript 理解。

这意味着当前问题不再是“状态机有没有”，而是：

- 哪些异常可以继续自动推进；
- 哪些异常必须立即升级给人；
- 哪些看似通过 review、实则在振荡；
- 这些判断是否能在 `state.json`、tests 和 SSOT 里被同一套术语解释。

如果 `0204` 不把这层 contract 显式化，`risk_profile` 只是名义字段，`--resume` 也无法可靠判断之前的异常是在收敛还是在放大。

## 当前事实与影响范围

基于 2026-03-22 仓库现状，本 iteration 的直接实现面限定在 orchestrator tooling 与其文档，不涉及产品 runtime、server、frontend、deploy 或 k8s。

直接影响文件：

- `scripts/orchestrator/orchestrator.mjs`
  - 当前 `REVIEW_PLAN` / `REVIEW_EXEC` 里混有 `cli_failure_count`、`ambiguous_revision`、major revision limit 等临时判断。
  - `resume` 前的一致性检查也会决定是否立即停止，需要纳入统一 failure model。
- `scripts/orchestrator/review_policy.mjs`
  - 目前只提供 `approval_count` / `major_revision_limit` / `cli_failure_threshold` / `risk_profile` / 粗粒度 `escalation_policy`。
  - `0204` 需要把它扩展到 failure kind 与 oscillation 阈值可配置。
- `scripts/orchestrator/drivers.mjs`
  - review CLI 已能返回 `error_max_turns`，但 failure kind 仍不完整，无法支撑细粒度规则。
- `scripts/orchestrator/state.mjs`
  - authoritative state 需要增加 failure / escalation / oscillation 的持久化信息，确保恢复后不丢上下文。
- `scripts/orchestrator/test_orchestrator.mjs`
  - 当前已有 route/policy/major revision 等回归面，是最直接的 deterministic test surface。
- `docs/ssot/orchestrator_hard_rules.md`
  - 必须成为 failure matrix、oscillation 和 escalation action 的权威术语来源。
- `docs/user-guide/orchestrator_local_smoke.md`
  - 操作者需要知道新的 `On Hold` 原因、resume 边界和人工裁决前提。

高概率新增的 helper 文件：

- `scripts/orchestrator/escalation_engine.mjs`
  - 负责 failure classification、oscillation detection、action resolution。

明确不在本 iteration 范围内的文件面：

- `scripts/orchestrator/monitor.mjs`
- `scripts/orchestrator/events.mjs`
- `scripts/orchestrator/scheduler.mjs`
- `packages/**`
- `deploy/**`
- `k8s/**`
- `.orchestrator/runs/**` 历史运行产物

这意味着 `0204` 是 orchestrator Phase 2 contract + engine 收口，不允许借机扩张到产品逻辑、部署路径，或 `0205` 才负责的 observability 清理。

## 范围

### In Scope

- 设计并落地显式 failure taxonomy。
- 设计并落地 policy-driven escalation action resolver。
- 设计并落地 oscillation detection 与触发阈值。
- 在 authoritative state 中持久化 failure / escalation / oscillation 证据。
- 让 `REVIEW_PLAN` / `REVIEW_EXEC` / consistency preflight 消费同一套 failure contract。
- 为上述逻辑补 deterministic regression tests。
- 更新 orchestrator SSOT 与本地 smoke/runbook，使无上下文读者理解新行为。

### Out Of Scope

- 不做 `0205` 的完成态收口与 observability cleanup。
- 不重构 `status.txt` / `events.jsonl` 展示或 schema。
- 不新增完整的人类裁决 CLI 子命令或交互 UI；本 iteration 只定义何时停止并请求人类裁决。
- 不修改 `packages/**`、runtime、frontend、server、deploy、k8s。
- 不修改业务 iteration 内容或任何非 orchestrator 的 docs contract。

## 成功标准

- `scripts/orchestrator/orchestrator.mjs` 不再把 review 异常主要折叠为“单一 `cli_failure_count` + `ambiguous` 例外”，而是统一消费显式 failure kind。
- 同一种异常在 code、state、tests、SSOT 中使用同一套命名，而不是每层各说各话。
- `error_max_turns`、parse failure、timeout / process error、state/doc inconsistency、oscillation 至少五类情况可被 deterministic 区分。
- oscillation 触发条件可由 policy 解释，且不再依赖人工读 transcript 才能判断。
- `state.json` 在恢复后仍能解释最近 failure 与 escalation 历史，不依赖 terminal 输出。
- regression tests 能 deterministic 覆盖：
  - failure classification
  - repeated failure threshold
  - oscillation detection
  - action resolution
  - resume 后状态保持
- `docs/ssot/orchestrator_hard_rules.md` 与 `docs/user-guide/orchestrator_local_smoke.md` 使用与实现一致的 failure/action 术语。

## 约束与不变量

- `0204` 必须建立在 `0203` 的 tri-state route 与 `review_policy` 模型之上；不得绕过或替换 `0203` 合同。
- `approval_count` 的 Auto-Approval 语义保持不变；`0204` 只能补 failure/oscillation 判定，不能偷改独立 review 规则。
- 高风险任务优先升级给人，而不是通过提高自动 review 轮数来掩盖异常。
- authoritative state 仍以 `.orchestrator/runs/<batch_id>/state.json` 为唯一真源。
- 不允许“异常被吞掉但 batch 继续跑”的 silent failure。
- 不允许把 `0205` 的 monitor/events/status cleanup 混入 `0204`。
- 不允许把 failure 规则写成只在 prompt 里存在、state/tests/SSOT 无法解释的隐式行为。

## 假设与验证方法

- A1：`0204` 的“escalation”主要针对 orchestrator 的 review / preflight / state consistency 异常，不扩展为业务功能层面的风险判断。
  - 验证方法：Phase 2 review 必须确认改动面仍严格限定在 `scripts/orchestrator/**` 与对应文档。

- A2：oscillation 检测应基于 authoritative state 中已有或新增的 review / failure 记录重建，而不是依赖外部缓存、终端历史或人工记忆。
  - 验证方法：Phase 3 测试必须覆盖“写入 state → reload state → 继续检测”的恢复路径。

- A3：`warn_and_continue` 只能用于低风险、可重试、不会改变合同边界的失败类型；`state_doc_inconsistency`、`ambiguous_revision` 等高风险信号默认不得静默继续。
  - 验证方法：Phase 2 review 必须检查 failure matrix 中高风险 failure 的默认 action 是否仍为 `human_decision_required` 或 `on_hold`。

- A4：`0204` 只负责规则引擎与检测，不负责创建新的人工裁决交互面。
  - 验证方法：Phase 3 执行期间若需要新增 CLI 子命令、UI 面板或 monitor 专用展示，应停止并回到 Phase 1 重新定 scope。

> 本文件只定义 WHAT / WHY / 边界 / 成功标准，不记录 Step 编号、执行命令、PASS/FAIL、commit 或运行输出。
