---
title: "Temporary ModelTable Payload v1"
doc_type: ssot
status: active
updated: 2026-05-12
source: ai
---

# Temporary ModelTable Payload v1

## Purpose

本文档把外部 Feishu 文档中的“临时模型表”数据定义搬入 repo，作为后续基础迁移与实现的仓内权威版本。

来源：
- `https://bob3y2gxxp.feishu.cn/wiki/SgPHwHGrwi5xT5kEIGQccBkcn7c`

说明：
- 外部 Feishu 文档是来源。
- 自本文件落盘后，repo 版本作为后续实现与迁移的执行权威。
- 本文件只定义 payload 本身，不定义接收方应执行的业务动作。

Authority:
- Below `CLAUDE.md`, architecture SSOT, runtime semantics, and label registry.
- Above lower data-model, UI, Matrix/MQTT, and user-guide descriptions that mention temporary message payload shape.
- 0424 principal-scoped subtable namespace target extends durable model references with `table_id`; see `docs/ssot/principal_scoped_subtable_namespace_v1.md`.

Scope:
- Temporary ModelTable message shape, metadata labels, validation rules, and materialization boundary.

Conflict behavior:
- If a lower doc describes formal business pin payload as plain object/string instead of record array, update the lower doc.
- Receiving, routing, forwarding, tracing, or displaying a temporary message does not materialize it unless an approved receiver explicitly writes labels.

## 1. Core Shape

临时模型表 payload 是一个 JSON 数组。  
数组中的每一项都是一条“临时模型表记录”，基础字段如下：

```json
{
  "id": 0,
  "p": 0,
  "r": 0,
  "c": 0,
  "k": "model_type",
  "t": "model.single",
  "v": "Data.Single"
}
```

字段含义：

- `id`
  - 临时模型 id
  - 作用域只在当前 payload 内
  - 不是仓库运行时中的正式 `model_id`
  - 同一 payload 中允许出现多个不同的 `id`
  - 相同 `id` 表示同一个临时模型
  - 不同 `id` 表示同一 payload 中携带多个临时模型
- `p`
  - page / plane 索引
- `r`
  - row
- `c`
  - column
- `k`
  - label key
- `t`
  - label type
- `v`
  - label value

通用 payload 约束：
- `id` / `p` / `r` / `c` 必须是整数。
- 通用 pin payload 可以携带多 cell / 多临时模型记录。
- `write_label.v1`、`bus_send.v1`、`pin_payload.v1` 等具名协议 payload 的控制 label 默认放在 `id=0,p=0,r=0,c=0`；协议解析只从这个 root cell 读取控制字段。

### 1.1 Temporary ModelTable Message Boundary (0347)

本文件定义的临时模型表 payload 也是 pin/event 传输中的 canonical message 形式，称为 Temporary ModelTable Message。

硬规则：

- `format is ModelTable-like; persistence is explicit materialization`.
- 传输格式必须像 ModelTable：由 `{id,p,r,c,k,t,v}` records 组成，可以表达单 cell、多 cell、单临时模型或多临时模型。
- 这类 message 本身不是正式持久 ModelTable；接收、路由、转发、缓存、trace、SSE 推送、Matrix/MQTT/MBR envelope 转换都不得自动把它变成业务 truth。
- `id` 是 message-local 临时 id，只在当前 message 内有意义；它不是正式 `model_id`，也不得被当成运行时模型 id 直接写入。
- 持久化只能由显式 materialization 触发，例如接收程序模型按 pin 语义调用 owner 写入路径、`write_label.v1` 被当前模型 root `mt_write` 接受、importer/installer 明确 materialize 新模型，或 owner materializer 经过校验后执行写入。
- 显式 materialization 发生后，才会产生正式 `add_label` / `rm_label` side effect；在此之前，message 只是传输数据。
- 临时 message 可以被短暂记录为诊断、审计或重放输入，但这类记录不是业务 ModelTable truth，不能作为 UI 或程序模型的 authoritative state。

判定方式：

- 如果某条数据只是 pin value、event payload、transport packet 的业务 payload、或前端本地 overlay，它仍是 Temporary ModelTable Message。
- 如果某条数据已经由 owner / D0 / importer 明确执行并写入某个正式 `model_id,p,r,c,k,t,v`，它才是 materialized ModelTable label。
- 同一个 record shape 可以出现在两种场景中；边界不由 JSON 形状决定，而由是否经过显式 materialization 决定。

