---
title: "Label Type Registry"
doc_type: ssot
status: active
updated: 2026-05-10
source: ai
---

# Label Type Registry

> 本文件是所有 `label.t` 的目标权威注册表。运行时 `_applyBuiltins` 的 dispatch 列表必须与本表一致；不一致必须以失败和修正处理，不得用兼容层遮蔽。
> 新增 `label.t` 必须先在本表注册，再实现运行时代码。
>
> 0356 起，PIN 连接合同由 `docs/ssot/pin_connection_contract_v2.md` 接管。0357 起，runtime 对 `pin.connect.model`、`pin.log.*`、`(self, ...)` / `(func, ...)` 端点写法执行硬拒绝；它们不是当前输入面，也不得通过兼容层恢复。

Authority:
- Below `CLAUDE.md`, architecture SSOT, and runtime semantics.
- This file is the target authority for `label.t` registration and placement rules.

Conflict behavior:
- If runtime dispatch accepts a label type not registered here, fix runtime or register the label through an iteration.
- If lower docs mention unregistered or deprecated label types as current inputs, update those docs.

---

## 1. 常规参数标签

用于存储数据值，运行时不对其产生副作用。

| label.t | 说明 | value 类型 |
|---|---|---|
| `str` | 字符串 | string |
| `int` | 整数 | number |
| `float` | 浮点数 | number |
| `bool` | 布尔 | boolean |
| `list` | 列表 | array |
| `tuple` | 元组 | array |
| `dict` | 字典 | object |
| `json` | 任意 JSON | any |

---

## 2. 模型声明标签

规则：
- 每个 materialized Cell 必须且只能有一个有效模型标签（effective model label）。
- 有效模型标签是 Cell 的主归属 / 主执行形态，不等于它只能被一个上层 scope 发现。
- 在 table/matrix 作用域内，尚未物化且未显式声明的普通 Cell，其有效模型标签默认为 `model.single`。
- `model.name` 只允许写在模型自己的 `(0,0,0)`。
- Cell 的 scope discoverability 是派生语义：
  - 父模型可经 `model.submt` 逐层看到 descendants
  - `model.matrix` 可看到其范围内的 `model.single` 与更小矩阵
- 执行时不按“当前属于哪些 scope”分支，而按 pin 链与目标坐标传播。

| label.t | 说明 | key | value | 位置约束 |
|---|---|---|---|---|
| `model.single` | 普通 Cell / 简单模型声明 | `model_type` | 类型名（如 `Code.JS`） | 任意 Cell；table/matrix 普通 Cell 可隐式默认为本类型 |
| `model.matrix` | 矩阵模型根声明 | `model_type` | 类型名（如 `Data.Array.One`） | 矩阵自身相对 `(0,0,0)`；创建必填 |
| `model.table` | 模型表根声明 | `model_type` | 类型名（如 `Flow`） | 模型 `(0,0,0)`；创建必填 |
| `model.submt` | 子模型挂载/映射 Cell | `model_type` | 子模型 id | 任意 hosting Cell；该 Cell 仅允许 `model.submt` + `pin.in` / `pin.out` / `pin.login` / `pin.logout` |

补充约束：
- `model.submt` 是 single-parent 挂载：同一个 child model 在任一时刻只能被一个父模型 hosting Cell 挂载。
- `model.submt` 只负责父子挂载，不自动赋予父模型对子模型内部 label 的 direct write 权限。
- child model 的正式输入/输出仍必须通过 hosting Cell 暴露出来的 pin relay 进入；最终落盘只能由 child root 默认程序（如 `mt_write`）、child owner materializer 或 importer/installer 明确执行。
- 删除 `model.submt` 仅删除父子挂载关系，不自动删除 child model 数据；只有删除 child model 自己的 `(0,0,0)` 根声明后，才删除整个 child model。
- 除 Model 0 外，每个模型都必须通过某个父模型 Cell 上的 `model.submt` 显式挂载进入模型层级。

根程序约定：
- 每个正数 `model.table` root `(0,0,0)` 默认携带 `mt_write` / `mt_bus_receive` / `mt_bus_send` 三类程序入口。
- 普通 Cell 发起正式写入时，必须通过当前模型内显式 `pin.connect.cell` 把 `write_label_req` 路由到 root `mt_write_req`。
- 早期 `(0,1,0)` reserved helper executor cell 已删除；`helper_executor`、`owner_apply`、`owner_apply_route`、`owner_materialize` 不再由 runtime 自动种入，也不得作为默认物化入口。

