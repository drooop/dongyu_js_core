# 定位说明（必须写在文件开头）

本文件是 派生运行时语义规范（Derived Runtime Semantics Spec）。

上位约束：`docs/architecture_mantanet_and_workers.md`

作用对象：所有软件工人运行时（Python/JS）

目的：统一解释“ModelTable 中的结构性声明如何在运行时产生副作用”

本文件不是实现指南，而是语义裁判规则。

宿主能力接口规范：`docs/ssot/host_ctx_api.md`

---

# Runtime Semantics: ModelTable-Driven Side Effects (v0)

## 0. Scope & Intent

本规范定义 ModelTable 中的结构性声明（Cell / Label）如何在运行时产生副作用。

核心原则：
- 副作用不是写代码触发的
- 副作用是模型表结构变化的结果
- 运行时只负责解释，不负责发明语义

应用层能力必须由 ModelTable 的结构性声明表达；系统级扩展通过系统自带的负数 model_id 模型承载，不改变运行时的语义边界与入口约束。

本规范适用于但不限于：
- PIN_IN / PIN_OUT
- 连接类声明（CONNECT）
- 运行触发类声明（run_<func>）
- 系统配置类声明（mqtt_target_*、v1n_id、data_type 等）

---

## 1. 核心概念定义（必须统一）

### 1.1 Structural Declaration（结构性声明）

当一个 Label(k, t, v) 被写入 ModelTable，且其 (k, t) 落入 运行时已知的解释域 时，该写入被称为结构性声明。

结构性声明的特点：
- 不表示“数据值”
- 表示“运行时应当建立/移除某种能力或连接”

### 1.2 Runtime Side Effect（运行时副作用）

运行时副作用是指：

运行时根据 ModelTable 的结构性声明，对外部系统或内部运行态做出的可观测动作。

例如：
- 订阅/取消订阅 MQTT topic
- 建立/解除 PIN 连接
- 注册/调用函数
- 写入运行时状态（如 last_msg_received）

### 1.3 System Negative Models（系统负数模型）

- `model_id < 0` 为系统负数模型：承载基座应用层能力扩展（非核心解释器变更）。
- 系统负数模型的静态定义以仓库内 JSON 作为 bootstrap 来源（启动时注入 ModelTable）；运行时真值仍以 ModelTable 为唯一数据源。
- 系统内建 `k` 为保留命名空间：用户模型可调用但不得重定义其语义。

---

## 2. 副作用触发机制（统一规则）

### 2.1 唯一触发入口

所有运行时副作用必须通过以下入口触发：
- add_label
- rm_label

禁止：
- 在其他代码路径中直接触发副作用
- 绕过 ModelTable 执行订阅、连接、调用等行为

### 2.2 初始化阶段的语义

初始化阶段定义为：
- 从持久化存储（如 sqlite）重建内存 ModelTable 的过程

规则：
- 初始化阶段通过 重放 add_label 建立内存状态
- 所有结构性声明的副作用必须在初始化阶段被一致触发
- 初始化与运行期的解释规则完全一致

---

## 3. 运行期动态语义（必须明确）

### 3.1 新增声明

运行期新增结构性声明（新的 Label）
→ 视同初始化阶段的 add_label
→ 必须触发相同副作用

### 3.2 删除声明

运行期删除结构性声明（rm_label）
→ 必须触发对应的逆向副作用

例如：
- 删除 PIN_IN → unsubscribe
- 删除 CONNECT → disconnect
- 删除 run_<func> → 取消可触发入口（若适用）

---

## 4. 唯一性与冲突处理（通用规则）

### 4.1 唯一性约束

当某类结构性声明被定义为 全局唯一 时：
- 系统负数模型域内：同一 k 在系统域内只能出现一次
- 用户模型域内：不要求全局唯一，仅要求同一 cell 内不重复
- 系统内建 k 视为保留字，用户不得覆盖/重定义其语义

冲突写入必须：
- 被 rejected
- 写入错误到 ModelTable（可审计）
- 不得 silent fail

### 4.2 冲突不是异常，是事实

冲突写入是合法事件，但结果必须可追溯（EventLog + error label）。

---

## 5. PIN_IN / PIN_OUT 只是实例，不是特例

### 5.1 PIN_IN 的语义归类

Label(k=<topic>, t="PIN_IN") 属于：
- 声明式外部输入通道（Declarative External Input Channel）

其副作用：
- 订阅 topic
- 将外部消息写回 ModelTable

### 5.2 其他同类声明（示例）

以下声明都服从本规范：
- CONNECT_*：声明连接关系
- run_<func>：声明可运行入口
- mqtt_target_*：声明运行时配置
- v1n_id / data_type：声明系统级约束

PIN_IN 不享有任何"特殊通道"。

### 5.2b CELL_CONNECT / cell_connection（0141）

