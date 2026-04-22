---
title: "DAM Worker 开发指南：软件工人与总线交互架构"
doc_type: handover
status: active
updated: 2026-04-21
source: ai
---

# DAM Worker 开发指南：软件工人与总线交互架构

> 前置知识：了解 MQTT、Matrix 协议基础概念
> 参考实现：Model 100 颜色生成器（完整 E2E 双总线样板）
> 架构设计：`docs/plans/2026-02-11-pin-isolation-and-model-hierarchy-design.md`
> 历史说明：本文件是 handover / implementation guide，不是当前模型 id 与模型标签语义的权威来源；如与 `CLAUDE.md` 或 `docs/ssot/**` 冲突，以上位规范为准。

---

## 1. 架构总览

### 1.1 系统拓扑

```
┌──────────┐      HTTP         ┌──────────────┐     Matrix (dy.bus.v0)    ┌────────────┐
│  滑动 UI  │ ──────────────→  │  UI Server    │ ←─────────────────────→  │ MBR Worker │
│ (Vue3)   │ POST /bus_event  │  (Bun)        │   管理总线：事件转发      │ (Node.js)  │
└──────────┘  GET  /snapshot   └──────────────┘   心跳、snapshot_delta    └─────┬──────┘
                                                                               │
                                                                         MQTT (mt.v0)
                                                                         控制总线
                                                                               │
                                                                       ┌───────┴────────┐
                                                                       │  K8s 软件工人  │
                                                                       │  (你的 DAM)    │
                                                                       └────────────────┘
```

**双总线分工：**

| 总线 | 协议 | 传输内容 | 两端 |
|------|------|----------|------|
| 管理总线 | Matrix 自定义事件 `dy.bus.v0` | 事件转发、心跳、patch 回写 | Server ↔ MBR |
| 控制总线 | MQTT + JSON | mt.v0 patch（命令与数据） | MBR ↔ K8s 软件工人 |

**你的 DAM 软件工人位于 K8s 软件工人层**，通过 MQTT 与 MBR 通信。MBR 负责 Matrix↔MQTT 的桥接，你不需要直接连 Matrix。

### 1.2 模型层级：Model 0 = 系统根

整个系统以 Model 0 为根模型，所有模型（包括系统模型和应用模型）均作为其子模型挂载：

```
Model 0 (系统根 — 不是用户直接操作的模型)
├── 系统子模型（负数 ID）
│   ├── Model -1   compat/status mailbox
│   ├── Model -2   editor_state
│   └── Model -10  运行时配置（MQTT topic 等）
├── 应用子模型（正数 ID）
│   ├── Model 100  test_color_form（颜色生成器示例）
│   ├── Model 1010 DAM Worker（你的资产管理模型）
│   └── ...
└── pin.bus.in / pin.bus.out — MQTT 的唯一外部入口/出口
```

关键点：
- MQTT 消息**只能**通过 Model 0 的 `pin.bus.in` 进入系统，不能直接写任意 Cell
- 用户操作的是应用子模型，不直接操作 Model 0
- 正数/负数模型使用同一套父子机制
- 对 imported slide app，当前也开始采用宿主自动生成的 `Model 0` ingress route：
  - 先进入宿主 `Model 0`
  - 再由宿主生成的 route relay 到 imported app 边界 pin

---

## 2. 核心数据结构

### 2.1 Label — 最小数据单元

```json
{ "k": "bg_color", "t": "str", "v": "#FF0000" }
```

| 字段 | 含义 | 说明 |
|------|------|------|
| `k` | key | 标识名，同一 Cell 内唯一 |
| `t` | type | 类型标记 |
| `v` | value | 任意 JSON 可序列化值 |

**Label Type 参考（按连接层级分组）：**

