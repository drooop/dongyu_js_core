---
title: "Iteration 0264-debug-crud-unhide-all Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0264-debug-crud-unhide-all
id: 0264-debug-crud-unhide-all
phase: phase1
---

# Iteration 0264-debug-crud-unhide-all Resolution

## 0. Execution Rules
- Work branch: `dev_0264-debug-crud-unhide-all`
- 先 RED tests，再改 snapshot/filter、表格派生、编辑器类型与保存逻辑。

## 1. Steps Overview

| Step | Title | Scope (Short) | Files (Key) | Validation (Executable) | Acceptance Criteria | Rollback |
|------|-------|---------------|-------------|--------------------------|--------------------|----------|
| 1 | Add RED tests | 锁调试界面“可见 + 可改”目标 | `scripts/tests/test_0264_debug_crud_unhide_all.mjs` | `node ...` | 先 RED | 删除测试 |
| 2 | Unhide snapshot/table labels | 取消结构标签过滤 | server snapshot + derivers | RED test | 结构标签出现在表格 | 回退过滤逻辑 |
| 3 | Allow arbitrary type editing | type selector 支持任意 label.t，保存支持结构类型 | home_catalog_ui + server save path | RED test | 任意类型可保存 | 回退类型处理 |
| 4 | Allow non-positive model CRUD | 负数模型 / Model 0 可直接保存删除 | server CRUD path | RED test + existing tests | 非正数模型可操作 | 回退直写分支 |
