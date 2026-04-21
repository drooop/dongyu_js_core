---
title: "编排器硬规则：doit-auto orchestrator"
doc_type: ssot
status: active
updated: 2026-04-21
source: ai
depends_on:
  - execution_governance_ultrawork_doit.md
  - ../WORKFLOW.md
  - ../../CLAUDE.md
---

# 编排器硬规则：doit-auto orchestrator

## 定位

本文件定义 orchestrator（doit-auto 角色）的行为约束。
orchestrator 只做编排与状态推进，不做评审（ultrawork）也不做实现（doit）。

当本文件与更高层规范冲突时，停止并报告（见 CONFLICT_PROTOCOL in CLAUDE.md）。

优先级：CLAUDE.md > execution_governance_ultrawork_doit.md > WORKFLOW.md > 本文件。

---

## §1 角色映射

| orchestrator 行为 | 对应角色 | 调用工具 |
|-------------------|---------|---------|
| 分解需求、调度、推进状态 | doit-auto | orchestrator 自身 |
| 生成 plan/resolution、执行实现 | doit | Codex CLI (`codex exec`) |
| 评审 plan、review 执行结果 | ultrawork | Claude Code CLI (`claude -p --model opus`) |

禁止：
- orchestrator 不得自行评审或实现。
- ultrawork 调用（Claude Code）review 阶段：只读 + 可跑测试，不可编辑文件。
- doit 调用（Codex）execution 阶段：可读写，sandbox = `danger-full-access`。

---

## §2 权威状态（Authoritative State）

### §2.1 状态源

唯一恢复依据：`.orchestrator/runs/<batch_id>/state.json`。

所有其他产物（status.txt、events.jsonl）均为 state.json 的衍生，不可用于恢复。

### §2.2 state.json schema（必须字段）

```
{
  "schema_version": 1,
  "state_revision": 0,
  "batch_id": "<uuid>",
  "prompt_hash": "<sha256 of original user prompt>",
  "created_at": "<ISO 8601>",
  "updated_at": "<ISO 8601>",
  "entry_source": "prompt|prompt_file|iteration|null",
  "entry_route": "new_requirement|draft_iteration|executable_iteration|null",
  "review_policy": {
    "approval_count": 3,
    "major_revision_limit": 3,
    "cli_failure_threshold": 2,
    "risk_profile": "standard|contract_recovery|delivery",
    "escalation_policy": {
      "ambiguous_revision": { "action": "human_decision_required" },
      "parse_failure": { "action": "on_hold_after_threshold", "threshold_source": "cli_failure_threshold", "below_threshold_action": "retry" },
      "max_turns": { "action": "on_hold_after_threshold", "threshold_source": "cli_failure_threshold", "below_threshold_action": "retry" },
      "timeout": { "action": "on_hold_after_threshold", "threshold_source": "cli_failure_threshold", "below_threshold_action": "retry" },
      "process_error": { "action": "on_hold_after_threshold", "threshold_source": "cli_failure_threshold", "below_threshold_action": "retry" },
      "state_doc_inconsistency": { "action": "human_decision_required" },
      "major_revision_limit": { "action": "on_hold" },
      "oscillation": {
        "action": "human_decision_required",
        "threshold": 1,
        "patterns": [
          "APPROVED>NEEDS_CHANGES>APPROVED",
          "NEEDS_CHANGES>APPROVED>NEEDS_CHANGES"
        ]
      }
    }
  },
  "risk_profile": "standard|contract_recovery|delivery|null",
  "primary_goals": [
    { "index": 0, "description": "...", "status": "pending|met|partially_met|not_met|regressed" }
  ],
  "iterations": [
    {
      "id": "<iteration_id>",
      "type": "primary|spawned",
      "status": "pending|active|completed|on_hold|blocked_by_spawn",
      "phase": "INTAKE|PLANNING|REVIEW_PLAN|EXECUTION|REVIEW_EXEC|COMPLETE",
      "spec": { "title": "...", "requirement": "..." },
      "spawned_by": null | "<parent_iteration_id>",
      "blocks": null | "<blocked_iteration_id>",
      "resolves_goals": [0, 2],
      "review_round": 0,
      "major_revision_count": 0,
      "entry_source": "prompt|prompt_file|iteration|null",
      "entry_route": "new_requirement|draft_iteration|executable_iteration|null",
      "review_policy": { "...": "same shape as batch review_policy" },
      "risk_profile": "standard|contract_recovery|delivery|null",
      "registered_in_iterations_md": false,
      "last_checkpoint": "<phase>:<detail>",
      "evidence": {
        "review_records": [...],
        "failures": [...],
        "escalations": [...],
        "oscillations": [...]
      }
    }
  ],
  "current_iteration": "<iteration_id>|null",
  "final_verification": "pending|passed|failed",
  "batch_summary": {
    "lifecycle": "running|awaiting_final_verification|stalled|completed",
    "terminal_outcome": "null|passed|failed|on_hold|blocked_by_spawn",
    "final_verification": "pending|passed|failed",
    "current_iteration": "<iteration_id>|null",
    "counts": {
      "total": 0,
      "completed": 0,
      "active": 0,
      "pending": 0,
      "on_hold": 0,
      "blocked_by_spawn": 0,
      "proposed": 0
    }
  },
  "traceability": [ ... ]
}
```

### §2.2.1 batch_summary（0205 authoritative terminal summary）

- `batch_summary` 是 `0205` 起新增的 authoritative terminal summary。
- 它必须能在 reload 后稳定表达 batch 当前属于：
  - `running`
  - `awaiting_final_verification`
  - `stalled`
  - `completed`
- `terminal_outcome` 只表达 batch 终态结论，不替代 iteration 自身 `status`。
- operator / notify / monitor 在需要判断“batch 是否已真正收口”时，必须优先读取 `state.json.batch_summary`，不得改为从 `status.txt` 文本或 `events.jsonl` message 猜测。
- terminal consumer（例如 wave launcher / operator terminal summary / notify）必须先信 `batch_summary`；如果 top-level `final_verification` 与 `batch_summary.final_verification` 漂移，必须 stop 并暴露不一致，不能按 top-level 继续推进。

### §2.3 原子写入

state.json 变更必须使用 write-to-temp + rename 模式，防止中断导致状态损坏：

```js
fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2))
fs.renameSync(tmpPath, statePath)
```

每次状态转换后必须立即持久化。

### §2.4 Crash Idempotency（崩溃幂等性）

#### 写入顺序（硬规则）

每次状态转换必须按以下严格顺序执行：

