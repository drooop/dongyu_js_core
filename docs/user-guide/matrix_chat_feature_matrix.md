---
title: "Matrix Chat 功能与调试清单"
doc_type: user-guide
status: active
updated: 2026-06-03
source: ai
---

# Matrix Chat 功能与调试清单

本文记录 `Matrix Chat` 滑动 APP 当前已经实现的功能、真实 Matrix 状态显示口径、交互动作和回归测试清单。后续继续改 Matrix Chat 时，应先按本文确认范围，再补测试和浏览器验证，避免漏测或把未接通能力误写成已完成。

## 当前显示口径

`Matrix Chat` 默认使用 `drop` 的远端 Matrix 身份，homeserver 为 `https://matrix.dongyudigital.com`。本地测试也按这个远端 homeserver 执行，不再用本地 Matrix 服务器替代。

会话列表按真实 Matrix 数据分组：

| 分组 | 判定规则 | 当前显示 |
|---|---|---|
| `All` | `drop` 当前 joined rooms，加上 `drop` 当前收到但尚未接受的邀请 | 所有可见会话和邀请。 |
| `People` | 正式 `m.direct` direct room，或 joined members 恰好是 `drop + 另一个人` 的 1v1 room | 当前 `m.direct` 为空时，`mbr` 这类双人 room 会显示为 People，但不称为正式 DM。 |
| `Rooms` | 普通多人 room，或成员接口异常导致无法确认 1v1 的 room | 显示 room 名；接口异常只作为该 room 的 warning。 |
| `Invites` | `/sync` 返回的 Matrix invite room | 可点击查看邀请面板，接受或拒绝邀请；如果远端同时把同一个 room 放在 joined 与 invite 区，投影以 joined 状态为准。 |

重要边界：

- `m.direct` account data 为空时，不把双人 room 直接叫正式 DM。
- 双人 room 可以显示在 `People`，摘要为 `1v1 room with <peer>`。
- room id 不作为主标题显示，只在 hover title 或详情 Dialog 中展示。
- 某些远端 room 的成员或历史消息接口可能返回 500；这类失败是单 room warning，不应导致整个刷新失败。
- Matrix 邀请同步可能有几秒延迟。真实浏览器验证时，点击 `Refresh` 后应等待邀请真正进入 `rooms_json`，不要只等按钮点击完成。
- 远端 `/sync` 可能短时间保留已接受或已拒绝的 invite 影子项；如果同一 room 已经是 joined，或本轮刚被拒绝，UI 投影不再把它显示为待处理邀请。
- 当前 room 的操作按钮由模型表投影出的 `active_can_*` 状态控制。普通 room、People/1v1、Invite 不会同时展示同一组操作。

## 已实现功能

| 功能 | 当前状态 | 入口 | 说明 |
|---|---|---|---|
| 远端 Matrix room 刷新 | 已实现 | `Refresh` | 读取 `drop` joined rooms、邀请、room name/topic、成员、权限和最近消息。 |
| 会话分组筛选 | 已实现 | `All` / `People` / `Rooms` / `Invites` tabs | 由模型表 `conversation_filter` 驱动。 |
| 选择会话 | 已实现 | 左侧 ConversationList | 选择后更新标题、摘要、详情和输入目标 room。 |
| 文本消息卡片 | 已实现 | 时间线 | 普通 `m.text` 以文字卡片显示。 |
| 文件消息卡片 | 已实现 | 时间线 | `m.file` 显示文件名、类型/大小，并提供下载入口。 |
| 图片消息卡片 | 已实现 | 时间线 | `m.image` 显示缩略预览，并提供打开/下载入口。 |
| 语音消息卡片 | 已实现 | 时间线 | `m.audio` 显示音频播放器和下载入口。 |
| 发送文本 | 已实现 | 底部输入框 + `Send` | UI 事件进入模型表程序模型，再由服务端 host action 调 Matrix API。 |
| 发送文件 | 已实现 | `Attach` / `Send File` | 当前支持单文件；上传后发送 Matrix media message 并显示对应卡片。 |
| 发送语音 | 已实现 | `Voice` | 点击后进入录音面板；点击 `Finish` 或按 Enter 结束并发送；`Cancel` 放弃；单条最多 60 秒。浏览器无麦克风权限时显示明确错误。 |
| 编辑消息 | 已实现 | `Edit last` Dialog | 以最后一个可编辑事件为入口，发送 Matrix replacement event。 |
| 创建 room / 1v1 | 已实现 | `New` Dialog | room 创建为普通私有 room；1v1 创建使用 Matrix direct-room 创建参数。 |
| 邀请成员 | 已实现 | Room 详情操作区 | 仅普通 room 且有权限时显示；对当前 room 调 Matrix invite，成功后在当前 room 的 pending invites 中显示。 |
| 接受邀请 | 已实现 | `Invites` tab + 专用邀请面板 | 选中邀请后隐藏普通聊天输入区，显示邀请面板；接受后重新刷新 Matrix 投影，邀请行变成普通 room。 |
| 拒绝邀请 | 已实现 | `Invites` tab + 专用邀请面板 | 选中邀请后点击 `Decline`，通过 Matrix leave/reject 拒绝邀请并刷新列表。 |
| 移除成员 | 已实现 | `Details` Dialog | 对当前 room 调 Matrix kick/remove；成员和 pending invite 从投影中移除。 |
| 离开 room | 已实现 | `Details` Dialog | 当前用户 leave 后，该 room 从可点击列表中移除，并切到下一个有效 room。 |
| 离开 1v1 | 已实现 | `Details` Dialog 的 `Leave 1v1` | 本质是 leave 当前 People 会话，不再叫 Delete DM。 |
| 设置 Dialog | 已实现基础 UI | `Settings` | 登录/安全设置入口已分层展示；敏感信息不写入 UI 模型。 |
| 视频会议 | 未接通 | 暂不作为成功能力展示 | 需要后续 MatrixRTC / Element Call 级别设计。 |
| 屏幕共享 | 未接通 | 暂不作为成功能力展示 | 需要后续媒体会话设计。 |
| 搜索会话 | 待实现 | `Search conversations` | 当前保留输入入口，后续需要接入模型表筛选或只读本地筛选。 |

