---
title: "定位说明（必须写在文件开头）"
doc_type: ssot
status: active
updated: 2026-04-09
source: ai
---

# 定位说明（必须写在文件开头）

本文件是 派生运行时语义规范（Derived Runtime Semantics Spec）。

上位约束：`docs/architecture_mantanet_and_workers.md`

作用对象：所有软件工人运行时（Python/JS）

目的：统一解释“ModelTable 中的结构性声明如何在运行时产生副作用”

本文件不是实现指南，而是语义裁判规则。

宿主能力接口规范：`docs/ssot/host_ctx_api.md`

标签类型注册表：`docs/ssot/label_type_registry.md`

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
- 系统配置类声明（`mqtt.local.*` / `matrix.*` / `v1n_id` / `data_type` 等）

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
- 系统负数模型统一属于“软件工人系统级能力层”。
- 负数模型内部按层级规划：
  - `-1 .. -100`：靠近基座/系统边界/系统支撑层（mailbox、state、auth、routing、worker base support）
  - `-101 .. -199`：内置系统级应用层（built-in system applications / workbenches）
  - `<= -200`：为后续更深层的内置系统级应用保留；新增范围必须经 iteration 明确登记
- 绝对值越小越靠近基座/系统边界，绝对值越大越靠近内置系统级应用层。
- 系统负数模型的静态定义以仓库内 JSON 作为 bootstrap 来源（启动时注入 ModelTable）；运行时真值仍以 ModelTable 为唯一数据源。
- 系统内建 `k` 为保留命名空间：用户模型可调用但不得重定义其语义。
- 非用户可见的 platform helper / policy worker / guard / filter 默认应放在系统负数模型，而不是正数用户模型。
- `model_id > 0` 统一视为用户创建模型空间；不要再用历史的正数号段去推断 framework/business 归属。

### 1.4 Effective Cell Model Label 与 Scope Discoverability（Cell 有效模型标签与层级发现）

- 每个 materialized Cell 仍然必须且只能有一个有效模型标签（effective model label）。
- 有效模型标签是该 Cell 的主归属 / 主执行形态，集合为：`model.single` / `model.matrix` / `model.table` / `model.submt`。
- `model.table`：模型根 `(0,0,0)` 的显式根声明。
- `model.matrix`：矩阵自身相对 `(0,0,0)` 的显式根声明。
- `model.submt`：子模型映射/挂载 Cell 的显式声明。
- `model.single`：普通 Cell 的有效默认形态。
- 在 table/matrix 作用域内，如果某个普通 Cell 尚未物化或未显式声明模型标签，则其有效模型标签默认视为 `model.single`。
- `model.name` 只允许出现在模型自己的 `(0,0,0)`。
- 每个非 0 模型都必须通过某个父模型 Cell 上的 `model.submt` 显式挂载进入层级；包括 bootstrap children（例如 `-1` 与 `1`）也不例外。

补充：Cell 的“有效模型标签唯一”与“可被多个上层 scope 发现”是两件不同的事。

- 一个 Cell 可以被多个上层 model scope 同时发现，但不需要显式声明多份归属。
- 这种 scope discoverability 是运行时派生语义，至少包括两类：
  - 父子挂载层级发现：
    - 父模型可看到直接 child model 的索引
    - child model 再可看到自己的 descendants
  - 矩阵范围发现：
    - `model.matrix` 可看到其范围内的 `model.single`
    - 也可看到范围内更小的 `model.matrix`
- `model.submt` 仍保持 single-parent 挂载约束；多重 discoverability 不等于允许一个 child model 被多处显式挂载。
- 执行时，Cell 不依赖“当前被哪些 scope 看见”来选择逻辑分支；真正决定执行路径的是已经建立好的 pin 链与目标坐标。

### 1.5 UI Projection Contract (0210 Freeze)

- 页面目录只负责声明“哪个 page 对应哪个 model asset / schema asset”；它不是业务真值本身。
- UI authoritative input 只能来自 materialized Cell label、显式页面目录、以及通过 `model.submt` 挂载进入层级的 child model 自身 Cell/label。
- `parent` 挂载的合法条件：
  - child model 必须通过父模型 hosting cell 上的显式 `model.submt` 进入层级；
  - child root 必须保留自己的显式 form label；
  - projection 只能读取 child model 的真实 Cell/label，不得把父模型共享 AST 当作 child truth source。
