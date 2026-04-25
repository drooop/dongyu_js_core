---
title: "0290 — slide-ui-phaseC-filltable-create-mount Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0290-slide-ui-phaseC-filltable-create-mount
id: 0290-slide-ui-phaseC-filltable-create-mount
phase: phase1
---

# 0290 — slide-ui-phaseC-filltable-create-mount Resolution

## Execution Strategy

- 本 iteration 进入 Phase 3，按已批准的 Phase C 合同做最小实现。
- 目标是把“用户通过填表创建并挂载 slide app”变成真实入口，而不再只是 docs-only 计划。
- 实现目标只覆盖：
  - 内置 creator app / truth 的正式入口
  - 用户填写最小字段后生成 slide-capable app
  - 新 app 自动挂到 Workspace、自动选中、可删除
  - 与 `0302` zip 导入共用同一套临时模型表 payload 合同
- 不进入 Gallery 收口，不进入远端 metrics 真发包链路，不开放 `workspace.page` 之外的新 surface type。
- 实施顺序固定为：
  1. 落地 creator app / truth 与 `slide_app_create` 动作
  2. 复用 `0302` payload/materialize 逻辑生成新 slide app
  3. 补 contract + server_flow 测试并回归 `0289/0302/0284`
  4. 补用户文档、Living Docs、deploy 与浏览器验收

## Step 1

- Scope:
  - 增加内置 filltable creator app / truth，并把创建动作接到 mailbox 主线
- Files:
  - `packages/ui-model-demo-frontend/src/model_ids.js`
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `packages/worker-base/system-models/runtime_hierarchy_mounts.json`
  - `packages/worker-base/system-models/intent_dispatch_config.json`
  - `packages/worker-base/system-models/intent_handlers_slide_create.json`
  - `scripts/tests/test_0290_slide_app_filltable_create_contract.mjs`
- Verification:
  - `1034` / `1035` 必须显式存在
  - `1034` 必须挂到 `Model 0`
  - `1034` 必须通过 `model.submt` 挂 `1035`
  - 创建按钮必须走 `slide_app_create`
- Acceptance:
  - Workspace 内存在一个正式的“滑动 APP 创建”入口
- Rollback:
  - 回退 creator models、dispatch route 与 contract test

## Step 2

- Scope:
  - 用 creator truth 中的字段生成 slide-capable app，并挂到 Workspace
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `scripts/tests/test_0290_slide_app_filltable_create_server_flow.mjs`
- Verification:
  - 新 app 必须沿用 `0302` 的临时模型表 payload 校验与 materialize 逻辑
  - 新 app root 必须带：
    - `app_name`
    - `source_worker`
    - `slide_capable=true`
    - `slide_surface_type=workspace.page`
    - `from_user`
    - `to_user`
  - 新 app truth 必须 materialize `headline` / `body_text`
  - 创建后必须自动进入 Workspace registry，并自动切为当前 app
- Acceptance:
  - 用户填表后能得到一个真实可打开的新 slide app
- Rollback:
  - 回退 server helper、host API 与 server_flow test

## Step 3

- Scope:
  - 补完整测试并回归现有 slide / matrix 主线
- Files:
  - `scripts/tests/test_0290_slide_app_filltable_create_contract.mjs`
  - `scripts/tests/test_0290_slide_app_filltable_create_server_flow.mjs`
- Verification:
  - `node scripts/tests/test_0290_slide_app_filltable_create_contract.mjs`
  - `node scripts/tests/test_0290_slide_app_filltable_create_server_flow.mjs`
  - `node scripts/tests/test_0289_slide_workspace_generalization_contract.mjs`
  - `node scripts/tests/test_0289_slide_workspace_generalization_server_flow.mjs`
  - `node scripts/tests/test_0302_slide_app_zip_import_contract.mjs`
  - `node scripts/tests/test_0302_slide_app_zip_import_server_flow.mjs`
  - `node scripts/tests/test_0284_matrix_userline_phase2_contract.mjs`
  - `node scripts/tests/test_0284_matrix_userline_phase2_server_flow.mjs`
- Acceptance:
  - 0290 新能力成立，且不打坏 0289/0302/0284
- Rollback:
  - 回退 0290 功能与测试改动

## Step 4

- Scope:
  - 补用户文档、Living Docs、deploy 与浏览器验收
- Files:
  - `docs/iterations/0290-slide-ui-phaseC-filltable-create-mount/runlog.md`
  - `docs/ssot/runtime_semantics_modeltable_driven.md`
  - `docs/user-guide/modeltable_user_guide.md`
  - `docs/user-guide/slide_app_filltable_create_v1.md`
  - `docs/user-guide/README.md`
- Verification:
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `node scripts/ops/obsidian_docs_audit.mjs --root docs`
  - 浏览器验证 creator app → create → open → edit → delete 全链路
- Acceptance:
  - `0290` 成为当前主线真实实现，并有现行文档可用
- Rollback:
  - 回退文档与 0290 功能改动，并重新 deploy
