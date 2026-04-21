---
title: "0218 — orchestrator-browser-task-contract-freeze Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0218-orchestrator-browser-task-contract-freeze
id: 0218-orchestrator-browser-task-contract-freeze
phase: phase1
---

# 0218 — orchestrator-browser-task-contract-freeze Resolution

## Execution Strategy

- 先做 inventory，确认现有 orchestrator 哪些审计机制可复用、哪些 browser-specific pieces 完全缺失。
- 再把 `browser_task` request/result、artifact 目录、failure taxonomy 冻结为 machine-readable schema 与 deterministic tests。
- 最后同步 SSOT、operator runbook 与 wave prompt，使 `0219-0221` 从同一份合同出发，而不是继续靠 prompt prose 或聊天上下文。

## Delivery Boundaries

- 本 iteration 允许的改动面：
  - versioned schema
  - deterministic tests
  - SSOT / runbook / wave prompt
  - `0218` 自身 iteration 文档与 Phase 3 runlog
- 本 iteration 不允许的改动面：
  - Browser Agent Bridge 实现
  - orchestrator 主循环 browser phase 接线
  - 真实 Playwright MCP smoke
  - 远端 / 本地环境 rollout

## Planned Deliverables

- Versioned schema:
  - `scripts/orchestrator/schemas/browser_task_request.json`
  - `scripts/orchestrator/schemas/browser_task_result.json`
- Deterministic tests:
  - `scripts/orchestrator/test_browser_task_contract.mjs`
  - `scripts/orchestrator/test_orchestrator.mjs` 中与 browser task contract 对齐的断言
- SSOT / runbook / execution prompt alignment:
  - `docs/ssot/orchestrator_hard_rules.md`
  - `docs/user-guide/orchestrator_local_smoke.md`
  - `docs/user-guide/orchestrator_wave_0218_0221_prompt.txt`
- Evidence:
  - `docs/iterations/0218-orchestrator-browser-task-contract-freeze/runlog.md`

## Step Summary

| Step | Name | Purpose | Primary files | Verification | Rollback |
|---|---|---|---|---|---|
| 1 | Inventory Current Audit Surface | 固定现有 authoritative / derived / local-only 边界与缺口 | `scripts/orchestrator/{state,events,monitor,drivers,orchestrator,test_orchestrator}.mjs`, `docs/ssot/orchestrator_hard_rules.md`, `docs/user-guide/orchestrator_local_smoke.md`, `docs/user-guide/orchestrator_wave_0218_0221_prompt.txt`, `.gitignore` | `bun scripts/orchestrator/test_orchestrator.mjs` + `rg` inventory | 本步主要是事实盘点；若补充了 runlog 记录，回退对应记录 |
| 2 | Freeze Request Result And Artifact Schemas | 让 browser task request/result 和 artifact manifest 变成 machine-readable contract | `scripts/orchestrator/schemas/browser_task_request.json`, `scripts/orchestrator/schemas/browser_task_result.json`, `scripts/orchestrator/test_browser_task_contract.mjs` | schema parse + contract test | 回退新增 schema/test 文件 |
| 3 | Freeze Failure Taxonomy And Evidence Mapping | 定义 browser failure kinds、PASS 判定以及 state/events/status/runlog 映射 | `docs/ssot/orchestrator_hard_rules.md`, `scripts/orchestrator/test_browser_task_contract.mjs`, `scripts/orchestrator/test_orchestrator.mjs` | browser contract test + orchestrator regression + doc grep | 回退 SSOT/test 改动 |
| 4 | Sync Operator Docs And Downstream Prompt | 让 runbook 与 0218-0221 wave prompt 使用同一术语和路径 | `docs/user-guide/orchestrator_local_smoke.md`, `docs/user-guide/orchestrator_wave_0218_0221_prompt.txt`, `scripts/orchestrator/test_orchestrator.mjs`, `docs/iterations/0218-orchestrator-browser-task-contract-freeze/runlog.md` | doc grep + regression | 回退 runbook/wave prompt/test/runlog 改动 |

## Step 1 — Inventory Current Audit Surface

- Scope:
  - 审计当前 orchestrator 对以下能力的既有事实：
    - authoritative state
    - append-only events
    - status dashboard
    - transcript storage
    - review / execution result schema
    - `.gitignore` 对 runtime artifacts 的处理
  - 明确 browser task 目前缺失哪些核心合同：
    - request/result schema
    - local exchange 目录
    - artifact manifest
    - failure taxonomy
    - browser-specific evidence mapping
  - 将 inventory 结果写入 `runlog.md`，作为后续 schema/doc freeze 的事实输入。
