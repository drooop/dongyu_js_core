# Host Capability Interface (ctx API)

本文件定义宿主层暴露给“程序模型函数”的最小能力集合（ctx API）。

约束：
- ctx 只能调用 ModelTable 的结构性入口（add_label / rm_label）。
- ctx 不得绕过 ModelTable 直接触发副作用。
- ctx 只对系统负数模型函数可用（model_id < 0）。

## 1. 数据访问

- `ctx.getLabel(ref)`
  - 读取某个 Cell 的 label 值（返回 `label.v` 或 `null`）
  - `ref` 结构：`{ model_id, p, r, c, k }`

- `ctx.writeLabel(ref, t, v)`
  - 等价于 `runtime.addLabel`，通过 ModelTable 触发副作用
  - `ref` 结构：`{ model_id, p, r, c, k }`

- `ctx.getState(key)`
  - 读取 editor_state（`model_id=-2`、`p=0,r=0,c=0`）中的某个 label

- `ctx.getStateInt(key)`
  - 读取并尝试解析为 int（失败返回 null）

## 2. MGMT 相关

- `ctx.getMgmtOutPayload(channel?)`
  - 读取系统负数模型中 `Label.t = "MGMT_OUT"` 的 payload

- `ctx.getMgmtInTarget(channel)`
  - 读取系统负数模型中 `Label.t = "MGMT_IN"` 的 TargetRef

- `ctx.getMgmtInbox()` / `ctx.clearMgmtInbox()`
  - 读取/清空系统负数模型中的 `mgmt_inbox`（原始管理总线消息）

- `ctx.sendMatrix(payload)`
  - 通过宿主发送 Matrix 消息（payload 为 MBR 约定格式）

## 3. PIN/MQTT 相关

- `ctx.startMqttLoop()`
  - 使用 ModelTable 的 mqtt_target_* 配置启动 MQTT loop

- `ctx.currentTopic(pinName)`
  - 计算 pin topic（Backward compatible）
  - 默认（Stage2）：依据 `mqtt_target_topic_prefix` 返回 `<prefix>/<pinName>`
  - `uiput_mm_v1`：依据 `mqtt_topic_base` 与当前 model_id 返回 `<base>/<model_id>/<pinName>`（pinName 必须为 leaf，不含 `/`）

- `ctx.mqttIncoming(topic, payload)`
  - 通过运行时写入 PIN_IN 的入站消息

## 4. 约束与保留

- ctx 只面向系统负数模型函数，用户模型不得直接调用。
- ctx 不得直接持久化/访问 secrets（如需使用，必须经宿主配置与审计）。
- 任何副作用都必须可追溯：EventLog / mqttTrace / intercepts。