## 消息卡片行为

| 消息类型 | Matrix 类型 | UI 显示 | 用户操作 |
|---|---|---|---|
| 普通文字 | `m.text` | 发送人、时间、正文 | 后续可扩展复制/引用。 |
| 文件 | `m.file` | 文件卡片、文件名、类型/大小 | `Download file` 下载原文件。 |
| 图片 | `m.image` | 缩略图、文件名 | `Open / download` 打开或下载原图。 |
| 语音 | `m.audio` | 音频播放器、文件名、类型/大小 | 播放或 `Download audio`。 |

## 交互动作清单

| UI 动作 | 模型事件 action | 后端 host action | 验证重点 |
|---|---|---|---|
| 点击 `Refresh` | `refresh_rooms` | `refreshRooms` | joined rooms、Invites、People/Rooms 分组和单 room warning。 |
| 点击 `All/People/Rooms/Invites` | `select_filter` | 无直接 Matrix 调用 | `conversation_filter` 写为 `all/people/rooms/invites`。 |
| 点击会话项 | `select_room` | 无直接 Matrix 调用 | 标题、摘要、详情、目标 room 同步。 |
| 点击 `Send` | `send_message` | `sendMessage` | 文本不能为空；发送后时间线出现 `You` 消息和 event id。 |
| 选择文件 | `ui_owner_label_update` | `uploadMedia` | 只允许单文件；写入 `pending_file_uri` 和 `pending_file_name`。 |
| 点击 `Send File` | `share_file` | `shareFile` | 必须已有 media URI；按钮未满足条件时不可用；发送后显示对应 media card。 |
| 点击 `Voice` | `start_voice` | `uploadMedia` + `shareFile` | 点击后只进入录音模式；`Finish` / Enter / 60 秒上限才会上传并发送 `m.audio`；`Cancel` 不上传、不发送并关闭麦克风流。 |
| 点击 `Edit last` 并确认 | `edit_message` | `editMessage` | replacement event 后原消息显示 edited 状态。 |
| 点击 `New` 创建 room | `create_channel` | `createRoom` | 普通 room 不进入 People；创建后可选中。 |
| 点击 `New` 创建 1v1 | `create_channel` | `createRoom` | 使用 direct-room 创建参数；创建后进入 People。 |
| 邀请成员 | `invite_member` | `inviteMember` | 仅适用于普通 room；成功后 pending invite 可见；对方 `/sync` 能看到 invite。 |
| 接受邀请 | `accept_invite` | `joinRoom` + `refreshRooms` | 必须先选中 Invites 中的邀请；join 成功后刷新列表，若远端 `/sync` 仍返回同 room 的旧 invite 影子项，投影会过滤该影子项。 |
| 拒绝邀请 | `decline_invite` | `leaveRoom` + `refreshRooms` | 必须先选中 Invites 中的邀请；成功后邀请行移除并切到剩余有效 room，延迟返回的旧 invite 影子项不会重新插入列表。 |
| 移除成员 | `remove_member` | `removeMember` | 成员和 pending invite 从投影中移除。 |
| 离开 room | `leave_room` | `leaveRoom` | 成功后 room 从 active list 中消失。 |
| 离开 1v1 | `delete_friend` | `leaveRoom` | 仅允许 People 会话；文案显示为离开 1v1。 |

