---
title: "Iteration 0277-non-three-fine-grain-audit Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0277-non-three-fine-grain-audit
id: 0277-non-three-fine-grain-audit
phase: phase3
---

# Iteration 0277-non-three-fine-grain-audit Runlog

## Environment

- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Branch: `dev_0277-non-three-fine-grain-audit`
- Base: `dev`

## Review Gate Record

### Review 1 — User Direct Approval

- Iteration ID: 0277-non-three-fine-grain-audit
- Review Date: 2026-04-03
- Review Type: User
- Review Index: 1
- Decision: **Approved**
- Notes:
  - 用户明确要求排除 Three.js，先做其余部分的细粒度审查

## Audit Facts

### Baseline

- File: `packages/worker-base/system-models/workspace_positive_models.json`
- Size: about `164 KB`
- Lines: `8882`
- Total records: `782`
- `add_label`: `765`
- `create_model`: `17`

### Dominant structure keys

- `ui_node_id`: `94`
- `ui_component`: `94`
- `ui_parent`: `86`
- `ui_order`: `86`
- `ui_props_json`: `71`
- `ui_bind_read_json`: `18`
- `ui_bind_json`: `9`
- `page_asset_v0`: `0`

### Judgment

- 结论：整体仍然是“细粒度 label 为主”
- 理由：
  - 结构层主要由分散 labels 表达
  - 没有退回 `page_asset_v0`
- 但仍存在一批偏粗的值，需要后续继续拆分

### Large items excluding Three.js

排除 `Model 1007/1008` 后，`>= 200 bytes` 的值共 `10` 个：

1. `func.js: forward_workspace_filltable_submit_from_model0`
2. `func.js: dispatch_local`
3. `func.js: dispatch_remote`
4. `json: ws_apps_registry`
5. `func.js: prepare_workspace_filltable_submit`
6. `json: submit__props`
7. `json: ui_props_json` on `Model 1011 / (2,9,0)` (`Static` FileInput props)
8. `json: ui_bind_json` on `Model 1009 / (2,3,0)` (`0270` Confirm button bind)
9. `func.js: emit_submit`
10. `json: input_value__bind`

### Large ui_props_json excluding Three.js

最值得关注的非 Three.js `ui_props_json`：

- `Model 1011 / (2,9,0)`：Static FileInput props
- `Model 1009 / (2,1,0)`：0270 layout container props
- `Model 1009 / (2,2,0)`：0270 input props
- `Model 1009 / (2,3,0)`：0270 button props
- `Model 1013 / (2,2,0)`：0276 hero Section props
- `Model 1013 / (2,15,0)`：0276 left callout props
- `Model 1013 / (2,16,0)`：0276 right callout props
- `Model 1011 / (2,15,0)`：Static table props

## Classification

### A. 应优先继续拆分的页面 authoring 粗块

- 0270:
  - button props
  - input props
  - layout container props
  - confirm bind json
- 0276:
  - hero / callout / summary section 中仍放在 `ui_props_json` 的聚合内容
- Static:
  - FileInput props
  - Table props

### B. 暂可保留的行为逻辑块

- `dispatch_remote`
- `dispatch_local`
- `prepare_workspace_filltable_submit`
- `forward_workspace_filltable_submit_from_model0`
- `emit_submit`

这些更偏流程逻辑，不是页面结构 authoring 的主要问题。

### C. 暂可保留的运行态投影块

- `ws_apps_registry`

它是运行态汇总状态，不是页面 authoring 本体，但后续仍可考虑进一步拆分。

## Recommended follow-up order

1. 先拆 `0270`
2. 再拆 `0276`
3. 再收 `Static`
4. 最后再看 `ws_apps_registry`

### Review 2 — AI Self-Verification

- Iteration ID: 0277-non-three-fine-grain-audit
- Review Date: 2026-04-03
- Review Type: AI-assisted
- Review Index: 2
- Decision: **PASS**
- Notes:
  - 已完成排除 Three.js 的结构审计
  - 已给出明确分类和收口优先级
