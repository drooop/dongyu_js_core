---
title: "0397 - Matrix Suite Live Test Slide App Plan"
doc_type: iteration-plan
status: approved
updated: 2026-05-28
source: ai
iteration_id: 0397-matrix-suite-live-test-slide-app
id: 0397-matrix-suite-live-test-slide-app
phase: approved
---

# Iteration 0397-matrix-suite-live-test-slide-app Plan

## Goal

- 将 `Matrix Suite` 收口为可真实测试的滑动 App：在浏览器里刷新远端 Matrix channel 列表、选择真实 room、发送真实 Matrix 消息，并在 UI 中看到真实 event id / 状态回写。
- 继续保持媒体能力边界诚实：voice / video / screen sharing 在未接通真实能力前，只显示 `requires_media_capability`，不伪造成功。
- 将 0394 的远端 Matrix 脚本检查与 0385 的 Matrix Suite 浏览器路径合并成一套可重复验收。

## Scope

- In scope:
- `Matrix Suite` 增加一个轻量测试入口：刷新远端 Matrix joined rooms、输入/选择目标 room id、发送测试消息。
- 服务端 Matrix host capability 增加 `refresh_rooms`，复用现有 Model 0 Matrix bootstrap/session，不在前端直接调用 Matrix API。
- 程序模型继续通过 `bus_event_v2 -> Model 0 ingress -> Model 1080 root pin.in -> func -> host action` 触发。
- 新增自动化合同测试，证明刷新 channel 与发送消息仍走模型表和 host action，且前端没有 direct Matrix send。
- 本地部署后用真实浏览器打开 `http://127.0.0.1:30900/#/workspace` 实测 Matrix Suite 与颜色生成器回归。
- Out of scope:
- 本轮不实现真实 WebRTC、屏幕采集、录音采集或 E2EE。
- 本轮不改变 MBR / RemoteWorker 双总线 topic 合同。
- 本轮不把 Matrix 密码、access token 写入模型表导出、repo 或客户端可见数据。

## Invariants / Constraints

- ModelTable 是 UI 和业务投影的真源；UI 只发事件，不直接拥有 Matrix side effect。
- Matrix side effect 只能由 UI Server host capability 执行；前端不得导入 `matrix-js-sdk` 或直接请求 Matrix Client API。
- 正式 UI 操作必须进入 Model 0 的 `bus_event_v2` 入口，再由模型表程序模型触发 host action。
- 远端 Matrix 默认使用 `https://matrix.dongyudigital.com`，本地测试不得回退本地 Synapse。
- 所有失败必须写回模型表中的可见状态，不允许静默失败。

## Success Criteria

- `python3 scripts/matrix_connection_check.py --homeserver https://matrix.dongyudigital.com --no-port-forward` 可以列出 drop joined channels，并完成 drop -> mbr 收发检查。
- `Matrix Suite` 页面可点击刷新远端 rooms；UI 中的 room 列表来自真实 Matrix joined rooms，而不是示例静态列表。
- 用户可以输入/选择真实 room id，点击 Send 后由服务端发送真实 Matrix 消息，UI 回写真实 event id。
- 媒体按钮继续显示 `requires_media_capability`，不会写入虚假的成功 timeline。
- 合同测试覆盖刷新 rooms、选择目标 room、真实 host action 调用、无前端 direct Matrix send。
- 本地部署和真实浏览器测试通过；颜色生成器仍能变色。

## Inputs

- Created at: 2026-05-28
- Iteration ID: 0397-matrix-suite-live-test-slide-app
- Branch: `dropx/dev_0397-matrix-suite-live-test-slide-app`
- User signal: 0396 合并推送后，要求回到 Matrix 测试滑动 App 任务。
