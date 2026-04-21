---
title: "0173 — Handoff Mode 会话迁移协议"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0173-handoff-mode-protocol
id: 0173-handoff-mode-protocol
phase: phase1
---

# 0173 — Handoff Mode 会话迁移协议

## Goal

- 为 Codex/OpenCode 建立一套可复用的会话迁移协议：在本仓库默认启用升级/降级建议，用户确认后生成 `compact_handoff` 与新会话首条 prompt。

## Scope

- In scope:
- 新增系统级 `handoff-mode` skill，承载通用迁移协议。
- 在本仓库新增本地默认规则文档，声明协议默认开启且与 fill-table/runtime 无关。
- 为本仓库增加一个静态契约测试，防止本地协议文案回归。
- Out of scope:
- 修改 runtime、server、worker、fill-table 逻辑。
- 试图在活跃 CLI 会话内热切换真实 context window。
- 改动用户当前正在编辑的 `CLAUDE.md` 与 `scripts/ops/README.md`。

## Invariants / Constraints

- `CLAUDE.md` 仍是仓库内最高优先级执行约束；本次只新增补充文档与 skill，不覆写其内容。
- 这次工作与项目内“填表能力”无直接关系，不得误接到 system-model、server prompt、owner-chain runtime 路径。
- 用户未明确回复 `升级后继续` 或 `降级后继续` 前，assistant 必须继续当前会话。
- `/handoff-mode` 必须是 toggle，而不是单向命令。
- 建议“1M/降级”时，仍需同时输出 `effort_suggestion: medium|high|xhigh — <short reason>`。

## Success Criteria

- 本仓库存在一份 future sessions 会自动发现的本地协议文档，并明确默认开启 `handoff-mode`。
- `/handoff-mode` 的取反与显式结果文案已被写入本地协议和系统级 skill。
- 明确记录升级/降级确认词、`compact_handoff` 最小字段、新会话 prompt 模板要求。
- 本地静态契约测试可 PASS，验证协议关键文案已落位。
- `docs/ITERATIONS.md` 与 `docs/iterations/0173-handoff-mode-protocol/*` 已记录本次 iteration 事实。

## Inputs

- Created at: 2026-03-07
- Iteration ID: 0173-handoff-mode-protocol
- Trigger:
  - 用户要求在 `dongyuapp_elysia_based` 默认启用升级/降级迁移协议，并在需要时建立系统级 skill。
