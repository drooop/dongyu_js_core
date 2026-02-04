# UI 事件到 Matrix 的完整流转机制

**文档状态**: SSOT (Single Source of Truth)
**创建日期**: 2026-02-04
**最后更新**: 2026-02-04

## 概述

本文档详细说明 UI 事件如何通过 ModelTable、程序模型、Matrix 总线、MQTT 总线最终到达设备 PIN 的完整链路。

## 完整数据流

```
UI 事件 (Browser)
  ↓ [POST /ui_event]
后端服务器 (server.mjs)
  ↓ [submitEnvelope()]
Mailbox 写入 (Model -1, Cell 0,0,1)
  ↓ [adapter.consumeOnce()]
LocalBusAdapter 消费
  ↓ [programEngine.tick()]
程序模型函数执行
  ↓ [ctx.sendMatrix(payload)]
Matrix 消息发送 (drop → mbr DM room)
  ↓ [Matrix Room.timeline 事件]
MBR Worker 接收
  ↓ [MQTT publish]
MQTT Broker
  ↓ [MQTT subscribe]
远程 Worker PIN_IN
```

## 关键组件

### 1. UI 事件提交 (`POST /ui_event`)

**位置**: `packages/ui-model-demo-server/server.mjs:1540`

```javascript
if (req.method === 'POST' && url.pathname === '/ui_event') {
  const body = await readJsonBody(req);
  const envelope = body && body.payload && body.type ? body : body.envelope;
  const consumeResult = await state.submitEnvelope(envelope);
  broadcastSnapshot();
  // 返回 200 OK
}
```

**关键点**:
- 前端发送 envelope（包含 payload 和 type）
- 后端调用 `submitEnvelope()` 处理
- 成功后广播 snapshot 给所有 SSE 客户端

### 2. Mailbox 写入 (`submitEnvelope`)

**位置**: `packages/ui-model-demo-server/server.mjs:923`

```javascript
async function submitEnvelope(envelopeOrNull) {
  // 第一步：写入 mailbox
  setMailboxEnvelope(runtime, envelopeOrNull);

  // 处理各种 action...

  // 最后：adapter 消费 + 程序引擎执行
  const result = adapter.consumeOnce();
  updateDerived();
  await programEngine.tick();
  return result;
}
```

**Mailbox Cell 位置**: Model -1, p=0, r=0, c=1, k='ui_event'

### 3. 程序模型引擎 (`ProgramModelEngine`)

**位置**: `packages/ui-model-demo-server/server.mjs:382`

#### 初始化 (`init()`)

```javascript
async init() {
  this.refreshFunctionRegistry();
  const roomLabel = findSystemLabel(this.runtime, 'matrix_room_id');
  this.matrixRoomId = roomLabel ? String(roomLabel.label.v || '') : '';
  const peerLabel = findSystemLabel(this.runtime, 'matrix_dm_peer_user_id');
  this.matrixDmPeerUserId = peerLabel ? String(peerLabel.label.v || '') : '';
  if (this.matrixRoomId) {
    this.matrixClient = await createMatrixClient();
    this.startMatrixListener();
  }
  this.started = true;
}
```

**必需的 System Labels** (Model -10):
- `matrix_room_id`: Matrix DM room ID (例: `!rvgIBRtgXATQGGRWiS:localhost`)
- `matrix_dm_peer_user_id`: MBR 用户 ID (例: `@mbr:localhost`)

#### 函数执行上下文 (`ctx`)

**位置**: `packages/ui-model-demo-server/server.mjs:520-553`

```javascript
const ctx = {
  // Runtime API
  getLabel: (ref) => { /* ... */ },
  setLabel: (ref, label) => { /* ... */ },

  // MQTT API
  mqttPublish: (topic, payload) => { /* ... */ },
  mqttIncoming: (topic, payload) => { /* ... */ },
  startMqttLoop: () => { /* ... */ },

  // Matrix API - 关键！
  sendMatrix: (payload) => this.sendMatrix(payload),
};
```

**`ctx.sendMatrix(payload)` 实现**:

```javascript
async sendMatrix(payload) {
  if (!this.matrixClient || !this.matrixRoomId) {
    throw new Error('matrix_not_ready');
  }
  if (!this.matrixDmPeerUserId) {
    throw new Error('matrix_dm_peer_user_id_required');
  }
  const body = JSON.stringify(payload);
  await this.matrixClient.sendEvent(this.matrixRoomId, 'm.room.message', {
    msgtype: 'm.text',
    body,
  });
}
```

### 4. 程序模型函数示例

**必需配置**: 在 System Model (-10) 中创建 `type: "function"` 的 label

```javascript
// 示例：监听 mailbox 并转发到 Matrix
const mailbox = ctx.getLabel({
  model_id: -1,
  p: 0, r: 0, c: 1,
  k: 'ui_event'
});

if (mailbox && mailbox.payload) {
  // 转发到 Matrix
  ctx.sendMatrix({
    type: 'ui_event',
    payload: mailbox.payload,
    timestamp: Date.now()
  });

  // 清空 mailbox（可选）
  ctx.setLabel(
    { model_id: -1, p: 0, r: 0, c: 1 },
    { k: 'ui_event', t: 'event', v: null }
  );
}
```

**存储位置**:
- Model: -10 (System)
- Cell: 任意 (例如 p=1, r=0, c=0)
- Label: `k: "forward_ui_to_matrix"`, `t: "function"`, `v: "<上述代码>"`

### 5. MBR Worker 接收和转发

**位置**: `scripts/run_worker_mbr_v0.mjs`

MBR Worker 监听 Matrix room 的消息，解析 JSON payload，然后：
1. 识别目标 MQTT topic
2. 发布到 MQTT broker
3. 远程 Worker 通过 PIN_IN 接收

## 疏通检查清单

要使 UI → Matrix → MQTT 链路工作，必须满足：

### Matrix 配置
- [x] Matrix homeserver 可达
- [x] drop 用户已创建
- [x] mbr 用户已创建
- [x] DM room 已创建，双方已加入
- [x] System labels 已配置：
  - `matrix_room_id`
  - `matrix_dm_peer_user_id`

### MQTT 配置
- [x] MQTT broker 可达
- [x] MBR Worker 已启动并连接

### 程序模型配置
- [ ] **System Model (-10) 中存在 function label**
- [ ] **函数包含 `ctx.sendMatrix()` 调用**
- [ ] **函数在 `tick()` 时被执行**

## 常见问题

### Q: UI 点击后有反应，但 Matrix 没有消息？

**A**: 检查程序模型函数是否配置。运行：

```javascript
// 浏览器控制台
const snap = window.__DY_STORE.snapshot;
const systemModel = snap.models[-10];
const functions = systemModel?.data
  ?.flatMap(c => Array.from(c.labels.entries()))
  .filter(([k, l]) => l.t === 'function');
console.log('Functions:', functions);
```

如果为空，说明**缺少程序模型函数**。

### Q: 如何调试 `sendMatrix` 是否被调用？

**A**: 查看后端日志，搜索 `sendEvent` 或 `m.room.message`：

```bash
tail -f <server-log> | grep -i "sendEvent\|room.message"
```

### Q: Matrix 连接成功但没有监听到消息？

**A**: 检查 `matrix_dm_peer_user_id` 是否正确配置。程序引擎只接受来自指定 peer 的消息。

## 参考文档

- `docs/architecture_mantanet_and_workers.md` - 整体架构
- `docs/ssot/mt_v0_patch_ops.md` - ModelTable patch 操作
- `docs/user-guide/ui_event_matrix_mqtt_guide.md` - 用户配置指南