## 2. Key Constraint

payload 只表达“临时模型表数据”。  
payload 内不再承载 `action` 字段来表达“增删改查动作”。

也就是说：

- payload = 数据
- 动作语义 = 由接收它的程序模型 / pin 名称决定

### 2.1 Pin Payload Rule (0331)

所有正式业务 `pin.in` / `pin.out` / `pin.bus.cb.in` / `pin.bus.cb.out` / `pin.bus.mb.in` / `pin.bus.mb.out` 的非空 value 都必须是本文件定义的临时模型表 payload，也就是 JSON record array。

允许的空值：
- `null` / `undefined` 可用于声明 pin 或清空 pin。

禁止作为正式业务 pin value：
- object envelope，例如 `{ "op": "write", "records": [...] }`
- object event，例如 `{ "action": "submit", "target": {...} }`
- 直接字符串 / 数字 / 布尔值

如果确实需要传递这些值，必须把它们包成临时模型表中的 label，例如：

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "value", "t": "str", "v": "hello" }
]
```

### 2.2 Reserved Metadata Labels

临时模型表 payload 可以包含系统内置 metadata label。metadata label 的 key 必须使用 `__mt_` 前缀。

当前保留 key：

| key | t | 说明 |
|---|---|---|
| `__mt_payload_kind` | `str` | payload 类型，例如 `write_label.v1` |
| `__mt_request_id` | `str` | 请求 id；用于审计/去重 |
| `__mt_from_cell` | `json` | 来源 cell，格式 `{ "p": 1, "r": 1, "c": 1 }` |
| `__mt_target_cell` | `json` | 目标 cell，格式 `{ "p": 2, "r": 2, "c": 2 }` |
| `__mt_status` | `str` | 处理结果状态，例如 `"ok"` / `"rejected"` |
| `__mt_error` | `json` | 接收方写回的结构化错误 |

约束：
- `__mt_*` 只表达传输/处理过程所需信息。
- 用户业务 label 不得使用 `__mt_` 前缀。
- 接收程序解析业务 label 时，必须忽略 `__mt_*` metadata。

### 2.2a Table-Qualified ModelRef Metadata（0424 target）

0424 target 下，跨 table、跨 principal、跨 installed App instance 的 durable model reference 必须使用 table-qualified metadata。

目标保留 key：

| key | t | 说明 |
|---|---|---|
| `origin_table_id` | `str` | 来源 table namespace |
| `origin_model_id` | `int` | 来源 model id，作用域为 `origin_table_id` |
| `reply_target_table_id` | `str` | 回包目标 table namespace |
| `reply_target_model_id` | `int` | 回包目标 model id，作用域为 `reply_target_table_id` |
| `principal_ref` | `json` | 诊断用 principal 信息；server-side session 仍是 authority |

规则：
- `origin_model_id` / `reply_target_model_id` 在 App instance traffic 中不得单独作为 durable target。
- 客户端或远端 worker 回传的 `principal_ref` 不能替代 server-side session / capability check。
- 在只有当前 table 上下文的内部临时 payload 中，bare `id` 仍是 message-local temporary id，不是正式 `model_id`。

### 2.3 Canonical writeLabel Payload (0331)

`writeLabel` 是一个受限跨 cell 写入请求：
- 只能写当前模型内的一个目标 cell。
- 只能写一个用户 label。
- 不携带 `model_id`；当前模型由执行上下文和 pin 链路决定。
- 过程字段也必须是临时模型表 label。

合法 payload：

```json
[
  {
    "id": 0,
    "p": 0,
    "r": 0,
    "c": 0,
    "k": "__mt_payload_kind",
    "t": "str",
    "v": "write_label.v1"
  },
  {
    "id": 0,
    "p": 0,
    "r": 0,
    "c": 0,
    "k": "__mt_request_id",
    "t": "str",
    "v": "req_123"
  },
  {
    "id": 0,
    "p": 0,
    "r": 0,
    "c": 0,
    "k": "__mt_from_cell",
    "t": "json",
    "v": { "p": 1, "r": 1, "c": 1 }
  },
  {
    "id": 0,
    "p": 0,
    "r": 0,
    "c": 0,
    "k": "__mt_target_cell",
    "t": "json",
    "v": { "p": 2, "r": 2, "c": 2 }
  },
  {
    "id": 0,
    "p": 0,
    "r": 0,
    "c": 0,
    "k": "testk",
    "t": "testtype",
    "v": "testv"
  }
]
```

这是 0332 current example。0424 target 下，若该 payload 属于 App instance traffic，必须在同一 record array 中额外写入 `origin_table_id` 与 `reply_target_table_id`，使 origin / reply target 成为 table-qualified `ModelRef`。

接收方规则：
- `id` 必须全部为 `0`。
- `p/r/c` 必须全部为 `0/0/0`。
- 必须存在 `__mt_payload_kind = "write_label.v1"`。
- 必须存在有效 `__mt_target_cell`。
- 除 `__mt_*` metadata 外，必须且只能存在一个用户 label。
- 如果存在 0 个或多于 1 个用户 label，必须 reject，并写入可审计错误。
- `writeLabel` 不支持一次写多个 cell；批量写入必须由后续明确的新程序模型/pin 语义定义。

### 2.4 Canonical bus_send Payload (0332)

`bus_send.v1` 是 Model 0 root 上 `mt_bus_send_in` 的内部请求格式。它用于把一个已经是临时模型表数组的业务 payload 转成 `pin.bus.cb.out` 或 `pin.bus.mb.out` 上的临时模型表值。

合法 payload：

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_payload_kind", "t": "str", "v": "bus_send.v1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_request_id", "t": "str", "v": "req_123" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "bus", "t": "str", "v": "management" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "bus_out_key", "t": "str", "v": "model100_submit_bus" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "message_role", "t": "str", "v": "request" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "endpoint_worker_id", "t": "str", "v": "R1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "endpoint_table_id", "t": "str", "v": "host" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "endpoint_model_id", "t": "int", "v": 3000 },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "endpoint_pin", "t": "str", "v": "submit" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "origin_worker_id", "t": "str", "v": "U1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "origin_table_id", "t": "str", "v": "host" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "origin_model_id", "t": "int", "v": 100 },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "origin_pin", "t": "str", "v": "submit" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "reply_target_worker_id", "t": "str", "v": "U1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "reply_target_table_id", "t": "str", "v": "host" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "reply_target_model_id", "t": "int", "v": 100 },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "reply_target_pin", "t": "str", "v": "result" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "payload", "t": "json", "v": [
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "message_text", "t": "str", "v": "hello" }
  ] }
]
```

