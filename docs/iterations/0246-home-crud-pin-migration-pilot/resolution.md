---
title: "0246 — home-crud-pin-migration-pilot Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0246-home-crud-pin-migration-pilot
id: 0246-home-crud-pin-migration-pilot
phase: phase1
---

# 0246 — home-crud-pin-migration-pilot Resolution

## Strategy

0246 只做业务迁移样板，不再改 runtime privilege 规则。

## Steps

| Step | Name | Goal |
|---|---|---|
| 1 | Freeze pin target contract | 定义 Home CRUD 的新 pin-based target contract |
| 2 | Migrate Home write path | 把 Home save/delete/select 等动作切到新链路 |
| 3 | Keep UX parity | 保持 0243 的用户可操作性和结果等价 |
| 4 | Regression | 证明迁移 bug 与 runtime bug 已解耦 |