1. **events.jsonl 追加**（append，原子性由 OS 文件追加保证）。每条 event 携带当前 `state_revision`。
2. **state.json 提交**（write-to-temp + rename，§2.3）。提交前 `state_revision++`。
3. **status.txt 刷新**（衍生看板，可丢失）。
4. **通知发送**（best-effort，见 §2.5）。

步骤 1-2 是关键路径。步骤 3-4 是尽力而为。

completion-related hard rule（0205）：

- iteration completed / final verification result / batch completed 必须共享同一条 terminal pipeline：
  1. completion-related event append
  2. authoritative state commit
  3. `status.txt` refresh
  4. notify
- completion event payload 不得只靠自由文本表达；至少包含：
  - `scope = iteration | batch`
  - `terminal_outcome`
  - `terminal_summary` 或同等 `state_revision` 关联
- batch complete notify 必须直接消费 `state.json.batch_summary`，不得自行重新统计完成数或重新推断 outcome。

#### 崩溃恢复规则

恢复时，orchestrator 从 state.json 恢复，然后检查一致性：

| 崩溃时点 | state.json 状态 | events.jsonl 状态 | 恢复动作 |
|---------|----------------|-------------------|---------|
| 步骤 1 后、步骤 2 前 | 旧状态（revision N） | 含 revision N+1 的事件 | **以 state.json 为准**。events.jsonl 中 `state_revision > N` 的事件为孤立事件，标记 `orphaned: true` 后重放该步骤。 |
| 步骤 2 后、步骤 3 前 | 新状态（revision N+1） | 含新事件 | 正常恢复。重新生成 status.txt。 |
| 步骤 2 执行中（rename 失败） | 旧状态（temp 文件残留） | 含新事件 | 检测 `state.json.tmp`：若存在且合法 JSON 且 `state_revision == N+1`，执行 rename 完成提交；否则按旧状态恢复。 |

`state_revision` 是单调递增整数。恢复时比对 state.json 的 revision 与 events.jsonl 末尾事件的 revision 即可判断一致性。

#### 幂等性要求

每个状态转换操作必须是幂等的：重复执行同一步骤不产生副作用。
具体地：
- CLI 调用结果已通过 transcript 持久化，重放时先检查 transcript 是否已存在。
- ITERATIONS.md 写入前先检查该条目是否已存在。
- runlog.md 写入使用 append + 唯一 review_index，重复 append 可通过 index 去重。

### §2.5 通知隔离（Notification Isolation）

通知（macOS notification、webhook）是 best-effort 操作，**不得影响状态推进**。

硬规则：
- 通知失败不回滚 state.json。state.json 一旦提交（步骤 2 完成），即为 ground truth。
- 通知失败写一条 `event_type: "error", severity: "warn"` 到 events.jsonl，包含失败原因。
- 通知失败不重试（避免阻塞主循环）。
- 通知代码必须 try-catch 包裹，异常不得向上传播到状态机主循环。

---

## §3 Iteration 注册

### §3.1 注册时点

- **primary iterations**：decompose 确认后、进入任何 Phase 之前，批量登记到 `docs/ITERATIONS.md`。
- **spawned iterations**：spawn 被接受时，立即为其执行完整的 Phase 0 intake：
  1. 分配 id（按 §3.2 格式）。
  2. 创建 `docs/iterations/<id>/` 目录骨架。
  3. 登记到 `docs/ITERATIONS.md`（状态 = Planned）。
  4. 登记完成后，该 iteration 方可进入排队状态（pending）。

注册是 Phase 0 的组成部分，不是 Phase 0 之前的独立动作。

违反：未登记即开始工作 = 违规，orchestrator 必须 abort 该 iteration。

### §3.2 登记格式

遵循 `docs/ITERATIONS.md` 现有表格格式：

```
| <id> | <date> | <title> | <steps> | <branch> | Planned | ./docs/iterations/<id>/ |
```

- id 格式：`<4位序号>-<kebab-desc>`，序号从 ITERATIONS.md 当前最大值 +1 递增。
- spawned iteration id 格式：`<parent_id>s-<kebab-desc>`（s 后缀表示 spawned）。
- branch 格式：`dropx/dev_<id>`。
- 初始状态：`Planned`。

### §3.3 状态更新

orchestrator 负责在以下时点更新 ITERATIONS.md 状态：
- Phase 2 Gate 通过 → `Approved`
- Phase 3 开始 → `In Progress`
- Phase 4 完成 → `Completed`
- 超限 On Hold → `On Hold`

### §3.4 Tri-State Entry Route

orchestrator 的入口不再是“prompt vs iteration”的二分法，而是以下三态 route：

- `new_requirement`
  - 来源：`--prompt` / `--prompt-file`
  - 起始 phase：`PLANNING`
  - 语义：从空白合同创建新 iteration plan/resolution
- `draft_iteration`
  - 来源：`--iteration <id>`，但合同仍为 scaffold，或 Review Gate 尚未允许执行
  - 起始 phase：`PLANNING`
  - 语义：基于既有草稿补完/重写合同（planning `mode=refine`）
- `executable_iteration`
  - 来源：`--iteration <id>`，且合同完整、ITERATIONS 状态已进入 `Approved` / `In Progress`
  - 起始 phase：`EXECUTION`
  - 语义：直接进入 execution / resume 路径

route 判定输入必须同时检查：
- CLI entry source
- `docs/ITERATIONS.md` status
- `plan.md` / `resolution.md` 是否存在
- 合同是否仍包含 scaffold 占位文本

显式阻断（不得 fallback）：
- terminal 状态：`Completed` / `On Hold` / `Cancelled`
- 缺失合同文件：`plan.md` 或 `resolution.md` 不存在

### §3.5 review_policy Model

review loop 的阈值与 coarse escalation 行为必须来自显式 `review_policy`，不得在主循环内硬编码常量。

字段：
- `approval_count`
- `major_revision_limit`
- `cli_failure_threshold`
- `risk_profile`
- `escalation_policy`

当前默认 route-to-policy 映射：

| entry_route | approval_count | major_revision_limit | cli_failure_threshold | risk_profile | escalation_policy |
|---|---:|---:|---:|---|---|
| `new_requirement` | 3 | 3 | 2 | `standard` | explicit failure matrix + oscillation policy |
| `draft_iteration` | 3 | 3 | 2 | `contract_recovery` | explicit failure matrix + oscillation policy |
| `executable_iteration` | 3 | 3 | 2 | `delivery` | explicit failure matrix + oscillation policy |

### §3.6 Failure Matrix / Oscillation Contract

`0204` 起，orchestrator 的 escalation 不再只看 `cli_failure` 粗粒度常量，而是显式 failure matrix：

