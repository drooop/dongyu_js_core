---
title: "0215 — ui-model-tier2-examples-v1 Runlog"
doc_type: iteration-runlog
status: planned
updated: 2026-03-23
source: ai
iteration_id: 0215-ui-model-tier2-examples-v1
id: 0215-ui-model-tier2-examples-v1
phase: phase3
---

# 0215 — ui-model-tier2-examples-v1 Runlog

## Environment

- Date: 2026-03-23
- Branch: `dropx/dev_0215-ui-model-tier2-examples-v1`
- Runtime: local repo + examples regression closeout

## Execution Records

### Step 1

- Command:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0191d_test_workspace_asset_resolution.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0214_sliding_flow_ui_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "workspace_positive_models\\.json|workspace_demo_apps\\.json" packages/ui-model-demo-frontend/src/demo_modeltable.js packages/ui-model-demo-server/server.mjs packages/worker-base/system-models`
- Key output:
  - `test_0191d_test_workspace_asset_resolution`: `2 passed, 0 failed`
  - `test_0214_sliding_flow_ui_contract`: `7 passed, 0 failed`
  - `test_0215_ui_model_tier2_examples_contract`: `4 passed, 0 failed`
  - `rg` 仅命中运行链路中的 `workspace_positive_models.json`：
    - `packages/ui-model-demo-frontend/src/demo_modeltable.js:10`
    - `packages/ui-model-demo-server/server.mjs:2818`
  - 本轮未发现 `workspace_demo_apps.json` 的 runtime consumer，符合 0215 authority guard
  - `0f23101` 已把以下 guard 物化到测试与资产面：
    - authoritative seed 固定为 `workspace_positive_models.json`
    - canonical example taxonomy 固定为 schema-only leaf / page_asset composition / parent-mounted data-path
    - parent / child 示例通过显式 `model.submt` 进入层级
- Result: PASS
- Commit: `0f23101`

### Step 2

- Command:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0191d_test_workspace_asset_resolution.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0201_route_local_ast_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_ui_model_examples_local.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && git diff --exit-code -- packages/worker-base/src/runtime.js packages/worker-base/src/runtime.mjs packages/ui-renderer/src/renderer.js packages/ui-renderer/src/renderer.mjs`
- Key output:
  - `test_0191d_test_workspace_asset_resolution`: `2 passed, 0 failed`
  - `test_0201_route_local_ast_contract`: `4 passed, 0 failed`
  - `test_0215_ui_model_tier2_examples_contract`: `4 passed, 0 failed`
  - `validate_ui_model_examples_local`: `PASS`
  - Tier 1 diff gate: `PASS`（`runtime.js/runtime.mjs/renderer.js/renderer.mjs` 无改动）
  - `workspace_positive_models.json` 物化 canonical examples：
    - `Model 1003`: schema-only leaf example
    - `Model 1004`: `page_asset_v0` composition example
    - `Model 1005`: parent-mounted example
    - `Model 1006`: mounted child truth model
  - `workspace_catalog_ui.json` 仅把 `1003/1004/1005` 暴露给 `Workspace`；`1005` 再通过 `model.submt` 显式挂载 `1006`
  - local validator 确认：
    - `Workspace` registry 包含 `1003/1004/1005`
    - child `1006` 不直接暴露到 `Workspace`
    - schema/page_asset/parent-mounted 三种 surface 都可被解析
- Result: PASS
- Commit: `0f23101`

### Step 3

