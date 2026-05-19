---
title: "0385 - Matrix Suite Real Communication Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-05-20
source: ai
iteration_id: 0385-matrix-suite-real-comm
id: 0385-matrix-suite-real-comm
phase: completed
---

# Iteration 0385-matrix-suite-real-comm Resolution

## Execution Strategy

- 使用 TDD：先写失败的合同测试，证明当前 Matrix Suite 仍在本地模拟；再补最小真实 host capability 和程序模型调用。
- 将真实 Matrix side effect 收口在 UI Server host capability。前端仍只渲染 UI 模型并发 `bus_event_v2`。
- 本轮先打通基础 Matrix 文本/频道/文件能力的可测试合同；媒体类能力先改为诚实状态，后续单独实现真实 WebRTC / recording。

## Step 1

- Scope: 迭代登记、计划冻结、Review Gate。
- Files: `docs/ITERATIONS.md`、`docs/iterations/0385-matrix-suite-real-comm/*`。
- Verification: `rg -n "0385-matrix-suite-real-comm" docs/ITERATIONS.md docs/iterations/0385-matrix-suite-real-comm/*.md`。
- Acceptance: plan/resolution/runlog 有 frontmatter；runlog 记录用户批准进入执行。
- Rollback: 删除 0385 iteration 目录并移除 `docs/ITERATIONS.md` 登记行。

## Step 2

- Scope: RED tests，冻结真实通讯和诚实媒体状态合同。
- Files: `scripts/tests/test_0385_matrix_suite_real_comm_contract.mjs`。
- Verification: 新测试在现状下失败，失败原因指向缺少真实 host capability 或媒体假成功。
- Acceptance: 失败测试覆盖 login/send/edit/create/share-file/media-not-connected/no-direct-frontend-send。
- Rollback: 删除新增测试文件。

## Step 3

- Scope: UI Server host capability 增量。
- Files: `packages/ui-model-demo-server/server.mjs`。
- Verification: Step 2 测试中的 host capability 调用部分通过；现有 auth/media upload 测试不回归。
- Acceptance: 新能力只在服务端触发 Matrix side effect；不暴露 secret；失败返回结构化错误。
- Rollback: 回退 host capability 增量。

## Step 4

- Scope: Matrix Suite 模型表程序模型和 UI 状态调整。
- Files: `packages/worker-base/system-models/workspace_positive_models.json`，必要时同步生成来源或验证 fixture。
- Verification: Step 2 测试全部通过；`scripts/tests/test_0383_matrix_suite_slide_app_contract.mjs` 仍通过。
- Acceptance: 基础通讯动作调用真实 host capability；媒体按钮不再伪造成功；UI 文案明确能力状态。
- Rollback: 回退 Model 1080 相关 labels。

## Step 5

- Scope: 本地部署和真实浏览器验证。
- Files: local runtime/deployment state; evidence under `output/playwright/`.
- Verification: 先部署/重启本地 UI Server，再用 Playwright 打开 `http://127.0.0.1:30900/#/workspace`，验证 Matrix Suite 和颜色生成器。
- Acceptance: 浏览器可见 Matrix Suite 不再伪造媒体成功；基础 Matrix 动作在可用会话下成功或在未配置时明确失败；颜色生成器仍可变色。
- Rollback: 重新部署上一版 main。

## Step 6

- Scope: 最终检查与归档。
- Files: 0385 docs, tests, implementation files.
- Verification: `git diff --check`、相关 Node 测试、frontend build、runlog PASS 证据。
- Acceptance: `docs/ITERATIONS.md` 标为 Completed，工作区可提交。
- Rollback: 回退本迭代 commit。

## Notes

- Generated at: 2026-05-20
- This iteration intentionally does not claim real screen sharing. It removes fake success and creates a safe contract for future media capability work.
