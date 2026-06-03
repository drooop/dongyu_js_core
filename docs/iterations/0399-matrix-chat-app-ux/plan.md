---
title: "0399 - Matrix Chat App UX Plan"
doc_type: iteration-plan
status: approved
updated: 2026-05-29
source: ai
iteration_id: 0399-matrix-chat-app-ux
id: 0399-matrix-chat-app-ux
phase: approved
---

# Iteration 0399-matrix-chat-app-ux Plan

## Goal

新增一个正式聊天软件形态的 Matrix 滑动 APP，让用户以当前默认 Matrix 身份进入后，可以像常见聊天软件一样查看会话列表、切换房间、查看聊天历史、输入文字、选择单个文件并发送，同时把设置、建房、账号安全等辅助功能收进弹窗或分层界面中。

## Background

当前 `Matrix Suite` 已能承担真实 Matrix refresh / send 的测试职责，但 UI/UX 仍像一页测试控制台：登录、密码维护、房间、消息、文件、状态与调试信息平铺在同一屏，无法作为正式聊天软件使用。本次不再把现有 `Matrix Suite` 继续堆功能，而是保留它作为测试界面，并新增一个面向最终用户的聊天滑动 APP。

## Reference Notes

- Element Web uses separated room list, room header, message composer, upload confirmation, and voice-message surfaces. Reference paths:
  - `https://github.com/element-hq/element-web/blob/develop/apps/web/src/components/structures/RoomView.tsx`
  - `https://github.com/element-hq/element-web/blob/develop/apps/web/src/components/views/rooms/RoomListPanel/RoomListPanel.tsx`
  - `https://github.com/element-hq/element-web/blob/develop/apps/web/src/components/views/rooms/MessageComposer.tsx`
  - `https://github.com/element-hq/element-web/blob/develop/apps/web/src/components/views/rooms/VoiceRecordComposerTile.tsx`
  - `https://github.com/element-hq/element-web/blob/develop/apps/web/src/components/structures/UploadBar.tsx`
  - `https://github.com/element-hq/element-web/blob/develop/apps/web/src/components/views/dialogs/UploadConfirmDialog.tsx`
  - `https://github.com/element-hq/element-web/blob/develop/apps/web/src/components/views/rooms/RoomHeader/RoomHeader.tsx`
- Matrix Client-Server API message types are the semantic reference for text/file/image/audio message display:
  - `https://spec.matrix.org/latest/client-server-api/#mroommessage`
  - `https://spec.matrix.org/latest/client-server-api/#mfile`
- 飞书、微信、Element 的共同 UX pattern 作为产品层参考：左侧会话列表，中间消息流，底部输入区；设置、账号、安全、创建房间、房间详情进入弹窗或二级层，不在主聊天页平铺。
- Visual concept generated for this iteration:
  - `/Users/drop/.codex/generated_images/019db1f3-5516-7320-b43b-635075e95d37/ig_006bd92db2834b0f016a188a552bb08191a09a7aa8d57cf704.png`

## Invariants

- `Matrix Suite` 作为测试/诊断滑动 APP 保留，不承担正式聊天软件主体验。
- 新正式聊天 APP 必须仍由 ModelTable UI 模型定义；前端组件只解释模型表标签，不直接调用 Matrix API。
- 所有业务动作仍通过已有 Model 0 ingress / `bus_event_v2` / 程序模型路径进入运行环境，不能从前端绕过数据链路。
- Matrix room id 仍可在详情/hover 中查看，但会话列表正文默认展示可读名称。
- 密码维护、安全设置、账号信息、创建房间/私聊、房间详情不得平铺在聊天主界面。
- 文件发送先只支持单文件；图片可显示缩略图式卡片，音频/普通文件以文件卡片展示。
- 如果本次新增 UI 组件，组件必须是模型表可配置的通用能力，不写死 Matrix 账号或房间。

## Scope

### In Scope