| 层级 | Type | 用途 | 位置限制 |
|------|------|------|----------|
| 系统边界 | `pin.bus.in` | MQTT 入站端口（全系统唯一入口） | 仅 Model 0 的 (0,0,0) |
| 系统边界 | `pin.bus.out` | MQTT 出站端口（全系统唯一出口） | 仅 Model 0 的 (0,0,0) |
| 模型边界 | `MODEL_IN` | 从父模型接收数据 | 子模型的 (0,0,0) |
| 模型边界 | `MODEL_OUT` | 向父模型回传数据 | 子模型的 (0,0,0) |
| 模型路由 | `cell_connection` | Cell 间路由表 | 各模型的 (0,0,0) |
| Cell 层 | `PIN_IN` | Cell 输入端口 | 各 Cell |
| Cell 层 | `PIN_OUT` | Cell 输出端口 | 各 Cell |
| Cell 层 | `CELL_CONNECT` | 统一连接表 | 各 Cell |
| Cell 层 | `function` | 程序模型（JS 代码） | 各 Cell |
| Cell 层 | `subModel` | 子模型挂载声明 | 各 Cell |
| 数据 | `str` / `int` / `bool` / `json` | 业务数据 | 任意 Cell |

### 2.2 Cell — 由四元组寻址

```
(model_id, p, r, c) → Map<k, Label>
```

- `model_id`: 模型 ID（整数）
- `p`: page（页）  `r`: row（行）  `c`: column（列）

**Cell 位置约定（重要）：**

| Cell 位置 | 用途 |
|-----------|------|
| `(model_id, 0, 0, 0)` | 模型入口 — MODEL_IN/OUT、cell_connection、核心业务数据 |
| `(model_id, 0, 0, 1)` | PIN 注册 — PIN_IN / PIN_OUT 声明 |
| `(model_id, 1, 0, 0)` | 请求输入 — 外部通过 records `add_label` 写入的业务参数 |
| `(-10, 0, 0, 0)` | 系统函数 — 程序模型的 function 定义 |

### 2.3 Model — 模型表中的一张表

```json
{ "id": 1010, "name": "dam_worker", "type": "worker" }
```

**Model ID 规划（已按当前规范修正）：**

| 范围 | 用途 |
|------|------|
| `< 0` | 软件工人系统级能力层（含 mailbox/state/support 与内置系统级应用） |
| `0` | 系统根/中间层模型（`pin.bus.in/out`、root routing、bootstrap config） |
| `> 0` | 用户创建模型 |

---

## 3. mt.v0 Patch 格式

**这是总线上传递的核心数据格式。** 所有模型表变更都通过 patch 描述。

```json
{
  "version": "mt.v0",
  "op_id": "unique_operation_id",
  "records": [
    { "op": "create_model", "model_id": 1010, "name": "dam_worker", "type": "worker" },
    { "op": "add_label", "model_id": 1010, "p": 0, "r": 0, "c": 0,
      "k": "status", "t": "str", "v": "ready" },
    { "op": "rm_label", "model_id": 1010, "p": 0, "r": 0, "c": 0, "k": "old_key" },
    { "op": "cell_clear", "model_id": 1010, "p": 0, "r": 0, "c": 0 }
  ]
}
```

**支持的 record 操作：**

| op | 必需字段 | 说明 |
|----|----------|------|
| `create_model` | `model_id`, `name`, `type` | 创建新模型 |
| `add_label` | `model_id`, `p`, `r`, `c`, `k`, `t`, `v` | 添加/覆盖 label |
| `rm_label` | `model_id`, `p`, `r`, `c`, `k` | 删除 label |
| `cell_clear` | `model_id`, `p`, `r`, `c` | 清空 cell |

**核心原则：** 所有业务参数一律通过 `records` 中的 `add_label` 写入请求 Cell，包括 `action` 标识。信封只有 `version` + `op_id` + `records` 三个字段。

---

## 4. 三层连接架构

这是 DAM Worker 开发中最重要的概念。数据从外部 MQTT 到达你的程序模型，经过三层显式声明的路由。

### 4.1 Layer 1: 系统边界 — pin.bus.in / pin.bus.out

MQTT 与系统内部的唯一接口，位于 Model 0 的 (0,0,0)。

