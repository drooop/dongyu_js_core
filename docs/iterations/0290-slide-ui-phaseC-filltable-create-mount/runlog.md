---
title: "0290 — slide-ui-phaseC-filltable-create-mount Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0290-slide-ui-phaseC-filltable-create-mount
id: 0290-slide-ui-phaseC-filltable-create-mount
phase: phase3
---

# 0290 — slide-ui-phaseC-filltable-create-mount Runlog

## Environment

- Date: `2026-04-06`
- Branch: `dev_0290-slide-ui-phaseC-filltable-create-mount`
- Runtime: docs-only planning

## Planning Record

### Record 1

- Inputs reviewed:
  - [[docs/iterations/0287-slide-ui-mainline-split/plan]]
  - [[docs/iterations/0288-slide-ui-phaseA-topology-freeze/plan]]
  - [[docs/iterations/0289-slide-ui-phaseB-workspace-generalization/plan]]
  - [[docs/user-guide/workspace_ui_filltable_example]]
- Locked conclusions:
  - `0290` 只处理用户创建与挂载路径
  - 不提前进入 Gallery / 文档 / 取证收口
  - 不重开 Phase A/B 系统主线合同

## Docs Updated

- [x] `docs/iterations/0287-slide-ui-mainline-split/plan.md` reviewed
- [x] `docs/iterations/0288-slide-ui-phaseA-topology-freeze/plan.md` reviewed
- [x] `docs/iterations/0289-slide-ui-phaseB-workspace-generalization/plan.md` reviewed
- [x] `docs/user-guide/workspace_ui_filltable_example.md` reviewed
- [ ] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed

## Review Gate Record

### Review 1 — AI-assisted

- Iteration ID: `0290-slide-ui-phaseC-filltable-create-mount`
- Review Date: `2026-04-06`
- Review Type: `AI-assisted`
- Review Index: `1`
- Decision: **Approved**
- Notes:
  - 未发现阻塞项。
  - Phase C 已把用户通过填表创建 host/truth、填写 metadata、声明 registry/mount 和验证挂载成功的路径收口清楚，且没有提前进入 Gallery/文档收口。

## Execution Start Record

### 2026-04-08

- Execution start:
  - `0290` 从 docs-only 计划进入 Phase 3
  - 当前目标是把“用户通过填表创建 slide app”做成 Workspace 里的正式入口
  - 新入口必须与 `0302` 共用同一套临时模型表 payload/materialize 合同，而不是再发明第三套安装协议
- done-criteria:
  - Workspace 中存在内置 `滑动 APP 创建`
  - 用户可填字段并创建新 slide app
  - 新 app 自动挂到 Workspace、自动选中、可打开、可删除
  - 新 app 与 `0289/0302` 既有主线合同兼容
  - 文档、Living Docs、deploy、浏览器验收全部完成

## Execution Record

### 2026-04-08 — Step 1 Creator App / Truth / Action Route

**Implemented**
- 新增内置 creator app / truth：
  - `1034` = `滑动 APP 创建`
  - `1035` = creator truth
- `1034` 挂到 `Model 0`
- `1034 (0,2,0)` 挂 `1035`
- creator truth 当前持有：
  - `create_app_name`
  - `create_source_worker`
  - `create_slide_surface_type`
  - `create_headline`
  - `create_body_text`
  - `create_status`
  - `create_last_app_id`
  - `create_last_app_name`
  - `create_last_truth_id`
- 创建按钮动作已接到 mailbox：
  - `slide_app_create -> handle_slide_app_create`

**Deterministic tests**
- `node scripts/tests/test_0290_slide_app_filltable_create_contract.mjs` → PASS

### 2026-04-08 — Step 2 Shared Payload / Materialize Path

**Implemented**
- server 侧新增 filltable create helper：
  - 从 `1035` 读取字段
  - 生成临时模型表数组 payload
  - 复用 `0302` 现有 `validateSlideImportPayload`
  - 复用 `0302` 现有 `materializeSlideImportPayload`
- 当前 v1 只允许创建：
  - `slide_surface_type = workspace.page`
- 创建出的 app 自动具备：
  - `slide_capable=true`
  - `slide_surface_type=workspace.page`
  - `from_user=local_filltable`
  - `to_user=workspace_local`
  - `deletable=true`
  - `installed_at=<created timestamp>`
- 创建后会：
  - 自动挂到 Workspace registry
  - 自动切成当前选中 app
  - 共享 `0302` 相同的单调递增 model_id 分配规则

**Deterministic tests**
- `node scripts/tests/test_0290_slide_app_filltable_create_server_flow.mjs` → PASS

