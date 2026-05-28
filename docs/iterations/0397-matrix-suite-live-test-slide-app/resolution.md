---
title: "0397 - Matrix Suite Live Test Slide App Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-05-28
source: ai
iteration_id: 0397-matrix-suite-live-test-slide-app
id: 0397-matrix-suite-live-test-slide-app
phase: completed
---

# Iteration 0397-matrix-suite-live-test-slide-app Resolution

## Execution Strategy

- 先冻结浏览器可验证的最小闭环：刷新真实 joined rooms、选择真实 room、发送真实 Matrix 消息、显示真实 event id。
- 使用小阶段实施：每阶段只改一个清晰范围，每阶段完成后用 sub-agent 依据 `codex-code-review` skill 审查，审查通过再进入下一阶段。
- 不新增前端 Matrix 直连；所有能力继续落在 UI Server host capability 与 ModelTable 程序模型中。

## Step 1 - Planning Gate

- Scope: 登记 0397，补齐 plan / resolution / runlog，并记录远端 Matrix 预检。
- Files:
- `docs/ITERATIONS.md`
- `docs/iterations/0397-matrix-suite-live-test-slide-app/plan.md`
- `docs/iterations/0397-matrix-suite-live-test-slide-app/resolution.md`
- `docs/iterations/0397-matrix-suite-live-test-slide-app/runlog.md`
- Verification:
- `rg -n "0397-matrix-suite-live-test-slide-app" docs/ITERATIONS.md docs/iterations/0397-matrix-suite-live-test-slide-app/*.md`
- `python3 scripts/matrix_connection_check.py --homeserver https://matrix.dongyudigital.com --no-port-forward`
- Acceptance: 计划完整、远端 Matrix 预检 PASS、sub-agent review APPROVED。
- Rollback: 删除 0397 iteration 目录并移除 `docs/ITERATIONS.md` 登记行。

## Step 2 - Contract Tests

- Scope: 新增合同测试，先锁定刷新 rooms / 选择 room / 发送真实 host action 的路径。
- Files:
- `scripts/tests/test_0397_matrix_suite_live_test_slide_app.mjs`
- Verification:
- `node scripts/tests/test_0397_matrix_suite_live_test_slide_app.mjs`
- Acceptance: 测试证明 `refresh_rooms` 和 `send_message` 都由 `bus_event_v2` 进入 Model 0，最终调用 host action；前端无 direct Matrix send。
- Rollback: 删除新增测试文件。

## Step 3 - Host Capability

- Scope: 增加 Matrix Suite `refreshRooms` host capability，复用现有 Matrix bootstrap/session 读取逻辑。
- Files:
- `packages/ui-model-demo-server/server.mjs`
- Verification:
- `node scripts/tests/test_0397_matrix_suite_live_test_slide_app.mjs`
- `node scripts/tests/test_0385_matrix_suite_real_comm_contract.mjs`
- Acceptance: `refresh_rooms` 可把真实 joined rooms materialize 到 `rooms_json` / `rooms_text` / `active_room_id` 等标签；失败写入可见错误。
- Rollback: 回退 `server.mjs` 的 0397 增量。

## Step 4 - UI Model / Program Model

- Scope: 扩展 Model 1080 的模型表定义，增加刷新、目标 room 输入、使用目标 room 的 UI 节点和程序模型动作。
- Files:
- `packages/worker-base/system-models/workspace_positive_models.json`
- Verification:
- `node scripts/tests/test_0397_matrix_suite_live_test_slide_app.mjs`
- `node scripts/tests/test_0383_matrix_suite_slide_app_contract.mjs`
- `node scripts/validate_ui_ast_v0x.mjs --case all`
- Acceptance: 新 UI 节点由 cellwise 模型表细粒度表达；按钮绑定仍是 `bus_event_v2`；输入框不逐字持久化。
- Rollback: 回退 Model 1080 相关 labels。

## Step 5 - Local Deploy / Browser E2E

- Scope: 本地部署新版，并用真实浏览器测试 Matrix Suite 与颜色生成器。
- Files: local runtime/deployment state; optional screenshots under ignored output paths.
- Verification:
- local baseline / rollout commands
- Playwright real browser on `http://127.0.0.1:30900/#/workspace`
- Acceptance: 浏览器可见真实 rooms refresh、选中真实 room、发送真实 Matrix 消息并显示 event id；颜色生成器仍能变色。
- Rollback: 重新部署上一版 `main`。

## Step 6 - Final Review / Completion

- Scope: 最终 sub-agent review、更新 runlog 与 iteration status，提交变更。
- Files: all changed files.
- Verification:
- `git diff --check`
- Step 2-5 的命令证据
- Acceptance: sub-agent final review APPROVED；`docs/ITERATIONS.md` 标记 Completed；工作区提交干净。
- Rollback: revert 0397 commit。

## Notes

- Generated at: 2026-05-28
- 0397 不声明真实 screen sharing 已接通；只保证当前能力边界在 UI 中诚实展示。
- Completion: local deployment, real browser Matrix send, mbr-side receive verification, and color generator regression all passed.