```json
// Model 0 (0,0,0) 上的 label
{ "k": "dam_register", "t": "pin.bus.in", "v": null }
{ "k": "dam_result",   "t": "pin.bus.out", "v": null }
```

- `pin.bus.in.k` = 本地端口名（如 `dam_register`），运行时从 Model -10 读配置，拼接完整 MQTT topic
- MQTT 消息到达时，运行时写入 `pin.bus.in.v`
- 写入 `pin.bus.out.v` 时，运行时自动拼接 topic 后发布到 MQTT
- **你不需要手动处理 MQTT topic 构造**，只需声明 `pin.bus.in` / `pin.bus.out` 端口名

### 4.2 Layer 2: 模型内路由 — cell_connection

位于各模型的 (0,0,0)，描述 Cell 间的数据路由。

```json
{ "k": "routing", "t": "cell_connection", "v": [
  {"from": [0,0,0,"dam_register"],     "to": [[2,0,0,"register_cmd"]]},
  {"from": [2,0,0,"register_result"],   "to": [[0,0,0,"dam_result"]]}
]}
```

- `from`: `[p, r, c, k]` 四元组标识源 Cell 的端口
- `to`: 二维数组，每个目标也是 `[p, r, c, k]`
- init 时遍历一次，建内存路由表

### 4.3 Layer 3: Cell 内连接 — CELL_CONNECT

位于各 Cell，描述 Cell 内部 PIN、函数、子模型之间的连线。

```json
{ "k": "wiring", "t": "CELL_CONNECT", "v": {
  "(self, register_cmd)":          ["(func, handle_register:in)"],
  "(func, handle_register:out)":   ["(self, register_result)"]
}}
```

**前缀规则：**

| 前缀 | 含义 | 示例 |
|------|------|------|
| `self` | Cell 自身的 PIN | `(self, register_cmd)` |
| `func` | Cell 内函数端口 | `(func, handle_register:in)` |
| `<数字ID>` | 挂载的子模型 | `(10, from_parent)` |

函数端口命名约定：`funcname:in`（输入端）/ `funcname:out`（输出端）。

### 4.4 子模型边界 — MODEL_IN / MODEL_OUT

当 DAM Worker 需要内嵌子模型时，子模型通过 MODEL_IN/MODEL_OUT 声明边界入口：

```json
// 子模型 (0,0,0) 上的 label
{ "k": "from_parent", "t": "MODEL_IN", "v": null }
{ "k": "to_parent",   "t": "MODEL_OUT", "v": null }
```

父模型的 CELL_CONNECT 用 `<子模型ID>` 前缀桥接到子模型：

```json
{ "(self, data_for_sub)": ["(1011, from_parent)"],
  "(1011, to_parent)":    ["(self, sub_result)"] }
```

### 4.5 数据流全路径

```
MQTT 消息 → `pin.bus.in` → cell_connection → PIN_IN → CELL_CONNECT → function → CELL_CONNECT → PIN_OUT → cell_connection → `pin.bus.out` → MQTT
```

每一跳都有显式声明，可在 ModelTable 中追踪完整路径。

---

## 5. MQTT Topic

### 5.1 Topic 层级结构（uiput_9layer_v2）

```
UIPUT/{dir}/{ws}/{dam}/{pic}/{de}/{sw}/{model}/{pin}
  ①     ②    ③     ④     ⑤    ⑥    ⑦     ⑧      ⑨
```

| 层 | 名称 | 含义 |
|----|------|------|
| ① | UIPUT | 协议命名空间（固定） |
| ② | dir | PIN 方向：`in`（入站）/ `out`（出站） |
| ③~⑦ | ws/dam/pic/de/sw | 工作区/DAM/PIC/数字员工/软件工人 ID |
| ⑧ | model | 模型 ID |
| ⑨ | pin | PIN 名称（不含方向后缀） |

**你不需要手动构造 topic。** 运行时从 Model -10 的配置中读取 ws/dam/pic/de/sw 各层值，加上 `pin.bus.in/out` 的端口名，自动拼接完整 topic。