## 回归测试清单

每次改 Matrix Chat 后至少运行：

```bash
node scripts/tests/test_0399_matrix_chat_app_ux_contract.mjs
node scripts/tests/test_0400_matrix_chat_room_projection_contract.mjs
node scripts/tests/test_0400_viewport_playwright_guard_contract.mjs
node scripts/tests/test_0401_matrix_chat_media_cards_contract.mjs
node scripts/tests/test_0401_matrix_chat_voice_contract.mjs
node scripts/tests/test_0401_matrix_chat_membership_contract.mjs
node scripts/tests/test_0402_matrix_chat_action_visibility_contract.mjs
node --check packages/ui-model-demo-server/server.mjs
node --check packages/ui-renderer/src/renderer.mjs
node --check packages/ui-renderer/src/renderer.js
python3 -m py_compile scripts/matrix_chat_real_flow_check.py
git diff --check
```

涉及真实 Matrix 行为时，还要运行：

```bash
scripts/matrix_chat_real_flow_check.py --timeout 40
```

真实浏览器至少覆盖：

- 打开 `Matrix Chat`。
- 点击 `Refresh`，确认远端 `drop` joined rooms 出现。
- 点击 `People`，确认 `mbr` 的 1v1 room 显示为 `mbr` 或对应 peer 名，摘要不是正式 DM。
- 点击 `Rooms`，确认普通 room 或接口异常 room 不混入 People。
- 发送一条文本消息并在时间线看到 `You` 消息。
- 发送一个文本文件并看到 file card，下载入口可见。
- 发送一张图片并看到 image card 缩略图，打开/下载入口可见。
- 点击 `Voice`，确认进入录音面板；点击 `Finish` 或按 Enter 后发送，并在时间线看到 audio card；点击 `Cancel` 时不发送。
- 新建临时 room，邀请 `@mbr:synapse.dongyudigital.com`，移除邀请/成员后确认投影更新。
- 由 `mbr` 邀请 `drop`，在浏览器中接受邀请，确认邀请变成普通 room，再退出并确认列表移除。
- 由 `mbr` 再邀请 `drop`，在浏览器中拒绝邀请，确认邀请行从列表移除。
- 结束后清理临时 Matrix room。

固定 Playwright session 结束时必须清理：

```bash
scripts/ops/playwright_session_guard.sh cleanup
scripts/ops/playwright_session_guard.sh check-clean
```

## 已完成的真实验证

2026-06-01 的 0401 验证已覆盖：

- 真实 Matrix API 脚本：文本、文件、图片、语音、离开 1v1、邀请并接受、邀请并移除成员全部 PASS。
- 本地浏览器：文本、文件、图片、语音发送成功，时间线显示 file/image/audio cards。
- 本地浏览器：邀请 `mbr`、移除成员、退出 room 后，room 列表正确更新。
- 本地浏览器：`mbr` 邀请 `drop` 后，`drop` 接受邀请，邀请行变成普通 room，退出后列表移除。

2026-06-02 的 0402 验证新增覆盖：

- 语音发送改为手动录音模式，启动中重复点击不会开多路麦克风；启动中取消会关闭稍后返回的音频流。
- 详情操作按钮由当前 room 类型和权限控制，不再同时展示 Remove / Leave room / Leave 1v1 / Accept invite。
- 邀请行显示专用邀请面板，普通聊天输入区隐藏，并提供 `Accept` / `Decline` 两个独立动作。
- 接受邀请后，如果远端 Matrix 暂时仍在 `/sync` 中返回旧 invite，前端投影以 joined room 为准，避免已接受的邀请继续出现在 Invites 列表。

## 后续改进队列

1. 接入搜索：决定搜索是只读本地筛选，还是模型表持久筛选。
2. 清理远端测试遗留 room：把历史 `0400 Matrix Chat Temp Room ...` 做成维护动作，不在普通用户界面里暴露过多噪声。
3. 明确 formal direct：如果需要真正 Matrix DM，需要写入/维护 `m.direct` account data，而不是只创建双人 room。
4. 优化 People 去重：多个同一 peer 的 1v1 room 是否聚合，需要产品规则。
5. 完善成员管理权限：当 power level 接口失败时，按钮应更明确地显示不可判定。
6. 做视频会议、屏幕共享的独立设计，不和普通消息发送混在同一轮实现。
