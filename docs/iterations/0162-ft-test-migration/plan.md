---
title: "0162 — 测试迁移 + 全量回归"
doc_type: iteration-plan
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0162-ft-test-migration
id: 0162-ft-test-migration
phase: phase1
---

# 0162 — 测试迁移 + 全量回归

## 0. Goal

将 tests/validate 脚本中的旧 label 类型断言迁移到新类型口径，并完成指定清单回归全绿。

## 1. Scope

- In scope:
  - `scripts/tests/*.mjs` 中旧 `function/CELL_CONNECT/...` 断言与 fixture 构造更新。
  - `scripts/validate_*.mjs` 中函数标签读取逻辑迁移到 `func.js` + `v.code || v`。
- Out of scope:
  - runtime/server/worker 逻辑代码改动（0161 已完成）。
  - 旧兼容层删除（0163）。

## 2. Constraints

- 分支为 `-ft-`，门禁自动开启。
- 仅改 tests/validate（与 docs 记录）。
- 若发现用例语义与系统模型当前行为不一致，记录到 runlog 并按“迁移口径”修正。

## 3. Success Criteria

- 0162 指定 tests 清单全部 PASS。
- 0162 指定 validate 清单全部 PASS。
