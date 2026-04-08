---
title: "0284 — matrix-userline-phase2 Runlog"
doc_type: iteration-runlog
status: completed
updated: 2026-04-08
source: ai
iteration_id: 0284-matrix-userline-phase2
id: 0284-matrix-userline-phase2
phase: phase4
---

# 0284 — matrix-userline-phase2 Runlog

## Environment

- Date: `2026-04-03`
- Branch: `dev_0284-matrix-userline-phase2`
- Runtime: docs-only planning

## Planning Record

### Record 1

- Inputs reviewed:
  - [[docs/iterations/0283-matrix-userline-phase1/plan]]
  - [[docs/plans/2026-04-03-slide-matrix-three-current-baseline]]
- Locked decisions inherited:
  - 方案 A 固定
  - 最小登录已前置到第一阶段
  - 第二阶段只做基础聊天 UI
  - 所有加密能力后置

## Docs Updated

- [x] `docs/plans/2026-04-03-slide-matrix-three-current-baseline.md` reviewed
- [x] `docs/iterations/0283-matrix-userline-phase1/plan.md` reviewed
- [ ] `docs/ssot/runtime_semantics_modeltable_driven.md` reviewed
- [ ] `docs/user-guide/modeltable_user_guide.md` reviewed

## Review Gate Record

### Review 1 — AI-assisted

- Iteration ID: `0284-matrix-userline-phase2`
- Review Date: `2026-04-05`
- Review Type: `AI-assisted`
- Review Index: `1`
- Decision: **Approved**
- Notes:
  - 未发现阻塞项。
  - 第二阶段范围收敛正确：共享私聊/群聊骨架、基础成员管理，不带注册、视频和加密。

## Execution Record

### 2026-04-08 — Step 1 Phase 2 Models

**Implemented**
- 在 `workspace_positive_models.json` 中新增：
  - `1020` = 当前房间成员真值
  - `1021` = 聊天 UI-only state
- `1016` 现已显式挂载 `1020/1021`
- `1018` 的 `rooms_json` 现已同时包含：
  - 一个 `dm`
  - 一个 `group`

**Deterministic tests**
- `node scripts/tests/test_0284_matrix_userline_phase2_contract.mjs` → PASS

### 2026-04-08 — Step 2 Shared Chat Shell

**Implemented**
- `1016` 页面现已扩为共享聊天骨架：
  - `2. Rooms`
  - `3. Timeline`
  - `4. Members`
- 输入框从 `1019.message_draft` 切到 `1021.composer_draft`
- 新增房间切换按钮与成员面板开关

**Deterministic tests**
- `node scripts/tests/test_0284_matrix_userline_phase2_contract.mjs` → PASS

### 2026-04-08 — Step 3 Room Switch + Current-Room Roundtrip

**Implemented**
- `prepare_matrix_phase1_send` 扩成 Phase 2 入口：
  - `select_room` 会同步 `1019` timeline 与 `1020` members
  - `submit` 仍走方案 A，并读取 `1021.composer_draft`
- `12_model1019.json` 远端真值现已补齐：
  - `room_timelines_json`
  - `timeline_json`
  - `timeline_text`
- 保持 `0283` 兼容：
  - 若没有可用的 `composer_draft`，仍回退到旧 `message_draft`
  - 若当前房间 id 不在 Phase 2 目录里，仍保留原 id 出站

**Deterministic tests**
- `node scripts/tests/test_0284_matrix_userline_phase2_server_flow.mjs` → PASS
- `node scripts/tests/test_0283_matrix_userline_send_receive_contract.mjs` → PASS

### 2026-04-08 — Step 4 Regression Sweep

**Deterministic tests**
- `node scripts/tests/test_0284_matrix_userline_phase2_contract.mjs` → PASS
- `node scripts/tests/test_0284_matrix_userline_phase2_server_flow.mjs` → PASS
- `node scripts/tests/test_0283_matrix_userline_phase1_contract.mjs` → PASS
- `node scripts/tests/test_0283_matrix_userline_login_contract.mjs` → PASS
- `node scripts/tests/test_0283_matrix_userline_send_receive_contract.mjs` → PASS
- `node scripts/tests/test_0270_workspace_ui_filltable_remote_mode_contract.mjs` → PASS
- `node scripts/tests/test_0272_static_workspace_contract.mjs` → PASS
- `node scripts/tests/test_0276_doc_workspace_example_contract.mjs` → PASS

### 2026-04-08 — Step 5 Local Deploy + Browser Verification

**Deploy**
- `bash scripts/ops/check_runtime_baseline.sh` → initial FAIL（deploy 前 `synapse` / `remote-worker` 未 ready）
- `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh` → PASS
- `bash scripts/ops/check_runtime_baseline.sh` → PASS

**Browser facts**
- `0284 Matrix Chat Phase 2`
  - Workspace 中可见并打开
  - 点击 `Open Team Room` 后：
    - 房间标题切到 `Phase 2 Team Room`
    - timeline 切到 group seed messages
    - members 切到 3 人摘要
  - 输入 `phase2 browser hello` 并点击 `Send Message` 后：
    - timeline 追加本地消息与 `echo: phase2 browser hello`
    - 状态保持 `remote_processed`
- `0270`
  - 输入 `0284 browser verify`
  - 点击 `Confirm`
  - 结果色值更新为 `#439ac7`
- `Model 100`
  - 点击 `Generate Color`
  - 颜色值更新为 `#ca5448`
- `Static`
  - Workspace 中 `Static` 页面可打开
  - `/p/it0294-static/` 直达页可访问

### Review 2 — AI Self-Verification

- Iteration ID: `0284-matrix-userline-phase2`
- Review Date: `2026-04-08`
- Review Type: `AI-assisted`
- Review Index: `2`
- Decision: **Approved**
- Notes:
  - 第二阶段已真实落地为共享聊天骨架，不再只是 docs-only 计划
  - `0283` 主链、`0270`、`Model 100`、`Static` 均未回归
  - fresh browser session 中仅剩 favicon 404 控制台噪音，未见新的业务异常

## Docs Updated

- [x] `docs/iterations/0284-matrix-userline-phase2/resolution.md` updated
- [x] `docs/iterations/0284-matrix-userline-phase2/runlog.md` updated
- [x] `docs/user-guide/matrix_userline_phase2.md` created
- [x] `docs/user-guide/README.md` updated
