---
title: "0220 — orchestrator-browser-phase-and-regression Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0220-orchestrator-browser-phase-and-regression
id: 0220-orchestrator-browser-phase-and-regression
phase: phase1
---

# 0220 — orchestrator-browser-phase-and-regression Resolution

## Execution Strategy

- 先补 execution 输出到 `browser_task` request 的结构化握手，避免 orchestrator 靠 prose 猜测是否需要浏览器验证。
- 再把 `0219` 的 Browser Agent Bridge 接入 orchestrator 主循环，完成 request materialization、result ingest、state/events/status wiring，并把 browser failure 纳入既有 escalation / on_hold 体系。
- 最后补齐 `--resume`、orphan、stale、timeout 等 browser-specific regression 和 operator docs，确保 `0221` 只需验证真实 MCP executor，而不再修主循环基础设施。

## Delivery Boundaries

- 本 iteration 允许的改动面：
  - `scripts/orchestrator/` 下的 orchestrator main loop、prompt/schema/parser、state/event/status、主回归测试
  - 为主循环接线所需的最小 bridge helper 对接
  - browser phase/operator 相关 SSOT 与 runbook
  - `0220` 自身 `runlog.md` 的事实记录
- 本 iteration 不允许的改动面：
  - 私自修改 `0218` 已冻结的 `browser_task_request.json` / `browser_task_result.json` schema、failure taxonomy 或 PASS 规则
  - 将 0220 漂移成 `0219` bridge 重写
  - 真实 Playwright MCP smoke、cluster rollout、远端操作、人工浏览器 DoD
  - 把 local artifact-only evidence 当成 PASS

## Planned Deliverables

- Browser-aware execution handshake:
  - `scripts/orchestrator/prompts.mjs`
  - `scripts/orchestrator/schemas/exec_output.json`
  - `scripts/orchestrator/drivers.mjs`
- Main-loop browser integration:
  - `scripts/orchestrator/orchestrator.mjs`
  - `scripts/orchestrator/state.mjs`
  - `scripts/orchestrator/events.mjs`
  - `scripts/orchestrator/monitor.mjs`
  - 如对接必需，最小更新：
    - `scripts/orchestrator/browser_bridge.mjs`
    - `scripts/orchestrator/browser_agent.mjs`
- Regression and docs:
  - `scripts/orchestrator/test_orchestrator.mjs`
  - `docs/ssot/orchestrator_hard_rules.md`
  - `docs/user-guide/orchestrator_local_smoke.md`
  - `docs/user-guide/orchestrator_wave_0218_0221_prompt.txt`
  - `docs/iterations/0220-orchestrator-browser-phase-and-regression/runlog.md`

## Step Summary

| Step | Name | Purpose | Primary files | Verification | Rollback |
|---|---|---|---|---|---|
| 1 | Introduce Browser Task Execution Handshake | 让 execution 输出可以显式声明 browser request，并由 orchestrator 生成 canonical `request.json` | `scripts/orchestrator/prompts.mjs`, `scripts/orchestrator/schemas/exec_output.json`, `scripts/orchestrator/drivers.mjs`, `scripts/orchestrator/orchestrator.mjs`, `scripts/orchestrator/test_orchestrator.mjs` | exec schema/parse regression + full orchestrator regression + contract grep | 回退 execution handshake 与对应测试 |
| 2 | Ingest Browser Result Into Authoritative Audit Surface | 把 `0219` bridge 接入主循环，并把 result/artifact 写入 `state.json` / `events.jsonl` / `status.txt` / `runlog.md` | `scripts/orchestrator/orchestrator.mjs`, `scripts/orchestrator/state.mjs`, `scripts/orchestrator/events.mjs`, `scripts/orchestrator/monitor.mjs`, `scripts/orchestrator/browser_bridge.mjs`, `scripts/orchestrator/browser_agent.mjs`, `scripts/orchestrator/test_orchestrator.mjs`, `docs/ssot/orchestrator_hard_rules.md`, `docs/user-guide/orchestrator_local_smoke.md` | bridge regression + orchestrator regression + status/doc grep | 回退 ingest/state/status/doc 改动，清理本地产物 |
| 3 | Harden Resume And Regression Coverage | 固定 browser phase 的 resume/orphan/stale/timeout/failure 行为，并同步 wave/runbook 口径 | `scripts/orchestrator/orchestrator.mjs`, `scripts/orchestrator/test_orchestrator.mjs`, `docs/ssot/orchestrator_hard_rules.md`, `docs/user-guide/orchestrator_local_smoke.md`, `docs/user-guide/orchestrator_wave_0218_0221_prompt.txt`, `docs/iterations/0220-orchestrator-browser-phase-and-regression/runlog.md` | full orchestrator regression + bridge regression + doc grep | 回退 browser resume/regression/docs 改动 |

## Step 1 — Introduce Browser Task Execution Handshake