**label.t 分发**：`_applyBuiltins` 首先按 `label.t` 分发，独立于 `label.k` connectKeys 检查。

| label.t | 触发 | 位置约束 |
|---|---|---|
| `CELL_CONNECT` | `_parseCellConnectLabel` → 构建 `cellConnectGraph` | 任意 Cell |
| `cell_connection` | `_parseCellConnectionLabel` → 构建 `cellConnectionRoutes` | 仅 (0,0,0) |
| `IN` | 若 Cell 有 `cellConnectGraph` 条目 → `_propagateCellConnect` (async) | 任意 Cell |

**CELL_CONNECT 端点格式**：`(prefix, port)`
- prefix = `self` | `func` | `<numericModelId>`
- self 目标：写 label(t='OUT') + 递归传播
- func 目标：`:in` 后缀 → `_executeFuncViaCellConnect`，`:out` 后缀 → 继续传播
- numeric 目标：路由到子模型 MODEL_IN（0142 实现）

**cell_connection 路由格式**：`[{from: [p,r,c,k], to: [[p,r,c,k], ...]}]`
- 同 Model 内跨 Cell 路由，写入目标 Cell 的 label(t='IN')

**AsyncFunction 隔离**：`_executeFuncViaCellConnect` 使用 `AsyncFunction` 构造器，完全独立于 `worker_engine_v0.mjs` 的同步 `executeFunction`。支持 30s 超时，错误写入 `__error_<funcName>` label。

**循环检测**：`_propagateCellConnect` 携带 `visited` Set，重复端点写入 eventLog(reason='cycle_detected') 后跳过。

### 5.2c BUS_IN/BUS_OUT 系统边界（0142）

| label.t | 位置约束 | 语义 |
|---|---|---|
| `BUS_IN` | 仅 Model 0 (0,0,0) | 注册外部输入端口 → `busInPorts` Map |
| `BUS_OUT` | 仅 Model 0 (0,0,0) | 注册外部输出端口 → `busOutPorts` Map |

- BUS_IN 写入 v 时 → 触发 cell_connection 路由（单一路由入口在 `_applyBuiltins`）
- BUS_OUT 写入 v 时 → 如有 mqttClient → `_topicFor(0, k, 'out')` 发布
- `mqttIncoming` 9layer 模式下 BUS_IN 短路：`busInPorts.has(pinName) && modelId === 0` → `_handleBusInMessage` → 不进入 legacy PIN_IN 路由
- `_subscribeDeclaredPinsOnStart` 追加 BUS_IN 端口 MQTT 订阅
- `_handleBusInMessage` 仅写 `addLabel(model0, 0,0,0, {k, t:'BUS_IN', v})`，路由由 `_applyBuiltins` 触发

### 5.2d MODEL_IN/MODEL_OUT 模型边界（0142）

| label.t | 位置约束 | 语义 |
|---|---|---|
| `MODEL_IN` | 仅 (0,0,0) | 注册模型输入端口 → `modelInPorts` Map |
| `MODEL_OUT` | 仅 (0,0,0) | 注册模型输出端口 → `modelOutPorts` Map |

- MODEL_IN 写入 v 时 → 子模型内 cell_connection 路由 + CELL_CONNECT 传播
- MODEL_OUT 写入 v 时 → 查 `parentChildMap` → 在父模型 hosting cell 上以 `(childModelId, portName)` 为源端口触发 CELL_CONNECT

### 5.2e subModel 声明与 parentChildMap（0142）

- `label.t === 'subModel'`, `label.k` = 子模型 ID（整数字符串）
- 注册到 `parentChildMap`: key=childModelId → {parentModelId, hostingCell:{p,r,c}}
- 如果子模型不存在 → 自动 `createModel({id, name: alias, type: 'sub'})`
- CELL_CONNECT 数字前缀路由：`(numericId, port)` → 查 parentChildMap → 写子模型 MODEL_IN

### 5.2f Bootstrap 加载顺序（0142）

1. `model_0_framework.json` → 创建 Model 0 结构（BUS_IN/OUT、subModel、CELL_CONNECT、cell_connection）
2. `system_models.json` → 填充 Model -10 等系统子模型
3. 应用模型 patch → 填充业务模型
4. `startMqttLoop()` → 此时 `_getConfigFromPage0()` 可读取 Model 0 MQTT 配置

---

### 5.3 PIN Patch Payload（ModelTablePatch v0）

为保证可审计与可回放，PIN_IN / PIN_OUT 的消息体必须为“纯 ModelTable patch”。

- Patch 结构（最小集合）：
  - `version`: `"mt.v0"`
  - `op_id`: string（必须存在，用于审计与去重）
  - `records`: array
    - record: `{ op, model_id, p, r, c, k, t?, v? }`
    - `op` in `{ "add_label", "rm_label" }`

