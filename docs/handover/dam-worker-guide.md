# DAM Worker 开发指南：软件工人与总线交互架构

> 前置知识：了解 MQTT、Matrix 协议基础概念
> 参考实现：Model 100 颜色生成器（完整 E2E 双总线样板）

---

## 1. 架构总览

```
┌──────────┐      HTTP         ┌──────────────┐     Matrix (dy.bus.v0)    ┌────────────┐
│  前端 UI  │ ──────────────→  │  UI Server    │ ←─────────────────────→  │ MBR Worker │
│ (Vue3)   │  POST /ui_event  │  (Bun)        │   管理总线：事件转发      │ (Node.js)  │
└──────────┘  GET  /snapshot   └──────────────┘   心跳、snapshot_delta    └─────┬──────┘
                                                                                │
                                                                          MQTT (mt.v0)
                                                                          数据总线
                                                                                │
                                                                        ┌───────┴────────┐
                                                                        │  K8s Worker    │
                                                                        │  (你的 DAM)    │
                                                                        └────────────────┘
```

**双总线分工：**

| 总线 | 协议 | 传输内容 | 两端 |
|------|------|----------|------|
| 管理总线 | Matrix 自定义事件 `dy.bus.v0` | 事件转发、心跳、patch 回写 | Server ↔ MBR |
| 数据总线 | MQTT + JSON | mt.v0 patch（命令与数据） | MBR ↔ K8s Worker |

**你的 DAM Worker 位于 K8s Worker 层**，通过 MQTT 与 MBR 通信。MBR 负责 Matrix↔MQTT 的桥接，你不需要直接连 Matrix。

---

## 2. 核心数据结构

### 2.1 Label — 最小数据单元

```json
{ "k": "bg_color", "t": "str", "v": "#FF0000" }
```

| 字段 | 含义 | 说明 |
|------|------|------|
| `k` | key | 标识名，同一 Cell 内唯一 |
| `t` | type | 类型标记（见下表） |
| `v` | value | 任意 JSON 可序列化值 |

**常用 type 值：**

| t | 用途 | v 的类型 |
|---|------|----------|
| `str` | 字符串 | `string` |
| `int` | 整数 | `number` |
| `bool` | 布尔 | `boolean` |
| `json` | 任意结构化数据 | `object` / `array` |
| `event` | UI 事件 | `object` |
| `function` | 程序模型函数 | `string`（JS 代码） |
| `PIN_IN` | 入站 PIN 声明 | `string`（PIN 名） |
| `PIN_OUT` | 出站 PIN 声明 | `string`（PIN 名） |
| `IN` | PIN 收到的入站数据 | 任意（由发送方决定） |
| `OUT` | PIN 要发出的出站数据 | 任意（通常是 mt.v0 patch） |

### 2.2 Cell — 由四元组寻址

```
(model_id, p, r, c) → Map<k, Label>
```

- `model_id`: 模型 ID（整数）
- `p`: page（页）
- `r`: row（行）
- `c`: column（列）

**Cell 位置约定（重要）：**

| Cell 位置 | 用途 |
|-----------|------|
| `(model_id, 0, 0, 0)` | 业务数据 — 存放模型的主要数据 label |
| `(model_id, 0, 0, 1)` | PIN 注册 — `PIN_IN` / `PIN_OUT` 声明 |
| `(model_id, 0, 1, 1)` | PIN 邮箱 — `IN` / `OUT` 数据的读写位置 |
| `(model_id, 0, 0, 2)` | UI 事件 — 前端写入的 `ui_event` |
| `(model_id, 1, 0, 0)` | 请求输入 — 外部通过 records `add_label` 写入的业务参数（action、mxc 等） |
| `(-10, 0, 0, 0)` | 系统函数 — 程序模型的 function 定义 |

### 2.3 Model — 模型表中的一张表

```json
{ "id": 100, "name": "test_color_form", "type": "ui" }
```

**Model ID 规划：**

| 范围 | 用途 |
|------|------|
| `< 0` | 系统模型（`-10` 是主系统模型） |
| `0` | 根模型（存 MQTT 配置等） |
| `1~999` | 普通用户模型 |
| `1000~1999` | 系统内置应用 |
| `2000+` | 用户安装应用 |

