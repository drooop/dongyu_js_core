---
title: "0294 — foundation-b-runtime-migration Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-06
source: ai
iteration_id: 0294-foundation-b-runtime-migration
id: 0294-foundation-b-runtime-migration
phase: phase1
---

# 0294 — foundation-b-runtime-migration Resolution

## Execution Strategy

- 本 iteration 是正式实现规划，不是立刻执行。
- 目标是把基础 B 拆成可执行的几步，供后续 Phase 3 严格顺序实施。
- 实施顺序固定为：
  1. runtime 合同切换
  2. 核心 system patch 迁移
  3. host / adapter 迁移
  4. validator / contract test 迁移
  5. 已规划业务线复审与收尾

## Step 1

- Scope:
  - runtime 合同切换
- Files:
  - `packages/worker-base/src/runtime.js`
  - `packages/worker-base/src/runtime.mjs`
  - `scripts/worker_engine_v0.mjs`
- Verification:
  - 必须有 failing tests first
  - 必须证明 runtime 已接受新 pin / payload 语义
  - 必须证明 D0 / 非 D0 / 矩阵权限边界符合新合同
- Acceptance:
  - Tier 1 运行时主语义切到新合同
- Rollback:
  - 回退 runtime 相关改动

## Step 2

- Scope:
  - 核心 system-model / deploy patch 迁移
- Files:
  - `deploy/sys-v1ns/remote-worker/patches/10_model100.json`
  - `deploy/sys-v1ns/remote-worker/patches/11_model1010.json`
  - `deploy/sys-v1ns/ui-side-worker/patches/10_ui_side_worker_demo.json`
  - `deploy/sys-v1ns/mbr/patches/mbr_role_v0.json`
  - `packages/worker-base/system-models/test_model_100_full.json`
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `packages/worker-base/system-models/templates/data_array_v0.json`
- Verification:
  - 旧 `pin.table.*` / `pin.single.*` 已迁出主路径
  - payload 不再默认携带 `action`
- Acceptance:
  - 核心 patch 面与新合同一致
- Rollback:
  - 回退 patch 改动

## Step 3

- Scope:
  - host / adapter / server 理解新合同
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/ui-model-demo-frontend/src/local_bus_adapter.js`
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
- Verification:
  - 新 payload 可被 host/adapter 正确理解
  - 不再默认依赖旧 action envelope
- Acceptance:
  - UI / host 层对新合同无歧义
- Rollback:
  - 回退 host / adapter 改动

## Step 4

- Scope:
  - validator / contract test 迁移
- Files:
  - `scripts/tests/test_0216_threejs_scene_contract.mjs`
  - `scripts/validate_program_model_loader_v0.mjs`
  - 其它受影响的 tests / validators
- Verification:
  - 所有迁移过的 tests/validators 在新合同下 PASS
- Acceptance:
  - 新合同有完整验证面
- Rollback:
  - 回退验证脚本改动

## Step 5

- Scope:
  - 补做 `0283-0291` 受影响说明复审
- Files:
  - `docs/iterations/0283-0291/*`（按需最小改动）
  - `docs/ITERATIONS.md`
- Verification:
  - 必须明确哪些业务线表述已更新到新合同
- Acceptance:
  - 基础层迁移和业务线规划重新对齐
- Rollback:
  - 回退文档修订