- matrix 挂载同样必须通过显式 `model.submt` hosting cell，且调用方必须明确相对坐标到绝对坐标的映射前提；不得用“某个根格里碰巧有 UI AST blob”代替矩阵挂载语义。
- 整页 `ui_ast_v0` 页面 JSON 只能视为 legacy-debt 的 projection artifact；它可以作为迁移期间被 inventory 的旧路径，但不能作为新的 authoritative bootstrap 合同。
- `ws_selected_ast`、共享 mailbox/root AST、以及其他由 server/frontend 派生出的共享 AST，同样只能视为 legacy-debt 或调试投影，不得升格为新的挂载声明或数据所有权边界。
- 若实现仍依赖上述 legacy-debt 路径才能“跑通”，结论只能是 non-conformant；不得以 fallback 或 derived snapshot 将其包装成合规方案。

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
- 删除 BUS_IN → 移除 busInPorts 注册
- 删除 CELL_CONNECT → 移除 cellConnectGraph 接线
- 删除 MQTT_WILDCARD_SUB → unsubscribe
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

## 5. 连接与路由声明

### 5.1 Legacy PIN_IN / PIN_OUT（DEPRECATED since 0143）

> **状态**：已废弃。0143 删除了运行时中所有 PIN_IN/PIN_OUT 处理代码。
> 替代方案：BUS_IN/BUS_OUT（系统边界）+ cell_connection（跨 Cell 路由）+ CELL_CONNECT（Cell 内接线）。

原语义：Label(k=<topic>, t="PIN_IN") 声明式外部输入通道。
已删除的运行时符号：pinInSet, pinOutSet, pinInBindings, _pinKey, _parsePinKey,
resolvePinInRoute, findPinInBindingsForDelivery, _pinRegistryCellFor, _pinMailboxCellFor,
_applyPinDeclarations, _applyPinRemoval, _applyMailboxTriggers, _resolveTriggerModelId, trigger_funcs。
已删除的约定 Cell 位置：PIN registry cell (0,0,1), PIN mailbox cell (0,1,1)。

### 5.2 当前结构性声明（完整列表）

以下声明服从本规范，由 `_applyBuiltins` 统一分发：
- pin.in / pin.out：Cell 级端口；写在非系统模型 root `(0,0,0)` 时同时承担模型边界端口语义
- pin.bus.in / pin.bus.out：系统边界端口（新，仅 Model 0）
- pin.log.*：日志通道端口；写在非系统模型 root `(0,0,0)` 时同时承担模型边界日志端口语义
- pin.connect.label：Cell 内接线图（新）
- pin.connect.cell：跨 Cell 路由（新）
- pin.connect.model：跨 Model 路由（新）
- model.submt：子模型声明（新）
- func.js / func.python：函数声明（新）
- model.single / model.matrix / model.table：模型形态声明（新）
- BUS_IN / BUS_OUT：系统边界端口（仅 Model 0）
- CELL_CONNECT：Cell 内接线图
- cell_connection：跨 Cell 路由
- MODEL_IN / MODEL_OUT：模型边界端口
- subModel：子模型声明
- IN：触发 cell_connection 路由 + CELL_CONNECT 传播
- MQTT_WILDCARD_SUB：MQTT 通配符订阅声明
- run_<func>：声明可运行入口（由 worker_engine_v0 tick 处理）
- `mqtt.local.*` / `matrix.*`：声明运行时配置（统一写入 Model 0 `(0,0,0)`，通常由 `MODELTABLE_PATCH_JSON` 启动期落表）
- `runtime_mode`：运行时生命周期标签（仅 Model 0 `(0,0,0)`，取值 `boot | edit | running`）

历史别名说明（non-normative）：
- repo 内可能仍能搜索到 `BUS_IN` / `BUS_OUT` / `CELL_CONNECT` / `cell_connection` / `MODEL_IN` / `MODEL_OUT` / `IN` / `function` / `subModel` / `submt` 等旧名。
- repo 内也可能仍能搜索到 `pin.table.*` / `pin.single.*` / `pin.log.table.*` / `pin.log.single.*`。
- 这些旧名属于迁移债务，不构成当前允许的新工作输入面。
- 若确需保留/新增兼容逻辑，必须得到用户显式批准。

