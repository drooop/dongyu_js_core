---
title: "0294 — foundation-b-runtime-migration Plan"
doc_type: iteration-plan
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0294-foundation-b-runtime-migration
id: 0294-foundation-b-runtime-migration
phase: phase1
---

# 0294 — foundation-b-runtime-migration Plan

## 0. Metadata

- ID: `0294-foundation-b-runtime-migration`
- Date: `2026-04-06`
- Owner: AI-assisted planning
- Branch: `dev_0294-foundation-b-runtime-migration`
- Planning mode: `refine`
- Depends on:
  - [[docs/iterations/0292-foundation-pin-payload-contract-freeze/plan]]
  - [[docs/ssot/temporary_modeltable_payload_v1]]
  - [[docs/ssot/program_model_pin_and_payload_contract_vnext]]
  - [[docs/plans/2026-04-06-pin-payload-impact-inventory-and-migration]]

## 1. Goal

- 作为“基础 B”，把 `0292` 冻结的新合同真正迁入当前仓库实现。
- 本阶段只负责：
  - runtime 合同切换
  - system-models / deploy patches 迁移
  - 验证脚本与 contract tests 迁移
- 本阶段完成态不是“业务线已经恢复执行”，而是：
  - 新合同已经成为仓库内可运行的实现基础，
  - 旧 pin / payload 语义不再是默认主线，
  - 后续业务线可以在新合同之上继续推进。

## 2. Background

- `0292` 已完成并过 Gate，当前仓内已经有：
  - [[docs/ssot/temporary_modeltable_payload_v1]]
  - [[docs/ssot/program_model_pin_and_payload_contract_vnext]]
  - [[docs/plans/2026-04-06-pin-payload-impact-inventory-and-migration]]
- 影响盘点已经明确：
  - runtime
  - `ui-server`
  - `remote-worker`
  - `MBR`
  - system-model patches
  - validators / contract tests
  - `0283-0291`
  都会受影响。
- 当前最大风险不是不知道怎么改，而是：
  - 很容易一边迁 runtime，一边顺手重写业务线
  - 或者只改 runtime，不改 patch 和验证，形成半迁移状态

## 3. Problem Statement

- 如果基础 B 不先把“合同切换”做完整，后面所有业务线都会卡在旧语义和新语义混跑的中间态：
  - runtime 接受新合同，但 system-models 还在写旧 pin
  - patch 已迁新合同，但验证脚本还在断言旧 payload
  - host/adapter 理解新数据，但 `MBR` 还在按旧 action / `mt.v0` 路线中转
- 所以基础 B 必须作为一次明确的迁移迭代，而不是零散修补。

## 4. Scope

### 4.1 In Scope

- runtime 合同切换：
  - 新程序模型 pin 归属语义
  - implicit program model 默认行为
  - `pin.in/out` 取代旧 `pin.model.* / pin.table.* / pin.single.*`
  - D0 / 非 D0 / 矩阵层级的权限边界落地
- system-model / deploy patch 迁移：
  - `Model 100`
  - `Model 1010`
  - `MBR`
  - `ui-side-worker`
  - 数据模型模板
- validator / contract test 迁移：
  - 去掉对旧 `action` payload 和旧 pin family 的默认假设
- 对 `0283-0291` 做一次受影响说明复审，但不重写这些计划。

### 4.2 Out of Scope

- 不做 `MBR` 总体架构重做。
- 不做 bus 拓扑重排。
- 不直接实现 Matrix / Slide UI / Three.js 新业务能力。
- 不实现数据模型具体功能（那是基础 C）。
- 不把这一轮扩成“所有业务线一起迁移并重新验收”的大包。

## 5. Invariants / Constraints

### 5.1 范围必须收紧

- 本阶段只负责“合同实现与迁移”。
- 不借机重做业务产品线。

### 5.2 迁移必须成套

- runtime 改动必须伴随：
  - patch 迁移
  - validator 迁移
  - contract test 迁移
- 不允许只改其中一层。

### 5.3 新旧语义不能长期并存

- 允许短期兼容过渡用于迁移，但最终主线必须明确：
  - 新合同是默认路径
  - 旧合同只是迁移兼容或被明确淘汰

### 5.4 业务线只做受影响复审

- `0283-0291` 在本阶段只需要：
  - 标注哪些表述已受新合同影响
  - 必要时做 wording 修订
- 不在本阶段把这些业务计划全部重写。

## 6. Success Criteria

- 基础 B 完成后，必须至少满足：
  1. runtime 已理解新合同
  2. 核心 system-model patches 已迁到新 pin / payload 语义
  3. validators / contract tests 已迁移
  4. 旧语义不再作为默认主线
  5. `0283-0291` 已补充受影响说明

## 7. Inputs

- Created at: `2026-04-06`
- Iteration ID: `0294-foundation-b-runtime-migration`
- Primary baselines:
  - [[docs/iterations/0292-foundation-pin-payload-contract-freeze/plan]]
  - [[docs/ssot/temporary_modeltable_payload_v1]]
  - [[docs/ssot/program_model_pin_and_payload_contract_vnext]]
  - [[docs/plans/2026-04-06-pin-payload-impact-inventory-and-migration]]
