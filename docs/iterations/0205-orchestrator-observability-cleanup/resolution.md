---
title: "0205 — Resolution (HOW)"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0205-orchestrator-observability-cleanup
id: 0205-orchestrator-observability-cleanup
phase: phase1
---

# 0205 — Resolution (HOW)

## 0. Execution Rules

- Work branch: `dropx/dev_0205-orchestrator-observability-cleanup`
- Working directory for every command: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- This iteration changes orchestrator tooling and orchestrator docs only.
- `packages/**`, runtime source, `deploy/**`, `k8s/**`, remote ops, tri-state routing, escalation rules, and human-decision UI are out of scope.
- Steps must be executed in order.
- Every Step must leave deterministic evidence in `docs/iterations/0205-orchestrator-observability-cleanup/runlog.md`.
- If implementation starts changing `entry_route` / `review_policy` / escalation behavior, or expands into product runtime/deploy concerns, stop and return to Phase 1.

## 1. Planned Change Surface

Primary implementation files:

- `scripts/orchestrator/orchestrator.mjs`
- `scripts/orchestrator/monitor.mjs`
- `scripts/orchestrator/events.mjs`
- `scripts/orchestrator/state.mjs`
- `scripts/orchestrator/notify.mjs`
- `scripts/orchestrator/test_orchestrator.mjs`
- `docs/ssot/orchestrator_hard_rules.md`
- `docs/user-guide/orchestrator_local_smoke.md`

Files that must remain untouched unless Phase 1 is revised:

- `scripts/orchestrator/entry_route.mjs`
- `scripts/orchestrator/review_policy.mjs`
- `scripts/orchestrator/escalation_engine.mjs`
- `scripts/orchestrator/drivers.mjs`
- `scripts/orchestrator/scheduler.mjs`
- `packages/**`
- `deploy/**`
- `k8s/**`

## 2. Steps Overview

| Step | Title | Goal | Key Files | Validation | Rollback |
|------|-------|------|-----------|------------|----------|
| 1 | Freeze Terminal Contract In Tests And State | 把 iteration completion、final verification、batch completion 的 authoritative contract 先冻结到 state/test 层，避免 monitor/event 修补继续无锚点 | `state.mjs`, `test_orchestrator.mjs`, `orchestrator.mjs` | `bun scripts/orchestrator/test_orchestrator.mjs` | 回退本 Step 对 state/main-loop/test 的提交 |
| 2 | Normalize Completion Write Order And Batch Summary | 让 completion event、state commit、status refresh、notify 使用单一终态顺序，不再出现 batch completed 与 state/status 各自半步错位 | `orchestrator.mjs`, `events.mjs`, `state.mjs`, `notify.mjs`, `test_orchestrator.mjs` | `bun scripts/orchestrator/test_orchestrator.mjs` | 回退本 Step 对 completion write path 的提交 |
| 3 | Clean Monitor And Event Observability Surface | 让 `status.txt` / `--monitor` / `events.jsonl` 对终态使用同一术语与数据来源，并清理硬编码/自由文本依赖 | `monitor.mjs`, `events.mjs`, `orchestrator.mjs`, `test_orchestrator.mjs` | `bun scripts/orchestrator/test_orchestrator.mjs` | 回退本 Step 对 monitor/event/test 的提交 |
| 4 | Sync SSOT And Operator Runbook | 把 completion cleanup 与 observability contract 写回 SSOT / runbook，并复验代码与文档一致 | `docs/ssot/orchestrator_hard_rules.md`, `docs/user-guide/orchestrator_local_smoke.md`, `test_orchestrator.mjs` | `bun scripts/orchestrator/test_orchestrator.mjs` | 回退本 Step 的文档与测试提交 |

## 3. Step Details

### Step 1 — Freeze Terminal Contract In Tests And State

**Goal**

- 先为 `0205` 建立 deterministic 的终态回归锚点，防止后续实现只是在 monitor 或 message 文本层“看起来更对”，但 authoritative state 仍然模糊。

**Scope**

- 更新 `scripts/orchestrator/test_orchestrator.mjs`
  - 新增 terminal closure 回归用例。
  - 至少覆盖：
    - iteration 进入 `COMPLETE` 后的最终 `status`
    - `final_verification` 从 `pending` 进入 `passed/failed`
    - batch 收尾后 `current_iteration === null`
    - `status.txt` 与 `events.jsonl` 的终态断言
- 更新 `scripts/orchestrator/state.mjs`
  - 若当前顶层字段不足以唯一表达 batch 完成态，则增加显式终态摘要或等价 helper，使 batch 是否已完成不必依赖 `status.txt` 或事件 message 猜测。
  - 保证新增字段/summary 在 reload state 后仍可读取。