### 5.2b CELL_CONNECT / cell_connection（0141）

**label.t 分发**：`_applyBuiltins` 首先按 `label.t` 分发，独立于 `label.k` connectKeys 检查。

| label.t | 触发 | 位置约束 |
|---|---|---|
| `CELL_CONNECT` | `_parseCellConnectLabel` → 构建 `cellConnectGraph` | 任意 Cell |
| `cell_connection` | `_parseCellConnectionLabel` → 构建 `cellConnectionRoutes` | 仅 (0,0,0) |
| `IN` | `_routeViaCellConnection` (同步) + 若 Cell 有 `cellConnectGraph` 条目 → `_propagateCellConnect` (async) | 任意 Cell |

**CELL_CONNECT 端点格式**：`(prefix, port)`
- prefix = `self` | `func` | `<numericModelId>`
- self 目标：写 label(t='OUT') + 递归传播
- func 目标：`:in` 后缀 → `_executeFuncViaCellConnect`，`:out` 后缀 → 继续传播
- numeric 目标：路由到子模型 root `(0,0,0)` 的 `pin.in`

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
- `mqttIncoming` BUS_IN 短路：`busInPorts.has(pinName) && modelId === 0` → `_handleBusInMessage` → 直接路由，不进入通用 IN 路径
- `_subscribeDeclaredPinsOnStart` 追加 BUS_IN 端口 MQTT 订阅
- `_handleBusInMessage` 仅写 `addLabel(model0, 0,0,0, {k, t:'BUS_IN', v})`，路由由 `_applyBuiltins` 触发

### 5.2d 模型根边界端口（0142+）

| label.t | 位置约束 | 语义 |
|---|---|---|
| `pin.in` / `pin.log.in` | 非系统模型 `(0,0,0)` | 注册模型输入端口 → `modelInPorts` Map |
| `pin.out` / `pin.log.out` | 非系统模型 `(0,0,0)` | 注册模型输出端口 → `modelOutPorts` Map |

- 非系统模型 root `(0,0,0)` 上的 `pin.in` 写入 v 时 → 子模型内 cell_connection 路由 + CELL_CONNECT 传播
- 非系统模型 root `(0,0,0)` 上的 `pin.out` 写入 v 时 → 查 `parentChildMap` → 在父模型 hosting cell 上以 `(childModelId, portName)` 为源端口触发 CELL_CONNECT，并同时进入 `pin.connect.model`
- `pin.table.* / pin.single.*` 不再是当前运行时主路径；若文档或历史测试仍提及它们，只能视为迁移债务或历史记录。

### 5.2e subModel 声明与 parentChildMap（0142）

- `label.t === 'model.submt'`, `label.k = 'model_type'`, `label.v` = 子模型 ID
- 注册到 `parentChildMap`: key=childModelId → {parentModelId, hostingCell:{p,r,c}}
- 如果子模型不存在 → 自动 `createModel({id, name: alias, type: 'sub'})`
- CELL_CONNECT 数字前缀路由：`(numericId, port)` → 查 parentChildMap → 写子模型模型边界输入（table/single）
- `model.submt` 表示**子模型映射位置**，不是 root-only 声明：`hostingCell` 可以是任意 Cell
- 同一 hosting Cell 最多允许一个 `model.submt`
- 同一个 child model 只能被一个父模型 hosting Cell 挂载（single-parent）
- hosting Cell 一旦安装 `model.submt`：
  - 允许保留或继续添加的只剩引脚类标签（`pin.*` / `pin.log.*`）
  - 预先存在的非引脚标签必须被清理
  - 后续再写入非引脚标签必须 reject，并写入 `eventLog(reason='submodel_host_cell_forbidden_label')`
- 删除 `model.submt` 仅解除父子挂载关系；不自动删除 child model 数据。

### 5.2f Runtime Lifecycle（0177）

- 运行时全局生命周期由 Model 0 `(0,0,0)` 的 `runtime_mode` 表示：
  - `boot`: trusted bootstrap 直写期
  - `edit`: 可读可建模，但不执行软件工人副作用
  - `running`: 才允许函数执行、MGMT_OUT/MQTT/Matrix 生效
- `ModelTableRuntime` 初始状态必须是：
  - `runtime_mode=boot`
  - `runLoopActive=false`
- 允许的状态迁移仅有：
  - `boot -> edit`
  - `edit -> running`