接收方规则：
- `bus_send.v1` 只能由 Model 0 `(0,0,0)` 的 `mt_bus_send` 处理。
- `bus` 必须是 `"control"` 或 `"management"`；UI / 滑动 App 交互默认使用 `"management"`。
- `payload` label 的 `v` 必须仍是临时模型表 record array。
- `message_role` 必须是 `"request"` 或 `"response"`；UI / 滑动 App 发起外发时写 `"request"`。
- `endpoint_*`、`origin_*`、`reply_target_*` 必须是 record array 中的 records，不能放在外层 JSON object 上。
- 旧对象请求，例如 `{ "op": "submit", "model_id": 100, ... }`，不得作为 `mt_bus_send_in` 的合法 pin value。

### 2.5 Canonical pin_payload Payload (0332)

`pin_payload.v1` 是 Model 0 `pin.bus.cb.out` / `pin.bus.mb.out` 的内部业务值格式。它本身仍是临时模型表数组；运行时或 server 在真正跨出系统边界时，可以把它还原为既有 transport packet：

对 imported slide app，远端 worker / model 来自 app root 的 `remote_bus_endpoint_v1`；远端 pin 来自当前被触发的公开 pin。UI Server 本地实例的 table-qualified `ModelRef`、host transport endpoint、回写目标和请求关联信息必须作为 payload record array 内的 metadata records 传递。

### 2.5a Provider-Owned Slide App Bundle Payload（0384 合同）

