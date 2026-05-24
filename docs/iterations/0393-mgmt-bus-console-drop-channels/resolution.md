---
title: "0393 Mgmt Bus Console Drop Channels Resolution"
doc_type: iteration-resolution
status: completed
updated: 2026-05-24
source: codex
---

# 0393 Mgmt Bus Console Drop Channels Resolution

## Stages

1. Projection contract
   - 先写失败测试，约束 joined-room 摘要如何变成 `mgmt_bus_console_subject_rows_json`。
   - 实现 projection helper，并运行 Mgmt Bus Console projection tests。
   - 小阶段完成后做 code review。

2. Server Matrix room discovery
   - 先写失败测试，约束服务端存在 joined-room 读取路径且不暴露 credentials。
   - 实现服务端 discovery：用 Matrix bootstrap identity 获取 joined rooms，写入 Model -2 投影状态。
   - 小阶段完成后做 code review。

3. Deploy and browser verification
   - 本地重新部署/启动受影响服务。
   - 使用真实浏览器进入 `Mgmt Bus Console`，检查 channel 列表、route status、timeline 是否正常。
   - 最后整体 code review，并更新 runlog / iteration status。

## Verification

- `node scripts/tests/test_0339_mgmt_bus_console_live_projection_contract.mjs`
- `node scripts/tests/test_0341_mgmt_bus_console_event_projection_contract.mjs`
- 新增 0393 测试
- `git diff --check`
- 本地真实浏览器访问 `http://127.0.0.1:30900/#/` 并打开 `Mgmt Bus Console`

## Result

- `Mgmt Bus Console` now resolves the Matrix session from Model 0 and uses `@drop:localhost` for joined-room discovery.
- Joined rooms are projected into Model `-2` as `mgmt_bus_console_subject_rows_json`, while Model `1036` remains UI structure and local interaction state.
- The Workspace desktop exposes `Mgmt Bus Console` as a built-in slide app and opens it as `workspace:1036`.
- Browser-visible Subjects tabs now declare an active ModelTable-backed tab (`selected_subject_tab=subjects`) so joined room rows render in the left panel.