| failure kind | 默认动作 | 阈值来源 | 阈值前动作 |
|---|---|---|---|
| `parse_failure` | `on_hold` | `review_policy.cli_failure_threshold` | `retry` |
| `max_turns` | `on_hold` | `review_policy.cli_failure_threshold` | `retry` |
| `timeout` | `on_hold` | `review_policy.cli_failure_threshold` | `retry` |
| `process_error` | `on_hold` | `review_policy.cli_failure_threshold` | `retry` |
| `state_doc_inconsistency` | `human_decision_required` | n/a | n/a |
| `ambiguous_revision` | `human_decision_required` | n/a | n/a |
| `major_revision_limit` | `on_hold` | n/a | n/a |
| `oscillation` | `human_decision_required` | `review_policy.escalation_policy.oscillation.threshold` | n/a |

动作语义：
- `retry`：保持当前 phase，继续下一轮 CLI/review 尝试。
- `warn_and_continue`：把 warning 写入 state evidence，但不阻断主循环；此动作只来自 policy override，不得由主循环隐式猜测。
- `human_decision_required`：停止当前恢复/评审路径，等待人类裁决；默认用于 `state_doc_inconsistency`、`ambiguous_revision`、`oscillation`。
- `on_hold`：iteration 进入 `On Hold`，并同步 state/runlog/ITERATIONS 证据。

oscillation 定义：
- `APPROVED -> NEEDS_CHANGES -> APPROVED`
- `NEEDS_CHANGES -> APPROVED -> NEEDS_CHANGES`

硬规则：
- oscillation 检测与 Auto-Approval consecutive count 并存，但**不得互相覆盖**。
- `state_doc_inconsistency` 必须作为显式 failure kind 记录到 `state.json` evidence，不得只打印 stderr。
- `0204` 只负责 failure matrix / oscillation / escalation action；`0205` 才负责 monitor/events/status cleanup 与 observable 收口。

边界：
- `0203` 只负责 tri-state route + `review_policy` 数据模型化与主循环消费。
- `0204` 才负责 failure matrix / oscillation detection / escalation rules engine。
- `0205` 才负责 completion cleanup / monitor-events observable 收口。

---

## §4 修订上限（Major Revision Limit）

### §4.1 硬限制

与 WORKFLOW.md §Phase2 和 execution_governance §Phase1/Phase3 审核规则一致：

- **Phase 2（Review Plan / REVIEW_PLAN）**：上限来自 `review_policy.major_revision_limit`，当前默认值 = 3。
- **Phase 3 审核（Review Exec / REVIEW_EXEC）**：上限来自 `review_policy.major_revision_limit`，当前默认值 = 3。

超过 → 该 iteration 立即转为 **On Hold**，通知用户人工裁决。

### §4.2 Major vs Minor 判定

orchestrator 不自行判定 major/minor。由 Claude Code (ultrawork) 在 review verdict 中做初判：

```json
{
  "verdict": "NEEDS_CHANGES",
  "revision_type": "major|minor|ambiguous",
  "revision_type_rationale": "为什么判定为此类型",
  "blocking_issues": [...]
}
```

处理规则：
- `revision_type: "major"` → major_revision_count++
- `revision_type: "minor"` → 不计数
- `revision_type: "ambiguous"` → orchestrator 必须**停止并请求人类裁决**，不得自行决定是否计入 major 计数
- 判定标准（与 WORKFLOW.md 一致）：影响 scope / 契约 / 验证口径 = major；措辞/格式 = minor

歧义升级规则（与 execution_governance 冲突处理一致）：
reviewer 的初判影响 major revision 计数，进而决定 iteration 是否 On Hold。
当 reviewer 自身无法确定分类时，必须标记 ambiguous 而非强行归类。
orchestrator 遇到 ambiguous 时停止，报告格式遵循 CLAUDE.md CONFLICT_PROTOCOL，
deciding_role = User。

### §4.3 On Hold 行为

iteration 进入 On Hold 时，orchestrator 必须：
1. 更新 state.json 和 ITERATIONS.md 状态为 `On Hold`。
2. 将 On Hold 原因、历次 review record 写入 runlog.md。
3. 发送通知（macOS + webhook）。
4. **不自动生成补救 iteration**。等待用户裁决。
5. 继续执行队列中下一个不被阻塞的 iteration（如有）。

---

## §5 Gate 证据模型

### §5.1 每次状态迁移必须绑定证据

state.json 中每个 iteration 的 `evidence` 字段：

```json
{
  "evidence": {
    "plan_md": "docs/iterations/<id>/plan.md",
    "resolution_md": "docs/iterations/<id>/resolution.md",
    "runlog_md": "docs/iterations/<id>/runlog.md",
    "review_records": [
      {
        "round": 1,
        "phase": "REVIEW_PLAN",
        "revision_type": "major",
        "verdict": "NEEDS_CHANGES",
        "session_id": "<claude_code_session_uuid>",
        "transcript_file": ".orchestrator/runs/<batch_id>/transcripts/<id>_review_plan_r1.json",
        "timestamp": "<ISO 8601>"
      }
    ],
    "failures": [
      {
        "kind": "max_turns|timeout|process_error|json_parse_error|state_doc_inconsistency|major_revision_limit|oscillation|...",
        "normalized_failure_kind": "parse_failure|max_turns|timeout|process_error|state_doc_inconsistency|major_revision_limit|oscillation|...",
        "phase": "REVIEW_PLAN|REVIEW_EXEC|EXECUTION|...",
        "message": "...",
        "timestamp": "<ISO 8601>"
      }
    ],
    "escalations": [
      {
        "failure_kind": "parse_failure|max_turns|timeout|process_error|state_doc_inconsistency|major_revision_limit|oscillation|...",
        "action": "retry|warn_and_continue|human_decision_required|on_hold|continue",
        "reason": "...",
        "threshold_reached": true,
        "timestamp": "<ISO 8601>"
      }
    ],
    "oscillations": [
      {
        "phase": "REVIEW_PLAN|REVIEW_EXEC",
        "pattern": "APPROVED>NEEDS_CHANGES>APPROVED",
        "threshold": 1,
        "detected": true,
        "timestamp": "<ISO 8601>"
      }
    ],
    "validation_commands": [
      { "command": "node scripts/tests/test_xxx.mjs", "result": "PASS", "output_hash": "<sha256>" }
    ],
    "final_commit": "<commit_hash>",
    "branch": "dropx/dev_<id>"
  }
}
```

### §5.2 Review Gate Record

