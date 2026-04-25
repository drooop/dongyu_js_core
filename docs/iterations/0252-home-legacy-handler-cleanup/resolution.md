---
title: "0252 — home-legacy-handler-cleanup Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0252-home-legacy-handler-cleanup
id: 0252-home-legacy-handler-cleanup
phase: phase1
---

# 0252 — home-legacy-handler-cleanup Resolution

## Execution Strategy

1. 先定位 `intent_handlers_home.json` 中 legacy `handle_home_*` direct-write 块
2. 删除仅用于旧 dispatch direct-write 的实现，保留 pin-only 相关必要声明
3. 运行 Home CRUD 与 pin owner-materialization 相关回归，确认行为不回退

## Step 1

- Scope:
  - 清理 legacy `handle_home_*` direct-write 逻辑
- Files:
  - `packages/worker-base/system-models/intent_handlers_home.json`
- Verification:
  - source inspection
- Acceptance:
  - 不再出现 legacy direct-write handler 块
- Rollback:
  - revert target file

## Step 2

- Scope:
  - 回归验证与收尾文档
- Files:
  - `scripts/tests/test_0249_home_crud_pin_migration_contract.mjs`
  - `scripts/tests/test_0212_home_crud_contract.mjs`
  - `packages/ui-model-demo-frontend/scripts/validate_home_crud_server_sse.mjs`
  - `docs/iterations/0252-home-legacy-handler-cleanup/runlog.md`
- Verification:
  - deterministic PASS/FAIL command output
- Acceptance:
  - 与 Home CRUD pin-only 相关验证全部 PASS
- Rollback:
  - revert test/doc updates
