---
title: "0244 — pin-only-core-with-scoped-privilege-contract-freeze Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0244-pin-only-core-with-scoped-privilege-contract-freeze
id: 0244-pin-only-core-with-scoped-privilege-contract-freeze
phase: phase1
---

# 0244 — pin-only-core-with-scoped-privilege-contract-freeze Resolution

## Strategy

0244 是纯 contract 冻结 iteration，不进入代码实现。

执行顺序：

1. 先把讨论稿压成接近 SSOT 的规则文本
2. 再把 root/privileged/table/matrix/submt 的边界写成可检查的 rule set
3. 最后补 downstream implementation checklist，避免后续实现时再次发散

## Steps

| Step | Name | Goal | Files | Acceptance |
|---|---|---|---|---|
| 1 | Normalize Terms And Problem Frame | 把讨论稿里的口头表达压成单义术语，并写清默认规则与例外规则的关系 | `docs/plans/2026-03-26-pin-only-core-with-scoped-privilege-design.md`, `docs/iterations/0244.../plan.md` | `PIN-only` 与 `scoped privilege` 不再混成并列主链路 |
| 2 | Freeze Scope Rules | 明确 root 自动权限、非 root 显式权限、table scope、matrix scope、submt hard boundary | `docs/iterations/0244.../plan.md` | 能用 rule text 判断同模型允许/不允许的 direct access |
| 3 | Define Downstream Test And Docs Surface | 明确未来实现必须改哪些文件、补哪些 regression tests、联动哪些 SSOT | `docs/iterations/0244.../resolution.md` | implementation checklist 完整，且不含 runtime 细节拍脑袋发挥 |
| 4 | Close Planning Ledger | 更新 runlog / ITERATIONS 状态，记录这是 contract freeze 而非 code change | `docs/iterations/0244.../runlog.md`, `docs/ITERATIONS.md` | auditable docs ready |

## Scope Rules To Freeze

### A. Default Path

- 默认 path = `PIN-only`

### B. Exception Path

- same-model internal management 允许 privileged direct access
- 该能力不是默认给所有 cell

### C. Privilege Source

- `root (0,0,0)` 自动拥有 privileged capability
- 非 root 需要显式声明

### D. `Model.table`

- privileged `table` cell 可直达本模型内部普通 cell
- privileged `table` cell 可直达本模型内部 nested `matrix` cell

### E. `Model.matrix`

- privileged `matrix` cell 只可直达该矩阵作用域内 cell
- 不自动获得 sibling region 权限

### F. Hard Boundary

- 一旦跨 `model_id`，立即回到 `PIN-only`
- 一旦跨 `model.submt`，立即回到 `PIN-only`

## Downstream Implementation Checklist

后续实现 iteration 至少需要覆盖以下面：

1. Runtime / Host API
- runtime 内部 scope check
- root auto privilege materialization
- non-root explicit privilege declaration

2. Regression tests
- ordinary `model.single` 不能跨 cell direct access
- privileged `table root` 可以操作同模型普通 cell
- privileged `table root` 可以操作同模型 nested matrix cell
- privileged `matrix root` 不能越出其矩阵作用域
- parent 不能 direct access child model via `submt`
- cross-model 仍然必须 pin

3. Docs updates (future, not in 0244)
- `docs/ssot/runtime_semantics_modeltable_driven.md`
- `docs/ssot/label_type_registry.md`
- `docs/ssot/model_layering_and_cell_model_labels_v0_1.md`
- `docs/user-guide/modeltable_user_guide.md`

## Non-Goals

- 不在 0244 决定最终 capability label 名
- 不在 0244 决定所有 helper API 细节
- 不在 0244 开始 pin migration implementation
