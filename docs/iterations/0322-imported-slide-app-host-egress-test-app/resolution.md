---
title: "0322 — imported-slide-app-host-egress-test-app Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0322-imported-slide-app-host-egress-test-app
id: 0322-imported-slide-app-host-egress-test-app
phase: phase1
---

# 0322 — imported-slide-app-host-egress-test-app Resolution

## Execution Strategy

1. 先写失败测试，锁定 imported app 的宿主入口、内部整理与宿主外发三段链路。
2. 再实现最小宿主 egress adapter，并补一个真实可导入的 slide app payload / zip。
3. 最后跑导入、外发与删除清理回归，并同步 authoritative docs。

## Step 1

- Scope:
  - 先锁定 imported app host egress MVP 合同与真实 server flow
- Files:
  - `scripts/tests/test_0322_imported_host_egress_contract.mjs`
  - `scripts/tests/test_0322_imported_host_egress_server_flow.mjs`
- Verification:
  - 新测试初始必须失败
- Acceptance:
  - 测试能锁定：
    - imported app 可导入并拿到新 `model_id`
    - imported app 声明的宿主入口可接 `submit`
    - imported app 会把结果整理成临时模型表 payload
    - 宿主自动补的 egress adapter 能接到 `Model 0`
    - `pin.bus.out / MQTT / Matrix` 三层都能被观察到
- Rollback:
  - 删除新增测试

## Step 2

- Scope:
  - 实现 imported app host egress adapter、生成测试 payload / zip，并补删除清理
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/worker-base/src/runtime.mjs`（仅在现有运行时能力不足时做最小辅助）
  - `test_files/imported_host_egress_app_payload.json`
  - `test_files/imported_host_egress_app.zip`
- Verification:
  - Step 1 新测试 PASS
  - zip 经真实导入链验证 PASS
- Acceptance:
  - imported app 删除后，不遗留宿主自动生成的 ingress / egress labels、forward function 或 mount relay
  - 不放开 imported zip 自带 `pin.bus.out`
- Rollback:
  - 回退实现与测试资产

## Step 3

- Scope:
  - authoritative docs / user-guide / handover 同步与完成态收口
- Files:
  - `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/label_type_registry.md`
  - `docs/user-guide/modeltable_user_guide.md`
  - `docs/handover/dam-worker-guide.md`
  - `docs/iterations/0322-imported-slide-app-host-egress-test-app/runlog.md`
  - `docs/ITERATIONS.md`
- Verification:
  - `node scripts/ops/obsidian_docs_audit.mjs --root docs`
- Acceptance:
  - 文档与实现口径一致
  - runlog 有真实命令、关键输出、commit 与 docs updated 记录
- Rollback:
  - 回退文档与索引改动
