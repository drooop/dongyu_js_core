---
title: "0204 — Resolution (HOW)"
doc_type: iteration-resolution
status: planned
updated: 2026-03-22
source: ai
iteration_id: 0204-escalation-rules-engine
id: 0204-escalation-rules-engine
phase: phase1
---

# 0204 — Resolution (HOW)

## 0. Execution Rules

- Work branch: `dropx/dev_0204-escalation-rules-engine`
- Working directory for every command: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- This iteration changes orchestrator tooling and orchestrator docs only.
- `packages/**`, runtime source, `deploy/**`, `k8s/**`, and remote ops are out of scope.
- Steps must be executed in order.
- Every Step must leave deterministic evidence in `docs/iterations/0204-escalation-rules-engine/runlog.md`.
- If implementation starts changing `status.txt` / `events.jsonl` schema, monitor rendering contract, completion cleanup semantics, or adds a new human-decision CLI surface, stop and return to Phase 1. Those belong to `0205` or to a separate iteration.

## 1. Planned Change Surface

Primary implementation files:

- `scripts/orchestrator/orchestrator.mjs`
- `scripts/orchestrator/review_policy.mjs`
- `scripts/orchestrator/drivers.mjs`
- `scripts/orchestrator/state.mjs`
- `scripts/orchestrator/test_orchestrator.mjs`
- `docs/ssot/orchestrator_hard_rules.md`
- `docs/user-guide/orchestrator_local_smoke.md`

Expected new helper file:

- `scripts/orchestrator/escalation_engine.mjs`

Files that must remain untouched unless Phase 1 is revised:

- `scripts/orchestrator/monitor.mjs`
- `scripts/orchestrator/events.mjs`
- `scripts/orchestrator/scheduler.mjs`
- `packages/**`
- `deploy/**`
- `k8s/**`

## 2. Steps Overview

| Step | Title | Goal | Key Files | Validation | Rollback |
|------|-------|------|-----------|------------|----------|
| 1 | Normalize Failure Signals And State Evidence | 把原始 review/CLI/preflight 异常归一化，并为 state 持久化 failure/escalation/oscillation 证据打底 | `drivers.mjs`, `state.mjs`, `escalation_engine.mjs`, `test_orchestrator.mjs` | `bun scripts/orchestrator/test_orchestrator.mjs` | 回退本 Step 对 driver/state/helper/test 的提交 |
| 2 | Implement Failure Matrix And Oscillation Rules | 把 failure kind、threshold、action resolver、oscillation detection 变成显式 policy contract | `escalation_engine.mjs`, `review_policy.mjs`, `test_orchestrator.mjs` | `bun scripts/orchestrator/test_orchestrator.mjs` | 回退本 Step 对 engine/policy/test 的提交 |
| 3 | Wire Main Loop To Escalation Engine | 让 review loop、resume/preflight 与 prompts 消费统一 escalation 决策，而不是各自硬编码 | `orchestrator.mjs`, `prompts.mjs`, `state.mjs`, `escalation_engine.mjs`, `test_orchestrator.mjs` | `bun scripts/orchestrator/test_orchestrator.mjs` | 回退本 Step 对主循环与 prompt 接线的提交 |
| 4 | Sync SSOT And Operator Runbook | 让代码、SSOT、runbook 对 failure matrix / oscillation / action 术语完全一致 | `docs/ssot/orchestrator_hard_rules.md`, `docs/user-guide/orchestrator_local_smoke.md`, `test_orchestrator.mjs` | `bun scripts/orchestrator/test_orchestrator.mjs` | 回退本 Step 的文档与测试提交 |

## 3. Step Details

### Step 1 — Normalize Failure Signals And State Evidence

**Goal**

- 为后续 escalation engine 建立稳定输入，避免主循环继续直接消费原始字符串错误与零散计数器。

**Scope**

- 更新 `scripts/orchestrator/drivers.mjs`
  - 对 review CLI failure 产出结构化 failure signal，而不是只返回 `ok=false + error message`。
  - 至少区分：
    - `max_turns`
    - `timeout`
    - `process_error`
    - `json_parse_error`
    - 其他可识别 transport/process failure
- 新增 `scripts/orchestrator/escalation_engine.mjs`
  - 提供 failure normalization 的统一入口。
  - 先定义数据结构与 helper，不在本 Step 完成完整规则矩阵。
- 更新 `scripts/orchestrator/state.mjs`
  - 为 iteration 增加可恢复的 failure / escalation / oscillation 证据承载字段。
  - 这些字段必须能在 reload state 后继续被读取，而不是仅存在于内存。
- 更新 `scripts/orchestrator/test_orchestrator.mjs`
  - 增补 failure signal normalization 与 state persistence 回归用例。

**Files**

- Create:
  - `scripts/orchestrator/escalation_engine.mjs`
- Update:
  - `scripts/orchestrator/drivers.mjs`
  - `scripts/orchestrator/state.mjs`
  - `scripts/orchestrator/test_orchestrator.mjs`
