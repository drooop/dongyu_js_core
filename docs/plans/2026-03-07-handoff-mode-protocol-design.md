---
title: "Handoff Mode Protocol Design"
doc_type: note
status: active
updated: 2026-04-21
source: ai
---

# Handoff Mode Protocol Design

## Goal

- 为 Codex/OpenCode 增加一套可复用的会话迁移协议：按任务大小建议升级/降级，在用户明确确认后输出 `compact_handoff` 与新会话首条 prompt。

## Context

- 用户希望在日常小任务中避免无谓使用大上下文。
- 当前 CLI 会话不能在活跃会话内热切换真实 context window，因此只能走“迁移到新会话”的协议。
- 本仓库需要默认启用该协议，但又不能把它误解为 fill-table/runtime 语义的一部分。

## Approaches

### Option A — 仅做系统级 skill

- 优点：
  - 可复用。
  - 与具体仓库耦合低。
- 缺点：
  - 不能保证在本仓库里默认开启。
  - 新会话若未显式提及 skill，协议容易失效。

### Option B — 仅做项目本地规则

- 优点：
  - 本仓库内默认生效最直接。
- 缺点：
  - 无法复用于其他仓库。
  - 协议知识只能留在本仓库。

### Option C — 双层落地（推荐）

- 系统级 skill 承载通用迁移协议。
- 项目本地规则声明：本仓库默认开启，并补充本仓库口径。
- 这样既能复用，也能保证在本仓库里默认生效。

## Accepted Design

- 采用双层落地：
  - 系统级 `handoff-mode` skill：负责通用判定、toggle、迁移包模板。
  - 仓库本地 `docs/CODEX_HANDOFF_MODE.md` + `AGENTS.md`：声明默认启用，并明确这只是 developer workflow。
- `/handoff-mode` 作为会话级开关：
  - 每次调用都取反。
  - 必须回一条明确状态句。
- 用户未明确回复 `升级后继续` 或 `降级后继续` 时，assistant 继续当前对话。

## Non-goals

- 不实现真实的 CLI 热切换 1M。
- 不修改 runtime/server/fill-table 逻辑。
- 不把大窗状态伪装成“已验证 1M 生效”。

## Validation

- 仓库本地增加静态契约测试，校验 AGENTS 与 `docs/CODEX_HANDOFF_MODE.md` 已落位。
- 系统级 skill 至少验证文件结构、触发描述、模板内容完整。
