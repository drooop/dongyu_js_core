---
title: "Iteration 0278-non-three-fine-grain-remediation Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0278-non-three-fine-grain-remediation
id: 0278-non-three-fine-grain-remediation
phase: phase3
---

# Iteration 0278-non-three-fine-grain-remediation Runlog

## Environment

- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Branch: `dev_0278-non-three-fine-grain-remediation`
- Base: `dev`

## Review Gate Record

### Review 1 — User Direct Approval

- Iteration ID: 0278-non-three-fine-grain-remediation
- Review Date: 2026-04-03
- Review Type: User
- Review Index: 1
- Decision: **Approved**
- Notes:
  - 用户同意按 `0277` 的优先级继续收口
  - 明确排除 Three.js

## Phase 3 Records

### 2026-04-03 — Implementation

**Implemented**
- Compiler:
  - 新增更细的 prop/style/ref labels 支持
  - 支持简单 `ui_write_value_ref`
- 0270:
  - 控件区容器从大 `ui_props_json` 拆到分散 labels
  - 输入框从大 `ui_props_json` / `ui_bind_json` 拆到分散 labels
  - Confirm 按钮的大样式 props 拆到分散 labels
  - 结果文本的大样式 props 拆到分散 labels
- 0276:
  - hero / summary / flow / layout proof / rebuild steps 的大 `ui_props_json` 基本拆成分散 labels
- Static:
  - Upload kind / FileInput / actions row / buttons / table / columns / delete write 结构全部收口到更细粒度 labels

### Deterministic tests

- `node scripts/tests/test_0278_non_three_fine_grain_contract.mjs` → PASS
- `node scripts/tests/test_0276_fileinput_picker_contract.mjs` → PASS
- `node scripts/tests/test_0276_doc_workspace_example_contract.mjs` → PASS
- `node scripts/tests/test_0276_doc_workspace_docs_contract.mjs` → PASS
- `node scripts/tests/test_0275_static_delete_contract.mjs` → PASS
- `node scripts/tests/test_0270_workspace_ui_filltable_example_contract.mjs` → PASS
- `node scripts/tests/test_0270_workspace_ui_filltable_mount_contract.mjs` → PASS
- `node scripts/tests/test_0270_workspace_ui_filltable_props_contract.mjs` → PASS
- `node scripts/tests/test_0272_static_workspace_contract.mjs` → PASS
- `node scripts/tests/test_0272_static_workspace_ui_contract.mjs` → PASS
- `node scripts/tests/test_0254_cellwise_authoring_runtime_contract.mjs` → PASS

### Local deploy / browser verification

- `bash scripts/ops/ensure_runtime_baseline.sh` → baseline ready
- `K8S_CONTEXT=orbstack SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh` → PASS
- `bash scripts/ops/check_runtime_baseline.sh` → baseline ready

**Browser facts**
- Static:
  - `选择文件` button 可点击
  - 选中文件后的空态/文件名显示正常
  - Upload/Delete 链路仍可工作
- 0276:
  - 页面仍能打开
  - 文档内容正常渲染
- 0270:
  - 页面仍能打开
  - 结构合同与页面 props 合同无回归

### Review 2 — AI Self-Verification

- Iteration ID: 0278-non-three-fine-grain-remediation
- Review Date: 2026-04-03
- Review Type: AI-assisted
- Review Index: 2
- Decision: **PASS**
- Notes:
  - 本轮目标是“页面 authoring 粗块收口”，非 0270 远端链路专项修复
  - Three.js 未纳入范围
