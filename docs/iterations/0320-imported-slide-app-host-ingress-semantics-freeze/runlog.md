---
title: "0320 — imported-slide-app-host-ingress-semantics-freeze Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-04-14
source: ai
iteration_id: 0320-imported-slide-app-host-ingress-semantics-freeze
id: 0320-imported-slide-app-host-ingress-semantics-freeze
phase: phase4
---

# 0320 — imported-slide-app-host-ingress-semantics-freeze Runlog

## Environment

- Date: `2026-04-14`
- Branch: `dev_0320-imported-slide-app-host-ingress-semantics-freeze`
- Runtime: planning

## Planning Record

### Record 1

- Inputs reviewed:
  - 用户对候选架构的认可结论
  - `0305/0306/0310/0311` resolution
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
- Locked conclusions:
  - 当前 live code 事实与候选宿主 ingress 架构必须分开写
  - `0320` 只冻结候选规约，不进入实现

## Review Gate Record

### Review 1 — User

- Iteration ID: `0320-imported-slide-app-host-ingress-semantics-freeze`
- Review Date: `2026-04-14`
- Review Type: `User`
- Review Index: `1`
- Decision: **Approved**
- Notes:
  - 同意新开 docs-only 迭代
  - 先冻结 imported app 的宿主接入语义

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed

## Execution Record

### 2026-04-14 — Step 1 Current Fact Inventory

**Reviewed**
- `docs/iterations/0305-slide-event-target-and-deferred-input-sync/resolution.md`
- `docs/iterations/0306-slide-pin-chain-routing-buildout/resolution.md`
- `docs/iterations/0310-slide-frontend-pin-addressing-freeze/resolution.md`
- `docs/iterations/0311-slide-page-asset-pinification-buildout/resolution.md`
- `docs/ssot/runtime_semantics_modeltable_driven.md`
- `docs/user-guide/modeltable_user_guide.md`
- `packages/ui-model-demo-server/server.mjs`
- `packages/ui-model-demo-frontend/src/local_bus_adapter.js`

**Locked current facts**
- 当前前端 pin 事件仍可直达目标 cell 的目标 pin
- 并不是所有正式事件都已经统一先进 `Model 0`
- 输入草稿 / 延后同步已经成立
- cell 的有效模型标签唯一，但可被多层 scope 发现

### 2026-04-14 — Step 2 Candidate Architecture Freeze

**Created**
- `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md`

**Frozen**
- 本规约是候选正式架构，不是当前 live code 事实
- 3 个裁决被明确写出：
  - 哪些事件属于宿主正式 ingress
  - 宿主自动补哪些 adapter
  - imported app 最少暴露哪些边界 pin
- 本地 UI 草稿态明确留在统一 ingress 之外

### 2026-04-14 — Step 3 Verification

**Command**
- `node scripts/ops/obsidian_docs_audit.mjs --root docs` → PASS

**Result**
- 0320 已形成独立规约页
- 当前事实与候选架构已明确分开

### 2026-04-14 — Post-review Fix

**Input**
- review 指出：Decision 3 只冻结了 pin 名称、类型和语义，但没有补“宿主如何稳定定位边界 pin”的规则，后续自动 wiring 仍无法唯一接线。

**Action**
- 更新 `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md`
  - 补充边界 pin 的稳定定位要求
  - 补充可接受的定位方式
  - 补充多入口时必须声明 primary 的规则

**Result**
- Decision 3 现在不仅要求 imported app 声明边界 pin 的语义
- 也要求 imported app 提供足以让宿主唯一定位接线目标的稳定定位信息

### 2026-04-14 — Post-review Fix 2

**Input**
- review 继续指出：如果 v1 允许多种 locator form，但只要求宿主“支持其中一种”，仍然会出现双方都合规却无法互通的兼容洞。

**Action**
- 再次更新 `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md`
  - 将 v1 收紧为一个强制 locator form
  - 明确：
    - v1 imported app 必须提供 root-relative cell locator
    - v1 宿主必须支持 root-relative cell locator

**Result**
- v1 不再允许“多种 locator form 各取其一”的互操作空洞
- Decision 3 现在能支撑下一步自动 wiring 的唯一定位前提

## Living Docs Review

- `docs/ssot/runtime_semantics_modeltable_driven.md`
  - reviewed, no change needed
- `docs/user-guide/modeltable_user_guide.md`
  - reviewed, no change needed
- `docs/ssot/execution_governance_ultrawork_doit.md`
  - reviewed, no change needed