---

## 3. mt.v0 Patch 格式

**这是总线上传递的核心数据格式。** 所有模型表变更都通过 patch 描述。

```json
{
  "version": "mt.v0",
  "op_id": "unique_operation_id",
  "records": [
    {
      "op": "create_model",
      "model_id": 100,
      "name": "model_name",
      "type": "ui"
    },
    {
      "op": "add_label",
      "model_id": 100,
      "p": 0, "r": 0, "c": 0,
      "k": "bg_color", "t": "str", "v": "#38bd7f"
    },
    {
      "op": "rm_label",
      "model_id": 100,
      "p": 0, "r": 0, "c": 0,
      "k": "old_key"
    },
    {
      "op": "cell_clear",
      "model_id": 100,
      "p": 0, "r": 0, "c": 0
    }
  ]
}
```

**支持的 record 操作：**

| op | 必需字段 | 说明 |
|----|----------|------|
| `create_model` | `model_id`, `name`, `type` | 创建新模型 |
| `add_label` | `model_id`, `p`, `r`, `c`, `k`, `t`, `v` | 添加/覆盖 label |
| `rm_label` | `model_id`, `p`, `r`, `c`, `k` | 删除 label |
| `cell_clear` | `model_id`, `p`, `r`, `c` | 清空 cell（保留系统 label） |

**op_id 要求：** 每个 patch 必须有唯一的 `op_id`，MBR 用它做幂等去重。

### 3.1 信封字段 — 纯 records 范式

mt.v0 patch 信封**只有三个字段**：

| 字段 | 是否必需 | 说明 |
|------|----------|------|
| `version` | 必需 | 固定 `"mt.v0"` |
| `op_id` | 必需 | 唯一操作 ID，用于幂等去重 |
| `records` | 必需 | ModelTable 操作指令数组 |

**核心原则：所有业务参数一律通过 `records` 中的 `add_label` 写入请求 Cell。**

包括业务动作标识（`action`）也是一条 label：

```json
{ "op": "add_label", "model_id": 1010, "p": 1, "r": 0, "c": 0,
  "k": "action", "t": "str", "v": "register_asset" }
```

业务参数同理，每个参数是独立的 label：

```json
{ "op": "add_label", "model_id": 1010, "p": 1, "r": 0, "c": 0,
  "k": "mxc", "t": "str", "v": "mxc://localhost/AaBbCcDd" },
{ "op": "add_label", "model_id": 1010, "p": 1, "r": 0, "c": 0,
  "k": "name", "t": "str", "v": "site-v2.zip" }
```

**为什么不用 `data` / `action` 扩展字段？**

1. **SSOT 一致性**：所有状态（包括请求参数）都在 ModelTable 中，runtime 可统一 snapshot / diff / 回放
2. **可观测性**：请求参数写入 Cell 后，调试时可直接查看 ModelTable snapshot，无需解析信封外层
3. **触发机制统一**：`add_label` 写入会触发 eventLog，程序模型可用 trigger_funcs 响应，无需额外分发逻辑
4. **无歧义**：消除 `records` 与 `data` 语义重叠的困惑——只有一个参数传递通道

---

## 4. MQTT Topic 设计 & PIN 机制

### 4.1 Topic 层级结构

> **过渡说明：** 当前代码有两种 topic 模式。旧模式 `uiput_mm_v1` 使用扁平的 `mqtt_topic_base` 字符串（无方向层），新模式 `uiput_9layer_v2` 使用下面的 9 层结构。系统通过 Model 0 Cell(0,0,0) 的 `mqtt_topic_mode` label 切换。两种模式可并存，runtime 自动降级。

```
UIPUT/{dir}/{ws}/{dam}/{pic}/{de}/{sw}/{model}/{pin}
  ①     ②    ③     ④     ⑤    ⑥    ⑦     ⑧      ⑨
```

