---
title: "Iteration 0263-mounting-remediation Run Log"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0263-mounting-remediation
id: 0263-mounting-remediation
phase: phase3
---

# Iteration 0263-mounting-remediation Run Log

## Environment
- OS: macOS
- Working directory: `/Users/drop/codebase/cowork/dongyuapp_elysia_based`
- Branch: `dev_0263-mounting-remediation`

### Review Gate Records (FACTS)
```text
Review Gate Record
- Iteration ID: 0263-mounting-remediation
- Review Date: 2026-03-30
- Review Type: User
- Reviewer: user
- Review Index: 1
- Decision: Approved
- Notes: user explicitly rejected server-only cleanup and required B-scheme remediation where all software workers conform.
```

## Step 1 — Add profile RED tests
- Start time: 2026-03-30 14:31:00 +0800
- End time: 2026-03-30 14:32:00 +0800
- Branch: `dev_0263-mounting-remediation`
- Commits:
  - N/A
- Commands executed:
  - `apply_patch scripts/tests/test_0263_model_mounting_profiles.mjs`
  - `node scripts/tests/test_0263_model_mounting_profiles.mjs`
- Key outputs (snippets):
  - initial RED: `analyzer must expose profile audits`
- Result: PASS

## Step 2 — Remediate hierarchy declarations
- Start time: 2026-03-30 14:32:00 +0800
- End time: 2026-03-30 14:41:00 +0800
- Branch: `dev_0263-mounting-remediation`
- Commits:
  - N/A
- Commands executed:
  - `apply_patch packages/worker-base/system-models/runtime_hierarchy_mounts.json`
  - `apply_patch packages/ui-model-demo-server/server.mjs`
  - `apply_patch packages/ui-model-demo-frontend/src/demo_modeltable.js`
  - `apply_patch packages/worker-base/system-models/workspace_catalog_ui.json`
  - `apply_patch deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json`
  - `apply_patch deploy/sys-v1ns/ui-side-worker/patches/00_ui_side_worker_config.json`
  - `apply_patch deploy/sys-v1ns/mbr/patches/mbr_role_v0.json`
  - `apply_patch packages/worker-base/system-models/test_model_100_ui.json`
  - `apply_patch packages/worker-base/src/runtime.mjs`
- Key outputs (snippets):
  - 新增 `runtime_hierarchy_mounts.json`，把 ui-server/local demo 的正式父链集中到 `Model 0`
  - `workspace_catalog_ui.json` 移除了 11 条由 `-25` 承担正式父挂载的 `model.submt`
  - `remote-worker` / `ui-side-worker` / `mbr-worker` 各自补了 `0 -> -10` 挂载
  - runtime 补齐 `model.submt` (`k=model_type`, `v=<childId>`) 的 child id 解析与 `parentChildMap` 更新
- Result: PASS

## Step 3 — Update Workspace mount resolution
- Start time: 2026-03-30 14:41:00 +0800
- End time: 2026-03-30 14:42:00 +0800
- Branch: `dev_0263-mounting-remediation`
- Commits:
  - N/A
- Commands executed:
  - `apply_patch packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
  - `apply_patch scripts/tests/test_0201_route_local_ast_contract.mjs`
  - `apply_patch scripts/tests/test_0214_sliding_flow_ui_contract.mjs`
- Key outputs (snippets):
  - Workspace mounted 判定从 `-25` 局部 submt 改成全局 hierarchy 扫描
  - `Model 100` 在 Workspace route 下重新恢复 selected app AST，不再落入 `ws_not_mounted`
- Result: PASS

## Step 4 — Rework analyzer/viz to profile audits
- Start time: 2026-03-30 14:42:00 +0800
- End time: 2026-03-30 14:44:30 +0800
- Branch: `dev_0263-mounting-remediation`
- Commits:
  - N/A
- Commands executed:
  - `apply_patch scripts/ops/model_mounting_analyzer.mjs`
  - `apply_patch scripts/tests/test_0262_model_mounting_analyzer.mjs`
  - `apply_patch viz-model-mounting.html`
  - `node scripts/ops/model_mounting_analyzer.mjs --write-viz`
  - `python3 -m http.server 8766`
  - Playwright MCP open `http://127.0.0.1:8766/viz-model-mounting.html`
- Key outputs (snippets):
  - analyzer 新增 profile:
    - `ui-server`
    - `remote-worker`
    - `ui-side-worker`
    - `mbr-worker`
  - 浏览器页面 summary:
    - `ui-server · unmounted=0 · dup=0`
    - `remote-worker · unmounted=0 · dup=0`
    - `ui-side-worker · unmounted=0 · dup=0`
    - `mbr-worker · unmounted=0 · dup=0`
