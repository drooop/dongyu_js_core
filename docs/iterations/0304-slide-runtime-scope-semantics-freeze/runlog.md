---
title: "0304 — slide-runtime-scope-semantics-freeze Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-04-09
source: ai
iteration_id: 0304-slide-runtime-scope-semantics-freeze
id: 0304-slide-runtime-scope-semantics-freeze
phase: phase4
---

# 0304 — slide-runtime-scope-semantics-freeze Runlog

## Environment

- Date: `2026-04-09`
- Branch: `dev_0304-slide-runtime-scope-semantics-freeze`
- Runtime: planning

## Planning Record

### Record 1

- Inputs reviewed:
  - [[CLAUDE]]
  - [[docs/WORKFLOW]]
  - [[docs/ITERATIONS]]
  - [[docs/iterations/0288-slide-ui-phaseA-topology-freeze/plan]]
  - [[docs/iterations/0302-slide-app-zip-import-v1/plan]]
  - [[docs/ssot/runtime_semantics_modeltable_driven]]
  - [[docs/ssot/label_type_registry]]
- Locked conclusions:
  - `0304` 只做 docs-only 语义冻结
  - `pin.table.* / pin.single.*` 清理与多重模型归属新语义必须分成两个独立验收点
  - 需求 3 落在 `0305`
  - 需求 4 落在 `0307`
  - `0306` 只建新路由，`0308` 再拆旧路由
  - `0304` 完成后先给同事接口预告，不等 `0309`

## Execution Start Record

### 2026-04-09

- Execution start:
  - `0304` 从 Phase 2 gate 进入 docs-only 执行
  - 当前目标不是改 runtime，而是先把：
    - `pin.table/pin.single` 退役口径
    - 多重模型归属语义
    - mailbox 之后的 Tier 归属
    - 同事 preview note
    一次写成现行规范
- done-criteria:
  - 上位架构、runtime SSOT、label registry、用户指南口径一致
  - `pin.table.* / pin.single.*` 已从现行主路径退出
  - preview note 已可给同事阅读
  - docs audit PASS

## Docs Updated

- [x] `docs/ITERATIONS.md` updated
- [x] `docs/plans/2026-04-09-slide-runtime-followup-it-breakdown.md` created
- [x] `docs/iterations/0304-slide-runtime-scope-semantics-freeze/plan.md` created
- [x] `docs/iterations/0304-slide-runtime-scope-semantics-freeze/resolution.md` created
- [x] `docs/iterations/0304-slide-runtime-scope-semantics-freeze/runlog.md` created
- [x] `docs/iterations/0305-slide-event-target-and-deferred-input-sync/*` scaffolded
- [x] `docs/iterations/0306-slide-pin-chain-routing-buildout/*` scaffolded
- [x] `docs/iterations/0307-slide-executable-app-import-v1/*` scaffolded
- [x] `docs/iterations/0308-slide-legacy-shortcut-retirement/*` scaffolded
- [x] `docs/iterations/0309-slide-matrix-delivery-and-coworker-guide/*` scaffolded
- [x] `docs/architecture_mantanet_and_workers.md` updated
- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` updated
- [x] `docs/ssot/label_type_registry.md` updated
- [x] `docs/ssot/tier_boundary_and_conformance_testing.md` updated
- [x] `docs/ssot/ui_to_matrix_event_flow.md` updated
- [x] `docs/user-guide/modeltable_user_guide.md` updated
- [x] `docs/user-guide/slide_matrix_delivery_preview_v0.md` created
- [x] `docs/user-guide/README.md` updated

## Review Gate Record

### Review 1 — AI-assisted

- Iteration ID: `0304-slide-runtime-scope-semantics-freeze`
- Review Date: `2026-04-09`
- Review Type: `AI-assisted`
- Review Index: `1`
- Decision: **Approved**
- Notes:
  - 用户已要求在开始 `0304` 之前先补齐后续 IT 落位、拆分 `0306` 风险，并把需求 3/4 明确落到后续 IT。

### Review 2 — User

- Iteration ID: `0304-slide-runtime-scope-semantics-freeze`
- Review Date: `2026-04-09`
- Review Type: `User`
- Review Index: `2`
- Decision: **Approved**
- Notes:
  - 用户确认 7-IT 方案可以启动 `0304`
  - 同时要求在 `0304` plan 中显式承认并记录：
    - `0305` 可能拆分为事件合同与 Input 延后同步两条节奏
    - `0306` 默认用内置模型验收
    - `0307` 不应阻塞主线
    - `0309` 需要紧跟 `0308`

### Review 3 — User

- Iteration ID: `0304-slide-runtime-scope-semantics-freeze`
- Review Date: `2026-04-09`
- Review Type: `User`
- Review Index: `3`
- Decision: **Approved**
- Notes:
  - `0304` plan 通过，可进入 Phase 2 gate
  - 非阻塞修正：`plan.md` §7 的“4 项”已改为“5 项”

## Execution Record

### 2026-04-09 — Step 1 现状差异盘点

**Facts captured**
- 当前 SSOT 中仍存在 `pin.table.* / pin.single.*` 现行条目：
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/ssot/label_type_registry.md`
  - `docs/architecture_mantanet_and_workers.md`
  - `docs/ssot/ui_to_matrix_event_flow.md`