| 层 | 名称 | 含义 | 示例值 |
|----|------|------|--------|
| ① | UIPUT | 协议命名空间 | `UIPUT`（固定） |
| ② | dir | PIN 方向 | `in`（入站）/ `out`（出站） |
| ③ | ws | 工作区 ID | `ws1`、`default` |
| ④ | dam | DAM 实例 ID | `dam1`（一个工作区可有一个或多个 DAM） |
| ⑤ | pic | PIC ID | `pic1` |
| ⑥ | de | 数字员工 ID | `de1` |
| ⑦ | sw | 软件工人 ID | `sw1`（一个数字员工下可有多个软件工人，1:N） |
| ⑧ | model | 模型 ID | `100`、`1010` |
| ⑨ | pin | PIN 名称 | `event`、`patch`、`upload_cmd` |

**示例（以 Model 100 为例）：**

```
入站: UIPUT/in/ws1/dam1/pic1/de1/sw1/100/event     ← MBR 发给 Worker 的命令
出站: UIPUT/out/ws1/dam1/pic1/de1/sw1/100/patch     ← Worker 发回 MBR 的结果
```

> **注意：** PIN 名称本身不含方向后缀（用 `event` 而非 `event_in`），因为方向已由 topic 第 ② 层 `in`/`out` 表达。

### 4.2 通配符使用

MQTT 提供两种通配符：

| 通配符 | 规则 | 示例 |
|--------|------|------|
| `+` | 匹配单层 | `UIPUT/out/+/dam1/#` — dam1 在所有工作区的出站 |
| `#` | 匹配末尾所有层（必须在最后） | `UIPUT/out/ws1/#` — ws1 的所有出站 |

**常用订阅模式：**

```
# MBR: 订阅所有出站（一条规则收所有 Worker 回传）
UIPUT/out/#

# MBR: 只订阅某工作区的出站
UIPUT/out/ws1/#

# DAM 监控: 某 DAM 域内所有流量（两条订阅）
UIPUT/in/ws1/dam1/#
UIPUT/out/ws1/dam1/#

# 调试: 某软件工人的所有流量
UIPUT/+/ws1/dam1/pic1/de1/sw1/#

# 调试: 某模型的所有流量
UIPUT/+/ws1/dam1/pic1/de1/sw1/100/#

# 全量监控
UIPUT/#
```

**方向放在第 ② 层的设计理由：** MBR 作为桥接层，最常见的需求是"订阅所有 Worker 的出站"。方向在第 ② 层时，`UIPUT/out/#` 一条规则即可，无需按每个 Worker 逐个订阅。

### 4.3 PIN 机制

PIN 是 Worker 的"接口声明"。通过在 Cell `(model_id, 0, 0, 1)` 写入特殊 label 来注册。

> **PIN 命名约定：** PIN 名不含方向后缀（用 `event` 而非 `event_in`），方向由 topic 第 ② 层 `in`/`out` 表达。

```json
// 声明入站 PIN（Worker 会自动订阅对应 MQTT topic）
{ "op": "add_label", "model_id": 100, "p": 0, "r": 0, "c": 1,
  "k": "event", "t": "PIN_IN", "v": "event" }

// 声明出站 PIN（Worker 写 OUT 时自动发布到对应 MQTT topic）
{ "op": "add_label", "model_id": 100, "p": 0, "r": 0, "c": 1,
  "k": "patch", "t": "PIN_OUT", "v": "patch" }
```

**数据流向：**

```
MQTT 入站消息到达（payload 为 mt.v0 patch）→ runtime 三路径处理：

1) records+trigger（推荐）：
  - 当 `records.length > 0`：runtime 先 `applyPatch(patch)` 逐条执行 records（通常写入请求 Cell）
  - 若该 PIN_IN binding 配置了 `trigger_funcs`：runtime 额外写入一条 trigger label `{ k: <pinName 或 binding.target.k>, t: "IN", v: { op_id } }`
    用于触发函数（注意：PIN_IN binding 的 `trigger_funcs` 仅在 `label.t === "IN"` 时触发）

2) records-only：
  - 当 `records.length > 0` 且没有 `trigger_funcs`：只执行 records，执行完即结束

3) fallback（legacy 兼容）：
  - 当 `records.length === 0`：仍写单条 `IN` label 到 legacy PIN mailbox（用于兼容旧 Worker）
    `Cell(model_id, 0, 1, 1) { k: <pinName>, t: "IN", v: <payload> }`

程序模型写 OUT → runtime 自动发布到 MQTT:
  Cell(model_id, 0, 1, 1) 的 label { k: "patch", t: "OUT", v: <mt.v0 patch> }
```