provider-owned 安装链路同样只传 Temporary ModelTable records。format is ModelTable-like, persistence is explicit materialization：传输过程中的 request / response 不会自动落表；只有 UI Server installer 在通过校验后才把 provider 返回的 bundle records materialize 成正式模型表。

bundle request 是 `pin_payload.v1 message_role=request` 的 nested `payload`：

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_payload_kind", "t": "str", "v": "slide_app_bundle_request.v1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "asset_id", "t": "str", "v": "r1-color-generator" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "requested_version", "t": "str", "v": "current" }
]
```

bundle response 是 `pin_payload.v1 message_role=response` 的 nested `payload`：

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_payload_kind", "t": "str", "v": "slide_app_bundle_response.v1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "asset_id", "t": "str", "v": "r1-color-generator" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "bundle_payload", "t": "json", "v": [] },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "bundle_sha256", "t": "str", "v": "" }
]
```

`bundle_payload.v` 必须是可被 slide-app import validator 接受的 ModelTable record array。UI Server 必须把 pending install state 与 response envelope 一起校验：`op_id` 或 request correlation、`asset_id`、provider endpoint、computed `topic`、`route_kind`、`reply_target` 都必须匹配。任何 stale / mismatched response 都不得 materialize。

合法 `pin_payload.v1` 内部业务值示例：

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_payload_kind", "t": "str", "v": "pin_payload.v1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_request_id", "t": "str", "v": "req_123" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "op_id", "t": "str", "v": "req_123" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "message_role", "t": "str", "v": "request" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "endpoint_worker_id", "t": "str", "v": "R1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "endpoint_table_id", "t": "str", "v": "host" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "endpoint_model_id", "t": "int", "v": 3000 },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "endpoint_pin", "t": "str", "v": "submit" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "origin_worker_id", "t": "str", "v": "U1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "origin_table_id", "t": "str", "v": "app:subject:drop:submit:001" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "origin_model_id", "t": "int", "v": 0 },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "origin_pin", "t": "str", "v": "submit" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "reply_target_worker_id", "t": "str", "v": "U1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "reply_target_table_id", "t": "str", "v": "app:subject:drop:submit:001" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "reply_target_model_id", "t": "int", "v": 0 },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "reply_target_pin", "t": "str", "v": "result" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "payload", "t": "json", "v": [
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "text", "t": "str", "v": "hello" }
  ] }
]
```

这是 0425 App instance example。`endpoint_table_id` 仍为 `host`，因为 transport topic 只能投递到 worker/model/pin；`origin_table_id` 与 `reply_target_table_id` 才描述 App instance table。

外层 transport packet 只用于跨系统边界承载上述 record array，不是业务 pin value：

```json
{
  "version": "v1",
  "type": "pin_payload",
  "payload": [
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_payload_kind", "t": "str", "v": "pin_payload.v1" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_request_id", "t": "str", "v": "req_123" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "op_id", "t": "str", "v": "req_123" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "message_role", "t": "str", "v": "request" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "endpoint_worker_id", "t": "str", "v": "R1" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "endpoint_table_id", "t": "str", "v": "host" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "endpoint_model_id", "t": "int", "v": 3000 },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "endpoint_pin", "t": "str", "v": "submit" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "origin_worker_id", "t": "str", "v": "U1" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "origin_table_id", "t": "str", "v": "app:subject:drop:submit:001" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "origin_model_id", "t": "int", "v": 0 },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "origin_pin", "t": "str", "v": "submit" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "reply_target_worker_id", "t": "str", "v": "U1" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "reply_target_table_id", "t": "str", "v": "app:subject:drop:submit:001" },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "reply_target_model_id", "t": "int", "v": 0 },
    { "id": 0, "p": 0, "r": 0, "c": 0, "k": "reply_target_pin", "t": "str", "v": "result" }
  ]
}
```

边界转换规则：
- `pin.bus.cb.out` / `pin.bus.mb.out` label 的 `v` 必须是 `pin_payload.v1` 临时模型表数组，而不是上述 object packet。
- MQTT / Matrix / MBR 等外层 transport 可以继续使用 object packet；这是系统边界 envelope，不是业务 pin value。
- `pin_payload.v1.payload` 里的业务内容必须仍是临时模型表 record array。
- `message_role` 必须存在；`request` 触发目标程序链路，`response` 只作为回包转发和 UI materialization 输入。
- `response_topic` 必须由 UI Server / 宿主在发出 request 时生成。host-table 目标可直接由 `<mqtt_topic_base>/<reply_target_worker_id>/<reply_target_model_id>/<reply_target_pin>` 派生；App instance 目标必须使用 host transport endpoint，并在 records 中另写 `reply_target_table_id + reply_target_model_id` 作为 materialization target。request 的 `response_topic` 必须合法且不得等于 `topic`；response 的 `topic` 必须等于 `response_topic`。
- `endpoint_*` records 是远端公开入口目标，使用 `worker_id + model_id + pin` 定位目标 worker 上的目标模型 root 公开 pin。
- `reply_target_*` records 是本地回包目标，必须由 UI Server / 宿主在运行时生成，不能由 imported ZIP records 提供或覆盖。
- 0424 target 下，`origin_*` / `reply_target_*` 的本地模型目标必须 table-qualified；App instance traffic 必须同时携带 `origin_table_id` / `reply_target_table_id`。
- `endpoint_pin` 必须和 transport topic 的最后一段一致，且表示目标模型公开 Cell pin，不是直接跨 Cell 调用 `{functionName}:in`。
- MBR / MQTT adapter 只能使用 `topic` record 作为当前 packet 的 transport topic。唯一合法 topic 形态是 `UIPUT/<ws_id>/<dam_id>/<pic_id>/<de_id>/<worker_id>/<model_id>/<pin>`。
- 请求使用远端 endpoint topic；回包使用 `response_topic`。response packet 的 `endpoint_*` 必须与当前 `topic` 的 host transport endpoint 一致；`reply_target_*` 必须与最终本地 materialization target 一致。host-table 目标下两者可以相同；App instance 目标下二者通常不同。
- `route.reply_to`、`return_topic`、`returnTopic`、`result_topic` 与旧 result topic 不是当前输入面；不能作为回包目标、不能兼容解析。

## 3. Imported Feishu Evidence

Feishu 原文中已经给出多组示例，且这些示例都符合上述形态：

- `Array.add_data:in`
- `Array.delete_data:in`
- `Queue.add_data:in`
- `Stack.add_data:in`
- `FlowTicket.new_ticket:in`
- `FlowTicket.find_by_id:in`

这些示例有两个关键信号：

1. 输入数据本体是记录数组，而不是 envelope 对象  
2. 动作由 pin 名称表达，例如：
   - `add_data:in`
   - `delete_data:in`
   - `find_by_id:in`

## 4. Canonical Examples

### 4.1 Single Record Model Payload

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "model_type", "t": "model.single", "v": "Data.Single" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "参数1", "t": "str", "v": "hello" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "参数2", "t": "int", "v": 123 }
]
```