### 2.0 Worker：软件工人类型标签

这些标签写在软件工人 root Model 0 `(0,0,0)`，用于标明该软件工人是数字员工管理软件工人还是一般软件工人，并参与启动期身份与角色校验。

| type | 解释 | key | value | 示例 |
|---|---|---|---|---|
| `worker.role` | 软件工人类型 | `sys_worker_role` | `WSM` 社区管理；`DEM` 数字员工管理；`V1N` 普通软件工人 | `[{"k":"sys_worker_role","t":"worker.role","v":"DEM"}]` |
| `worker.id` | 软件工人 ID | `sys_worker_id` | `ws/dam/pic/de/sw`，五段数字 | `[{"k":"sys_worker_id","t":"worker.id","v":"5/10/28/35/13"}]` |

位置约束：
- `sys_worker_id` 和 `sys_worker_role` 只能写在 Model 0 `(0,0,0)`。
- `sys_worker_id` 首次 trusted bootstrap 写入后锁定，后续只能通过显式维护流程变更。
- `sys_worker_role` 的值为 `"DEM"` 才允许声明 `pin.bus.mb.*`。`"V1N"` 普通软件工人只能声明 `pin.bus.cb.*`。`"WSM"` 当前仅作为社区管理角色保留，不得被当作 `"DEM"` 使用。
- 旧 `v1n_id`、旧 `k=worker.role` 和旧 `is_DEM` 都不是合法输入面。

### 2.1 UI Bootstrap Boundary (0210 Freeze)

- `ui_ast_v0`、`ws_selected_ast`、共享 mailbox root AST 都不是新的 label.t 合同；它们只是普通 `json` 数据标签在某些历史实现里的投影结果。
- 新的 UI bootstrap / mount 语义只能建立在：
  - `model.single` / `model.matrix` / `model.table` / `model.submt`
  - 显式页面目录
  - materialized Cell label
- 若某条 UI 路径需要把 `ui_ast_v0` 或共享 AST 当作 authoritative bootstrap，必须在 iteration 中被记为 legacy-debt / forbidden，而不是注册成新的 label.t。

---

## 3. PIN 端口标签（结构性声明，产生运行时副作用）

### 3.1 数据通道

| label.t | 说明 | key | value | 位置约束 |
|---|---|---|---|---|
| `pin.in` | Cell 级输入端口；写在非系统模型 root `(0,0,0)` 时也承担模型根边界输入 | 端口名 | `null` 或临时 ModelTable payload array | 任意 Cell |
| `pin.out` | Cell 级输出端口；写在非系统模型 root `(0,0,0)` 时也承担模型根边界输出 | 端口名 | `null` 或临时 ModelTable payload array | 任意 Cell |
| `pin.bus.cb.in` | 控制总线边界输入端口 | 端口名 | `null` 或临时 ModelTable payload array | 仅软件工人 Model 0 (0,0,0) |
| `pin.bus.cb.out` | 控制总线边界输出端口 | 端口名 | `null` 或临时 ModelTable payload array | 仅软件工人 Model 0 (0,0,0) |
| `pin.bus.mb.in` | 管理总线边界输入端口 | 端口名 | `null` 或临时 ModelTable payload array | 仅 DEM 软件工人 Model 0 (0,0,0) |
| `pin.bus.mb.out` | 管理总线边界输出端口 | 端口名 | `null` 或临时 ModelTable payload array | 仅 DEM 软件工人 Model 0 (0,0,0) |

0331 payload 约束：
- 正式业务 pin 的非空 value 必须是 `docs/ssot/temporary_modeltable_payload_v1.md` 定义的 record array。
- 对象 envelope（如 `{op, records}` / `{action, target}`）不再是正式 pin value。
- pin 名称 / 接收程序模型决定动作语义；payload 本身只表达数据。

0347 message / materialization 约束：
- pin value 中的 record array 是 Temporary ModelTable Message：`format is ModelTable-like; persistence is explicit materialization`。
- `id` 是 message-local 临时 id，不是正式 `model_id`。
- 写入 pin、route、bus、log/trace 或前端 projection 都不自动创建或更新正式 ModelTable。
- 只有接收程序模型、当前模型 root 默认程序（如 `mt_write`）、owner materializer 或 importer/installer 明确执行 materialization 时，才允许产生正式 `add_label` / `rm_label` side effect。

### 3.2 日志通道

