---
title: "0253 — hard-cut-ui-authoring-and-write-contract-freeze Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0253-hard-cut-ui-authoring-and-write-contract-freeze
id: 0253-hard-cut-ui-authoring-and-write-contract-freeze
phase: phase1
---

# 0253 — hard-cut-ui-authoring-and-write-contract-freeze Plan

## Metadata

- ID: `0253-hard-cut-ui-authoring-and-write-contract-freeze`
- Date: `2026-03-27`
- Owner: AI-assisted planning
- Branch: `dev_0253-hard-cut-ui-authoring-and-write-contract-freeze`
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Depends on:
  - `0244-pin-only-core-with-scoped-privilege-contract-freeze`
  - `0247-cross-model-pin-owner-materialization-contract-freeze`
  - `0249-home-crud-pin-migration-retry-on-owner-materialization`

## WHAT

冻结 hard-cut 新 contract：

- `cellwise authoring` 是唯一 UI source
- rich page 不再以手写 `page_asset_v0` 为 source
- business write 一律 `pin/owner-materialization`
- direct positive-model `bind.write` 废弃

## Success Criteria

- 新 authoring label 家族冻结
- 新 layout/composition 规则冻结
- 新 write routing 规则冻结
- 旧路线废弃边界写清
- 形成一份独立 contract 文档，供 0254+ implementation 直接消费

## Frozen Contract

### 1. Authoring Source

- `cellwise.ui.v1` 是唯一合法 UI authoring source
- rich page 不再以手写 `page_asset_v0` 为 authoring source

### 2. Root Labels

放在 root `(0,0,0)`：

- `ui_authoring_version = "cellwise.ui.v1"`
- `ui_root_node_id`

### 3. Node Labels

每个 node 一个 cell，最小 label 家族：

- `ui_node_id`
- `ui_component`
- `ui_parent`
- `ui_order`
- `ui_slot` optional
- `ui_layout`
- `ui_gap`
- `ui_wrap`
- `ui_text`
- `ui_title`
- `ui_label`
- `ui_variant`
- `ui_placeholder`

### 4. Read Binding

read binding 由分散 label 表达：

- `ui_read_model_id`
- `ui_read_p`
- `ui_read_r`
- `ui_read_c`
- `ui_read_k`

### 5. Write Routing

- UI-local write 可继续 same-model/local
- business write 一律不再 author 成 direct positive-model `target_ref`
- business write 必须表达为 action intent，并走 `pin/owner-materialization`

### 6. Hard Deprecation

- 禁止新增手写 `page_asset_v0`
- 禁止新增 direct positive-model `bind.write`