### 5.2 通配符

| 通配符 | 规则 | 典型用法 |
|--------|------|----------|
| `+` | 匹配单层 | `UIPUT/out/+/dam1/#` — 所有工作区的出站 |
| `#` | 匹配末尾所有层 | `UIPUT/out/#` — 所有出站 |

---

## 6. 完整 E2E 数据流（以文件注册为例）

```
① 前端上传文件到 Matrix → 获得 mxc:// URI

② 前端通过 UI 触发注册命令
   POST /bus_event（legacy `/ui_event` alias）→ Server → Matrix Room → MBR Worker

③ MBR 构造 mt.v0 patch:
   records = [
     { op: "add_label", model_id: 1010, p: 1, r: 0, c: 0,
       k: "action", t: "str", v: "register_asset" },
     { op: "add_label", model_id: 1010, p: 1, r: 0, c: 0,
       k: "mxc", t: "str", v: "mxc://localhost/AaBbCcDd" },
     ...
   ]

④ MBR 发布到 MQTT → topic 由运行时配置决定
   → 到达 Model 0 的 `pin.bus.in(k="dam_register")`

⑤ Model 0 的 cell_connection 路由:
   (0,0,0,"dam_register") → (2,0,0,"register_cmd")
   Cell(2,0,0) 的 PIN_IN "register_cmd" 收到数据

⑥ Cell(2,0,0) 的 CELL_CONNECT 路由:
   (self, register_cmd) → (func, handle_register:in)
   函数 handle_register 执行:
   - 读请求 Cell (1010, 1, 0, 0) 的 action/mxc/name 等参数
   - 建立资产索引
   - 构造响应 patch

⑦ CELL_CONNECT 路由函数输出:
   (func, handle_register:out) → (self, register_result)

⑧ cell_connection 路由到 `pin.bus.out`:
   (2,0,0,"register_result") → (0,0,0,"dam_result")
   运行时发布到 MQTT

⑨ MBR 收到 MQTT → 封装为 Matrix dy.bus.v0 → Server

⑩ Server applyPatch → 更新 Model 1010 状态 → 广播 snapshot 给前端
```

---

## 7. 函数执行模型

### 7.1 编译与运行

程序模型的 `function` label（v = JS 代码字符串）在 init 阶段被编译为 AsyncFunction：

```javascript
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
const fn = new AsyncFunction('ctx', 'label', userCode);
```

运行时通过 CELL_CONNECT 触发函数，传入受限上下文 `ctx`：

```javascript
// ctx 提供的 API（白名单）
ctx.getLabel({ model_id, p, r, c, k })     // 读 label
ctx.writeLabel({ model_id, p, r, c, k }, t, v)  // 写 label
ctx.rmLabel({ model_id, p, r, c, k })      // 删 label
ctx.runtime                                  // ModelTableRuntime 实例
```

### 7.2 超时与错误处理

```javascript
const result = await Promise.race([
  fn(ctx, inputLabel),
  timeout(30000)  // 30 秒超时
]);
```

- 异步超时保护：通过 `Promise.race` 实现
- 错误自动捕获并写入日志端口
- **已知限制**：同步阻塞代码（如 `while(true) {}`）无法被超时机制中断。用户代码必须是协作式的，长时间操作需使用 `await`

### 7.3 并发模型

- CELL_CONNECT 一个源连多个目标 → 所有目标**并发执行**（Promise.all）
- 串行依赖通过连接拓扑表达：A:out → B:in，A 完成后 B 自动触发
- 不需要排序注解，连接图本身就是执行计划

---

## 8. DAM Worker 的角色与职责

### 8.1 定位

DongyuApp 内置类 Element.io 的聊天功能，文件上传/下载通过 Matrix Content Repository API 完成。文件实体的存储由 Matrix Homeserver 负责，DAM Worker **不负责文件实体的存储和搬运**。

```
文件存储链路（DAM 不参与）:
  前端 → Matrix media API (上传) → Homeserver → 存储后端
  前端 ← Matrix media API (下载) ← Homeserver ← 存储后端

DAM 只关心: mxc://server/mediaId（文件的稳定引用地址）
```