- Scope:
  - 扩展 execution prompt，让 Codex execution 阶段能在结构化输出中显式声明 browser validation 需求。
  - 扩展 `exec_output` contract，使 orchestrator 能解析 browser request 元数据，而不是从 prose 或 runlog 里猜测。
  - 在 orchestrator 中新增 request materialization 入口，把 execution 输出映射成 canonical：
    - `.orchestrator/runs/<batch_id>/browser_tasks/<task_id>/request.json`
    - `output/playwright/<batch_id>/<task_id>/...` 的 required artifact 约束
  - 保持 `0218` request/result schema 不变；本步只定义 execution 到 request 的上游握手。
- Files:
  - `scripts/orchestrator/prompts.mjs`
  - `scripts/orchestrator/schemas/exec_output.json`
  - `scripts/orchestrator/drivers.mjs`
  - `scripts/orchestrator/orchestrator.mjs`
  - `scripts/orchestrator/test_orchestrator.mjs`
- Implementation notes:
  - browser request 必须是 structured data，不接受“请去浏览器验证一下”这种非结构化暗示。
  - `parseExecOutput()` 必须能稳定提取 browser request 字段；无法解析时应进入显式 failure/on_hold，而不是静默忽略。
  - request materialization 只能写入 canonical exchange 路径，不得跳过 `request.json` 直接调用 Browser Agent。
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('scripts/orchestrator/schemas/exec_output.json','utf8')); console.log('exec_output schema parse PASS')"`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_orchestrator.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "browser_task|request\\.json|required_artifacts|success_assertions" scripts/orchestrator/prompts.mjs scripts/orchestrator/schemas/exec_output.json scripts/orchestrator/drivers.mjs scripts/orchestrator/orchestrator.mjs`
- Acceptance:
  - execution 输出可以显式承载 browser request，主循环能够 deterministic 地生成 canonical `request.json`。
  - orchestrator 不再依赖 prose、ad-hoc 文本或人工推断来判断是否需要 browser task。
  - 0218/0219 的 request/result contract 未被改名、改语义或绕开。
- Rollback:
  - 回退 `prompts.mjs`、`exec_output.json`、`drivers.mjs`、`orchestrator.mjs` 中的 browser handshake 改动与对应 regression。

## Step 2 — Ingest Browser Result Into Authoritative Audit Surface

- Scope:
  - 让 orchestrator 能消费 `0219` 生成的 `result.json` 和 local artifacts，并把它们 authoritative 地写进 state/evidence chain。
  - 为 browser lifecycle 写结构化事件，并让 `status.txt` 暴露浏览器相关投影字段。
  - 明确 browser task 与既有 phase/hold/continue 的关系：
    - 何时进入 browser subphase/wait point
    - 何时视为成功继续
    - 何时因 `mcp_unavailable`、`artifact_missing`、`artifact_mismatch`、`browser_bridge_not_proven` 等进入失败/人工裁决路径
  - 若主循环接线需要 bridge helper 暴露更清晰的 load/verify API，只允许做最小对接补强。
- Files:
  - `scripts/orchestrator/orchestrator.mjs`
  - `scripts/orchestrator/state.mjs`
  - `scripts/orchestrator/events.mjs`
  - `scripts/orchestrator/monitor.mjs`
  - 如确有必要：
    - `scripts/orchestrator/browser_bridge.mjs`
    - `scripts/orchestrator/browser_agent.mjs`
  - `scripts/orchestrator/test_orchestrator.mjs`
  - `docs/ssot/orchestrator_hard_rules.md`
  - `docs/user-guide/orchestrator_local_smoke.md`
