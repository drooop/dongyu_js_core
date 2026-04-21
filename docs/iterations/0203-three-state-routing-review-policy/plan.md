---
title: "0203 — orchestrator v1.1 Phase 1：三态路由 + review_policy"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0203-three-state-routing-review-policy
id: 0203-three-state-routing-review-policy
phase: phase1
---

# 0203 — orchestrator v1.1 Phase 1：三态路由 + review_policy

## WHAT

本 iteration 要把当前 orchestrator 的入口判定从“新需求 decompose”与“既有 iteration 直接执行”这套隐式二分，升级为显式、可持久化、可验证的三态路由模型，并把 review gate 的关键阈值从主循环硬编码提升为 `review_policy` 配置模型。

目标行为分为三类：

- `new_requirement`
  - 入口：`--prompt` / `--prompt-file`
  - 语义：真正的新需求，尚未映射到既有 iteration
  - 起点：`DECOMPOSE -> INTAKE`
- `draft_iteration`
  - 入口：`--iteration <id>`
  - 语义：iteration 已存在，但合同仍是草稿态，尚未达到“可直接执行”的条件
  - 起点：跳过 decompose，进入 planning / review_plan 的 refine 路径
- `executable_iteration`
  - 入口：`--iteration <id>`
  - 语义：iteration 已有稳定 contract，允许进入 execution / review_exec / resume
  - 起点：跳过 decompose，直接进入 execution 或 resume

同时，本 iteration 要把当前散落在 `scripts/orchestrator/orchestrator.mjs` 中的评审阈值显式建模为 `review_policy`，至少覆盖以下现有控制面：

- `approval_count`
- `major_revision_limit`
- `cli_failure_threshold`
- `risk_profile`
- `escalation_policy`

`0203` 只做“入口识别 + review_policy 显式化”的第一阶段收口，不做完整 escalation 规则引擎，也不做完成态/observability 清理。

## WHY

当前 codebase 已经暴露出两个明确瓶颈，且二者都发生在 orchestrator 自身，而不是 runtime / server / frontend：

- 入口判定仍是二分法。
  - `scripts/orchestrator/orchestrator.mjs` 现在只有两条主入口：
    - `--prompt` / `--prompt-file`：永远走 decompose
    - `--iteration <id>`：永远走“existing iteration”
  - `runExistingIteration()` 目前只按 `docs/ITERATIONS.md` 的状态做粗映射：
    - `Planned -> PLANNING`
    - `Approved -> EXECUTION`
    - `In Progress -> EXECUTION`
  - 这会把“已有目录但合同仍是草稿”的场景，和“已有稳定 contract、可直接执行”的场景混在同一入口里。

- review gate 阈值仍是硬编码。
  - `scripts/orchestrator/orchestrator.mjs` 当前直接定义：
    - `AUTO_APPROVAL_REQUIRED = 3`
    - `MAJOR_REVISION_LIMIT = 3`
  - `cli_failure_count >= 2` 的停机阈值分别散落在 `REVIEW_PLAN` 与 `REVIEW_EXEC` 两个循环里。
  - `ambiguous` 当前直接触发 `On Hold`，但这个行为没有作为显式 policy 被 state、prompt 或文档看到。

另外，现有 iteration 骨架本身已经说明“draft”是独立状态，而不是可以被 `Approved/In Progress` 替代的细节：

- `scripts/orchestrator/iteration_register.mjs` 的 `createIterationSkeleton()` 会在 `plan.md` / `resolution.md` 写入占位文本 `(to be filled by Codex during PLANNING phase)`。
- 这类已登记、已落盘、但仍是占位合同的 iteration，本质上属于 `draft_iteration`，不应与 `executable_iteration` 混用。

`scripts/orchestrator/RETROSPECTIVE_2026-03-21.md` 已进一步确认，下一轮瓶颈不再是状态机主链路是否存在，而是：

- route 选择是否贴近真实工作流
- review 集成边界是否显式化
- 人工升级边界是否能从“隐式 if-else”转为“可裁决策略”

因此，`0203` 的价值不是发明新功能，而是把现有真实瓶颈冻结成明确 contract，给 `0204` 的 escalation engine 和 `0205` 的 observability cleanup 提供稳定前提。

## 当前事实与影响范围

基于 2026-03-21 仓库现状，本 iteration 的直接实现面集中在 `scripts/orchestrator/**` 与 orchestrator SSOT，不涉及产品 runtime 或部署面。

直接影响文件：

- `scripts/orchestrator/orchestrator.mjs`
  - 入口分流
  - `runExistingIteration()` 起始 phase 判定
  - review loop 中的硬编码阈值
- `scripts/orchestrator/state.mjs`
  - batch / iteration 状态持久化
  - 需要承载 route kind 与 review policy
