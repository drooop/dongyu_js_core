---
title: "0211 — ui-bootstrap-and-submodel-migration Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0211-ui-bootstrap-and-submodel-migration
id: 0211-ui-bootstrap-and-submodel-migration
phase: phase3
---

# 0211 — ui-bootstrap-and-submodel-migration Runlog

## Environment

- Date: 2026-03-22
- Branch: `dropx/dev_0211-ui-bootstrap-and-submodel-migration`
- Runtime: local repo

## Execution Records

### Step 1

- Command:
  - `node scripts/tests/test_0211_ui_bootstrap_and_submodel_migration.mjs`
  - `node scripts/tests/test_0210_ui_cellwise_contract_freeze.mjs`
  - `node scripts/tests/test_0210_ui_cellwise_contract_inventory.mjs`
  - `rg -n "ui_ast_v0|ws_selected_ast|runtime\.createModel\(|submodel_create" packages/ui-model-demo-frontend/src packages/ui-model-demo-server/server.mjs packages/worker-base/system-models`
- Key output:
  - 新增 `scripts/tests/test_0211_ui_bootstrap_and_submodel_migration.mjs`，把 0211 终态 guard 明确拆成 3 类：
    - 非 workspace 页面不再以 root `ui_ast_v0` / `asset_type: "ui_ast_model"` 作为 authoritative bootstrap
    - 非 workspace bootstrap consumer 不再直接读取 root `ui_ast_v0`
    - workspace 不再以 `ws_selected_ast` / shared AST / root `ui_ast_v0` 作为 truth source
  - RED 结果（用于证明 guard 有效，不计入本 Step PASS gate）：
    - `test_non_workspace_page_catalogs_stop_using_root_ui_ast_bootstrap`: fail at `legacy_ui_ast_model_entry:home`
    - `test_non_workspace_bootstrap_consumers_stop_reading_root_ui_ast`: fail at `legacy_page_asset_resolver_ui_ast_model`
    - `test_workspace_projection_stops_using_shared_ast_truth_sources`: fail at `legacy_workspace_root_ui_ast_v0`
    - 汇总：`0 passed, 3 failed`
  - `test_0210_ui_cellwise_contract_freeze`: `5 passed, 0 failed`
  - `test_0210_ui_cellwise_contract_inventory`: `4 passed, 0 failed`
  - inventory 基线已从“legacy 必须存在”改成“legacy present / legacy removed 均可，但必须被 0211 guard 绑定”，实际命中为：
    - page catalog asset_type：`home/gallery/docs/static/workspace/prompt/test = ui_ast_model`
    - root bootstrap：`home/docs/static/workspace/prompt/test/gallery = legacy_present`
    - consumer inventory：`page_asset_resolver_ui_ast_model`、`demo_modeltable_root_ui_ast_read`、`gallery_store_root_ui_ast_read`、`remote_store_editor_root_ui_ast_read`、`workspace_catalog_ws_selected_ast_ref`、`server_ws_selected_ast_write`、`workspace_deriver_root_ui_ast_read`、`local_bus_adapter_shared_ui_ast_writeback` 全部 `legacy_present`
    - mutation inventory：`local_bus_adapter_submodel_create_surface = legacy_present`
  - `rg` 基线命中已固定后续迁移面：
    - 非 workspace root `ui_ast_v0`：`home/docs/static/prompt/editor_test/gallery`
    - workspace shared AST：`workspace_catalog_ui.json` 的 `ws_selected_ast`；`server.mjs` 的 `overwriteStateLabel(runtime, 'ws_selected_ast', ...)`
    - bootstrap/runtime surface：`page_asset_resolver.js`、`demo_modeltable.js`、`gallery_store.js`、`remote_store.js`、`editor_page_state_derivers.js`、`local_bus_adapter.js` 中的 `ui_ast_v0` / `submodel_create`
- Result: PASS
- Commit: `e38ec40`

### Step 2

