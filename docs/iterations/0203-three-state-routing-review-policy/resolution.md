---
title: "0203 — Resolution (HOW)"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0203-three-state-routing-review-policy
id: 0203-three-state-routing-review-policy
phase: phase1
---

# 0203 — Resolution (HOW)

## 0. Execution Rules

- Work branch: `dropx/dev_0203-three-state-routing-review-policy`
- Working directory for every command: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- This iteration changes orchestrator tooling and orchestrator governance docs only.
- `packages/**`, `deploy/**`, `k8s/**`, runtime source, system-model patches and remote ops are out of scope.
- Steps must be executed in order.
- Every Step must leave a deterministic validation trail in `docs/iterations/0203-three-state-routing-review-policy/runlog.md`.
- If implementation starts touching escalation rule tables, oscillation detection, completion cleanup, monitor/events display semantics, or product runtime files, stop and return to Phase 1. Those belong to `0204` / `0205` or to other iterations.

## 1. Planned Change Surface

Primary implementation files:

- `scripts/orchestrator/orchestrator.mjs`
- `scripts/orchestrator/state.mjs`
- `scripts/orchestrator/prompts.mjs`
- `scripts/orchestrator/test_orchestrator.mjs`
- `docs/ssot/orchestrator_hard_rules.md`

Expected new helper files:

- `scripts/orchestrator/entry_route.mjs`
- `scripts/orchestrator/review_policy.mjs`

Files that must remain untouched unless Phase 1 is revised:

- `scripts/orchestrator/monitor.mjs`
- `scripts/orchestrator/events.mjs`
- `scripts/orchestrator/scheduler.mjs`
- `scripts/orchestrator/drivers.mjs`
- `packages/**`
- `deploy/**`
- `k8s/**`

## 2. Steps Overview

| Step | Title | Goal | Key Files | Validation | Rollback |
|------|-------|------|-----------|------------|----------|
| 1 | Introduce Route + Policy Models | 把 route kind 与 `review_policy` 变成显式、可持久化数据结构 | `entry_route.mjs`, `review_policy.mjs`, `state.mjs`, `test_orchestrator.mjs` | `bun scripts/orchestrator/test_orchestrator.mjs` | 回退本 Step 对 helper/state/test 的提交 |
| 2 | Wire Tri-State Entry Routing | 让 `--prompt` / `--iteration` 真正走三态 route，而不是二分入口 | `orchestrator.mjs`, `entry_route.mjs`, `prompts.mjs`, `test_orchestrator.mjs` | `bun scripts/orchestrator/test_orchestrator.mjs` | 回退本 Step 对入口路由的提交 |
| 3 | Apply review_policy To Review Loops | 用 `review_policy` 取代 review gate 的主循环硬编码阈值 | `orchestrator.mjs`, `review_policy.mjs`, `prompts.mjs`, `state.mjs`, `test_orchestrator.mjs` | `bun scripts/orchestrator/test_orchestrator.mjs` | 回退本 Step 对 policy 消费逻辑的提交 |
| 4 | Sync SSOT And Run Full Regression | 让 orchestrator SSOT 与代码使用同一套 route / policy 术语并复验 | `docs/ssot/orchestrator_hard_rules.md`, `test_orchestrator.mjs` | `bun scripts/orchestrator/test_orchestrator.mjs` | 回退本 Step 的文档与测试提交 |

## 3. Step Details

### Step 1 — Introduce Route + Policy Models

**Goal**

- 为 tri-state routing 和 `review_policy` 建立独立的 helper 模块与 state 结构，消除“只有主循环知道规则”的隐式实现。

**Scope**

- 新增 `scripts/orchestrator/entry_route.mjs`
  - 定义 route kind：
    - `new_requirement`
    - `draft_iteration`
    - `executable_iteration`
  - 定义判定输入：
    - CLI entry source
    - `docs/ITERATIONS.md` status
    - `plan.md` / `resolution.md` 是否存在
    - 是否仍包含 scaffold 占位文本
- 新增 `scripts/orchestrator/review_policy.mjs`
  - 定义 `review_policy` 结构
  - 提供默认 profile 与 route-to-policy 映射
- 更新 `scripts/orchestrator/state.mjs`
  - 在 batch / iteration state 中持久化：
    - `entry_route`
    - `entry_source`
    - `review_policy`
    - `risk_profile`
- 扩展 `scripts/orchestrator/test_orchestrator.mjs`
  - 增加 route classification 与 policy persistence 的回归用例

**Files**

- Create:
  - `scripts/orchestrator/entry_route.mjs`
  - `scripts/orchestrator/review_policy.mjs`
- Update:
  - `scripts/orchestrator/state.mjs`
  - `scripts/orchestrator/test_orchestrator.mjs`