- Result: PASS

## Step 5 — Run focused regression
- Start time: 2026-03-30 14:44:30 +0800
- End time: 2026-03-30 14:46:00 +0800
- Branch: `dev_0263-mounting-remediation`
- Commits:
  - N/A
- Commands executed:
  - `node scripts/tests/test_0262_model_mounting_analyzer.mjs`
  - `node scripts/tests/test_0263_model_mounting_profiles.mjs`
  - `node scripts/tests/test_0182_model100_submit_chain_contract.mjs`
  - `node scripts/tests/test_0201_route_local_ast_contract.mjs`
  - `node scripts/tests/test_0214_sliding_flow_ui_contract.mjs`
  - `node scripts/tests/test_0144_remote_worker.mjs`
  - `node scripts/tests/test_0211_ui_bootstrap_and_submodel_migration.mjs`
  - `node scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
  - `node scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`
  - `node scripts/tests/test_0216_threejs_scene_contract.mjs`
  - `node scripts/ops/model_mounting_analyzer.mjs`
  - `node scripts/ops/model_mounting_analyzer.mjs --write-viz`
- Key outputs (snippets):
  - `PASS test_0262_model_mounting_analyzer`
  - `PASS test_0263_model_mounting_profiles`
  - `PASS test_0182_model100_submit_chain_contract`
  - `4 passed, 0 failed out of 4` (`test_0201_route_local_ast_contract`)
  - `7 passed, 0 failed out of 7` (`test_0214_sliding_flow_ui_contract`)
  - `7 passed, 0 failed out of 7` (`test_0144_remote_worker`)
  - analyzer:
    - `ui-server_unmounted=0`
    - `ui-server_duplicates=0`
    - `remote-worker_unmounted=0`
    - `remote-worker_duplicates=0`
    - `ui-side-worker_unmounted=0`
    - `ui-side-worker_duplicates=0`
    - `mbr-worker_unmounted=0`
    - `mbr-worker_duplicates=0`
- Result: PASS

## Final Audit Outcome
- 所有 software worker profile 已归零：
  - `ui-server`: 0 unmounted / 0 duplicate
  - `remote-worker`: 0 unmounted / 0 duplicate
  - `ui-side-worker`: 0 unmounted / 0 duplicate
  - `mbr-worker`: 0 unmounted / 0 duplicate
- `canonical` 聚合视图仍显示 `duplicate=3`，其含义为“跨 profile 重复声明”，不再代表单一 runtime 的 single-parent 违规。

## Step 1 — Add profile RED tests
- Start time: 2026-03-30 14:32:00 +0800
- End time: 2026-03-30 14:32:20 +0800
- Branch: `dev_0263-mounting-remediation`
- Commits:
  - N/A
- Commands executed:
  - `apply_patch scripts/tests/test_0263_model_mounting_profiles.mjs`
  - `node scripts/tests/test_0263_model_mounting_profiles.mjs`
- Key outputs (snippets):
  - initial RED: `analyzer must expose profile audits`
- Result: PASS

## Step 2 — Remediate hierarchy declarations
- Start time: 2026-03-30 14:32:20 +0800
- End time: 2026-03-30 14:40:30 +0800
- Branch: `dev_0263-mounting-remediation`
- Commits:
  - N/A
- Commands executed:
  - `apply_patch packages/worker-base/system-models/runtime_hierarchy_mounts.json`
  - `apply_patch packages/ui-model-demo-server/server.mjs`
  - `apply_patch packages/ui-model-demo-frontend/src/demo_modeltable.js`
  - `apply_patch packages/worker-base/system-models/workspace_catalog_ui.json`
  - `apply_patch deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json`
  - `apply_patch deploy/sys-v1ns/ui-side-worker/patches/00_ui_side_worker_config.json`
  - `apply_patch deploy/sys-v1ns/mbr/patches/mbr_role_v0.json`
  - `apply_patch packages/worker-base/system-models/test_model_100_ui.json`
  - `apply_patch packages/worker-base/src/runtime.mjs`
- Key outputs (snippets):
  - 新增 `runtime_hierarchy_mounts.json`，将 ui-server/local demo 的正式父链集中到 `Model 0`
  - `workspace_catalog_ui.json` 移除了 11 条把 `-25` 作为正式父挂载宿主的 `model.submt`
  - `remote-worker` / `ui-side-worker` / `mbr-worker` 各自补了 `0 -> -10` 挂载
  - runtime 补齐了新式 `model.submt` (`k=model_type`, `v=<childId>`) 的 child id 解析与 `parentChildMap` 注册/解除
- Result: PASS

## Step 3 — Update Workspace mount resolution
- Start time: 2026-03-30 14:40:30 +0800
- End time: 2026-03-30 14:41:20 +0800
- Branch: `dev_0263-mounting-remediation`
- Commits:
  - N/A
- Commands executed:
  - `apply_patch packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
  - `apply_patch scripts/tests/test_0201_route_local_ast_contract.mjs`
  - `apply_patch scripts/tests/test_0214_sliding_flow_ui_contract.mjs`
