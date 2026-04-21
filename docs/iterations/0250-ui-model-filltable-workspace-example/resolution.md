---
title: "0250 — ui-model-filltable-workspace-example Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0250-ui-model-filltable-workspace-example
id: 0250-ui-model-filltable-workspace-example
phase: phase1
---

# 0250 — ui-model-filltable-workspace-example Resolution

## Execution Strategy

0250 只做文档重写，不新增能力：

1. 先用当前界面 CRUD 路径重新裁决“什么是界面里真的可做的事情”
2. 再把目标 user guide 改成 label-by-label 示例文档：
   - 只覆盖 `1003` / `1004`
   - 不再写 patch / contract 教程
3. 最后做 living docs review，并记录为什么当前文档不再承诺 create_model / Workspace mount

## Step 1

- Scope:
  - 冻结本轮裁决边界，明确旧文中哪些说法已经过时
- Files:
  - `CLAUDE.md`
  - `docs/WORKFLOW.md`
  - `docs/ITERATIONS.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/user-guide/modeltable_user_guide.md`
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `packages/worker-base/system-models/workspace_catalog_ui.json`
  - `packages/worker-base/system-models/home_catalog_ui.json`
  - `packages/worker-base/system-models/intent_handlers_home.json`
  - `packages/ui-model-demo-server/server.mjs`
- Verification:
  - source inspection with explicit file evidence
- Acceptance:
  - 明确当前界面能力只到“已有正数 UI model 的 label CRUD”
  - 明确 `1003` / `1004` 是可直接举例的现成模型
- Rollback:
  - no file mutation in this step

## Step 2

- Scope:
  - 重写目标 user guide，使其只保留当前可成立的正例
- Files:
  - `docs/user-guide/ui_model_filltable_workspace_example.md`
  - `docs/user-guide/README.md`
- Verification:
  - 文档自检：术语、例子、边界、证据入口是否一致
- Acceptance:
  - 文档给出 `1003` / `1004` 的逐条 label 示例
  - 文档不再出现 patch / `candidate_changes` / create_model 教程
- Rollback:
  - revert above doc edits

## Step 3

- Scope:
  - 补 iteration 记录与 docs review 结论
- Files:
  - `docs/ITERATIONS.md`
  - `docs/iterations/0250-ui-model-filltable-workspace-example/plan.md`
  - `docs/iterations/0250-ui-model-filltable-workspace-example/resolution.md`
  - `docs/iterations/0250-ui-model-filltable-workspace-example/runlog.md`
- Verification:
  - entry/status/branch/path self-consistency
- Acceptance:
  - 0250 已登记
  - runlog 记录 scope 收窄后的 living docs review 事实
- Rollback:
  - revert iteration/index edits