- Files:
  - `scripts/orchestrator/state.mjs`
  - `scripts/orchestrator/events.mjs`
  - `scripts/orchestrator/monitor.mjs`
  - `scripts/orchestrator/drivers.mjs`
  - `scripts/orchestrator/orchestrator.mjs`
  - `scripts/orchestrator/test_orchestrator.mjs`
  - `docs/ssot/orchestrator_hard_rules.md`
  - `docs/user-guide/orchestrator_local_smoke.md`
  - `docs/user-guide/orchestrator_wave_0218_0221_prompt.txt`
  - `.gitignore`
  - `docs/iterations/0218-orchestrator-browser-task-contract-freeze/runlog.md`
- Implementation notes:
  - inventory 至少要回答三件事：
    - 现有 orchestrator 哪些文件已经定义了 authoritative / derived audit contract；
    - 哪些路径适合作为 browser exchange 与 browser evidence；
    - 当前仓库中哪些 browser_task 语义完全不存在。
  - 本步不新增 runtime 功能；若发现需要 runtime 接线，直接标记为 `0219` / `0220` 范围，不在 0218 内解决。
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_orchestrator.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "state\\.json|events\\.jsonl|status\\.txt|transcripts|browser_task|output/playwright|\\.orchestrator/" scripts/orchestrator docs/ssot/orchestrator_hard_rules.md docs/user-guide/orchestrator_local_smoke.md docs/user-guide/orchestrator_wave_0218_0221_prompt.txt .gitignore`
- Acceptance:
  - inventory 明确区分：
    - 可直接复用的现有骨架；
    - 需要 0218 冻结但当前不存在的 browser-specific contract；
    - 明确属于 0219/0220/0221 的后续实现项。
  - 后续 Step 不再需要重新讨论“现有 orchestrator 有没有 authoritative audit 骨架”。
- Rollback:
  - 若本步仅新增 runlog inventory 记录，回退该记录即可；本步不应引入 runtime 行为变更。

## Step 2 — Freeze Request Result And Artifact Schemas

- Scope:
  - 新增 machine-readable schema，冻结 browser task request/result 的最小必需字段。
  - 冻结 artifact manifest 的最小合同，至少覆盖：
    - screenshot / json / trace / console 等 artifact 类型
    - artifact 路径
    - required vs optional
    - producer/executor metadata
  - 增加专属 contract test，验证 schema 文件、必需字段和最小正反样例。
- Files:
  - `scripts/orchestrator/schemas/browser_task_request.json`
  - `scripts/orchestrator/schemas/browser_task_result.json`
  - `scripts/orchestrator/test_browser_task_contract.mjs`
  - 必要时补充：
    - `scripts/orchestrator/test_orchestrator.mjs`
- Implementation notes:
  - schema 文件必须 versioned，放在与现有 review/exec/final verdict 同级的 `scripts/orchestrator/schemas/`。
  - request/result schema 不应绑定某个具体 executor 命令行实现，但必须显式描述 browser-capable executor 边界。
  - artifact contract 要明确：
    - batch-local exchange 文件不等于 operator-facing screenshot 证据；
    - `output/playwright/` 只存 local evidence，不自动代表 orchestrator 已 ingest。
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('scripts/orchestrator/schemas/browser_task_request.json','utf8')); JSON.parse(fs.readFileSync('scripts/orchestrator/schemas/browser_task_result.json','utf8')); console.log('browser_task schemas parse PASS')"`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_browser_task_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "task_id|iteration_id|batch_id|attempt|artifact|failure_kind|executor|status" scripts/orchestrator/schemas/browser_task_request.json scripts/orchestrator/schemas/browser_task_result.json scripts/orchestrator/test_browser_task_contract.mjs`
- Acceptance:
  - request/result/artifact contract 已从 prose 变成 machine-readable schema + deterministic test。
  - `0219` 可以直接按 schema 实现 request/result 文件桥，而不是再发明字段。
- Rollback:
  - 回退本步新增的 schema 文件和 contract test；若同步修改了 `test_orchestrator.mjs`，一并回退。

## Step 3 — Freeze Failure Taxonomy And Evidence Mapping

- Scope:
  - 将 browser-specific failure kinds 与 PASS 判定提升到 SSOT。
  - 定义 browser result 被 orchestrator 视为“已通过”的必要条件：
    - result status = pass
    - required artifacts 存在
    - orchestrator evidence 链已引用该 task/result
  - 冻结 browser task 与现有审计面的映射：
    - `state.json` 应记录什么
    - `events.jsonl` 应记录什么
    - `status.txt` 至少暴露哪些 browser summary
    - `runlog.md` 应如何引用 request/result/artifact
  - 用 deterministic tests 保护上述合同，避免后续实现偏离。
- Files:
  - `docs/ssot/orchestrator_hard_rules.md`
  - `scripts/orchestrator/test_browser_task_contract.mjs`
  - `scripts/orchestrator/test_orchestrator.mjs`
  - 如需补充 schema 注释，可更新：
    - `scripts/orchestrator/schemas/browser_task_request.json`
    - `scripts/orchestrator/schemas/browser_task_result.json`
- Implementation notes:
  - failure taxonomy 至少需要覆盖：
    - request_invalid
    - executor_unavailable / mcp_unavailable
    - timeout / cancelled
    - result_invalid
    - artifact_missing / artifact_mismatch
    - stale_result / duplicate_result
    - ingest_failed
    - browser_bridge_not_proven
  - 文档必须明确 browser artifact 只能作为 evidence，不能绕过 ingest 直接宣布 PASS。
  - 若本步发现现有 `state.json` / `events.jsonl` 模型本身无法表达所需 browser evidence，必须在文档中明确把 runtime接线留给 `0219` / `0220`，不得在 0218 内偷偷实现。
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_browser_task_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_orchestrator.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "browser_task|failure_kind|artifact_missing|artifact_mismatch|stale_result|duplicate_result|output/playwright|state\\.json|events\\.jsonl|status\\.txt|runlog\\.md" docs/ssot/orchestrator_hard_rules.md scripts/orchestrator/test_browser_task_contract.mjs scripts/orchestrator/test_orchestrator.mjs`
- Acceptance:
  - browser failure taxonomy、PASS 判定和 evidence mapping 已写入 SSOT 且有 regression 保护。
  - `0220` 在接线时可以直接消费这些术语，而不是重新命名 failure kind 或 audit path。