你只需要：
1. 在模型定义中声明 PIN_IN / PIN_OUT
2. 写程序模型函数读 IN、写 OUT
3. Runtime 自动处理 MQTT 订阅/发布

---

## 5. 完整 E2E 数据流（以 Model 100 为例）

```
① 用户点击 "Generate Color" 按钮
   │
② 前端写 mailbox label → POST /ui_event 到 Server
   │
③ Server: submitEnvelope()
   ├─ 写入 Model -1 Cell(0,0,1) mailbox
   ├─ programEngine.tick() → 触发 forward_ui_events
   ├─ adapter.consumeOnce() → label_add 到 Model 100 Cell(0,0,2)
   ├─ programEngine.tick() → 触发 forward_model100_events
   └─ sendMatrix({ version:"v0", type:"ui_event", source_model_id:100, ... })
       │
④ Matrix Room (dy.bus.v0 事件)
       │
⑤ MBR Worker: subscribe 回调
   ├─ 写入 mbr_mgmt_inbox → 触发 mbr_mgmt_to_mqtt
   ├─ 构造 mt.v0 patch
   └─ publishMqtt("UIPUT/in/ws1/dam1/pic1/de1/sw1/100/event", patch)
       │
⑥ MQTT Broker
       │
⑦ K8s Worker: mqttIncoming()                    ← 你的 DAM Worker 在这里
   ├─ 若 patch.records 非空：runtime 先 applyPatch(patch) 执行 records（写入请求参数等）
   ├─ 若该 PIN_IN 配置了 trigger_funcs：runtime 额外写入一条 trigger IN label 触发函数
   ├─ (fallback) 若 records 为空：沿用 legacy mailbox { k:"event", t:"IN", v:<payload> }
   ├─ 程序模型执行：生成颜色 #38bd7f
   ├─ 构造结果 patch: { version:"mt.v0", records:[{op:"add_label",...}] }
   └─ 写入 Cell(100, 0, 1, 1) { k:"patch", t:"OUT", v:<patch> }
        │  runtime 自动发布到 MQTT
       │
⑧ MQTT Broker → "UIPUT/out/ws1/dam1/pic1/de1/sw1/100/patch"
       │
⑨ MBR Worker: recv mqtt OUT
   ├─ 写入 mbr_mqtt_inbox → 触发 mbr_mqtt_to_mgmt
   └─ sendMatrix({ version:"v0", type:"snapshot_delta", payload:<patch> })
       │
⑩ Matrix Room → Server
   ├─ 触发 on_model100_patch_in
   ├─ runtime.applyPatch(patch) → 更新 Model 100 的 bg_color
   └─ 广播 snapshot 给所有前端 SSE 客户端
       │
⑪ 前端 UI 更新：显示新颜色 #38bd7f
```

---

## 6. Model 100 参考实现详解

Model 100 有两个 JSON 定义文件，分别用于不同侧：

### 6.1 K8s Worker 侧（你需要参考的）

**文件：** `packages/worker-base/system-models/test_model_100_full.json`

```json
{
  "version": "mt.v0",
  "op_id": "test_model_100_full_v0",
  "records": [
    // 1. 创建模型
    { "op": "create_model", "model_id": 100, "name": "test_color_form", "type": "ui" },

    // 2. 业务数据 label（Cell 0,0,0）
    { "op": "add_label", "model_id": 100, "p": 0, "r": 0, "c": 0,
      "k": "bg_color", "t": "str", "v": "#FFFFFF" },
    { "op": "add_label", "model_id": 100, "p": 0, "r": 0, "c": 0,
      "k": "status", "t": "str", "v": "ready" },

    // 3. PIN 声明（Cell 0,0,1）— 注意 PIN 名不含方向后缀
    { "op": "add_label", "model_id": 100, "p": 0, "r": 0, "c": 1,
      "k": "event", "t": "PIN_IN", "v": "event" },
    { "op": "add_label", "model_id": 100, "p": 0, "r": 0, "c": 1,
      "k": "patch", "t": "PIN_OUT", "v": "patch" },

    // 4. 程序模型函数（系统模型 -10）
    { "op": "add_label", "model_id": -10, "p": 0, "r": 0, "c": 0,
      "k": "on_model100_event_in", "t": "function",
      "v": "... 见下文 ..." }
  ]
}
```

