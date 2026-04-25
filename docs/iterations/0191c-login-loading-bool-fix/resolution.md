---
title: "Iteration 0191c-login-loading-bool-fix Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0191c-login-loading-bool-fix
id: 0191c-login-loading-bool-fix
phase: phase1
---

# Iteration 0191c-login-loading-bool-fix Resolution

## Execution Strategy

- 先让测试明确失败，再只改 `login_catalog_ui.json` 的单个字段。

## Step 1

- Scope:
  - 在现有 login patch 测试中加入布尔类型断言
- Files:
  - `scripts/tests/test_0191c_login_patch_schema.mjs`
- Verification:
  - `node scripts/tests/test_0191c_login_patch_schema.mjs`
- Acceptance:
  - 测试先以类型错误失败
- Rollback:
  - 回退测试改动

## Step 2

- Scope:
  - 将 `login_loading` 从字符串改为布尔
- Files:
  - `packages/worker-base/system-models/login_catalog_ui.json`
- Verification:
  - `node scripts/tests/test_0191c_login_patch_schema.mjs`
- Acceptance:
  - 测试转绿
- Rollback:
  - 回退 `login_catalog_ui.json`