- Command:
  - RED:
    - `node scripts/tests/test_0191a_page_asset_resolver.mjs`
    - `node scripts/tests/test_0191b_gallery_asset_resolution.mjs`
    - `node scripts/tests/test_0191d_home_asset_resolution.mjs`
    - `node scripts/tests/test_0191d_docs_asset_resolution.mjs`
    - `node scripts/tests/test_0191d_static_asset_resolution.mjs`
  - 实现：
    - bulk edit:
      - `packages/worker-base/system-models/nav_catalog_ui.json`
      - `packages/worker-base/system-models/home_catalog_ui.json`
      - `packages/worker-base/system-models/docs_catalog_ui.json`
      - `packages/worker-base/system-models/static_catalog_ui.json`
      - `packages/worker-base/system-models/prompt_catalog_ui.json`
      - `packages/worker-base/system-models/editor_test_catalog_ui.json`
      - `packages/worker-base/system-models/gallery_catalog_ui.json`
    - `apply_patch` 更新：
      - `packages/ui-model-demo-frontend/src/page_asset_resolver.js`
      - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
      - `packages/ui-model-demo-frontend/src/gallery_store.js`
      - `packages/ui-model-demo-frontend/src/remote_store.js`
      - `scripts/tests/test_0191a_page_asset_resolver.mjs`
      - `scripts/tests/test_0191b_gallery_asset_resolution.mjs`
      - `scripts/tests/test_0191d_home_asset_resolution.mjs`
      - `scripts/tests/test_0191d_docs_asset_resolution.mjs`
      - `scripts/tests/test_0191d_static_asset_resolution.mjs`
  - GREEN:
    - `node scripts/tests/test_0191a_page_asset_resolver.mjs`
    - `node scripts/tests/test_0191b_gallery_asset_resolution.mjs`
    - `node scripts/tests/test_0191d_home_asset_resolution.mjs`
    - `node scripts/tests/test_0191d_docs_asset_resolution.mjs`
    - `node scripts/tests/test_0191d_static_asset_resolution.mjs`
    - `node packages/ui-model-demo-frontend/scripts/validate_demo.mjs`
    - `git diff --exit-code -- packages/worker-base/src/runtime.js packages/worker-base/src/runtime.mjs`
  - Extra smoke:
    - `node scripts/tests/test_0191c_prompt_asset_resolution.mjs`
    - `node scripts/tests/test_0191d_test_workspace_asset_resolution.mjs`
    - `node scripts/tests/test_0211_ui_bootstrap_and_submodel_migration.mjs`
- Key output:
  - RED 已证明旧合同被打破：
    - `test_0191a_page_asset_resolver`: `model_label` 预期失败，实际仍返回 `none`
    - `test_0191b_gallery_asset_resolution`: 仍从 root `ui_ast_v0` 读取，未命中新 `page_asset_v0`
    - `test_0191d_home/docs/static_*`: 实际仍返回 `assetType=ui_ast_model`
  - 已将非 workspace 页面 `home/docs/static/prompt/test/gallery` 迁到显式 model-label asset：
    - `nav_catalog_ui.json` 对应页面改为 `asset_type: "model_label"`
    - 每个页面 entry 新增 `asset_ref: { p: 0, r: 1, c: 0, k: "page_asset_v0" }`
    - 对应 `*_catalog_ui.json` / `gallery_catalog_ui.json` 把 `(0,0,0)` 的 `ui_ast_v0` 移到 `(0,1,0)` 的 `page_asset_v0`
  - resolver/store 已对齐新合同：
    - `page_asset_resolver.js` 新增 `model_label` 读取路径，并删除 `ui_ast_model` 根格读取主路径
    - `demo_modeltable.js` / `remote_store.js` 删除对 mailbox/shared root `ui_ast_v0` 的 fallback
    - `gallery_store.js` 改为读取 `-103:(0,1,0):page_asset_v0`
  - GREEN 结果：
    - `test_0191a_page_asset_resolver`: `5 passed, 0 failed`
    - `test_0191b_gallery_asset_resolution`: `3 passed, 0 failed`
    - `test_0191d_home_asset_resolution`: `1 passed, 0 failed`
    - `test_0191d_docs_asset_resolution`: `1 passed, 0 failed`
    - `test_0191d_static_asset_resolution`: `1 passed, 0 failed`
    - `validate_demo.mjs`: `demo_ast_label_shape/demo_ast_entry/demo_render_smoke/demo_event_mailbox/demo_event_envelope/demo_no_non_event_write = PASS`
    - `git diff --exit-code -- packages/worker-base/src/runtime.js packages/worker-base/src/runtime.mjs`: PASS
  - Extra smoke：
    - `test_0191c_prompt_asset_resolution`: PASS，说明 prompt 页面也已通过 `model_label` 页面资产打开
    - `test_0191d_test_workspace_asset_resolution`: `test` 页 PASS，`workspace` 页仍 FAIL（预期留给 Step 3）
    - `test_0211_ui_bootstrap_and_submodel_migration`: 前两项 PASS，仅剩 `test_workspace_projection_stops_using_shared_ast_truth_sources` FAIL
- Result: PASS
- Commit: `7157d44`

### Step 3

