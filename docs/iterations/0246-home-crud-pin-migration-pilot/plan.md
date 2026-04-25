---
title: "0246 — home-crud-pin-migration-pilot Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0246-home-crud-pin-migration-pilot
id: 0246-home-crud-pin-migration-pilot
phase: phase1
---

# 0246 — home-crud-pin-migration-pilot Plan

## Metadata

- ID: `0246-home-crud-pin-migration-pilot`
- Date: `2026-03-26`
- Owner: AI-assisted planning
- Branch: `dropx/dev_0246-home-crud-pin-migration-pilot`
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Depends on:
  - `0245-scoped-privilege-runtime-and-regression`
  - `0243-home-mailbox-crud-for-filltable`

## WHAT

0246 不再做 runtime scope check 本身，而是在 0245 已验证的能力之上，把 Home CRUD 从 mailbox 链迁移到 pin，作为第一个业务样板。

## WHY

Home CRUD 已经是当前最清晰、最容易验证的页面级写入入口。  
用它做第一个 mailbox -> pin 样板，最容易判断：

- 迁移后行为是否等价
- 哪些 mailbox 中间层还可以删
- 哪些 handler 可以保留但换触发方式

## Success Criteria

- Home CRUD 不再依赖旧 mailbox-dispatch 链路
- Home 对正数模型写入改走新的 pin-based contract
- 行为与 `0243` 用户体验保持等价