### 6.2 程序模型函数（K8s 侧核心逻辑）

```javascript
// on_model100_event_in — 当 event PIN 收到数据时触发
//
// ctx 对象提供以下 API：
//   ctx.runtime          — ModelTableRuntime 实例
//   ctx.getLabel(ref)    — 读取 label 值，ref = { model_id, p, r, c, k }
//   ctx.writeLabel(ref, t, v) — 写入 label
//   ctx.rmLabel(ref)     — 删除 label
//   ctx.sendMatrix(event)     — 发送 Matrix 事件（仅 MBR 可用）
//   ctx.publishMqtt(topic, payload) — 发送 MQTT 消息（仅 MBR 可用）

// 1. 读取 PIN 邮箱中的入站数据
const cell = ctx.runtime.getCell(ctx.runtime.getModel(100), 0, 1, 1);
const inLabel = cell.labels.get('event');
if (!inLabel || inLabel.t !== 'IN') return;
const payload = inLabel.v;

// 2. 解析 action
const action = payload && payload.action ? payload.action : '';

if (action === 'submit') {
  // 3. 执行业务逻辑（这里是生成随机颜色）
  const color = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');

  // 4. 构造 mt.v0 patch 作为返回结果
  const patch = {
    version: 'mt.v0',
    op_id: 'color_response_' + Date.now(),
    records: [
      { op: 'add_label', model_id: 100, p: 0, r: 0, c: 0,
        k: 'bg_color', t: 'str', v: color },
      { op: 'add_label', model_id: 100, p: 0, r: 0, c: 0,
        k: 'status', t: 'str', v: 'color_updated_' + color }
    ]
  };

  // 5. 更新本地 runtime（K8s Worker 侧的状态）
  ctx.runtime.addLabel(ctx.runtime.getModel(100), 0, 0, 0,
    { k: 'bg_color', t: 'str', v: color });

  // 6. 写 OUT → runtime 自动通过 MQTT 发布 patch 给 MBR
  ctx.writeLabel(
    { model_id: 100, p: 0, r: 1, c: 1, k: 'patch' },
    'OUT', patch
  );
}

// 7. 清理：移除已处理的 IN label，防止重复触发
ctx.runtime.rmLabel(ctx.runtime.getModel(100), 0, 1, 1, 'event');
ctx.rmLabel({ model_id: -10, p: 0, r: 0, c: 0, k: 'run_on_model100_event_in' });
```

### 6.3 Server 侧（UI Server 加载的定义）

**文件：** `packages/worker-base/system-models/test_model_100_ui.json`

Server 侧的 Model 100 定义与 K8s 侧不同：
- 只有 `PIN_IN: patch`（接收 K8s 回写的 patch）
- 有 `forward_model100_events` 函数（把 UI 事件转发到 Matrix）
- 有 `on_model100_patch_in` 函数（收到返回 patch 后 applyPatch）

**你的 DAM Worker 不需要修改 Server 侧代码**，但需要为你的模型提供类似的 Server 侧 JSON 定义，让 Server 知道如何转发事件和接收回写。

---

## 7. K8s Worker 启动流程

**参考文件：** `scripts/run_remote_worker_k8s_v2.mjs`