- 必要时更新 `scripts/orchestrator/orchestrator.mjs`
  - 让主循环写出 Step 1 所需的 authoritative terminal facts，但暂不在本 Step 解决 monitor/event 展示细节。

**Files**

- Update:
  - `scripts/orchestrator/state.mjs`
  - `scripts/orchestrator/orchestrator.mjs`
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
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "Batch complete|Final Verification|current_iteration|completed|status.txt" scripts/orchestrator/state.mjs scripts/orchestrator/orchestrator.mjs scripts/orchestrator/test_orchestrator.mjs
```

**Acceptance Criteria**

- terminal closure 已经被测试显式覆盖，不再只靠 retrospective 文字描述。
- authoritative state 能被 deterministic 地解释为“运行中 / 已完成 / 已完成但验证失败”等终态。
- reload 后的 `state.json` 仍能提供同一份终态解释。

**Rollback Strategy**

- 回退本 Step 对 `state.mjs`、`orchestrator.mjs`、`test_orchestrator.mjs` 的提交。
- 若终态字段设计在评审中被认定不稳定，先回退该 Step，再重审 state contract 后继续。

---

### Step 2 — Normalize Completion Write Order And Batch Summary

**Goal**

- 把 iteration completion、final verification、batch completion 的写入顺序统一为一条可解释链路，避免出现 completed event 已写出，但 `state.json` / `status.txt` 仍停留在前一拍的情况。

**Scope**

- 更新 `scripts/orchestrator/orchestrator.mjs`
  - 把 batch 收尾收敛为单一 helper 或单一顺序：
    - completion-related event
    - authoritative state commit
    - `status.txt` refresh
    - notify
  - 不允许继续保留“notify 先于 completed event”或“batch completed event 不参与衍生面刷新”的路径。
  - iteration `COMPLETE` 与 batch `Batch complete` 必须使用一致的终态推进规则。
- 更新 `scripts/orchestrator/events.mjs`
  - 为 batch completed 与 iteration completed 提供稳定的事件表达方式。
  - 事件 payload 至少要能区分：
    - scope = iteration / batch
    - terminal outcome
    - 对应 state revision 或终态摘要
- 更新 `scripts/orchestrator/state.mjs`
  - 若 Step 1 引入显式终态摘要，本 Step 负责让 batch 完成事件与通知使用同一份 state 事实。
- 更新 `scripts/orchestrator/notify.mjs`
  - batch complete 通知内容若来自完成计数或终态摘要，必须直接消费 authoritative state，而不是再次自行推导。
- 更新 `scripts/orchestrator/test_orchestrator.mjs`
  - 回归覆盖 completion write order 与 batch summary。

**Files**

- Update:
  - `scripts/orchestrator/orchestrator.mjs`
  - `scripts/orchestrator/events.mjs`
  - `scripts/orchestrator/state.mjs`
  - `scripts/orchestrator/notify.mjs`
  - `scripts/orchestrator/test_orchestrator.mjs`

**Validation (Executable)**

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_orchestrator.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "notifyBatchComplete|Batch complete|event_type: 'completed'|final_verification|state_revision" scripts/orchestrator/orchestrator.mjs scripts/orchestrator/events.mjs scripts/orchestrator/state.mjs scripts/orchestrator/notify.mjs scripts/orchestrator/test_orchestrator.mjs
```

**Acceptance Criteria**

- 不再存在 batch complete 只靠 event message 表示、但 state/status 没有同步终态摘要的路径。
- batch completion 的事件、state、notify 使用同一份终态来源。
- 终态写入顺序可以被 SSOT 与测试共同解释，而不是只能靠阅读主循环代码理解。

**Rollback Strategy**

- 回退本 Step 对 `orchestrator.mjs`、`events.mjs`、`state.mjs`、`notify.mjs`、`test_orchestrator.mjs` 的提交。
- 若 write order 调整导致 crash/recovery 语义不再清晰，恢复到 Step 1 状态并重新审定 completion pipeline。

---

### Step 3 — Clean Monitor And Event Observability Surface

**Goal**

- 让 `status.txt`、`--monitor` 与 `events.jsonl` 成为同一份终态 contract 的不同投影，而不是三个各自“差不多”的观察面。

**Scope**

- 更新 `scripts/orchestrator/monitor.mjs`
  - 在 `status.txt` 中显式展示 batch 终态摘要，而不是只从 active iteration 角度拼装当前看板。
  - 当 batch 已完成时，不应继续保留误导性的运行中表述。
  - `Phase:` 或同类终端展示若保留 review limit，必须消费 iteration 自身 policy/summary，不允许继续写死 `/3`。
- 更新 `scripts/orchestrator/events.mjs`
  - 调整 recent event 呈现依赖，使 monitor 不需要通过自由文本猜测“这是 batch 级 completed 还是 iteration 级 completed”。