**Validation (Executable)**

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_orchestrator.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "new_requirement|draft_iteration|executable_iteration|review_policy|approval_count|major_revision_limit|cli_failure_threshold|risk_profile" scripts/orchestrator/entry_route.mjs scripts/orchestrator/review_policy.mjs scripts/orchestrator/state.mjs scripts/orchestrator/test_orchestrator.mjs
```

**Acceptance Criteria**

- route kind 与 `review_policy` 已存在独立模块，不再只作为 `orchestrator.mjs` 的局部常量和临时判断。
- state 可为 new batch 与 existing iteration 两类入口持久化 route/policy 信息。
- regression tests 至少覆盖：
  - `--prompt` 对应 `new_requirement`
  - scaffold / incomplete iteration 对应 `draft_iteration`
  - `Approved` / `In Progress` 且合同完整的 iteration 对应 `executable_iteration`

**Rollback Strategy**

- 回退本 Step 对 `entry_route.mjs`、`review_policy.mjs`、`state.mjs`、`test_orchestrator.mjs` 的提交。
- 若 route/policy 结构经 review 认定设计错误，删除新增 helper 并恢复 `state.mjs` 到执行前版本，不进入 Step 2。

---

### Step 2 — Wire Tri-State Entry Routing

**Goal**

- 把当前入口从“prompt vs iteration”的二分法改为真正的三态 route selection，并为 `draft_iteration` 和 `executable_iteration` 赋予不同启动语义。

**Scope**

- 更新 `scripts/orchestrator/orchestrator.mjs`
  - `--prompt` / `--prompt-file` 只允许进入 `new_requirement`
  - `--iteration <id>` 必须先经过 route classification
  - 对 `Completed` / `On Hold` / `Cancelled` / 缺失合同的 iteration 给出显式阻断，不做隐式 fallback
- 重写 `runExistingIteration()` 的起始 phase 判定
  - 不再只使用 `Planned -> PLANNING`, `Approved/In Progress -> EXECUTION`
  - `draft_iteration` 进入 planning / refine 路径
  - `executable_iteration` 进入 execution / resume 路径
- 更新 `scripts/orchestrator/prompts.mjs`
  - planning prompt 支持两种模式：
    - `create`：新建合同
    - `refine`：基于既有草稿补完/重写合同

**Files**

- Update:
  - `scripts/orchestrator/orchestrator.mjs`
  - `scripts/orchestrator/prompts.mjs`
  - `scripts/orchestrator/test_orchestrator.mjs`
- Use from Step 1:
  - `scripts/orchestrator/entry_route.mjs`

**Validation (Executable)**

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_orchestrator.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && ! rg -n -- "'Planned': 'PLANNING'|'Approved': 'EXECUTION'|'In Progress': 'EXECUTION'" scripts/orchestrator/orchestrator.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "new_requirement|draft_iteration|executable_iteration|runExistingIteration|refine" scripts/orchestrator/orchestrator.mjs scripts/orchestrator/prompts.mjs scripts/orchestrator/entry_route.mjs
```

**Acceptance Criteria**

- `--iteration` 不再把所有 existing iteration 视为同一种入口。
- `draft_iteration` 与 `executable_iteration` 的启动 phase 可以被代码和测试一致解释。
- 当 iteration 目录存在但合同仍是 scaffold 占位文本时，不会误入 execution。
- 当 iteration 已 `Completed` / `On Hold` / `Cancelled` 时，不会被静默当作 executable work item。

**Rollback Strategy**

- 回退本 Step 对 `orchestrator.mjs`、`prompts.mjs`、`test_orchestrator.mjs` 的提交。
- 若 tri-state 接线引入 route ambiguity，恢复为 Step 1 之后的状态，并在 Phase 1 补充 route 判定规则。

---

### Step 3 — Apply `review_policy` To Review Loops

**Goal**

- 让 `REVIEW_PLAN` / `REVIEW_EXEC` 的阈值来自显式 policy，而不是来自 duplicated magic numbers。

**Scope**

- 更新 `scripts/orchestrator/orchestrator.mjs`
  - 用 `review_policy.approval_count` 替代 `AUTO_APPROVAL_REQUIRED`
  - 用 `review_policy.major_revision_limit` 替代 `MAJOR_REVISION_LIMIT`
  - 用 `review_policy.cli_failure_threshold` 替代 duplicated `>= 2`
  - `ambiguous` 等 coarse stop 行为改为读取 `review_policy.escalation_policy`
- 更新 `scripts/orchestrator/prompts.mjs`
  - 在 plan review / exec review prompt 中写入当前 `review_policy`
  - 让 reviewer 明确知道本轮采用的 approvals / revision limit / risk profile