每次 review 必须同时写入：
1. `docs/iterations/<id>/runlog.md`（遵循 WORKFLOW.md Review Gate 记录模板）。
2. state.json `evidence.review_records[]`。
3. 完整 transcript 存入 `.orchestrator/runs/<batch_id>/transcripts/`。

Review Gate 记录模板（照搬 WORKFLOW.md）：

```
Review Gate Record
- Iteration ID: <id>
- Review Date: <ISO date>
- Review Type: AI-assisted (doit-auto orchestrated)
- Review Index: 1/2/3
- Decision: Approved / Change Requested / On Hold
- Revision Type: major / minor / N/A
- Notes: <summary>
```

### §5.3 Auto-Approval Policy

当无人类显式审核时，遵循 WORKFLOW.md Auto-Approval Policy。
连续 `APPROVED` 的阈值来自 `review_policy.approval_count`，当前默认值 = 3。

#### 通过条件（全部满足）

1. 最近连续 `approval_count` 次 review 的 Decision 均为 **Approved**。
2. 这些 review 之间**不夹任何未关闭的 Change Requested**。
3. 每次 review 满足以下**独立性可审计条件**：
   - 不同的 Claude Code `session_id`（不使用 `--continue`，每次为独立进程启动）。
   - 独立的 transcript 文件（存入 `.orchestrator/runs/<batch_id>/transcripts/`）。
   - 独立的 Review Gate Record（写入 runlog.md，含 Review Index）。
4. 所有 review 记录完整写入 runlog.md 和 state.json evidence。

#### orchestrator 实现逻辑

REVIEW_PLAN 阶段：
1. 以新 Claude Code session 执行 review。
2. 如果 NEEDS_CHANGES：
   - 连续 APPROVED 计数归零。
   - 送回 Codex 修改（检查 `review_policy.major_revision_limit` 是否超限）。
   - 修改完成后回到第 1 步（新 session）。
3. 如果 APPROVED：
   - 连续 APPROVED 计数 +1。
   - 如果计数 < `approval_count`：回到第 1 步（新 session，继续独立 review）。
   - 如果计数 = `approval_count`：Gate 通过，进入 EXECUTION。

REVIEW_EXEC 阶段同理。

#### 审计验证

恢复时，orchestrator 必须能从 state.json 的 `evidence.review_records[]` 重建连续 APPROVED 计数。
每条 review_record 包含 session_id 字段，用于验证独立性。

#### session_id 获取与缺失处理

session_id 从 Claude Code `--output-format json` 返回的 `session_id` 字段提取。
此为 Claude Code 原生字段，不可用 PID、时间戳或 transcript 文件名替代。

如果某次 review 的 session_id 缺失（CLI 返回异常或字段为空）：
- 该次 review **不计入** Auto-Approval 连续计数。
- review_record 仍正常写入（session_id 字段标记 `"missing"`），verdict 仍有效。
- orchestrator 需在新 session 补一次独立 review 以恢复连续计数。

---

## §6 串行执行与并发边界

### §6.1 硬规则

v1 明确：**单 active iteration，串行执行**。

- 同一时刻只有一个 iteration 处于 active 状态。
- spawn 只会打断当前 iteration 并插队，不做并行。
- 禁止在同一 worktree 上同时运行多个 iteration 的代码变更。

### §6.2 Spawn 语义

spawn 不是并行分叉，是串行插队：

```
0203 (active, EXECUTION)
  → 发现 blocking issue → spawn 0203s-sse-fix
  → 0203 状态 → blocked_by_spawn
  → 0203s-sse-fix 成为 active → 走完 Phase 0-4
  → 0203s-sse-fix completed → 0203 恢复 active
```

非 blocking spawn：
```
0203 (active, EXECUTION)
  → reviewer 建议非阻塞 improvement → spawn 0203s-improvement
  → 0203 继续执行，不中断
  → 0203s-improvement 进入 pending 队列
  → 0203 完成后，scheduler 按优先级取下一个
```

### §6.3 Spawn 边界分类

spawn 分为两类，权限不同：

**derived_dependency（派生依赖）**
- 定义：为完成已批准 scope 必须补出的前置依赖。
- 判定条件：当前 iteration 的 resolution 无法继续执行，除非先完成该 spawn。
- 权限：orchestrator 可自动登记、排队、执行。无需额外人类确认。
- 约束：spawn 的 scope 不得超出当前 iteration 的已批准 scope 隐含的范围。
- 示例：执行"SSE 路由同步修复"时发现 reconnect handler 有 bug，必须先修。

**scope_expansion（范围扩展）**
- 定义：超出已确认 batch 原始需求的新需求。
- 判定条件：该 spawn 解决的问题不在任何 primary_goal 的 decomposed_requirement 范围内。
- 权限：orchestrator **只能提议，不能自动执行**。
  1. 将提议记录到 state.json（status = `proposed`，type = `scope_expansion`）。
  2. 发送通知给用户。
  3. 用户确认后方可进入 Phase 0 intake。
  4. 用户不确认则丢弃。
- 示例：执行"SSE 路由同步修复"时 reviewer 发现"Gallery 缓存策略需要重构"——这不属于原始 scope。

**分类判定**

由 Claude Code (ultrawork) 在 review verdict 的 `spawned_iterations` 中声明：

```json
{
  "spawned_iterations": [
    {
      "title": "...",
      "reason": "...",
      "spawn_type": "derived_dependency|scope_expansion",
      "blocks_current": true,
      "scope_justification": "为什么属于此分类"
    }
  ]
}
```

如果分类存在歧义，reviewer 必须标记 `spawn_type: "scope_expansion"`（宁严勿松）。

### §6.4 分支策略

- 每个 iteration 必须在 `dropx/dev_<id>` 分支工作。
- spawn 打断时：commit 当前工作（WIP commit），切换到 spawn 分支。
- spawn 完成后：切回被阻塞的 iteration 分支，继续执行。
- 合并路径：iteration 完成 → 本地 merge 到 dev → push dev。

### §6.5 Branch/Worktree Guard

每个 iteration 在 state.json 中持久化 `expected_branch` 字段：

```json
{
  "id": "0203-gallery-remote-load",
  "expected_branch": "dropx/dev_0203-gallery-remote-load",
  ...
}
```

#### 启动/恢复时检查（硬规则）

orchestrator 在开始执行某个 iteration 之前（含恢复场景），必须执行以下检查：

1. **分支匹配**：`git branch --show-current` 的结果必须等于 `expected_branch`。
2. **工作区干净**：`git status --porcelain` 输出为空，或所有变更均属于当前 iteration 的已知文件。
   排除项（不视为脏状态）：
   - `.orchestrator/` 下的所有文件（orchestrator 运行产物）。
   - `.gitignore` 中已忽略的文件（`git status --porcelain` 不含 ignored，但 untracked 中可能有新忽略项）。
   - `docs/ITERATIONS.md`（orchestrator 自身会更新此文件，属于正常写入）。
