---
title: "Iteration 0194-ui-snapshot-helper-dedup Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0194-ui-snapshot-helper-dedup
id: 0194-ui-snapshot-helper-dedup
phase: phase1
---

# Iteration 0194-ui-snapshot-helper-dedup Plan

## Goal

- 清理 UI 层低优先级技术债：
  - 将 `getSnapshotModel` / `getSnapshotLabelValue` / `parseSafeInt` 抽成统一 helper
  - 删除 `deriveHomeTableRows` 中当前无消费方的 `model_id_is_editable`

## Background

- 当前这 3 个 snapshot helper 在 UI 相关文件中存在多处重复定义：
  - `demo_modeltable`
  - `remote_store`
  - `page_asset_resolver`
  - `editor_page_state_derivers`
  - `ui_schema_projection`
- 这些 helper 语义相同，但散落在多个文件中，后续一旦 snapshot key 或容错规则变化，维护成本会被放大。
- 同时，[editor_page_state_derivers.js](/Users/drop/codebase/cowork/dongyuapp_elysia_based/packages/ui-model-demo-frontend/src/editor_page_state_derivers.js) 中的 `model_id_is_editable` 字段当前无消费方，继续保留只会增加噪声。

## Scope

- In scope:
  - 新增统一 helper 模块，例如 `snapshot_utils`
  - `demo_modeltable`、`remote_store`、`page_asset_resolver`、`editor_page_state_derivers`、`ui_schema_projection`、`local_bus_adapter` 改为 import 统一 helper
  - 删除 `deriveHomeTableRows` 中未消费的 `model_id_is_editable`
  - 增加最小验证，确认重复定义已删除
- Out of scope:
  - 不改变 snapshot 结构
  - 不改变页面行为
  - 不调整 runtime / server / renderer 协议
  - 不顺手做其它 helper 重构

## Invariants / Constraints

- 这轮是 UI 技术债清理，不得借机引入行为变更。
- 必须遵守 repo root `CLAUDE` 的 Tier 边界：
  - 仅做前端 helper 去重与字段清理
  - 不扩 Tier 1 解释器语义
- 验收除了测试 PASS 外，还必须用 `rg` 明确证明旧的重复定义已删除。

## Success Criteria

- 新的统一 snapshot helper 模块存在并被 UI 相关文件复用。
- `getSnapshotModel` / `getSnapshotLabelValue` / `parseSafeInt` 在目标文件中不再重复定义。
- `deriveHomeTableRows` 不再输出 `model_id_is_editable`。
- 既有相关验证通过。
- `rg` 结果确认重复定义只保留在新的统一 helper 文件中。
- `model_id_is_editable` 仅允许在本轮新增测试中出现，不得再出现在运行时代码或导出数据中。

## Risks & Mitigations

- Risk:
  - 抽 helper 时改动 import 路径，导致页面解析或本地 store 出现回归。
  - Mitigation:
    - 用现有 `validate_demo`、`validate_editor` 与相关 0191 测试做回归。
- Risk:
  - 误删 `model_id_is_editable` 后，隐藏消费方才暴露。
  - Mitigation:
    - 先用 `rg` 确认无消费方，再删除；若发现消费者则本轮停止并回到 Gate。

## Alternatives

### A. 推荐：统一抽 helper 并删除未消费字段

- 优点：
  - 技术债一次性收干净
  - 后续 snapshot 相关改动只需改一处
- 缺点：
  - 需要同步调整多个 import

### B. 只删未消费字段，不做 helper 去重

- 优点：
  - 改动更小
- 缺点：
  - snapshot helper 重复定义仍然保留
  - 后续仍有多点维护成本

当前推荐：A。

## Inputs

- Created at: 2026-03-19
- Iteration ID: 0194-ui-snapshot-helper-dedup
- Trigger:
  - 用户明确要求先处理 UI 层剩余低优先级技术债
  - 范围已确认仅包含 snapshot helper 去重和 `model_id_is_editable` 删除
