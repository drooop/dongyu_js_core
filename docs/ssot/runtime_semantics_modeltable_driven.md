---
title: "定位说明（必须写在文件开头）"
doc_type: ssot
status: active
updated: 2026-04-29
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
- **(0323) model.single 沙箱边界澄清**：model.single 的"结构性沙箱"约束仅作用于**写**（`V1N.addLabel`/`V1N.removeLabel` 仅限自身 Cell），**不作用于读**。嵌套在 model.table 作用域内的 model.single Cell 可通过 `V1N.readLabel(p, r, c, k)` 读取所在 model.table 内任意 Cell。独立（非嵌套）的 model.single 无跨 Cell 读路径。这是对 §5.3 model.single 原"programs operate on own Cell only"描述的权限模型精化。
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

0331 payload current truth：
- `pin.in` / `pin.out` / `pin.bus.in` / `pin.bus.out` 的正式业务 value 必须是临时 ModelTable record array。
- `null` / `undefined` 可继续作为声明或清空端口的空值。
- 对象式业务 envelope 只允许作为历史迁移债务被 inventory，不得作为新实现或新通过路径。
- `writeLabel` 的正式跨 cell 写入请求由 `write_label.v1` 临时 ModelTable payload 表达，并通过显式 pin route 到当前模型 `(0,0,0)` 的 `mt_write`。

0347 message/materialization current truth：
- pin/event 中传递的 record array 是 Temporary ModelTable Message：`format is ModelTable-like; persistence is explicit materialization`。
- Temporary message 的 `id` 只在当前 message 内有效，不是正式 `model_id`。
- 接收、路由、转发、trace、projection 都不自动 materialize；只有 owner / 当前模型 D0 helper / 接收程序模型 / importer 明确执行写入时，才产生正式 `add_label` / `rm_label` side effect。

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
  - **(0323) 裁决**：本节描述的 (0,1,0) helper executor 模式已被 §5.3 规定的 (0,0,0) 默认三程序（mt_write / mt_bus_receive / mt_bus_send）替代，仅对 `model.single` 场景仍适用（因为 model.single 不具备独立的 (0,0,0) 根 Cell 承载三程序）。对 `model.table`，createModel 不再保留 (0,1,0) helper，而是自动植入 (0,0,0) 三程序——详见 §5.2g。
  - `createModel()` 创建正数模型时，默认保留 `(0,1,0)` 为 helper executor cell（**仅 model.single 适用**）
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

### 5.2f.1 EventLog Observer（0322）

- `ModelTableRuntime.eventLog` 暴露 `setObserver(callback)`；每次 `record(entry)` 会在入队后同步调用 observer（捕获并忽略 observer 自身的异常，不影响 record）。
- Tier 1 契约：observer 是**纯可观测性 hook**，runtime 不因为 observer 存在而改变任何 label 处理语义。没有 observer 时所有既有路径行为与之前完全一致。
- Tier 2 契约：`ui-model-demo-server` 的 `createServerState` 在 programEngine 创建后注册 observer，通过 microtask 调度 `programEngine.tick()`（仅当 `runtime_mode=running`）。这让 `eventLog → processEventsSnapshot → intercepts → executeFunction` 这条 host 驱动链在测试与非 HTTP 调用场景下也能自动跑起来。
- 不允许的用法：
  - observer 不得在回调里同步写 label（会造成重入记录）——必须延后到 microtask / tick。
  - observer 不得抛出未捕获异常；record 已做本地 catch，但 tier 2 代码仍应自己保证幂等。
- 与 `_executeFuncViaCellConnect` ctx 的区别：ctx 只暴露 `publishMqtt`，不含 `sendMatrix`。Matrix 发送、intercept dispatch、跨 tick 调度属 tier 2 `ProgramModelEngine` 的职责；任何需要 Matrix 的路径必须经 `pin.bus.out` + programEngine bridge，不得在 runtime pin.connect.label 直接触发的 func 里使用 `ctx.sendMatrix`。

### 5.2g Bootstrap 加载顺序（0142/0177，0323 增补）

1. `model_0_framework.json` → 创建 Model 0 结构（BUS_IN/OUT、subModel、CELL_CONNECT、cell_connection）
2. `system_models.json` → 填充 Model -10 等系统子模型
3. 应用模型 patch → 填充业务模型
4. trusted bootstrap patch（如 `MODELTABLE_PATCH_JSON`）直写 Model 0 `(0,0,0)` 上的 `mqtt.local.*` / `matrix.*`
5. `ui-server` 进入 `edit`；headless worker 在连接就绪前保持 `edit`
6. 显式或自动切换到 `running`
7. `startMqttLoop()` / Matrix adapter 在 `running` 后才允许生效