### 2026-04-08 — Step 3 Regression Sweep

**Deterministic tests**
- `node scripts/tests/test_0290_slide_app_filltable_create_contract.mjs` → PASS
- `node scripts/tests/test_0290_slide_app_filltable_create_server_flow.mjs` → PASS
- `node scripts/tests/test_0289_slide_workspace_generalization_contract.mjs` → PASS
- `node scripts/tests/test_0289_slide_workspace_generalization_server_flow.mjs` → PASS
- `node scripts/tests/test_0302_slide_app_zip_import_contract.mjs` → PASS
- `node scripts/tests/test_0302_slide_app_zip_import_server_flow.mjs` → PASS
- `node scripts/tests/test_0284_matrix_userline_phase2_contract.mjs` → PASS
- `node scripts/tests/test_0284_matrix_userline_phase2_server_flow.mjs` → PASS

**Fixes discovered during live verification**
- 初次 deploy + 浏览器检查发现：
  - 旧运行环境里 `0302` 首次导入 app 已占用 `1032/1033`
  - creator 复用这组保留 id，导致侧边栏显示冲突
- 已修复为：
  - creator 保留模型改到 `1034/1035`
  - `test_0290_slide_app_filltable_create_contract.mjs` 新增 guard：
    - `creator_reserved_ids_do_not_overlap_first_zip_import_range`
- 第二次 deploy + 浏览器检查继续发现：
  - 旧运行环境里首次导入 app 已占用 `Model 0 (2,0,14)` 挂载槽
  - creator 复用这个静态挂载槽，导致“侧边栏可见但右侧打不开”
- 已修复为：
  - creator 静态挂载槽改到 `Model 0 (2,0,15)`
  - `test_0290_slide_app_filltable_create_contract.mjs` 新增 guard：
    - `slide_creator_mount_must_avoid_legacy_first_import_slot`

### 2026-04-08 — Step 4 Living Docs / Deploy / Browser Verification

**Living Docs review**
- `docs/ssot/runtime_semantics_modeltable_driven.md`
  - updated：补齐 slide-capable app 准入与 `slide_surface_type` 枚举
- `docs/user-guide/modeltable_user_guide.md`
  - updated：补齐 `1030-1035` 保留模型与当前 surface enum
- `docs/ssot/label_type_registry.md`
  - reviewed, no change：本轮没有新增 `label.t`
- `docs/handover/dam-worker-guide.md`
  - reviewed, no change：本轮不涉及 DAM worker owner-chain 变更

**Deploy**
- `bash scripts/ops/check_runtime_baseline.sh` → initial FAIL（deploy 前本地服务未 ready）
- `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh` → PASS
- `bash scripts/ops/check_runtime_baseline.sh` → PASS

**Browser facts**
- Workspace 侧边栏中同时出现：
  - `E2E 颜色生成器`
  - `滑动 APP 导入`
  - `滑动 APP 创建`
- 打开 `滑动 APP 创建` 后，可填写：
  - app name
  - source worker
  - surface type
  - headline
  - body text
- 点击 `创建 Slide App` 后：
  - 侧边栏新增创建出来的 app
  - 当前选中自动切到新 app
  - 打开后可在新 app 输入框继续编辑
  - 文本预览同步变化
- 浏览器实测创建样例：
  - app name = `Filltable Browser App`
  - source worker = `filltable-browser`
  - headline = `Browser Created Headline`
  - body text = `Browser created body text`
- 在创建出的 app 中继续把正文改成：
  - `Browser edited body`
  - 右侧预览同步显示 `Browser edited body`
- 点击侧边栏 `Delete` 后：
  - 创建出来的 app 从 Workspace 消失

### Review 2 — AI Self-Verification

- Iteration ID: `0290-slide-ui-phaseC-filltable-create-mount`
- Review Date: `2026-04-08`
- Review Type: `AI-assisted`
- Review Index: `2`
- Decision: **Approved**
- Notes:
  - `0290` 已从 docs-only planning 变成真实入口
  - 新入口与 `0302` 共用同一套 payload/materialize 合同
  - 范围仍然守在 “用户创建并挂载 workspace.page slide app” 这一刀，没有提前进入 Gallery / metrics 真发包

## Docs Updated

- [x] `docs/iterations/0290-slide-ui-phaseC-filltable-create-mount/resolution.md` updated
- [x] `docs/iterations/0290-slide-ui-phaseC-filltable-create-mount/runlog.md` updated
- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` updated
- [x] `docs/user-guide/modeltable_user_guide.md` updated
- [x] `docs/user-guide/slide_app_filltable_create_v1.md` created
- [x] `docs/user-guide/README.md` updated
