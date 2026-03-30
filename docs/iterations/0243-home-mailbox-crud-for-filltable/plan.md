---
title: "0243 — home-mailbox-crud-for-filltable Plan"
doc_type: iteration-plan
status: planned
updated: 2026-03-26
source: ai
iteration_id: 0243-home-mailbox-crud-for-filltable
id: 0243-home-mailbox-crud-for-filltable
phase: phase1
---

# 0243 — home-mailbox-crud-for-filltable Plan

## Metadata

- ID: `0243-home-mailbox-crud-for-filltable`
- Date: `2026-03-26`
- Owner: AI-assisted planning
- Branch: `dropx/dev_0243-home-mailbox-crud-for-filltable`
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Depends on:
  - `0212-home-crud-proper-tier2`
  - `0240-local-browser-evidence-rerun-after-0238-0239`

## WHAT

本 iteration 按 `0212` 已冻结的 action 名，补齐 Home 页真正可用的 mailbox-based CRUD：

- `home_refresh`
- `home_select_row`
- `home_open_create`
- `home_open_edit`
- `home_save_label`
- `home_delete_label`
- `home_view_detail`
- `home_close_detail`
- `home_close_edit`

目标不是放开 direct positive mutation，而是让 Home 页通过 mailbox -> handler -> `addLabel/rmLabel` 对选中正数模型执行增删改查。

## WHY

当前 Home 只有：
- filter
- select
- refresh shell

没有：
- Add Label
- Edit
- Delete
- create/edit/detail UI surface

因此用户虽然能看表，但还不能真正“填表”。

同时当前规约已经明确：
- 负数 UI state 可直接写
- 正数业务模型不得 direct mutation
- 正数写入必须走 mailbox / handler 路径

所以 0243 的正确实现必须是 mailbox-based CRUD，而不是临时放开 direct write。

## Success Criteria

- Home `page_asset_v0` 中 materialize 出 CRUD UI
- 只使用 `0212` 已冻结的 action 名
- 正数模型 CRUD 通过 `intent_dispatch_table` + `intent_handlers_home.json`
- 本地 server path 可直接完成 Home 增删改查
- generic `direct_model_mutation_disabled` 仍继续生效