```javascript
// 1. 创建 Runtime
const rt = new ModelTableRuntime();

// 2. 加载系统 patch（mqtt_topic_mode, mqtt_topic_base 等）
loadSystemPatch(rt);

// 3. 确保系统模型存在
if (!rt.getModel(-10)) {
  rt.createModel({ id: -10, name: 'system', type: 'system' });
}

// 4. 设置 payload 模式
rt.addLabel(rt.getModel(0), 0, 0, 0,
  { k: 'mqtt_payload_mode', t: 'str', v: 'mt_v0' });

// 5. 启动 MQTT 连接（runtime 自动处理 PIN 订阅）
rt.startMqttLoop({
  transport: 'real',
  host: 'host.docker.internal',  // Docker 内连宿主机
  port: 1883,
  client_id: `dy-k8s-worker-${Date.now()}`,
  username: 'u',
  password: 'p',
  tls: false,
});

// 6. 加载模型定义（PIN 声明 → 自动订阅 MQTT topic）
const patch = JSON.parse(fs.readFileSync(
  'packages/worker-base/system-models/test_model_100_full.json', 'utf8'));
rt.applyPatch(patch, { allowCreateModel: true });

// 7. 事件轮询：检测 PIN_IN 数据到达 → 触发程序模型
setInterval(() => {
  const events = rt.eventLog.list();
  for (; cursor < events.length; cursor++) {
    const e = events[cursor];
    if (e.op !== 'add_label') continue;
    // 检测 Model 100 的 event PIN 邮箱被写入
    if (e.cell.model_id === 100 && e.cell.p === 0 && e.cell.r === 1 && e.cell.c === 1) {
      if (e.label.t === 'IN' && e.label.k === 'event') {
        // 设置触发器 → engine.tick() 执行函数
        rt.addLabel(rt.getModel(-10), 0, 0, 0,
          { k: 'run_on_model100_event_in', t: 'str', v: '1' });
      }
    }
  }
  engine.tick();
}, 50);
```

---

## 8. MBR 桥接逻辑（不需要你修改，但需要了解）

MBR Worker 有两个核心函数（定义在 `scripts/run_worker_mbr_v0.mjs`）：

### 8.1 mbr_mgmt_to_mqtt — Matrix → MQTT

收到 Matrix `dy.bus.v0` 事件后：

1. 解析 `source_model_id`，决定路由到哪个 Worker
2. 构造 mt.v0 patch
3. 发布到 MQTT topic `UIPUT/in/{ws}/{dam}/{pic}/{de}/{sw}/{model_id}/{pin}`

**路由规则：**
- `source_model_id === 100` → topic: `.../100/event`，pin: `event`
- 其他 → topic: `.../2/patch`（默认 Worker ID），pin: `patch`

> **对 DAM：** MBR 需要添加对你的 model_id 的路由规则，或者改为通用的 source_model_id 路由。这是后续需要扩展的点。

### 8.2 mbr_mqtt_to_mgmt — MQTT → Matrix

收到 MQTT 消息后：

1. 验证是 mt.v0 格式
2. 去重（op_id）
3. 封装为 `{ version:"v0", type:"snapshot_delta", payload:<patch> }`
4. 发送到 Matrix room

Server 收到后通过对应的 `on_model{id}_patch_in` 函数 applyPatch。

---

## 9. DAM Worker 的角色与职责

### 9.1 定位

DongyuApp 内置类 Element.io 的聊天功能，文件上传/下载通过 Matrix Content Repository API 完成。文件实体的存储由 Matrix Homeserver 负责，DAM Worker **不负责文件实体的存储和搬运**。

```
文件存储链路（DAM 不参与）:
  前端 → Matrix media API (上传) → Homeserver → 存储后端
  前端 ← Matrix media API (下载) ← Homeserver ← 存储后端

DAM 只关心: mxc://server/mediaId（文件的稳定引用地址）
```

### 9.2 DAM 的五项职责

```
┌──────────────────────────────────────────────────────┐
│                    DAM Worker                         │
│                                                      │
│  ① 元数据索引                                         │
│     文件上传后，前端通过 PIN 通知 DAM 建立索引          │
│     记录: mxc URI、文件名、MIME、大小、所属模型、标签   │
│                                                      │
│  ② 权限管理                                           │
│     谁可以访问哪些资产                                 │
│     基于模型/应用/用户的访问控制                       │
│                                                      │
│  ③ 源地址查询                                         │
│     按条件检索资产: 按模型、按类型、按标签              │
│     返回 mxc URI 列表供前端下载                       │
│                                                      │
│  ④ 分发                                               │
│     把资产引用推送给需要的滑动 UI                      │
│     跨应用的资产共享                                   │
│                                                      │
│  ⑤ 同步                                               │
│     多工作区间的资产同步                               │
│     资产状态变更通知                                   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 9.3 总线交互示例

> 以下示例中 DAM Worker 的 model_id 假设为 `1010`。

**文件上传后注册资产：**

```
1. 前端调 Matrix media API 上传文件
   POST /_matrix/media/v3/upload?filename=site-v2.zip
   → 返回 { "content_uri": "mxc://localhost/AaBbCcDd" }

