---
title: "Iteration 0193-editor-submodel-test-alignment Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0193-editor-submodel-test-alignment
id: 0193-editor-submodel-test-alignment
phase: phase3
---

# Iteration 0193-editor-submodel-test-alignment Runlog

## Environment

- Date: 2026-03-19
- Branch: `dropx/dev_0193-editor-submodel-test-alignment`
- Runtime: local repo + docs vault

Review Gate Record
- Iteration ID: 0193-editor-submodel-test-alignment
- Review Date: 2026-03-19
- Review Type: User
- Review Index: 1
- Decision: Approved
- Notes:
  - 用户已明确确认：`0193 通过 Gate，可以开始实施`
  - Gate 作用域为扩展后的 editor direct-mutation cleanup
  - 约束保持不变：不改 runtime / server / adapter

## Execution Records

### Step 1

- Command:
  - `git switch -c dropx/dev_0193-editor-submodel-test-alignment`
  - `python3 /Users/drop/.codex/skills/it/scripts/init_iteration_scaffold.py 0193-editor-submodel-test-alignment --repo-root /Users/drop/codebase/cowork/dongyuapp_elysia_based`
  - `node packages/ui-model-demo-frontend/scripts/validate_editor.mjs`
  - `rg -n "submodel_create|direct_model_mutation_disabled" packages/ui-model-demo-frontend/scripts packages/ui-model-demo-frontend/src packages/ui-model-demo-server scripts/tests packages/worker-base/system-models/editor_test_catalog_ui.json`
- Key output:
  - 已确认当前失败：
    - `FAIL: editor_submodel_create: model 2 not created`
  - 已确认这不是 runtime 缺口，而是整个 legacy direct-mutation harness 过时：
    - local adapter 拒绝 `submodel_create`
    - server 同样拒绝 `submodel_create`
    - `test_0177_direct_model_mutation_disabled_contract.mjs` 明确要求 direct mutation 被拒绝
    - `validate_editor.mjs` 与 `editor_test_catalog_ui.json` 中还存在多处 `label_add / update / remove / cell_clear` 成功假设
  - 已登记本轮范围：
    - 修测试
    - 修测试资产
    - 不改 runtime
- Result: PASS
- Commit: N/A

### Step 2

- Command:
  - `apply_patch` 更新：
    - `packages/ui-model-demo-frontend/scripts/validate_editor.mjs`
    - `packages/worker-base/system-models/editor_test_catalog_ui.json`
  - `node packages/ui-model-demo-frontend/scripts/validate_editor.mjs`
  - `node scripts/tests/test_0177_direct_model_mutation_disabled_contract.mjs`
  - `node packages/ui-model-demo-frontend/scripts/validate_demo.mjs`
  - `git diff -- packages/ui-model-demo-frontend/src/local_bus_adapter.js packages/ui-model-demo-server/server.mjs packages/worker-base/src/runtime.js packages/worker-base/src/runtime.mjs`
- Key output:
  - `validate_editor.mjs` 已从 legacy direct-mutation success harness 调整为：
    - business-model direct mutation rejection
    - local editor-state mutation success
    - mailbox / envelope / local validation coverage
  - `editor_test_catalog_ui.json` 已移除 `submodel_create` 按钮，并将动作按钮改为本地 editor state probe
  - 验证结果：
    - `validate_editor.mjs`: PASS
    - `test_0177_direct_model_mutation_disabled_contract.mjs`: PASS
    - `validate_demo.mjs`: PASS
  - runtime/server diff check: empty
- Result: PASS
- Commit: `291c834`

### Step 3

- Command:
  - `git switch dev`
  - `git merge --no-ff dropx/dev_0193-editor-submodel-test-alignment -m "merge: complete 0193 editor direct mutation alignment"`
  - `git push origin dev`
- Key output:
  - implementation commit: `291c834`
  - merge commit: `d384dea`
  - `origin/dev` 已包含：
    - `validate_editor.mjs` 对齐当前 direct-mutation 拒绝合同
    - `editor_test_catalog_ui.json` 清除业务模型直写控件
  - 无关本地改动 `AGENTS.md` 未纳入 merge
- Result: PASS
- Commit: `d384dea`

## Docs Updated

- [x] `docs/ssot/tier_boundary_and_conformance_testing` reviewed
- [x] `docs/iterations/0191d-static-docs-home-legacy-removal/*` reviewed
- [x] `docs/iterations/0191d-form-label-fix/*` reviewed
