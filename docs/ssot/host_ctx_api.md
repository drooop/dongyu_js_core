---
title: "Host Capability Interface (V1N API)"
doc_type: ssot
status: active
updated: 2026-04-24
source: ai
---

# Host Capability Interface (V1N API)

本文件定义宿主层暴露给"程序模型函数"的最小能力集合。

0323 起，用户程序 API 面统一使用 **V1N 命名空间**，替代原 ctx 命名空间。

## 0. 权限模型总则（0323）

两级权限分层：

| 层级 | 适用范围 | 写权限 | 读权限 |
|---|---|---|---|
| **模型内特权** | (0,0,0) 默认三程序（mt_write / mt_bus_receive / mt_bus_send） | 当前模型内任意 Cell | 当前模型内任意 Cell |
| **沙箱** | 用户自定义程序（非 (0,0,0) 默认程序） | 仅自身 Cell | 当前模型内任意 Cell |

核心约束：
- 用户程序不得直接读写其他模型的 Cell。
- 跨 Cell 写入必须通过 pin 路由到 (0,0,0) 的 `mt_write_req` 输入。
- 跨模型通信必须通过 pin 链路经 Model 0 路由。
- 用户程序不得直接调用 `applyPatch` / `applyScopedPatch`。

## 1. V1N 数据访问 API（用户程序面）

- `V1N.addLabel(k, t, v)`
  - 在当前 Cell 写入 label，通过 ModelTable 触发副作用
  - 无坐标参数，作用域严格限定为执行函数所在的 Cell
  - 等价于 `runtime.addLabel(currentModel, currentP, currentR, currentC, {k, t, v})`

- `V1N.removeLabel(k)`
  - 删除当前 Cell 的 label
  - 无坐标参数，作用域严格限定为执行函数所在的 Cell

- `V1N.readLabel(p, r, c, k)`
  - 读取当前模型内任意 Cell 的 label 值（返回 `label.v` 或 `null`）
  - `p, r, c` 为当前模型内的坐标；model_id 隐式锁定为当前模型
  - 跨模型读取禁止：必须通过 pin 请求-响应模式

## 2. 跨 Cell 写入路径

用户程序无法直接写入其他 Cell。如需跨 Cell 修改 label，必须通过 pin 路由：

```
用户程序 Cell
  → write_label_req pin.out (携带临时 ModelTable payload)
  → pin.connect.cell 显式路由
  → (0,0,0) mt_write_req pin.in
  → mt_write 程序解析 write_label.v1 payload 并执行实际写入
  → mt_write_result pin.out (可选返回结果)
```

用户 API（0331 冻结 v1）：
```js
V1N.writeLabel(p, r, c, { k, t, v })
```

API 约束：
- `p/r/c` 是当前模型内目标 cell 坐标。
- `model_id` 隐式锁定为当前模型，不允许作为参数传入。
- `label` 必须包含一个非空 `k`、一个非空 `t` 和任意 JSON-compatible `v`。
- 一次调用只写一个目标 cell 的一个 label。

底层 pin payload 必须是 `docs/ssot/temporary_modeltable_payload_v1.md` 定义的临时 ModelTable record array。`writeLabel` 生成的 canonical payload：
```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_payload_kind", "t": "str", "v": "write_label.v1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_request_id", "t": "str", "v": "req_123" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_from_cell", "t": "json", "v": { "p": 1, "r": 1, "c": 1 } },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_target_cell", "t": "json", "v": { "p": 2, "r": 2, "c": 2 } },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "keyName", "t": "str", "v": "value" }
]
```

字段约束（规范层面冻结，实施由 0323+1 落地）：
- `__mt_payload_kind`：必须为 `"write_label.v1"`。
- `__mt_target_cell`：必填，且坐标必须位于当前 model.table 范围内，`mt_write` 拒绝越界。
- 非 `__mt_*` 用户 label：必须且只能有一个。
- `k`：非空字符串，且不得为 (0,0,0) 的保留 key（`mt_write` / `mt_bus_receive` / `mt_bus_send`），mt_write 拒绝覆盖保留 key
- `t`：遵循 `docs/ssot/label_type_registry.md` 注册的 label.t
- `v`：与 `t` 匹配的类型化 value

返回结果（可选 `mt_write_result`）也应使用临时 ModelTable payload，至少包含：
```json
[
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_payload_kind", "t": "str", "v": "write_label_result.v1" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_request_id", "t": "str", "v": "req_123" },
  { "id": 0, "p": 0, "r": 0, "c": 0, "k": "__mt_status", "t": "str", "v": "ok" }
]
```
- `__mt_status`：`"ok"` | `"rejected"`
- `__mt_error`：`__mt_status`=`"rejected"` 时必填，结构化错误码（当前至少含 `out_of_scope`、`reserved_key`、`type_mismatch`、`invalid_payload`、`multiple_user_labels`、`missing_user_label`）