2. 前端通过 PIN 发送注册命令给 DAM Worker:
   MQTT topic: UIPUT/in/{ws}/{dam}/{pic}/{de}/{sw}/1010/register

   // 所有参数通过 records add_label 写入请求 Cell (1010, 1, 0, 0)
   payload:
   {
     "version": "mt.v0",
     "op_id": "reg_1770535046849",
     "records": [
       // action 也是 label，不用信封扩展字段
       { "op": "add_label", "model_id": 1010, "p": 1, "r": 0, "c": 0,
         "k": "action", "t": "str", "v": "register_asset" },
       { "op": "add_label", "model_id": 1010, "p": 1, "r": 0, "c": 0,
         "k": "mxc", "t": "str", "v": "mxc://localhost/AaBbCcDd" },
       { "op": "add_label", "model_id": 1010, "p": 1, "r": 0, "c": 0,
         "k": "name", "t": "str", "v": "site-v2.zip" },
       { "op": "add_label", "model_id": 1010, "p": 1, "r": 0, "c": 0,
         "k": "mime", "t": "str", "v": "application/zip" },
       { "op": "add_label", "model_id": 1010, "p": 1, "r": 0, "c": 0,
         "k": "size", "t": "int", "v": 2048000 },
       { "op": "add_label", "model_id": 1010, "p": 1, "r": 0, "c": 0,
         "k": "owner_model_id", "t": "int", "v": 1001 },
       { "op": "add_label", "model_id": 1010, "p": 1, "r": 0, "c": 0,
         "k": "tags", "t": "json", "v": ["frontend", "release"] }
     ]
   }

3. DAM Worker 建立索引 → 返回确认 patch:
   MQTT topic: UIPUT/out/{ws}/{dam}/{pic}/{de}/{sw}/1010/result

   // 返回也是纯 records，runtime 逐条执行写入 ModelTable
   {
     "version": "mt.v0",
     "op_id": "reg_ack_1770535046850",
     "records": [
       { "op": "add_label", "model_id": 1010,
         "p": 0, "r": 0, "c": 0,
         "k": "last_registered", "t": "json",
         "v": { "asset_id": "AaBbCcDd", "status": "registered" } }
     ]
   }
```

**查询资产：**

```
1. 滑动 UI 通过 PIN 发送查询:
   MQTT topic: UIPUT/in/{ws}/{dam}/{pic}/{de}/{sw}/1010/query

   // 查询参数同样通过 records 写入请求 Cell (1010, 1, 0, 0)
   {
     "version": "mt.v0",
     "op_id": "qry_1770535100000",
     "records": [
       { "op": "add_label", "model_id": 1010, "p": 1, "r": 0, "c": 0,
         "k": "action", "t": "str", "v": "list_assets" },
       { "op": "add_label", "model_id": 1010, "p": 1, "r": 0, "c": 0,
         "k": "owner_model_id", "t": "int", "v": 1001 },
       { "op": "add_label", "model_id": 1010, "p": 1, "r": 0, "c": 0,
         "k": "mime_prefix", "t": "str", "v": "image/" }
     ]
   }

2. DAM Worker 查索引 → 返回 patch:
   MQTT topic: UIPUT/out/{ws}/{dam}/{pic}/{de}/{sw}/1010/result

   // 查询结果通过 records 写入 ModelTable，前端通过 snapshot 获取
   {
     "version": "mt.v0",
     "op_id": "qry_ack_1770535100001",
     "records": [
       { "op": "add_label", "model_id": 1010,
         "p": 0, "r": 0, "c": 0,
         "k": "query_result", "t": "json",
         "v": {
           "assets": [
             { "mxc": "mxc://localhost/abc", "name": "logo.png", "mime": "image/png", "size": 51200 },
             { "mxc": "mxc://localhost/def", "name": "bg.jpg", "mime": "image/jpeg", "size": 204800 }
           ]
         } }
     ]
   }

