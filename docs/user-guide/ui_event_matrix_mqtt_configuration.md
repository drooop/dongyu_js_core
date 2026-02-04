# UI 事件通过 Matrix/MQTT 到达设备的配置指南

**适用场景**: 将 Web UI 的操作（点击、输入等）通过 Matrix 管理总线和 MQTT 控制总线发送到远程设备

**前置条件**:
- Matrix homeserver 已部署
- MQTT broker 已部署
- drop 用户和 mbr 用户已创建
- DM room 已建立

## 一、架构概览

```
用户点击 UI
    ↓
浏览器发送事件
    ↓
后端写入 Mailbox (Cell)
    ↓
程序模型函数监听 Mailbox         ← 你需要配置这一步！
    ↓
调用 ctx.sendMatrix() 发送
    ↓
Matrix → MBR → MQTT → 设备
```

**关键**: 需要配置**程序模型函数**来驱动消息流转。

## 二、配置步骤

### 步骤 1: 确认 Matrix 配置

在 System Model (Model -10) 中必须有以下 labels：

| Cell | k | t | v |
|------|---|---|---|
| (0,0,0) | `matrix_room_id` | `str` | DM room ID（例: `!abc:localhost`）|
| (0,0,1) | `matrix_dm_peer_user_id` | `str` | MBR 用户 ID（例: `@mbr:localhost`）|

**验证方法**（浏览器控制台）：

```javascript
const snap = window.__DY_STORE.snapshot;
const sys = snap.models[-10];
const roomId = sys?.data
  ?.flatMap(c => Array.from(c.labels.entries()))
  .find(([k]) => k === 'matrix_room_id')?.[1]?.v;
console.log('Room ID:', roomId);
```

如果为空，需要通过 mt.v0 patch 添加。参考 `packages/worker-base/system-models/matrix_config.json`。

### 步骤 2: 创建程序模型函数

在 System Model (-10) 中添加一个 `type: "function"` 的 label。

**方法 A: 通过 JSON patch 文件**

创建 `packages/worker-base/system-models/ui_to_matrix_forwarder.json`：

```json
{
  "version": "mt.v0",
  "op_id": "ui_to_matrix_forwarder_v0",
  "records": [
    {
      "op": "add_label",
      "model_id": -10,
      "p": 1,
      "r": 0,
      "c": 0,
      "k": "forward_ui_events",
      "t": "function",
      "v": "const mailbox = ctx.getLabel({ model_id: -1, p: 0, r: 0, c: 1, k: 'ui_event' });\nif (mailbox && mailbox.payload) {\n  const payload = mailbox.payload;\n  console.log('[forward_ui_events] Forwarding:', payload);\n  ctx.sendMatrix({\n    type: 'ui_event',\n    action: payload.action,\n    data: payload,\n    timestamp: Date.now()\n  });\n  // 清空 mailbox\n  ctx.setLabel(\n    { model_id: -1, p: 0, r: 0, c: 1 },\n    { k: 'ui_event', t: 'event', v: null }\n  );\n}"
    }
  ]
}
```

**方法 B: 通过 UI 手动添加**（使用 DataTable 编辑器）

1. 选择 Model -10
2. 添加 Cell (1, 0, 0)
3. 添加 Label:
   - k: `forward_ui_events`
   - t: `function`
   - v: 下面的代码

**函数代码**（易读格式）：

```javascript
const mailbox = ctx.getLabel({
  model_id: -1,
  p: 0, r: 0, c: 1,
  k: 'ui_event'
});

if (mailbox && mailbox.payload) {
  const payload = mailbox.payload;

  // 发送到 Matrix
  ctx.sendMatrix({
    type: 'ui_event',
    action: payload.action || 'unknown',
    data: payload,
    timestamp: Date.now()
  });

  // 清空 mailbox（防止重复处理）
  ctx.setLabel(
    { model_id: -1, p: 0, r: 0, c: 1 },
    { k: 'ui_event', t: 'event', v: null }
  );
}
```

