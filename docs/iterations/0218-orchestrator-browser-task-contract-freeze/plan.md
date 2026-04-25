---
title: "0218 — orchestrator-browser-task-contract-freeze Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0218-orchestrator-browser-task-contract-freeze
id: 0218-orchestrator-browser-task-contract-freeze
phase: phase1
---

# 0218 — orchestrator-browser-task-contract-freeze Plan

## Goal

- 冻结一套自包含、可审计、可回归的 `browser_task` 合同，使 orchestrator 在后续 `0219-0221` 中使用同一组 request/result schema、artifact 目录规则、failure taxonomy，以及 `state.json` / `events.jsonl` / `status.txt` / `runlog.md` 证据语义。
- 明确 browser-capable executor 是桥接能力，不是 orchestrator 现有 `codex exec` / `claude -p` 子进程的隐含能力；后续实现必须围绕这一边界建设，而不是在不同 iteration 中各自发明临时协议。

## Background

- `0202-0205` 已经把 orchestrator 主链路冻结为：
  - `scripts/orchestrator/state.mjs` 维护 `.orchestrator/runs/<batch_id>/state.json` 作为唯一恢复真源。
  - `scripts/orchestrator/events.mjs` 维护 append-only 的 `events.jsonl`。
  - `scripts/orchestrator/monitor.mjs` 维护衍生的 `status.txt` 看板。
  - `scripts/orchestrator/drivers.mjs` 把 Codex / Claude Code transcript 落盘到 `.orchestrator/runs/<batch_id>/transcripts/`。
  - `docs/ssot/orchestrator_hard_rules.md` 与 `docs/user-guide/orchestrator_local_smoke.md` 已冻结现有 audit / recovery / completion 语义。
- 但截至 2026-03-23，仓库还没有任何 browser-specific 合同面：
  - `scripts/orchestrator/schemas/` 只有 `review_verdict.json`、`exec_output.json`、`final_verdict.json`，没有 `browser_task` request/result schema。
  - `scripts/orchestrator/` 现有实现、测试和 runbook 都没有 `browser_task`、bridge exchange、artifact ingest、stale result 或 browser failure taxonomy。
  - `docs/user-guide/orchestrator_wave_0218_0221_prompt.txt` 已提出 `0218-0221` 的能力波次，但该 prompt 目前只是需求锚点，不是机器可校验的合同。
- 同时，仓库对 artifact 路径已有明确边界：
  - `.orchestrator/` 被 `.gitignore` 排除，适合存放 batch-local runtime 产物。
  - `output/` 也被 `.gitignore` 排除；现有 Playwright 截图与浏览器证据通常落在 `output/playwright/`。
- 因此 `0218` 的职责不是做 bridge 或主循环接线，而是先把“browser task 到底是什么、结果怎样才算可审计、哪些文件是 authoritative/derived/local-only”一次写死。

## Problem Statement

- 当前 browser capability 只存在于需求层，没有统一 contract。若直接进入 `0219` 或 `0220`，极易出现以下漂移：
  - 不同实现各自定义 request/result 字段，导致 bridge 与 orchestrator 无法稳定对接。
  - artifact 一部分写到 `.orchestrator/`，另一部分写到 `output/playwright/`，但没有明确哪个是 exchange 文件、哪个是 operator evidence。
  - browser executor 的失败、超时、缺 artifact、stale result、MCP unavailable 等情况被混写成普通 CLI failure，后续恢复与 stop rule 无法 deterministic 判断。
  - `state.json`、`events.jsonl`、`status.txt`、`runlog.md` 之间的双写/衍生边界不清，容易出现“文件存在但 batch 没 ingest”或“口头说通过但没有结构化证据”的伪成功。
- 这类漂移会直接破坏：
  - `0219-orchestrator-browser-agent-bridge` 的 request/result 文件协议；
  - `0220-orchestrator-browser-phase-and-regression` 的 resume / orphan / stale result 回归；
  - `0221-playwright-mcp-local-smoke` 的真实 MCP 证明标准；
  - 以及后续 `0223` / `0225` 的环境证据生成。

## Scope