### 8.2 五项职责

| 职责 | 说明 |
|------|------|
| 元数据索引 | 文件上传后建立索引：mxc URI、文件名、MIME、大小、所属模型、标签 |
| 权限管理 | 基于模型/应用/用户的访问控制 |
| 源地址查询 | 按条件检索资产，返回 mxc URI 列表供前端下载 |
| 分发 | 把资产引用推送给需要的滑动 UI，支持跨应用共享 |
| 同步 | 多工作区间的资产同步和状态变更通知 |

### 8.3 总线交互示例

> DAM Worker 的 model_id 假设为 `1010`。

**注册资产：**

```json
// MBR 通过 `pin.bus.in` 发送到系统，records 写入请求 Cell (1010, 1, 0, 0)
{
  "version": "mt.v0",
  "op_id": "reg_1770535046849",
  "records": [
    { "op": "add_label", "model_id": 1010, "p": 1, "r": 0, "c": 0,
      "k": "action", "t": "str", "v": "register_asset" },
    { "op": "add_label", "model_id": 1010, "p": 1, "r": 0, "c": 0,
      "k": "mxc", "t": "str", "v": "mxc://localhost/AaBbCcDd" },
    { "op": "add_label", "model_id": 1010, "p": 1, "r": 0, "c": 0,
      "k": "name", "t": "str", "v": "site-v2.zip" },
    { "op": "add_label", "model_id": 1010, "p": 1, "r": 0, "c": 0,
      "k": "mime", "t": "str", "v": "application/zip" },
    { "op": "add_label", "model_id": 1010, "p": 1, "r": 0, "c": 0,
      "k": "size", "t": "int", "v": 2048000 }
  ]
}
```

**DAM 响应：**

```json
// 通过 `pin.bus.out` 回传到 MQTT
{
  "version": "mt.v0",
  "op_id": "reg_ack_1770535046850",
  "records": [
    { "op": "add_label", "model_id": 1010, "p": 0, "r": 0, "c": 0,
      "k": "last_registered", "t": "json",
      "v": { "asset_id": "AaBbCcDd", "status": "registered" } }
  ]
}
```

### 8.4 mxc:// URI 说明

格式：`mxc://{server_name}/{media_id}`

| 操作 | HTTP 端点 |
|------|----------|
| 上传 | `POST /_matrix/media/v3/upload?filename=xxx` + Authorization header |
| 下载 | `GET /_matrix/media/v3/download/{server_name}/{media_id}` |
| 缩略图 | `GET /_matrix/media/v3/thumbnail/{server_name}/{media_id}?width=256&height=256` |

默认上传限制 50MB（Synapse 可配置）。

---

## 9. K8s 软件工人启动流程

**参考文件：** `scripts/run_remote_worker_k8s_v2.mjs`

```javascript
// 1. 创建 Runtime
const rt = new ModelTableRuntime();

// 2. 加载系统 patch（Model 0 框架 + Model -10 配置）
loadSystemPatch(rt);

// 3. 确保系统模型存在
if (!rt.getModel(-10)) {
  rt.createModel({ id: -10, name: 'system', type: 'system' });
}

// 4. 启动 MQTT 连接
//    运行时自动根据 `pin.bus.in/out` 声明订阅/发布对应 topic
rt.startMqttLoop({
  transport: 'real',
  host: 'host.docker.internal',
  port: 1883,
  client_id: `dy-k8s-worker-${Date.now()}`,
  username: 'u',
  password: 'p',
  tls: false,
});

// 5. 加载 DAM 模型定义
//    - create_model
//    - `pin.bus.in/out` 声明 → 自动订阅 MQTT
//    - cell_connection 路由
//    - CELL_CONNECT 连线
//    - function 编译
const patch = JSON.parse(fs.readFileSync('path/to/dam_model.json', 'utf8'));
rt.applyPatch(patch, { allowCreateModel: true });

// 6. 运行时自动处理：
//    MQTT 入站 → `pin.bus.in` → cell_connection → CELL_CONNECT → function → ... → `pin.bus.out` → MQTT 出站
```