- Rollback:
  - 回退本步对 SSOT、contract test、orchestrator regression 的改动。

## Step 4 — Sync Operator Docs And Downstream Prompt

- Scope:
  - 让 operator runbook 与 wave prompt 使用与 SSOT 完全一致的 browser task 术语、目录和 stop rules。
  - 在 `runlog.md` 留下 Phase 3 的事实证据：
    - 执行命令
    - PASS/FAIL
    - 最终冻结的 schema/doc 文件
  - 只同步 `0218` 直接相关的 operator-facing 文档，不改写 `0219-0221` 自身 plan/resolution。
- Files:
  - `docs/user-guide/orchestrator_local_smoke.md`
  - `docs/user-guide/orchestrator_wave_0218_0221_prompt.txt`
  - `scripts/orchestrator/test_orchestrator.mjs`
  - `docs/iterations/0218-orchestrator-browser-task-contract-freeze/runlog.md`
- Implementation notes:
  - `orchestrator_local_smoke.md` 需要新增 browser task operator 读法：
    - 去哪里找 batch-local exchange
    - 去哪里找 `output/playwright/` evidence
    - 何时应判定 `artifact mismatch` / `browser_bridge_not_proven`
  - wave prompt 需要与最终冻结术语一致，但不得扩大 0218 scope。
  - runlog 只记录事实执行，不重写 plan/resolution。
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_browser_task_contract.mjs && bun scripts/orchestrator/test_orchestrator.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "browser_task|request/result|output/playwright|artifact mismatch|browser_bridge_not_proven|MCP unavailable|state\\.json|events\\.jsonl" docs/user-guide/orchestrator_local_smoke.md docs/user-guide/orchestrator_wave_0218_0221_prompt.txt docs/ssot/orchestrator_hard_rules.md`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "browser_task|schema|failure taxonomy|PASS|FAIL" docs/iterations/0218-orchestrator-browser-task-contract-freeze/runlog.md`
- Acceptance:
  - operator runbook、wave prompt、SSOT、tests 对 browser task 使用同一套术语和路径。
  - `0219-0221` 的执行者只需读 0218 + SSOT/runbook，即可理解后续 bridge / phase / smoke 应满足什么。
- Rollback:
  - 回退本步对 runbook、wave prompt、test、runlog 的改动；若 runlog 已追加错误事实，按事实追加更正记录，不改写历史。

## Final Verification Target For 0218

- `0218` 完成时，至少应满足以下可判定结果：
  - repo 中存在 versioned 的 browser task request/result schema。
  - repo 中存在 deterministic browser-task contract tests，且通过。
  - SSOT 与 operator docs 明确说明 authoritative / derived / local-only 的 browser task 审计边界。
  - `0219-0221` 不再需要重新定义核心字段、artifact 目录或 PASS 判定。

## Rollback Principle

- `0218` 的回退以 versioned docs/schema/test 为主：
  - 优先回退最近一个 Step 的 docs/schema/test 提交；
  - 每次回退后必须重新执行本 iteration 已定义的 contract/regression tests；
  - `.orchestrator/` 与 `output/playwright/` 中的运行期产物不是 versioned 交付物，必要时只作为本地证据清理，不构成 repo 回退目标。

## Notes

- `0218` 的核心价值是冻结合同，不是证明 browser capability 已经可运行。
- 若执行中发现 contract 设计必须改动现有 orchestrator state/event 基座才能成立，应停止并把该问题升级给 `0219` / `0220`，而不是在 0218 中跨 scope 直接实现。
