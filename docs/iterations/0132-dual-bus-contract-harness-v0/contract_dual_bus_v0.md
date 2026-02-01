# Dual Bus Contract v0 (Matrix ↔ MBR ↔ MQTT)

本契约仅描述 v0 的最小可判定闭环。管理总线与控制总线是抽象概念；Matrix 仅作为 ManagementBusAdapter 的 concrete 实现之一。

## 0. Scope
- 管理总线（Management Bus）：承载 UI 事件与投影更新的总线抽象。
- 控制总线（Control Bus）：承载执行侧副作用（PIN_IN/OUT + MQTT）的总线抽象。
- MBR：Management Bus 与 Control Bus 的桥接与策略中枢。

## 1. Non-goals
- 不涉及 E2EE / Element Call。
- 不引入“通用 ModelTable mutation over bus”。
- 不把 Matrix 视为“管理总线本体”。

## 2. Core Invariants
- UI 只写 event mailbox；UI 不得直连 Matrix/MQTT。
- 所有副作用必须由 `add_label`/`rm_label` 触发（ModelTable-driven）。
- MGMT 声明仅允许在系统负数模型中定义；用户模型入口保持为 PIN_IN / PIN_OUT。
- 生产环境 secrets 不得写入 ModelTable / EventLog / runlog（测试环境可允许，但需明确标注并接受可观测暴露）。

## 3. Identity & Idempotency
- `op_id` 是跨总线的因果主键（来自 mailbox envelope）。
- MBR 必须以 `op_id` 去重/防重放。
- 任何外部输入都必须能映射到某个 `op_id` 或被判定为无效输入。

## 4. Management Bus Message (v0)
### 4.1 Envelope
- 版本：`v0`
- 字段（最小集合）：
  - `version`: 固定 `"v0"`
  - `type`: `"ui_event" | "snapshot_delta" | "pin_out" | "error"`
  - `op_id`: string
  - `payload`: object
  - `trace` (optional): `{ room_id?, event_id?, sender? }`

### 4.2 UI Event Payload (type = ui_event)
- 必须复用 Stage 3 mailbox contract：`contract_event_mailbox.md` 的 envelope 结构。
- `payload` 应包含 `action/target/value/meta` 等字段（与 Stage 3 一致）。

### 4.3 Snapshot/Delta Payload (type = snapshot_delta)
- `payload` 必须可映射到 ModelTable 结构变化（以 `add_label/rm_label` 形式写回）。
- 不允许 UI 直接声明副作用。

### 4.4 PIN_OUT Payload (type = pin_out)
- 用于把 Control Bus 的 PIN_OUT 结果回传至 Management Bus。
- `payload` 至少包含：`pin`, `value`, `t="OUT"`。

## 5. Control Bus Message (v0, MQTT)
### 5.1 Topic
- 复用 `docs/iterations/0123-pin-mqtt-loop/validation_protocol.md` 的 v0 约定：
  - `<prefix>/<pin_name>`（若 prefix 为空则为 `<pin_name>`）

### 5.2 Payload
- 复用 v0 约定：`{ pin: <pin_name>, value: <payload>, t: "IN|OUT" }`
- 允许把 `op_id` 嵌入 `value`（例如 `value = { op_id, body }`），不改变外层结构。

## 6. MBR Bridging Rules (v0)
- Mgmt → Control：
  - `ui_event` 必须映射为 `PIN_IN`（通过 add_label 写入 mailbox）。
  - MBR 必须保留 `op_id` 并用于去重。
- Control → Mgmt：
  - `PIN_OUT` 必须映射为 `pin_out` 管理总线消息，并写回 ModelTable 投影。

## 7. Matrix Adapter Mapping (v0)
- Matrix 仅作为 ManagementBusAdapter 实现。
- 适配要求：
  - 必须在 room 中发送/接收可解析的 MgmtBusEventV0。
  - 不得输出 secrets（token/密码不出现在 payload 与日志中）。
- 事件编码建议（可调整，但需版本化）：
  - `event_type`: `"dy.bus.v0"`
  - `content`: MgmtBusEventV0 JSON

## 8. Config Inputs (keys only)
### 8.1 Env Contract (keys only)
- `MATRIX_HOMESERVER_URL`
- `MATRIX_MBR_USER`
- `MATRIX_MBR_PASSWORD`
- `MATRIX_MBR_ACCESS_TOKEN` (optional)

### 8.2 Auth Priority
- 若存在 `MATRIX_MBR_ACCESS_TOKEN`，优先使用 token。
- 否则使用 `MATRIX_MBR_USER` + `MATRIX_MBR_PASSWORD`。

### 8.3 Room Selection
- `room_id/room_alias` 由 harness 输入提供，不写入 `.env` 或 ModelTable。

### 8.4 Redaction Rules
- token/密码不得出现在日志、EventLog、runlog 与 ModelTable snapshot 中。

## 9. Observability
- matrix-live 验收必须输出：`room_id`, `event_id`, `op_id`（值可记录但不得暴露 secrets）。
- harness 必须可输出 MQTT trace（connect/subscribe/publish）与 ModelTable EventLog。
