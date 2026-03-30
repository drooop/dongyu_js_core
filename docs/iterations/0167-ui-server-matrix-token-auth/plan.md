---
title: "Iteration 0167-ui-server-matrix-token-auth Plan"
doc_type: iteration-plan
status: planned
updated: 2026-03-21
source: ai
iteration_id: 0167-ui-server-matrix-token-auth
id: 0167-ui-server-matrix-token-auth
phase: phase1
---

# Iteration 0167-ui-server-matrix-token-auth Plan

## Goal

- 修复远端 `ui-server` 启动时通过密码登录 Matrix 触发 `429 Too Many Requests`，导致 `ProgramModelEngine.matrixAdapter` 为空、浏览器侧提交退化为 `matrix_unavailable` 的问题。

## Scope

- In scope:
  - 记录并固化 `ui-server` 应使用 `drop` 用户 access token 的部署约束。
  - 为 deploy secret/manifest 增加 `MATRIX_MBR_ACCESS_TOKEN` 注入，并让 `ui-server` 优先走 token auth。
  - 复跑远端 deploy 与浏览器 smoke，确认颜色生成器恢复 `processed`。
- Out of scope:
  - 清理当前工作树中无关的 UI/renderer 脏改动。
  - 改动 `mbr-worker` 的 token 使用策略。

## Invariants / Constraints

- 必须先写失败测试，再改部署脚本/manifest。
- `ui-server` 继续使用 `drop` 用户身份，不回退到 `mbr` 用户。
- `ui-server` 环境中不恢复 `MATRIX_MBR_BOT_ACCESS_TOKEN`；如需 token，使用 `MATRIX_MBR_ACCESS_TOKEN` + `MATRIX_MBR_USER`。
- 改动必须最小化，只针对本次 `429 login` 根因。

## Success Criteria

- 代码侧有测试覆盖：deploy secret/manifest 为 `ui-server` 注入 `MATRIX_MBR_ACCESS_TOKEN`。
- 远端 `ui-server` 启动日志不再出现 `Matrix init failed ... 429`。
- 浏览器中颜色生成器提交后状态从 `loading` 进入 `processed`，不再落到 `matrix_unavailable`。

## Inputs

- Created at: 2026-03-06
- Iteration ID: 0167-ui-server-matrix-token-auth