- Command:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0212_home_crud_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_ui_model_examples_local.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_ui_model_examples_server_sse.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && git diff --exit-code -- packages/worker-base/src/runtime.js packages/worker-base/src/runtime.mjs packages/ui-renderer/src/renderer.js packages/ui-renderer/src/renderer.mjs`
- Key output:
  - `test_0212_home_crud_contract`: `4 passed, 0 failed`
  - `test_0215_ui_model_tier2_examples_contract`: `4 passed, 0 failed`
  - `validate_ui_model_examples_local`: `PASS`
  - `validate_ui_model_examples_server_sse`: `PASS`
  - Tier 1 diff gate: `PASS`（`runtime.js/runtime.mjs/renderer.js/renderer.mjs` 无改动）
  - `intent_dispatch_config.json` 已注册：
    - `ui_examples_promote_child_stage -> handle_ui_examples_promote_child_stage`
  - `intent_handlers_ui_examples.json` 已提供正式 handler：
    - authoritative child truth 写入 `Model 1006`
    - parent projection 状态写回 `Model 1005`
  - `local_bus_adapter.js` 对 `ui_examples_promote_child_stage` 明确返回 `unsupported / ui_examples_remote_only`，local validator 证实 child truth 仍保持 `draft`
  - server validator 证实正式 data path 可将 child stage 从 `draft -> review -> approved`，且 parent/child `page_asset_v0` surface 保持可解析
- Result: PASS
- Commit: `0f23101`

### Step 4

- Command:
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0191d_test_workspace_asset_resolution.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0201_route_local_ast_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0212_home_crud_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0214_sliding_flow_ui_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_ui_model_examples_local.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && node packages/ui-model-demo-frontend/scripts/validate_ui_model_examples_server_sse.mjs`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && npm -C packages/ui-model-demo-frontend run test`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && npm -C packages/ui-model-demo-frontend run build`
  - `cd /Users/drop/codebase/cowork/dongyuapp_elysia_based && rg -n "0215-ui-model-tier2-examples-v1|ui-model-tier2-examples|workspace_positive_models|ui_components_v2" docs/ITERATIONS.md docs/iterations/0215-ui-model-tier2-examples-v1/runlog.md docs/user-guide/ui_components_v2.md`
- Key output:
  - targeted regression 全部 GREEN：
    - `test_0191d_test_workspace_asset_resolution`: `2 passed, 0 failed`
    - `test_0201_route_local_ast_contract`: `4 passed, 0 failed`
    - `test_0212_home_crud_contract`: `4 passed, 0 failed`
    - `test_0214_sliding_flow_ui_contract`: `7 passed, 0 failed`
    - `test_0215_ui_model_tier2_examples_contract`: `4 passed, 0 failed`
    - `validate_ui_model_examples_local`: `PASS`
    - `validate_ui_model_examples_server_sse`: `PASS`
    - `npm -C packages/ui-model-demo-frontend run test`: `scripts/validate_editor.mjs` 全量 `PASS`
    - `npm -C packages/ui-model-demo-frontend run build`: `✓ built in 2.40s`
  - docs assessment：
    - `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed: no update required
    - `docs/ssot/tier_boundary_and_conformance_testing.md` reviewed: no update required
    - `docs/user-guide/modeltable_user_guide.md` reviewed: no update required
    - `docs/user-guide/ui_components_v2.md` reviewed: no update required
  - assessment rationale：
    - 0215 仅新增 canonical example assets、dispatch entry/handler 与 local/server validators
    - 未修改 runtime / renderer 语义
    - 未改变 mailbox contract、pin routing、reserved model ids/cells 的公共口径
    - 涉及组件（`StatusBadge` / `StatCard` / `Terminal` / `Include`）已有文档覆盖，且 `ui_components_v2.md` 现有“StatCard 仅支持 AST”口径与 0215 实现一致
  - ledger closeout：
    - `docs/ITERATIONS.md` 中 `0215-ui-model-tier2-examples-v1` 已更新为 `Completed`
    - `rg` 已命中本 runlog 的 Step 1-4 证据与 `docs/user-guide/ui_components_v2.md` 的现有组件说明
- Result: PASS

## Docs Updated

- [x] `docs/WORKFLOW.md` reviewed
- [x] `docs/ITERATIONS.md` reviewed
- [x] `0210` / `0211` outputs reviewed

```
Review Gate Record
- Iteration ID: 0215-ui-model-tier2-examples-v1
- Review Date: 2026-03-22
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_PLAN
- Review Index: 1
- Decision: APPROVED
- Revision Type: minor
- Notes: plan/resolution 结构完整、合规通过、验证链完备，可进入 phase2 review gate；3 条非阻塞建议供执行时参考
```

```
Review Gate Record
- Iteration ID: 0215-ui-model-tier2-examples-v1
- Review Date: 2026-03-22
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_PLAN
- Review Index: 2
- Decision: APPROVED
- Revision Type: N/A
- Notes: # Plan: Review Iteration 0215-ui-model-tier2-examples-v1
```

```
Review Gate Record
- Iteration ID: 0215-ui-model-tier2-examples-v1
- Review Date: 2026-03-22
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_PLAN
- Review Index: 4
- Decision: On Hold
- Revision Type: N/A
- Notes: parse_failure: Could not parse verdict from review output