3. **无未归属变更**：如果 worktree 存在排除项之外的未提交变更且无法确认归属于当前 iteration，视为异常。

#### 检查失败行为

任一检查失败 → 该 iteration 立即转为 **On Hold**，通知用户。

禁止：
- 自动 checkout 到 expected_branch（可能丢失未提交工作）。
- 自动 stash（隐藏问题）。
- 自动 reset（破坏性操作）。

用户裁决后手动恢复分支状态，orchestrator 才可继续。

此规则与 CLAUDE.md 分支规范对齐：`dev_<id>-<desc>` 分支工作，dev 只接受 merge commit。

---

## §7 需求追踪矩阵（Traceability）

### §7.1 结构

state.json `traceability` 字段：

```json
{
  "traceability": [
    {
      "goal_index": 0,
      "goal_description": "修复 SSE 路由同步问题",
      "decomposed_requirement": "SSE 断连后 page sync 状态不一致...",
      "iteration_ids": ["0202-sse-route-sync-fix"],
      "validation_commands": [
        "node scripts/tests/test_0201_route_local_ast_contract.mjs",
        "node scripts/tests/test_0182_app_shell_route_sync_contract.mjs"
      ],
      "validation_results": [
        { "command": "...", "result": "PASS", "at": "<ISO 8601>", "commit": "<hash>" }
      ],
      "status": "pending|met|partially_met|not_met|regressed"
    }
  ]
}
```

### §7.2 追踪规则

- decompose 阶段：每个 primary goal 必须关联到至少一个 iteration。
- iteration 完成时：orchestrator 更新该 goal 关联的 iteration 状态。
- spawn iteration 完成时：如果它解决了某个 goal 的一部分，追加到该 goal 的 iteration_ids。
- Final Verification 时：对每个 goal 逐一运行 validation_commands，记录结果。

### §7.3 Final Verification Gate

- 所有 iteration 完成后触发。
- Claude Code (Opus) 逐一验证每个 primary goal。
- 验证方式：运行 traceability 中的 validation_commands + 读取相关代码 + git diff 检查。
- 输出：逐 goal 的 status + evidence。
- 如果存在 `not_met` 或 `regressed`：
  - orchestrator 将该 goal 标记为失败。
  - **不自动生成补救 iteration**。通知用户裁决。
  - 用户可选择：手动修复 / 授权自动补救 / 接受当前状态。

manual accept hard rules（0231）：

- 正式入口只有：

```bash
bun scripts/orchestrator/orchestrator.mjs --accept-final-verification --batch-id <id> --reason "<why human accepts>"
```

- `--resume is not a manual accept path`。
- `do not edit state.json by hand`。
- manual accept 只允许用于 batch 已进入 terminal lifecycle、且 authoritative `batch_summary.terminal_outcome = failed` 的场景。
- manual accept 必须走 append-only `override evidence`，保留原始 failed terminal event，不得重写或删除既有失败事件。
- `override evidence` 至少包含：
  - `override_kind = manual_final_verification_accept`
  - `previous_terminal_outcome`
  - `new_terminal_outcome`
  - `reason`
- manual accept 成功后，必须同步收口：
  - `state.final_verification = passed`
  - `state.batch_summary.final_verification = passed`
  - `state.batch_summary.terminal_outcome = passed`
  - `state.batch_summary.lifecycle = completed`

---

## §8 目录结构与隔离

### §8.1 按 batch 隔离

```
.orchestrator/
├── runs/
│   └── <batch_id>/
│       ├── state.json           # 唯一恢复源（原子写入）
│       ├── events.jsonl          # 事件日志（衍生）
│       ├── status.txt            # 看板文件（衍生）
│       ├── traceability.json     # 追踪矩阵快照（从 state.json 提取）
│       ├── browser_tasks/        # browser_task batch-local exchange（非 authoritative）
│       │   └── <task_id>/
│       │       ├── request.json
│       │       └── result.json
│       ├── ops_tasks/            # ops_task batch-local exchange + logs/artifacts（非 authoritative）
│       │   └── <task_id>/
│       │       ├── request.json
│       │       ├── result.json
│       │       ├── stdout.log
│       │       ├── stderr.log
│       │       └── artifacts/
│       └── transcripts/          # 完整 CLI 输出存档
│           ├── <id>_planning.json
│           ├── <id>_review_plan_r1.json
│           ├── <id>_review_plan_r2.json
│           ├── <id>_execution.json
│           └── <id>_review_exec_r1.json
└── schemas/
    ├── review_verdict.json
    ├── exec_output.json
    ├── final_verdict.json
    ├── browser_task_request.json
    ├── browser_task_result.json
    ├── ops_task_request.json
    └── ops_task_result.json
```

不使用全局单例文件。每个 batch 完全独立。

### §8.2 .gitignore

`.orchestrator/` 必须加入 `.gitignore`。transcripts 可能包含大量输出，不应进入版本控制。

### §8.3 browser_task exchange / evidence 边界（0218 contract freeze）

- machine-readable contract：
  - `scripts/orchestrator/schemas/browser_task_request.json`
  - `scripts/orchestrator/schemas/browser_task_result.json`
- batch-local exchange（供 0219 bridge / 0220 ingest 使用）：
  - request file：`.orchestrator/runs/<batch_id>/browser_tasks/<task_id>/request.json`
  - result file：`.orchestrator/runs/<batch_id>/browser_tasks/<task_id>/result.json`
- operator-facing local evidence：
  - `output/playwright/<batch_id>/<task_id>/...`
  - 至少允许 `screenshot` / `json` / `trace` / `console`

硬规则：
- request/result exchange file 是 local-only bridge surface，不是 authoritative state。
- `output/playwright/` 中的 artifact 只是 local evidence；即使截图存在，也**不得**直接宣布 browser task PASS。
- 0218 只冻结目录与 contract；0219 实现 bridge consumer，0220 实现 orchestrator ingest / state-event-status wiring，0221 才做真实 MCP smoke 证明。

### §8.4 ops_task exchange / evidence 边界（0226 contract freeze；0227 bridge live；0228 runtime 已接线）

- machine-readable contract：
  - `scripts/orchestrator/schemas/ops_task_request.json`
  - `scripts/orchestrator/schemas/ops_task_result.json`