- 新增正式聊天滑动 APP，例如 `Matrix Chat`，并纳入桌面/Workspace 滑动 APP 列表。
- 扩展 UI renderer 的聊天类组件，使 UI 模型能声明会话列表、消息流、文件预览、底部输入区和设置弹窗。
- 为新 APP 复用或泛化当前 Matrix Suite 的服务端 Matrix refresh/send/create/upload 行为。
- 新增合同测试，证明正式聊天 APP 的主界面不再是测试面板式平铺，并证明关键动作仍走模型表事件链路。
- 本地部署后用真实浏览器打开新聊天 APP，验证会话刷新、房间切换、文字发送、单文件选择预览，以及设置/创建/详情弹窗。

### Out of Scope

- 不删除现有 `Matrix Suite` 测试界面。
- 不实现完整实时语音录制、WebRTC 通话或屏幕共享的生产链路；本次只把这些入口从主界面整理到合理位置，并避免伪装成已完成。
- 不改变远端 Matrix server 默认配置、不迁移账号体系、不调整 MBR/控制总线 topic 合同。
- 不引入 MUI / Quasar 等大型 UI 框架依赖。

## Success Criteria

- 新聊天 APP 在 Workspace / Android tablet shell 中可打开，主界面呈现“会话列表 + 聊天历史 + 底部输入区”的聊天软件结构。
- 会话列表能刷新并展示当前默认用户已加入的 Matrix rooms，默认显示名称而非 room id。
- 点击会话能切换聊天区，右侧不再出现登录测试框、密码维护或调试面板平铺。
- 输入文字后点击 Send 能通过模型表事件链路发送 Matrix 消息，并清空输入框或显示可判定状态。
- 选择单个文件后，发送前能看到文件预览卡片；图片类文件和普通文件至少有不同视觉表现。
- 设置、创建会话/房间、房间详情、账号/安全设置通过 Dialog/Tabs 等分层组件展示。
- 新增/调整的合同测试、UI AST 校验、本地部署检查和真实浏览器测试均 PASS。
- 每个实施小阶段结束后均完成 sub-agent `codex-code-review` 审查，并处理审查意见。

## Risks & Mitigations

- Risk: 新组件过度 Matrix-specific，后续难复用。
  - Impact: UI 模型扩展变成单一 APP 的硬编码。
  - Mitigation: 将组件命名和属性设计为 `ConversationList`、`MessageTimeline`、`AttachmentPreview`、`ComposerBar` 等通用聊天/协作组件，通过 props/bind 接收模型表数据和动作。
- Risk: 文件发送 UI 看起来完成，但真实 Matrix 发送没有走通。
  - Impact: 用户误判功能状态。
  - Mitigation: 浏览器验证必须区分“预览成功”和“发送成功”；发送成功只以 Matrix 返回或运行态状态为准。
- Risk: 当前 Matrix Suite 逻辑只绑定 Model 1080，新增 APP 不能复用。
  - Impact: 正式聊天 APP 只能静态展示。
  - Mitigation: 将服务端 helper 泛化为可按 model id 工作，保持 1080 测试界面不回归。
- Risk: 输入框仍因持久化更新抖动。
  - Impact: 聊天输入体验不自然。
  - Mitigation: 继续使用本地 overlay / commit policy；正文输入在发送或 blur 时落表，避免每个字符都走持久化回推。

## Open Questions

- None. 用户已授权本轮由 Codex 做设计决策，并在 sub-agent review 通过后继续实施。

## Compliance Checklists

### SSOT Alignment Checklist

- ModelTable remains truth; UI remains projection.
- Business events enter through worker root Model 0 ingress and program model handling.
- New labels/components must remain cellwise UI authoring, not raw HTML string takeover.
- No compatibility fallback or legacy direct Matrix call is allowed in the new UI path.

### UX Layering Checklist

- Main page only contains conversation navigation, active room header, timeline, and composer.
- Settings/account/security/create-room/details are Dialog/Tabs/Drawer-level surfaces.
- Test/debug/login/password maintenance controls are not visible as flat main-page panels.
- File and voice controls appear in the composer, not as isolated test blocks.