- trusted bootstrap 直写仅限：
  - system patch / role patch 加载
  - SQLite 恢复
  - `MODELTABLE_PATCH_JSON`
- `applyPatch(... allowCreateModel=true)` 不是公共能力；只有 `trustedBootstrap=true` 的 patch loader 才允许 `create_model` 或隐式补建模型
- 除 bootstrap loader 外，运行态普通 handler / server 回程 / 用户程序模型都不得直接持有或调用 runtime-wide `applyPatch`。
- 运行态正式 materialization 必须通过当前模型的 owner materialization / helper executor 完成。
- `applyScopedPatch(currentModelId, patch)` 是运行态唯一允许的 patch 语义：
  - 只允许 bootstrap loader 之外的内部 owner/helper 路径使用
  - 所有 `records[*].model_id` 必须等于 `currentModelId`
  - 禁止 `create_model`
  - 禁止跨模型写入父/子/兄弟模型
- 正数模型默认 helper scaffold：
  - `createModel()` 创建正数模型时，默认保留 `(0,1,0)` 为 helper executor cell
  - 该 cell 默认具备：
    - `helper_executor=true`
    - `scope_privileged=true`
    - `owner_apply: pin.in`
    - `owner_apply_route: pin.connect.label`
    - `owner_materialize: func.js`
  - 该 helper cell 允许作为 same-model privileged exception 执行 owner materialization，包括 `model.single` 场景
- `boot/edit` 期间必须抑制：
  - `run_*` 入口
  - `_executeFuncViaCellConnect`
  - `ctx.publishMqtt()`
  - `pin.bus.out` publish
  - `MQTT_WILDCARD_SUB` 生效

### 5.2g Bootstrap 加载顺序（0142/0177）

1. `model_0_framework.json` → 创建 Model 0 结构（BUS_IN/OUT、subModel、CELL_CONNECT、cell_connection）
2. `system_models.json` → 填充 Model -10 等系统子模型
3. 应用模型 patch → 填充业务模型
4. trusted bootstrap patch（如 `MODELTABLE_PATCH_JSON`）直写 Model 0 `(0,0,0)` 上的 `mqtt.local.*` / `matrix.*`
5. `ui-server` 进入 `edit`；headless worker 在连接就绪前保持 `edit`
6. 显式或自动切换到 `running`
7. `startMqttLoop()` / Matrix adapter 在 `running` 后才允许生效

---

### 5.3 模型形态约束（Model Forms）

运行时必须执行以下模型形态约束：

- `model.single`：单 Cell 沙箱；代码只允许操作自身 Cell；`add_label` 形态为 `(k, t, v)`。
- `model.matrix`：固定维度（min/max p/r/c）；必须进行边界和碰撞检测（定义保留，按需落地）。
- `model.table`：动态大小；`add_label` 形态为 `(p, r, c, k, t, v)`。
- `model_type` 二维编码：
  - `label.t` = 形态（model.single | model.matrix | model.table）
  - `label.v` = 类型（Code.JS | Data.Array | Flow | Doc.Markdown | ...）
- 无效的形态×类型组合必须拒绝并写入错误标签（不得 silent fail）。

### 5.4 MQTT Payload 格式（ModelTablePatch v0）

MQTT 消息体统一为 ModelTablePatch：

- Patch 结构（最小集合）：
  - `version`: `"mt.v0"`
  - `op_id`: string（必须存在，用于审计与去重）
  - `records`: array
    - record: `{ op, model_id, p, r, c, k, t?, v? }`
    - `op` in `{ "add_label", "rm_label" }`

- 入站流程（`mqttIncoming`）：
  1. 解析 topic → 提取 modelId, cellK
  2. BUS_IN 短路检查（仅 Model 0）
  3. mt_v0 模式：先 `applyPatch(records)`，再写 `IN` label 到目标模型 (0,0,0)
  4. IN label 触发 cell_connection 路由 + CELL_CONNECT 函数执行（异步）

- 出站：BUS_OUT label 写入 v 时，自动发布到对应 topic

### 5.5 消息路由全链路（0143 最终架构）

