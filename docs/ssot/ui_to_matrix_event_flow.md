---
title: "UI 事件到双总线的完整流转机制"
doc_type: ssot
status: active
updated: 2026-05-10
source: ai
---

# UI 事件到双总线的完整流转机制

## Positioning

- Authority: below `CLAUDE.md`, architecture SSOT, runtime semantics, label registry, and current PIN / payload contracts.
- Scope: current UI event flow through ModelTable, program models, control bus, optional management bus, MQTT, and device PIN delivery.
- Rule type: current flow description plus target constraints where explicitly marked.
- Conflict behavior: if current flow language conflicts with `pin_connection_contract_v2.md`, `temporary_modeltable_payload_v1.md`, or runtime semantics, those higher-priority SSOT docs win.

## 概述

本文档详细说明 UI 事件如何通过 ModelTable、程序模型、控制总线、MBR、MQTT 总线最终到达设备 PIN 的完整链路。显式管理语义可以由 MBR 转入管理总线，但不是同工作区默认路径。

## 完整数据流

说明：
- 程序模型不暴露 direct Matrix send helper。
- 自 0187 起，UI 侧已不再存在 legacy `mailbox -> forward_ui_events -> direct Matrix send` 默认旁路。
- 当前 canonical app-level 外发路径是：
  - UI 写 mailbox / 模型内本地状态
  - 模型内函数或 relay 写 root `pin.out`
  - 逐层 relay 到 Model 0
  - 默认仅 Model 0 `pin.bus.cb.out` / 等价宿主观察点触发控制总线 bridge
- 系统边界已拆分：同工作区 UI/滑动 App 默认使用 `pin.bus.cb.in` / `pin.bus.cb.out`，显式管理语义使用 `pin.bus.mb.in` / `pin.bus.mb.out`。
- mailbox 之后的“事件 -> pin ingress / routing”解释属于 Tier 1 runtime；`server` 只负责 transport / adapter。

0213 Matrix debug 补充：
- `matrix_debug_refresh` / `matrix_debug_clear_trace` / `matrix_debug_summarize` 属于 debug surface safe ops。
- 它们的 canonical path 是：
  - UI 写 `Model -1` mailbox
  - `intent_dispatch_table` 命中 `Model -10` handler
  - handler 调 `server.mjs` hostApi
  - host 只回写 `Model -2` 投影状态与 `Model -100` trace/debug state
- 这些动作不得 direct-write business model，不得 direct `sendMatrix`，也不是 `Model 100` submit chain 的替代入口。

```
UI 事件 (Browser)
  ↓ [POST /ui_event]
后端服务器 (server.mjs)
  ↓ [submitEnvelope()]
Mailbox 写入 (Model -1, Cell 0,0,1)
  ↓ [adapter.consumeOnce() + runtime/app functions]
本地 dispatch / model relay
  ↓ [only if explicit route reaches Model 0 egress]
Model 0 egress function
  ↓ [pin.bus.cb.out bridge]
控制总线消息发送 (MQTT / worker-owned control topic)
  ↓ [MBR 读取 payload.topic]
MBR Worker 接收并转发
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
  const matrixConfig = readMatrixBootstrapConfig(this.runtime);
  this.matrixRoomId = matrixConfig.roomId || '';
  this.matrixDmPeerUserId = matrixConfig.peerUserId || '';
  if (this.matrixRoomId) {
    this.matrixAdapter = await createMatrixLiveAdapter({
      roomId: this.matrixRoomId,
      peerUserId: this.matrixDmPeerUserId || undefined,
      homeserverUrl: matrixConfig.homeserverUrl || undefined,
      accessToken: matrixConfig.accessToken || undefined,
      userId: matrixConfig.userId || undefined,
      password: matrixConfig.password || undefined,
    });
  }
  this.started = true;
}
```

**必需的启动来源**：
- `MODELTABLE_PATCH_JSON` 在进程启动时先写入 ModelTable
- Matrix / MQTT 运行参数只从 **Model 0 (0,0,0)** 读取
- `ui-server` 启动后默认停在 `runtime_mode=edit`
- 只有显式 `POST /api/runtime/mode { "mode": "running" }` 之后，UI 事件才允许真正向 Matrix/MBR 继续传播
- headless worker（如 `mbr-worker`）在 bootstrap 与连接准备完成后自动进入 `running`

**必需的 Matrix labels** (Model 0, Cell 0,0,0):
- `matrix_room_id` / `str`
- `matrix_server` / `matrix.server`
- `matrix_user` / `matrix.user`
- `matrix_passwd` / `matrix.passwd`（可选，存在 token 时可省略）
- `matrix_token` / `matrix.token`
- `matrix_contuser` / `matrix.contuser`

#### 函数执行上下文 (`ctx`)

```javascript
const ctx = {
  // Restricted runtime view
  runtime: runtimeView,

  // MQTT API
  mqttPublish: (topic, payload) => { /* ... */ },
  mqttIncoming: (topic, payload) => { /* ... */ },
  startMqttLoop: () => { /* ... */ },

  // System bridge API for approved negative-model/server functions
  hostApi: {
    readCrossModel: (model_id, p, r, c, k) => { /* ... */ },
    writeCrossModel: (model_id, p, r, c, k, t, v) => { /* ... */ },
    rmCrossModel: (model_id, p, r, c, k) => { /* ... */ },
  },

  // No direct Matrix/MQTT send helper is exposed to user program models.
};
```

Matrix/MQTT 发送由 `ProgramModelEngine` 观察 Model 0 root split bus out pin 后完成。程序模型只能生成 ModelTable-like `pin_payload.v1` records 并写入合法 pin 链路。