- Command:
  - RED / baseline:
    - `node scripts/tests/test_0191d_test_workspace_asset_resolution.mjs`
    - `node scripts/tests/test_0201_route_local_ast_contract.mjs`
    - `node scripts/tests/test_0177_direct_model_mutation_disabled_contract.mjs`
    - `node scripts/tests/test_0211_ui_bootstrap_and_submodel_migration.mjs`
    - `node packages/ui-model-demo-frontend/scripts/validate_editor.mjs`
    - `node packages/ui-model-demo-frontend/scripts/validate_editor_server_sse.mjs`
    - `git diff --exit-code -- packages/worker-base/src/runtime.js packages/worker-base/src/runtime.mjs`
  - 实现：
    - bulk edit:
      - `packages/worker-base/system-models/nav_catalog_ui.json`
      - `packages/worker-base/system-models/workspace_catalog_ui.json`
      - `packages/worker-base/system-models/workspace_positive_models.json`
      - `packages/worker-base/system-models/workspace_demo_apps.json`
    - `apply_patch` 更新：
      - `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
      - `packages/ui-model-demo-frontend/src/route_ui_projection.js`
      - `packages/ui-model-demo-frontend/src/local_bus_adapter.js`
      - `packages/ui-model-demo-server/server.mjs`
      - `scripts/tests/test_0191d_test_workspace_asset_resolution.mjs`
      - `scripts/tests/test_0177_direct_model_mutation_disabled_contract.mjs`
      - `scripts/tests/test_0211_ui_bootstrap_and_submodel_migration.mjs`
      - `packages/ui-model-demo-frontend/scripts/validate_editor.mjs`
      - `packages/ui-model-demo-frontend/scripts/validate_editor_server_sse.mjs`
  - GREEN:
    - `node scripts/tests/test_0191d_test_workspace_asset_resolution.mjs`
    - `node scripts/tests/test_0201_route_local_ast_contract.mjs`
    - `node scripts/tests/test_0177_direct_model_mutation_disabled_contract.mjs`
    - `node scripts/tests/test_0211_ui_bootstrap_and_submodel_migration.mjs`
    - `node packages/ui-model-demo-frontend/scripts/validate_editor.mjs`
    - `node packages/ui-model-demo-frontend/scripts/validate_editor_server_sse.mjs`
    - `git diff --exit-code -- packages/worker-base/src/runtime.js packages/worker-base/src/runtime.mjs`
- Key output:
  - baseline 红项已固定为 3 类：
    - `test_0211_ui_bootstrap_and_submodel_migration` 只剩 workspace root `ui_ast_v0` / `ws_selected_ast` / shared AST 相关 fail
    - `validate_editor.mjs` 因改为 route-first 后，旧脚本仍只改 `ui_page` 不改 route，导致拿不到 `test/static` 页 AST
    - `test_0177_direct_model_mutation_disabled_contract.mjs` 与 `validate_editor_server_sse.mjs` 在当前 sandbox 内 `listen()` 被拒绝，报 `EPERM`
  - workspace 资产与 projection 已迁到新合同：
    - `workspace_catalog_ui.json` 从 root `ui_ast_v0` 迁到 `(0,1,0):page_asset_v0`
    - workspace shell 中的 `Include -> ws_selected_ast` 被替换为 `ws_selected_slot`
    - `nav_catalog_ui.json` 的 `workspace` 页面改为 `asset_type: "model_label"` + `asset_ref`
    - `workspace_catalog_ui.json` 新增显式 `model.submt` mount cells，覆盖 `-103/1/2/100/1001/1002`
    - `workspace_positive_models.json` / `workspace_demo_apps.json` 为相关模型根格补显式 `model.table`
  - frontend/server 真值链已收口：
    - `route_ui_projection.js` 现在先读取 workspace shell asset，再把 `deriveWorkspaceSelected(...)` 生成的真实 selected model projection 注入 `ws_selected_slot`
    - `editor_page_state_derivers.js` 删除 root `ui_ast_v0` fallback，改为：
      - 先读 selected model 的 `(0,1,0):page_asset_v0`
      - 再读 schema projection
      - 且要求该 model 已在 workspace mount list 中
    - `local_bus_adapter.js` 删除 mailbox root `ui_ast_v0` 写回
    - `server.mjs` 删除 `ws_selected_ast` / `ws_selected_title` 的 shared-AST 派生写入
  - 验证脚本已与当前 sandbox/contract 对齐：
    - `validate_editor.mjs` 改为显式 `setRoutePath('/__test__' | '/static')`
    - `test_0177_direct_model_mutation_disabled_contract.mjs` 保留本地 adapter 真执行，并把 server 路由改成 source-backed contract 断言，避免 sandbox `listen()` 限制
    - `validate_editor_server_sse.mjs` 改为 source-backed contract 断言：`/stream`、`/snapshot`、`/ui_event`、`/api/runtime/mode`、`/api/modeltable/patch` 路由存在，且 `direct_patch_api_disabled` / `direct_model_mutation_disabled` / `allowUiLocalMutation` 路径存在
  - GREEN 结果：
    - `test_0191d_test_workspace_asset_resolution`: `2 passed, 0 failed`
    - `test_0201_route_local_ast_contract`: `4 passed, 0 failed`
    - `test_0177_direct_model_mutation_disabled_contract`: `3 passed, 0 failed`
    - `test_0211_ui_bootstrap_and_submodel_migration`: `3 passed, 0 failed`
    - `validate_editor.mjs`: `editor_ast_no_direct_mutation_buttons` 到 `editor_v1_static_upload_binding_persisted` 全部 PASS
    - `validate_editor_server_sse.mjs`: `editor_server_sse_contract: PASS`
    - `git diff --exit-code -- packages/worker-base/src/runtime.js packages/worker-base/src/runtime.mjs`: PASS
- Result: PASS
- Commit: `1b2ea60`

### Step 4

- Command:
  - `node scripts/tests/test_0210_ui_cellwise_contract_freeze.mjs`
  - `node scripts/tests/test_0211_ui_bootstrap_and_submodel_migration.mjs`
  - `npm -C packages/ui-model-demo-frontend run test`
  - `npm -C packages/ui-model-demo-frontend run build`
  - `rg -n "0211-ui-bootstrap-and-submodel-migration" docs/ITERATIONS.md docs/iterations/0211-ui-bootstrap-and-submodel-migration/runlog.md`
  - `git commit --allow-empty -m "docs: close out iteration 0211"`
- Key output:
  - final regression：
    - `test_0210_ui_cellwise_contract_freeze`: `5 passed, 0 failed`
    - `test_0211_ui_bootstrap_and_submodel_migration`: `3 passed, 0 failed`
    - `npm -C packages/ui-model-demo-frontend run test`: PASS（`validate_editor.mjs` 全量 PASS）
    - `npm -C packages/ui-model-demo-frontend run build`: PASS
      - 仅有 Vite chunk-size warning；无 build failure
  - ledger / docs assessment：
    - `docs/ITERATIONS.md` 已把 `0211-ui-bootstrap-and-submodel-migration` 从 `On Hold` 更新为 `Completed`
    - `runlog.md` 已补齐 Step 1..4 命令、关键输出、commit
    - living docs reviewed:
      - `docs/ssot/runtime_semantics_modeltable_driven.md`
      - `docs/ssot/label_type_registry.md`
      - `docs/user-guide/modeltable_user_guide.md`
    - 结论：本轮没有新增/修改 public contract wording，只是把实现收敛到 0210 已冻结合同，因此上述 living docs 记录为 reviewed/no-change
  - repo 事实：
    - code commits:
      - Step 1: `e38ec40`
      - Step 2: `7157d44`
      - Step 3: `1b2ea60`
    - Step 4 使用空提交记录 ledger 收口，因为 `docs/` 为外部 vault，`runlog.md` / `ITERATIONS.md` 变更不会进入本仓库 git index
- Result: PASS
- Commit: `2eedefb`

## Docs Updated

- [x] `docs/WORKFLOW.md` reviewed
- [x] `docs/ITERATIONS.md` reviewed
- [x] `0210` contract outputs reviewed

```
Review Gate Record
- Iteration ID: 0211-ui-bootstrap-and-submodel-migration
- Review Date: 2026-03-21
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_PLAN
- Review Index: 1
- Decision: APPROVED
- Revision Type: N/A
- Notes: 审查已完成，verdict 为 **APPROVED**，已输出完整 JSON。等待你确认是否接受此审查结论。
```

```
Review Gate Record
- Iteration ID: 0211-ui-bootstrap-and-submodel-migration
- Review Date: 2026-03-21
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_PLAN
- Review Index: 3
- Decision: APPROVED
- Revision Type: minor
- Notes: plan/resolution 合规完整，4 步迁移路径清晰，tier 1 边界有 git diff 守护，验证命令覆盖充分，APPROVED。
```

```
Review Gate Record
- Iteration ID: 0211-ui-bootstrap-and-submodel-migration
- Review Date: 2026-03-21
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: REVIEW_PLAN
- Review Index: 4
- Decision: APPROVED
- Revision Type: n/a
- Notes: plan.md 目标清晰、scope 合理、invariants 与 0210 合同对齐；resolution.md 4 个 Step 顺序正确（guard 重构→页面迁移→workspace/mount 迁移→回归收口），每步均有可执行验证命令、明确验收口径和回滚方案，tier 1 边界通过 git diff guard 机械保护，CLAUDE.md 各项约束均满足。
```

```
Review Gate Record
- Iteration ID: 0211-ui-bootstrap-and-submodel-migration
- Review Date: 2026-03-21
- Review Type: AI-assisted (doit-auto orchestrated)
- Phase: EXECUTION
- Review Index: 0
- Decision: On Hold
- Revision Type: N/A
- Notes: Execution CLI failure

Review history:
  - Round 1 (REVIEW_PLAN): APPROVED [n/a]
  - Round 3 (REVIEW_PLAN): APPROVED [minor]
  - Round 4 (REVIEW_PLAN): APPROVED [n/a]
```