向后兼容承诺：字段的新增必须保持既有字段的 addLabel/rmLabel 行为不变；删除或重命名既有字段需要 iteration 审批。

## 3. 跨模型通信路径

两种合法路径：

**路径 A — 子模型挂载：**
```
子模型 Cell → pin.out → (0,0,0) mt_bus_send:in → mt_bus_send → 模型边界 pin.out
  → 父模型 hosting cell pin.connect → 父模型处理
```

**路径 B — Model 0 中转：**
```
子模型边界 pin.out → pin.connect.model (Model 0) → 目标模型边界 pin.in
  → 目标模型 (0,0,0) mt_bus_receive:in → mt_bus_receive → 分发到目标 Cell
```

禁止任何绕过 pin 的直接跨模型读写。

## 4. (0,0,0) 默认三程序（模型内特权）

每个 model.table 的 (0,0,0) 必须包含以下三个 func.js 标签：

| func.js key | 引脚 | 职责 |
|---|---|---|
| `mt_write` | `mt_write_req` pin.in / `mt_write_result` pin.out | 接收写入请求，对当前 model.table 内任意 Cell 执行 addLabel/rmLabel |
| `mt_bus_receive` | `mt_bus_receive:in` / `mt_bus_receive:out` | 接收从父模型路由下来的消息，分发到模型内目标 Cell |
| `mt_bus_send` | `mt_bus_send:in` / `mt_bus_send:out` | 汇集模型内 Cell 的外发消息，上行到父模型边界 |

约束：
- 这三个程序是系统提供的基础设施，用户不得覆盖或删除。
- 这三个程序拥有模型内特权：可读写当前模型内任意 Cell。
- 替代原 (0,1,0) helper executor 模式（**仅 model.table 场景**；model.single 场景仍保留 helper scaffold，详见 `docs/ssot/runtime_semantics_modeltable_driven.md` §5.2f）。

## 5. MGMT 相关（待迁移）

以下 API 在后续实现迭代中将迁移为 pin 链路通信：

- `ctx.getMgmtOutPayload(channel?)` → DEPRECATED
- `ctx.getMgmtInTarget(channel)` → DEPRECATED
- `ctx.getMgmtInbox()` / `ctx.clearMgmtInbox()` → DEPRECATED
- `ctx.sendMatrix(payload)` → DEPRECATED

迁移方向：通过 (0,0,0) mt_bus_send 经 pin 链路上行到 Model 0，由 Model 0 负责管理总线外发。

## 6. PIN/MQTT 相关（系统级，非用户程序面）

以下能力仅限系统级程序（如 Model 0 的 trusted bootstrap）：

- `ctx.startMqttLoop()` — 仅 Model 0 trusted bootstrap
- `ctx.currentTopic(pinName)` — 系统级 topic 计算
- `ctx.mqttIncoming(topic, payload)` — 系统级入站处理

用户程序不暴露这些能力。

## 7. Deprecated API（兼容期）

以下 API 标注为 DEPRECATED，仅在兼容期内保留：

| 原 API | 替代 | 说明 |
|---|---|---|
| `ctx.writeLabel(ref, t, v)` | `V1N.addLabel(k, t, v)` + pin 路由 | 无限制跨模型写 → 仅自身 Cell |
| `ctx.getLabel(ref)` | `V1N.readLabel(p, r, c, k)` + pin 请求 | 无限制跨模型读 → 仅当前模型 |
| `ctx.rmLabel(ref)` | `V1N.removeLabel(k)` + pin 路由 | 无限制跨模型删 → 仅自身 Cell |
| `ctx.getState(key)` | `V1N.readLabel` 指向 editor_state 模型 | 待迁移 |
| `ctx.getStateInt(key)` | 同上 | 待迁移 |
| helper executor (0,1,0) | (0,0,0) mt_write 程序 | 仅 model.table 场景替代；model.single 保留 helper scaffold |

兼容期结束条件：后续实现迭代完成所有系统函数迁移后，正式移除。

## 8. 约束与保留

- 任何副作用都必须可追溯：EventLog / mqttTrace / intercepts。
- V1N API 面必须保持最小能力集。
- ctx 不得直接持久化/访问 secrets。
- 当前产品路径允许将 Matrix token / password 作为 trusted bootstrap patch 的一部分落到 Model 0，用于进程启动期读取。
