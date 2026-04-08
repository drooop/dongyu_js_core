---
title: "Matrix Userline Phase 2"
doc_type: user-guide
status: active
updated: 2026-04-08
source: ai
---

# Matrix Userline Phase 2

## 这一步做了什么

`0284` 把 `0283` 的“最小登录 + 单会话一发一收”扩成了真正可用的基础聊天界面：

- 房间列表
- 当前房间时间线
- 当前房间输入框
- 当前房间成员面板

仍然保持非加密，仍然走方案 A，也就是继续经 `MBR` / `dy.bus.v0`。

## 模型分工

- `1016`
  - Workspace 可见 app host。
  - 负责把页面骨架投影出来。
- `1017`
  - 登录 / session 真值。
- `1018`
  - 房间目录真值。
- `1019`
  - 当前房间会话真值。
  - 包括当前房间 id、时间线文本、当前回包状态。
- `1020`
  - 当前房间成员真值。
- `1021`
  - 聊天 UI-only state。
  - 当前输入框草稿和成员面板开关在这里。

## 页面怎么看

打开 Workspace 后，`0284 Matrix Chat Phase 2` 会显示 4 块：

1. `1. 最小登录`
2. `2. Rooms`
3. `3. Timeline`
4. `4. Members`

### Rooms

- 现在至少有两间种子房间：
  - `Phase 1 Echo Room`
  - `Phase 2 Team Room`
- 点击房间按钮后：
  - 当前房间标题会切换
  - 时间线会切换
  - 成员摘要会切换

### Timeline

- 当前时间线显示的是“当前房间”的内容，不是全局消息池。
- 发送消息时：
  - 读取的是 `1021.composer_draft`
  - 出站仍然用 `pin_payload`
  - 回包后会追加到当前房间的 timeline

### Members

- 成员面板显示的是“当前房间”的成员，不是全局用户列表。
- 现在只做基础成员展示：
  - 展示名
  - user id
  - presence
- 不包含复杂权限治理。

## 当前范围不做什么

- 不做注册 / 资料编辑 / 在线状态完整产品面
- 不做视频通话
- 不做任何加密能力
- 不切到方案 B

这些都留给后续 `0285 / 0286`。

## 最短验证步骤

1. 打开 Workspace。
2. 找到 `0284 Matrix Chat Phase 2`。
3. 点击 `Open Team Room`。
4. 确认房间标题切到 `Phase 2 Team Room`。
5. 确认 timeline 变成 group seed messages。
6. 确认成员摘要切到 team room 三人列表。
7. 在输入框输入一段文本并点击 `Send Message`。
8. 确认 timeline 中追加本地消息和 `echo:` 回包。

## 本轮本地验收事实

- `Open Team Room` 已验证可切换当前房间。
- `phase2 browser hello` 已验证能在当前 group room 成功一发一收。
- `0270`、`Model 100`、`Static` 已一起回归，无页面退化。
