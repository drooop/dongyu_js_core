---
title: "0291 — slide-ui-phaseD-gallery-doc-evidence Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0291-slide-ui-phaseD-gallery-doc-evidence
id: 0291-slide-ui-phaseD-gallery-doc-evidence
phase: phase1
---

# 0291 — slide-ui-phaseD-gallery-doc-evidence Resolution

## Execution Strategy

- 本 iteration 进入 Phase 3，按已批准的 Phase D 合同做最小收口实现。
- 实现目标只覆盖：
  - Gallery 中新增正式的 Slide UI showcase
  - 提供主文档和本地/远端证据 runbook
  - 用本地与远端浏览器事实证明 `0288-0290` 形成的主线已经可展示、可学习、可复验
- 不继续扩展 Slide UI 业务能力，不重开拓扑、主线通用化和用户创建合同。
- 实施顺序固定为：
  1. 落地 Gallery slide showcase 和派生状态
  2. 落地主文档与证据 runbook
  3. 补 contract/server-flow 测试并回归现有 slide/gallery 主线
  4. 本地 deploy + 浏览器取证
  5. cloud deploy + 远端浏览器取证

## Step 1

- Scope:
  - 在 Gallery 中加入正式的 Slide UI showcase
- Files:
  - `packages/worker-base/system-models/gallery_catalog_ui.json`
  - `packages/ui-model-demo-frontend/src/gallery_store.js`
  - `packages/ui-model-demo-frontend/src/editor_page_state_derivers.js`
  - `packages/ui-model-demo-frontend/src/demo_modeltable.js`
  - `packages/ui-model-demo-server/server.mjs`
- Verification:
  - Gallery 中必须存在 `0291 Slide UI Mainline Showcase`
  - showcase 必须能读到：
    - slide app 数量
    - 当前 slide 模型列表
    - creator 状态
    - 最近一次创建结果
- Acceptance:
  - Gallery 不再只是泛组件页，而有正式的 Slide UI 展示入口
- Rollback:
  - 回退 gallery patch 与派生状态逻辑

## Step 2

- Scope:
  - 补主文档与证据 runbook
- Files:
  - `docs/user-guide/slide_ui_mainline_guide.md`
  - `docs/user-guide/slide_ui_evidence_runbook.md`
  - `docs/user-guide/README.md`
- Verification:
  - README 必须收录两份新文档
  - 主文档必须说明 Gallery / Workspace / 细分页导航
  - evidence runbook 必须给出本地与远端入口和最小操作路径
- Acceptance:
  - Slide UI 收口资产有正式文档入口
- Rollback:
  - 回退新增 user-guide 文档

## Step 3

- Scope:
  - 补测试并守住既有 gallery/slide 合同
- Files:
  - `scripts/tests/test_0291_slide_gallery_doc_evidence_contract.mjs`
  - `scripts/tests/test_0291_slide_gallery_doc_evidence_server_flow.mjs`
  - `scripts/tests/test_0217_gallery_extension_contract.mjs`
- Verification:
  - `node scripts/tests/test_0291_slide_gallery_doc_evidence_contract.mjs`
  - `node scripts/tests/test_0291_slide_gallery_doc_evidence_server_flow.mjs`
  - `node scripts/tests/test_0217_gallery_extension_contract.mjs`
  - `node scripts/tests/test_0289_slide_workspace_generalization_contract.mjs`
  - `node scripts/tests/test_0289_slide_workspace_generalization_server_flow.mjs`
  - `node scripts/tests/test_0290_slide_app_filltable_create_contract.mjs`
  - `node scripts/tests/test_0290_slide_app_filltable_create_server_flow.mjs`
  - `node scripts/tests/test_0302_slide_app_zip_import_contract.mjs`
  - `node scripts/tests/test_0302_slide_app_zip_import_server_flow.mjs`
- Acceptance:
  - 0291 新资产成立，且不打坏 0217/0289/0290/0302
- Rollback:
  - 回退 0291 showcase/docs/tests 改动

## Step 4

- Scope:
  - 完成本地 deploy 与浏览器取证
- Files:
  - `docs/iterations/0291-slide-ui-phaseD-gallery-doc-evidence/runlog.md`
- Verification:
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - 浏览器验证：
    - `/#/gallery` 可见 Slide UI showcase
    - showcase 的 `Open Workspace` 可跳转
    - `/#/workspace` 可继续跑 creator create/edit/delete
- Acceptance:
  - 本地证据成立
- Rollback:
  - 回退功能并重新 deploy 本地

## Step 5

- Scope:
  - 完成 cloud deploy 与远端浏览器取证，并回写 closure 事实
- Files:
  - `docs/iterations/0291-slide-ui-phaseD-gallery-doc-evidence/runlog.md`
  - `docs/ITERATIONS.md`
- Verification:
  - `ssh drop@124.71.43.80 'sudo -n env KUBECONFIG=/etc/rancher/rke2/rke2.yaml bash /home/wwpic/dongyuapp/scripts/ops/remote_preflight_guard.sh'`
  - `bash scripts/ops/sync_cloud_source.sh --ssh-user drop --ssh-host 124.71.43.80 --remote-repo /home/wwpic/dongyuapp --remote-repo-owner wwpic --revision <rev>`
  - 首选：`ssh drop@124.71.43.80 'sudo -n env KUBECONFIG=/etc/rancher/rke2/rke2.yaml bash /home/wwpic/dongyuapp/scripts/ops/deploy_cloud_full.sh --rebuild'`
  - 若 canonical full rebuild 被远端 apt / mirror 问题阻塞，且本轮只改 `ui-server`，允许降级为：
    - 本地 build `ui-server` tar
    - 远端 `ctr images import /tmp/dy-ui-server-<rev>.tar`
    - `kubectl -n dongyu rollout restart deployment/ui-server`
    - `kubectl -n dongyu rollout status deployment/ui-server`
    - 远端 pod 内源码哈希必须与本地 revision 对齐
  - 远端浏览器验证：
    - `https://app.dongyudigital.com/#/gallery`
    - `https://app.dongyudigital.com/#/workspace`
- Acceptance:
  - 0291 正式收口，ITERATIONS 标记为 Completed
- Rollback:
  - 回退 cloud 到前一个已知 revision，或重新部署前一版 dev