---

## 10. MBR 桥接逻辑（不需要你修改，但需要了解）

MBR Worker（`scripts/run_worker_mbr_v0.mjs`）负责 Matrix ↔ MQTT 桥接：

### Matrix → MQTT

1. 收到 Matrix `dy.bus.v0` 事件
2. 解析 `source_model_id`，查询路由规则（`mbr_route_<modelId>` label）
3. 构造 mt.v0 patch
4. 发布到 MQTT（运行时拼接 topic）

### MQTT → Matrix

1. 收到 MQTT 消息
2. 验证 mt.v0 格式 + op_id 去重
3. 封装为 `{ version:"v0", type:"snapshot_delta", payload:<patch> }`
4. 发送到 Matrix room → Server applyPatch

---

## 11. DAM Worker 开发 Checklist

1. **选定 Model ID**（1000~1999 段，如 `1010`）

2. **在 Model 0 声明 `pin.bus.in` / `pin.bus.out`**
   - 为 DAM 的每个外部接口声明入站/出站端口
   - 如：`pin.bus.in(k="dam_register")`、`pin.bus.out(k="dam_result")`

3. **编写 Model 0 的 cell_connection**
   - 路由 `pin.bus.in` 端口到 DAM 的 hosting cell
   - 路由 DAM 的输出端口到 `pin.bus.out`

4. **编写 DAM 模型 JSON**
   - `create_model`（model_id = 1010）
   - 业务数据 label 初始值
   - MODEL_IN / MODEL_OUT 声明（如有子模型需求）
   - CELL_CONNECT 定义：PIN → 函数 → PIN 的连线
   - 程序模型函数

5. **编写 Server 侧 JSON**
   - 相同 model_id 的 create_model
   - 接收回写 patch 的处理函数

6. **注册 MBR 路由**
   - 在 `system_models.json` 中添加 `mbr_route_1010` label

7. **编写 K8s 软件工人启动脚本**（参照 `run_remote_worker_k8s_v2.mjs`）

8. **编写 Dockerfile & K8s 部署配置**

9. **测试**：启动 Server + MBR + MQTT broker + 你的 Worker，验证全链路

---

## 12. 关键源码索引

| 文件 | 说明 |
|------|------|
| `packages/worker-base/src/runtime.js` | ModelTableRuntime — Cell/Label/PIN/MQTT 核心 |
| `packages/worker-base/system-models/system_models.json` | 系统 seed patch |
| `packages/worker-base/system-models/test_model_100_full.json` | Model 100 K8s 侧定义（参考模板） |
| `packages/worker-base/system-models/test_model_100_ui.json` | Model 100 Server 侧定义 |
| `scripts/run_remote_worker_k8s_v2.mjs` | K8s 软件工人启动脚本（参考模板） |
| `scripts/worker_engine_v0.mjs` | WorkerEngineV0 — 函数执行引擎 & ctx API |
| `scripts/run_worker_mbr_v0.mjs` | MBR Worker — Matrix↔MQTT 桥 |
| `packages/worker-base/src/matrix_live.js` | Matrix 适配器 |
| `packages/ui-model-demo-server/server.mjs` | UI Server |
| `packages/ui-renderer/src/renderer.mjs` | 前端渲染器 |

---

## 13. 运行环境

```
Docker 容器：eclipse-mosquitto:2 (MQTT broker, 端口 1883)
Matrix Homeserver：Synapse (已部署)
MBR Worker：bun scripts/run_worker_mbr_v0.mjs
UI Server：bun packages/ui-model-demo-server/server.mjs --port 9000

环境变量（K8s 软件工人）：
  MQTT_HOST=host.docker.internal
  MQTT_PORT=1883
  MQTT_USER=u
  MQTT_PASS=p
  WORKER_ID=<your_worker_id>
```

---

