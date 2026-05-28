---
title: "0393 Mgmt Bus Console Drop Channels Plan"
doc_type: iteration-plan
status: completed
updated: 2026-05-24
source: codex
---

# 0393 Mgmt Bus Console Drop Channels Plan

## Goal

让 `Mgmt Bus Console` 默认以 `drop` Matrix 用户视角显示运行信息：进入该滑动 App 时，左侧 `Subjects / Rooms` 不再只展示本地 trace/route fallback，而是展示 `drop` 当前已加入的所有 Matrix channel/room。

## Scope

- 服务端从当前 Model 0 / 环境中的 Matrix 配置读取 `drop` 身份，不在 UI 模型、正数模型或前端 snapshot 中暴露 token、password 等敏感数据。
- 增加一个 Matrix joined-room 读取路径，获取 `drop` 已加入的 room id，并尽量补充 room name / canonical alias；拿不到名称时用 room id 作为可见名称。
- 将 joined-room 摘要注入 `deriveMgmtBusConsoleProjection`，最终写入 `mgmt_bus_console_subject_rows_json`。
- 保留现有 event timeline、route status、composer、inspector 逻辑，不改变 Mgmt Bus Console 的发送路径。
- 增加测试覆盖：
  - joined-room 数据会变成 Mgmt Bus Console subjects。
  - 敏感字段不会进入 subject rows。
  - 无 joined-room 数据时仍显示现有 fallback，不静默失败。

## Non-Goals

- 不实现 Matrix Suite 的完整登录切换。
- 不改变 Matrix 消息发送/接收协议。
- 不把 `drop` 的 token/password 写入持久化正数模型。
- 不新增前端直连 Matrix API。

## Acceptance

- `Mgmt Bus Console` 默认展示 `drop` 已加入的 channel/room 列表。
- 页面仍能看到现有 route/event 状态。
- 相关测试和格式检查通过。
- 本地部署后，用真实浏览器打开 `Mgmt Bus Console`，可看到 room/channel 列表；若 Matrix 环境不可用，页面必须显示明确状态而不是空白误导。