### 4.2 Table-Like Payload

```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "model_type", "t": "model.table", "v": "Data" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "ticket_id", "t": "str", "v": "" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "column", "t": "int", "v": 0 },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "ticket_step", "t": "int", "v": 5 },
  { "id": 0, "p": 0, "r": 0, "c": 1, "k": "model_type", "t": "model.single", "v": "Data.Single" },
  { "id": 0, "p": 0, "r": 0, "c": 1, "k": "参数1", "t": "str", "v": "hello" },
  { "id": 0, "p": 0, "r": 0, "c": 1, "k": "参数2", "t": "int", "v": 123 }
]
```

说明：
- 当前 imported source 中仍有少数示例值缺失、字段未加引号等不完整文本。
- repo 权威版本以“字段结构”与“动作不在 payload 中”这两个核心约束为准。

## 5. Explicit Non-Goals

本文件当前不定义：

- 记录数组如何选择具体 materialization 算法
- `id` 与正式 `model_id` 的映射算法；默认情况下二者没有映射关系
- 程序模型收到 payload 后如何执行 add/update/delete；Data.* 目标语义见 `docs/ssot/feishu_data_model_contract_v1.md`
- `MBR` / MQTT / Matrix 如何编码该 payload

这些内容由：
- [[docs/ssot/program_model_pin_and_payload_contract_vnext]]
- 以及 `foundation B` 迁移实现迭代  
继续定义。
