---
title: "Iteration 0268-home-all-models-filter Plan"
doc_type: iteration-plan
status: active
updated: 2026-03-31
source: ai
iteration_id: 0268-home-all-models-filter
id: 0268-home-all-models-filter
phase: phase1
---

# Iteration 0268-home-all-models-filter Plan

## 0. Metadata
- ID: 0268-home-all-models-filter
- Date: 2026-03-31
- Owner: Codex + User
- Branch: dev_0268-home-all-models-filter

## 1. Goal
让首页 ModelTable 编辑器的 Model 选择器支持 `All models`，并在该模式下显示所有模型的行。

## 2. Background
当前首页只能按一个 `selected_model_id` 显示单模型行。用户要求能显式选择“不筛选”，即一次查看所有模型，同时仍保留现有 `p/r/c` 与 `k|t|v` 过滤。

## 3. Invariants (Must Not Change)
- `selected_model_id=0` 仍然表示真实 `Model 0`，不能挪作 “all” 哨兵。
- 行级 `Select/Edit/Delete/Detail` 动作继续使用行上的真实 `model_id`。
- 全量模式下不得隐式猜测目标模型进行 `+ Add Label`。

## 4. Scope
### 4.1 In Scope
- selector 首项新增 `All models`
- Home 表格支持全量模式遍历所有模型
- 全量模式下 `Current target` / 缺失文案调整
- 全量模式下 `+ Add Label` 禁用或明确阻断

### 4.2 Out of Scope
- 其它页面的 model selector
- 模型排序策略以外的新筛选器

## 5. Success Criteria (Definition of Done)
1. 首页可显式切到 `All models`。
2. `All models` 下表格同时展示多个 `model_id` 的行，并继续应用现有过滤器。
3. `+ Add Label` 在 `All models` 下不会误写到不明确目标。