- In scope:
  - 盘点现有 orchestrator 的 authoritative state、derived audit 和 transcript 机制，明确哪些部分可直接复用为 browser task 审计骨架。
  - 冻结 `browser_task` request/result 的机器可校验 schema。
  - 冻结 browser task 的目录与证据分层，至少覆盖：
    - bridge exchange 文件放在哪里；
    - browser runtime artifact 放在哪里；
    - 哪些路径只作本地证据，哪些字段必须被 orchestrator ingest 进 versioned 审计面。
  - 冻结 browser failure taxonomy，至少覆盖：
    - request invalid / result invalid
    - executor unavailable / MCP unavailable
    - timeout / cancelled
    - artifact missing / artifact mismatch
    - stale / duplicate result
    - ingest failed / browser bridge not proven
  - 冻结 browser task 的通过判定：
    - 结构化 result 为 PASS
    - 必需 artifact 存在
    - orchestrator 已把该结果写入自己的 state/event/runlog 证据链
  - 为 `0219-0221` 提供唯一的上游 contract 输入，不再允许下游 iteration 自行增补核心字段或语义。
- Out of scope:
  - 不实现 Browser Agent Bridge。
  - 不把 browser phase 接入 orchestrator 主循环。
  - 不执行真实 Playwright MCP smoke。
  - 不做本地或远端集群 rollout、remote ops、人工浏览器操作。
  - 不把 `0218` 变成 runtime 改造 iteration；runtime wiring 属于 `0219` / `0220`。

## Contract Targets

- `browser_task` 必须成为显式协议对象，而不是“给某个 agent 发一段自然语言让它打开浏览器”的隐式约定。
- contract 产物至少应定义：
  - request identity：
    - `batch_id`
    - `iteration_id`
    - `task_id`
    - `attempt`
    - `created_at`
  - executor boundary：
    - 请求创建者
    - browser-capable executor 身份或类型
    - executor 不可用时的 failure 语义
  - action payload：
    - target / task objective
    - required artifacts
    - success assertions
    - timeout / retry 前提
  - result envelope：
    - `status`
    - `failure_kind`
    - `summary`
    - artifact manifest
    - executor metadata
    - timestamps
  - evidence mapping：
    - `state.json` 仍是 authoritative state
    - `events.jsonl` / `status.txt` 仍是 derived audit
    - `runlog.md` 仍记录 versioned human-readable evidence
    - `output/playwright/` 与 batch-local browser exchange 目录仅作为 local runtime evidence；不能替代 orchestrator ingest
- `0218` 还必须冻结以下目录角色：
  - versioned schema / tests：`scripts/orchestrator/schemas/`、`scripts/orchestrator/test*.mjs`
  - batch-local exchange / recovery：`.orchestrator/runs/<batch_id>/...`
  - browser evidence artifacts：`output/playwright/`
- 任何 browser task PASS 都必须同时满足：
  - request/result schema 合法；
  - 必需 artifact 真实存在；
  - orchestrator 审计面能够引用这次执行，而不是只留下孤立文件。

## Authoritative / Derived / Local-Only Matrix

| Layer | Role | Current anchor | 0218 freeze result |
|---|---|---|---|
| Authoritative | batch 恢复真源 | `.orchestrator/runs/<batch_id>/state.json` via `scripts/orchestrator/state.mjs` | browser task 的 ingest 结果必须最终归入这里；request/result 文件本身不能替代 state |
| Derived audit | append-only 事件时间线 | `.orchestrator/runs/<batch_id>/events.jsonl` via `scripts/orchestrator/events.mjs` | browser lifecycle 必须有结构化事件语义，但事件仍不可反推覆盖 state |
| Derived operator view | 当前汇总看板 | `.orchestrator/runs/<batch_id>/status.txt` via `scripts/orchestrator/monitor.mjs` | browser subphase/summary 只能是 state 的投影，不单独成为恢复源 |
| Versioned evidence | repo 内人类可读证据 | `docs/iterations/<id>/runlog.md` | browser ingest 结果必须能被 runlog 引用和审计 |
| Local runtime exchange | bridge request/result 文件交换 | 目前不存在 | 0218 必须冻结目录与幂等边界，供 0219 实现 |
| Local browser artifact | 截图、trace、console、json 等证据 | `output/playwright/` 已被现有浏览器验证使用 | 0218 必须定义它与 request/result/state/runlog 的引用关系，禁止“只有截图没有结构化结果” |

## Impact Surface

- Orchestrator runtime / audit consumers：
  - `scripts/orchestrator/orchestrator.mjs`
  - `scripts/orchestrator/state.mjs`
  - `scripts/orchestrator/events.mjs`
  - `scripts/orchestrator/monitor.mjs`
  - `scripts/orchestrator/drivers.mjs`
  - `scripts/orchestrator/scheduler.mjs`
- Machine-readable contract / regression surface：
  - `scripts/orchestrator/schemas/`
  - `scripts/orchestrator/test_orchestrator.mjs`
  - 新增 browser-task contract tests（文件名在 execution 中确定）