行为与数据通道一致，但类型隔离（不可与数据通道混连）。

说明：0356 目标合同中日志通道使用 `pin.login` / `pin.logout`。早期 `pin.log.in` / `pin.log.out` / `pin.log.bus.*` 在 0357 后会被 runtime 拒绝。

| label.t | 说明 | key | value | 位置约束 |
|---|---|---|---|---|
| `pin.login` | Cell 级日志输入；写在非系统模型 root `(0,0,0)` 时也承担模型根边界日志输入 | 端口名 | `null` 或临时 ModelTable payload array | 任意 Cell |
| `pin.logout` | Cell 级日志输出；写在非系统模型 root `(0,0,0)` 时也承担模型根边界日志输出 | 端口名 | `null` 或临时 ModelTable payload array | 任意 Cell |

### 3.3 连接规则

- `pin.in` ↔ `pin.out` 互连；`pin.login` ↔ `pin.logout` 互连。
- 数据通道与日志通道不可混连。
- 同层级内 `in` 只连 `out`。
- 子模型对外连接只通过 (0,0,0) 的边界端口。

---

## 4. PIN 连接声明标签（结构性声明）

| label.t | 说明 | key | value 格式 | 位置约束 |
|---|---|---|---|---|
| `pin.connect.label` | Cell 内接线 | 连接名 | `[{from: "pinName", to: ["pinName", ...]}, ...]` | 任意 Cell |
| `pin.connect.cell` | Model 内跨 Cell 路由 | 连接名 | `[{from: [p,r,c,"pinName"], to: [[p,r,c,"pinName"], ...]}, ...]` | 仅 (0,0,0) |

`pin.connect.model` 已从 0356 目标合同中移除。跨模型通信必须通过 `model.submt` hosting Cell 暴露的父模型内 Cell 引脚、子模型 root `(0,0,0)` 的边界引脚，以及父模型内 `pin.connect.cell` 完成。

`pin.connect.label` 端点规则：

- 端点直接使用同一个 Cell 内的引脚 key。
- 可连接当前 Cell 上的 `pin.in` / `pin.out` / `pin.login` / `pin.logout`。
- 可连接当前 Cell 上函数自动拥有的 `{funcName}:in` / `{funcName}:out` / `{funcName}:logout`。
- 不允许 `(self, x)` / `(func, f:in)` / numeric prefix。
- 不允许引用其他 Cell 或其他 model id。

`pin.connect.cell` 端点规则：

- 端点必须是同一模型内 `[p,r,c,"pinName"]`。
- `"pinName"` 必须是目标 Cell 上声明的 Cell 引脚 key。
- 不允许在 `pin.connect.cell` 中直接引用函数引脚。
- 函数触发必须先到函数所在 Cell 的普通引脚，再由该 Cell 的 `pin.connect.label` 转给函数引脚。

---

## 5. 函数标签（结构性声明）

| label.t | 说明 | key | value 格式 | 位置约束 |
|---|---|---|---|---|
| `func.js` | JS 函数 | 函数名 | `{"code": "async (ctx) => { ... }", "modelName": "scope"}` | 任意 Cell |
| `func.python` | Python 函数 | 函数名 | `{"code": "def func(ctx): ...", "modelName": "scope"}` | 任意 Cell |

value 字段说明：
- `code`（必填）：函数代码。
- `modelName`（推荐）：声明函数作用域；矩阵模型启用后用于父/子矩阵消歧。

旧格式说明：
- `value: "code string"` 不再执行。
- 新模型必须使用结构化 value。

每个函数自动关联三个引脚：
- `{funcName}:in`（输入）
- `{funcName}:out`（输出）
- `{funcName}:logout`（日志输出）

---

## 6. 流程标签（Tier 2 约定，非运行时结构性声明）

运行时不直接解释 `flow.*` 标签。由流程管理器函数（Tier 2 模板）读取并执行。

| label.t | 说明 | key | value |
|---|---|---|---|
| `flow.start` | 流程起节点 | `~StepName~` | 步骤名称 |
| `flow.develop` | 流程承节点 | `~StepName~` | 步骤名称 |
| `flow.trans` | 流程转节点 | `~StepName~` | 步骤名称 |
| `flow.end` | 流程合节点 | `~StepName~` | 步骤名称 |
| `flow.connect` | 流程节点连接 | `~NEXT~` / `~TRUE~` / `~FALSE~` | 目标步骤名 |
| `flow.develop.outpin` | 承节点外部引脚 | `~OutPin~` | 引脚名称 |
| `flow.develop.addend` | 承节点结束控制 | `~isAddEnd~` | true/false |
| `flow.trans.usecode` | 转节点代码控制 | `~isUseCode~` | true/false |
| `flow.trans.logicaltype` | 转节点判断逻辑 | `~LogicalType~` | `and` / `or` |
| `flow.trans.judgements` | 转节点判断条目 | `~Judgements~` | 判断条目列表 |

