---
title: "Iteration 0400-matrix-chat-ux-hardening Plan"
doc_type: iteration-plan
status: planned
updated: 2026-06-03
source: ai
iteration_id: 0400-matrix-chat-ux-hardening
id: 0400-matrix-chat-ux-hardening
phase: phase1
---

# Iteration 0400-matrix-chat-ux-hardening Plan

## Goal

让正式的 Matrix Chat 滑动 APP 达到可真实使用的聊天软件最小闭环，同时修复 Android tablet shell 在 100% 缩放下的外层滚动问题，并把真实浏览器测试的进程清理方式固化。

本轮不把 Matrix Suite 继续做成正式聊天客户端；Matrix Suite 继续保留为测试界面。正式体验收口在 Matrix Chat。

## Scope

- In scope:
  - 100% 浏览器缩放下，外层页面不得横向或纵向滚动；需要滚动的内容只能在应用内部列表、消息流等区域滚动。
  - 固化 Playwright/Chrome 测试生命周期：复用固定测试会话或测试结束自动关闭，避免残留多个 Chromium/Chrome 进程。
  - Matrix Chat 真实读取 `drop` 用户已加入的 Matrix rooms/channels，能够识别并展示 `drop` 与 `mbr` 的 DM-like room。
  - Matrix Chat 真实发送文字消息、上传并发送单文件、展示文件消息卡片。
  - Matrix Chat 增加基础成员管理：添加/邀请成员、房主/管理员移除成员、普通成员离开 channel；对 Matrix 权限不足的情况要显示明确失败，不静默吞掉。
  - 参照 Element / Feishu / WeChat 等常见聊天软件的信息架构：房间列表、消息流、底部输入区、设置和成员管理进入 Dialog/Drawer，不再把测试面板平铺到主界面。
  - 用真实浏览器完成本地实测，并在每个小阶段后用 sub-agent 调用 `codex-code-review` 审查。
- Out of scope:
  - 不重做 Matrix Suite 的测试工具定位。
  - 不实现端到端加密、音视频会议的真实媒体协商、多人文件库、消息全文搜索。
  - 不引入外部聊天 UI 框架；参考其 UX，但实现仍由 UI 模型和现有 renderer 能力承担。

## Invariants / Constraints

- ModelTable 是 UI 和业务状态真源，UI 只能投影模型表。
- UI 业务事件必须进入 Model 0/system bus 既有边界，不允许前端直接绕过模型表执行 Matrix 业务写入。
- 本轮不得增加旧路径兼容代码；如果现有合同不满足，优先修正规约/模型/运行时真实路径。
- 浏览器验证必须使用远端 Matrix server `https://matrix.dongyudigital.com`，不得退回本地 Synapse。
- 测试用临时 room 可以创建和清理；不得对真实重要 room 执行破坏性成员操作。
- 视觉调整不能脱离 UI 模型；需要新增属性或组件时，先写清模型表含义，再实现 renderer 支持。

## Success Criteria

- Shell/viewport:
  - 在真实浏览器 100% 缩放、至少 1365x768 和当前默认窗口尺寸下，`document.scrollingElement.scrollWidth <= window.innerWidth` 且 `scrollHeight <= window.innerHeight`。
  - Matrix Chat 打开后能完整铺满应用窗口；房间列表和消息流可在内部滚动，最外层页面不能被拖出空白。
- Browser lifecycle:
  - 新增或固化一个浏览器测试入口，测试前后可证明没有遗留本项目测试启动的 Playwright CLI daemon、Playwright-managed Chromium profile/session，或显式由测试脚本启动的 Chrome 进程。
  - 清理边界必须只覆盖本项目测试会话和 Playwright profile，不得误杀用户日常使用的 Chrome 窗口。
  - 后续文档/runlog 明确要求使用固定 session 或自动清理入口，并记录 `list` / process check 结果。
- Matrix room/channel:
  - Matrix Chat 刷新后显示 `drop` 用户真实 joined rooms；`Dongyu Local Test` / `@mbr` DM-like room 可见，room id 只在 hover/详情层展示。
  - 单个 room 的成员或历史读取失败时，只在该 room 显示错误状态，不导致整页刷新失败。
- Message/file:
  - 通过真实浏览器在 Matrix Chat 中选择 room，发送文字消息后能在消息流中看到真实回写。
  - 上传单文件并点击 Send File 后，Matrix 返回真实 event，消息流显示文件卡片；图片文件显示可识别预览或文件卡。
- Members:
  - 创建临时测试 room 验证邀请、移除、离开操作；权限不足时 UI 显示 Matrix 返回的失败原因。
  - DM/朋友操作以 Matrix room 语义表达：添加朋友等价于创建/邀请 DM room，删除朋友等价于 leave/archive 该 DM room，不伪造 Matrix 不存在的全局好友表。
- Review:
  - 每个小阶段结束后有 sub-agent code review 记录；发现的问题必须修正后再进入下一阶段。
  - 最终再做一次整体 sub-agent review，并完成本地真实浏览器验收。

## Inputs

- Created at: 2026-05-29
- Iteration ID: 0400-matrix-chat-ux-hardening
- Branch: `dropx/dev_0400-matrix-chat-ux-hardening`
- Existing evidence:
  - `drop` homeserver: `https://matrix.dongyudigital.com`
  - `drop` user: `@drop:synapse.dongyudigital.com`
  - `mbr` user: `@mbr:synapse.dongyudigital.com`
  - `Dongyu Local Test` room: `!OOuhOIkNosIGMCescc:synapse.dongyudigital.com`, members include `drop` and `mbr`

## Stage Plan

1. Planning and review
   - Freeze this plan and register the iteration.
   - Use sub-agent + `codex-code-review` to review the plan.
   - Improve plan/resolution if the review finds gaps.
2. Viewport and browser lifecycle hardening
   - Tighten desktop/foreground shell and Matrix Chat model sizing so only inner panels scroll.
   - Add a reusable Playwright session cleanup/check helper and document usage in runlog.
   - Add deterministic contract tests for no oversized app root and cleanup helper presence.
   - Sub-agent review and fixes.
3. Matrix room projection and history
   - Extend server-side Matrix refresh to enrich rooms with members, DM detection, permissions, latest message/history status, and per-room error state.
   - Project enriched data into Matrix Chat labels without direct frontend Matrix calls.
   - Add deterministic tests with mocked Matrix responses, including partial room failures.
   - Sub-agent review and fixes.
4. Chat actions and UI/UX
   - Add UI-model-backed Dialog/Drawer actions for settings, room details, invite/remove/leave, add/delete DM-like friend, and file preview/send.
   - Keep main surface as standard chat layout: left room list, right message history, bottom composer.
   - Add deterministic tests for event bindings and action labels.
   - Sub-agent review and fixes.
5. Live local verification
   - Redeploy/restart local stack.
   - Use real browser to verify viewport, room refresh, mbr DM visibility, text send, file send, and safe temporary room member operations.
   - Verify browser process cleanup after tests.
   - Sub-agent review and fixes.
6. Final review and closeout
   - Run full relevant deterministic checks.
   - Run final sub-agent review over code, docs, tests, and runlog.
   - Update resolution with PASS/FAIL evidence and remaining explicit limitations, if any.
