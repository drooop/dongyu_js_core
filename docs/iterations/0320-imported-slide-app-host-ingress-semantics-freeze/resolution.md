---
title: "0320 — imported-slide-app-host-ingress-semantics-freeze Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0320-imported-slide-app-host-ingress-semantics-freeze
id: 0320-imported-slide-app-host-ingress-semantics-freeze
phase: phase1
---

# 0320 — imported-slide-app-host-ingress-semantics-freeze Resolution

## Execution Strategy

1. 先收当前事实证据，确认现有 direct-pin、deferred input 和 scope discoverability 的正式边界。
2. 再冻结候选宿主 ingress 语义，明确它不是当前事实，而是下一阶段规约候选。
3. 最后评估对现有说明页和未来实现迭代的影响，但不进入实现。

## Step 1

- Scope:
  - 收当前已实现事实
- Files:
  - `docs/iterations/0305-slide-event-target-and-deferred-input-sync/resolution.md`
  - `docs/iterations/0306-slide-pin-chain-routing-buildout/resolution.md`
  - `docs/iterations/0310-slide-frontend-pin-addressing-freeze/resolution.md`
  - `docs/iterations/0311-slide-page-asset-pinification-buildout/resolution.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/ui-model-demo-frontend/src/local_bus_adapter.js`
- Verification:
  - 记录关键事实和不变量
- Acceptance:
  - “当前事实”部分自洽，不混入候选架构
- Rollback:
  - 回退 `0320` 文档

## Step 2

- Scope:
  - 冻结候选宿主 ingress 语义
- Files:
  - `docs/iterations/0320-imported-slide-app-host-ingress-semantics-freeze/plan.md`
  - `docs/iterations/0320-imported-slide-app-host-ingress-semantics-freeze/runlog.md`
  - `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md`
- Verification:
  - 文本审查
- Acceptance:
  - 明确回答 3 个裁决：
    - 哪些事件必须统一 ingress
    - 宿主自动补哪些 adapter
    - imported app 最少暴露哪些边界 pin
- Rollback:
  - 回退 `0320` 文档

## Step 3

- Scope:
  - 评估对现有文档和后续实现的影响
- Files:
  - `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md`
  - `docs/iterations/0320-imported-slide-app-host-ingress-semantics-freeze/runlog.md`
- Verification:
  - `node scripts/ops/obsidian_docs_audit.mjs --root docs`
- Acceptance:
  - 明确哪些现有页后续需要引用 0320
  - 不直接改写现有“当前事实”口径
- Rollback:
  - 回退本轮 planning 文档
