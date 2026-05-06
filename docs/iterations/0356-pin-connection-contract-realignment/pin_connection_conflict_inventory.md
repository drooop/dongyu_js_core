---
title: "0356 PIN Connection Conflict Inventory"
doc_type: iteration_evidence
status: active
updated: 2026-05-06
source: ai
iteration: 0356-pin-connection-contract-realignment
---

# 0356 PIN Connection Conflict Inventory

## Scope

本清单记录 0356 目标合同与仓库现状之间的冲突。0356 只冻结规约和审计结果，不做 runtime / test / model asset 迁移。

目标合同：

- `pin.connect.model` 移除。
- `pin.connect.label` 端点直接写同 Cell 引脚名，不再写 `(self, ...)` / `(func, ...)` / numeric prefix。
- `pin.connect.cell` 只连接同模型内 Cell 引脚，不能直接连接函数引脚。
- 函数引脚为 `{funcName}:in` / `{funcName}:out` / `{funcName}:logout`。
- 日志引脚目标命名为 `pin.login` / `pin.logout`。
- 引脚 payload 仍是 Temporary ModelTable Message：`format is ModelTable-like, persistence is explicit materialization`。

## Commands Used

```bash
rg -n "pin\.connect\.model" . --glob '!node_modules/**' --glob '!dist/**' --glob '!output/**' --glob '!logs/**' -S
rg -n "\(self,|\(func,|\([0-9-]+, [^)]+\)" . --glob '!node_modules/**' --glob '!dist/**' --glob '!output/**' --glob '!logs/**' -S
rg -n "pin\.log\.|:log\.out|func:log\.out" . --glob '!node_modules/**' --glob '!dist/**' --glob '!output/**' --glob '!logs/**' -S
rg -l "pin\.connect\.model|\(self,|\(func,|pin\.log\.|:log\.out" CLAUDE.md docs/ssot docs/user-guide docs/architecture_mantanet_and_workers.md --glob '*.md' --glob '*.html' -S
```

## Current Counts

粗略文件级命中数：

- `pin.connect.model`: 60 files.
- `(self, ...)` / `(func, ...)` / numeric prefix endpoint: 55 files.
- `pin.log.*` / `:log.out`: 16 files.

这些数字包含历史 iteration、plans、tests、fixtures、runtime 和本次新增的“legacy debt”说明，不代表 0356 要全部删除。

## High-Priority Docs Updated In 0356

本轮已把以下活跃规约或用户指南改为 0356 目标口径：

- `CLAUDE.md`
- `docs/architecture_mantanet_and_workers.md`
- `docs/ssot/pin_connection_contract_v2.md`
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

## Runtime Conflicts

后续 implementation iteration 必须处理：

- `packages/worker-base/src/runtime.mjs`
  - `modelConnectionRoutes` / `pin.connect.model` parser / dispatcher 仍存在。
  - `pin.connect.label` parser 仍支持 `(self, ...)` / `(func, ...)` / numeric prefix。
  - log channel 仍识别 `pin.log.in` / `pin.log.out` / `pin.log.bus.*`。
- `packages/ui-model-demo-server/server.mjs`
  - imported slide app host ingress / repair / generated route 仍生成 `pin.connect.model`。
  - prompt policy 文本仍把 `pin.connect.model` 列为结构性 label。
- `packages/ui-model-demo-server/filltable_policy.mjs`
  - 仍允许或校验 `pin.connect.model`。

0356 未改这些文件，避免在 docs-only 规约收口中产生未验证 runtime 行为变化。

## Model Asset Conflicts

后续模型资产迁移必须处理：

- `packages/worker-base/system-models/workspace_positive_models.json`
  - 仍包含多处 `pin.connect.model`。
  - 仍包含按旧 runtime 生成的跨模型 route。
- `packages/worker-base/system-models/test_model_100_ui.json`
  - 仍包含 `pin.connect.model`。
- `deploy/sys-v1ns/ui-side-worker/patches/10_ui_side_worker_demo.json`
  - 仍包含 `pin.connect.model` 和 `(self, ...)` / `(func, ...)`。
- `deploy/sys-v1ns/remote-worker/patches/*.json`
  - 多个 worker demo 仍使用 `(self, ...)` / `(func, ...)` endpoint。

这些资产是运行面的一部分，迁移时必须同步测试和部署路径。

## Test And Validator Conflicts

后续测试迁移必须处理：

- `scripts/validate_builtins_v0.mjs`
- `scripts/validate_program_model_loader_v0.mjs`
- `scripts/tests/test_0158_new_label_types.mjs`
- `scripts/tests/test_0248_cross_model_pin_owner_materialization_contract.mjs`
- `scripts/tests/test_0306_model100_pin_chain_contract.mjs`
- `scripts/tests/test_0306_runtime_mailbox_ingress_contract.mjs`
- `scripts/tests/test_0312_slide_import_cache_contract.mjs`
- `scripts/tests/test_0326_ui_event_busin_flow.mjs`
- `scripts/tests/test_0336_mgmt_bus_console_contract.mjs`
- `scripts/tests/test_0339_mgmt_bus_console_live_projection_contract.mjs`

其中一部分测试当前直接断言 `pin.connect.model` 存在；实现迁移时必须先改为 0356 target contract 的 RED 测试，再改 runtime 和资产。

## Historical Docs

以下区域保留旧字样作为历史记录，不在 0356 中批量重写：

- `docs/iterations/**`
- `docs/plans/**`

后续如果某个历史 plan 被重新提升为当前方案，必须先按 0356 合同重写。

## Suggested Implementation Order

1. 先改 runtime parser contract：`pin.connect.label` 只接受直接端点名，`pin.connect.cell` 禁止函数引脚，`pin.connect.model` 拒绝新写入。
2. 再改 host/importer/server 生成逻辑：Model 0 路由改为 hosting Cell 边界 + `pin.connect.cell`。
3. 再迁移 system-models 和 deploy patches。
4. 最后迁移测试与 validators，并添加禁止旧写法回归的 grep gate。