- batch-local exchange / log / artifact layout（0227 bridge 已实现；0228 ingest 待接线）：
  - task dir：`.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/`
  - request file：`.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/request.json`
  - result file：`.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/result.json`
  - claim file（0227 bridge-local lease marker）：`.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/claim.json`
  - stdout file：`.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/stdout.log`
  - stderr file：`.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/stderr.log`
  - artifacts dir：`.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/artifacts/`

硬规则：
- `ops_task` request/result/stdout/stderr/artifacts 都是 local-only bridge surface，不是 authoritative state。
- `claim.json` 是 0227 bridge-local claim/release 生命周期文件；它可能在任务执行中短暂存在，release/recovery 后消失，不得被当成 authoritative state。
- `stdout.log` / `stderr.log` / `artifacts/` 的存在只说明 executor 曾输出本地证据；没有 orchestrator ingest，不得直接宣布 PASS。
- 0227 当前 live boundary = `scripts/orchestrator/ops_bridge.mjs` + `scripts/orchestrator/ops_executor.mjs`：已实现 external executor bridge、claim/release、local stdout/stderr/result/artifact archive。
- 如果当前只看到 `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/request.json|result.json|claim.json|stdout.log|stderr.log|artifacts/`，而没有 `state.json` / `events.jsonl` / `status.txt` / `runlog.md` 的 ops ingest 引用，结论只能是 `bridge local evidence present`，不得写 PASS。
- `exec_output.json` 中的 `ops_tasks[]` 只声明 machine-readable task metadata；0226 不实现 external executor runtime。
- 0226 只冻结目录与 contract；0227 实现 external executor bridge 与 request/result file exchange；0228 runtime 已接线 authoritative ingest / state-event-status wiring；0229/0230 只负责真实 shell smoke，不再补 phase contract。

---

## §9 事件日志 Schema

### §9.1 events.jsonl 每行格式

```json
{
  "schema_version": 1,
  "batch_id": "<uuid>",
  "event_id": "<uuid>",
  "state_revision": 0,
  "timestamp": "<ISO 8601>",
  "iteration_id": "<id>|null",
  "parent_iteration": "<id>|null",
  "phase": "DECOMPOSE|INTAKE|PLANNING|REVIEW_PLAN|EXECUTION|REVIEW_EXEC|COMPLETE|FINAL_VERIFY",
  "actor": "orchestrator|codex|claude",
  "event_type": "transition|review|spawn|blocked|on_hold|completed|error|notify",
  "severity": "info|warn|error",
  "message": "human-readable description",
  "data": { ... }
}
```

### §9.2 必须记录的事件

| 事件 | event_type | severity |
|------|-----------|----------|
| phase 转换 | transition | info |
| review verdict 返回 | review | info |
| major revision 计数变化 | review | warn |
| spawn 创建 | spawn | warn |
| iteration blocked | blocked | warn |
| iteration on hold | on_hold | error |
| iteration completed | completed | info |
| batch 完成 | completed | info |
| final verification 结果 | review | info/error |
| CLI 调用失败 | error | error |
| 通知发送 | notify | info |

### §9.3 browser_task failure taxonomy / PASS rule / audit mapping（0218）

browser-specific failure kinds（与 `browser_task_result.json` 对齐）：

| failure kind | 语义 |
|---|---|
| `request_invalid` | request 文件缺字段、字段类型错误、路径不符合 contract |
| `executor_unavailable` | browser-capable executor 不可用 |
| `mcp_unavailable` | 需要 MCP 时 Playwright MCP capability 不可用 |
| `timeout` | task 超时 |
| `cancelled` | task 被显式取消 |
| `result_invalid` | result 文件缺字段、字段类型错误、与 request 不匹配 |
| `artifact_missing` | required artifact 缺失 |
| `artifact_mismatch` | artifact 存在但路径/类型/producer/hash 与 contract 不一致 |
| `stale_result` | result attempt 落后于当前 request attempt |
| `duplicate_result` | 同一 request/attempt 被重复回写 result |
| `ingest_failed` | orchestrator 读取 result/artifact 后无法写入 state/event/runlog evidence |
| `browser_bridge_not_proven` | 真实 MCP-backed bridge 未被证明；仅有 mock/文案/孤立 artifact |

browser task PASS 的必要条件（全部满足）：
1. `result.status = pass`
2. request 中所有 `required_artifacts` 均真实存在于 `output/playwright/<batch_id>/<task_id>/...`
3. orchestrator 已把该 task/result 写入自己的 evidence chain；没有 ingest 证据时，最多只能算“local evidence present”，不得算 PASS

四类审计面映射（0218 冻结 contract，0220 已实现 wiring）：
- `state.json`
  - 当前 runtime 以 authoritative 方式记录 browser task ingest 结果，至少覆盖：
    - `task_id`
    - `attempt`
    - `status`
    - `failure_kind`
    - `request_file`
    - `result_file`
    - `artifact_paths`
    - `ingested_at`
  - 这些字段当前存于 iteration `evidence.browser_tasks[]`，下游实现不得换名或绕开 authoritative state
- `events.jsonl`
  - 当前 runtime 为 browser lifecycle 写 `event_type = browser_task` 的结构化 event，并在 `data` 中携带至少：
    - `task_id`
    - `attempt`
    - `status`
    - `failure_kind`
    - `request_file`
    - `result_file`
- `status.txt`
  - 当前 runtime 至少暴露：
    - `Browser Task:`
    - `Browser Attempt:`
    - `Browser Status:`
    - `Browser Failure Kind:`
  - 这些字段是 `state.json` 的投影，不得成为恢复源
- `runlog.md`
  - 当前 derived-doc helper 追加 browser task 记录时，必须引用：
    - request file 路径
    - result file 路径
    - required artifact 路径
    - 最终 PASS / FAIL 与 failure kind
  - 状态提交顺序仍是：browser lifecycle event → state commit → status refresh → runlog append

禁止：
- 只凭 `output/playwright/` 中的 screenshot/json 就把 iteration 标记为 PASS
- 只写 runlog prose，不写 request/result/artifact 路径
- 把 browser result 文件当成新的 authoritative state，绕过 `state.json`

### §9.4 ops_task failure taxonomy / PASS rule / audit mapping（0226）

ops-specific failure kinds（与 `ops_task_result.json` 对齐）：

