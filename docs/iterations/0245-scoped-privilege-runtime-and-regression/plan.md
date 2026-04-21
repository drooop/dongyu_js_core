---
title: "0245 — scoped-privilege-runtime-and-regression Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0245-scoped-privilege-runtime-and-regression
id: 0245-scoped-privilege-runtime-and-regression
phase: phase1
---

# 0245 — scoped-privilege-runtime-and-regression Plan

## Metadata

- ID: `0245-scoped-privilege-runtime-and-regression`
- Date: `2026-03-26`
- Owner: AI-assisted planning
- Branch: `dropx/dev_0245-scoped-privilege-runtime-and-regression`
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Depends on:
  - `0244-pin-only-core-with-scoped-privilege-contract-freeze`

## WHAT

0245 只做 runtime 能力层：

- privileged capability 识别
- `root (0,0,0)` 自动 privilege
- non-root explicit privilege
- `Model.table` same-model scope check
- `Model.matrix` same-scope check
- `submt` / cross-model hard-boundary
- regression tests

## WHY

必须先把 runtime 能力独立做对，再做 mailbox -> pin 迁移。  
否则一旦行为错误，无法判断问题来自：

- scope check 本身
- 还是业务迁移本身

## Success Criteria

- runtime 层已有 scoped privilege 能力
- regression tests 可以独立证明：
  - ordinary cell 无跨 cell direct access
  - table root / privileged cell 可操作 same-model owned cells
  - matrix root / privileged cell 只限自己矩阵作用域
  - 跨 `model.submt` 仍失败
  - 跨 `model_id` 仍失败