## Host Adapter 删除清理 Checklist（0322 补）

当 host 删除一个 imported slide app 时，`removeImportedBundleFromRuntime` 必须依次核对下列清单。任何一条未清都算"残件泄漏"，会让下一次 imported app 安装到同 cell 时路由错位。

### A. 从 imported root cell `(0,0,0)` 读取清单

- `host_ingress_generated_model0_labels: json` — 0321 ingress adapter 在 Model 0 `(0,0,0)` 上留下的 key 数组
- `host_ingress_generated_root_labels: json` — imported root `(0,0,0)` 上由 ingress adapter 添加的 key
- `host_egress_generated_model0_labels: json` — 0322 egress 在 Model 0 `(0,0,0)` 留下的 key（含 `<forwardFunc>_last_error`）
- `host_egress_generated_mount: json` — `{p, r, c, keys[]}`，mount cell 上 bridge + relay 的 key 列表
- `host_egress_generated_system_labels: json` — 写在 Model -10 `(0,0,0)` 的 `forwardFunc` key 列表

### B. 删除顺序

1. Model 0 `(0,0,0)` 上全部 `host_ingress_generated_model0_labels` 条目 → `rm_label`
2. Model 0 `(0,0,0)` 上全部 `host_egress_generated_model0_labels` 条目 → `rm_label`（包括 error label）
3. Model 0 mount cell 上 `host_egress_generated_mount.keys` 全部条目 → `rm_label`
4. Model -10 `(0,0,0)` 上 `host_egress_generated_system_labels` 全部条目 → `rm_label`；`programEngine.functions.delete(key)` 同步清除代码 Map，`sys.functions.delete(key)` 清除 Model 级别 registration
5. Runtime model registry 中删除所有 `imported_bundle_model_ids`
6. 对 Model 0 `(0,0,0)` 上全部 `model.submt` 指向被删 model id 的 label 做一次 final sweep

### C. 系统模型解析原则

- 不使用 `firstSystemModel` fallback；必须 `runtime.getModel(-10)`，失败则在该步停止 cleanup，防止 label 删到错误的负模型
- 若需要 cleanup 之外的负模型枚举（如健康检查），另写 helper，不要复用 egress 路径的 sys 变量

### D. 删除后的最小断言（测试契约）

`scripts/tests/test_0322_imported_host_egress_server_flow.mjs` 的 delete 段已断言：

- Model 0 root 不再有 ingressKey / egressLabel / busLabel
- Model -10 root 不再有 forwardFunc
- mount cell 上 relay + bridge 被清空

其它 host-visible label 的残留需要在未来迭代扩展断言（见 0322 runlog Known Follow-ups MEDIUM #4）。

---

## 附录：术语表

> 飞书在线版：[术语表 — 洞宇 APP 软件工人开发](https://bob3y2gxxp.feishu.cn/wiki/JWGFw86ggivvUuk7Bx3cY0UQnfb)

| 术语 (中文) | 术语 (英文) | 缩写/别称 | 说明 |
|---|---|---|---|
| 软件工人 | Software Worker | SW / V1N | 一个虚拟节点 (1 Virtual Node)，运行程序模型的执行单元 |
| 程序模型 | Program Model | — | function label，v = JS 代码字符串，init 时编译为 AsyncFunction |
| 模型表 | ModelTable | MT | 系统唯一真相源 (SSOT)，所有状态的权威存储 |
| 滑动 UI | Sliding UI | — | Vue3 前端，模型表的只读投影 |
| 管理总线 | Management Bus | — | Matrix 协议，用户侧事件传输 |
| 控制总线 | Control Bus | — | MQTT 协议，执行侧指令传输 |
| 管理总线路由器 | Management Bus Router | MBR | 管理总线 ↔ 控制总线的桥接软件工人 |
| 数字资产管理器 | Digital Asset Manager | DAM | 负责资产元数据索引、权限、查询、分发、同步 |
| 数字员工 | Digital Employee | DE | 一个数字员工下可有多个软件工人 (1:N) |
