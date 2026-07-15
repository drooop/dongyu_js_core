---
title: "UI 事件到双总线的完整流转机制"
doc_type: ssot
status: active
updated: 2026-07-16
source: ai
---

# UI 事件到双总线的完整流转机制

## Positioning

- Authority: below `CLAUDE.md`, architecture SSOT, runtime semantics, label registry, and current PIN / payload contracts.
- Scope: current UI event flow through ModelTable, program models, control bus, optional management bus, MQTT, and device PIN delivery.
- Rule type: current flow description plus target constraints where explicitly marked.
- Conflict behavior: if current flow language conflicts with `pin_connection_contract_v2.md`, `temporary_modeltable_payload_v1.md`, or runtime semantics, those higher-priority SSOT docs win.

## 概述

本文档详细说明 UI 事件如何通过 ModelTable、程序模型和 split bus 最终到达设备 PIN：默认 control 由 UI Server 的 MQTT adapter 直达目标 Worker；显式 management 才通过 Matrix/Synapse 与 MBR。

## 完整数据流

说明：
- 程序模型不暴露 direct Matrix send helper。
- 自 0187 起，UI 侧已不再存在 legacy `mailbox -> forward_ui_events -> direct Matrix send` 默认旁路。
- 当前正式业务 submit 使用 POST `/bus_event`，body 必须是 `bus_event_v2`；server 校验后写入 Model 0 `(0,0,0)` 的 `pin.bus.cb.in`，再通过 pin route 到目标模型。
- 所有浏览器 `bus_event_v2` submit 统一先进入 Model 0 `pin.bus.cb.in`，不因后续 transport 选择而改写浏览器 ingress pin。
- `/ui_event` 只可作为接受同一份 `bus_event_v2` body 的 compatibility URL alias，不构成另一套业务协议。
- 当前 canonical app-level 外发路径是：
  - 目标模型处理经 Model 0 ingress 到达的正式事件
  - 模型内函数或 relay 写 root `pin.out`
  - 逐层 relay 到 Model 0
  - 默认仅 Model 0 `pin.bus.cb.out` / 等价宿主观察点触发控制总线 bridge
- 系统边界已拆分：浏览器业务统一从 `pin.bus.cb.in` 进入目标模型；control 由目标模型外发到 `pin.bus.cb.out`，management 由目标模型外发 payload 显式写 `bus=management` 与 `route_kind=management` 后选择 `pin.bus.mb.out` 和 Matrix/Synapse/MBR。`pin.bus.mb.in` 属于 management transport ingress，不是浏览器 submit 入口。
- Model 0 之后的“pin ingress / routing”解释属于 Tier 1 runtime；`server` 只负责 envelope 校验与 transport / adapter。

历史/debug intent 边界：
- pre-0326 的 `/ui_event -> Model -1 ui_event mailbox` 只保留为历史/debug intent 说明，不是 current business submit。
- 0213 的 `matrix_debug_refresh` / `matrix_debug_clear_trace` / `matrix_debug_summarize` 属于 debug surface safe ops。
- 它们的 canonical path 是：
  - UI 写 `Model -1` mailbox
  - `intent_dispatch_table` 命中 `Model -10` handler
  - handler 调 `server.mjs` hostApi
  - host 只回写 `Model -2` 投影状态与 `Model -100` trace/debug state
- 这些动作不得 direct-write business model，不得 direct `sendMatrix`，也不是 `Model 100` submit chain 的替代入口。

```
正式业务事件 (Browser)
  ↓ [POST /bus_event, type=bus_event_v2]
UI Server envelope validator
  ↓ [temporary ModelTable record array]
Model 0 pin.bus.cb.in
  ↓ [pin route]
目标模型程序
  ↓ [root pin.out -> host relay -> Model 0 egress]
Model 0 pin.bus.cb.out
  ↓ [pin.bus.cb.out bridge]
UI Server MQTT adapter
  ↓ [publish payload.topic]
本地 MQTT Broker
  ↓ [MQTT subscribe]
远程 Worker pin.bus.cb.in
```

当且仅当 management 由目标模型外发且 payload 显式携带 `bus=management` 与 `route_kind=management` 时，上述 egress transport 分支改为 `UI Server -> 本地 Matrix/Synapse -> MBR -> 本地 MQTT Broker -> 远程 Worker`；浏览器 ingress 仍统一是 `pin.bus.cb.in`，不得把 management 分支写成另一条浏览器入口或默认 control 路径。

## 关键组件

### 1. 正式业务事件提交 (`POST /bus_event`)

**关键点**:
- 前端发送 `type=bus_event_v2` envelope，`value` 已经是临时 ModelTable record array。
- 后端完成 current envelope 校验后，把所有浏览器业务统一写入 Model 0 `pin.bus.cb.in`；目标模型处理后，只有外发 payload 显式写 `bus=management` 与 `route_kind=management` 才选择 Matrix/Synapse/MBR。
- legacy `type=ui_event` 必须拒绝；`/ui_event` compatibility URL 也只能接受当前 `bus_event_v2` body。
- 成功后触发 client snapshot 投影更新：`/stream` 默认以 `bootstrap` profile 连接，初始事件只发送该 profile 的 `snapshot`；打开滑动 APP 后，客户端用 table-qualified `visibleModelRefs` 明确订阅已加载模型，后续在同一会话和同一 profile 可见范围内优先发送 `snapshot_patch`。
- 权限变化、patch 过大、profile baseline 缺失或序列不匹配时，服务端必须发送可观察的 reset/recovery，或客户端重新拉取当前 profile 的 `/snapshot`；不得静默扩展为完整模型全集。
- 无论传输的是完整 `snapshot` 还是 `snapshot_patch`，它们都只是 ModelTable truth 的前端投影，不得作为绕过 ModelTable 的业务写入通道。

