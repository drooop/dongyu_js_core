---
title: "0298 — pin-contract-cleanup Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-06
source: ai
iteration_id: 0298-pin-contract-cleanup
id: 0298-pin-contract-cleanup
phase: phase1
---

# 0298 — pin-contract-cleanup Resolution

## Execution Strategy

- 先删 runtime compat，再迁范围内 patch/config/docs。
- 每一步都用失败测试或明确 grep 证明“旧残留确实存在”，再做最小改动。
- 不扩大到未锁定文件。

## Step 1

- Scope:
  - 清掉 `runtime.mjs` 中 4 处旧 pin compat handler
- Files:
  - `packages/worker-base/src/runtime.mjs`
  - 受影响的 targeted tests
- Verification:
  - 必须先有 grep/测试证明 compat handler 仍存在
  - 删除后 `0294` 主路径相关 tests 仍然全部 PASS
- Acceptance:
  - runtime 不再内建 `pin.table.* / pin.single.*` 的兼容语义
- Rollback:
  - 回退 runtime 与相关 tests

## Step 2

- Scope:
  - 迁移已锁定的 system-model / config 残留
- Files:
  - `packages/worker-base/system-models/intent_handlers_home.json`
  - `packages/worker-base/system-models/home_catalog_ui.json`
  - `deploy/sys-v1ns/ui-side-worker/patches/10_ui_side_worker_demo.json`
  - `packages/worker-base/system-models/llm_cognition_config.json`
- Verification:
  - grep 不再命中这些文件中的旧 pin family
  - Home CRUD / ui-side-worker demo 对应 contract tests 必须 PASS
- Acceptance:
  - 范围内的 patch/config 残留已切到新合同
- Rollback:
  - 回退这些 patch/config 改动

## Step 3

- Scope:
  - 同步规范文档并做本地验证
- Files:
  - `CLAUDE.md`
  - `docs/user-guide/modeltable_user_guide.md`（如需要）
  - `docs/iterations/0298-pin-contract-cleanup/runlog.md`
  - `docs/ITERATIONS.md`
- Verification:
  - `CLAUDE.md` 的 `PIN_SYSTEM` 不再保留旧 family 的规范描述
  - `obsidian_docs_audit` PASS
  - 本地 redeploy 后至少确认：
    - 首页 CRUD
    - `0270`
    - `Static`
    - 颜色生成器
- Acceptance:
  - cleanup 已从 runtime / patch / docs 三层闭环
- Rollback:
  - 回退 docs 和 cleanup 改动

## Explicit Non-Goals

- 不做新的 pin 设计
- 不清理 `0298` 范围之外的历史残留
- 不改 Matrix / Slide UI / Three.js 功能
- 不开新的 Gallery 展示

## Notes

- 这轮 cleanup 完成后，才适合重新进入业务线实现。