### 步骤 3: 重启后端服务器

```bash
# 停止现有服务器
pkill -f ui-model-demo-server

# 启动服务器（加载新的 system model patch）
bun packages/ui-model-demo-server/server.mjs --port 9000
```

### 步骤 4: 验证配置

**4.1 检查函数是否加载**（浏览器控制台）：

```javascript
const snap = window.__DY_STORE.snapshot;
const sys = snap.models[-10];
const funcs = sys?.data
  ?.flatMap(c => Array.from(c.labels.entries()))
  .filter(([k, l]) => l.t === 'function');
console.log('程序模型函数:', funcs);
```

应该看到 `forward_ui_events`。

**4.2 测试 UI 事件**：

1. 打开 http://127.0.0.1:9000
2. 点击任意操作按钮（例如 Submit）
3. 查看后端日志：

```bash
tail -f <server-log> | grep -i "sendEvent\|forward_ui"
```

应该看到类似：
```
[forward_ui_events] Forwarding: {...}
FetchHttpApi: --> PUT .../rooms/.../send/m.room.message/...
```

**4.3 检查 MBR 是否接收**：

查看 MBR Worker 日志：

```bash
tail -f <mbr-worker-log>
```

应该看到接收到的 Matrix 消息。

## 三、故障排查

### 问题 1: UI 有反应，但 Matrix 没有消息

**原因**: 程序模型函数未配置或未执行

**排查**:
1. 检查 System Model (-10) 是否有 `function` 类型的 label
2. 查看后端日志是否有异常
3. 在函数中添加 `console.log` 调试

### 问题 2: Matrix 连接报错 `matrix_not_ready`

**原因**: System labels 未配置

**解决**: 确认 `matrix_room_id` 和 `matrix_dm_peer_user_id` 存在且正确

### 问题 3: 函数执行但 `ctx.sendMatrix()` 报错

**原因**: MatrixClient 未初始化

**排查**:
1. 检查后端启动日志，确认 Matrix 客户端已登录
2. 检查环境变量：`MATRIX_MBR_USER`, `MATRIX_MBR_PASSWORD` 或 `MATRIX_MBR_ACCESS_TOKEN`

## 四、高级配置

### 条件转发

只转发特定 action 的事件：

```javascript
const mailbox = ctx.getLabel({ model_id: -1, p: 0, r: 0, c: 1, k: 'ui_event' });
if (mailbox && mailbox.payload) {
  const action = mailbox.payload.action;

  // 只转发 PIN_OUT 相关事件
  if (action === 'send_pin_out' || action === 'declare_pin_out') {
    ctx.sendMatrix({
      type: 'control',
      action,
      data: mailbox.payload,
      timestamp: Date.now()
    });
  }

  // 清空
  ctx.setLabel(
    { model_id: -1, p: 0, r: 0, c: 1 },
    { k: 'ui_event', t: 'event', v: null }
  );
}
```

### 消息变换

转发前修改 payload 格式：

```javascript
const mailbox = ctx.getLabel({ model_id: -1, p: 0, r: 0, c: 1, k: 'ui_event' });
if (mailbox && mailbox.payload) {
  const orig = mailbox.payload;

  // 转换为设备控制协议格式
  const devicePayload = {
    device_id: orig.meta?.device_id || 'default',
    command: orig.action,
    params: orig.data,
    sent_at: Date.now()
  };

  ctx.sendMatrix(devicePayload);

  ctx.setLabel(
    { model_id: -1, p: 0, r: 0, c: 1 },
    { k: 'ui_event', t: 'event', v: null }
  );
}
```

## 五、相关文档

- **架构文档**: `docs/ssot/ui_to_matrix_event_flow.md` - 完整技术实现
- **Patch 操作**: `docs/ssot/mt_v0_patch_ops.md` - 如何修改 ModelTable
- **Runtime API**: `docs/ssot/host_ctx_api.md` - `ctx` 对象的完整 API