- PIN_OUT：
  - 用户模型的 `Label.t = "PIN_OUT"` 时，其 `Label.v` 必须是 ModelTablePatch。
  - 运行时将 Patch 作为 payload 发送（MQTT）。

- PIN_IN：
  - MQTT 入站 payload 必须是 ModelTablePatch。
  - 当 `Label.v` 为 TargetRef（Cell-owned）时，运行时写入 TargetRef 指向 Cell。
  - 当 TargetRef 同时声明 `trigger_funcs`（可选 `trigger_model_id`）时，运行时必须产出 `run_func` intercept。
  - 当 `Label.v` 不可解析为 TargetRef 时，回退到 pin mailbox（legacy 兼容）。

---

### 5.4 Direct-Path Semantics（In-proc Transport）

本节定义“直达 path”的语义边界：仅替换传输层，不改变 ModelTable 驱动的副作用语义。

语义差异清单（MUST/MUST NOT）：
- MUST：直达 path 只替换传输层，不得绕过 add_label/rm_label 触发入口。
- MUST：EventLog / mqttTrace / intercepts 的可观测结果与 MQTT path 等价。
- MUST NOT：UI 直连总线；UI 仍只能写 mailbox。
- MUST：PIN_OUT 继续由 mailbox `t="OUT"` 触发 publish（兼容既有模型）。
- MUST：PIN_IN 入站写入目标遵循声明优先（Cell-owned TargetRef）与 legacy mailbox fallback。
- MUST NOT：引入隐式副作用或跳过 ModelTable（与本规范 2.1/8.x 一致）。

最小验证用例（现有脚本）：
- `node scripts/validate_pin_mqtt_loop.mjs --case args_override`
- `node scripts/validate_dual_bus_harness_v0.mjs --case e2e`
- `node scripts/validate_iteration_guard.mjs --case stage4`

等价性断言（最小）：
- IN：`mqttIncoming(topic, payload)` → pin mailbox add_label(`t="IN"`).
- IN（Cell-owned）：`mqttIncoming(topic, payload)` → TargetRef add_label(`t="IN"`).
- IN（legacy fallback）：`mqttIncoming(topic, payload)` → pin mailbox add_label(`t="IN"`).
- OUT：pin mailbox add_label(`t="OUT"`) → publish + mqttTrace 记录。
- 上述断言在 in-proc 与 MQTT transport 下均成立。

---

## 6. 管理总线 Patch 规则（MGMT_IN / MGMT_OUT）

管理总线消息体统一为 ModelTablePatch，并且必须携带 `op_id`。

### 6.1 系统侧声明（系统负数模型）
- 仅允许在系统自带的负数 model_id 模型中声明：
  - `Label.t = "MGMT_OUT"`：`Label.v` 为 ModelTablePatch
  - `Label.t = "MGMT_IN"`：`Label.v` 为 TargetRef（仅目标信息）
- 用户模型不使用 MGMT_*，用户侧入口保持为 PIN_IN / PIN_OUT。

TargetRef 结构：
```
{ "model_id": 1, "p": 2, "r": 3, "c": 4, "k": "pageA.textA1" }
```

### 6.2 匹配规则（必须全部满足）
- `session_id` 必须一致（由系统注入，用户不填写）。
- `channel` 必须一致：`channel == Label.k`。
- 若消息带 `target`，则 `target` 坐标必须与该 Label 所在 Cell 完全一致。
- 不满足任一条件 → 丢弃并记录。

---

## 7. 用户输入（Mailbox）

用户输入通过 event mailbox 进入运行时（派生规范，详见合同）：
- Mailbox 位置：`model_id=-1 Cell(0,0,1)`
- Label: `ui_event` / `ui_event_error` / `ui_event_last_op_id`
- 事件 envelope 必须带 `op_id`（审计/去重必需）

> 详见 `docs/iterations/0129-modeltable-editor-v0/contract_event_mailbox.md`。

---

## 8. v0 强约束（为了可裁决性）

v0 版本必须遵守：
- 所有副作用 可观测（EventLog / intercept）
- 副作用只由 ModelTable 变化驱动
- 参数只是“事实写入手段”，不是事实源
- 不允许隐式副作用、不允许静默行为
- 所有失败必须写回 ModelTable

---

## 9. 非目标（明确排除）

本规范 不定义：
- UI 布局/组件渲染细节
- 双总线（Matrix）实现细节（仅定义 Patch 口径）
- E2EE
- 调度/优化策略

---

## 10. 解释优先级

当存在歧义时：
1) `docs/architecture_mantanet_and_workers.md`
2) 本规范（`runtime_semantics_modeltable_driven.md`）
3) Project Charter
4) Iteration Spec / Ledger

---

需要你把这份文件当成“运行时解释宪法”，比如你再实现 PIN_IN、CONNECT、run_<func> 时，必须引用本文件，而不是自己“理解一遍”。

在 Stage 2.3 / 3.x / 4.x 的 Plan 中强制引用。
