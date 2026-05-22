---
title: "0385 - Matrix Suite Real Communication Plan"
doc_type: iteration-plan
status: approved
updated: 2026-05-20
source: ai
iteration_id: 0385-matrix-suite-real-comm
id: 0385-matrix-suite-real-comm
phase: approved
---

# Iteration 0385-matrix-suite-real-comm Plan

## Goal

- 将 `Matrix Suite` 从“高保真界面 + 本地模拟事件”推进到真实 Matrix 基础通讯。
- 修正能力表达：没有真实接通的 screen sharing / video conferencing / voice messages 不得显示为已成功完成。
- 保持 UI Server 自带滑动 App 的边界：UI 仍由 `cellwise.ui.v1` 模型表表达，正式业务事件仍经 Model 0 bus ingress 进入程序模型。

## Scope

- In scope:
- `Matrix Suite` 增加真实 Matrix session 状态显示与登录动作，复用现有 server-side Matrix login host capability，不在前端直接引入 `matrix-js-sdk`。
- `send_message` / `edit_message` / `create_channel` / `share_file` 等动作增加真实通讯出口的 host capability 合同，并保留 ModelTable truth materialization。
- `FileInput` 上传继续走 `/api/media/upload`，共享文件动作应能把 `mxc://...` URI 写成真实 Matrix file event 或在缺少会话时明确失败。
- `Voice` / `Video` / `Screen` 按当前能力改为显式 `not_connected` / `requires_media_capability` 状态，不再伪造成功 timeline。
- 增加自动化测试，证明这些动作不是纯本地模拟；同时证明前端仍无 direct Matrix send。
- 本地部署后用真实浏览器验证 Matrix Suite 基础交互和颜色生成器回归。
- Out of scope:
- 本次不实现完整 E2EE。
- 本次不实现真实 WebRTC conferencing、真实屏幕流传输或真实录音采集；只移除“假成功”并为后续 media capability 留出明确状态与合同位置。
- 本次不改变 MBR / RemoteWorker 的双总线主题合同。

## Invariants / Constraints

- ModelTable 是 UI 和业务投影的真源；UI 不能直接拥有业务状态。
- Matrix Suite 的业务按钮必须继续通过 `bus_event_v2 -> Model 0 pin.bus.cb.in -> Model 0 hosting cell -> Model 1080 root pin.in -> 程序模型`。
- 前端不得导入 `matrix-js-sdk`，不得直接调用 Matrix send/create/edit/media API。
- 真实 Matrix side effect 只能通过 UI Server host capability 发生，并且程序模型必须把成功或失败写回模型表。
- 密码和 access token 不得写入 repo、导出 zip 或客户端可见模型表。
- 未接通的媒体能力必须可见失败或待接入，不允许用本地 timeline 假装完成。

## Success Criteria

- `Matrix Suite` 设置区可触发真实 Matrix 登录；成功后显示真实 user id / homeserver 状态，失败时显示明确错误。
- 发送文本消息会调用 server-side Matrix host capability；成功时将真实 event id 或 host 返回结果写入 timeline，失败时不伪造成功。
- 编辑消息、创建频道、文件共享具备真实 host capability 合同和测试覆盖；在未配置真实 Matrix 会话时必须明确失败。
- Voice / Video / Screen 点击后显示“需要媒体能力/未接通”，不会再追加“Voice message recorded / Video conference started / Screen sharing started”这类假成功事件。
- 合同测试覆盖：无前端 direct Matrix send、Model 0 ingress route 未绕过、真实 host capability 被调用、失败会写回 ModelTable。
- 本地部署和真实浏览器实测通过；云端部署如本轮要求发布，则按 main 提升后再验证。

## Inputs

- Created at: 2026-05-20
- Iteration ID: 0385-matrix-suite-real-comm
- User signal: Matrix Suite currently only has visual shell and lacks true login, communication, and screen sharing.