**0177 边界补充**：
- `/api/modeltable/patch` 不再作为公共建模入口，固定返回 `direct_patch_api_disabled`
- MBR 只允许标准业务事件桥接；generic CRUD / `create_model` / `cell_clear` 不得再经 Matrix->MBR->MQTT 转发

### 4. 程序模型函数示例

**必需配置**: UI 模型或 imported slide app 在 root 声明 `remote_bus_endpoint_v1` 与 `dual_bus_model.egress_pins`，业务程序只把 Temporary ModelTable records 写到公开 root `pin.out`。UI Server 运行时负责生成 host egress adapter，把 `topic`、`route_kind=control`、`message_role=request`、endpoint、origin 和 server-owned reply target 写成 `pin_payload.v1` records 后经 Model 0 `mt_bus_send` / `pin.bus.cb.out` 外发；不得恢复旧的 Model 0 egress label/function 或 `ctx.getLabel/writeLabel/rmLabel`。

```javascript
// 示例：业务程序只准备模型表形态 payload，并写到公开 root pin.out。
const payload = [
  { id: 0, p: 0, r: 0, c: 0, k: '__mt_payload_kind', t: 'str', v: 'ui_event.v1' },
  { id: 0, p: 0, r: 0, c: 0, k: 'message_text', t: 'str', v: 'hello' },
];
V1N.addLabel('submit', 'pin.out', payload);
```

**注意**:
- 不再推荐把 mailbox 中的任意 `ui_event` 直接默认转发到 Matrix。
- 如果某个动作需要外发，必须先在模型定义中声明 `remote_bus_endpoint_v1` 与 `dual_bus_model.egress_pins`；实际回包目标由 UI Server 根据本地安装模型 id 写入 `reply_target_worker_id` / `reply_target_model_id` / `reply_target_pin` records，ZIP 内不得声明 `route.reply_to` 或 `reply_target_*`。

### 5. MBR Worker 接收和转发

**位置**: `scripts/run_worker_mbr_v0.mjs`

MBR Worker 监听 Matrix room 的消息，解析 `pin_payload.v1` Temporary ModelTable records，然后：
1. 读取消息内 `topic` record
2. 校验 `message_role=request` 和可选 `route_kind`
3. 校验 topic 正好是 `UIPUT/<ws>/<dam>/<pic>/<de>/<sw>/<worker_id>/<model_id>/<pin>`
4. 发布到 MQTT broker；默认控制总线转控制总线，显式 `route_kind=management` 才转管理总线
5. remote-worker 通过 `pin.bus.cb.in` / root route 接收；remote-worker 回包时仍发布到同一个 endpoint topic，但 `message_role=response`

**现行 product path 约束**：
- Matrix / MQTT bootstrap 只从 Model 0 `(0,0,0)` 读取，不再使用 `mbr_matrix_room_id` / `mbr_mqtt_host` 这类负数模型旧 transport config。
- `mbr_cb_dispatch` 必须通过消息体中的 `topic` record 解析目标 topic，并且只接受合法 `message_role` 与 `route_kind`；缺少 topic、目标不合法、或出现旧 `result_topic` / `return_topic` / `route.reply_to` 时必须拒绝并写错误。
- `mbr_route_<source_model_id>` 不再是当前规约输入面，也不得作为兼容兜底恢复。
- `runtime_mode=edit` 时，MBR 可以建立 Matrix/MQTT 连接，但入站 Matrix/MQTT 消息必须直接丢弃，不得先写 inbox 再等到 `running` 后补处理。
- 当前 canonical 业务桥接是 endpoint-addressed `pin_payload.v1`：
  - Control bus packet -> MBR -> MQTT `UIPUT/<ws>/<dam>/<pic>/<de>/<sw>/<worker_id>/<model_id>/<pin>`
  - MQTT control bus result -> MBR -> control bus packet -> owner materialization

## 疏通检查清单

要使默认 UI → control bus → MBR → MQTT 链路工作，必须满足：

### Management bus 配置（仅显式管理语义需要）
- [x] Matrix homeserver 可达
- [x] drop 用户已创建
- [x] mbr 用户已创建
- [x] DM room 已创建，双方已加入
- [x] `MODELTABLE_PATCH_JSON` 已写入 Model 0：
  - `matrix_room_id`
  - `matrix_server`
  - `matrix_user`
  - `matrix_token`
  - `matrix_contuser`

### MQTT 配置
- [x] MQTT broker 可达
- [x] MBR Worker 已启动并连接

### 程序模型配置
- [ ] **System Model (-10) 中存在 function label**
- [ ] **函数写入合法 `pin_payload.v1` 到 split bus pin 链路**
- [ ] **函数在 `tick()` 时被执行**

## 常见问题

### Q: UI 点击后有反应，但 MQTT / MBR 没有消息？

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

### Q: 如何调试显式管理总线是否真的发送？

**A**: 查看后端日志，搜索 `sendEvent` 或 `m.room.message`：

```bash
tail -f <server-log> | grep -i "sendEvent\|room.message"
```

### Q: Matrix 连接成功但没有监听到消息？

**A**: 检查 `matrix_contuser` 是否正确配置。程序引擎只接受来自指定 peer 的消息。

## 参考文档

- `docs/architecture_mantanet_and_workers.md` - 整体架构
- `docs/ssot/mt_v0_patch_ops.md` - ModelTable patch 操作
- `docs/user-guide/ui_event_matrix_mqtt_configuration.md` - 用户配置指南