```
MQTT → mqttIncoming → BUS_IN 短路 / 写 IN 到 model(0,0,0)
  → cell_connection 路由到 processing cell
  → CELL_CONNECT wiring 触发函数 (AsyncFunction, 30s timeout)
  → 函数输出 → CELL_CONNECT (func:out → self:patch)
  → cell_connection 路由回 (0,0,0)
  → BUS_OUT / MQTT 发布
```

验证脚本：
- `node scripts/tests/test_0143_e2e.mjs` — 全链路集成测试
- `node scripts/validate_model100_records_e2e_v0.mjs` — Model 100 records-only E2E
- `node scripts/tests/test_bus_in_out.mjs` — BUS_IN/OUT 单元测试

---

## 6. 函数标签格式（Function Labels）

函数标签属于结构性声明，运行时负责编译与执行路由：

- `label.t`：`func.js` 或 `func.python`
- `label.k`：函数名
- `label.v`：兼容期支持两种格式
  - 旧：`string`（仅兼容旧模型）
  - 新：`{"code":"...", "modelName":"optional_scope_name"}`

执行规则：
- 运行时应优先读取 `v.code`，兼容期可回退到 string。
- 新模型必须使用结构化 value（`{code, modelName}`）。
- 每个函数自动关联三个引脚：`func:in`、`func:out`、`func:log.out`。
- `func.python` 在无 Python worker 时必须写错误标签，不得静默失败。

---

## 7. 管理总线 Patch 规则（MGMT_IN / MGMT_OUT）

管理总线消息体统一为 ModelTablePatch，并且必须携带 `op_id`。

### 6.1 系统侧声明（系统负数模型）
- 仅允许在系统自带的负数 model_id 模型中声明：
  - `Label.t = "MGMT_OUT"`：`Label.v` 为 ModelTablePatch
  - `Label.t = "MGMT_IN"`：`Label.v` 为 TargetRef（仅目标信息）
- 用户模型不使用 MGMT_*，用户侧入口通过 BUS_IN/BUS_OUT + cell_connection + CELL_CONNECT。

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

## 8. 数据模型 PIN 接口规范（Tier 2 约定）

所有数据模型子类型（Data.Array / Data.Queue / Data.Stack / Data.LinkedList / Data.CircularBuffer 等）
共享统一的 PIN 接口约定：

- `add_data_in`（pin.in）：添加数据
- `delete_data_in`（pin.in）：删除数据
- `get_data_in`（pin.in）：获取数据请求
- `get_data_out`（pin.out）：获取数据响应
- `get_all_data_in`（pin.in）：获取全部数据请求
- `get_all_data_out`（pin.out）：获取全部数据响应
- `get_size_in`（pin.in）：获取数据量请求
- `get_size_out`（pin.out）：获取数据量响应

说明：
- 本节为 Tier 2 约定，运行时不硬编码数据结构算法。
- 运行时仅保证 pin.* 路由语义；具体行为由模型函数（func.js / func.python）实现。

---

## 9. 用户输入（Mailbox）

用户输入通过 event mailbox 进入运行时（派生规范，详见合同）：
- Mailbox 位置：`model_id=-1 Cell(0,0,1)`
- Label: `ui_event` / `ui_event_error` / `ui_event_last_op_id`
- 事件 envelope 必须带 `op_id`（审计/去重必需）
- Mailbox 只是事件入口，不是长期业务分发语义本身。

事件入口的 Tier 归属冻结如下：

- “event mailbox -> 合法 pin ingress / routing” 的解释属于 Tier 1 runtime 语义。
- `server` / `frontend` 只负责：
  - envelope 适配
  - mailbox write
  - snapshot / transport
- `server` 层若保留 mailbox / `dual_bus_model` 快捷触发，只能视为迁移债务，不是长期规范。

当前 `0306` 的正式内置实现分两类：

- target 型事件：
  - `payload.action = "submit"`
  - `payload.target` 必须带完整 `model_id / p / r / c`
  - runtime 派生 ingress key：`ui_event_<action>_<model_id>_<p>_<r>_<c>`
  - 当前 built-in `Model 100` 的 key 为：
    - `ui_event_submit_100_0_0_0`
- system action 型事件：
  - 当前已迁移：
    - `slide_app_import`
    - `slide_app_create`
    - `ws_app_add`
    - `ws_app_delete`
    - `ws_select_app`
    - `ws_app_select`
  - runtime 派生 ingress key：`ui_event_<action>`

统一规则：

