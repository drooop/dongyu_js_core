# ModelTable User Guide (Living Doc)

> Status: Living Doc
> This document MUST be updated whenever any of the following change:
> - mailbox contract (event envelope, error codes, single-slot policy)
> - PIN topic/payload rules
> - MGMT patch rules or routing rules
> - reserved model ids / reserved cells

## 0. Who This Is For
本指南面向需要“直接填写模型表单元格”的开发/集成/测试人员。

## 1. Mental Model (SSOT-aligned)
- ModelTable 是唯一真值；UI 只是投影。
- 所有副作用必须由 add_label / rm_label 触发。
- 管理总线（MGMT）与控制总线（PIN/MQTT）只处理“纯 ModelTable patch”。

## 2. Reserved Models (System)
- `model_id = 0`：root（配置/Pin registry/Pin mailbox）
- `model_id = -1`：editor_mailbox（UI event mailbox）
- `model_id = -2`：editor_state（UI 控件状态）
- 其他负数 model_id 为系统自带模型（基座应用层能力扩展）；用户不得创建/写入
- 用户模型必须 `>= 1`
- 系统负数模型的 bootstrap 定义来源：`packages/worker-base/system-models/*.json`

## 3. User Input (Mailbox)
UI 只能写 event mailbox：`model_id=-1 Cell(0,0,1) k=ui_event t=event`。
Mailbox 的 envelope 必须包含 `op_id`（用于审计/去重）。

参考合同：`docs/iterations/0129-modeltable-editor-v0/contract_event_mailbox.md`

## 4. ModelTablePatch v0 (统一消息体)
所有总线消息必须是“纯 ModelTable patch”，最小结构如下：

```json
{
  "version": "mt.v0",
  "op_id": "op_123",
  "records": [
    {
      "op": "add_label",
      "model_id": 1,
      "p": 2,
      "r": 3,
      "c": 4,
      "k": "pageA.textA1",
      "t": "str",
      "v": "hello"
    }
  ]
}
```

`op_id` 必须存在（包含本地触发）。

## 5. PIN (Control Bus)
### 5.1 用户填写方式
用户模型里：

- PIN_IN：`k=<pin_name>, t=PIN_IN, v=<TargetRef>`
- PIN_OUT：`k=<pin_name>, t=PIN_OUT, v=<ModelTablePatch>`

TargetRef 结构：
```json
{ "model_id": 1, "p": 2, "r": 3, "c": 4, "k": "pageA.textA1" }
```

### 5.2 行为
- PIN_IN：MQTT 入站 payload 是 ModelTablePatch，运行时把 patch 应用到 TargetRef。
- PIN_OUT：用户写入 ModelTablePatch，运行时将 patch 作为 MQTT payload 发送。

### 5.3 示例（A/B/C）
- A 页面订阅 pinA：
  - `k=pinA, t=PIN_IN, v={ model_id:1,p:2,r:3,c:4,k:"pageA.textA1" }`
- 远端发送 pinA：payload = ModelTablePatch，textA1 更新。

## 6. MGMT (Management Bus, MBR Format v0)

本节以 **MBR 当前可执行格式** 为准：消息体是 JSON 文本，字段固定；topic 为固定分段。

### 6.1 MBR Topic（8 段）
```
UIPUT/<workspace>/<dam>/<pic>/<de>/<sw>/<model>/<cell_k>
```

每段必须符合：`^[A-Za-z0-9_-]+$`

### 6.2 Matrix 侧 payload（UI ↔ MBR）
必填字段：
- `topic`: string（8 段）
- `signature`: string（trace id，全链路透传）
- `k`: string（PIN 名称）
- `t`: string（`str` 或 `json`）
- `v`: string（当 `t=json` 时为 JSON 文本）
- `timestamp`: string（毫秒级 Unix 时间戳）

### 6.3 MQTT 侧 payload（Worker ↔ MBR）
必填字段：
- `userid`: string（Matrix 用户 id）
- `signature`, `k`, `t`, `v`, `timestamp`

### 6.4 系统填写方式（只填 Cell）
系统在系统负数模型里只需要填写 **TargetRef**：

