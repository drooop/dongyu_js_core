---
title: "0398 - Matrix Suite Room Name Display Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-05-29
source: ai
iteration_id: 0398-matrix-suite-room-name-display
id: 0398-matrix-suite-room-name-display
phase: completed
---

# Iteration 0398-matrix-suite-room-name-display Resolution

## Step 1 - Contract Test

- Scope: 新增 0398 合同测试，先证明当前房间列表会泄漏 room id 或缺少 hover/detail 约束。
- Files:
- `scripts/tests/test_0398_matrix_suite_room_name_display.mjs`
- Verification:
- `node scripts/tests/test_0398_matrix_suite_room_name_display.mjs`
- Acceptance: RED 阶段失败点明确指向房间列表展示规则。
- Rollback: 删除新增测试文件。

## Step 2 - Projection Update

- Scope: 调整 Matrix Suite 服务端投影和 Model 1080 程序模型中的 `renderRooms` 规则。
- Files:
- `packages/ui-model-demo-server/server.mjs`
- `packages/worker-base/system-models/workspace_positive_models.json`
- Verification:
- `node scripts/tests/test_0398_matrix_suite_room_name_display.mjs`
- `node scripts/tests/test_0397_matrix_suite_live_test_slide_app.mjs`
- `node scripts/tests/test_0385_matrix_suite_real_comm_contract.mjs`
- Acceptance: 列表正文不出现 `!room...` id，详情仍出现 id，0397/0385 不回归。
- Rollback: 回退上述文件。

## Step 3 - Browser Verification / Completion

- Scope: 本地构建部署，真实浏览器刷新 Matrix Suite rooms，并检查列表/详情显示。
- Files:
- `docs/iterations/0398-matrix-suite-room-name-display/runlog.md`
- `docs/ITERATIONS.md`
- Verification:
- `node scripts/validate_ui_ast_v0x.mjs --case all`
- `node scripts/ops/validate_obsidian_docs_gate.mjs --root docs`
- Playwright on `http://127.0.0.1:30900/#/workspace`
- Acceptance: 浏览器中列表只见房间名称；详情区可见当前 room id；sub-agent review APPROVED。
- Rollback: 重新部署上一版 `main`。