- runtime 会把标准化后的事件值写到：
  - `Model 0 (0,0,0) k=<derived-key> t=pin.bus.in`
- 若 `Model 0` 上存在对应的 `pin.connect.model` 路由，该事件即进入合法 pin-chain。
- 对 `0306` 已迁移的 slide/workspace 动作：
  - 缺少对应 route 时，必须报 `route_missing`
  - 不再允许回退到 server 的 direct `run_func` / direct positive-model `ui_event`
- 其他未迁移动作仍可能保留 legacy shortcut；它们属于后续收口债务，不构成新的正式规范。

> 详见 `docs/iterations/0129-modeltable-editor-v0/contract_event_mailbox.md`。

### 7.1 认知层（scene_context, 0153）

- 认知模型：`model_id=-12`, `cell(0,0,0)`, `k=scene_context`, `t=json`。
- `scene_context` 推荐字段：
  - `current_app: int`
  - `active_flow: string|null`
  - `flow_step: int`
  - `recent_intents: array`（固定上限，默认 20）
  - `last_action_result: object|null`
  - `session_vars: object`

语义规则：
- 认知更新通过系统函数 `update_scene_context` 执行，触发来源为 `event_trigger_map.ui_event`。
- `scene_context` 属于系统上下文，不承载业务主数据，不替代业务模型真值。
- 认知函数失败不应阻断后续 forward/dispatch；失败须写可观测错误（如 `mgmt_func_error`）。

### 7.2 动作反馈层（action_lifecycle, 0153）

- 生命周期标签：`model_id=-1`, `cell(0,0,1)`, `k=action_lifecycle`, `t=json`。
- 推荐字段：
  - `op_id: string`
  - `action: string`
  - `status: idle|executing|completed|failed`
  - `started_at: int(ms epoch)`
  - `completed_at: int(ms epoch)|null`
  - `result: object|null`
  - `confidence: number`

语义规则：
- dispatch 命中后，执行前必须写 `status=executing`。
- dispatch 完成后必须写终态：
  - 成功：`status=completed`
  - 失败：`status=failed`，并包含结构化 `result.code/detail`
- `action_lifecycle` 为“最新态单槽”，用于观测当前/最近动作状态，不承担全量历史归档。

### 7.3 本地事件隔离（Prompt FillTable, 0155）

适用动作：
- `llm_filltable_preview`
- `llm_filltable_apply`

语义规则：
- 事件 envelope 的 `meta.local_only=true` 时，不得触发任何外发路径。
- 上述两个 filltable 动作默认视为本地事件；即使未显式设置 `local_only`，forward 层也应按动作前缀防护跳过。
- 跳过 Matrix 转发不影响本地 dispatch 执行；本地 Preview/Apply 仍通过 `intent_dispatch_table` + function labels 完整执行。

0187 补充：
- legacy `mailbox -> forward_ui_events -> ctx.sendMatrix(...)` 通路已退役。
- `ui_event` 从 mailbox 出发时，不再存在“默认 direct Matrix forward” 兜底。
- 当前 UI 外发 authority 只允许通过显式接线最终到达 Model 0 `pin.bus.out` 的路径。

### 7.4 Local-First Egress Authority（0181, approved target contract）

本节定义一个**目标规约**：UI 动作默认本地处理；只有当动作的现有 out pin 接线最终到达 Model 0 的 `pin.bus.out` 时，动作才允许离开本地 runtime。

约束：
- 不新增 pin type、label.t 或额外 runtime 解释语义。
- 只能沿用现有：
  - `pin.out`
  - `pin.bus.out`
  - `pin.in`
  - `pin.connect.label`
  - `pin.connect.cell`
  - `pin.connect.model`
  - `model.submt`
- “是否外发”的 authority 落在接线路径事实本身，不落在新的辅助字段。

判定规则：
- UI 动作若只改本地状态 label，且没有进入任何模型边界 out pin，则该动作是本地动作。
- UI 动作若写入了模型边界 out pin，但该 pin 没有通过父子 hosting cell relay 一路接到 Model 0，则该动作仍视为本地动作。
- 只有当动作写入的现有 out pin 经 `model.submt` hosting cell + `pin.connect.label` + `cell_connection` 逐层 relay，并最终接到 Model 0 `(0,0,0)` 的 `pin.bus.out`，该动作才允许外发。