```
{ "model_id": 1, "p": 2, "r": 3, "c": 4, "k": "pageA.textA1" }
```

用于：
- 出站：`k=<channel>, t=MGMT_OUT, v=<MBR_Matrix_Payload>`
- 入站订阅：`k=<channel>, t=MGMT_IN, v=<TargetRef>`

**分格规则（必须）**：
- `MGMT_OUT` 与 `MGMT_IN` 必须写在不同的 cell（不同的 `p/r/c`），避免同一 cell 内同名 `k` 覆盖与方向歧义。
- 若同一 `channel` 需要同时支持收发，建议使用相同 `k` 但不同 cell 坐标。

其中：
- `channel == k`（用于匹配）
- `MBR_Matrix_Payload` 为上述 Matrix payload 结构（topic/signature/k/t/v/timestamp）

### 6.5 匹配规则
MGMT_IN 仅在以下条件全部满足时写入：
1) `session_id` 一致（由系统注入，用户不填写）
2) `channel == Label.k`
3) 若消息带 `target`，坐标必须与该 cell 完全一致

### 6.6 示例（A/B/C）
页面 A/B/C 的 Text 组件：
- `pageA.textA1`
- `pageB.textB1`
- `pageC.textC1`

系统声明：
- `k=pageA.textA1, t=MGMT_IN, v={ model_id:1,p:2,r:3,c:4,k:"pageA.textA1" }`

远端返回（Matrix payload）示例：
```json
{
  "topic": "UIPUT/ws_test/dam/pic/de/sw/model/pageA.textA1",
  "signature": "sig-...",
  "k": "pageA.textA1",
  "t": "str",
  "v": "hello",
  "timestamp": "1733943035123"
}
```

### 6.7 对齐说明
- 若与 `docs/ssot/runtime_semantics_modeltable_driven.md` 冲突，以该文档为准。
- Mailbox 合同冻结：`docs/iterations/0129-modeltable-editor-v0/contract_event_mailbox.md`。

## 7. Env vs ModelTable
生产环境中仅以下信息来自 env，**不得写入 ModelTable**：
- Matrix token / password
- MQTT 凭证（如需）

允许通过 env 提供 ModelTablePatch：
- `MODELTABLE_PATCH_JSON`：ModelTablePatch v0（可指向系统负数模型与目标 Cell）
- 测试环境可包含敏感项，但可能出现在 EventLog / snapshot / runlog 中

ModelTable 只保存可审计的结构化声明与 patch。

## 8. Troubleshooting
- `reserved_cell`: 写入了保留模型或保留坐标
- `op_id_replay`: op_id 重复
- `invalid_target`: target 缺失/类型不对

建议先查 `ui_event_error` 与 EventLog。

## 9. Connectivity Test (CellA/CellB 双向)
本测试只依赖 MBR 格式与 ModelTable，不依赖 UI 特殊逻辑。

### 9.1 CellA（模拟 UI 侧 → MBR）
在系统负数模型中写：
- `k=pageA.submitA1, t=MGMT_OUT`
- `v` 填入 MBR Matrix payload（JSON 文本），例如：
```json
{
  "topic": "UIPUT/ws_test/dam/pic/de/sw/model/pageA.submitA1",
  "signature": "sig-1111",
  "k": "pageA.submitA1",
  "t": "str",
  "v": "hello",
  "timestamp": "1733943035123"
}
```

预期：
- MBR 将该 payload 转发到 MQTT（同名 topic）。

### 9.2 CellB（模拟 Worker → MBR → UI 回包）
先在系统负数模型中声明入站目标：
- `k=pageA.textA1, t=MGMT_IN, v={ model_id:1,p:2,r:3,c:4,k:"pageA.textA1" }`

使用 MQTT 客户端向同名 topic 发送 payload：
```json
{
  "userid": "@your_user:server",
  "signature": "sig-2222",
  "k": "pageA.textA1",
  "t": "str",
  "v": "updated",
  "timestamp": "1733943035123"
}
```

预期：
- MBR 私聊回 Matrix，程序模型写回 `pageA.textA1` 的目标 cell。
