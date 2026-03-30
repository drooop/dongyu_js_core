---
title: "0160 — Resolution (HOW)"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0160-ft-system-models-migration
id: 0160-ft-system-models-migration
phase: phase1
---

# 0160 — Resolution (HOW)

## 0. Strategy

按规则批量迁移 JSON，先做静态扫描确认命中，再执行转换，再做零残留 + JSON 解析 + 关键回归。

## 1. Steps

| Step | Scope | Files | Verify |
|---|---|---|---|
| 1 | 落盘 + compact checkpoint + 切 In Progress | `docs/iterations/0160.../*`, `docs/ITERATIONS.md` | 文档存在且状态正确 |
| 2 | 批量迁移 system-models/deploy JSON | `packages/worker-base/system-models/*.json`, `deploy/sys-v1ns/**/*.json` | 旧类型扫描归零（排除 legacy） |
| 3 | 验证与归档 | 测试脚本 + runlog | JSON 解析 PASS + 测试 PASS |

## 2. Verification Commands

1. `rg -n '"t"\s*:\s*"function"|"t"\s*:\s*"CELL_CONNECT"|"t"\s*:\s*"cell_connection"|"t"\s*:\s*"BUS_IN"|"t"\s*:\s*"BUS_OUT"|"t"\s*:\s*"MODEL_IN"|"t"\s*:\s*"MODEL_OUT"|"t"\s*:\s*"subModel"' packages/worker-base/system-models/*.json deploy/sys-v1ns/**/*.json`
2. `node scripts/tests/test_0146_fill_table_only_mode_guard.mjs`
3. `node scripts/tests/test_0147_fill_table_only_auto_gate.mjs`
4. `node scripts/tests/test_0155_prompt_filltable_policy.mjs`
5. `node scripts/tests/test_0158_new_label_types.mjs && node scripts/tests/test_0158_func_value_compat.mjs`

## 3. Gate Notes

- 分支：`dev_0160-ft-system-models-migration`（含 `-ft-`，pre-commit 自动门禁）。
- 本迭代不改非白名单实现文件。
