---
title: "Iteration 0191d-form-label-fix Plan"
doc_type: iteration-plan
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0191d-form-label-fix
id: 0191d-form-label-fix
phase: phase1
---

# Iteration 0191d-form-label-fix Plan

## Goal

- 补齐当前单 cell UI 资产模型的显式 `model_type` / form label，使其与 `Model -21` 的显式声明保持一致。

## Background

- `0191d` 主线迁移已完成，但审查指出：
  - `-22` Home catalog
  - `-23` Docs catalog
  - `-24` Static catalog
  缺少显式 form label。
- 进一步审计后发现，同类的单 cell UI 资产模型还包括：
  - `-25` Workspace catalog
  - `-26` editor test catalog
  - `-103` Gallery catalog
- `Model -21` 已在 `0191d` 中补了 `model.single`，因此当前最一致的收口方式是把上述同类资产模型一起补齐。

## Scope

- In scope:
  - 为当前单 cell UI 资产模型补 `model_type`
  - 目标模型：
    - `-22` `UI.HomeCatalog`
    - `-23` `UI.DocsCatalog`
    - `-24` `UI.StaticCatalog`
    - `-25` `UI.WorkspaceCatalog`
    - `-26` `UI.EditorTestCatalog`
    - `-103` `UI.GalleryCatalog`
  - 为这些 patch 增加最小合同验证
- Out of scope:
  - 不处理多 cell 模型：
    - `-3` Login
    - `-102` Gallery state
  - 不调整页面行为
  - 不处理 helper 去重或未消费字段

## Invariants / Constraints

- 仅补 label，不改页面 AST 和交互行为。
- 不新增 model id。
- 新 label 统一使用：
  - `k: "model_type"`
  - `t: "model.single"`
  - `v: "<UI.*Catalog>"`

## Success Criteria

- 上述 6 个单 cell UI 资产模型都具备显式 `model_type`。
- 合同测试明确断言这些标签存在。
- 既有资产解析与页面回归不受影响。

## Risks & Mitigations

- Risk:
  - 只补 3 个被 reviewer 点名的模型，留下同类漏项。
  - Mitigation:
    - 本轮一次性补齐当前所有同类单 cell UI 资产模型。
- Risk:
  - 把多 cell 模型也一起补成 `model.single`，引入错误语义。
  - Mitigation:
    - 明确把 `-3` / `-102` 排除在本轮之外。

## Alternatives

### A. 推荐：一次性补齐当前所有单 cell UI 资产模型

- 优点：
  - 彻底收干净同类问题
  - 避免后续再开一轮同型补丁
- 缺点：
  - 比只改 3 个文件略大一点

### B. 只补 `-22/-23/-24`

- 优点：
  - 最小变更
- 缺点：
  - `-25/-26/-103` 仍留同类缺口

当前推荐：A。

## Inputs

- Created at: 2026-03-19
- Iteration ID: 0191d-form-label-fix
- Trigger:
  - 用户 review 指出 `-22/-23/-24` 缺显式 form label
  - 二次审计发现 `-25/-26/-103` 同类缺口
