---
title: "Iteration 0191d-form-label-fix Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0191d-form-label-fix
id: 0191d-form-label-fix
phase: phase1
---

# Iteration 0191d-form-label-fix Resolution

## Execution Strategy

- 先让测试明确要求这些资产模型必须有显式 `model_type`，再只做最小 patch 修改。
- 不碰多 cell 模型，不扩大到行为层变更。

## Step 1

- Scope:
  - 在测试中加入对 6 个单 cell UI 资产模型 `model_type` 的断言
- Files:
  - `scripts/tests/test_0191d_catalog_form_labels.mjs`
- Verification:
  - `node scripts/tests/test_0191d_catalog_form_labels.mjs`
- Acceptance:
  - 测试先以缺失 `model_type` 失败
- Rollback:
  - 回退测试文件

## Step 2

- Scope:
  - 为以下 patch 增加显式 `model_type`
    - `gallery_catalog_ui.json`
    - `home_catalog_ui.json`
    - `docs_catalog_ui.json`
    - `static_catalog_ui.json`
    - `workspace_catalog_ui.json`
    - `editor_test_catalog_ui.json`
- Files:
  - `packages/worker-base/system-models/gallery_catalog_ui.json`
  - `packages/worker-base/system-models/home_catalog_ui.json`
  - `packages/worker-base/system-models/docs_catalog_ui.json`
  - `packages/worker-base/system-models/static_catalog_ui.json`
  - `packages/worker-base/system-models/workspace_catalog_ui.json`
  - `packages/worker-base/system-models/editor_test_catalog_ui.json`
- Verification:
  - `node scripts/tests/test_0191d_catalog_form_labels.mjs`
  - `node scripts/tests/test_0191d_home_asset_resolution.mjs`
  - `node scripts/tests/test_0191d_docs_asset_resolution.mjs`
  - `node scripts/tests/test_0191d_static_asset_resolution.mjs`
  - `node scripts/tests/test_0191d_test_workspace_asset_resolution.mjs`
- Acceptance:
  - 6 个单 cell UI 资产模型都具备显式 `model_type`
  - 资产解析回归保持通过
- Rollback:
  - 回退上述 6 个 patch 文件