---

## 7. 数据模型 PIN 接口规范（Tier 2 约定）

0348 起，Data.* 目标合同由 `docs/ssot/feishu_data_model_contract_v1.md` 接管。

所有 Feishu-aligned 数据模型子类型共享统一 PIN 接口：

| pin 名称 | 方向 | 说明 |
|---|---|---|
| `add_data:in` | pin.in | 添加数据 |
| `delete_data:in` | pin.in | 删除数据 |
| `update_data:in` | pin.in | 修改数据 |
| `get_data:in` | pin.in | 获取数据（请求） |
| `get_data:out` | pin.out | 获取数据（响应） |
| `get_all_data:in` | pin.in | 获取全部数据（请求） |
| `get_all_data:out` | pin.out | 获取全部数据（响应） |
| `get_size:in` | pin.in | 获取数据量（请求） |
| `get_size:out` | pin.out | 获取数据量（响应） |

0296-era names such as `add_data_in`, `get_data_out`, `enqueue_data_in`, `dequeue_data_in`, `push_data_in`, `pop_data_in`, and `peek_data_in` are not the target contract after 0348. As of 0355, `Data.Array.One` does not provide aliases for the Array-era underscore pins; remaining Queue/Stack artifacts must be replaced in their own no-compatibility iterations.

---

## 8. Removed Historical Aliases（非当前规范）

以下旧名可能仍出现在历史文档或负向测试中，但它们不是当前允许的新工作输入面。
runtime 不得新增或保留兼容层来支持这些旧名；结构性旧类型写入必须失败。

| label.t | 替代方案 |
|---|---|
| `BUS_IN` | 按总线角色使用 `pin.bus.cb.in` 或 `pin.bus.mb.in` |
| `BUS_OUT` | 按总线角色使用 `pin.bus.cb.out` 或 `pin.bus.mb.out` |
| `CELL_CONNECT` | `pin.connect.label` |
| `cell_connection` | `pin.connect.cell` |
| `MODEL_IN` | 非系统模型 root `(0,0,0)` 上的 `pin.in` |
| `MODEL_OUT` | 非系统模型 root `(0,0,0)` 上的 `pin.out` |
| `pin.table.in` | 非系统模型 root `(0,0,0)` 上的 `pin.in` |
| `pin.table.out` | 非系统模型 root `(0,0,0)` 上的 `pin.out` |
| `pin.single.in` | 非系统模型 root `(0,0,0)` 上的 `pin.in` |
| `pin.single.out` | 非系统模型 root `(0,0,0)` 上的 `pin.out` |
| `pin.log.in` | `pin.login` |
| `pin.log.out` | `pin.logout` |
| `pin.log.bus.in` | 已移除；不得使用 |
| `pin.log.bus.out` | 已移除；不得使用 |
| `pin.log.table.in` | `pin.login` |
| `pin.log.table.out` | `pin.logout` |
| `pin.log.single.in` | `pin.login` |
| `pin.log.single.out` | `pin.logout` |
| `IN` | `pin.in` |
| `function` | `func.js` |
| `subModel` | `model.submt` |
| `submt` | `model.submt` |
| `PIN_IN` / `PIN_OUT` | （已废弃） |
| `label_connection` | `pin.connect.label` |
| `trigger_funcs` | `pin.connect.label` |
| `function_PIN_IN` / `function_PIN_OUT` | （已废弃） |
| `pin.connect.model` | （已移除）通过 `model.submt` hosting Cell + child root pins + `pin.connect.cell` 表达 |
| `(self, pinName)` / `(func, funcName:in)` / `(modelId, pinName)` | `pin.connect.label` 直接写同 Cell 端点名 |

## 9. Imported App Host Ingress Declaration（0321 MVP）

除 label.t 之外，当前仓库新增一条 v1 root label 声明，用于 imported slide app 的宿主接入：

- Cell:
  - imported app root `(0,0,0)`
- Label:
  - `k = host_ingress_v1`
  - `t = json`

