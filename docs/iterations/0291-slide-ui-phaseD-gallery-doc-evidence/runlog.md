---
title: "0291 — slide-ui-phaseD-gallery-doc-evidence Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0291-slide-ui-phaseD-gallery-doc-evidence
id: 0291-slide-ui-phaseD-gallery-doc-evidence
phase: phase3
---

# 0291 — slide-ui-phaseD-gallery-doc-evidence Runlog

## Environment

- Date: `2026-04-06`
- Branch: `dev_0291-slide-ui-phaseD-gallery-doc-evidence`
- Runtime: docs-only planning

## Planning Record

### Record 1

- Inputs reviewed:
  - [[docs/iterations/0287-slide-ui-mainline-split/plan]]
  - [[docs/iterations/0288-slide-ui-phaseA-topology-freeze/plan]]
  - [[docs/iterations/0289-slide-ui-phaseB-workspace-generalization/plan]]
  - [[docs/iterations/0290-slide-ui-phaseC-filltable-create-mount/plan]]
  - [[docs/user-guide/README]]
- Locked conclusions:
  - `0291` 只处理 Gallery / 文档 / 取证收口
  - 不重开拓扑、主线通用化、用户创建路径
  - 使用说明文档应逐步进入 UI 模型主线

## Docs Updated

- [x] `docs/iterations/0287-slide-ui-mainline-split/plan.md` reviewed
- [x] `docs/iterations/0288-slide-ui-phaseA-topology-freeze/plan.md` reviewed
- [x] `docs/iterations/0289-slide-ui-phaseB-workspace-generalization/plan.md` reviewed
- [x] `docs/iterations/0290-slide-ui-phaseC-filltable-create-mount/plan.md` reviewed
- [x] `docs/user-guide/README.md` reviewed
- [ ] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed

## Review Gate Record

### Review 1 — AI-assisted

- Iteration ID: `0291-slide-ui-phaseD-gallery-doc-evidence`
- Review Date: `2026-04-06`
- Review Type: `AI-assisted`
- Review Index: `1`
- Decision: **Approved**
- Notes:
  - 未发现阻塞项。
  - Phase D 已把 Gallery 展示、使用文档结构、本地/远端证据清单和 UI 模型化评估范围切清楚，且没有重开前 3 个阶段的核心合同。

## Execution Start Record

### 2026-04-09

- Execution start:
  - `0291` 从 docs-only 计划进入 Phase 3
  - 当前目标不是再扩 Slide UI 能力，而是把 `0288-0290` 的能力收成：
    - Gallery 正式展示面
    - 主文档
    - 本地 / 远端证据 runbook
- done-criteria:
  - Gallery 中存在正式的 Slide UI showcase
  - Showcase 能读到当前 slide 主线状态
  - 本地浏览器能从 Gallery 跳到 Workspace，并继续跑 creator create/edit/delete
  - 远端 cloud 已跑到 `0291` 代码，并有公网浏览器证据

## Execution Record

### 2026-04-09 — Step 1 Gallery Showcase

**Implemented**
- Gallery 新增 `0291 Slide UI Mainline Showcase`
- Showcase 直接投影当前主线状态：
  - slide app 计数
  - slide-capable app 列表
  - creator 当前状态
  - 最近一次创建结果
- `gallery_store` 正式暴露 `slideMainline` 合同：
  - `100`
  - `1030/1031`
  - `1034/1035`
  - actions = `slide_app_import` / `slide_app_create`

### 2026-04-09 — Step 2 Docs / Runbook

**Implemented**
- 新增主文档：
  - `docs/user-guide/slide_ui_mainline_guide.md`
- 新增证据 runbook：
  - `docs/user-guide/slide_ui_evidence_runbook.md`
- `docs/user-guide/README.md` 已收录这两页

### 2026-04-09 — Step 3 Tests / Regression

**Deterministic tests**
- `node scripts/tests/test_0291_slide_gallery_doc_evidence_contract.mjs` → PASS
- `node scripts/tests/test_0291_slide_gallery_doc_evidence_server_flow.mjs` → PASS
- `node scripts/tests/test_0217_gallery_extension_contract.mjs` → PASS
- `node scripts/tests/test_0289_slide_workspace_generalization_contract.mjs` → PASS
- `node scripts/tests/test_0289_slide_workspace_generalization_server_flow.mjs` → PASS
- `node scripts/tests/test_0290_slide_app_filltable_create_contract.mjs` → PASS
- `node scripts/tests/test_0290_slide_app_filltable_create_server_flow.mjs` → PASS
- `node scripts/tests/test_0302_slide_app_zip_import_contract.mjs` → PASS
- `node scripts/tests/test_0302_slide_app_zip_import_server_flow.mjs` → PASS

### 2026-04-09 — Step 4 Local Deploy + Browser Evidence

**Deploy**
- `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh` → PASS
- `bash scripts/ops/check_runtime_baseline.sh` → PASS