- 当前上位文档仍把 materialized Cell 解释为“只有唯一归属”，尚未区分：
  - 主归属 / effective model label
  - 多层 scope discoverability

**Verification commands**
- `rg -n "pin\\.table|pin\\.single|pin\\.log\\.table|pin\\.log\\.single" docs/architecture_mantanet_and_workers.md docs/ssot/runtime_semantics_modeltable_driven.md docs/ssot/label_type_registry.md docs/ssot/ui_to_matrix_event_flow.md docs/user-guide/modeltable_user_guide.md docs/user-guide/README.md`
- `rg -n "effective model label|scope discoverability|mailbox 之后|Tier 1 runtime" docs/architecture_mantanet_and_workers.md docs/ssot/runtime_semantics_modeltable_driven.md docs/ssot/label_type_registry.md docs/ssot/tier_boundary_and_conformance_testing.md docs/user-guide/modeltable_user_guide.md`

### 2026-04-09 — Step 2 SSOT 语义冻结

**Implemented**
- 在上位和现行 SSOT 中冻结了两条语义：
  1. materialized Cell 仍有唯一 effective model label，但可被多个上层 scope 派生发现
  2. mailbox 之后的“事件 -> pin ingress / routing”解释属于 Tier 1 runtime
- 同步把现行主路径里的模型边界端口口径改为：
  - 非系统模型 root `(0,0,0)` 上的 `pin.in / pin.out`
  - 不再把 `pin.table.* / pin.single.*` 当作当前主路径

**Files**
- `docs/architecture_mantanet_and_workers.md`
- `docs/ssot/runtime_semantics_modeltable_driven.md`
- `docs/ssot/label_type_registry.md`
- `docs/ssot/tier_boundary_and_conformance_testing.md`
- `docs/ssot/ui_to_matrix_event_flow.md`
- `docs/user-guide/modeltable_user_guide.md`

### 2026-04-09 — Step 3 后续 IT 边界收紧

**Implemented**
- 后续 IT 拆分文档继续收紧：
  - `0305` 承认两个独立验收点，可在后续拆成 `0305a/0305b`
  - `0306` 默认用内置 `Model 100` 验收
  - `0307` 明确不阻塞主线
  - `0309` 明确紧跟 `0308`

**Files**
- `docs/plans/2026-04-09-slide-runtime-followup-it-breakdown.md`
- `docs/iterations/0305-slide-event-target-and-deferred-input-sync/plan.md`
- `docs/iterations/0306-slide-pin-chain-routing-buildout/plan.md`
- `docs/iterations/0307-slide-executable-app-import-v1/plan.md`
- `docs/iterations/0309-slide-matrix-delivery-and-coworker-guide/plan.md`

### 2026-04-09 — Step 4 同事接口预告

**Implemented**
- 新增：
  - `docs/user-guide/slide_matrix_delivery_preview_v0.md`
- 这份预告明确给出：
  - 当前 zip 包结构
  - Matrix 投递的大方向
  - 当前已稳定与尚未冻结的部分
  - 临时替身验证路径（Workspace 手动导入）

### Review 4 — AI Self-Verification

- Iteration ID: `0304-slide-runtime-scope-semantics-freeze`
- Review Date: `2026-04-09`
- Review Type: `AI-assisted`
- Review Index: `4`
- Decision: **Approved**
- Notes:
  - 当前现行文档里 `pin.table.* / pin.single.*` 只保留在历史别名或迁移债务说明中
  - 多重 scope discoverability 与 Tier 1 ingress 归属已同步写入上位和现行文档
  - 同事 preview note 已落盘

## Deterministic Verification

- `rg -n "pin\\.table|pin\\.single|pin\\.log\\.table|pin\\.log\\.single" docs/architecture_mantanet_and_workers.md docs/ssot/runtime_semantics_modeltable_driven.md docs/ssot/label_type_registry.md docs/ssot/tier_boundary_and_conformance_testing.md docs/ssot/ui_to_matrix_event_flow.md docs/user-guide/modeltable_user_guide.md docs/user-guide/slide_matrix_delivery_preview_v0.md docs/user-guide/README.md`
  - 结果：现行主路径只剩历史别名 / 债务说明，不再把这些类型列为当前正式端口
- `rg -n "mailbox 之后|Tier 1 runtime|多个上层 scope|scope discoverability|pin ingress|主归属" docs/architecture_mantanet_and_workers.md docs/ssot/runtime_semantics_modeltable_driven.md docs/ssot/label_type_registry.md docs/ssot/tier_boundary_and_conformance_testing.md docs/ssot/ui_to_matrix_event_flow.md docs/user-guide/modeltable_user_guide.md docs/user-guide/slide_matrix_delivery_preview_v0.md`
  - 结果：新语义与 Tier 归属均可检出
- `node scripts/ops/obsidian_docs_audit.mjs --root docs`
  - PASS
