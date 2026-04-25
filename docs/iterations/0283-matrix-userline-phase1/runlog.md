---
title: "0283 — matrix-userline-phase1 Runlog"
doc_type: iteration-runlog
status: active
updated: 2026-04-21
source: ai
iteration_id: 0283-matrix-userline-phase1
id: 0283-matrix-userline-phase1
phase: phase3
---

# 0283 — matrix-userline-phase1 Runlog

## Environment

- Date: `2026-04-06`
- Branch: `dev_0283-matrix-userline-phase1`
- Runtime: local execution

## Planning Record

### Record 1

- Inputs reviewed:
  - [[docs/plans/2026-04-03-slide-matrix-three-current-baseline]]
  - [[docs/ssot/ui_to_matrix_event_flow]]
  - [[docs/user-guide/dual_worker_slide_e2e_v0]]
- Locked decisions applied:
  - Matrix 非加密在三条主线中排第一
  - 最小登录能力前置到第一阶段
  - 方案 A 固定
  - 所有加密能力后置
  - 第一阶段建议冻结 `1016-1019` 作为产品层模型块

## Docs Updated

- [x] `docs/plans/2026-04-03-slide-matrix-three-current-baseline.md` reviewed
- [x] `docs/WORKFLOW.md` reviewed
- [x] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [x] `docs/user-guide/modeltable_user_guide.md` reviewed (评估：本轮不改正文)
- [x] `docs/user-guide/matrix_userline_phase1.md` created
- [x] `docs/user-guide/README.md` updated

## Review Gate Record

### Review 1 — AI-assisted

- Iteration ID: `0283-matrix-userline-phase1`
- Review Date: `2026-04-05`
- Review Type: `AI-assisted`
- Review Index: `1`
- Decision: **Approved**
- Notes:
  - 未发现阻塞项。
  - 第一阶段已清楚冻结最小登录前置、方案 A 固定、聊天消息与 `mt.v0` patch 区分、以及加密后置。

## Execution Record

### Record 2

- Execution start:
  - 进入 Phase 3，实现 `1016-1019` 最小 Matrix 用户产品线
  - 执行前先把 `resolution.md` 从 docs-only 冻结稿补成可执行施工图
  - 当前 done-criteria：
    - Workspace 中出现 `1016` app
    - `1017` 完成最小登录/session truth
    - `1019` 通过 MBR / remote-worker 完成“一发一收”
    - 本地浏览器验证通过且不回归颜色生成器 / `0270` / `Static`

### 2026-04-06 — Step 1 Model Block / Mount

- Implemented:
  - `1016-1019` 正数模型块已落地到 `workspace_positive_models.json`
  - `1016` 已挂到 `runtime_hierarchy_mounts.json`
  - `model_ids.js` 已补齐 `1016-1019` 常量
- Deterministic tests:
  - `node scripts/tests/test_0283_matrix_userline_phase1_contract.mjs` → PASS

### 2026-04-06 — Step 2 Minimal Login / Session

- Implemented:
  - `server.mjs` 增加 `matrixUserLogin` host capability
  - `1017` 通过 `dual_bus_model.ui_event_func` 物化最小登录结果
  - 登录 homeserver 归一化：
    - `https://matrix.localhost` → `http://synapse.dongyu.svc.cluster.local:8008`
- Deterministic tests:
  - `node scripts/tests/test_0283_matrix_userline_login_contract.mjs` → PASS

### 2026-04-06 — Step 3 Single Send / Single Receive

- Implemented:
  - `1019` 发送路径固定为 `pin_payload` + `source_model_id=1019`
  - 新增 `deploy/sys-v1ns/remote-worker/patches/12_model1019.json`
  - 新增 `mbr_route_1019`
  - `mbr_mqtt_model_ids` 与 `remote_subscriptions` 已纳入 `1019`
  - 修复 authoritative asset 清单遗漏：
    - `scripts/ops/sync_local_persisted_assets.sh` 现已包含 `12_model1019.json`
- Deterministic tests:
  - `node scripts/tests/test_0283_matrix_userline_send_receive_contract.mjs` → PASS
  - `node scripts/tests/test_0144_remote_worker.mjs` → PASS
  - `node scripts/tests/test_0144_mbr_compat.mjs` → PASS

### 2026-04-06 — Step 4 Regression / Browser Verification

- Regression tests:
  - `node scripts/tests/test_0270_workspace_ui_filltable_remote_mode_contract.mjs` → PASS
  - `node scripts/tests/test_0272_static_workspace_contract.mjs` → PASS
  - `node scripts/tests/test_0276_doc_workspace_example_contract.mjs` → PASS
  - `bash scripts/ops/check_runtime_baseline.sh` → PASS
- Browser verification:
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh` → PASS
  - `0283 Matrix Chat Phase 1`
    - Workspace 可见新条目
    - 使用本地新注册用户 `phase1demo2 / Phase1Demo456` 登录成功
    - 页面状态显示 `authenticated`
    - 页面显示用户 id：`@phase1demo2:localhost`
    - 发送 `phase1 browser hello 3`
    - 页面状态显示 `remote_processed`
    - 页面显示回包：`echo: phase1 browser hello 3`
  - `0270`
    - 结果色值从 `#d44106` 变为 `#0e74da`
  - `Model 100`
    - 颜色值从 `#21bc67` 变为 `#070bd3`
  - `Static`
    - 页面仍可打开，上传项目表格仍可见

### Review 2 — AI Self-Verification

- Iteration ID: `0283-matrix-userline-phase1`
- Review Date: `2026-04-06`
- Review Type: `AI-assisted`
- Review Index: `2`
- Decision: **Approved**
- Notes:
  - `1016-1019` 模型块、最小登录、单条消息闭环、本地浏览器验证与回归抽测均已通过
  - 本轮未提前扩到 `0284-0286`