**(0323) (0,0,0) 默认三程序的注入时机：**

- 三程序（`mt_write` / `mt_bus_receive` / `mt_bus_send`）由 `createModel()` **在 model.table 创建时自动植入 (0,0,0)**，不占用 bootstrap patch 步骤。
- 注入发生在步骤 1–3 中：任何通过 `createModel({type: 'table'})` 产生的 model.table，其 (0,0,0) 在创建返回时已包含三个 func.js 标签。
- JSON patches（步骤 1–3）可以覆盖三程序的 code 实现（用于升级或定制），但不得删除这三个 key。删除尝试必须被 rejected 并写入 `eventLog(reason='default_program_removal_forbidden')`。
- Model 0（系统根）作为特殊情况：其 (0,0,0) 承载 pin.bus.* 和 pin.connect.model，不强制植入三程序；跨模型路由由 Model 0 的既有系统函数承担。
- 负数系统模型（如 Model -10）保留现有实现路径：是否植入三程序由各系统模型独立裁决，迁移计划见 0323+2。

**(0323) 三程序 code 的 Tier 归属裁决：**

- 三程序的 func.js `code` 字符串内容属于 **Tier 2（填表能力）**：它们是业务级路由与权限逻辑，必须可通过 JSON patch 表达和覆盖。
- 三程序的植入机制（即"createModel 自动把默认 code 写入 (0,0,0)"）属于 **Tier 1（基座运行能力）**：这是基座对 model.table 形态的结构性保证，类似 (0,0,0) 必须声明 `model.table` 的基座强制。
- 默认 code 的来源必须是 Tier 2 的系统级 JSON patch 文件（推荐位置：`packages/worker-base/system-models/default_table_programs.json`，由 0323+1 冻结），**不得**将 code 字符串硬编码在 `createModel()` 的 JS 源码内。运行时代码仅负责"从 Tier 2 来源读取 code → 写入 (0,0,0)"的装配动作。
- 这一裁决保持 fill-table-first 硬约束：三程序的行为定义是填表的，只是其存在性由基座保证。覆盖路径：后续 JSON patches 可通过 addLabel 覆盖 (0,0,0) 的三个 func.js key，以定制或升级默认行为。

**(0323) 本迭代（规约层）与 0323+1（实施层）的过渡期约定：**

- 0323 是 docs-only 迭代：本节定义的"createModel 自动植入"是**规范合同**，运行时代码尚未实现植入机制。
- 0323 期间现有 `createModel()` 行为**不变**（不自动植入三程序）；任何依赖三程序存在的调用必须等待 0323+1。
- 0323+1 起始时的首要任务：
  1. 创建 `packages/worker-base/system-models/default_table_programs.json`（Tier 2 JSON patch，含三个 func.js 的初版 code）
  2. 修改 `createModel()` 实现：对 `type: 'table'` 的调用，读取该 JSON patch 并在创建返回前写入 (0,0,0) 的三个 func.js 标签
  3. 对本条规约的"必须来自 Tier 2 系统级 JSON patch 文件"硬约束在此时实质生效
- 在 0323+1 完成之前，任何试图依赖 (0,0,0) 三程序存在的业务模型或系统函数都不应被 bootstrap，否则行为 undefined。
- 本过渡期约定仅适用于 0323 → 0323+1 的短暂窗口；0323+1 完成后本节恢复为正常的不变约束。

---

### 5.3 模型形态约束（Model Forms）

运行时必须执行以下模型形态约束：