- 更新 `scripts/orchestrator/review_policy.mjs`
  - 提供 route-aware default policy
  - 为 `0204` 留出 `risk_profile` / `escalation_policy` 的扩展位，但不在本 iteration 引入规则引擎
- 更新 `scripts/orchestrator/test_orchestrator.mjs`
  - 增补 policy consumption 的回归用例

**Files**

- Update:
  - `scripts/orchestrator/orchestrator.mjs`
  - `scripts/orchestrator/prompts.mjs`
  - `scripts/orchestrator/review_policy.mjs`
  - `scripts/orchestrator/state.mjs`
  - `scripts/orchestrator/test_orchestrator.mjs`

**Validation (Executable)**

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_orchestrator.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && ! rg -n -- "AUTO_APPROVAL_REQUIRED|MAJOR_REVISION_LIMIT" scripts/orchestrator/orchestrator.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "approval_count|major_revision_limit|cli_failure_threshold|risk_profile|escalation_policy" scripts/orchestrator/orchestrator.mjs scripts/orchestrator/prompts.mjs scripts/orchestrator/review_policy.mjs scripts/orchestrator/state.mjs
```

**Acceptance Criteria**

- review gate 的关键阈值不再散落为主循环常量。
- state、prompt、tests 可以看到同一份 `review_policy`。
- 本 Step 只显式化当前 policy 和 coarse profile，不引入 `0204` 才应负责的 failure matrix / oscillation engine。

**Rollback Strategy**

- 回退本 Step 对 `orchestrator.mjs`、`prompts.mjs`、`review_policy.mjs`、`state.mjs`、`test_orchestrator.mjs` 的提交。
- 若 policy 抽象导致 `REVIEW_PLAN` / `REVIEW_EXEC` 行为无法解释，回退到 Step 2 状态并重新审定 policy 字段集合。

---

### Step 4 — Sync SSOT And Run Full Regression

**Goal**

- 让 orchestrator SSOT、代码和测试对 tri-state routing 与 `review_policy` 使用完全一致的术语与边界。

**Scope**

- 更新 `docs/ssot/orchestrator_hard_rules.md`
  - 增补 tri-state route definitions
  - 明确 `review_policy` 的字段、默认 profile、route-to-policy 关系
  - 明确 `0203` / `0204` / `0205` 的边界，避免后续实现混线
- 复跑 orchestrator regression
- 在执行阶段把真实命令与关键输出记入 `runlog.md`

**Files**

- Update:
  - `docs/ssot/orchestrator_hard_rules.md`
  - `scripts/orchestrator/test_orchestrator.mjs`

**Validation (Executable)**

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_orchestrator.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "new_requirement|draft_iteration|executable_iteration|review_policy|approval_count|major_revision_limit|cli_failure_threshold|risk_profile|escalation_policy" docs/ssot/orchestrator_hard_rules.md
```

**Acceptance Criteria**

- SSOT 中的 route 名称、policy 字段名、边界说明与实现完全一致。
- regression tests 对 Step 1-3 引入的三态路由与 policy 回归面仍全部 PASS。
- 文档明确说明：
  - `0203` 负责 route + policy externalization
  - `0204` 负责 escalation engine / oscillation
  - `0205` 负责 completion / observability cleanup

**Rollback Strategy**

- 回退本 Step 对 `docs/ssot/orchestrator_hard_rules.md` 与 `test_orchestrator.mjs` 的提交。
- 若 SSOT 审核发现字段名或边界定义错误，先回退文档与相关测试，再回到 Step 3 修正实现。

## 4. Overall Acceptance

- tri-state routing 已在代码、state、tests、SSOT 四个层面形成同一套 contract。
- `review_policy` 已成为显式数据模型，而不是 `orchestrator.mjs` 的隐藏阈值集合。
- 入口误判、草稿合同误执行、硬编码阈值漂移三类问题都具备 deterministic regression coverage。
- 变更面没有扩散到 runtime、frontend、server、deploy 或 k8s。

## 5. Overall Rollback

若整个 iteration 在 Phase 3 执行后需要整体回退，按以下顺序操作：

1. 回退 Step 4 的 SSOT 与测试变更。
2. 回退 Step 3 的 `review_policy` 消费逻辑。
3. 回退 Step 2 的 tri-state 入口接线。
4. 回退 Step 1 的 helper 模块与 state 字段。

回退原则：

- 只回退 `0203` 引入的 orchestrator 文件与文档变更。
- 不回退同一工作树中与本 iteration 无关的用户改动。
- 每次回退后都必须重新执行 `bun scripts/orchestrator/test_orchestrator.mjs`，并把事实结果写回 `runlog.md`。

> 本文件只定义 HOW；不得记录 PASS/FAIL、命令输出、commit hash 或真实执行结果。