| failure kind | 语义 |
|---|---|
| `request_invalid` | request 缺字段、字段类型错误、路径不符合 canonical contract |
| `executor_unavailable` | external ops executor 不可用 |
| `target_unreachable` | 目标环境不可达（例如本地 cluster / 远端 host / 远端 kubectl 无法连接） |
| `timeout` | task 超时 |
| `cancelled` | task 被显式取消 |
| `result_invalid` | result 缺字段、字段类型错误、与 request 不匹配 |
| `nonzero_exit` | command 已执行但退出码非 0 |
| `assertion_failed` | executor 无法证明 request.success_assertions 全部满足 |
| `artifact_missing` | required artifact 缺失 |
| `artifact_mismatch` | artifact 路径/类型/hash/producer 与 contract 不一致 |
| `remote_guard_blocked` | remote safety guard 未通过（例如 `remote_preflight_guard.sh` 失败、socket 不匹配、权限不足、guard 前置未满足） |
| `forbidden_remote_op` | request 命中 `CLAUDE.md` 的 absolute prohibitions（例如 `k3s`、`systemctl` cluster runtime、`/etc/rancher`、CNI、防火墙、网络接口改动） |
| `stale_result` | result attempt 落后于当前 request attempt |
| `duplicate_result` | 同一 request/attempt 被重复回写 result |
| `ingest_failed` | orchestrator 读取 result/stdout/stderr/artifacts 后无法写入 state/event/runlog evidence |
| `ops_bridge_not_proven` | executor/runtime 只停留在 mock/文案/孤立日志，尚未证明真实 shell bridge 可用 |

remote safety stop rules（0226 冻结边界，0227/0228/0230 不得改名）：
- allowed：
  - 仅限 `CLAUDE.md` 明确允许的 cluster operations / image operations / file transfer，以及经 `ops_task` contract 声明的 local readonly / local mutating / remote readonly / remote mutating whitelist surface
- forbidden：
  - 一旦 request 命中 `CLAUDE.md` `REMOTE_OPS_SAFETY` 的 absolute prohibitions，必须以 `forbidden_remote_op` 停止；不得降级成 warning、不得伪装成 `nonzero_exit`
- human-decision-required：
  - `kubectl delete namespace`
  - `helm uninstall`
  - 任何可能影响其他 namespace 或 cluster-wide resources 的操作
  - 这些是 orchestration stop rules，不是 bridge 自行裁量的 pass/fail；orchestrator 必须进入 `human_decision_required` / `On Hold`，等待人类确认与 rollback plan
- guard blocked：
  - remote task 若缺少 `remote_preflight_guard.sh` 前置、rke2 判定失败、containerd socket 不可达、root/权限不足，必须以 `remote_guard_blocked` 停止；不得继续尝试 mutating op

ops task PASS 的必要条件（全部满足）：
1. `result.status = pass`
2. `exit_code = 0`
3. pass result 按 contract 语义表示 request 中所有 `success_assertions` 已满足；若 executor 无法证明，必须返回 `assertion_failed` 或其他 non-pass failure kind
4. request 中所有 `required_artifacts` 均真实存在于 canonical `artifacts/` 目录，并与 result manifest 一致
5. orchestrator 已把该 task/result/stdout/stderr/artifact 引入自己的 evidence chain；没有 ingest 证据时，最多只能算“local logs/artifacts present”，不得算 PASS

0227 bridge live 的 operator 读法：
- 可以把 canonical task dir 内的 `request.json` / `result.json` / `claim.json` / `stdout.log` / `stderr.log` / `artifacts/` 视为 bridge-local evidence
- bridge-local evidence 只证明 external executor bridge 已运行过；若缺少 0228 authoritative ingest，只能判为 `bridge local evidence present`

四类审计面映射（0228 runtime 已接线）：
- `state.json`
  - 0228 runtime 已以 authoritative 方式记录 ops task ingest 结果，至少覆盖：
    - `task_id`
    - `attempt`
    - `status`
    - `failure_kind`
    - `request_file`
    - `result_file`
    - `stdout_file`
    - `stderr_file`
    - `exit_code`
    - `artifact_paths`
    - `ingested_at`
  - 这些字段当前存于 iteration `evidence.ops_tasks[]`，下游实现不得换名或绕开 authoritative state
- `events.jsonl`
  - 0228 runtime 当前会写 `event_type = ops_task` 的结构化 event，并在 `data` 中至少携带：
    - `task_id`
    - `attempt`
    - `status`
    - `failure_kind`
    - `request_file`
    - `result_file`
    - `stdout_file`
    - `stderr_file`
    - `exit_code`
- `status.txt`
  - 0228 runtime 当前至少暴露：
    - `Ops Task:`
    - `Ops Attempt:`
    - `Ops Status:`
    - `Ops Failure Kind:`
    - `Ops Exit Code:`
  - 这些字段是 `state.json` 的投影，不得成为恢复源
- `runlog.md`
  - 0228 derived-doc helper 当前追加 ops task 记录时，必须引用：
    - request file 路径
    - result file 路径
    - stdout file 路径
    - stderr file 路径
    - required artifact 路径
    - 最终 PASS / FAIL、failure kind、exit_code
  - 状态提交顺序仍是：ops lifecycle event → state commit → status refresh → runlog append

0228 runtime 已接线后的恢复边界：
- `--resume` 必须先信 `state.json.evidence.ops_tasks[]`，再回看 `.orchestrator/runs/<batch_id>/ops_tasks/<task_id>/...`
- 如果 task dir 内只有 `result.json` / `stdout.log` / `stderr.log` / `artifacts/`，但 `state.json` 没有 pending ops task，结论只能是 bridge-local evidence present，不能恢复成 PASS
- `forbidden_remote_op` 维持 explicit `On Hold` stop；`kubectl delete namespace` / `helm uninstall` 等 critical remote op 在 request preflight 就必须进入 `human_decision_required` / `On Hold`

禁止：
- 只凭 `stdout.log` / `stderr.log` / `artifacts/` 就把 iteration 标记为 PASS
- 只写 runlog prose，不写 request/result/stdout/stderr/artifact 路径
- 把 ops result 文件当成新的 authoritative state，绕过 `state.json`

---

## §10 通知

### §10.1 通知触发点

| 事件 | 通知方式 |
|------|---------|
| iteration completed | macOS notification |
| iteration on_hold（需人工裁决） | macOS notification + webhook |
| spawn created | macOS notification |
| batch completed | macOS notification + webhook |
| final verification failed | macOS notification + webhook |
| CLI error（连续 2 次失败） | macOS notification |

### §10.2 实现

- macOS：`osascript -e 'display notification ...'`
- webhook：POST JSON to `config.webhook_url`（可选配置）
- 通知失败不阻塞主流程。

---

## §11 Decompose（Phase -1）

### §11.1 触发

用户以自然语言输入需求。orchestrator 调用 Claude Code (Opus) 分析 codebase + 需求，输出结构化任务列表。

### §11.2 输出要求