v1 当前只允许：

- 一个 primary boundary
- `semantic = submit`
- `locator_kind = root_relative_cell`
- `locator_value = { p, r, c }`
- `pin_name` 对应的目标 label 必须是 `pin.in`

它不是新的 label.t，而是 imported app root 上的正式声明 key。

宿主安装后自动生成的接入 labels 当前包括：

- `Model 0`:
  - `pin.bus.mb.in`
  - `pin.connect.cell`（从 Model 0 root 系统边界 adapter 路由到 imported app 的 hosting Cell 引脚）
- imported app hosting Cell:
  - `model.submt`
  - 与 imported model root `(0,0,0)` 边界对应的 `pin.in` / `pin.out`
- imported model root:
  - `pin.in`
  - `pin.connect.cell`

删除 imported app 时，宿主必须清理安装时自动补上的 Model 0 / hosting Cell labels。

## 10. Imported Slide App Remote Bus Endpoint（0362）

除 label.t 之外，0362 新增一条 imported slide app root label 声明，用于表达远端提供方入口：

- Cell:
  - imported app root `(0,0,0)`
- Label:
  - `k = remote_bus_endpoint_v1`
  - `t = json`

它不是新的 label.t，不是 ZIP sidecar manifest，也不是 MBR per-app route。它只是 imported app 模型表内的 root 声明。

v1 只允许声明远端默认目标：

```json
{
  "transport": "mqtt",
  "to": {
    "worker_id": "RE",
    "model_id": 3000
  }
}
```

约束：

- `to.worker_id` 是远端提供方 worker / Remote Entity 标识。
- `to.model_id` 是远端提供方 worker 内部的 provider model id。
- `to.pin` 不写在 `remote_bus_endpoint_v1` 中；运行时必须由触发动作的公开 pin 名补齐，例如 `submit1`。
- `route.reply_to` 不允许由 ZIP / imported records 提供或覆盖。`route.reply_to` 是 UI Server 运行时根据当前安装实例与宿主身份生成的 server-owned route metadata。
- MBR 不得要求为每个 imported app 写入静态 per-app route label；跨 worker 目的地必须来自运行时消息的 `route.to`。

与之配套的 `dual_bus_model` 必须显式列出可外发的公开 pin：

```json
{
  "mode": "imported_host_egress",
  "egress_pins": ["submit1"]
}
```

`egress_pins` 可以包含多个公开 pin，例如 `submit1`、`submit2`。每个 pin 都必须是 imported app root `(0,0,0)` 上已声明的普通 `pin.out`；不得写成 `submit1:in` 这类函数端点。

## 11. Host-owned UI Egress Binding（0363）

0363 新增目标 label.t：

- `t = ui.egress.binding.v1`

它只允许由 UI Server installer 在 imported slide app 安装完成后写入，不允许出现在 provider ZIP / imported records 中。

| label.t | 说明 | key | value | 位置约束 |
|---|---|---|---|---|
| `ui.egress.binding.v1` | 记录 imported app 公开 `pin.out` 与宿主系统总线出口之间的 host-owned egress 绑定；供 UI 投影显示，不替代实际 pin route | 绑定名，例如 `ui_egress_submit1_binding` | JSON object | 安装后的 imported app root `(0,0,0)`；仅 UI Server installer 可写 |

value 必须至少包含：

- `from_pin`: imported root 上的公开 `pin.out` 名称。
- `bus`: `"management"` 或 `"control"`；UI/滑动 App 用户交互默认使用 `"management"`。
- `host_model_id`: 当前 worker root model id，目标为 `0`。
- `host_cell`: 目标为 `[0,0,0]`。
- `host_pin_type`: 必须是 `pin.bus.mb.out` 或 `pin.bus.cb.out`。
- `host_pin_key`: 宿主生成的系统总线出口 key。
- `target`: `{ worker_id, model_id, pin }`，由 `remote_bus_endpoint_v1` 与当前公开出口 pin 合成。
- `reply_pin`: 回包进入本地 imported app 的公开 pin。
- `owned_by`: 必须是 `"ui-server-installer"`。

约束：

- `ui.egress.binding.v1` 只能描述安装后的接线事实；不能授权 UI 绕过 pin route 直接发 bus 消息。
- 若 binding 存在但对应 `pin.connect.*` 或系统总线出口缺失，安装状态必须判为不完整。
- 删除 imported app 时，宿主必须同步删除 binding 记录。