- Key outputs (snippets):
  - `deriveWorkspaceSelected` 不再只读 `-25`，改为扫描全局 hierarchy 中的 `model.submt/submt`
  - Workspace route 在 `ws_app_selected=100` 时重新恢复 selected app AST，而不是 `ws_not_mounted`
- Result: PASS

## Step 4 — Rework analyzer/viz to profile audits
- Start time: 2026-03-30 14:41:20 +0800
- End time: 2026-03-30 14:44:30 +0800
- Branch: `dev_0263-mounting-remediation`
- Commits:
  - N/A
- Commands executed:
  - `apply_patch scripts/ops/model_mounting_analyzer.mjs`
  - `apply_patch scripts/tests/test_0262_model_mounting_analyzer.mjs`
  - `apply_patch viz-model-mounting.html`
  - `node scripts/ops/model_mounting_analyzer.mjs --write-viz`
  - `python3 -m http.server 8766`
  - Playwright MCP open `http://127.0.0.1:8766/viz-model-mounting.html`
- Key outputs (snippets):
  - analyzer 输出 profile:
    - `ui-server`
    - `remote-worker`
    - `ui-side-worker`
    - `mbr-worker`
  - `viz-model-mounting.html` 默认显示 profile buttons，而不是 scope 混算
  - 浏览器页面显示：
    - `ui-server · unmounted=0 · dup=0`
    - `remote-worker · unmounted=0 · dup=0`
    - `ui-side-worker · unmounted=0 · dup=0`
    - `mbr-worker · unmounted=0 · dup=0`
- Result: PASS

## Step 5 — Run focused regression
- Start time: 2026-03-30 14:44:30 +0800
- End time: 2026-03-30 14:45:30 +0800
- Branch: `dev_0263-mounting-remediation`
- Commits:
  - N/A
- Commands executed:
  - `node scripts/tests/test_0262_model_mounting_analyzer.mjs`
  - `node scripts/tests/test_0263_model_mounting_profiles.mjs`
  - `node scripts/tests/test_0182_model100_submit_chain_contract.mjs`
  - `node scripts/tests/test_0201_route_local_ast_contract.mjs`
  - `node scripts/tests/test_0214_sliding_flow_ui_contract.mjs`
  - `node scripts/tests/test_0144_remote_worker.mjs`
  - `node scripts/tests/test_0211_ui_bootstrap_and_submodel_migration.mjs`
  - `node scripts/tests/test_0213_matrix_debug_surface_contract.mjs`
  - `node scripts/tests/test_0215_ui_model_tier2_examples_contract.mjs`
  - `node scripts/tests/test_0216_threejs_scene_contract.mjs`
  - `node scripts/ops/model_mounting_analyzer.mjs`
- Key outputs (snippets):
  - `PASS test_0262_model_mounting_analyzer`
  - `PASS test_0263_model_mounting_profiles`
  - `PASS test_0182_model100_submit_chain_contract`
  - `4 passed, 0 failed out of 4` (`test_0201_route_local_ast_contract`)
  - `7 passed, 0 failed out of 7` (`test_0214_sliding_flow_ui_contract`)
  - `7 passed, 0 failed out of 7` (`test_0144_remote_worker`)
  - analyzer summary:
    - `ui-server_unmounted=0`
    - `ui-server_duplicates=0`
    - `remote-worker_unmounted=0`
    - `remote-worker_duplicates=0`
    - `ui-side-worker_unmounted=0`
    - `ui-side-worker_duplicates=0`
    - `mbr-worker_unmounted=0`
    - `mbr-worker_duplicates=0`
- Result: PASS

## Final Audit Outcome
- 所有 software worker profile 已归零：
  - `ui-server`: 0 unmounted / 0 duplicate
  - `remote-worker`: 0 unmounted / 0 duplicate
  - `ui-side-worker`: 0 unmounted / 0 duplicate
  - `mbr-worker`: 0 unmounted / 0 duplicate
- `canonical` 聚合视图仍显示 `duplicate=3`，其含义已降级为“跨 profile 重复声明”，不再代表单一 runtime 内的 single-parent 违规。
