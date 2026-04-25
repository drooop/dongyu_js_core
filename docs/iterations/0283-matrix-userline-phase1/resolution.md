---
title: "0283 — matrix-userline-phase1 Resolution"
doc_type: iteration-resolution
status: planned
updated: 2026-04-21
source: ai
iteration_id: 0283-matrix-userline-phase1
id: 0283-matrix-userline-phase1
phase: phase1
---

# 0283 — matrix-userline-phase1 Resolution

## Execution Strategy

- 本 iteration 进入 Phase 3，按已批准的第一阶段合同做最小实现。
- 实现目标只覆盖：
  - `1016-1019` 正数模型块落地
  - 最小登录/session 真值落地
  - 方案 A 下“一发一收”闭环落地
  - Workspace 可见入口 + 最小页面可用
- 不扩成完整聊天产品，不提前进入 `0284-0286`。
- 实施顺序固定为：
  1. 落地 `1016-1019` 模型块与 Workspace 挂载
  2. 落地 `1017` 最小登录/session 路径
  3. 落地 `1018/1019` 单会话消息闭环与 MBR/remote-worker 路由
  4. 补齐测试与文档
  5. 本地 deploy + 浏览器验收

## Step 1

- Scope:
  - 在正式 patch 中创建 `1016-1019`
  - 将 `1016` 挂到 Workspace
  - 将 `1017/1018/1019` 作为 `1016` 的 child truth block 固定下来
- Files:
  - `packages/ui-model-demo-frontend/src/model_ids.js`
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `packages/worker-base/system-models/runtime_hierarchy_mounts.json`
  - `scripts/tests/test_0283_matrix_userline_phase1_contract.mjs`
- Verification:
  - `1016` 出现在 Workspace registry / mount 链上
  - `1017/1018/1019` 不作为独立 sidebar app 暴露
  - `1016` 页面 AST 能从 cellwise patch 生成
- Acceptance:
  - 产品层模型放置与父子关系已在运行态固定
- Rollback:
  - 回退上述 patch / test

## Step 2

- Scope:
  - 在 `1017` 落地最小登录真值：
    - homeserver / username / password draft
    - authenticated / session_user_id / session_display_name / session_homeserver_url
    - session_status / login_error
  - 增加一个受控 host capability，用于产品层登录验证
- Files:
  - `packages/ui-model-demo-server/server.mjs`
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `scripts/tests/test_0283_matrix_userline_login_contract.mjs`
- Verification:
  - 失败测试先证明当前缺少 `1017` 登录闭环
  - 通过注入 login stub，可验证：
    - 登录成功后 `1017` 写入 session truth
    - 登录失败时写入错误状态
    - 不依赖前端独立 Matrix client
- Acceptance:
  - `1017` 已能独立承载最小登录/session 结果
- Rollback:
  - 回退 host capability、truth patch 与测试

## Step 3

- Scope:
  - 在 `1018/1019` 落地最小单会话 truth
  - 将 `1019` 接入方案 A：
    - `submit` 通过 MBR / `dy.bus.v0`
    - remote-worker 返回 `result`
  - 增加最小 remote echo handler
- Files:
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `packages/worker-base/system-models/system_models.json`
  - `deploy/sys-v1ns/mbr/patches/mbr_role_v0.json`
  - `deploy/sys-v1ns/remote-worker/patches/00_remote_worker_config.json`
  - `deploy/sys-v1ns/remote-worker/patches/12_model1019.json`
  - `scripts/tests/test_0283_matrix_userline_send_receive_contract.mjs`
- Verification:
  - 失败测试先证明 `1019` 还未进入 MBR / remote-worker 主链
  - 通过后必须能证明：
    - 发送 payload 走 `pin_payload`
    - `source_model_id=1019`
    - 返回 payload 通过 `result` 物化到 `1019`
- Acceptance:
  - “发一条、收一条”闭环成立
- Rollback:
  - 回退上述 patch / route / test

## Step 4

- Scope:
  - 让 `1016` Workspace 页面可见、可操作
  - 补齐最小 contract docs / user guide
  - 补齐 `0283` runlog 与 docs 更新评估
- Files:
  - `packages/worker-base/system-models/workspace_positive_models.json`
  - `docs/iterations/0283-matrix-userline-phase1/runlog.md`
  - `docs/ITERATIONS.md`
  - `docs/user-guide/README.md`
  - `docs/user-guide/matrix_userline_phase1.md`
- Verification:
  - Workspace 中能打开 `1016`
  - 用户文档能说明：
    - Phase 1 做了什么
    - 不做什么
    - 如何验证最小登录和单消息闭环
- Acceptance:
  - 第一阶段实现与文档边界一致
- Rollback:
  - 回退页面 patch 与文档

## Step 5

- Scope:
  - 本地 redeploy
  - 浏览器验证：
    - Workspace 入口可见
    - 登录成功
    - 单条消息发送与回显成功
  - 回归：
    - 颜色生成器
    - `0270`
    - `Static`
- Files:
  - `docs/iterations/0283-matrix-userline-phase1/runlog.md`
- Verification:
  - `bash scripts/ops/ensure_runtime_baseline.sh`
  - `SKIP_MATRIX_BOOTSTRAP=1 bash scripts/ops/deploy_local.sh`
  - `bash scripts/ops/check_runtime_baseline.sh`
  - 浏览器逐项验证最小 Matrix 页和现有主路径
- Acceptance:
  - 第一阶段最小产品线本地可运行，且未带坏既有主路径
- Rollback:
  - 回退功能代码与 patch，重新 deploy 本地基线