- `model.single`：单 Cell 沙箱；代码只允许操作自身 Cell；`add_label` 形态为 `(k, t, v)`。
- `model.matrix`：固定维度（min/max p/r/c）；必须进行边界和碰撞检测（定义保留，按需落地）。
- `model.table`：动态大小；`add_label` 形态为 `(p, r, c, k, t, v)`。
  - **(0323) (0,0,0) 默认基础设施**：每个 model.table 的 (0,0,0) Cell 必须包含以下三个 `func.js` 标签作为默认基础设施程序：

    | func.js key | 引脚 | 职责 | 权限 |
    |---|---|---|---|
    | `mt_write` | `mt_write_req` pin.in / `mt_write_result` pin.out | 接收写入请求，对当前 model.table 内任意 Cell 执行 addLabel/rmLabel | 模型内特权 |
    | `mt_bus_receive` | `mt_bus_receive:in` / `mt_bus_receive:out` | 接收从父模型路由下来的消息，分发到模型内目标 Cell | 模型内特权 |
    | `mt_bus_send` | `mt_bus_send:in` / `mt_bus_send:out` | 汇集模型内 Cell 的外发消息，上行到父模型边界 | 模型内特权 |

  - 这三个程序替代原 (0,1,0) helper executor 模式（**仅 model.table 场景废弃**；model.single 场景保留，详见 §5.2f 裁决）。
  - 用户程序不得覆盖或删除这三个 func.js 标签。

- `model_type` 二维编码：
  - `label.t` = 形态（model.single | model.matrix | model.table）
  - `label.v` = 类型（Code.JS | Data.Array.One | Flow | Doc.Markdown | ...）
- 无效的形态×类型组合必须拒绝并写入错误标签（不得 silent fail）。

### 5.3b 运行时权限模型（0323）

**权限分层：**

| 层级 | 适用范围 | 写权限 | 读权限 |
|---|---|---|---|
| 模型内特权 | (0,0,0) 默认三程序（mt_write / mt_bus_receive / mt_bus_send） | 当前模型内任意 Cell | 当前模型内任意 Cell |
| 沙箱 | 用户自定义程序（非 (0,0,0) 默认程序） | 仅自身 Cell | 当前模型内任意 Cell |

**V1N API 面（暴露给用户程序）：**

- `V1N.addLabel(k, t, v)` — 写入当前 Cell 的 label（无坐标参数）
- `V1N.removeLabel(k)` — 删除当前 Cell 的 label（无坐标参数）
- `V1N.readLabel(p, r, c, k)` — 读取当前模型内任意 Cell 的 label（只读）
- `V1N.writeLabel(p, r, c, { k, t, v })` — 通过显式 `write_label_req` pin.out 路由到 `(0,0,0)` 的 `mt_write_req`，请求写入当前模型内一个目标 Cell 的一个 label

**跨 Cell 写入路径：**

用户程序 `write_label_req` pin.out → `pin.connect.cell` → `(0,0,0)` `mt_write_req` pin.in → `mt_write` 执行写入 → `mt_write_result` pin.out

**跨模型通信路径（两种合法方式）：**

1. 子模型挂载路径：model.submt hosting cell → 引脚接出/接入
2. Model 0 中转路径：Cell pin.out → (0,0,0) mt_bus_send:in → 模型边界 pin.out → Model 0 pin.connect.model → 目标模型

**禁止：**

- 用户程序直接读写其他模型的 Cell
- 用户程序绕过 pin 链路的任何直接跨模型操作

**Removed / Historical：**

- `ctx.writeLabel` / `ctx.getLabel` / `ctx.rmLabel` 已结束兼容期；活动运行面不得声明或调用，必须替代为 V1N API + pin 路由
- (0,1,0) helper executor → 替代为 (0,0,0) 默认三程序（**仅 model.table 场景**；model.single 场景保留 helper scaffold，详见 §5.2f）

详细 API 定义见 `docs/ssot/host_ctx_api.md`。

### 5.4 MQTT 外层补丁格式（ModelTablePatch v0）

本节描述的是 MQTT / bootstrap / trusted system boundary 使用的外层补丁传输格式，不是正式业务 pin value 的格式。

0331 起，正式业务 `pin.in` / `pin.out` / `pin.bus.in` / `pin.bus.out` 的非空 value 必须是临时 ModelTable record array；不得把 `{ op, records }` / ModelTablePatch envelope 作为业务 pin payload。0347 起，这类 record array 统一视为 Temporary ModelTable Message：格式像 ModelTable，但只有显式 materialization 后才成为正式持久模型表数据。

ModelTablePatch v0 仅作为外部补丁 envelope 或历史迁移债务保留：

- Patch 结构（最小集合）：
  - `version`: `"mt.v0"`
  - `op_id`: string（必须存在，用于审计与去重）
  - `records`: array
    - record: `{ op, model_id, p, r, c, k, t?, v? }`
    - `op` in `{ "add_label", "rm_label" }`

