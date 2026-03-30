---
title: "0159 — Resolution (HOW)"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0159-filltable-new-types
id: 0159-filltable-new-types
phase: phase1
---

# 0159 — Resolution (HOW)

## 0. Strategy

采用 TDD 小步迭代：
1. 先用现有 `test_0155_prompt_filltable.mjs` 做 RED/基线确认；
2. 实现最小策略改动使测试稳定；
3. 必要时新增 0159 定向测试覆盖结构性类型策略分支；
4. 用显式文件清单做回归。

## 1. Steps

| Step | Scope | Files | Verify |
|---|---|---|---|
| 1 | 基线与 RED：确认 filltable 当前行为与缺口 | `scripts/tests/test_0155_prompt_filltable_policy.mjs` | 基线执行并记录结果 |
| 2 | 策略实现：结构性类型集合 + allow 开关 + value 规范 | `packages/ui-model-demo-server/filltable_policy.mjs` | 0155/0159 相关测试 PASS |
| 3 | FT skill 提示与 server 端校验联动 | `packages/ui-model-demo-server/server.mjs`, `packages/worker-base/system-models/llm_cognition_config.json` | 0155 测试 + 静态检查 PASS |
| 4 | 回归与证据沉淀 | 显式测试清单 | 0155 + 0158 新增测试 + 关键回归 PASS |

## 2. Verification Commands

1. `node scripts/tests/test_0155_prompt_filltable_policy.mjs`
2. `node scripts/tests/test_0158_new_label_types.mjs`
3. `node scripts/tests/test_0158_func_value_compat.mjs`
4. `for f in scripts/tests/test_0146_fill_table_only_mode_guard.mjs scripts/tests/test_0147_fill_table_only_auto_gate.mjs scripts/tests/test_0155_prompt_filltable.mjs scripts/tests/test_0158_new_label_types.mjs scripts/tests/test_0158_func_value_compat.mjs; do [ -f "$f" ] || continue; echo "=== $f ==="; node "$f" || exit 1; done`

## 3. Gate Notes

- fill-table-only: OFF（0159 涉及 `filltable_policy.mjs` 和 `server.mjs`）。
- 分支命名：`dev_0159-filltable-new-types`（禁含 `-ft-`）。
