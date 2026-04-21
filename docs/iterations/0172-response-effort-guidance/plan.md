---
title: "0172 — 回复复杂度建议规约化"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0172-response-effort-guidance
id: 0172-response-effort-guidance
phase: phase1
---

# 0172 — 回复复杂度建议规约化

## Goal

- 将“每次回复都附带 `medium` / `high` / `xhigh` 选择建议”从聊天偏好提升为仓库内可复用规约。
- 约束应进入最高优先级文档，避免只停留在会话上下文。

## Scope

- In scope:
- 在 `CLAUDE.md` 增加统一回复复杂度建议规则与使用边界。
- 在 iteration 文档中记录本次治理变更的目标、执行方案与事实证据。
- Out of scope:
- 修改运行时代码、业务逻辑或测试用例。
- 追溯历史 iteration 台账收口。

## Invariants / Constraints

- `CLAUDE.md` 是本仓库执行约束的唯一最高优先级来源。
- 先登记 iteration，再做文档变更。
- 仅做治理文档修改，不触碰 runtime / server / worker 逻辑。
- 回复中的建议必须是“建议等级”，不能冒充硬性的任务复杂度事实。

## Success Criteria

- `CLAUDE.md` 明确要求每次回复都附带 `medium` / `high` / `xhigh` 建议。
- 规约中给出默认值与升级条件，避免使用口径漂移。
- `docs/ITERATIONS.md` 已登记本 iteration，runlog 有 gate 与执行证据。

## Inputs

- Created at: 2026-03-07
- Iteration ID: 0172-response-effort-guidance
- Trigger:
  - 用户要求今后每次回复都附带 `medium/high/xhigh` 选择建议，并要求纳入规约。