### 2. Model 0 ingress

**浏览器正式入口**: Model 0, p=0, r=0, c=0, t=`pin.bus.cb.in`。`pin.bus.mb.in` 保留给 management transport ingress，不接收浏览器 `bus_event_v2` submit。

Model -1 的 `ui_event` mailbox 只属于历史/debug intent，不得作为正式业务入口或 Model 0 pin chain 的替代路径。

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

Matrix/MQTT 发送由 `ProgramModelEngine` 观察 Model 0 root split bus out pin 后完成。程序模型只能生成 ModelTable-like `pin_payload.v2` records 并写入合法 pin 链路。

**0177 边界补充**：
- `/api/modeltable/patch` 不再作为公共建模入口，固定返回 `direct_patch_api_disabled`
- MBR 只允许标准业务事件桥接；generic CRUD / `create_model` / `cell_clear` 不得再经 Matrix->MBR->MQTT 转发

### 4. 程序模型函数示例

**必需配置**: UI 模型或 imported slide app 在 root 声明 `remote_bus_endpoint_v1` 与 `dual_bus_model.egress_pins`，业务程序只把 Temporary ModelTable records 写到公开 root `pin.out`。UI Server 运行时负责生成 host egress adapter，把 `topic`、`bus=control`、`route_kind=control`、`message_role=request`、endpoint、origin、server-owned reply target 和 `payload_model_id` 写成 `pin_payload.v2` records 后经 Model 0 `mt_bus_send` / `pin.bus.cb.out` 外发；不得恢复旧的 Model 0 egress label/function 或 `ctx.getLabel/writeLabel/rmLabel`。

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
- 如果某个动作需要外发，必须先在模型定义中声明 `remote_bus_endpoint_v1` 与 `dual_bus_model.egress_pins`；实际回包目标由 UI Server 根据本地 App instance `ModelRef` 写入 `reply_target_worker_id` / `reply_target_table_id` / `reply_target_model_id` / `reply_target_pin` records，ZIP 内不得声明 `route.reply_to` 或 `reply_target_*`。

### 5. Control 直连与 Management 经 MBR

**位置**: `scripts/run_worker_v0.mjs`、`scripts/run_worker_remote_v1.mjs`、`packages/ui-model-demo-server/server.mjs`

Control request/response 当前在 UI Server 与 R1 之间通过本地 MQTT 直达，MBR 不桥接、不回显：

```text
UI Server pin.bus.cb.out -> local MQTT -> R1 pin.bus.cb.in
R1 pin.bus.cb.out -> local MQTT response_topic -> UI Server pin.bus.cb.in
```

Management request/response 才通过本地 Matrix/Synapse 与 MBR。MBR 解析 `pin_payload.v2` records，校验 `message_role`、`route_kind=management` 与 `topic`，并在 Matrix management bus 与本地 MQTT control bus 之间各桥接一次。

**现行 product path 约束**：
- Matrix / MQTT bootstrap 只从 Model 0 `(0,0,0)` 读取，不再使用 `mbr_matrix_room_id` / `mbr_mqtt_host` 这类负数模型旧 transport config。
- `mbr_cb_dispatch` 必须通过消息体中的 `topic` record 解析目标 topic，并且只接受合法 `message_role` 与 `route_kind`；缺少 topic、目标不合法、或出现旧 `result_topic` / `return_topic` / `route.reply_to` 时必须拒绝并写错误。
- `mbr_route_<source_model_id>` 不再是当前规约输入面，也不得作为兼容兜底恢复。
- `runtime_mode=edit` 时，MBR 可以建立 Matrix/MQTT 连接，但入站 Matrix/MQTT 消息必须直接丢弃，不得先写 inbox 再等到 `running` 后补处理。
- 当前 canonical 路由是 endpoint-addressed `pin_payload.v2`：
  - control：UI Server -> local MQTT -> R1；response 按 `response_topic` 原路直达 UI Server，MBR no-echo；
  - management：UI Server -> local Matrix/Synapse -> MBR -> local MQTT -> R1；response 只经 MBR 返回一次。

## 疏通检查清单

要使默认 UI → local MQTT → R1 control 链路工作，必须满足；只有 management 语义才额外要求 Matrix/MBR：

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
- [x] UI Server 与目标 remote-worker 已连接本地 MQTT
- [x] management 验收时 MBR Worker 已启动并同时连接 Matrix/MQTT

### 程序模型配置
- [ ] **System Model (-10) 中存在 function label**
- [ ] **函数写入合法 `pin_payload.v2` 到 split bus pin 链路**
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