- 必要时更新 `scripts/orchestrator/orchestrator.mjs`
  - 保证 `refreshStatus()` 在 terminal path 上不会漏掉完成事件或终态摘要。
- 更新 `scripts/orchestrator/test_orchestrator.mjs`
  - 新增 monitor/status 的 terminal assertions，而不仅是基础 smoke。

**Files**

- Update:
  - `scripts/orchestrator/monitor.mjs`
  - `scripts/orchestrator/events.mjs`
  - `scripts/orchestrator/orchestrator.mjs`
  - `scripts/orchestrator/test_orchestrator.mjs`

**Validation (Executable)**

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_orchestrator.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "Done:|Active:|Final Verification:|Current:|Phase:|Batch complete|Latest Events|major" scripts/orchestrator/monitor.mjs scripts/orchestrator/events.mjs scripts/orchestrator/orchestrator.mjs scripts/orchestrator/test_orchestrator.mjs
```

**Acceptance Criteria**

- monitor 能明确区分运行中 batch 与 terminal batch。
- `status.txt` 不再长期出现 `Batch complete` 与运行中计数/当前 iteration 并存的误导性组合。
- monitor/event 输出不再依赖 message 文本猜测 completed scope。
- review limit 展示不再写死 `3`。

**Rollback Strategy**

- 回退本 Step 对 `monitor.mjs`、`events.mjs`、`orchestrator.mjs`、`test_orchestrator.mjs` 的提交。
- 若 monitor 清理导致运行中看板可读性下降，先回退本 Step，再重新评审展示 contract。

---

### Step 4 — Sync SSOT And Operator Runbook

**Goal**

- 把 `0205` 的完成态与 observability contract 写成仓库内可独立理解的规范，而不是只存在于实现细节和 runlog 里。

**Scope**

- 更新 `docs/ssot/orchestrator_hard_rules.md`
  - 明确 authoritative terminal state 的字段或等价 contract
  - 明确 completion write order
  - 明确 batch completed / iteration completed 的事件边界
  - 明确 `status.txt` / `events.jsonl` / `state.json` 在 terminal path 上各自负责什么
  - 明确 `0205` 与 `0203` / `0204` 的最终边界
- 更新 `docs/user-guide/orchestrator_local_smoke.md`
  - 说明操作者如何判定 batch 已真实完成
  - 说明若看到 completed event 与 status 看板不一致，应优先检查哪一层
  - 说明新的 `status.txt` / `events.jsonl` 终态字段或摘要如何阅读
- 更新 `scripts/orchestrator/test_orchestrator.mjs`
  - 保持 docs-sync assertions 与实现术语一致

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
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "Batch complete|status.txt|events.jsonl|state.json|Final Verification|completed" docs/ssot/orchestrator_hard_rules.md docs/user-guide/orchestrator_local_smoke.md
```

**Acceptance Criteria**

- SSOT、runbook、代码、测试对终态字段、write order、completed event 术语完全一致。
- 无上下文操作者只靠仓库文档即可理解“batch 是否完成”和“遇到不一致时以哪一层为准”。
- 本 Step 没有把 tri-state routing、escalation engine 或产品 runtime 变更混入 `0205`。

**Rollback Strategy**

- 回退本 Step 对 `docs/ssot/orchestrator_hard_rules.md`、`docs/user-guide/orchestrator_local_smoke.md`、`test_orchestrator.mjs` 的提交。
- 若文档评审发现术语与实现不一致，先回退文档与相关测试，再回到 Step 1-3 修正代码 contract。

## 4. Overall Acceptance

- orchestrator 的 iteration completion、final verification、batch completion 已形成单一、可恢复、可观测的终态 contract。
- `state.json`、`status.txt`、`events.jsonl` 在 terminal path 上不再各自表达半套真相。
- `--monitor` 能在运行中与完成后都提供不歧义的看板。
- terminal closure regression 已被 deterministic 冻结，retrospective 中提到的不一致不再只能靠人工经验发现。
- 变更面没有扩散到 route、escalation、runtime、frontend、server、deploy 或 k8s。

## 5. Overall Rollback

若整个 iteration 在 Phase 3 执行后需要整体回退，按以下顺序操作：

1. 回退 Step 4 的 SSOT、runbook 与相关测试变更。
2. 回退 Step 3 的 monitor/event observable surface 清理。
3. 回退 Step 2 的 completion write order、batch summary 与 notify 接线。
4. 回退 Step 1 的 terminal state contract 与回归锚点。

回退原则：

- 只回退 `0205` 引入的 orchestrator 文件与文档变更。
- 不回退同一工作树中与本 iteration 无关的用户改动。
- 每次回退后都必须重新执行 `bun scripts/orchestrator/test_orchestrator.mjs`，并把事实结果写回 `runlog.md`。

> 本文件只定义 HOW；不得记录 PASS/FAIL、命令输出、commit hash 或真实执行结果。