Review history:
  - Round 1 (REVIEW_PLAN): APPROVED [minor]
  - Round 2 (REVIEW_PLAN): APPROVED [n/a]
```

```
Review Gate Record
- Iteration ID: 0215-ui-model-tier2-examples-v1
- Review Date: 2026-03-22
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_PLAN
- Review Index: 5
- Decision: APPROVED
- Revision Type: n/a
- Notes: plan/resolution 结构完整、约束合规、验证充分，五项 conformance 全部 pass，可进入 phase2 review gate
```

```
Review Gate Record
- Iteration ID: 0215-ui-model-tier2-examples-v1
- Review Date: 2026-03-22
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_EXEC
- Review Index: 1
- Decision: APPROVED
- Revision Type: N/A
- Notes: # 0215-ui-model-tier2-examples-v1 Execution Review
```

```
Review Gate Record
- Iteration ID: 0215-ui-model-tier2-examples-v1
- Review Date: 2026-03-22
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_EXEC
- Review Index: 2
- Decision: APPROVED
- Revision Type: N/A
- Notes: # 0215 Execution Review — Findings
```

```
Review Gate Record
- Iteration ID: 0215-ui-model-tier2-examples-v1
- Review Date: 2026-03-22
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_EXEC
- Review Index: 3
- Decision: NEEDS_CHANGES
- Revision Type: major
- Notes: 审查已完成。verdict 为 **NEEDS_CHANGES (major)**——分支上零 0215 执行 commit，所有关键交付文件缺失，runlog 无执行证据。详细 blocking issues 见上方 JSON。
```

```
Review Gate Record
- Iteration ID: 0215-ui-model-tier2-examples-v1
- Review Date: 2026-03-23
- Review Type: AI-assisted (Claude Code)
- Phase: REVIEW_EXEC
- Review Index: 4
- Decision: NEEDS_CHANGES
- Revision Type: minor
- Notes: Steps 1-3 实质交付通过验证，仅需补完 Step 4 的 runlog 执行证据、ITERATIONS.md 状态更新和 docs assessment 结论。
```

```
Review Gate Record
- Iteration ID: 0215-ui-model-tier2-examples-v1
- Review Date: 2026-03-22
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_EXEC
- Review Index: 4
- Decision: NEEDS_CHANGES
- Revision Type: minor
- Notes: 审查已完成。verdict 为 **NEEDS_CHANGES (minor)** — Steps 1-3 实质交付通过验证，仅需补完 Step 4 的 runlog 执行证据、ITERATIONS.md 状态更新和 docs assessment 结论。
```

```
Review Gate Record
- Iteration ID: 0215-ui-model-tier2-examples-v1
- Review Date: 2026-03-22
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_EXEC
- Review Index: 6
- Decision: APPROVED
- Revision Type: N/A
- Notes: 审查已完成。verdict JSON 已在上方输出，APPROVED。
```

```
Review Gate Record
- Iteration ID: 0215-ui-model-tier2-examples-v1
- Review Date: 2026-03-22
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_EXEC
- Review Index: 7
- Decision: APPROVED
- Revision Type: N/A
- Notes: 审查已完成，verdict 为 **APPROVED**。0215 迭代交付完整，可以关闭。
```

```
Review Gate Record
- Iteration ID: 0215-ui-model-tier2-examples-v1
- Review Date: 2026-03-22
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_EXEC
- Review Index: 8
- Decision: APPROVED
- Revision Type: N/A
- Notes: 审查已完成，verdict 为 **APPROVED**。0215 迭代交付完整，所有 4 个 Step PASS，conformance 五项全部通过。
```