- `scripts/orchestrator/prompts.mjs`
  - planning / review prompt 当前不感知 route kind 与 review policy
- `scripts/orchestrator/test_orchestrator.mjs`
  - 当前已有状态机测试，是最直接的回归面
- `docs/ssot/orchestrator_hard_rules.md`
  - 需要成为三态路由与 `review_policy` 的权威文档

高概率新增的辅助文件：

- `scripts/orchestrator/entry_route.mjs`
- `scripts/orchestrator/review_policy.mjs`

明确不在本 iteration 范围内的文件面：

- `packages/worker-base/src/runtime.js`
- `packages/worker-base/src/runtime.mjs`
- `packages/worker-base/system-models/**`
- `packages/ui-model-demo-frontend/**`
- `packages/ui-model-demo-server/**`
- `deploy/**`
- `k8s/**`
- `.orchestrator/runs/**` 运行时产物

这意味着 `0203` 是 orchestrator tooling / governance 收口，不是 runtime Tier 1 变更，不允许借机扩张到解释器、ModelTable patch 或部署路径。

## 范围

### In Scope

- 定义三态入口模型：`new_requirement / draft_iteration / executable_iteration`
- 定义 route 判定依据：
  - CLI 入口类型
  - `docs/ITERATIONS.md` 状态
  - `plan.md` / `resolution.md` 是否仍是 scaffold 占位合同
- 定义 `review_policy` 数据模型和默认 profile
- 将 route kind 与 `review_policy` 持久化到 orchestrator state
- 让 planning / review / execution 主循环消费显式 policy，而不是直接消费魔法常量
- 为 tri-state routing 和 `review_policy` 增补 deterministic regression tests
- 更新 orchestrator SSOT，使无上下文读者可以理解 CLI 新语义

### Out Of Scope

- 不实现完整 escalation rule engine
- 不实现 oscillation 检测
- 不做 `COMPLETE` / `Batch complete` 收口一致性清理
- 不重构 monitor / events schema / status.txt 展示层
- 不改产品 runtime、server、frontend、deploy、k8s
- 不新增或改动业务 iteration 内容

## 成功标准

- `--prompt` / `--prompt-file` 与 `--iteration <id>` 的责任边界明确，不再依赖隐式猜测。
- `draft_iteration` 与 `executable_iteration` 的判定不再只看 `docs/ITERATIONS.md` 状态，还要看合同是否仍是 scaffold / incomplete。
- `runExistingIteration()` 不再把“已有 iteration”粗暴映射为 `PLANNING` 或 `EXECUTION` 两种起点，而是先完成 route classification。
- 当前 review 控制面中的关键阈值不再散落为主循环常量，而是被统一表示为 `review_policy`。
- `scripts/orchestrator/test_orchestrator.mjs` 或同级定向测试能 deterministic 覆盖：
  - 三态分类
  - invalid route 拒绝
  - `review_policy` 生效
  - review threshold 回归
- `docs/ssot/orchestrator_hard_rules.md` 与代码使用同一套 route 名称、同一套 policy 字段名。

## 约束与不变量

- `0203` 只允许修改 orchestrator tooling 与其治理文档，不得越界到产品运行时与部署面。
- 不改变 `docs/WORKFLOW.md` 的 Phase 定义，不改变 `CLAUDE.md` 的硬规则。
- 不把 `0204` 的 escalation engine 与 oscillation 检测提前混入 `0203`。
- 不把 `0205` 的完成态收口与 observability 清理提前混入 `0203`。
- 不允许出现“路由能跑通，但 route kind / review policy 无法在 state 或文档中解释”的隐式实现。

## 假设与验证方法

- A1：本 iteration 的“三态路由”指 orchestrator CLI 入口路由，不指 runtime 的 pin / CELL_CONNECT / bus 路由。
  - 验证方法：Phase 2 review 必须检查修改面是否仍然严格限于 `scripts/orchestrator/**` 与 orchestrator SSOT。
- A2：`review_policy` 在 `0203` 只负责显式化当前已有阈值与 coarse profile，不负责落地完整 escalation 规则表。
  - 验证方法：Phase 2 review 必须确认 `0203` 没有引入 oscillation engine、复杂失败分类矩阵或额外 observability 面。
- A3：`draft_iteration` 的最小判定口径允许使用现有 scaffold 占位文本和合同完整性，而不要求引入新的外部元数据文件。
  - 验证方法：Phase 3 实施后，测试必须覆盖 scaffold iteration、已完成 plan/resolution 的 `Planned` iteration、`Approved/In Progress` iteration 三类样本。

> 本文件只定义 WHAT / WHY / 边界 / 成功标准，不记录 Step 编号、执行命令、PASS/FAIL、commit 或运行输出。
