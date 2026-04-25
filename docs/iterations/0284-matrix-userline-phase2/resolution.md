---
title: "0284 — matrix-userline-phase2 Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0284-matrix-userline-phase2
id: 0284-matrix-userline-phase2
phase: phase1
---

# 0284 — matrix-userline-phase2 Resolution

## Execution Strategy

- 本 iteration 进入 Phase 3，按已批准的第二阶段合同做最小实现。
- 实现目标只覆盖：
  - 在 `1016-1019` 之上补 `1020/1021`
  - 把单会话页扩成共享聊天骨架
  - 保持方案 A 下当前房间的一发一收
  - 让成员面板和房间切换在 Workspace 页面真实可用
- 不扩成完整聊天产品，不提前进入 `0285/0286`。
- 实施顺序固定为：
  1. 落地 `1020/1021` 与第二阶段 truth/state 分工
  2. 扩展 `1016` 页面为房间列表 / 时间线 / 输入框 / 成员面板
  3. 更新 `1019` 本地/远端处理，保证切房间和当前房间回包成立
  4. 补齐 contract tests 与用户文档
  5. 本地 deploy + 浏览器验收

## Step 1

- Scope:
  - 基于 `0283`，新增 `1020/1021`
  - 固定 `1020` 为当前房间成员真值
  - 固定 `1021` 为聊天 UI-only state
- Files:
  - `packages/ui-model-demo-frontend/src/model_ids.js`
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `scripts/tests/test_0284_matrix_userline_phase2_contract.mjs`
- Verification:
  - `1020` 必须拥有：
    - `room_members_json`
    - `active_members_json`
    - `active_members_summary`
  - `1021` 必须拥有：
    - `composer_draft`
    - `member_panel_open`
    - `selected_room_id`
  - 消息真值仍留在 `1019`
- Acceptance:
  - 第二阶段新增模型职责已在 patch 中固定
- Rollback:
  - 回退模型常量、patch 与测试

## Step 2

- Scope:
  - 将 `1016` 从单会话样例页扩为共享聊天骨架
  - 明确房间列表、timeline、输入框、成员面板的位置与关系
- Files:
  - `packages/worker-base/system-models/workspace_positive_models.json`
- Verification:
  - Workspace 页面必须出现：
    - `2. Rooms`
    - `3. Timeline`
    - `4. Members`
  - `matrix_phase2_composer_input` 必须绑定到 `1021.composer_draft`
  - 至少存在一间 `dm` 和一间 `group` 房间
- Acceptance:
  - 共享聊天骨架可从 Workspace 真页面打开
- Rollback:
  - 回退页面 patch

## Step 3

- Scope:
  - 更新 `1019` 和 remote `12_model1019.json`
  - 保证房间切换、当前房间 timeline 和成员摘要同步
  - 保持当前房间走方案 A 一发一收
- Files:
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `deploy/sys-v1ns/remote-worker/patches/12_model1019.json`
  - `scripts/tests/test_0284_matrix_userline_phase2_server_flow.mjs`
- Verification:
  - 点击房间按钮后：
    - `active_room_id` 必须切换
    - `timeline_text` 必须切换
    - `active_members_summary` 必须切换
  - 发送消息时：
    - payload 仍用 `pin_payload`
    - 当前房间 id 必须进入 payload
    - `composer_draft` 必须作为当前输入源
- Acceptance:
  - 第二阶段当前房间链路与成员真值成立
- Rollback:
  - 回退 `1019` / remote patch / 测试

## Step 4

- Scope:
  - 补 contract tests 和用户文档
  - 让 Phase 2 完成态可被后续直接复用
- Files:
  - `scripts/tests/test_0284_matrix_userline_phase2_contract.mjs`
  - `scripts/tests/test_0284_matrix_userline_phase2_server_flow.mjs`
  - `docs/user-guide/matrix_userline_phase2.md`
  - `docs/user-guide/README.md`
- Verification:
  - 新增 `0284` 测试必须先红后绿
  - 用户文档必须能说明：
    - `1016-1021` 的职责
    - 房间切换与成员面板怎么看
    - 当前一发一收如何验证
- Acceptance:
  - 第二阶段行为、测试、用户入口三者一致
- Rollback:
  - 回退测试与用户文档

## Step 5

- Scope:
  - 本地 redeploy
  - 浏览器验证：
    - 打开 `0284 Matrix Chat Phase 2`
    - 切换 `dm/group`
    - 在当前房间发一条、收一条
    - 查看成员面板
  - 回归：
    - `0270`
    - `Model 100`
    - `Static`
- Files:
  - `docs/iterations/0284-matrix-userline-phase2/runlog.md`
  - `docs/ITERATIONS.md`
- Verification:
  - `bash scripts/ops/check_runtime_baseline.sh`
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - 真浏览器点击验证当前房间与回归页面
- Acceptance:
  - 第二阶段页面本地可运行，且未带坏既有主路径
- Rollback:
  - 回退功能 patch / 测试 / 文档并重新 deploy 本地基线
