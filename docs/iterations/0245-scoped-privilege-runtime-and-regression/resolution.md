---
title: "0245 — scoped-privilege-runtime-and-regression Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-03-26
source: ai
iteration_id: 0245-scoped-privilege-runtime-and-regression
id: 0245-scoped-privilege-runtime-and-regression
phase: phase1
---

# 0245 — scoped-privilege-runtime-and-regression Resolution

## Strategy

0245 只改 runtime / tests / docs assessment，不触碰 mailbox migration。

## Steps

| Step | Name | Goal |
|---|---|---|
| 1 | Freeze runtime API surface | 定义 privileged capability 的 runtime 表达方式 |
| 2 | Add RED regression suite | 先把 same-model privilege / cross-submt forbid 写成 RED |
| 3 | Implement scoped privilege | 在 runtime 中落 capability check 与 scope check |
| 4 | Run regression suite | 证明 runtime 能力独立成立 |

