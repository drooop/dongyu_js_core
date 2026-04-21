---
title: "Iteration 0194-ui-snapshot-helper-dedup Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0194-ui-snapshot-helper-dedup
id: 0194-ui-snapshot-helper-dedup
phase: phase1
---

# Iteration 0194-ui-snapshot-helper-dedup Resolution

## Execution Strategy

- 先用审计命令确认重复定义和 `model_id_is_editable` 的零消费现状。
- 再只做最小重构：
  - 新增统一 helper 模块
  - 目标文件改为 import
  - 删除未消费字段
- 最后用测试 + `rg` 双重验证，确认没有行为变化且重复定义已清掉。

## Step 1

- Scope:
  - 审计 snapshot helper 重复定义位置
  - 审计 `model_id_is_editable` 是否存在消费方
- Files:
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
  - `packages/ui-model-demo-frontend/src/remote_store.js`
  - `packages/ui-model-demo-frontend/src/page_asset_resolver.js`
  - `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
  - `packages/ui-model-demo-frontend/src/ui_schema_projection.js`
  - `packages/ui-model-demo-frontend/src/local_bus_adapter.js`
- Verification:
  - `rg -n "function getSnapshotModel|function getSnapshotLabelValue|function parseSafeInt|export function getSnapshotModel|export function getSnapshotLabelValue|export function parseSafeInt" packages/ui-model-demo-frontend/src`
  - `rg -n "model_id_is_editable" packages/ui-model-demo-frontend/src packages/ui-model-demo-server scripts`
- Acceptance:
  - 重复定义位置清单明确
  - `model_id_is_editable` 无消费方得到确认
- Rollback:
  - 本步仅记录事实，无代码回滚需求

## Step 2

- Scope:
  - 新增统一 snapshot helper 文件
  - 将目标文件改为 import 统一 helper
  - 删除 `deriveHomeTableRows` 中 `model_id_is_editable`
- Files:
  - `packages/ui-model-demo-frontend/src/snapshot_utils.js`
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
  - `packages/ui-model-demo-frontend/src/remote_store.js`
  - `packages/ui-model-demo-frontend/src/page_asset_resolver.js`
  - `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
  - `packages/ui-model-demo-frontend/src/ui_schema_projection.js`
  - `packages/ui-model-demo-frontend/src/local_bus_adapter.js`
- Verification:
  - `node packages/ui-model-demo-frontend/scripts/validate_demo.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_editor.mjs`
  - `node scripts/tests/test_0191a_page_asset_resolver.mjs`
  - `node scripts/tests/test_0191d_home_asset_resolution.mjs`
  - `node scripts/tests/test_0191d_docs_asset_resolution.mjs`
  - `node scripts/tests/test_0191d_static_asset_resolution.mjs`
  - `node scripts/tests/test_0191d_test_workspace_asset_resolution.mjs`
  - `rg -n "function getSnapshotModel|function getSnapshotLabelValue|function parseSafeInt|export function getSnapshotModel|export function getSnapshotLabelValue|export function parseSafeInt" packages/ui-model-demo-frontend/src`
  - `rg -n "model_id_is_editable" packages/ui-model-demo-frontend/src packages/ui-model-demo-server`
- Acceptance:
  - 所有验证通过
  - snapshot helper 重复定义仅保留在统一 helper 文件
  - `model_id_is_editable` 已从导出数据和运行时代码中消失
- Rollback:
  - 回退上述 6 个前端文件

## Step 3

- Scope:
  - 收口 runlog 与 `docs/ITERATIONS`
- Files:
  - `docs/iterations/0194-ui-snapshot-helper-dedup/runlog`
  - `docs/ITERATIONS`
- Verification:
  - runlog 记录 commit / merge / verification 证据
  - `docs/ITERATIONS` 状态与 runlog 一致
- Acceptance:
  - 台账完整
- Rollback:
  - 回退 docs vault 中本轮新增记录