回程规则：
- 外界返回结果先到 `Model 0`
- `Model 0` 只能写本层 relay / input pin，不得 direct patch 深层子模型
- 数据必须经父模型 hosting cell 暴露的 child pin 逐层下传
- 到达目标模型后，只允许由该模型 owner materialization / helper executor 完成最终 label 落盘
- `server` 或任意运行态 handler 若 direct `applyPatch` 目标子模型，应视为 direct patch bypass / 规约违规

禁止：
- 不得为“是否远端”再发明新的 pin 类型。
- 不得要求所有 UI 动作先进入远端候选池，再由宿主特判是否转发。
- 不得绕过父模型 hosting cell，直接从深层子模型跳接到 Model 0。

#### 7.4a 颜色生成器参考链路（0181）

本样例仅作为规约范式，不代表当前运行时已在所有环境完全按此落地。

层级：
- `Model 0`：系统根，唯一允许 `pin.bus.out`
- `Model 100`：颜色生成器应用根
- `Model 110`：workspace/color page
- `Model 111`：color form
- `Model 112`：submit cluster

动作分类：
- 输入框：只写 `model100_input_draft`，不进入 out pin，永远本地。
- 切页 / 选中应用：只写 `ui_page` / `ws_app_selected`，不进入 out pin，永远本地。
- `Generate Color`：
  - 先在本地函数中写 `submit_inflight=true`
  - 本地组装 payload
  - 然后写入 `Model 112 (0,0,0)` 的现有 `pin.out submit`
  - 该 `submit` 端口经父层 hosting cell relay 逐级上送至 `Model 0 pin.bus.out submit`
  - 因此只有 `submit` 会外发

每一级父模型只做 relay：
- 子模型 `(0,0,0).submit` 写入 `pin.out`
- runtime 将其投递到父模型 hosting cell 的 `(childModelId, submit)` 源端口
- 父模型 hosting cell 用 `pin.connect.label` 将 `(childModelId, submit)` 接到本 cell relay label
- 父模型 root `(0,0,0)` 通过 `pin.connect.cell` 收到 relay label，再写本层 `pin.out submit`
- 该过程重复直到 Model 0

回程 materialization：
- `Model 0` 收到返回后只能继续写 relay / request pin
- 目标模型 `(0,0,0)` 或 reserved helper executor cell 接收 owner request
- owner materialization / helper executor 仅在当前 `model_id` 内执行 scoped writes
- 不允许用“先写目标模型 input pin，再 direct `applyPatch(records)`”作为中转；这属于 direct patch bypass

Model 0：
- 只允许在 `(0,0,0)` 声明 `pin.bus.out submit`
- 所有真正离开本地 runtime 的动作必须最终接到这里

由此得到的 conformance 结论：
- 没有完整上行接线的动作，一律视为本地动作
- 输入 / 切页 / 展开 / 过滤等动作默认不得接入出站链
- `submit` 这类明确需要双总线的动作，才允许通过现有 relay 链接到 Model 0

### 7.5 Committed State + Interaction Overlay（0186）

本节定义高频 UI 交互的正式语义分层：

- `committed state` = ModelTable
- `transient interaction overlay` = 当前前端会话内的临时交互态

不变量：
- ModelTable 仍然是唯一 committed / shared / persisted truth。
- overlay 不是 SSOT，不得写入 `snapshot.models` 伪装成 committed state。
- worker / server / 其他 client 只应读取 committed ModelTable，不读取 overlay。

#### 7.5a 默认推导

label / bind 侧允许声明：

- `commit_policy`
  - `immediate`
  - `on_change`
  - `on_blur`
  - `on_submit`

- `interaction_mode`
  - `committed_direct`
  - `overlay_then_commit`

- `commit_target`
  - 默认 `self`
  - 仅在跨 ref 提交时显式声明

默认推导规则：
- `commit_policy=immediate` -> `interaction_mode=committed_direct`
- `commit_policy=on_change|on_blur|on_submit` -> `interaction_mode=overlay_then_commit`
- `commit_target` 默认等于当前 label ref / `write.target_ref`

#### 7.5b 渲染读取规则

当 label 声明 `overlay_then_commit` 时，UI 读取值必须使用：

- `effectiveValue = overlayValue ?? committedValue`

其中：
- `committedValue` 来自 `snapshot.models`
- `overlayValue` 来自 client-local overlayStore

