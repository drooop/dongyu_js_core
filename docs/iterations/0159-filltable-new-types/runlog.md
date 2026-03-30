---
title: "Iteration 0159-filltable-new-types Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-03-21
source: ai
iteration_id: 0159-filltable-new-types
id: 0159-filltable-new-types
phase: phase3
---

# Iteration 0159-filltable-new-types Runlog

## Environment

- Date: 2026-03-06
- Branch: `dev_0159-filltable-new-types` (worktree) + mirrored into active workspace `dev_0156-ui-renderer-component-registry`
- Runtime: Node.js
- fill-table-only: OFF

## Review Gate Record

### Record 1

- Iteration ID: 0159-filltable-new-types
- Review Date: 2026-03-06
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes:
  - 用户已确认 v4 定稿并要求按文件版计划执行。

## Compact Checkpoint

### CP-001 (before implementation)

- Completed iterations:
  - 0157a docs gate
  - 0157b runtime merge
  - 0158 runtime new label types
- Current target:
  - 0159 filltable policy + FT skill adaptation
- Planned code scope:
  - `packages/ui-model-demo-server/filltable_policy.mjs`
  - `packages/worker-base/system-models/intent_handlers_prompt_filltable.json`
  - `packages/ui-model-demo-server/server.mjs`
- Hard constraints snapshot:
  - default deny structural types
  - `allow_structural_types` explicit opt-in
  - `func.*` value must be structured (`{code: string}`)

## Execution Records

### Step 0 — Plan/Resolution/Runlog filed + compact checkpoint

- Result: PASS

### Step 1 — RED: 结构性类型策略测试先失败

- Command:
  - `node scripts/tests/test_0155_prompt_filltable_policy.mjs`
- Key output:
  - `6 passed, 3 failed out of 9`
  - 失败点：
    - `structural_type_default_denied` 实际返回 `label_type_not_allowed`
    - `structural_type_allowed_by_flag` 接收数为 `0`
    - `structural_values_must_match_type_contract` 实际返回 `label_type_not_allowed`
- Result: PASS（符合 TDD RED 预期）

### Step 2 — GREEN: filltable_policy 新类型策略实现

- Changed:
  - `packages/ui-model-demo-server/filltable_policy.mjs`
  - `scripts/tests/test_0155_prompt_filltable_policy.mjs`
- Implemented:
  - 新增 `STRUCTURAL_LABEL_TYPES`。
  - 新增 policy 字段 `allow_structural_types`（默认 `false`）。
  - `validateFilltableRecords` 增加结构性类型门禁：默认拒绝，显式开启后允许。
  - `normalizeTypedValue` 扩展：
    - `func.js/func.python`: `v` 必须为对象且含非空 `code`。
    - `pin.connect.*`: `v` 必须为数组。
    - `model.single/model.matrix/model.table`: `v` 必须为非空字符串。
    - `submt`: `v` 必须可序列化。
- Result: PASS

### Step 3 — FT skill prompt 规则更新

- Changed:
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/worker-base/system-models/llm_cognition_config.json`
- Implemented:
  - 更新默认 `DEFAULT_LLM_FILLTABLE_PROMPT_TEMPLATE`，明确新类型门禁与 value 约束。
  - 同步更新系统模型中的 `llm_filltable_prompt_template`，避免运行时继续使用旧模板。
- Result: PASS

### Step 4 — 回归验证（显式清单）

- Command:
  - `for f in scripts/tests/test_0146_fill_table_only_mode_guard.mjs scripts/tests/test_0147_fill_table_only_auto_gate.mjs scripts/tests/test_0155_prompt_filltable_policy.mjs scripts/tests/test_0158_new_label_types.mjs scripts/tests/test_0158_func_value_compat.mjs; do [ -f "$f" ] || continue; echo "=== $f ==="; node "$f" || exit 1; done`
- Key output:
  - `test_0146_fill_table_only_mode_guard.mjs`: `5 passed, 0 failed`
  - `test_0147_fill_table_only_auto_gate.mjs`: `4 passed, 0 failed`
  - `test_0155_prompt_filltable_policy.mjs`: `9 passed, 0 failed`
  - `test_0158_new_label_types.mjs`: `3 passed, 0 failed`
  - `test_0158_func_value_compat.mjs`: `3 passed, 0 failed`
- Result: PASS

## Docs Updated

- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed（0159 未改变 runtime 语义条款，无需更新）
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed（本次为内部 filltable 策略/提示改造，无新增用户操作流程）
- [x] `docs/ssot/execution_governance_ultrawork_doit.md` reviewed（执行治理规则未变更）

## Current Conclusion

- 0159 已完成：filltable policy 新类型门禁 + FT prompt 规则已落地并通过回归。
- 下一迭代可进入 0160（system-models/deploy JSON 迁移，ft ON 分支）。
