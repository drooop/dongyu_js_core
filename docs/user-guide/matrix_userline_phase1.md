---
title: "Matrix Userline Phase 1"
doc_type: user-guide
status: active
updated: 2026-04-06
source: ai
---

# Matrix Userline Phase 1

这是 `0283` 的最小可运行版本。

目标只有三件事：

1. 在 Workspace 里出现一个正式条目  
2. 用真实 Matrix 账号完成一次最小登录  
3. 通过 `MBR` 双总线发一条消息，并收到 remote-worker 回来的第一条回复

## 对应模型

- `1016`
  - Workspace 可见 app host
- `1017`
  - 最小登录 / session truth
- `1018`
  - 最小房间目录 truth
- `1019`
  - 当前会话 truth

## 当前页面能做什么

- 输入 homeserver、username、password
- 点击 `Login`
- 看到 `authenticated` 与当前用户 id
- 在单会话房间里输入一条消息
- 点击 `Send One Message`
- 页面下方显示：
  - 最新发出的文本
  - remote-worker 返回的 echo 文本

## 当前明确不做什么

- 不做注册
- 不做资料编辑
- 不做在线状态
- 不做私聊 / 群聊完整房间列表
- 不做任何加密
- 不做视频通话

这些内容留给：

- `0284`
- `0285`
- `0286`

## 本地验证步骤

1. 打开：
   - `http://localhost:30900/#/workspace`
2. 在 Workspace 侧边栏打开：
   - `0283 Matrix Chat Phase 1`
3. 填登录表单
   - `Homeserver URL`: `https://matrix.localhost`
   - `Username`: 你当前本地 Synapse 中存在的用户
   - `Password`: 对应密码
4. 点击 `Login`
5. 看到状态变成：
   - `authenticated`
6. 在消息框输入任意文本
7. 点击 `Send One Message`
8. 等待页面状态从：
   - `loading`
   变成
   - `remote_processed`
9. 页面最下方应显示 remote-worker 回来的 echo 文本

## 如果本地没有可登录用户

可以在本地 k8s Synapse 里注册一个测试用户：

```bash
kubectl exec -n dongyu deploy/synapse -- \
  register_new_matrix_user \
  -u phase1demo \
  -p Phase1Demo123 \
  -c /data/homeserver.yaml \
  --no-admin \
  http://localhost:8008
```

注册后，直接在页面里用这个用户名和密码登录即可。

## 当前链路口径

- 登录：
  - 页面写入 `1017`
  - 宿主侧完成最小 Matrix password login
  - 结果回写 `1017`
- 发消息：
  - 页面写入 `1019`
  - `1019` 走方案 A，经 `MBR` 发出 `pin_payload`
  - `remote-worker` 处理后回写 `result`
  - `ui-server` 再把回包 materialize 到 `1019`

所以这条线已经证明：

- Matrix 用户产品层可以落在正数模型里
- 最小登录可以先于完整聊天产品存在
- 聊天消息当前确实能先走 `MBR` 双总线，而不是直接走前端独立 Matrix client