**Browser facts**
- 本地 `http://127.0.0.1:30900/#/gallery` 可见：
  - `0291 Slide UI Mainline Showcase`
- Showcase 中 `Open Workspace` 已可跳到：
  - `http://127.0.0.1:30900/#/workspace`
- 本地 Workspace 中确认：
  - `滑动 APP 导入`
  - `滑动 APP 创建`
  均存在
- 本地创建样例：
  - app name = `PhaseD Local App`
  - source worker = `phaseD-local`
  - headline = `PhaseD Local Headline`
  - body text = `PhaseD local body`
- 创建后：
  - 侧边栏新增 `PhaseD Local App`
  - 当前页自动切到该 app
  - 正文改成 `PhaseD local body edited` 后，预览同步变化
- 删除后：
  - `PhaseD Local App` 从 Workspace 消失

### 2026-04-09 — Step 5 Cloud Revision + Remote Evidence

**Remote preflight**
- 直接执行：
  - `ssh drop@124.71.43.80 'sudo -n bash /home/wwpic/dongyuapp/scripts/ops/remote_preflight_guard.sh'`
  - FAIL: `kubectl cannot reach cluster`
- 复核后按当前 cloud 口径补齐 root/rke2 kubeconfig：
  - `ssh drop@124.71.43.80 'sudo -n env KUBECONFIG=/etc/rancher/rke2/rke2.yaml bash /home/wwpic/dongyuapp/scripts/ops/remote_preflight_guard.sh'`
  - PASS

**Remote source sync**
- `bash scripts/ops/sync_cloud_source.sh --ssh-user drop --ssh-host 124.71.43.80 --remote-repo /home/wwpic/dongyuapp --remote-repo-owner wwpic --revision ea1fd47` → PASS
- remote repo revision = `ea1fd47`

**Remote deploy path used**
- 先尝试 canonical full rebuild：
  - `ssh drop@124.71.43.80 'sudo -n env KUBECONFIG=/etc/rancher/rke2/rke2.yaml bash /home/wwpic/dongyuapp/scripts/ops/deploy_cloud_full.sh --rebuild'`
- 事实：
  - 远端在重建未改动的 worker 镜像时，apt mirror 持续过慢
  - 本轮代码只改 `ui-server` 面（frontend bundle + server projection）
- 因此切到最小 cloud rollout：
  1. 本地 build `ui-server` tar
  2. 上传 `/tmp/dy-ui-server-ea1fd47.tar`
  3. 远端执行：
     - `ctr --address /run/k3s/containerd/containerd.sock -n k8s.io images import /tmp/dy-ui-server-ea1fd47.tar`
     - `kubectl -n dongyu rollout restart deployment/ui-server`
     - `kubectl -n dongyu rollout status deployment/ui-server --timeout=180s`
  4. rollout → PASS

**Remote source hash verification**
- remote pod = `ui-server-84bf98bfbc-jbxvp`
- pod 内源码 SHA256 与本地一致：
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
  - `packages/ui-model-demo-frontend/src/demo_app.js`
  - `packages/ui-model-demo-frontend/src/gallery_store.js`

**Remote browser facts**
- 公网 `https://app.dongyudigital.com/#/gallery` 可见：
  - `0291 Slide UI Mainline Showcase`
- Showcase 的 `Open Workspace` 已可跳到：
  - `https://app.dongyudigital.com/#/workspace`
- 公网 Workspace 中确认：
  - `滑动 APP 导入`
  - `滑动 APP 创建`
  均存在
- 远端创建样例：
  - app name = `PhaseD Remote App`
  - source worker = `phaseD-remote`
  - headline = `PhaseD Remote Headline`
  - body text = `PhaseD remote body`
- 创建后：
  - 侧边栏新增 `PhaseD Remote App`
  - 当前页自动切到该 app
  - 正文改成 `PhaseD remote body edited` 后，预览同步变化
- 删除后：
  - `PhaseD Remote App` 从 Workspace 消失

### Review 2 — AI Self-Verification

- Iteration ID: `0291-slide-ui-phaseD-gallery-doc-evidence`
- Review Date: `2026-04-09`
- Review Type: `AI-assisted`
- Review Index: `2`
- Decision: **Approved**
- Notes:
  - Gallery、主文档、证据 runbook、本地浏览器、远端浏览器五条线都已闭合
  - 本轮没有扩新能力，只把 `0288-0290` 的成果收成正式资产

## Docs Updated

- [x] `docs/user-guide/slide_ui_mainline_guide.md` created
- [x] `docs/user-guide/slide_ui_evidence_runbook.md` created
- [x] `docs/user-guide/README.md` updated
- [x] `docs/iterations/0291-slide-ui-phaseD-gallery-doc-evidence/resolution.md` updated
- [x] `docs/iterations/0291-slide-ui-phaseD-gallery-doc-evidence/runlog.md` updated
