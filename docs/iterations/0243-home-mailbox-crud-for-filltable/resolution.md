---
title: "0243 — home-mailbox-crud-for-filltable Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0243-home-mailbox-crud-for-filltable
id: 0243-home-mailbox-crud-for-filltable
phase: phase1
---

# 0243 — home-mailbox-crud-for-filltable Resolution

## Strategy

0243 采用：

1. 先把 `0212` contract test 扩成真实 RED
2. 再补 Home asset UI surface
3. 再补 `intent_dispatch_table` / `intent_handlers_home.json`
4. 最后用 local/server validator 证明本地 Home 已可直接填表

## Steps

| Step | Name | Goal | Verification |
|---|---|---|---|
| 1 | Freeze 0212 Action Contract As RED | 让 `0212` contract test 真正要求 Home asset / dispatch table materialize 这套 `home_*` actions | `test_0212_home_crud_contract` 先 FAIL |
| 2 | Materialize Home CRUD UI | 在 `home_catalog_ui.json` 增加 Add/Edit/Delete/Detail/dialog surface | updated asset validators PASS |
| 3 | Add Home Handlers | 在 `intent_dispatch_config.json` / `intent_handlers_home.json` 中接住 `home_*` business writes | server validator PASS |
| 4 | Align Local Contract | local adapter 至少对 `home_*` 给出明确行为（复用或 explicit unsupported） | local validator PASS |
| 5 | Regression And Closeout | 回归 + runlog + ledger | targeted suite PASS |

