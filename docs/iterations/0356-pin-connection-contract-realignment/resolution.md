---
title: "0356 PIN Connection Contract Realignment Resolution"
doc_type: iteration_resolution
status: completed
updated: 2026-05-06
source: ai
iteration: 0356-pin-connection-contract-realignment
---

# Iteration 0356 PIN Connection Contract Realignment Resolution

## Execution Strategy

采用 docs-only 收口：

1. 先新增目标合同文档，明确 0356 后的新引脚和连接规则。
2. 再更新最高优先级与 SSOT 文档，把旧写法降级为 implementation debt / historical alias。
3. 再更新开发者可见示例，避免继续教用户写 `(self, ...)` / `(func, ...)`。
4. 最后输出冲突清单，作为后续 implementation iteration 的迁移边界。

## Step 1 — Freeze Target Contract

Scope:

- 新增 `pin_connection_contract_v2.md`。
- 明确 `pin.connect.model` removed、`pin.connect.label` direct endpoint、`pin.connect.cell` same-model-only、函数三引脚、日志引脚、payload 模型数据。

Files:

- `docs/ssot/pin_connection_contract_v2.md`

Verification:

- 人工核对合同是否覆盖用户提供文本中的每条规则。

Acceptance:

- 合同独立可引用，且明确 0356 不做 runtime 实现。

Rollback:

- 删除新增合同文档并恢复引用。

## Step 2 — Realign Active Specs And Guides

Scope:

- 更新最高优先级文档和活跃 SSOT / user guide。
- 将旧写法标为 legacy / removed / migration debt。

Files:

- `CLAUDE.md`
- `docs/architecture_mantanet_and_workers.md`
- `docs/ssot/label_type_registry.md`
- `docs/ssot/runtime_semantics_modeltable_driven.md`
- `docs/ssot/host_ctx_api.md`
- `docs/ssot/ui_model_pin_routing_architecture.md`
- `docs/ssot/imported_slide_app_host_ingress_semantics_v1.md`
- `docs/ssot/model_layering_and_cell_model_labels_v0_1.md`
- `docs/ssot/feishu_alignment_decisions_v0.md`
- `docs/user-guide/modeltable_user_guide.md`
- `docs/user-guide/workspace_ui_filltable_example.md`
- `docs/user-guide/slide_delivery_and_runtime_overview_v1.md`
- `docs/user-guide/slide_app_zip_import_v1.md`
- `docs/user-guide/slide_executable_import_v1.md`
- `docs/user-guide/slide_matrix_delivery_v1.md`
- `docs/user-guide/slide_matrix_delivery_preview_v0.md`
- `docs/user-guide/slide-app-runtime/slide_app_runtime_developer_guide.md`
- `docs/user-guide/slide-app-runtime/minimal_submit_app_provider_guide.md`
- `docs/user-guide/slide-app-runtime/slide_app_runtime_flow_visualized.html`

Verification:

- grep high-priority docs for old terms and confirm remaining hits are legacy / removed / migration-debt contexts.

Acceptance:

- New docs/examples do not instruct users to write `pin.connect.model` or prefix endpoints.

Rollback:

- Revert this docs-only commit.

## Step 3 — Conflict Inventory

Scope:

- Record remaining conflicts across runtime, tests, system models, deploy patches, historical docs.
- Keep history under `docs/iterations/**` and `docs/plans/**` intact.

Files:

- `docs/iterations/0356-pin-connection-contract-realignment/pin_connection_conflict_inventory.md`
- `docs/iterations/0356-pin-connection-contract-realignment/plan.md`
- `docs/iterations/0356-pin-connection-contract-realignment/resolution.md`
- `docs/iterations/0356-pin-connection-contract-realignment/runlog.md`
- `docs/ITERATIONS.md`

Verification:

- `rg` inventory commands recorded.
- `git diff --check`.

Acceptance:

- Follow-up implementation work has a concrete migration list.

Rollback:

- Revert this docs-only commit.