3. 滑动 UI 用返回的 mxc URI 通过 Matrix media API 下载/展示
```

### 9.4 mxc:// URI 说明

**格式：** `mxc://{server_name}/{media_id}`

**对应的 HTTP 端点：**

```
上传: POST /_matrix/media/v3/upload?filename=xxx
      Header: Authorization: Bearer {access_token}
      Header: Content-Type: {mime-type}
      Body: 文件二进制
      响应: { "content_uri": "mxc://localhost/AaBbCcDdEeFf" }

下载: GET /_matrix/media/v3/download/{server_name}/{media_id}

缩略图: GET /_matrix/media/v3/thumbnail/{server_name}/{media_id}?width=256&height=256
```

默认上传限制 50MB（Synapse 可配置）。

---

## 10. 关键源码索引

| 文件 | 说明 |
|------|------|
| `packages/worker-base/src/runtime.js` | ModelTableRuntime — Cell/Label/PIN/MQTT 核心 |
| `packages/worker-base/system-models/system_models.json` | 系统 seed patch（mqtt_topic_base 等） |
| `packages/worker-base/system-models/test_model_100_full.json` | Model 100 K8s 侧定义（**照此模板写 DAM**） |
| `packages/worker-base/system-models/test_model_100_ui.json` | Model 100 Server 侧定义 |
| `scripts/run_remote_worker_k8s_v2.mjs` | K8s Worker 启动脚本（**照此模板写 DAM 启动**） |
| `scripts/worker_engine_v0.mjs` | WorkerEngineV0 — 函数执行引擎 & ctx API |
| `scripts/run_worker_mbr_v0.mjs` | MBR Worker — Matrix↔MQTT 桥 |
| `packages/bus-mgmt/src/matrix_live.js` | Matrix 适配器（MBR 使用） |
| `packages/ui-model-demo-server/server.mjs` | UI Server — submitEnvelope / event 转发 |
| `packages/ui-renderer/src/renderer.mjs` | 前端渲染器 — bind.write / dispatchEvent |

---

## 11. DAM Worker 开发 Checklist

1. **选定 Model ID**（1000~1999 段）
2. **定义 PIN 接口**
   - 哪些 PIN_IN（接收什么命令：注册、查询、删除等）
   - 哪些 PIN_OUT（返回什么结果）
3. **编写 K8s 侧 JSON**（参照 `test_model_100_full.json`）
   - create_model
   - 业务数据 label 初始值
   - PIN_IN / PIN_OUT 声明
   - 程序模型函数
4. **编写 Server 侧 JSON**（参照 `test_model_100_ui.json`）
   - create_model（相同 model_id）
   - PIN_IN: patch（接收 K8s 回写）
   - forward 函数 + on_patch_in 函数
5. **编写 K8s Worker 启动脚本**（参照 `run_remote_worker_k8s_v2.mjs`）
6. **注册 MBR 路由**（在 `system_models.json` 中添加 `mbr_route_<YOUR_MODEL_ID>` label）
7. **编写 Dockerfile & K8s 部署配置**（参照 `k8s/` 目录）
8. **测试**：启动 Server + MBR + MQTT broker + 你的 Worker，验证全链路

---

## 12. 运行环境依赖

```
Docker 容器：eclipse-mosquitto:2 (MQTT broker, 端口 1883)
Matrix Homeserver：Synapse (已部署)
MBR Worker：bun scripts/run_worker_mbr_v0.mjs
UI Server：bun packages/ui-model-demo-server/server.mjs --port 9000

环境变量（K8s Worker）：
  MQTT_HOST=host.docker.internal   # Docker 内连宿主机
  MQTT_PORT=1883
  MQTT_USER=u
  MQTT_PASS=p
  WORKER_ID=<your_worker_id>
```