### 7.6 Workspace Slide App Admission / Surface Enum（0289 / 0290 / 0302）

本节冻结当前 Workspace slide 主线对正数 app 的准入与 surface value 口径。

slide-capable app 的最小根标签：

- `app_name`
- `slide_capable = true`
- `slide_surface_type`
- `ui_authoring_version`
- `ui_root_node_id`

补充要求：

- 若 app 需要 child truth，必须继续通过显式 `model.submt` 挂载。
- `deletable` / `installed_at` / `from_user` / `to_user` 属于 Workspace registry / lifecycle metadata，可选但推荐显式写出。
- 不满足最小根标签的 Workspace app，不得进入 slide-capable 主线集合。

当前 `slide_surface_type` 正式枚举仅允许：

- `flow.shell`
  - app 在 Workspace 中通过 flow shell 投影显示
- `workspace.importer`
  - app 本身是 zip 导入工作页面
- `workspace.page`
  - app 本身是直接在 Workspace 右侧显示的页面型 slide app

当前内置落点：

- `Model 100` → `flow.shell`
- `Model 1030` → `workspace.importer`
- `Model 1034` → `workspace.page`

新增枚举值或改变既有语义时：

- 必须先更新本节
- 必须同步更新现行用户文档
- 不允许在单个 iteration 中私自发明新值后再补文档


未声明 `overlay_then_commit` 的 label，仍按 committed snapshot 直接读取。

#### 7.5c 生命周期

1. 用户交互中：
- 更新 overlay
- 不直接改 committed ModelTable

2. 到达 commit 时机：
- `on_change`：例如 slider pointerup / change
- `on_blur`：例如 input blur
- `on_submit`：例如显式 submit/action 前
- `immediate`：每次更新都直接 committed

3. commit 之后：
- overlay entry 进入 pending / waiting-for-ack 状态
- SSE / response snapshot 继续更新 committed cache
- 当 committed value 与 overlay 提交值一致时，清除 overlay entry

4. 失败时：
- committed state 不变
- overlay 可保留为当前前端会话的未提交值
- 失败必须有结构化错误可观测

#### 7.5d 冲突规则

当前阶段采用：
- 单用户优先
- `last-write-wins`

当 overlay active 且 snapshot 回流时：
- snapshot 继续更新 committed cache
- 但不得覆盖当前交互显示
- 只有当 committed value 收敛到 overlay 提交值，才清除 overlay

#### 7.5e 明确示例

若 slider 声明：
- `commit_policy=on_change`

则：
- 拖动中的 `0 -> 100 -> 0` 轨迹只存在于 overlay
- 鼠标松开后，最终值才 commit 到 ModelTable
- 若最终值回到 `0`，ModelTable 不需要经历一次真实的 `0 -> 100 -> 0`

若 slider 显式声明：
- `commit_policy=immediate`

则：
- 每一步都直接写 committed ModelTable
- 若同时又显式接到 Model 0 `pin.bus.out`，则每一步都可继续外发

#### 7.5f 约束

- 不得把 overlay 自动扩展到所有正数模型 label。
- 只有显式声明 `commit_policy != immediate` 的 label 才启用 overlay。
- 不得用 debounce/throttle 替代语义定义；它们最多是实现层优化参数。

---

## 10. v0 强约束（为了可裁决性）

v0 版本必须遵守：
- 所有副作用 可观测（EventLog / intercept）
- 副作用只由 ModelTable 变化驱动
- 参数只是“事实写入手段”，不是事实源
- 不允许隐式副作用、不允许静默行为
- 所有失败必须写回 ModelTable

---

## 11. 非目标（明确排除）

本规范 不定义：
- UI 布局/组件渲染细节
- 双总线（Matrix）实现细节（仅定义 Patch 口径）
- E2EE
- 调度/优化策略

---

## 12. 解释优先级

当存在歧义时：
1) `docs/architecture_mantanet_and_workers.md`
2) 本规范（`runtime_semantics_modeltable_driven.md`）
3) Project Charter
4) Iteration Spec / Ledger

---

需要你把这份文件当成“运行时解释宪法”，比如你再实现 PIN_IN、CONNECT、run_<func> 时，必须引用本文件，而不是自己“理解一遍”。

在 Stage 2.3 / 3.x / 4.x 的 Plan 中强制引用。
