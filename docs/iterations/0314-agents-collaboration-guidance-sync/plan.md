---
title: "0314 — agents-collaboration-guidance-sync Plan"
doc_type: iteration-plan
status: completed
updated: 2026-04-13
source: ai
iteration_id: 0314-agents-collaboration-guidance-sync
id: 0314-agents-collaboration-guidance-sync
phase: phase4
---

# 0314 — agents-collaboration-guidance-sync Plan

## Goal

- 将 `AGENTS.md` 中新增的 repo-local collaboration 补充正式提交，并按仓库分支规则合回 `dev`。

## Scope

- In scope:
  - 提交 `AGENTS.md`
  - 补 0314 迭代记录
  - 本地 merge 到 `dev` 并 push
- Out of scope:
  - 不改 `CLAUDE.md`
  - 不修改业务代码
  - 不扩写其他用户文档

## Invariants / Constraints

- 只提交 `AGENTS.md` 与 `0314` 迭代记录。
- 不改动用户未明确要求的其他文件。
- 仍遵守：
  - 先迭代分支
  - 再 merge 回 `dev`
  - 最后 push

## Success Criteria

1. `AGENTS.md` 的新增协作补充进入 git 历史。
2. `0314` 在 `docs/ITERATIONS.md` 与本地迭代目录有完整记录。
3. 变更已 merge 到 `dev` 并推到 `origin/dev`。

## Inputs

- Created at: 2026-04-13
- Iteration ID: `0314-agents-collaboration-guidance-sync`
- User request:
  - “AGENTS.md也提交并推送吧”