- 入站流程（`mqttIncoming`，legacy mt_v0 补丁入口）：
  1. 解析 topic → 提取 modelId, cellK
  2. BUS_IN 短路检查（仅 Model 0）
  3. mt_v0 模式只允许作为外层补丁入口：先 `applyPatch(records)`，再进入相应的 pin / mailbox 迁移路径
  4. 新业务 pin payload 必须在进入 pin value 前转换为临时 ModelTable record array

- 出站：BUS_OUT label 的内部业务 value 必须是 `pin_payload.v1` 临时 ModelTable payload；运行时或 server 在 MQTT / Matrix / MBR 边界发布前可还原为外层 `pin_payload` object packet。

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
- `label.v`：运行时读取两种格式
  - 旧：`string`（仅兼容旧模型）
  - 新：`{"code":"...", "modelName":"optional_scope_name"}`

执行规则：
- 运行时应优先读取 `v.code`，仅为历史模型可回退到 string。
- 新模型必须使用结构化 value（`{code, modelName}`）。
- 每个函数自动关联三个引脚：`func:in`、`func:out`、`func:log.out`。
- `func.python` 在无 Python worker 时必须写错误标签，不得静默失败。

---

## 7. 管理总线 Patch 规则（MGMT_IN / MGMT_OUT）

管理总线的外层系统消息体仍可使用 ModelTablePatch，并且必须携带 `op_id`。这属于 system boundary / migration envelope，不得作为用户业务 pin value。

### 6.1 系统侧声明（系统负数模型）
- 仅允许在系统自带的负数 model_id 模型中声明：
  - `Label.t = "MGMT_OUT"`：`Label.v` 为 ModelTablePatch（仅系统负数模型 / system boundary）
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

0348 起，Data.* 目标合同由 `docs/ssot/feishu_data_model_contract_v1.md` 接管。
0349 起，Data.* 的 Tier 2 实现路线由 `docs/ssot/data_model_tier2_implementation_v1.md` 接管。

所有 Feishu-aligned 数据模型子类型共享统一 PIN 接口约定：

- `add_data:in`（pin.in）：添加数据
- `delete_data:in`（pin.in）：删除数据
- `update_data:in`（pin.in）：修改数据
- `get_data:in`（pin.in）：获取数据请求
- `get_data:out`（pin.out）：获取数据响应
- `get_all_data:in`（pin.in）：获取全部数据请求
- `get_all_data:out`（pin.out）：获取全部数据响应
- `get_size:in`（pin.in）：获取数据量请求
- `get_size:out`（pin.out）：获取数据量响应

0296-era underscore pins and operation-specific Queue/Stack pins are implementation debt, not the target contract.

说明：
- 本节为 Tier 2 约定，运行时不硬编码数据结构算法。
- 运行时仅保证 pin.* 路由语义；具体行为由模型函数（func.js / func.python）实现。
- `Data.Single` 是 `model.single` element cell；collection-like Data.* 才使用 `model.table` 或 `model.matrix`。

---

## 9. 用户输入（Bus Event, 0326）

0326 之后，前端 / server 的正式业务事件 current truth 为：

- 浏览器 / server current path 只提交 `type = bus_event_v2`
- `/bus_event` 是正式入口；`/ui_event` 仍可作为显式兼容 URL alias 接受同一份 `bus_event_v2` body，但不构成独立协议
- `Model 0 (0,0,0)` 是唯一正式 ingress
- 事件值写入 `k=<bus_in_key> t=pin.bus.in`
- `bus_event_v2.value` 在进入 `pin.bus.in` 前必须已经是临时 ModelTable record array；server/frontend 不得把 `{ target_cell, target_pin, value }` 对象在 ingress 上临时转换为通过态 payload。
- `write_label.v1` 只属于目标模型内部的跨 cell 写入链路：用户程序调用 `writeLabel` 后，经显式 `write_label_req -> mt_write_req -> mt_write_result` 路由生成和消费；它不是 Model 0 bus ingress 的通用 passing path。
- `pin.connect.model` 把事件送到目标子模型 root `pin.in`
- 子模型 `(0,0,0)` 的 `mt_bus_receive` 再把 payload 分发到目标 cell / target pin

冻结点：

- 合法 `bus_in_key` 仅：
  - `ui_submit`
  - `ui_click`
  - `ui_input`
  - `ui_edit`
  - `slide_import_media_uri_update`
  - `slide_import_click`
  - `mgmt_bus_console_send`
  - `mgmt_bus_console_refresh`