- Must NOT touch:
  - `scripts/orchestrator/monitor.mjs`
  - `scripts/orchestrator/events.mjs`
  - `packages/**`

**Validation (Executable)**

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_orchestrator.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "max_turns|timeout|process_error|json_parse_error|failure|escalation|oscillation" scripts/orchestrator/drivers.mjs scripts/orchestrator/state.mjs scripts/orchestrator/escalation_engine.mjs scripts/orchestrator/test_orchestrator.mjs
```

**Acceptance Criteria**

- review/CLI failure 不再只能由 free-form error text 区分。
- authoritative state 已具备持久化 failure / escalation / oscillation 证据的结构。
- regression tests 覆盖：
  - driver failure normalization
  - state reload 后证据仍可读取

**Rollback Strategy**

- 回退本 Step 对 `drivers.mjs`、`state.mjs`、`escalation_engine.mjs`、`test_orchestrator.mjs` 的提交。
- 若 failure signal 结构经 review 认定不稳定，删除新增 helper 并恢复 state schema 到执行前版本，不进入 Step 2。

---

### Step 2 — Implement Failure Matrix And Oscillation Rules

**Goal**

- 把 failure kind、oscillation threshold 和 escalation action resolver 正式建模为 policy，而不是继续靠主循环局部判断拼装行为。

**Scope**

- 完成 `scripts/orchestrator/escalation_engine.mjs`
  - 定义 failure matrix 输入/输出 contract。
  - 输入至少包括：
    - phase
    - failure kind
    - recent failure history
    - recent review verdict history
    - `risk_profile`
    - `review_policy.escalation_policy`
  - 输出至少包括：
    - normalized failure kind
    - selected action
    - trigger reason
    - whether the threshold was reached
- 更新 `scripts/orchestrator/review_policy.mjs`
  - 把 `escalation_policy` 扩展为能表达 failure-specific action 与 oscillation threshold 的结构。
  - 为 `new_requirement` / `draft_iteration` / `executable_iteration` 设定默认 profile。
- 定义 oscillation detection
  - 至少覆盖：
    - `APPROVED -> NEEDS_CHANGES -> APPROVED`
    - `NEEDS_CHANGES -> APPROVED -> NEEDS_CHANGES`
  - 判定必须与 Auto-Approval 连续计数并存，但不能互相覆盖或互相污染。
- 更新 `scripts/orchestrator/test_orchestrator.mjs`
  - 增补 failure matrix / oscillation / action resolution 的 deterministic case。

**Files**

- Update:
  - `scripts/orchestrator/escalation_engine.mjs`
  - `scripts/orchestrator/review_policy.mjs`
  - `scripts/orchestrator/test_orchestrator.mjs`
- Must NOT touch:
  - `packages/**`
  - `deploy/**`
  - `k8s/**`

**Validation (Executable)**

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_orchestrator.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "ambiguous_revision|parse_failure|max_turns|timeout|state_doc_inconsistency|oscillation|warn_and_continue|human_decision_required|on_hold" scripts/orchestrator/escalation_engine.mjs scripts/orchestrator/review_policy.mjs scripts/orchestrator/test_orchestrator.mjs
```

**Acceptance Criteria**

- failure matrix 至少覆盖 `ambiguous_revision`、parse failure、max turns、timeout/process error、state/doc inconsistency、oscillation。
- rule engine 可对同一 failure kind 基于 policy 解析出明确 action。
- oscillation 触发阈值来自 policy 或配置结构，而不是主循环魔法常量。
- regression tests 覆盖至少一个 oscillation 触发样本和至少三个不同 failure kind 的 action resolution。

**Rollback Strategy**

- 回退本 Step 对 `escalation_engine.mjs`、`review_policy.mjs`、`test_orchestrator.mjs` 的提交。
- 若 oscillation 定义在 review 中被认定过宽或过窄，先回退该 Step，再在 Phase 1 调整 contract 后重做。

---

### Step 3 — Wire Main Loop To Escalation Engine

**Goal**

- 让 `REVIEW_PLAN`、`REVIEW_EXEC`、resume/preflight consistency 检查与 prompts 使用同一套 escalation 决策，去掉 duplicated ad-hoc branching。

**Scope**

- 更新 `scripts/orchestrator/orchestrator.mjs`
  - 将 `REVIEW_PLAN` / `REVIEW_EXEC` 中的 CLI failure、parse failure、`ambiguous_revision`、major revision limit、oscillation 判定统一接到 escalation engine。
  - 将 `checkStateIterationsConsistency()` 与相关恢复/preflight 阻断映射到显式 failure kind。
  - 把 selected action 写入 state 证据，并据此决定：
    - retry
    - continue
    - warn and continue
    - human decision required
    - on hold
- 更新 `scripts/orchestrator/prompts.mjs`
  - 在 review prompt 中显式注入当前 `review_policy`、risk context 和必要的 escalation/oscillation 边界，避免 reviewer 与 orchestrator 使用不同规则。
- 补充 `scripts/orchestrator/test_orchestrator.mjs`
  - 覆盖主循环消费 escalation engine 的回归路径。
  - 覆盖 reload state 后仍能继续判断 repeated failure / oscillation 的恢复路径。

**Files**

- Update:
  - `scripts/orchestrator/orchestrator.mjs`
  - `scripts/orchestrator/prompts.mjs`
  - `scripts/orchestrator/state.mjs`
  - `scripts/orchestrator/escalation_engine.mjs`
  - `scripts/orchestrator/test_orchestrator.mjs`
- Must NOT touch:
  - `scripts/orchestrator/monitor.mjs`
  - `scripts/orchestrator/events.mjs`
  - `packages/**`

**Validation (Executable)**

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_orchestrator.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "escalation|oscillation|state_doc_inconsistency|warn_and_continue|human_decision_required|on_hold" scripts/orchestrator/orchestrator.mjs scripts/orchestrator/prompts.mjs scripts/orchestrator/escalation_engine.mjs scripts/orchestrator/state.mjs
```

**Acceptance Criteria**

- `REVIEW_PLAN` 与 `REVIEW_EXEC` 不再分别维护各自的 failure/stop 分支逻辑。
- `state_doc_inconsistency`、review parse failure、max turns、oscillation 都经过统一 engine 产生 action。
- `--resume` 后 repeated failure / oscillation 判断不会因进程重启而丢失。
- prompt 中呈现的 escalation 边界与主循环实际消费的 policy 保持一致。

**Rollback Strategy**

- 回退本 Step 对 `orchestrator.mjs`、`prompts.mjs`、`state.mjs`、`escalation_engine.mjs`、`test_orchestrator.mjs` 的提交。
- 若主循环接线导致 review gate 行为不可解释，恢复到 Step 2 状态并重新审定 engine API。

---

### Step 4 — Sync SSOT And Operator Runbook

**Goal**

- 让代码、SSOT 和本地操作者文档对 failure matrix、oscillation 和 escalation action 使用完全一致的术语与边界。

**Scope**

- 更新 `docs/ssot/orchestrator_hard_rules.md`
  - 明确 failure taxonomy
  - 明确 oscillation definition / threshold source
  - 明确 `review_policy.escalation_policy` 结构
  - 明确 state 中新增的 failure / escalation / oscillation 证据字段
  - 明确 `0204` 与 `0205` 边界
- 更新 `docs/user-guide/orchestrator_local_smoke.md`
  - 说明新的 `On Hold` 原因分类
  - 说明 operator 如何识别 oscillation / state_doc_inconsistency
  - 说明恢复前的人类裁决边界
- 复跑 orchestrator regression，并把真实证据留到 `runlog.md`

**Files**

- Update:
  - `docs/ssot/orchestrator_hard_rules.md`
  - `docs/user-guide/orchestrator_local_smoke.md`
  - `scripts/orchestrator/test_orchestrator.mjs`

**Validation (Executable)**

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_orchestrator.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "failure matrix|oscillation|warn_and_continue|human_decision_required|state_doc_inconsistency|escalation_policy" docs/ssot/orchestrator_hard_rules.md docs/user-guide/orchestrator_local_smoke.md
```

**Acceptance Criteria**

- SSOT、runbook、tests 与代码使用同一套 failure/action/oscillation 术语。
- 操作者无需阅读聊天上下文，仅凭 runbook 与 state/runlog 就能理解何时需要人工裁决。
- 本 Step 没有把 monitor/events/status cleanup 混入 `0204`。

**Rollback Strategy**

- 回退本 Step 对 `docs/ssot/orchestrator_hard_rules.md`、`docs/user-guide/orchestrator_local_smoke.md`、`test_orchestrator.mjs` 的提交。
- 若文档评审发现术语或边界与实现不一致，先回退文档与相关测试，再回到 Step 3 修正实现。

## 4. Overall Acceptance

- orchestrator 已具备显式 failure matrix、oscillation detection 和 policy-driven action resolver。
- authoritative state 能在恢复后解释 failure history 与 escalation decisions。
- main loop 不再依赖分散的 ad-hoc failure handling。
- docs 与 tests 对新 contract 有 deterministic 覆盖，且变更面未扩散到 runtime、frontend、server、deploy 或 k8s。

## 5. Overall Rollback

若整个 iteration 在 Phase 3 执行后需要整体回退，按以下顺序操作：

1. 回退 Step 4 的 SSOT、runbook 与相关测试变更。
2. 回退 Step 3 的主循环接线与 prompt 接线。
3. 回退 Step 2 的 failure matrix / oscillation / policy 扩展。
4. 回退 Step 1 的 driver normalization、state schema 与 helper 文件。

回退原则：

- 只回退 `0204` 引入的 orchestrator 文件与文档变更。
- 不回退同一工作树中与本 iteration 无关的用户改动。
- 每次回退后都必须重新执行 `bun scripts/orchestrator/test_orchestrator.mjs`，并把事实结果写回 `runlog.md`。

> 本文件只定义 HOW；不得记录 PASS/FAIL、命令输出、commit hash 或真实执行结果。
