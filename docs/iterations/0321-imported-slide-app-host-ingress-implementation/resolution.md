---
title: "0321 — imported-slide-app-host-ingress-implementation Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0321-imported-slide-app-host-ingress-implementation
id: 0321-imported-slide-app-host-ingress-implementation
phase: phase1
---

# 0321 — imported-slide-app-host-ingress-implementation Resolution

## Execution Strategy

1. 先补失败测试，锁定 boundary pin schema、导入校验与宿主自动 route。
2. 再以最小 schema 和最小 semantic（`submit`）实现导入期 host adapter。
3. 最后跑回归、本地导入验证并更新文档。

## Step 1

- Scope:
  - 锁定 v1 boundary pin schema 和导入期 host adapter 合同
- Files:
  - `scripts/tests/test_0321_imported_host_ingress_contract.mjs`
  - `scripts/tests/test_0321_imported_host_ingress_server_flow.mjs`
- Verification:
  - 初始测试必须失败
- Acceptance:
  - 测试能锁定：
    - 只允许 `root-relative cell locator`
    - 必须声明 primary 边界 pin
    - 安装后自动生成 `Model 0` ingress route
    - `Model 0` ingress 可 relay 到 imported app boundary pin
- Rollback:
  - 删除新增测试

## Step 2

- Scope:
  - 实现导入期 boundary pin 校验、宿主 route 生成与删除清理
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/worker-base/src/runtime.mjs`（如需最小辅助）
  - `scripts/tests/fixtures/`（如需最小 payload fixture）
- Verification:
  - 新测试 PASS
- Acceptance:
  - MVP 以 `submit` semantic 成立
  - imported app 删除后，不遗留宿主自动生成的 ingress port / `pin.connect.model` route
- Rollback:
  - 回退实现改动

## Step 3

- Scope:
  - 文档、回归与 authoritative SSOT 同步
- Files:
  - `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/label_type_registry.md`
  - `docs/iterations/0321-imported-slide-app-host-ingress-implementation/runlog.md`
  - 视需要补一页用户/同事说明
- Verification:
  - `node scripts/ops/obsidian_docs_audit.mjs --root docs`
  - 相关导入回归 PASS
- Acceptance:
  - 文档与实现口径一致
  - authoritative SSOT 对新的 boundary pin 声明与宿主 route 生成有同步更新
- Rollback:
  - 回退文档改动