- unknown key 必须拒绝，返回结构化错误
- legacy `type = ui_event` envelope 在当前 server ingress 会被显式拒绝，不再是 current truth

说明：`slide_import_*` 与 `mgmt_bus_console_*` 是经过 Model 0 allow-list 登记的专用 ingress key，不是任意动态 key。它们的 `value` 仍必须是临时 ModelTable record array，并由 `pin.connect.model` 进入目标模型。

Tier 归属：

- `Model 0 pin.bus.in -> pin.connect.model -> child mt_bus_receive` 属于 Tier 1 runtime 语义
- `server` / `frontend` 只负责：
  - `bus_event_v2` envelope 适配
  - HTTP transport / snapshot
  - 不得再把业务事件 first landing 到 `model_id=-1`

Historical / Retired (pre-0326):

- `model_id=-1 Cell(0,0,1)` mailbox `ui_event / ui_event_error / ui_event_last_op_id`
- `ui_event_<action>` 派生 ingress key
- direct positive-model `(0,0,2) ui_event`
- direct server `run_func` / direct positive-model `ui_event` fallback

Compatibility note:

- runtime / legacy positive-model flows 中仍可能保留 `ui_event` 相关内部兼容点；它们不是 0326 frontend/server current path，后续收口须以具体 flow/entrypoint 为单位处理

这些旧路径仅可作为历史说明出现，不再构成正式规范。

### 3.0.2 Imported Slide App Host Ingress (0321 MVP)

对 imported slide app，当前新增一条宿主自动生成的 host ingress 能力。

触发条件：

- imported app root `(0,0,0)` 显式带：
  - `k = host_ingress_v1`
  - `t = json`
- 且当前 v1 只接受：
  - 一个 primary `submit` boundary
  - `locator_kind = root_relative_cell`

安装时，宿主会自动补：

- `Model 0` 上的 host ingress `pin.bus.in`
- `Model 0` 上对应的 `pin.connect.model`
- imported model root 上的 relay `pin.in`
- imported model root 上对应的 `pin.connect.cell`

因此，当前 v1 的正式宿主 ingress 路径是：

1. 宿主把正式业务输入写到：
   - `Model 0 (0,0,0) k=imported_host_submit_<model_id> t=pin.bus.in`
2. `Model 0` 的 `pin.connect.model` 把它路由到 imported model root relay pin
3. imported model root 的 `pin.connect.cell` 再把它 relay 到声明的 boundary pin
4. imported app 内部后续链路继续由 app 自己定义

删除 imported app 时，宿主必须同时清理这条自动生成的 `Model 0` ingress route。

前端协议的后续正式冻结（`0310`）如下：

- 前端正式业务事件不再以 `action` 作为长期语义。
- 前端正式业务事件应改为：
  - `target = cell`
  - `pin = port`
- 也就是：
  - `target.model_id / p / r / c` 只负责指向“哪个 Cell”
  - `pin` 只负责指向“这个 Cell 的哪个可写入口”
- `pin` 不进入 `target`，两者必须保持分离。
- `action` 在兼容层中可暂留到 `0308`，但不再是新的正式协议字段。

投影协议的后续正式冻结（`0310`）如下：

- cellwise AST 节点除 `cell_ref` 外，还应显式携带可写 pin 信息。
- 当前冻结字段名为：
  - `writable_pins`
- `writable_pins` 的结构固定为数组：
  - `[{ name, direction, trigger, value_t?, commit_policy?, primary? }]`
- 字段约束：
  - `name: string`
  - `direction: "in" | "out"`
  - `trigger: "click" | "change" | "blur" | "submit"`
  - `value_t: optional string`
  - `commit_policy: optional "immediate" | "on_change" | "on_blur" | "on_submit"`
  - `primary: optional bool`
- `0310/0311` 范围内，前端可写 pin 仅允许使用：
  - `direction = "in"`
- 每个节点内，同一个 `trigger + direction` 组合只允许出现一次。
- 若节点没有 `writable_pins`，则说明该节点不具备正式 pin 直寻址写入口。

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
- 认知更新通过系统函数 `update_scene_context` 执行，触发来源为 `event_trigger_map.bus_event`。
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
- `bus_event` 从 mailbox/compat 层出发时，不再存在“默认 direct Matrix forward” 兜底。
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