- Implementation notes:
  - `state.json` 必须成为 browser ingest 的唯一恢复真源；`result.json` 不能直接作为 resume 判定依据。
  - `events.jsonl` 必须记录 browser lifecycle 事件，并带上 `task_id`、`attempt`、`status`、`failure_kind`、`request_file`、`result_file`。
  - `status.txt` 中的 `Browser Task:` / `Browser Attempt:` / `Browser Status:` / `Browser Failure Kind:` 必须是 state 的投影，不得反向驱动恢复逻辑。
  - `runlog.md` 中必须记录 request/result/artifact 路径与最终 PASS/FAIL；禁止只写 prose。
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_browser_agent_bridge.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_orchestrator.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "Browser Task:|Browser Attempt:|Browser Status:|Browser Failure Kind:|browser_task|ingested_at|request_file|result_file" scripts/orchestrator/state.mjs scripts/orchestrator/events.mjs scripts/orchestrator/monitor.mjs docs/ssot/orchestrator_hard_rules.md docs/user-guide/orchestrator_local_smoke.md`
- Acceptance:
  - browser task result 可以被主循环 ingest，且 authoritative state、events、status、runlog 四个审计面互相对齐。
  - 仅有 local artifact 或 existing result 文件而未完成 ingest 时，iteration 不会被误判为 PASS。
  - browser failure kinds 可以真实影响 orchestrator 的 continue/on_hold 决策。
- Rollback:
  - 回退 state/event/status/doc 的 browser ingest 改动；如创建了本地 `.orchestrator/` / `output/playwright/` 测试产物，仅清理本地痕迹，不把它们当 versioned 交付物。

## Step 3 — Harden Resume And Regression Coverage

- Scope:
  - 为 browser phase 增加 deterministic 回归，至少覆盖：
    - happy path browser pass
    - request 已写出但 result 未到
    - result 已存在但尚未 ingest
    - stale result / duplicate result / artifact mismatch
    - timeout / `mcp_unavailable` / `browser_bridge_not_proven`
    - orphaned event 与 `--resume` 恢复
  - 固定 browser subphase 在 crash/resume 之间的最小恢复规则，避免重复消费、重复成功或静默跳过 bridge 冲突。
  - 同步 operator-facing 文档和 wave prompt，使 0221 能沿用同一 phase/证据口径。
  - 在 `runlog.md` 中预先明确本 iteration Phase 3 应记录的浏览器验证证据类型与 PASS/FAIL 模板。
- Files:
  - `scripts/orchestrator/orchestrator.mjs`
  - `scripts/orchestrator/test_orchestrator.mjs`
  - `docs/ssot/orchestrator_hard_rules.md`
  - `docs/user-guide/orchestrator_local_smoke.md`
  - `docs/user-guide/orchestrator_wave_0218_0221_prompt.txt`
  - `docs/iterations/0220-orchestrator-browser-phase-and-regression/runlog.md`
- Implementation notes:
  - `--resume` 应优先读取 authoritative state，再决定是否回看 request/result/artifact；不能直接以现存文件为真。
  - orphaned event 处理必须复用现有 recovery 原则，不额外发明第二套 browser-only 恢复通道。
  - 对 stale/duplicate/timeout 等 browser failure 的判定要保持 deterministic，避免同一输入在重复 resume 中产生不同结论。
  - 若 regression 暴露出 `0218`/`0219` 合同不足，应停止并升级为 planning 变更，而不是在测试修修补补时偷偷改合同。
- Verification:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_orchestrator.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && bun scripts/orchestrator/test_browser_agent_bridge.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n -- "browser_task|resume|orphan|stale_result|duplicate_result|timeout|mcp_unavailable|browser_bridge_not_proven|Browser Task:" scripts/orchestrator/test_orchestrator.mjs docs/ssot/orchestrator_hard_rules.md docs/user-guide/orchestrator_local_smoke.md docs/user-guide/orchestrator_wave_0218_0221_prompt.txt`
- Acceptance:
  - browser phase 的 resume/orphan/stale/timeout 路径都被 deterministic regression 固定。
  - 0221 可以把真实 MCP smoke 聚焦在 executor 可用性与真实 artifact proof，而不是返修 orchestrator browser phase。
  - operator docs 与 wave prompt 不再停留在“合同冻结”，而是能描述已落地的 browser phase / ingest / recovery 行为。
- Rollback:
  - 回退 browser-specific regression、resume 逻辑与文档同步；保留 `0218`/`0219` 已成立的 contract/bridge，不做越级回退。

## Final Verification Target For 0220

- orchestrator 能以结构化方式接收 browser request，并生成 canonical `request.json`。
- orchestrator 能消费 `0219` bridge 的 `result.json` / artifacts，并把结果 authoritative 地写入 `state.json`、`events.jsonl`、`status.txt`、`runlog.md`。
- `--resume` 能 deterministic 地恢复 browser subphase，而不是重复执行、重复成功或忽略 bridge 冲突。
- `scripts/orchestrator/test_orchestrator.mjs` 中存在 browser-specific regression，而不仅是文档关键词断言。
- `0221` 进入真实 MCP smoke 前，不再需要补主循环 browser wiring。

## Rollback Principle

- `0220` 的回退优先局限在 browser integration 层：
  - 先回退最近一个 Step 的主循环/测试/文档改动；
  - 每次回退后重新执行 `bun scripts/orchestrator/test_orchestrator.mjs` 与 `bun scripts/orchestrator/test_browser_agent_bridge.mjs`；
  - 本地 `.orchestrator/` 与 `output/playwright/` 产物只做环境清理，不当作 versioned 回退目标；
  - 若回退发现必须连带改动 `0218`/`0219` 合同，视为 planning 问题而不是继续扩回退范围。

## Notes

- `0220` 的核心交付不是“再写一个 browser test”，而是让 browser task 真正成为 orchestrator 的主循环能力。
- 任何试图在 `0220` 里顺手完成 real MCP proof、环境 rollout 或下游 browser evidence 波次的做法，都属于 scope violation。