- SSOT / operator docs：
  - `docs/ssot/orchestrator_hard_rules.md`
  - `docs/user-guide/orchestrator_local_smoke.md`
  - `docs/user-guide/orchestrator_wave_0218_0221_prompt.txt`
- Runtime artifact boundaries：
  - `.gitignore`
  - `.orchestrator/runs/<batch_id>/`
  - `output/playwright/`

## Reusable Mechanisms And Missing Pieces

- 已有可复用骨架：
  - `state.json` 的 authoritative / atomic commit / crash recovery 语义。
  - `events.jsonl` 的 append-only event log。
  - `status.txt` 的衍生 monitor 视图。
  - `transcripts/` 的 CLI transcript 存档。
  - `test_orchestrator.mjs` 的 deterministic regression 基线。
- 当前缺失、且必须由 `0218` 冻结的 pieces：
  - browser task request / result schema。
  - browser-specific artifact manifest 和目录角色。
  - browser executor boundary 与 capability assumption。
  - browser failure taxonomy 与 stop rule 对应关系。
  - browser result ingest 与 state/event/runlog 双写审计语义。

## Invariants / Constraints

- 严格遵守 `CLAUDE.md`、`docs/WORKFLOW.md`、`docs/ITERATIONS.md`、`docs/ssot/orchestrator_hard_rules.md`。
- `0218` 是 contract-freeze iteration：
  - 允许改 schema、tests、SSOT、runbook、iteration docs；
  - 不允许偷做 bridge、main loop、executor 启动逻辑。
- authoritative state 仍只能是 `state.json`；任何 browser result 文件、artifact 文件、截图、trace 都不能直接取代 orchestrator ingest。
- 不允许以 prose 或人工描述伪造 browser success；必须依赖结构化 result + artifact existence + ingest evidence。
- 不允许把 `codex exec` / `claude -p` 默认视为 browser-capable executor。
- 任何对 `output/playwright/` 或 `.orchestrator/` 的约定都必须明确其“本地、非版本化”边界。

## Success Criteria

- 无上下文读者只读 `0218` 文档即可理解：
  - 为什么现有 orchestrator 审计骨架不足以直接承载 browser task；
  - `browser_task` 的 request/result/artifact/evidence 合同要冻结什么；
  - authoritative / derived / local-only 三层边界分别是什么；
  - 为什么 `0219` / `0220` / `0221` 不能再自行定义核心字段。
- `0218` 的 execution plan 能明确列出后续需修改的 schema、tests、SSOT 与 runbook 文件。
- resolution 中每个 Step 都有 deterministic validation command。
- `0219-0221` 可以直接把 `0218` 作为唯一 contract 输入，而不必再次讨论基本术语。

## Risks & Mitigations

- Risk:
  - 合同过早绑定某一种 executor 实现，导致 `0219` bridge 只能服务单一 agent。
  - Mitigation:
    - 在 `0218` 只冻结协议边界和 evidence contract，不绑定具体实现细节。
- Risk:
  - 将 `output/playwright/` 中的本地 artifact 误升格为 authoritative state。
  - Mitigation:
    - 明确本地 artifact 只能作为 evidence，由 orchestrator ingest 后才进入正式审计链。
- Risk:
  - `0218` scope 膨胀，提前混入 `0219` / `0220` 的 runtime 接线。
  - Mitigation:
    - 把 bridge、phase integration、real MCP smoke 明确列为 out of scope。

## Alternatives

### A. 推荐：先冻结协议和审计合同，再由 0219/0220/0221 分层实现

- 优点：
  - request/result、artifact、failure 语义一次定清，下游迭代边界稳定。
  - deterministic tests 可以在 bridge 接线前先锁住合同。
- 缺点：
  - 需要先做一轮 docs/schema/test 为主的 freeze，而不是直接堆实现。

### B. 在 0219/0220 中边写 bridge 边补协议

- 优点：
  - 短期看起来推进更快。
- 缺点：
  - 极易把局部实现细节写成全局 contract，导致 stale result、artifact mismatch、resume 语义后期返工。

当前推荐：A。

## Inputs

- Created at: 2026-03-23
- Iteration ID: `0218-orchestrator-browser-task-contract-freeze`
- Planning mode: `refine`
- Upstream anchor:
  - `0202-doit-auto-orchestrator`
  - `0203-three-state-routing-review-policy`
  - `0204-escalation-rules-engine`
  - `0205-orchestrator-observability-cleanup`
- Downstream:
  - `0219-orchestrator-browser-agent-bridge`
  - `0220-orchestrator-browser-phase-and-regression`
  - `0221-playwright-mcp-local-smoke`
  - `0223-local-cluster-browser-evidence`
  - `0225-remote-browser-evidence`
