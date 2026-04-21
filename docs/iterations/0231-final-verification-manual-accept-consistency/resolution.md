---
title: "0231 — final-verification-manual-accept-consistency Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0231-final-verification-manual-accept-consistency
id: 0231-final-verification-manual-accept-consistency
phase: phase1
---

# 0231 — final-verification-manual-accept-consistency Resolution

## HOW

实现采用“正式 operator 入口 + authoritative state helper + append-only override evidence + consumer 对齐 + docs/test 收口”的顺序推进。

核心原则：

- 不再依赖人工直接改 `.orchestrator/runs/<batch_id>/state.json`
- 不用 `--resume` 充当 final verification manual accept
- 保留原始 failed terminal event，只追加新的人工接受证据
- 让 `batch_summary` 成为 terminal consumer 的唯一 authoritative summary

## Preconditions

- Working directory:
  - `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Target branch:
  - `dropx/dev_0231-final-verification-manual-accept-consistency`
- Bun must be available for `scripts/orchestrator/*.mjs`
- Execution will mutate two local sample batches for proof:
  - `7ff3735e-abf6-4cab-b024-8d474e66673b`
  - `6d22aa18-43a7-4cd6-8e9c-823e2e6b23bb`
- Run once before Step 2 to preserve those samples:

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && mkdir -p /tmp/0231-final-verification-manual-accept-consistency && rm -rf /tmp/0231-final-verification-manual-accept-consistency/7ff3735e-abf6-4cab-b024-8d474e66673b /tmp/0231-final-verification-manual-accept-consistency/6d22aa18-43a7-4cd6-8e9c-823e2e6b23bb && cp -R .orchestrator/runs/7ff3735e-abf6-4cab-b024-8d474e66673b /tmp/0231-final-verification-manual-accept-consistency/7ff3735e-abf6-4cab-b024-8d474e66673b && cp -R .orchestrator/runs/6d22aa18-43a7-4cd6-8e9c-823e2e6b23bb /tmp/0231-final-verification-manual-accept-consistency/6d22aa18-43a7-4cd6-8e9c-823e2e6b23bb
```

## Step Summary

| Step | Name | Purpose | Primary files | Verification | Rollback |
|---|---|---|---|---|---|
| 1 | Add Manual-Accept Contract And Entry | 提供正式 `Final Verification` manual accept CLI 与 authoritative state/event helper | `scripts/orchestrator/orchestrator.mjs`, `scripts/orchestrator/state.mjs`, `scripts/orchestrator/events.mjs`, `scripts/orchestrator/test_orchestrator.mjs` | test suite + symbol grep | 回退 CLI flag、helper 和相关测试 |
| 2 | Sync Terminal State And Consumer Decisions | 用正式入口修复真实样本，并让 wave terminal consumer 遵守 `batch_summary` authority | `scripts/orchestrator/orchestrator.mjs`, `scripts/orchestrator/wave_launcher_lib.mjs`, `scripts/orchestrator/test_orchestrator.mjs` | sample accept commands + state/status assertions + test suite | 恢复 `/tmp/0231-final-verification-manual-accept-consistency/` 备份并回退 consumer 改动 |
| 3 | Freeze Operator Docs And Audit Rules | 把 manual accept、`--resume` 边界、append-only override evidence 写入 SSOT 与 runbook | `docs/ssot/orchestrator_hard_rules.md`, `docs/user-guide/orchestrator_local_smoke.md`, `scripts/orchestrator/test_orchestrator.mjs` | docs grep + test suite | 回退文档和对应断言 |

## Step 1 — Add Manual-Accept Contract And Entry

- Scope:
  - 为 orchestrator 增加正式 CLI 入口，例如 `--accept-final-verification --batch-id <id> --reason <text>`。
  - 增加 batch-level helper，拒绝非法前置状态：
    - batch 仍有 `active` / `pending` / `on_hold`
    - batch 尚未进入 terminal lifecycle
    - 未提供人工接受原因
  - 让 helper 统一设置：
    - `state.final_verification = passed`
    - `state.batch_summary.final_verification = passed`
    - `state.batch_summary.terminal_outcome = passed`
    - `state.batch_summary.lifecycle = completed`
  - 追加一条结构化 override evidence，至少包含：
    - `scope = batch`
    - `override_kind = manual_final_verification_accept`
    - `previous_terminal_outcome = failed`
    - `new_terminal_outcome = passed`
    - `reason`
- Files:
  - `scripts/orchestrator/orchestrator.mjs`
  - `scripts/orchestrator/state.mjs`
  - `scripts/orchestrator/events.mjs`
  - `scripts/orchestrator/test_orchestrator.mjs`
- Implementation notes:
  - 保留原始 parse-failed event，不做重写。
  - `status.txt` 必须通过现有投影路径刷新，不允许单独 patch 文本。
  - 不在本 Step 修改 parser 或 final verification prompt。
- Verification:

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_orchestrator.mjs
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "--accept-final-verification|manual_final_verification_accept|previous_terminal_outcome|new_terminal_outcome" scripts/orchestrator/orchestrator.mjs scripts/orchestrator/state.mjs scripts/orchestrator/events.mjs scripts/orchestrator/test_orchestrator.mjs
```

- Acceptance:
  - 人工接受不再依赖手改 `state.json`。
  - 合法输入会走统一 helper；非法输入会 deterministic fail。
- Rollback:
  - 回退 CLI flag、state helper、event helper 与对应测试。

## Step 2 — Sync Terminal State And Consumer Decisions

- Scope:
  - 使用 Step 1 的正式入口修复两个真实样本 batch：
    - `7ff3735e-abf6-4cab-b024-8d474e66673b`
    - `6d22aa18-43a7-4cd6-8e9c-823e2e6b23bb`
  - 确保 accept 后磁盘上的 `state.json`、`batch_summary`、`status.txt` 同步收口。
  - 对齐 `wave_launcher_lib.mjs` 的 terminal decision：
    - 优先消费 `batch_summary`
    - 如果 top-level `final_verification` 与 `batch_summary` 漂移，停止并暴露不一致，而不是继续 wave
- Files:
  - `scripts/orchestrator/orchestrator.mjs`
  - `scripts/orchestrator/wave_launcher_lib.mjs`
  - `scripts/orchestrator/test_orchestrator.mjs`
- Implementation notes:
  - 这一步只修 batch terminal accept，不改 iteration lifecycle。
  - 对真实样本的验证必须在备份完成后执行。
  - 如果样本目录缺失，允许在测试中构造等价 fixture，但默认先以现有真实 batch 为准。
- Verification:

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/orchestrator.mjs --accept-final-verification --batch-id 7ff3735e-abf6-4cab-b024-8d474e66673b --reason "manual accept after transcript review: parser false negative"
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/orchestrator.mjs --accept-final-verification --batch-id 6d22aa18-43a7-4cd6-8e9c-823e2e6b23bb --reason "manual accept after transcript review: parser false negative"
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node -e 'const fs=require("fs"); const ids=["7ff3735e-abf6-4cab-b024-8d474e66673b","6d22aa18-43a7-4cd6-8e9c-823e2e6b23bb"]; for (const id of ids) { const state=JSON.parse(fs.readFileSync(".orchestrator/runs/"+id+"/state.json","utf8")); const status=fs.readFileSync(".orchestrator/runs/"+id+"/status.txt","utf8"); if (!(state.final_verification==="passed" && state.batch_summary?.final_verification==="passed" && state.batch_summary?.terminal_outcome==="passed" && state.batch_summary?.lifecycle==="completed")) { throw new Error("terminal drift:"+id+" "+JSON.stringify(state.batch_summary)); } if (!status.includes("Batch Outcome: passed") || !status.includes("Final Verification: passed")) { throw new Error("status drift:"+id); } } console.log("PASS");'
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_orchestrator.mjs
```

- Acceptance:
  - 真实样本不再出现“顶层 passed，但 summary/status 仍 failed”。
  - wave launcher 不再把 summary/top-level 漂移状态当成继续条件。
- Rollback:
  - 从 `/tmp/0231-final-verification-manual-accept-consistency/` 恢复两个 sample run 目录。
  - 回退 `wave_launcher_lib.mjs` 与 Step 2 引入的测试/调用点。

## Step 3 — Freeze Operator Docs And Audit Rules

- Scope:
  - 在 SSOT 中明确：
    - manual accept 的正式入口
    - `--resume` 不是 manual accept 入口
    - append-only override evidence 规则
    - terminal consumer 必须优先读 `batch_summary`
  - 在 runbook 中明确：
    - 何时允许 manual accept
    - accept 后如何检查 `state.json` / `status.txt` / `events.jsonl`
    - 为什么禁止手改 `state.json`
- Files:
  - `docs/ssot/orchestrator_hard_rules.md`
  - `docs/user-guide/orchestrator_local_smoke.md`
  - `scripts/orchestrator/test_orchestrator.mjs`
- Implementation notes:
  - 文档必须与 Step 1/2 的最终 CLI 与 event payload 完全一致。
  - 不新增模糊术语，例如“差不多通过”“相当于 resume”。
- Verification:

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "--accept-final-verification|manual accept|batch_summary|do not edit state.json by hand|--resume is not a manual accept path|override evidence" docs/ssot/orchestrator_hard_rules.md docs/user-guide/orchestrator_local_smoke.md
```

```bash
cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_orchestrator.mjs
```

- Acceptance:
  - 无上下文 operator 只看 SSOT/runbook 即可知道如何执行 accept、如何验证结果、为何不能用手改文件替代。
- Rollback:
  - 回退文档改动及对应测试断言。

## Definition Of Done

- Step 1-3 的验证命令全部 PASS。
- `7ff3735e-abf6-4cab-b024-8d474e66673b` 与 `6d22aa18-43a7-4cd6-8e9c-823e2e6b23bb` 被正式 accept 后，磁盘上的 `state.json`、`status.txt`、`events.jsonl` 口径一致。
- `bun scripts/orchestrator/test_orchestrator.mjs` 包含 manual accept 与 consumer alignment 的 regression，并保持全绿。
- `docs/ssot/orchestrator_hard_rules.md` 与 `docs/user-guide/orchestrator_local_smoke.md` 已同步到最终实现口径。

## Rollback Strategy

- 代码回退：
  - 逐 Step 回退新增 CLI、helper、consumer 对齐、docs 和 tests。
- 样本数据回退：
  - 用 `/tmp/0231-final-verification-manual-accept-consistency/` 中的备份恢复两个 sample run 目录。
- 判定规则：
  - 只要出现 `batch_summary` 与 `status.txt` 再次漂移，或 wave launcher 对漂移状态继续返回 `continue`，就视为 rollback 触发条件。