```json
{
  "analysis": "对需求的整体理解",
  "iterations": [
    {
      "title": "...",
      "requirement": "...",
      "scope": "small|medium|large",
      "depends_on": [],
      "resolves_goals": [0],
      "validation_approach": "预期的验证方式"
    }
  ],
  "execution_order": [0, 1, 2],
  "risks": ["..."]
}
```

### §11.3 确认 Gate

decompose 完成后，orchestrator 暂停并展示计划。用户选择：
- **确认**：进入自动执行。
- **编辑**：修改任务列表后确认。
- **追加**：追加需求后重新 decompose。
- **取消**：终止。

确认后，orchestrator 批量登记所有 primary iteration 到 ITERATIONS.md，然后进入主循环。

### §11.4 --auto-confirm

如果用户传入 `--auto-confirm` 参数，跳过确认 Gate，直接进入执行。
此时 decompose 结果仍然写入 state.json 并展示到 stderr，但不等待交互。

---

## §12 Conformance Review（继承自 WORKFLOW.md）

每次 Phase 3 实现和 Phase 3 审核（REVIEW_EXEC）必须评估：
1. Tier 1 / Tier 2 边界
2. 负数系统模型 / 正数业务模型放置边界
3. 数据所有权
4. 数据流向
5. 数据链路是否存在跳层/绕过

此要求包含在 Claude Code review prompt 中，不由 orchestrator 自行判断。

---

## §13 Driver 权限配置

### §13.1 Claude Code（ultrawork 角色）

review 阶段 allowedTools：
```
Read, Grep, Glob,
Bash(git:*), Bash(node:*), Bash(bun:*),
Agent, Skill
```

禁止：Edit, Write, Bash(rm:*), Bash(mv:*)

模型：opus
max-turns：10
output-format：json

### §13.2 Codex（doit 角色）

Planning 阶段：
```
codex exec --full-auto -s workspace-write -m gpt-5.4
```

Execution 阶段：
```
codex exec --full-auto -s danger-full-access -m gpt-5.4
```

### §13.3 输出捕获

- Codex：`-o <file>` 写最终消息 + `--json` 写 JSONL 事件流到 transcript。
- Claude Code：`--output-format json` 写完整 agent 记录到 transcript。

---

## §14 冲突处理

当 orchestrator 遇到以下情况，必须停止并通知用户：

1. state.json 与 ITERATIONS.md 状态不一致。
2. Review verdict 无法解析（PARSE_ERROR 连续 2 次）。
3. Codex 或 Claude Code CLI 调用失败（timeout / crash）连续 2 次。
4. iteration 分支与 dev 存在 merge conflict 且无法自动解决。
5. 本文件与 WORKFLOW.md / execution_governance 的规则冲突。

报告格式遵循 CLAUDE.md CONFLICT_PROTOCOL。

---

## §15 监控

### §15.1 三层监控

| 层级 | 载体 | 刷新时机 | 用途 |
|------|------|---------|------|
| 实时流 | stderr | 持续 | 当前 CLI 工具的执行进度 |
| 状态看板 | status.txt | 每次状态转换 | 整体进度概览 |
| 事件日志 | events.jsonl | 每次事件 | 完整审计历史 |

### §15.2 内置 --monitor 子命令

```bash
bun scripts/orchestrator/orchestrator.mjs --monitor [--batch-id <id>]
```

功能：轮询 status.txt + tail events.jsonl，在终端内渲染看板。
不依赖 `watch` 命令。使用 `while + sleep 2 + clear` 实现。

### §15.3 terminal observability contract（0205）

- `status.txt` 在 terminal path 上至少暴露以下字段：
  - `Batch Lifecycle:`
  - `Batch Outcome:`
  - `Final Verification:`
  - `State Revision:`
- 当 batch 已完成时：
  - `Phase:` 必须显示 `terminal`
  - 不得继续依赖 `Current:` / `Done:` 等字段制造“仍在运行”的暗示
- 当存在 active iteration 时：
  - `Phase:` 中的 major revision 上限必须来自该 iteration 的 `review_policy.major_revision_limit`
  - 不允许继续写死 `/3`
- `events.jsonl` / `--monitor` recent events 对 completion 类事件必须显示结构化 scope label，例如：
  - `[iteration:completed]`
  - `[batch:passed]`
- monitor 的 recent event rendering 必须直接消费 event payload (`scope` / `terminal_outcome`)，不得通过 `message === "Batch complete"` 等自由文本反推 scope。

---

## §16 实施范围（v1）

v1 明确包含：
- decompose + confirm gate
- 串行 iteration 执行（Phase 0-4）
- 3 次 major revision 限制 + On Hold
- Auto-Approval Policy（3 次独立 APPROVED）
- blocking spawn 插队
- 非 blocking spawn 入队
- 需求追踪矩阵
- Final Verification Gate（不自动补救）
- 三层监控 + macOS 通知
- batch 隔离目录
- 断点恢复

v1 明确不包含：
- 并行 iteration 执行
- 自动补救 iteration 生成
- Web dashboard
- Webhook 通知（预留接口，不实现）
- Codex session resume（v1 每次 exec 均为新 session）

---

## 变更记录

| 日期 | 变更 | 原因 |
|------|------|------|
| 2026-03-21 | 初始版本 | orchestrator v0→v1 design freeze |
| 2026-03-21 | §3 spawn 注册 = Phase 0 intake | spawn 登记是 Phase 0 的组成部分，不是前置动作 |
| 2026-03-21 | §4.2 major/minor 歧义升级 | reviewer 初判 + ambiguous 时停止请求人类裁决 |
| 2026-03-21 | §5.3 独立性可审计条件 | session_id + transcript + review record + 连续 3 次无夹杂 |
| 2026-03-21 | §2.4 crash idempotency | 写入顺序、崩溃恢复规则、幂等性要求 |
| 2026-03-21 | §6.3 spawn 边界分类 | derived_dependency (自动) vs scope_expansion (仅提议) |
| 2026-03-21 | §6.5 branch/worktree guard | 恢复时分支/工作区检查，失败即 On Hold |
| 2026-03-21 | §5.3 session_id 缺失不计入 | 禁止用 PID/时间戳/文件名替代原生 session_id |
| 2026-03-21 | §2.2+§9.1 state_revision | 单调递增，event 携带 revision 便于孤立判断 |
| 2026-03-21 | §6.5 工作区排除项 | .orchestrator/、gitignored、ITERATIONS.md 不视为脏 |
| 2026-03-21 | §2.5 通知隔离 | notify best-effort，失败写 event 不回滚 state |
| 2026-03-22 | §2.2/§2.4/§15 completion observability cleanup | 增加 `batch_summary`、completion structured payload、terminal status/event contract |
